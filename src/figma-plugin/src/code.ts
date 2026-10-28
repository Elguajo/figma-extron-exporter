import { PROFILES, ROLE_ID, CONTROL_KINDS, ELEMENT_KINDS, isControlKind, elementCount, fail, integer, key, readMetadata, metadataSchema, text, type MetadataInput, type Metadata, type Profile, type Role } from './model.ts';
import { exportCaptured, type Capture } from './export.ts';
import { createDemo, tag } from './demo.ts';
import { recognize, applyRecognition, type RecognitionPlan } from './recognize.ts';
import { createKit } from './kit.ts';
import { isStrokeLine,readStrokeLine } from './stroke-line.ts';
import { sweepExportLeftovers } from './read-node.ts';
import { type ProjectNode,type ProjectOptions } from './project.ts';
import { ExportScope, selected, pageOf, selectionKind, type ScopeMode } from './scope.ts';
import { requireNodeForKind } from './assignment-rules.ts';
import { containerSuffix,freeKey } from './assignment-repair.ts';
import { isButtonContainer } from './button-artwork.ts';
import { buttonPreparationSummary, markBackground, prepareButtons, presetPreviews, rememberPreset } from './button-preparation.ts';
import type { ButtonStatePair } from './button-preparation.ts';
import type { ButtonPreparationSummary } from './model.ts';
import { focusNode } from './focus-node.ts';
import { MANUAL_KEY } from './key-sync.ts';
import { DEFAULT_NUMBERING, planNumbering, applyNumbering, type NumberingOptions, type NumberingPlan } from './button-numbering.ts';
import { requireLatinName } from './latin-name.ts';
import { setButtonTextMode, type ButtonTextMode } from './button-native-text.ts';
import { controlText,formatVariant } from './kit-contract.ts';
import { MANUAL_PATTERN,hasManualPattern,patternProblem,resolvePattern } from './datetime-format.ts';
import { bindPopups,popupBindingInfo,savePopupPlace,saveContainerSettings,saveDraft,popupContext } from './popup-binding.ts';
import { authoringLinks,setReferenceTarget,setSelectionGroup,setStartPage,linkedNode,type LinkContext,type AuthoringLinks } from './authoring-links.ts';
import { createOrigin,planIdMap,applyIdMap,type IdMapPlan } from './id-map.ts';
import { settingsProjects } from './project-settings.ts';
import type { ProjectSettings } from './model.ts';
// The build injects only our two local PNG resources; no remote source or server.
declare const __ICONS__: Record<string,number[]>;
declare const __html__:string;
figma.showUI(__html__,{width:420,height:720,themeColors:true});
try{sweepExportLeftovers(figma.currentPage);}catch{ /* A leftover copy is harmless; startup must not fail on it. */ }
const scopeContext = new ExportScope();
let settingsProjectId:string|undefined;
function availableSettingsProjects(resolve=()=>scopeContext.resolve()) {
  let context:LinkContext|undefined;
  if(scopeContext.mode!=='selection')try{context=resolve();}catch{ /* Discover projects even when the export scope is unavailable. */ }
  return settingsProjects(scopeContext.profile,context);
}
let recognitionMode:ScopeMode='selection';
let busy=false;
let idMapPlan:IdMapPlan|undefined,idMapToken=0;
let recognition:RecognitionPlan|undefined, recognitionToken=0;
let diagnosticSelectionId:string|undefined;
let numberingOptions={...DEFAULT_NUMBERING},numberingPlan:NumberingPlan|undefined,numberingToken=0,numberingEnabled=false;
function numberingView() {
  numberingPlan=undefined;
  try {
    numberingPlan=planNumbering(figma.currentPage.selection,numberingOptions);
    return {type:'numbering-plan',token:++numberingToken,options:numberingOptions,rows:numberingPlan.rows};
  } catch(error) {return {type:'numbering-plan',options:numberingOptions,rows:[],error:error instanceof Error?error.message:String(error)};}
}
function postRecognition(plan:RecognitionPlan):void {
  recognition=plan;recognitionMode=scopeContext.mode;
  figma.ui.postMessage({type:'recognition',token:++recognitionToken,rows:plan.rows,errors:plan.errors,issues:plan.issues,warnings:plan.warnings});
}
const stored=(node:BaseNode)=>readMetadata(node,{allowCopied:true});
function linksContext(resolve:()=>ReturnType<ExportScope['resolve']>=()=>scopeContext.resolve(),forReference=false):LinkContext {
  const selection=figma.currentPage.selection,node=selection[0];
  // A place is edited in its owning project, even when the remembered export
  // subset omits its screen or an as-yet unbound sibling popup group.
  const reference=forReference&&selection.length===1&&selectionKind(node)==='popup-ref';
  let profile=scopeContext.profile;
  try{const resolved=resolve();profile=resolved.profile;if(resolved.scope.kind==='project'&&!reference)return resolved;}catch{ /* Multi-selection can be authored before choosing an export scope. */ }
  if(!node)fail('links','Выберите элемент проекта.');
  return {...popupContext(node,profile),profile};
}

