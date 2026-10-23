import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { authorButtons, paint } from './button-preparation-fixture.ts';
import { png } from './kit-fixture.ts';
import { background, descendants } from '../src/button-artwork.ts';
import { buttonPreparationSummary, markBackground, prepareButtons, presetPreviews, presetSummary, rememberPreset } from '../src/button-preparation.ts';
import { capture, designSignature, exportFrame } from '../src/export.ts';
import { applyRecognition, recognize } from '../src/recognize.ts';
import { DATA_KEY, readMetadata } from '../src/model.ts';
import { kitFixture } from './kit-fixture.ts';
import { createKit } from '../src/kit.ts';

for(const fractional of ['icon-detail','caption'] as const)test(`Fractional ${fractional} inside raster artwork is preserved during preparation, recognition and export`,async()=>{
  const f=authorButtons(),button=f.buttons[0];
  const target=descendants(button).find(n=>fractional==='caption'?n.type==='TEXT':n.name==='Vector')!;
  target.x=5.14;target.y=7.25;target.resize(14.86,11.04);
  const geometry=[target.x,target.y,target.width,target.height];
  prepareButtons(f.root);
  const plan=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const before=designSignature(f.root),bundle=await exportFrame(f.root);
  assert.equal(bundle.resources.length,4);assert.equal(designSignature(f.root),before);
  assert.ok([target.x,target.y,target.width,target.height].every((v,i)=>Math.abs(v-geometry[i])<1e-9));
});

for(const [width,expected] of [[218.21,218],[218.7,219],[218.5,219]])test(`Fractional Group button ${width} rounds to ${expected} through recognition and PNG export`,async()=>{
  const f=authorButtons(),button=f.buttons[0],bg=background(button);
  button.x=10.21;button.y=10.7;button.resize(width,80.7);bg.resize(width,80.7);
  prepareButtons(f.root);
  const plan=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const before=designSignature(f.root),pageBefore=f.page.children.map(n=>n.id);
  let renders=0;
  f.setRenderHook(node=>{
    if(node.children[0]?.parent&&button.children.some(s=>s.name===node.children[0].name)){
      assert.deepEqual([node.width,node.height],[expected,81]);
      assert.deepEqual([node.children[0].width,node.children[0].height],[width,80.7]);renders++;
    }
    return png(Math.round(node.width),Math.round(node.height));
  });
  const bundle=await exportFrame(f.root),result=bundle.screen.elements.find(e=>e.controlId===readMetadata(button)!.controlId)!;
  assert.deepEqual(result.rect,[10,11,expected,81]);assert.equal(result.states!.length,2);assert.equal(renders,2);
  assert.equal(designSignature(f.root),before);assert.deepEqual(f.page.children.map(n=>n.id),pageBefore);
  button.children[1].resize(width-2,80.7);
  assert.ok(recognize(f.root,'tlp-pro-1025m').issues.some(i=>i.nodeId===button.children[1].id&&i.message.includes('всю кнопку')));
});

