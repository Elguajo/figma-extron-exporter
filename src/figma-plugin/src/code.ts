import { DATA_KEY, PROFILES, ROLE_ID, fail, integer, key, readMetadata, text, type Metadata, type Profile, type Role } from './model.ts';
import { capture, exportFrame } from './export.ts';
import { createDemo, tag } from './demo.ts';
// The build injects only our two local PNG resources; no remote source or server.
declare const __ICONS__: Record<string,number[]>;
declare const __html__:string;
figma.showUI(__html__,{width:420,height:720,themeColors:true});
let busy=false;
function selected():SceneNode {const selection=figma.currentPage.selection;if(selection.length!==1)fail('selection','Выберите один Frame экрана или один его элемент.');return selection[0];}
function screenOf(node:SceneNode):FrameNode {
  let current:BaseNode|null=node;
  while(current&&current.type!=='PAGE') {
    const metadata=readMetadata(current);
    if(metadata?.kind==='page'&&current.type==='FRAME')return current;
    current=current.parent;
  }
  return fail('selection','Выберите подготовленный Frame экрана. Для первого запуска создайте демо.');
}
function publish():void {
  try {const n=selected();let metadata:Metadata|null=null;let warning='';try{metadata=readMetadata(n);}catch(e){warning=String((e as Error).message);}
    figma.ui.postMessage({type:'selection',id:n.id,name:n.name,nodeType:n.type,metadata,warning});
  }catch {figma.ui.postMessage({type:'selection',id:null,name:'Выберите один элемент или Frame экрана'});}
}
function apply(data:Record<string,unknown>):void {
  const node=selected();const kind=data.kind as Metadata['kind'];
  const value:Omit<Metadata,'schema'|'ownerNodeId'>={kind};
  if(['page','button','label','level'].includes(kind)) {
    value.key=key(data.key,'Ключ');value.objectId=integer(Number(data.objectId),1,kind==='page'?65534:1000000,'objectId');
    if(kind!=='page')value.controlId=kind==='label'?null:integer(Number(data.controlId),1,65535,'controlId');
  }
  if(kind==='page') {
    if(!Object.prototype.hasOwnProperty.call(PROFILES,String(data.profile)))fail('profile','Выберите профиль панели.');
    value.profile=data.profile as Profile;value.projectName=text(data.projectName,'Имя проекта');
  }else if(kind==='state') {
    if(!Object.prototype.hasOwnProperty.call(ROLE_ID,String(data.role)))fail('states','Выберите роль состояния.');
    value.role=data.role as Role;value.stateId=ROLE_ID[value.role];value.stateName=text(data.stateName,'Имя состояния');
  }else if(kind==='image') {
    value.key=key(data.key,'Ключ ресурса');value.file=String(data.file);value.resourceName=String(data.resourceName);
    if(!/^assets\/[a-z0-9][a-z0-9-]{0,63}\.png$/.test(value.file)||/[\r\n]/.test(value.file)||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.png$/.test(value.resourceName)||/[\r\n]/.test(value.resourceName)) fail('image','Задайте assets/name.png и ASCII resourceName.png.');
  }else if(!['button','label','level'].includes(kind))fail('kind','Выберите назначение элемента.');
  if(kind==='label'?node.type!=='TEXT':node.type!=='FRAME') fail('node-type',kind==='label'?'Для Label выберите Text.':'Для этого назначения выберите Frame.');
  if(kind!=='page') {
    const parentKind=node.parent?readMetadata(node.parent)?.kind:undefined;
    const expected=kind==='state'?'button':kind==='image'?'state':'page';
    if(parentKind!==expected)fail('placement',`${node.name}: сначала назначьте родительский Frame как ${expected}. Текст внутри состояния кнопки не является отдельным Label.`);
  }
  tag(node,value);
}
figma.on('selectionchange',publish);
figma.ui.onmessage=async(message:{type:string;data?:Record<string,unknown>;profile?:Profile;role?:Role})=>{
  if(message.type==='ready'){publish();return;}
  if(busy){figma.ui.postMessage({type:'error',message:'Дождитесь завершения текущей операции.'});return;}
  busy=true;
  try {
    if(message.type==='demo') {
      if(!message.profile||!Object.prototype.hasOwnProperty.call(PROFILES,message.profile))fail('profile','Выберите профиль.');
      await createDemo(message.profile,Object.fromEntries(Object.entries(__ICONS__).map(([k,v])=>[k,new Uint8Array(v)])));
      publish();figma.ui.postMessage({type:'success',message:'Демо создано. Можно редактировать и экспортировать выбранный экран.'});
    }else if(message.type==='apply') {apply(message.data??{});publish();figma.ui.postMessage({type:'success',message:'Назначение сохранено в Figma-узле.'});}
    else if(message.type==='preview') {
      const node=selected();if(node.type!=='FRAME'||readMetadata(node)?.kind!=='button')fail('selection','Выберите Frame кнопки.');
      const role=message.role;if(!role||!Object.prototype.hasOwnProperty.call(ROLE_ID,role))fail('states','Выберите роль состояния.');
      const children=node.children.map(n=>({node:n,metadata:readMetadata(n)}));
      if(children.length!==3||children.some(c=>c.metadata?.kind!=='state')||children.filter(c=>c.metadata?.role===role).length!==1)fail('states','Сначала назначьте три состояния кнопки.');
      for(const c of children)c.node.visible=c.metadata!.role===role;
      figma.ui.postMessage({type:'success',message:`Показано состояние ${role}. При экспорте сохраняются все три.`});
    }else if(message.type==='check') {const c=capture(screenOf(selected()));figma.ui.postMessage({type:'success',message:`Экран проверен: ${c.screen.elements.length} элемента, ${c.screen.assets.length} PNG. Декодирование PNG проверит CLI после экспорта.`});}
    else if(message.type==='export') {
      const bundle=await exportFrame(screenOf(selected()),message=>figma.ui.postMessage({type:'progress',message}));
      figma.ui.postMessage({type:'bundle',bundle});
    }else fail('message','Неизвестная команда.');
  }catch(e){figma.ui.postMessage({type:'error',message:e instanceof Error?e.message:String(e),code:(e as {code?:string}).code??'plugin'});}
  finally {busy=false;figma.ui.postMessage({type:'idle'});}
};
