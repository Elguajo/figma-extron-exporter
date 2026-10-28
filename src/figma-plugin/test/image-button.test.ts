import test from 'node:test';
import assert from 'node:assert/strict';
import { authorButtons, paint } from './button-preparation-fixture.ts';
import { png } from './kit-fixture.ts';
import { descendants } from '../src/button-artwork.ts';
import { prepareButtons } from '../src/button-preparation.ts';
import { BUTTON_TEXT_KEY, setButtonTextMode } from '../src/button-native-text.ts';
import { DEFAULT_NUMBERING, planNumbering, applyNumbering } from '../src/button-numbering.ts';
import { recognize, applyRecognition, namedControl } from '../src/recognize.ts';
import { capture, designSignature, exportFrame } from '../src/export.ts';
import { DATA_KEY, readMetadata } from '../src/model.ts';
import { ExportScope } from '../src/scope.ts';

for (const profile of ['tlp-pro-1025m', 'tlp-pro-300m-portrait'] as const)
for (const prefix of ['imagebutton', 'ibtn', 'IMAGEBUTTON'] as const)
test(`${profile} / ${prefix}: prepare and render whole states, including arbitrary captions and hidden feedback`, async () => {
  const f = authorButtons(profile), button = f.buttons[0];f.buttons[1].remove();
  button.name = prefix + '_AudioControl';
  assert.deepEqual(namedControl(button.name), {kind:'button',suffix:'audiocontrol',buttonMode:'on-off'});
  assert.deepEqual(prepareButtons(f.root), {buttons:1,states:2,skipped:0});
  const expected = button.children.map((state, i) => {
    const label = descendants(state).find(n => n.type === 'TEXT') as TextNode;
    label.fontName = {family:'Inter',style:'Regular'};
    label.characters = i ? 'Audio\nSelected' : 'Audio\nControl';
    label.x = i ? 3.25 : 10.5;label.y = i ? 2.5 : 48.25;
    label.resize(100,24);
    return [label.characters,label.x,label.y,label.width,label.height];
  });
  const plan = recognize(f.root, profile);assert.deepEqual(plan.errors, []);applyRecognition(plan);
  const before = designSignature(f.root), pageNodes = f.page.children.map(n => n.id);
  const captured = capture(f.root), element = captured.screen.elements[0];
  assert.equal(captured.screen.elements.length, 1);
  assert.equal(element.kind, 'button');assert.equal(element.controlId, readMetadata(button)!.controlId);
  assert.deepEqual(element.states!.map(s => [s.name,s.text,s.fill]), [['Off','','#00000000'],['On','','#00000000']]);
  assert.ok(captured.images.every(i => !i.artwork?.omitTextId));
  const rendered: unknown[][] = [];
  f.setRenderHook(node => {
    const label = descendants(node as unknown as SceneNode).find(n => n.type === 'TEXT') as TextNode;
    assert.ok(label, 'the actual PNG clone must still contain the caption');
    rendered.push([label.characters,label.x,label.y,label.width,label.height]);
    return png(Math.round(node.width), Math.round(node.height));
  });
  const bundle = await exportFrame(f.root);
  assert.equal(bundle.resources.length, 2);assert.deepEqual(rendered, expected);
  assert.equal(button.children[1].visible, false);
  assert.equal(designSignature(f.root), before);assert.deepEqual(f.page.children.map(n => n.id), pageNodes);
  assert.deepEqual(prepareButtons(f.root), {buttons:0,states:0,skipped:1});
});

test('Plain Frame states with full-area centered text are forced into PNG, without native captions', () => {
  const f = authorButtons();f.buttons.forEach(b => b.remove());
  const button = figma.createFrame();button.name = 'ibtn_Centered';button.resize(120,80);button.fills = [];f.root.appendChild(button);
  for (const [i,name] of ['Off','On'].entries()) {
    const state = figma.createFrame();state.name = name;state.resize(120,80);state.fills = [paint(i ? '#0077AA' : '#222222')];state.visible = !i;button.appendChild(state);
    const label = figma.createText();label.characters = 'Audio';label.resize(120,80);label.textAlignHorizontal = 'CENTER';label.textAlignVertical = 'CENTER';state.appendChild(label);
  }
  applyRecognition(recognize(f.root, 'tlp-pro-1025m'));
  const result = capture(f.root);
  assert.equal(result.images.length, 2);assert.equal(result.screen.elements.length, 1);
  assert.ok(result.screen.elements[0].states!.every(s => s.text === '' && s.image));
  assert.ok(result.images.every(i => !i.artwork?.omitTextId));
});