for (const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const) test(`${profile}: Group design → two states per prefix → export; repeated preparation and styling preserve IDs`, async () => {
  const f = authorButtons(profile), before = f.buttons.map(b => [b.id,b.type,b.x,b.y,b.width,b.height]);
  const originalChildren = f.buttons.map(b => b.children.map(n => n.id));
  assert.deepEqual(presetSummary(), {normal:'Passive',feedback:'Active'});
  assert.deepEqual(prepareButtons(f.root), {buttons:2,states:4,skipped:0});
  assert.deepEqual(f.buttons.map(b => [b.id,b.type,b.x,b.y,b.width,b.height]), before);
  assert.deepEqual(f.buttons.map(b => b.children.map(s => s.name)), [['Off','On'],['Normal','Active']]);
  for (const [i,b] of f.buttons.entries()) {
    const [normal,active] = b.children as GroupNode[];
    assert.deepEqual(normal.children.map(n => n.id), originalChildren[i]);
    assert.equal(normal.visible,true);assert.equal(active.visible,false);
    assert.deepEqual(background(normal).fills,f.normal.fills);assert.deepEqual(background(active).strokes,f.active.strokes);
    assert.equal(background(active).cornerRadius,4); // Corners are opt-in.
    assert.deepEqual(descendants(normal).filter(n => n.type==='TEXT').map(n => n.characters),[i?'Power':'Audio']);
  }
  const plan = recognize(f.root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const identities = f.buttons.map(b => b.getPluginData(DATA_KEY));
  const stateIds = f.buttons.flatMap(b => b.children.map(s => s.getPluginData(DATA_KEY)));
  const signature = designSignature(f.root), layers = f.page.children.map(n => n.id);
  const bundle = await exportFrame(f.root);
  assert.equal(bundle.resources.length,4);assert.equal(bundle.screen.assets.length,4);
  assert.deepEqual(bundle.screen.elements.map(e => e.states!.map(s => s.name)),[['Off','On'],['Normal','Active']]);
  assert.ok(bundle.screen.elements.every(e => e.states!.every(s => s.text==='' && s.fill==='#00000000')));
  assert.equal(designSignature(f.root),signature);assert.deepEqual(f.page.children.map(n => n.id),layers);
  assert.deepEqual(prepareButtons(f.root),{buttons:0,states:0,skipped:2});assert.equal(designSignature(f.root),signature);
  f.active.fills=[paint('#009900')];prepareButtons(f.root,{},true,true);
  assert.equal(background(f.buttons[0].children[1]).cornerRadius,8);
  assert.deepEqual(background(f.buttons[1].children[1]).fills,f.active.fills);
  assert.deepEqual(f.buttons.map(b => b.getPluginData(DATA_KEY)),identities);
  assert.deepEqual(f.buttons.flatMap(b => b.children.map(s => s.getPluginData(DATA_KEY))),stateIds);
  applyRecognition(recognize(f.root,profile));assert.deepEqual(f.buttons.map(b => b.getPluginData(DATA_KEY)),identities);
});

test('Outer Frame with its own fill becomes transparent; its paint moves inside, without moving original content', () => {
  const f=authorButtons(),original=f.buttons[0],outer=figma.createFrame();outer.name=original.name;outer.resize(120,80);outer.fills=[paint('#444444')];outer.strokes=[paint('#999999')];outer.cornerRadius=5;
  f.root.insertChild(0,outer);outer.x=original.x;outer.y=original.y;
  for(const child of [...original.children])if(child.type!=='RECTANGLE')outer.appendChild(child);original.remove();
  const positions=outer.children.map(n=>[n.id,n.absoluteBoundingBox]);prepareButtons(f.root);
  assert.equal(outer.type,'FRAME');assert.deepEqual(outer.fills,[]);assert.deepEqual(outer.strokes,[]);assert.equal(outer.cornerRadius,0);
  const state=outer.children[0] as GroupNode;
  assert.deepEqual(state.children.filter(n=>n.name!=='Background').map(n=>[n.id,n.absoluteBoundingBox]),positions);
  assert.deepEqual(state.children.map(n=>n.name),['Background','Voice','txt_title.place']);
});

test('A transparent outer Frame does not compete with its Background rectangle during preparation or export',()=>{
  const f=authorButtons(),group=f.buttons[0],outer=figma.createFrame();outer.name=group.name;outer.resize(group.width,group.height);outer.fills=[];
  f.root.insertChild(0,outer);outer.x=group.x;outer.y=group.y;
  for(const child of [...group.children])outer.appendChild(child);group.remove();
  const bg=outer.children[0];assert.equal(background(outer).id,bg.id);
  assert.equal(prepareButtons(f.root).states,4);const plan=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);assert.equal(capture(f.root).screen.elements.length,2);
});

test('Authored Frame states accept grouped icon artwork without requiring a generated-state marker',async()=>{
  const f=authorButtons();prepareButtons(f.root);
  for(const button of f.buttons)for(const group of [...button.children] as GroupNode[]){
    const state=figma.createFrame();state.name=group.name;state.resize(group.width,group.height);state.fills=background(group).fills;state.strokes=[];state.cornerRadius=0;state.visible=group.visible;
    button.insertChild(button.children.indexOf(group),state);state.x=0;state.y=0;
    for(const child of [...group.children])if(child.name!=='Rectangle 11')state.appendChild(child);
    group.remove();
  }
  const plan=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const before=designSignature(f.root),bundle=await exportFrame(f.root);assert.equal(bundle.resources.length,4);assert.equal(designSignature(f.root),before);
});

test('One authored Pressed on an ordinary button gains only Normal and exports as a two-state momentary button',()=>{
  const f=authorButtons();prepareButtons(f.root);const button=f.buttons[0];button.children[0].remove();button.children[0].name='Pressed';button.children[0].visible=true;
  const pressed=button.children[0],before=designSignature(pressed);
  assert.equal(prepareButtons(f.root).states,1);assert.deepEqual(button.children.map(n=>n.name),['Pressed','Normal']);assert.equal(designSignature(pressed),before);
  const plan=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const result=capture(f.root).screen.elements[0];assert.equal(result.press,'Pressed');assert.deepEqual(result.states!.map(s=>[s.name,s.stateId]),[['Normal',0],['Pressed',1]]);
});

