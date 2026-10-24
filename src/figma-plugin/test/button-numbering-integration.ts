// Archived plugin -> EXUI -> archived CLI -> real GDL writer and independent reader.
// Figma API is modeled; native captions, names and IDs are checked in the GDL.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { fakeFigma } from './fake-figma.ts';
import { namedFixture } from './named-fixture.ts';
import { packageExui } from '../src/package.ts';
import { DATA_KEY, type Bundle } from '../src/model.ts';

const [archive,cliDirectory,output]=process.argv.slice(2);
assert.ok(archive&&cliDirectory&&output,'Usage: node test/button-numbering-integration.ts <plugin.zip> <unpacked-cli> <output>');
const files=unzipSync(new Uint8Array(await readFile(archive)));
const version=JSON.parse(strFromU8(files['version.json'])),manifest=JSON.parse(strFromU8(files['manifest.json']));
const cliVersion=JSON.parse(await readFile(path.join(cliDirectory,'version.json'),'utf8'));
assert.equal(version.version,'0.7.3');assert.equal(version.compatibleCliVersion,cliVersion.version);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.resolve(output),installed=path.resolve(cliDirectory);
await mkdir(out,{recursive:true});
function cli(args:string[]) {
  const result=spawnSync(process.env.DOTNET_EXE??path.join(root,'.tools/dotnet/dotnet.exe'),[path.join(installed,'cli/Extron.Cli.dll'),...args],{cwd:root,encoding:'utf8',timeout:180000});
  assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));return JSON.parse(result.stdout);
}
const evidence:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const) {
  const f=fakeFigma(),screen=await namedFixture(profile,true),buttons=[screen.children[0],screen.children[3]] as FrameNode[];
  f.page.selection=[screen as never];runInNewContext(strFromU8(files[manifest.main]),{figma:f.api,Uint8Array,console});
  const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  let saved:string[]|undefined;
  const identities=()=>buttons.flatMap(b=>[b,...b.children]).map(n=>{const m=JSON.parse(n.getPluginData(DATA_KEY));return JSON.stringify([n.id,m.objectId,m.controlId,m.stateId,m.role]);});
  for(const step of ['baseline','numbered'] as const) {
    if(step==='numbered') {
      f.page.selection=buttons as never;
      const metadata=buttons.flatMap(b=>[b,...b.children]).map(n=>n.getPluginData(DATA_KEY));
      await send({type:'button-numbering-preview',numbering:{base:'Box',start:1,mode:'position',names:true,labels:true}});
      const plan=f.messages.filter(m=>m.type==='numbering-plan').at(-1)!;assert.equal((plan.rows as unknown[]).length,2);
      await send({type:'button-numbering-apply',token:plan.token});
      assert.deepEqual(buttons.flatMap(b=>[b,...b.children]).map(n=>n.getPluginData(DATA_KEY)),metadata);
      assert.deepEqual(buttons.map(b=>b.name),['btn_Box1','button_Box2']);
    }
    f.page.selection=[screen as never];
    await send({type:'export',profile});assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
    if(saved)assert.deepEqual(identities(),saved);else saved=identities();
    const bundle=f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle;
    const base=path.join(out,`${profile}-${step}`),input=base+'.exui',gdl=base+'.gdl';
    await writeFile(input,packageExui(bundle),{flag:'wx'});
    const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');
    const generation=cli(['convert-package',input,gdl,'--registry',process.env.EXUI_DONOR_REGISTRY??path.join(root,'samples/donors.json')]);
    const report=JSON.parse(await readFile(gdl+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:{Passed:boolean})=>c.Passed));
    const controls=cli(['list-controls',gdl]).model.Pages[0].Controls;
    for(const expected of bundle.screen.elements.filter(e=>e.kind==='button')) {
      const actual=controls.find((c:any)=>c.Comments==='exui-key='+expected.key);
      assert.ok(actual);assert.equal(actual.Name,expected.name);assert.equal(actual.ObjectId,expected.objectId);assert.equal(actual.ControlId,expected.controlId);
      assert.deepEqual(actual.States.map((s:any)=>[s.Name,s.Text]),Array.from(expected.states!,s=>[s.name,s.text]));
      if(step==='numbered')assert.ok(expected.states!.every(s=>/^Box [12]$/.test(s.text)));
    }
    evidence.push({profile,step,validation,generation,checks:report.Generation.Checks.length,idsPreserved:true});
    console.log(`PASS ${profile} / ${step}: GDL names, captions and IDs verified (${report.Generation.Checks.length} checks)`);
  }
}
await writeFile(path.join(out,'integration.json'),JSON.stringify({passed:true,version:version.version,scenarios:evidence,boundary:'real archived plugin and CLI, GDL writer/reader; modeled Figma API, no Desktop/hardware claim'},null,2)+'\n');
