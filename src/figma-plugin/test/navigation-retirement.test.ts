import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma,icons } from './fake-figma.ts';
import { twoScreens } from './page-project-fixture.ts';
import { sectionFixture } from './expanded-fixture.ts';
import { DATA_KEY,readMetadata } from '../src/model.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { capture,designSignature,exportFrame } from '../src/export.ts';

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:JSON.stringify(Object.fromEntries(Object.entries(icons()).map(([k,v])=>[k,[...v]])))}}).outputFiles[0].text;
function plugin(){const f=fakeFigma();vm.runInNewContext(source,{figma:f.api,Uint8Array,console});return {...f,send:f.api.ui.onmessage as (m:unknown)=>Promise<void>};}
function legacy(node:SceneNode,data:Record<string,unknown>){node.setPluginData(DATA_KEY,JSON.stringify({...JSON.parse(node.getPluginData(DATA_KEY)),...data}));}
function ids(node:SceneNode){const m=readMetadata(node)!;return [m.key,m.objectId,m.controlId,m.stateId,m.stateName];}

for(const schema of ['exui-node/1','exui-node/2','exui-node/3'])test(`Legacy ${schema}: navigation is ignored on read without rewriting saved data`,()=>{
 const p=plugin(),{main,button}=twoScreens();applyRecognition(recognize(main,'tlp-pro-1025m'));
 legacy(button,{schema,navigate:'page.deleted',...(schema==='exui-node/3'?{buttonMode:'on-off'}:{buttonMode:undefined})});
 const raw=button.getPluginData(DATA_KEY),identity=ids(button),m=readMetadata(button)!;
 assert.equal(Object.hasOwn(m,'navigate'),false);assert.deepEqual(ids(button),identity);assert.equal(button.getPluginData(DATA_KEY),raw);
 const captured=capture(main).screen;assert.ok('elements' in captured);assert.equal(captured.elements.some(e=>Object.hasOwn(e,'navigate')),false);
});

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)for(const target of ['page.deleted','page.main',42])test(`Legacy navigation ${target}, ${profile}: check/export keep IDs, states and repeated export stable`,async()=>{
 const p=plugin(),{main,audio,button}=twoScreens(profile),options={members:[main,audio]};
 applyRecognition(recognize(p.page as never,profile,options));
 legacy(button,{navigate:target});legacy(audio,{shownBy:'navigation'});
 const nodes=[main,audio,button,...(button as FrameNode).children],before=nodes.map(ids),raw=nodes.map(n=>n.getPluginData(DATA_KEY));
 p.page.selection=[main as never,audio as never];p.emit('selectionchange');
 assert.deepEqual(nodes.map(n=>n.getPluginData(DATA_KEY)),raw,'opening the editor is read-only');
 await p.send({type:'check',scopeMode:'selected-frames',profile});await p.send({type:'export',scopeMode:'selected-frames',profile});
 assert.deepEqual(p.messages.filter(m=>m.type==='error'||m.type==='recognition'),[]);
 const screen=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle.screen;
 assert.deepEqual(Array.from(screen.pages,(c:any)=>c.shownBy),['start','program']);
 assert.equal(screen.pages.some((c:any)=>c.elements.some((e:any)=>Object.hasOwn(e,'navigate'))),false);
 assert.deepEqual(nodes.map(ids),before);assert.deepEqual(nodes.map(n=>n.getPluginData(DATA_KEY)),raw);
 const stable=designSignature(p.page as never);await p.send({type:'export',scopeMode:'selected-frames',profile});
 assert.equal(designSignature(p.page as never),stable);assert.deepEqual(nodes.map(ids),before);
});

test('Legacy additional page exports alone without requiring its former navigation source',async()=>{
 fakeFigma();const {audio}=twoScreens();applyRecognition(recognize(audio,'tlp-pro-1025m'));legacy(audio,{shownBy:'navigation'});
 const before=designSignature(audio),bundle=await exportFrame(audio);
 assert.ok('page' in bundle.screen);assert.equal(bundle.screen.page.objectId,readMetadata(audio)!.objectId);assert.equal(designSignature(audio),before);
});

test('Legacy popup navigation does not affect popup placement, modal flags or group references',async()=>{
 fakeFigma();const root=sectionFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));
 const baseline=capture(root).screen;assert.ok('popups' in baseline);
 for(const child of root.children)if(readMetadata(child)?.kind==='popup')legacy(child,{shownBy:'navigation'});
 const bundle=await exportFrame(root);assert.ok('popups' in bundle.screen);
 assert.deepEqual(bundle.screen.popups,baseline.popups);assert.deepEqual(bundle.screen.groups,baseline.groups);
 assert.deepEqual(bundle.screen.pages,baseline.pages);
});

test('Retired fields from an old form cannot add sibling screens to export or save navigation',async()=>{
 const p=plugin(),{main,audio,button}=twoScreens();applyRecognition(recognize(main,'tlp-pro-1025m'));
 p.page.selection=[main as never];p.emit('selectionchange');
 const untouched=designSignature(audio),id=readMetadata(button)!.controlId;
 p.page.selection=[button as never];await p.send({type:'context',scopeMode:'selection'});
 const selection=p.messages.filter(m=>m.type==='selection').at(-1) as any;
 assert.equal(selection.targets,undefined);
 await p.send({type:'apply',data:{...selection.metadata,navigate:'page.audiocontrol',navigationTargetId:audio.id}});
 await p.send({type:'export'});assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);
 const screen=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle.screen;
 assert.ok('page' in screen);assert.equal(screen.elements.find((e:any)=>e.kind==='button').controlId,id);
 assert.equal(Object.hasOwn(JSON.parse(button.getPluginData(DATA_KEY)),'navigate'),false);assert.equal(designSignature(audio),untouched);
});

test('Failure writing renamed legacy assignments rolls back their exact stored records and IDs',()=>{
 fakeFigma();const {main,audio,button}=twoScreens(),root=figma.currentPage,options={members:[main,audio]};
 applyRecognition(recognize(root,'tlp-pro-1025m',options));legacy(button,{navigate:'page.audiocontrol'});legacy(audio,{shownBy:'navigation'});
 main.name='screen_Renamed';audio.name='screen_NewAudio';
 const before=designSignature(root),identity=[main,audio,button].map(ids),plan=recognize(root,'tlp-pro-1025m',options);
 const original=audio.setPluginData.bind(audio);let once=true;audio.setPluginData=(k,v)=>{if(once&&v){once=false;throw new Error('write failure');}original(k,v);};
 assert.deepEqual(plan.errors,[]);assert.throws(()=>applyRecognition(plan),/write failure/);
 assert.equal(designSignature(root),before);assert.deepEqual([main,audio,button].map(ids),identity);
});
