import { fail,integer,type Metadata,type NativeStyle } from './model.ts';

export const TRANSPARENT='#00000000';

function solid(paints:readonly Paint[]|PluginAPI['mixed'],where:string):string {
  if(!Array.isArray(paints))fail('appearance',`${where}: нужен один SOLID цвет.`);
  const visible=paints.filter(p=>p.visible!==false);
  if(!visible.length)return TRANSPARENT;
  if(visible.length!==1||visible[0].type!=='SOLID')fail('appearance',`${where}: нужен один SOLID цвет.`);
  const paint=visible[0] as SolidPaint,alpha=paint.opacity??1;
  const components=[alpha,paint.color.r,paint.color.g,paint.color.b];
  if(components.some(v=>!Number.isFinite(v)||v<0||v>1))fail('appearance',`${where}: некорректный цвет.`);
  const hex=components.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase();
  return alpha===1?'#'+hex.slice(2):'#'+hex;
}

// Frame opacity and radii are authoring guides. Only explicitly selected paints
// enter EXUI; the source Frame and its children are never modified.
export function popupAppearance(node:FrameNode|InstanceNode,m:Metadata):{background:string;stroke?:NativeStyle} {
  const background=m.exportBackground===true?solid(node.fills,node.name+' · фон'):TRANSPARENT;
  if(m.exportStroke!==true)return {background};
  const strokeColor=solid(node.strokes,node.name+' · обводка');
  if(strokeColor===TRANSPARENT||!node.strokes.some(p=>p.visible!==false))return {background};
  if(node.strokeAlign!=='INSIDE')fail('appearance',`${node.name}: для экспорта обводки выберите Stroke → Inside.`);
  if(node.dashPattern.length||['strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight'].some(k=>k in node&&(node as unknown as Record<string,unknown>)[k]!==node.strokeWeight))
    fail('appearance',`${node.name}: для экспорта нужна сплошная обводка одинаковой толщины со всех сторон.`);
  if(typeof node.strokeWeight!=='number')fail('appearance',`${node.name}: нужна одинаковая толщина обводки со всех сторон.`);
  const thickness=integer(Math.round(node.strokeWeight),1,Math.floor(Math.min(Math.round(node.width),Math.round(node.height))/2),'Толщина обводки');
  return {background,stroke:{shape:'rectangle',radius:0,strokeColor,thickness}};
}
