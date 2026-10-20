import { DATA_KEY, PROFILES, ROLE_ID, CONTROL_KINDS, ELEMENT_KINDS, elementCount, fail, integer, key, readMetadata, text, type Metadata, type Profile, type Role } from './model.ts';
import { capture, exportFrame } from './export.ts';
import { createDemo, tag } from './demo.ts';
import { recognize, applyRecognition, type RecognitionPlan } from './recognize.ts';
// The build injects only our two local PNG resources; no remote source or server.
declare const __ICONS__: Record<string,number[]>;
declare const __html__:string;
figma.showUI(__html__,{width:420,height:720,themeColors:true});
let busy=false;
let recognition:RecognitionPlan|undefined, recognitionToken=0;
function selected():SceneNode {const selection=figma.currentPage.selection;if(selection.length!==1)fail('selection','Выберите один Frame экрана или один его элемент.');return selection[0];}
function screenOf(node:SceneNode):FrameNode {
  let current:BaseNode|null=node,found:FrameNode|undefined;
  while(current&&current.type!=='PAGE') {
    const metadata=readMetadata(current);
    if(metadata?.kind==='project'&&current.type==='FRAME')return current;
    if(metadata?.kind==='page'&&current.type==='FRAME')found=current;
    current=current.parent;
  }
  if(found)return found;
  return fail('screen-unprepared','У выбранного макета ещё нет назначения «Экран». Выберите внешний Frame и профиль, затем нажмите «Распознать по именам» и сохраните назначения. Для ручной подготовки используйте «Подготовить выбранный экран» и «Назначение выбранного элемента».');
}
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
  tag(node,{kind:'page',key:'page.home',objectId:100,profile,projectName:text(node.name,'Имя проекта')});
}
function publish():void {
  try {const n=selected();let metadata:Metadata|null=null;let warning='';try{metadata=readMetadata(n);}catch(e){warning=String((e as Error).message);}
    let states:{stateId?:number;name?:string;role?:Role}[]=[];
    try{if(n.type==='FRAME'&&['button','level'].includes(metadata?.kind??''))states=n.children.map(c=>readMetadata(c)).filter(m=>m?.kind==='state').map(m=>({stateId:m!.stateId,name:m!.stateName,role:m!.role}));}
    catch(e){warning=warning||(e instanceof Error?e.message:String(e));}
    figma.ui.postMessage({type:'selection',id:n.id,name:n.name,nodeType:n.type,metadata,warning,states});
  }catch {figma.ui.postMessage({type:'selection',id:null,name:'Выберите один элемент или Frame экрана'});}
}
function apply(data:Record<string,unknown>):void {
  const node=selected(),kind=data.kind as Metadata['kind'];
  if(!['project','page','popup','popup-group','state','image',...ELEMENT_KINDS].includes(kind))fail('kind','Выберите назначение.');
  const value:Omit<Metadata,'schema'|'ownerNodeId'>={kind};
  if(!['state','image'].includes(kind))value.key=key(data.key,'Ключ');
  if(!['project','state','image'].includes(kind))value.objectId=integer(Number(data.objectId),1,['page','popup'].includes(kind)?65534:kind==='popup-group'?65535:1000000,'objectId');
  if(ELEMENT_KINDS.includes(kind))value.controlId=CONTROL_KINDS.includes(kind)?integer(Number(data.controlId),1,65535,'controlId'):null;
  if(['project','page','popup'].includes(kind)){
    if(!Object.prototype.hasOwnProperty.call(PROFILES,String(data.profile)))fail('profile','Выберите профиль панели.');
    value.profile=data.profile as Profile;value.projectName=text(data.projectName,'Имя проекта');
    if(kind!=='project'&&data.shownBy){if(!['start','navigation','program'].includes(String(data.shownBy)))fail('page','Выберите способ показа.');value.shownBy=data.shownBy as Metadata['shownBy'];}
    if(kind==='popup')value.modal=data.modal==='true';
  }
  if(kind==='state'){
    if(!Object.prototype.hasOwnProperty.call(ROLE_ID,String(data.role)))fail('states','Выберите роль состояния.');
    value.role=data.role as Role;value.stateId=data.stateId!==''&&data.stateId!==undefined?integer(Number(data.stateId),0,7,'stateId'):ROLE_ID[value.role];value.stateName=text(data.stateName,'Имя состояния');
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
  if(kind==='datetime')value.pattern=text(data.pattern,'Формат даты/времени');
  if(kind==='popup-ref'){if(!!data.popup===!!data.group)fail('popup-ref','Укажите popup или группу.');if(data.popup)value.popup=key(data.popup,'Ключ popup');if(data.group)value.group=key(data.group,'Ключ группы');}
  if(kind==='button'&&data.navigate)value.navigate=key(data.navigate,'Цель перехода');
  if(CONTROL_KINDS.includes(kind)){
    const behavior:NonNullable<Metadata['behavior']>={};if(data.selectionGroup){if(kind!=='button')fail('behavior','Группа выбора применяется к кнопкам.');behavior.selectionGroup=key(data.selectionGroup,'Группа выбора');}
    for(const field of ['enabled','visible'] as const)if(data[field]!==''&&data[field]!==undefined){if(!['true','false'].includes(String(data[field])))fail('behavior','Выберите значение поведения.');behavior[field]=data[field]==='true';}
    if(Object.keys(behavior).length)value.behavior=behavior;
  }
  const textKind=['label','value','datetime'].includes(kind),primitive=['shape','line'].includes(kind);
  if(textKind?node.type!=='TEXT':primitive?!['FRAME','RECTANGLE','ELLIPSE'].includes(node.type):node.type!=='FRAME')fail('node-type',textKind?'Для этого назначения нужен Text.':primitive?'Выберите Frame, Rectangle или Ellipse.':'Выберите Frame.');
  const parentKind=node.parent?readMetadata(node.parent)?.kind:undefined;
  const allowed=kind==='project'?[undefined]:kind==='page'?[undefined,'project']:kind==='popup'?['project','popup-group']:kind==='popup-group'?['project']:kind==='state'?['button','level']:kind==='image'?['state']:['page','popup'];
  if(!allowed.includes(parentKind))fail('placement',`${node.name}: недопустимый родитель для ${kind}.`);
  tag(node,value);
}
figma.on('selectionchange',()=>{recognition=undefined;publish();});
figma.ui.onmessage=async(message:{type:string;data?:Record<string,unknown>;profile?:Profile;role?:Role;stateId?:number;token?:number})=>{
  if(message.type==='ready'){publish();return;}
  if(busy){figma.ui.postMessage({type:'error',message:'Дождитесь завершения текущей операции.'});return;}
  busy=true;
  try {
    if(message.type==='recognize') {
      recognition=undefined;
      const plan=recognize(selected(),message.profile!);recognition=plan;
      figma.ui.postMessage({type:'recognition',token:++recognitionToken,rows:plan.rows,errors:plan.errors,warnings:plan.warnings});
    }else if(message.type==='apply-recognition') {
      const plan=recognition;recognition=undefined;
      if(!plan||message.token!==recognitionToken||selected().id!==plan.root.id||message.profile!==plan.profile)fail('recognition','Результат распознавания устарел. Распознайте выбранный экран ещё раз.');
      applyRecognition(plan);publish();figma.ui.postMessage({type:'success',message:'Назначения сохранены. Существующие ключи и ID сохранены. Можно проверить экран и скачать .exui.'});
    }else {
    recognition=undefined;
    if(message.type==='demo') {
      if(!message.profile||!Object.prototype.hasOwnProperty.call(PROFILES,message.profile))fail('profile','Выберите профиль.');
      await createDemo(message.profile,Object.fromEntries(Object.entries(__ICONS__).map(([k,v])=>[k,new Uint8Array(v)])));
      publish();figma.ui.postMessage({type:'success',message:'Демо создано. Можно редактировать и экспортировать выбранный экран.'});
    }else if(message.type==='prepare') {
      prepare(message.profile);publish();figma.ui.postMessage({type:'success',message:'Назначение «Экран» сохранено. Далее нажмите «Распознать по именам» либо назначьте элементы вручную, затем нажмите «Проверить экран». Слои макета не изменены.'});
    }else if(message.type==='apply') {apply(message.data??{});publish();figma.ui.postMessage({type:'success',message:'Назначение сохранено в Figma-узле.'});}
    else if(message.type==='preview') {
      const node=selected();if(node.type!=='FRAME'||!['button','level'].includes(readMetadata(node)?.kind??''))fail('selection','Выберите Frame кнопки.');
      const role=message.role;if(message.stateId===undefined&&(!role||!Object.prototype.hasOwnProperty.call(ROLE_ID,role)))fail('states','Выберите состояние.');
      if(message.stateId!==undefined)integer(message.stateId,0,7,'ID состояния');
      const children=node.children.map(n=>({node:n,metadata:readMetadata(n)}));
      const matches=(m:Metadata|null)=>message.stateId!==undefined?m?.stateId===message.stateId:m?.role===role;
      if(children.length<2||children.length>8||children.some(c=>c.metadata?.kind!=='state')||children.filter(c=>matches(c.metadata)).length!==1)fail('states','Выберите одно назначенное состояние; при нескольких feedback используйте его ID.');
      for(const c of children)c.node.visible=matches(c.metadata);
      figma.ui.postMessage({type:'success',message:`Показано состояние ${message.stateId??role}. При экспорте сохраняются все состояния.`});
    }else if(message.type==='check') {const c=capture(screenOf(selected()));figma.ui.postMessage({type:'success',message:`Макет проверен: ${elementCount(c.screen)} элемента, ${c.screen.assets.length} PNG. Декодирование PNG проверит CLI после экспорта.`});}
    else if(message.type==='export') {
      const bundle=await exportFrame(screenOf(selected()),message=>figma.ui.postMessage({type:'progress',message}));
      figma.ui.postMessage({type:'bundle',bundle});
    }else fail('message','Неизвестная команда.');
    }
  }catch(e){figma.ui.postMessage({type:'error',message:e instanceof Error?e.message:String(e),code:(e as {code?:string}).code??'plugin'});}
  finally {busy=false;figma.ui.postMessage({type:'idle'});}
};
