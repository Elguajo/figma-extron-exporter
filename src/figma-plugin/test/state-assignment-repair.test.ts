import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFigma } from './fake-figma.ts';
import { namedFixture } from './named-fixture.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';
import { capture, designSignature } from '../src/export.ts';
import { DATA_KEY, readMetadata } from '../src/model.ts';

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)for(const names of [
  ['Off','On'],['Normal','Pressed'],['Normal','Active','Pressed'],
] as const)test(`${profile}: ${names.join('/')} repairs stale roles, names and IDs transactionally and stays stable`,async()=>{
  fakeFigma();const root=await namedFixture(profile,names.length===2),button=root.children[0] as FrameNode;
  button.children.forEach((state,i)=>state.name=names[i]);
  applyRecognition(recognize(root,profile));
  const identity=button.getPluginData(DATA_KEY),layers=button.children.map(s=>[s.id,s.name,s.x,s.y,s.width,s.height,s.visible]);
  for(const state of button.children){
    const metadata=readMetadata(state)!;
    state.setPluginData(DATA_KEY,JSON.stringify({...metadata,schema:'exui-node/2',role:'feedback',stateId:7,stateName:'Passive'}));
  }
  assert.throws(()=>capture(root));
  const invalid=designSignature(root),plan=recognize(root,profile);
  assert.deepEqual(plan.errors,[]);assert.equal(designSignature(root),invalid);
  applyRecognition(plan);
  assert.equal(button.getPluginData(DATA_KEY),identity);
  assert.deepEqual(button.children.map(s=>[s.id,s.name,s.x,s.y,s.width,s.height,s.visible]),layers);
  const states=capture(root).screen.elements[0].states!;
  assert.deepEqual(states.map(s=>[s.name,s.role,s.stateId]),names.map((name,i)=>[name,i===0?'normal':name==='Pressed'?'pressed':'feedback',i]));
  assert.deepEqual(recognize(root,profile).writes,[]);
});

test('Recognizing renamed Off/On layers swaps stale roles without swapping artwork or button identity',async()=>{
  fakeFigma();const root=await namedFixture('tlp-pro-1025m',true),button=root.children[0] as FrameNode;
  applyRecognition(recognize(root,'tlp-pro-1025m'));
  const identity=button.getPluginData(DATA_KEY),contents=button.children.map(state=>state.children.map(n=>n.id));
  button.children[0].name='On';button.children[1].name='Off';
  const before=designSignature(root),plan=recognize(root,'tlp-pro-1025m');
  assert.deepEqual(plan.errors,[]);assert.equal(designSignature(root),before);applyRecognition(plan);
  assert.deepEqual(button.children.map(s=>[readMetadata(s)!.stateName,readMetadata(s)!.role,readMetadata(s)!.stateId]),[['On','feedback',1],['Off','normal',0]]);
  assert.deepEqual(button.children.map(state=>state.children.map(n=>n.id)),contents);
  assert.equal(button.getPluginData(DATA_KEY),identity);assert.deepEqual(recognize(root,'tlp-pro-1025m').writes,[]);
});

test('Repairing a momentary state preserves its valid saved slot 1',async()=>{
  fakeFigma();const root=await namedFixture('tlp-pro-1025m',true),button=root.children[0] as FrameNode;
  button.children[0].name='Normal';button.children[1].name='Pressed';
  applyRecognition(recognize(root,'tlp-pro-1025m'));
  const pressed=button.children[1],metadata=readMetadata(pressed)!;
  pressed.setPluginData(DATA_KEY,JSON.stringify({...metadata,schema:'exui-node/2',role:'feedback',stateId:1,stateName:'On'}));
  const plan=recognize(root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  assert.equal(readMetadata(pressed)!.stateId,1);assert.equal(readMetadata(pressed)!.role,'pressed');
  assert.deepEqual(capture(root).screen.elements[0].states!.map(s=>[s.name,s.stateId]),[['Normal',0],['Pressed',1]]);
});

test('Legacy state metadata and custom feedback names retain their saved contract',async()=>{
  fakeFigma();const root=await namedFixture(),button=root.children[0] as FrameNode;
  applyRecognition(recognize(root,'tlp-pro-1025m'));
  const {buttonMode,...legacy}=readMetadata(button)!;
  button.setPluginData(DATA_KEY,JSON.stringify({...legacy,schema:'exui-node/2'}));
  const active=button.children[1],metadata=readMetadata(active)!;
  active.setPluginData(DATA_KEY,JSON.stringify({...metadata,stateName:'Ready'}));
  const states=button.children.map(s=>s.getPluginData(DATA_KEY)),plan=recognize(root,'tlp-pro-1025m');
  assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  assert.deepEqual(button.children.map(s=>s.getPluginData(DATA_KEY)),states);
  assert.deepEqual(capture(root).screen.elements[0].states!.map(s=>s.name),['Normal','Ready','Pressed']);
});

test('Ambiguous state names reject the plan without persisting guessed roles',async()=>{
  fakeFigma();const root=await namedFixture('tlp-pro-1025m',true),button=root.children[0] as FrameNode;
  applyRecognition(recognize(root,'tlp-pro-1025m'));button.children[1].name='Off';
  const before=designSignature(root),plan=recognize(root,'tlp-pro-1025m');
  assert.ok(plan.errors.length);assert.throws(()=>applyRecognition(plan));assert.equal(designSignature(root),before);
});

test('A failed state repair write restores all original metadata and the registry',async()=>{
  fakeFigma();const root=await namedFixture('tlp-pro-1025m',true),button=root.children[0] as FrameNode;
  applyRecognition(recognize(root,'tlp-pro-1025m'));
  for(const state of button.children){const m=readMetadata(state)!;state.setPluginData(DATA_KEY,JSON.stringify({...m,stateName:'Passive'}));}
  const before=designSignature(root),plan=recognize(root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);
  const state=button.children[1],write=state.setPluginData.bind(state);let failOnce=true;
  state.setPluginData=(key,value)=>{if(key===DATA_KEY&&failOnce){failOnce=false;throw new Error('write denied');}write(key,value);};
  assert.throws(()=>applyRecognition(plan),/write denied/);assert.equal(designSignature(root),before);
});
