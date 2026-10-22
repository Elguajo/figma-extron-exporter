import test from 'node:test';
import assert from 'node:assert/strict';
import { authorButtons } from './button-preparation-fixture.ts';
import { background, validateArtwork } from '../src/button-artwork.ts';
import { prepareButtons } from '../src/button-preparation.ts';
import { rect } from '../src/read-node.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';
import { designSignature, exportFrame } from '../src/export.ts';

test('Matching Group states with subpixel precision do not trigger a full-button error', async () => {
  const f = authorButtons(), button = f.buttons[0];
  const width = 218.00001525878906, height = 159.99998474121094;
  background(button).resize(width, height);button.resize(width, height);
  prepareButtons(f.root);
  const state = button.children[0] as GroupNode;
  // The previous comparison rejected these identical authored bounds because
  // only the state side was rounded, even within the old 0.001px tolerance.
  assert.notEqual(JSON.stringify(rect(state, button)), JSON.stringify([0, 0, button.width, button.height]));
  const before = designSignature(f.root), plan = recognize(f.root, 'tlp-pro-1025m');
  assert.deepEqual(plan.errors, []);assert.equal(designSignature(f.root), before);
  applyRecognition(plan);
  const saved = designSignature(f.root), bundle = await exportFrame(f.root);
  assert.deepEqual(bundle.screen.elements[0].rect, [10, 10, 218, 160]);
  assert.equal(bundle.screen.elements[0].states!.length, 2);
  assert.equal(designSignature(f.root), saved);
  assert.equal(button.width, width);assert.equal(state.height, height);
});

for (const defect of ['width', 'position'] as const) test(`Actual state ${defect} mismatch reports measured bounds and a geometry-specific hint`, () => {
  const f = authorButtons(), button = f.buttons[0];prepareButtons(f.root);
  const state = button.children[0] as GroupNode;
  if (defect === 'width') state.resize(118, 80);
  else state.x = 2;
  assert.throws(() => validateArtwork(state, button), (error: any) => {
    assert.equal(error.code, 'states');assert.equal(error.nodeId, state.id);
    assert.match(error.message, /После округления для экспорта/);
    assert.ok(error.message.includes(defect === 'width' ? '118×80' : 'X=2, Y=0'));
    assert.match(error.message, /button_AudioControl.*120×80/);
    return true;
  });
  const issue = recognize(f.root, 'tlp-pro-1025m').issues.find(i => i.nodeId === state.id)!;
  assert.ok(issue);assert.match(issue.fix, /округляются/);assert.doesNotMatch(issue.fix, /Off \/ On/);
});
