import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { icons, fakeFigma } from './fake-figma.ts';
import { namedFixture } from './named-fixture.ts';
import { createDemo } from '../src/demo.ts';
import { projectFixture,sectionFixture } from './expanded-fixture.ts';
import { kitFixture } from './kit-fixture.ts';
import { strokeLineFixture } from './stroke-line-fixture.ts';
const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:JSON.stringify(Object.fromEntries(Object.entries(icons()).map(([k,v])=>[k,[...v]])))}}).outputFiles[0].text;
function plugin(){const fake=fakeFigma();vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});return{...fake,send:fake.api.ui.onmessage as (message:unknown)=>Promise<void>};}

test('Manual Pen line mapping → check/export from a child; invalid curves do not overwrite metadata',async()=>{
 const p=plugin(),root=await strokeLineFixture(),line=root.children[0] as VectorNode;
 p.page.selection=[root as never];await p.send({type:'prepare',profile:'tlp-pro-1025m'});
 p.page.selection=[line as never];await p.send({type:'apply',data:{kind:'line',key:'home.pen',objectId:'7',keyEdited:'true'}});
 const metadata=line.getPluginData('exui');assert.equal(JSON.parse(metadata).kind,'line');
 // The other lines are unmapped, so recognize the complete screen before exporting.
 p.page.selection=[root as never];await p.send({type:'recognize',profile:'tlp-pro-1025m'});
 const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;assert.deepEqual([...report.errors],[]);
 await p.send({type:'apply-recognition',profile:'tlp-pro-1025m',token:report.token});
 p.page.selection=[line as never];await p.send({type:'check'});await p.send({type:'export'});
 assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);
 const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;
 assert.equal(bundle.screen.elements[0].objectId,7);assert.equal(bundle.resources.length,0);
 (line.vectorNetwork.segments[0] as any).tangentStart={x:2,y:5};
 await p.send({type:'apply',data:{kind:'line',key:'home.changed',objectId:'99'}});
 assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'line-path');
 assert.equal(line.getPluginData('exui'),metadata);
});

test('Section project: recognize → map navigation by target list → check/export from a child',async()=>{
 const p=plugin(),root=sectionFixture('tlp-pro-300m-portrait');p.page.selection=[root as never];
 await p.send({type:'recognize',profile:'tlp-pro-300m-portrait'});const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;assert.deepEqual([...report.errors],[]);
 await p.send({type:'apply-recognition',token:report.token,profile:'tlp-pro-300m-portrait'});
 const home=root.children[0] as FrameNode,button=home.children.find(n=>n.name==='button_Connection')!;p.page.selection=[button as never];p.emit('selectionchange');
 const selection=p.messages.filter(m=>m.type==='selection').at(-1) as any;assert.equal(selection.scope.id,root.id);assert.equal(selection.scope.kind,'project');assert.equal(selection.scope.profile,'tlp-pro-300m-portrait');
 assert.ok(selection.targets.some((t:any)=>t.key==='page.settings'));assert.equal(selection.targets.some((t:any)=>t.key==='page.home'),false);
 const m=JSON.parse(button.getPluginData('exui'));await p.send({type:'apply',data:{...m,buttonMode:'legacy',navigate:'page.settings'}});
 p.page.selection=[root.children[1] as never];const settings=JSON.parse(root.children[1].getPluginData('exui'));await p.send({type:'apply',data:{...settings,shownBy:'navigation'}});
 p.page.selection=[button as never];await p.send({type:'check'});await p.send({type:'export'});
 assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;
 assert.equal(bundle.screen.pages.length,2);assert.equal(bundle.screen.pages[0].elements.find((e:any)=>e.key===m.key).navigate,'page.settings');
});

test('Manual mapping supports Section only as a project and preserves an invalid selection',async()=>{
 const p=plugin(),section=p.api.createSection();section.name='Trilliant';p.page.selection=[section];
 await p.send({type:'apply',data:{kind:'project',key:'project.trilliant',projectName:'Trilliant',profile:'tlp-pro-1025m'}});
 assert.equal(JSON.parse(section.getPluginData('exui')).kind,'project');const before=section.getPluginData('exui');
 await p.send({type:'apply',data:{kind:'page',key:'page.home',objectId:'100',projectName:'Trilliant',profile:'tlp-pro-1025m'}});
 assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'node-type');assert.equal(section.getPluginData('exui'),before);
});

