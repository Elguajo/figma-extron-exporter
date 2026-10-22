import { DATA_KEY, PROFILES, ROLE_ID, ELEMENT_KINDS, CONTROL_KINDS, fail, integer, key, readMetadata, text, validateButtonStates, type Asset, type Bundle, type Element, type Font, type Metadata, type Profile, type Role, type Screen, type SingleScreen, type State } from './model.ts';
import { color, exportPng, hasTransform, plain, readText, rect, textAlignment } from './read-node.ts';
import { nativeElement,range } from './extended.ts';
import { captureProject,type ProjectOptions } from './project.ts';
import { controlText,isControlFrame,KIT_KEY,KIT_POPUP_GROUP_KEY } from './kit-contract.ts';
import { isStrokeLine,readStrokeLine } from './stroke-line.ts';
import { ExportError, nodeError } from './model.ts';
import { artworkText, isButtonContainer, usesButtonArtwork, validateArtwork } from './button-artwork.ts';
import { popupAppearance,TRANSPARENT } from './popup-appearance.ts';

export interface ArtworkRender {omitTextId?:string;width:number;height:number;offsetX?:number;offsetY?:number}
export interface Capture { profile: Profile; screen: Screen; images: { asset: Asset; node: SceneNode; artwork?:ArtworkRender }[]; signature: string; signatureMembers?: readonly SceneNode[] }
type MetadataReader = (node: SceneNode|PageNode) => Metadata | null;
type VisibilityReader = (node: SceneNode) => boolean;
function meta(node: SceneNode, kind: string | undefined, read: MetadataReader): Metadata {
  const m=read(node);
  if (!m || kind && m.kind!==kind) fail('unmapped', `${node.name}: назначьте тип ${kind ?? 'элемента'} в плагине.`);
  return m;
}
function frame(node: SceneNode): asserts node is FrameNode|InstanceNode {
  if (!isControlFrame(node)) fail('node-type', `${node.name}: нужен подготовленный Frame или экземпляр компонента Extron Kit.`);
}
function graphicBounds(node:SceneNode,parent:SceneNode,clipToParent=false):{rect:number[];artwork?:ArtworkRender} {
  const a=node.absoluteBoundingBox,b=parent.absoluteBoundingBox;
  if(!a||!b)fail('geometry',`${node.name}: нет геометрии.`,node);
  const values=[a.x-b.x,a.y-b.y,a.width,a.height];
  if(values.some(v=>!Number.isFinite(v))||a.width<=0||a.height<=0)fail('geometry',`${node.name}: нужна конечная геометрия положительного размера.`,node);
  const integral=values.every(v=>Math.abs(v-Math.round(v))<=.001);
  // Preserve the existing integer tolerance and pixel envelope. Clip only raster
  // graphics: changing a native control's rect would resize its appearance/hit area.
  const [x,y,w,h]=integral?values.map(Math.round):values;
  let left=Math.floor(x),top=Math.floor(y),right=Math.ceil(x+w),bottom=Math.ceil(y+h);
  if(clipToParent&&'clipsContent'in parent&&parent.clipsContent){
    left=Math.max(0,left);top=Math.max(0,top);
    right=Math.min(Math.round(parent.width),right);bottom=Math.min(Math.round(parent.height),bottom);
  }
  const width=right-left,height=bottom-top;
  if(width<1||height<1)fail('bounds',`${node.name}: элемент полностью за пределами холста; переместите его внутрь или удалите из экспорта.`,node);
  if(integral&&left===x&&top===y&&width===w&&height===h)return {rect:[x,y,w,h]};
  // Negative offsets crop the cloned PNG in a temporary clipping viewport;
  // the original layer and all its descendants keep their authored geometry.
  return {rect:[left,top,width,height],artwork:{width,height,offsetX:x-left,offsetY:y-top}};
}
function nativeStaticText(node:SceneNode):(ReturnType<typeof readText>&{textAlign?:Element['textAlign']})|undefined {
  const copy=controlText(node);if(!copy)fail('node-type',`${node.name}: label должен быть Text либо Component/Instance с одним Text (или текстовым Frame кита).`);
  // Invalid content is still an error. Only native appearance limitations can
  // fall back to a static snapshot; dynamic Value / DateTime never call this.
  let appearance:ReturnType<typeof readText>;
  try {appearance=readText(copy);}catch(error){if(error instanceof ExportError&&['font','color'].includes(error.code))return;throw error;}
  let alignment:Element['textAlign'];try{alignment=textAlignment(copy);}catch(error){if(error instanceof ExportError&&error.code==='alignment')return;throw error;}
  if(copy!==node){
    try {if(JSON.stringify(rect(copy,node))!==JSON.stringify(rect(node,node)))return;}
    catch(error){if(error instanceof ExportError&&error.code==='geometry')return;throw error;}
  }
  return {...appearance,...(alignment!=='middle-left'?{textAlign:alignment}:{})};
}
// GUI Designer draws native text through GDI: unkerned hinted advances, its own
// label insets and a fixed 1.21em Inter line. A box as tight as Figma's clips the
// last glyphs or line, so grow it around the alignment anchor within `limit`.
// Arial keeps its verified Figma geometry.
const GDI_LINE=1.21;
export function nativeTextRect(label:TextNode,font:Font,align:Element['textAlign'],r:number[],limit:number[]):number[] {
  if(font.family==='Arial')return r;
  const px=font.size/0.75,[x,y,w,h]=r,lh=label.lineHeight as LineHeight|undefined;
  const explicit=label.characters.split(/\r\n|[\n\r]|\p{Zl}|\p{Zp}/u).length;
  const line=typeof lh!=='object'||lh.unit==='AUTO'?px*GDI_LINE:lh.unit==='PIXELS'?lh.value:px*lh.value/100;
  // Only an auto-height box reveals the lines Figma wrapped at its fixed width.
  // Such text keeps nearly the same width, so GDI breaks lines in the same places.
  const lines=label.textAutoResize==='HEIGHT'&&line>0?Math.max(explicit,Math.round(h/line)):explicit,wrapped=lines>explicit;
  const width=w+Math.ceil(wrapped?px*.25:Math.max(px*.75,w*.06)),height=Math.max(h,Math.ceil(px*(lines*GDI_LINE+.25)));
  const [vertical,horizontal]=(align??'middle-left').split('-');
  const grow=(start:number,size:number,next:number,anchor:'start'|'middle'|'end',min:number,max:number):[number,number]=>{
    if(anchor==='start')return [start,Math.max(size,Math.min(next,max-start))];
    if(anchor==='end'){const s=Math.min(start,Math.max(min,start+size-next));return [s,start+size-s];}
    const half=Math.max(0,Math.min(Math.floor((next-size)/2),start-min,max-start-size));return [start-half,size+2*half];
  };
  const [nx,nw]=grow(x,w,width,horizontal==='left'?'start':horizontal==='right'?'end':'middle',limit[0],limit[0]+limit[2]);
  const [ny,nh]=grow(y,h,height,vertical==='top'?'start':vertical==='bottom'?'end':'middle',limit[1],limit[1]+limit[3]);
  return [nx,ny,nw,nh];
}
function commonButtonCaption(button:SceneNode) {
  if(!isButtonContainer(button)||button.children.length<2||hasTransform(button)||button.children.some(hasTransform))return;
  const labels=new Map<string,string>();let common:ReturnType<typeof nativeStaticText>,bounds:number[]|undefined,signature:string|undefined;
  for(const state of button.children){
    if(!isButtonContainer(state))return;
    const directLabels=state.children.filter((n):n is TextNode=>n.type==='TEXT');
    const label=directLabels[0];if(directLabels.length!==1||!label.visible||state.children.some(n=>'isMask'in n&&n.isMask))return;
    const textBox=label.absoluteBoundingBox;if(!textBox)return;
    // An icon higher in the stack is safe when its painted bounds do not
    // intersect the caption. Preserve overlapping/masked compositions in PNG.
    for(const above of state.children.slice(state.children.indexOf(label)+1)){
      if(!above.visible)continue;
      const box=('absoluteRenderBounds'in above?above.absoluteRenderBounds:null)??above.absoluteBoundingBox;
      if(!box||box.x<textBox.x+textBox.width&&box.x+box.width>textBox.x&&box.y<textBox.y+textBox.height&&box.y+box.height>textBox.y)return;
    }
    try {
      const copy=nativeStaticText(label);if(!copy||copy.font.family==='Arial')return;
      const r=rect(label,state);
      const buttonRect=rect(button,button);
      if(r[0]<0||r[1]<0||r[2]<1||r[3]<1||r[0]+r[2]>buttonRect[2]||r[1]+r[3]>buttonRect[3])return;
      // Full-area captions belong to the native Button itself.
      if(JSON.stringify(r)===JSON.stringify(buttonRect)&&label.textAlignHorizontal==='CENTER'&&['CENTER','BOTTOM'].includes(label.textAlignVertical))return;
      const next=JSON.stringify([copy,r]);if(signature&&signature!==next)return;
      signature=next;common=copy;bounds=nativeTextRect(label,copy.font,copy.textAlign,r,buttonRect);labels.set(state.id,label.id);
    }catch(error){if(error instanceof ExportError)return;throw error;}
  }
  return common&&bounds?{copy:common,rect:bounds,labels}:undefined;
}
function snapshot(node: SceneNode|PageNode, members?: readonly SceneNode[]): unknown {
  // Detect edits across async PNG exports; no package may silently combine two design revisions.
  const props: Record<string,unknown>={ parentId:node.parent?.id, metadata:node.getPluginData(DATA_KEY),registry:node.getPluginData('exui-id-registry'),kit:node.getPluginData(KIT_KEY),kitPopupGroup:node.getPluginData(KIT_POPUP_GROUP_KEY),buttonBackground:node.getPluginData('exui-button-background'),generatedState:node.getPluginData('exui-generated-state') };
  for(const field of ['id','type','name','visible','opacity','clipsContent','relativeTransform','absoluteTransform','absoluteBoundingBox','width','height','fills','strokes','strokeWeight','strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight','strokeAlign','strokeCap','strokeJoin','dashPattern','variableWidthStrokeProperties','complexStrokeProperties','effects','cornerRadius','topLeftRadius','topRightRadius','bottomRightRadius','bottomLeftRadius','cornerSmoothing','blendMode','isMask','reactions','characters','fontName','fontSize','fontWeight','lineHeight','letterSpacing','textCase','textDecoration','textAlignHorizontal','textAlignVertical','vectorPaths','vectorNetwork','arcData','pointCount','innerRadius'])
    if(field in node) props[field]=(node as unknown as Record<string,unknown>)[field];
  if(node.type==='TEXT'&&[node.fontName,node.fontSize,node.fills,node.textCase,node.textDecoration,node.letterSpacing,node.lineHeight].includes(figma.mixed))
    props.textSegments=node.getStyledTextSegments(['fontName','fontSize','fills','textCase','textDecoration','letterSpacing','lineHeight']);
  if('children' in node) props.children=(members??node.children).map(child=>snapshot(child));
  return props;
}
export function scopedDesignSignature(root: SceneNode|PageNode, members?: readonly SceneNode[]): string { return JSON.stringify(snapshot(root,members)); }
export function designSignature(root: SceneNode|PageNode): string { return scopedDesignSignature(root); }
export function capture(root: SceneNode|PageNode, read: MetadataReader = readMetadata,options:ProjectOptions={},visible:VisibilityReader=node=>node.visible): Capture {
  if(read(root)?.kind==='project'){
    const members=options.members?[...options.members]:undefined;
    return {...captureProject(root,read,(node,metadata,inProject)=>captureSingle(node,metadata,inProject,visible),node=>scopedDesignSignature(node,members),options),...(members?{signatureMembers:members}:{})};
  }
  if(root.type==='PAGE')fail('screen-unprepared','Распознайте выбранные фреймы или экраны текущей страницы.');
  return captureSingle(root,read,false,visible);
}
export function captureSingle(root:SceneNode,read:MetadataReader=readMetadata,inProject=false,visible:VisibilityReader=node=>node.visible):Capture&{screen:SingleScreen} {
  try{return captureSingleContent(root,read,inProject,visible);}catch(error){nodeError(error,root);}
}
function captureSingleContent(root:SceneNode,read:MetadataReader,inProject:boolean,visible:VisibilityReader):Capture&{screen:SingleScreen} {
  frame(root);
  const pm=meta(root,undefined,read);if(pm.kind!=='page'&&!(inProject&&pm.kind==='popup'))fail('kind',`${root.name}: нужен экран или popup проекта.`);
  // Screen corners are canvas presentation in Figma. Native Extron pages
  // always use the full rectangular canvas; preserve the source Frame.
  plain(root,false,false,false,{ignoreCornerRadius:true,ignoreOpacity:pm.kind==='popup',ignoreStrokes:pm.kind==='popup'});
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
  const addImage=(node:SceneNode,m:Pick<Metadata,'file'|'resourceName'>,k:string,artwork?:ArtworkRender)=>{
    key(k,node.name);
    if(!m.file||!/^assets\/[a-z0-9][a-z0-9-]{0,63}\.png$/.test(m.file)||/[\r\n]/.test(m.file))fail('image',`${node.name}: нужен путь assets/name.png.`);
    if(!m.resourceName||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.png$/.test(m.resourceName)||/[\r\n]/.test(m.resourceName))fail('image',`${node.name}: нужно ASCII resourceName.png.`);
    const asset:Asset={key:k,file:m.file,resourceName:m.resourceName},previous=assets.get(k);
    if(previous&&JSON.stringify(previous)!==JSON.stringify(asset))fail('image',`${k}: несовместимые объявления ресурса.`);
    if(!previous){addKey(k,node.name);if(paths.has(asset.file)||resourceNames.has(asset.resourceName.toLowerCase()))fail('image',`${k}: повтор пути или имени ресурса.`);paths.add(asset.file);resourceNames.add(asset.resourceName.toLowerCase());assets.set(k,asset);}
    images.push({asset,node,...(artwork?{artwork}:{})});return k;
  };
  const appearance=pm.kind==='popup'?popupAppearance(root,pm):undefined;
  const screen: SingleScreen={schema:'exui-screen/5',project:{name:text(pm.projectName,'Имя проекта')},page:{key:addKey(pm.key,root.name),objectId:integer(pm.objectId,1,65534,'ID страницы'),name:text(root.name,'Имя страницы'),background:appearance?.background??color(root)},assets:[],elements:[]};
  if(root.children.length<1 || root.children.length>64) fail('elements','На странице должно быть 1..64 элемента.');
  // Derived caption IDs must remain independent of layer order and avoid the
  // full authored ID range, including explicitly assigned IDs near 1,000,000.
  const sourceIds=new Set(root.children.map(node=>{try{return read(node)?.objectId;}catch(error){nodeError(error,node);}}).filter((id):id is number=>typeof id==='number'&&Number.isInteger(id)&&id>=1&&id<=1000000));
  const captionIds=new Map<number,number>(),reservedCaptionIds=new Set(sourceIds);
  for(const sourceId of [...sourceIds].sort((a,b)=>a-b)){
    let candidate=1000001-sourceId;
    while(reservedCaptionIds.has(candidate))candidate=candidate===1?1000000:candidate-1;
    reservedCaptionIds.add(candidate);captionIds.set(sourceId,candidate);
  }
  function decoration(node:SceneNode,objectId:number,bounds:number[],fillColor:string,stroke?:Element['native']) {
    if(fillColor===TRANSPARENT&&!stroke)return;
    let derivedId:number;
    if(node===root){derivedId=1000000;while(reservedCaptionIds.has(derivedId))derivedId--;reservedCaptionIds.add(derivedId);}
    else derivedId=captionIds.get(objectId)!;
    ids.add(derivedId);
    screen.elements.push({key:addKey(`popup-appearance.${screen.page.objectId}.${objectId}`,node.name),kind:'shape',objectId:derivedId,controlId:null,name:text(node.name.slice(0,245)+' appearance','Имя оформления'),rect:bounds,fillColor,native:stroke??{shape:'rectangle',radius:0,strokeColor:TRANSPARENT,thickness:0}});
  }
  if(appearance?.stroke)decoration(root,screen.page.objectId,[0,0,Math.round(root.width),Math.round(root.height)],TRANSPARENT,appearance.stroke);
  for(const node of root.children) {
    try {
    const m=meta(node,undefined,read),strokeLine=m.kind==='line'&&isStrokeLine(node)?readStrokeLine(node):null;
    if(!strokeLine)plain(node,false,m.kind==='shape'||m.kind==='line',false,{rasterTransform:m.kind==='button',ignoreCornerRadius:m.kind==='popup-ref',ignoreOpacity:m.kind==='popup-ref'||m.kind==='line',ignoreStrokes:m.kind==='popup-ref'});
    if(!ELEMENT_KINDS.includes(m.kind)) fail('kind',`${node.name}: неизвестный тип элемента экрана.`);
    const objectId=integer(m.objectId,1,1000000,node.name+'.objectId');
    if(ids.has(objectId)) fail('duplicate-id',`${node.name}: objectId ${objectId} уже используется.`); ids.add(objectId);
    const passive=!CONTROL_KINDS.includes(m.kind);
    const controlId=passive?null:integer(m.controlId,1,65535,node.name+'.controlId');
    if(passive && m.controlId!==null) fail('id',`${node.name}: у ${m.kind} controlId должен быть null.`);
    if(controlId!==null) {if(controls.has(controlId)) fail('duplicate-id',`${node.name}: controlId ${controlId} уже используется.`);controls.add(controlId);}
    const graphic=m.kind==='graphic'||m.kind==='label'?graphicBounds(node,root,m.kind==='graphic'):undefined;
    const bounds=strokeLine?.rect??graphic?.rect??rect(node,root), [x,y,w,h]=bounds;
    if(x<0||y<0||w<1||h<1||x+w>Math.round(root.width)||y+h>Math.round(root.height)) fail('bounds',`${node.name}: элемент выходит за холст.`);
    const e: Element={key:addKey(m.key,node.name),kind:m.kind as Element['kind'],objectId,controlId,name:text(node.name,'Имя элемента'),rect:bounds};
    let caption:Element|undefined;
    if(m.navigate){if(!inProject)fail('navigation','Для переходов нужна секция проекта или Frame project_Name.');if(m.kind!=='button')fail('navigation','Переход допустим только у кнопки.');e.navigate=key(m.navigate,'Цель перехода');}
    if(m.behavior){if(passive)fail('behavior','Поведение требует управляющего ID.');if(Object.keys(m.behavior).some(k=>!['selectionGroup','enabled','visible'].includes(k))||['enabled','visible'].some(k=>k in m.behavior!&&typeof m.behavior![k as 'enabled'|'visible']!=='boolean'))fail('behavior','Неизвестные или некорректные поля поведения.');if(m.behavior.selectionGroup){if(m.kind!=='button')fail('behavior','Группа выбора применяется к кнопкам.');key(m.behavior.selectionGroup,'Группа выбора');}e.behavior=m.behavior;}
    if(strokeLine) {
      Object.assign(e,strokeLine);
    }else if(nativeElement(node,m,e)) {
      // Native controls carry editable appearance rather than a raster snapshot.
    }else if(m.kind==='popup-ref') {
      frame(node);if(!inProject||pm.kind==='popup')fail('placement','Popup reference допустим только на странице проекта.');
      if(node.children.length)fail('structure','Popup reference должен быть пустым Frame.');
      if(!!m.popup===!!m.group)fail('popup-ref','Укажите одну цель: popup или группу popup.');
      if(m.popup)e.popup=key(m.popup,'Цель popup');if(m.group)e.group=key(m.group,'Группа popup');
      const refAppearance=popupAppearance(node,m);
      decoration(node,objectId,bounds,refAppearance.background,refAppearance.stroke);
    }else if(m.kind==='graphic') {
      frame(node);e.image=addImage(node,m,key('image.'+e.key,'Ключ изображения'),graphic?.artwork);
    }else if(m.kind==='label') {
      const copy=nativeStaticText(node);
      if(copy&&!graphic?.artwork){Object.assign(e,copy);e.rect=nativeTextRect(controlText(node)!,copy.font,copy.textAlign,bounds,[0,0,Math.round(root.width),Math.round(root.height)]);}
      else {
        e.kind='graphic';
        const file=`text-${screen.page.objectId}-${objectId}.png`;
        e.image=addImage(node,{file:'assets/'+file,resourceName:'exui-'+file},`text-artwork.${screen.page.objectId}.${objectId}`,graphic?.artwork??{width:w,height:h});
      }
    } else if(m.kind==='level'&&m.display!=='multistate') {
      frame(node);if(node.children.length) fail('appearance',`${node.name}: Level preview должен быть пустым Frame с цветом fill.`);
      Object.assign(e,{display:m.display??'slider',...range(m,node),fillColor:color(node)});
    } else {
      if(m.kind==='button'){if(!isButtonContainer(node))fail('node-type',`${node.name}: нужен Frame или Group кнопки.`);}else frame(node);
      if('fills' in node&&(!Array.isArray(node.fills)||node.fills.some(f=>f.visible!==false))) fail('appearance',`${node.name}: фон кнопки задаётся на состояниях; у внешнего Frame fills должны быть пусты.`);
      if(node.children.length<2||node.children.length>8) fail('states',`${node.name}: нужны 2..8 состояний, начиная с Normal.`);
      if(node.children.filter(visible).length!==1) fail('states',`${node.name}: для предпросмотра должно быть видно ровно одно состояние.`);
      const states: State[]=[];let commonFont:Font|undefined;
      const shared=m.kind==='button'?commonButtonCaption(node):undefined;
      if(shared){
        const captionId=captionIds.get(objectId)!;ids.add(captionId);
        caption={key:addKey(`button-caption.${screen.page.objectId}.${objectId}`,node.name),kind:'label',objectId:captionId,controlId:null,name:text(node.name.slice(0,248)+' caption','Имя подписи'),rect:[x+shared.rect[0],y+shared.rect[1],shared.rect[2],shared.rect[3]],...shared.copy};
      }
      for(const stateNode of node.children) {
        try {
        if(m.kind==='button'&&isButtonContainer(stateNode)&&(shared||usesButtonArtwork(stateNode))) {
          validateArtwork(stateNode,node);
          const sm=meta(stateNode,'state',read);integer(sm.stateId,0,7,'ID состояния');
          if(!sm.role||!(sm.role in ROLE_ID))fail('states',`${stateNode.name}: нужны роли состояний.`);
          const copy=shared?{font:{family:'Arial' as const,size:12,bold:false},text:'',textColor:'#FFFFFF',bottom:false,omitTextId:shared.labels.get(stateNode.id)}:artworkText(stateNode);
          if(copy.omitTextId&&!shared){
            if(commonFont&&JSON.stringify(commonFont)!==JSON.stringify(copy.font))fail('font',`${node.name}: шрифт должен совпадать во всех состояниях.`);
            commonFont=copy.font;
          }
          const file=`button-${controlId}-${sm.stateId}.png`;
          const image=addImage(stateNode,{file:'assets/'+file,resourceName:'exui-'+file},key(`button-artwork.${controlId}.state${sm.stateId}`,'Ключ оформления'),{omitTextId:copy.omitTextId,width:w,height:h});
          // Transparent corners in the full-size PNG reveal the page color,
          // rather than an opaque square in the button's own fill color.
          const fill=screen.page.background;
          states.push({stateId:sm.stateId!,name:text(sm.stateName,'Имя состояния'),role:sm.role,text:copy.text,textColor:copy.textColor,fill,image,imageAlign:'middle-center',...(copy.bottom?{textAlign:'bottom-center' as const}:{})});
          continue;
        }
        frame(stateNode);plain(stateNode,true);const sm=meta(stateNode,'state',read);
        if(!sm.role||!(sm.role in ROLE_ID)||sm.schema==='exui-node/1'&&sm.stateId!==ROLE_ID[sm.role]) fail('states',`${stateNode.name}: нужны явные ID и роли состояний.`);
        integer(sm.stateId,0,7,'ID состояния');
        if(JSON.stringify(rect(stateNode,node))!==JSON.stringify([0,0,w,h])) fail('states',`${stateNode.name}: состояние должно занимать весь Frame кнопки.`);
        const labels=stateNode.children.filter(n=>n.type==='TEXT');
        if(labels.length!==1) fail('states',`${stateNode.name}: нужна ровно одна текстовая подпись.`);
        const label=labels[0] as TextNode, copy=readText(label,m.kind==='button');
        if(JSON.stringify(rect(label,stateNode))!==JSON.stringify([0,0,w,h]) || label.textAlignHorizontal!=='CENTER' || !['CENTER','BOTTOM'].includes(label.textAlignVertical))
          fail('alignment',`${label.name}: подпись должна занимать всю кнопку, CENTER по горизонтали и CENTER/BOTTOM по вертикали.`,label);
        if(commonFont&&JSON.stringify(commonFont)!==JSON.stringify(copy.font)) fail('font',`${node.name}: шрифт должен совпадать во всех состояниях.`);
        commonFont=copy.font;
        const state: State={stateId:sm.stateId!,name:text(sm.stateName,'Имя состояния'),role:sm.role,text:copy.text,fill:color(stateNode),textColor:copy.textColor};
        if(label.textAlignVertical==='BOTTOM') state.textAlign='bottom-center';
        const icons=stateNode.children.filter(n=>n!==label);
        if(icons.length>1) fail('states',`${stateNode.name}: допустима одна иконка.`);
        if(icons.length) {
          const icon=icons[0], im=meta(icon,'image',read);
          if(!icon.visible || ('opacity' in icon && icon.opacity!==1)) fail('image',`${icon.name}: иконка должна быть видимой и непрозрачной.`,icon);
          const [ix,iy,iw,ih]=rect(icon,stateNode);
          const centeredX=[Math.floor((w-iw)/2),Math.ceil((w-iw)/2)],centeredY=[Math.floor((h-ih)/2),Math.ceil((h-ih)/2)];
          if(iw<1||ih<1||iw>4096||ih>4096||iw>w||ih>h||!centeredX.includes(ix)||![0,...centeredY].includes(iy)) fail('alignment',`${icon.name}: иконка должна быть по центру, сверху или посередине, в Native размере.`,icon);
          state.imageAlign=iy===0?'top-center':'middle-center';
          state.image=addImage(icon,im,key(im.key,icon.name),icon.width!==iw||icon.height!==ih?{width:iw,height:ih}:undefined);
        }
        states.push(state);
        }catch(error){nodeError(error,stateNode);}
      }
      states.sort((a,b)=>a.stateId-b.stateId);
      if(m.kind==='button')validateButtonStates(m.buttonMode,states,node.name);
      const roles=states.map(s=>s.role).join(',');
      if(states[0].role!=='normal'||states.slice(1).some(s=>s.role==='normal')||states.filter(s=>s.role==='pressed').length>1||new Set(states.map(s=>s.name.toLowerCase())).size!==states.length||new Set(states.map(s=>s.stateId)).size!==states.length) fail('states',`${node.name}: Normal должен быть первым, Pressed не более одного; имена и ID уникальны.`);
      if(new Set(states.map(s=>JSON.stringify([s.text,s.fill,s.textColor,s.image??null]))).size!==states.length) fail('states',`${node.name}: состояния должны различаться текстом, цветом или изображением; одного выравнивания недостаточно.`);
      // Metadata keeps canonical role IDs (pressed=2). A two-state momentary
      // button has dense package/GDL state IDs 0/normal, 1/pressed.
      if(roles==='normal,pressed')states[1].stateId=1;
      if(!states.every((s,i)=>s.stateId===i))fail('states',`${node.name}: ID состояний должны идти подряд от 0. Сохраните назначения состояний явно.`);
      const pressed=states.find(s=>s.role==='pressed');
      Object.assign(e,{font:commonFont??{family:'Arial',size:12,bold:false},states,...(pressed?{press:pressed.name}:{})});
      if(m.kind==='level'){if(pressed)fail('states','Multistate Level не имеет Pressed.');Object.assign(e,{display:'multistate',...range(m,node),fillColor:states[0].fill});}
    }
    screen.elements.push(e);
    if(caption)screen.elements.push(caption);
    }catch(error){nodeError(error,node);}
  }
  screen.assets=[...assets.values()].sort((a,b)=>a.key.localeCompare(b.key,'en'));
  if(screen.elements.length>64)fail('elements','С учётом отдельных подписей и оформления popup на странице допустимо до 64 элементов.');
  return {profile,screen,images,signature:designSignature(root)};
}