test('Existing single On creates only Off; explicit style update applies the active sample to Pressed', () => {
  const f=authorButtons();prepareButtons(f.root);const b=f.buttons[0];b.children[0].remove();b.children[0].visible=true;
  const on=b.children[0],before=designSignature(on);assert.equal(on.name,'On');
  assert.equal(prepareButtons(f.root).states,1);assert.equal(designSignature(on),before);
  assert.deepEqual(b.children.map(s=>s.name),['On','Off']);assert.deepEqual(b.children.map(s=>s.visible),[true,false]);
  const feedback=f.buttons[1],pressed=feedback.children[1].clone();feedback.appendChild(pressed);pressed.name='Pressed';pressed.visible=false;
  background(pressed).fills=[paint('#FFFF00')];const pressedId=pressed.id;
  prepareButtons(f.root,{},true);assert.deepEqual(background(pressed).fills,f.active.fills);assert.equal(pressed.id,pressedId);assert.equal(pressed.visible,false);
  assert.deepEqual(prepareButtons(f.root),{buttons:0,states:0,skipped:2});
});

test('Native full-area centered text is omitted only from temporary PNG clone and remains editable in EXUI', async () => {
  const f=authorButtons();for(const b of f.buttons){const label=descendants(b).find(n=>n.type==='TEXT') as TextNode;label.x=0;label.y=0;label.resize(b.width,b.height);label.textAlignHorizontal='CENTER';label.textAlignVertical='BOTTOM';}
  prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  const texts:string[]=[];f.setRenderHook(node=>{assert.equal(node.type,'FRAME');texts.push(...descendants(node as never).filter(n=>n.type==='TEXT'&&!n.visible).map(n=>n.name));return png(node.width,node.height);});
  const before=designSignature(f.root),bundle=await exportFrame(f.root);assert.equal(texts.length,4);
  assert.deepEqual(bundle.screen.elements.map(e=>e.states!.map(s=>[s.text,s.textAlign])),[[['Audio','bottom-center'],['Audio','bottom-center']],[['Power','bottom-center'],['Power','bottom-center']]]);
  assert.equal(designSignature(f.root),before);
});

test('Ambiguous background blocks all writes; explicit choice is copied, remembered and can be cleared', () => {
  const f=authorButtons(),b=f.buttons[1],duplicate=b.children[0].clone();b.appendChild(duplicate);
  const before=designSignature(f.root);assert.throws(()=>prepareButtons(f.root),/несколько слоёв/);assert.equal(designSignature(f.root),before);
  markBackground(duplicate);assert.equal(background(b).id,duplicate.id);prepareButtons(f.root);
  const state=b.children[0] as GroupNode;assert.equal(background(state).id,duplicate.id);
  assert.equal(background(b.children[1]).getPluginData('exui-button-background'),'1');
  markBackground(duplicate);assert.throws(()=>background(state),/несколько слоёв/);
});

test('Preset references survive rename and restart; deleted explicit preset and equal styles fail without changing the design', () => {
  const f=authorButtons();rememberPreset(f.normal,'normal');rememberPreset(f.active,'feedback');f.normal.name='Custom idle';f.active.name='Custom active';
  assert.deepEqual(presetSummary(),{normal:'Custom idle',feedback:'Custom active'});
  f.active.fills=f.normal.fills;f.active.strokes=f.normal.strokes;f.active.strokeWeight=f.normal.strokeWeight;
  const before=designSignature(f.root);assert.throws(()=>prepareButtons(f.root),/должны различаться/);assert.equal(designSignature(f.root),before);
  f.active.remove();assert.equal(presetSummary().feedback,'Не выбран');assert.throws(()=>prepareButtons(f.root),/Не найден активный/);assert.equal(designSignature(f.root),before);
});

test('Failure after first button grouping restores original IDs, paint, geometry and hierarchy across the batch', () => {
  const f=authorButtons(),before=designSignature(f.root),pageBefore=f.page.children.map(n=>n.id),original=f.api.group;let groups=0;
  f.api.group=(...args)=>{if(++groups===2)throw new Error('group failure');return original(...args);};
  assert.throws(()=>prepareButtons(f.root),/group failure/);assert.equal(designSignature(f.root),before);assert.deepEqual(f.page.children.map(n=>n.id),pageBefore);
});

