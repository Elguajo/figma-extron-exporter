import { DATA_KEY,PROFILES,ROLE_ID,ELEMENT_KINDS,CONTROL_KINDS,metadataSchema,fail,integer,key,readMetadata,text,type Kind,type Metadata,type Profile,type Role } from './model.ts';
import { capture,designSignature } from './export.ts';

export const REGISTRY_KEY='exui-id-registry';
interface Registry {schema:'exui-id-registry/1'|'exui-id-registry/2';ownerNodeId:string;nextObjectId:number;nextControlId:number;nextContainerId?:number;nextGroupId?:number}
export interface RecognitionRow {id:string;name:string;kind:Kind;key?:string;objectId?:number;controlId?:number|null;isNew:boolean}
export interface RecognitionPlan {root:FrameNode;profile:Profile;signature:string;registry:string;writes:{node:SceneNode;metadata:Metadata}[];rows:RecognitionRow[];errors:string[];warnings:string[]}
const TYPES:Record<string,Kind>={btn:'button',button:'button',lvl:'level',level:'level',txt:'label',text:'label',logo:'graphic',img:'graphic',image:'graphic',val:'value',value:'value',sld:'slider',slider:'slider',shp:'shape',shape:'shape',ln:'line',line:'line',dt:'datetime',datetime:'datetime',pr:'popup-ref',popupref:'popup-ref',gau:'level',gauge:'level',ind:'level',indicator:'level',led:'level',volumeled:'level',mlvl:'level',multilevel:'level'};
export function namedControl(name:string):{kind:Kind;suffix:string;display?:Metadata['display']}|null {
  const match=/^([a-z]+)_(.+)$/i.exec(name);if(!match)return null;
  const prefix=match[1].toLowerCase(),kind=TYPES[prefix];if(!kind)return null;
  const result:{kind:Kind;suffix:string;display?:Metadata['display']}={kind,suffix:slug(match[2])};
  if(['gau','gauge','ind','indicator'].includes(prefix))result.display='gauge';
  if(['led','volumeled'].includes(prefix))result.display='volume-led';
  if(['mlvl','multilevel'].includes(prefix))result.display='multistate';
  return result;
}
function slug(value:string):string {if(!/^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*$/.test(value))fail('name',`${value}: используйте латинские буквы, цифры и дефисы без пробелов, например VolumeDown.`);return key(value.toLowerCase(),'Имя слоя');}
export function namedRole(name:string):Role|null {return ({off:'normal',normal:'normal',on:'feedback',feedback:'feedback',pressed:'pressed'} as Record<string,Role>)[name.replace(/^(st|state)_/i,'').toLowerCase()]??null;}
function signature(root:FrameNode):string {return designSignature(root)+'\n'+root.getPluginData(REGISTRY_KEY);}

