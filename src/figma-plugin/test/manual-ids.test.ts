// The real bundled command handler; only the Figma API boundary is simulated.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { namedFixture } from './named-fixture.ts';
import { expandedFixture,frame,label } from './expanded-fixture.ts';
import { DATA_KEY,readMetadata } from '../src/model.ts';
import { tag } from '../src/demo.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { designSignature } from '../src/export.ts';

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
function plugin(){const fake=fakeFigma();const restart=()=>vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});restart();return {...fake,restart,send:(m:unknown)=>(fake.api.ui.onmessage as (m:unknown)=>Promise<void>)(m)};}
const profile='tlp-pro-1025m';
const errors=(p:ReturnType<typeof plugin>)=>p.messages.filter(m=>m.type==='error');
async function setup(){const p=plugin(),root=await namedFixture(profile,true);applyRecognition(recognize(root,profile));return {p,root,button:root.children[0]};}
async function save(p:ReturnType<typeof plugin>,node:SceneNode,data:Record<string,unknown>){p.page.selection=[node as never];await p.send({type:'save-ids',nodeId:node.id,data});}

test('Recreated button reclaims a deleted control ID; check, restart and exported EXUI preserve it',async()=>{
  const {p,root,button}=await setup(),old=readMetadata(button)!;
  const replacement=button.clone();button.remove();
  function clear(n:SceneNode){n.setPluginData(DATA_KEY,'');if('children' in n)for(const c of n.children)clear(c);}clear(replacement);
  await save(p,replacement,{objectId:'',controlId:String(old.controlId)});
  assert.deepEqual(errors(p),[]);
  const assigned=readMetadata(replacement)!;assert.equal(assigned.controlId,old.controlId);assert.ok(assigned.objectId!>old.objectId!);
  await p.send({type:'check'});p.restart();await p.send({type:'export'});
  assert.deepEqual(errors(p),[]);
  const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;
  const exported=bundle.screen.elements.find((e:any)=>e.key===assigned.key);
  assert.equal(exported.controlId,old.controlId);assert.equal(exported.objectId,assigned.objectId);
  assert.equal(readMetadata(root.children.find(n=>n.name==='button_Mute')!)!.controlId,8103);
});

