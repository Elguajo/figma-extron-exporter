import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { icons, fakeFigma } from './fake-figma.ts';
import { namedFixture } from './named-fixture.ts';
const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:JSON.stringify(Object.fromEntries(Object.entries(icons()).map(([k,v])=>[k,[...v]])))}}).outputFiles[0].text;
function plugin(){const fake=fakeFigma();vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});return{...fake,send:fake.api.ui.onmessage as (message:unknown)=>Promise<void>};}

test('Built plugin recognizes aliases and Off/On, rejects stale tokens and preserves IDs after restart',async()=>{
  const p=plugin(),root=await namedFixture('tlp-pro-1025m',true);p.page.selection=[root as never];
  await p.send({type:'recognize',profile:'tlp-pro-1025m'});const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;
  assert.equal(report.errors.length,0);assert.equal(root.getPluginData('exui'),'');
  await p.send({type:'apply-recognition',token:report.token+1,profile:'tlp-pro-1025m'});assert.equal(root.getPluginData('exui'),'');
  await p.send({type:'recognize',profile:'tlp-pro-1025m'});const token=p.messages.filter(m=>m.type==='recognition').at(-1)!.token;
  await p.send({type:'apply-recognition',token,profile:'tlp-pro-1025m'});await p.send({type:'export'});
  const bundle=(p.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;assert.equal(bundle.screen.schema,'exui-screen/3');assert.equal(bundle.screen.elements[0].states.length,2);
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
  assert.equal(bundle.screen.schema,'exui-screen/4');assert.equal(bundle.screen.elements[0].kind,'graphic');assert.equal(bundle.resources.length,1);
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

test('Own unassigned screen: actionable error → prepare → assign label → editable export',async()=>{
  const p=plugin();const root=p.api.createFrame();root.name='Свой экран';root.resize(1280,800);
  root.fills=[{type:'SOLID',color:{r:0,g:0,b:0}}];root.x=300;root.y=200;
  const label=p.api.createText();root.appendChild(label);label.name='Зал';label.characters='Hall';label.resize(120,40);
  label.x=20;label.y=30;label.textAlignVertical='CENTER';label.fills=[{type:'SOLID',color:{r:1,g:1,b:1}}];
  p.page.selection=[root];const before=JSON.stringify({bounds:root.absoluteBoundingBox,fills:root.fills,children:root.children.map(n=>[n.id,n.name,n.x,n.y,n.width,n.height,n.characters])});
  await p.send({type:'export'});
  assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'screen-unprepared');
  assert.ok(String(p.messages.filter(m=>m.type==='error').at(-1)?.message).includes('Подготовить выбранный экран'));
  assert.equal(p.messages.filter(m=>m.type==='bundle').length,0);
  await p.send({type:'prepare',profile:'tlp-pro-1025m'});
  assert.deepEqual(JSON.parse(root.getPluginData('exui')),{schema:'exui-node/1',ownerNodeId:root.id,kind:'page',key:'page.home',objectId:100,profile:'tlp-pro-1025m',projectName:'Свой экран'});
  assert.equal(JSON.stringify({bounds:root.absoluteBoundingBox,fills:root.fills,children:root.children.map(n=>[n.id,n.name,n.x,n.y,n.width,n.height,n.characters])}),before);
  assert.equal(label.getPluginData('exui'),'');
  await p.send({type:'export'});assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'unmapped');
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
  const p=plugin();const root=p.api.createFrame();root.name='Свой экран';root.resize(1280,800);p.page.selection=[root];
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
