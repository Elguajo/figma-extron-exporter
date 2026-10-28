import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { authorButtons } from './button-preparation-fixture.ts';
import { prepareButtons } from '../src/button-preparation.ts';
import { BUTTON_TEXT_KEY, setButtonTextMode } from '../src/button-native-text.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';
import { capture, designSignature, exportFrame } from '../src/export.ts';
import { createKit } from '../src/kit.ts';
import { kitFixture, png } from './kit-fixture.ts';
import { ExportScope } from '../src/scope.ts';

function fixture() {
  const f=authorButtons();prepareButtons(f.root);
  for(const b of f.buttons)for(const state of b.children)state.children.find(n=>n.type==='TEXT')!.fontName={family:'Inter',style:'Regular'};
  applyRecognition(recognize(f.root,'tlp-pro-1025m'));return f;
}
test('Auto mode follows frame position on every export and ignores all paragraph alignments',()=>{
  const f=fixture(),button=f.buttons[0];
  setButtonTextMode(f.root,{members:[button]},'auto');
  for(const horizontal of ['LEFT','CENTER','RIGHT','JUSTIFIED'])for(const vertical of ['TOP','CENTER','BOTTOM']){
    for(const state of button.children){const label=state.children.find(n=>n.type==='TEXT')!;label.textAlignHorizontal=horizontal as any;label.textAlignVertical=vertical as any;}
    const native=capture(f.root).screen.elements[0];
    assert.ok(native.states!.every(s=>s.textAlign==='bottom-center'));
    assert.ok(capture(f.root).images.filter(i=>i.asset.key.startsWith('button-artwork.'+native.controlId+'.')).every(i=>!!i.artwork?.omitTextId));
  }
  for(const state of button.children){const label=state.children.find(n=>n.type==='TEXT')!;label.y=28;}
  assert.ok(capture(f.root).screen.elements[0].states!.every(s=>!s.textAlign));
  // A full-area text frame means middle even with paragraph BOTTOM / RIGHT.
  for(const state of button.children){const label=state.children.find(n=>n.type==='TEXT')!;label.x=0;label.y=0;label.resize(120,80);}
  assert.ok(capture(f.root).screen.elements[0].states!.every(s=>!s.textAlign));
  assert.equal(button.getPluginData(BUTTON_TEXT_KEY),'auto');
});

test('Auto centers a horizontally offset text box without changing source geometry or IDs',()=>{
  const f=fixture(),button=f.buttons[0];
  for(const state of button.children){const label=state.children.find(n=>n.type==='TEXT')!;label.x=1;label.resize(80,24);}
  const before=designSignature(f.root),ids=capture(f.root).screen.elements.filter(e=>e.kind==='button').map(e=>[e.objectId,e.controlId]);
  setButtonTextMode(f.root,{members:[button]},'auto');
  const captured=capture(f.root);assert.equal(captured.screen.elements.filter(e=>e.kind==='label').length,0);
  assert.ok(captured.screen.elements[0].states!.every(s=>s.textAlign==='bottom-center'));
  assert.deepEqual(captured.screen.elements.filter(e=>e.kind==='button').map(e=>[e.objectId,e.controlId]),ids);
  setButtonTextMode(f.root,{members:[button]},'design');assert.equal(designSignature(f.root),before);
});

for(const y of [0,8,48,70])test(`Auto rejects top, ambiguous or out-of-bounds frame y=${y} before any batch writes`,()=>{
  const f=fixture();
  for(const state of f.buttons[1].children)state.children.find(n=>n.type==='TEXT')!.y=y;
  const before=designSignature(f.root);
  assert.throws(()=>setButtonTextMode(f.root,{},'auto'),(e:any)=>e.code==='button-text-alignment');
  assert.equal(designSignature(f.root),before);
});

test('Moving auto caption into an unsupported position after applying gives a contextual export error',()=>{
  const f=fixture();setButtonTextMode(f.root,{},'auto');
  const label=f.buttons[0].children[0].children.find(n=>n.type==='TEXT')!;label.y=0;
  assert.throws(()=>capture(f.root),(e:any)=>e.code==='button-text-alignment'&&e.nodeId===label.id);
});
for(const mode of ['middle-center','bottom-center'] as const)test(`${mode}: alignment changes native Button text; source layout, IDs and unselected button stay intact`,async()=>{
  const f=fixture(),button=f.buttons[0],before=designSignature(f.root),neighbor=designSignature(f.buttons[1]);
  assert.equal(capture(f.root).screen.elements.filter(e=>e.kind==='label').length,0);
  assert.deepEqual(setButtonTextMode(f.root,{members:[button]},mode),{buttons:1,skipped:0});
  const captured=capture(f.root),native=captured.screen.elements[0];
  assert.deepEqual(native.states!.map(s=>s.text),['Audio','Audio']);
  assert.ok(native.states!.every(s=>(s.textAlign??'middle-center')===mode));
  assert.equal(native.font!.family,'Inter');
  assert.equal(captured.screen.elements.filter(e=>e.kind==='label').length,0);
  assert.ok(captured.images.filter(i=>i.asset.key.startsWith('button-artwork.'+native.controlId+'.')).every(i=>!!i.artwork?.omitTextId));
  assert.equal(designSignature(f.buttons[1]),neighbor);
  const plan=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  await exportFrame(f.root);
  assert.deepEqual(setButtonTextMode(f.root,{members:[button]},mode),{buttons:0,skipped:1});
  setButtonTextMode(f.root,{members:[button]},'design');assert.equal(designSignature(f.root),before);
});

