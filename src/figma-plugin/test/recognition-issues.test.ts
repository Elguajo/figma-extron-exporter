import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { namedFixture } from './named-fixture.ts';
import { recognize } from '../src/recognize.ts';
import { designSignature } from '../src/export.ts';
import { DATA_KEY } from '../src/model.ts';
import { twoScreens } from './page-project-fixture.ts';

const profile='tlp-pro-1025m';
const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
function plugin(){const fake=fakeFigma();vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});return {...fake,send:fake.api.ui.onmessage as (m:unknown)=>Promise<void>};}

test('Repeated Normal names identify the actual state and parent button; Vector and logo errors explain fixes',async()=>{
  const fake=fakeFigma(),root=await namedFixture();
  const normals=[root.children[0],root.children[3]].map(button=>(button as FrameNode).children[0]);
  for(const state of normals)(state as any).type='GROUP';
  const vector=fake.api.createVector();vector.name='Vector 1';root.appendChild(vector as never);
  const logo=fake.api.createVector();logo.name='logo_trilliant';root.appendChild(logo as never);
  const before=designSignature(root),plan=recognize(root,profile);
  assert.equal(plan.errors.length,4);assert.equal(plan.issues.length,4);
  for(const state of normals){const issue=plan.issues.find(i=>i.nodeId===state.id)!;assert.equal(issue.nodeType,'GROUP');assert.equal(issue.path,`Home → ${state.parent!.name} → Normal`);assert.match(issue.fix,/Выбранный слой — фон/);}
  assert.match(plan.issues.find(i=>i.nodeId===vector.id)!.fix,/ln_Divider/);
  assert.match(plan.issues.find(i=>i.nodeId===logo.id)!.fix,/Frame selection/);
  assert.equal(designSignature(root),before);
});

test('Late validation reports the exact button, state or Text despite duplicate layer names',async()=>{
  for(const defect of ['invalid-text','state-size','button-fill','label-alignment','icon-alignment','icon-geometry'] as const){
    fakeFigma();const root=await namedFixture(),button=root.children[defect.startsWith('icon-')?0:3] as FrameNode,state=button.children[0] as FrameNode,label=state.children.find(n=>n.type==='TEXT') as TextNode;
    const icon=state.children.find(n=>n.type!=='TEXT')!;
    const target=defect.startsWith('icon-')?icon:defect==='invalid-text'||defect==='label-alignment'?label:defect==='state-size'?state:button;
    if(defect==='invalid-text')label.characters='\uD800';
    if(defect==='state-size')state.resize(state.width-1,state.height);
    if(defect==='button-fill')button.fills=[{type:'SOLID',color:{r:1,g:0,b:0}}];
    if(defect==='label-alignment')label.textAlignHorizontal='LEFT';
    if(defect==='icon-alignment')icon.x++;
    if(defect==='icon-geometry')icon.x+=0.5;
    const plan=recognize(root,profile);assert.equal(plan.issues.length,1);assert.equal(plan.issues[0].nodeId,target.id);assert.ok(plan.issues[0].path.includes(button.name));
    assert.equal(root.getPluginData(DATA_KEY),'');
  }
});

for(const command of ['recognize','check','export'])test(`${command}: report → show exact layer → fix → retry original screen → save`,async()=>{
  const p=plugin(),root=await namedFixture(),control=root.children[2],before=designSignature(root);control.name='Unknown';p.page.selection=[root as never];
  const invalid=designSignature(root);let zoomed:string[]=[];p.api.viewport.scrollAndZoomIntoView=(nodes:any)=>{zoomed=nodes.map((n:any)=>n.id);};
  await p.send({type:command,profile});
  const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;
  assert.equal(report.issues[0].nodeId,control.id);assert.equal(designSignature(root),invalid);assert.equal(p.messages.some(m=>m.type==='bundle'),false);
  await p.send({type:'select-issue',nodeId:control.id});p.emit('selectionchange');
  assert.equal(p.page.selection[0].id,control.id);assert.deepEqual([...zoomed],[control.id]);assert.equal(p.messages.filter(m=>m.type==='selection').at(-1)?.keepRecognition,true);
  control.name='lvl_Volume';assert.equal(designSignature(root),before);
  await p.send({type:'recognize',profile,fromReport:true});
  const retry=p.messages.filter(m=>m.type==='recognition').at(-1) as any;assert.deepEqual([...retry.errors],[]);assert.equal(root.getPluginData(DATA_KEY),'');
  p.emit('selectionchange');await p.send({type:'apply-recognition',profile,token:retry.token});
  assert.equal(JSON.parse(root.getPluginData(DATA_KEY)).kind,'page');assert.deepEqual(p.messages.filter(m=>m.type==='error'),[]);
});

test('Selected-frames report keeps both screens when drilling down and rerunning; unrelated node IDs are refused',async()=>{
  const p=plugin(),{main,audio,button}=twoScreens();p.page.selection=[main as never,audio as never];
  button.children[0].type='GROUP' as never;
  await p.send({type:'export',profile,scopeMode:'selected-frames'});
  const report=p.messages.filter(m=>m.type==='recognition').at(-1) as any;assert.ok(report.errors.length);
  await p.send({type:'select-issue',nodeId:report.issues[0].nodeId});p.emit('selectionchange');
  button.children[0].type='FRAME' as never;
  await p.send({type:'recognize',profile,scopeMode:'selected-frames',fromReport:true});
  const retry=p.messages.filter(m=>m.type==='recognition').at(-1) as any;assert.deepEqual([...retry.errors],[]);assert.ok(retry.rows.some((r:any)=>r.id===main.id));assert.ok(retry.rows.some((r:any)=>r.id===audio.id));
  await p.send({type:'select-issue',nodeId:'unrelated'});assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'recognition');
  await p.send({type:'apply-recognition',profile,scopeMode:'selected-frames',token:retry.token});assert.equal(JSON.parse(audio.getPluginData(DATA_KEY)).kind,'page');
});

test('Removed layers and ordinary selection changes cannot reuse diagnostic navigation or retry stale reports',async()=>{
  const p=plugin(),root=await namedFixture(),control=root.children[2];control.name='Unknown';p.page.selection=[root as never];
  await p.send({type:'recognize',profile});control.remove();
  await p.send({type:'select-issue',nodeId:control.id});assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'selection');
  p.page.selection=[root.children[0] as never];p.emit('selectionchange');
  assert.equal(p.messages.filter(m=>m.type==='selection').at(-1)?.keepRecognition,false);
  await p.send({type:'recognize',profile,fromReport:true});assert.equal(p.messages.filter(m=>m.type==='error').at(-1)?.code,'recognition');
});
