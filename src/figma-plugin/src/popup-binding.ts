import { DATA_KEY,PROFILES,fail,integer,key,metadataSchema,readMetadata,text,type Metadata,type Profile } from './model.ts';
import { recognize,REGISTRY_KEY,type RecognitionPlan } from './recognize.ts';
import { selectionKind } from './scope.ts';
import { byName,type ProjectNode,type ProjectOptions } from './project.ts';
import { hasTransform } from './read-node.ts';
import { MANUAL_KEY } from './key-sync.ts';
import { requireLatinName } from './latin-name.ts';

type Context={root:ProjectNode;options:ProjectOptions};
const stored=(node:BaseNode)=>readMetadata(node,{allowCopied:true});
const isProject=(node:BaseNode)=>stored(node)?.kind==='project'||node.type==='SECTION'||node.type==='FRAME'&&/^(project|prj)_/i.test(node.name);
function owner(node:BaseNode):ProjectNode {
  let p=node.parent;while(p&&p.type!=='PAGE'){if(isProject(p))return p as ProjectNode;p=p.parent;}
  if(p?.type==='PAGE')return p;return fail('popup-binding','Frame удалён или не принадлежит открытой странице.');
}
function context(node:SceneNode,profile:Profile):Context {
  const root=owner(node);
  if(root.type!=='PAGE')return {root,options:{}};
  const size=PROFILES[profile];
  const members=root.children.filter(n=>n.type==='FRAME'&&(selectionKind(n)==='popup'||selectionKind(n)==='popup-group'||(stored(n)?.kind==='page'||/^(screen|scr)_/i.test(n.name)||/^home$/i.test(n.name))&&n.width===size.width&&n.height===size.height));
  return {root,options:{members,projectName:figma.root.name}};
}
function frame(node:SceneNode):asserts node is FrameNode {
  if(node.type!=='FRAME')fail('node-type','Выберите Frame экрана, popup или места popup.');
}
function reference(node:SceneNode):asserts node is FrameNode {
  frame(node);if(selectionKind(node)!=='popup-ref')fail('popup-binding','Выберите Frame с именем popupref_Name.');
  requireLatinName(node,'popupref_');
  if(node.children.length)fail('popup-binding','Место popup должно быть пустым Frame.');
  const parent=node.parent;
  if(!parent||parent.type!=='FRAME'||selectionKind(parent)==='popup'||selectionKind(parent)==='popup-group'||!(/^(screen|scr)_/i.test(parent.name)||/^home$/i.test(parent.name)||stored(parent)?.kind==='page'))
    fail('popup-binding','Место popup должно находиться непосредственно внутри Frame экрана.');
}
function draft(plan:RecognitionPlan,node:SceneNode|PageNode):Metadata {
  const current=stored(node);
  const value=current?.ownerNodeId===node.id?current:plan.writes.find(w=>w.node.id===node.id)?.metadata;
  if(!value||!plan.rows.some(row=>row.id===node.id))fail('popup-binding',`${node.name}: не удалось подготовить назначение. Проверьте имя и положение Frame.`);
  key(value.key,'Ключ');integer(value.objectId,1,value.kind==='popup-group'?65535:['popup','page'].includes(value.kind)?65534:1000000,'ID объекта');
  return {...value};
}
function ancestors(nodes:SceneNode[],root:ProjectNode):Set<string> {
  const ids=new Set<string>([root.id]);for(const node of nodes){let p:BaseNode|null=node;while(p){ids.add(p.id);if(p===root)break;p=p.parent;}}return ids;
}
// Authoring a connection may precede artwork validation. Persist only the
// selected containers/place and their new ancestors, never unrelated controls.
function saveDraft(plan:RecognitionPlan,nodes:SceneNode[],values:Map<string,Metadata>,manual?:{node:SceneNode;value:string}):()=>void {
  const ids=ancestors(nodes,plan.root),writes=plan.writes.filter(w=>ids.has(w.node.id)&&!stored(w.node));
  for(const node of nodes){const value=values.get(node.id);if(value){const i=writes.findIndex(w=>w.node.id===node.id);if(i>=0)writes.splice(i,1);writes.push({node,metadata:value});}}
  const old=writes.map(w=>({node:w.node,value:w.node.getPluginData(DATA_KEY)})),registry=plan.root.getPluginData(REGISTRY_KEY),oldManual=manual?.node.getPluginData(MANUAL_KEY);
  const restore=()=>{
    const failed:string[]=[];
    for(const item of old)try{item.node.setPluginData(DATA_KEY,item.value);}catch{failed.push(item.node.name);}
    if(manual)try{manual.node.setPluginData(MANUAL_KEY,oldManual!);}catch{failed.push(manual.node.name);}
    if(!failed.length)try{plan.root.setPluginData(REGISTRY_KEY,registry);}catch{failed.push(plan.root.name);}
    if(failed.length)fail('popup-binding-rollback',`Не удалось восстановить назначения: ${failed.join(', ')}. Проверьте Frame; резерв ID сохранён.`);
  };
  try {
    plan.root.setPluginData(REGISTRY_KEY,plan.registry);
    for(const w of writes)w.node.setPluginData(DATA_KEY,JSON.stringify(w.metadata));
    if(manual)manual.node.setPluginData(MANUAL_KEY,manual.value);
  }catch(error){restore();throw error;}
  return restore;
}
export function savePopupPlace(node:SceneNode,data:Record<string,unknown>,profile:Profile):void {
  reference(node);
  const ctx=context(node,profile);
  // A standalone screen can have a draft place before popups are drawn nearby.
  const root=ctx.root.type==='PAGE'&&ctx.options.members?.length===1?node.parent as FrameNode:ctx.root;
  const options=root===ctx.root?ctx.options:{};
  const plan=recognize(root,profile,options),m=draft(plan,node),before=stored(node);
  m.kind='popup-ref';m.controlId=null;
  if(data.key)m.key=key(data.key,'Ключ');
  if(data.objectId!==undefined&&data.objectId!=='')m.objectId=integer(Number(data.objectId),1,1000000,'ID объекта');
  if(data.popup&&data.group)fail('popup-ref','Выберите popup или группу, а не обе цели.');
  delete m.popup;delete m.group;
  if(data.popup)m.popup=key(data.popup,'Ключ popup');if(data.group)m.group=key(data.group,'Ключ группы');
  for(const field of ['exportBackground','exportStroke'] as const){
    if(data[field]!==undefined&&!['true','false'].includes(String(data[field])))fail('appearance','Выберите, экспортировать ли оформление popup.');
    delete m[field];if(data[field]==='true')m[field]=true;
  }
  m.schema=metadataSchema(m);m.ownerNodeId=node.id;
  const manual=data.key===''?'':data.keyEdited==='true'&&data.key!==before?.key?node.id:node.getPluginData(MANUAL_KEY);
  saveDraft(plan,[node],new Map([[node.id,m]]),{node,value:manual});
}

