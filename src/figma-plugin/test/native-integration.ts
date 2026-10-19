// Real .NET/Extron boundary; Figma is represented by the explicit fake API fixture.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { fakeFigma, icons } from './fake-figma.ts';
import { createDemo } from '../src/demo.ts';
import { exportFrame } from '../src/export.ts';
import { packageExui } from '../src/package.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const dotnet=process.env.DOTNET_EXE??'dotnet',registry=process.env.EXUI_DONOR_REGISTRY;
const out=path.resolve(process.argv[2]??path.join(root,'output/figma-plugin',new Date().toISOString().replace(/[:.]/g,'-')));
await mkdir(out,{recursive:true});
function cli(args:string[]){const result=spawnSync(dotnet,[path.join(root,'src/cli/bin/Debug/net10.0/Extron.Cli.dll'),...args],{cwd:root,encoding:'utf8',timeout:180000});if(result.status!==0)throw new Error(result.stderr||result.stdout||String(result.error));return JSON.parse(result.stdout);}
const evidence:unknown[]=[];
for(const [profile,suffix] of [['tlp-pro-1025m','1025m'],['tlp-pro-300m-portrait','300m']] as const){
  fakeFigma();const frame=await createDemo(profile,icons());const bundle=await exportFrame(frame),bytes=packageExui(bundle);
  const input=path.join(out,`plugin-${suffix}.exui`);await writeFile(input,bytes,{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.elements,4);assert.equal(validation.resources,2);
  const row:Record<string,unknown>={profile,input,validation,figmaBoundary:'fake API; real Figma not exercised'};
  if(registry){
    const output=path.join(out,`plugin-${suffix}.gdl`);const generation=cli(['convert-package',input,output,'--registry',registry]);
    assert.equal(generation.checks,'61/61 passed');assert.equal(generation.GuiDesignerVerified,false);assert.equal(generation.HardwareVerified,false);
    const report=JSON.parse(await readFile(output+'.report.json','utf8'));
    assert.ok(report.Generation.Checks.every((c:{Passed:boolean})=>c.Passed));row.generation=generation;
    const model=cli(['list-controls',output]).model;assert.equal(model.Pages[0].Controls.length,4);
    const before=model.Pages[0].Controls.map((c:any)=>[c.Comments,c.ObjectId,c.ControlId]).sort();
    (frame.children as any).reverse();for(const c of frame.children)c.x+=1;
    const moved=path.join(out,`plugin-${suffix}-moved.exui`);await writeFile(moved,packageExui(await exportFrame(frame)),{flag:'wx'});
    const movedOutput=path.join(out,`plugin-${suffix}-moved.gdl`);cli(['convert-package',moved,movedOutput,'--registry',registry]);
    const after=cli(['list-controls',movedOutput]).model.Pages[0].Controls.map((c:any)=>[c.Comments,c.ObjectId,c.ControlId]).sort();assert.deepEqual(before,after);row.idsPreservedAfterMoveAndReorder=true;
  }
  evidence.push(row);console.log(`PASS ${profile}: .exui → CLI validation${registry?' → editable .gdl, 61/61, IDs preserved':''}`);
}
await writeFile(path.join(out,'integration.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log('Evidence: '+out);
