// Actual bundled plugin -> EXUI -> native writer -> independent GDL reader.
// Geometry/paint at the Figma API boundary remain modeled explicitly.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import path from 'node:path';
import {muteFixture} from './button-inline-fixture.ts';
import {packageExui} from '../src/package.ts';
import {designSignature} from '../src/export.ts';
import {png} from './kit-fixture.ts';
const root=path.resolve(import.meta.dirname,'../../..'),out=path.resolve(process.argv[2]??path.join(root,'output/mute-text-overlap/integration'));
await mkdir(out,{recursive:true});
function cli(args:string[]){const r=spawnSync(process.env.DOTNET_EXE??path.join(root,'.tools/dotnet/dotnet.exe'),[process.env.EXUI_CLI_DLL??path.join(root,'src/cli/bin/Release/net10.0/Extron.Cli.dll'),...args],{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr||r.stdout||String(r.error));return JSON.parse(r.stdout);}
const evidence:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
  const f=muteFixture(profile),before=designSignature(f.root);let renders=0;
  f.setRenderHook(wrapper=>{
    renders++;const row=wrapper.children[0].children[0],text=row.children.find(n=>n.type==='TEXT')!,icon=wrapper.children.find(n=>n.name==='Mute icon')!;
    assert.equal(text.opacity,0);assert.equal(text.visible,true);assert.equal(row.layoutMode,'HORIZONTAL');
    assert.deepEqual([icon.x,icon.y,icon.width,icon.height],[51,16,22,20]);return png(288,52);
  });
  f.page.selection=[f.root as never];
  runInNewContext(await readFile(path.join(root,'src/figma-plugin/dist/code.js'),'utf8'),{figma:f.api,Uint8Array,console});
  await (f.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'export',profile});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  const bundle=f.messages.find(m=>m.type==='bundle')!.bundle as Parameters<typeof packageExui>[0];
  assert.equal(renders,2);assert.equal(designSignature(f.root),before);
  const input=path.join(out,profile+'.exui'),output=path.join(out,profile+'.gdl');
  await writeFile(input,packageExui(bundle),{flag:'wx'});
  const generation=cli(['convert-package',input,output,'--registry',path.join(root,'samples/donors.json')]);
  const controls=cli(['list-controls',output]).model.Pages[0].Controls;
  assert.equal(controls.length,1);const c=controls[0],e=bundle.screen.elements[0];
  assert.equal(c.Type,'PBButton');assert.equal(c.ControlId,e.controlId);assert.equal(c.ObjectId,e.objectId);assert.equal(c.FlattenText,false);
  assert.deepEqual([c.Left,c.Top,c.Width,c.Height],[16,415,288,52]);
  assert.deepEqual(c.States.map((s:any)=>s.Text),['Mute all audio','Mute all audio']);assert.equal(c.PressFeedbackState,1);
  const replaced=path.join(out,profile+'-replaced.gdl');
  cli(['set-button-text',output,replaced,String(c.ControlId),'Mute all audio','Mute']);
  const changed=cli(['list-controls',replaced]).model.Pages[0].Controls;
  assert.ok(changed[0].States.every((s:any)=>s.Text==='Mute'));assert.equal(changed[0].ControlId,c.ControlId);assert.equal(changed[0].ObjectId,c.ObjectId);
  evidence.push({profile,generation,controls:1,separateLabels:0,nativeText:true,idsPreserved:true,sourceLayoutPreserved:true,inlineIconBounds:[51,16,22,20],textReplacementVerified:true});
  console.log(`PASS ${profile}: Mute icon clear of editable native Button Text, IDs and source preserved`);
}
await writeFile(path.join(out,'integration.json'),JSON.stringify({passed:true,scenarios:evidence,boundary:'Modeled Figma geometry/PNG; actual compiled plugin, CLI, Extron writer and independent GDL reader. Hardware and live GUI Designer not exercised.'},null,2)+'\n',{flag:'wx'});
