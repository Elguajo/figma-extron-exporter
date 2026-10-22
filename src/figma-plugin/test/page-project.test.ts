import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma,icons } from './fake-figma.ts';
import { frame,label } from './expanded-fixture.ts';
import { PROFILES,DATA_KEY,readMetadata,type Profile } from '../src/model.ts';
import { recognize,applyRecognition,REGISTRY_KEY } from '../src/recognize.ts';
import { capture,designSignature,exportFrame } from '../src/export.ts';
import { twoScreens } from './page-project-fixture.ts';
import { pageScreens } from '../src/project.ts';
import { createDemo } from '../src/demo.ts';

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:JSON.stringify(Object.fromEntries(Object.entries(icons()).map(([k,v])=>[k,[...v]])))}}).outputFiles[0].text;
function plugin(){const fake=fakeFigma();vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});return{...fake,send:fake.api.ui.onmessage as (message:unknown)=>Promise<void>};}

for(const savedTarget of [false,true])test(`Navigation before recognition is saved (target saved: ${savedTarget})`,async()=>{
 const p=plugin(),{main,audio,button}=twoScreens();
 if(savedTarget){
  applyRecognition(recognize(audio,'tlp-pro-1025m'));
  const m=readMetadata(audio)!;audio.setPluginData(DATA_KEY,JSON.stringify({...m,shownBy:'navigation'}));
 }
 const before=designSignature(p.page as never);
 p.page.selection=[main as never,audio as never];p.emit('selectionchange');
 p.page.selection=[button as never];p.emit('selectionchange');
 const selected=p.messages.filter(m=>m.type==='selection').at(-1) as any;
 assert.ok(selected.targets.some((t:any)=>t.name===audio.name),'unprepared project must offer its target');
 assert.equal(selected.targets.some((t:any)=>t.name===main.name),false);
 assert.ok(selected.metadata?.key,'new button must have draft identity in its editor');
 assert.equal(designSignature(p.page as never),before,'viewing the form must not write assignments');
 await p.send({type:'apply',scopeMode:'selected-frames',profile:'tlp-pro-1025m',data:{...selected.metadata,navigate:selected.targets[0].key}});
 assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);
 assert.equal(readMetadata(button)!.navigate,readMetadata(audio)!.key);
 await p.send({type:'check',scopeMode:'selected-frames',profile:'tlp-pro-1025m'});
 assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);
 assert.deepEqual([...recognize(p.page as never,'tlp-pro-1025m',{members:[main,audio]}).errors],[]);
});
for(const failure of ['invalid-target','invalid-design','write-failure'])test(`New navigation save is atomic on ${failure}`,async()=>{
 const p=plugin(),{main,audio,button}=twoScreens();
 p.page.selection=[main as never,audio as never];p.emit('selectionchange');p.page.selection=[button as never];p.emit('selectionchange');
 const selected=p.messages.filter(m=>m.type==='selection').at(-1) as any;
 if(failure==='invalid-design')audio.children[0].name='unsupported';
 if(failure==='write-failure'){
  const original=audio.setPluginData.bind(audio);let once=true;
  audio.setPluginData=(key,value)=>{if(once&&value){once=false;throw new Error('write failure');}original(key,value);};
 }
 const before=designSignature(p.page as never);
 await p.send({type:'apply',scopeMode:'selected-frames',profile:'tlp-pro-1025m',data:{...selected.metadata,navigate:failure==='invalid-target'?'page.missing':selected.targets[0].key}});
 assert.equal(p.messages.filter(m=>m.type==='error').length,1);
 assert.equal(designSignature(p.page as never),before);
});

