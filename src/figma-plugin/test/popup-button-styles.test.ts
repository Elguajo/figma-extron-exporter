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
import { prepareButtons } from '../src/button-preparation.ts';
import { PAGE_SETTINGS_KEY } from '../src/scope.ts';

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

for(const scopeMode of ['selected-frames','page'])test(`Screen styling is local while preserving the ${scopeMode} export project`,async()=>{
  const f=authorButtons(),api=f.api as unknown as PluginAPI;
  const popup=api.createFrame();popup.name='popup_Separate';popup.resize(600,300);popup.appendChild(f.buttons[0].clone());
  const before=designSignature(popup);
  f.page.selection=[f.root as never];vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'context',scopeMode});
  const selection=f.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal((selection.scope as any)?.kind,'project');
  assert.equal((selection.buttonScope as any)?.id,f.root.id);
  assert.equal((selection.buttonScope as any)?.kind,'page');
  assert.equal((selection.buttonWorkflow as any)?.total,2);
  await send({type:'button-apply-styles',scopeMode});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(designSignature(popup),before);
  assert.deepEqual(f.buttons.map(b=>b.children.length),[2,2]);
});

for(const scopeMode of ['selected-frames','page'])for(const assigned of [false,true])test(`Selected popup group overrides restored ${scopeMode} styling scope ${assigned?'with assignments':'by prefix'}`,async()=>{
  const f=authorButtons(),api=f.api as unknown as PluginAPI;
  const group=api.createFrame();group.name='popupgroup_WallLayouts';group.resize(4083,621);
  const popup=api.createFrame();popup.name='popup_WallFull';popup.resize(600,300);group.appendChild(popup);
  const raw=f.buttons[0].clone();raw.name='button_InputAll';popup.appendChild(raw);
  const partial=raw.clone();partial.name='button_InputRight';popup.appendChild(partial);
  const normal=api.group([...partial.children],partial);normal.name='Normal';
  if(assigned){
    tag(group,{kind:'popup-group',key:'group.walllayouts',objectId:1});
    tag(popup,{kind:'popup',key:'popup.wallfull',objectId:101,profile:'tlp-pro-1025m',projectName:'Wall'});
  }
  // Reproduce the misleading "29 buttons; 0 new states" from an unrelated project.
  for(let i=0;i<27;i++)f.root.appendChild(f.buttons[0].clone());
  prepareButtons(f.root);
  const untouched=designSignature(f.root),geometry=[raw,partial].map(n=>[n.id,n.type,n.x,n.y,n.width,n.height]);
  const saved=JSON.stringify({schema:'exui-page-settings/1',pageId:f.page.id,mode:scopeMode,profile:'tlp-pro-1025m',members:[f.root.id]});
  f.page.setPluginData(PAGE_SETTINGS_KEY,saved);f.page.selection=[group as never];
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'ready'});
  const selection=f.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal(selection.scopeMode,scopeMode);
  assert.equal((selection.scope as any)?.kind,'project');
  assert.equal((selection.buttonScope as any)?.id,group.id);
  assert.deepEqual(JSON.parse(JSON.stringify(selection.buttonWorkflow)),{total:2,create:2,update:0});
  await send({type:'button-apply-styles',scopeMode,existing:'update'});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.deepEqual(raw.children.map(n=>n.name),['Off','On']);
  assert.deepEqual(partial.children.map(n=>n.name),['Normal','On']);
  assert.equal(raw.children[1].visible,false);assert.equal(partial.children[1].visible,false);
  assert.equal(designSignature(f.root),untouched);
  assert.deepEqual([raw,partial].map(n=>[n.id,n.type,n.x,n.y,n.width,n.height]),geometry);
  const result=f.messages.filter(m=>m.type==='success'&&m.operation==='button-apply-styles').at(-1)!;
  assert.match(String(result.message),/popupgroup_WallLayouts/);
  assert.match(String(result.message),/Подготовлено кнопок: 2; обновлено готовых: 0; новых состояний: 3/);
  // Keep the export project and resolve a selected descendant to its own popup.
  f.page.selection=[background(raw.children[0]) as never];f.emit('selectionchange');
  const childSelection=f.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal((childSelection.buttonScope as any)?.id,popup.id);
  assert.equal(childSelection.scopeMode,scopeMode);
  assert.equal(f.page.getPluginData(PAGE_SETTINGS_KEY),saved);
});

