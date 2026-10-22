import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { frame,label } from './expanded-fixture.ts';
import { bindPopups,popupBindingInfo,savePopupPlace } from '../src/popup-binding.ts';
import { capture,designSignature } from '../src/export.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { DATA_KEY,PROFILES,readMetadata,type Profile } from '../src/model.ts';
function fixture(profile:Profile='tlp-pro-1025m',mode:'page'|'project'|'section'='project',grouped=false) {
  const f=fakeFigma(),size=PROFILES[profile];
  const root=mode==='page'?figma.currentPage:mode==='section'?figma.createSection():frame(null,'project_Trilliant',50,70,3000,1800,'');
  if(mode==='section')root.name='AV panels';
  const main=frame(root as FrameNode,'screen_AudioControl',0,0,size.width,size.height,'#101010');
  const ref=frame(main,'popupref_AudioControls',160,120,120,100,'');
  const group=grouped?frame(root as FrameNode,'popupgroup_AudioControls',size.width+40,0,280,100,''):undefined;
  const hall=frame((group??root) as FrameNode,'popup_HallSources',group?0:size.width+40,0,120,100,'#101010');label(hall,'text_Title','Hall',5,5,100,30);
  const terrace=frame((group??root) as FrameNode,'popup_TerraceSources',group?160:size.width+200,0,120,100,'#101010');label(terrace,'text_Title','Terrace',5,5,100,30);
  return {...f,root,main,ref,hall,terrace,group,profile};
}
function select(f:ReturnType<typeof fixture>){f.page.selection=[f.hall as never,f.terrace as never];return [f.hall.id,f.terrace.id];}
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)for(const mode of ['page','project','section'] as const)test(`${profile}/${mode}: save place with empty fields → select two popup → group and bind → export`,()=>{
  const f=fixture(profile,mode);savePopupPlace(f.ref,{key:'',objectId:'',exportBackground:'true'},profile);
  const place=readMetadata(f.ref)!;assert.equal(place.kind,'popup-ref');assert.ok(place.objectId);assert.ok(place.key);assert.equal(place.group,undefined);assert.equal(place.popup,undefined);assert.equal(place.exportBackground,true);
  const nodes=[f.hall,f.terrace],positions=nodes.map(n=>n.absoluteBoundingBox),styles=nodes.map(n=>JSON.stringify(n.fills));
  const ids=select(f),info=popupBindingInfo(profile)!;assert.deepEqual(info.targets.map(t=>t.id),[f.ref.id]);
  const result=bindPopups(f.ref.id,ids,profile),group=f.hall.parent!;assert.equal(f.terrace.parent,group);assert.equal(group.name,'popupgroup_AudioControls');
  assert.equal(readMetadata(f.ref)!.group,readMetadata(group)!.key);assert.equal(readMetadata(f.ref)!.popup,undefined);
  assert.deepEqual(nodes.map(n=>n.absoluteBoundingBox),positions);assert.deepEqual(nodes.map(n=>JSON.stringify(n.fills)),styles);
  const plan=recognize(result.root,profile,result.options);assert.deepEqual(plan.errors,[]);applyRecognition(plan);const screen=capture(result.root,undefined,result.options).screen;
  assert.ok('groups' in screen);assert.equal(screen.groups.length,1);assert.equal(screen.popups.length,2);assert.equal(screen.pages[0].elements.filter(e=>e.kind==='popup-ref').length,1);
  const before=designSignature(f.root),identity=nodes.map(n=>n.getPluginData(DATA_KEY));select(f);bindPopups(f.ref.id,ids,profile);
  assert.equal(designSignature(f.root),before);assert.deepEqual(nodes.map(n=>n.getPluginData(DATA_KEY)),identity);
});
test('Existing organizational group is reused without moving its popups or changing its identity',()=>{
  const f=fixture('tlp-pro-1025m','project',true),positions=[f.hall.absoluteBoundingBox,f.terrace.absoluteBoundingBox],ids=select(f);
  const result=bindPopups(f.ref.id,ids,f.profile);assert.equal(f.hall.parent,f.group);assert.equal(f.terrace.parent,f.group);assert.deepEqual([f.hall.absoluteBoundingBox,f.terrace.absoluteBoundingBox],positions);
  const plan=recognize(result.root,f.profile,result.options);assert.deepEqual(plan.errors,[]);
});
test('The existing destination is offered again when the bound group is selected later',()=>{
  const f=fixture(),other=frame(f.main,'popupref_Aardvark',10,10,120,100,'');
  bindPopups(f.ref.id,select(f),f.profile);select(f);const info=popupBindingInfo(f.profile)!;
  assert.equal(info.referenceId,f.ref.id);assert.ok(info.targets.some(t=>t.id===other.id));
});
test('Places on another panel profile are excluded',()=>{
  const f=fixture(),small=frame(f.root as FrameNode,'screen_Small',0,1000,320,480,'#101010'),ref=frame(small,'popupref_Small',20,20,120,100,'');
  select(f);assert.ok(!popupBindingInfo(f.profile)!.targets.some(t=>t.id===ref.id));
});
for(const [name,edit] of [
  ['different size',(f:ReturnType<typeof fixture>)=>f.terrace.resize(121,100)],
  ['modal popup',(f:ReturnType<typeof fixture>)=>{f.terrace.name='modalpopup_Terrace';}],
  ['part of a group',(f:ReturnType<typeof fixture>)=>{const other=frame(f.group!,'popup_Third',320,0,120,100,'');label(other,'text_Title','Third',5,5,100,30);}],
] as const)test(`Refuses ${name} without metadata or layout changes`,()=>{
  const f=fixture('tlp-pro-1025m','project',true);edit(f);const ids=select(f),before=designSignature(f.root);
  assert.throws(()=>bindPopups(f.ref.id,ids,f.profile));assert.equal(designSignature(f.root),before);
});
test('Targets from another project and stale selection are refused',()=>{
  const f=fixture(),other=frame(null,'project_Other',4000,0,3000,1800,''),main=frame(other,'screen_Other',0,0,1280,800,'#101010'),ref=frame(main,'popupref_Other',20,20,120,100,'');
  const ids=select(f),before=designSignature(f.root);assert.ok(!popupBindingInfo(f.profile)!.targets.some(t=>t.id===ref.id));assert.throws(()=>bindPopups(ref.id,ids,f.profile));
  f.page.selection=[f.hall as never];assert.throws(()=>bindPopups(f.ref.id,ids,f.profile),/Выделение/);assert.equal(designSignature(f.root),before);
});
test('Binding before artwork is prepared does not assign or modify unrelated controls',()=>{
  const f=fixture(),unfinished=frame(f.main,'button_Unfinished',0,0,80,40,'');
  const ids=select(f);bindPopups(f.ref.id,ids,f.profile);assert.equal(unfinished.getPluginData(DATA_KEY),'');assert.equal(unfinished.children.length,0);
  const plan=recognize(f.root,f.profile);assert.ok(plan.errors.length,'artwork errors still block export');
});
test('A failed metadata write restores tree, positions, registry and original selection',()=>{
  const f=fixture(),ids=select(f),before=designSignature(f.root),pageBefore=f.page.children.map(n=>n.id),original=f.ref.setPluginData.bind(f.ref);let failed=false;
  f.ref.setPluginData=(k,v)=>{if(!failed&&k===DATA_KEY&&v){failed=true;throw new Error('fixture write failed');}original(k,v);};
  assert.throws(()=>bindPopups(f.ref.id,ids,f.profile),/fixture write failed/);assert.equal(designSignature(f.root),before);assert.deepEqual(f.page.children.map(n=>n.id),pageBefore);assert.deepEqual(f.page.selection.map(n=>n.id),ids);
});
test('A failed reparent restores popup positions and removes the incomplete group',()=>{
  const f=fixture(),ids=select(f),before=designSignature(f.root),create=f.api.createFrame;let failed=false;
  f.api.createFrame=()=>{const node=create(),append=node.appendChild.bind(node);node.appendChild=n=>{if(n.id===f.terrace.id&&!failed){failed=true;throw new Error('fixture move failed');}append(n);};return node;};
  assert.throws(()=>bindPopups(f.ref.id,ids,f.profile),/fixture move failed/);assert.equal(designSignature(f.root),before);assert.deepEqual(f.page.selection.map(n=>n.id),ids);
});
test('Built commands work without keys and retain the complete project after the popup selection changes',async()=>{
  const f=fixture('tlp-pro-300m-portrait','page');
  const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  f.page.selection=[f.ref as never];await send({type:'apply',profile:f.profile,data:{kind:'popup-ref',key:'',objectId:'',popup:'',group:''}});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);assert.ok(readMetadata(f.ref)?.objectId);
  select(f);f.emit('selectionchange');const message=f.messages.filter(m=>m.type==='selection').at(-1)!;assert.equal((message.popupBinding as any).targets[0].id,f.ref.id);
  await send({type:'bind-popups',profile:f.profile,referenceId:f.ref.id,popupIds:[f.hall.id,f.terrace.id]});
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});await (f.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'export',profile:f.profile});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);const screen=(f.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle.screen;assert.equal(screen.groups.length,1);assert.equal(screen.popups.length,2);assert.equal(screen.pages.length,1);
});