test('Nested Artwork caption plus blank Kit placeholder becomes native without moving or duplicating either text',async()=>{
  const fake=kitFixture(),kit=await createKit('tlp-pro-1025m'),f=authorButtons('tlp-pro-1025m',fake);
  f.buttons.forEach(b=>b.remove());
  const instance=kit.components.find(n=>n.name==='button_Button')!.createInstance();f.root.appendChild(instance);instance.x=10;instance.y=10;
  applyRecognition(recognize(f.root,'tlp-pro-1025m'));const before=designSignature(f.root);
  setButtonTextMode(f.root,{},'middle-center');
  const captured=capture(f.root),native=captured.screen.elements[0];
  assert.equal(captured.screen.elements.length,1);assert.equal(native.kind,'button');assert.ok(native.states!.every(s=>!!s.text));
  assert.ok(captured.images.every(i=>!!i.artwork?.omitTextId));
  await exportFrame(f.root);setButtonTextMode(f.root,{},'design');assert.equal(designSignature(f.root),before);
});

test('Different state text and colors stay on the same Button; icon-only buttons are skipped',()=>{
  const f=fixture(),button=f.buttons[0];
  const text=button.children[1].children.find(n=>n.type==='TEXT')!;text.characters='HDMI';
  for(const state of f.buttons[1].children)state.children.find(n=>n.type==='TEXT')!.characters='';
  assert.deepEqual(setButtonTextMode(f.root,{},'bottom-center'),{buttons:1,skipped:1});
  assert.deepEqual(capture(f.root).screen.elements[0].states!.map(s=>s.text),['Audio','HDMI']);
});

test('Selecting one Kit instance changes only that button, without escalating to its screen',async()=>{
  const fake=kitFixture(),kit=await createKit('tlp-pro-1025m'),f=authorButtons('tlp-pro-1025m',fake);
  const component=kit.components.find(n=>n.name==='button_Button')!;
  const selected=component.createInstance(),neighbor=component.createInstance();
  f.root.appendChild(selected);f.root.appendChild(neighbor);
  f.page.selection=[selected as never];
  const scope=new ExportScope().resolveButtons();
  assert.equal(scope.scope.id,selected.id);
  assert.deepEqual(setButtonTextMode(scope.root,scope.options,'middle-center'),{buttons:1,skipped:0});
  assert.equal(selected.getPluginData(BUTTON_TEXT_KEY),'middle-center');
  assert.equal(neighbor.getPluginData(BUTTON_TEXT_KEY),'');
  assert.ok(f.buttons.every(b=>!b.getPluginData(BUTTON_TEXT_KEY)));
});

for(const problem of ['multiple','font','state-font','mask','transform','unprepared'] as const)test(`${problem}: invalid second button prevents the complete batch without changing the first`,()=>{
  const f=fixture(),state=f.buttons[1].children[0],text=state.children.find(n=>n.type==='TEXT')!;
  if(problem==='multiple'){const extra=text.clone();state.appendChild(extra);}
  if(problem==='font')text.fontName={family:'Unsupported',style:'Regular'};
  if(problem==='state-font')text.fontSize=24;
  if(problem==='mask')state.children[0].isMask=true;
  if(problem==='transform')Object.defineProperty(state,'relativeTransform',{value:[[0,-1,0],[1,0,0]]});
  if(problem==='unprepared')state.remove();
  const before=designSignature(f.root);
  assert.throws(()=>setButtonTextMode(f.root,{},'bottom-center'));
  assert.equal(designSignature(f.root),before);
});

test('Metadata write failure rolls back every affected button',()=>{
  const f=fixture(),before=designSignature(f.root),button=f.buttons[1],set=button.setPluginData.bind(button);let calls=0;
  button.setPluginData=(key,value)=>{if(key===BUTTON_TEXT_KEY&&++calls===1)throw new Error('write failed');set(key,value);};
  assert.throws(()=>setButtonTextMode(f.root,{},'bottom-center'),/write failed/);assert.equal(designSignature(f.root),before);
});

test('Changing text ownership during asynchronous rendering invalidates the export',async()=>{
  const f=fixture();setButtonTextMode(f.root,{},'bottom-center');
  f.setRenderHook(node=>{f.buttons[0].setPluginData(BUTTON_TEXT_KEY,'middle-center');return png(Math.round(node.width),Math.round(node.height));});
  await assert.rejects(()=>exportFrame(f.root),(error:any)=>error.code==='design-changed');
});

test('Bundled plugin command applies to selected scope independently of style presets and can reset native alignment',async()=>{
  const f=fixture();f.styles.remove();f.page.selection=[f.root as never];
  const code=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
  vm.runInNewContext(code,{figma:f.api,Uint8Array,console});const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'button-text',buttonText:'bottom-center'});await send({type:'export',profile:'tlp-pro-1025m'});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  const bundle=f.messages.find(m=>m.type==='bundle')!.bundle as Awaited<ReturnType<typeof exportFrame>>;
  assert.equal(bundle.screen.elements.length,2);assert.ok(bundle.screen.elements.every(e=>e.kind==='button'&&e.states!.every(s=>!!s.text)));
  await send({type:'button-text',buttonText:'design'});assert.ok(f.buttons.every(b=>!b.getPluginData(BUTTON_TEXT_KEY)));
  f.page.selection=[];await send({type:'button-text',buttonText:'bottom-center'});
  assert.equal(f.messages.filter(m=>m.type==='error').at(-1)?.code,'selection');
});
