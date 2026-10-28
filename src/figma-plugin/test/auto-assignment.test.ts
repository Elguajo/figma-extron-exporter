// Runs the bundled command handler across the Figma API fixture boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma,icons } from './fake-figma.ts';
import { expandedFixture,frame,label,sectionFixture } from './expanded-fixture.ts';
import { namedFixture } from './named-fixture.ts';
import { twoScreens } from './page-project-fixture.ts';
import { createDemo,tag } from '../src/demo.ts';
import { DATA_KEY,readMetadata,PROFILES,type Profile } from '../src/model.ts';
import { recognize,applyRecognition,REGISTRY_KEY } from '../src/recognize.ts';
import { capture,designSignature } from '../src/export.ts';
import { packageExui } from '../src/package.ts';

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:JSON.stringify(Object.fromEntries(Object.entries(icons()).map(([k,v])=>[k,[...v]])))}}).outputFiles[0].text;
function plugin(){const fake=fakeFigma();const restart=()=>vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});restart();return{...fake,restart,send:(m:unknown)=>(fake.api.ui.onmessage as (m:unknown)=>Promise<void>)(m)};}
function latestBundle(p:ReturnType<typeof plugin>){assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);const message=p.messages.filter(m=>m.type==='bundle').at(-1) as any;assert.ok(message);return message.bundle;}

for(const profile of Object.keys(PROFILES) as Profile[])for(const command of ['check','export'])test(`${profile}: ${command} assigns an untouched screen, repeated export and restart keep identity`,async()=>{
 const p=plugin(),root=expandedFixture(profile);p.page.selection=[root as never];p.emit('selectionchange');
 const context=p.messages.filter(m=>m.type==='selection').at(-1) as any;assert.equal(context.scope.id,root.id);assert.equal(root.getPluginData(DATA_KEY),'');
 await p.send({type:command,profile});assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);
 const slider=readMetadata(root.children[0])!;assert.equal(slider.ownerNodeId,root.children[0].id);assert.ok(slider.key);assert.ok(slider.objectId);assert.ok(slider.controlId);
 const before=designSignature(root);await p.send({type:'export',profile});const bundle=latestBundle(p),first=packageExui(bundle);
 const exported=bundle.screen.elements.find((e:any)=>e.kind==='slider');assert.equal(exported.min,0);assert.equal(exported.max,100);assert.equal(exported.orientation,'left-to-right');
 assert.equal(designSignature(root),before);p.restart();await p.send({type:'export',profile});assert.deepEqual(packageExui(latestBundle(p)),first);assert.equal(designSignature(root),before);
});

test('Copied renamed slider keeps custom range and behavior while the original wins even after reordering',async()=>{
 const p=plugin(),root=expandedFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));const slider=root.children[0];
 tag(slider,{...readMetadata(slider)!,min:10,max:255,orientation:'right-to-left',behavior:{enabled:true,visible:false}});(slider as FrameNode).children.find(n=>n.name==='Fill')!.x=156;
 const original=slider.getPluginData(DATA_KEY),copy=slider.clone();copy.name='slider_SecondHallVolume';copy.y=350;
 (root.children as any).splice((root.children as any).indexOf(copy),1);(root.children as any).unshift(copy);
 p.page.selection=[copy as never];await p.send({type:'export'});const bundle=latestBundle(p),m=readMetadata(copy)!;
 assert.equal(slider.getPluginData(DATA_KEY),original);assert.equal(m.ownerNodeId,copy.id);assert.notEqual(m.key,readMetadata(slider)!.key);assert.notEqual(m.objectId,readMetadata(slider)!.objectId);assert.notEqual(m.controlId,readMetadata(slider)!.controlId);
 assert.equal(m.min,10);assert.equal(m.max,255);assert.equal(m.orientation,'right-to-left');assert.deepEqual(m.behavior,{enabled:true,visible:false});assert.equal(bundle.screen.elements.find((e:any)=>e.key===m.key).max,255);
});

