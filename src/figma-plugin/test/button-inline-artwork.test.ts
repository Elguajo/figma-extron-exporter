import test from 'node:test';
import assert from 'node:assert/strict';
import {authorButtons} from './button-preparation-fixture.ts';
import {prepareButtons} from '../src/button-preparation.ts';
import {descendants} from '../src/button-artwork.ts';
import {recognize,applyRecognition} from '../src/recognize.ts';
import {capture,designSignature,exportFrame} from '../src/export.ts';
import {png} from './kit-fixture.ts';

import {muteFixture} from './button-inline-fixture.ts';

for(const side of ['left','right'] as const)test(`Mute ${side} icon follows centered native caption; text, ID, state and source layout survive export`,async()=>{
  const f=muteFixture(undefined,side),before=designSignature(f.root),initial=capture(f.root),element=initial.screen.elements[0];
  assert.equal(element.kind,'button');assert.equal(initial.screen.elements.length,1);
  assert.deepEqual(element.states!.map(s=>s.text),['Mute all audio','Mute all audio']);
  assert.deepEqual(element.rect,[16,415,288,52]);assert.equal(element.press,'Pressed');
  let rendered=0;
  f.setRenderHook(wrapper=>{
    rendered++;
    const state=wrapper.children[0],row=state.children[0],label=row.children.find(n=>n.type==='TEXT')!,slot=row.children.find(n=>n.name==='Mute icon')!;
    assert.equal(row.layoutMode,'HORIZONTAL');assert.equal(label.visible,true,'caption must retain its Auto Layout slot');assert.equal(label.opacity,0);
    assert.equal(slot.visible,true);assert.equal(slot.opacity,0,'original icon slot prevents reflow');
    const icon=wrapper.children.find(n=>n.name==='Mute icon')!;
    assert.ok(icon&&icon.visible&&icon.opacity===1);assert.equal(icon.y,16);
    // Caption moves from center 160/128 to 144. The icon follows it, with
    // six extra pixels for GUI Designer's Inter advances; the 10px gap survives.
    assert.equal(icon.x,side==='left'?51:215);
    const captionLeft=144-55,captionRight=144+55;
    assert.ok(side==='left'?captionLeft-icon.x-icon.width>=10:icon.x-captionRight>=10);
    return png(288,52);
  });
  await exportFrame(f.root);assert.equal(rendered,2);assert.equal(designSignature(f.root),before);
  assert.deepEqual(capture(f.root).screen.elements.map(e=>[e.objectId,e.controlId]),[[element.objectId,element.controlId]]);
  f.setRenderHook(()=>{throw new Error('raster failure');});
  await assert.rejects(()=>exportFrame(f.root),/raster failure/);assert.equal(designSignature(f.root),before);
  assert.ok(f.page.children.every(n=>n.getPluginData('exui-export-temp')!=='1'));
});

test('Imagebutton retains complete Auto Layout artwork without native caption or icon movement',async()=>{
  const f=muteFixture();f.button.name='imagebutton_MuteAll';const initial=capture(f.root);
  assert.ok(initial.screen.elements[0].states!.every(s=>s.text===''));
  assert.ok(initial.images.every(i=>!i.artwork?.moves&&!i.artwork?.omitTextId));
  f.setRenderHook(wrapper=>{const row=wrapper.children[0].children[0];assert.ok(row.children.every(n=>n.visible&&n.opacity===1));assert.equal(wrapper.children.length,1);return png(288,52);});
  await exportFrame(f.root);
});

test('An icon above the caption and a distant edge decoration retain their authored positions',()=>{
  const f=authorButtons();prepareButtons(f.root);applyRecognition(recognize(f.root,'tlp-pro-1025m'));
  assert.ok(capture(f.root).images.every(i=>!i.artwork?.moves));
  const mute=muteFixture();
  for(const state of mute.button.children){const row=state.children[0] as FrameNode;row.children.find(n=>n.name==='Mute icon')!.remove();const edge=figma.createRectangle();edge.name='Edge';edge.resize(10,20);edge.x=270;edge.y=16;state.appendChild(edge);}
  assert.ok(capture(mute.root).images.every(i=>!i.artwork?.moves));
});

test('Nested icon group moves as one graphic while its internal pieces remain together',()=>{
  const f=muteFixture();
  for(const state of f.button.children){const row=state.children[0] as FrameNode,icon=row.children.find(n=>n.name==='Mute icon')!;const group=figma.group([icon],row);group.name='Mute glyph';}
  const captured=capture(f.root);
  assert.ok(captured.images.every(i=>i.artwork!.moves!.length===1&&i.artwork!.moves![0].nodeId===(i.node as FrameNode).children[0].children.find(n=>n.type==='GROUP')!.id));
});

test('Insufficient room fails with a contextual layout error rather than cropping an icon',()=>{
  const f=muteFixture();
  for(const state of f.button.children){const label=descendants(state).find(n=>n.type==='TEXT')!;label.resize(270,20);}
  assert.throws(()=>capture(f.root),(e:any)=>e.code==='button-text-layout'&&!!e.nodeId);
});
