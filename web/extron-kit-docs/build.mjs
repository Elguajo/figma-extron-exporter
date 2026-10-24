import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DATETIME_FORMATS,formatDateTime} from '../../src/figma-plugin/src/datetime-format.ts';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../..');
const target=path.join(root,'output/sites/extron-kit-docs');
const dist=path.join(target,'dist');
await mkdir(path.join(dist,'assets'),{recursive:true});
await mkdir(path.join(target,'.openai'),{recursive:true});
await copyFile(path.join(dir,'.openai/hosting.json'),path.join(target,'.openai/hosting.json'));
await mkdir(path.join(dist,'assets/fonts'),{recursive:true});
for(const file of ['Inter-Regular.woff2','Inter-Bold.woff2','LICENSE.txt'])await copyFile(path.join(dir,'assets/fonts',file),path.join(dist,'assets/fonts',file));
for(const file of ['index.html','styles.css','app.js'])await copyFile(path.join(dir,file),path.join(dist,file));
const catalog=JSON.parse(await readFile(path.join(root,'design/extron-kit/kit.json'),'utf8'));
const data={...catalog,pluginVersion:'0.7.3',cliVersion:'0.7.3',formats:DATETIME_FORMATS.map(f=>({...f,preview:formatDateTime(f.pattern)}))};
await writeFile(path.join(dist,'kit-data.js'),'window.KIT_DATA='+JSON.stringify(data).replace(/</g,'\\u003c')+';\n');
const images={
 'panel-1025m.png':'T78n4.png','panel-300m.png':'EWlyr.png','components.png':'MeFgF.png','presets.png':'bBKBy.png',
 'states.png':'NUGgl.png','formats.png':'S9VIn.png','confirmation.png':'ZITQn.png','library.png':'overview/pNJ2b.png'
};
for(const [to,from]of Object.entries(images))await copyFile(path.join(root,'design/extron-kit/previews/apple-light-2026-10-24',from),path.join(dist,'assets',to));
await copyFile(path.join(root,'output/apple-kit-2026-10-24/figma-extron-plugin-0.7.3-apple-light-2026-10-24.zip'),path.join(dist,'assets/extron-kit-plugin.zip'));
await copyFile(path.join(root,'src/figma-plugin/EXTRON_KIT.md'),path.join(dist,'assets/extron-kit-guide.md'));
console.log('Site built: '+dist);
