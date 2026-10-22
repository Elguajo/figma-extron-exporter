// Fake Figma boundary; real CLI, Extron writer and independent NRBF verifier.
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { unzipSync,strFromU8 } from 'fflate';
import { fakeFigma } from './fake-figma.ts';
import { projectFixture,solid } from './expanded-fixture.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { readMetadata,DATA_KEY,type Bundle } from '../src/model.ts';
import { exportFrame } from '../src/export.ts';
import { packageExui } from '../src/package.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.resolve(process.argv[2]??path.join(root,'output/figma-plugin','popup-appearance-'+Date.now()));await mkdir(out,{recursive:true});
const dotnet=process.env.DOTNET_EXE??'dotnet',registry=process.env.EXUI_DONOR_REGISTRY;
const archive=process.env.EXUI_PLUGIN_ARCHIVE?unzipSync(new Uint8Array(await readFile(process.env.EXUI_PLUGIN_ARCHIVE))):undefined;
function cli(args:string[]) {
  const result=spawnSync(dotnet,[process.env.EXUI_CLI_DLL??path.join(root,'src/cli/bin/Debug/net10.0/Extron.Cli.dll'),...args],{cwd:root,encoding:'utf8',timeout:180000});
  assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));return JSON.parse(result.stdout);
}
const evidence:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)for(const keep of [false,true]) {
  const fake=fakeFigma(),project=projectFixture(profile),plan=recognize(project,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const page=project.children[0] as FrameNode,ref=page.children.find(n=>n.name==='popupref_Sources') as FrameNode;
  const popup=project.children.find(n=>n.name==='popup_Sources') as FrameNode;
  for(const node of [ref,popup]) {
    node.fills=[solid('#123456')];node.strokes=[solid('#FF0000')];node.strokeAlign='INSIDE';node.strokeWeight=2;node.opacity=.2;node.cornerRadius=20;
    if(keep)node.setPluginData(DATA_KEY,JSON.stringify({...readMetadata(node),exportBackground:true,exportStroke:true}));
  }
  ref.fills=[{...solid('#123456'),opacity:.5}];
  const name=`${profile}-${keep?'keep':'ignore'}`,input=path.join(out,name+'.exui');
  let bundle:Bundle;
  if(archive) {
    const manifest=JSON.parse(strFromU8(archive['manifest.json']));fake.page.appendChild(project as never);fake.page.selection=[project as never];
    runInNewContext(strFromU8(archive[manifest.main]),{figma:fake.api,Uint8Array,console});
    await (fake.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'export',profile});
    assert.deepEqual(fake.messages.filter(m=>m.type==='error'),[]);
    bundle=fake.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle;
  }else bundle=await exportFrame(project);
  await writeFile(input,packageExui(bundle),{flag:'wx'});const validation=cli(['validate-package',input]);
  const row:Record<string,unknown>={name,validation,archive:process.env.EXUI_PLUGIN_ARCHIVE,figmaBoundary:'fake API; native writer is real when registry supplied'};
  if(registry) {
    const output=path.join(out,name+'.gdl');row.generation=cli(['convert-package',input,output,'--registry',registry]);
    const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:any)=>c.Passed));
    const model=cli(['list-controls',output]).model,main=model.Pages.find((p:any)=>p.Name==='Home'),pu=model.Popups.find((p:any)=>p.Name===popup.name);
    assert.equal(pu.Background,keep?0xFF123456:0);
    assert.equal(model.Popups.find((p:any)=>p.Name==='modalpopup_Confirm').Background,0);
    const decoration=main.Controls.find((c:any)=>c.Comments?.startsWith('exui-key=popup-appearance.'));
    const border=pu.Controls.find((c:any)=>c.Comments?.startsWith('exui-key=popup-appearance.'));
    if(keep) {
      assert.equal(decoration.Type,'PBShape');assert.equal(decoration.ControlId,0);assert.equal(decoration.Native.Fill,0x80123456);assert.equal(decoration.Native.Stroke,0xFFFF0000);
      assert.equal(border.Type,'PBShape');assert.equal(border.Native.Fill,0);assert.equal(border.Native.Stroke,0xFFFF0000);
      assert.equal(pu.Controls[0].ObjectId,border.ObjectId);
      assert.equal(main.Controls[main.Controls.indexOf(decoration)+1].Type,'PBPopupPageReference');
      const resource=model.Resources.find((r:any)=>r.Name===decoration.Native.BorderName);assert.equal(resource.Border.Thickness,2);assert.equal(resource.Border.Radius,0);
    }else {assert.equal(decoration,undefined);assert.equal(border,undefined);}
    row.checks=report.Generation.Checks.length;
  }
  evidence.push(row);console.log('PASS '+name+' → EXUI/5'+(registry?' → GDL/NRBF':''));
}
await writeFile(path.join(out,'results.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(out);
