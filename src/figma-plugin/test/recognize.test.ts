import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFigma, icons } from './fake-figma.ts';
import { createDemo } from '../src/demo.ts';
import { recognize, applyRecognition, namedControl, namedRole, REGISTRY_KEY } from '../src/recognize.ts';
import { DATA_KEY } from '../src/model.ts';
import { exportFrame, designSignature } from '../src/export.ts';
import { packageExui } from '../src/package.ts';
import { unzipSync, strFromU8 } from 'fflate';
import { namedFixture, graphicFixture } from './named-fixture.ts';

test('Short and full prefixes, camel case and Off/On aliases identify the same types',()=>{
  for(const [a,b,kind] of [['btn_Music','button_Music','button'],['lvl_HallVolume','level_HallVolume','level'],['txt_VolumeValue','text_VolumeValue','label']]) {
    assert.deepEqual(namedControl(a),namedControl(b));assert.equal(namedControl(a)!.kind,kind);
  }
  assert.equal(namedControl('Button_VolumeDown')!.suffix,'volumedown');
  assert.deepEqual(namedControl('btn_volumeup'),namedControl('button_VolumeUp'));
  assert.equal(namedRole('Off'),'normal');assert.equal(namedRole('On'),'feedback');assert.equal(namedRole('state_Pressed'),'pressed');
  assert.throws(()=>namedControl('btn_Музыка'));assert.equal(namedControl('Music'),null);
});
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)for(const two of [false,true])
test(`Named ${profile}, ${two?2:3} states: dry run → commit → valid package with stable IDs`,async()=>{
  fakeFigma();const root=await namedFixture(profile,two),before=designSignature(root);
  const plan=recognize(root,profile);assert.deepEqual(plan.errors,[]);assert.equal(designSignature(root),before);assert.equal(root.getPluginData(REGISTRY_KEY),'');
  assert.equal(plan.rows.find(r=>r.name===(two?'btn_Music':'fbtn_Music'))!.key,'home.music');
  applyRecognition(plan);const result=await exportFrame(root);
  assert.equal(result.screen.elements.filter(e=>e.kind==='button').every(e=>e.states!.length===(two?2:3)),true);
  const files=unzipSync(packageExui(result));assert.equal(JSON.parse(strFromU8(files['manifest.json'])).schema,'exui/5');
  assert.equal(result.screen.elements[0].press,two?undefined:'Pressed');
  assert.deepEqual(result.screen.elements[0].states!.map(s=>s.name),two?['Off','On']:['Normal','Active','Pressed']);
  const ids=result.screen.elements.map(e=>[e.key,e.objectId,e.controlId]).sort();
  root.name='Переименованный экран';root.children[0].name='Любое новое имя';
  const again=recognize(root,profile);assert.deepEqual(again.errors,[]);assert.equal(again.writes.length,0);applyRecognition(again);
  assert.deepEqual((await exportFrame(root)).screen.elements.map(e=>[e.key,e.objectId,e.controlId]).sort(),ids);
});