export function recognize(root:SceneNode,profile:Profile):RecognitionPlan {
  if(root.type!=='FRAME')fail('selection','Выберите внешний Frame экрана или project_Name.');
  if(!Object.prototype.hasOwnProperty.call(PROFILES,profile))fail('profile','Выберите профиль панели.');
  let parent=root.parent;while(parent&&parent.type!=='PAGE'){if(['page','popup'].includes(readMetadata(parent)?.kind??''))fail('placement','Для распознавания выберите внешний Frame экрана.');parent=parent.parent;}
  const existingRoot=readMetadata(root),isProject=existingRoot?.kind==='project'||!existingRoot&&/^(prj|project)_/i.test(root.name);
  if(existingRoot&&existingRoot.kind!==(isProject?'project':'page'))fail('placement','Выбран элемент с другим назначением.');
  if(existingRoot?.profile&&existingRoot.profile!==profile)fail('profile','Выбранный профиль отличается от сохранённого профиля экрана.');
  const canvas=PROFILES[profile];if(!isProject&&(root.width!==canvas.width||root.height!==canvas.height))fail('profile',`Для этого профиля нужен Frame ${canvas.width}×${canvas.height}.`);
  const registry:Registry={schema:isProject?'exui-id-registry/2':'exui-id-registry/1',ownerNodeId:root.id,nextObjectId:1,nextControlId:8101,...(isProject?{nextContainerId:100,nextGroupId:1}:{})};
  function importRegistry(node:SceneNode,main=false){const raw=node.getPluginData(REGISTRY_KEY);if(!raw)return;let r:Registry;try{r=JSON.parse(raw);}catch{fail('registry','Повреждён реестр ID экрана.');}if(!r||!['exui-id-registry/1','exui-id-registry/2'].includes(r.schema)||r.ownerNodeId!==node.id)fail('registry','Неизвестный или скопированный реестр ID экрана.');if(r.schema==='exui-id-registry/2'){integer(r.nextContainerId,1,65535,'Следующий ID контейнера');integer(r.nextGroupId,1,65536,'Следующий ID группы');}integer(r.nextObjectId,1,1000001,'Следующий ID объекта');integer(r.nextControlId,1,65536,'Следующий ID управления');registry.nextObjectId=Math.max(registry.nextObjectId,r.nextObjectId);registry.nextControlId=Math.max(registry.nextControlId,r.nextControlId);if(isProject){registry.nextContainerId=Math.max(registry.nextContainerId!,integer(r.nextContainerId??100,1,65535,'Следующий ID контейнера'));registry.nextGroupId=Math.max(registry.nextGroupId!,integer(r.nextGroupId??1,1,65536,'Следующий ID группы'));}else if(main&&r.schema!=='exui-id-registry/1')fail('registry','Для экрана ожидается реестр ID экрана.');}
  function scan(node:SceneNode){importRegistry(node,node.id===root.id);const m=readMetadata(node);if(m&&ELEMENT_KINDS.includes(m.kind)){registry.nextObjectId=Math.max(registry.nextObjectId,integer(m.objectId,1,1000000,node.name+'.objectId')+1);if(CONTROL_KINDS.includes(m.kind))registry.nextControlId=Math.max(registry.nextControlId,integer(m.controlId,1,65535,node.name+'.controlId')+1);}if(isProject&&m&&['page','popup','popup-group'].includes(m.kind)){if(m.kind==='popup-group')registry.nextGroupId=Math.max(registry.nextGroupId!,integer(m.objectId,1,65535,'ID группы')+1);else registry.nextContainerId=Math.max(registry.nextContainerId!,integer(m.objectId,1,65534,'ID контейнера')+1);}if('children' in node&&!['graphic','image','slider'].includes(m?.kind??namedControl(node.name)?.kind??''))for(const child of node.children)scan(child);}
  scan(root);
  const plan:RecognitionPlan={root,profile,signature:signature(root),registry:'',writes:[],rows:[],errors:[],warnings:[]},proposed=new Map<string,Metadata>();
  const read=(node:SceneNode)=>proposed.get(node.id)??readMetadata(node);
  function assign(node:SceneNode,value:Omit<Metadata,'schema'|'ownerNodeId'>):Metadata {
    const existing=readMetadata(node),metadata=existing??{...value,schema:metadataSchema(value),ownerNodeId:node.id};
    if(metadata.kind!==value.kind)fail('kind',`${node.name}: сохранённое назначение ${metadata.kind} не соответствует ${value.kind}.`);
    if(!existing){proposed.set(node.id,metadata);plan.writes.push({node,metadata});}else if(!plan.warnings.length)plan.warnings.push('Для уже назначенных элементов сохранённые типы, ключи и ID имеют приоритет над именами слоёв.');
    plan.rows.push({id:node.id,name:node.name,kind:metadata.kind,key:metadata.key,objectId:metadata.objectId,controlId:metadata.controlId,isNew:!existing});return metadata;
  }
  function states(button:FrameNode,control:Metadata){
    if(button.children.length<2||button.children.length>8)fail('states',`${button.name}: нужны 2..8 Frame состояний.`);
    const custom=control.display==='multistate'||button.children.some(s=>!namedRole(s.name)),used=new Set(button.children.map(s=>readMetadata(s)?.stateId).filter((id):id is number=>id!==undefined));
    for(const state of button.children){
      if(state.type!=='FRAME')fail('node-type',`${state.name}: состояние должно быть Frame.`);
      if(state.children.length<1||state.children.length>2||state.children.filter(n=>n.type==='TEXT').length!==1)fail('states',`${state.name}: нужен один Text и не более одной Frame-иконки.`);
      const sm=readMetadata(state);let role=sm?.role??namedRole(state.name);
      if(!role){if(!/^(st|state)_[A-Za-z][A-Za-z0-9-]*$/i.test(state.name))fail('states',`${state.name}: используйте Normal, On, Pressed или state_Ready.`);role='feedback';}
      let stateId=sm?.stateId??ROLE_ID[role];if(custom&&!sm){stateId=role==='normal'?0:1;while(used.has(stateId))stateId++;used.add(stateId);}
      assign(state,{kind:'state',role,stateId,stateName:state.name});
      for(const icon of state.children.filter(n=>n.type!=='TEXT')){const im=readMetadata(icon);if(!im&&!/^(Icon|(ico|icon)_[A-Za-z][A-Za-z0-9-]*)$/i.test(icon.name))fail('name',`${icon.name}: нужен Icon, ico_Music или icon_Music.`);if(icon.type!=='FRAME')fail('node-type',`${icon.name}: для иконки нужен Frame.`);const file=`control-${control.objectId}-${stateId}.png`;assign(icon,{kind:'image',key:key(`icon.${control.key}.state${stateId}`,'Ключ иконки'),file:'assets/'+file,resourceName:'exui-'+file});}
    }
  }
  function elements(container:FrameNode,namespace:string){
    if(container.children.length<1||container.children.length>64)fail('elements','На экране должно быть 1..64 элемента.');const suffixes=new Set<string>();
    for(const node of container.children){try{
      const existing=readMetadata(node);let named:ReturnType<typeof namedControl>=null;try{named=namedControl(node.name);}catch(e){if(!existing)throw e;}
      if(named){if(suffixes.has(named.suffix))fail('duplicate-name',`${node.name}: повтор имени ${named.suffix}; регистр и префикс не различают элементы.`);suffixes.add(named.suffix);}
      if(!existing&&!named){if(/^(video|vid|dynamicimage|dimg)_/i.test(node.name))fail('platform',`${node.name}: видео/динамические картинки не поддержаны профилями 1025M/300M.`);fail('name',`${node.name}: нужен поддерживаемый префикс из справочника.`);}
      const kind=existing?.kind??named!.kind;if(!ELEMENT_KINDS.includes(kind))fail('placement',`${node.name}: недопустимое назначение на экране.`);
      const textKind=['label','value','datetime'].includes(kind),primitive=['shape','line'].includes(kind);
      if(textKind?node.type!=='TEXT':primitive?!['FRAME','RECTANGLE','ELLIPSE'].includes(node.type):node.type!=='FRAME')fail('node-type',`${node.name}: нужен ${textKind?'Text':primitive?'Frame, Rectangle или Ellipse':'Frame'}.`);
      const value:Omit<Metadata,'schema'|'ownerNodeId'>=existing??{kind,key:key(namespace+'.'+named!.suffix,node.name),objectId:integer(registry.nextObjectId++,1,1000000,'ID объекта'),controlId:CONTROL_KINDS.includes(kind)?integer(registry.nextControlId++,1,65535,'ID управления'):null};
      if(!existing){if(kind==='graphic'){value.file=`assets/graphic-${value.objectId}.png`;value.resourceName=`exui-graphic-${value.objectId}.png`;}if(named?.display)value.display=named.display;if(kind==='datetime')value.pattern=(node as TextNode).characters;if(kind==='popup-ref')value.popup='popup.'+named!.suffix;}
      const control=assign(node,value);if(kind==='button'||control.display==='multistate')states(node as FrameNode,control);
    }catch(e){plan.errors.push(e instanceof Error?e.message:String(e));}}
  }
  if(!isProject){const namespace=existingRoot?key(existingRoot.key,'Ключ экрана').replace(/^page\./,''):slug(root.name.replace(/^(scr|screen)_/i,''));assign(root,existingRoot??{kind:'page',key:'page.'+namespace,objectId:100,profile,projectName:text(root.name,'Имя проекта')});elements(root,namespace);}
  else {
    assign(root,existingRoot??{kind:'project',key:'project.'+slug(root.name.replace(/^(prj|project)_/i,'')),profile,projectName:text(root.name,'Имя проекта')});let pageNumber=0;
    function container(node:SceneNode,group?:string){
      if(node.type!=='FRAME')fail('node-type',`${node.name}: нужен Frame экрана/popup.`);
      const existing=readMetadata(node),match=/^(scr|screen|pop|popup|mdl|modalpopup)_(.+)$/i.exec(node.name),prefix=match?.[1].toLowerCase();
      const kind=existing?.kind??(prefix&&['pop','popup','mdl','modalpopup'].includes(prefix)?'popup':'page');if(!['page','popup'].includes(kind))fail('placement','В проекте допустимы страницы и popup.');
      if(group&&kind!=='popup')fail('placement','В группе допустимы только popup.');
      const suffix=existing?key(existing.key,'Ключ контейнера').replace(/^(page|popup)\./,''):slug(match?.[2]??node.name);
      assign(node,existing??{kind,key:(kind==='page'?'page.':'popup.')+suffix,objectId:integer(registry.nextContainerId!++,1,65534,'ID контейнера'),profile,projectName:text(root.name,'Имя проекта'),shownBy:kind==='page'&&pageNumber===0?'start':'program',...(kind==='popup'?{modal:prefix==='mdl'||prefix==='modalpopup',...(group?{group}:{})}:{})});
      if(kind==='page')pageNumber++;elements(node,suffix);
    }
    for(const node of root.children){try{const existing=readMetadata(node),groupMatch=/^(pgrp|popupgroup)_(.+)$/i.exec(node.name);if(existing?.kind==='popup-group'||groupMatch){if(node.type!=='FRAME')fail('node-type','Группа popup должна быть Frame.');const m=assign(node,existing??{kind:'popup-group',key:'group.'+slug(groupMatch![2]),objectId:integer(registry.nextGroupId!++,1,65535,'ID группы')});for(const child of node.children)container(child,m.key);}else container(node);}catch(e){plan.errors.push(e instanceof Error?e.message:String(e));}}
  }
  if(!plan.errors.length){try{capture(root,read);}catch(e){plan.errors.push(e instanceof Error?e.message:String(e));}}
  plan.registry=JSON.stringify(registry);return plan;
}

export function applyRecognition(plan:RecognitionPlan):void {
  if(plan.errors.length)fail('recognition','Сначала исправьте ошибки распознавания.');
  if(plan.root.removed||signature(plan.root)!==plan.signature)fail('design-changed','Макет изменился после распознавания. Нажмите «Распознать по именам» ещё раз.');
  const originals=plan.writes.map(({node})=>({node,raw:node.getPluginData(DATA_KEY)})),oldRegistry=plan.root.getPluginData(REGISTRY_KEY);
  try{plan.root.setPluginData(REGISTRY_KEY,plan.registry);for(const {node,metadata} of plan.writes)node.setPluginData(DATA_KEY,JSON.stringify(metadata));capture(plan.root);}
  catch(e){const errors:string[]=[];for(const {node,raw} of originals){try{node.setPluginData(DATA_KEY,raw);}catch{errors.push(node.name);}}if(!errors.length){try{plan.root.setPluginData(REGISTRY_KEY,oldRegistry);}catch{errors.push(plan.root.name);}}if(errors.length)fail('recognition-rollback',`Не удалось полностью восстановить назначения: ${errors.join(', ')}. Проверьте их вручную и повторите распознавание. Резерв ID сохранён, если запись реестра была выполнена.`);throw e;}
}
