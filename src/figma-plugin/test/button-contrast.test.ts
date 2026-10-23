import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { authorButtons, paint } from './button-preparation-fixture.ts';
import { background, descendants } from '../src/button-artwork.ts';
import { contrastRatio } from '../src/button-contrast.ts';
import { prepareButtons } from '../src/button-preparation.ts';
import { designSignature } from '../src/export.ts';

const color = (node: SceneNode, field: 'fills' | 'strokes' = 'fills') => ({...((node as GeometryMixin)[field] as SolidPaint[])[0].color});
const label = (node: SceneNode) => descendants(node).find(n => n.type === 'TEXT') as TextNode;
const icon = (node: SceneNode) => descendants(node).find(n => n.name === 'Vector') as RectangleNode;
const black = paint('#000000').color, white = paint('#FFFFFF').color, gold = paint('#D2AE6D').color;

test('WCAG contrast uses sRGB luminance: black/white 21, equal colors 1, gold fails white text', () => {
  assert.equal(contrastRatio(black,white),21);
  assert.equal(contrastRatio(gold,gold),1);
  assert.ok(contrastRatio(white,gold)<3);
  assert.ok(contrastRatio(black,gold)>4.5);
});

test('Input 7: white label and gold icon become black on gold On, while Off keeps its contrasting artwork', () => {
  const f=authorButtons();f.buttons[0].name='button_Source7';label(f.buttons[0]).characters='Input 7';
  icon(f.buttons[0]).fills=[paint('#D2AE6D')];f.active.fills=[paint('#D2AE6D')];
  const original=descendants(f.buttons[0]).map(n=>[n,n.id,n.x,n.y,n.width,n.height] as const),report={corrected:0,unchecked:0};
  prepareButtons(f.root,{},false,false,{report});
  const [off,on]=f.buttons[0].children;
  assert.deepEqual(color(label(off)),white);assert.deepEqual(color(icon(off)),gold);
  assert.deepEqual(color(label(on)),black);assert.deepEqual(color(icon(on)),black);
  assert.equal(on.visible,false);assert.equal(label(on).characters,'Input 7');
  assert.deepEqual(report,{corrected:4,unchecked:0});
  for(const [n,id,x,y,w,h] of original)assert.deepEqual([n.id,n.x,n.y,n.width,n.height],[id,x,y,w,h]);
});

test('Each clone assesses the authored color: a white label corrected on light Off remains white on dark On', () => {
  const f=authorButtons();f.normal.fills=[paint('#D2AE6D')];f.active.fills=[paint('#101112')];
  prepareButtons(f.root);
  assert.deepEqual(color(label(f.buttons[0].children[0])),black);
  assert.deepEqual(color(label(f.buttons[0].children[1])),white);
});

test('Updating existing states repairs low contrast; skip-ready and disabled correction preserve the artwork', () => {
  const f=authorButtons();prepareButtons(f.root);
  const before=designSignature(f.root);f.active.fills=[paint('#D2AE6D')];
  prepareButtons(f.root,{},'apply-new');assert.equal(designSignature(f.root),before);
  prepareButtons(f.root,{},'apply',false,{enabled:false});
  assert.deepEqual(color(label(f.buttons[0].children[1])),white);
  const report={corrected:0,unchecked:0};prepareButtons(f.root,{},'apply',false,{report});
  assert.deepEqual(color(label(f.buttons[0].children[1])),black);
  assert.ok(report.corrected>=2);assert.equal(report.unchecked,0);
  const repeated=designSignature(f.root);prepareButtons(f.root,{},'apply');assert.equal(designSignature(f.root),repeated);
});

test('Stroke-only icons are corrected through nested groups, hidden artwork stays untouched', () => {
  const f=authorButtons();f.active.fills=[paint('#D2AE6D')];
  const glyph=icon(f.buttons[0]);glyph.fills=[];glyph.strokes=[paint('#D2AE6D')];
  const hidden=glyph.clone();glyph.parent!.appendChild(hidden);hidden.name='hidden icon';hidden.visible=false;
  prepareButtons(f.root);
  const on=f.buttons[0].children[1];
  assert.deepEqual(color(icon(on),'strokes'),black);assert.deepEqual(icon(on).fills,[]);
  assert.deepEqual(color(descendants(on).find(n=>n.name==='hidden icon')!,'strokes'),gold);
});

