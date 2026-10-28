import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFigma } from './fake-figma.ts';
import { png } from './kit-fixture.ts';
import { namedFixture } from './named-fixture.ts';
import { exportPng } from '../src/read-node.ts';
import { capture, designSignature, exportFrame } from '../src/export.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';
import { controlText } from '../src/kit-contract.ts';
import { DATA_KEY } from '../src/model.ts';
import { authorButtons } from './button-preparation-fixture.ts';
import { prepareButtons } from '../src/button-preparation.ts';

// Observe the Figma boundary setter: the general fake deliberately does not
// simulate rotation, reflection, or rasterized pixels.
function observeTransforms(fake: ReturnType<typeof fakeFigma>) {
  const descriptor=Object.getOwnPropertyDescriptor(fake.FakeNode.prototype,'relativeTransform')!;
  const assigned=new Map<object,number[][]>();
  Object.defineProperty(fake.FakeNode.prototype,'relativeTransform',{
    configurable:true,get:descriptor.get,
    set(value:number[][]){assigned.set(this,structuredClone(value));descriptor.set!.call(this,value);}
  });
  return assigned;
}

for(const [name,linear,shift] of [
  ['horizontal reflection',[[-1,0],[0,1]],[120,0]],
  ['vertical reflection',[[1,0],[0,-1]],[0,80]],
  ['quarter rotation',[[0,-1],[1,0]],[80,0]],
  ['half rotation',[[-1,0],[0,-1]],[120,80]],
  ['skew',[[1,0.25],[0,1]],[0,0]],
] as const)test(`PNG wrapper preserves ${name}, bounds origin and subpixel padding; cleanup preserves source`,async()=>{
  const fake=fakeFigma(),assigned=observeTransforms(fake),node=fake.api.createFrame();node.name='Normal';node.resize(120,80);
  Object.defineProperty(node,'absoluteTransform',{get:()=>[[...linear[0],6400+shift[0]],[...linear[1],-3200+shift[1]]]});
  Object.defineProperty(node,'absoluteBoundingBox',{get:()=>({x:6400,y:-3200,width:name==='quarter rotation'?80:name==='skew'?140:120,height:name==='quarter rotation'?120:80})});
  const before=designSignature(node as never),selection=[node];fake.page.selection=selection;
  let renders=0;
  fake.setRenderHook(wrapper=>{
    renders++;assert.equal(wrapper.width,160);assert.equal(wrapper.height,140);
    const copy=wrapper.children[0];assert.equal(copy.visible,true);
    assert.deepEqual(assigned.get(copy),[[...linear[0],shift[0]+0.25],[...linear[1],shift[1]+0.75]]);
    return png(160,140);
  });
  await exportPng(node as never,{width:160,height:140,offsetX:0.25,offsetY:0.75});
  assert.equal(renders,1);assert.deepEqual(fake.page.children,[node]);
  assert.equal(fake.page.selection,selection);assert.equal(designSignature(node as never),before);
  fake.setRenderHook(()=>{throw new Error('render failed');});
  await assert.rejects(exportPng(node as never,{width:160,height:140}),/render failed/);
  assert.deepEqual(fake.page.children,[node]);assert.equal(designSignature(node as never),before);
});

for(const type of ['GROUP','FRAME'] as const)test(`${type} mirrored state recognizes and exports all artwork without native caption or changing IDs`,async()=>{
  const fake=fakeFigma(),root=await namedFixture(),button=root.children[3] as FrameNode,state=button.children[0] as FrameNode;
  applyRecognition(recognize(root,'tlp-pro-1025m'));
  button.name='ibtn_Mirrored';(state as any).type=type;
  if(type==='GROUP'){
    const background=fake.api.createRectangle();background.resize(state.width,state.height);background.fills=[{type:'SOLID',color:{r:0.1,g:0.1,b:0.1}}];state.appendChild(background as never);
  }
  Object.defineProperty(state,'relativeTransform',{get:()=>[[-1,0,state.width],[0,1,0]]});
  Object.defineProperty(state,'absoluteTransform',{get:()=>{const b=state.absoluteBoundingBox!;return [[-1,0,b.x+b.width],[0,1,b.y]];}});
  const before=designSignature(root),plan=recognize(root,'tlp-pro-1025m');
  assert.deepEqual(plan.errors,[]);assert.equal(designSignature(root),before);applyRecognition(plan);
  const metadata=button.getPluginData(DATA_KEY),saved=designSignature(root),captured=capture(root);
  const render=captured.images.find(i=>i.node===state)!;
  assert.ok(render.artwork);assert.equal(render.artwork.omitTextId,undefined);
  const exported=captured.screen.elements.find(e=>e.objectId===JSON.parse(metadata).objectId)!;
  assert.equal(exported.states![0].text,'');assert.ok(exported.states![0].image);
  fake.setRenderHook(node=>png(Math.round(node.width),Math.round(node.height)));
  await exportFrame(root);assert.equal(designSignature(root),saved);
  const again=recognize(root,'tlp-pro-1025m');assert.deepEqual(again.errors,[]);applyRecognition(again);
  assert.equal(button.getPluginData(DATA_KEY),metadata);
});

