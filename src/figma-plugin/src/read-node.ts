// Adapted from Baolv/figma-export, commit 6312d15, src/lib/traverse.ts and assets.ts.
// See ../THIRD_PARTY_NOTICES.md. The Extron restrictions and metadata handling are ours.
import { fail, text, type Font } from './model.ts';

export function rect(node: SceneNode, parent: SceneNode): number[] {
  const a = node.absoluteBoundingBox, b = parent.absoluteBoundingBox;
  if (!a || !b) fail('geometry', `${node.name}: нет геометрии.`);
  const values = [a.x-b.x, a.y-b.y, a.width, a.height];
  if (values.some(v => !Number.isFinite(v) || Math.abs(v-Math.round(v)) > 0.001))
    fail('geometry', `${node.name}: координаты и размеры должны быть целыми пикселями.`);
  return values.map(Math.round);
}
export function plain(node: SceneNode, allowHidden = false): void {
  if ((!allowHidden && !node.visible) || ('opacity' in node && node.opacity !== 1) || ('isMask' in node && node.isMask) ||
      ('blendMode' in node && node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL'))
    fail('appearance', `${node.name}: скрытые элементы, opacity, маски и blend modes не поддержаны.`);
  const transforms = [node.relativeTransform,node.absoluteTransform];
  if (transforms.some(t=>Math.abs(t[0][0]-1)>0.00001 || Math.abs(t[1][1]-1)>0.00001 || Math.abs(t[0][1])>0.00001 || Math.abs(t[1][0])>0.00001))
    fail('transform', `${node.name}: поворот, отражение и skew не поддержаны.`);
  if ('effects' in node && node.effects.some(e => e.visible !== false)) fail('appearance', `${node.name}: эффекты не входят в .exui/1.`);
  if ('strokes' in node && node.strokes.some(p => p.visible !== false)) fail('appearance', `${node.name}: обводки не входят в .exui/1.`);
  if ('cornerRadius' in node && node.cornerRadius !== 0) fail('appearance', `${node.name}: скругление не входит в .exui/1.`);
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
  if (typeof f !== 'object' || f.family !== 'Arial' || !['Regular','Bold'].includes(f.style) || typeof node.fontSize !== 'number')
    fail('font', `${node.name}: поддержан единый шрифт Arial Regular или Bold.`);
  if (node.textDecoration !== 'NONE' || node.textCase !== 'ORIGINAL' || node.letterSpacing === figma.mixed || node.letterSpacing.value !== 0)
    fail('font', `${node.name}: decoration, case и letter spacing не поддержаны.`);
  // Figma uses px; the existing Extron plan stores points. Fixed 96px/in : 72pt/in.
  const size = Number((node.fontSize*0.75).toFixed(4));
  if (size < 4 || size > 200) fail('font', `${node.name}: размер должен соответствовать 4..200 pt (${(4/0.75).toFixed(2)}..${(200/0.75).toFixed(2)} px).`);
  return { family: 'Arial', size, bold: f.style === 'Bold' };
}
export function readText(node: TextNode) {
  plain(node);
  return { text: text(node.characters,node.name), textColor: color(node), font: font(node) };
}
export async function exportPng(node: SceneNode): Promise<Uint8Array> {
  try {
    // Keep the upstream native PNG path; never silently skip a required resource.
    return await node.exportAsync({ format:'PNG', constraint:{ type:'SCALE', value:1 } });
  } catch (e) { return fail('image-export', `${node.name}: PNG не экспортирован: ${String(e)}`); }
}
