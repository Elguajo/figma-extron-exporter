import test from 'node:test';
import assert from 'node:assert/strict';
import { createKit } from '../src/kit.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { capture,designSignature,exportFrame } from '../src/export.ts';
import { DATA_KEY } from '../src/model.ts';
import { kitFixture } from './kit-fixture.ts';
import { packageExui } from '../src/package.ts';
import { unzipSync } from 'fflate';
import { DATETIME_FORMATS } from '../src/datetime-format.ts';
import { contrastRatio } from '../src/button-contrast.ts';
import catalog from '../../../docs/design/extron-kit/kit.json' with {type:'json'};

const momentaryNames=['button_VolumeUp','button_VolumeDown','button_Back','button_Home','button_Settings'];

test('Apple-inspired palette keeps label contrast and a discernible slider thumb',()=>{
  const rgb=(hex:string)=>({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255});
  const c=catalog.colors;
  for(const [fg,bg]of [[c.ink,c.control],[c.ink,c.surface],[c.muted,c.canvas],[c.muted,c.surface],[c.onAccent,c.active],[c.onAccent,c.pressed],[c.onAccent,c.success],[c.onAccent,c.danger],[c.onAccent,c.dangerPressed]])assert.ok(contrastRatio(rgb(fg),rgb(bg))>=4.5,`${fg} on ${bg}`);
  assert.ok(contrastRatio(rgb(c.accent),rgb(c.track))>=3);
});

test('Figma rejects component property bindings inside slot content',()=>{
  const fake=kitFixture(),master=(fake.api as any).createComponent(),slot=master.createSlot(),text=fake.api.createText() as any;
  slot.appendChild(text);
  assert.throws(()=>{text.componentPropertyReferences={characters:'Label#1'};},/slot sublayer/);
});

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)
test(`Kit ${profile}: components, slots, native controls → recognition → valid package, source masters unchanged`,async()=>{
  const fake=kitFixture(),kit=await createKit(profile);
  assert.equal(kit.components.length,29+DATETIME_FORMATS.length);assert.equal(kit.dateTime.type,'COMPONENT_SET');assert.equal(kit.dateTime.name,'datetime_Clock');assert.equal(fake.page.selection[0].id,kit.example.id);
  const chapters=kit.library.children.filter(n=>n.type==='FRAME') as FrameNode[];
  assert.deepEqual(chapters.map(n=>n.name),['00 / Начало работы','01 / Основы и состояния','02 / Компоненты и AV-пресеты','03 / Дата и время']);
  const overlaps=(a:SceneNode,b:SceneNode)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
  for(const [index,a]of chapters.entries())for(const b of chapters.slice(index+1))assert.equal(overlaps(a,b),false,`${a.name} overlaps ${b.name}`);
  const templateBoard=kit.templates[0].parent as FrameNode,examplesBoard=kit.example.parent as FrameNode;
  assert.equal(templateBoard.name,'Extron Kit / 04 — Шаблоны');assert.equal(examplesBoard.name,'Extron Kit / 05 — Готовые экраны');
  assert.ok(templateBoard.y>=kit.library.y+kit.library.height+240);assert.equal(overlaps(templateBoard,examplesBoard),false);
  const master=designSignature(kit.library),before=designSignature(kit.example);
  const plan=recognize(kit.example,profile);assert.deepEqual(plan.errors,[]);assert.equal(designSignature(kit.example),before);applyRecognition(plan);
  const bundle=await exportFrame(kit.example);assert.equal(bundle.screen.schema,'exui-screen/5');assert.equal(designSignature(kit.library),master);
  assert.equal(bundle.screen.elements.find(e=>e.kind==='slider')!.native!.thumbType,'ellipse');
  assert.equal(bundle.screen.elements.find(e=>e.kind==='slider')!.native!.trackWidth,8);
  assert.equal(bundle.screen.elements.find(e=>e.kind==='slider')!.fillColor,'#0066CC');
  for(const element of bundle.screen.elements.filter(e=>['label','value','datetime'].includes(e.kind)))assert.equal(element.font!.family,'Inter');
  assert.equal(bundle.screen.elements.find(e=>e.kind==='value')!.text,'42%');
  assert.deepEqual(bundle.screen.elements.find(e=>e.kind==='datetime')!.native,{pattern:'MMMM d, h:mm tt'});
  assert.equal(bundle.screen.elements.find(e=>e.kind==='label')!.text,profile==='tlp-pro-1025m'?'Hall / AV Control':'Room control');
  for(const button of bundle.screen.elements.filter(e=>e.kind==='button'))assert.ok(button.states!.every(s=>s.text===''&&s.image));
  assert.ok(Object.keys(unzipSync(packageExui(bundle))).length>2);
  const ids=bundle.screen.elements.map(e=>[e.key,e.objectId,e.controlId]);
  kit.example.children[1].x+=1;const again=recognize(kit.example,profile);assert.deepEqual(again.errors,[]);assert.equal(again.writes.length,0);applyRecognition(again);
  assert.deepEqual(capture(kit.example).screen.elements.map(e=>[e.key,e.objectId,e.controlId]),ids);
  assert.ok(kit.components.every(n=>!n.getPluginData(DATA_KEY)));
  const project=recognize(kit.templates[0],profile);assert.deepEqual(project.errors,[]);
  const music=kit.example.children.find(n=>n.name==='feedbackbutton_Music') as FrameNode;
  assert.deepEqual(music.children.map(n=>[n.name,n.visible]),[['Normal',false],['Active',true],['Pressed',false]]);
  assert.ok((music.children[1] as FrameNode).children.some(n=>'children'in n&&n.children.some(c=>c.name==='Selection mark')));
  for(const button of bundle.screen.elements.filter(e=>e.kind==='button'))assert.ok(button.states!.every(s=>s.fill==='#00000000'));
  if(profile==='tlp-pro-1025m')assert.deepEqual(bundle.screen.elements.filter(e=>e.kind==='shape').map(e=>e.native!.radius),[24,24,24]);
});

