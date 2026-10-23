import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { fakeFigma } from './fake-figma.ts';
import { frame,label } from './expanded-fixture.ts';
import { recognize,applyRecognition,REGISTRY_KEY } from '../src/recognize.ts';
import { capture,designSignature } from '../src/export.ts';
import { authoringLinks,setReferenceTarget } from '../src/authoring-links.ts';
import { ExportScope } from '../src/scope.ts';
import { DATA_KEY,PROFILES,readMetadata,type Profile } from '../src/model.ts';
import { MANUAL_KEY } from '../src/key-sync.ts';
import { KIT_POPUP_GROUP_KEY } from '../src/kit-contract.ts';

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}}).outputFiles[0].text;
function fixture(profile:Profile='tlp-pro-1025m',mode:'project'|'section'|'page'='project'){
  const f=fakeFigma(),size=PROFILES[profile];
  const root=mode==='page'?figma.currentPage:mode==='section'?figma.createSection():frame(null,'project_Video',0,0,3600,1800,'');
  if(mode==='section')root.name='Video Walls';
  const screen=frame(root as FrameNode,'screen_VideoWallControl',0,0,size.width,size.height);
  const ref=frame(screen,'popupref_WallLayouts',10,80,280,120,'');
  const group=frame(root as FrameNode,'popupgroup_WallLayouts',size.width+40,0,900,120,'');
  const popups=['Full','Split','Multi'].map((name,i)=>{
    const p=frame(group,'popup_Wall'+name,i*300,0,280,120);label(p,'text_Title',name,5,5,100,30);return p;
  });
  const options=mode==='page'?{members:[screen,group]}:{};
  return {...f,root,screen,ref,group,popups,profile,options,ctx:{root,options,profile}};
}
function single(parent:FrameNode,name='popup_WallLayouts',w=280){
  const p=frame(parent,name,0,400,w,120);label(p,'text_Title','Sources',5,5,100,30);return p;
}

for(const profile of Object.keys(PROFILES) as Profile[])for(const mode of ['project','section','page'] as const)
test(`${profile}/${mode}: matching popup group is inferred, saved and exported without moving artwork`,()=>{
  const f=fixture(profile,mode),bounds=[f.ref,...f.popups].map(n=>n.absoluteBoundingBox);
  // Case and short prefixes are equivalent; order must not affect inference.
  f.ref.name='PR_walllayouts';f.group.name='PGRP_WallLayouts';
  const signature=designSignature(f.root);
  if(mode==='page')f.options.members!.reverse();
  const plan=recognize(f.root,profile,f.options);assert.deepEqual(plan.errors,[]);
  assert.equal(designSignature(f.root),signature);assert.equal(f.root.getPluginData(REGISTRY_KEY),'');
  const inferred=authoringLinks(f.ctx,[f.ref],plan).reference!;assert.equal(inferred.targetId,f.group.id);assert.equal(inferred.inferred,true);
  applyRecognition(plan);
  const m=readMetadata(f.ref)!;assert.equal(m.group,readMetadata(f.group)!.key);assert.equal(m.popup,undefined);
  const result=capture(f.root,undefined,f.options).screen;assert.ok('pages' in result);
  assert.equal(result.popups.length,3);assert.equal(result.pages[0].elements[0].group,result.groups[0].key);
  assert.deepEqual([f.ref,...f.popups].map(n=>n.absoluteBoundingBox),bounds);
  assert.equal(recognize(f.root,profile,f.options).writes.length,0);
  assert.equal(authoringLinks(f.ctx,[f.ref]).reference!.inferred,undefined);
});

