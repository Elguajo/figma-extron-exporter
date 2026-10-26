import { DATA_KEY,PROFILES,ROLE_ID,ELEMENT_KINDS,CONTROL_KINDS,metadataSchema,isControlKind,isElementKind,stateRole,fail,integer,key,readMetadata,text,type ButtonMode,type Kind,type MetadataInput, type Metadata,type Profile,type Role } from './model.ts';
import type { ProjectNode,ProjectOptions } from './project.ts';
import { capture,scopedDesignSignature,type Capture } from './export.ts';
import { isControlFrame,isKitNode,KIT_POPUP_GROUP_KEY } from './kit-contract.ts';
import { isStrokeLine } from './stroke-line.ts';
import { containerSuffix,freeKey,repairAssignments } from './assignment-repair.ts';
import { requireNodeForKind } from './assignment-rules.ts';
import { syncKeys } from './key-sync.ts';
import { requireLatinName } from './latin-name.ts';
import { recognitionIssue } from './recognition-issue.ts';
import type { RecognitionIssue } from './model.ts';
import { usesButtonArtwork, validateArtwork, type ButtonContainer } from './button-artwork.ts';
import { popupNameSuffix } from './popup-name.ts';

export const REGISTRY_KEY='exui-id-registry';
interface Registry {schema:'exui-id-registry/1'|'exui-id-registry/2';ownerNodeId:string;nextObjectId:number;nextControlId:number;nextContainerId?:number;nextGroupId?:number}
export interface RecognitionRow {id:string;name:string;kind:Kind;buttonMode?:ButtonMode;key?:string;objectId?:number;controlId?:number|null;isNew:boolean}
export interface RecognitionPlan {root:ProjectNode;options:ProjectOptions;profile:Profile;signature:string;registry:string;writes:{node:SceneNode|PageNode;metadata:Metadata}[];visibility:{node:SceneNode;visible:boolean}[];rows:RecognitionRow[];keys:{name:string;from:string;to:string}[];errors:string[];issues:RecognitionIssue[];warnings:string[]}
const KIND_PREFIX:Partial<Record<Kind,string>>={button:'button_',label:'text_',value:'value_',level:'level_',slider:'slider_',shape:'shape_',line:'line_',datetime:'datetime_','popup-ref':'popupref_',graphic:'image_'};
const TYPES:Record<string,Kind>={btn:'button',button:'button',lvl:'level',level:'level',txt:'label',text:'label',logo:'graphic',img:'graphic',image:'graphic',val:'value',value:'value',sld:'slider',slider:'slider',shp:'shape',shape:'shape',ln:'line',line:'line',dt:'datetime',datetime:'datetime',pr:'popup-ref',popupref:'popup-ref',gau:'level',gauge:'level',ind:'level',indicator:'level',led:'level',volumeled:'level',mlvl:'level',multilevel:'level'};
export function namedControl(name:string):{kind:Kind;suffix:string;display?:Metadata['display'];buttonMode?:ButtonMode}|null {
  const match=/^([a-z]+)_(.+)$/i.exec(name);if(!match)return null;
  const prefix=match[1].toLowerCase(),kind=['fbtn','feedbackbutton'].includes(prefix)?'button':TYPES[prefix];if(!kind)return null;
  const result:{kind:Kind;suffix:string;display?:Metadata['display'];buttonMode?:ButtonMode}={kind,suffix:slug(match[2],name)};
  if(kind==='button')result.buttonMode=['fbtn','feedbackbutton'].includes(prefix)?'feedback':'on-off';
  if(['gau','gauge','ind','indicator'].includes(prefix))result.display='gauge';
  if(['led','volumeled'].includes(prefix))result.display='volume-led';
  if(['mlvl','multilevel'].includes(prefix))result.display='multistate';
  return result;
}
function slug(value:string,name:string):string {
  const pattern=/^[A-Za-z][A-Za-z0-9]*(?:[.-][A-Za-z0-9]+)*$/;
  if(!pattern.test(value)){
    const invalid=/[^A-Za-z0-9.-]/u.exec(value),prefix=name.slice(0,name.length-value.length);
    const candidate=value.replace(/[\s\u200B-\u200D\uFEFF]+/g,'-');
    const example=prefix+(pattern.test(candidate)?candidate:'Name');
    const detail=invalid?`${/[\s\u200B-\u200D\uFEFF]/u.test(invalid[0])?'недопустимый пробел или невидимый символ':`недопустимый символ «${invalid[0]}»`} в позиции ${prefix.length+invalid.index+1}. `:'';
    fail('name',`${name}: ${detail}После префикса используйте латинскую букву, затем латинские буквы, цифры, точки и дефисы между непустыми частями, без пробелов и дополнительных _. Например, ${example}.`);
  }
  return key(value.toLowerCase(),'Имя слоя');
}
export function namedRole(name:string):Role|null {return stateRole(name.replace(/^(st|state)_/i,''));}
function signature(root:ProjectNode,options:ProjectOptions):string {return scopedDesignSignature(root,options.members)+'\n'+root.getPluginData(REGISTRY_KEY);}

