import { ExportError, fail, type Font } from './model.ts';
import { font, hasTransform, plain, rect, type ArtworkMove } from './read-node.ts';

export type ButtonContainer = FrameNode | GroupNode | InstanceNode;
export const BACKGROUND_KEY = 'exui-button-background';
// This prefix keeps the complete state in PNG, including its captions, even
// when a native-text setting was saved before the button was renamed.
export function isImageButton(node: {readonly name: string}): boolean {
  return /^(imagebutton|ibtn)_/i.test(node.name);
}
export function isButtonContainer(node: SceneNode): node is ButtonContainer {
  return node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'INSTANCE';
}
export function descendants(node: SceneNode): SceneNode[] {
  return [node, ...('children' in node ? node.children.flatMap(descendants) : [])];
}
export function hasFill(node: SceneNode): boolean {
  return 'fills' in node && Array.isArray(node.fills) && node.fills.some(p => p.visible !== false);
}
// This is a candidate comparison, not native geometry validation. Artwork can
// contain fractional pixels; compare authored background bounds before rounding.
export function fillsArea(node: SceneNode, parent: SceneNode): boolean {
  const a=node.absoluteBoundingBox,b=parent.absoluteBoundingBox;
  if(!a||!b)return false;
  return [a.x-b.x,a.y-b.y,a.width-b.width,a.height-b.height].every(v=>Number.isFinite(v)&&Math.abs(v)<=.001);
}
export function background(node: SceneNode): FrameNode | RectangleNode {
  const visible = (n: SceneNode) => {let current:BaseNode|null=n;while(current&&current!==node){if('visible' in current&&!current.visible)return false;current=current.parent;}return true;};
  const candidates = descendants(node).filter((n): n is FrameNode | RectangleNode =>
    (n.type === 'RECTANGLE' || n.type === 'FRAME') && visible(n) && fillsArea(n,node) &&
    (n!==node||hasFill(n)||n.getPluginData(BACKGROUND_KEY)==='1'));
  const marked = candidates.filter(n => n.getPluginData(BACKGROUND_KEY) === '1');
  if (marked.length === 1) return marked[0];
  if (marked.length > 1) fail('button-background', `${node.name}: отмечено несколько фонов. Оставьте отметку на одном слое.`, node);
  // A filled state Frame already declares its own background.
  if (node.type === 'FRAME' && hasFill(node)) return node;
  if (candidates.length === 1) return candidates[0];
  // A transparent container is not a second background beside its child.
  // Without a child surface, the Frame itself remains a valid paint target.
  if (!candidates.length && node.type==='FRAME') return node;
  fail('button-background', `${node.name}: ${candidates.length ? 'несколько слоёв размером с кнопку' : 'не найден фон размером с кнопку'}. Выберите нужный прямоугольник и нажмите «Выбранный слой — фон».`, node);
}
export function usesButtonArtwork(node: ButtonContainer): boolean {
  return (node.parent !== null && isImageButton(node.parent)) || hasTransform(node) || node.type === 'GROUP' || node.children.filter(n=>n.type==='TEXT').length!==1 ||
    node.children.some(n=>n.type!=='TEXT'&&descendants(n).some(child=>child.type==='TEXT')) ||
    node.children.some(n => !['TEXT','FRAME','SLOT'].includes(n.type)) || node.getPluginData('exui-generated-state') === '1' ||
    node.children.some(n=>{if(n.type!=='TEXT')return false;try{font(n);return false;}catch(error){if(error instanceof ExportError&&error.code==='font')return true;throw error;}}) ||
    ('strokes' in node && node.strokes.some(p => p.visible !== false)) || ('cornerRadius' in node && node.cornerRadius !== 0);
}
export interface ArtworkText { font: Font; text: string; textColor: string; omitTextId?: string; bottom: boolean; moves?:ArtworkMove[] }
export function validateArtwork(state: ButtonContainer, button: ButtonContainer): void {
  plain(state, true, true, false, {rasterTransform:true});
  const actual = rect(state, button), expected = rect(button, button);
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    fail('states', `${state.name}: состояние должно занимать всю кнопку. После округления для экспорта: состояние X=${actual[0]}, Y=${actual[1]}, ${actual[2]}×${actual[3]}; кнопка «${button.name}» X=0, Y=0, ${expected[2]}×${expected[3]}.`, state);
  background(state);
}
