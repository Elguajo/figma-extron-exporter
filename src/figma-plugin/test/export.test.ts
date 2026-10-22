import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDemo } from '../src/demo.ts';
import { capture, designSignature, exportFrame } from '../src/export.ts';
import { DATA_KEY, readMetadata, text } from '../src/model.ts';
import { packageExui } from '../src/package.ts';
import { unzipSync, strFromU8 } from 'fflate';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { fakeFigma, icons } from './fake-figma.ts';
import { graphicFixture } from './named-fixture.ts';
import { png } from './kit-fixture.ts';
import { projectFixture, solid } from './expanded-fixture.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';
async function fixture(profile='tlp-pro-1025m') {const fake=fakeFigma();const root=await createDemo(profile as never,icons(),true);return{fake,root};}
function semantic(screen:unknown){const result=structuredClone(screen) as any;result.assets.sort((a:any,b:any)=>a.key.localeCompare(b.key));for(const e of result.elements)if(e.states)for(const s of e.states){s.imageAlign??='middle-center';s.textAlign??='middle-center';}return result;}
function edit(node:any,values:Record<string,unknown>){node.setPluginData(DATA_KEY,JSON.stringify({...JSON.parse(node.getPluginData(DATA_KEY)),...values}));}
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)test(`Rounded screen ${profile}: presentation corners do not change EXUI or the original Figma Frame`,async()=>{
  const {root}=await fixture(profile),square=packageExui(await exportFrame(root));
  root.cornerRadius=10;root.clipsContent=true;
  const before=designSignature(root);
  assert.deepEqual(packageExui(await exportFrame(root)),square);assert.equal(designSignature(root),before);assert.equal(root.cornerRadius,10);
  Object.assign(root,{cornerRadius:figma.mixed,topLeftRadius:10,topRightRadius:20,bottomLeftRadius:30,bottomRightRadius:40});
  const mixed=designSignature(root);assert.deepEqual(packageExui(await exportFrame(root)),square);assert.equal(designSignature(root),mixed);
  // Ignoring presentation corners does not permit unsupported screen strokes.
  root.strokes=[solid('#FFFFFF')];assert.throws(()=>capture(root),(e:any)=>e.code==='appearance'&&e.message.includes('обводки'));
});

test('Project page corners are ignored while native shape radius and popup validation stay intact',()=>{
  fakeFigma();const project=projectFixture();applyRecognition(recognize(project,'tlp-pro-1025m'));
  const square=capture(project).screen;
  for(const child of project.children)if(readMetadata(child)?.kind==='page')(child as FrameNode).cornerRadius=10;
  const rounded=capture(project).screen;assert.deepEqual(rounded,square);assert.ok('pages' in rounded);
  assert.equal(rounded.pages[0].elements.find(e=>e.kind==='shape')!.native!.radius,10);
  const popup=project.children.find(n=>readMetadata(n)?.kind==='popup') as FrameNode;popup.cornerRadius=10;
  assert.throws(()=>capture(project),(e:any)=>e.code==='appearance'&&e.nodeId===popup.id&&e.message.includes('скругление'));
});