export function recognize(root:SceneNode|PageNode,profile:Profile,options:ProjectOptions={},edits:ReadonlyMap<string,MetadataInput>=new Map()):RecognitionPlan {
  if(root.type!=='FRAME'&&root.type!=='SECTION'&&root.type!=='PAGE')fail('selection','Выберите секцию проекта или внешний Frame экрана / project_Name.');
  if(!Object.prototype.hasOwnProperty.call(PROFILES,profile))fail('profile','Выберите профиль панели.');
  let parent=root.parent;while(parent&&parent.type!=='PAGE'){if(['page','popup'].includes(readMetadata(parent)?.kind??''))fail('placement','Для распознавания выберите внешний Frame экрана.');parent=parent.parent;}
  const stored=(node:SceneNode|PageNode)=>readMetadata(node,{allowCopied:true});
  let existingRoot=stored(root);const isProject=(root.type==='SECTION'||root.type==='PAGE')||existingRoot?.kind==='project'||!existingRoot&&/^(prj|project)_/i.test(root.name);
  if(existingRoot&&existingRoot.kind!==(isProject?'project':'page'))fail('placement','Выбран элемент с другим назначением.');
  if(root.type!=='PAGE'&&existingRoot?.profile&&existingRoot.profile!==profile)fail('profile','Выбранный профиль отличается от сохранённого профиля экрана.');
  if(root.type==='PAGE'&&!options.members)fail('project-scope','Выберите фреймы проекта.');
  const canvas=PROFILES[profile];if(!isProject&&root.type==='FRAME'&&(root.width!==canvas.width||root.height!==canvas.height))fail('profile',`Для этого профиля нужен Frame ${canvas.width}×${canvas.height}.`);
  const registry:Registry={schema:isProject?'exui-id-registry/2':'exui-id-registry/1',ownerNodeId:root.id,nextObjectId:1,nextControlId:8101,...(isProject?{nextContainerId:100,nextGroupId:1}:{})};
  function importRegistry(node:SceneNode|PageNode,main=false){const raw=node.getPluginData(REGISTRY_KEY);if(!raw)return;let r:Registry;try{r=JSON.parse(raw);}catch{fail('registry','Повреждён реестр ID экрана.');}if(!r||!['exui-id-registry/1','exui-id-registry/2'].includes(r.schema)||typeof r.ownerNodeId!=='string'||!r.ownerNodeId)fail('registry','Неизвестный реестр ID экрана.');if(r.schema==='exui-id-registry/2'){integer(r.nextContainerId,1,65535,'Следующий ID контейнера');integer(r.nextGroupId,1,65536,'Следующий ID группы');}integer(r.nextObjectId,1,1000001,'Следующий ID объекта');integer(r.nextControlId,1,65536,'Следующий ID управления');registry.nextObjectId=Math.max(registry.nextObjectId,r.nextObjectId);registry.nextControlId=Math.max(registry.nextControlId,r.nextControlId);if(isProject){registry.nextContainerId=Math.max(registry.nextContainerId!,integer(r.nextContainerId??100,1,65535,'Следующий ID контейнера'));registry.nextGroupId=Math.max(registry.nextGroupId!,integer(r.nextGroupId??1,1,65536,'Следующий ID группы'));}else if(main&&r.schema!=='exui-id-registry/1')fail('registry','Для экрана ожидается реестр ID экрана.');}
  const nodes:(SceneNode|PageNode)[]=[],saved=new Map<string,Metadata>();let singleContainerId=100;
  function scan(node:SceneNode|PageNode){importRegistry(node,node.id===root.id);nodes.push(node);const m=stored(node);if(m)saved.set(node.id,m);if(m&&ELEMENT_KINDS.includes(m.kind)){registry.nextObjectId=Math.max(registry.nextObjectId,integer(m.objectId,1,1000000,node.name+'.objectId')+1);if(CONTROL_KINDS.includes(m.kind))registry.nextControlId=Math.max(registry.nextControlId,integer(m.controlId,1,65535,node.name+'.controlId')+1);}if(m&&['page','popup','popup-group'].includes(m.kind)){if(m.kind==='popup-group'){if(isProject)registry.nextGroupId=Math.max(registry.nextGroupId!,integer(m.objectId,1,65535,'ID группы')+1);}else{const next=integer(m.objectId,1,65534,'ID контейнера')+1;if(isProject)registry.nextContainerId=Math.max(registry.nextContainerId!,next);else singleContainerId=Math.max(singleContainerId,next);}}let kind=m?.kind;if(!kind){try{kind=namedControl(node.name)?.kind;}catch{ /* Report invalid names in the plan, before any write. */ }}if('children' in node&&(node.type==='SECTION'||node.type==='PAGE'||!['graphic','image','slider'].includes(kind??'')))for(const child of node===root?(options.members??node.children):node.children)scan(child);}
  scan(root);
  const repaired=repairAssignments(nodes,saved,{object:()=>integer(registry.nextObjectId++,1,1000000,'ID объекта'),control:()=>integer(registry.nextControlId++,1,65535,'ID управления'),container:()=>integer(isProject?registry.nextContainerId!++:singleContainerId++,1,65534,'ID контейнера'),group:()=>integer(registry.nextGroupId!++,1,65535,'ID группы')});
  // Keys follow the current layer names; the repaired IDs stay unchanged.
  const keyChanges=syncKeys(root,options.members??('children' in root?root.children:[]),isProject,repaired,name=>namedControl(name)?.suffix??null);
  const existingFor=(node:SceneNode|PageNode)=>repaired.get(node.id)??null;
  existingRoot=existingFor(root);
  const plan:RecognitionPlan={root,options,profile,signature:signature(root,options),registry:'',writes:[],visibility:[],rows:[],keys:keyChanges.map(c=>({name:c.node.name,from:c.from,to:c.to})),errors:[],issues:[],warnings:[]},proposed=new Map<string,Metadata>();
  if(keyChanges.length)plan.warnings.push(`Ключи обновлены по именам слоёв: ${keyChanges.slice(0,3).map(c=>`${c.from} → ${c.to}`).join(', ')}${keyChanges.length>3?` и ещё ${keyChanges.length-3}`:''}. ID не изменены.`);
  let problemNode:SceneNode|PageNode=root;
  function report(error:unknown){const nodeId=(error as {nodeId?:string})?.nodeId;const node=nodes.find(n=>n.id===nodeId)??problemNode;plan.errors.push(error instanceof Error?error.message:String(error));plan.issues.push(recognitionIssue(node,root,error));}
  const reservedKeys=new Set([...repaired.values()].map(m=>m.key).filter((k):k is string=>!!k));
  const read=(node:SceneNode|PageNode)=>proposed.get(node.id)??existingFor(node);
  const newPopupRefs:SceneNode[]=[];
  function assign(node:SceneNode|PageNode,value:MetadataInput):Metadata {
    const original=saved.get(node.id),prior=existingFor(node),edit=edits.get(node.id);
    let metadata=edit?{...edit,schema:metadataSchema(edit),ownerNodeId:node.id}:node===root&&root.type==='PAGE'&&prior?.kind==='project'?{...prior,profile,projectName:options.projectName??prior.projectName}:prior??{...value,schema:metadataSchema(value),ownerNodeId:node.id};
    // Copies get their own display name. Names previously derived from the
    // frame keep following renames; explicitly customized project names stay.
    if(!edit&&original&&['page','popup'].includes(metadata.kind)&&(original.ownerNodeId!==node.id||original.projectName&&original.key?.replace(/^(page|popup)\./,'')===containerSuffix(original.projectName)))
      metadata={...metadata,projectName:node.name};
    if(metadata.kind!==value.kind)fail('kind',`${node.name}: сохранённое назначение ${metadata.kind} не соответствует ${value.kind}.`);
    if(!original||JSON.stringify(metadata)!==JSON.stringify(original)){proposed.set(node.id,metadata);plan.writes.push({node,metadata});}else if(!plan.warnings.length)plan.warnings.push('ID и свойства сохраняются, ключи следуют именам слоёв. Копии и совпадения получают свободные назначения.');
    plan.rows.push({id:node.id,name:node.name,kind:metadata.kind,...(metadata.buttonMode?{buttonMode:metadata.buttonMode}:{}),key:metadata.key,objectId:metadata.objectId,controlId:metadata.controlId,isNew:!original||original.ownerNodeId!==node.id});return metadata;
  }
  function states(button:ButtonContainer,control:Metadata){
    if(button.children.length<2||button.children.length>8)fail('states',`${button.name}: нужны 2..8 состояний. Для готового дизайна нажмите «Применить оформление» в разделе «Оформление кнопок».`);
    const custom=control.display==='multistate'||button.children.some(s=>!namedRole(s.name)),used=new Set(button.children.map(s=>existingFor(s)?.stateId).filter((id):id is number=>id!==undefined));
    for(const state of button.children){
      problemNode=state;
      requireNodeForKind(state,'state');
      const artwork=control.kind==='button'&&usesButtonArtwork(state);
      if(artwork)validateArtwork(state,button);
      else if(state.children.length<1||state.children.length>2||state.children.filter(n=>n.type==='TEXT').length!==1)fail('states',`${state.name}: нужен один Text и не более одной Frame-иконки.`);
      const sm=existingFor(state);let role=sm?.role??namedRole(state.name);
      if(!role){if(!/^(st|state)_[A-Za-z][A-Za-z0-9-]*$/i.test(state.name))fail('states',`${state.name}: используйте Normal, On, Pressed или state_Ready.`);role='feedback';}
      let stateId=sm?.stateId??ROLE_ID[role];if(custom&&!sm){stateId=role==='normal'?0:1;while(used.has(stateId))stateId++;used.add(stateId);}
      const stateName=control.buttonMode?state.name.replace(/^(st|state)_/i,''):state.name;
      assign(state,{kind:'state',role,stateId,stateName});
      if(artwork)continue;
      for(const icon of state.children.filter(n=>n.type!=='TEXT')){problemNode=icon;const im=existingFor(icon),kitArtwork=isKitNode(icon)&&icon.name==='Artwork / '+state.name;if(!im&&!kitArtwork&&!/^(Icon|(ico|icon)_[A-Za-z][A-Za-z0-9-]*)$/i.test(icon.name))fail('name',`${icon.name}: нужен Icon, ico_Music или icon_Music.`);requireNodeForKind(icon,'image');const file=`control-${control.objectId}-${stateId}.png`;assign(icon,{kind:'image',key:key(`icon.${control.key}.state${stateId}`,'Ключ иконки'),file:'assets/'+file,resourceName:'exui-'+file});}
    }
    if(control.kind==='button'){
      const visible=button.children.filter(state=>state.visible);
      if(visible.length!==1){
        const normal=button.children.find(state=>read(state)?.role==='normal');
        const shown=visible.find(state=>state===normal)??visible[0]??normal;
        if(shown){
          for(const node of button.children)if(node.visible!==(node===shown))plan.visibility.push({node,visible:node===shown});
          plan.warnings.push(`${button.name}: при сохранении для предпросмотра останется только «${shown.name}». Все состояния сохранятся в экспорте.`);
        }
      }
    }
  }
  function elements(container:FrameNode,namespace:string){
    problemNode=container;
    if(container.children.length<1||container.children.length>64)fail('elements','На экране должно быть 1..64 элемента.');
    for(const node of container.children){try{
      problemNode=node;
      const existing=existingFor(node);requireLatinName(node,KIND_PREFIX[existing?.kind??'button']??'');let named:ReturnType<typeof namedControl>=null;try{named=namedControl(node.name);}catch(e){if(!existing)throw e;}
      if(!existing&&!named){if(/^(video|vid|dynamicimage|dimg)_/i.test(node.name))fail('platform',`${node.name}: видео/динамические картинки не поддержаны профилями 1025M/300M.`);fail('name',`${node.name}: нужен поддерживаемый префикс из справочника.`);}
      const kind=existing?.kind??named!.kind;if(!isElementKind(kind))fail('placement',`${node.name}: недопустимое назначение на экране.`);
      requireNodeForKind(node,kind);
      let value:MetadataInput;
      if(existing)value=existing;
      else {
        const identity={key:freeKey(namespace+'.'+named!.suffix,reservedKeys),objectId:integer(registry.nextObjectId++,1,1000000,'ID объекта')};
        value=isControlKind(kind)?{...identity,kind,controlId:integer(registry.nextControlId++,1,65535,'ID управления')}:{...identity,kind,controlId:null};
      }
      if(!existing){if(kind==='graphic'){value.file=`assets/graphic-${value.objectId}.png`;value.resourceName=`exui-graphic-${value.objectId}.png`;}if(named?.buttonMode)value.buttonMode=named.buttonMode;if(named?.display)value.display=named.display;if(kind==='popup-ref'){const group=node.getPluginData(KIT_POPUP_GROUP_KEY);if(group)value.group=key(group,'Группа popup');else value.popup='popup.'+named!.suffix;}}
      const control=assign(node,value);
      if(kind==='popup-ref'&&!existing&&!edits.has(node.id)&&!node.getPluginData(KIT_POPUP_GROUP_KEY))newPopupRefs.push(node);
      if(kind==='button'||control.display==='multistate')states(node as ButtonContainer,control);
    }catch(e){report(e);}}
  }
  if(!isProject){if(root.type!=='FRAME')fail('node-type','Для экрана нужен Frame.');try{requireLatinName(root,'screen_');}catch(e){report(e);}const namespace=existingRoot?key(existingRoot.key,'Ключ экрана').replace(/^page\./,''):containerSuffix(root.name);assign(root,existingRoot??{kind:'page',key:freeKey('page.'+namespace,reservedKeys),objectId:100,profile,projectName:text(options.projectName??root.name,'Имя проекта')});elements(root,namespace);}
  else {
    // A section is the project boundary regardless of its user-facing name.
    // Its key is local to the root; child keys/IDs use the existing project registry.
    if(root.type==='FRAME')try{requireLatinName(root,'project_');}catch(e){report(e);}
    assign(root,existingRoot??{kind:'project',key:freeKey(root.type==='PAGE'?'project.page':root.type==='SECTION'?'project.section':'project.'+containerSuffix(root.name),reservedKeys),profile,projectName:text(options.projectName??root.name,'Имя проекта')});let pageNumber=0;
    function container(node:SceneNode,group?:string){
      problemNode=node;
      requireNodeForKind(node,'page');
      const existing=existingFor(node),match=/^(scr|screen|pop|popup|mdl|modalpopup)_(.+)$/i.exec(node.name),prefix=match?.[1].toLowerCase();
      const kind=existing?.kind??(prefix&&['pop','popup','mdl','modalpopup'].includes(prefix)?'popup':'page');
      if(group&&kind!=='popup')fail('placement','В группе допустимы только popup.');
      if(kind!=='page'&&kind!=='popup')fail('placement','В проекте допустимы страницы и popup.');
      try{requireLatinName(node,kind==='popup'?'popup_':'screen_');}catch(e){report(e);}
      const containerKey=existing?key(existing.key,'Ключ контейнера'):freeKey((kind==='page'?'page.':'popup.')+containerSuffix(node.name),reservedKeys),suffix=containerKey.replace(/^(page|popup)\./,'');
      assign(node,existing??{kind,key:containerKey,objectId:integer(registry.nextContainerId!++,1,65534,'ID контейнера'),profile,projectName:text(node.name,'Имя проекта'),shownBy:kind==='page'&&pageNumber===0?'start':'program',...(kind==='popup'?{modal:prefix==='mdl'||prefix==='modalpopup',...(group?{group}:{})}:{})});
      if(kind==='page')pageNumber++;elements(node,suffix);
    }
    for(const node of options.members??root.children){try{problemNode=node;const existing=existingFor(node),groupMatch=/^(pgrp|popupgroup)_(.+)$/i.exec(node.name);if(existing?.kind==='popup-group'||groupMatch){requireNodeForKind(node,'popup-group');try{requireLatinName(node,'popupgroup_');}catch(e){report(e);}const m=assign(node,existing??{kind:'popup-group',key:freeKey('group.'+containerSuffix(node.name),reservedKeys),objectId:integer(registry.nextGroupId!++,1,65535,'ID группы')});for(const child of node.children)container(child,m.key);}else container(node);}catch(e){report(e);}}
  }
  // Resolve after every container has its actual key, independent of layer
  // order. Saved assignments (including an explicitly cleared link) and Kit
  // bindings never participate in name inference.
  const nodeById=new Map(nodes.map(n=>[n.id,n]));
  const popupTargets=plan.rows.flatMap(row=>{
    const node=nodeById.get(row.id)!,m=read(node)!;
    return node.type!=='PAGE'&&(m.kind==='popup-group'||m.kind==='popup'&&!m.modal&&!m.group&&(!node.parent||read(node.parent as SceneNode|PageNode)?.kind!=='popup-group'))?[node]:[];
  });
  for(const ref of newPopupRefs)try{
    problemNode=ref;
    const suffix=popupNameSuffix(ref.name),matches=popupTargets.filter(n=>n.parent===ref.parent?.parent&&suffix!==undefined&&popupNameSuffix(n.name)===suffix),m=read(ref)!;
    if(matches.length>1){
      delete m.popup;delete m.group;
      fail('popup-name-ambiguous',`${ref.name}: найдены несколько целей с совпадающим именем: ${matches.map(n=>n.name).join(', ')}. Выберите popup или группу в «Содержимое места popup» и сохраните связь.`,ref);
    }
    if(matches.length===1){
      const target=read(matches[0])!;delete m.popup;delete m.group;
      if(target.kind==='popup-group')m.group=target.key;else m.popup=target.key;
    }
  }catch(e){report(e);}
  if(!plan.errors.length){try{
    // Separately exported screens can have distinct keys but the same generated
    // PNG paths. Give each distinct asset its own path without touching artwork.
    const paths=new Map<string,string>(),resources=new Map<string,string>(),reservedPaths=new Set<string>(),reservedResources=new Set<string>(),nodeById=new Map(nodes.map(n=>[n.id,n]));
    for(const row of plan.rows){const m=read(nodeById.get(row.id)!);if(m?.file)reservedPaths.add(m.file);if(m?.resourceName)reservedResources.add(m.resourceName.toLowerCase());}
    const assetRows=plan.rows.filter(row=>['graphic','image'].includes(row.kind)).sort((a,b)=>Number(proposed.has(a.id))-Number(proposed.has(b.id)));
    for(const row of assetRows){const node=nodeById.get(row.id)!;let m=read(node)!;const pathKey=paths.get(m.file!),resourceKey=resources.get(m.resourceName?.toLowerCase()??'');
      if(pathKey!==undefined&&pathKey!==m.key||resourceKey!==undefined&&resourceKey!==m.key){let file:string,name:string;do{const id=integer(registry.nextObjectId++,1,1000000,'ID ресурса');file=`assets/asset-${id}.png`;name=`exui-asset-${id}.png`;}while(reservedPaths.has(file)||reservedResources.has(name));m={...m,file,resourceName:name};proposed.set(node.id,m);const write=plan.writes.find(w=>w.node.id===node.id);if(write)write.metadata=m;else plan.writes.push({node,metadata:m});reservedPaths.add(file);reservedResources.add(name);}
      paths.set(m.file!,m.key!);resources.set(m.resourceName?.toLowerCase()??'',m.key!);
    }
    const visibility=new Map(plan.visibility.map(change=>[change.node.id,change.visible]));
    problemNode=root;capture(root,read,options,node=>visibility.get(node.id)??node.visible,false);
  }catch(e){report(e);}}
  plan.registry=JSON.stringify(registry);return plan;
}

