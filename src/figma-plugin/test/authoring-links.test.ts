import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { frame,label } from './expanded-fixture.ts';
import { authoringLinks,setReferenceTarget,setSelectionGroup,setStartPage,linkedNode } from '../src/authoring-links.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { capture,designSignature } from '../src/export.ts';
import { DATA_KEY,PROFILES,readMetadata,type Profile } from '../src/model.ts';
import { ExportScope } from '../src/scope.ts';
const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
function fixture(profile:Profile='tlp-pro-1025m',batch=false){
  const f=fakeFigma(),size=PROFILES[profile],root=batch?f.page:frame(null,'project_Links',0,0,3600,1800,'');
  const a=frame(root as FrameNode,'screen_Main',0,0,size.width,size.height),b=frame(root as FrameNode,'screen_Audio',size.width+30,0,size.width,size.height);
  const ref=frame(b,'popupref_AudioControls',10,100,120,100,'');
  const group=frame(root as FrameNode,'popupgroup_AudioControls',0,size.height+30,280,100,'');
  const popups=['Hall','Terrace'].map((name,i)=>{const p=frame(group,'popup_'+name,i*140,0,120,100);label(p,'text_Title',name,5,5,100,30);return p;});
  const single=frame(root as FrameNode,'popup_Single',300,size.height+30,120,100);label(single,'text_Title','Single',5,5,100,30);
  const buttons=['Broadcast1','Broadcast2','Broadcast3'].map((name,i)=>{const n=frame(a,'button_'+name,10+i*100,10,90,40,'');for(const [j,state] of ['Normal','Active'].entries()){const s=frame(n,state,0,0,90,40,j?'#0077AA':'#202020');s.visible=j===0;label(s,'Text',name,0,0,90,40).textAlignHorizontal='CENTER';}return n;});
  const options=batch?{members:[a,b,group,single],projectName:'Links'}:{};
  return {...f,root,a,b,ref,group,popups,single,buttons,ctx:{root,options,profile}};
}
for(const profile of Object.keys(PROFILES) as Profile[])for(const batch of [false,true])test(`${profile}/${batch?'Page members':'project'}: popup target selection preserves geometry and remembers connection`,()=>{
  const f=fixture(profile,batch),before=[...f.popups,f.ref].map(n=>n.absoluteBoundingBox);
  assert.equal(readMetadata(f.ref),null);const initial=authoringLinks(f.ctx,[f.ref]);assert.ok(initial.reference!.targets.some(t=>t.id===f.group.id));assert.equal(readMetadata(f.ref),null);
  setReferenceTarget(f.ctx,f.ref.id,f.group.id);const saved=authoringLinks(f.ctx,[f.ref]);assert.equal(saved.reference!.targetId,f.group.id);assert.deepEqual(saved.reference!.members.map(t=>t.name),['popup_Hall','popup_Terrace']);
  assert.equal(readMetadata(f.ref)!.group,readMetadata(f.group)!.key);assert.deepEqual([...f.popups,f.ref].map(n=>n.absoluteBoundingBox),before);
  const id=readMetadata(f.ref)!.objectId;setReferenceTarget(f.ctx,f.ref.id,f.single.id);assert.equal(readMetadata(f.ref)!.popup,readMetadata(f.single)!.key);assert.equal(readMetadata(f.ref)!.group,undefined);
  setReferenceTarget(f.ctx,f.ref.id,'');assert.equal(readMetadata(f.ref)!.popup,undefined);assert.equal(readMetadata(f.ref)!.objectId,id);assert.equal(f.group.removed,false);
});
test('Popup list excludes mismatched sizes, modals, grouped individual pages and foreign project',()=>{
  const f=fixture();f.single.resize(121,100);const modal=frame(f.root as FrameNode,'modalpopup_Confirm',400,900,120,100);label(modal,'text_Title','Modal',0,0,100,30);
  const foreign=frame(null,'project_Other',4000,0,1600,900),p=frame(foreign,'popup_Foreign',0,0,120,100);label(p,'text_Title','Foreign',0,0,100,30);
  const info=authoringLinks(f.ctx,[f.ref]);assert.deepEqual(info.reference!.targets.map(t=>t.id),[f.group.id]);
  for(const target of [f.single,modal,f.popups[0],p])assert.throws(()=>setReferenceTarget(f.ctx,f.ref.id,target.id));assert.equal(readMetadata(f.ref),null);
});
test('Missing popup target remains visible as a broken connection without selection-time writes',()=>{
  const f=fixture();setReferenceTarget(f.ctx,f.ref.id,f.group.id);f.group.remove();const before=designSignature(f.root);const info=authoringLinks(f.ctx,[f.ref]);assert.equal(info.reference!.missing,true);assert.equal(designSignature(f.root),before);setReferenceTarget(f.ctx,f.ref.id,'');assert.equal(readMetadata(f.ref)!.group,undefined);
});
test('Create, join and leave selection group retain other button properties and identity',()=>{
  const f=fixture();f.page.selection=f.buttons.slice(0,2) as never;const value=setSelectionGroup(f.ctx,f.buttons.slice(0,2).map(n=>n.id),'',true);assert.ok(value);
  const ids=f.buttons.slice(0,2).map(n=>[readMetadata(n)!.objectId,readMetadata(n)!.controlId]);
  const before=readMetadata(f.buttons[0])!;f.buttons[0].setPluginData(DATA_KEY,JSON.stringify({...before,behavior:{...before.behavior,enabled:false,visible:true}}));
  f.page.selection=[f.buttons[2]] as never;setSelectionGroup(f.ctx,[f.buttons[2].id],value);assert.equal(readMetadata(f.buttons[2])!.behavior!.selectionGroup,value);
  let info=authoringLinks(f.ctx,[f.buttons[2]]);assert.equal(info.buttons!.group,value);assert.match(info.groups[0].name,/3.*button_Broadcast1/);
  f.page.selection=[f.buttons[0]] as never;setSelectionGroup(f.ctx,[f.buttons[0].id],'');assert.deepEqual(readMetadata(f.buttons[0])!.behavior,{enabled:false,visible:true});
  assert.deepEqual(f.buttons.slice(0,2).map(n=>[readMetadata(n)!.objectId,readMetadata(n)!.controlId]),ids);
  info=authoringLinks(f.ctx,f.buttons.slice(0,2));assert.equal(info.buttons!.mixed,true);
});
test('Grouping rejects stale selection, unknown group, mixed containers and foreign buttons without writes',()=>{
  const f=fixture(),ids=f.buttons.slice(0,2).map(n=>n.id),original=designSignature(f.root);f.page.selection=[f.buttons[0]] as never;
  assert.throws(()=>setSelectionGroup(f.ctx,ids,'',true),/Выделение изменилось/);
  f.page.selection=f.buttons.slice(0,2) as never;assert.throws(()=>setSelectionGroup(f.ctx,ids,'missing'),/не существует/);
  f.b.appendChild(f.buttons[1]);assert.throws(()=>setSelectionGroup(f.ctx,ids,'',true),/одной страницы/);f.a.appendChild(f.buttons[1]);
  assert.equal(readMetadata(f.buttons[0]),null);assert.equal(readMetadata(f.buttons[1]),null);
});
test('A failed group write restores all assignments and registry',()=>{
  const f=fixture(),before=designSignature(f.root),original=f.buttons[1].setPluginData.bind(f.buttons[1]);let failed=false;
  f.buttons[1].setPluginData=(key,value)=>{if(!failed&&key===DATA_KEY){failed=true;throw new Error('write refused');}original(key,value);};f.page.selection=f.buttons.slice(0,2) as never;
  assert.throws(()=>setSelectionGroup(f.ctx,f.buttons.slice(0,2).map(n=>n.id),'',true),/write refused/);assert.equal(designSignature(f.root),before);
});
test('Start selector changes only the exact project membership and survives fresh runtime',async()=>{
  const f=fixture('tlp-pro-1025m',true),excluded=frame(null,'screen_Excluded',0,2000,1280,800),labelNode=label(excluded,'text_Title','Excluded',0,0,100,30);
  setStartPage(f.ctx,f.b.id);assert.equal(readMetadata(f.b)!.shownBy,'start');assert.equal(readMetadata(f.a)!.shownBy,'program');assert.equal(readMetadata(excluded),null);assert.equal(readMetadata(labelNode),null);
  f.page.selection=[f.a,f.b,f.group,f.single] as never;const scope=new ExportScope();scope.refreshSelection();scope.persist();f.page.selection=[f.ref] as never;
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});await (f.api.ui.onmessage as any)({type:'ready'});
  const msg=f.messages.filter(m=>m.type==='selection').at(-1) as any;assert.equal(msg.links.startId,f.b.id);assert.ok(!msg.links.pages.some((p:any)=>p.id===excluded.id));
});
test('A failed start-page write rolls back the previous start and leaves unrelated art untouched',()=>{
  const f=fixture();setStartPage(f.ctx,f.a.id);const before=designSignature(f.root),original=f.b.setPluginData.bind(f.b);let failed=false;
  f.b.setPluginData=(key,value)=>{if(!failed&&key===DATA_KEY){failed=true;throw new Error('start refused');}original(key,value);};assert.throws(()=>setStartPage(f.ctx,f.b.id),/start refused/);assert.equal(designSignature(f.root),before);
});
test('Popup connection write failure restores target, reference and registry',()=>{
  const f=fixture(),before=designSignature(f.root),original=f.group.setPluginData.bind(f.group);let failed=false;
  f.group.setPluginData=(key,value)=>{if(!failed&&key===DATA_KEY){failed=true;throw new Error('link refused');}original(key,value);};assert.throws(()=>setReferenceTarget(f.ctx,f.ref.id,f.group.id),/link refused/);assert.equal(designSignature(f.root),before);
});
test('Multi-selecting button Frames retains selection export mode and remembered project membership',()=>{
  const f=fixture();f.page.selection=f.buttons.slice(0,2) as never;const scope=new ExportScope();scope.refreshSelection();assert.equal(scope.mode,'selection');
});
test('Built command restores groups after restart and focuses navigation targets without metadata mutation',async()=>{
  const f=fixture();f.page.selection=f.buttons.slice(0,2) as never;vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  await (f.api.ui.onmessage as any)({type:'selection-group',buttonIds:f.buttons.slice(0,2).map(n=>n.id),group:'',create:true});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);const group=readMetadata(f.buttons[0])!.behavior!.selectionGroup;
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});f.page.selection=[f.buttons[0]] as never;await (f.api.ui.onmessage as any)({type:'ready'});assert.equal((f.messages.filter(m=>m.type==='selection').at(-1) as any).links.buttons.group,group);
  const before=designSignature(f.root);await (f.api.ui.onmessage as any)({type:'show-linked',nodeId:f.buttons[0].id,targetId:f.b.id});assert.equal(f.page.selection[0].id,f.b.id);assert.equal(designSignature(f.root),before);assert.ok(f.api.viewport.zoom>0);
  const foreign=frame(null,'project_Foreign',4000,0,2000,900),page=frame(foreign,'screen_Foreign',0,0,1280,800);assert.throws(()=>linkedNode(f.ctx,page.id));
});
test('Built commands reject delayed saves and foreign target IDs',async()=>{
  const f=fixture();f.page.selection=[f.a] as never;vm.runInNewContext(source,{figma:f.api,Uint8Array,console});const send=f.api.ui.onmessage as any;
  await send({type:'start-page',nodeId:f.b.id,targetId:f.b.id});assert.equal(readMetadata(f.a),null);
  await send({type:'reference-target',nodeId:f.a.id,targetId:f.group.id});assert.equal(readMetadata(f.a),null);assert.equal(f.messages.filter(m=>m.type==='error').length,2);
});