test('Fractional logo retains its exact source geometry inside a pixel-aligned PNG viewport',async()=>{
  const fake=fakeFigma(),root=await graphicFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));
  const logo=root.children.find(n=>readMetadata(n)?.kind==='graphic') as FrameNode;
  logo.x=48.42;logo.y=27.91;logo.resize(204.01,29.09);
  const plan=recognize(root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const before=designSignature(root),pageBefore=fake.page.children.map(n=>n.id);
  let wrapped=false;
  fake.setRenderHook(node=>{
    if(node.children.length===1&&node.children[0].name===logo.name){
      wrapped=true;assert.deepEqual([node.width,node.height],[205,30]);
      assert.ok(Math.abs(node.children[0].x-.42)<1e-9);assert.ok(Math.abs(node.children[0].y-.91)<1e-9);
      assert.deepEqual([node.children[0].width,node.children[0].height],[204.01,29.09]);
    }
    return png(Math.round(node.width),Math.round(node.height));
  });
  const bundle=await exportFrame(root),result=bundle.screen.elements.find(e=>e.kind==='graphic')!;
  assert.deepEqual(result.rect,[48,27,205,30]);assert.ok(wrapped);assert.equal(designSignature(root),before);assert.deepEqual(fake.page.children.map(n=>n.id),pageBefore);
  assert.deepEqual([logo.x,logo.y,logo.width,logo.height],[48.42,27.91,204.01,29.09]);
});
for(const [width,expected] of [[218.21,218],[218.7,219]])test(`Native button and full-area states round ${width} to ${expected} without changing Figma`,async()=>{
  const {fake,root}=await fixture(),button=root.children[0] as FrameNode;
  button.x=24.7;button.y=48.21;button.resize(width,160.7);
  for(const state of button.children as readonly FrameNode[]){
    state.resize(width,160.7);
    const label=state.children.find(n=>n.type==='TEXT')!;label.resize(width,160.7);
    for(const icon of state.children.filter(n=>n.type!=='TEXT')){icon.x=(expected-icon.width)/2;icon.y=0;}
  }
  const before=designSignature(root);fake.setRenderHook(node=>png(Math.round(node.width),Math.round(node.height)));
  const bundle=await exportFrame(root);assert.deepEqual(bundle.screen.elements[0].rect,[25,48,expected,161]);
  assert.equal(bundle.screen.elements[0].states!.length,3);assert.equal(designSignature(root),before);
});
for(const [profile,suffix] of [['tlp-pro-1025m','1025m'],['tlp-pro-300m-portrait','300m']])
  test(`Demo ${suffix}: Figma adapter → exact known screen semantics → deterministic ZIP with SHA-256`,async()=>{
    const {root}=await fixture(profile);const bundle=await exportFrame(root);
    const expected=JSON.parse(readFileSync(new URL(`../../../examples/exui-v1/${suffix}/screen.json`,import.meta.url),'utf8'));
    assert.equal(expected.schema,'exui-screen/1');
    expected.schema='exui-screen/5';
    assert.deepEqual(semantic(bundle.screen),semantic(expected));
    const a=packageExui(bundle),b=packageExui(await exportFrame(root));assert.deepEqual(a,b);
    const files=unzipSync(a);assert.equal(Object.keys(files).length,4);assert.ok(files['manifest.json']&&files['screen.json']);
    const manifest=JSON.parse(strFromU8(files['manifest.json']));assert.equal(manifest.profile,profile);assert.equal(manifest.schema,'exui/5');
    for(const resource of manifest.resources)assert.equal(resource.sha256,bytesToHex(sha256(files[resource.path])).toUpperCase());
  });