test('Automatic single-popup binding uses the actual manual key for dotted suffixes',()=>{
  const f=fixture();f.group.remove();f.ref.name='popupref_Sources.Hall';
  const p=single(f.root as FrameNode,'pop_Sources.Hall');
  const initial=recognize(f.root,f.profile),m=initial.writes.find(w=>w.node.id===p.id)!.metadata;
  p.setPluginData(DATA_KEY,JSON.stringify({...m,key:'popup.manual'}));p.setPluginData(MANUAL_KEY,p.id);
  const plan=recognize(f.root,f.profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  assert.equal(readMetadata(f.ref)!.popup,'popup.manual');assert.equal(readMetadata(f.ref)!.group,undefined);
});

test('Dots and hyphens in suffixes are not interchangeable',()=>{
  const f=fixture();f.ref.name='popupref_Wall.Layouts';f.group.name='popupgroup_Wall-Layouts';
  const plan=recognize(f.root,f.profile);assert.ok(plan.errors.length);assert.equal(plan.writes.find(w=>w.node.id===f.ref.id)!.metadata.group,undefined);
});

test('Kit bindings and explicit edits take priority over a matching name',()=>{
  for(const binding of ['kit','edit'] as const){
    const f=fixture(),other=f.group.clone();other.name='popupgroup_Explicit';
    if(binding==='kit')f.ref.setPluginData(KIT_POPUP_GROUP_KEY,'group.explicit');
    const edits=binding==='edit'?new Map([[f.ref.id,{kind:'popup-ref' as const,key:'video.place',objectId:500,controlId:null,group:'group.explicit'}]]):undefined;
    const plan=recognize(f.root,f.profile,{},edits);
    assert.equal(plan.writes.find(w=>w.node.id===f.ref.id)!.metadata.group,'group.explicit');
  }
});

for(const duplicate of ['popup-and-group','two-groups'] as const)
test(`${duplicate}: ambiguity points to the reference and can be resolved through the existing selector`,()=>{
  const f=fixture();let other:FrameNode;
  if(duplicate==='popup-and-group')other=single(f.root as FrameNode);
  else {other=f.group.clone();other.name='pgrp_walllayouts';}
  const before=designSignature(f.root),plan=recognize(f.root,f.profile);
  assert.equal(plan.errors.length,1);assert.match(plan.errors[0],/несколько.*совпадающим именем/i);
  assert.equal(plan.issues[0].nodeId,f.ref.id);assert.match(plan.issues[0].fix,/Содержимое места popup/);
  assert.throws(()=>applyRecognition(plan));assert.equal(designSignature(f.root),before);
  const info=authoringLinks(f.ctx,[f.ref],plan).reference!;
  assert.equal(info.targetId,undefined);assert.ok(info.targets.some(t=>t.id===f.group.id));assert.ok(info.targets.some(t=>t.id===other.id));
  setReferenceTarget(f.ctx,f.ref.id,f.group.id);
  // Each authored ordinary popup still needs a place in the project.
  const extra=frame(f.screen,'popupref_Other',10,220,280,120,'');setReferenceTarget(f.ctx,extra.id,other.id);
  const resolved=recognize(f.root,f.profile);assert.deepEqual(resolved.errors,[]);applyRecognition(resolved);
  assert.equal(readMetadata(f.ref)!.group,readMetadata(f.group)!.key);
});

test('A size mismatch is diagnosed on the reference instead of silently choosing another target',()=>{
  const f=fixture();f.popups.forEach(p=>p.resize(279,120));
  const plan=recognize(f.root,f.profile);assert.equal(plan.errors.length,1);
  assert.match(plan.errors[0],/280×120/);assert.match(plan.errors[0],/279×120/);assert.equal(plan.issues[0].nodeId,f.ref.id);
  assert.equal(readMetadata(f.ref),null);
});

test('Saved choices, explicit removal and broken links are never replaced by name inference',()=>{
  const f=fixture(),p=single(f.root as FrameNode,'popup_Manual');
  setReferenceTarget(f.ctx,f.ref.id,p.id);const saved=readMetadata(f.ref)!;
  let plan=recognize(f.root,f.profile);assert.equal(plan.writes.find(w=>w.node.id===f.ref.id),undefined);
  assert.equal(readMetadata(f.ref)!.popup,saved.popup);
  p.remove();plan=recognize(f.root,f.profile);assert.ok(plan.errors.length);
  assert.equal(plan.writes.find(w=>w.node.id===f.ref.id),undefined);assert.equal(readMetadata(f.ref)!.popup,saved.popup);
  setReferenceTarget(f.ctx,f.ref.id,'');plan=recognize(f.root,f.profile);assert.ok(plan.errors.length);
  assert.equal(plan.writes.find(w=>w.node.id===f.ref.id),undefined);assert.equal(readMetadata(f.ref)!.group,undefined);assert.equal(readMetadata(f.ref)!.popup,undefined);
});

test('Modal popups and individual group members cannot be inferred as direct targets',()=>{
  const f=fixture();f.group.name='popupgroup_Other';f.popups[0].name='popup_WallLayouts';
  const size=PROFILES[f.profile],modal=frame(f.root as FrameNode,'modalpopup_WallLayouts',0,600,size.width,size.height);label(modal,'text_Title','Modal',0,0,100,30);
  const plan=recognize(f.root,f.profile);assert.ok(plan.errors.length);assert.throws(()=>applyRecognition(plan));
  const draft=plan.writes.find(w=>w.node.id===f.ref.id)!.metadata;
  assert.equal(draft.group,undefined);assert.equal(draft.popup,'popup.walllayouts');assert.equal(readMetadata(f.ref),null);
});

for(const mode of ['selected-frames','page'] as const)
test(`${mode}: first check discovers the unsaved group and a restarted plugin exports it`,async()=>{
  const f=fixture('tlp-pro-1025m','page'),unrelated=frame(null,'popupgroup_Unfinished',5000,0,100,100,'');
  const foreign=frame(null,'project_Foreign',7000,0,2000,1000,'');single(foreign);
  const before=designSignature(unrelated),foreignBefore=designSignature(foreign);
  f.page.selection=[f.screen] as never;
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  await (f.api.ui.onmessage as any)({type:'check',scopeMode:mode,profile:f.profile});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.equal(readMetadata(f.ref)?.group,readMetadata(f.group)?.key);assert.ok(readMetadata(f.group));
  vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
  await (f.api.ui.onmessage as any)({type:'export',scopeMode:mode,profile:f.profile});
  const result=(f.messages.filter(m=>m.type==='bundle').at(-1) as any)?.bundle.screen;
  assert.ok(result);assert.equal(result.groups.length,1);assert.equal(result.popups.length,3);
  assert.equal(designSignature(unrelated),before);assert.equal(designSignature(foreign),foreignBefore);
});

test('Screen-only discovery keeps ambiguous candidates for explicit choice and respects project boundaries',()=>{
  const f=fixture('tlp-pro-1025m','page'),other=single(f.root as FrameNode);
  f.page.selection=[f.screen] as never;const scope=new ExportScope();scope.mode='selected-frames';scope.refreshSelection();
  const ctx=scope.resolve();assert.deepEqual(new Set(ctx.options.members!.map(n=>n.id)),new Set([f.screen.id,f.group.id,other.id]));
  const plan=recognize(ctx.root,ctx.profile,ctx.options);assert.match(plan.errors[0],/несколько.*совпадающим именем/i);
  const foreign=frame(null,'project_Other',5000,0,2000,1000,'');foreign.appendChild(f.group);foreign.appendChild(other);
  const restricted=scope.resolve();assert.deepEqual(restricted.options.members!.map(n=>n.id),[f.screen.id]);
});

test('Page-wide discovery resolves same-named groups separately inside each project',()=>{
  const f=fixture(),copy=f.root.clone() as FrameNode;copy.name='project_Other';
  const otherScreen=copy.children[0] as FrameNode,otherRef=otherScreen.children[0],otherGroup=copy.children[1];
  otherScreen.name='screen_Other';otherGroup.name='pgrp_WallLayouts';
  const scope=new ExportScope();scope.mode='page';const ctx=scope.resolve();
  const plan=recognize(ctx.root,ctx.profile,ctx.options);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  assert.equal(readMetadata(f.ref)!.group,readMetadata(f.group)!.key);
  assert.equal(readMetadata(otherRef)!.group,readMetadata(otherGroup)!.key);
  assert.notEqual(readMetadata(f.ref)!.group,readMetadata(otherRef)!.group);
});

test('A failed automatic-binding write rolls back artwork metadata and the ID registry',()=>{
  const f=fixture(),plan=recognize(f.root,f.profile);assert.deepEqual(plan.errors,[]);
  const before=designSignature(f.root),original=f.ref.setPluginData.bind(f.ref);let failed=false;
  f.ref.setPluginData=(key,value)=>{if(key===DATA_KEY&&!failed){failed=true;throw new Error('write refused');}original(key,value);};
  assert.throws(()=>applyRecognition(plan),/write refused/);assert.equal(designSignature(f.root),before);assert.equal(f.root.getPluginData(REGISTRY_KEY),'');
});
