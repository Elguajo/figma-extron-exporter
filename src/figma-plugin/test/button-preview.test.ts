import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFigma } from './fake-figma.ts';
import { namedFixture } from './named-fixture.ts';
import { recognize, applyRecognition, REGISTRY_KEY } from '../src/recognize.ts';
import { capture, designSignature, exportFrame } from '../src/export.ts';
import { DATA_KEY, readMetadata } from '../src/model.ts';
import { authorButtons } from './button-preparation-fixture.ts';
import { prepareButtons } from '../src/button-preparation.ts';

for (const names of [['Active', 'Passive'], ['On', 'Off'], ['Normal', 'Pressed'], ['Normal', 'Active', 'Pressed']]) {
  test(`${names.join('/')}: recognition plans preview repair without editing, commit keeps all exported states`, async () => {
    fakeFigma();const root = await namedFixture('tlp-pro-1025m', names.length === 2), button = root.children[0] as FrameNode;
    button.name = names.length === 2 ? 'button_side.hall' : 'feedbackbutton_Hall';
    button.children.forEach((state, i) => {state.name = names[i];state.visible = true;});
    const normal = button.children.find(s => ['Passive', 'Off', 'Normal'].includes(s.name))!;
    const before = designSignature(root), plan = recognize(root, 'tlp-pro-1025m');
    assert.deepEqual(plan.errors, []);assert.equal(designSignature(root), before);
    applyRecognition(plan);
    assert.deepEqual(button.children.filter(s => s.visible).map(s => s.id), [normal.id]);
    const saved = designSignature(root), bundle = await exportFrame(root);
    assert.deepEqual(new Set(bundle.screen.elements[0].states!.map(s => s.name)), new Set(names));
    applyRecognition(recognize(root, 'tlp-pro-1025m'));assert.equal(designSignature(root), saved);
  });
}

for (const visible of [[], [1], [1, 2]]) test(`Preview selection ${JSON.stringify(visible)} preserves a single choice or restores a useful state`, async () => {
  fakeFigma();const root = await namedFixture(), button = root.children[0] as FrameNode;
  button.children.forEach((s, i) => s.visible = visible.includes(i));
  applyRecognition(recognize(root, 'tlp-pro-1025m'));
  assert.deepEqual(button.children.map(s => s.visible), [visible.length === 0, visible.length > 0, false]);
});

test('Saved state roles take priority over renamed layers when repairing preview', async () => {
  fakeFigma();const root = await namedFixture('tlp-pro-1025m', true);applyRecognition(recognize(root, 'tlp-pro-1025m'));
  const button = root.children[0] as FrameNode, normal = button.children[0];
  normal.name = 'Selected artwork';button.children[1].name = 'Normal';button.children.forEach(s => s.visible = true);
  const identity = button.getPluginData(DATA_KEY);applyRecognition(recognize(root, 'tlp-pro-1025m'));
  assert.deepEqual(button.children.filter(s => s.visible).map(s => s.id), [normal.id]);
  assert.equal(button.getPluginData(DATA_KEY), identity);assert.equal(readMetadata(normal)?.role, 'normal');
});

test('Group artwork preview is repaired without hiding artwork children', () => {
  const f = authorButtons();prepareButtons(f.root);
  const button = f.buttons[0];button.children.forEach(s => s.visible = true);
  const children = button.children.map(s => (s as GroupNode).children.map(n => [n.id, n.visible]));
  applyRecognition(recognize(f.root, 'tlp-pro-1025m'));
  assert.equal(button.children.filter(s => s.visible).length, 1);
  assert.deepEqual(button.children.map(s => (s as GroupNode).children.map(n => [n.id, n.visible])), children);
});

test('Other validation failures leave preview and assignments untouched', async () => {
  fakeFigma();const root = await namedFixture(), button = root.children[0] as FrameNode;
  button.children.forEach(s => s.visible = true);root.children[2].cornerRadius = 5;
  const before = designSignature(root), plan = recognize(root, 'tlp-pro-1025m');
  assert.ok(plan.errors.length);assert.throws(() => applyRecognition(plan));assert.equal(designSignature(root), before);
});

test('Visibility write failure restores all preview changes, metadata and registry', async () => {
  fakeFigma();const root = await namedFixture(), button = root.children[0] as FrameNode;
  button.children.forEach(s => s.visible = true);
  const before = designSignature(root), plan = recognize(root, 'tlp-pro-1025m'), state = button.children[2];let visible = true, once = true;
  Object.defineProperty(state, 'visible', {enumerable: true, configurable: true, get: () => visible, set: value => {visible = value;if (once) {once = false;throw new Error('Visibility denied');}}});
  assert.throws(() => applyRecognition(plan), /Visibility denied/);
  assert.equal(designSignature(root), before);assert.equal(root.getPluginData(REGISTRY_KEY), '');
});

test('Editing visibility after recognition invalidates the plan', async () => {
  fakeFigma();const root = await namedFixture('tlp-pro-1025m', true), button = root.children[0] as FrameNode;
  button.children.forEach(s => s.visible = true);const plan = recognize(root, 'tlp-pro-1025m');button.children[0].visible = false;
  const before = designSignature(root);assert.throws(() => applyRecognition(plan), (e: any) => e.code === 'design-changed');
  assert.equal(designSignature(root), before);
});

test('Direct capture still rejects an ambiguous preview outside the recognition transaction', async () => {
  fakeFigma();const root = await namedFixture('tlp-pro-1025m', true);applyRecognition(recognize(root, 'tlp-pro-1025m'));
  (root.children[0] as FrameNode).children.forEach(s => s.visible = true);
  assert.throws(() => capture(root), /ровно одно состояние/);
});