test('Current-page scope offers draft navigation targets after reopening without remembered selection',async()=>{
 const p=plugin(),{audio,button}=twoScreens();p.page.selection=[button as never];
 await p.send({type:'context',scopeMode:'page',profile:'tlp-pro-1025m'});
 const selected=p.messages.filter(m=>m.type==='selection').at(-1) as any;
 assert.ok(selected.targets.some((t:any)=>t.name===audio.name));
 await p.send({type:'apply',scopeMode:'page',profile:'tlp-pro-1025m',data:{...selected.metadata,navigate:selected.targets[0].key}});
 assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);
 assert.equal(readMetadata(button)!.navigate,readMetadata(audio)!.key);
});

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
 test(`Selected frames ${profile}: one project, no wrapper, unrelated frames untouched, navigation survives editing`,async()=>{
  const p=plugin(),{main,audio,button}=twoScreens(profile),scratch=frame(null,'Scratch',0,1200,100,100,'#AABBCC'),untouched=designSignature(scratch);
  const layout=()=>JSON.stringify([main,audio].map(n=>[n.id,n.parent!.id,n.x,n.y,n.width,n.height]));const before=layout();
  p.page.selection=[main as never,audio as never];p.emit('selectionchange');
  assert.equal(p.messages.filter(m=>m.type==='selection').at(-1)?.scopeMode,'selected-frames');
  await p.send({type:'recognize',scopeMode:'selected-frames',profile});const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;
  assert.deepEqual([...report.errors],[]);assert.equal(main.getPluginData(DATA_KEY),'');
  await p.send({type:'apply-recognition',scopeMode:'selected-frames',profile,token:report.token});
  assert.equal(layout(),before);assert.equal(designSignature(scratch),untouched);assert.equal(p.page.children.length,3);
  p.page.selection=[button as never];p.emit('selectionchange');const selected=p.messages.filter(m=>m.type==='selection').at(-1) as any;
  assert.equal(selected.scope.kind,'project');assert.ok(selected.targets.some((t:any)=>t.key==='page.audiocontrol'));
  await p.send({type:'apply',scopeMode:'selected-frames',profile,data:{...readMetadata(button),navigate:'page.audiocontrol'}});
  p.page.selection=[audio as never];p.emit('selectionchange');
  await p.send({type:'apply',scopeMode:'selected-frames',profile,data:{...readMetadata(audio),shownBy:'navigation'}});
  await p.send({type:'check',scopeMode:'selected-frames',profile});await p.send({type:'export',scopeMode:'selected-frames',profile});
  assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;
  // Pages are ordered by name; the first selected page remains the start page.
  const [audioPage,mainPage]=bundle.screen.pages;assert.deepEqual([audioPage.name,mainPage.name],['screen_AudioControl','screen_Main']);
  assert.equal(bundle.screen.pages.length,2);assert.equal(mainPage.shownBy,'start');assert.equal(bundle.screen.project.name,'fixture');
  assert.equal(mainPage.elements.find((e:any)=>e.kind==='button').navigate,'page.audiocontrol');assert.equal(designSignature(scratch),untouched);
  assert.equal(audioPage.shownBy,'navigation');
 });
}

test('Current-page mode filters panel sizes, traverses sections and skips scratch/component frames',async()=>{
 const p=plugin(),{main,audio}=twoScreens(),other=frame(null,'screen_Mobile',0,900,320,480,'#101010'),scratch=frame(null,'Scratch',0,1500,1280,800,'#000000'),section=p.api.createSection();
 section.appendChild(audio as never);const before=[other,scratch].map(designSignature);
 const found=pageScreens(p.page as never,'tlp-pro-1025m');assert.deepEqual(found.map(n=>n.id),[main.id,audio.id]);
 p.page.selection=[];await p.send({type:'context',scopeMode:'page',profile:'tlp-pro-1025m'});
 const context=p.messages.filter(m=>m.type==='selection').at(-1) as any;assert.equal(context.canRecognize,true);assert.equal(context.id,null);
 await p.send({type:'recognize',scopeMode:'page',profile:'tlp-pro-1025m'});const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;
 assert.deepEqual([...report.errors],[]);await p.send({type:'apply-recognition',scopeMode:'page',profile:'tlp-pro-1025m',token:report.token});await p.send({type:'export',scopeMode:'page',profile:'tlp-pro-1025m'});
 assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);assert.deepEqual([other,scratch].map(designSignature),before);assert.equal(section.getPluginData(DATA_KEY),'');
});

