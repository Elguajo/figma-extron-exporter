import { DATA_KEY, PROFILES, ROLE_ID, ELEMENT_KINDS, CONTROL_KINDS, fail, integer, key, readMetadata, text, validateButtonStates, type Asset, type Bundle, type Element, type Font, type Metadata, type Profile, type Role, type Screen, type SingleScreen, type State } from './model.ts';
import { color, exportPng, plain, readText, rect } from './read-node.ts';
import { nativeElement,range } from './extended.ts';
import { captureProject } from './project.ts';
import { controlText,isControlFrame,KIT_KEY,KIT_POPUP_GROUP_KEY } from './kit-contract.ts';

export interface Capture { profile: Profile; screen: Screen; images: { asset: Asset; node: SceneNode }[]; signature: string }
type MetadataReader = (node: SceneNode) => Metadata | null;
function meta(node: SceneNode, kind: string | undefined, read: MetadataReader): Metadata {
  const m=read(node);
  if (!m || kind && m.kind!==kind) fail('unmapped', `${node.name}: назначьте тип ${kind ?? 'элемента'} в плагине.`);
  return m;
}
function frame(node: SceneNode): asserts node is FrameNode|InstanceNode {
  if (!isControlFrame(node)) fail('node-type', `${node.name}: нужен подготовленный Frame или экземпляр компонента Extron Kit.`);
}
function snapshot(node: SceneNode): unknown {
  // Detect edits across async PNG exports; no package may silently combine two design revisions.
  const props: Record<string,unknown>={ metadata:node.getPluginData(DATA_KEY),registry:node.getPluginData('exui-id-registry'),kit:node.getPluginData(KIT_KEY),kitPopupGroup:node.getPluginData(KIT_POPUP_GROUP_KEY) };
  for(const field of ['id','type','name','visible','opacity','clipsContent','relativeTransform','width','height','fills','strokes','strokeWeight','effects','cornerRadius','blendMode','isMask','reactions','characters','fontName','fontSize','fontWeight','lineHeight','letterSpacing','textCase','textDecoration','textAlignHorizontal','textAlignVertical','vectorPaths','vectorNetwork','arcData','pointCount','innerRadius'])
    if(field in node) props[field]=(node as unknown as Record<string,unknown>)[field];
  if('children' in node) props.children=node.children.map(snapshot);
  return props;
}
export function designSignature(root: SceneNode): string { return JSON.stringify(snapshot(root)); }
export function capture(root: SceneNode, read: MetadataReader = readMetadata): Capture {
  if(read(root)?.kind==='project')return captureProject(root,read,captureSingle,designSignature);
  return captureSingle(root,read);
}
export function captureSingle(root:SceneNode,read:MetadataReader=readMetadata,inProject=false):Capture&{screen:SingleScreen} {
  frame(root); plain(root);
  const pm=meta(root,undefined,read);if(pm.kind!=='page'&&!(inProject&&pm.kind==='popup'))fail('kind',`${root.name}: нужен экран или popup проекта.`);
  if(!pm.profile || !(pm.profile in PROFILES)) fail('profile','Выберите один из двух профилей панели.');
  const profile=pm.profile, canvas=PROFILES[profile];
  if(!inProject&&pm.shownBy&&pm.shownBy!=='start')fail('page','Для способа показа navigation/program нужна общая секция проекта или Frame project_Name.');
  if(pm.kind==='popup'&&!pm.modal){if(root.width<1||root.height<1||root.width>canvas.width||root.height>canvas.height)fail('profile','Popup должен помещаться в холст.');}
  else if(root.width!==canvas.width || root.height!==canvas.height) fail('profile',`Холст должен быть ${canvas.width}×${canvas.height}; масштабирование не выполняется.`);
  const keys=new Set<string>(), ids=new Set<number>(), controls=new Set<number>();
  const addKey=(value:unknown,where:string)=>{const k=key(value,where); if(keys.has(k)) fail('duplicate-key',`${where}: повтор ключа ${k}.`); keys.add(k);return k;};
  const images: Capture['images']=[];
  const assets=new Map<string,Asset>();
  const paths=new Set<string>(), resourceNames=new Set<string>();
  const addImage=(node:SceneNode,m:Metadata,k:string)=>{
    key(k,node.name);
    if(!m.file||!/^assets\/[a-z0-9][a-z0-9-]{0,63}\.png$/.test(m.file)||/[\r\n]/.test(m.file))fail('image',`${node.name}: нужен путь assets/name.png.`);
    if(!m.resourceName||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.png$/.test(m.resourceName)||/[\r\n]/.test(m.resourceName))fail('image',`${node.name}: нужно ASCII resourceName.png.`);
    const asset:Asset={key:k,file:m.file,resourceName:m.resourceName},previous=assets.get(k);
    if(previous&&JSON.stringify(previous)!==JSON.stringify(asset))fail('image',`${k}: несовместимые объявления ресурса.`);
    if(!previous){addKey(k,node.name);if(paths.has(asset.file)||resourceNames.has(asset.resourceName.toLowerCase()))fail('image',`${k}: повтор пути или имени ресурса.`);paths.add(asset.file);resourceNames.add(asset.resourceName.toLowerCase());assets.set(k,asset);}
    images.push({asset,node});return k;
  };
  const screen: SingleScreen={schema:'exui-screen/1',project:{name:text(pm.projectName,'Имя проекта')},page:{key:addKey(pm.key,root.name),objectId:integer(pm.objectId,1,65534,'ID страницы'),name:text(root.name,'Имя страницы'),background:color(root)},assets:[],elements:[]};
  if(root.children.length<1 || root.children.length>64) fail('elements','На странице должно быть 1..64 элемента.');
  for(const node of root.children) {
    const m=meta(node,undefined,read);plain(node,false,m.kind==='shape'||m.kind==='line');
    if(!ELEMENT_KINDS.includes(m.kind)) fail('kind',`${node.name}: неизвестный тип элемента экрана.`);
    const objectId=integer(m.objectId,1,1000000,node.name+'.objectId');
    if(ids.has(objectId)) fail('duplicate-id',`${node.name}: objectId ${objectId} уже используется.`); ids.add(objectId);
    const passive=!CONTROL_KINDS.includes(m.kind);
    const controlId=passive?null:integer(m.controlId,1,65535,node.name+'.controlId');
    if(passive && m.controlId!==null) fail('id',`${node.name}: у ${m.kind} controlId должен быть null.`);
    if(controlId!==null) {if(controls.has(controlId)) fail('duplicate-id',`${node.name}: controlId ${controlId} уже используется.`);controls.add(controlId);}
    const bounds=rect(node,root), [x,y,w,h]=bounds;
    if(x<0||y<0||w<1||h<1||x+w>root.width||y+h>root.height) fail('bounds',`${node.name}: элемент выходит за холст.`);
    const e: Element={key:addKey(m.key,node.name),kind:m.kind as Element['kind'],objectId,controlId,name:text(node.name,'Имя элемента'),rect:bounds};
    if(m.navigate){if(!inProject)fail('navigation','Для переходов нужна секция проекта или Frame project_Name.');if(m.kind!=='button')fail('navigation','Переход допустим только у кнопки.');e.navigate=key(m.navigate,'Цель перехода');}
    if(m.behavior){if(passive)fail('behavior','Поведение требует управляющего ID.');if(Object.keys(m.behavior).some(k=>!['selectionGroup','enabled','visible'].includes(k))||['enabled','visible'].some(k=>k in m.behavior!&&typeof m.behavior![k as 'enabled'|'visible']!=='boolean'))fail('behavior','Неизвестные или некорректные поля поведения.');if(m.behavior.selectionGroup){if(m.kind!=='button')fail('behavior','Группа выбора применяется к кнопкам.');key(m.behavior.selectionGroup,'Группа выбора');}e.behavior=m.behavior;}
    if(nativeElement(node,m,e)) {
      // Native controls carry editable appearance rather than a raster snapshot.
    }else if(m.kind==='popup-ref') {
      frame(node);if(!inProject||pm.kind==='popup')fail('placement','Popup reference допустим только на странице проекта.');
      if(node.children.length)fail('structure','Popup reference должен быть пустым Frame.');
      if(!!m.popup===!!m.group)fail('popup-ref','Укажите одну цель: popup или группу popup.');
      if(m.popup)e.popup=key(m.popup,'Цель popup');if(m.group)e.group=key(m.group,'Группа popup');
    }else if(m.kind==='graphic') {
      frame(node);e.image=addImage(node,m,key('image.'+e.key,'Ключ изображения'));
    }else if(m.kind==='label') {
      const copy=controlText(node);if(!copy) fail('node-type',`${node.name}: label должен быть Text или текстовым компонентом кита.`);
      if(copy.textAlignHorizontal!=='LEFT'||copy.textAlignVertical!=='CENTER') fail('alignment',`${node.name}: для текущего профиля Label используйте LEFT / CENTER.`);
      if(copy!==node&&JSON.stringify(rect(copy,node))!==JSON.stringify([0,0,w,h]))fail('alignment',`${node.name}: Content должен занимать весь текстовый контейнер.`);
      Object.assign(e,readText(copy));
    } else if(m.kind==='level'&&m.display!=='multistate') {
      frame(node);if(node.children.length) fail('appearance',`${node.name}: Level preview должен быть пустым Frame с цветом fill.`);
      Object.assign(e,{display:m.display??'slider',...range(m,node),fillColor:color(node)});
    } else {
      frame(node);
      if(!Array.isArray(node.fills)||node.fills.some(f=>f.visible!==false)) fail('appearance',`${node.name}: фон кнопки задаётся на состояниях; у внешнего Frame fills должны быть пусты.`);
      if(node.children.length<2||node.children.length>8) fail('states',`${node.name}: нужны 2..8 состояний, начиная с Normal.`);
      if(node.children.filter(n=>n.visible).length!==1) fail('states',`${node.name}: для предпросмотра должно быть видно ровно одно состояние.`);
      const states: State[]=[];let commonFont:Font|undefined;
      for(const stateNode of node.children) {
        frame(stateNode);plain(stateNode,true);const sm=meta(stateNode,'state',read);
        if(!sm.role||!(sm.role in ROLE_ID)||sm.schema==='exui-node/1'&&sm.stateId!==ROLE_ID[sm.role]) fail('states',`${stateNode.name}: нужны явные ID и роли состояний.`);
        integer(sm.stateId,0,7,'ID состояния');
        if(JSON.stringify(rect(stateNode,node))!==JSON.stringify([0,0,w,h])) fail('states',`${stateNode.name}: состояние должно занимать весь Frame кнопки.`);
        const labels=stateNode.children.filter(n=>n.type==='TEXT');
        if(labels.length!==1) fail('states',`${stateNode.name}: нужна ровно одна текстовая подпись.`);
        const label=labels[0] as TextNode, copy=readText(label,m.kind==='button');
        if(JSON.stringify(rect(label,stateNode))!==JSON.stringify([0,0,w,h]) || label.textAlignHorizontal!=='CENTER' || !['CENTER','BOTTOM'].includes(label.textAlignVertical))
          fail('alignment',`${label.name}: подпись должна занимать всю кнопку, CENTER по горизонтали и CENTER/BOTTOM по вертикали.`);
        if(commonFont&&JSON.stringify(commonFont)!==JSON.stringify(copy.font)) fail('font',`${node.name}: шрифт должен совпадать во всех состояниях.`);
        commonFont=copy.font;
        const state: State={stateId:sm.stateId!,name:text(sm.stateName,'Имя состояния'),role:sm.role,text:copy.text,fill:color(stateNode),textColor:copy.textColor};
        if(label.textAlignVertical==='BOTTOM') state.textAlign='bottom-center';
        const icons=stateNode.children.filter(n=>n!==label);
        if(icons.length>1) fail('states',`${stateNode.name}: допустима одна иконка.`);
        if(icons.length) {
          const icon=icons[0], im=meta(icon,'image',read);
          if(!icon.visible || ('opacity' in icon && icon.opacity!==1)) fail('image',`${icon.name}: иконка должна быть видимой и непрозрачной.`);
          const [ix,iy,iw,ih]=rect(icon,stateNode);
          if(iw<1||ih<1||iw>4096||ih>4096||iw>w||ih>h||ix!==(w-iw)/2||![0,(h-ih)/2].includes(iy)) fail('alignment',`${icon.name}: иконка должна быть по центру, сверху или посередине, в Native размере.`);
          state.imageAlign=iy===0?'top-center':'middle-center';
          state.image=addImage(icon,im,key(im.key,icon.name));
        }
        states.push(state);
      }
      states.sort((a,b)=>a.stateId-b.stateId);
      if(m.kind==='button')validateButtonStates(m.buttonMode,states,node.name);
      const roles=states.map(s=>s.role).join(',');
      if(states[0].role!=='normal'||states.slice(1).some(s=>s.role==='normal')||states.filter(s=>s.role==='pressed').length>1||new Set(states.map(s=>s.name.toLowerCase())).size!==states.length||new Set(states.map(s=>s.stateId)).size!==states.length) fail('states',`${node.name}: Normal должен быть первым, Pressed не более одного; имена и ID уникальны.`);
      if(new Set(states.map(s=>JSON.stringify([s.text,s.fill,s.textColor,s.image??null]))).size!==states.length) fail('states',`${node.name}: состояния должны различаться текстом, цветом или изображением; одного выравнивания недостаточно.`);
      // Metadata keeps canonical role IDs (pressed=2). A two-state momentary
      // button has dense package/GDL state IDs 0/normal, 1/pressed.
      if(roles==='normal,pressed'){states[1].stateId=1;screen.schema='exui-screen/4';}
      if(!states.every((s,i)=>s.stateId===i))fail('states',`${node.name}: ID состояний должны идти подряд от 0. Сохраните назначения состояний явно.`);
      const pressed=states.find(s=>s.role==='pressed');
      Object.assign(e,{font:commonFont,states,...(pressed?{press:pressed.name}:{})});
      if(m.kind==='level'){if(pressed)fail('states','Multistate Level не имеет Pressed.');Object.assign(e,{display:'multistate',...range(m,node),fillColor:states[0].fill});}
    }
    screen.elements.push(e);
  }
  if(screen.elements.some(e=>e.kind==='graphic'||e.states?.map(s=>s.role).join(',')==='normal,pressed'))screen.schema='exui-screen/4';
  else if(screen.elements.some(e=>e.states?.length===2))screen.schema='exui-screen/3';
  if(screen.elements.some(e=>e.native||e.kind==='value'||e.kind==='button'&&e.states?.some(s=>s.text==='')||e.states&&!['normal,pressed','normal,feedback','normal,feedback,pressed'].includes(e.states.map(s=>s.role).join(',')))||inProject||root.children.some(n=>['exui-node/2','exui-node/3'].includes(read(n)?.schema??''))||screen.elements.some(e=>e.states&&e.states.length>3))screen.schema='exui-screen/5';
  if(assets.size>16)screen.schema='exui-screen/5'; // Larger asset sets require the updated v5 reader.
  screen.assets=[...assets.values()].sort((a,b)=>a.key.localeCompare(b.key,'en'));
  return {profile,screen,images,signature:designSignature(root)};
}

