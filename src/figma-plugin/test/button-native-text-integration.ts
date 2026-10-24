// Real Extron writer and independent reader; Figma API/rendering are fixtures.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {authorButtons} from './button-preparation-fixture.ts';
import {prepareButtons} from '../src/button-preparation.ts';
import {setButtonTextMode} from '../src/button-native-text.ts';
import {recognize,applyRecognition} from '../src/recognize.ts';
import {exportFrame,designSignature} from '../src/export.ts';
import {packageExui} from '../src/package.ts';
const root=path.resolve(import.meta.dirname,'../../..'),out=path.resolve(process.argv[2]??path.join(root,'output/button-native-text-integration'));
await mkdir(out,{recursive:true});
function cli(args:string[]){const r=spawnSync(process.env.DOTNET_EXE??path.join(root,'.tools/dotnet/dotnet.exe'),[process.env.EXUI_CLI_DLL??path.join(root,'src/cli/bin/Debug/net10.0/Extron.Cli.dll'),...args],{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr||r.stdout||String(r.error));return JSON.parse(r.stdout);}
const evidence:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)for(const variant of ['middle-center','bottom-center','auto-middle','auto-bottom'] as const){
  const mode=variant.startsWith('auto')?'auto':variant as 'middle-center'|'bottom-center';
  const bottom=variant==='bottom-center'||variant==='auto-bottom';
  const f=authorButtons(profile);prepareButtons(f.root);
  for(const b of f.buttons)for(const state of b.children){const label=state.children.find(n=>n.type==='TEXT')!;label.fontName={family:'Inter',style:'Regular'};if(variant==='auto-middle')label.y=28;}
  applyRecognition(recognize(f.root,profile));const source=designSignature(f.root),before=await exportFrame(f.root);
  assert.equal(before.screen.elements.filter(e=>e.kind==='label').length,2);
  setButtonTextMode(f.root,{},mode);const after=await exportFrame(f.root);
  const base=path.join(out,profile+'-'+variant),input=base+'.exui',output=base+'.gdl';
  await writeFile(input,packageExui(after),{flag:'wx'});
  const generation=cli(['convert-package',input,output,'--registry',path.join(root,'samples/donors.json')]);
  const controls=cli(['list-controls',output]).model.Pages[0].Controls;
  assert.equal(controls.length,2);assert.ok(controls.every((c:any)=>c.Type==='PBButton'&&!c.FlattenText));
  for(const e of after.screen.elements){const c=controls.find((c:any)=>c.ObjectId===e.objectId);assert.equal(c.ControlId,e.controlId);assert.deepEqual(c.States.map((s:any)=>s.Text),e.states!.map(s=>s.text));assert.ok(c.States.every((s:any)=>s.TextAlignment===(bottom?0:3)));}
  const replaced=base+'-replaced.gdl';cli(['set-button-text',output,replaced,String(controls[0].ControlId),'Audio','BGM CH 1']);
  const changed=cli(['list-controls',replaced]).model.Pages[0].Controls;
  assert.equal(changed.length,2);assert.ok(changed[0].States.every((s:any)=>s.Text==='BGM CH 1'));assert.deepEqual(changed[1],controls[1]);
  assert.deepEqual(changed.map((c:any)=>[c.ObjectId,c.ControlId]),controls.map((c:any)=>[c.ObjectId,c.ControlId]));
  setButtonTextMode(f.root,{},'design');assert.equal(designSignature(f.root),source);
  evidence.push({profile,mode,variant,generation,controls:2,separateLabels:0,idsPreserved:true,sourceLayoutPreserved:true,plainTextReplacementVerified:true});
  console.log(`PASS ${profile} / ${variant}: native Button text, no Label, replacement and IDs verified`);
}
await writeFile(path.join(out,'integration.json'),JSON.stringify({passed:true,scenarios:evidence,boundary:'Modeled Figma API/PNG; real CLI, Extron writer and independent reader. Text replacement via CLI, not live GCP feedback; hardware not run.'},null,2)+'\n',{flag:'wx'});
