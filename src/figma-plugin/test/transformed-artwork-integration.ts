// Released plugin and CLI; Figma geometry/rendering remains an API fixture.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { authorButtons, paint } from './button-preparation-fixture.ts';
import { prepareButtons } from '../src/button-preparation.ts';
import { designSignature, type exportFrame } from '../src/export.ts';
import { packageExui } from '../src/package.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.resolve(process.argv[2]??path.join(root,'output/figma-plugin/transformed-cli-'+Date.now()));
const plugin=unzipSync(new Uint8Array(await readFile(path.join(root,'samples/fixtures/release-0.5/figma-extron-plugin-0.5.3.zip'))));
const cliArchive=unzipSync(new Uint8Array(await readFile(path.join(root,'samples/fixtures/release-0.5/figma-extron-cli-0.5.2-windows.zip'))));
const cliDll=path.join(root,'samples/fixtures/release-0.5/cli/Extron.Cli.dll');
assert.equal(JSON.parse(strFromU8(plugin['version.json'])).version,'0.5.3');
assert.equal(JSON.parse(strFromU8(cliArchive['version.json'])).version,'0.5.2');
assert.deepEqual(new Uint8Array(await readFile(cliDll)),cliArchive['cli/Extron.Cli.dll']);
await mkdir(out,{recursive:true});
function cli(args:string[]){
  const result=spawnSync(path.join(root,'.tools/dotnet/dotnet.exe'),[cliDll,...args],{cwd:root,encoding:'utf8',timeout:60000});
  if(result.status!==0)throw new Error(result.stderr||result.stdout||String(result.error));
  return JSON.parse(result.stdout);
}
const results=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
  const f=authorButtons(profile);prepareButtons(f.root);
  for(const [index,button] of f.buttons.entries())for(const state of button.children){
    // Include both visible and hidden reflected Group states.
    Object.defineProperty(state,'relativeTransform',{get:()=>index?[ [1,0,0],[0,-1,state.height] ]:[ [-1,0,state.width],[0,1,0] ]});
    Object.defineProperty(state,'absoluteTransform',{get:()=>{const b=state.absoluteBoundingBox!;return index?[[1,0,b.x],[0,-1,b.y+b.height]]:[[-1,0,b.x+b.width],[0,1,b.y]];}});
  }
  for(const [index,kind] of ['datetime','value','text'].entries()){
    const component=f.api.createFrame();component.type='COMPONENT';component.name=kind+'_Component';component.resize(180,24);component.x=10;component.y=230+index*35;f.root.appendChild(component as never);
    const text=f.api.createText();component.appendChild(text);text.resize(180,24);text.characters=kind==='datetime'?'HH:mm':kind==='value'?'42%':'Native component';text.textAlignVertical='CENTER';text.fills=[paint('#FFFFFF')];
  }
  f.page.selection=[f.root as never];
  runInNewContext(strFromU8(plugin['dist/code.js']),{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (message:unknown)=>Promise<void>;
  await send({type:'check',profile});assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  const saved=designSignature(f.root);
  await send({type:'export',profile});assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  const bundle=f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Awaited<ReturnType<typeof exportFrame>>;
  assert.equal(designSignature(f.root),saved);
  const input=path.join(out,profile+'.exui'),output=path.join(out,profile+'.gdl');
  await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');assert.equal(validation.elements,5);assert.equal(validation.resources,4);
  const generation=cli(['convert-package',input,output,'--registry',path.join(root,'samples/donors.json')]);
  const report=JSON.parse(await readFile(output+'.report.json','utf8'));
  assert.ok(report.Generation.Checks.length>0&&report.Generation.Checks.every((c:{Passed:boolean})=>c.Passed));
  const controls=cli(['list-controls',output]).model.Pages[0].Controls;
  for(const expected of bundle.screen.elements){
    const actual=controls.find((c:any)=>c.Comments==='exui-key='+expected.key);assert.ok(actual);
    assert.equal(actual.ObjectId,expected.objectId);assert.equal(actual.ControlId,expected.controlId??0);
    assert.deepEqual([actual.Left,actual.Top,actual.Width,actual.Height],[...expected.rect]);
    if(expected.kind==='button'){
      assert.equal(actual.Type,'PBButton');assert.equal(actual.States.length,expected.states!.length);
      for(const state of expected.states!){const s=actual.States.find((s:any)=>s.Name===state.name);assert.ok(s.Image);assert.equal(s.Text,'');}
    }else if(expected.kind==='datetime'){
      assert.equal(actual.Type,'PBDateTime');assert.equal(actual.Native.Pattern,'HH:mm');
    }else{
      assert.equal(actual.Type,'PBLabel');assert.equal(actual.Text,expected.text);
      if(expected.kind==='value')assert.equal(actual.Native.DynamicText,true);
    }
  }
  results.push({profile,validation,generation,checks:report.Generation.Checks.length,sourceUnchanged:true,figmaBoundary:'mock geometry and PNG pixels; real released plugin and CLI'});
  console.log(`PASS ${profile}: plugin 0.5.3 archive -> CLI 0.5.2 archive -> GDL; ${report.Generation.Checks.length} checks`);
}
await writeFile(path.join(out,'results.json'),JSON.stringify({plugin:'0.5.3',cli:'0.5.2',results},null,2)+'\n',{flag:'wx'});