test('Built plugin creates the kit without selection, then recognizes its example',async()=>{
 const fake=kitFixture();vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});const send=fake.api.ui.onmessage as (m:unknown)=>Promise<void>;
 await send({type:'kit',profile:'tlp-pro-300m-portrait'});assert.equal(fake.messages.some(m=>m.type==='error'),false);
 assert.equal(fake.page.selection[0].name,'screen_Home');assert.equal(fake.page.selection[0].width,320);
 await send({type:'recognize',profile:'tlp-pro-300m-portrait'});const report=fake.messages.filter(m=>m.type==='recognition').at(-1) as any;assert.deepEqual([...report.errors],[]);
 await send({type:'apply-recognition',profile:'tlp-pro-300m-portrait',token:report.token});await send({type:'export'});
 assert.equal(fake.messages.some(m=>m.type==='error'),false);assert.ok(fake.messages.some(m=>m.type==='bundle'));
});

test('Manual mapping refuses an instance as a project/page container without saving metadata',async()=>{
 const fake=kitFixture();vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});const send=fake.api.ui.onmessage as (m:unknown)=>Promise<void>;
 const instance=new fake.FakeNode('INSTANCE');fake.page.appendChild(instance);fake.page.selection=[instance];
 for(const kind of ['project','page']){
  await send({type:'apply',data:{kind,key:kind+'.test',objectId:'100',profile:'tlp-pro-1025m',projectName:'Test'}});
  assert.equal(fake.messages.filter(m=>m.type==='error').at(-1)?.code,'node-type');assert.equal(instance.getPluginData('exui'),'');
 }
});

test('Built plugin exports the whole project from a selected control, edits range/behavior and previews individual feedback states',async()=>{
 const p=plugin(),root=projectFixture('tlp-pro-300m-portrait');p.page.selection=[root as never];await p.send({type:'recognize',profile:'tlp-pro-300m-portrait'});const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;assert.deepEqual([...report.errors],[]);await p.send({type:'apply-recognition',profile:'tlp-pro-300m-portrait',token:report.token});
 const home=root.children[0] as FrameNode,slider=home.children[0],m=JSON.parse(slider.getPluginData('exui'));p.page.selection=[slider as never];await p.send({type:'apply',data:{...m,min:'0',max:'255',orientation:'left-to-right',enabled:'true',visible:'false'}});assert.equal(JSON.parse(slider.getPluginData('exui')).max,255);assert.equal(JSON.parse(slider.getPluginData('exui')).objectId,m.objectId);
 const before=slider.getPluginData('exui');await p.send({type:'apply',data:{...m,min:'100',max:'0',orientation:'left-to-right'}});assert.equal(slider.getPluginData('exui'),before);
 await p.send({type:'export'});const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;assert.equal(bundle.screen.pages.length,2);assert.equal(bundle.screen.pages[0].elements[0].max,255);assert.equal(bundle.screen.pages[0].elements[0].behavior.visible,false);
 const button=home.children.find(n=>n.name==='button_Connection') as FrameNode;p.page.selection=[button as never];p.emit('selectionchange');const selection=p.messages.filter(m=>m.type==='selection').at(-1) as any;assert.equal(selection.states.length,4);await p.send({type:'preview',stateId:2});assert.deepEqual(button.children.map(n=>n.visible),[false,false,true,false]);
});
test('A copied state keeps its parent mapping and preview available without a copy error on selection',async()=>{
 const p=plugin();await p.send({type:'demo',profile:'tlp-pro-300m-portrait'});const button=p.page.selection[0].children[0],state=button.children[1],m=JSON.parse(state.getPluginData('exui'));m.ownerNodeId='copied';state.setPluginData('exui',JSON.stringify(m));p.page.selection=[button];p.emit('selectionchange');const selection=p.messages.filter(m=>m.type==='selection').at(-1) as any;assert.equal(selection.id,button.id);assert.equal(selection.metadata.kind,'button');assert.equal(selection.warning,'');assert.equal(selection.states.length,button.children.length);
 const before=state.getPluginData('exui');await p.send({type:'preview',stateId:m.stateId});assert.equal(state.visible,true);assert.equal(state.getPluginData('exui'),before);
});

test('Corrupt state metadata still produces a selection warning without hiding the parent mapping',async()=>{
 const p=plugin();await p.send({type:'demo',profile:'tlp-pro-300m-portrait'});const button=p.page.selection[0].children[0];button.children[1].setPluginData('exui','{broken');p.page.selection=[button];p.emit('selectionchange');const selection=p.messages.filter(m=>m.type==='selection').at(-1) as any;assert.equal(selection.id,button.id);assert.equal(selection.metadata.kind,'button');assert.ok(selection.warning);assert.deepEqual([...selection.states],[]);
});

