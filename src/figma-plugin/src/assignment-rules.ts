import { fail, type Kind } from './model.ts';
import { controlText, isControlFrame } from './kit-contract.ts';
import { isStrokeLine } from './stroke-line.ts';
import { isButtonContainer } from './button-artwork.ts';

// Manual assignments and name recognition accept the same Figma node types.
export function requireNodeForKind(node: SceneNode, kind: 'page' | 'popup' | 'popup-group'): asserts node is FrameNode;
export function requireNodeForKind(node: SceneNode, kind: 'state'): asserts node is FrameNode | GroupNode;
export function requireNodeForKind(node: SceneNode, kind: 'image'): asserts node is FrameNode | SlotNode;
export function requireNodeForKind(node: SceneNode, kind: Kind): void;
export function requireNodeForKind(node: SceneNode, kind: Kind): void {
  let valid: boolean, expected: string;
  switch (kind) {
    case 'project':
      valid = node.type === 'FRAME' || node.type === 'SECTION';
      expected = 'секция или Frame';
      break;
    case 'state':
      valid = node.type === 'FRAME' || node.type === 'GROUP';
      expected = 'Frame или Group';
      break;
    case 'button':
      valid = isButtonContainer(node);
      expected = 'Frame, Group или экземпляр компонента кита';
      break;
    case 'page': case 'popup': case 'popup-group':
      valid = node.type === 'FRAME';
      expected = 'обычный Frame';
      break;
    case 'label': case 'value': case 'datetime':
      valid = controlText(node) !== null;
      expected = 'Text или текстовый компонент кита';
      break;
    case 'shape': case 'line':
      valid = isControlFrame(node) || node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || kind === 'line' && isStrokeLine(node);
      expected = kind === 'line' ? 'Frame, Rectangle, Line или прямая Pen-линия (Vector)' : 'Frame, Rectangle или Ellipse';
      break;
    case 'image':
      valid = node.type === 'FRAME' || node.type === 'SLOT';
      expected = 'Frame или слот кита';
      break;
    default:
      valid = isControlFrame(node);
      expected = 'Frame или экземпляр компонента кита';
  }
  if (!valid) fail('node-type', `${node.name}: нужен ${expected}.`);
}