test('IDs and explicit state IDs survive layer order, state order, texts and geometry edits',async()=>{
  const {root}=await fixture();const before=capture(root).screen;
  const button=root.children[0] as any;button.children.reverse();root.children.reverse();
  for(const n of root.children){n.x+=1;if(n.type==='TEXT')n.characters='Уровень';else if(n.children.length)for(const s of n.children)s.children.find((c:any)=>c.type==='TEXT').characters='Новый '+s.name;}
  const after=(await exportFrame(root)).screen;
  const ids=(s:any)=>s.elements.map((e:any)=>[e.key,e.objectId,e.controlId]).sort();assert.deepEqual(ids(before),ids(after));
  assert.equal(after.elements[0].key,'volume.mute');assert.deepEqual(after.elements[0].states!.map(s=>[s.stateId,s.role]),[[0,'normal'],[1,'feedback'],[2,'pressed']]);
});
test('Empty Button captions force exui/5 while separate overlays retain editable text',async()=>{
  const {root}=await fixture();const button=root.children[0] as FrameNode;
  for(const state of button.children as FrameNode[])(state.children.find(n=>n.type==='TEXT') as TextNode).characters='';
  const screen=(await exportFrame(root)).screen;assert.ok('elements'in screen);
  assert.equal(screen.schema,'exui-screen/5');assert.ok(screen.elements[0].states!.every(s=>s.text===''));
  assert.equal(screen.elements[1].text,'Громкость');
  (button.children[0] as FrameNode).children.find(n=>n.type==='TEXT')!.characters=' ';
  assert.throws(()=>capture(root),(e:any)=>e.code==='text');
});
test('Empty static labels stay invalid',async()=>{
  const {root}=await fixture();(root.children[1] as TextNode).characters='';
  assert.throws(()=>capture(root),(e:any)=>e.code==='text');
});
for(const family of ['Roboto','Noto Sans','Custom Font'])test(`Static ${family} text exports automatically as PNG without a source Frame`,async()=>{
  const {fake,root}=await fixture(),label=root.children[1] as TextNode;
  label.fontName={family,style:'Regular'};if(family==='Roboto'){label.textAlignHorizontal='RIGHT';label.textAlignVertical='TOP';}
  const before=designSignature(root),metadata=label.getPluginData(DATA_KEY),identity=readMetadata(label)!;
  fake.setRenderHook(node=>png(Math.round(node.width),Math.round(node.height)));
  const bundle=await exportFrame(root),result=bundle.screen.elements.find(e=>e.key===identity.key)!;
  assert.equal(result.kind,'graphic');assert.equal(result.controlId,null);assert.equal(result.objectId,identity.objectId);
  assert.equal(result.text,undefined);assert.equal(result.font,undefined);assert.ok(result.image);
  assert.ok(bundle.resources.find(r=>r.path===bundle.screen.assets.find(a=>a.key===result.image)!.file));
  assert.equal(label.type,'TEXT');assert.equal(label.getPluginData(DATA_KEY),metadata);assert.equal(designSignature(root),before);
  assert.deepEqual(fake.page.children,[root]);assert.deepEqual(packageExui(await exportFrame(root)),packageExui(bundle));
});
test('Mixed-font and fractional static text keeps its original layout while native Arial stays editable',async()=>{
  const {fake,root}=await fixture(),label=root.children[1] as TextNode,identity=readMetadata(label)!;
  assert.equal(capture(root).screen.elements.find(e=>e.key===identity.key)!.kind,'label');
  label.fontName=figma.mixed;label.x=48.42;label.y=27.91;label.resize(204.01,29.09);
  const before=designSignature(root);fake.setRenderHook(node=>png(Math.round(node.width),Math.round(node.height)));
  const result=(await exportFrame(root)).screen.elements.find(e=>e.key===identity.key)!;
  assert.equal(result.kind,'graphic');assert.deepEqual(result.rect,[48,27,205,30]);assert.equal(designSignature(root),before);
});
test('Static Arial retains its authored alignment as native text',async()=>{
  const {fake,root}=await fixture(),label=root.children[1] as TextNode;
  label.textAlignHorizontal='CENTER';label.textAlignVertical='TOP';fake.setRenderHook(node=>png(Math.round(node.width),Math.round(node.height)));
  const result=(await exportFrame(root)).screen.elements[1];assert.equal(result.kind,'label');assert.equal(result.textAlign,'top-center');
});
test('Inter captions in existing Frame button states remain native text without altering their IDs or labels',async()=>{
  const {fake,root}=await fixture(),button=root.children[0] as FrameNode;
  for(const state of button.children as FrameNode[])(state.children.find(n=>n.type==='TEXT') as TextNode).fontName={family:'Inter',style:'Medium'};
  const before=designSignature(root);fake.setRenderHook(node=>png(Math.round(node.width),Math.round(node.height)));
  const result=(await exportFrame(root)).screen.elements[0];
  assert.equal(result.kind,'button');assert.equal(result.controlId,readMetadata(button)!.controlId);
  assert.deepEqual(result.states!.map(s=>[s.stateId,s.role,s.text]),[[0,'normal','Музыка'],[1,'feedback','Музыка'],[2,'pressed','Музыка']]);
  assert.equal(result.font!.family,'Inter');assert.equal(result.font!.style,'Medium');assert.equal(designSignature(root),before);
});
test('A style change inside a mixed-font range during PNG rendering aborts the package',async()=>{
  const {fake,root}=await fixture(),label=root.children[1] as TextNode;
  label.fontName=figma.mixed;
  const segments=[{characters:label.characters,start:0,end:label.characters.length,fontName:{family:'Inter',style:'Regular'}}];
  (label as any).textSegments=segments;
  let changed=false;fake.setRenderHook(node=>{if(!changed){segments[0].fontName.family='Roboto';changed=true;}return png(Math.round(node.width),Math.round(node.height));});
  await assert.rejects(exportFrame(root),(e:any)=>e.code==='design-changed');assert.deepEqual(fake.page.children,[root]);
});
test('Unsupported DateTime fonts remain an explicit error rather than a frozen picture',async()=>{
  const {root}=await fixture(),label=root.children[1] as TextNode;
  edit(label,{kind:'datetime'});label.fontName={family:'Roboto',style:'Regular'};
  assert.throws(()=>capture(root),(e:any)=>e.code==='font'&&e.nodeId===label.id);
});
for(const [name,change,code] of [
  ['duplicate object ID',(r:any)=>edit(r.children[0],{objectId:2}),'duplicate-id'],
  ['duplicate control ID',(r:any)=>edit(r.children[0],{controlId:8103}),'duplicate-id'],
  ['copied node owner',(r:any)=>edit(r.children[0],{ownerNodeId:'previous-owner'}),'copied-node'],
  ['semantic key inferred from text',(r:any)=>edit(r.children[0],{key:undefined}),'key'],
  ['non-finite coordinate',(r:any)=>r.children[0].x=NaN,'geometry'],
  ['non-positive size',(r:any)=>r.children[0].width=0,'geometry'],
  ['size rounded to zero',(r:any)=>r.children[0].width=.2,'bounds'],
  ['inherited rotation',(r:any)=>Object.defineProperty(r,'absoluteTransform',{value:[[0,-1,0],[1,0,0]]}),'transform'],
  ['outside canvas',(r:any)=>r.children[0].x=1270,'bounds'],
  ['wrong panel size',(r:any)=>r.width=320,'profile'],
  ['unknown child',(r:any)=>r.appendChild(new (r.constructor)('RECTANGLE')),'unmapped'],
  ['hidden control',(r:any)=>r.children[0].visible=false,'appearance'],
  ['gradient',(r:any)=>r.fills=[{type:'GRADIENT_LINEAR'}],'color'],
  ['effects',(r:any)=>r.effects=[{type:'DROP_SHADOW'}],'appearance'],
  ['mixed pressed/feedback',(r:any)=>edit(r.children[0].children[2],{role:'feedback'}),'states'],
  ['missing normal state',(r:any)=>r.children[0].children.splice(0,1),'states'],
  ['states different only in alignment',(r:any)=>r.children[0].children[2].fills=structuredClone(r.children[0].children[0].fills),'states'],
  ['different state fonts',(r:any)=>r.children[0].children[1].children[0].fontSize=12,'font'],
  ['unsupported dynamic font',(r:any)=>{edit(r.children[1],{kind:'value',controlId:8200});r.children[1].fontName={family:'Roboto',style:'Regular'};},'font'],
  ['unsupported dynamic alignment',(r:any)=>{edit(r.children[1],{kind:'value',controlId:8200});r.children[1].textAlignHorizontal='JUSTIFIED';},'alignment'],
  ['icon wrong anchor',(r:any)=>r.children[0].children[0].children[1].x=5,'alignment'],
  ['invalid image path',(r:any)=>edit(r.children[0].children[0].children[1],{file:'../escape.png'}),'image'],
] as const)test(`Export refuses ${name}`,async()=>{const {root}=await fixture();change(root);assert.throws(()=>capture(root),(e:any)=>e.code===code);});
test('PNG render failure is fatal; no partial bundle is returned',async()=>{const {fake,root}=await fixture();fake.setRenderHook(()=>{throw new Error('render failed');});await assert.rejects(exportFrame(root),(e:any)=>e.code==='image-export');});

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'])test(`PNG ${profile}: hidden preview ancestors never reach rendering; source and selection stay intact`,async()=>{
  const {fake,root}=await fixture(profile),before=capture(root).signature;
  fake.setRenderHook(node=>{for(let parent=node.parent;parent;parent=parent.parent)if(!parent.visible)throw new Error('Renderer cannot paint a hidden ancestor');});
  const bundle=await exportFrame(root);assert.equal(bundle.resources.length,2);
  assert.equal(capture(root).signature,before);assert.deepEqual(fake.page.children,[root]);assert.deepEqual(fake.page.selection,[root]);
});

