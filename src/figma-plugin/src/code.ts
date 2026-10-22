import { PROFILES, ROLE_ID, CONTROL_KINDS, ELEMENT_KINDS, isControlKind, elementCount, fail, integer, key, readMetadata, text, type MetadataInput, type Metadata, type Profile, type Role } from './model.ts';
import { exportCaptured, type Capture } from './export.ts';
import { createDemo, tag } from './demo.ts';
import { recognize, applyRecognition, type RecognitionPlan } from './recognize.ts';
import { createKit } from './kit.ts';
import { isStrokeLine,readStrokeLine } from './stroke-line.ts';
import { projectMembers, type ProjectNode,type ProjectOptions } from './project.ts';
import { ExportScope, selected, pageOf, type ScopeMode } from './scope.ts';
import { requireNodeForKind } from './assignment-rules.ts';
import { containerSuffix,freeKey } from './assignment-repair.ts';
import { isButtonContainer } from './button-artwork.ts';
import { buttonPreparationSummary, markBackground, prepareButtons, presetPreviews, rememberPreset } from './button-preparation.ts';
import type { ButtonPreparationSummary } from './model.ts';
import { focusNode } from './focus-node.ts';
import { MANUAL_KEY } from './key-sync.ts';
import { requireLatinName } from './latin-name.ts';
import { controlText,formatVariant } from './kit-contract.ts';
import { MANUAL_PATTERN,hasManualPattern,patternProblem,resolvePattern } from './datetime-format.ts';
// The build injects only our two local PNG resources; no remote source or server.
declare const __ICONS__: Record<string,number[]>;
declare const __html__:string;
figma.showUI(__html__,{width:420,height:720,themeColors:true});
const scopeContext = new ExportScope();
let recognitionMode:ScopeMode='selection';
let busy=false;
let recognition:RecognitionPlan|undefined, recognitionToken=0;
let diagnosticSelectionId:string|undefined;
function postRecognition(plan:RecognitionPlan):void {
  recognition=plan;recognitionMode=scopeContext.mode;
  figma.ui.postMessage({type:'recognition',token:++recognitionToken,rows:plan.rows,errors:plan.errors,issues:plan.issues,warnings:plan.warnings});
}
const stored=(node:BaseNode)=>readMetadata(node,{allowCopied:true});

