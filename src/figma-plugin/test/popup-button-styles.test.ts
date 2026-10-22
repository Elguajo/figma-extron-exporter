import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { authorButtons, paint } from './button-preparation-fixture.ts';
import { background } from '../src/button-artwork.ts';
import { designSignature } from '../src/export.ts';
import { tag } from '../src/demo.ts';

const archive=process.env.EXUI_PLUGIN_ARCHIVE?unzipSync(readFileSync(process.env.EXUI_PLUGIN_ARCHIVE)):undefined;
const source=archive?strFromU8(archive[JSON.parse(strFromU8(archive['manifest.json'])).main]):buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;

for(const kind of ['popup','popup-group'] as const)for(const assigned of [false,true])for(const inProject of [false,true])test(`${kind}: styles work ${assigned?'with saved assignments':'by prefix'} ${inProject?'inside a project':'without an export root'}`,async()=>{
  const f=authorButtons(),api=f.api as unknown as PluginAPI;
  const group=api.createFrame();group.name='popupgroup_AudioControls';group.resize(2237,800);
  const popup=api.createFrame();popup.name='popup_TerraceSources';popup.resize(600,300);group.appendChild(popup);
  const other=api.createFrame();other.name='popup_HallSources';other.resize(600,300);group.appendChild(other);
  const outside=f.buttons[0].clone();f.root.appendChild(outside);
  popup.appendChild(f.buttons[0]);other.appendChild(f.buttons[1]);
  if(inProject){const project=api.createFrame();project.name='project_Audio';project.appendChild(f.root);project.appendChild(group);}
  if(assigned){
    group.name='AudioControls';popup.name='TerraceSources';
    tag(group,{kind:'popup-group',key:'group.audio',objectId:1});
    tag(popup,{kind:'popup',key:'popup.terrace',objectId:101,profile:'tlp-pro-1025m',projectName:'Audio'});
  }
  const target=kind==='popup'?popup:group,untouched=designSignature(f.root),otherBefore=designSignature(other);
  const geometry=f.buttons.map(b=>[b.id,b.x,b.y,b.width,b.height]);
  f.page.selection=[target as never];vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'ready'});
  const selection=f.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal((selection.buttonScope as any)?.id,target.id);
  assert.equal((selection.buttonScope as any)?.kind,kind);
  assert.equal((selection.buttonWorkflow as any)?.total,kind==='popup'?1:2);
  if(!inProject)assert.equal(selection.scope,undefined);
  await send({type:'button-apply-styles'});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(f.buttons[0].children[0].name,'Off');
  assert.equal(JSON.stringify(background(f.buttons[0].children[1]).fills),JSON.stringify(f.active.fills));
  assert.equal(designSignature(f.root),untouched);
  if(kind==='popup')assert.equal(designSignature(other),otherBefore);
  else assert.equal(f.buttons[1].children[0].name,'Normal');
  assert.deepEqual(f.buttons.map(b=>[b.id,b.x,b.y,b.width,b.height]),geometry);
  // A child selection must resolve to the same popup for subsequent updates.
  f.page.selection=[background(f.buttons[0].children[0]) as never];f.active.fills=[paint('#FF7700')];
  await send({type:'button-apply-styles',existing:'update'});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(JSON.stringify(background(f.buttons[0].children[1]).fills),JSON.stringify(f.active.fills));
  assert.equal(designSignature(f.root),untouched);
});

for(const scopeMode of ['selected-frames','page'])test(`Popup styling preserves the explicit ${scopeMode} project scope`,async()=>{
  const f=authorButtons(),api=f.api as unknown as PluginAPI;
  const popup=api.createFrame();popup.name='popup_Separate';popup.resize(600,300);popup.appendChild(f.buttons[0].clone());
  const before=designSignature(popup);
  f.page.selection=[f.root as never];vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'context',scopeMode});
  const selection=f.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal((selection.buttonScope as any)?.kind,'project');
  assert.equal((selection.buttonWorkflow as any)?.total,2);
  await send({type:'button-apply-styles',scopeMode});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(designSignature(popup),before);
  assert.deepEqual(f.buttons.map(b=>b.children.length),[2,2]);
});
