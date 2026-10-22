// Real archived plugin and real Extron writer/independent NRBF reader.
// Figma operations/rendering remain boundary fixtures, not a Desktop claim.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {authorButtons,paint} from './button-preparation-fixture.ts';
import {prepareButtons} from '../src/button-preparation.ts';
import {recognize,applyRecognition} from '../src/recognize.ts';
import {exportFrame} from '../src/export.ts';
import {packageExui} from '../src/package.ts';
const root=path.resolve(import.meta.dirname,'../../..'),out=path.resolve(process.argv[2]);await mkdir(out,{recursive:true});
const archive=process.argv[3]?unzipSync(new Uint8Array(await readFile(process.argv[3]))):undefined;
const cliDll=process.env.EXUI_CLI_DLL??path.join(root,'src/cli/bin/Debug/net10.0/Extron.Cli.dll');
const dotnet=process.env.DOTNET_EXE??path.join(root,'.tools/dotnet/dotnet.exe');
function cli(args:string[]){const result=spawnSync(dotnet,[cliDll,...args],{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});assert.equal(result.status,0,result.stderr||result.stdout);return JSON.parse(result.stdout);}
const evidence:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
  const f=authorButtons(profile),api=f.api as unknown as PluginAPI;let send:((m:unknown)=>Promise<void>)|undefined;
  if(archive){const manifest=JSON.parse(strFromU8(archive['manifest.json']));f.page.selection=[f.root as never];runInNewContext(strFromU8(archive[manifest.main]),{figma:f.api,Uint8Array,console});send=f.api.ui.onmessage as never;await send!({type:'button-create-states',profile});}else prepareButtons(f.root);
  for(const [i,button] of f.buttons.entries())for(const state of button.children){
    const label=state.children.find(n=>n.type==='TEXT')!;label.fontName={family:'Inter',style:i?'Medium':'Bold'};
    if(i===0){label.x=0;label.y=0;label.resize(button.width,button.height);label.textAlignHorizontal='CENTER';label.textAlignVertical='CENTER';}
  }
  const weights=['Thin','Extra Light','Light','Regular','Medium','Semi Bold','Bold','Extra Bold','Black'];
  const styles=weights.concat(weights.map(w=>w==='Regular'?'Italic':w+' Italic'));
  for(const [i,style] of styles.entries()){
    const label=api.createText();f.root.appendChild(label);label.name='txt_Font'+i;label.characters=style+' Тест';label.fontName={family:'Inter',style,variationSettings:{wght:(i%9+1)*100,opsz:14}};label.fills=[paint('#FFFFFF')];label.x=i<9?10:165;label.y=230+(i%9)*25;label.resize(145,24);label.textAlignHorizontal=(['LEFT','CENTER','RIGHT'] as const)[i%3];label.textAlignVertical=(['TOP','CENTER','BOTTOM'] as const)[Math.floor(i/3)%3];
  }
  for(const [i,kind] of ['value','datetime','txt'].entries()){
    const node=api.createText();f.root.appendChild(node);node.name=kind+'_Live';node.characters=kind==='datetime'?'HH:mm':kind==='value'?'42%':'Inter Display';node.fontName={family:kind==='txt'?'Inter Display':'Inter',style:'Regular'};node.fills=[paint('#FFFFFF')];node.x=i===1?165:10;node.y=i===2?205:180;node.resize(140,24);node.textAlignHorizontal='RIGHT';node.textAlignVertical='TOP';
  }
  if(send){await send({type:'export',profile});assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);}else applyRecognition(recognize(f.root,profile));
  const bundle=send?f.messages.find(m=>m.type==='bundle')!.bundle as Awaited<ReturnType<typeof exportFrame>>:await exportFrame(f.root);
  assert.ok(bundle.screen.elements.every(e=>e.kind!=='graphic'));assert.equal(bundle.screen.elements.filter(e=>e.key.startsWith('button-caption.')).length,1);
  const input=path.join(out,profile+'.exui'),output=path.join(out,profile+'.gdl');await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=cli(['validate-package',input]),generation=cli(['convert-package',input,output,'--registry',path.join(root,'samples/donors.json')]);
  const model=cli(['list-controls',output]).model;
  const resource=model.Resources.filter((r:any)=>r.Name==='Inter Regular Bold Italic');assert.equal(resource.length,1);assert.equal(resource[0].Font.Sha256,'EA4E3D9970B9B6B566110A1B0E13635FE235280B83DD2443DCB3FACA1E2456EF');
  for(const expected of bundle.screen.elements){
    const actual=model.Pages[0].Controls.find((c:any)=>c.ObjectId===expected.objectId);assert.ok(actual);assert.equal(actual.ControlId,expected.controlId??0);assert.equal(actual.FlattenText,false);
    if(expected.kind==='label'||expected.kind==='value'){assert.equal(actual.Type,'PBLabel');assert.equal(actual.Text,expected.text);assert.equal(actual.Font.Resource,'Inter Regular Bold Italic');}
    if(expected.kind==='datetime'){assert.equal(actual.Type,'PBDateTime');assert.equal(actual.Font.Resource,'Inter Regular Bold Italic');assert.equal(actual.Native.Pattern,'HH:mm');}
    if(expected.font?.family==='Inter'){const fonts=expected.kind==='button'?actual.States.map((s:any)=>s.Font):[actual.Font];assert.ok(fonts.every((v:any)=>v.Resource==='Inter Regular Bold Italic'));}
  }
  const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:any)=>c.Passed));
  for(const defect of ['unknown-family','unknown-style','inconsistent-bold','invalid-alignment']){
    const bad=structuredClone(bundle),label=bad.screen.elements.find(e=>e.kind==='label'&&e.font?.family==='Inter')!;
    if(defect==='unknown-family')label.font!.family='Untrusted' as never;
    if(defect==='unknown-style')label.font!.style='Book';
    if(defect==='inconsistent-bold'){label.font!.style='Bold';label.font!.bold=false;}
    if(defect==='invalid-alignment')label.textAlign='justify' as never;
    const badPath=path.join(out,profile+'-'+defect+'.exui');await writeFile(badPath,packageExui(bad),{flag:'wx'});
    const rejected=spawnSync(dotnet,[cliDll,'validate-package',badPath],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(rejected.status,1,defect+' must be a validation refusal');assert.ok(rejected.stderr.includes(defect==='inconsistent-bold'?'ERROR [spec]':'ERROR [package-schema]'),rejected.stderr);
  }
  evidence.push({profile,archivedPlugin:!!archive,validation,generation,checks:report.Generation.Checks.length,guiDesigner:'separate real application check',hardware:'not run'});console.log('PASS native Inter / '+profile+': 18 styles, editable Button, caption overlay, Label, Value and DateTime; embedded once');
}
await writeFile(path.join(out,'integration.json'),JSON.stringify(evidence,null,2)+'\n');