test('Legacy metadata is preserved byte-for-byte; new IDs skip all existing assignments',async()=>{
  const fake=fakeFigma();const root=await createDemo('tlp-pro-1025m',icons(),true);
  const originals=[root,...root.children].map(n=>[n,n.getPluginData(DATA_KEY)] as const);
  const level=fake.api.createFrame();level.name='level_Additional';level.resize(100,10);level.x=600;level.y=700;level.fills=[{type:'SOLID',color:{r:1,g:0,b:0}}];root.appendChild(level as never);
  const plan=recognize(root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  for(const [n,data] of originals)assert.equal(n.getPluginData(DATA_KEY),data);
  const metadata=JSON.parse(level.getPluginData(DATA_KEY));assert.ok(metadata.objectId>4);assert.ok(metadata.controlId>8104);
});

test('Two-state and three-state buttons coexist on one screen without invented states',async()=>{
  fakeFigma();const root=await namedFixture();const ordinary=root.children[0] as FrameNode;ordinary.name='btn_Music';ordinary.children[2].remove();ordinary.children[0].name='Off';ordinary.children[1].name='On';
  applyRecognition(recognize(root,'tlp-pro-1025m'));const bundle=await exportFrame(root);
  assert.equal(bundle.screen.schema,'exui-screen/5');
  assert.equal(bundle.screen.elements[0].states!.length,2);assert.equal(bundle.screen.elements[0].press,undefined);
  assert.equal(bundle.screen.elements[3].states!.length,3);assert.equal(bundle.screen.elements[3].press,'Pressed');
});

test('Counters survive deletion and reorder; deleted auto IDs are not reused',async()=>{
  const fake=fakeFigma();const root=await namedFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));
  const old=JSON.parse(root.children[3].getPluginData(DATA_KEY));root.children[3].remove();
  const level=fake.api.createFrame();level.name='lvl_New';level.resize(40,10);level.x=900;level.y=700;level.fills=[{type:'SOLID',color:{r:1,g:0,b:0}}];root.appendChild(level as never);
  (root.children as any).reverse();applyRecognition(recognize(root,'tlp-pro-1025m'));
  const current=JSON.parse(level.getPluginData(DATA_KEY));assert.ok(current.objectId>old.objectId);assert.ok(current.controlId>old.controlId);
});

for(const [name,edit] of [
  ['duplicate semantic key',(root:any)=>root.children[3].name='button_Music'],
  ['unknown screen child',(root:any)=>root.children[2].name='Volume'],
  ['missing On',(root:any)=>root.children[0].children[1].name='Other'],
  ['both Off and Normal',(root:any)=>root.children[0].children[1].name='Normal'],
  ['unsupported rounded appearance',(root:any)=>root.children[2].cornerRadius=5],
] as const)test(`Recognition blocks ${name} without any writes`,async()=>{
  fakeFigma();const root=await namedFixture();edit(root);const before=designSignature(root);const plan=recognize(root,'tlp-pro-1025m');
  assert.ok(plan.errors.length);assert.throws(()=>applyRecognition(plan));assert.equal(designSignature(root),before);assert.equal(root.getPluginData(REGISTRY_KEY),'');
});

test('Changed geometry, metadata or registry invalidates a reviewed plan',async()=>{
  for(const edit of [(r:any)=>r.children[0].x++,(r:any)=>r.setPluginData(REGISTRY_KEY,'changed'),(r:any)=>r.children[0].setPluginData(DATA_KEY,'changed')]) {
    fakeFigma();const root=await namedFixture(),plan=recognize(root,'tlp-pro-1025m');edit(root);
    assert.throws(()=>applyRecognition(plan),(e:any)=>e.code==='design-changed');
  }
});

test('Failed write restores the original metadata and registry',async()=>{
  fakeFigma();const root=await namedFixture(),plan=recognize(root,'tlp-pro-1025m'),before=designSignature(root);
  const child=root.children[1],original=child.setPluginData.bind(child);let failed=false;
  child.setPluginData=(k,v)=>{if(!failed&&v){failed=true;throw new Error('Write failed');}original(k,v);};
  assert.throws(()=>applyRecognition(plan),/Write failed/);assert.equal(designSignature(root),before);assert.equal(root.getPluginData(REGISTRY_KEY),'');
});

test('Corrupt registry, exhausted IDs, copied nodes and wrong profiles fail safely',async()=>{
  fakeFigma();const root=await namedFixture();root.setPluginData(REGISTRY_KEY,'{"schema":"future"}');assert.throws(()=>recognize(root,'tlp-pro-1025m'));
  root.setPluginData(REGISTRY_KEY,JSON.stringify({schema:'exui-id-registry/1',ownerNodeId:root.id,nextObjectId:1000001,nextControlId:65536}));
  const exhausted=recognize(root,'tlp-pro-1025m');assert.ok(exhausted.errors.length);assert.throws(()=>applyRecognition(exhausted));
  root.setPluginData(REGISTRY_KEY,'');assert.throws(()=>recognize(root,'tlp-pro-300m-portrait'));
  applyRecognition(recognize(root,'tlp-pro-1025m'));const copy=root.clone();assert.throws(()=>recognize(copy,'tlp-pro-1025m'),(e:any)=>e.code==='copied-node');
});