test('Page project plan rolls back writes and refuses stale membership or a changed scope',async()=>{
 const p=plugin(),{main,audio}=twoScreens(),root=p.page as never as PageNode,options={members:[main,audio],projectName:'AV'};
 const plan=recognize(root,'tlp-pro-1025m',options),before=designSignature(root),original=audio.setPluginData.bind(audio);let failOnce=true;
 audio.setPluginData=(k,v)=>{if(failOnce&&v){failOnce=false;throw new Error('write failure');}original(k,v);};
 assert.throws(()=>applyRecognition(plan),/write failure/);assert.equal(designSignature(root),before);
 const next=recognize(root,'tlp-pro-1025m',options);audio.name='screen_Other';assert.throws(()=>applyRecognition(next),(e:any)=>e.code==='design-changed');
 p.page.selection=[main as never,audio as never];await p.send({type:'recognize',scopeMode:'selected-frames',profile:'tlp-pro-1025m'});const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;
 await p.send({type:'context',scopeMode:'page',profile:'tlp-pro-1025m'});await p.send({type:'apply-recognition',scopeMode:'page',profile:'tlp-pro-1025m',token:report.token});
 assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'recognition');assert.equal(root.getPluginData(REGISTRY_KEY),'');
});

test('Separately assigned duplicate container IDs are repaired in a draft; unique assignments remain intact',()=>{
 const p=plugin(),{main,audio}=twoScreens();applyRecognition(recognize(main,'tlp-pro-1025m'));applyRecognition(recognize(audio,'tlp-pro-1025m'));
 const before=[main,audio].map(designSignature),plan=recognize(p.page as never,'tlp-pro-1025m',{members:[main,audio]});
 assert.deepEqual(plan.errors,[]);assert.deepEqual([main,audio].map(designSignature),before);applyRecognition(plan);
 assert.equal(designSignature(main),before[0]);assert.notEqual(readMetadata(main)!.objectId,readMetadata(audio)!.objectId);
 assert.equal(recognize(p.page as never,'tlp-pro-1025m',{members:[main,audio]}).writes.length,0);
});

test('Page registry reserves deleted IDs across selected subsets and rejects export without an explicit subset',()=>{
 const p=plugin(),{main,audio}=twoScreens(),root=p.page as never as PageNode;applyRecognition(recognize(root,'tlp-pro-1025m',{members:[main,audio]}));
 const id=readMetadata(audio)!.objectId!;audio.remove();const size=PROFILES['tlp-pro-1025m'],next=frame(null,'screen_New',0,0,size.width,size.height,'#101010');label(next,'text_Title','New',0,0,100,30);
 applyRecognition(recognize(root,'tlp-pro-1025m',{members:[main,next]}));assert.ok(readMetadata(next)!.objectId!>id);
 assert.throws(()=>capture(root),(e:any)=>e.code==='project-scope');
});

test('Selected page export retains PNGs and aborts source edits during rendering without leaking clones',async()=>{
 const p=plugin(),screen=await createDemo('tlp-pro-300m-portrait',icons()),root=p.page as never as PageNode,options={members:[screen]};
 applyRecognition(recognize(root,'tlp-pro-300m-portrait',options));const initial=await exportFrame(root,()=>{},options);assert.equal(initial.resources.length,2);
 const ids=p.page.children.map(n=>n.id);let once=true;p.setRenderHook(()=>{if(once){once=false;screen.children[1].x++;}});
 await assert.rejects(exportFrame(root,()=>{},options),(e:any)=>e.code==='design-changed');assert.deepEqual(p.page.children.map(n=>n.id),ids);
});

test('Changing the active page during a batch export cannot deliver a bundle for the old page',async()=>{
 const p=plugin(),screen=await createDemo('tlp-pro-300m-portrait',icons());p.page.selection=[screen as never];
 await p.send({type:'recognize',scopeMode:'selected-frames',profile:'tlp-pro-300m-portrait'});const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;
 await p.send({type:'apply-recognition',scopeMode:'selected-frames',profile:'tlp-pro-300m-portrait',token:report.token});
 const originalIds=p.page.children.map(n=>n.id),other=new p.FakeNode('PAGE') as any;other.name='Other';other.selection=[];let once=true;
 p.setRenderHook(()=>{if(once){once=false;p.api.currentPage=other;p.emit('currentpagechange');}});
 await p.send({type:'export',scopeMode:'selected-frames',profile:'tlp-pro-300m-portrait'});
 assert.equal(p.messages.some(m=>m.type==='bundle'),false);assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'design-changed');
 assert.deepEqual(p.page.children.map(n=>n.id),originalIds);assert.equal(other.children.length,0);
});
