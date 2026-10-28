// Real .NET/Extron boundary; Figma is represented by the explicit fake API fixture.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { fakeFigma, icons } from './fake-figma.ts';
import { createDemo,tag } from '../src/demo.ts';
import { exportFrame } from '../src/export.ts';
import { packageExui } from '../src/package.ts';
import { namedFixture, graphicFixture } from './named-fixture.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';
import { expandedFixture,projectFixture,verticalFixture,frame as makeFrame } from './expanded-fixture.ts';
import { readMetadata,PROFILES } from '../src/model.ts';
import { kitFixture,png } from './kit-fixture.ts';
import { manyAssetsFixture } from './many-assets-fixture.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const dotnet=process.env.DOTNET_EXE??'dotnet',registry=process.env.EXUI_DONOR_REGISTRY;
const out=path.resolve(process.argv[2]??path.join(root,'output/figma-plugin',new Date().toISOString().replace(/[:.]/g,'-')));
await mkdir(out,{recursive:true});
function cli(args:string[]){const result=spawnSync(dotnet,[path.join(root,'src/cli/bin/Debug/net10.0/Extron.Cli.dll'),...args],{cwd:root,encoding:'utf8',timeout:180000});if(result.status!==0)throw new Error(result.stderr||result.stdout||String(result.error));return JSON.parse(result.stdout);}
const evidence:unknown[]=[];
for(const [profile,suffix] of [['tlp-pro-1025m','1025m'],['tlp-pro-300m-portrait','300m']] as const){
  fakeFigma();const frame=await createDemo(profile,icons(),true);const bundle=await exportFrame(frame),bytes=packageExui(bundle);
  const input=path.join(out,`plugin-${suffix}.exui`);await writeFile(input,bytes,{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.elements,4);assert.equal(validation.resources,2);
  const row:Record<string,unknown>={profile,input,validation,figmaBoundary:'fake API; real Figma not exercised'};
  if(registry){
    const output=path.join(out,`plugin-${suffix}.gdl`);const generation=cli(['convert-package',input,output,'--registry',registry]);
    assert.equal(generation.checks,'71/71 passed');assert.equal(generation.GuiDesignerVerified,false);assert.equal(generation.HardwareVerified,false);
    const report=JSON.parse(await readFile(output+'.report.json','utf8'));
    assert.equal(report.Generation.Checks.length,71);assert.ok(report.Generation.Checks.every((c:{Passed:boolean})=>c.Passed));row.generation=generation;
    const model=cli(['list-controls',output]).model;assert.equal(model.Pages[0].Controls.length,4);
    const before=model.Pages[0].Controls.map((c:any)=>[c.Comments,c.ObjectId,c.ControlId]).sort();
    (frame.children as any).reverse();for(const c of frame.children)c.x+=1;
    const moved=path.join(out,`plugin-${suffix}-moved.exui`);await writeFile(moved,packageExui(await exportFrame(frame)),{flag:'wx'});
    const movedOutput=path.join(out,`plugin-${suffix}-moved.gdl`);cli(['convert-package',moved,movedOutput,'--registry',registry]);
    const after=cli(['list-controls',movedOutput]).model.Pages[0].Controls.map((c:any)=>[c.Comments,c.ObjectId,c.ControlId]).sort();assert.deepEqual(before,after);row.idsPreservedAfterMoveAndReorder=true;
  }
  evidence.push(row);console.log(`PASS ${profile}: .exui → CLI validation${registry?' → editable .gdl, 71/71, IDs preserved':''}`);
}
for(const [profile,suffix] of [['tlp-pro-1025m','1025m'],['tlp-pro-300m-portrait','300m']] as const){
  fakeFigma();const frame=await namedFixture(profile,true);const plan=recognize(frame,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(frame),input=path.join(out,`named-off-on-${suffix}.exui`);await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');
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
  evidence.push(row);console.log(`PASS ${profile}: named Off/On → exui/5 → CLI${registry?' → editable GDL, two states, press feedback -1':''}`);
}
for(const [profile,suffix] of [['tlp-pro-1025m','1025m'],['tlp-pro-300m-portrait','300m']] as const){
  fakeFigma();const frame=await graphicFixture(profile);const plan=recognize(frame,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(frame),input=path.join(out,`logo-volume-${suffix}.exui`);await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');
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
  evidence.push(row);console.log(`PASS ${profile}: logo + yellow Normal/Pressed → exui/5 → CLI${registry?' → PBImage + press feedback 1':''}`);
}
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
 for(const [name,fixture] of [['expanded',expandedFixture],['project',projectFixture],['vertical',verticalFixture]] as const){
  fakeFigma();const frame=fixture(profile),plan=recognize(frame,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const homeNode=name==='project'?(frame.children[0] as FrameNode):frame;
  const button=homeNode.children.find(n=>n.name==='button_Connection')!;tag(button,{...readMetadata(button)!,behavior:{selectionGroup:'sources.hall',enabled:true,visible:true}});
  const bundle=await exportFrame(frame),input=path.join(out,`${name}-${profile}.exui`);await writeFile(input,packageExui(bundle),{flag:'wx'});const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');
  const row:Record<string,unknown>={profile,name,validation,figmaBoundary:'fake Figma API; real native writer and independent NRBF'};
  if(registry){const output=path.join(out,`${name}-${profile}.gdl`);row.generation=cli(['convert-package',input,output,'--registry',registry]);const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:any)=>c.Passed));
   const model=cli(['list-controls',output]).model,home=model.Pages.find((p:any)=>p.Name==='Home'),controls=home.Controls;
   const nativeSlider=controls.find((c:any)=>c.Comments==='exui-key=home.volume');
   assert.equal(nativeSlider.Type,'PBSlider');assert.equal(nativeSlider.Native.Slider.ThumbImage,'Slider Thumb');
   assert.equal(nativeSlider.Native.Slider.ThumbAspectRatio,nativeSlider.Native.Slider.ThumbHeight/nativeSlider.Native.Slider.ThumbWidth);
   const nativeValue=controls.find((c:any)=>c.Comments==='exui-key=home.volumevalue');
   assert.equal(nativeValue.Native.DynamicText,true);assert.equal(nativeValue.TextAlignment,4);
   assert.equal(controls.find((c:any)=>c.Comments==='exui-key=home.card').Type,'PBShape');assert.equal(controls.find((c:any)=>c.Comments==='exui-key=home.divider').Type,'PBLine');assert.equal(controls.find((c:any)=>c.Comments==='exui-key=home.clock').Type,'PBDateTime');
   assert.equal(controls.find((c:any)=>c.Comments==='exui-key=home.status').States.length,3);assert.equal(controls.find((c:any)=>c.Comments==='exui-key=home.connection').States.length,4);
   if(name==='project'){assert.equal(model.Pages.length,2);assert.equal(model.Popups.length,5);assert.equal(model.Groups.length,1);}
   if(name==='vertical'){const slider=controls.find((c:any)=>c.Type==='PBSlider').Native.Slider;assert.equal(slider.Orientation,2);assert.equal(slider.Min,10);assert.equal(slider.Max,255);const line=controls.find((c:any)=>c.Type==='PBLine').Native.Line;assert.equal(line.Start,0);assert.equal(line.End,4);const shape=controls.find((c:any)=>c.Type==='PBShape');assert.equal(model.Resources.find((r:any)=>r.Name===shape.Native.BorderName).Border.Shape,2);}
   const mapResult=spawnSync(dotnet,[path.join(root,'src/cli/bin/Debug/net10.0/Extron.Cli.dll'),'id-map',input],{cwd:root,encoding:'utf8',timeout:60000});assert.equal(mapResult.status,0);assert.ok(mapResult.stdout.includes('sources.hall'));await writeFile(path.join(out,`${name}-${profile}.id-map.md`),mapResult.stdout,{flag:'wx'});
  }
  evidence.push(row);console.log(`PASS ${profile}: ${name} → exui/5 → CLI${registry?' → native types and independently verified states/containers':''}`);
 }
}
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
  fakeFigma();const frame=await graphicFixture(profile);
  const button=frame.children[0] as FrameNode;
  for(const state of button.children as FrameNode[])(state.children.find(n=>n.type==='TEXT') as TextNode).characters='';
  const plan=recognize(frame,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(frame),input=path.join(out,`blank-caption-${profile}.exui`);
  await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');
  const row:Record<string,unknown>={profile,name:'blank-caption',validation,figmaBoundary:'fake Figma API; real native writer and independent NRBF'};
  if(registry){
    const output=path.join(out,`blank-caption-${profile}.gdl`);row.generation=cli(['convert-package',input,output,'--registry',registry]);
    const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:any)=>c.Passed));
    const controls=cli(['list-controls',output]).model.Pages[0].Controls;
    const native=controls.find((c:any)=>c.Comments==='exui-key=home.volumeup');assert.equal(native.Type,'PBButton');
    assert.ok(native.States.length>0);assert.ok(native.States.every((s:any)=>s.Text===''));
    const overlay=controls.find((c:any)=>c.Comments==='exui-key=home.volumevalue');assert.equal(overlay.Type,'PBLabel');assert.ok(overlay.Text.length>0);
    row.blankNativeStatesAndSeparateTextVerified=true;
  }
  evidence.push(row);console.log(`PASS ${profile}: empty button captions → exui/5 → native blank button + separate editable label`);
}
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
  fakeFigma();const frame=await namedFixture(profile,false);const plan=recognize(frame,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const input=path.join(out,`feedback-button-${profile}.exui`);await writeFile(input,packageExui(await exportFrame(frame)),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');
  const row:Record<string,unknown>={profile,name:'feedback-button',validation,figmaBoundary:'fake Figma API; native Extron writer and independent NRBF'};
  if(registry){
    const output=path.join(out,`feedback-button-${profile}.gdl`);row.generation=cli(['convert-package',input,output,'--registry',registry]);
    const model=cli(['list-controls',output]).model;
    for(const button of model.Pages[0].Controls.filter((c:any)=>c.Type==='PBButton')){assert.deepEqual(button.States.map((s:any)=>s.Name),['Normal','Active','Pressed']);assert.equal(button.PressFeedbackState,2);}
    row.activeAndPressFeedbackVerified=true;
  }
  evidence.push(row);console.log(`PASS ${profile}: feedbackbutton_ → Normal/Active/Pressed, native press feedback 2`);
}
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
 for(const [name,prefix,names] of [
  ['momentary','button',['Normal','Pressed']],
  ['passive-active','button',['Passive','Active']],
  ['feedback-two','feedbackbutton',['Normal','Active']],
 ] as const){
  fakeFigma();const frame=await namedFixture(profile,false),button=frame.children[0] as FrameNode;
  button.name=prefix+'_VolumeDown';button.children[names[1]==='Pressed'?1:2].remove();
  button.children.forEach((s,i)=>s.name=names[i]);
  const plan=recognize(frame,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(frame),expected=bundle.screen.elements[0];
  assert.deepEqual(expected.states!.map(s=>s.name),names);assert.deepEqual(expected.states!.map(s=>s.stateId),[0,1]);
  const input=path.join(out,`${name}-${profile}.exui`);await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');
  const row:Record<string,unknown>={profile,name,validation,figmaBoundary:'fake Figma API; real CLI/native writer'};
  if(registry){
    const output=path.join(out,`${name}-${profile}.gdl`);row.generation=cli(['convert-package',input,output,'--registry',registry]);
    const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:any)=>c.Passed));
    const control=cli(['list-controls',output]).model.Pages[0].Controls.find((c:any)=>c.Comments==='exui-key='+expected.key);
    assert.equal(control.Type,'PBButton');assert.equal(control.ControlId,expected.controlId);
    assert.deepEqual(control.States.map((s:any)=>s.Name),names);
    assert.equal(control.PressFeedbackState,names[1]==='Pressed'?1:-1);
    row.twoAuthoredStatesVerified=true;
  }
  evidence.push(row);console.log(`PASS ${profile}: ${name} → two authored native states, no fabricated third state`);
 }
}
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
 for(const project of [false,true]){
  kitFixture();const frame=await manyAssetsFixture(profile,project),plan=recognize(frame,profile);
  assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(frame),name=project?'many-assets-project':'many-assets-screen',expected=profile==='tlp-pro-1025m'?36:18;
  const input=path.join(out,`${name}-${profile}.exui`);await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.resources,expected);
  const row:Record<string,unknown>={profile,name,validation,figmaBoundary:'fake Figma API/PNG; real CLI/native writer'};
  if(registry){
    const output=path.join(out,`${name}-${profile}.gdl`);row.generation=cli(['convert-package',input,output,'--registry',registry]);
    const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:any)=>c.Passed));
    const controls=cli(['list-controls',output]).model.Pages[0].Controls;
    assert.equal(controls.length,expected/3);assert.ok(controls.every((c:any)=>c.Type==='PBButton'&&c.States.length===3&&c.States.every((s:any)=>s.Image)));
    row.allArtworkResourcesAndNativeStatesVerified=true;
  }
  evidence.push(row);console.log(`PASS ${profile}: ${name} → ${expected} PNGs → CLI/native GDL`);
 }
}
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
  const fake=fakeFigma(),size=PROFILES[profile];
  const frame=makeFrame(null,'screen_StartPage',250,180,size.width,size.height);
  frame.clipsContent=true;makeFrame(frame,'image_Background',0,-99,size.width,size.height+198);
  const plan=recognize(frame,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  fake.setRenderHook(node=>png(node.width,node.height));
  const bundle=await exportFrame(frame),input=path.join(out,`clipped-background-${profile}.exui`);
  assert.deepEqual(bundle.screen.elements[0].rect,[0,0,size.width,size.height]);
  await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');assert.equal(validation.resources,1);
  const row:Record<string,unknown>={profile,name:'clipped-background',validation,figmaBoundary:'fake Figma API/PNG; real CLI/native writer'};
  if(registry){
    const output=path.join(out,`clipped-background-${profile}.gdl`);row.generation=cli(['convert-package',input,output,'--registry',registry]);
    const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:any)=>c.Passed));
    const control=cli(['list-controls',output]).model.Pages[0].Controls[0];
    assert.equal(control.Type,'PBImage');assert.equal(control.ControlId,0);assert.equal(control.Comments,'exui-key=startpage.background');
    row.nativeImageVerified=true;
  }
  evidence.push(row);console.log(`PASS ${profile}: clipped background → viewport PNG → CLI/native GDL`);
}
await writeFile(path.join(out,'integration.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log('Evidence: '+out);
