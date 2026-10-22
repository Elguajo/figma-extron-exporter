import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { twoScreens } from './page-project-fixture.ts';
import { authorButtons } from './button-preparation-fixture.ts';
import { presetPreviews,rememberPreset } from '../src/button-preparation.ts';
import { ExportScope,PAGE_SETTINGS_KEY } from '../src/scope.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { exportCaptured } from '../src/export.ts';
import { png } from './kit-fixture.ts';

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;

test('Preset previews visit each page container once even when samples are missing',()=>{
  const f=fakeFigma(),api=f.api as unknown as PluginAPI;
  const scratch=api.createFrame();scratch.name='Scratch';
  for(let i=0;i<1000;i++)scratch.appendChild(api.createRectangle());
  const children=scratch.children;let reads=0;
  Object.defineProperty(scratch,'children',{get(){reads++;return children;}});
  const previews=presetPreviews();
  assert.equal(previews.normal.ready,false);assert.equal(previews.feedback.ready,false);
  assert.equal(reads,1);
});

test('Explicit preset references avoid unrelated artwork and still follow renamed samples',()=>{
  const f=authorButtons();rememberPreset(f.normal,'normal');rememberPreset(f.active,'feedback');
  f.normal.name='Custom normal';f.active.name='Custom active';
  const api=f.api as unknown as PluginAPI,scratch=api.createFrame();scratch.name='Scratch';
  f.page.insertChild(0,scratch as never);
  Object.defineProperty(scratch,'children',{get(){throw new Error('Unrelated artwork was traversed');}});
  const previews=presetPreviews();assert.equal(previews.normal.name,'Custom normal');assert.equal(previews.feedback.name,'Custom active');
  assert.equal(previews.normal.ready,true);assert.equal(previews.feedback.ready,true);
});

test('Empty saved membership restores without reading page children',()=>{
  const f=fakeFigma();new ExportScope().persist();
  let reads=0;
  Object.defineProperty(f.page,'children',{get(){reads++;throw new Error('Page traversal during empty restore');}});
  const scope=new ExportScope();assert.equal(scope.mode,'selection');assert.equal(scope.profile,'tlp-pro-1025m');
  assert.equal(reads,0);
});

test('Saved frame restoration stops after all requested frames are found',()=>{
  const f=fakeFigma(),{main,audio}=twoScreens();
  f.page.selection=[main as never,audio as never];const scope=new ExportScope();scope.refreshSelection();scope.persist();
  const scratch=f.api.createFrame();scratch.name='Scratch';let reads=0;
  Object.defineProperty(scratch,'children',{get(){reads++;return [];}});
  const restored=new ExportScope();assert.equal(restored.mode,'selected-frames');assert.equal(reads,0);
});

test('Ready and selection events do not serialize unrelated page artwork in selected-frame mode',async()=>{
  const f=fakeFigma(),{main,audio}=twoScreens(),scratch=f.api.createFrame();scratch.name='Scratch';let paintReads=0;
  Object.defineProperty(scratch,'fills',{get(){paintReads++;return [];}});
  f.page.selection=[main as never,audio as never];
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  await (f.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'ready'});
  f.page.selection=[main.children[0] as never];f.emit('selectionchange');
  assert.equal(paintReads,0);assert.equal(f.messages.filter(m=>m.type==='selection').length,2);
  assert.ok((f.messages.at(-1)!.targets as unknown[]).length);
  assert.ok(f.page.getPluginData(PAGE_SETTINGS_KEY));
});

test('Scoped recognition ignores scratch edits but rejects edits to selected screens',()=>{
  const f=fakeFigma(),{main,audio}=twoScreens(),scratch=f.api.createRectangle();
  const options={members:[main,audio],projectName:'Panels'};
  const plan=recognize(f.page as unknown as PageNode,'tlp-pro-1025m',options);assert.deepEqual(plan.errors,[]);
  scratch.x+=1;applyRecognition(plan);
  const changed=recognize(f.page as unknown as PageNode,'tlp-pro-1025m',options);main.children[0].x+=1;
  assert.throws(()=>applyRecognition(changed),/изменился после распознавания/);
});

for(const mutation of ['edit','remove','reparent'] as const)test(`Scoped export still rejects a screen ${mutation} after capture`,async()=>{
  const f=fakeFigma(),{main,audio}=twoScreens(),options={members:[main,audio],projectName:'Panels'};
  const captured=applyRecognition(recognize(f.page as unknown as PageNode,'tlp-pro-1025m',options));
  if(mutation==='edit')audio.children[0].x+=1;
  else if(mutation==='remove')audio.remove();
  else f.api.createFrame().appendChild(audio as never);
  await assert.rejects(exportCaptured(f.page as unknown as PageNode,captured),/Дизайн изменился/);
});

test('Scoped export permits changes to scratch artwork outside the export',async()=>{
  const f=fakeFigma(),{main,audio}=twoScreens(),options={members:[main,audio],projectName:'Panels'};
  const captured=applyRecognition(recognize(f.page as unknown as PageNode,'tlp-pro-1025m',options));
  const scratch=f.api.createRectangle();scratch.name='Scratch';scratch.x+=10;
  const bundle=await exportCaptured(f.page as unknown as PageNode,captured);assert.equal(bundle.screen.schema,'exui-screen/5');
});

for(const edited of ['screen','scratch'] as const)test(`Scoped export checks for ${edited} changes during asynchronous PNG rendering`,async()=>{
  const f=fakeFigma(),{main,audio}=twoScreens(),api=f.api as unknown as PluginAPI;
  const graphic=api.createFrame();graphic.name='image_Logo';graphic.resize(20,20);graphic.x=200;main.appendChild(graphic);
  const scratch=api.createRectangle();scratch.name='Scratch';
  const captured=applyRecognition(recognize(f.page as unknown as PageNode,'tlp-pro-1025m',{members:[main,audio],projectName:'Panels'}));
  let renders=0;
  f.setRenderHook(async node=>{renders++;await Promise.resolve();if(edited==='screen')audio.children[0].x+=1;else scratch.x+=1;return png(node.width,node.height);});
  if(edited==='screen')await assert.rejects(exportCaptured(f.page as unknown as PageNode,captured),/Дизайн изменился/);
  else assert.equal((await exportCaptured(f.page as unknown as PageNode,captured)).resources.length,1);
  assert.ok(renders>0);
});
