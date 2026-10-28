// Real EXUI converter, Extron writer and independent reader; Figma/PNG are fixtures.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { authorButtons } from './button-preparation-fixture.ts';
import { descendants } from '../src/button-artwork.ts';
import { prepareButtons } from '../src/button-preparation.ts';
import { setButtonTextMode } from '../src/button-native-text.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';
import { capture, designSignature, exportFrame } from '../src/export.ts';
import { packageExui } from '../src/package.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const out = path.resolve(process.argv[2] ?? path.join(root, 'output/image-button-integration'));
await mkdir(out, {recursive:true});
function cli(args: string[]) {
  const result = spawnSync(process.env.DOTNET_EXE ?? path.join(root, '.tools/dotnet/dotnet.exe'),
    [process.env.EXUI_CLI_DLL ?? path.join(root, 'src/cli/bin/Debug/net10.0/Extron.Cli.dll'), ...args],
    {cwd:root,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
  assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
  return JSON.parse(result.stdout);
}
const evidence: unknown[] = [];
for (const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const) {
  const f = authorButtons(profile);prepareButtons(f.root);
  for (const button of f.buttons) for (const state of button.children)
    (descendants(state).find(n => n.type === 'TEXT') as TextNode).fontName = {family:'Inter',style:'Regular'};
  applyRecognition(recognize(f.root, profile));setButtonTextMode(f.root, {}, 'auto');
  const ids = capture(f.root).screen.elements.map(e => [e.objectId,e.controlId]);
  f.buttons[0].name = 'imagebutton_AudioControl';
  for (const state of f.buttons[0].children) (descendants(state).find(n => n.type === 'TEXT') as TextNode).y = 3;
  applyRecognition(recognize(f.root, profile));
  const before = designSignature(f.root), bundle = await exportFrame(f.root);
  assert.equal(designSignature(f.root), before);
  const input = path.join(out, profile + '.exui'), output = path.join(out, profile + '.gdl');
  await writeFile(input, packageExui(bundle), {flag:'wx'});
  const generation = cli(['convert-package',input,output,'--registry',path.join(root, 'samples/donors.json')]);
  const model = cli(['list-controls',output]).model, controls = model.Pages[0].Controls;
  assert.equal(controls.length, 2);assert.ok(controls.every((c: any) => c.Type === 'PBButton'));
  assert.deepEqual(controls.map((c: any) => [c.ObjectId,c.ControlId]), ids);
  assert.deepEqual(controls[0].States.map((s: any) => s.Text), ['','']);
  assert.deepEqual(controls[0].States.map((s: any) => s.Name), ['Off','On']);
  assert.deepEqual(controls[1].States.map((s: any) => s.Text), ['Power','Power']);
  assert.equal(controls[1].FlattenText, false);
  for (const state of controls[0].States) {
    const resource = model.Resources.find((r: any) => r.Name === state.Image);
    assert.ok(resource);assert.deepEqual([resource.Width,resource.Height], [120,80]);
  }
  evidence.push({profile,generation,imageButton:controls[0].Name,states:2,separateLabels:0,idsPreserved:true,nativeNeighborPreserved:true});
  console.log(`PASS ${profile}: raster Button states, PNG dimensions, native neighbor and IDs verified in GDL`);
}
await writeFile(path.join(out, 'integration.json'), JSON.stringify({passed:true,scenarios:evidence,
  boundary:'Modeled Figma API/PNG; real CLI, Extron writer and independent reader. Live Figma and hardware not run.'}, null, 2) + '\n', {flag:'wx'});