test('Button inside a copied popup saves GUI Designer ID 9140; export repairs ancestors/states and keeps that ID',async()=>{
  const p=plugin(),section=figma.createSection(),home=expandedFixture(),popup=await namedFixture(profile,true);
  section.name='AV panels';section.appendChild(home);section.appendChild(popup);popup.name='popup_HallSources';
  frame(home,'popupref_HallSources',0,0,popup.width,popup.height,'');
  const plan=recognize(section,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const copy=popup.clone();popup.remove();const button=(copy as FrameNode).children[0];
  const parentBefore=copy.getPluginData(DATA_KEY),statesBefore=(button as FrameNode).children.map(n=>designSignature(n));
  await save(p,button,{objectId:'',controlId:'9140'});
  assert.deepEqual(errors(p),[]);assert.equal(readMetadata(button)!.controlId,9140);
  assert.equal(copy.getPluginData(DATA_KEY),parentBefore);assert.deepEqual((button as FrameNode).children.map(n=>designSignature(n)),statesBefore);
  await p.send({type:'export'});assert.deepEqual(errors(p),[]);
  function owned(n:SceneNode){const m=readMetadata(n);if(m)assert.equal(m.ownerNodeId,n.id);if('children' in n)for(const c of n.children)owned(c);}owned(copy);
  assert.equal(readMetadata(copy)!.ownerNodeId,copy.id);assert.equal(readMetadata(button)!.controlId,9140);
  const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;
  assert.ok(bundle.screen.popups.some((c:any)=>c.elements.some((e:any)=>e.controlId===9140)));
});

test('ID-only saving preserves properties and ignores unrelated unsaved form values',async()=>{
  const {p,button}=await setup(),before=readMetadata(button)!;
  await save(p,button,{objectId:'500',controlId:'9140',key:'Bad key',kind:'slider',min:'invalid'});
  assert.deepEqual(errors(p),[]);
  assert.deepEqual(readMetadata(button),{...before,objectId:500,controlId:9140});
  const copy=button.clone();copy.name='button_Second';p.page.selection=[copy as never];p.emit('selectionchange');
  const selection=p.messages.filter(m=>m.type==='selection').at(-1) as any;
  assert.notEqual(selection.metadata.objectId,500);assert.notEqual(selection.metadata.controlId,9140);
});

test('Occupied control IDs across pages/popups and object IDs within a page reject without writes',async()=>{
  const {p,root,button}=await setup(),other=readMetadata(root.children[3])!;
  for(const data of [{controlId:String(other.controlId)},{objectId:String(other.objectId)}]){
    const before=designSignature(root);await save(p,button,data);
    assert.equal(errors(p).at(-1)?.code,'duplicate-id');assert.match(String(errors(p).at(-1)?.message),/button_Mute/);assert.equal(designSignature(root),before);
  }
  // The same control ID is forbidden even in another container.
  const section=figma.createSection();section.name='AV panels';section.appendChild(root);const popup=await namedFixture(profile,true);popup.name='popup_Sources';section.appendChild(popup);
  frame(root,'popupref_Sources',0,0,popup.width,popup.height,'');
  const plan=recognize(section,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);const before=designSignature(section);
  await save(p,button,{controlId:String(readMetadata(popup.children[0])!.controlId)});
  assert.equal(errors(p).at(-1)?.code,'duplicate-id');assert.equal(designSignature(section),before);
  // Object IDs have a separate namespace in each container.
  await save(p,button,{objectId:String(readMetadata(popup.children[0])!.objectId)});
  assert.equal(p.messages.filter(m=>m.type==='success').at(-1)?.operation,'save-ids');
});

test('Invalid IDs and stale selection fail without changing saved assignments',async()=>{
  const {p,root,button}=await setup();
  for(const data of [{controlId:'0'},{controlId:'65536'},{controlId:'1.5'},{controlId:'abc'},{objectId:'-1'},{objectId:'1000001'}]){
    const before=designSignature(root);await save(p,button,data);assert.equal(errors(p).at(-1)?.code,'id');assert.equal(designSignature(root),before);
  }
  const before=designSignature(root);p.page.selection=[root.children[3] as never];await p.send({type:'save-ids',nodeId:button.id,data:{controlId:'9140'}});
  assert.equal(errors(p).at(-1)?.code,'selection');assert.equal(designSignature(root),before);
});

test('Existing Save assignment also rejects occupied IDs instead of letting export renumber them',async()=>{
  const {p,root,button}=await setup(),m=readMetadata(button)!,before=designSignature(root);
  p.page.selection=[button as never];await p.send({type:'apply',nodeId:button.id,data:{...m,objectId:String(m.objectId),controlId:String(readMetadata(root.children[3])!.controlId)}});
  assert.equal(errors(p).at(-1)?.code,'duplicate-id');assert.equal(designSignature(root),before);
});

test('A failed ID write rolls back metadata and the allocation registry',async()=>{
  const {p,root,button}=await setup(),before=designSignature(root),write=button.setPluginData.bind(button);let failed=false;
  button.setPluginData=(key,value)=>{if(key===DATA_KEY&&!failed){failed=true;throw new Error('simulated write failure');}write(key,value);};
  await save(p,button,{controlId:'9140'});assert.match(String(errors(p).at(-1)?.message),/simulated write failure/);assert.equal(designSignature(root),before);
});

test('Saving a button ID ignores unrelated Mute geometry and divider type errors; export still checks them',async()=>{
  const {p,root,button}=await setup(),mute=root.children[3] as FrameNode,off=mute.children[0] as FrameNode;
  const height=off.height;off.resize(off.width,height+4);off.setPluginData('exui-generated-state','1');
  const divider=figma.createLine();divider.name='line_Devider4';root.appendChild(divider);
  tag(divider,{kind:'graphic',key:'home.divider',objectId:4000,controlId:null,file:'assets/divider.png',resourceName:'divider.png'});
  const broken=recognize(root,profile);assert.ok(broken.errors.some(e=>e.includes('Off')));assert.ok(broken.errors.some(e=>e.includes('line_Devider4')));
  const others=root.children.filter(n=>n!==button).map(n=>designSignature(n));
  await save(p,button,{controlId:'9140'});
  assert.deepEqual(errors(p),[]);assert.equal(readMetadata(button)!.controlId,9140);
  assert.deepEqual(root.children.filter(n=>n!==button).map(n=>designSignature(n)),others);
  p.restart();await p.send({type:'check'});
  const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;
  assert.ok(report.errors.some((e:string)=>e.includes('Off')));assert.ok(report.errors.some((e:string)=>e.includes('line_Devider4')));
  assert.equal(readMetadata(button)!.controlId,9140);
  off.resize(off.width,height);off.setPluginData('exui-generated-state','');divider.remove();await p.send({type:'export'});
  assert.deepEqual(errors(p),[]);const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;
  assert.equal(bundle.screen.elements.find((e:any)=>e.key===readMetadata(button)!.key).controlId,9140);
});

test('An occupied ID is rejected even when its owner is absent from recognition rows because of an invalid name',async()=>{
  const {p,root,button}=await setup(),other=root.children[3],id=readMetadata(other)!.controlId;
  other.name='button_ОшибочноеИмя';assert.ok(!recognize(root,profile).rows.some(row=>row.id===other.id));
  const before=designSignature(root);await save(p,button,{controlId:String(id)});
  assert.equal(errors(p).at(-1)?.code,'duplicate-id');assert.match(String(errors(p).at(-1)?.message),/button_ОшибочноеИмя/);assert.equal(designSignature(root),before);
});

test('Existing Page 1 button accepts native GUI Designer ID 1 even when its container cannot be recognized',async()=>{
  const {p,root,button}=await setup();button.name='button_Page1';
  // A container-wide export limit prevents all child rows from being produced.
  while(root.children.length<=64)frame(root,'shape_Extra'+root.children.length,0,0,1,1);
  assert.ok(!recognize(figma.currentPage,profile,{members:[root]}).rows.some(row=>row.id===button.id));
  const others=root.children.filter(n=>n!==button).map(n=>designSignature(n));
  await save(p,button,{objectId:String(readMetadata(button)!.objectId),controlId:'1'});
  assert.deepEqual(errors(p),[]);assert.equal(readMetadata(button)!.controlId,1);
  assert.deepEqual(root.children.filter(n=>n!==button).map(n=>designSignature(n)),others);
  while(root.children.length>4)root.children.at(-1)!.remove();
  p.restart();await p.send({type:'export'});assert.deepEqual(errors(p),[]);
  const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;
  assert.equal(bundle.screen.elements.find((e:any)=>e.name==='button_Page1').controlId,1);
});

test('Saving an assigned button outside the remembered export members uses its own project without changing export settings',async()=>{
  const {p,root,button}=await setup(),other=await namedFixture(profile,true);other.name='screen_Other';
  p.page.selection=[other as never];await p.send({type:'context',scopeMode:'selected-frames',profile});
  await save(p,button,{controlId:'1'});
  assert.deepEqual(errors(p),[]);assert.equal(readMetadata(button)!.controlId,1);
  const context=p.messages.filter(m=>m.type==='selection').at(-1) as any;
  assert.equal(context.scopeMode,'selected-frames');assert.ok(!context.scopeHint.includes(root.name));
});

test('Page buttons keep manual IDs 1/2 through invalid placement, popup moves, state errors, restart and export',async()=>{
  const {p,root,button:first}=await setup(),second=root.children[3];
  first.name='button_Page1';second.name='button_Page2';
  const section=figma.createSection();section.name='Audio panels';section.appendChild(root);
  const group=frame(null,'popupgroup_AudioControls',0,0,1280,800,'');section.appendChild(group);
  const hall=frame(group,'popup_HallSources',0,0,1280,800,''),terrace=frame(group,'popup_TerraceSources',0,0,1280,800,'');
  label(hall,'text_Title','Hall',0,0,100,30);label(terrace,'text_Title','Terrace',0,0,100,30);
  const ref=frame(root,'popupref_AudioControls',0,0,1280,800,'');
  tag(ref,{kind:'popup-ref',key:'home.audiocontrols',objectId:500,controlId:null,group:'group.audiocontrols'});
  for(const [button,id] of [[first,1],[second,2]] as const)await save(p,button,{controlId:String(id)});
  assert.deepEqual(errors(p),[]);
  const ids=[first,second].map(n=>[readMetadata(n)!.objectId,readMetadata(n)!.controlId]);
  group.appendChild(first);group.appendChild(second);
  const misplaced=recognize(section,profile);assert.ok(misplaced.errors.length,JSON.stringify(misplaced.errors));
  for(const popup of [hall,terrace,hall]){
    popup.insertChild(0,second);popup.appendChild(first);
    const plan=recognize(section,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
    assert.deepEqual([first,second].map(n=>[readMetadata(n)!.objectId,readMetadata(n)!.controlId]),ids);
  }
  // Reproduce the visible Off/On pair with a stale saved role from a copied state.
  const on=(first as FrameNode).children[1],before=on.getPluginData(DATA_KEY);
  on.setPluginData(DATA_KEY,JSON.stringify({...readMetadata(on),role:'normal'}));
  await p.send({type:'check'});
  const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;
  assert.ok(report.errors.some((e:string)=>e.startsWith('On:')&&e.includes('ID и роли состояний')),JSON.stringify(report.errors));
  assert.deepEqual([first,second].map(n=>[readMetadata(n)!.objectId,readMetadata(n)!.controlId]),ids);
  on.setPluginData(DATA_KEY,before);p.restart();await p.send({type:'export'});
  assert.deepEqual(errors(p),[]);
  const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;
  const exported=bundle.screen.popups.flatMap((popup:any)=>popup.elements);
  for(const [i,button] of [first,second].entries()){
    const element=exported.find((e:any)=>e.name===button.name);
    assert.deepEqual([element.objectId,element.controlId],ids[i]);
  }
});

test('A replacement button with inherited metadata gets new draft IDs; saving ID 1 claims it before check/export',async()=>{
  const {p,root,button}=await setup();button.name='button_Page1';
  await save(p,button,{controlId:'1'});assert.deepEqual(errors(p),[]);
  const old=readMetadata(button)!;
  // Model a rebuilt outer container with a new Figma ID and inherited plugin data.
  const replacement=button.clone();button.remove();
  assert.equal(readMetadata(replacement,{allowCopied:true})!.ownerNodeId,button.id);
  const plan=recognize(root,profile);assert.deepEqual(plan.errors,[]);
  const draft=plan.writes.find(w=>w.node===replacement)!.metadata;
  assert.notEqual(draft.controlId,1);assert.notEqual(draft.objectId,old.objectId);
  assert.equal(readMetadata(replacement,{allowCopied:true})!.controlId,1); // Dry run does not write.
  await save(p,replacement,{controlId:'1'});assert.deepEqual(errors(p),[]);
  await p.send({type:'check'});p.restart();await p.send({type:'export'});
  assert.deepEqual(errors(p),[]);assert.equal(readMetadata(replacement)!.controlId,1);
  const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;
  assert.equal(bundle.screen.elements.find((e:any)=>e.name==='button_Page1').controlId,1);
});

test('Reselecting an ID-saved button with copied states does not report a copy error; preview keeps all IDs',async()=>{
  const {p,button}=await setup(),replacement=button.clone();button.remove();replacement.name='button_Page1';
  await save(p,replacement,{controlId:'1'});assert.deepEqual(errors(p),[]);
  const states=(replacement as FrameNode).children,stateData=states.map(n=>n.getPluginData(DATA_KEY));
  p.page.selection=[replacement as never];p.emit('selectionchange');
  const selection=p.messages.filter(m=>m.type==='selection').at(-1) as any;
  assert.equal(selection.warning,'');
  assert.equal(selection.metadata.controlId,1);assert.equal(selection.states.length,2);
  await p.send({type:'preview',stateId:1});assert.deepEqual(errors(p),[]);
  assert.deepEqual(states.map(n=>n.visible),[false,true]);
  assert.equal(readMetadata(replacement)!.controlId,1);
  assert.deepEqual(states.map(n=>n.getPluginData(DATA_KEY)),stateData);
  await p.send({type:'check'});assert.deepEqual(errors(p),[]);
  assert.equal(readMetadata(replacement)!.controlId,1);
  assert.ok(states.every(n=>readMetadata(n)!.ownerNodeId===n.id));
});
