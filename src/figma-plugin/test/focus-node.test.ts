import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFigma } from './fake-figma.ts';
import { focusNode } from '../src/focus-node.ts';

test('A hidden rotated state without bounds uses its canvas transform and remains hidden',()=>{
  const p=fakeFigma(),state=p.api.createFrame();state.resize(100,40);state.visible=false;
  Object.defineProperty(state,'absoluteBoundingBox',{get:()=>null});
  Object.defineProperty(state,'absoluteTransform',{get:()=>[[0,-1,6500],[1,0,-3400]]});
  focusNode(state as never);
  assert.deepEqual(p.api.viewport.center,{x:6480,y:-3350});assert.equal(p.api.viewport.zoom,2);
  assert.equal(state.visible,false);assert.equal(state.width,100);assert.equal(state.height,40);
  assert.equal(p.page.children.length,1);assert.equal(state.data.size,0);
});

test('A rotated layer uses its canvas bounds rather than its local dimensions and position',()=>{
  const p=fakeFigma(),line=p.api.createLine();line.resize(906,0);line.x=345;line.y=586;
  Object.defineProperty(line,'absoluteBoundingBox',{get:()=>({x:-6000,y:8000,width:0,height:906})});
  focusNode(line as never);
  assert.deepEqual(p.api.viewport.center,{x:-6000,y:8453});
  assert.equal(p.api.viewport.zoom,672/906);
});
