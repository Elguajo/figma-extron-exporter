import { DATA_KEY, PROFILES, ROLE_ID, fail, integer, key, readMetadata, text, type Asset, type Bundle, type Element, type Font, type Metadata, type Profile, type Role, type Screen, type State } from './model.ts';
import { color, exportPng, plain, readText, rect } from './read-node.ts';

interface Capture { profile: Profile; screen: Screen; images: { asset: Asset; node: SceneNode }[]; signature: string }
function meta(node: SceneNode, kind?: string): Metadata {
  const m=readMetadata(node);
  if (!m || kind && m.kind!==kind) fail('unmapped', `${node.name}: назначьте тип ${kind ?? 'элемента'} в плагине.`);
  return m;
}
function frame(node: SceneNode): asserts node is FrameNode {
  if (node.type!=='FRAME') fail('node-type', `${node.name}: нужен подготовленный Frame. Instances и component sets пока не поддержаны.`);
}
function snapshot(node: SceneNode): unknown {
  // Detect edits across async PNG exports; no package may silently combine two design revisions.
  const props: Record<string,unknown>={ metadata:node.getPluginData(DATA_KEY) };
  for(const field of ['id','type','name','visible','opacity','relativeTransform','width','height','fills','strokes','strokeWeight','effects','cornerRadius','blendMode','isMask','reactions','characters','fontName','fontSize','fontWeight','lineHeight','letterSpacing','textCase','textDecoration','textAlignHorizontal','textAlignVertical','vectorPaths','vectorNetwork','arcData','pointCount','innerRadius'])
    if(field in node) props[field]=(node as unknown as Record<string,unknown>)[field];
  if('children' in node) props.children=node.children.map(snapshot);
  return props;
}
export function capture(root: SceneNode): Capture {
  frame(root); plain(root);
  const pm=meta(root,'page');
  if(!pm.profile || !(pm.profile in PROFILES)) fail('profile','Выберите один из двух профилей панели.');
  const profile=pm.profile, canvas=PROFILES[profile];
  if(root.width!==canvas.width || root.height!==canvas.height) fail('profile',`Холст должен быть ${canvas.width}×${canvas.height}; масштабирование не выполняется.`);
  const keys=new Set<string>(), ids=new Set<number>(), controls=new Set<number>();
  const addKey=(value:unknown,where:string)=>{const k=key(value,where); if(keys.has(k)) fail('duplicate-key',`${where}: повтор ключа ${k}.`); keys.add(k);return k;};
  const images: Capture['images']=[];
  const assets=new Map<string,Asset>();
  const paths=new Set<string>(), resourceNames=new Set<string>();
  const screen: Screen={schema:'exui-screen/1',project:{name:text(pm.projectName,'Имя проекта')},page:{key:addKey(pm.key,root.name),objectId:integer(pm.objectId,1,65534,'ID страницы'),name:text(root.name,'Имя страницы'),background:color(root)},assets:[],elements:[]};
  if(root.children.length<1 || root.children.length>64) fail('elements','На странице должно быть 1..64 элемента.');
  for(const node of root.children) {
    plain(node); const m=meta(node);
    if(!['button','label','level'].includes(m.kind)) fail('kind',`${node.name}: на странице допустимы button, label, level.`);
    const objectId=integer(m.objectId,1,1000000,node.name+'.objectId');
    if(ids.has(objectId)) fail('duplicate-id',`${node.name}: objectId ${objectId} уже используется.`); ids.add(objectId);
    const controlId=m.kind==='label'?null:integer(m.controlId,1,65535,node.name+'.controlId');
    if(m.kind==='label' && m.controlId!==null) fail('id',`${node.name}: у label controlId должен быть null.`);
    if(controlId!==null) {if(controls.has(controlId)) fail('duplicate-id',`${node.name}: controlId ${controlId} уже используется.`);controls.add(controlId);}
    const bounds=rect(node,root), [x,y,w,h]=bounds;
    if(x<0||y<0||w<1||h<1||x+w>canvas.width||y+h>canvas.height) fail('bounds',`${node.name}: элемент выходит за холст.`);
    const e: Element={key:addKey(m.key,node.name),kind:m.kind as Element['kind'],objectId,controlId,name:text(node.name,'Имя элемента'),rect:bounds};
    if(m.kind==='label') {
      if(node.type!=='TEXT') fail('node-type',`${node.name}: label должен быть Text.`);
      if(node.textAlignHorizontal!=='LEFT'||node.textAlignVertical!=='CENTER') fail('alignment',`${node.name}: для текущего профиля Label используйте LEFT / CENTER.`);
      Object.assign(e,readText(node));
    } else if(m.kind==='level') {
      frame(node);if(node.children.length) fail('appearance',`${node.name}: Level preview должен быть пустым Frame с цветом fill.`);
      Object.assign(e,{display:'slider',orientation:'left-to-right',min:0,max:100,fillColor:color(node)});
    } else {
      frame(node);
      if(!Array.isArray(node.fills)||node.fills.some(f=>f.visible!==false)) fail('appearance',`${node.name}: фон кнопки задаётся на состояниях; у внешнего Frame fills должны быть пусты.`);
      if(node.children.length!==3) fail('states',`${node.name}: нужны три Frame состояния.`);
      if(node.children.filter(n=>n.visible).length!==1) fail('states',`${node.name}: для предпросмотра должно быть видно ровно одно состояние.`);
      const states: State[]=[];let commonFont:Font|undefined;
      for(const stateNode of node.children) {
        frame(stateNode);plain(stateNode,true);const sm=meta(stateNode,'state');
        if(!sm.role||!(sm.role in ROLE_ID)||sm.stateId!==ROLE_ID[sm.role]) fail('states',`${stateNode.name}: нужны явные 0/normal, 1/feedback, 2/pressed.`);
        if(JSON.stringify(rect(stateNode,node))!==JSON.stringify([0,0,w,h])) fail('states',`${stateNode.name}: состояние должно занимать весь Frame кнопки.`);
        const labels=stateNode.children.filter(n=>n.type==='TEXT');
        if(labels.length!==1) fail('states',`${stateNode.name}: нужна ровно одна текстовая подпись.`);
        const label=labels[0] as TextNode, copy=readText(label);
        if(JSON.stringify(rect(label,stateNode))!==JSON.stringify([0,0,w,h]) || label.textAlignHorizontal!=='CENTER' || !['CENTER','BOTTOM'].includes(label.textAlignVertical))
          fail('alignment',`${label.name}: подпись должна занимать всю кнопку, CENTER по горизонтали и CENTER/BOTTOM по вертикали.`);
        if(commonFont&&JSON.stringify(commonFont)!==JSON.stringify(copy.font)) fail('font',`${node.name}: шрифт должен совпадать во всех состояниях.`);
        commonFont=copy.font;
        const state: State={stateId:sm.stateId,name:text(sm.stateName,'Имя состояния'),role:sm.role,text:copy.text,fill:color(stateNode),textColor:copy.textColor};
        if(label.textAlignVertical==='BOTTOM') state.textAlign='bottom-center';
        const icons=stateNode.children.filter(n=>n!==label);
        if(icons.length>1) fail('states',`${stateNode.name}: допустима одна иконка.`);
        if(icons.length) {
          const icon=icons[0], im=meta(icon,'image');
          if(!icon.visible || ('opacity' in icon && icon.opacity!==1)) fail('image',`${icon.name}: иконка должна быть видимой и непрозрачной.`);
          const [ix,iy,iw,ih]=rect(icon,stateNode);
          if(iw<1||ih<1||iw>4096||ih>4096||iw>w||ih>h||ix!==(w-iw)/2||![0,(h-ih)/2].includes(iy)) fail('alignment',`${icon.name}: иконка должна быть по центру, сверху или посередине, в Native размере.`);
          state.imageAlign=iy===0?'top-center':'middle-center';
          const k=key(im.key,icon.name);
          if(!im.file||!/^assets\/[a-z0-9][a-z0-9-]{0,63}\.png$/.test(im.file)||/[\r\n]/.test(im.file)) fail('image',`${icon.name}: нужен путь assets/name.png.`);
          if(!im.resourceName||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.png$/.test(im.resourceName)||/[\r\n]/.test(im.resourceName)) fail('image',`${icon.name}: нужно ASCII resourceName.png.`);
          const asset={key:k,file:im.file,resourceName:im.resourceName};const previous=assets.get(k);
          if(previous&&JSON.stringify(previous)!==JSON.stringify(asset)) fail('image',`${k}: несовместимые объявления ресурса.`);
          if(!previous) {
            addKey(k,icon.name);
            if(paths.has(asset.file)||resourceNames.has(asset.resourceName.toLowerCase())) fail('image',`${k}: повтор пути или имени ресурса.`);
            paths.add(asset.file);resourceNames.add(asset.resourceName.toLowerCase());assets.set(k,asset);
          }
          images.push({asset,node:icon});state.image=k;
        }
        states.push(state);
      }
      states.sort((a,b)=>a.stateId-b.stateId);
      if(states.map(s=>s.role).join(',')!=='normal,feedback,pressed'||new Set(states.map(s=>s.name)).size!==3) fail('states',`${node.name}: роли и имена состояний должны быть уникальны.`);
      if(new Set(states.map(s=>JSON.stringify([s.text,s.fill,s.textColor,s.image??null]))).size!==3) fail('states',`${node.name}: состояния должны различаться текстом, цветом или изображением; одного выравнивания недостаточно.`);
      Object.assign(e,{font:commonFont,states,press:states[2].name});
    }
    screen.elements.push(e);
  }
  if(assets.size>16) fail('images','Допустимо до 16 PNG ресурсов.');
  screen.assets=[...assets.values()].sort((a,b)=>a.key.localeCompare(b.key,'en'));
  return {profile,screen,images,signature:JSON.stringify(snapshot(root))};
}

