import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { frame,projectFixture } from './expanded-fixture.ts';
import { tag } from '../src/demo.ts';
import { DATA_KEY } from '../src/model.ts';
import { designSignature } from '../src/export.ts';

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
function plugin(){const f=fakeFigma();vm.runInNewContext(source,{figma:f.api,Uint8Array,console});return{...f,send:f.api.ui.onmessage as (m:unknown)=>Promise<void>};}
const cases=[['pop','popup'],['popup','popup'],['mdl','popup'],['modalpopup','popup'],['pgrp','popup-group'],['popupgroup','popup-group'],['pr','popup-ref'],['popupref','popup-ref']] as const;

for(const [prefix,kind] of cases)for(const assigned of [false,true])test(`${prefix}: standalone popup actions are unavailable ${assigned?'with saved metadata':'before recognition'}, including panel-sized frames`,async()=>{
  const p=plugin(),node=frame(null,prefix+'_AudioControls',0,0,1280,800);
  if(assigned){node.name='AudioControls';tag(node,{kind,key:'test.audio',objectId:101});}
  const before=designSignature(node);p.page.selection=[node as never];p.emit('selectionchange');
  const message=p.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal(message.selectionKind,kind);assert.equal(message.canPrepare,false);assert.equal(message.canRecognize,false);
  assert.equal(message.scope,undefined,'a panel-sized popup must not become an export screen');
  assert.equal(designSignature(node),before,'selection must not save assignments');
  for(const type of ['prepare','recognize','check','export']){
    await p.send({type,profile:'tlp-pro-1025m'});
    assert.equal(p.messages.filter(m=>m.type==='error').length,['prepare','recognize','check','export'].indexOf(type)+1);
    assert.equal(designSignature(node),before,`${type} must not turn a popup into a page`);
  }
  assert.equal(p.messages.some(m=>m.type==='bundle'||m.type==='recognition'),false);
});

test('Selecting a popup inside an unsaved project keeps project export available and blocks screen-only actions',async()=>{
  const p=plugin(),root=projectFixture(),popup=root.children.find(n=>n.name==='modalpopup_Confirm')!;
  const before=designSignature(root);p.page.selection=[popup as never];p.emit('selectionchange');
  const message=p.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal(message.canPrepare,false);assert.equal(message.canRecognize,false);
  assert.equal((message.scope as any)?.id,root.id);assert.equal((message.scope as any)?.kind,'project');
  assert.equal(designSignature(root),before);
  await p.send({type:'check',profile:'tlp-pro-1025m'});
  assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);
  assert.equal(JSON.parse(popup.getPluginData(DATA_KEY)).kind,'popup');
});

test('Returning to an ordinary screen re-enables preparation and recognition; saved assignment overrides prefix',async()=>{
  const p=plugin(),popup=frame(null,'popup_Audio',0,0,940,670),screen=frame(null,'screen_Main',0,0,1280,800);
  p.page.selection=[popup as never];p.emit('selectionchange');
  p.page.selection=[screen as never];p.emit('selectionchange');
  let message=p.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal(message.canPrepare,true);assert.equal(message.canRecognize,true);
  await p.send({type:'prepare',profile:'tlp-pro-1025m'});
  assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);
  screen.name='popup_ExistingPage';p.emit('selectionchange');
  message=p.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal(message.selectionKind,'page');assert.equal(message.canRecognize,true);assert.equal(message.canPrepare,false);
});