test('Built plugin recognizes aliases and Off/On, rejects stale tokens and preserves IDs after restart',async()=>{
  const p=plugin(),root=await namedFixture('tlp-pro-1025m',true);p.page.selection=[root as never];
  await p.send({type:'recognize',profile:'tlp-pro-1025m'});const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;
  assert.equal(report.errors.length,0);assert.equal(root.getPluginData('exui'),'');
  await p.send({type:'apply-recognition',token:report.token+1,profile:'tlp-pro-1025m'});assert.equal(root.getPluginData('exui'),'');
  await p.send({type:'recognize',profile:'tlp-pro-1025m'});const token=p.messages.filter(m=>m.type==='recognition').at(-1)!.token;
  await p.send({type:'apply-recognition',token,profile:'tlp-pro-1025m'});await p.send({type:'export'});
  const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;assert.equal(bundle.screen.schema,'exui-screen/5');assert.equal(bundle.screen.elements[0].states.length,2);
  const before=root.children.map(n=>n.getPluginData('exui'));
  vm.runInNewContext(source,{figma:p.api,Uint8Array,console});const restarted=p.api.ui.onmessage as (m:any)=>Promise<void>;
  await restarted({type:'recognize',profile:'tlp-pro-1025m'});const newToken=p.messages.filter(m=>m.type==='recognition').at(-1)!.token;
  await restarted({type:'apply-recognition',token:newToken,profile:'tlp-pro-1025m'});assert.deepEqual(root.children.map(n=>n.getPluginData('exui')),before);
  await restarted({type:'recognize',profile:'tlp-pro-1025m'});p.emit('selectionchange');
  await restarted({type:'apply-recognition',token:newToken,profile:'tlp-pro-1025m'});assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'recognition');
});

test('Built plugin supports manual static-graphic mapping as a passive Frame on the page',async()=>{
  const p=plugin(),root=p.api.createFrame();root.name='Home';root.resize(1280,800);root.fills=[{type:'SOLID',color:{r:0,g:0,b:0}}];p.page.selection=[root];
  await p.send({type:'prepare',profile:'tlp-pro-1025m'});
  const logo=p.api.createFrame();root.appendChild(logo);logo.name='logo_Company';logo.resize(64,64);logo.fills=[{type:'IMAGE',imageHash:p.api.createImage(icons()['icon.note-dark']).hash,scaleMode:'FILL'}];p.page.selection=[logo];
  await p.send({type:'apply',data:{kind:'graphic',key:'home.company',objectId:'1',file:'assets/company.png',resourceName:'company.png'}});
  assert.equal(JSON.parse(logo.getPluginData('exui')).controlId,null);
  await p.send({type:'export'});const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;
  assert.equal(bundle.screen.schema,'exui-screen/5');assert.equal(bundle.screen.elements[0].kind,'graphic');assert.equal(bundle.resources.length,1);
});
test('Manual form persists the chosen button type and rejects unsupported modes without changing metadata',async()=>{
  const p=plugin();await p.send({type:'demo',profile:'tlp-pro-1025m'});const root=p.page.selection[0],button=root.children[0];p.page.selection=[button];
  const before=JSON.parse(button.getPluginData('exui'));
  await p.send({type:'apply',data:{...before,buttonMode:'on-off'}});
  const assigned=JSON.parse(button.getPluginData('exui'));assert.equal(assigned.schema,'exui-node/3');assert.equal(assigned.buttonMode,'on-off');
  assert.equal(assigned.objectId,before.objectId);assert.equal(assigned.controlId,before.controlId);
  // An ordinary button requires two states; saving its type never deletes a third.
  await p.send({type:'export'});const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;assert.match(report.errors.join('\n'),/ровно 2 состояния/);assert.equal(report.issues[0].nodeId,button.id);
  const raw=button.getPluginData('exui');
  for(const mode of ['auto','legacy']){await p.send({type:'apply',data:{...assigned,buttonMode:mode}});assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'button-mode');assert.equal(button.getPluginData('exui'),raw);}
});

test('Manual form preserves saved legacy buttons only through the explicit legacy choice',async()=>{
  const p=plugin();const root=await createDemo('tlp-pro-1025m',icons(),true);root.name='Home';['button_SourceMusic','text_VolumeCaption','level_Volume','button_Mute'].forEach((name,i)=>root.children[i].name=name);p.page.selection=[root.children[0] as never];
  const before=JSON.parse(root.children[0].getPluginData('exui'));
  await p.send({type:'apply',data:{...before,buttonMode:'legacy'}});
  assert.deepEqual(JSON.parse(root.children[0].getPluginData('exui')),before);
  await p.send({type:'export'});assert.equal(p.messages.some(m=>m.type==='bundle'),true);
});

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
  let resolve!:()=>void;const gate=new Promise<void>(r=>resolve=r);p.setRenderHook(async()=>{await gate;});
  const pending=p.send({type:'export'});await p.send({type:'demo',profile:'tlp-pro-300m-portrait'});
  assert.ok(p.messages.some(m=>m.type==='error'&&String(m.message).includes('Дождитесь')));assert.equal(p.page.children.filter(n=>JSON.parse(n.getPluginData('exui')||'null')?.kind==='page').length,1);
  resolve();await pending;assert.equal(p.page.children.length,1);
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

