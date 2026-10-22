import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFigma, icons } from './fake-figma.ts';
import { namedFixture } from './named-fixture.ts';
import { createDemo } from '../src/demo.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';
import { capture, exportCaptured, exportFrame } from '../src/export.ts';
import { packageExui } from '../src/package.ts';

test('A committed capture exports the same package as a fresh read, including persisted IDs', async () => {
  fakeFigma();
  const root = await namedFixture();
  const captured = applyRecognition(recognize(root, 'tlp-pro-1025m'));
  assert.deepEqual(packageExui(await exportCaptured(root, captured)), packageExui(await exportFrame(root)));
});

test('A stale committed capture is refused before rendering any PNG', async () => {
  const fake = fakeFigma();
  const root = await createDemo('tlp-pro-1025m', icons());
  const captured = capture(root);
  let renders = 0;
  fake.setRenderHook(() => { renders++; });
  root.children[0].name = 'Changed after validation';
  await assert.rejects(exportCaptured(root, captured), (e: any) => e.code === 'design-changed');
  assert.equal(renders, 0);
  assert.deepEqual(fake.page.children, [root]);
});

test('Moving an ancestor while PNGs render invalidates the capture without leaving temporary nodes', async () => {
  const fake = fakeFigma();
  const root = await createDemo('tlp-pro-1025m', icons());
  const parent = fake.api.createFrame();
  parent.appendChild(root as never);
  const local = root.relativeTransform;
  fake.setRenderHook(() => { parent.x++; });
  await assert.rejects(exportFrame(root), (e: any) => e.code === 'design-changed');
  assert.deepEqual(root.relativeTransform, local);
  assert.deepEqual(fake.page.children, [parent]);
  assert.deepEqual(parent.children, [root]);
});

test('A capture from another root cannot be exported under the selected root', async () => {
  const fake = fakeFigma();
  const root = await createDemo('tlp-pro-300m-portrait', icons());
  const other = await createDemo('tlp-pro-300m-portrait', icons());
  let renders = 0;
  fake.setRenderHook(() => { renders++; });
  await assert.rejects(exportCaptured(other, capture(root)), (e: any) => e.code === 'design-changed');
  assert.equal(renders, 0);
});
