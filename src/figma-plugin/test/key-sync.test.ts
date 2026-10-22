// Keys follow layer names through the bundled command handler; IDs never move.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma,icons } from './fake-figma.ts';
import { frame,label } from './expanded-fixture.ts';
import { twoScreens } from './page-project-fixture.ts';
import { tag } from '../src/demo.ts';
import { readMetadata } from '../src/model.ts';
import { designSignature } from '../src/export.ts';
import { MANUAL_KEY } from '../src/key-sync.ts';

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:JSON.stringify(Object.fromEntries(Object.entries(icons()).map(([k,v])=>[k,[...v]])))}}).outputFiles[0].text;
function plugin(){const fake=fakeFigma();vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});return{...fake,send:(m:unknown)=>(fake.api.ui.onmessage as (m:unknown)=>Promise<void>)(m)};}
type Plugin=ReturnType<typeof plugin>;
function button(parent:FrameNode,name:string,x:number){const b=frame(parent,name,x,60,90,40,'');for(const [i,state] of ['Normal','Pressed'].entries()){const s=frame(b,state,0,0,90,40,i?'#0077AA':'#303030');label(s,'Text',name,0,0,90,40).textAlignHorizontal='CENTER';s.visible=i===0;}return b;}
function project(){const screens=twoScreens();screens.main.name='screen_MainDashboard';const ch01=button(screens.audio,'button_CH01',20),back=button(screens.audio,'button_BacktoMain',200);return{...screens,ch01,back};}
async function exportBoth(p:Plugin,frames:SceneNode[]){p.page.selection=frames as never;p.emit('selectionchange');p.messages.length=0;await p.send({type:'export',scopeMode:'selected-frames',profile:'tlp-pro-1025m'});assert.deepEqual(p.messages.filter(m=>m.type==="error"||m.type==="recognition").map((m:any)=>m.errors??m.message),[]);return p.messages.find(m=>m.type==='bundle') as any;}
const keyOf=(n:SceneNode)=>readMetadata(n)!.key;
const ids=(n:SceneNode)=>{const m=readMetadata(n)!;return [m.objectId,m.controlId];};

test('Stale page.home, home.* and homeexportready.*-2 keys follow current names; navigation follows; IDs stay',async()=>{
  const p=plugin(),{main,audio,button:open,ch01,back}=project();await exportBoth(p,[main,audio]);
  // The state left by a screen first named Home and a slider copied from homeExportReady.
  tag(audio,{...readMetadata(audio)!,key:'page.home'});const title=audio.children[0];
  tag(title,{...readMetadata(title)!,key:'home.title'});tag(ch01,{...readMetadata(ch01)!,key:'homeexportready.ch01-2'});tag(back,{...readMetadata(back)!,key:'home.backtomain'});
  tag(open,{...readMetadata(open)!,navigate:'page.home'});
  const before=[audio,title,ch01,back,open].map(ids);
  const result=await exportBoth(p,[main,audio]);
  assert.deepEqual([audio,title,ch01,back].map(keyOf),['page.audiocontrol','audiocontrol.title','audiocontrol.ch01','audiocontrol.backtomain']);
  assert.equal(readMetadata(open)!.navigate,'page.audiocontrol');assert.deepEqual([audio,title,ch01,back,open].map(ids),before);
  assert.match(result.assignmentSummary,/Ключи обновлены по именам слоёв: 4; ID не изменены/);
  const exported=result.bundle.screen.pages.flatMap((c:any)=>c.elements).find((e:any)=>e.name==='button_AudioControl');assert.equal(exported.navigate,'page.audiocontrol');
  const stable=designSignature(p.page as never);const again=await exportBoth(p,[main,audio]);assert.equal(designSignature(p.page as never),stable);assert.doesNotMatch(again.assignmentSummary,/Ключи обновлены/);
});