test('Renaming a native-text button overrides saved alignment and is reversible without changing identities or feedback type', () => {
  const f = authorButtons();prepareButtons(f.root);
  for (const button of f.buttons) for (const state of button.children)
    (descendants(state).find(n => n.type === 'TEXT') as TextNode).fontName = {family:'Inter',style:'Regular'};
  applyRecognition(recognize(f.root, 'tlp-pro-1025m'));setButtonTextMode(f.root, {}, 'auto');
  const button = f.buttons[1], originalName = button.name, saved = button.getPluginData(DATA_KEY);
  const native = capture(f.root).screen.elements.find(e => e.controlId === readMetadata(button)!.controlId)!;
  button.name = 'imagebutton_Power';
  // Top-positioned captions would fail in the retained automatic native mode.
  for (const state of button.children) (descendants(state).find(n => n.type === 'TEXT') as TextNode).y = 0;
  const plan = recognize(f.root, 'tlp-pro-1025m');assert.deepEqual(plan.errors, []);applyRecognition(plan);
  const image = capture(f.root).screen.elements.find(e => e.controlId === native.controlId)!;
  assert.equal(button.getPluginData(DATA_KEY), saved);assert.equal(readMetadata(button)!.buttonMode, 'feedback');
  assert.deepEqual([image.objectId,image.controlId], [native.objectId,native.controlId]);
  assert.ok(image.states!.every(s => s.text === '' && s.image));
  assert.equal(button.getPluginData(BUTTON_TEXT_KEY), 'auto');
  button.name = originalName;
  for (const state of button.children) (descendants(state).find(n => n.type === 'TEXT') as TextNode).y = 50;
  assert.deepEqual(capture(f.root).screen.elements.find(e => e.controlId === native.controlId), native);
});

test('Identical Inter captions stay inside imagebutton PNGs rather than becoming a shared Label', () => {
  const f = authorButtons();prepareButtons(f.root);
  for (const button of f.buttons) for (const state of button.children)
    (descendants(state).find(n => n.type === 'TEXT') as TextNode).fontName = {family:'Inter',style:'Regular'};
  applyRecognition(recognize(f.root, 'tlp-pro-1025m'));
  assert.equal(capture(f.root).screen.elements.filter(e => e.kind === 'label').length, 2);
  f.buttons[0].name = 'imagebutton_AudioControl';
  const result = capture(f.root);
  assert.equal(result.screen.elements.filter(e => e.kind === 'label').length, 1);
  const id = readMetadata(f.buttons[0])!.controlId;
  assert.ok(result.images.filter(i => i.asset.key.startsWith(`button-artwork.${id}.`)).every(i => !i.artwork?.omitTextId));
});

test('An existing three-state feedback button keeps Pressed and all IDs after switching to imagebutton', () => {
  const f = authorButtons();prepareButtons(f.root);const button = f.buttons[1];
  const pressed = button.children[1].clone();pressed.name = 'Pressed';pressed.visible = false;pressed.setPluginData(DATA_KEY, '');button.appendChild(pressed);
  applyRecognition(recognize(f.root, 'tlp-pro-1025m'));
  const saved = button.getPluginData(DATA_KEY), stateData = button.children.map(s => s.getPluginData(DATA_KEY));
  button.name = 'imagebutton_Power';applyRecognition(recognize(f.root, 'tlp-pro-1025m'));
  const result = capture(f.root).screen.elements.find(e => e.controlId === readMetadata(button)!.controlId)!;
  assert.deepEqual(result.states!.map(s => [s.stateId,s.role,s.text]), [[0,'normal',''],[1,'feedback',''],[2,'pressed','']]);
  assert.equal(result.press, 'Pressed');assert.equal(button.getPluginData(DATA_KEY), saved);
  assert.deepEqual(button.children.map(s => s.getPluginData(DATA_KEY)), stateData);
});

test('Native text settings skip image buttons in mixed selection, without validating raster text', () => {
  const f = authorButtons();prepareButtons(f.root);f.buttons[0].name = 'ibtn_AudioControl';
  for (const state of f.buttons[0].children) {
    const label = descendants(state).find(n => n.type === 'TEXT') as TextNode;
    label.fontName = {family:'Unsupported Raster Font',style:'Regular'};label.y = 0;
    state.appendChild(label.clone());
  }
  const before = designSignature(f.buttons[0]);
  assert.deepEqual(setButtonTextMode(f.root, {}, 'auto'), {buttons:1,skipped:1});
  assert.equal(designSignature(f.buttons[0]), before);
  f.buttons[0].setPluginData(BUTTON_TEXT_KEY, 'bottom-center');
  const retained = designSignature(f.buttons[0]);
  for (const mode of ['auto','middle-center','bottom-center','design'] as const) {
    assert.deepEqual(setButtonTextMode(f.root, {members:[f.buttons[0]]}, mode), {buttons:0,skipped:1});
    assert.equal(designSignature(f.buttons[0]), retained);
  }
  applyRecognition(recognize(f.root, 'tlp-pro-1025m'));
  assert.ok(capture(f.root).screen.elements[0].states!.every(s => s.text === ''));
});

test('Unassigned image button selection and numbering retain both prefixes and do not include neighbors', async () => {
  const f = authorButtons();f.buttons[0].name = 'imagebutton_AudioControl';f.buttons[1].name = 'ibtn_Power';
  f.page.selection = [f.buttons[0] as never];
  const scope = new ExportScope().resolveButtons();assert.equal(scope.scope.kind, 'button');
  assert.deepEqual(scope.options.members, [f.buttons[0]]);
  prepareButtons(scope.root, scope.options);
  assert.equal(f.buttons[0].children[0].name, 'Off');assert.equal(f.buttons[1].children[0].type, 'RECTANGLE');
  f.page.selection = f.buttons as never;
  await applyNumbering(planNumbering(f.page.selection, {...DEFAULT_NUMBERING,base:'Card',start:1}));
  assert.deepEqual(f.buttons.map(b => b.name), ['imagebutton_Card1','ibtn_Card2']);
  assert.ok(f.buttons.every(b => !b.getPluginData(DATA_KEY)));
});