function prepare(profile:Profile|undefined):void {
  const node=selected();
  if(node.type!=='FRAME')fail('node-type','Для подготовки выберите внешний Frame экрана.');
  const kind=selectionKind(node);
  if(kind&&kind!=='page')fail('placement','Подготовка экрана недоступна для этого назначения. Выберите внешний Frame экрана.');
  if(!profile||!Object.prototype.hasOwnProperty.call(PROFILES,profile))fail('profile','Выберите профиль панели.');
  const canvas=PROFILES[profile];
  if(node.width!==canvas.width||node.height!==canvas.height)fail('profile',`Выбранный профиль требует Frame ${canvas.width}×${canvas.height}; сейчас ${node.width}×${node.height}. Выберите подходящий профиль или измените размер макета самостоятельно.`);
  const metadata=readMetadata(node);
  if(metadata) {
    if(metadata.kind!=='page')fail('placement','У этого Frame уже есть назначение элемента. Выберите внешний Frame экрана.');
    if(metadata.profile!==profile)fail('profile','У экрана уже сохранён другой профиль. Измените его через «Назначение выбранного элемента».');
    return;
  }
  let parent=node.parent;
  while(parent&&parent.type!=='PAGE') {
    if(readMetadata(parent)?.kind==='page')fail('placement','Выбран элемент внутри подготовленного экрана. Выберите внешний Frame экрана.');
    parent=parent.parent;
  }
  requireLatinName(node,'screen_');
  const used=new Set<string>();let nextId=100;
  function collect(parent:BaseNode&ChildrenMixin){for(const child of parent.children){const m=stored(child);if(m?.key)used.add(m.key);if(m&&['page','popup'].includes(m.kind))nextId=Math.max(nextId,integer(m.objectId,1,65534,'ID контейнера')+1);if('children' in child&&(!m||['project','popup-group'].includes(m.kind)))collect(child);}}
  collect(figma.currentPage);
  tag(node,{kind:'page',key:freeKey('page.'+containerSuffix(node.name),used),objectId:integer(nextId,1,65534,'ID контейнера'),profile,projectName:text(node.name,'Имя проекта')});
}