test('A key typed in the form survives renames; an emptied field returns to the automatic key',async()=>{
  const p=plugin(),{main,audio,ch01}=project();await exportBoth(p,[main,audio]);const m=readMetadata(ch01)!;
  const form=(key:string,edited:boolean)=>({kind:'button',buttonMode:m.buttonMode,key,objectId:String(m.objectId),controlId:String(m.controlId),navigate:'',selectionGroup:'',enabled:'',visible:'',keyEdited:String(edited)});
  p.page.selection=[ch01 as never];await p.send({type:'apply',data:form('source.channel1',true)});assert.deepEqual(p.messages.filter(x=>x.type==='error'),[]);
  ch01.name='button_Channel1';await exportBoth(p,[main,audio]);assert.equal(keyOf(ch01),'source.channel1');assert.deepEqual(ids(ch01),[m.objectId,m.controlId]);
  // An unchanged key field (another property edited) keeps the manual key.
  p.page.selection=[ch01 as never];await p.send({type:'apply',data:form('source.channel1',false)});await exportBoth(p,[main,audio]);assert.equal(keyOf(ch01),'source.channel1');
  p.page.selection=[ch01 as never];await p.send({type:'apply',data:form('',true)});assert.equal(ch01.getPluginData(MANUAL_KEY),'');
  await exportBoth(p,[main,audio]);assert.equal(keyOf(ch01),'audiocontrol.channel1');assert.deepEqual(ids(ch01),[m.objectId,m.controlId]);
});

test('A copy does not inherit the manual key flag and a failed form save restores it',async()=>{
  const p=plugin(),{main,audio,ch01}=project();await exportBoth(p,[main,audio]);const m=readMetadata(ch01)!;
  tag(ch01,{...m,key:'source.channel1'});ch01.setPluginData(MANUAL_KEY,ch01.id);const copy=ch01.clone();copy.x=400;
  await exportBoth(p,[main,audio]);assert.equal(keyOf(ch01),'source.channel1');assert.equal(keyOf(copy),'audiocontrol.ch01');assert.notDeepEqual(ids(copy),ids(ch01));
  p.page.selection=[ch01 as never];await p.send({type:'apply',data:{kind:'button',buttonMode:m.buttonMode,key:'Bad Key',objectId:String(m.objectId),controlId:String(m.controlId),keyEdited:'true'}});
  assert.equal(p.messages.filter(x=>x.type==='error').at(-1)?.code,'key');assert.equal(ch01.getPluginData(MANUAL_KEY),ch01.id);
});

test('Russian layer names of screens and elements are rejected with a Latin example; nothing is written',async()=>{
  const p=plugin(),{main,audio,ch01}=project();await exportBoth(p,[main,audio]);
  audio.name='Аудио Зал';ch01.name='button_Канал1';const before=designSignature(p.page as never);
  p.page.selection=[main,audio] as never;p.emit('selectionchange');p.messages.length=0;await p.send({type:'export',scopeMode:'selected-frames',profile:'tlp-pro-1025m'});
  const report=p.messages.find(m=>m.type==='recognition') as any;assert.ok(report);assert.equal(p.messages.some(m=>m.type==='bundle'),false);
  assert.deepEqual(Array.from(report.issues,(i:any)=>i.nodeId).sort(),[audio.id,ch01.id].sort());
  assert.ok(report.errors.some((e:string)=>e.includes('Аудио Зал: русские буквы')&&e.includes('screen_AudioZal')));
  assert.ok(report.errors.some((e:string)=>e.includes('button_Канал1: русские буквы')&&e.includes('button_Kanal1')));
  assert.equal(designSignature(p.page as never),before);
  audio.name='screen_AudioZal';ch01.name='button_Kanal1';await exportBoth(p,[main,audio]);assert.deepEqual([keyOf(audio),keyOf(ch01)],['page.audiozal','audiozal.kanal1']);
});

test('Manual prepare rejects a Russian screen name without writing and suggests a Latin one',async()=>{
  const p=plugin(),root=frame(null,'Главная',0,0,1280,800);p.page.selection=[root as never];
  await p.send({type:'prepare',profile:'tlp-pro-1025m'});const error=p.messages.filter(m=>m.type==='error').at(-1) as any;
  assert.equal(error?.code,'name');assert.match(error.message,/screen_Glavnaya/);assert.equal(root.getPluginData('exui'),'');
});