export async function exportFrame(root:SceneNode, progress:(message:string)=>void=()=>{}):Promise<Bundle> {
  const captured=capture(root);const byPath=new Map<string,Uint8Array>();
  for(const {asset,node} of captured.images) {
    progress('PNG: '+asset.key);
    const bytes=await exportPng(node);
    if(bytes.length>4*1024*1024) fail('image-size',`${asset.key}: PNG больше 4 MiB.`);
    if(bytes.length<33) fail('image-size',`${asset.key}: PNG повреждён.`);
    const size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(size.getUint32(16)!==Math.round(node.width)||size.getUint32(20)!==Math.round(node.height)) fail('image-size',`${asset.key}: PNG должен совпадать с Native размером Frame. Уберите эффекты за его границами.`);
    const previous=byPath.get(asset.file);
    if(previous&&(previous.length!==bytes.length||previous.some((v,i)=>v!==bytes[i]))) fail('image-conflict',`${asset.key}: один ключ использован для разных изображений.`);
    byPath.set(asset.file,bytes);
  }
  if(root.removed||capture(root).signature!==captured.signature) fail('design-changed','Дизайн изменился во время экспорта. Повторите экспорт после завершения правок.');
  return {profile:captured.profile,screen:captured.screen,resources:[...byPath].sort(([a],[b])=>a.localeCompare(b,'en')).map(([path,bytes])=>({path,bytes}))};
}
