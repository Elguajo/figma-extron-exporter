// Figma API/rendering is modelled; the bundled plugin, CLI, native writer and NRBF reader are real.
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { fakeFigma } from './fake-figma.ts';
import { namedFixture } from './named-fixture.ts';
import { readMetadata,type Bundle } from '../src/model.ts';
import { packageExui } from '../src/package.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.resolve(process.argv[2]??path.join(root,'output/update-workflow',String(Date.now())));
await mkdir(out,{recursive:true});
const dotnet=process.env.DOTNET_EXE??'dotnet',registry=process.env.EXUI_DONOR_REGISTRY;
const dll=process.env.EXUI_CLI_DLL??path.join(root,'src/cli/bin/Debug/net10.0/Extron.Cli.dll');
const code=await readFile(path.join(root,'src/figma-plugin/dist/code.js'),'utf8');
function command(args:string[],expected=0) {
  const r=spawnSync(dotnet,[dll,...args],{cwd:root,encoding:'utf8',timeout:180000});
  assert.equal(r.status,expected,r.stderr||r.stdout||String(r.error));return r;
}
const cli=(args:string[])=>JSON.parse(command(args).stdout);
const evidence:unknown[]=[];
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const) {
  const fake=fakeFigma(),frame=await namedFixture(profile,true);fake.page.selection=[frame as never];
  const restart=()=>runInNewContext(code,{figma:fake.api,Uint8Array,console});restart();
  async function save(version:string) {
    await (fake.api.ui.onmessage as (m:unknown)=>Promise<void>)({type:'export',profile});
    assert.deepEqual(fake.messages.filter(m=>m.type==='error'),[]);
    const bundle=fake.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle;
    const input=path.join(out,`${profile}-${version}.exui`);await writeFile(input,packageExui(bundle),{flag:'wx'});
    cli(['validate-package',input]);return input;
  }
  const before=await save('v1');
  const music=frame.children[0] as FrameNode,mute=frame.children[3] as FrameNode;
  const musicId=readMetadata(music)!.controlId!,deletedId=readMetadata(mute)!.controlId!;
  const musicObjectId=readMetadata(music)!.objectId!;
  for(const state of music.children as FrameNode[]) {
    state.fills=[{type:'SOLID',color:{r:.1,g:.4,b:.6}}];
    (state.children.find(n=>n.type==='TEXT') as TextNode).characters='Music zone';
  }
  music.x+=1;
  const added=mute.clone();added.name='button_Extra';mute.remove();restart();
  const after=await save('v2'),addedId=readMetadata(added)!.controlId!;
  assert.notEqual(addedId,deletedId);assert.notEqual(addedId,musicId);
  assert.equal(readMetadata(music)!.controlId,musicId);assert.equal(readMetadata(music)!.objectId,musicObjectId);
  const comparison=cli(['compare-packages',before,after,'--json']);
  assert.equal(comparison.schema,'exui-comparison/1');assert.equal(comparison.gcpVerified,false);
  assert.equal(comparison.items.filter((i:any)=>i.status==='added').length,1);
  assert.equal(comparison.items.filter((i:any)=>i.status==='removed').length,1);
  const changed=comparison.items.find((i:any)=>i.before?.controlId===musicId);
  assert.equal(changed.status,'modified');assert.equal(changed.after.controlId,musicId);
  assert.ok(changed.changes.every((c:any)=>c.severity==='info'));
  assert.equal(comparison.items.find((i:any)=>i.before?.controlId===deletedId).status,'removed');
  const markdown=command(['compare-packages',before,after]).stdout;
  assert.ok(markdown.includes('Добавлен')&&markdown.includes('Удалён')&&markdown.includes('GCP'));
  await writeFile(path.join(out,profile+'-changes.md'),markdown,{flag:'wx'});
  await writeFile(path.join(out,profile+'-changes.json'),JSON.stringify(comparison,null,2)+'\n',{flag:'wx'});
  assert.deepEqual(cli(['compare-packages',before,after,'--json']),comparison);
  assert.ok(cli(['compare-packages',before,before,'--json']).items.every((i:any)=>i.status==='unchanged'));
  command(['compare-packages',before],2);command(['compare-packages',before,after,'--bad'],2);
  command(['compare-packages',before,path.join(out,'missing.exui')],1);
  const invalid=path.join(out,profile+'-invalid.exui');await writeFile(invalid,new Uint8Array([1,2,3]),{flag:'wx'});
  assert.equal(command(['compare-packages',before,invalid],1).stdout,'');
  command(['id-map',before,'--json'],2);
  const row:Record<string,unknown>={profile,musicId,deletedId,addedId,comparison,figmaBoundary:'modelled API; real bundled plugin',gcpVerified:false};
  if(registry) {
    const generations=[];
    for(const [version,input] of [['v1',before],['v2',after]]) {
      const output=path.join(out,`${profile}-${version}.gdl`),generation=cli(['convert-package',input,output,'--registry',registry]);
      const model=cli(['list-controls',output]).model,controls=model.Pages.flatMap((p:any)=>p.Controls);
      assert.equal(controls.find((c:any)=>c.ControlId===musicId).ObjectId,musicObjectId);
      assert.equal(controls.filter((c:any)=>c.ControlId===deletedId).length,version==='v1'?1:0);
      assert.equal(controls.filter((c:any)=>c.ControlId===addedId).length,version==='v1'?0:1);
      assert.match(generation.checks,/^(\d+)\/\1 passed$/);generations.push({version,...generation});
    }
    row.generations=generations;
  }
  evidence.push(row);console.log(`PASS ${profile}: export v1 → edit/add/delete → restart → export v2 → compare${registry?' → GDL/NRBF for both revisions':''}`);
}
await writeFile(path.join(out,'results.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(out);
