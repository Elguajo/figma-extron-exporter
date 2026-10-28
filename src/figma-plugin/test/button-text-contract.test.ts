import test from 'node:test';
import assert from 'node:assert/strict';
import {authorButtons,paint} from './button-preparation-fixture.ts';
import {prepareButtons} from '../src/button-preparation.ts';
import {BUTTON_TEXT_KEY,setButtonTextMode} from '../src/button-native-text.ts';
import {descendants} from '../src/button-artwork.ts';
import {recognize,applyRecognition} from '../src/recognize.ts';
import {capture,designSignature,exportFrame} from '../src/export.ts';
import {DATA_KEY,readMetadata} from '../src/model.ts';
import {png} from './kit-fixture.ts';

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)
for(const prefix of ['button','btn','feedbackbutton','fbtn'])test(`${profile} / ${prefix}: caption is native Button text without applying a text command`,async()=>{
 const f=authorButtons(profile),button=f.buttons[0];f.buttons[1].remove();button.name=prefix+'_CH01';prepareButtons(f.root);
 for(const [i,state] of button.children.entries()){
  const label=descendants(state).find(n=>n.type==='TEXT') as TextNode;
  label.fontName={family:'Inter',style:'Regular'};label.characters=i?'BGM Selected':'BGM Music';label.fills=[paint(i?'#000000':'#FFFFFF')];
 }
 const plan=recognize(f.root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
 const before=designSignature(f.root),saved=button.getPluginData(DATA_KEY),id=readMetadata(button)!.controlId;
 const captured=capture(f.root);assert.equal(captured.screen.elements.length,1);
 const element=captured.screen.elements[0];assert.equal(element.kind,'button');assert.equal(element.controlId,id);
 assert.deepEqual(element.states!.map(s=>s.text),['BGM Music','BGM Selected']);
 assert.ok(captured.images.every(i=>!!i.artwork?.omitTextId));assert.equal(button.getPluginData(BUTTON_TEXT_KEY),'');
 f.setRenderHook(node=>{assert.equal(descendants(node as unknown as SceneNode).some(n=>n.type==='TEXT'&&n.visible&&n.opacity!==0),false,'caption must not be painted into the state PNG');return png(Math.round(node.width),Math.round(node.height));});
 await exportFrame(f.root);assert.equal(designSignature(f.root),before);assert.equal(button.getPluginData(DATA_KEY),saved);
 button.name='ibtn_CH01';const raster=capture(f.root).screen.elements[0];
 assert.ok(raster.states!.every(s=>s.text===''));assert.equal(raster.controlId,id);
});

test('Resetting old design mode restores native text; image prefix alone selects complete PNG',()=>{
 const f=authorButtons();prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
 setButtonTextMode(f.root,{},'bottom-center');setButtonTextMode(f.root,{},'design');
 const captured=capture(f.root);assert.equal(captured.screen.elements.length,2);
 assert.ok(captured.screen.elements.every(e=>e.kind==='button'&&e.states!.every(s=>s.text)));
});

for(const problem of ['multiple','font','mask'] as const)test(`${problem}: ordinary button refuses an uneditable caption instead of rasterizing it`,()=>{
 const f=authorButtons();prepareButtons(f.root);const state=f.buttons[0].children[0],label=descendants(state).find(n=>n.type==='TEXT') as TextNode;
 if(problem==='multiple')state.appendChild(label.clone());
 if(problem==='font')label.fontName={family:'Unsupported',style:'Regular'};
 if(problem==='mask')state.children[0].isMask=true;
 const before=designSignature(f.root),plan=recognize(f.root,'tlp-pro-1025m');assert.ok(plan.errors.length);
 assert.match(plan.errors.join('\n'),/imagebutton_|ibtn_/);assert.equal(designSignature(f.root),before);
});

test('Icon-only ordinary button with a nested Frame needs no dummy Text',()=>{
 const f=authorButtons();f.buttons.forEach(b=>b.remove());
 const button=figma.createFrame();button.name='button_Back';button.resize(55,55);button.fills=[];f.root.appendChild(button);
 for(const [i,name] of ['Normal','Pressed'].entries()){
  const state=figma.createFrame();state.name=name;state.resize(55,55);state.fills=[paint(i?'#D0AC68':'#181B1C')];state.visible=!i;button.appendChild(state);
  const icon=figma.createFrame();icon.name='Icon';icon.resize(20,20);icon.x=17;icon.y=17;state.appendChild(icon);
 }
 const plan=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
 const e=capture(f.root).screen.elements[0];assert.equal(e.kind,'button');assert.equal(e.press,'Pressed');assert.ok(e.states!.every(s=>s.text===''&&s.image));
});

test('Plain state with an empty direct placeholder and a nested caption cannot hide its text in an icon PNG',()=>{
 const f=authorButtons();f.buttons.forEach(b=>b.remove());
 const button=figma.createFrame();button.name='button_Nested';button.resize(120,80);button.fills=[];f.root.appendChild(button);
 for(const [i,name] of ['Off','On'].entries()){
  const state=figma.createFrame();state.name=name;state.resize(120,80);state.fills=[paint(i?'#0077AA':'#222222')];state.visible=!i;button.appendChild(state);
  const empty=figma.createText();empty.characters='';empty.resize(120,80);state.appendChild(empty);
  const content=figma.createFrame();content.name='Artwork';content.resize(120,80);content.fills=[];state.appendChild(content);
  const label=figma.createText();label.characters=i?'Selected':'BGM Music';label.fills=[paint('#FFFFFF')];label.resize(90,24);label.x=15;label.y=28;content.appendChild(label);
 }
 const plan=recognize(f.root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
 const result=capture(f.root);assert.equal(result.screen.elements.length,1);
 assert.deepEqual(result.screen.elements[0].states!.map(s=>s.text),['BGM Music','Selected']);
 assert.ok(result.images.every(i=>!!i.artwork?.omitTextId));
});