test('Repeated fresh instances preserve service names and get distinct stable keys and IDs',async()=>{
  const fake=kitFixture(),kit=await createKit('tlp-pro-300m-portrait');
  for(const child of [...kit.example.children])child.remove();
  const master=kit.components.find(n=>n.name==='button_Button')!;
  for(let i=0;i<3;i++){const instance=master.createInstance();kit.example.appendChild(instance);instance.x=10;instance.y=i*100;}
  let plan=recognize(kit.example,'tlp-pro-300m-portrait');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const first=capture(kit.example).screen.elements;assert.deepEqual(first.map(e=>e.key),['home.button','home.button-2','home.button-3']);
  assert.equal(new Set(first.map(e=>e.controlId)).size,3);assert.ok(kit.example.children.every(n=>n.name==='button_Button'));
  // Place a fresh instance before existing ones: the saved suffixes must stay reserved.
  const extra=master.createInstance();kit.example.appendChild(extra);extra.x=10;extra.y=300;
  (kit.example.children as any).unshift((kit.example.children as any).pop());
  plan=recognize(kit.example,'tlp-pro-300m-portrait');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  assert.equal(capture(kit.example).screen.elements[0].key,'home.button-4');
  assert.deepEqual(capture(kit.example).screen.elements.slice(1).map(e=>[e.key,e.controlId]),first.map(e=>[e.key,e.controlId]));
});

test('Custom slot layers are rasterized; native text wrappers and invalid external structure remain validated',async()=>{
  const fake=kitFixture(),kit=await createKit('tlp-pro-300m-portrait'),button=kit.example.children.find(n=>n.name==='feedbackbutton_Music') as FrameNode;
  const art=(button.children[0] as FrameNode).children[0] as FrameNode,design=fake.api.createFrame();design.name='My arbitrary design';design.cornerRadius=12;design.effects=[{type:'DROP_SHADOW'}];design.resize(220,64);art.appendChild(design as never);
  let plan=recognize(kit.example,'tlp-pro-300m-portrait');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const before=designSignature(kit.example);await exportFrame(kit.example);assert.equal(designSignature(kit.example),before);
  const value=kit.example.children.find(n=>n.name==='value_VolumeValue') as FrameNode;
  (value.children[0] as TextNode).x=1;assert.throws(()=>capture(kit.example),/Content/);
  (value.children[0] as TextNode).x=0;button.cornerRadius=8;assert.throws(()=>capture(kit.example),/скругление/);
});

