import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { authorButtons } from './button-preparation-fixture.ts';
import { prepareButtons } from '../src/button-preparation.ts';
import { DEFAULT_NUMBERING, planNumbering, applyNumbering, type NumberingOptions } from '../src/button-numbering.ts';
import { DATA_KEY, readMetadata } from '../src/model.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';

function fixture() {
  const f=fakeFigma(),api=f.api as unknown as PluginAPI;
  const root=api.createFrame();root.name='popupgroup_AudioControls';
  function button(parent:FrameNode=root,name='button_Box1',x=0,y=0) {
    const node=api.createFrame();node.name=name;node.x=x;node.y=y;node.resize(100,40);parent.appendChild(node);
    const text=api.createText();text.characters='Box 1';node.appendChild(text);return node;
  }
  function plan(options:Partial<NumberingOptions>={},selection:SceneNode[]=[...root.children]) {
    f.page.selection=selection as never;return planNumbering(selection,{...DEFAULT_NUMBERING,...options});
  }
  return {...f,api,root,button,plan};
}

test('24 duplicated buttons follow visual rows despite reversed layer order and fractional top edges',async()=>{
  const f=fixture(),buttons=Array.from({length:24},(_,i)=>f.button(f.root,'button_Box1',(i%6)*110,Math.floor(i/6)*50+(i%2)*.5));
  for(const b of [...buttons].reverse())f.root.appendChild(b);
  const plan=f.plan();assert.equal(plan.rows.length,24);assert.ok(buttons.every(b=>b.name==='button_Box1'),'preview is read-only');
  assert.equal((await applyNumbering(plan)).names,23);
  assert.deepEqual(buttons.map(b=>b.name),buttons.map((_,i)=>`button_Box${i+1}`));
  assert.ok(buttons.every(b=>(b.children[0] as TextNode).characters==='Box 1'),'labels are opt-in');
});

test('selected buttons keep independent parent counters; selecting parents adds no other buttons',async()=>{
  const f=fixture(),nested=f.api.createFrame();nested.name='Nested';f.root.appendChild(nested);
  const a=f.button(),b=f.button(nested,'btn_Box1'),c=f.button(nested,'fbtn_Box1',110);
  const untouched=f.button(nested,'button_Box1',220);
  const plan=f.plan({start:5},[f.root,nested,a,b,c]);await applyNumbering(plan);
  assert.deepEqual([a.name,b.name,c.name],['button_Box5','btn_Box5','fbtn_Box6']);
  assert.equal(new Set(plan.rows.map(r=>r.containerId)).size,2);
  assert.equal(plan.rows.length,3);assert.equal(untouched.name,'button_Box1');
});

test('partial selection reserves unselected siblings and never changes them',async()=>{
  const f=fixture(),a=f.button(),b=f.button(f.root,'button_Box1',110),c=f.button(f.root,'button_Box2',220);
  const plan=f.plan({},[b]);await applyNumbering(plan);
  assert.deepEqual([a.name,b.name,c.name],['button_Box1','button_Box3','button_Box2']);
});

test('repair reserves all existing numbers first, fills gaps, preserves genuine owner over earlier clone, and is idempotent',async()=>{
  const f=fixture(),owner=f.button(f.root,'button_Box4',220);
  owner.setPluginData(DATA_KEY,JSON.stringify({schema:'exui-node/3',kind:'button',key:'home.box',objectId:1,controlId:8101,buttonMode:'on-off',ownerNodeId:owner.id}));
  const clone=owner.clone();clone.x=0;const other=f.button(f.root,'button_Box2',110);
  await applyNumbering(f.plan({mode:'duplicates'}));
  assert.deepEqual([owner.name,clone.name,other.name],['button_Box4','button_Box1','button_Box2']);
  assert.deepEqual(await applyNumbering(f.plan({mode:'duplicates'})),{names:0,labels:0});
});

test('text updates include hidden states, keep state names, and can leave outer names intact',async()=>{
  const f=fixture(),button=f.button();button.children[0].remove();
  for(const name of ['Off','On','Pressed']){const state=f.api.createFrame();state.name=name;state.visible=name==='Off';button.appendChild(state);const text=f.api.createText();text.characters=name;state.appendChild(text);}
  const result=await applyNumbering(f.plan({names:false,labels:true,start:7}));
  assert.equal(button.name,'button_Box1');assert.deepEqual(result,{names:0,labels:3});
  assert.deepEqual(button.children.map(s=>s.name),['Off','On','Pressed']);
  assert.deepEqual(button.children.map(s=>(s as FrameNode).children[0]).map(t=>(t as TextNode).characters),['Box 7','Box 7','Box 7']);
});

test('a failed caption preflight makes no changes to any button',()=>{
  const f=fixture(),a=f.button(),b=f.button(f.root,'button_Box1',110),extra=f.api.createText();b.appendChild(extra);
  assert.throws(()=>f.plan({labels:true}),/ровно один/);
  assert.deepEqual([a.name,b.name],['button_Box1','button_Box1']);
  extra.remove();(b.children[0] as TextNode).fontName=f.api.mixed;
  assert.throws(()=>f.plan({labels:true}),/смешанное оформление/);
  assert.doesNotThrow(()=>f.plan(),'name-only works with complex text');
});

test('font load failure does not rename layers or update any captions',async()=>{
  const f=fixture(),b=f.button();f.api.loadFontAsync=async()=>{throw new Error('Font unavailable');};
  await assert.rejects(applyNumbering(f.plan({labels:true,start:5})),/Font unavailable/);
  assert.equal(b.name,'button_Box1');assert.equal((b.children[0] as TextNode).characters,'Box 1');
});

