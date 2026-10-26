import test from 'node:test';
import assert from 'node:assert/strict';
import {kitFixture} from './kit-fixture.ts';
import {createKit} from '../src/kit.ts';
import {recognize,applyRecognition} from '../src/recognize.ts';
import {exportFrame,designSignature} from '../src/export.ts';
import {packageExui} from '../src/package.ts';
import {PROFILES} from '../src/model.ts';

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)test(`Support content ${profile}: feedback, passive unavailable actions and separate compact profile survive export`,async()=>{
  kitFixture();const kit=await createKit(profile),masters=designSignature(kit.library);
  assert.deepEqual(kit.supportScreens.map(n=>n.name),['screen_SystemWaiting','screen_SourceUnavailable','screen_ConnectionLost']);
  assert.equal(kit.compactExample.parent,kit.contentBoard);
  assert.ok(!kit.supportProject.children.includes(kit.compactExample));
  const overlap=(a:SceneNode,b:SceneNode)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
  for(const screen of [...kit.supportScreens,kit.compactExample]){
    const p=screen===kit.compactExample?PROFILES['tlp-pro-300m-portrait']:PROFILES[profile];
    assert.deepEqual([screen.width,screen.height],[p.width,p.height]);
    for(const [index,node]of screen.children.entries()){
      assert.ok(node.x>=0&&node.y>=0&&node.x+node.width<=screen.width&&node.y+node.height<=screen.height,screen.name+'/'+node.name);
      if(/^(button_|feedbackbutton_)/.test(node.name))assert.ok(node.width>=56&&node.height>=56,node.name);
      if(node.name.startsWith('shape_'))continue;
      for(const other of screen.children.slice(index+1).filter(n=>!n.name.startsWith('shape_')))assert.equal(overlap(node,other),false,screen.name+'/'+node.name+' overlaps '+other.name);
    }
  }
  const plan=recognize(kit.supportProject,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(kit.supportProject);assert.ok(packageExui(bundle).length>0);
  assert.equal(bundle.screen.pages!.length,3);
  const elements=bundle.screen.pages!.flatMap(p=>p.elements);
  const unavailable=elements.filter(e=>e.name==='image_UnavailableAction');
  assert.equal(unavailable.length,2);assert.ok(unavailable.every(e=>e.kind==='graphic'&&e.controlId===null));
  assert.equal(elements.filter(e=>e.name==='button_Retry').length,1);
  assert.ok(elements.filter(e=>e.name==='value_Reason').every(e=>e.kind==='value'&&(e.controlId??0)>0));
  assert.ok(elements.filter(e=>e.name==='multilevel_Connection').every(e=>e.states!.length===3));
  assert.equal(new Set(elements.map(e=>e.key)).size,elements.length);
  const compactPlan=recognize(kit.compactExample,'tlp-pro-300m-portrait');assert.deepEqual(compactPlan.errors,[]);applyRecognition(compactPlan);
  const compact=await exportFrame(kit.compactExample);assert.ok(packageExui(compact).length>0);
  assert.equal(compact.screen.elements.filter(e=>e.kind==='slider').length,1);
  assert.equal(compact.screen.elements.find(e=>e.name==='value_MasterVolume')!.text,'42%');
  assert.deepEqual(compact.screen.elements.find(e=>e.name==='feedbackbutton_Music')!.states!.map(s=>s.role),['normal','feedback','pressed']);
  assert.equal(designSignature(kit.library),masters,'examples must not edit library masters');
});

test('Failure while creating new content removes only the new kit',async()=>{
  const fake=kitFixture(),existing=fake.api.createFrame(),create=fake.api.createFrame;
  fake.page.selection=[existing];
  fake.api.createFrame=()=>{const n=create();Object.defineProperty(n,'name',{configurable:true,get:()=>'',set:(name:string)=>{if(name==='screen_CompactAudio')throw Error('compact creation failed');Object.defineProperty(n,'name',{value:name,writable:true,configurable:true});}});return n;};
  await assert.rejects(()=>createKit('tlp-pro-1025m'),/compact creation failed/);
  assert.deepEqual(fake.page.children,[existing]);assert.deepEqual(fake.page.selection,[existing]);
});