test('Copied button repairs its states and PNGs without changing the original or the layer names',async()=>{
 const p=plugin(),root=await createDemo('tlp-pro-1025m',icons()),button=root.children[0],before=designSignature(button),copy=button.clone();copy.x=600;
 const names=(n:SceneNode):unknown=>[n.name,...('children' in n?n.children.map(names):[])],oldNames=names(copy);
 p.page.selection=[copy as never];await p.send({type:'export'});const bundle=latestBundle(p);
 assert.equal(designSignature(button),before);assert.deepEqual(names(copy),oldNames);
 const visit=(n:SceneNode)=>{const m=readMetadata(n);if(m)assert.equal(m.ownerNodeId,n.id);if('children' in n)for(const c of n.children)visit(c);};visit(copy);
 assert.ok(bundle.resources.length>2);assert.equal(new Set(bundle.resources.map((r:any)=>r.path)).size,bundle.resources.length);const stable=designSignature(root);await p.send({type:'export'});latestBundle(p);assert.equal(designSignature(root),stable);
});

test('Independently prepared Main Dashboard and Audio Control with page.home/100 export together under name-derived keys',async()=>{
 const p=plugin(),{main,audio}=twoScreens();main.name='Main Dashboard';audio.name='Audio Control';
 for(const screen of [main,audio])tag(screen,{kind:'page',key:'page.home',objectId:100,profile:'tlp-pro-1025m',projectName:'Trilliant'});
 const first=main.getPluginData(DATA_KEY);p.page.selection=[main as never,audio as never];p.emit('selectionchange');await p.send({type:'export',scopeMode:'selected-frames',profile:'tlp-pro-1025m'});
 const bundle=latestBundle(p);assert.deepEqual({...readMetadata(main),key:undefined},{...JSON.parse(first),key:undefined});assert.deepEqual([readMetadata(main)!.key,readMetadata(audio)!.key],['page.main-dashboard','page.audio-control']);assert.notEqual(readMetadata(main)!.objectId,readMetadata(audio)!.objectId);
 assert.equal(bundle.screen.pages.length,2);assert.deepEqual(Array.from(bundle.screen.pages,(c:any)=>[c.name,c.shownBy]),[['Main Dashboard','start'],['Audio Control','program']]);
});

test('Standalone screens with colliding control IDs and PNG paths merge without collisions',async()=>{
 const p=plugin(),first=await namedFixture(),second=await namedFixture();second.name='Audio';
 applyRecognition(recognize(first,'tlp-pro-1025m'));applyRecognition(recognize(second,'tlp-pro-1025m'));const before=designSignature(first);
 p.page.selection=[first as never,second as never];p.emit('selectionchange');await p.send({type:'export',scopeMode:'selected-frames',profile:'tlp-pro-1025m'});const bundle=latestBundle(p);
 assert.equal(designSignature(first),before);const all=bundle.screen.pages.flatMap((c:any)=>c.elements),ids=all.filter((e:any)=>e.controlId!==null).map((e:any)=>e.controlId);assert.equal(new Set(ids).size,ids.length);assert.equal(new Set(all.map((e:any)=>e.key)).size,all.length);
 assert.equal(new Set(bundle.screen.assets.map((a:any)=>a.file)).size,bundle.screen.assets.length);assert.ok(bundle.resources.length>2);
});

test('Whole-screen copies, including a cloned registry and identical names, get stable exported identities',async()=>{
 const p=plugin(),root=await createDemo('tlp-pro-1025m',icons());applyRecognition(recognize(root,'tlp-pro-1025m'));const copy=root.clone(),before=designSignature(root);
 p.page.selection=[root as never,copy as never];p.emit('selectionchange');await p.send({type:'export',scopeMode:'selected-frames',profile:'tlp-pro-1025m'});const bundle=latestBundle(p);
 assert.equal(designSignature(root),before);assert.equal(copy.name,root.name);assert.notEqual(bundle.screen.pages[0].name,bundle.screen.pages[1].name);assert.notEqual(readMetadata(root)!.key,readMetadata(copy)!.key);
 const stable=designSignature(p.page as never);await p.send({type:'export',scopeMode:'selected-frames',profile:'tlp-pro-1025m'});latestBundle(p);assert.equal(designSignature(p.page as never),stable);
});

test('Copied complete project remaps internal popup/group targets and ignores legacy navigation and keeps original source intact',async()=>{
 const p=plugin(),root=sectionFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));
 const pages=root.children.filter(n=>readMetadata(n)?.kind==='page'),button=(pages[0] as FrameNode).children.find(n=>readMetadata(n)?.kind==='button')!;
 tag(button,{...readMetadata(button)!,navigate:readMetadata(pages[1])!.key});tag(pages[1],{...readMetadata(pages[1])!,shownBy:'navigation'});
 const before=designSignature(root),copy=root.clone();p.page.selection=[copy as never];await p.send({type:'export'});const bundle=latestBundle(p);
 assert.equal(designSignature(root),before);assert.equal(bundle.screen.pages.length,2);assert.equal(bundle.screen.pages.flatMap((p:any)=>p.elements).some((e:any)=>Object.hasOwn(e,'navigate')),false);assert.equal(bundle.screen.pages[1].shownBy,'program');assert.ok(bundle.screen.popups.length);capture(copy);
});

