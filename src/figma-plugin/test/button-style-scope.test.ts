import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { authorButtons, paint } from './button-preparation-fixture.ts';
import { prepareButtons } from '../src/button-preparation.ts';
import { background } from '../src/button-artwork.ts';
import { designSignature } from '../src/export.ts';
import { PAGE_SETTINGS_KEY } from '../src/scope.ts';

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;

for(const mode of ['selection','selected-frames','page'])for(const child of [false,true])test(`Override uses the selected screen${child?' descendant':''}, independent of ${mode} export scope`,async()=>{
  const f=authorButtons(),api=f.api as unknown as PluginAPI;
  prepareButtons(f.root);
  const other=f.root.clone();other.name='screen_Custom';
  const project=api.createFrame();project.name='project_All';project.appendChild(f.root);project.appendChild(other);
  f.active.fills=[paint('#FF7700')];
  const untouched=designSignature(other);
  f.page.setPluginData(PAGE_SETTINGS_KEY,JSON.stringify({schema:'exui-page-settings/1',pageId:f.page.id,mode,profile:'tlp-pro-1025m',members:[f.root.id,other.id]}));
  f.page.selection=[(child?background(f.buttons[0].children[0]):f.root) as never];
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'ready'});
  const selection=f.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal((selection.buttonScope as any)?.id,f.root.id);
  assert.equal((selection.buttonWorkflow as any)?.total,2);
  await send({type:'button-apply-styles',scopeMode:mode,existing:'update',statePair:'normal-pressed'});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(designSignature(other),untouched);
  assert.deepEqual(f.buttons[0].children.map(n=>n.name),['Normal','Pressed']);
  assert.equal(JSON.stringify(background(f.buttons[0].children[1]).fills),JSON.stringify(f.active.fills));
});

for(const mode of ['selection','selected-frames','page'])test(`Multiple selected frames exclude cached screens and linked popups in ${mode}`,async()=>{
  const f=authorButtons(),api=f.api as unknown as PluginAPI;
  prepareButtons(f.root);
  const second=f.root.clone();second.name='screen_Second';
  const custom=f.root.clone();custom.name='screen_StartPage';
  const popup=api.createFrame();popup.name='popup_Controls';popup.appendChild(f.buttons[0].clone());
  const ref=api.createFrame();ref.name='popupref_Controls';f.root.appendChild(ref);
  f.active.fills=[paint('#FF7700')];
  const untouched=[custom,popup].map(designSignature);
  f.page.setPluginData(PAGE_SETTINGS_KEY,JSON.stringify({schema:'exui-page-settings/1',pageId:f.page.id,mode,profile:'tlp-pro-1025m',members:[custom.id]}));
  f.page.selection=[f.root,second] as never;
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'ready'});
  const selection=f.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal((selection.buttonWorkflow as any)?.total,4);
  assert.match((selection.buttonScope as any)?.name,/screen_Home.*screen_Second/);
  await send({type:'button-apply-styles',scopeMode:mode,existing:'update',statePair:'normal-pressed'});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.deepEqual([custom,popup].map(designSignature),untouched);
  for(const root of [f.root,second])assert.deepEqual(root.children[0].children.map(n=>n.name),['Normal','Pressed']);
  // Narrowing the live selection must not reuse the remembered two-screen project.
  const secondBefore=designSignature(second);
  f.page.selection=[f.root as never];f.emit('selectionchange');
  f.active.fills=[paint('#AA0077')];
  await send({type:'button-apply-styles',scopeMode:mode,existing:'update',statePair:'off-on'});
  assert.equal(designSignature(second),secondBefore);
  assert.deepEqual(f.buttons[0].children.map(n=>n.name),['Off','On']);
});

test('No selection cannot apply styles to a remembered project or the whole page',async()=>{
  const f=authorButtons();prepareButtons(f.root);const before=designSignature(f.root);
  f.page.setPluginData(PAGE_SETTINGS_KEY,JSON.stringify({schema:'exui-page-settings/1',pageId:f.page.id,mode:'page',profile:'tlp-pro-1025m',members:[f.root.id]}));
  f.page.selection=[];vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'ready'});
  assert.equal(f.messages.filter(m=>m.type==='selection').at(-1)!.buttonScope,undefined);
  f.active.fills=[paint('#FF7700')];await send({type:'button-apply-styles',existing:'update'});
  assert.equal(f.messages.filter(m=>m.type==='error').at(-1)?.code,'selection');
  assert.equal(designSignature(f.root),before);
});

for(const type of ['FRAME','GROUP'])for(const multiple of [false,true])test(`Selected ${multiple?'multiple':'single'} ${type} buttons do not restyle their siblings`,async()=>{
  const f=authorButtons(),api=f.api as unknown as PluginAPI;prepareButtons(f.root);
  const selected=[f.buttons[0]];
  if(multiple){const copy=f.buttons[0].clone();copy.name='button_Second';f.root.appendChild(copy);selected.push(copy);}
  const nodes=selected.map(group=>{
    if(type==='GROUP')return group;
    const frame=api.createFrame();frame.name=group.name;frame.resize(group.width,group.height);frame.fills=[];
    f.root.appendChild(frame);for(const child of [...group.children])frame.appendChild(child);group.remove();return frame;
  });
  const custom=designSignature(f.buttons[1]);f.active.fills=[paint('#FF7700')];
  f.page.selection=nodes as never;vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;await send({type:'ready'});
  assert.equal((f.messages.filter(m=>m.type==='selection').at(-1)!.buttonWorkflow as any)?.total,nodes.length);
  await send({type:'button-apply-styles',existing:'update',statePair:'normal-pressed'});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(designSignature(f.buttons[1]),custom);
  for(const node of nodes)assert.deepEqual(node.children.map(n=>n.name),['Normal','Pressed']);
});