test('Partial restoration failure is reported and keeps IDs reserved',async()=>{
  fakeFigma();const root=await namedFixture(),plan=recognize(root,'tlp-pro-1025m');
  const child=root.children[1],original=child.setPluginData.bind(child);let blocked=false;
  child.setPluginData=(k,v)=>{if(blocked)throw new Error('Restore denied');original(k,v);if(v){blocked=true;throw new Error('Interrupted write');}};
  assert.throws(()=>applyRecognition(plan),(e:any)=>e.code==='recognition-rollback');
  assert.equal(root.getPluginData(REGISTRY_KEY),plan.registry);
  assert.equal(root.getPluginData(DATA_KEY),'');assert.equal(root.children[0].getPluginData(DATA_KEY),'');
});

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)test(`Graphics and Normal/Pressed on ${profile}: PNG, passive ID and dense momentary states`,async()=>{
  fakeFigma();const root=await graphicFixture(profile);const plan=recognize(root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(root);assert.equal(bundle.screen.schema,'exui-screen/4');
  const graphic=bundle.screen.elements.find(e=>e.kind==='graphic')!;assert.equal(graphic.controlId,null);assert.ok(graphic.image);
  const momentary=bundle.screen.elements[0];assert.deepEqual(momentary.states!.map(s=>[s.role,s.stateId]),[['normal',0],['pressed',1]]);assert.equal(momentary.press,'Pressed');
  assert.equal(momentary.states![1].fill,'#FFCC00');
  assert.deepEqual((bundle.screen.elements[3].states??[]).map(s=>s.role),['normal','feedback','pressed']);
  const files=unzipSync(packageExui(bundle));assert.equal(JSON.parse(strFromU8(files['manifest.json'])).schema,'exui/4');
  const oldKeys=root.children.map(n=>n.getPluginData(DATA_KEY));root.children[0].name='btn_volumeup';
  const again=recognize(root,profile);assert.deepEqual(again.errors,[]);applyRecognition(again);assert.deepEqual(root.children.map(n=>n.getPluginData(DATA_KEY)),oldKeys);
});

test('Logo, img and image are equivalent static graphics; capitalization is ignored',()=>{
  for(const prefix of ['logo','img','image'])assert.deepEqual(namedControl(prefix+'_Company'),{kind:'graphic',suffix:'company'});
  assert.deepEqual(namedControl('text_VolumeValue'),namedControl('TXT_volumevalue'));
});

test('Case-only duplicate names are rejected even against previously stored CamelCase keys',async()=>{
  const fake=fakeFigma();const root=await graphicFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));
  // Represents a key written by the previous plugin normalization.
  const first=root.children[0],m=JSON.parse(first.getPluginData(DATA_KEY));m.key='home.volume-up';first.setPluginData(DATA_KEY,JSON.stringify(m));
  const other=fake.api.createFrame();other.name='btn_volumeup';root.appendChild(other as never);
  const plan=recognize(root,'tlp-pro-1025m');assert.ok(plan.errors.some(e=>e.includes('повтор имени')));assert.throws(()=>applyRecognition(plan));assert.equal(other.getPluginData(DATA_KEY),'');
});

test('Standalone graphic requires a Frame and cannot acquire a control ID or button states',async()=>{
  fakeFigma();const root=await graphicFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));const logo=root.children[4];
  const m=JSON.parse(logo.getPluginData(DATA_KEY));m.controlId=999;logo.setPluginData(DATA_KEY,JSON.stringify(m));
  await assert.rejects(exportFrame(root),(e:any)=>e.code==='id');
});