test('Repeated fresh ordinary layers receive distinct keys, objects and controls',async()=>{
 const p=plugin(),root=expandedFixture(),slider=root.children[0],copy=slider.clone();copy.y=350;p.page.selection=[root as never];await p.send({type:'export'});latestBundle(p);
 const a=readMetadata(slider)!,b=readMetadata(copy)!;assert.notEqual(a.key,b.key);assert.notEqual(a.objectId,b.objectId);assert.notEqual(a.controlId,b.controlId);
});

test('Invalid structure or a failed assignment write cannot persist a partial automatic repair',async()=>{
 const p=plugin(),root=expandedFixture();p.page.selection=[root as never];const slider=root.children[0] as FrameNode,thumb=slider.children.find(n=>n.name==='Thumb')!;thumb.name='Missing';const before=designSignature(root);
 await p.send({type:'export'});assert.equal(p.messages.some(m=>m.type==='bundle'),false);assert.equal(designSignature(root),before);
 thumb.name='Thumb';const validBefore=designSignature(root),original=root.children[1].setPluginData.bind(root.children[1]);let once=true;
 root.children[1].setPluginData=(k,v)=>{if(v&&once){once=false;throw new Error('write denied');}original(k,v);};await p.send({type:'export'});
 assert.equal(p.messages.some(m=>m.type==='bundle'),false);assert.equal(designSignature(root),validBefore);assert.equal(root.getPluginData(REGISTRY_KEY),'');
});

test('Page mode auto-assigns only eligible screens and leaves scratch frames untouched',async()=>{
 const p=plugin(),{main,audio}=twoScreens(),scratch=frame(null,'Scratch',0,900,1280,800,'#123456'),before=designSignature(scratch);p.page.selection=[];
 await p.send({type:'export',scopeMode:'page',profile:'tlp-pro-1025m'});const bundle=latestBundle(p);assert.equal(bundle.screen.pages.length,2);assert.equal(designSignature(scratch),before);assert.ok(readMetadata(main));assert.ok(readMetadata(audio));
});

test('Manual prepare uses frame-derived keys and different IDs for neighboring screens',async()=>{
 const p=plugin();for(const name of ['Main Dashboard','Audio Control']){const n=frame(null,name,0,0,1280,800);label(n,'text_Title',name,10,10,200,30);p.page.selection=[n as never];await p.send({type:'prepare',profile:'tlp-pro-1025m'});}
 const screens=p.page.children;assert.equal(readMetadata(screens[0] as never)!.key,'page.main-dashboard');assert.equal(readMetadata(screens[1] as never)!.key,'page.audio-control');assert.notEqual(readMetadata(screens[0] as never)!.objectId,readMetadata(screens[1] as never)!.objectId);
});

test('An exhausted control registry cannot leave a copied element partially repaired',async()=>{
 const p=plugin(),root=expandedFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));const copy=root.children[0].clone();copy.y=350;
 const registry=JSON.parse(root.getPluginData(REGISTRY_KEY));registry.nextControlId=65536;root.setPluginData(REGISTRY_KEY,JSON.stringify(registry));const before=designSignature(root);p.page.selection=[root as never];
 await p.send({type:'export'});assert.equal(p.messages.some(m=>m.type==='bundle'),false);assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'id');assert.equal(designSignature(root),before);
});

test('Automatic export rejects corrupt metadata without silently resetting it',async()=>{
 const p=plugin(),root=expandedFixture();root.children[0].setPluginData(DATA_KEY,JSON.stringify({schema:'future',ownerNodeId:root.children[0].id,kind:'slider'}));const before=designSignature(root);p.page.selection=[root as never];
 await p.send({type:'export'});assert.equal(p.messages.some(m=>m.type==='bundle'),false);assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'metadata');assert.equal(designSignature(root),before);
});

test('Retry after PNG render failure reuses the automatically saved assignments',async()=>{
 const p=plugin(),root=await namedFixture();p.page.selection=[root as never];p.setRenderHook(()=>{throw new Error('render unavailable');});await p.send({type:'export'});
 assert.equal(p.messages.some(m=>m.type==='bundle'),false);assert.ok(readMetadata(root));const before=designSignature(root);p.setRenderHook(()=>{});p.messages.length=0;
 await p.send({type:'export'});latestBundle(p);assert.equal(designSignature(root),before);
});