export function applyRecognition(plan:RecognitionPlan):Capture {
  if(plan.errors.length)fail('recognition','Сначала исправьте ошибки распознавания.');
  if(plan.root.removed||plan.options.members?.some(n=>n.removed)||signature(plan.root,plan.options)!==plan.signature)fail('design-changed','Макет изменился после распознавания. Нажмите «Распознать по именам» ещё раз.');
  const originals=plan.writes.map(({node})=>({node,raw:node.getPluginData(DATA_KEY)})),oldRegistry=plan.root.getPluginData(REGISTRY_KEY);
  const previewOriginals:{node:SceneNode;visible:boolean}[]=[];
  try{
    plan.root.setPluginData(REGISTRY_KEY,plan.registry);
    for(const {node,metadata} of plan.writes)node.setPluginData(DATA_KEY,JSON.stringify(metadata));
    for(const {node,visible} of plan.visibility){previewOriginals.push({node,visible:node.visible});node.visible=visible;}
    return capture(plan.root,readMetadata,plan.options);
  }catch(e){
    const errors:string[]=[];
    for(const {node,visible} of previewOriginals.reverse()){try{node.visible=visible;}catch{errors.push(node.name);}}
    for(const {node,raw} of originals){try{node.setPluginData(DATA_KEY,raw);}catch{errors.push(node.name);}}
    if(!errors.length){try{plan.root.setPluginData(REGISTRY_KEY,oldRegistry);}catch{errors.push(plan.root.name);}}
    if(errors.length)fail('recognition-rollback',`Не удалось полностью восстановить назначения и видимость: ${errors.join(', ')}. Проверьте их вручную и повторите распознавание. Резерв ID сохранён, если запись реестра была выполнена.`);
    throw e;
  }
}
