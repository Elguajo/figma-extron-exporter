// Real CLI + native Extron writer. Figma and PNG rendering use the declared fixture.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {kitFixture} from './kit-fixture.ts';
import {createKit} from '../src/kit.ts';
import {recognize,applyRecognition} from '../src/recognize.ts';
import {exportFrame} from '../src/export.ts';
import {packageExui} from '../src/package.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.resolve(process.argv[2]??path.join(root,'output/kit-integration-'+Date.now()));await mkdir(out,{recursive:true});
const dotnet=process.env.DOTNET_EXE??path.join(root,'.tools/dotnet/dotnet.exe');
function cli(args:string[]){const r=spawnSync(dotnet,[path.join(root,'src/cli/bin/Debug/net10.0/Extron.Cli.dll'),...args],{cwd:root,encoding:'utf8',timeout:180000});assert.equal(r.status,0,r.stderr||r.stdout||String(r.error));return JSON.parse(r.stdout);}
const evidence:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
 kitFixture();const kit=await createKit(profile);
 for(const [name,node]of [['screen',kit.example],['project',kit.templates[0]]] as const){
  const plan=recognize(node,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);const bundle=await exportFrame(node);
  const input=path.join(out,`${name}-${profile}.exui`),output=path.join(out,`${name}-${profile}.gdl`);await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]),generation=cli(['convert-package',input,output,'--registry',path.join(root,'samples/donors.json')]);
  const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:any)=>c.Passed));
  const model=cli(['list-controls',output]).model;
  if(name==='screen'){
   assert.ok(model.Pages[0].Controls.some((n:any)=>n.Type==='PBSlider'));
   for(const button of bundle.screen.elements.filter(e=>e.kind==='button')){
    const actual=model.Pages[0].Controls.find((n:any)=>n.Comments==='exui-key='+button.key);assert.equal(actual.ControlId,button.controlId);
    assert.deepEqual(actual.States.map((s:any)=>s.Name),button.states!.map(s=>s.name));
   }
  }else{assert.equal(model.Pages.length,1);assert.equal(model.Groups.length,1);assert.ok(model.Popups.length>=4);}
  evidence.push({profile,name,validation,generation,boundary:'Figma API and PNG rendering simulated; real CLI, donor, x86 writer and independent NRBF checks. No GUI Build/device claim.'});
  console.log(`PASS kit ${profile} / ${name}: ${generation.checks}`);
 }
}
await writeFile(path.join(out,'kit-integration.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