export function saveContainerSettings(node:SceneNode,data:Record<string,unknown>,profile:Profile):void {
  frame(node);const kind=data.kind;
  if(!['page','popup','popup-group'].includes(String(kind)))fail('kind','Выберите тип контейнера.');
  const ctx=context(node,profile),root=ctx.root.type==='PAGE'&&ctx.options.members?.length===1&&kind==='page'?node:ctx.root;
  const plan=recognize(root,profile,root===ctx.root?ctx.options:{}),m=draft(plan,node),before=stored(node);
  if(m.kind!==kind)fail('kind','Имя Frame не соответствует выбранному типу. Используйте screen_, popup_ или popupgroup_.');
  if(data.key)m.key=key(data.key,'Ключ');
  if(data.objectId!==undefined&&data.objectId!=='')m.objectId=integer(Number(data.objectId),1,kind==='popup-group'?65535:65534,'ID объекта');
  if(kind!=='popup-group'){
    m.profile=profile;if(data.projectName)m.projectName=text(data.projectName,'Имя проекта');
    if(data.shownBy){if(!['start','program','navigation'].includes(String(data.shownBy))||kind==='popup'&&data.shownBy==='start')fail('page','Выберите допустимый способ показа.');m.shownBy=data.shownBy as Metadata['shownBy'];}
  }
  if(kind==='popup'){
    m.modal=data.modal==='true';
    for(const field of ['exportBackground','exportStroke'] as const){
      if(data[field]!==undefined&&!['true','false'].includes(String(data[field])))fail('appearance','Выберите, экспортировать ли оформление popup.');
      delete m[field];if(data[field]==='true')m[field]=true;
    }
  }
  m.schema=metadataSchema(m);m.ownerNodeId=node.id;
  const nodes=[node],values=new Map([[node.id,m]]);
  if(kind==='page'&&data.shownBy==='start'){
    function visit(n:SceneNode|PageNode){
      if(n.id!==node.id&&plan.rows.some(row=>row.id===n.id&&row.kind==='page')){
        const other=draft(plan,n);
        if((other.shownBy==='start'||!other.shownBy)&&n.type==='FRAME'){
          const normal={...other,shownBy:'program' as const};normal.schema=metadataSchema(normal);nodes.push(n);values.set(n.id,normal);
        }
      }
      if('children' in n)for(const child of n===plan.root?(plan.options.members??n.children):n.children)visit(child);
    }
    visit(plan.root);
  }
  const manual=data.key===''?'':data.keyEdited==='true'&&data.key!==before?.key?node.id:node.getPluginData(MANUAL_KEY);
  saveDraft(plan,nodes,values,{node,value:manual});
}

