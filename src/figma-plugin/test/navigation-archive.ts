// Verifies navigation retirement in an archive against a simulated Figma API.
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
const ui=strFromU8(files[manifest.ui]);assert.ok(ui.includes(`· ${version.version}`));
assert.doesNotMatch(ui,/id="(?:navigate|showNavigation|navigationHelp)"|value="navigation"/);
await mkdir(output,{recursive:true});const results:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)for(const mode of ['selected-frames','selection'] as const){
 const f=fakeFigma(),{main,audio,button}=twoScreens(profile);
 vm.runInNewContext(strFromU8(files[manifest.main]),{figma:f.api,Uint8Array,console});
 const send=f.api.ui.onmessage as (message:unknown)=>Promise<void>;
 f.page.selection=[main as never,audio as never];await send({type:'check',scopeMode:'selected-frames',profile});
 for(const [node,legacy] of [[button,{navigate:'page.deleted'}],[audio,{shownBy:'navigation'}]] as const)
  node.setPluginData(DATA_KEY,JSON.stringify({...JSON.parse(node.getPluginData(DATA_KEY)),...legacy}));
 const ids=[main,audio,button].map(n=>{const m=readMetadata(n)!;return [m.objectId,m.controlId];});
 const video=audio.clone();video.name='screen_VideoControl';
 f.page.selection=[video as never];f.emit('selectionchange');
 const selected=f.messages.filter(m=>m.type==='selection').at(-1) as any;
 assert.equal(selected.metadata.projectName,video.name);
 assert.notEqual(JSON.parse(video.getPluginData(DATA_KEY)).ownerNodeId,video.id,'opening the editor does not write');
 f.page.selection=[button as never];await send({type:'context',scopeMode:mode,profile});
 const editor=f.messages.filter(m=>m.type==='selection').at(-1) as any;
 assert.equal(editor.targets,undefined);
 const id=readMetadata(button)!.controlId;
 await send({type:'export',scopeMode:mode,profile});
 assert.deepEqual(f.messages.filter(m=>m.type==='error'||m.type==='recognition'),[],JSON.stringify(f.messages));
 const bundle=f.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle;
 const pages='pages' in bundle.screen?bundle.screen.pages:[{...bundle.screen.page,shownBy:'start',elements:bundle.screen.elements}];
 assert.equal(pages.length,mode==='selection'?1:2);assert.equal(pages.some(p=>p.name===video.name),false);
 assert.deepEqual(Array.from(pages,p=>p.shownBy),mode==='selection'?['start']:['start','program']);
 const control=pages.find(p=>p.name===main.name)!.elements.find(e=>e.kind==='button')!;
 assert.equal(Object.hasOwn(control,'navigate'),false);assert.equal(control.controlId,id);
 assert.deepEqual([main,audio,button].map(n=>{const m=readMetadata(n)!;return [m.objectId,m.controlId];}),ids);
 await writeFile(path.join(output,`${profile}-${mode}.exui`),packageExui(bundle));
 results.push({profile,mode,pages:pages.map(p=>p.name),controlId:control.controlId});
}
await writeFile(path.join(output,'navigation-archive.json'),JSON.stringify({version,passed:true,boundary:'Shipped plugin bundle; simulated Figma API. No Figma Desktop or Extron panel verification.',results},null,2)+'\n');
console.log(`PASS packaged navigation retirement: ${results.length} cases, plugin ${version.version}`);
