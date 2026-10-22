import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { frame,label } from './expanded-fixture.ts';
import { bindPopups } from '../src/popup-binding.ts';
import { DATA_KEY,readMetadata } from '../src/model.ts';
import { recognize } from '../src/recognize.ts';
import { designSignature } from '../src/export.ts';
import { ExportScope } from '../src/scope.ts';

const profile='tlp-pro-1025m' as const;
const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
function fixture(){
  const f=fakeFigma();
  const start=frame(null,'screen_StartPage',-2800,0,1280,800),main=frame(null,'screen_MainDashboard',-1400,0,1280,800),audio=frame(null,'screen_AudioControl',0,0,1280,800);
  for(const n of [start,main,audio])label(n,'txt_Title',n.name,10,10,400,30);
  const ref=frame(audio,'popupref_AudioControls',323,103,940,670,'');
  const group=frame(null,'popupgroup_AudioControls',1400,0,1998,750,'');
  const popups=['HallSources','TerraceSources'].map((name,i)=>{const n=frame(group,'popup_'+name,39+i*980,40,940,670);label(n,'txt_Title',name,10,10,400,30);return n;});
  f.page.selection=[group] as never;bindPopups(ref.id,popups.map(p=>p.id),profile);
  return {...f,start,main,audio,ref,group,popups};
}

for(const mode of ['selected-frames','page'] as const)test(`${mode}: bind AudioControls then select screens only → check, reopen and export linked popup group`,async()=>{
  const f=fixture(),unrelated=frame(null,'popupgroup_Unfinished',4000,0,100,100,''),before=designSignature(unrelated);
  const connection=readMetadata(f.ref),bounds=[f.ref,...f.popups].map(n=>n.absoluteBoundingBox);
  f.page.selection=[f.start,f.main,f.audio] as never;
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  await (f.api.ui.onmessage as any)({type:'check',scopeMode:mode,profile});
  const report=f.messages.filter(m=>m.type==='recognition').at(-1) as any;
  assert.deepEqual(report?.errors??[],[]);
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(readMetadata(f.ref)!.group,connection!.group);
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  await (f.api.ui.onmessage as any)({type:'export',scopeMode:mode,profile});
  const screen=(f.messages.filter(m=>m.type==='bundle').at(-1) as any)?.bundle.screen;
  assert.ok(screen,'a valid saved connection must export without manually selecting its group');
  assert.equal(screen.pages.length,3);assert.equal(screen.groups.length,1);assert.equal(screen.popups.length,2);
  assert.equal(screen.pages.find((p:any)=>p.name===f.audio.name).elements.find((e:any)=>e.kind==='popup-ref').group,screen.groups[0].key);
  assert.deepEqual([f.ref,...f.popups].map(n=>n.absoluteBoundingBox),bounds);
  assert.equal(designSignature(unrelated),before);
});

test('An omitted linked group is diagnosed as a missing target on the reference, not as a size mismatch on the whole page',()=>{
  const f=fixture(),plan=recognize(f.page as never,profile,{members:[f.start,f.main,f.audio]});
  assert.equal(plan.errors.length,1);
  assert.match(plan.errors[0],/group\.audiocontrols.*не найдена/i);
  assert.equal(plan.issues[0].nodeId,f.ref.id);
  assert.match(plan.issues[0].fix,/состав|област/i);
});

test('A real size mismatch reports both sizes and points to the popup reference',()=>{
  const f=fixture();f.popups.forEach(n=>n.resize(939,670));
  const plan=recognize(f.page as never,profile,{members:[f.start,f.main,f.audio,f.group]});
  assert.equal(plan.errors.length,1);assert.match(plan.errors[0],/940×670/);assert.match(plan.errors[0],/939×670/);
  assert.equal(plan.issues[0].nodeId,f.ref.id);
});

test('Saved links include a standalone popup without including another project with the same key',()=>{
  const f=fixture(),single=frame(null,'popup_Single',4000,0,940,670);label(single,'txt_Title','Single',10,10,100,30);
  const foreign=frame(null,'project_Other',6000,0,2000,1000,''),foreignPopup=frame(foreign,'popup_Single',0,0,940,670);label(foreignPopup,'txt_Title','Foreign',10,10,100,30);
  const initial=recognize(f.page as never,profile,{members:[f.start,f.main,f.audio,f.group,single]});
  const m=initial.writes.find(w=>w.node.id===single.id)!.metadata;
  single.setPluginData(DATA_KEY,JSON.stringify(m));
  const r=readMetadata(f.ref)!;f.ref.setPluginData(DATA_KEY,JSON.stringify({...r,group:undefined,popup:m.key}));
  foreignPopup.setPluginData(DATA_KEY,JSON.stringify({...m,ownerNodeId:foreignPopup.id}));
  f.page.selection=[f.start,f.main,f.audio] as never;
  const scope=new ExportScope();scope.refreshSelection();const ctx=scope.resolve();
  assert.deepEqual(ctx.options.members!.map(n=>n.id),[f.start.id,f.main.id,f.audio.id,single.id]);
});
