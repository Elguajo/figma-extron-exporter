import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { frame,label } from './expanded-fixture.ts';
import { readMetadata } from '../src/model.ts';
import { designSignature } from '../src/export.ts';
import { PAGE_SETTINGS_KEY } from '../src/scope.ts';

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
function fixture(){
  const f=fakeFigma();
  const project=(name:string)=>{
    const root=frame(null,'project_'+name,0,0,2800,900,'');
    const pages=['Main','Audio'].map((name,i)=>{const n=frame(root,'screen_'+name,i*1400,0,1280,800);label(n,'text_Title',name,0,0,200,30);return n;});
    return {root,pages};
  };
  const a=project('A');
  const start=()=>{vm.runInNewContext(source,{figma:f.api,Uint8Array,console});return f.api.ui.onmessage as (m:unknown)=>Promise<void>;};
  const latest=()=>f.messages.filter(m=>m.type==='selection').at(-1) as any;
  return {...f,a,project,start,latest};
}

test('Project settings open without selection, save explicitly and survive restart',async()=>{
  const f=fixture(),send=f.start(),before=designSignature(f.a.root);
  await send({type:'ready'});
  let view=f.latest().projectSettings;
  assert.equal(view.projectId,f.a.root.id);assert.equal(view.pages.length,2);
  assert.equal(designSignature(f.a.root),before,'opening settings must not assign the design');
  await send({type:'start-page',projectId:view.projectId,targetId:f.a.pages[1].id});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(readMetadata(f.a.pages[1])?.shownBy,'start');assert.equal(readMetadata(f.a.pages[0])?.shownBy,'program');
  assert.equal(f.page.selection.length,0);
  await f.start()({type:'ready'});assert.equal(f.latest().projectSettings.startId,f.a.pages[1].id);
  f.page.selection=[f.a.pages[0] as never];f.emit('selectionchange');assert.equal(f.latest().projectSettings,undefined);
  f.page.selection=[f.a.pages[0],f.a.pages[1]] as never;f.emit('selectionchange');assert.equal(f.latest().projectSettings,undefined);
  f.page.selection=[];f.emit('selectionchange');assert.equal(f.latest().projectSettings.startId,f.a.pages[1].id);
});

test('Multiple projects require a choice and only that project changes',async()=>{
  const f=fixture(),b=f.project('B'),send=f.start();await send({type:'ready'});
  assert.equal(f.latest().projectSettings.projects.length,2);assert.equal(f.latest().projectSettings.projectId,undefined);
  const before=designSignature(f.a.root),settings=f.page.getPluginData(PAGE_SETTINGS_KEY);
  await send({type:'project-settings',projectId:b.root.id});
  assert.equal(f.latest().projectSettings.projectId,b.root.id);
  assert.deepEqual(Array.from(f.latest().projectSettings.pages,(p:any)=>p.id).sort(),b.pages.map(p=>p.id).sort());
  await send({type:'start-page',projectId:b.root.id,targetId:b.pages[1].id});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(readMetadata(b.pages[1])?.shownBy,'start');assert.equal(designSignature(f.a.root),before);
  assert.equal(f.page.getPluginData(PAGE_SETTINGS_KEY),settings,'project settings must not change export scope');
  await send({type:'start-page',projectId:b.root.id,targetId:f.a.pages[0].id});
  assert.equal(f.messages.filter(m=>m.type==='error').length,1);assert.equal(designSignature(f.a.root),before);
});

test('Remembered selected-frame membership stays exact without selection',async()=>{
  const f=fixture();
  const screens=['One','Two','Excluded'].map(name=>{const n=frame(null,'screen_'+name,0,0,1280,800);label(n,'text_Title',name,0,0,200,30);return n;});
  const send=f.start();f.page.selection=screens.slice(0,2) as never;f.emit('selectionchange');
  f.page.selection=[];f.emit('selectionchange');
  await send({type:'project-settings',projectId:f.page.id});
  assert.equal(f.latest().projectSettings.pages.length,2);
  await send({type:'start-page',projectId:f.page.id,targetId:screens[1].id});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);assert.equal(readMetadata(screens[2]),null);
  assert.equal(readMetadata(screens[1])?.shownBy,'start');
});

test('A stale settings command cannot write after canvas selection changes',async()=>{
  const f=fixture(),send=f.start();await send({type:'ready'});const before=designSignature(f.a.root);
  f.page.selection=[f.a.pages[0] as never];
  await send({type:'start-page',projectId:f.a.root.id,targetId:f.a.pages[1].id});
  assert.equal(f.messages.filter(m=>m.type==='error').length,1);assert.equal(designSignature(f.a.root),before);
});

test('An empty page supplies an empty settings state',async()=>{
  const f=fixture();f.a.root.remove();await f.start()({type:'ready'});
  assert.equal(f.latest().projectSettings.projects.length,0);assert.equal(f.latest().projectSettings.pages.length,0);
});

test('A Section and portrait screens use the selected panel profile',async()=>{
  const f=fixture();f.a.root.remove();
  const section=f.api.createSection();section.name='Portrait project';
  const screen=frame(null,'screen_Portrait',0,0,320,480);label(screen,'text_Title','Portrait',0,0,200,30);section.appendChild(screen as never);
  const send=f.start();await send({type:'context',profile:'tlp-pro-300m-portrait'});
  const settings=f.latest().projectSettings;
  assert.equal(settings.projectId,section.id);assert.equal(settings.pages[0].id,screen.id);
  await send({type:'start-page',projectId:section.id,targetId:screen.id,profile:'tlp-pro-300m-portrait'});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(readMetadata(screen)?.shownBy,'start');assert.equal(readMetadata(screen)?.profile,'tlp-pro-300m-portrait');
});

test('Switching Figma pages clears the chosen settings project and rejects stale saves',async()=>{
  const f=fixture(),send=f.start();await send({type:'ready'});
  const next=new f.FakeNode('PAGE') as typeof f.page;next.selection=[];next.name='Next page';
  const b=f.project('Next');next.appendChild(b.root as never);
  f.api.currentPage=next;f.emit('currentpagechange');
  assert.equal(f.latest().projectSettings.projectId,b.root.id);
  const before=designSignature(b.root);
  await send({type:'start-page',projectId:f.a.root.id,targetId:f.a.pages[1].id});
  assert.equal(f.messages.filter(m=>m.type==='error').length,1);assert.equal(designSignature(b.root),before);
});
