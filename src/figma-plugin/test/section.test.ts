import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFigma,icons } from './fake-figma.ts';
import { sectionFixture,projectFixture } from './expanded-fixture.ts';
import { recognize,applyRecognition,REGISTRY_KEY } from '../src/recognize.ts';
import { capture,designSignature,exportFrame } from '../src/export.ts';
import { readMetadata,DATA_KEY } from '../src/model.ts';
import { packageExui } from '../src/package.ts';
import { tag,createDemo } from '../src/demo.ts';

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
 test(`Section ${profile}: Unicode name, pages, popups and group retain the Frame project contract`,async()=>{
  fakeFigma();const section=sectionFixture(profile),before=designSignature(section),plan=recognize(section,profile);
  assert.deepEqual(plan.errors,[]);assert.equal(designSignature(section),before);applyRecognition(plan);
  const bundle=await exportFrame(section),screen=bundle.screen;assert.ok('pages' in screen);
  assert.equal(screen.schema,'exui-screen/5');assert.equal(screen.project.name,section.name);
  assert.equal(screen.pages.length,2);assert.equal(screen.popups.length,4);assert.equal(screen.groups.length,1);
  assert.equal(screen.pages.filter(p=>p.shownBy==='start').length,1);
  assert.deepEqual(screen.pages[0].elements[0].rect,[20,20,260,32]);assert.ok(packageExui(bundle).length>500);
  const stored=section.children.map(n=>[n.id,n.getPluginData(DATA_KEY)]).sort(),registry=section.getPluginData(REGISTRY_KEY);
  section.name='Новый заголовок';(section.children as SceneNode[]).reverse();applyRecognition(recognize(section,profile));
  assert.deepEqual(section.children.map(n=>[n.id,n.getPluginData(DATA_KEY)]).sort(),stored);assert.equal(section.getPluginData(REGISTRY_KEY),registry);
 });
 test(`Section ${profile}: existing page IDs and hidden PNG states survive moving into a section`,async()=>{
  fakeFigma();const page=await createDemo(profile,icons()),before=page.children.map(n=>n.getPluginData(DATA_KEY));
  const section=figma.createSection();section.name='AV';section.appendChild(page);applyRecognition(recognize(section,profile));
  const bundle=await exportFrame(section);assert.ok('pages' in bundle.screen);assert.equal(bundle.resources.length,2);
  assert.deepEqual(page.children.map(n=>n.getPluginData(DATA_KEY)),before);
 });
}

test('Section reviewed plan is invalidated by child edits; failed writes roll back the root and registry',()=>{
 fakeFigma();const section=sectionFixture(),plan=recognize(section,'tlp-pro-1025m');section.children[1].name='screen_Other';
 assert.throws(()=>applyRecognition(plan),(e:any)=>e.code==='design-changed');
 const next=recognize(section,'tlp-pro-1025m'),before=designSignature(section),node=section.children[1],original=node.setPluginData.bind(node);let once=true;
 node.setPluginData=(k,v)=>{if(once&&v){once=false;throw new Error('write failure');}original(k,v);};
 assert.throws(()=>applyRecognition(next),/write failure/);assert.equal(designSignature(section),before);
});

test('Section cannot hide duplicate control IDs, invalid children, copied ownership or a wrong profile',()=>{
 const fake=fakeFigma();const section=sectionFixture();applyRecognition(recognize(section,'tlp-pro-1025m'));
 assert.throws(()=>recognize(section,'tlp-pro-300m-portrait'),(e:any)=>e.code==='profile');
 assert.throws(()=>capture(section.clone()),(e:any)=>e.code==='copied-node');
 const home=section.children[0] as FrameNode,control=home.children[0],other=home.children[1],m=readMetadata(other)!;
 tag(other,{...m,controlId:readMetadata(control)!.controlId});assert.throws(()=>capture(section),(e:any)=>e.code==='duplicate-id');tag(other,m);
 const nested=fake.api.createSection();section.appendChild(nested as never);const before=designSignature(section),plan=recognize(section,'tlp-pro-1025m');
 assert.ok(plan.errors.some(e=>e.includes('Frame')));assert.throws(()=>applyRecognition(plan));assert.equal(designSignature(section),before);
});

test('An existing Frame project and its registry remain byte-for-byte compatible',()=>{
 fakeFigma();const root=projectFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));const before=designSignature(root),screen=capture(root).screen;
 applyRecognition(recognize(root,'tlp-pro-1025m'));assert.equal(designSignature(root),before);assert.deepEqual(capture(root).screen,screen);
});

test('Section names that resemble element prefixes never change scanning or reserved IDs',()=>{
 for(const name of ['button_Мой проект','image_Trilliant','slider_AV']){
  fakeFigma();const section=sectionFixture();section.name=name;
  const plan=recognize(section,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const screen=capture(section).screen;assert.ok('pages' in screen);assert.equal(screen.project.name,name);
  const ids=[...screen.pages,...screen.popups].flatMap(c=>c.elements).filter(e=>e.controlId!==null).map(e=>e.controlId);
  assert.equal(new Set(ids).size,ids.length);
 }
});
