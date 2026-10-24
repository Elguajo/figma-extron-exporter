import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { fakeFigma } from './fake-figma.ts';
import { namedFixture } from './named-fixture.ts';
import { recognize, applyRecognition, namedControl } from '../src/recognize.ts';
import { capture, designSignature, exportFrame } from '../src/export.ts';
import { DATA_KEY, readMetadata } from '../src/model.ts';
import { kitFixture } from './kit-fixture.ts';
import { createKit } from '../src/kit.ts';

for(const [two,mode,names,roles] of [[true,'on-off',['Off','On'],['normal','feedback']],[false,'feedback',['Normal','Active','Pressed'],['normal','feedback','pressed']]] as const) {
  test(`New ${mode} button: explicit metadata/3, fixed states, key follows rename with stable IDs`,async()=>{
    fakeFigma();const root=await namedFixture('tlp-pro-1025m',two);
    const plan=recognize(root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);assert.equal(plan.rows.find(r=>r.kind==='button')?.buttonMode,mode);
    applyRecognition(plan);const button=root.children[0];const saved=button.getPluginData(DATA_KEY);
    assert.equal(readMetadata(button)?.schema,'exui-node/3');assert.equal(readMetadata(button)?.buttonMode,mode);
    const first=capture(root).screen;assert.ok('elements' in first);
    assert.deepEqual(first.elements[0].states!.map(s=>s.name),names);assert.deepEqual(first.elements[0].states!.map(s=>s.role),roles);
    assert.equal(first.elements[0].press,two?undefined:'Pressed');
    button.name=two?'feedbackbutton_Renamed':'button_Renamed';
    const next=recognize(root,'tlp-pro-1025m');assert.deepEqual(next.errors,[]);applyRecognition(next);
    assert.equal(readMetadata(button)?.key,'home.renamed');assert.deepEqual({...readMetadata(button),key:undefined},{...JSON.parse(saved),key:undefined});
    const second=capture(root).screen;assert.ok('elements' in second);
    assert.deepEqual([second.elements[0].objectId,second.elements[0].controlId],[first.elements[0].objectId,first.elements[0].controlId]);
    const withoutImage=(states:typeof first.elements[0]['states'])=>states!.map(s=>({...s,image:undefined}));
    assert.deepEqual(withoutImage(second.elements[0].states),withoutImage(first.elements[0].states));
    assert.ok(second.elements[0].states!.every(s=>!s.image||s.image===`icon.home.renamed.state${s.stateId}`));
  });
}

for(const [name,two,edit] of [
  ['ordinary cannot have three states',false,(b:FrameNode)=>{b.name='button_Music';}],
  ['ordinary cannot have two normal states',true,(b:FrameNode)=>{b.children[1].name='Normal';}],
  ['ordinary requires a normal state',true,(b:FrameNode)=>{b.children[0].name='Active';}],
  ['feedback requires feedback, not just Pressed',false,(b:FrameNode)=>{b.children[1].remove();}],
  ['feedback rejects unknown feedback names',false,(b:FrameNode)=>{b.children[1].name='state_Disabled';}],
  ['ordinary rejects unknown feedback names',true,(b:FrameNode)=>{b.children[1].name='state_Disabled';}],
] as const)test(`Button contract: ${name}, no writes`,async()=>{
  fakeFigma();const root=await namedFixture('tlp-pro-1025m',two);edit(root.children[0] as FrameNode);
  const before=designSignature(root),plan=recognize(root,'tlp-pro-1025m');
  assert.ok(plan.errors.some(e=>e.includes('требует')));assert.throws(()=>applyRecognition(plan));assert.equal(designSignature(root),before);
});

