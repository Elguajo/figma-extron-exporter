import test from 'node:test';
import assert from 'node:assert/strict';
import {authorButtons,paint} from './button-preparation-fixture.ts';
import {prepareButtons} from '../src/button-preparation.ts';
import {recognize,applyRecognition} from '../src/recognize.ts';
import {capture,exportFrame,designSignature,nativeTextRect} from '../src/export.ts';
import {font} from '../src/read-node.ts';
import {readMetadata} from '../src/model.ts';

const weights=['Thin','Extra Light','Light','Regular','Medium','Semi Bold','Bold','Extra Bold','Black'];
for(const family of ['Inter','Inter Display'])test(`${family}: all 18 static styles remain native including Medium and SemiBold aliases`,()=>{
  const f=authorButtons(),label=figma.createText();label.fontName={family,style:'Regular'};
  for(const style of weights.concat(weights.map(w=>w==='Regular'?'Italic':w+' Italic'))){
    label.fontName={family,style};assert.equal(font(label).family,family);assert.equal(font(label).style,style);assert.equal(font(label).bold,style==='Bold'||style==='Bold Italic');
  }
  label.fontName={family,style:'SemiBold'};assert.equal(font(label).style,'Semi Bold');
  label.fontName={family,style:'Book'};assert.throws(()=>font(label),(e:any)=>e.code==='font');
});
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)test(`${profile}: Inter labels, Value and DateTime preserve all native alignments and assignments`,async()=>{
  const f=authorButtons(profile);prepareButtons(f.root);
  const label=figma.createText();f.root.appendChild(label);label.name='txt_title.source.type';label.characters='MAIN PANEL';label.resize(150,24);label.x=10;label.y=220;label.fontName={family:'Inter',style:'Regular'};label.fills=[paint('#FFFFFF')];
  for(const h of ['LEFT','CENTER','RIGHT'] as const)for(const v of ['TOP','CENTER','BOTTOM'] as const){
    label.textAlignHorizontal=h;label.textAlignVertical=v;
    const plan=recognize(f.root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
    const before=designSignature(f.root),id=readMetadata(label)!,result=(await exportFrame(f.root)).screen.elements.find(e=>e.key===id.key)!;
    assert.equal(result.kind,'label');assert.equal(result.text,'MAIN PANEL');assert.equal(result.font!.family,'Inter');assert.equal(result.textAlign??'middle-left',`${v==='CENTER'?'middle':v.toLowerCase()}-${h.toLowerCase()}`);assert.equal(designSignature(f.root),before);
  }
  for(const kind of ['value','datetime'] as const){
    const node=figma.createText();f.root.appendChild(node);node.name=kind+'_Live';node.characters=kind==='value'?'42%':'HH:mm';node.resize(140,24);node.x=10;node.y=260;node.fontName={family:'Inter',style:'Semi Bold'};node.fills=[paint('#FFFFFF')];node.textAlignHorizontal='RIGHT';node.textAlignVertical='BOTTOM';
    const p=recognize(f.root,profile);assert.deepEqual(p.errors,[]);applyRecognition(p);
    const e=capture(f.root).screen.elements.find(e=>e.key===readMetadata(node)!.key)!;assert.equal(e.kind,kind);assert.equal(e.font!.style,'Semi Bold');assert.equal(e.textAlign,'bottom-right');
  }
});
test('Arbitrary-position Inter captions belong to Button; differing states retain editable text',async()=>{
  const f=authorButtons();prepareButtons(f.root);
  const button=f.buttons[0];
  for(const state of button.children)for(const n of state.children)if(n.type==='TEXT')n.fontName={family:'Inter',style:'Medium'};
  applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  const before=designSignature(f.root),bundle=await exportFrame(f.root),native=bundle.screen.elements[0];
  assert.equal(native.kind,'button');assert.equal(native.font!.style,'Medium');assert.equal(bundle.screen.elements.length,2);
  assert.ok(native.states!.every(s=>s.text==='Audio'));assert.equal(designSignature(f.root),before);
  button.children[1].children.find(n=>n.type==='TEXT')!.characters='Different';
  assert.deepEqual(capture(f.root).screen.elements[0].states!.map(s=>s.text),['Audio','Different']);
});
test('Native Inter static text gets GDI room around its alignment anchor without leaving the container',()=>{
  const f=authorButtons();prepareButtons(f.root);
  const button=f.buttons[0];
  for(const state of button.children)for(const n of state.children)if(n.type==='TEXT'){
    n.fontName={family:'Inter',style:'Semi Bold'};n.fontSize=21;n.characters='Video\nControl';n.resize(76,46);n.x=22;n.y=30;
    n.textAlignHorizontal='CENTER';n.textAlignVertical='CENTER';(n as any).textAutoResize='WIDTH_AND_HEIGHT';
  }
  const label=button.children[0].children.find(n=>n.type==='TEXT') as TextNode,before=designSignature(f.root);
  const rect=nativeTextRect(label,font(label),'middle-center',[22,30,76,46],[0,0,120,80]);
  // Two GDI lines need 57px; the bottom edge allows only 4 of the 11 extra pixels, mirrored on top.
  assert.deepEqual(rect,[14,26,92,54]);assert.equal(designSignature(f.root),before);
});
test('Figma variable-font reads with standard named axes stay native; custom axis values never silently change',()=>{
  authorButtons();const label=figma.createText();
  for(const [style,wght] of [['Regular',400],['Medium',500],['Bold',700]] as const){label.fontName={family:'Inter',style,variationSettings:{wght,opsz:14}};assert.equal(font(label).style,style);}
  label.fontName={family:'Inter Display',style:'Regular',variationSettings:{wght:400,opsz:32}};assert.equal(font(label).family,'Inter Display');
  for(const variationSettings of [{wght:550,opsz:14},{wght:400,opsz:24},{wght:400,slnt:-5},{wght:400,wdth:100}]){label.fontName={family:'Inter',style:'Regular',variationSettings};assert.throws(()=>font(label),(e:any)=>e.code==='font');}
});
test('Native Button text needs no extra object IDs at either end of the authored range',()=>{
  const f=authorButtons();prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  for(const [i,button] of f.buttons.entries()){
    const metadata=readMetadata(button)!;button.setPluginData('exui',JSON.stringify({...metadata,objectId:i?1:1000000}));
    for(const state of button.children)state.children.find(n=>n.type==='TEXT')!.fontName={family:'Inter',style:'Regular'};
  }
  const ids=()=>capture(f.root).screen.elements.map(e=>[e.key,e.objectId]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  const before=ids();assert.equal(new Set(before.map(e=>e[1])).size,2);
  f.root.insertChild(0,f.buttons[1]);assert.deepEqual(ids(),before);
});
test('An icon above or overlapping a caption never flattens ordinary Button text; masks require imagebutton',()=>{
  const f=authorButtons();prepareButtons(f.root);const button=f.buttons[0];
  for(const state of button.children){state.children.find(n=>n.type==='TEXT')!.fontName={family:'Inter',style:'Regular'};state.appendChild(state.children.find(n=>n.type==='GROUP')!);}
  applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  const hasCaption=()=>capture(f.root).screen.elements[0].states!.every(s=>s.text==='Audio');
  assert.ok(hasCaption());
  const state=button.children[0],icon=state.children[state.children.length-1];icon.y=50;assert.equal(hasCaption(),true);
  icon.y=10;icon.isMask=true;assert.throws(hasCaption,/imagebutton_/);
  button.name='ibtn_AudioControl';assert.equal(capture(f.root).screen.elements[0].states!.every(s=>s.text===''),true);
});
