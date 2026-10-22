// Real CLI / Extron writer and reader. Figma grouping and PNG rasterization
// remain explicit boundary fixtures; this does not exercise Figma Desktop.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { authorButtons, paint } from './button-preparation-fixture.ts';
import { background, descendants } from '../src/button-artwork.ts';
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
  const result=spawnSync(dotnet,[process.env.EXUI_CLI_DLL??path.join(root,'src/cli/bin/Debug/net10.0/Extron.Cli.dll'),...args],{cwd:root,encoding:'utf8',timeout:180000});
  if(result.status!==0)throw new Error(result.stderr||result.stdout||String(result.error));
  return JSON.parse(result.stdout);
}
const results:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const) {
  const f=authorButtons(profile);
  f.root.cornerRadius=10; // Presentation-only screen corners do not enter GDL.
  let send:((message:unknown)=>Promise<void>)|undefined;
  if(archive){
    const manifest=JSON.parse(strFromU8(archive['manifest.json']));assert.equal(manifest.id,'figma-extron-exporter-local-dev');
    f.page.selection=[f.root as never];runInNewContext(strFromU8(archive[manifest.main]),{figma:f.api,Uint8Array,console});
    send=f.api.ui.onmessage as (message:unknown)=>Promise<void>;await send({type:'button-create-states',profile,corners:true});
    assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  }else prepareButtons(f.root,{},false,true);
  // Raster details and captions can be fractional; they are not native bounds.
  const detail=descendants(f.buttons[0].children[0]).find(n=>n.name==='Vector')!;
  detail.x=.14;detail.y=.04;detail.resize(14.86,11.04);
  const caption=descendants(f.buttons[0].children[0]).find(n=>n.type==='TEXT')!;
  caption.x+=.14;caption.y+=.04;
  const pressed=f.buttons[1].children[1].clone();f.buttons[1].appendChild(pressed);pressed.name='Pressed';pressed.visible=false;background(pressed).fills=[paint('#FFFF00')];
  const api=f.api as unknown as PluginAPI;
  const logo=api.createFrame();logo.name='logo_Trilliant';f.root.appendChild(logo as never);logo.x=48.42;logo.y=320.91;logo.resize(204.01,29.09);
  for(const [i,family] of ['Inter','Roboto'].entries()){
    const label=api.createText();label.name='txt_Title'+i;f.root.appendChild(label as never);label.characters='MAIN PANEL '+family;label.fontName={family,style:'Regular'};label.textAlignHorizontal='RIGHT';label.textAlignVertical='TOP';
    label.x=48.42;label.y=230.91+i*40;label.resize(204.01,29.09);
  }
  const value=api.createText();value.name='value_Volume';f.root.appendChild(value as never);value.characters='42%';value.x=10;value.y=400;value.resize(100,24);value.textAlignVertical='CENTER';value.fills=[paint('#FFFFFF')];
  if(!send){const plan=recognize(f.root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);}
  else {await send({type:'check',profile});await send({type:'export',profile});assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);}
  const bundle=send?f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Awaited<ReturnType<typeof exportFrame>>:await exportFrame(f.root),input=path.join(out,profile+'.exui'),output=path.join(out,profile+'.gdl');
  await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]);assert.equal(validation.contract,'exui/5');assert.equal(validation.resources,8);assert.equal(validation.elements,6);
  const generation=cli(['convert-package',input,output,'--registry',process.env.EXUI_DONOR_REGISTRY??path.join(root,'samples/donors.json')]);
  const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:{Passed:boolean})=>c.Passed));
  const model=cli(['list-controls',output]).model;
  for(const expected of bundle.screen.elements) {
    const actual=model.Pages[0].Controls.find((c:any)=>c.Comments==='exui-key='+expected.key);
    assert.equal(actual.ObjectId,expected.objectId);assert.equal(actual.ControlId,expected.controlId??0);
    assert.deepEqual([actual.Left,actual.Top,actual.Width,actual.Height],Array.from(expected.rect));
    if(expected.kind==='graphic'){
      assert.deepEqual(Array.from(expected.rect).slice(2),[205,30]);
      assert.equal(actual.Type,'PBImage');assert.equal(actual.Graphic.Image,bundle.screen.assets.find(a=>a.key===expected.image)!.resourceName);continue;
    }
    if(expected.kind==='value'){assert.equal(actual.Text,expected.text);assert.equal(actual.Native.DynamicText,true);continue;}
    assert.deepEqual(actual.States.map((s:any)=>[s.Name,s.Text,s.Image]),Array.from(expected.states!,s=>[s.name,s.text,bundle.screen.assets.find(a=>a.key===s.image)!.resourceName]));
    assert.equal(actual.PressFeedbackState,expected.press?2:-1);
  }
  results.push({profile,archivedPlugin:!!archive,validation,generation,checks:report.Generation.Checks.length,figma:'boundary fixture',guiDesigner:'not run',hardware:'not run'});
  console.log('PASS '+profile+': Group buttons, fractional logo, Inter/Roboto static text, native dynamic value → EXUI/5 → native GDL');
}
await writeFile(path.join(out,'integration.json'),JSON.stringify(results,null,2)+'\n');