test('Creation failure removes only new kit content and restores the user selection',async()=>{
  const fake=kitFixture(),existing=fake.api.createFrame();existing.name='User design';fake.page.selection=[existing];
  (fake.api as any).createComponent=()=>{throw new Error('Slots unavailable in host');};
  await assert.rejects(()=>createKit('tlp-pro-1025m'),/Slots unavailable/);
  assert.deepEqual(fake.page.children,[existing]);assert.deepEqual(fake.page.selection,[existing]);
});

test('Creating a fresh kit preserves an assigned older kit and its Off/On instances',async()=>{
  kitFixture();const old=await createKit('tlp-pro-1025m');
  for(const button of old.example.children.filter(n=>n.name==='button_VolumeUp'||n.name==='button_VolumeDown')){
    for(const [index,state]of (button as FrameNode).children.entries()){
      state.name=index===0?'Off':'On';
      (state as FrameNode).children[0].name='Artwork / '+state.name;
    }
  }
  const plan=recognize(old.example,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const before=await exportFrame(old.example),signature=designSignature(old.example),library=designSignature(old.library);
  const fresh=await createKit('tlp-pro-1025m');
  assert.notEqual(fresh.library.id,old.library.id);
  assert.equal(designSignature(old.example),signature);assert.equal(designSignature(old.library),library);
  assert.deepEqual((await exportFrame(old.example)).screen,before.screen);
  for(const button of before.screen.elements.filter(e=>e.name==='button_VolumeUp'||e.name==='button_VolumeDown')){
    assert.deepEqual(button.states!.map(s=>s.role),['normal','feedback']);assert.equal(button.press,undefined);
  }
});

test('Every generated control has an exportable contract, including multilevel and native primitives',async()=>{
 const fake=kitFixture(),kit=await createKit('tlp-pro-300m-portrait');
 for(const master of kit.components.filter(n=>n.name!=='popupref_Popup')){
  for(const child of [...kit.example.children])child.remove();
  const instance=master.createInstance();kit.example.appendChild(instance);instance.x=0;instance.y=0;
  // Variants are 440 px wide; the 300M canvas is 320 px.
  if(instance.width>320){instance.resize(320,instance.height);for(const child of instance.children)(child as TextNode).resize(320,child.height);}
  const plan=recognize(kit.example,'tlp-pro-300m-portrait');assert.deepEqual(plan.errors,[],master.name);applyRecognition(plan);
  const bundle=await exportFrame(kit.example);assert.ok(packageExui(bundle).length>0,master.name);
  if(momentaryNames.includes(master.name)){
    const button=bundle.screen.elements[0];
    assert.equal(button.kind,'button');assert.equal(button.press,'Pressed');
    assert.deepEqual(button.states!.map(s=>[s.stateId,s.name,s.role]),[[0,'Normal','normal'],[1,'Pressed','pressed']]);
    assert.deepEqual(button.states!.map(s=>s.fill),['#00000000','#00000000'],'PNG buttons must reveal the screen under rounded corners');
    assert.ok(button.states!.every(s=>s.image));
    assert.deepEqual(instance.children.map(s=>[s.name,s.visible]),[['Normal',true],['Pressed',false]]);
    assert.ok((instance.children as FrameNode[]).every(s=>s.cornerRadius===16&&s.clipsContent));
    const artwork=(instance.children as FrameNode[]).map(s=>s.children[0] as FrameNode);
    const paints=artwork.map(a=>a.children.find(n=>n.name==='Background') as FrameNode).map(n=>n.fills[0] as SolidPaint);
    const hex=(p:SolidPaint)=>'#'+[p.color.r,p.color.g,p.color.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase();
    assert.deepEqual(paints.map(hex),['#E8E8ED','#004C99']);
    assert.deepEqual(artwork.map(a=>hex((a.children.find(n=>n.name==='Label') as TextNode).fills[0] as SolidPaint)),['#1D1D1F','#FFFFFF']);
  }
  // This loop starts a fresh screen assignment for each independent component.
  kit.example.setPluginData(DATA_KEY,'');kit.example.setPluginData('exui-id-registry','');
 }
});