test('Own unassigned screen: unsupported child is reported → optional prepare → assign label → editable export',async()=>{
  const p=plugin();const root=p.api.createFrame();root.name='My Screen';root.resize(1280,800);
  root.fills=[{type:'SOLID',color:{r:0,g:0,b:0}}];root.x=300;root.y=200;
  const label=p.api.createText();root.appendChild(label);label.name='Hall';label.characters='Hall';label.resize(120,40);
  label.x=20;label.y=30;label.textAlignVertical='CENTER';label.fills=[{type:'SOLID',color:{r:1,g:1,b:1}}];
  p.page.selection=[root];const before=JSON.stringify({bounds:root.absoluteBoundingBox,fills:root.fills,children:root.children.map(n=>[n.id,n.name,n.x,n.y,n.width,n.height,n.characters])});
  await p.send({type:'export'});
  const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;
  assert.ok(report.errors.join('\n').includes('префикс'));assert.equal(report.issues[0].nodeId,label.id);
  assert.equal(p.messages.filter(m=>m.type==='bundle').length,0);
  await p.send({type:'prepare',profile:'tlp-pro-1025m'});
  assert.deepEqual(JSON.parse(root.getPluginData('exui')),{schema:'exui-node/1',ownerNodeId:root.id,kind:'page',key:'page.my-screen',objectId:100,profile:'tlp-pro-1025m',projectName:'My Screen'});
  assert.equal(JSON.stringify({bounds:root.absoluteBoundingBox,fills:root.fills,children:root.children.map(n=>[n.id,n.name,n.x,n.y,n.width,n.height,n.characters])}),before);
  assert.equal(label.getPluginData('exui'),'');
  await p.send({type:'export'});assert.ok((p.messages.filter(m=>m.type==='recognition').at(-1) as any).issues.some((i:any)=>i.nodeId===label.id));
  p.page.selection=[label];await p.send({type:'apply',data:{kind:'label',key:'hall.title',objectId:'1'}});
  await p.send({type:'export'});
  const result=p.messages.filter(m=>m.type==='bundle').at(-1) as any;
  assert.equal(result.bundle.screen.elements[0].kind,'label');assert.equal(result.bundle.screen.elements[0].text,'Hall');
  assert.deepEqual(Array.from(result.bundle.screen.elements[0].rect),[20,30,120,40]);
});

test('Prepare preserves all existing page metadata and refuses a copied page',async()=>{
  const p=plugin();await p.send({type:'demo',profile:'tlp-pro-1025m'});const root=p.page.selection[0];
  const before=root.getPluginData('exui');
  await p.send({type:'prepare',profile:'tlp-pro-1025m'});assert.equal(root.getPluginData('exui'),before);
  const copy=root.clone();p.page.selection=[copy];const copied=copy.getPluginData('exui');
  await p.send({type:'prepare',profile:'tlp-pro-1025m'});
  assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'copied-node');assert.equal(copy.getPluginData('exui'),copied);
});

test('Prepare rejects wrong profile, node type, existing kind and nested screen without mutation',async()=>{
  const p=plugin();const root=p.api.createFrame();root.name='My Screen';root.resize(1280,800);p.page.selection=[root];
  for(const profile of ['unknown','tlp-pro-300m-portrait']) {
    await p.send({type:'prepare',profile});assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'profile');assert.equal(root.getPluginData('exui'),'');
  }
  assert.equal(root.width,1280);assert.equal(root.height,800);
  const label=p.api.createText();p.page.selection=[label];await p.send({type:'prepare',profile:'tlp-pro-1025m'});
  assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'node-type');assert.equal(label.getPluginData('exui'),'');
  p.page.selection=[root];await p.send({type:'prepare',profile:'tlp-pro-1025m'});
  const nested=p.api.createFrame();nested.resize(1280,800);root.appendChild(nested);p.page.selection=[nested];
  await p.send({type:'prepare',profile:'tlp-pro-1025m'});assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'placement');assert.equal(nested.getPluginData('exui'),'');
  await p.send({type:'apply',data:{kind:'level',key:'volume',objectId:'1',controlId:'9001'}});const before=nested.getPluginData('exui');
  await p.send({type:'prepare',profile:'tlp-pro-1025m'});assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'placement');assert.equal(nested.getPluginData('exui'),before);
});