export async function exportFrame(root:SceneNode, progress:(message:string)=>void=()=>{}):Promise<Bundle> {
  const captured=capture(root);const byPath=new Map<string,Uint8Array>();let imageBytes=0;
  for(const {asset,node} of captured.images) {
    progress('PNG: '+asset.key);
    const bytes=await exportPng(node);
    if(bytes.length>4*1024*1024) fail('image-size',`${asset.key}: PNG больше 4 MiB.`);
    if(bytes.length<33) fail('image-size',`${asset.key}: PNG повреждён.`);
    const size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(size.getUint32(16)!==Math.round(node.width)||size.getUint32(20)!==Math.round(node.height)) fail('image-size',`${asset.key}: PNG ${size.getUint32(16)}×${size.getUint32(20)}, ожидался Native размер Frame ${Math.round(node.width)}×${Math.round(node.height)}.`);
    const previous=byPath.get(asset.file);
    if(previous&&(previous.length!==bytes.length||previous.some((v,i)=>v!==bytes[i]))) fail('image-conflict',`${asset.key}: один ключ использован для разных изображений.`);
    if(!previous){imageBytes+=bytes.length;if(imageBytes>16*1024*1024)fail('package-size','Изображения превышают 16 MiB. Уменьшите PNG перед повторным экспортом.');}
    byPath.set(asset.file,bytes);
  }
  if(root.removed||capture(root).signature!==captured.signature) fail('design-changed','Дизайн изменился во время экспорта. Повторите экспорт после завершения правок.');
  return {profile:captured.profile,screen:captured.screen,resources:[...byPath].sort(([a],[b])=>a.localeCompare(b,'en')).map(([path,bytes])=>({path,bytes}))};
}
