import test from 'node:test';
import assert from 'node:assert/strict';
import { kitFixture,png } from './kit-fixture.ts';
import { manyAssetsFixture } from './many-assets-fixture.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { exportFrame } from '../src/export.ts';
import { packageExui } from '../src/package.ts';
import { unzipSync,strFromU8 } from 'fflate';

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)
for(const project of [false,true])test(`${profile} ${project?'project':'screen'}: all ${profile==='tlp-pro-1025m'?36:18} Artwork PNGs survive export and ZIP`,async()=>{
  kitFixture();const root=await manyAssetsFixture(profile,project),plan=recognize(root,profile);
  assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(root),expected=profile==='tlp-pro-1025m'?36:18;
  assert.equal(bundle.screen.schema,'exui-screen/5');assert.equal(bundle.resources.length,expected);
  const files=unzipSync(packageExui(bundle)),manifest=JSON.parse(strFromU8(files['manifest.json']));
  assert.equal(manifest.resources.length,expected);assert.equal(Object.keys(files).length,expected+2);
  for(const resource of manifest.resources)assert.ok(files[resource.path]);
  const legacy=structuredClone(bundle);legacy.screen.schema='exui-screen/4';assert.throws(()=>packageExui(legacy),(e:any)=>e.code==='package');
  const duplicate=structuredClone(bundle);duplicate.resources.push(duplicate.resources[0]);assert.throws(()=>packageExui(duplicate),/Повтор/);
  // Size protections apply equally to packages with more than 16 resources.
  const oversized=structuredClone(bundle);oversized.resources[0].bytes=new Uint8Array(4*1024*1024+1);
  assert.throws(()=>packageExui(oversized),(e:any)=>e.code==='package-image');
  const total=structuredClone(bundle);
  for(const resource of total.resources.slice(0,5)){
    const bytes=new Uint8Array(4*1024*1024);bytes.set(resource.bytes);resource.bytes=bytes;
  }
  assert.throws(()=>packageExui(total),(e:any)=>e.code==='package-size');
});

test('PNG export stops as soon as unique rendered assets exceed the package byte budget',async()=>{
  const fake=kitFixture(),root=await manyAssetsFixture(),plan=recognize(root,'tlp-pro-1025m');
  assert.deepEqual(plan.errors,[]);applyRecognition(plan);let rendered=0;
  fake.setRenderHook(node=>{
    rendered++;const bytes=new Uint8Array(4*1024*1024);bytes.set(png(Math.round(node.width),Math.round(node.height)));
    node.fills=[{type:'IMAGE',imageHash:fake.api.createImage(bytes).hash,scaleMode:'FILL'}];
  });
  await assert.rejects(()=>exportFrame(root),(e:any)=>e.code==='package-size');
  assert.equal(rendered,5);
});
