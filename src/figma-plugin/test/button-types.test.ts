import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { fakeFigma } from './fake-figma.ts';
import { namedFixture } from './named-fixture.ts';
import { recognize, applyRecognition, namedControl } from '../src/recognize.ts';
import { capture, designSignature } from '../src/export.ts';
import { DATA_KEY, readMetadata } from '../src/model.ts';

for(const [two,mode,names,roles] of [[true,'on-off',['Off','On'],['normal','feedback']],[false,'feedback',['Normal','Active','Pressed'],['normal','feedback','pressed']]] as const) {
  test(`New ${mode} button: explicit metadata/3, fixed states and stable identity after rename`,async()=>{
    fakeFigma();const root=await namedFixture('tlp-pro-1025m',two);
    const plan=recognize(root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);assert.equal(plan.rows.find(r=>r.kind==='button')?.buttonMode,mode);
    applyRecognition(plan);const button=root.children[0];const saved=button.getPluginData(DATA_KEY);
    assert.equal(readMetadata(button)?.schema,'exui-node/3');assert.equal(readMetadata(button)?.buttonMode,mode);
    const first=capture(root).screen;assert.ok('elements' in first);
    assert.deepEqual(first.elements[0].states!.map(s=>s.name),names);assert.deepEqual(first.elements[0].states!.map(s=>s.role),roles);
    assert.equal(first.elements[0].press,two?undefined:'Pressed');
    button.name=two?'feedbackbutton_Renamed':'button_Renamed';
    const next=recognize(root,'tlp-pro-1025m');assert.deepEqual(next.errors,[]);applyRecognition(next);
    assert.equal(button.getPluginData(DATA_KEY),saved);
    const second=capture(root).screen;assert.ok('elements' in second);
    assert.deepEqual([second.elements[0].objectId,second.elements[0].controlId],[first.elements[0].objectId,first.elements[0].controlId]);
  });
}

for(const [name,two,edit] of [
  ['ordinary cannot acquire Pressed',false,(b:FrameNode)=>{b.name='button_Music';}],
  ['ordinary requires On, not Active',true,(b:FrameNode)=>{b.children[1].name='Active';}],
  ['ordinary requires Off, not Normal',true,(b:FrameNode)=>{b.children[0].name='Normal';}],
  ['feedback requires Pressed',false,(b:FrameNode)=>{b.children[2].remove();}],
  ['feedback requires Active, not On',false,(b:FrameNode)=>{b.children[1].name='On';}],
  ['feedback cannot silently use only Off/On',true,(b:FrameNode)=>{b.name='fbtn_Music';}],
] as const)test(`Button contract: ${name}, no writes`,async()=>{
  fakeFigma();const root=await namedFixture('tlp-pro-1025m',two);edit(root.children[0] as FrameNode);
  const before=designSignature(root),plan=recognize(root,'tlp-pro-1025m');
  assert.ok(plan.errors.some(e=>e.includes('ровно')));assert.throws(()=>applyRecognition(plan));assert.equal(designSignature(root),before);
});

test('State prefixes/case are accepted; raw Figma layers are preserved',async()=>{
  fakeFigma();const root=await namedFixture();const button=root.children[0] as FrameNode;
  button.name='FEEDBACKBUTTON_Music';button.children.forEach((s,i)=>s.name=['st_Normal','STATE_Active','pressed'][i]);
  const names=button.children.map(s=>s.name);applyRecognition(recognize(root,'tlp-pro-1025m'));
  assert.deepEqual(button.children.map(s=>s.name),names);assert.equal(readMetadata(button)?.buttonMode,'feedback');
  assert.deepEqual(namedControl('fbtn_Music'),namedControl('feedbackbutton_music'));
});

test('Saved type is enforced during export, not only during recognition',async()=>{
  fakeFigma();const root=await namedFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));
  const button=root.children[0] as FrameNode,active=button.children[1];
  const raw=JSON.parse(active.getPluginData(DATA_KEY));active.setPluginData(DATA_KEY,JSON.stringify({...raw,stateName:'On'}));
  assert.throws(()=>capture(root),(e:any)=>e.code==='button-states');
});

test('Malformed metadata/3 cannot lose buttonMode or downgrade silently',async()=>{
  fakeFigma();const root=await namedFixture('tlp-pro-1025m',true);applyRecognition(recognize(root,'tlp-pro-1025m'));
  const button=root.children[0],raw=JSON.parse(button.getPluginData(DATA_KEY));
  for(const bad of [{...raw,buttonMode:undefined},{...raw,buttonMode:'auto'},{...raw,schema:'exui-node/2'},{...raw,kind:'label'}]){
    button.setPluginData(DATA_KEY,JSON.stringify(bad));assert.throws(()=>readMetadata(button),(e:any)=>e.code==='metadata');
  }
});

test('Plugin 0.2.1 refuses new metadata/3 instead of ignoring the type',async()=>{
  const fixture=fakeFigma();const root=await namedFixture('tlp-pro-1025m',true);applyRecognition(recognize(root,'tlp-pro-1025m'));
  fixture.page.selection=[root as any];
  const zip=unzipSync(new Uint8Array(readFileSync(new URL('../../../releases/figma-plugin/0.2.1/figma-extron-plugin-0.2.1.zip',import.meta.url))));
  vm.runInNewContext(strFromU8(zip['dist/code.js']),{figma:fixture.api,Uint8Array,console});
  await (fixture.api.ui.onmessage as any)({type:'export'});
  assert.equal(fixture.messages.find(m=>m.type==='error')?.code,'metadata');assert.equal(fixture.messages.some(m=>m.type==='bundle'),false);
});