test('Failed PNG rendering removes temporary clones and preserves hidden states and original node IDs', async () => {
  const f=authorButtons();prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  const before=designSignature(f.root),pageBefore=f.page.children.map(n=>n.id);f.setRenderHook(()=>{throw new Error('raster failure');});
  await assert.rejects(()=>exportFrame(f.root),/raster failure/);assert.equal(designSignature(f.root),before);assert.deepEqual(f.page.children.map(n=>n.id),pageBefore);
});

test('Failure preparing the temporary PNG viewport cleans up both the viewport and the unattached clone', async () => {
  const f=authorButtons();prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  const before=designSignature(f.root),pageBefore=f.page.children.map(n=>n.id),create=f.api.createFrame;
  f.api.createFrame=()=>{const node=create();node.resize=()=>{throw new Error('viewport failure');};return node;};
  await assert.rejects(()=>exportFrame(f.root),/viewport failure/);assert.equal(designSignature(f.root),before);assert.deepEqual(f.page.children.map(n=>n.id),pageBefore);
});

test('A manually added raster caption does not change the shared native font of the other states', () => {
  const f=authorButtons(),b=f.buttons[1];
  const text=descendants(b).find(n=>n.type==='TEXT') as TextNode;text.x=0;text.y=0;text.resize(b.width,b.height);text.textAlignHorizontal='CENTER';text.textAlignVertical='CENTER';text.fontSize=24;
  prepareButtons(f.root);const pressed=b.children[1].clone();b.appendChild(pressed);pressed.name='Pressed';pressed.visible=false;
  const caption=descendants(pressed).find(n=>n.type==='TEXT') as TextNode;caption.resize(100,24);caption.y=50;
  const plan=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const button=capture(f.root).screen.elements[1];assert.equal(button.font!.size,18);assert.deepEqual(button.states!.map(s=>s.text),['Power','Power','']);
});

test('Ready Kit instances are skipped when creating states for fresh groups on the same screen', async () => {
  const fake=kitFixture(),kit=await createKit('tlp-pro-1025m'),f=authorButtons('tlp-pro-1025m',fake);
  const component=kit.components.find(n=>n.name==='feedbackbutton_Music')!,instance=component.createInstance();f.root.appendChild(instance);instance.x=150;instance.y=10;
  const before=designSignature(instance);assert.deepEqual(prepareButtons(f.root),{buttons:2,states:4,skipped:1});assert.equal(designSignature(instance),before);
});

test('Multiple screens produce distinct artwork resource paths; copied buttons retain original identity and get their own assets', () => {
  const f=authorButtons();prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  const copied=f.root.clone();copied.name='screen_Audio';const options={members:[f.root,copied]};
  const metadata=f.buttons.map(b=>b.getPluginData(DATA_KEY));const plan=recognize(figma.currentPage,'tlp-pro-1025m',options);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const result=capture(figma.currentPage,readMetadata,options);assert.equal(result.screen.assets.length,8);assert.equal(new Set(result.screen.assets.map(a=>a.file)).size,8);
  assert.deepEqual(f.buttons.map(b=>b.getPluginData(DATA_KEY)),metadata);
});

test('Built plugin commands: remember presets → create groups → check → preview → restart → update style', async () => {
  const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
  const f=authorButtons();vm.runInNewContext(source,{figma:f.api,Uint8Array,console});const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  f.page.selection=[f.normal as never];await send({type:'button-preset-normal'});f.page.selection=[f.active as never];await send({type:'button-preset-active'});
  f.page.selection=[f.root as never];await send({type:'button-create-states',corners:true});await send({type:'check'});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);assert.equal(readMetadata(f.buttons[0])?.buttonMode,'on-off');
  const identity=f.buttons[0].getPluginData(DATA_KEY);f.page.selection=[f.buttons[0] as never];f.emit('selectionchange');
  assert.equal((f.messages.filter(m=>m.type==='selection').at(-1)?.states as any[]).length,2);await send({type:'preview',stateId:1});assert.deepEqual(f.buttons[0].children.map(n=>n.visible),[false,true]);
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});f.active.fills=[paint('#00FF00')];f.page.selection=[background(f.buttons[0].children[0]) as never];
  await (f.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'button-update-styles'});
  assert.equal(JSON.stringify(background(f.buttons[0].children[1]).fills),JSON.stringify(f.active.fills));assert.equal(f.buttons[0].getPluginData(DATA_KEY),identity);
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
});