for(const command of ['check','export'])test(`${command} repairs stale Off/On metadata automatically and keeps the repair stable`,async()=>{
 const p=plugin(),root=await namedFixture('tlp-pro-1025m',true),button=root.children[0] as FrameNode;
 applyRecognition(recognize(root,'tlp-pro-1025m'));const identity=button.getPluginData(DATA_KEY);
 button.children[0].name='On';button.children[1].name='Off';
 for(const state of button.children){const m=readMetadata(state)!;state.setPluginData(DATA_KEY,JSON.stringify({...m,schema:'exui-node/2',role:'feedback',stateId:7,stateName:'Passive'}));}
 p.page.selection=[root as never];await p.send({type:command,profile:'tlp-pro-1025m'});
 assert.deepEqual(p.messages.filter(m=>m.type==='error'||m.type==='recognition'),[]);
 assert.equal(button.getPluginData(DATA_KEY),identity);
 assert.deepEqual(button.children.map(s=>[readMetadata(s)!.stateName,readMetadata(s)!.role,readMetadata(s)!.stateId]),[['On','feedback',1],['Off','normal',0]]);
 if(command==='export')assert.deepEqual([...latestBundle(p).screen.elements[0].states.map((s:any)=>s.name)],['Off','On']);
 const stable=designSignature(root);await p.send({type:command,profile:'tlp-pro-1025m'});assert.equal(designSignature(root),stable);
});

for(const command of ['check','export'])test(`${command} automatically hides the extra Passive/Active preview layer and keeps persistent identities`,async()=>{
 const p=plugin(),root=await namedFixture('tlp-pro-1025m',true),button=root.children[0] as FrameNode;
 button.name='button_side.hall';button.children.forEach((s,i)=>s.name=['Active','Passive'][i]);
 p.page.selection=[root as never];await p.send({type:'check'});const identity=button.getPluginData(DATA_KEY);
 button.children.forEach(s=>s.visible=true);p.messages.length=0;await p.send({type:command});
 assert.deepEqual(p.messages.filter(m=>m.type==='error'||m.type==='recognition'),[]);
 assert.deepEqual(button.children.map(s=>s.visible),[false,true]);assert.equal(button.getPluginData(DATA_KEY),identity);
 const result=p.messages.find(m=>m.type===(command==='check'?'success':'bundle'))!;
 assert.match(String(command==='check'?result.message:result.assignmentSummary),/предпросмотр кнопок: 1/);
 if(command==='export')assert.deepEqual([...(result.bundle as any).screen.elements[0].states.map((s:any)=>s.name)],['Passive','Active']);
 const before=designSignature(root);await p.send({type:'export'});latestBundle(p);assert.equal(designSignature(root),before);
});

test('Selected-frame project repairs previews only in selected screens',async()=>{
 const p=plugin(),first=await namedFixture('tlp-pro-1025m',true),second=await namedFixture('tlp-pro-1025m',true),outside=await namedFixture('tlp-pro-1025m',true);
 for(const root of [first,second,outside])(root.children[0] as FrameNode).children.forEach(s=>s.visible=true);
 const untouched=designSignature(outside);p.page.selection=[first as never,second as never];
 await p.send({type:'export',scopeMode:'selected-frames',profile:'tlp-pro-1025m'});const bundle=latestBundle(p);
 assert.equal(bundle.screen.pages.length,2);assert.equal(designSignature(outside),untouched);
 for(const root of [first,second])assert.equal((root.children[0] as FrameNode).children.filter(s=>s.visible).length,1);
});

test('Recognition review leaves both states visible until assignments are applied',async()=>{
 const p=plugin(),root=await namedFixture('tlp-pro-1025m',true),button=root.children[0] as FrameNode;
 button.children.forEach(s=>s.visible=true);const before=designSignature(root);p.page.selection=[root as never];
 await p.send({type:'recognize',profile:'tlp-pro-1025m'});const report=p.messages.find(m=>m.type==='recognition')!;
 assert.deepEqual([...report.errors as string[]],[]);assert.equal(designSignature(root),before);
 await p.send({type:'apply-recognition',profile:'tlp-pro-1025m',token:report.token});
 assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);assert.equal(button.children.filter(s=>s.visible).length,1);
});
