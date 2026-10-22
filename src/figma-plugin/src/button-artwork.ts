import { fail, type Font } from './model.ts';
import { plain, readText, rect } from './read-node.ts';

export type ButtonContainer = FrameNode | GroupNode | InstanceNode;
export const BACKGROUND_KEY = 'exui-button-background';
export function isButtonContainer(node: SceneNode): node is ButtonContainer {
  return node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'INSTANCE';
}
export function descendants(node: SceneNode): SceneNode[] {
  return [node, ...('children' in node ? node.children.flatMap(descendants) : [])];
}
export function hasFill(node: SceneNode): boolean {
  return 'fills' in node && Array.isArray(node.fills) && node.fills.some(p => p.visible !== false);
}
export function background(node: SceneNode): FrameNode | RectangleNode {
  const fits = (n: SceneNode) => JSON.stringify(rect(n, node)) === JSON.stringify([0, 0, node.width, node.height]);
  const visible = (n: SceneNode) => {let current:BaseNode|null=n;while(current&&current!==node){if('visible' in current&&!current.visible)return false;current=current.parent;}return true;};
  const candidates = descendants(node).filter((n): n is FrameNode | RectangleNode =>
    (n.type === 'RECTANGLE' || n.type === 'FRAME') && visible(n) && fits(n));
  const marked = candidates.filter(n => n.getPluginData(BACKGROUND_KEY) === '1');
  if (marked.length === 1) return marked[0];
  if (marked.length > 1) fail('button-background', `${node.name}: отмечено несколько фонов. Оставьте отметку на одном слое.`, node);
  // A filled state Frame already declares its own background.
  if (node.type === 'FRAME' && hasFill(node)) return node;
  if (candidates.length === 1) return candidates[0];
  fail('button-background', `${node.name}: ${candidates.length ? 'несколько слоёв размером с кнопку' : 'не найден фон размером с кнопку'}. Выберите нужный прямоугольник и нажмите «Выбранный слой — фон».`, node);
}
export function usesButtonArtwork(node: ButtonContainer): boolean {
  return node.type === 'GROUP' || node.children.some(n => n.type === 'RECTANGLE') || node.getPluginData('exui-generated-state') === '1' ||
    ('strokes' in node && node.strokes.some(p => p.visible !== false)) || ('cornerRadius' in node && node.cornerRadius !== 0);
}
export interface ArtworkText { font: Font; text: string; textColor: string; omitTextId?: string; bottom: boolean }
// Native Button text has only full-area CENTER / BOTTOM alignment. Other text
// stays in the PNG so an arbitrary authored label is not moved during export.
export function artworkText(state: ButtonContainer): ArtworkText {
  const labels = descendants(state).filter((n): n is TextNode => n.type === 'TEXT' && n.visible);
  const label = labels[0];
  const fallback: ArtworkText = { font: { family: 'Arial', size: 12, bold: false }, text: '', textColor: '#FFFFFF', bottom: false };
  if (labels.length !== 1 || !label) return fallback;
  const full = JSON.stringify(rect(label, state)) === JSON.stringify([0, 0, state.width, state.height]);
  if (label.parent !== state || state.children[state.children.length-1] !== label || !full || label.textAlignHorizontal !== 'CENTER' || !['CENTER', 'BOTTOM'].includes(label.textAlignVertical)) return fallback;
  try {
    const copy = readText(label, true);
    return { ...copy, omitTextId: label.id, bottom: label.textAlignVertical === 'BOTTOM' };
  } catch { return fallback; }
}
export function validateArtwork(state: ButtonContainer, button: ButtonContainer): void {
  plain(state, true, true);
  if (JSON.stringify(rect(state, button)) !== JSON.stringify([0, 0, button.width, button.height]))
    fail('states', `${state.name}: состояние должно занимать всю кнопку.`, state);
  background(state);
}