for(const [prefix,names,roles,press] of [
  ['button',['Normal','Pressed'],['normal','pressed'],'Pressed'],
  ['button',['Passive','Active'],['normal','feedback'],undefined],
  ['feedbackbutton',['Normal','Active'],['normal','feedback'],undefined],
  ['feedbackbutton',['Passive','Active'],['normal','feedback'],undefined],
  ['feedbackbutton',['Off','On'],['normal','feedback'],undefined],
  ['feedbackbutton',['Passive','Active','Pressed'],['normal','feedback','pressed'],'Pressed'],
] as const)test(`${prefix} ${names.join('/')}: only authored states exported, identity and source layers preserved`,async()=>{
  fakeFigma();const root=await namedFixture();const button=root.children[0] as FrameNode;
  button.name=prefix+'_VolumeDown';
  if(names.length===2)button.children[names[1]==='Pressed'?1:2].remove();
  button.children.forEach((s,i)=>s.name='state_'+names[i]);
  const beforeNames=button.children.map(s=>s.name);
  const plan=recognize(root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const before=designSignature(root),bundle=await exportFrame(root),element=bundle.screen.elements[0];
  assert.deepEqual(element.states!.map(s=>s.name),names);assert.deepEqual(element.states!.map(s=>s.role),roles);
  assert.deepEqual(element.states!.map(s=>s.stateId),names.map((_,i)=>i));assert.equal(element.press,press);
  assert.deepEqual(button.children.map(s=>s.name),beforeNames);assert.equal(designSignature(root),before);
  const ids=[element.objectId,element.controlId];applyRecognition(recognize(root,'tlp-pro-1025m'));
  assert.deepEqual([capture(root).screen.elements[0].objectId,capture(root).screen.elements[0].controlId],ids);
});

test('Two-state kit button exports only its two Artwork PNGs, including hidden Active',async()=>{
  kitFixture();const kit=await createKit('tlp-pro-1025m');
  const button=kit.example.children.find(n=>n.name==='feedbackbutton_Hall') as FrameNode;
  for(const node of [...kit.example.children])if(node!==button)node.remove();
  button.children[2].remove();
  button.children[0].visible=true;button.children[1].visible=false;
  // Artwork slots retain their service names; they remain image resources.
  const plan=recognize(kit.example,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const source=designSignature(kit.example),bundle=await exportFrame(kit.example);
  assert.deepEqual(bundle.screen.elements[0].states!.map(s=>s.name),['Normal','Active']);
  assert.equal(bundle.screen.elements[0].press,undefined);assert.equal(bundle.resources.length,2);
  assert.equal(bundle.screen.assets.length,2);assert.equal(button.children[1].visible,false);
  assert.equal(designSignature(kit.example),source);
});

test('State prefixes/case are accepted; raw Figma layers are preserved',async()=>{
  fakeFigma();const root=await namedFixture();const button=root.children[0] as FrameNode;
  button.name='FEEDBACKBUTTON_Music';button.children.forEach((s,i)=>s.name=['st_Normal','STATE_Active','pressed'][i]);
  const names=button.children.map(s=>s.name);applyRecognition(recognize(root,'tlp-pro-1025m'));
  assert.deepEqual(button.children.map(s=>s.name),names);assert.equal(readMetadata(button)?.buttonMode,'feedback');
  assert.deepEqual(namedControl('fbtn_Music'),namedControl('feedbackbutton_music'));
});

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)test(`${profile}: button_side.hall keeps its name and dotted key; renaming moves the key, not the IDs`,async()=>{
  fakeFigma();const root=await namedFixture(profile,true),button=root.children[0] as FrameNode;
  button.name='button_side.hall';button.children.forEach((s,i)=>s.name=['Passive','Active'][i]);
  const plan=recognize(root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(root),first=bundle.screen.elements[0];
  assert.equal(first.name,'button_side.hall');assert.equal(first.key,'home.side.hall');
  assert.deepEqual(first.states!.map(s=>s.name),['Passive','Active']);
  button.name='button_SideHall';applyRecognition(recognize(root,profile));
  const again=capture(root).screen.elements[0];
  assert.deepEqual([again.key,again.objectId,again.controlId],['home.sidehall',first.objectId,first.controlId]);
});

test('Dotted layer names reject empty segments; repeated names get distinct keys',async()=>{
  fakeFigma();const root=await namedFixture('tlp-pro-1025m',true),button=root.children[0] as FrameNode;
  for(const name of ['button_.hall','button_side.','button_side..hall']){
    button.name=name;const before=designSignature(root);
    const plan=recognize(root,'tlp-pro-1025m');assert.ok(plan.errors.length);assert.throws(()=>applyRecognition(plan));assert.equal(designSignature(root),before);
  }
  button.name='button_side.hall';root.children[3].name='button_SIDE.HALL';
  const before=designSignature(root),plan=recognize(root,'tlp-pro-1025m');
  assert.deepEqual(plan.errors,[]);assert.equal(designSignature(root),before);applyRecognition(plan);
  assert.equal(new Set(root.children.map(n=>JSON.parse(n.getPluginData('exui')).key)).size,root.children.length);
});

test('Saved type is enforced during export, not only during recognition',async()=>{
  fakeFigma();const root=await namedFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));
  const button=root.children[0] as FrameNode,active=button.children[1];
  const raw=JSON.parse(active.getPluginData(DATA_KEY));active.setPluginData(DATA_KEY,JSON.stringify({...raw,stateName:'Passive'}));
  assert.throws(()=>capture(root),(e:any)=>e.code==='button-states');
});

test('Malformed metadata/3 cannot lose buttonMode or downgrade silently',async()=>{
  fakeFigma();const root=await namedFixture('tlp-pro-1025m',true);applyRecognition(recognize(root,'tlp-pro-1025m'));
  const button=root.children[0],raw=JSON.parse(button.getPluginData(DATA_KEY));
  for(const bad of [{...raw,buttonMode:undefined},{...raw,buttonMode:'auto'},{...raw,schema:'exui-node/2'},{...raw,kind:'label'}]){
    button.setPluginData(DATA_KEY,JSON.stringify(bad));assert.throws(()=>readMetadata(button),(e:any)=>e.code==='metadata');
  }
});

test('Plugin 0.2.1 refuses new metadata/3 instead of ignoring the type',async()=>{
  const fixture=fakeFigma();const root=await namedFixture('tlp-pro-1025m',true);applyRecognition(recognize(root,'tlp-pro-1025m'));
  fixture.page.selection=[root as any];
  const legacyArchive=new URL('../../../releases/figma-plugin/Legacy/0.2.1/figma-extron-plugin-0.2.1.zip',import.meta.url);
  const archive=existsSync(legacyArchive)?legacyArchive:new URL('../../../releases/figma-plugin/0.2.1/figma-extron-plugin-0.2.1.zip',import.meta.url);
  const zip=unzipSync(new Uint8Array(readFileSync(archive)));
  vm.runInNewContext(strFromU8(zip['dist/code.js']),{figma:fixture.api,Uint8Array,console});
  await (fixture.api.ui.onmessage as any)({type:'export'});
  assert.equal(fixture.messages.find(m=>m.type==='error')?.code,'metadata');assert.equal(fixture.messages.some(m=>m.type==='bundle'),false);
});
