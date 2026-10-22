import { fail } from './model.ts';
import { plain } from './read-node.ts';
import { paintColor } from './paint-color.ts';

export function isStrokeLine(node:SceneNode):node is VectorNode|LineNode {
  return node.type==='VECTOR'||node.type==='LINE';
}

// PBLine currently represents an axis-aligned, constant-width segment with flat caps.
// Read the path rather than its zero-height/zero-width geometric bounding box.
export function readStrokeLine(node:VectorNode|LineNode) {
  plain(node,false,true,true,{ignoreOpacity:true});
  if(node.strokeAlign!=='CENTER')fail('line-appearance',`${node.name}: положение обводки должно быть Center.`);
  if(node.dashPattern.length)fail('line-appearance',`${node.name}: нужна сплошная обводка без пунктира.`);
  // UNIFORM is Figma's explicit constant-width profile, not a variable stroke.
  const width=node.variableWidthStrokeProperties;
  if(width&&width.widthProfile!=='UNIFORM')fail('line-appearance',`${node.name}: профиль переменной толщины ${width.widthProfile} не поддержан. Выберите Uniform.`);
  if(node.complexStrokeProperties&&node.complexStrokeProperties.type!=='BASIC')
    fail('line-appearance',`${node.name}: кисти и динамические обводки не поддержаны. Выберите обычную обводку.`);
  const strokes=node.strokes.filter(p=>p.visible!==false);
  if(strokes.length!==1||strokes[0].type!=='SOLID')
    fail('line-appearance',`${node.name}: нужен один SOLID Stroke.`);
  if(!Array.isArray(node.fills)||node.fills.some(p=>p.visible!==false))
    fail('line-appearance',`${node.name}: уберите Fill; цвет линии задаётся через Stroke.`);
  const strokeWeight=node.strokeWeight;
  if(typeof strokeWeight!=='number'||!Number.isFinite(strokeWeight)||Math.round(strokeWeight)<1||Math.round(strokeWeight)>1280)
    fail('line-geometry',`${node.name}: толщина линии (Stroke) после округления должна быть 1..1280 px.`);
  const thickness=Math.round(strokeWeight);
  let vertices:ReadonlyArray<VectorVertex>=[{x:0,y:0},{x:node.width,y:0}];
  if(node.type==='VECTOR') {
    const network=node.vectorNetwork,segment=network.segments[0];
    if(network.vertices.length!==2||network.segments.length!==1||network.regions?.length||
        !segment||!Number.isInteger(segment.start)||!Number.isInteger(segment.end)||
        segment.start===segment.end||!network.vertices[segment.start]||!network.vertices[segment.end])
      fail('line-path',`${node.name}: Pen-линия должна содержать две точки и один открытый отрезок, без ломаных и замкнутых контуров.`);
    if([segment.tangentStart,segment.tangentEnd].some(t=>t&&(t.x!==0||t.y!==0)))
      fail('line-path',`${node.name}: кривые Безье не поддержаны; уберите управляющие ручки Pen.`);
    vertices=network.vertices;
  }
  if(vertices.some(v=>(v.strokeCap??node.strokeCap)!=='NONE'||
      (v.cornerRadius??('cornerRadius' in node?node.cornerRadius:0))!==0))
    fail('line-appearance',`${node.name}: нужны плоские окончания NONE, без стрелок и скруглений.`);
  const t=node.relativeTransform;
  if(t.some(row=>row.some(v=>!Number.isFinite(v)))||
      Math.abs(t[0][0]**2+t[1][0]**2-1)>0.00001||
      Math.abs(t[0][1]**2+t[1][1]**2-1)>0.00001||
      Math.abs(t[0][0]*t[0][1]+t[1][0]*t[1][1])>0.00001)
    fail('transform',`${node.name}: масштабирование и skew линии не поддержаны.`);
  const points=vertices.map(v=>({x:t[0][0]*v.x+t[0][1]*v.y+t[0][2],y:t[1][0]*v.x+t[1][1]*v.y+t[1][2]}));
  const [a,b]=points,dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);
  if(!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))||Math.max(dx,dy)<0.001)
    fail('line-path',`${node.name}: нужен отрезок ненулевой длины.`);
  if(dx>0.001&&dy>0.001)
    fail('line-direction',`${node.name}: сейчас поддержаны горизонтальные и вертикальные линии; диагональ не поддержана.`);
  const horizontal=dy<=0.001,length=horizontal?dx:dy;
  if(length<=strokeWeight||Math.round(length)<=thickness)
    fail('line-geometry',`${node.name}: длина линии должна быть больше её толщины до и после округления.`);
  // Round the original painted bounds, as for other native controls. Keep the
  // source Stroke and path untouched; PBLine thickness must match its rect.
  const bounds=horizontal?[Math.min(a.x,b.x),(a.y+b.y)/2-strokeWeight/2,length,strokeWeight]:
    [(a.x+b.x)/2-strokeWeight/2,Math.min(a.y,b.y),strokeWeight,length];
  return {rect:bounds.map(Math.round),fillColor:paintColor(strokes[0] as SolidPaint,node.name,node.opacity),native:{thickness}};
}
