import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { authorButtons } from './button-preparation-fixture.ts';
import { prepareButtons, type ButtonStatePair } from '../src/button-preparation.ts';
import { background } from '../src/button-artwork.ts';
import { applyRecognition, recognize } from '../src/recognize.ts';
import { capture, designSignature, exportFrame } from '../src/export.ts';
import { DATA_KEY, readMetadata } from '../src/model.ts';
import { namedFixture } from './named-fixture.ts';

for (const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const) for (const statePair of ['off-on','normal-pressed'] as const) {
  test(`${profile}: chosen ${statePair} creates styled states and exports the correct press behavior`, async()=>{
    const f=authorButtons(profile),before=f.buttons.map(b=>[b.id,b.x,b.y,b.width,b.height]);
    assert.deepEqual(prepareButtons(f.root,{},'apply-new',true,{enabled:false},statePair),{buttons:2,states:4,skipped:0});
    const expected=statePair==='off-on'?['Off','On']:['Normal','Pressed'];
    assert.deepEqual(f.buttons[0].children.map(s=>s.name),expected);
    assert.deepEqual(f.buttons[1].children.map(s=>s.name),['Normal','Active']);
    assert.deepEqual(f.buttons.map(b=>[b.id,b.x,b.y,b.width,b.height]),before);
    for (const b of f.buttons) {
      assert.deepEqual(background(b.children[0]).fills,f.normal.fills);
      assert.deepEqual(background(b.children[1]).fills,f.active.fills);
      assert.deepEqual(b.children.map(s=>s.visible),[true,false]);
    }
    const plan=recognize(f.root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
    const bundle=await exportFrame(f.root),button=bundle.screen.elements[0];
    assert.deepEqual(button.states!.map(s=>[s.name,s.stateId]),expected.map((n,i)=>[n,i]));
    assert.equal(button.press,statePair==='normal-pressed'?'Pressed':undefined);
  });
}

test('Override converts assigned Off/On to Normal/Pressed and back, preserving nodes, button identity and selection', async()=>{
  const f=authorButtons();prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  const b=f.buttons[0],identity=b.getPluginData(DATA_KEY),nodes=b.children.map(s=>s.id);
  const feedbackNames=f.buttons[1].children.map(s=>s.name),feedbackData=f.buttons[1].children.map(s=>s.getPluginData(DATA_KEY));
  b.children[0].visible=false;b.children[1].visible=true;
  for (const pair of ['normal-pressed','off-on','normal-pressed'] as const) {
    prepareButtons(f.root,{},'apply',false,{enabled:false},pair);
    const expected=pair==='off-on'?['Off','On']:['Normal','Pressed'];
    assert.deepEqual(b.children.map(s=>s.name),expected);assert.deepEqual(b.children.map(s=>s.id),nodes);
    assert.deepEqual(b.children.map(s=>s.visible),[false,true]);assert.equal(b.getPluginData(DATA_KEY),identity);
    assert.equal(readMetadata(b.children[1])!.role,pair==='off-on'?'feedback':'pressed');
    const bundle=await exportFrame(f.root),button=bundle.screen.elements[0];
    assert.deepEqual(button.states!.map(s=>[s.name,s.stateId]),expected.map((n,i)=>[n,i]));
    assert.equal(button.press,pair==='off-on'?undefined:'Pressed');
    const plan=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
    assert.equal(b.getPluginData(DATA_KEY),identity);
    const stable=designSignature(f.root);prepareButtons(f.root,{},'apply',false,{enabled:false},pair);assert.equal(designSignature(f.root),stable);
  }
  assert.deepEqual(f.buttons[1].children.map(s=>s.name),feedbackNames);
  assert.deepEqual(f.buttons[1].children.map(s=>s.getPluginData(DATA_KEY)),feedbackData);
});

test('Override converts a canonical saved Pressed ID 2 back to a dense Off/On pair',()=>{
  const f=authorButtons();prepareButtons(f.root,{},'apply-new',false,{},'normal-pressed');
  applyRecognition(recognize(f.root,'tlp-pro-1025m'));assert.equal(readMetadata(f.buttons[0].children[1])!.stateId,2);
  prepareButtons(f.root,{},'apply',false,{},'off-on');
  const result=capture(f.root).screen.elements[0];assert.equal(result.press,undefined);
  assert.deepEqual(result.states!.map(s=>[s.name,s.stateId,s.role]),[['Off',0,'normal'],['On',1,'feedback']]);
});

test('Override of native Frame states updates schema/1 roles without losing editable text or icons',async()=>{
  const f=authorButtons();f.normal.strokes=[];f.active.strokes=[];
  const root=await namedFixture('tlp-pro-1025m',true);
  applyRecognition(recognize(root,'tlp-pro-1025m'));
  const before=capture(root).screen.elements.filter(e=>e.kind==='button').map(e=>({id:e.controlId,texts:e.states!.map(s=>s.text),images:e.states!.map(s=>s.image)}));
  assert.equal(readMetadata((root.children[0] as FrameNode).children[1])!.schema,'exui-node/1');
  for(const pair of ['normal-pressed','off-on'] as const) {
    prepareButtons(root,{},'apply',false,{enabled:false},pair);
    const buttons=capture(root).screen.elements.filter(e=>e.kind==='button');
    assert.deepEqual(buttons.map(e=>({id:e.controlId,texts:e.states!.map(s=>s.text),images:e.states!.map(s=>s.image)})),before);
    assert.ok(buttons.every(e=>e.press===(pair==='normal-pressed'?'Pressed':undefined)));
    assert.deepEqual(recognize(root,'tlp-pro-1025m').errors,[]);
  }
});

test('Skip leaves assigned ready Off/On intact while creating Normal/Pressed for a fresh button',()=>{
  const f=authorButtons();prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  const ready=designSignature(f.buttons[0]),raw=f.buttons[0].clone();f.root.appendChild(raw);raw.name='button_New';
  raw.setPluginData(DATA_KEY,'');const artwork=[...raw.children[0].children];raw.children[1].remove();
  for (const child of artwork)raw.appendChild(child);raw.children[0].remove();
  const result=prepareButtons(f.root,{},'apply-new',false,{},'normal-pressed');
  assert.equal(result.buttons,1);assert.equal(designSignature(f.buttons[0]),ready);
  assert.deepEqual(raw.children.map(s=>s.name),['Normal','Pressed']);
});

for (const pair of ['off-on','normal-pressed'] as const) test(`A single Normal is completed as a consistent ${pair} pair`,()=>{
  const f=authorButtons(),b=f.buttons[0];const state=f.api.group([...b.children],b);state.name='Normal';
  prepareButtons(f.root,{},'apply-new',false,{},pair);
  assert.deepEqual(b.children.map(s=>s.name),pair==='off-on'?['Off','On']:['Normal','Pressed']);
});

for (const original of ['On','Pressed']) test(`A single ${original} is completed and styled as the selected momentary pair`,()=>{
  const f=authorButtons(),b=f.buttons[0],state=f.api.group([...b.children],b);state.name=original;
  prepareButtons(f.root,{},'apply-new',false,{enabled:false},'normal-pressed');
  assert.deepEqual(b.children.map(s=>s.name),['Pressed','Normal']);
  assert.deepEqual(background(state).fills,f.active.fills);
  assert.deepEqual(background(b.children[1]).fills,f.normal.fills);
  assert.deepEqual(b.children.map(s=>s.visible),[true,false]);
});

test('A later failure rolls back converted names, roles, IDs, visibility and styling',()=>{
  const f=authorButtons();prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  const raw=f.buttons[0].clone();raw.name='button_New';raw.setPluginData(DATA_KEY,'');f.root.appendChild(raw);
  raw.children[1].remove();const state=raw.children[0];for(const child of [...state.children])raw.appendChild(child);state.remove();
  const before=designSignature(f.root),metadata=f.buttons[0].children.map(s=>s.getPluginData(DATA_KEY));
  f.api.group=()=>{throw new Error('later grouping failed');};
  assert.throws(()=>prepareButtons(f.root,{},'apply',false,{},'normal-pressed'),/later grouping failed/);
  assert.equal(designSignature(f.root),before);assert.deepEqual(f.buttons[0].children.map(s=>s.getPluginData(DATA_KEY)),metadata);
});

test('Invalid pair is rejected before writes',()=>{
  const f=authorButtons(),before=designSignature(f.root);
  assert.throws(()=>prepareButtons(f.root,{},'apply',false,{},'bad' as ButtonStatePair),/Выберите Off/);
  assert.equal(designSignature(f.root),before);
});

test('Built command passes the chosen pair through creation, Override, check and export',async()=>{
  const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
  const f=authorButtons();f.page.selection=[f.root as never];vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (message:unknown)=>Promise<void>;
  await send({type:'button-apply-styles',statePair:'off-on'});await send({type:'check'});
  const identity=f.buttons[0].getPluginData(DATA_KEY);
  await send({type:'button-apply-styles',statePair:'normal-pressed',existing:'update'});
  await send({type:'check'});await send({type:'export'});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);assert.equal(f.buttons[0].getPluginData(DATA_KEY),identity);
  const bundle=f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as {screen:{elements:{press?:string}[]}};
  assert.equal(bundle.screen.elements[0].press,'Pressed');
});
