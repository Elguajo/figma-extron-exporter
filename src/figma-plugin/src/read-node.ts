// Adapted from Baolv/figma-export, commit 6312d15, src/lib/traverse.ts and assets.ts.
// See ../THIRD_PARTY_NOTICES.md. The Extron restrictions and metadata handling are ours.
import { fail, text, nodeError, type Font, type TextAlignment } from './model.ts';

export function rect(node: SceneNode, parent: SceneNode): number[] {
  const a = node.absoluteBoundingBox, b = parent.absoluteBoundingBox;
  if (!a || !b) fail('geometry', `${node.name}: нет геометрии.`,node);
  const values = [a.x-b.x, a.y-b.y, a.width, a.height];
  if (values.some(v => !Number.isFinite(v)) || a.width <= 0 || a.height <= 0)
    fail('geometry', `${node.name}: нужна конечная геометрия положительного размера.`,node);
  // Extron uses integer pixels. Round export geometry without changing Figma.
  return values.map(Math.round);
}
export function hasTransform(node: SceneNode): boolean {
  return [node.relativeTransform,node.absoluteTransform].some(t=>Math.abs(t[0][0]-1)>0.00001 || Math.abs(t[1][1]-1)>0.00001 || Math.abs(t[0][1])>0.00001 || Math.abs(t[1][0])>0.00001);
}
export function plain(node: SceneNode, allowHidden = false, decorated = false, allowLineTransform = false, options: {ignoreCornerRadius?: boolean; ignoreOpacity?:boolean; ignoreStrokes?:boolean; rasterTransform?: boolean} = {}): void {
  if ((!allowHidden && !node.visible) || (!options.ignoreOpacity && 'opacity' in node && node.opacity !== 1) || ('isMask' in node && node.isMask) ||
      ('blendMode' in node && node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL'))
    fail('appearance', `${node.name}: скрытые элементы, opacity, маски и blend modes не поддержаны.`);
  if (options.rasterTransform && [node.relativeTransform,node.absoluteTransform].some(t=>[t[0][0],t[0][1],t[1][0],t[1][1]].some(v=>!Number.isFinite(v)) || Math.abs(t[0][0]*t[1][1]-t[0][1]*t[1][0])<1e-10))
    fail('transform', `${node.name}: нужна конечная невырожденная трансформация.`,node);
  if (!allowLineTransform && !options.rasterTransform && hasTransform(node))
    fail('transform', `${node.name}: поворот, отражение и skew не поддержаны.`);
  if ('effects' in node && node.effects.some(e => e.visible !== false)) fail('appearance', `${node.name}: эффекты не поддержаны для этого нативного элемента.`);
  if (!decorated && !options.ignoreStrokes && 'strokes' in node && node.strokes.some(p => p.visible !== false)) fail('appearance', `${node.name}: обводки не поддержаны для этого нативного элемента.`);
  if (!decorated && !options.ignoreCornerRadius && 'cornerRadius' in node && node.cornerRadius !== 0) fail('appearance', `${node.name}: скругление не поддержано для этого нативного элемента.`);
  if ('reactions' in node && node.reactions.length) fail('interaction', `${node.name}: переходы Figma не экспортируются. Уберите prototype interactions.`);
}
export function color(node: SceneNode): string {
  if (!('fills' in node) || !Array.isArray(node.fills)) return fail('color', `${node.name}: нужен один сплошной цвет.`);
  const fills = node.fills.filter(f => f.visible !== false);
  if (fills.length !== 1 || fills[0].type !== 'SOLID' || (fills[0].opacity ?? 1) !== 1)
    fail('color', `${node.name}: нужен один непрозрачный SOLID fill.`);
  const { r, g, b } = (fills[0] as SolidPaint).color;
  return '#'+[r,g,b].map(v => Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase();
}
export function font(node: TextNode): Font {
  const f = node.fontName;
  if (typeof f !== 'object' || !['Arial','Inter','Inter Display'].includes(f.family) || typeof node.fontSize !== 'number')
    fail('font', `${node.name}: для редактируемого текста поддержаны Arial Regular/Bold, Inter и Inter Display.`);
  const weights=['Thin','Extra Light','Light','Regular','Medium','Semi Bold','Bold','Extra Bold','Black'];
  const styles=weights.concat(weights.map(w=>w==='Regular'?'Italic':w+' Italic'));
  const style=styles.find(s=>s.replace(/ /g,'').toLowerCase()===f.style.replace(/ /g,'').toLowerCase());
  if(f.family==='Arial'?!['Regular','Bold'].includes(f.style):!style)fail('font',`${node.name}: начертание ${f.style} не поддержано нативным шрифтом.`);
  if(f.variationSettings&&Object.keys(f.variationSettings).length){
    const weightName=style==='Italic'?'Regular':style?.replace(/ Italic$/,'');
    const expectedWeight=(weights.indexOf(weightName!)+1)*100,italic=style?.includes('Italic')??false;
    const defaults:Record<string,number>={wght:expectedWeight,opsz:f.family==='Inter Display'?32:14,ital:italic?1:0,slnt:italic?-10:0};
    if(f.family==='Arial'||Object.entries(f.variationSettings).some(([axis,value])=>!(axis in defaults)||!Number.isFinite(value)||Math.abs(value-defaults[axis])>.001))
      fail('font',`${node.name}: произвольные оси variable font сохраняются только в PNG. Для редактируемого Inter используйте стандартный вес и optical size 14 (Inter) / 32 (Inter Display).`);
  }
  if (node.textDecoration !== 'NONE' || node.textCase !== 'ORIGINAL' || node.letterSpacing === figma.mixed || node.letterSpacing.value !== 0)
    fail('font', `${node.name}: decoration, case и letter spacing не поддержаны.`);
  // Figma uses px; the existing Extron plan stores points. Fixed 96px/in : 72pt/in.
  const size = Number((node.fontSize*0.75).toFixed(4));
  if (size < 4 || size > 200) fail('font', `${node.name}: размер должен соответствовать 4..200 pt (${(4/0.75).toFixed(2)}..${(200/0.75).toFixed(2)} px).`);
  return f.family==='Arial'?{ family: 'Arial', size, bold: f.style === 'Bold' }:{family:f.family as 'Inter'|'Inter Display',size,bold:style==='Bold'||style==='Bold Italic',style};
}
export function textAlignment(node:TextNode):TextAlignment {
  const horizontal={LEFT:'left',CENTER:'center',RIGHT:'right'}[node.textAlignHorizontal as 'LEFT'|'CENTER'|'RIGHT'];
  const vertical={TOP:'top',CENTER:'middle',BOTTOM:'bottom'}[node.textAlignVertical];
  if(!horizontal||!vertical)fail('alignment',`${node.name}: нативный текст поддерживает Left / Center / Right и Top / Center / Bottom.`);
  return `${vertical}-${horizontal}` as TextAlignment;
}
export function readText(node: TextNode, allowEmpty = false) {
  try {
  plain(node);
  return { text: allowEmpty && node.characters === '' ? '' : text(node.characters,node.name), textColor: color(node), font: font(node) };
  }catch(error){nodeError(error,node);}
}
export async function exportPng(node: SceneNode, artwork?:{omitTextId?:string;width:number;height:number;offsetX?:number;offsetY?:number}): Promise<Uint8Array> {
  let temporary:SceneNode|undefined,cloned:SceneNode|undefined;
  try {
    // Export independently of hidden/clipping State ancestors. The original
    // preview, identity and geometry are never toggled or reparented.
    // Capture before reparenting: inherited rotation/reflection belongs in PNG.
    const transform=node.absoluteTransform,bounds=node.absoluteBoundingBox;
    cloned=node.clone();temporary=cloned;figma.currentPage.appendChild(cloned);cloned.visible=true;
    if(artwork){
      const wrapper=figma.createFrame();temporary=wrapper;wrapper.fills=[];wrapper.resize(artwork.width,artwork.height);wrapper.clipsContent=true;
      // A full-size background anchors Group bounds when native text is hidden.
      function omit(original:SceneNode,copy:SceneNode){if(original.id===artwork!.omitTextId)copy.visible=false;if('children' in original&&'children' in copy)original.children.forEach((child,i)=>omit(child,copy.children[i]));}
      if(!bounds)fail('geometry',`${node.name}: нет геометрии.`,node);
      wrapper.appendChild(cloned);
      cloned.relativeTransform=[
        [transform[0][0],transform[0][1],transform[0][2]-bounds.x+(artwork.offsetX??0)],
        [transform[1][0],transform[1][1],transform[1][2]-bounds.y+(artwork.offsetY??0)]
      ];
      omit(node,cloned);
    }
    const right=Math.max(0,...figma.currentPage.children.filter(n=>n!==temporary).map(n=>n.x+n.width));
    temporary.x=Math.ceil(right)+128;temporary.y=0;
    return await temporary.exportAsync({ format:'PNG', constraint:{ type:'SCALE', value:1 }, useAbsoluteBounds:true, contentsOnly:true });
  } catch (e) { return fail('image-export', `${node.name}: PNG не экспортирован: ${String(e)}`); }
  finally {if(temporary&&!temporary.removed)temporary.remove();if(cloned&&!cloned.removed)cloned.remove();}
}
