import { fail,integer,text,type Element,type Metadata,type Orientation } from './model.ts';
import { color,plain,rect,readText,textAlignment } from './read-node.ts';
import { controlText,isControlFrame } from './kit-contract.ts';

const orientations:Orientation[]=['left-to-right','right-to-left','bottom-to-top','top-to-bottom'];
export function range(m:Metadata,node:SceneNode) {
  const orientation=m.orientation??'left-to-right';if(!orientations.includes(orientation))fail('orientation',`${node.name}: неизвестная ориентация.`);
  const min=integer(m.min??0,0,2147483646,'Минимум'),max=integer(m.max??100,1,2147483647,'Максимум');
  if(min>=max)fail('range',`${node.name}: минимум должен быть меньше максимума.`);
  return {orientation,min,max};
}
function radius(node:SceneNode):number {
  if(node.type==='ELLIPSE')return Math.floor(Math.min(node.width,node.height)/2);
  return 'cornerRadius' in node?integer(node.cornerRadius,0,Math.floor(Math.min(node.width,node.height)/2),node.name+'.radius'):0;
}
function empty(node:SceneNode) {if('children' in node&&node.children.length)fail('structure',`${node.name}: внутри примитива не должно быть слоёв.`);}
export function nativeElement(node:SceneNode,m:Metadata,e:Element):boolean {
  if(m.kind==='value'||m.kind==='datetime') {
    const copy=controlText(node);if(!copy)fail('node-type',`${node.name}: нужен Text или текстовый компонент кита.`);
    if(copy!==node&&JSON.stringify(rect(copy,node))!==JSON.stringify([0,0,node.width,node.height]))fail('alignment',`${node.name}: Content должен занимать весь текстовый контейнер.`);
    Object.assign(e,readText(copy));
    const alignment=textAlignment(copy);if(alignment!=='middle-left')e.textAlign=alignment;
    if(m.kind==='datetime') {e.native={pattern:text(m.pattern??copy.characters,'Формат даты/времени')};delete e.text;}
    return true;
  }
  if(m.kind==='shape'||m.kind==='line') {
    if(!['FRAME','RECTANGLE','ELLIPSE','INSTANCE'].includes(node.type))fail('node-type',`${node.name}: нужен Frame, Rectangle, Ellipse или примитив кита.`);
    empty(node);plain(node,false,true);e.fillColor=color(node);
    const thickness=m.kind==='line'?Math.min(node.width,node.height):'strokeWeight' in node?node.strokeWeight:0;
    if(m.kind==='line'){
      if(radius(node)!==0||'strokes' in node&&node.strokes.some(s=>s.visible!==false)||node.type==='ELLIPSE')fail('appearance',`${node.name}: линия требует прямоугольник без скругления и обводки.`);
      e.native={thickness:integer(thickness,1,1280,'Толщина линии')};
    }
    else {
      const strokes='strokes' in node?node.strokes.filter(s=>s.visible!==false):[];
      if(strokes.length>1||strokes.some(s=>s.type!=='SOLID'||(s.opacity??1)!==1))fail('appearance',`${node.name}: одна сплошная обводка или без обводки.`);
      if(strokes.length&&'strokeAlign' in node&&node.strokeAlign!=='INSIDE')fail('appearance',`${node.name}: обводка фигуры должна быть INSIDE.`);
      const stroke=strokes[0] as SolidPaint|undefined;
      const strokeColor=stroke?'#'+[stroke.color.r,stroke.color.g,stroke.color.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase():'#000000';
      e.native={shape:node.type==='ELLIPSE'?'ellipse':'rectangle',radius:node.type==='ELLIPSE'?0:radius(node),strokeColor,thickness:strokes.length?integer(thickness,0,640,'Толщина обводки'):0};
    }
    return true;
  }
  if(m.kind!=='slider')return false;
  if(!isControlFrame(node))fail('node-type',`${node.name}: нужен Frame или компонент кита с Track, Fill, Thumb.`);
  if(!Array.isArray(node.fills)||node.fills.some(p=>p.visible!==false))fail('appearance',`${node.name}: фон Slider задают его части Track/Fill/Thumb.`);
  if(node.children.length!==3)fail('slider',`${node.name}: нужны ровно три части Track, Fill, Thumb.`);
  const parts=new Map(node.children.map(p=>[p.name.toLowerCase(),p]));
  if(parts.size!==3||!['track','fill','thumb'].every(k=>parts.has(k)))fail('slider',`${node.name}: имена частей Track, Fill, Thumb должны быть уникальны.`);
  const track=parts.get('track')!,fill=parts.get('fill')!,thumb=parts.get('thumb')!;
  if(![track,fill].every(n=>['FRAME','RECTANGLE'].includes(n.type))||!['FRAME','RECTANGLE','ELLIPSE'].includes(thumb.type))fail('slider','Track и Fill — Frame/Rectangle, Thumb — Frame/Rectangle/Ellipse.');
  for(const part of [track,fill,thumb]){empty(part);plain(part,false,true);if('strokes' in part&&part.strokes.some(s=>s.visible!==false))fail('slider',`${part.name}: обводки частей Slider не поддержаны.`);color(part);}
  Object.assign(e,range(m,node));
  const vertical=e.orientation==='bottom-to-top'||e.orientation==='top-to-bottom';
  const tr=rect(track,node),fr=rect(fill,node),th=rect(thumb,node),length=vertical?node.height:node.width;
  const trackWidth=vertical?tr[2]:tr[3];
  if(vertical?tr[1]!==0||tr[3]!==length||tr[0]!==Math.floor((node.width-trackWidth)/2):tr[0]!==0||tr[2]!==length||tr[1]!==Math.floor((node.height-trackWidth)/2))fail('slider',`${node.name}: Track должен занимать всю длину и быть по центру поперёк Slider.`);
  if(fr[0]<0||fr[1]<0||fr[2]<1||fr[3]<1||fr[0]+fr[2]>node.width||fr[1]+fr[3]>node.height|| (vertical?fr[0]!==tr[0]||fr[2]!==trackWidth:fr[1]!==tr[1]||fr[3]!==trackWidth))fail('slider',`${node.name}: Fill должен лежать на Track и совпадать с его толщиной.`);
  if(e.orientation==='left-to-right'&&fr[0]!==0||e.orientation==='right-to-left'&&fr[0]+fr[2]!==node.width||e.orientation==='top-to-bottom'&&fr[1]!==0||e.orientation==='bottom-to-top'&&fr[1]+fr[3]!==node.height)fail('slider','Fill должен начинаться с края, соответствующего направлению Slider.');
  if(th[0]<0||th[1]<0||th[0]+th[2]>node.width||th[1]+th[3]>node.height)fail('slider',`${node.name}: Thumb выходит за Slider.`);
  if(radius(fill)!==radius(track))fail('slider','Fill и Track должны иметь одинаковое скругление.');
  if(vertical?th[0]!==Math.floor((node.width-th[2])/2):th[1]!==Math.floor((node.height-th[3])/2))fail('slider','Thumb должен быть по центру поперёк Slider.');
  const thumbRadius=radius(thumb);const ellipse=thumb.type==='ELLIPSE'||thumb.width===thumb.height&&thumbRadius===Math.floor(Math.min(thumb.width,thumb.height)/2);
  if(!ellipse&&thumbRadius!==0)fail('slider',`${thumb.name}: поддержаны эллипс или прямоугольник без скругления.`);
  e.fillColor=color(fill);e.native={trackColor:color(track),trackWidth,thumbColor:color(thumb),thumbWidth:th[2],thumbHeight:th[3],thumbType:ellipse?'ellipse':'rectangle',radius:radius(track)};
  return true;
}
