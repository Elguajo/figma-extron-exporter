// Synthetic API-boundary measurement; this does not profile the native Figma host.
import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildSync } from 'esbuild';
import { fakeFigma } from './fake-figma.ts';
import { twoScreens } from './page-project-fixture.ts';

const entry=fileURLToPath(new URL('../src/code.ts',import.meta.url));
const baselinePresets=execFileSync('git',['show','HEAD:src/figma-plugin/src/button-preparation.ts'],{encoding:'utf8'});
// Reconstruct only the pre-fix hot paths; retain other working-tree changes.
const sources:Record<string,string>={};
for(const name of ['code','export','scope'])sources[name]=readFileSync(new URL(`../src/${name}.ts`,import.meta.url),'utf8');
sources.code=sources.code.replace('preparedLinks={context:resolved,plan};','');
sources.export=sources.export.replace('JSON.stringify(snapshot(root,members))','JSON.stringify(snapshot(root))');
sources.scope=sources.scope.replace(/      function visit\(node:SceneNode\)\{if\(!wanted.size\)return;[^\n]+\n      if\(wanted.size\)for\(const child of page.children\)\{visit\(child\);if\(!wanted.size\)break;\}/,
  "      function visit(node:SceneNode){if(node.type==='FRAME'&&wanted.has(node.id))children.set(node.id,node);if('children' in node)for(const child of node.children)visit(child);}\n      for(const child of page.children)visit(child);");
sources['button-preparation']=baselinePresets;
const baseOptions={entryPoints:[entry],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:'{}'}};
// buildSync does not support plugins: use the async build API for baseline overrides.
const {build}=await import('esbuild');
const before=(await build({...baseOptions,plugins:[{name:'pre-fix-hot-paths',setup(builder){
  builder.onLoad({filter:/[\\/]src[\\/](code|export|scope|button-preparation)\.ts$/},args=>{
    const name=/([^\\/]+)\.ts$/.exec(args.path)![1];
    return {contents:sources[name],loader:'ts'};
  });
}}]})).outputFiles![0].text;
const after=buildSync(baseOptions).outputFiles[0].text;
const rows=[];
for(const [version,source] of [['before',before],['after',after]]){
  const samples=[];let paintReads=0;let result:unknown;
  for(let run=0;run<3;run++){
    const f=fakeFigma(),{main,audio}=twoScreens();
    for(let group=0;group<50;group++){
      const scratch=f.api.createFrame();scratch.name='Scratch '+group;
      for(let i=0;i<100;i++){
        const rect=f.api.createRectangle();scratch.appendChild(rect);
        Object.defineProperty(rect,'fills',{get(){paintReads++;return [];}});
      }
    }
    f.page.selection=[main as never,audio as never];
    const start=performance.now();vm.runInNewContext(source,{figma:f.api,Uint8Array,console});
    const send=f.api.ui.onmessage as (m:unknown)=>Promise<void>;
    await send({type:'ready'});samples.push(performance.now()-start);
    assert.deepEqual(f.messages.filter(m=>m.type==='error'),[]);
    await send({type:'export'});
    const bundle=f.messages.find(m=>m.type==='bundle');assert.ok(bundle);
    const normalized=JSON.parse(JSON.stringify(bundle.bundle));
    if(version==='before')result=normalized;
    else assert.deepEqual(normalized,rows[0].bundle);
  }
  rows.push({version,medianStartupMs:samples.sort((a,b)=>a-b)[1],scratchPaintReadsAcrossStartupAndExport:paintReads,bundle:result});
}
const report={boundary:'synthetic Figma API; 5000 unrelated rectangles; median of 3 runs; no native Figma timing',before:rows[0],after:rows[1],identicalExport:true};
delete (report.before as any).bundle;delete (report.after as any).bundle;
mkdirSync('../../output/plugin-startup',{recursive:true});writeFileSync('../../output/plugin-startup/benchmark.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