test('PNG exports retain transparent Frame margins at Native 1x',async()=>{
  const {fake,root}=await fixture();let renders=0;
  fake.setRenderHook((_node,settings)=>{assert.equal(settings.useAbsoluteBounds,true);assert.equal(settings.contentsOnly,true);assert.deepEqual(settings.constraint,{type:'SCALE',value:1});renders++;});
  await exportFrame(root);assert.equal(renders,3);
});

test('Failed isolated PNG rendering leaves no temporary nodes or changed preview',async()=>{
  const {fake,root}=await fixture(),before=capture(root).signature;let renders=0;
  fake.setRenderHook(node=>{assert.equal(node.parent,fake.page);assert.notEqual(node,root);if(++renders===2)throw new Error('Render failed on feedback');});
  await assert.rejects(exportFrame(root),(e:any)=>e.code==='image-export');assert.equal(renders,2);
  assert.equal(capture(root).signature,before);assert.deepEqual(fake.page.children,[root]);assert.deepEqual(fake.page.selection,[root]);
});

test('Native PNG size mismatch remains fatal and reports received versus expected dimensions',async()=>{
  const {fake,root}=await fixture();const bad=new Uint8Array(icons()['icon.note-light']);new DataView(bad.buffer).setUint32(16,63);
  const hash=fake.api.createImage(bad).hash;fake.setRenderHook(node=>{node.fills=[{type:'IMAGE',imageHash:hash}];});
  await assert.rejects(exportFrame(root),(e:any)=>e.code==='image-size'&&e.message.includes('63×64')&&e.message.includes('64×64'));
  assert.deepEqual(fake.page.children,[root]);
});
test('Changes during async rendering abort the export',async()=>{const {fake,root}=await fixture();let changed=false;fake.setRenderHook(()=>{if(!changed){root.children[1].name='Изменение';changed=true;}});await assert.rejects(exportFrame(root),(e:any)=>e.code==='design-changed');});
test('Identical asset key with different actual PNG bytes is refused',async()=>{const {fake,root}=await fixture();let rendered=0;fake.setRenderHook((n:any)=>{if(++rendered===3){const hash=fake.api.createImage(new Uint8Array([...icons()['icon.note-light'],0])).hash;n.fills=[{type:'IMAGE',imageHash:hash}];}});await assert.rejects(exportFrame(root),(e:any)=>e.code==='image-conflict');});
test('Package rejects unsafe paths, missing assets and oversize resource',async()=>{const {root}=await fixture();const bundle=await exportFrame(root);const bad=structuredClone(bundle);bad.resources[0].path='../escape.png';assert.throws(()=>packageExui(bad));bad.resources=[];assert.throws(()=>packageExui(bad));const large=structuredClone(bundle);large.resources[0].bytes=new Uint8Array(4*1024*1024+1);assert.throws(()=>packageExui(large));});
test('Text validation preserves Cyrillic and surrogate pairs, rejects broken Unicode',()=>{assert.equal(text('Музыка 🎵','test'),'Музыка 🎵');assert.throws(()=>text('\uD800','test'));assert.throws(()=>text('\uDC00','test'));assert.throws(()=>text('a\0b','test'));});
test('Figma plugin metadata survives cosmetic changes without rewriting',async()=>{const {root}=await fixture();const n=root.children[0],before=n.getPluginData(DATA_KEY);n.name='Новая подпись';n.x+=3;assert.equal(n.getPluginData(DATA_KEY),before);assert.equal(readMetadata(n)?.controlId,8101);});
