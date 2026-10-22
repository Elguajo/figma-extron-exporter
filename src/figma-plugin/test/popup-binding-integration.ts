// The shipped plugin main bundle runs against an explicit fake Figma boundary;
// the CLI, native Extron writer and independent GDL verification are real.
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { unzipSync,strFromU8 } from 'fflate';
import { fakeFigma } from './fake-figma.ts';
import { frame,label } from './expanded-fixture.ts';
import { PROFILES,type Bundle } from '../src/model.ts';
import { packageExui } from '../src/package.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.resolve(process.argv[2]??path.join(root,'output/figma-plugin','popup-binding-'+Date.now()));await mkdir(out,{recursive:true});
const source=process.env.EXUI_PLUGIN_ARCHIVE?(()=>{return readFile(process.env.EXUI_PLUGIN_ARCHIVE).then(bytes=>{const files=unzipSync(bytes),manifest=JSON.parse(strFromU8(files['manifest.json']));return strFromU8(files[manifest.main]);});})():readFile(path.join(root,'src/figma-plugin/dist/code.js'),'utf8');
const code=await source,registry=process.env.EXUI_DONOR_REGISTRY,dotnet=process.env.DOTNET_EXE??'dotnet';
function cli(args:string[]){const result=spawnSync(dotnet,[process.env.EXUI_CLI_DLL??path.join(root,'src/cli/bin/Debug/net10.0/Extron.Cli.dll'),...args],{cwd:root,encoding:'utf8',timeout:180000});assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));return JSON.parse(result.stdout);}
const evidence:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)for(const grouped of [false,true]){
  const f=fakeFigma(),size=PROFILES[profile],main=frame(null,'screen_AudioControl',0,0,size.width,size.height,'#101010'),ref=frame(main,'popupref_AudioControls',160,120,120,100,'');
  const group=grouped?frame(null,'popupgroup_AudioControls',size.width+40,0,300,100,''):undefined;
  const hall=frame(group??null,'popup_HallSources',group?0:size.width+40,0,120,100,'#101010'),terrace=frame(group??null,'popup_TerraceSources',group?160:size.width+200,0,120,100,'#101010');
  label(hall,'text_Title','Hall',5,5,100,30);label(terrace,'text_Title','Terrace',5,5,100,30);
  const positions=[hall.absoluteBoundingBox,terrace.absoluteBoundingBox];
  runInNewContext(code,{figma:f.api,Uint8Array,console});let send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
  f.page.selection=[ref as never];await send({type:'apply',profile,data:{kind:'popup-ref',key:'',objectId:'',popup:'',group:''}});
  f.page.selection=[hall as never,terrace as never];f.emit('selectionchange');
  await send({type:'bind-popups',profile,referenceId:ref.id,popupIds:[hall.id,terrace.id]});
  assert.deepEqual([hall.absoluteBoundingBox,terrace.absoluteBoundingBox],positions);
  if(grouped)assert.equal(hall.parent,group);
  f.page.selection=[main as never];await send({type:'apply',profile,data:{kind:'page',shownBy:'start',key:'',objectId:'',projectName:''}});
  // Fresh plugin runtime must restore the project members without reselecting.
  runInNewContext(code,{figma:f.api,Uint8Array,console});send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;await send({type:'export',profile});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  const bundle=f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle;
  assert.ok('pages' in bundle.screen);assert.equal(bundle.screen.pages[0].shownBy,'start');assert.equal(bundle.screen.groups.length,1);assert.equal(bundle.screen.popups.length,2);
  assert.equal(bundle.screen.pages[0].elements[0].group,bundle.screen.groups[0].key);
  const name=profile+'-'+(grouped?'reuse-group':'create-group'),input=path.join(out,name+'.exui');await writeFile(input,packageExui(bundle),{flag:'wx'});
  const row:Record<string,unknown>={name,archive:process.env.EXUI_PLUGIN_ARCHIVE,validation:cli(['validate-package',input]),boundary:'fake Figma API; actual bundle, saved pluginData across runtimes, real CLI'};
  if(registry){const output=path.join(out,name+'.gdl');row.generation=cli(['convert-package',input,output,'--registry',registry]);const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.ok(report.Generation.Checks.every((c:any)=>c.Passed));row.checks=report.Generation.Checks.length;
    const model=cli(['list-controls',output]).model;assert.equal(model.Groups.length,1);assert.equal(model.Pages.length,1);assert.equal(model.Popups.filter((p:any)=>p.Name!=='Offline Page').length,2);const nativeRef=model.Pages[0].Controls.find((c:any)=>c.Type==='PBPopupPageReference');assert.equal(nativeRef.PopupBinding.GroupId,model.Groups[0].Id);assert.equal(nativeRef.Left,160);assert.equal(nativeRef.Top,120);
  }
  evidence.push(row);console.log('PASS '+name+' → saved binding/restart → EXUI/5'+(registry?' → GDL/NRBF':''));
}
await writeFile(path.join(out,'results.json'),JSON.stringify(evidence,null,2)+'\n');console.log(out);