export async function exportFrame(root:SceneNode|PageNode, progress:(message:string)=>void=()=>{},options:ProjectOptions={}):Promise<Bundle> {
  return exportCaptured(root,capture(root,readMetadata,options),progress);
}

// Reuse the post-commit capture during a command; never cache it across edits.
export async function exportCaptured(root:SceneNode|PageNode,captured:Capture,progress:(message:string)=>void=()=>{}):Promise<Bundle> {
  const unchanged=()=>{
    if(root.removed||captured.signatureMembers?.some(n=>n.removed)||scopedDesignSignature(root,captured.signatureMembers)!==captured.signature)fail('design-changed','Дизайн изменился во время экспорта. Повторите экспорт после завершения правок.');
  };
  unchanged();
  const byPath=new Map<string,Uint8Array>();let imageBytes=0;
  for(const {asset,node,artwork} of captured.images) {
    progress('PNG: '+asset.key);
    const bytes=await exportPng(node,artwork);
    if(bytes.length>4*1024*1024) fail('image-size',`${asset.key}: PNG больше 4 MiB.`);
    if(bytes.length<33) fail('image-size',`${asset.key}: PNG повреждён.`);
    const size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const width=artwork?.width??Math.round(node.width),height=artwork?.height??Math.round(node.height);
    if(size.getUint32(16)!==width||size.getUint32(20)!==height) fail('image-size',`${asset.key}: PNG ${size.getUint32(16)}×${size.getUint32(20)}, ожидался размер ${width}×${height}.`);
    const previous=byPath.get(asset.file);
    if(previous&&(previous.length!==bytes.length||previous.some((v,i)=>v!==bytes[i]))) fail('image-conflict',`${asset.key}: один ключ использован для разных изображений.`);
    if(!previous){imageBytes+=bytes.length;if(imageBytes>16*1024*1024)fail('package-size','Изображения превышают 16 MiB. Уменьшите PNG перед повторным экспортом.');}
    byPath.set(asset.file,bytes);
  }
  unchanged();
  return {profile:captured.profile,screen:captured.screen,resources:[...byPath].sort(([a],[b])=>a.localeCompare(b,'en')).map(([path,bytes])=>({path,bytes}))};
}
