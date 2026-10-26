// Runs the shipped bundle against a simulated Figma API, not a Desktop session.
import assert from 'node:assert/strict';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { unzipSync,strFromU8 } from 'fflate';
import { fakeFigma } from './fake-figma.ts';
import { twoScreens } from './page-project-fixture.ts';
import { DATA_KEY,readMetadata,type Bundle } from '../src/model.ts';
import { packageExui } from '../src/package.ts';

const [archive,output]=process.argv.slice(2);
assert.ok(archive&&output,'Usage: node test/navigation-archive.ts <plugin.zip> <output-directory>');
const files=unzipSync(new Uint8Array(await readFile(archive))),version=JSON.parse(strFromU8(files['version.json']));
const manifest=JSON.parse(strFromU8(files['manifest.json']));
assert.ok(strFromU8(files[manifest.ui]).includes(`· ${version.version}`));
await mkdir(output,{recursive:true});const results:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)for(const mode of ['selected-frames','selection'] as const){
 const f=fakeFigma(),{main,audio,button}=twoScreens(profile);
 vm.runInNewContext(strFromU8(files[manifest.main]),{figma:f.api,Uint8Array,console});
 const send=f.api.ui.onmessage as (message:unknown)=>Promise<void>;
 f.page.selection=[main as never,audio as never];await send({type:'check',scopeMode:'selected-frames',profile});
 const video=audio.clone();video.name='screen_VideoControl';
 f.page.selection=[video as never];f.emit('selectionchange');
 const selected=f.messages.filter(m=>m.type==='selection').at(-1) as any;
 assert.equal(selected.metadata.projectName,video.name);
 assert.notEqual(JSON.parse(video.getPluginData(DATA_KEY)).ownerNodeId,video.id,'opening the editor does not write');
 f.page.selection=[button as never];await send({type:'context',scopeMode:mode,profile});
 const editor=f.messages.filter(m=>m.type==='selection').at(-1) as any;
 assert.ok(editor.targets.some((t:any)=>t.id===video.id&&t.outsideScope));
 const id=readMetadata(button)!.controlId;
 await send({type:'apply',nodeId:button.id,data:{...editor.metadata,navigate:'',navigationTargetId:video.id}});
 await send({type:'export',scopeMode:'selected-frames',profile});
 assert.deepEqual(f.messages.filter(m=>m.type==='error'||m.type==='recognition'),[],JSON.stringify(f.messages));
 const bundle=f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle;
 assert.ok('pages' in bundle.screen);assert.equal(bundle.screen.pages.length,mode==='selection'?2:3);
 const target=bundle.screen.pages.find(p=>p.name===video.name)!;
 const control=bundle.screen.pages.find(p=>p.name===main.name)!.elements.find(e=>e.kind==='button')!;
 assert.ok(target);assert.equal(control.navigate,target.key);assert.equal(control.controlId,id);
 assert.equal(readMetadata(video)!.projectName,video.name);
 assert.equal(new Set(bundle.screen.pages.map(p=>p.objectId)).size,bundle.screen.pages.length);
 await writeFile(path.join(output,`${profile}-${mode}.exui`),packageExui(bundle));
 results.push({profile,mode,pages:bundle.screen.pages.map(p=>p.name),navigate:control.navigate,controlId:control.controlId});
}
await writeFile(path.join(output,'navigation-archive.json'),JSON.stringify({version,passed:true,boundary:'Shipped plugin bundle; simulated Figma API. No Figma Desktop or Extron panel verification.',results},null,2)+'\n');
console.log(`PASS packaged navigation: ${results.length} cases, plugin ${version.version}`);
