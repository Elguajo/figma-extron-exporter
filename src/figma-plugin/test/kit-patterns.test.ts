import test from 'node:test';
import assert from 'node:assert/strict';
import {kitFixture} from './kit-fixture.ts';
import {createKit} from '../src/kit.ts';
import {recognize,applyRecognition} from '../src/recognize.ts';
import {exportFrame} from '../src/export.ts';
import {packageExui} from '../src/package.ts';
import {designSignature} from '../src/export.ts';
import {DATA_KEY,PROFILES} from '../src/model.ts';
import registry from '../../../design/extron-kit/patterns.json' with {type:'json'};
import symbols from '../../../design/extron-kit/icons/icons.json' with {type:'json'};

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)test(`AV patterns ${profile}: all scenarios fit and export together with unique IDs`,async()=>{
  kitFixture();const kit=await createKit(profile),masters=designSignature(kit.library);
  assert.equal(kit.patterns.length,6);assert.equal(kit.icons.length,18);
  assert.deepEqual(kit.patterns.map(n=>n.name),registry.patterns.map(p=>p.container));
  for(const screen of kit.patterns){
    assert.equal(screen.width,PROFILES[profile].width);assert.equal(screen.height,PROFILES[profile].height);
    for(const node of screen.children){
      assert.ok(node.x>=0&&node.y>=0&&node.x+node.width<=screen.width&&node.y+node.height<=screen.height,screen.name+'/'+node.name);
      if(node.name.startsWith('button_')||node.name.startsWith('feedbackbutton_'))assert.ok(node.width>=56&&node.height>=56);
    }
  }
  const plan=recognize(kit.patternProject,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(kit.patternProject);assert.ok(packageExui(bundle).length>0);
  assert.ok('pages'in bundle.screen);assert.equal(bundle.screen.pages!.length,5);assert.equal(bundle.screen.popups!.length,1);assert.equal(bundle.screen.popups![0].modal,true);
  const all=[...bundle.screen.pages!,...bundle.screen.popups!].flatMap(p=>p.elements);
  const controls=all.filter(e=>(e.controlId??0)>0);assert.equal(new Set(controls.map(e=>e.controlId)).size,controls.length);
  assert.equal(new Set(all.map(e=>e.key)).size,all.length);
  const status=all.find(e=>e.name==='multilevel_Connection')!;
  assert.deepEqual(status.states!.map(s=>s.text),['Starting','Ready','Offline']);
  const shutdown=all.find(e=>e.name==='button_TurnOff')!;assert.deepEqual(shutdown.states!.map(s=>s.role),['normal','pressed']);
  assert.ok(all.filter(e=>e.kind==='button').every(e=>e.states!.every(s=>s.image)));
  assert.equal(designSignature(kit.library),masters);
  for(const icon of kit.icons){assert.equal(icon.width,24);assert.equal(icon.height,24);assert.equal(icon.getPluginData(DATA_KEY),'');}
  assert.ok(symbols.icons.every(i=>i.svg.includes('viewBox="0 0 24 24"')));
  const before=JSON.stringify(bundle.screen);applyRecognition(recognize(kit.patternProject,profile));assert.equal(JSON.stringify((await exportFrame(kit.patternProject)).screen),before);
});

test('SVG import failure removes extension boards and restores the previous selection',async()=>{
  const fake=kitFixture(),existing=fake.api.createFrame();fake.page.selection=[existing];
  (fake.api as any).createNodeFromSvg=()=>{throw new Error('SVG import failed');};
  await assert.rejects(()=>createKit('tlp-pro-1025m'),/SVG import failed/);
  assert.deepEqual(fake.page.children,[existing]);assert.deepEqual(fake.page.selection,[existing]);
});