for(const scopeMode of ['selection','selected-frames','page'])for(const child of [false,true])for(const existing of ['skip','update'] as const)test(`Modal styling: ${scopeMode}, selected ${child?'descendant':'frame'}, ${existing} ready buttons`,async()=>{
  const f=authorButtons(),api=f.api as unknown as PluginAPI;
  const modal=api.createFrame();modal.name='modalpopup_SourceSelect';modal.resize(1080,600);
  const raw=f.buttons[0].clone();raw.name='button_Source1';modal.appendChild(raw);
  const artwork=api.group([...raw.children],raw);artwork.name='Group 17';
  prepareButtons(f.root);
  const ready=f.buttons[0].clone();ready.name='button_Source3';modal.appendChild(ready);
  ready.children[0].visible=false;ready.children[1].visible=true;
  const momentary=f.buttons[0].clone();momentary.name='button_ExitModal';modal.appendChild(momentary);
  momentary.children[0].name='Normal';momentary.children[1].name='Pressed';
  const pressedBefore=designSignature(momentary.children[1]),readyBefore=designSignature(ready),momentaryBefore=designSignature(momentary);
  f.active.fills=[paint('#FF7700')];f.normal.fills=[paint('#444444')];
  const untouched=designSignature(f.root),geometry=[raw,ready,momentary].map(n=>[n.id,n.type,n.x,n.y,n.width,n.height]);
  const saved=JSON.stringify({schema:'exui-page-settings/1',pageId:f.page.id,mode:scopeMode,profile:'tlp-pro-1025m',members:[f.root.id]});
  f.page.setPluginData(PAGE_SETTINGS_KEY,saved);f.page.selection=[(child?background(raw):modal) as never];
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  await send({type:'ready'});
  const selection=f.messages.filter(m=>m.type==='selection').at(-1)!;
  assert.equal((selection.buttonScope as any)?.id,modal.id);
  assert.deepEqual(JSON.parse(JSON.stringify(selection.buttonWorkflow)),{total:3,create:1,update:2});
  await send({type:'button-apply-styles',scopeMode,existing});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.deepEqual(raw.children.map(n=>n.name),['Off','On']);
  assert.equal(artwork.parent,raw.children[0]);
  assert.equal(JSON.stringify(background(raw.children[1]).fills),JSON.stringify(f.active.fills));
  assert.deepEqual(ready.children.map(n=>n.visible),[false,true]);
  if(existing==='skip'){
    assert.equal(designSignature(momentary.children[1]),pressedBefore);
    assert.equal(designSignature(ready),readyBefore);assert.equal(designSignature(momentary),momentaryBefore);
  }else{
    assert.equal(JSON.stringify(background(ready.children[1]).fills),JSON.stringify(f.active.fills));
    assert.equal(JSON.stringify(background(momentary.children[0]).fills),JSON.stringify(f.normal.fills));
    assert.equal(JSON.stringify(background(momentary.children[1]).fills),JSON.stringify(f.active.fills));
  }
  assert.equal(designSignature(f.root),untouched);
  assert.deepEqual([raw,ready,momentary].map(n=>[n.id,n.type,n.x,n.y,n.width,n.height]),geometry);
  assert.equal(f.page.getPluginData(PAGE_SETTINGS_KEY),saved);
  const result=f.messages.filter(m=>m.type==='success'&&m.operation==='button-apply-styles').at(-1)!;
  assert.match(String(result.message),/modalpopup_SourceSelect/);
  assert.ok(String(result.message).includes(`Подготовлено кнопок: 1; обновлено готовых: ${existing==='update'?2:0}; новых состояний: 2; пропущено готовых: ${existing==='skip'?2:0}`));
});
