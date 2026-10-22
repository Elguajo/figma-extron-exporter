import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFigma } from './fake-figma.ts';
import { projectFixture,solid } from './expanded-fixture.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { capture,designSignature,exportFrame } from '../src/export.ts';
import { DATA_KEY,readMetadata,type Profile,type Metadata } from '../src/model.ts';
import { packageExui } from '../src/package.ts';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
function setup(profile:Profile='tlp-pro-1025m') {
  fakeFigma();const root=projectFixture(profile);applyRecognition(recognize(root,profile));
  const page=root.children[0] as FrameNode,popup=root.children.find(n=>n.name==='popup_Sources') as FrameNode;
  const ref=page.children.find(n=>n.name==='popupref_Sources') as FrameNode;
  return {root,page,popup,ref};
}
function settings(node:FrameNode,values:Partial<Metadata>) {node.setPluginData(DATA_KEY,JSON.stringify({...readMetadata(node),...values}));}
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)test(`Popup guides ${profile}: paints, opacity and mixed corners are ignored without changing Figma`,async()=>{
  const {root,ref}=setup(profile),baseline=packageExui(await exportFrame(root));
  const group=root.children.find(n=>n.name==='popupgroup_Zones') as FrameNode;
  const popups=[...root.children.filter(n=>readMetadata(n)?.kind==='popup'),...group.children] as FrameNode[];
  for(const node of [ref,...popups])Object.assign(node,{fills:[{type:'GRADIENT_LINEAR',visible:true}],strokes:[solid('#FF0000')],opacity:0,cornerRadius:figma.mixed,topLeftRadius:4,topRightRadius:8,bottomLeftRadius:12,bottomRightRadius:16});
  const before=designSignature(root),plan=recognize(root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  assert.equal(designSignature(root),before);
  assert.deepEqual(packageExui(await exportFrame(root)),baseline);assert.equal(designSignature(root),before);
  const screen=capture(root).screen;assert.ok('popups' in screen);assert.ok(screen.popups.every(p=>p.background==='#00000000'));
});
test('Opt-in reference background and stroke export as a passive rectangle immediately below the reference',()=>{
  const {root,ref}=setup();ref.fills=[solid('#102030')];ref.strokes=[solid('#FF0000')];ref.strokeAlign='INSIDE';ref.strokeWeight=2;ref.cornerRadius=10;ref.opacity=.1;
  settings(ref,{exportBackground:true,exportStroke:true});const before=designSignature(root),screen=capture(root).screen;assert.ok('pages' in screen);
  const elements=screen.pages[0].elements,index=elements.findIndex(e=>e.kind==='popup-ref'&&e.name===ref.name),decoration=elements[index-1];
  assert.equal(decoration.kind,'shape');assert.equal(decoration.controlId,null);assert.equal(decoration.fillColor,'#102030');assert.deepEqual(decoration.rect,elements[index].rect);
  assert.deepEqual(decoration.native,{shape:'rectangle',radius:0,strokeColor:'#FF0000',thickness:2});
  assert.equal(new Set(elements.map(e=>e.objectId)).size,elements.length);assert.equal(designSignature(root),before);
  const ids=elements.map(e=>[e.key,e.objectId]).sort();(root.children[0] as FrameNode).children.slice().reverse().forEach(n=>(root.children[0] as FrameNode).appendChild(n));
  const reordered=capture(root).screen;assert.ok('pages' in reordered);assert.deepEqual(reordered.pages[0].elements.map(e=>[e.key,e.objectId]).sort(),ids);
  settings(ref,{exportBackground:false,exportStroke:false});const disabled=capture(root).screen;assert.ok('pages' in disabled);assert.ok(!disabled.pages[0].elements.some(e=>e.key===decoration.key));
});
test('Background and stroke switches work independently and preserve SOLID alpha, ignoring Frame opacity',()=>{
  const {root,ref,popup}=setup();ref.fills=[{...solid('#123456'),opacity:.5}];ref.strokes=[solid('#FF0000')];ref.strokeAlign='INSIDE';
  settings(ref,{exportBackground:true});settings(popup,{exportBackground:true});popup.fills=[solid('#202020')];popup.opacity=0;
  let screen=capture(root).screen;assert.ok('pages' in screen);let shape=screen.pages[0].elements.find(e=>e.key.startsWith('popup-appearance.'))!;
  assert.equal(shape.fillColor,'#80123456');assert.equal(shape.native!.thickness,0);assert.equal(screen.popups.find(p=>p.name===popup.name)!.background,'#202020');
  settings(ref,{exportBackground:false,exportStroke:true});screen=capture(root).screen;assert.ok('pages' in screen);shape=screen.pages[0].elements.find(e=>e.key.startsWith('popup-appearance.'))!;
  assert.equal(shape.fillColor,'#00000000');assert.equal(shape.native!.strokeColor,'#FF0000');
});
test('Popup border uses transparent native shape behind its original children',()=>{
  const {root,popup}=setup();popup.strokes=[solid('#FF0000')];popup.strokeAlign='INSIDE';popup.cornerRadius=15;settings(popup,{exportStroke:true});
  const screen=capture(root).screen;assert.ok('popups' in screen);const result=screen.popups.find(p=>p.name===popup.name)!;
  assert.equal(result.background,'#00000000');assert.equal(result.elements[0].kind,'shape');assert.deepEqual(result.elements[0].rect,[0,0,80,60]);
  assert.equal(result.elements[0].native!.radius,0);assert.equal(result.elements[1].kind,'label');
});
test('Decoration IDs avoid authored IDs and derived caption IDs at the upper boundary',()=>{
  const {root,popup,ref}=setup();settings((root.children[0] as FrameNode).children[0] as FrameNode,{objectId:1000000});
  popup.strokes=[solid('#FF0000')];popup.strokeAlign='INSIDE';settings(popup,{exportStroke:true});
  settings(popup.children[0] as FrameNode,{objectId:1000000});ref.fills=[solid('#112233')];settings(ref,{exportBackground:true});
  const screen=capture(root).screen;assert.ok('pages' in screen);for(const c of [...screen.pages,...screen.popups])assert.equal(new Set(c.elements.map(e=>e.objectId)).size,c.elements.length);
});
for(const [name,edit] of [
  ['effects',(n:FrameNode)=>{n.effects=[{type:'DROP_SHADOW'} as Effect];}],
  ['hidden Frame',(n:FrameNode)=>{n.visible=false;}],
] as const)test(`Ignoring guides still rejects ${name}`,()=>{const {root,ref}=setup();edit(ref);assert.throws(()=>capture(root));});
test('Opted-in unsupported paints and border alignment fail without modifying source',()=>{
  const {root,ref}=setup();ref.strokes=[solid('#FF0000')];settings(ref,{exportStroke:true});let before=designSignature(root);
  assert.throws(()=>capture(root),/Inside/);assert.equal(designSignature(root),before);
  settings(ref,{exportStroke:false,exportBackground:true});ref.fills=[{type:'GRADIENT_LINEAR'} as Paint];before=designSignature(root);
  assert.throws(()=>capture(root),/SOLID/);assert.equal(designSignature(root),before);
});
test('Malformed authoring flags are rejected while legacy popup assignments need no migration',()=>{
  const {ref}=setup();assert.equal(readMetadata(ref)!.exportBackground,undefined);
  settings(ref,{exportBackground:'true' as unknown as boolean});assert.throws(()=>readMetadata(ref),/оформление popup/);
});
test('Built form command persists opt-ins across restart and clears them when disabled',async()=>{
  const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
  const fake=fakeFigma(),root=projectFixture();fake.page.appendChild(root as never);applyRecognition(recognize(root,'tlp-pro-1025m'));
  const popup=root.children.find(n=>n.name==='popup_Sources') as FrameNode,ref=(root.children[0] as FrameNode).children.find(n=>n.name==='popupref_Sources') as FrameNode;
  vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});
  for(const node of [ref,popup]) {
    fake.page.selection=[node as never];fake.emit('selectionchange');const m=readMetadata(node)!;
    const form={...m,objectId:String(m.objectId),modal:'false',keyEdited:'false',exportBackground:'true',exportStroke:'true'};
    await (fake.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'apply',data:form});
    assert.equal(readMetadata(node)!.exportBackground,true);assert.equal(readMetadata(node)!.exportStroke,true);
    vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});fake.emit('selectionchange');
    const selection=fake.messages.filter(m=>m.type==='selection').at(-1)!.metadata as Metadata;assert.equal(selection.exportBackground,true);
    await (fake.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'apply',data:{...form,exportBackground:'false',exportStroke:'false'}});
    assert.equal(readMetadata(node)!.exportBackground,undefined);assert.equal(readMetadata(node)!.exportStroke,undefined);
  }
  assert.deepEqual(fake.messages.filter(m=>m.type==='error'),[]);
});