test('One apply prepares fresh buttons and updates ready states including Pressed, preserving artwork, IDs and visibility', () => {
  const f=authorButtons();prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  const ready=f.buttons[1],pressed=ready.children[1].clone();ready.appendChild(pressed);pressed.name='Pressed';pressed.visible=false;
  for(const n of descendants(pressed))n.setPluginData(DATA_KEY,'');
  const identities=f.buttons.flatMap(b=>[b,...b.children]).map(n=>[n,n.getPluginData(DATA_KEY)] as const);
  const originalArt=f.buttons.flatMap(b=>descendants(b).filter(n=>n.type==='TEXT'||n.name==='Voice').map(n=>[n,designSignature(n)] as const));
  const bg=f.api.createRectangle();bg.resize(120,80);bg.fills=[paint('#111111')];
  const raw=f.api.group([bg],f.root);raw.name='button_New';raw.x=150;raw.y=10;
  f.active.fills=[paint('#003366')];f.normal.fills=[paint('#151515')];
  assert.deepEqual(buttonPreparationSummary(f.root),{total:3,create:1,update:2});
  assert.deepEqual(prepareButtons(f.root,{},'apply',true),{buttons:3,states:2,skipped:0});
  for(const b of [f.buttons[0],ready,raw]) {
    assert.deepEqual(background(b.children[0]).fills,f.normal.fills);assert.deepEqual(background(b.children[1]).fills,f.active.fills);
    assert.deepEqual(b.children.slice(0,2).map(s=>s.visible),[true,false]);
  }
  for(const [n,identity] of identities)assert.equal(n.getPluginData(DATA_KEY),identity);
  for(const [n,signature] of originalArt)assert.equal(designSignature(n),signature);
  assert.deepEqual(background(pressed).fills,f.active.fills);assert.equal(pressed.visible,false);
  const repeated=designSignature(f.root);prepareButtons(f.root,{},'apply',true);assert.equal(designSignature(f.root),repeated);
  assert.deepEqual(buttonPreparationSummary(f.root),{total:3,create:0,update:3});
  const plan=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  assert.deepEqual(capture(f.root).screen.elements.map(e=>e.states?.length),[2,3,2]);
});

test('Combined apply restores ready styles if a fresh button fails during grouping', () => {
  const f=authorButtons();prepareButtons(f.root,{members:[f.buttons[0]]});
  f.normal.fills=[paint('#990000')];f.active.fills=[paint('#009900')];
  const before=designSignature(f.root),pageLayers=f.page.children.map(n=>n.id);
  f.api.group=()=>{throw new Error('fixture grouping failure');};
  assert.throws(()=>prepareButtons(f.root,{},'apply'),/fixture grouping failure/);
  assert.equal(designSignature(f.root),before);assert.deepEqual(f.page.children.map(n=>n.id),pageLayers);
});

test('Combined apply restores existing styles and original fresh artwork after a later clone fails', () => {
  const f=authorButtons();prepareButtons(f.root,{members:[f.buttons[0]]});f.normal.fills=[paint('#990000')];
  const before=designSignature(f.root),pageLayers=f.page.children.map(n=>n.id),clone=f.FakeNode.prototype.clone;
  f.FakeNode.prototype.clone=function(){if(this.name==='Normal')throw new Error('fixture clone failure');return clone.call(this);};
  assert.throws(()=>prepareButtons(f.root,{},'apply'),/fixture clone failure/);
  assert.equal(designSignature(f.root),before);assert.deepEqual(f.page.children.map(n=>n.id),pageLayers);
});

test('Combined apply updates the source of a single state and styles momentary Pressed with the active sample', () => {
  const f=authorButtons();prepareButtons(f.root);
  const single=f.buttons[1];single.children[0].remove();const active=single.children[0];active.visible=true;
  const momentary=f.buttons[0];momentary.children[0].name='Normal';momentary.children[1].name='Pressed';const pressed=momentary.children[1],pressedId=pressed.id;
  f.active.fills=[paint('#FF7700')];f.normal.fills=[paint('#111111')];
  prepareButtons(f.root,{},'apply');assert.deepEqual(background(active).fills,f.active.fills);assert.equal(active.visible,true);
  assert.deepEqual(single.children.map(s=>s.name),['Active','Normal']);assert.deepEqual(background(single.children[1]).fills,f.normal.fills);
  assert.deepEqual(background(pressed).fills,f.active.fills);assert.equal(pressed.id,pressedId);assert.equal(pressed.visible,false);assert.deepEqual(momentary.children.map(s=>s.name),['Normal','Pressed']);
});

