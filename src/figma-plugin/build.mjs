import * as esbuild from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const icons={};
for(const tone of ['light','dark'])icons[`icon.note-${tone}`]=[...await readFile(path.join(root,`../../examples/first-screen/assets/note-${tone}.png`))];
const common={bundle:true,target:'es2017',logLevel:'info'};
async function build(){
  const ui=await esbuild.build({...common,entryPoints:[path.join(root,'src/ui.ts')],write:false,minify:true});
  const html=(await readFile(path.join(root,'ui.html'),'utf8')).replace('/*__BUNDLE__*/',()=>ui.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
  await mkdir(path.join(root,'dist'),{recursive:true});
  await writeFile(path.join(root,'dist/ui.html'),html);
  await esbuild.build({...common,entryPoints:[path.join(root,'src/code.ts')],outfile:path.join(root,'dist/code.js'),define:{__html__:JSON.stringify(html),__ICONS__:JSON.stringify(icons)}});
}
await build();
if(process.argv.includes('--watch')){
  const {watch}=await import('node:fs');let timer;
  watch(root,{recursive:true},(_,file)=>{if(file&&!file.startsWith('dist')&&!file.startsWith('node_modules')&&!file.includes('package-lock')){clearTimeout(timer);timer=setTimeout(()=>build().catch(console.error),150);}});
}
