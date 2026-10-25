import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {DATETIME_FORMATS,formatDateTime} from '../../../src/figma-plugin/src/datetime-format.ts';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../..');
const target=dir;
const dist=path.join(target,'dist');
await mkdir(path.join(dist,'assets'),{recursive:true});
await mkdir(path.join(dist,'assets/fonts'),{recursive:true});
for(const file of ['Inter-Regular.woff2','Inter-Bold.woff2','LICENSE.txt'])await copyFile(path.join(dir,'assets/fonts',file),path.join(dist,'assets/fonts',file));
const pkg=JSON.parse(await readFile(path.join(root,'src/figma-plugin/package.json'),'utf8'));
for(const file of ['styles.css','app.js','guides.js'])await copyFile(path.join(dir,file),path.join(dist,file));
await writeFile(path.join(dist,'index.html'),(await readFile(path.join(dir,'index.html'),'utf8')).replaceAll('__PLUGIN_VERSION__',pkg.version));
const catalog=JSON.parse(await readFile(path.join(root,'docs/design/extron-kit/kit.json'),'utf8'));
const patterns=JSON.parse(await readFile(path.join(root,'docs/design/extron-kit/patterns.json'),'utf8'));
const icons=JSON.parse(await readFile(path.join(root,'docs/design/extron-kit/icons/icons.json'),'utf8'));
const guides=JSON.parse(await readFile(path.join(root,'docs/prefix_map/guide-data.json'),'utf8'));
const prefixes=JSON.parse(await readFile(path.join(root,'docs/prefix_map/prefix-data.json'),'utf8'));
const data={...catalog,guides,prefixes,patterns:patterns.patterns,icons:icons.icons.map(({name})=>({name})),iconVersion:icons.version,pluginVersion:pkg.version,cliVersion:pkg.compatibleCliVersion,formats:DATETIME_FORMATS.map(f=>({...f,preview:formatDateTime(f.pattern)}))};
await writeFile(path.join(dist,'kit-data.js'),'window.KIT_DATA='+JSON.stringify(data).replace(/</g,'\\u003c')+';\n');
const images={
 'panel-1025m.png':'T78n4.png','panel-300m.png':'EWlyr.png','components.png':'MeFgF.png','presets.png':'bBKBy.png',
 'states.png':'NUGgl.png','formats.png':'S9VIn.png','confirmation.png':'ZITQn.png','library.png':'overview/pNJ2b.png'
};
for(const [to,from]of Object.entries(images))await copyFile(path.join(root,'docs/design/extron-kit/previews/apple-light-2026-10-24',from),path.join(dist,'assets',to));
const manifest=JSON.parse(await readFile(path.join(root,'docs/design/extron-kit/av-patterns-2026-10-24.snapshot.json'),'utf8'));
for(const [key,id]of Object.entries(manifest.panels)){
 const [profile,name]=key.split('/'),suffix=profile==='tlp-pro-1025m'?'1025m':'300m';
 await copyFile(path.join(root,'docs/design/extron-kit/previews/av-patterns-2026-10-24',id+'.png'),path.join(dist,'assets',`pattern-${name}-${suffix}.png`));
}
await mkdir(path.join(dist,'assets/icons'),{recursive:true});
const iconZip={};
for(const {name,svg}of icons.icons){
 const bytes=new TextEncoder().encode(svg);iconZip[name+'.svg']=bytes;await writeFile(path.join(dist,'assets/icons',name+'.svg'),bytes);
}
iconZip['LICENSE']=new Uint8Array(await readFile(path.join(root,'docs/design/extron-kit/icons/LICENSE')));
const {zipSync}=createRequire(path.join(root,'src/figma-plugin/package.json'))('fflate');
await writeFile(path.join(dist,'assets/av-icons.zip'),zipSync(iconZip,{level:6,mtime:new Date(2000,0,1)}));
await copyFile(path.join(root,'docs/design/extron-kit/RESEARCH-2026-10-24.md'),path.join(dist,'assets/kit-research.md'));
await copyFile(path.join(root,`releases/figma-plugin/${pkg.version}/figma-extron-plugin-${pkg.version}.zip`),path.join(dist,'assets/extron-kit-plugin.zip'));
await copyFile(path.join(root,`releases/cli/${pkg.compatibleCliVersion}/figma-extron-cli-${pkg.compatibleCliVersion}-windows.zip`),path.join(dist,'assets/extron-cli.zip'));
for(const file of ['figma-extron-prefix-cheatsheet.pdf','figma-extron-use-cases.pdf'])await copyFile(path.join(root,'docs/prefix_map',file),path.join(dist,'assets',file));
for(const [from,to]of [['docs/cli-setup.md','cli-setup.md'],['docs/updating-configured-projects.md','updating-configured-projects.md'],['src/figma-plugin/NATIVE_TEXT.md','native-text.md']])await copyFile(path.join(root,from),path.join(dist,'assets',to));
await copyFile(path.join(root,'src/figma-plugin/EXTRON_KIT.md'),path.join(dist,'assets/extron-kit-guide.md'));
console.log('Site built: '+dist);