for(const profile of Object.keys(PROFILES) as Profile[])for(const subset of ['other-screen','reference-screen','group'] as const)test(`${profile}/${subset}: popup reference links remain editable outside the saved export subset`,async()=>{
  const f=fixture(profile,true),includeScreen=subset==='reference-screen';
  // Saving an empty place intentionally disables name inference. The authoring
  // selector must still find targets outside the remembered export subset.
  setReferenceTarget(f.ctx,f.ref.id,'');
  f.page.selection=(includeScreen?[f.a,f.b]:subset==='group'?[f.group]:[f.a]) as never;
  const scope=new ExportScope();scope.mode='selected-frames';scope.profile=profile;scope.refreshSelection();scope.persist();
  f.page.selection=[f.ref] as never;
  const before=designSignature(f.root);
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'ready'});
  const message=f.messages.filter(m=>m.type==='selection').at(-1) as any;
  assert.ok(message.links?.reference,'reference selector must remain visible');
  assert.ok(message.links.reference.targets.some((t:any)=>t.id===f.group.id),'sibling group must be selectable');
  assert.equal(designSignature(f.root),before,'selection must not write assignments');
  await send({type:'reference-target',nodeId:f.ref.id,targetId:f.group.id});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(readMetadata(f.ref)!.group,readMetadata(f.group)!.key);
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  await (f.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'ready'});
  const restored=f.messages.filter(m=>m.type==='selection').at(-1) as any;
  assert.equal(restored.links.reference.targetId,f.group.id);
  const exported=new ExportScope().resolve();
  assert.equal(exported.options.members!.some(n=>n.id===f.b.id),includeScreen,'editing preserves the selected export screens');
});

