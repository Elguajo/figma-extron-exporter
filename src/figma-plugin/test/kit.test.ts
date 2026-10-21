import test from 'node:test';
import assert from 'node:assert/strict';
import { createKit } from '../src/kit.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { capture,designSignature,exportFrame } from '../src/export.ts';
import { DATA_KEY } from '../src/model.ts';
import { kitFixture } from './kit-fixture.ts';
import { packageExui } from '../src/package.ts';
import { unzipSync } from 'fflate';

test('Figma rejects component property bindings inside slot content',()=>{
  const fake=kitFixture(),master=(fake.api as any).createComponent(),slot=master.createSlot(),text=fake.api.createText() as any;
  slot.appendChild(text);
  assert.throws(()=>{text.componentPropertyReferences={characters:'Label#1'};},/slot sublayer/);
});

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)
test(`Kit ${profile}: components, slots, native controls → recognition → valid package, source masters unchanged`,async()=>{
  const fake=kitFixture(),kit=await createKit(profile);
  assert.equal(kit.components.length,30);assert.equal(fake.page.selection[0].id,kit.example.id);
  const master=designSignature(kit.library),before=designSignature(kit.example);
  const plan=recognize(kit.example,profile);assert.deepEqual(plan.errors,[]);assert.equal(designSignature(kit.example),before);applyRecognition(plan);
  const bundle=await exportFrame(kit.example);assert.equal(bundle.screen.schema,'exui-screen/5');assert.equal(designSignature(kit.library),master);
  assert.equal(bundle.screen.elements.find(e=>e.kind==='slider')!.native!.thumbType,'ellipse');
  assert.equal(bundle.screen.elements.find(e=>e.kind==='value')!.text,'42%');
  assert.equal(bundle.screen.elements.find(e=>e.kind==='label')!.text,profile==='tlp-pro-1025m'?'Hall / AV Control':'Room control');
  for(const button of bundle.screen.elements.filter(e=>e.kind==='button'))assert.ok(button.states!.every(s=>s.text===''&&s.image));
  assert.ok(Object.keys(unzipSync(packageExui(bundle))).length>2);
  const ids=bundle.screen.elements.map(e=>[e.key,e.objectId,e.controlId]);
  kit.example.children[1].x+=1;const again=recognize(kit.example,profile);assert.deepEqual(again.errors,[]);assert.equal(again.writes.length,0);applyRecognition(again);
  assert.deepEqual(capture(kit.example).screen.elements.map(e=>[e.key,e.objectId,e.controlId]),ids);
  assert.ok(kit.components.every(n=>!n.getPluginData(DATA_KEY)));
  const project=recognize(kit.templates[0],profile);assert.deepEqual(project.errors,[]);
});

test('Repeated fresh instances preserve service names and get distinct stable keys and IDs',async()=>{
  const fake=kitFixture(),kit=await createKit('tlp-pro-300m-portrait');
  for(const child of [...kit.example.children])child.remove();
  const master=kit.components.find(n=>n.name==='button_Button')!;
  for(let i=0;i<3;i++){const instance=master.createInstance();kit.example.appendChild(instance);instance.x=10;instance.y=i*100;}
  let plan=recognize(kit.example,'tlp-pro-300m-portrait');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const first=capture(kit.example).screen.elements;assert.deepEqual(first.map(e=>e.key),['home.button','home.button-2','home.button-3']);
  assert.equal(new Set(first.map(e=>e.controlId)).size,3);assert.ok(kit.example.children.every(n=>n.name==='button_Button'));
  // Place a fresh instance before existing ones: the saved suffixes must stay reserved.
  const extra=master.createInstance();kit.example.appendChild(extra);extra.x=10;extra.y=300;
  (kit.example.children as any).unshift((kit.example.children as any).pop());
  plan=recognize(kit.example,'tlp-pro-300m-portrait');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  assert.equal(capture(kit.example).screen.elements[0].key,'home.button-4');
  assert.deepEqual(capture(kit.example).screen.elements.slice(1).map(e=>[e.key,e.controlId]),first.map(e=>[e.key,e.controlId]));
});

test('Custom slot layers are rasterized; native text wrappers and invalid external structure remain validated',async()=>{
  const fake=kitFixture(),kit=await createKit('tlp-pro-300m-portrait'),button=kit.example.children.find(n=>n.name==='feedbackbutton_Music') as FrameNode;
  const art=(button.children[0] as FrameNode).children[0] as FrameNode,design=fake.api.createFrame();design.name='My arbitrary design';design.cornerRadius=12;design.effects=[{type:'DROP_SHADOW'}];design.resize(220,64);art.appendChild(design as never);
  let plan=recognize(kit.example,'tlp-pro-300m-portrait');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const before=designSignature(kit.example);await exportFrame(kit.example);assert.equal(designSignature(kit.example),before);
  const value=kit.example.children.find(n=>n.name==='value_VolumeValue') as FrameNode;
  (value.children[0] as TextNode).x=1;assert.throws(()=>capture(kit.example),/Content/);
  (value.children[0] as TextNode).x=0;button.cornerRadius=8;assert.throws(()=>capture(kit.example),/скругление/);
});

test('Creation failure removes only new kit content and restores the user selection',async()=>{
  const fake=kitFixture(),existing=fake.api.createFrame();existing.name='User design';fake.page.selection=[existing];
  (fake.api as any).createComponent=()=>{throw new Error('Slots unavailable in host');};
  await assert.rejects(()=>createKit('tlp-pro-1025m'),/Slots unavailable/);
  assert.deepEqual(fake.page.children,[existing]);assert.deepEqual(fake.page.selection,[existing]);
});

test('Every generated control has an exportable contract, including multilevel and native primitives',async()=>{
 const fake=kitFixture(),kit=await createKit('tlp-pro-300m-portrait');
 for(const master of kit.components.filter(n=>n.name!=='popupref_Popup')){
  for(const child of [...kit.example.children])child.remove();
  const instance=master.createInstance();kit.example.appendChild(instance);instance.x=0;instance.y=0;
  const plan=recognize(kit.example,'tlp-pro-300m-portrait');assert.deepEqual(plan.errors,[],master.name);applyRecognition(plan);
  const bundle=await exportFrame(kit.example);assert.ok(packageExui(bundle).length>0,master.name);
  // This loop starts a fresh screen assignment for each independent component.
  kit.example.setPluginData(DATA_KEY,'');kit.example.setPluginData('exui-id-registry','');
 }
});