for(const change of ['selection','name','new-sibling','during-font-load'])test(`stale preview rejects ${change} without applying old plan`,async()=>{
  const f=fixture(),b=f.button(),plan=f.plan({labels:true,start:5});
  if(change==='selection')f.page.selection=[];
  if(change==='name')b.name='button_Changed';
  if(change==='new-sibling')f.button();
  if(change==='during-font-load')f.api.loadFontAsync=async()=>{f.page.selection=[];};
  await assert.rejects(applyNumbering(plan),/изменились/);
  assert.equal(b.name,change==='name'?'button_Changed':'button_Box1');
  assert.equal((b.children[0] as TextNode).characters,'Box 1');
});

test('write failure rolls back earlier names and text',async()=>{
  const f=fixture(),a=f.button(),b=f.button(f.root,'button_Box1',110),label=b.children[0] as TextNode;
  let value=label.characters;Object.defineProperty(label,'characters',{get:()=>value,set:(next:string)=>{if(next==='Box 6')throw new Error('Read only');value=next;}});
  await assert.rejects(applyNumbering(f.plan({labels:true,start:5})),/Read only/);
  assert.deepEqual([a.name,b.name],['button_Box1','button_Box1']);
  assert.equal((a.children[0] as TextNode).characters,'Box 1');assert.equal(label.characters,'Box 1');
});

test('a new container outside the selected buttons and their parents is outside the operation',async()=>{
  const f=fixture(),old=f.api.createFrame();old.name='Existing';f.root.appendChild(old);const b=f.button(old);
  const plan=f.plan({start:5},[b]),added=f.api.createFrame();added.name='New';f.root.appendChild(added);const other=f.button(added);
  await applyNumbering(plan);assert.equal(b.name,'button_Box5');assert.equal(other.name,'button_Box1');
});

test('parent frames, groups, sections and button descendants alone do not select buttons',()=>{
  const f=fixture(),b=f.button();
  for(const type of ['FRAME','GROUP','SECTION']){
    const parent=new f.FakeNode(type);parent.name='Container';f.page.appendChild(parent);parent.appendChild(b as never);
    assert.throws(()=>f.plan({},[parent as unknown as SceneNode]),/Выделите сами кнопки/);
    assert.equal(b.name,'button_Box1');
  }
  assert.throws(()=>f.plan({},[b.children[0]]),/Выделите сами кнопки/);
});

for(const mode of ['position','duplicates'] as const)test(`${mode}: both name and text changes are limited to directly selected buttons`,async()=>{
  const f=fixture(),a=f.button(),b=f.button(f.root,'button_Box1',110),c=f.button(f.root,'button_Box2',220);
  const before=[a,c].map(node=>JSON.stringify([node.name,(node.children[0] as TextNode).characters,node.getPluginData(DATA_KEY)]));
  const plan=f.plan({mode,labels:true},[b]);await applyNumbering(plan);
  assert.deepEqual([a,c].map(node=>JSON.stringify([node.name,(node.children[0] as TextNode).characters,node.getPluginData(DATA_KEY)])),before);
  assert.equal(b.name,'button_Box3');assert.equal((b.children[0] as TextNode).characters,'Box 3');
});

test('invalid options, empty selection, and component definitions are rejected',()=>{
  const f=fixture();f.button();
  for(const options of [{base:'Box_'},{base:'Ящик'},{base:'A'.repeat(65)},{start:0},{start:1.5},{names:false,labels:false},{mode:'unknown' as never}])assert.throws(()=>f.plan(options));
  assert.throws(()=>f.plan({},[]),/Выделите/);
  const component=new f.FakeNode('COMPONENT');component.name='button_Box1';f.page.appendChild(component);
  assert.throws(()=>f.plan({},[component as unknown as SceneNode]),/Выделите сами кнопки/);
});

test('renaming and text update preserve saved object/control/state IDs through the next export recognition',async()=>{
  const f=authorButtons(),buttons=f.buttons as unknown as GroupNode[];
  prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  const before=buttons.map(b=>[b,...b.children].map(n=>({id:n.id,metadata:n.getPluginData(DATA_KEY)})));
  f.page.selection=buttons as never;
  await applyNumbering(planNumbering(buttons,{...DEFAULT_NUMBERING,labels:true}));
  assert.deepEqual(buttons.map(b=>[b,...b.children].map(n=>({id:n.id,metadata:n.getPluginData(DATA_KEY)}))),before,'numbering never writes metadata');
  const next=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(next.errors,[]);applyRecognition(next);
  for(const [i,b] of buttons.entries()){
    const old=JSON.parse(before[i][0].metadata),now=readMetadata(b)!;
    assert.equal(now.objectId,old.objectId);assert.equal(now.controlId,old.controlId);
    assert.deepEqual(b.children.map(s=>readMetadata(s)?.stateId),before[i].slice(1).map(s=>JSON.parse(s.metadata).stateId));
  }
});

test('plugin messages use live selection independent of export mode and reject stale tokens',async()=>{
  const f=fixture(),b=f.button();f.page.selection=[b as never];
  const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'button-numbering-preview',scopeMode:'page',numbering:{...DEFAULT_NUMBERING,start:9}});
  const preview=f.messages.filter(m=>m.type==='numbering-plan').at(-1)!;
  assert.equal(b.name,'button_Box1');assert.equal((preview.rows as any[])[0].to,'button_Box9');
  await send({type:'button-numbering-apply',token:preview.token});
  assert.equal(b.name,'button_Box9');assert.equal(f.messages.filter(m=>m.type==='error').length,0);
  await send({type:'button-numbering-apply',token:preview.token});
  assert.equal(f.messages.filter(m=>m.type==='error').at(-1)?.code,'button-numbering-stale');
});
