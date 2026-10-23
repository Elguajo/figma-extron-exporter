import type { ButtonContainer } from './button-artwork.ts';

export interface ContrastReport { corrected: number; unchecked: number }
export interface ContrastOptions { enabled?: boolean; report?: ContrastReport }

// WCAG relative luminance (sRGB). Use 4.5 for all labels, including large text,
// and 3 for icon artwork. Only replace colors that fail their threshold.
export function contrastRatio(a: RGB, b: RGB): number {
  const luminance = (c: RGB) => [c.r,c.g,c.b].reduce((sum,v,i) =>
    sum + (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4) * [.2126,.7152,.0722][i], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x,y) + .05) / (Math.min(x,y) + .05);
}
function solid(paints: readonly Paint[] | PluginAPI['mixed']): SolidPaint | undefined {
  if (!Array.isArray(paints)) return;
  const visible = paints.filter(p => p.visible !== false);
  return visible.length === 1 && visible[0].type === 'SOLID' && (!visible[0].blendMode || visible[0].blendMode === 'NORMAL') ? visible[0] as SolidPaint : undefined;
}
const visiblePaint = (paints: readonly Paint[] | PluginAPI['mixed']) => !Array.isArray(paints) || paints.some(p => p.visible !== false);
const composite = (color: RGB, bg: RGB, alpha: number): RGB => ({r:color.r*alpha+bg.r*(1-alpha),g:color.g*alpha+bg.g*(1-alpha),b:color.b*alpha+bg.b*(1-alpha)});
const ordinary = (node: SceneNode) => (!('opacity' in node) || node.opacity === 1) &&
  (!('blendMode' in node) || ['NORMAL','PASS_THROUGH'].includes(node.blendMode)) &&
  (!('isMask' in node) || !node.isMask) && (!('effects' in node) || !node.effects.some(e => e.visible !== false));

// The caller shares its undo stack with background/state creation. Hidden state
// roots are checked too; hidden artwork within a state is left alone.
export function correctButtonContrast(state: ButtonContainer, surface: FrameNode | RectangleNode, undo: (() => void)[]): ContrastReport {
  const corrected = new Set<string>(), unchecked = new Set<string>();
  const bg = solid(surface.fills);
  let ancestor: BaseNode | null = surface;
  while (ancestor && ancestor.type !== 'PAGE') {
    if ('opacity' in ancestor && !ordinary(ancestor as SceneNode)) return {corrected:0,unchecked:1};
    ancestor = ancestor.parent;
  }
  if (!bg || (bg.opacity ?? 1) !== 1) return {corrected:0,unchecked:1};

  function paints(node: SceneNode & MinimalFillsMixin & MinimalStrokesMixin, field: 'fills' | 'strokes', backdrop: RGB, minimum: number) {
    const original = node[field];
    if (!visiblePaint(original)) return;
    const paint = solid(original);
    if (!paint) { unchecked.add(node.id); return; }
    const alpha = paint.opacity ?? 1;
    if (contrastRatio(composite(paint.color,backdrop,alpha),backdrop) >= minimum) return;
    const black = {r:0,g:0,b:0}, white = {r:1,g:1,b:1};
    const color = contrastRatio(composite(black,backdrop,alpha),backdrop) >= contrastRatio(composite(white,backdrop,alpha),backdrop) ? black : white;
    if (contrastRatio(composite(color,backdrop,alpha),backdrop) < minimum) { unchecked.add(node.id); return; }
    // Keep paint opacity and invisible paints; detach only the failing solid color.
    const replacement = (original as readonly Paint[]).map(p => p.visible === false ? p : {...paint,color,boundVariables:undefined});
    undo.push(() => { node[field] = original as readonly Paint[]; });
    node[field] = replacement;
    corrected.add(node.id);
  }
  function visit(node: SceneNode, backdrop: RGB) {
    if (node !== state && !node.visible) return;
    if (node === surface && node.type === 'RECTANGLE') return;
    if (!ordinary(node)) { unchecked.add(node.id); return; }
    // Containers with a local surface keep that surface, and their children are
    // checked against it. Boolean operations render their own paints as one icon.
    if ('children' in node && ['FRAME','GROUP','COMPONENT','COMPONENT_SET','INSTANCE'].includes(node.type)) {
      if (node !== state && 'fills' in node && visiblePaint(node.fills)) {
        const local = solid(node.fills);
        if (!local || (local.opacity ?? 1) !== 1) { unchecked.add(node.id); return; }
        backdrop = local.color;
      }
      if (node.children.some(child => 'isMask' in child && child.isMask && child.visible)) { unchecked.add(node.id); return; }
      for (const child of node.children) visit(child,backdrop);
      return;
    }
    if ('fills' in node && 'strokes' in node) {
      const minimum = node.type === 'TEXT' ? 4.5 : 3;
      paints(node,'fills',backdrop,minimum);
      paints(node,'strokes',backdrop,minimum);
    }
  }
  visit(state,bg.color);
  return {corrected:corrected.size,unchecked:unchecked.size};
}
