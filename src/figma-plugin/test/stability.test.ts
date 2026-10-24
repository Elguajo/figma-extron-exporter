import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { frame } from './expanded-fixture.ts';
import { DATA_KEY } from '../src/model.ts';

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;

for(const name of ['screen_Main','popup_Sources'])test(`Corrupt assignment on ${name} is reported in the panel instead of freezing it`,async()=>{
  const f=fakeFigma(),node=frame(null,name,0,0,1280,800,'#101010');node.setPluginData(DATA_KEY,'{corrupt');
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  f.page.selection=[node as never];
  await (f.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'ready'});
  f.emit('selectionchange');
  const selections=f.messages.filter(m=>m.type==='selection');
  assert.equal(selections.length,2);
  for(const message of selections){assert.equal(message.id,node.id);assert.match(String(message.warning),/повреждены данные Extron/);}
});

test('Canvas events during an export are handled once after it finishes',async()=>{
  const {twoScreens}=await import('./page-project-fixture.ts');const {png}=await import('./kit-fixture.ts');
  const f=fakeFigma(),{main,audio}=twoScreens(),graphic=frame(main as never,'image_Logo',200,20,20,20,'#FFFFFF');
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  f.page.selection=[main as never,audio as never];await send({type:'ready'});f.emit('selectionchange');
  let during=-1;
  f.setRenderHook(async node=>{f.page.selection=[audio as never];f.emit('selectionchange');f.emit('selectionchange');during=f.messages.filter(m=>m.type==='selection').length;await Promise.resolve();return png(node.width,node.height);});
  const before=f.messages.filter(m=>m.type==='selection').length;
  await send({type:'export',scopeMode:'selected-frames',profile:'tlp-pro-1025m'});
  const types=f.messages.map(m=>m.type),bundle=types.lastIndexOf('bundle'),idle=types.lastIndexOf('idle');
  assert.ok(bundle>=0&&graphic.id);
  assert.equal(during,before+1,'only the post-commit refresh of the export itself runs during PNG rendering');
  assert.deepEqual(types.slice(idle+1),['selection'],'the deferred selection is published once, after idle');
  assert.equal(f.messages.at(-1)!.id,audio.id);
});

test('Plugin start removes only marked top-level PNG export leftovers',async()=>{
  const {EXPORT_TEMP_KEY}=await import('../src/read-node.ts');
  const f=fakeFigma(),leftover=frame(null,'button_Mute',5000,0,90,40,'#303030'),design=frame(null,'screen_Main',0,0,1280,800,'#101010'),nested=frame(design as never,'Nested',0,0,10,10,'#000000');
  leftover.setPluginData(EXPORT_TEMP_KEY,'1');nested.setPluginData(EXPORT_TEMP_KEY,'1');
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  assert.ok(leftover.removed);assert.ok(!design.removed&&!nested.removed);
});

test('PNG export copies are marked while they exist and removed afterwards',async()=>{
  const {EXPORT_TEMP_KEY,exportPng}=await import('../src/read-node.ts');const {png}=await import('./kit-fixture.ts');
  const f=fakeFigma(),screen=frame(null,'screen_Main',0,0,1280,800,'#101010'),logo=frame(screen as never,'image_Logo',10,10,20,20,'#FFFFFF');
  const marks:string[]=[];
  f.setRenderHook(node=>{marks.push(node.getPluginData(EXPORT_TEMP_KEY));return png(node.width,node.height);});
  await exportPng(logo as never);await exportPng(logo as never,{width:30,height:30,offsetX:5,offsetY:5});
  assert.deepEqual(marks,['1','1']);
  assert.deepEqual(f.page.children.map(n=>n.name),['screen_Main']);
  assert.equal(logo.getPluginData(EXPORT_TEMP_KEY),'');
});