function exportRoot():{root:ProjectNode;options:ProjectOptions;captured:Capture;assignmentSummary:string}|null {
  const resolved=scopeContext.resolve();
  const profile=resolved.profile;
  const plan=recognize(resolved.root,profile,resolved.options);
  if(plan.errors.length){postRecognition(plan);return null;}
  const captured=applyRecognition(plan);
  const previewCount=new Set(plan.visibility.map(change=>change.node.parent!.id)).size;
  const assignmentSummary=[plan.writes.length?`Автоматически сохранено назначений: ${plan.writes.length}.`:'',plan.keys.length?`Ключи обновлены по именам слоёв: ${plan.keys.length}; ID не изменены.`:'',previewCount?`Автоматически настроен предпросмотр кнопок: ${previewCount}. Все состояния сохранены.`:''].filter(Boolean).join(' ');
  // The plan just applied equals a fresh recognition of the same scope: reuse it.
  publish(false,{root:resolved.root,options:resolved.options,plan});return {...resolved,captured,assignmentSummary};
}
// One canvas event resolves the export scope once; nothing in publish() changes it.
function once<T>(compute:()=>T):()=>T {
  let state:{value:T}|{error:unknown}|undefined;
  return ()=>{state??=(()=>{try{return {value:compute()};}catch(error){return {error};}})();if('error' in state)throw state.error;return state.value;};
}
const sameMembers=(a:ProjectOptions,b:ProjectOptions)=>(a.members?.map(n=>n.id).join()??'')===(b.members?.map(n=>n.id).join()??'');
function publish(keepRecognition=false,applied?:{root:ProjectNode;options:ProjectOptions;plan:RecognitionPlan}):void {
  const selection=figma.currentPage.selection,n=selection.length===1?selection[0]:undefined;
  const resolveScope=once(()=>scopeContext.resolve());
  let warning='',metadata:Metadata|null=null;
  try{scopeContext.refreshSelection();if(n)metadata=stored(n);}catch(e){warning=(e as Error).message;}
  let states:{stateId?:number;name?:string;role?:Role}[]=[];
  // Preview only reads state-local roles/slots. ID-only saving claims the button
  // while copied descendants remain pending until check/export repairs them.
  try{if(n&&isButtonContainer(n)&&['button','level'].includes(metadata?.kind??''))states=n.children.map(stored).filter(m=>m?.kind==='state').map(m=>({stateId:m!.stateId,name:m!.stateName,role:m!.role}));}catch(e){warning=warning||(e as Error).message;}
  let scope:{id:string;name:string;kind:string;profile?:Profile}|undefined;
  let scopeHint='';
  let preparedLinks:{context:LinkContext;plan:RecognitionPlan}|undefined;
  let canRecognize=false;
  let canPrepare=false,kind:Metadata['kind']|undefined;
  try{if(n)kind=selectionKind(n);canPrepare=scopeContext.canPrepare;}catch{ /* Invalid saved assignments remain available for manual repair. */ }
  let buttonWorkflow:ButtonPreparationSummary|undefined;
  let buttonScope:ReturnType<ExportScope['resolveButtons']>['scope']|undefined;
  try {
    const resolved=scopeContext.resolveButtons();
    buttonScope=resolved.scope;buttonWorkflow=buttonPreparationSummary(resolved.root,resolved.options);
  }catch{ /* Export guidance and manual assignments remain available. */ }
  try{canRecognize=scopeContext.canRecognize;}catch{ /* Metadata errors are shown above. */ }
  try {
    const resolved=resolveScope();
    const {root,options}=resolved,rm=stored(root);
    canRecognize=resolved.canRecognize;scopeHint=resolved.hint;scope=resolved.scope;
    if(rm?.kind==='project'||resolved.scope.kind==='project'){
        // Offer draft identities without writing on selection, even when
        // the project artwork still needs repair.
        const plan=applied&&applied.root===root&&sameMembers(applied.options,options)&&applied.plan.profile===resolved.profile?applied.plan:recognize(root,resolved.profile,options);
        preparedLinks={context:resolved,plan};
        const proposed=new Map(plan.writes.map(w=>[w.node.id,w.metadata]));
        const read=(node:SceneNode|PageNode)=>proposed.get(node.id)??readMetadata(node);
        if(n)metadata=read(n);
    }else if(n){
      // Show new/copy identities and automatic names without saving them.
      // Reuse the authoring draft below, keeping one snapshot per selection.
      const context=linksContext(resolveScope),plan=recognize(context.root,context.profile,context.options);
      preparedLinks={context,plan};
      metadata=plan.writes.find(w=>w.node.id===n.id)?.metadata??metadata;
    }
  }catch(e){if(scopeContext.mode!=='selection'){canRecognize=false;scopeHint=(e as Error).message;}}
  // A newly copied screen can be selected for editing before it joins the
  // remembered export members. Show its own draft, not the source's metadata.
  if(n?.type==='FRAME'&&metadata?.kind==='page'&&metadata.ownerNodeId!==n.id)try{
    metadata=recognize(n,metadata.profile??scopeContext.profile).writes.find(w=>w.node.id===n.id)?.metadata??metadata;
  }catch{ /* The existing assignment remains available for manual repair. */ }
  let datetime:{pattern?:string;preview?:string;source?:string;error?:string;manual:boolean}|undefined;
  try{
    const copy=n&&controlText(n);
    if(n&&copy&&(metadata?.kind==='datetime'||!metadata&&/^(dt|datetime)_/i.test(n.name))){
      const manual=hasManualPattern(n),resolved=resolvePattern({text:copy,wrapped:copy!==n,variant:formatVariant(n),saved:metadata?.pattern,manual});
      datetime={...resolved,manual};
    }
  }catch(e){warning=warning||(e as Error).message;}
  const buttonStylePreviews=presetPreviews();
  const buttonPresets={normal:buttonStylePreviews.normal.name,feedback:buttonStylePreviews.feedback.name};
  let links:AuthoringLinks|undefined;
  try{
    const context=linksContext(resolveScope);
    const plan=preparedLinks&&preparedLinks.context.root===context.root&&preparedLinks.context.profile===context.profile&&sameMembers(preparedLinks.context.options,context.options)?preparedLinks.plan:undefined;
    links=authoringLinks(context,selection,plan);
    if(n&&kind==='popup-ref'){
      const referenceContext=linksContext(resolveScope,true);
      if(referenceContext.root!==context.root||referenceContext.profile!==context.profile||!sameMembers(referenceContext.options,context.options))
        links.reference=authoringLinks(referenceContext,selection).reference;
    }
  }catch{ /* Incomplete layouts retain manual assignment fields. */ }
  let projectSettings:ProjectSettings|undefined;
  if(!selection.length){
    const projects=availableSettingsProjects(resolveScope);
    const project=projects.find(p=>p.id===settingsProjectId)??(projects.length===1?projects[0]:undefined);
    settingsProjectId=project?.id;
    projectSettings={projects:projects.map(({id,name})=>({id,name})),projectId:project?.id,pages:[]};
    if(project)try{
      const context=project.context;
      const plan=preparedLinks&&preparedLinks.context.root===context.root&&preparedLinks.context.profile===context.profile&&sameMembers(preparedLinks.context.options,context.options)?preparedLinks.plan:undefined;
      const value=authoringLinks(context,[],plan);
      projectSettings.pages=value.pages;projectSettings.startId=value.startId;
    }catch(e){projectSettings.error=(e as Error).message;}
  }
  try{scopeContext.persist(scope?.profile??scopeContext.profile);}catch{warning=warning||'Не удалось сохранить настройки текущей страницы. Назначения слоёв остаются в файле Figma.';}
  let popupBinding:ReturnType<typeof popupBindingInfo>;try{popupBinding=popupBindingInfo(scope?.profile??scopeContext.profile);}catch(e){warning=warning||(e as Error).message;}
  figma.ui.postMessage({type:'selection',keepRecognition,id:n?.id??null,name:n?.name??(selection.length?`Выбрано фреймов: ${selection.length}`:'Выберите экраны на холсте'),nodeType:n?.type,metadata,selectionKind:kind,canPrepare,warning,states,scope,links,projectSettings,popupBinding,buttonPresets,buttonStylePreviews,buttonScope,buttonWorkflow,datetime,scopeMode:scopeContext.mode,canRecognize,scopeHint,profile:scope?.profile??scopeContext.profile,numbering:numberingEnabled?numberingView():undefined});
}
function apply(input:Record<string,unknown>):void {
  const node=selected(),kind=input.kind as Metadata['kind'];
  if(!['project','page','popup','popup-group','state','image',...ELEMENT_KINDS].includes(kind))fail('kind','Выберите назначение.');
  if(kind==='popup-ref'){savePopupPlace(node,input,scopeContext.profile);return;}
  if(['page','popup','popup-group'].includes(kind)&&(!stored(node)||stored(node)?.kind===kind)){saveContainerSettings(node,input,scopeContext.profile);return;}
  // A key typed in the form stays fixed; an emptied field returns it to the
  // automatic key, which the next check derives from the layer name.
  const previous=stored(node),automatic=kind!=='state'&&input.key===''&&!!previous?.key;
  const data=automatic?{...input,key:previous!.key}:input;
  const manual=kind!=='state'&&!automatic&&input.keyEdited==='true'&&data.key!==previous?.key;
  const previousFlag=node.getPluginData(MANUAL_KEY),previousPatternFlag=node.getPluginData(MANUAL_PATTERN);
  if(manual)node.setPluginData(MANUAL_KEY,node.id);else if(automatic)node.setPluginData(MANUAL_KEY,'');
  // Same rule for the date/time pattern: typed stays, empty follows the design.
  if(kind==='datetime'){
    if(input.patternEdited!=='true')data.pattern=previous?.pattern??'';
    else node.setPluginData(MANUAL_PATTERN,data.pattern===''?'':node.id);
  }
  try{assignNode(node,kind,data);}catch(e){node.setPluginData(MANUAL_KEY,previousFlag);node.setPluginData(MANUAL_PATTERN,previousPatternFlag);throw e;}
}
// ID authoring must work before artwork is exportable. Recognition supplies a
// draft identity; persist only the selected node and any missing ancestors.
function saveIds(node:SceneNode,input:Record<string,unknown>,replacement?:MetadataInput):Metadata {
  // Author the selected node's project, independently of remembered export
  // members. A popup/button may be selected while another screen is exported.
  let profile=scopeContext.profile;
  for(let parent=node.parent;parent&&parent.type!=='PAGE';parent=parent.parent){const saved=stored(parent);if(saved?.profile){profile=saved.profile;break;}}
  const resolved={...popupContext(node,profile),profile};
  let member:BaseNode=node;while(member.parent&&member.parent!==resolved.root)member=member.parent;
  if(member.parent!==resolved.root||resolved.options.members&&!resolved.options.members.some(n=>n.id===member.id))fail('manual-ids',`${node.name}: выбранный слой не находится внутри экрана/popup проекта. Выберите саму кнопку в Layers.`);
  const draft=recognize(resolved.root,resolved.profile,resolved.options);
  const current=stored(node);
  const value=replacement??(current?.ownerNodeId===node.id?current:draft.writes.find(w=>w.node.id===node.id)?.metadata??current);
  if(!value||!ELEMENT_KINDS.includes(value.kind))fail('manual-ids',`${node.name}: у выбранного слоя нет назначения элемента Extron. Выберите внешний button_ / btn_ Frame кнопки, а не Text или состояние Off/On.${draft.errors.length?'\n'+draft.errors.join('\n'):''}`);
  requireNodeForKind(node,value.kind);
  const edited:Metadata={...value,schema:metadataSchema(value),ownerNodeId:node.id};
  if(input.objectId!==undefined&&input.objectId!=='')edited.objectId=integer(Number(input.objectId),1,1000000,'ID объекта');
  if(isControlKind(value.kind)&&input.controlId!==undefined&&input.controlId!=='')edited.controlId=integer(Number(input.controlId),1,65535,'ID управления Extron');
  // A broken name/type can exclude an assigned control from recognition rows.
  // Check actual owners directly; copies and unassigned drafts have no claim
  // to their inherited/proposed IDs and will get free ones during export.
  function check(other:SceneNode|PageNode):void {
    const m=stored(other);
    if(other.id!==node.id&&m?.ownerNodeId===other.id&&ELEMENT_KINDS.includes(m.kind)){
      const control=isControlKind(edited.kind)&&isControlKind(m.kind)&&m.controlId===edited.controlId;
      if(control||other.parent===node.parent&&m.objectId===edited.objectId)
        fail('duplicate-id',`ID ${control?'управления Extron '+edited.controlId:'объекта '+edited.objectId} уже занят: ${other.name}. Выберите свободный ID или сначала измените назначение этого слоя.`);
    }
    if('children' in other)for(const child of other===resolved.root?(resolved.options.members??other.children):other.children)check(child);
  }
  check(resolved.root);
  const registry=JSON.parse(draft.registry);
  registry.nextObjectId=Math.max(registry.nextObjectId,edited.objectId!+1);
  if(isControlKind(edited.kind))registry.nextControlId=Math.max(registry.nextControlId,edited.controlId!+1);
  draft.registry=JSON.stringify(registry);
  saveDraft(draft,[node],new Map([[node.id,edited]]));
  return readMetadata(node)!;
}
function assignNode(node:SceneNode,kind:Metadata['kind'],data:Record<string,unknown>):void {
  let value:MetadataInput;
  switch(kind){
    case 'project': case 'page': case 'popup': {
      if(!Object.prototype.hasOwnProperty.call(PROFILES,String(data.profile)))fail('profile','Выберите профиль панели.');
      const common={key:key(data.key,'Ключ'),profile:data.profile as Profile,projectName:text(data.projectName,'Имя проекта')};
      value=kind==='project'?{kind,...common}:{kind,...common,objectId:integer(Number(data.objectId),1,65534,'objectId')};
      break;
    }
    case 'popup-group':
      value={kind,key:key(data.key,'Ключ'),objectId:integer(Number(data.objectId),1,65535,'objectId')};break;
    case 'state': {
      if(!Object.prototype.hasOwnProperty.call(ROLE_ID,String(data.role)))fail('states','Выберите роль состояния.');
      const role=data.role as Role;
      value={kind,role,stateId:data.stateId!==''&&data.stateId!==undefined?integer(Number(data.stateId),0,7,'stateId'):ROLE_ID[role],stateName:text(data.stateName,'Имя состояния')};break;
    }
    case 'image':
      value={kind,key:key(data.key,'Ключ ресурса'),file:String(data.file),resourceName:String(data.resourceName)};break;
    default: {
      const identity={key:key(data.key,'Ключ'),objectId:integer(Number(data.objectId),1,1000000,'objectId')};
      value=isControlKind(kind)?{kind,...identity,controlId:integer(Number(data.controlId),1,65535,'controlId')}:{kind,...identity,controlId:null};
    }
  }
  if(kind==='button'){
    if(data.buttonMode==='legacy'){
      const previous=stored(node);
      if(previous?.kind!=='button'||previous.buttonMode)fail('button-mode','Прежние правила доступны только для уже сохранённой кнопки без нового типа.');
    }else{
      const mode=data.buttonMode??'on-off';
      if(mode!=='on-off'&&mode!=='feedback')fail('button-mode','Выберите 2 состояния (Off / On или Normal / Pressed) либо выбор с видом нажатия (Normal / Active / Pressed; Pressed необязателен для совместимости).');
      value.buttonMode=mode;
    }
  }
  if(kind==='page'||kind==='popup'){
    if(data.shownBy){if(!['start','program'].includes(String(data.shownBy)))fail('page','Выберите способ показа.');value.shownBy=data.shownBy as Metadata['shownBy'];}
    if(kind==='popup')value.modal=data.modal==='true';
  }
  if(kind==='image'||kind==='graphic'){
    value.key=key(data.key,'Ключ ресурса');value.file=String(data.file);value.resourceName=String(data.resourceName);
    if(!/^assets\/[a-z0-9][a-z0-9-]{0,63}\.png$/.test(value.file)||/[\r\n]/.test(value.file)||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.png$/.test(value.resourceName)||/[\r\n]/.test(value.resourceName))fail('image','Задайте assets/name.png и ASCII resourceName.png.');
  }
  if(kind==='level'||kind==='slider'){
    if(kind==='level'){if(!['slider','gauge','volume-led','multistate'].includes(String(data.display)))fail('level','Выберите режим Level.');value.display=data.display as Metadata['display'];}
    if(!['left-to-right','right-to-left','bottom-to-top','top-to-bottom'].includes(String(data.orientation)))fail('orientation','Выберите ориентацию.');
    value.orientation=data.orientation as Metadata['orientation'];value.min=integer(Number(data.min),0,2147483646,'Минимум');value.max=integer(Number(data.max),1,2147483647,'Максимум');if(value.min>=value.max)fail('range','Минимум должен быть меньше максимума.');
  }
  if(kind==='datetime'&&data.pattern){
    const pattern=String(data.pattern),problem=patternProblem(pattern);
    if(problem)fail('datetime-pattern',`Формат даты/времени «${pattern}»: ${problem}.`);
    value.pattern=pattern;
  }
  if(kind==='popup-ref'){if(!!data.popup===!!data.group)fail('popup-ref','Укажите popup или группу.');if(data.popup)value.popup=key(data.popup,'Ключ popup');if(data.group)value.group=key(data.group,'Ключ группы');}
  if(kind==='popup'||kind==='popup-ref')for(const field of ['exportBackground','exportStroke'] as const){
    if(data[field]!==undefined&&!['true','false'].includes(String(data[field])))fail('appearance','Выберите, экспортировать ли оформление popup.');
    if(data[field]==='true')value[field]=true;
  }
  if(CONTROL_KINDS.includes(kind)){
    const behavior:NonNullable<Metadata['behavior']>={};if(data.selectionGroup){if(kind!=='button')fail('behavior','Группа выбора применяется к кнопкам.');behavior.selectionGroup=key(data.selectionGroup,'Группа выбора');}
    for(const field of ['enabled','visible'] as const)if(data[field]!==''&&data[field]!==undefined){if(!['true','false'].includes(String(data[field])))fail('behavior','Выберите значение поведения.');behavior[field]=data[field]==='true';}
    if(Object.keys(behavior).length)value.behavior=behavior;
  }
  requireNodeForKind(node,kind);
  const previous=stored(node);
  if(isControlKind(kind)&&previous?.kind===kind&&(previous.ownerNodeId!==node.id||previous.objectId!==value.objectId||previous.controlId!==value.controlId)){
    saveIds(node,data,value);return;
  }
  if(kind==='line'&&isStrokeLine(node))readStrokeLine(node);
  const parentKind=node.parent&&!(kind==='project'&&node.parent.type==='PAGE')?readMetadata(node.parent)?.kind:undefined;
  const allowed=kind==='project'?[undefined]:kind==='page'?[undefined,'project']:kind==='popup'?['project','popup-group']:kind==='popup-group'?['project']:kind==='state'?['button','level']:kind==='image'?['state']:['page','popup'];
  if(!allowed.includes(parentKind))fail('placement',`${node.name}: недопустимый родитель для ${kind}.`);
  tag(node,value);
}
// Canvas events have no caller to report to: an unexpected error must reach the
// panel instead of leaving it showing a stale selection.
function safePublish(keepRecognition=false):void {
  try{publish(keepRecognition);}catch(e){figma.ui.postMessage({type:'error',message:e instanceof Error?e.message:String(e),code:(e as {code?:string}).code??'plugin'});}
}
function selectionChanged():void {if(diagnosticSelectionId&&figma.currentPage.selection.length===1&&figma.currentPage.selection[0].id===diagnosticSelectionId){safePublish(true);return;}diagnosticSelectionId=undefined;recognition=undefined;safePublish();}
function pageChanged():void {recognition=undefined;idMapPlan=undefined;figma.ui.postMessage({type:'id-map-clear'});diagnosticSelectionId=undefined;scopeContext.reset();settingsProjectId=undefined;safePublish();}
// Figma delivers canvas events while an operation awaits fonts or PNG exports.
// Handle them once the operation ends rather than on a half-finished document.
let deferred:'selection'|'page'|undefined;
figma.on('selectionchange',()=>{if(busy){deferred=deferred??'selection';return;}selectionChanged();});
figma.on('currentpagechange',()=>{if(busy){deferred='page';return;}pageChanged();});
figma.ui.onmessage=async(message:{type:string;data?:Record<string,unknown>;numbering?:NumberingOptions;profile?:Profile;role?:Role;stateId?:number;token?:number;scopeMode?:ScopeMode;projectId?:string;nodeId?:string;fromReport?:boolean;corners?:boolean;contrast?:boolean;statePair?:ButtonStatePair;existing?:'skip'|'update';referenceId?:string;popupIds?:string[];targetId?:string;buttonIds?:string[];group?:string;create?:boolean;buttonText?:ButtonTextMode|'design'})=>{
  if(message.type==='ready'){safePublish();return;}
  if(busy){figma.ui.postMessage({type:'error',message:'Дождитесь завершения текущей операции.'});return;}
  busy=true;
  try {
    if(message.type==='id-map-preview'){
      idMapPlan=undefined;
      const plan=planIdMap(figma.currentPage,String(message.data?.json??''));idMapPlan=plan;
      figma.ui.postMessage({type:'id-map-preview',token:++idMapToken,rows:plan.rows});return;
    }
    if(message.type==='id-map-apply'){
      const plan=idMapPlan;idMapPlan=undefined;
      if(!plan||message.token!==idMapToken)fail('id-map-stale','Обновите предпросмотр карты ID.');
      const changed=applyIdMap(plan);publish();figma.ui.postMessage({type:'id-map-applied',message:`Карта ID применена. Изменено кнопок: ${changed}. Можно экспортировать макет с ID из GUI Designer.`});return;
    }
    if(message.type==='button-numbering-preview') {
      if(!message.numbering||typeof message.numbering!=='object')fail('button-numbering','Проверьте настройки нумерации.');
      numberingOptions={base:message.numbering.base,start:message.numbering.start,mode:message.numbering.mode,names:message.numbering.names,labels:message.numbering.labels};
      numberingEnabled=true;
      figma.ui.postMessage(numberingView());return;
    }
    if(message.type==='button-numbering-apply') {
      const plan=numberingPlan;numberingPlan=undefined;recognition=undefined;
      if(!plan||message.token!==numberingToken)fail('button-numbering-stale','Предпросмотр устарел. Обновите настройки нумерации.');
      const result=await applyNumbering(plan);
      publish();figma.ui.postMessage({type:'success',operation:message.type,message:`Нумерация завершена. Переименовано кнопок: ${result.names}; обновлено текстовых слоёв: ${result.labels}. ID Extron сохранены.`});return;
    }
    if(message.scopeMode){if(!['selection','selected-frames','page'].includes(message.scopeMode))fail('scope','Выберите область экспорта.');scopeContext.mode=message.scopeMode;}
    if(message.profile&&Object.prototype.hasOwnProperty.call(PROFILES,message.profile))scopeContext.profile=message.profile;
    if(message.type==='context'){recognition=undefined;publish();return;}
    if(message.type==='project-settings'||message.type==='start-page'){
      if(figma.currentPage.selection.length)fail('links','Снимите выделение, чтобы открыть настройки проекта.');
      const project=availableSettingsProjects().find(p=>p.id===message.projectId);
      if(!project)fail('links','Проект недоступен. Выберите проект повторно.');
      settingsProjectId=project.id;
      if(message.type==='start-page'){
        if(typeof message.targetId!=='string')fail('links','Выберите стартовую страницу.');
        setStartPage(project.context,message.targetId);
      }
      publish();
      if(message.type==='start-page')figma.ui.postMessage({type:'success',message:'Стартовая страница сохранена в проекте.'});
      return;
    }
    if(['reference-target','selection-group','show-linked'].includes(message.type)){
      if(message.nodeId&&selected().id!==message.nodeId)fail('links','Выделение изменилось. Повторите действие для выбранного элемента.');
      const ctx=linksContext(undefined,message.type==='reference-target'||message.type==='show-linked'&&selectionKind(selected())==='popup-ref');
      if(message.type==='show-linked'){
        if(typeof message.targetId!=='string')fail('links','Выберите цель.');
        const node=linkedNode(ctx,message.targetId);figma.currentPage.selection=[node];focusNode(node);
      }else if(message.type==='reference-target'){
        if(typeof message.targetId!=='string')fail('links','Выберите popup или группу.');
        setReferenceTarget(ctx,selected().id,message.targetId);
      }else {
        if(!Array.isArray(message.buttonIds)||message.buttonIds.some(id=>typeof id!=='string')||typeof message.group!=='string')fail('links','Выберите кнопки и группу.');
        setSelectionGroup(ctx,message.buttonIds,message.group,message.create===true);
      }
      recognition=undefined;publish();figma.ui.postMessage({type:'success',message:message.type==='show-linked'?'Элемент показан на холсте.':'Связь сохранена в файле Figma.'});return;
    }
    if(message.type==='bind-popups'){
      if(typeof message.referenceId!=='string'||!Array.isArray(message.popupIds)||message.popupIds.some(id=>typeof id!=='string'))fail('popup-binding','Выберите место popup и фреймы для связывания.');
      const result=bindPopups(message.referenceId,message.popupIds,scopeContext.profile);
      scopeContext.useProject(result.root,result.options);recognition=undefined;publish();
      figma.ui.postMessage({type:'success',message:'Popup связаны с выбранным местом. Группа и ключи подготовлены автоматически. Теперь можно проверить проект.'});return;
    }
    if(message.type==='select-issue') {
      const plan=recognition;
      if(!plan||plan.root.removed||!plan.issues.some(i=>i.nodeId===message.nodeId))fail('recognition','Отчёт устарел. Повторите распознавание.');
      let node:SceneNode|undefined;
      function find(current:SceneNode|PageNode){if(current.removed)return;if(current.id===message.nodeId&&current.type!=='PAGE')node=current;if('children' in current)for(const child of current===plan!.root?(plan!.options.members??current.children):current.children)find(child);}
      if((plan.root.type==='PAGE'?plan.root.id:pageOf(plan.root)?.id)!==figma.currentPage.id)fail('recognition','Откройте страницу макета и повторите распознавание.');
      find(plan.root);if(!node)fail('selection','Слой удалён или перемещён. Повторите распознавание.');
      diagnosticSelectionId=node.id;figma.currentPage.selection=[node];focusNode(node);publish(true);
    }else if(message.type==='recognize') {
      const previous=message.fromReport?recognition:undefined;
      recognition=undefined;
      diagnosticSelectionId=previous?diagnosticSelectionId:undefined;
      if(message.fromReport&&(!previous||previous.root.removed||recognitionMode!==scopeContext.mode||previous.profile!==message.profile||(previous.root.type==='PAGE'?previous.root.id:pageOf(previous.root)?.id)!==figma.currentPage.id))fail('recognition','Отчёт устарел. Выберите макет и распознайте его заново.');
      const resolved=previous?{root:previous.root,options:previous.options}:scopeContext.resolve(true);
      if(previous&&resolved.root.type!=='PAGE'){diagnosticSelectionId=resolved.root.id;figma.currentPage.selection=[resolved.root];publish(true);}
      const plan=recognize(resolved.root,message.profile!,resolved.options);postRecognition(plan);
    }else if(message.type==='apply-recognition') {
      const plan=recognition;recognition=undefined;
      if(!plan||message.token!==recognitionToken||(plan.root.type==='PAGE'?figma.currentPage.id!==plan.root.id:selected().id!==plan.root.id)||recognitionMode!==scopeContext.mode||message.profile!==plan.profile)fail('recognition','Результат распознавания устарел. Распознайте выбранный экран ещё раз.');
      applyRecognition(plan);publish();figma.ui.postMessage({type:'success',message:`Назначения сохранены. ${plan.visibility.length?'Лишние состояния скрыты в предпросмотре; все состояния сохраняются в экспорте. ':''}ID сохранены, ключи следуют именам слоёв. Можно проверить экран и скачать .exui.`});
    }else {
    recognition=undefined;
    if(message.type==='button-preset-normal'||message.type==='button-preset-active') {
      rememberPreset(selected(),message.type==='button-preset-normal'?'normal':'feedback');
      publish();figma.ui.postMessage({type:'success',message:'Эталон запомнен на текущей странице. Теперь выберите экран и создайте состояния.'});
    }else if(message.type==='button-background') {
      const marked=markBackground(selected());publish();figma.ui.postMessage({type:'success',message:marked?'Слой отмечен как фон. Выберите экран и повторите создание состояний.':'Отметка фона снята.'});
    }else if(message.type==='button-apply-styles'||message.type==='button-create-states'||message.type==='button-update-styles') {
      const resolved=scopeContext.resolveButtons();
      const summary=buttonPreparationSummary(resolved.root,resolved.options);
      if(message.type==='button-apply-styles'&&summary.update>0&&!['skip','update'].includes(message.existing??''))fail('button-existing','Выберите, пропустить готовые кнопки или применить к ним новый стиль.');
      const contrast={corrected:0,unchecked:0};
      const result=prepareButtons(resolved.root,resolved.options,message.type==='button-apply-styles'?(message.existing==='update'?'apply':'apply-new'):message.type==='button-update-styles',message.corners===true,{enabled:message.contrast!==false,report:contrast},message.statePair);
      const contrastMessage=message.contrast===false?' Автокоррекция контраста выключена.':` Контраст: исправлено слоёв — ${contrast.corrected}.${contrast.unchecked?` Требуют ручной проверки: ${contrast.unchecked} (сложные заливки, изображения, эффекты или прозрачность).`:''}`;
      publish();figma.ui.postMessage({type:'success',operation:message.type,message:(message.type==='button-apply-styles'?`Область: ${resolved.scope.name}. ${result.buttons?'Оформление применено.':'Изменений нет.'} Подготовлено кнопок: ${summary.create}; обновлено готовых: ${result.buttons-summary.create}; новых состояний: ${result.states}; пропущено готовых: ${result.skipped}. Далее проверьте макет и скачайте .exui.`:message.type==='button-update-styles'?`Область: ${resolved.scope.name}. Оформление обновлено: ${result.buttons} кнопок. Pressed получает активный образец; имена и ID состояний сохранены.`:`Область: ${resolved.scope.name}. Подготовлено кнопок: ${result.buttons}; создано состояний: ${result.states}; уже готовы: ${result.skipped}. Теперь нажмите «Проверить макет».`)+contrastMessage});
    }else if(message.type==='button-text') {
      const resolved=scopeContext.resolveButtons();
      const result=setButtonTextMode(resolved.root,resolved.options,message.buttonText!);
      recognition=undefined;publish();
      const detail=result.buttons?`У настроенных кнопок в GDL подписи будут частью Button ${message.buttonText==='auto'?'с автоматическим выравниванием из Figma при каждом экспорте':message.buttonText==='bottom-center'?'снизу по центру':'по центру'}, без отдельного Label.`:'Настройки текста не изменены.';
      const messageText=message.buttonText==='design'?`Восстановлен экспорт по расположению Figma: ${result.buttons} кнопок. Отдельные подписи снова могут экспортироваться как Label.`:`Текст для GCP настроен: ${result.buttons} кнопок; без изменений: ${result.skipped}. ${detail} Слои Figma и ID сохранены. Скачайте .exui и создайте новый GDL.`;
      figma.ui.postMessage({type:'success',operation:message.type,message:messageText+' Кнопки imagebutton_ / ibtn_ сохраняют подписи внутри PNG.'});
    }else if(message.type==='kit') {
      const result=await createKit(message.profile!);
      publish();figma.ui.postMessage({type:'success',message:`Extron Kit создан: ${result.components.length-result.dateTime.children.length} компонентов, datetime_Clock с ${result.dateTime.children.length} форматами, шаблоны проекта, 3 сценария ожидания/доступности/восстановления и отдельный экран 320×480. Выбран пример экрана. Изменяйте оформление в слотах Artwork, затем скачайте .exui — назначения подготовятся автоматически.`});
    }else if(message.type==='demo') {
      if(!message.profile||!Object.prototype.hasOwnProperty.call(PROFILES,message.profile))fail('profile','Выберите профиль.');
      await createDemo(message.profile,Object.fromEntries(Object.entries(__ICONS__).map(([k,v])=>[k,new Uint8Array(v)])));
      publish();figma.ui.postMessage({type:'success',message:'Демо создано. Можно редактировать и экспортировать выбранный экран.'});
    }else if(message.type==='prepare') {
      prepare(message.profile);publish();figma.ui.postMessage({type:'success',message:'Назначение «Экран» сохранено. Далее нажмите «Распознать по именам» либо назначьте элементы вручную, затем нажмите «Проверить экран». Слои макета не изменены.'});
    }else if(message.type==='apply') {
      if(message.nodeId&&selected().id!==message.nodeId)fail('selection','Выделение изменилось. Выберите слой и сохраните назначение ещё раз.');
      apply(message.data??{});publish();figma.ui.postMessage({type:'success',message:message.data?.kind==='popup-ref'&&!message.data.popup&&!message.data.group?'Место popup сохранено. Выделите popup-фреймы вместе, выберите это место в блоке «Размещение popup» и свяжите их.':'Назначение сохранено в Figma-узле.'});
    }else if(message.type==='save-ids') {
      if(!message.nodeId||selected().id!==message.nodeId)fail('selection','Выделение изменилось. Выберите слой и сохраните ID ещё раз.');
      const metadata=saveIds(selected(),message.data??{});
      publish();figma.ui.postMessage({type:'success',operation:message.type,message:`ID сохранены: объект ${metadata.objectId}${isControlKind(metadata.kind)?`, управление Extron ${metadata.controlId}`:''}. Ошибки оформления не мешают сохранению ID. Перед экспортом нажмите «Проверить макет».`});
    }
    else if(message.type==='preview') {
      const node=selected();if(!isButtonContainer(node)||!['button','level'].includes(stored(node)?.kind??''))fail('selection','Выберите Group, Frame или экземпляр кнопки кита.');
      const role=message.role;if(message.stateId===undefined&&(!role||!Object.prototype.hasOwnProperty.call(ROLE_ID,role)))fail('states','Выберите состояние.');
      if(message.stateId!==undefined)integer(message.stateId,0,7,'ID состояния');
      const children=node.children.map(n=>({node:n,metadata:stored(n)}));
      const matches=(m:Metadata|null)=>message.stateId!==undefined?m?.stateId===message.stateId:m?.role===role;
      if(children.length<2||children.length>8||children.some(c=>c.metadata?.kind!=='state')||children.filter(c=>matches(c.metadata)).length!==1)fail('states','Выберите одно назначенное состояние; при нескольких feedback используйте его ID.');
      for(const c of children)c.node.visible=matches(c.metadata);
      figma.ui.postMessage({type:'success',message:`Показано состояние ${message.stateId??role}. При экспорте сохраняются все состояния.`});
    }else if(message.type==='check') {const resolved=exportRoot();if(!resolved)return;const {captured:c,assignmentSummary}=resolved;figma.ui.postMessage({type:'success',message:`Макет проверен: ${elementCount(c.screen)} элемента, ${c.screen.assets.length} PNG. ${assignmentSummary} Декодирование PNG проверит CLI после экспорта.`});}
    else if(message.type==='export') {
      const resolved=exportRoot();if(!resolved)return;const {root,captured,assignmentSummary}=resolved;
      const bundle=await exportCaptured(root,captured,message=>figma.ui.postMessage({type:'progress',message}));
      bundle.origin=createOrigin(root,bundle,captured.signatureMembers);
      if(root.type==='PAGE'&&root.id!==figma.currentPage.id)fail('design-changed','Открытая страница изменилась во время экспорта. Повторите экспорт на нужной странице.');
      figma.ui.postMessage({type:'bundle',bundle,assignmentSummary});
    }else fail('message','Неизвестная команда.');
    }
  }catch(e){figma.ui.postMessage({type:'error',operation:message.type,message:e instanceof Error?e.message:String(e),code:(e as {code?:string}).code??'plugin'});}
  finally {
    busy=false;figma.ui.postMessage({type:'idle'});
    const event=deferred;deferred=undefined;
    if(event==='page')pageChanged();else if(event==='selection')selectionChanged();
  }
};
