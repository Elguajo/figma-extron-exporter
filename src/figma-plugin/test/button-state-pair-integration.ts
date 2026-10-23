// Shipped plugin → EXUI → shipped CLI → real Extron writer and independent reader.
// Figma API and PNG rendering are fixtures; no Figma Desktop/hardware claim.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { authorButtons } from './button-preparation-fixture.ts';
import { packageExui } from '../src/package.ts';
import { DATA_KEY, type Bundle } from '../src/model.ts';

const [pluginZip,cliDir,output]=process.argv.slice(2);
assert.ok(pluginZip&&cliDir&&output,'Usage: node test/button-state-pair-integration.ts <plugin.zip> <unpacked-cli> <new-output>');
const files=unzipSync(new Uint8Array(await readFile(pluginZip)));
const version=JSON.parse(strFromU8(files['version.json']));assert.equal(version.version,version.compatibleCliVersion);
const cliVersion=JSON.parse(await readFile(path.join(cliDir,'version.json'),'utf8'));assert.equal(cliVersion.version,version.compatibleCliVersion);
const manifest=JSON.parse(strFromU8(files['manifest.json'])),source=strFromU8(files[manifest.main]);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),installed=path.resolve(cliDir),out=path.resolve(output);
await mkdir(out,{recursive:true});
function cli(args:string[]) {
  const result=spawnSync(process.env.DOTNET_EXE??path.join(root,'.tools/dotnet/dotnet.exe'),[path.join(installed,'cli/Extron.Cli.dll'),...args],{cwd:root,encoding:'utf8',timeout:180000});
  assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));return JSON.parse(result.stdout);
}
const evidence:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const) {
  const f=authorButtons(profile);f.page.selection=[f.root as never];runInNewContext(source,{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (message:unknown)=>Promise<void>;
  let identity:string|undefined,nodes:string[]|undefined;
  for(const [step,statePair] of ['off-on','normal-pressed','off-on'].entries()) {
    await send({type:'button-apply-styles',profile,statePair,existing:step?'update':'skip',contrast:false});
    await send({type:'check',profile});await send({type:'export',profile});
    assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
    if(!identity){identity=f.buttons[0].getPluginData(DATA_KEY);nodes=f.buttons[0].children.map(s=>s.id);}
    assert.equal(f.buttons[0].getPluginData(DATA_KEY),identity);assert.deepEqual(f.buttons[0].children.map(s=>s.id),nodes);
    const bundle=f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle;
    const base=path.join(out,`${profile}-${step}-${statePair}`),input=base+'.exui',gdl=base+'.gdl';
    await writeFile(input,packageExui(bundle),{flag:'wx'});
    const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');
    const generation=cli(['convert-package',input,gdl,'--registry',process.env.EXUI_DONOR_REGISTRY??path.join(root,'samples/donors.json')]);
    const report=JSON.parse(await readFile(gdl+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:{Passed:boolean})=>c.Passed));
    const controls=cli(['list-controls',gdl]).model.Pages[0].Controls;
    for(const expected of bundle.screen.elements) {
      const actual=controls.find((c:any)=>c.Comments==='exui-key='+expected.key);
      assert.equal(actual.ControlId,expected.controlId);assert.equal(actual.ObjectId,expected.objectId);
      assert.deepEqual(actual.States.map((s:any)=>s.Name),Array.from(expected.states!,s=>s.name));
      assert.equal(actual.PressFeedbackState,expected.press?1:-1);
    }
    evidence.push({profile,step,statePair,validation,generation,checks:report.Generation.Checks.length});
    console.log(`PASS ${profile}: ${step?'Override':'create'} ${statePair}, native press feedback ${statePair==='off-on'?-1:1}, IDs preserved`);
  }
}
await writeFile(path.join(out,'integration.json'),JSON.stringify({version:version.version,passed:true,scenarios:evidence,boundary:'real archived plugin and CLI/Extron writer/reader; modeled Figma API and PNG; no Desktop/hardware run'},null,2)+'\n');