function prepare(profile:Profile|undefined):void {
  const node=selected();
  if(node.type!=='FRAME')fail('node-type','Для подготовки выберите внешний Frame экрана.');
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
  publish();return {...resolved,captured,assignmentSummary};
}
function publish(keepRecognition=false):void {
  const selection=figma.currentPage.selection,n=selection.length===1?selection[0]:undefined;
  let warning='',metadata:Metadata|null=null;
  try{scopeContext.refreshSelection();if(n)metadata=stored(n);}catch(e){warning=(e as Error).message;}
  let states:{stateId?:number;name?:string;role?:Role}[]=[];
  try{if(n&&isButtonContainer(n)&&['button','level'].includes(metadata?.kind??''))states=n.children.map(c=>readMetadata(c)).filter(m=>m?.kind==='state').map(m=>({stateId:m!.stateId,name:m!.stateName,role:m!.role}));}catch(e){warning=warning||(e as Error).message;}
  let scope:{id:string;name:string;kind:string;profile?:Profile}|undefined;
  let targets:{key:string;name:string;kind:string}[]=[],scopeHint='';
  let canRecognize=false;
  let buttonWorkflow:ButtonPreparationSummary|undefined;
  try{canRecognize=scopeContext.canRecognize;}catch{ /* Metadata errors are shown above. */ }
  try {
    const resolved=scopeContext.resolve();
    const {root,options}=resolved,rm=stored(root);
    canRecognize=resolved.canRecognize;scopeHint=resolved.hint;scope=resolved.scope;
    buttonWorkflow=buttonPreparationSummary(root,options);
    if(rm?.kind==='project'||resolved.scope.kind==='project'){
        // A navigation error can prevent the very assignments needed to repair
        // it. Offer the draft keys without writing anything on selection.
        const plan=recognize(root,resolved.profile,options);
        const proposed=new Map(plan.writes.map(w=>[w.node.id,w.metadata]));
        const read=(node:SceneNode|PageNode)=>proposed.get(node.id)??readMetadata(node);
        if(n)metadata=read(n);
        let container:BaseNode|null=n??null;
        while(container&&!['page','popup'].includes(read(container as SceneNode|PageNode)?.kind??''))container=container.parent;
        targets=projectMembers(root,read,options).containers.filter(c=>c.id!==container?.id).map(c=>({node:c,metadata:read(c)})).filter(c=>c.metadata&&['page','popup'].includes(c.metadata.kind)).map(c=>({key:c.metadata!.key!,name:c.node.name,kind:c.metadata!.kind}));
    }
  }catch(e){if(scopeContext.mode!=='selection'){canRecognize=false;scopeHint=(e as Error).message;}}
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
  figma.ui.postMessage({type:'selection',keepRecognition,id:n?.id??null,name:n?.name??(selection.length?`Выбрано фреймов: ${selection.length}`:'Выберите экраны на холсте'),nodeType:n?.type,metadata,warning,states,scope,targets,buttonPresets,buttonStylePreviews,buttonWorkflow,datetime,scopeMode:scopeContext.mode,canRecognize,scopeHint,profile:scope?.profile??scopeContext.profile});
}
function apply(input:Record<string,unknown>):void {
  const node=selected(),kind=input.kind as Metadata['kind'];
  if(!['project','page','popup','popup-group','state','image',...ELEMENT_KINDS].includes(kind))fail('kind','Выберите назначение.');
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
      const previous=readMetadata(node);
      if(previous?.kind!=='button'||previous.buttonMode)fail('button-mode','Прежние правила доступны только для уже сохранённой кнопки без нового типа.');
    }else{
      const mode=data.buttonMode??'on-off';
      if(mode!=='on-off'&&mode!=='feedback')fail('button-mode','Выберите 2 состояния (Off / On или Normal / Pressed) либо выбор с видом нажатия (Normal / Active / Pressed; Pressed необязателен для совместимости).');
      value.buttonMode=mode;
    }
  }
  if(kind==='page'||kind==='popup'){
    if(data.shownBy){if(!['start','navigation','program'].includes(String(data.shownBy)))fail('page','Выберите способ показа.');value.shownBy=data.shownBy as Metadata['shownBy'];}
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
  if(kind==='button'&&data.navigate)value.navigate=key(data.navigate,'Цель перехода');
  if(CONTROL_KINDS.includes(kind)){
    const behavior:NonNullable<Metadata['behavior']>={};if(data.selectionGroup){if(kind!=='button')fail('behavior','Группа выбора применяется к кнопкам.');behavior.selectionGroup=key(data.selectionGroup,'Группа выбора');}
    for(const field of ['enabled','visible'] as const)if(data[field]!==''&&data[field]!==undefined){if(!['true','false'].includes(String(data[field])))fail('behavior','Выберите значение поведения.');behavior[field]=data[field]==='true';}
    if(Object.keys(behavior).length)value.behavior=behavior;
  }
  requireNodeForKind(node,kind);
  if(kind==='button'&&value.navigate){
    const resolved=scopeContext.resolve();
    if(resolved.scope.kind!=='project')fail('navigation','Для перехода выберите «Экраны текущей страницы — один проект» или выделите экраны вместе.');
    if(!stored(node)||!stored(resolved.root)||projectMembers(resolved.root,stored,resolved.options).containers.some(c=>!stored(c))){
      const plan=recognize(resolved.root,resolved.profile,resolved.options,new Map([[node.id,value]]));
      if(!plan.rows.some(row=>row.id===node.id))fail('navigation','Кнопка не входит в выбранный проект. Выделите нужные экраны вместе.');
      if(plan.errors.length)fail('recognition',plan.errors.join('\n'));
      applyRecognition(plan);return;
    }
  }
  if(kind==='line'&&isStrokeLine(node))readStrokeLine(node);
  const parentKind=node.parent&&!(kind==='project'&&node.parent.type==='PAGE')?readMetadata(node.parent)?.kind:undefined;
  const allowed=kind==='project'?[undefined]:kind==='page'?[undefined,'project']:kind==='popup'?['project','popup-group']:kind==='popup-group'?['project']:kind==='state'?['button','level']:kind==='image'?['state']:['page','popup'];
  if(!allowed.includes(parentKind))fail('placement',`${node.name}: недопустимый родитель для ${kind}.`);
  tag(node,value);
}
figma.on('selectionchange',()=>{if(diagnosticSelectionId&&figma.currentPage.selection.length===1&&figma.currentPage.selection[0].id===diagnosticSelectionId){publish(true);return;}diagnosticSelectionId=undefined;recognition=undefined;publish();});
figma.on('currentpagechange',()=>{recognition=undefined;diagnosticSelectionId=undefined;scopeContext.reset();publish();});
figma.ui.onmessage=async(message:{type:string;data?:Record<string,unknown>;profile?:Profile;role?:Role;stateId?:number;token?:number;scopeMode?:ScopeMode;nodeId?:string;fromReport?:boolean;corners?:boolean;existing?:'skip'|'update'})=>{
  if(message.type==='ready'){publish();return;}
  if(busy){figma.ui.postMessage({type:'error',message:'Дождитесь завершения текущей операции.'});return;}
  busy=true;
  try {
    if(message.scopeMode){if(!['selection','selected-frames','page'].includes(message.scopeMode))fail('scope','Выберите область экспорта.');scopeContext.mode=message.scopeMode;}
    if(message.profile&&Object.prototype.hasOwnProperty.call(PROFILES,message.profile))scopeContext.profile=message.profile;
    if(message.type==='context'){recognition=undefined;publish();return;}
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
      const resolved=scopeContext.resolve();
      if(message.type==='button-apply-styles'&&buttonPreparationSummary(resolved.root,resolved.options).update>0&&!['skip','update'].includes(message.existing??''))fail('button-existing','Выберите, пропустить готовые кнопки или применить к ним новый стиль.');
      const result=prepareButtons(resolved.root,resolved.options,message.type==='button-apply-styles'?(message.existing==='update'?'apply':'apply-new'):message.type==='button-update-styles',message.corners===true);
      publish();figma.ui.postMessage({type:'success',operation:message.type,message:message.type==='button-apply-styles'?`Оформление применено. Кнопок: ${result.buttons}; новых состояний: ${result.states}; пропущено готовых: ${result.skipped}. Далее проверьте макет и скачайте .exui.`:message.type==='button-update-styles'?`Оформление обновлено: ${result.buttons} кнопок. Pressed и другие состояния сохранены.`:`Подготовлено кнопок: ${result.buttons}; создано состояний: ${result.states}; уже готовы: ${result.skipped}. Теперь нажмите «Проверить макет».`});
    }else if(message.type==='kit') {
      const result=await createKit(message.profile!);
      publish();figma.ui.postMessage({type:'success',message:`Extron Kit создан: ${result.components.length-result.dateTime.children.length} компонентов, datetime_Clock с ${result.dateTime.children.length} форматами даты/времени и шаблоны проекта. Выбран пример экрана. Изменяйте оформление в слотах Artwork, затем распознайте экран и сохраните назначения.`});
    }else if(message.type==='demo') {
      if(!message.profile||!Object.prototype.hasOwnProperty.call(PROFILES,message.profile))fail('profile','Выберите профиль.');
      await createDemo(message.profile,Object.fromEntries(Object.entries(__ICONS__).map(([k,v])=>[k,new Uint8Array(v)])));
      publish();figma.ui.postMessage({type:'success',message:'Демо создано. Можно редактировать и экспортировать выбранный экран.'});
    }else if(message.type==='prepare') {
      prepare(message.profile);publish();figma.ui.postMessage({type:'success',message:'Назначение «Экран» сохранено. Далее нажмите «Распознать по именам» либо назначьте элементы вручную, затем нажмите «Проверить экран». Слои макета не изменены.'});
    }else if(message.type==='apply') {apply(message.data??{});publish();figma.ui.postMessage({type:'success',message:'Назначение сохранено в Figma-узле.'});}
    else if(message.type==='preview') {
      const node=selected();if(!isButtonContainer(node)||!['button','level'].includes(readMetadata(node)?.kind??''))fail('selection','Выберите Group, Frame или экземпляр кнопки кита.');
      const role=message.role;if(message.stateId===undefined&&(!role||!Object.prototype.hasOwnProperty.call(ROLE_ID,role)))fail('states','Выберите состояние.');
      if(message.stateId!==undefined)integer(message.stateId,0,7,'ID состояния');
      const children=node.children.map(n=>({node:n,metadata:readMetadata(n)}));
      const matches=(m:Metadata|null)=>message.stateId!==undefined?m?.stateId===message.stateId:m?.role===role;
      if(children.length<2||children.length>8||children.some(c=>c.metadata?.kind!=='state')||children.filter(c=>matches(c.metadata)).length!==1)fail('states','Выберите одно назначенное состояние; при нескольких feedback используйте его ID.');
      for(const c of children)c.node.visible=matches(c.metadata);
      figma.ui.postMessage({type:'success',message:`Показано состояние ${message.stateId??role}. При экспорте сохраняются все состояния.`});
    }else if(message.type==='check') {const resolved=exportRoot();if(!resolved)return;const {captured:c,assignmentSummary}=resolved;figma.ui.postMessage({type:'success',message:`Макет проверен: ${elementCount(c.screen)} элемента, ${c.screen.assets.length} PNG. ${assignmentSummary} Декодирование PNG проверит CLI после экспорта.`});}
    else if(message.type==='export') {
      const resolved=exportRoot();if(!resolved)return;const {root,captured,assignmentSummary}=resolved;
      const bundle=await exportCaptured(root,captured,message=>figma.ui.postMessage({type:'progress',message}));
      if(root.type==='PAGE'&&root.id!==figma.currentPage.id)fail('design-changed','Открытая страница изменилась во время экспорта. Повторите экспорт на нужной странице.');
      figma.ui.postMessage({type:'bundle',bundle,assignmentSummary});
    }else fail('message','Неизвестная команда.');
    }
  }catch(e){figma.ui.postMessage({type:'error',operation:message.type,message:e instanceof Error?e.message:String(e),code:(e as {code?:string}).code??'plugin'});}
  finally {busy=false;figma.ui.postMessage({type:'idle'});}
};
