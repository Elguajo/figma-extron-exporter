import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { frame,label } from './expanded-fixture.ts';
import { ExportScope,PAGE_SETTINGS_KEY } from '../src/scope.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { DATA_KEY,readMetadata } from '../src/model.ts';
import { designSignature } from '../src/export.ts';
import { tag } from '../src/demo.ts';
const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
test('Page scope, profile and selected-frame order survive a fresh ExportScope',()=>{
  const f=fakeFigma(),a=frame(null,'screen_A',0,0,320,480),b=frame(null,'screen_B',400,0,320,480);label(a,'text_Title','A',10,10,100,30);label(b,'text_Title','B',10,10,100,30);
  f.page.selection=[b as never,a as never];const scope=new ExportScope();scope.profile='tlp-pro-300m-portrait';scope.refreshSelection();scope.persist();
  f.page.selection=[a as never];const restored=new ExportScope();assert.equal(restored.mode,'selected-frames');assert.equal(restored.profile,'tlp-pro-300m-portrait');assert.deepEqual(restored.resolve().options.members!.map(n=>n.id),[b.id,a.id]);
  const saved=f.page.getPluginData(PAGE_SETTINGS_KEY);restored.persist();assert.equal(f.page.getPluginData(PAGE_SETTINGS_KEY),saved);
});
test('Different Figma pages retain separate settings and deleted member IDs do not revive',()=>{
  const f=fakeFigma(),a=frame(null,'screen_A',0,0,1280,800),b=frame(null,'screen_B',1400,0,1280,800);
  f.page.selection=[a as never,b as never];const scope=new ExportScope();scope.refreshSelection();scope.persist();
  const first=f.page,second=new f.FakeNode('PAGE') as typeof first;second.name='Second';second.selection=[];f.api.currentPage=second;
  scope.reset();assert.equal(scope.mode,'selection');assert.equal(scope.profile,'tlp-pro-1025m');scope.mode='page';scope.profile='tlp-pro-300m-portrait';scope.persist();
  f.api.currentPage=first;scope.reset();assert.equal(scope.mode,'selected-frames');assert.equal(scope.profile,'tlp-pro-1025m');
  b.remove();f.page.selection=[a as never];const restored=new ExportScope();assert.deepEqual(restored.resolve().options.members!.map(n=>n.id),[a.id]);
  f.api.currentPage=second;scope.reset();assert.equal(scope.mode,'page');assert.equal(scope.profile,'tlp-pro-300m-portrait');
});
test('Remembered project membership also restores frames nested inside a Section',()=>{
  const f=fakeFigma(),section=figma.createSection();section.name='Panels';
  const a=frame(section as unknown as FrameNode,'screen_A',0,0,1280,800),b=frame(section as unknown as FrameNode,'screen_B',1400,0,1280,800);
  f.page.selection=[b as never,a as never];const scope=new ExportScope();scope.refreshSelection();scope.persist();f.page.selection=[a as never];
  const restored=new ExportScope();assert.deepEqual(restored.resolve().options.members!.map(n=>n.id),[b.id,a.id]);
});
for(const raw of ['{bad json',JSON.stringify({schema:'exui-page-settings/1',pageId:'other',mode:'page',profile:'tlp-pro-300m-portrait',members:[]}),JSON.stringify({schema:'future',mode:'page',members:[]})])test('Invalid or copied page preferences fall back without deleting saved data: '+raw,()=>{
  const f=fakeFigma();f.page.setPluginData(PAGE_SETTINGS_KEY,raw);const scope=new ExportScope();assert.equal(scope.mode,'selection');assert.equal(scope.profile,'tlp-pro-1025m');assert.equal(f.page.getPluginData(PAGE_SETTINGS_KEY),raw);
});
test('Saved start page and type are restored by the built plugin after selecting another node and restarting',async()=>{
  const f=fakeFigma(),project=frame(null,'project_Memory',0,0,3000,1800,''),a=frame(project,'screen_A',0,0,1280,800),b=frame(project,'screen_B',1400,0,1280,800);label(a,'text_Title','A',10,10,100,30);label(b,'text_Title','B',10,10,100,30);
  applyRecognition(recognize(project,'tlp-pro-1025m'));
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  f.page.selection=[b as never];await send({type:'apply',data:{...readMetadata(b),kind:'page',shownBy:'start',keyEdited:'false'}});
  assert.equal(readMetadata(a)!.shownBy,'program');
  f.page.selection=[a as never];f.emit('selectionchange');
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});f.page.selection=[b as never];f.emit('selectionchange');
  const message=f.messages.filter(m=>m.type==='selection').at(-1)!;assert.equal((message.metadata as any).kind,'page');assert.equal((message.metadata as any).shownBy,'start');
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);assert.equal(readMetadata(b)!.shownBy,'start');
});
test('Start page can be saved before recognition without typing a key, ID or project name',async()=>{
  const f=fakeFigma(),main=frame(null,'screen_Main',0,0,1280,800,'#101010');label(main,'text_Title','Main',10,10,100,30);
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});f.page.selection=[main as never];
  await (f.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'apply',data:{kind:'page',shownBy:'start',key:'',objectId:'',projectName:'',profile:'tlp-pro-1025m'}});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);assert.equal(readMetadata(main)!.kind,'page');assert.equal(readMetadata(main)!.shownBy,'start');assert.ok(readMetadata(main)!.objectId);
});
test('Failed switch of the start page restores both page assignments',async()=>{
  const f=fakeFigma(),project=frame(null,'project_Panels',0,0,3000,1800,''),a=frame(project,'screen_A',0,0,1280,800),b=frame(project,'screen_B',1400,0,1280,800);label(a,'text_Title','A',10,10,100,30);label(b,'text_Title','B',10,10,100,30);applyRecognition(recognize(project,'tlp-pro-1025m'));
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});const before=designSignature(project),original=a.setPluginData.bind(a);let failed=false;
  a.setPluginData=(key,value)=>{if(!failed&&key===DATA_KEY&&value){failed=true;throw new Error('start write failed');}original(key,value);};f.page.selection=[b as never];
  await (f.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'apply',data:{...readMetadata(b),kind:'page',shownBy:'start'}});
  assert.equal(designSignature(project),before);assert.equal(readMetadata(a)!.shownBy,'start');assert.equal(readMetadata(b)!.shownBy,'program');assert.match(String(f.messages.filter(m=>m.type==='error').at(-1)!.message),/start write failed/);
});
test('A delayed save cannot apply the previous layer form to a different selected layer',async()=>{
  const f=fakeFigma(),a=frame(null,'screen_A',0,0,1280,800),b=frame(null,'screen_B',1400,0,1280,800);vm.runInNewContext(source,{figma:f.api,Uint8Array,console});f.page.selection=[b as never];
  await (f.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'apply',nodeId:a.id,data:{kind:'page',shownBy:'start',key:'',objectId:''}});
  assert.equal(readMetadata(a),null);assert.equal(readMetadata(b),null);assert.match(String(f.messages.filter(m=>m.type==='error').at(-1)!.message),/Выделение изменилось/);
});
test('An implicit legacy start page is demoted when another page is explicitly made the start page',async()=>{
  const f=fakeFigma(),a=frame(null,'screen_A',0,0,1280,800),b=frame(null,'screen_B',1400,0,1280,800);label(a,'text_Title','A',10,10,100,30);label(b,'text_Title','B',10,10,100,30);
  tag(a,{kind:'page',key:'page.a',objectId:100,profile:'tlp-pro-1025m',projectName:'Panels'});
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});f.page.selection=[b as never];await (f.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'apply',data:{kind:'page',key:'',objectId:'',shownBy:'start'}});
  assert.equal(readMetadata(a)!.shownBy,'program');assert.equal(readMetadata(a)!.schema,'exui-node/2');assert.equal(readMetadata(b)!.shownBy,'start');
  const plan=recognize(f.page as unknown as PageNode,'tlp-pro-1025m',{members:[a,b],projectName:'Panels'});assert.deepEqual(plan.errors,[]);
});