function selectedPopups():FrameNode[] {
  const selection=figma.currentPage.selection;
  const nodes=selection.length===1&&selectionKind(selection[0])==='popup-group'&&selection[0].type==='FRAME'?selection[0].children:selection;
  if(!nodes.length||nodes.some(n=>n.type!=='FRAME'||selectionKind(n)!=='popup'))fail('popup-binding','Выделите popup-фреймы вместе или их группу.');
  const popups=[...nodes] as FrameNode[];
  if(popups.some(n=>stored(n)?.modal===true||/^(modalpopup|mdl)_/i.test(n.name)&&stored(n)?.modal!==false))fail('popup-binding','Модальный popup нельзя размещать внутри места popup.');
  return popups;
}
export interface PopupBindingInfo {popupIds:string[];names:string[];targets:{id:string;name:string}[];referenceId?:string;error?:string}
export function popupBindingInfo(profile:Profile):PopupBindingInfo|undefined {
  const selection=figma.currentPage.selection;
  if(!selection.length||!selection.every(n=>['popup','popup-group'].includes(selectionKind(n)??'')))return;
  try {
    const popups=selectedPopups(),root=owner(popups[0]);
    if(popups.some(p=>owner(p)!==root))fail('popup-binding','Выберите popup одного проекта.');
    const targets:{id:string;name:string}[]=[],bound:string[]=[];
    const group=popups[0].parent,groupKey=group&&selectionKind(group)==='popup-group'?stored(group)?.key:undefined;
    function scan(node:SceneNode|PageNode) {
      if(node.type!=='PAGE'&&node!==root&&isProject(node))return;
      if(node.type!=='PAGE'&&selectionKind(node)==='popup-ref'){
        try{reference(node);const parent=node.parent as FrameNode,size=PROFILES[profile];if(owner(node)===root&&parent.width===size.width&&parent.height===size.height&&(!stored(parent)?.profile||stored(parent)?.profile===profile)){
          targets.push({id:node.id,name:`${parent.name} → ${node.name}`});
          const m=stored(node);if(groupKey&&m?.group===groupKey||popups.length===1&&m?.popup&&m.popup===stored(popups[0])?.key)bound.push(node.id);
        }}catch{ /* An invalid Frame cannot be a destination. */ }
      }else if('children' in node&&!(node.type!=='PAGE'&&selectionKind(node)==='popup'))for(const child of node.children)scan(child);
    }
    scan(root);
    return {popupIds:popups.map(p=>p.id),names:popups.map(p=>p.name),targets:byName(targets),...(bound.length===1?{referenceId:bound[0]}:{})};
  }catch(error){return {popupIds:[],names:[],targets:[],error:(error as Error).message};}
}
export function bindPopups(referenceId:string,popupIds:readonly string[],profile:Profile):Context {
  const popups=selectedPopups();
  if(popups.length!==popupIds.length||popups.some(p=>!popupIds.includes(p.id)))fail('popup-binding','Выделение изменилось. Выберите popup и место ещё раз.');
  const info=popupBindingInfo(profile);if(!info?.targets.some(t=>t.id===referenceId))fail('popup-binding','Место popup удалено или находится в другом проекте.');
  let target:SceneNode|undefined;
  function find(node:SceneNode|PageNode){if(node.id===referenceId&&node.type!=='PAGE')target=node;else if('children' in node)for(const c of node.children)find(c);}
  find(figma.currentPage);if(!target)fail('popup-binding','Место popup удалено.');reference(target);
  const ref=target,ctx=context(ref,profile),parent=popups[0].parent;
  for(const popup of popups){requireLatinName(popup,'popup_');if(stored(popup)?.profile&&stored(popup)?.profile!==profile)fail('popup-binding','Popup и место должны использовать один профиль панели.');}
  if(!parent||popups.some(p=>p.parent!==parent))fail('popup-binding','Выберите popup, расположенные рядом внутри одного Frame или секции.');
  if(popups.some(p=>hasTransform(p))||hasTransform(ref))fail('popup-binding','Для связывания нужны Frame без поворота, отражения и масштаба.');
  const size=[Math.round(ref.width),Math.round(ref.height)];
  if(popups.some(p=>Math.round(p.width)!==size[0]||Math.round(p.height)!==size[1]))fail('popup-binding',`Размеры popup должны совпадать с ${ref.name}: ${size[0]}×${size[1]}. Размеры автоматически не меняются.`);
  if(size.some(v=>v<1)||size[0]>PROFILES[profile].width||size[1]>PROFILES[profile].height)fail('popup-binding','Место popup должно помещаться в размер панели.');
  const reuse=parent.type==='FRAME'&&selectionKind(parent)==='popup-group';
  if(reuse&&(parent.children.length!==popups.length||parent.children.some(c=>!popups.includes(c as FrameNode))))fail('popup-binding','Выберите всю существующую группу: нельзя переносить только часть её popup.');
  if(!reuse&&(parent!==ctx.root||'layoutMode' in parent&&parent.layoutMode!=='NONE'))fail('popup-binding','Отдельные popup должны лежать непосредственно в проекте, без Auto Layout.');
  const original=popups.map(node=>({node,index:parent.children.indexOf(node),x:node.x,y:node.y})),selection=figma.currentPage.selection;
  let group:FrameNode|undefined,undo:(()=>void)|undefined;
  try {
    if(reuse)group=parent as FrameNode;
    else {
      const base=('popupgroup_'+ref.name.replace(/^(popupref|pr)_/i,'')).slice(0,245).replace(/[.-]+$/,''),names=new Set(parent.children.map(n=>n.name.toLowerCase()));let name=base,index=2;
      while(names.has(name.toLowerCase()))name=base+'-'+index++;
      group=figma.createFrame();group.name=name;group.fills=[];group.strokes=[];group.clipsContent=false;
      const left=Math.min(...popups.map(p=>p.x)),top=Math.min(...popups.map(p=>p.y));
      group.resize(Math.max(...popups.map(p=>p.x+p.width))-left,Math.max(...popups.map(p=>p.y+p.height))-top);
      parent.insertChild(Math.min(...original.map(p=>p.index)),group);group.x=left;group.y=top;
      for(const item of original){group.appendChild(item.node);item.node.x=item.x-left;item.node.y=item.y-top;}
      if(ctx.root.type==='PAGE')ctx.options.members=[...(ctx.options.members??[]).filter(n=>!popups.includes(n as FrameNode)),group];
    }
    const plan=recognize(ctx.root,profile,ctx.options),g=draft(plan,group),r=draft(plan,ref);
    if(g.kind!=='popup-group'||r.kind!=='popup-ref')fail('popup-binding','Проверьте назначения группы и места popup.');
    r.group=g.key;delete r.popup;
    const values=new Map<string,Metadata>([[group.id,g],[ref.id,r]]);
    for(const node of popups){const m=draft(plan,node);m.group=g.key;values.set(node.id,m);}
    undo=saveDraft(plan,[group,ref,...popups],values);
    figma.currentPage.selection=[ref];
    return ctx;
  }catch(error){
    const failed:string[]=[];
    if(undo)try{undo();}catch(e){failed.push((e as Error).message);}
    if(!reuse&&group){
      for(const item of [...original].sort((a,b)=>a.index-b.index))try{parent.insertChild(item.index,item.node);item.node.x=item.x;item.node.y=item.y;}catch{failed.push(item.node.name);}
      if(!group.children.length)try{group.remove();}catch{failed.push(group.name);}
    }
    try{figma.currentPage.selection=selection;}catch{failed.push('выделение');}
    if(failed.length)fail('popup-binding-rollback',`Связывание не завершено. Не удалось полностью восстановить: ${failed.join(', ')}. Исходные popup не удалены; проверьте их положение.`);
    throw error;
  }
}