for(const kind of ['datetime','value','text'] as const)test(`Single-Text main Component ${kind} stays native and retains source structure`,async()=>{
  const fake=fakeFigma(),root=await namedFixture(),old=root.children[1];
  const component=fake.api.createFrame();component.type='COMPONENT';component.name=kind+'_Clock';component.x=old.x;component.y=old.y;component.resize(old.width,old.height);root.appendChild(component as never);old.remove();
  const label=fake.api.createText();component.appendChild(label);label.resize(component.width,component.height);label.characters=kind==='datetime'?'HH:mm':'42';label.fills=[{type:'SOLID',color:{r:1,g:1,b:1}}];label.textAlignVertical='CENTER';
  const before=designSignature(root),plan=recognize(root,'tlp-pro-1025m');
  assert.equal(controlText(component as never),label);assert.deepEqual(plan.errors,[]);assert.equal(designSignature(root),before);applyRecognition(plan);
  const saved=designSignature(root),bundle=await exportFrame(root),element=bundle.screen.elements.find(e=>e.name===component.name)!;
  assert.equal(element.kind,kind==='text'?'label':kind);assert.equal(element.image,undefined);
  if(kind==='datetime')assert.equal(element.native!.pattern,'HH:mm');else assert.equal(element.text,'42');
  assert.equal(component.type,'COMPONENT');assert.equal(designSignature(root),saved);
  const extra=fake.api.createText();component.appendChild(extra);
  assert.equal(controlText(component as never),null);assert.ok(recognize(root,'tlp-pro-1025m').errors.length);
});

test('Rotated outer button uses canvas bounds and raster states with inherited rotation',async()=>{
  const f=authorButtons(),button=f.buttons[0];button.name='ibtn_Rotated';prepareButtons(f.root);
  Object.defineProperty(button,'relativeTransform',{get:()=>[[0,-1,180],[1,0,10]]});
  // Supply geometric API values for the original design only. The rendering
  // boundary is covered separately above; this is not a Figma raster renderer.
  function canvasGeometry(node:any){
    Object.defineProperty(node,'absoluteTransform',{get:()=>{
      const local=node.relativeTransform as number[][],parent=node.parent;
      if(!parent||parent.type==='PAGE')return local;
      const p=parent.absoluteTransform as number[][];
      return [0,1].map(i=>[
        p[i][0]*local[0][0]+p[i][1]*local[1][0],
        p[i][0]*local[0][1]+p[i][1]*local[1][1],
        p[i][0]*local[0][2]+p[i][1]*local[1][2]+p[i][2]
      ]);
    }});
    Object.defineProperty(node,'absoluteBoundingBox',{get:()=>{
      const t=node.absoluteTransform as number[][];
      const corners=[[0,0],[node.width,0],[0,node.height],[node.width,node.height]].map(([x,y])=>[t[0][0]*x+t[0][1]*y+t[0][2],t[1][0]*x+t[1][1]*y+t[1][2]]);
      const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
      return{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
    }});
    node.children.forEach(canvasGeometry);
  }
  canvasGeometry(f.root);
  const before=designSignature(f.root),plan=recognize(f.root,'tlp-pro-1025m');
  assert.deepEqual(plan.errors,[]);assert.equal(designSignature(f.root),before);applyRecognition(plan);
  const saved=designSignature(f.root),bundle=await exportFrame(f.root),element=bundle.screen.elements.find(e=>e.name===button.name)!;
  assert.deepEqual(element.rect,[100,10,80,120]);
  assert.ok(element.states!.every(s=>s.image&&s.text===''));
  assert.equal(designSignature(f.root),saved);
});