test('Combined apply validates existing backgrounds before changing a fresh button', () => {
  const f=authorButtons();prepareButtons(f.root,{members:[f.buttons[1]]});
  const s=f.buttons[1].children[0] as GroupNode;s.appendChild(background(s).clone());
  const before=designSignature(f.root);assert.ok(buttonPreparationSummary(f.root).updateIssue?.includes('несколько'));
  assert.throws(()=>prepareButtons(f.root,{},'apply'),/несколько/);assert.equal(designSignature(f.root),before);
});

test('Skipping ready buttons applies styles only to fresh buttons and does not validate or change ready backgrounds', () => {
  const f=authorButtons();prepareButtons(f.root,{members:[f.buttons[0]]});
  const state=f.buttons[0].children[0] as GroupNode;state.appendChild(background(state).clone());
  const before=designSignature(f.buttons[0]);f.normal.fills=[paint('#111111')];f.active.fills=[paint('#FF7700')];
  assert.deepEqual(prepareButtons(f.root,{},'apply-new'),{buttons:1,states:2,skipped:1});
  assert.equal(designSignature(f.buttons[0]),before);
  assert.deepEqual(background(f.buttons[1].children[0]).fills,f.normal.fills);assert.deepEqual(background(f.buttons[1].children[1]).fills,f.active.fills);
});

test('Preset previews report actual color, ambiguous samples and a deleted explicit source without changing the page', () => {
  const f=authorButtons(),before=designSignature(f.root);
  assert.deepEqual(presetPreviews().feedback,{name:'Active',ready:true,hint:'',fill:'rgba(0,119,170,1)',stroke:'rgba(0,187,255,1)',radius:8});
  assert.equal(designSignature(f.root),before);
  const duplicate=f.normal.clone();duplicate.name='Off';assert.equal(presetPreviews().normal.ready,false);assert.match(presetPreviews().normal.hint,/несколько/);
  rememberPreset(f.normal,'normal');assert.equal(presetPreviews().normal.ready,true);f.normal.remove();assert.equal(presetPreviews().normal.ready,false);assert.match(presetPreviews().normal.hint,/удалён/);
});

test('Built combined command publishes selection guidance, counts and a scoped success for the next export step', async () => {
  const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
  const f=authorButtons();vm.runInNewContext(source,{figma:f.api,Uint8Array,console});const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  f.page.selection=[f.styles as never];await send({type:'ready'});
  const sample=f.messages.filter(m=>m.type==='selection').at(-1)!;assert.equal(sample.scope,undefined);assert.equal((sample.buttonStylePreviews as any).normal.ready,true);
  f.page.selection=[f.root as never];await send({type:'ready'});
  assert.deepEqual(JSON.parse(JSON.stringify(f.messages.filter(m=>m.type==='selection').at(-1)!.buttonWorkflow)),{total:2,create:2,update:0});
  await send({type:'button-apply-styles',corners:true});
  assert.ok(f.messages.some(m=>m.type==='success'&&m.operation==='button-apply-styles'));
  assert.deepEqual(JSON.parse(JSON.stringify(f.messages.filter(m=>m.type==='selection').at(-1)!.buttonWorkflow)),{total:2,create:0,update:2});
  const before=designSignature(f.root);await send({type:'button-apply-styles'});
  assert.equal(f.messages.filter(m=>m.type==='error').at(-1)?.code,'button-existing');assert.equal(designSignature(f.root),before);
  f.messages.splice(0);await send({type:'button-apply-styles',existing:'skip'});assert.equal(designSignature(f.root),before);
  const unchanged=f.messages.filter(m=>m.type==='success'&&m.operation==='button-apply-styles').at(-1)!;
  assert.match(String(unchanged.message),/Область: screen_Home\. Изменений нет\./);
  assert.match(String(unchanged.message),/Подготовлено кнопок: 0; обновлено готовых: 0; новых состояний: 0; пропущено готовых: 2/);
  f.active.fills=[paint('#FF7700')];await send({type:'button-apply-styles',existing:'update'});
  assert.equal(JSON.stringify(background(f.buttons[0].children[1]).fills),JSON.stringify(f.active.fills));
  await send({type:'check'});assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
});
