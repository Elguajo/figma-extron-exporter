// Packaged plugin -> Figma API boundary fixture -> EXUI -> released CLI.
// This does not exercise Figma Desktop or the physical touch panel.
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { unzipSync,strFromU8 } from 'fflate';
import { fakeFigma } from './fake-figma.ts';
import { frame,label } from './expanded-fixture.ts';
import { packageExui } from '../src/package.ts';
import { PROFILES,readMetadata,type Bundle,type Profile } from '../src/model.ts';
import { designSignature } from '../src/export.ts';

const [archive,output,cliRoot]=process.argv.slice(2);
assert.ok(archive&&output&&cliRoot,'Usage: node test/popup-auto-binding-integration.ts <plugin.zip> <new-output-dir> <cli-root>');
const files=unzipSync(new Uint8Array(await readFile(archive))),manifest=JSON.parse(strFromU8(files['manifest.json'])),version=JSON.parse(strFromU8(files['version.json']));
assert.equal(manifest.id,'figma-extron-exporter-local-dev');assert.equal(version.version,'0.7.0');assert.equal(version.compatibleCliVersion,'0.7.0');
const source=strFromU8(files[manifest.main]),ui=strFromU8(files[manifest.ui]);assert.ok(ui.includes('· 0.7.0'));
await mkdir(output,{recursive:true});const evidence=[];
for(const profile of Object.keys(PROFILES) as Profile[])for(const mode of ['selected-frames','page']){
  const f=fakeFigma(),size=PROFILES[profile],screen=frame(null,'screen_VideoWallControl',0,0,size.width,size.height);
  const ref=frame(screen,'popupref_WallLayouts',10,80,280,120,''),group=frame(null,'popupgroup_WallLayouts',size.width+40,0,900,120,'');
  const popups=['Full','Split','Multi'].map((name,i)=>{const p=frame(group,'popup_Wall'+name,i*300,0,280,120);label(p,'text_Title',name,5,5,100,30);return p;});
  const scratch=frame(null,'popupgroup_Unfinished',5000,0,100,100,''),scratchBefore=designSignature(scratch),bounds=[ref,...popups].map(n=>n.absoluteBoundingBox);
  const start=()=>{let embedded='';f.api.showUI=(html?:string)=>{embedded=html??'';};runInNewContext(source,{figma:f.api,Uint8Array,console});assert.equal(embedded,ui);return f.api.ui.onmessage as (m:unknown)=>Promise<void>;};
  f.page.selection=[screen] as never;let send=start();
  await send({type:'check',scopeMode:mode,profile});
  assert.deepEqual(f.messages.filter(m=>m.type==='recognition').flatMap(m=>(m as any).errors),[]);
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  assert.ok(readMetadata(group));assert.equal(readMetadata(ref)!.group,readMetadata(group)!.key);
  send=start();await send({type:'export',scopeMode:mode,profile});
  assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
  const bundle=f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle;
  assert.ok('pages' in bundle.screen);assert.equal(bundle.screen.groups.length,1);assert.equal(bundle.screen.popups.length,3);
  assert.equal(bundle.screen.pages[0].elements[0].group,bundle.screen.groups[0].key);
  assert.deepEqual([ref,...popups].map(n=>n.absoluteBoundingBox),bounds);assert.equal(designSignature(scratch),scratchBefore);
  const input=path.resolve(output,profile+'-'+mode+'.exui');await writeFile(input,packageExui(bundle),{flag:'wx'});
  const validation=spawnSync(process.env.DOTNET_EXE??'dotnet',[path.resolve(cliRoot,'cli/Extron.Cli.dll'),'validate-package',input],{encoding:'utf8',timeout:30000});
  assert.equal(validation.status,0,validation.stderr||validation.stdout);assert.equal(JSON.parse(validation.stdout).contract,'exui/5');
  const before=designSignature(f.page as never);await send({type:'export',scopeMode:mode,profile});
  assert.equal(designSignature(f.page as never),before);
  assert.deepEqual(packageExui(f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle),packageExui(bundle));
  evidence.push({profile,mode,pages:1,groups:1,popups:3,automaticBinding:true,cliValidation:'exui/5',repeatedExportStable:true});
}
await writeFile(path.resolve(output,'result.json'),JSON.stringify({plugin:version.version,evidence,boundary:'Figma API fixture; not Desktop'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({plugin:version.version,evidence},null,2));
