import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { icons, fakeFigma } from './fake-figma.ts';
const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:JSON.stringify(Object.fromEntries(Object.entries(icons()).map(([k,v])=>[k,[...v]])))}}).outputFiles[0].text;
function plugin(){const fake=fakeFigma();vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});return{...fake,send:fake.api.ui.onmessage as (message:unknown)=>Promise<void>};}
test('Built plugin: ready → create demo → check → export; preview retains all state roles',async()=>{
  const p=plugin();await p.send({type:'ready'});assert.equal(p.messages.at(-1)?.id,null);
  await p.send({type:'demo',profile:'tlp-pro-1025m'});assert.equal(p.page.children.length,1);
  await p.send({type:'check'});assert.ok(p.messages.some(m=>m.type==='success'&&String(m.message).includes('4 элемента')));
  const root=p.page.selection[0];p.page.selection=[root.children[0]];
  await p.send({type:'preview',role:'feedback'});assert.deepEqual(root.children[0].children.map(n=>n.visible),[false,true,false]);
  await p.send({type:'export'});const result=p.messages.filter(m=>m.type==='bundle').at(-1) as any;
  assert.equal(result.bundle.screen.elements[0].states.length,3);assert.equal(result.bundle.screen.elements[0].press,'Pressed');assert.equal(result.bundle.resources.length,2);
});
test('Built plugin refuses a second command while an export is pending',async()=>{
  const p=plugin();await p.send({type:'demo',profile:'tlp-pro-1025m'});
  let resolve!:()=>void;const gate=new Promise<void>(r=>resolve=r);const icon=p.page.selection[0].children[0].children[0].children[1];const original=icon.exportAsync.bind(icon);
  icon.exportAsync=async()=>{await gate;return original();};
  const pending=p.send({type:'export'});await p.send({type:'demo',profile:'tlp-pro-300m-portrait'});
  assert.ok(p.messages.some(m=>m.type==='error'&&String(m.message).includes('Дождитесь')));assert.equal(p.page.children.length,1);
  resolve();await pending;
});
test('Built plugin saves explicit metadata, keeps rename-independent IDs and rejects wrong node types',async()=>{
  const p=plugin();await p.send({type:'demo',profile:'tlp-pro-300m-portrait'});const root=p.page.selection[0];p.page.selection=[root.children[1]];
  await p.send({type:'apply',data:{kind:'label',key:'volume.caption',objectId:'42'}});
  assert.equal(JSON.parse(p.page.selection[0].getPluginData('exui')).objectId,42);
  await p.send({type:'apply',data:{kind:'button',key:'volume.caption',objectId:'42',controlId:'9000'}});
  assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'node-type');
  assert.equal(JSON.parse(p.page.selection[0].getPluginData('exui')).kind,'label');
  p.page.selection=[root.children[0].children[0].children[0]];
  await p.send({type:'apply',data:{kind:'label',key:'accidental.label',objectId:'45'}});
  assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'placement');
  assert.equal(p.page.selection[0].getPluginData('exui'),'');
});
