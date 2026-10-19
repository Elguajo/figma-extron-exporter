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
import { namedFixture, graphicFixture } from './named-fixture.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';
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
    assert.equal(generation.checks,'65/65 passed');assert.equal(generation.GuiDesignerVerified,false);assert.equal(generation.HardwareVerified,false);
    const report=JSON.parse(await readFile(output+'.report.json','utf8'));
    assert.equal(report.Generation.Checks.length,65);assert.ok(report.Generation.Checks.every((c:{Passed:boolean})=>c.Passed));row.generation=generation;
    const model=cli(['list-controls',output]).model;assert.equal(model.Pages[0].Controls.length,4);
    const before=model.Pages[0].Controls.map((c:any)=>[c.Comments,c.ObjectId,c.ControlId]).sort();
    (frame.children as any).reverse();for(const c of frame.children)c.x+=1;
    const moved=path.join(out,`plugin-${suffix}-moved.exui`);await writeFile(moved,packageExui(await exportFrame(frame)),{flag:'wx'});
    const movedOutput=path.join(out,`plugin-${suffix}-moved.gdl`);cli(['convert-package',moved,movedOutput,'--registry',registry]);
    const after=cli(['list-controls',movedOutput]).model.Pages[0].Controls.map((c:any)=>[c.Comments,c.ObjectId,c.ControlId]).sort();assert.deepEqual(before,after);row.idsPreservedAfterMoveAndReorder=true;
  }
  evidence.push(row);console.log(`PASS ${profile}: .exui → CLI validation${registry?' → editable .gdl, 65/65, IDs preserved':''}`);
}
for(const [profile,suffix] of [['tlp-pro-1025m','1025m'],['tlp-pro-300m-portrait','300m']] as const){
  fakeFigma();const frame=await namedFixture(profile,true);const plan=recognize(frame,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(frame),input=path.join(out,`named-off-on-${suffix}.exui`);await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/3');
  const row:Record<string,unknown>={profile,input,validation,figmaBoundary:'fake API; real Figma not exercised'};
  if(registry){
    const output=path.join(out,`named-off-on-${suffix}.gdl`);row.generation=cli(['convert-package',input,output,'--registry',registry]);
    const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:{Passed:boolean})=>c.Passed));
    const model=cli(['list-controls',output]).model;
    for(const expected of bundle.screen.elements){const control=model.Pages[0].Controls.find((c:any)=>c.Comments==='exui-key='+expected.key);assert.ok(control);assert.equal(control.ObjectId,expected.objectId);assert.equal(control.ControlId,expected.controlId??0);
      if(expected.kind==='button'){assert.equal(control.PressFeedbackState,-1);assert.deepEqual(control.States.map((s:any)=>s.Name),['Off','On']);}
    }
    row.twoStatesAndDisabledPressFeedbackVerified=true;
  }
  evidence.push(row);console.log(`PASS ${profile}: named Off/On → exui/3 → CLI${registry?' → editable GDL, two states, press feedback -1':''}`);
}
for(const [profile,suffix] of [['tlp-pro-1025m','1025m'],['tlp-pro-300m-portrait','300m']] as const){
  fakeFigma();const frame=await graphicFixture(profile);const plan=recognize(frame,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(frame),input=path.join(out,`logo-volume-${suffix}.exui`);await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/4');
  const row:Record<string,unknown>={profile,input,validation,figmaBoundary:'fake API and PNG rendering; real Figma not exercised'};
  if(registry){
    const output=path.join(out,`logo-volume-${suffix}.gdl`);row.generation=cli(['convert-package',input,output,'--registry',registry]);
    const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:{Passed:boolean})=>c.Passed));
    const model=cli(['list-controls',output]).model;
    const logo=model.Pages[0].Controls.find((c:any)=>c.Comments==='exui-key=home.company');assert.equal(logo.Type,'PBImage');assert.equal(logo.ControlId,0);assert.equal(logo.Graphic.Layout,3);assert.equal(logo.Graphic.Image,'exui-graphic-5.png');
    assert.equal(logo.States.length,0);assert.equal(logo.Graphic.Background,0);assert.equal(logo.Graphic.Border,0);assert.equal(logo.Graphic.Shape,0);
    const button=model.Pages[0].Controls.find((c:any)=>c.Comments==='exui-key=home.volumeup');assert.equal(button.PressFeedbackState,1);assert.deepEqual(button.States.map((s:any)=>s.Name),['Normal','Pressed']);assert.equal(button.States[1].Fill,0xFFFFCC00);
    row.nativeLogoAndMomentaryVerified=true;
  }
  evidence.push(row);console.log(`PASS ${profile}: logo + yellow Normal/Pressed → exui/4 → CLI${registry?' → PBImage + press feedback 1':''}`);
}
await writeFile(path.join(out,'integration.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log('Evidence: '+out);