test('Reference editing outside the export subset still rejects a foreign project target',async()=>{
  const f=fixture('tlp-pro-1025m',true),foreign=frame(null,'project_Foreign',4000,0,2000,1000,'');
  const popup=frame(foreign,'popup_Foreign',0,0,120,100);label(popup,'text_Title','Foreign',5,5,100,30);
  setReferenceTarget(f.ctx,f.ref.id,'');
  f.page.selection=[f.a] as never;const scope=new ExportScope();scope.mode='selected-frames';scope.refreshSelection();scope.persist();
  f.page.selection=[f.ref] as never;vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;await send({type:'ready'});
  const message=f.messages.filter(m=>m.type==='selection').at(-1) as any;
  assert.ok(!message.links.reference.targets.some((t:any)=>t.id===popup.id));
  const before=designSignature(f.root);
  await send({type:'reference-target',nodeId:f.ref.id,targetId:popup.id});
  assert.equal(f.messages.filter(m=>m.type==='error').length,1);
  assert.equal(designSignature(f.root),before);
});
test('Saved selections survive recognition and export with references, single popup and exactly one start',()=>{
  const f=fixture(),ref=frame(f.b,'popupref_Single',150,100,120,100,'');
  setReferenceTarget(f.ctx,f.ref.id,f.group.id);setReferenceTarget(f.ctx,ref.id,f.single.id);setStartPage(f.ctx,f.b.id);
  f.page.selection=f.buttons.slice(0,2) as never;const group=setSelectionGroup(f.ctx,f.buttons.slice(0,2).map(n=>n.id),'',true);
  const before=f.buttons.slice(0,2).map(n=>[readMetadata(n)!.objectId,readMetadata(n)!.controlId]),plan=recognize(f.root,'tlp-pro-1025m',f.ctx.options);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const screen=capture(f.root,undefined,f.ctx.options).screen;assert.ok('pages' in screen);assert.equal(screen.pages[0].name,'screen_Audio');assert.equal(screen.pages.filter(p=>p.shownBy==='start').length,1);
  const main=screen.pages.find(p=>p.name==='screen_Main')!;assert.equal(main.elements.filter(e=>e.behavior?.selectionGroup===group).length,2);assert.deepEqual(f.buttons.slice(0,2).map(n=>[readMetadata(n)!.objectId,readMetadata(n)!.controlId]),before);
});
