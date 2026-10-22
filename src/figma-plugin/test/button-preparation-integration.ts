// Real CLI / Extron writer and reader. Figma grouping and PNG rasterization
// remain explicit boundary fixtures; this does not exercise Figma Desktop.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { authorButtons, paint } from './button-preparation-fixture.ts';
import { background } from '../src/button-artwork.ts';
import { prepareButtons } from '../src/button-preparation.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';
import { exportFrame } from '../src/export.ts';
import { packageExui } from '../src/package.ts';
import { unzipSync, strFromU8 } from 'fflate';
import { runInNewContext } from 'node:vm';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.resolve(process.argv[2]??path.join(root,'output/figma-plugin/button-preparation-native-'+Date.now()));
await mkdir(out,{recursive:true});
const dotnet=process.env.DOTNET_EXE??path.join(root,'.tools/dotnet/dotnet.exe');
const archive=process.argv[3]?unzipSync(new Uint8Array(await readFile(path.resolve(process.argv[3])))):undefined;
function cli(args:string[]) {
  const result=spawnSync(dotnet,[path.join(root,'src/cli/bin/Debug/net10.0/Extron.Cli.dll'),...args],{cwd:root,encoding:'utf8',timeout:180000});
  if(result.status!==0)throw new Error(result.stderr||result.stdout||String(result.error));
  return JSON.parse(result.stdout);
}
const results:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const) {
  const f=authorButtons(profile);
  let send:((message:unknown)=>Promise<void>)|undefined;
  if(archive){
    const manifest=JSON.parse(strFromU8(archive['manifest.json']));assert.equal(manifest.id,'figma-extron-exporter-local-dev');
    f.page.selection=[f.root as never];runInNewContext(strFromU8(archive[manifest.main]),{figma:f.api,Uint8Array,console});
    send=f.api.ui.onmessage as (message:unknown)=>Promise<void>;await send({type:'button-create-states',profile,corners:true});
    assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  }else prepareButtons(f.root,{},false,true);
  const pressed=f.buttons[1].children[1].clone();f.buttons[1].appendChild(pressed);pressed.name='Pressed';pressed.visible=false;background(pressed).fills=[paint('#FFFF00')];
  if(!send){const plan=recognize(f.root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);}
  else {await send({type:'check',profile});await send({type:'export',profile});assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);}
  const bundle=send?f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Awaited<ReturnType<typeof exportFrame>>:await exportFrame(f.root),input=path.join(out,profile+'.exui'),output=path.join(out,profile+'.gdl');
  await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');assert.equal(validation.resources,5);assert.equal(validation.elements,2);
  const generation=cli(['convert-package',input,output,'--registry',process.env.EXUI_DONOR_REGISTRY??path.join(root,'samples/donors.json')]);
  const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:{Passed:boolean})=>c.Passed));
  const model=cli(['list-controls',output]).model;
  for(const expected of bundle.screen.elements) {
    const actual=model.Pages[0].Controls.find((c:any)=>c.Comments==='exui-key='+expected.key);
    assert.equal(actual.ObjectId,expected.objectId);assert.equal(actual.ControlId,expected.controlId);
    assert.deepEqual(actual.States.map((s:any)=>[s.Name,s.Text,s.Image]),Array.from(expected.states!,s=>[s.name,s.text,bundle.screen.assets.find(a=>a.key===s.image)!.resourceName]));
    assert.equal(actual.PressFeedbackState,expected.press?2:-1);
  }
  results.push({profile,archivedPlugin:!!archive,validation,generation,checks:report.Generation.Checks.length,figma:'boundary fixture',guiDesigner:'not run',hardware:'not run'});
  console.log('PASS '+profile+': Group buttons → states/styles → EXUI/5 → native GDL, writer/reader and manual Pressed');
}
await writeFile(path.join(out,'integration.json'),JSON.stringify(results,null,2)+'\n');