for(const kind of ['gradient','image','mixed','transparent-paint','transparent-layer','effect','blend','mask'] as const)
test(`Unsupported ${kind} is preserved and reported for manual checking`, () => {
  const f=authorButtons();f.active.fills=[paint('#D2AE6D')];
  const text=label(f.buttons[0]);
  if(kind==='gradient')text.fills=[{type:'GRADIENT_LINEAR',gradientTransform:[[1,0,0],[0,1,0]],gradientStops:[{position:0,color:{...white,a:1}},{position:1,color:{...gold,a:1}}]}];
  if(kind==='image')text.fills=[{type:'IMAGE',imageHash:'fixture',scaleMode:'FILL'}];
  if(kind==='mixed')text.fills=figma.mixed;
  if(kind==='transparent-paint')text.fills=[{...paint('#FFFFFF'),opacity:.1}];
  if(kind==='transparent-layer')text.opacity=.4;
  if(kind==='effect')text.effects=[{type:'LAYER_BLUR',radius:2,visible:true}];
  if(kind==='blend')text.blendMode='MULTIPLY';
  if(kind==='mask')text.isMask=true;
  const original=text.fills,report={corrected:0,unchecked:0};prepareButtons(f.root,{},false,false,{report});
  assert.deepEqual(text.fills,original);assert.ok(report.unchecked>0);
});

test('Translucent solid foreground is evaluated after compositing; paint alpha is preserved', () => {
  const f=authorButtons();f.active.fills=[paint('#D2AE6D')];label(f.buttons[0]).fills=[{...paint('#FFFFFF'),opacity:.9}];
  prepareButtons(f.root);
  const text=label(f.buttons[0].children[1]);assert.deepEqual(color(text),black);
  assert.equal((text.fills as SolidPaint[])[0].opacity,.9);
});

test('A complex or translucent background is not guessed; both states report manual checks', () => {
  const f=authorButtons();f.normal.fills=[{...paint('#000000'),opacity:.5}];f.active.fills=[{type:'IMAGE',imageHash:'fixture',scaleMode:'FILL'}];
  const report={corrected:0,unchecked:0};prepareButtons(f.root,{},false,false,{report});
  assert.deepEqual(report,{corrected:0,unchecked:4});
  assert.deepEqual(color(label(f.buttons[0].children[1])),white);
});

test('Text in a local filled Frame is checked against that local background', () => {
  const f=authorButtons(),button=f.buttons[0],text=label(button),panel=figma.createFrame();
  panel.resize(100,24);panel.name='caption panel';panel.fills=[paint('#FFFFFF')];button.appendChild(panel);panel.x=10;panel.y=50;panel.appendChild(text);text.x=0;text.y=0;
  f.active.fills=[paint('#101112')];prepareButtons(f.root);
  assert.deepEqual(panel.fills,[paint('#FFFFFF')]);assert.deepEqual(color(text),black);
});

test('A filled Frame background containing the label still checks its children', () => {
  const f=authorButtons(),button=f.buttons[0],bg=background(button),text=label(button),panel=figma.createFrame();
  panel.resize(button.width,button.height);panel.fills=bg.fills;button.insertChild(0,panel);panel.x=0;panel.y=0;panel.appendChild(text);bg.remove();
  f.normal.fills=[paint('#D2AE6D')];prepareButtons(f.root);
  assert.deepEqual(color(text),black);
});

test('Failure after correcting multiple states restores original colors, backgrounds and layer identities', () => {
  const f=authorButtons();prepareButtons(f.root);f.active.fills=[paint('#D2AE6D')];
  const before=designSignature(f.root);f.api.commitUndo=()=>{throw new Error('commit fixture failure');};
  assert.throws(()=>prepareButtons(f.root,{},'apply'),/commit fixture failure/);
  assert.equal(designSignature(f.root),before);
});

test('Built command enables correction by default, accepts opt-out and reports corrected/unchecked artwork', async () => {
  const archive=process.env.EXUI_PLUGIN_ARCHIVE?unzipSync(readFileSync(process.env.EXUI_PLUGIN_ARCHIVE)):undefined;
  const source=archive?strFromU8(archive[JSON.parse(strFromU8(archive['manifest.json'])).main]):buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
  const f=authorButtons();f.active.fills=[paint('#D2AE6D')];f.page.selection=[f.root as never];
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'button-apply-styles',contrast:false});
  assert.deepEqual(color(label(f.buttons[0].children[1])),white);
  assert.match(String(f.messages.filter(m=>m.type==='success').at(-1)?.message),/Автокоррекция контраста выключена/);
  await send({type:'button-apply-styles',existing:'update'});
  assert.deepEqual(color(label(f.buttons[0].children[1])),black);
  assert.match(String(f.messages.filter(m=>m.type==='success').at(-1)?.message),/Контраст: исправлено слоёв — 4/);
  label(f.buttons[0].children[1]).opacity=.1;
  await send({type:'button-apply-styles',existing:'update'});
  assert.match(String(f.messages.filter(m=>m.type==='success').at(-1)?.message),/Требуют ручной проверки/);
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
});
