import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { frame,label } from './expanded-fixture.ts';
import { png } from './kit-fixture.ts';

// Counts full design snapshots per UI event instead of timing it: the count is
// deterministic, and each snapshot reads every property of every node in scope.
const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
function fixture(){
  const f=fakeFigma(),screens:FrameNode[]=[];let reads=0;
  for(let s=0;s<3;s++){
    const screen=frame(null,`screen_S${s}`,s*1400,0,1280,800,'#101010');screens.push(screen);label(screen,'text_Title','Title',10,10,200,30);
    for(let b=0;b<4;b++){
      const button=frame(screen,`button_B${b}`,20+b*110,60,100,50,'');
      for(const [i,name] of ['Normal','Pressed'].entries()){const state=frame(button,name,0,0,100,50,i?'#0077AA':'#303030'),text=label(state,'Text','B'+b,0,0,100,50);text.textAlignHorizontal='CENTER';text.textAlignVertical='CENTER';state.visible=i===0;}
    }
  }
  const nodes:SceneNode[]=[];const walk=(n:SceneNode)=>{nodes.push(n);if('children' in n)n.children.forEach(walk);};screens.forEach(walk);
  for(const node of nodes){const value=(node as any).vectorNetwork;delete (node as any).vectorNetwork;Object.defineProperty(node,'vectorNetwork',{get(){reads++;return value;},configurable:true});}
  f.setRenderHook(async node=>png(Math.round(node.width),Math.round(node.height)));
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  const snapshots=async(action:()=>unknown)=>{reads=0;await action();return reads/nodes.length;};
  return {f,screens,send,snapshots};
}

test('Selecting a layer takes one design snapshot of its page project',async()=>{
  const {f,screens,send,snapshots}=fixture();await send({type:'ready'});
  assert.equal(await snapshots(()=>{f.page.selection=[screens[0].children[2] as never];f.emit('selectionchange');}),1);
  f.page.selection=[...screens] as never;f.emit('selectionchange');
  assert.equal(await snapshots(()=>{f.page.selection=[screens[1].children[2] as never];f.emit('selectionchange');}),1);
});

test('Project check and export stay within their snapshot budget',async()=>{
  const {f,screens,send,snapshots}=fixture();await send({type:'ready'});
  f.page.selection=[...screens] as never;f.emit('selectionchange');
  assert.ok(await snapshots(()=>send({type:'check',scopeMode:'selected-frames',profile:'tlp-pro-1025m'}))<=3);
  assert.ok(await snapshots(()=>send({type:'export',scopeMode:'selected-frames',profile:'tlp-pro-1025m'}))<=5);
  assert.equal(f.messages.filter(m=>m.type==='error').length,0);
  assert.equal(f.messages.filter(m=>m.type==='bundle').length,1);
});
