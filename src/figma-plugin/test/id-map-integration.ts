// Archived/built plugin -> real EXUI/native CLI -> binding -> protected GDL update
// -> Figma ID-map preview/apply -> re-export. The Figma API is simulated.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
import {fakeFigma} from './fake-figma.ts';
import {namedFixture} from './named-fixture.ts';
import {readMetadata,type Bundle} from '../src/model.ts';
import {packageExui} from '../src/package.ts';
const repo=path.resolve(fileURLToPath(new URL('../../..',import.meta.url)));
const out=path.resolve(process.argv[2]??path.join(repo,'output/id-map-integration',String(Date.now())));await mkdir(out,{recursive:true});
const code=process.env.EXUI_PLUGIN_ZIP?strFromU8(unzipSync(await readFile(process.env.EXUI_PLUGIN_ZIP))['dist/code.js']):await readFile(path.join(repo,'src/figma-plugin/dist/code.js'),'utf8');
const dotnet=process.env.DOTNET_EXE??path.join(repo,'.tools/dotnet/dotnet.exe'),dll=process.env.EXUI_CLI_DLL??path.join(repo,'src/cli/bin/Release/net10.0/Extron.Cli.dll');
function cli(args:string[]){const r=spawnSync(dotnet,[dll,...args],{cwd:repo,encoding:'utf8',timeout:180000});assert.equal(r.status,0,r.stderr||r.stdout);return JSON.parse(r.stdout);}
const evidence=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
 const f=fakeFigma(),root=await namedFixture(profile,true),button=root.children[0] as FrameNode;button.name='button_Page1';
 for(const state of button.children as FrameNode[])(state.children.find(n=>n.type==='TEXT') as TextNode).characters='Page 1 fresh';
 f.page.selection=[root as never];runInNewContext(code,{figma:f.api,Uint8Array,console});const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
 await send({type:'export',profile});assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
 const bundle=f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle;assert.ok(bundle.origin);
 const sourceId=readMetadata(button)!.controlId!;assert.notEqual(sourceId,1);
 const exui=path.join(out,profile+'.exui'),gdl=path.join(out,profile+'-incoming.gdl');await writeFile(exui,packageExui(bundle));
 cli(['validate-package',exui]);const native=cli(['convert-package',exui,gdl,'--registry',process.env.EXUI_DONOR_REGISTRY??path.join(repo,'samples/donors.json')]);
 const base=path.join(repo,'output/reconciliation',profile+'-manual-id1-working.gdl'),pairs=[{controlId:1,sourceControlId:sourceId}],pairFile=path.join(out,profile+'-pairs.json');await writeFile(pairFile,JSON.stringify(pairs));
 const plan=cli(['plan-layout-update',base,gdl,'--bindings',pairFile]);assert.equal(plan.items.find((i:any)=>i.controlId===1).status,'mapped');
 const selection={schema:'exui-layout-selection/1',baseSha256:plan.baseSha256,sourceSha256:plan.sourceSha256,controlIds:[1],bindings:pairs},selectionFile=path.join(out,profile+'-selection.json');await writeFile(selectionFile,JSON.stringify(selection));
 const updated=path.join(out,profile+'-updated.gdl');cli(['update-layout',base,gdl,selectionFile,updated]);
 const model=cli(['list-controls',updated]).model,actual=[...model.Pages,...model.Popups].flatMap((p:any)=>p.Controls).find((c:any)=>c.ControlId===1);
 assert.equal(actual.Name,'Button1_ID1');assert.equal(actual.ObjectId,2562);assert.equal(actual.States[0].Text,'Page 1 fresh');
 const mapFile=path.join(out,profile+'-figma-id-map.json');cli(['export-figma-id-map',base,gdl,exui,selectionFile,mapFile]);
 const json=await readFile(mapFile,'utf8');await send({type:'id-map-preview',data:{json}});assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
 const preview=f.messages.filter(m=>m.type==='id-map-preview').at(-1) as any;assert.equal(preview.rows[0].from,sourceId);assert.equal(preview.rows[0].to,1);assert.equal(readMetadata(button)!.controlId,sourceId);
 await send({type:'id-map-apply',token:preview.token});assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);assert.equal(readMetadata(button)!.controlId,1);
 await send({type:'export',profile});assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
 const next=f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle;assert.equal(next.origin!.nodes.find(n=>n.nodeId===button.id)!.controlId,1);
 const imported=path.join(out,profile+'-imported.exui');await writeFile(imported,packageExui(next));cli(['validate-package',imported]);
 evidence.push({profile,sourceId,targetId:1,nativeChecks:native.checks,updated,mapFile,imported});console.log('PASS round trip: '+profile+' / '+sourceId+' -> native 1 -> Figma 1 -> EXUI 1');
}
await writeFile(path.join(out,'evidence.json'),JSON.stringify({passed:true,boundary:'Figma API simulated; native Extron conversion and packaged formats real',evidence},null,2));
