import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {runInNewContext} from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dist=path.join(root,'output/sites/extron-kit-docs/dist');
const catalog=JSON.parse(await readFile(path.join(root,'design/extron-kit/kit.json'),'utf8'));
const context={window:{}};
runInNewContext(await readFile(path.join(dist,'kit-data.js'),'utf8'),context);
const data=context.window.KIT_DATA;
assert.deepEqual(JSON.parse(JSON.stringify(data.controls)),catalog.controls);
assert.equal(data.revision,catalog.revision);
assert.equal(data.formats.length,28);
assert.equal(new Set(data.formats.map(f=>f.pattern)).size,28);
const html=await readFile(path.join(dist,'index.html'),'utf8');
const js=await readFile(path.join(dist,'app.js'),'utf8');
const css=await readFile(path.join(dist,'styles.css'),'utf8');
const assets=new Set([...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1]));
for(const match of js.matchAll(/(?:assets\/)?[\w-]+\.(?:png|zip|md)/g))assets.add(match[0].startsWith('assets/')?match[0]:'assets/'+match[0]);
// Panel names are assembled dynamically by the profile tabs.
assets.add('assets/panel-1025m.png');assets.add('assets/panel-300m.png');
for(const m of css.matchAll(/url\(([^)]+)\)/g))assets.add(m[1]);
for(const asset of assets){assert.ok(!asset.includes('..'));assert.ok((await readFile(path.join(dist,asset))).length>0,asset);}
for(const name of ['Inter-Regular.woff2','Inter-Bold.woff2'])assert.equal((await readFile(path.join(dist,'assets/fonts',name))).subarray(0,4).toString(),'wOF2');
const zip=await readFile(path.join(dist,'assets/extron-kit-plugin.zip'));
assert.equal(zip.readUInt32LE(0),0x04034b50);
const sourceZip=await readFile(path.join(root,'output/av-patterns-2026-10-24/figma-extron-plugin-0.7.3-av-patterns-2026-10-24.zip'));
assert.equal(createHash('sha256').update(zip).digest('hex'),createHash('sha256').update(sourceZip).digest('hex'));
console.log(`PASS: catalog source parity, 28 formats, ${assets.size} asset links, licensed WOFF2 and exact plugin download`);
assert.equal(data.patterns.length,6);assert.equal(data.icons.length,18);
for(const p of data.patterns)for(const [profile,w,h]of [['1025m',1280,800],['300m',320,480]]){
 const png=await readFile(path.join(dist,'assets',`pattern-${p.id}-${profile}.png`));assert.equal(png.readUInt32BE(16),w);assert.equal(png.readUInt32BE(20),h);
}
for(const i of data.icons)assert.match(await readFile(path.join(dist,'assets/icons',i.name+'.svg'),'utf8'),/<svg/);
assert.ok((await readFile(path.join(dist,'assets/av-icons.zip'))).length>0);
console.log('PASS: 6 scenarios, 12 native-size real PNGs and 18 SVG downloads');

const server=spawn(process.execPath,[path.join(root,'web/extron-kit-docs/serve.mjs')],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
try{
 const [line]=await once(server.stdout,'data',{signal:AbortSignal.timeout(10000)});
 const url=String(line).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];assert.ok(url,'preview server announces its bound port');
 for(const [asset,type]of [['icons/power.svg','image/svg+xml'],['fonts/Inter-Regular.woff2','font/woff2']]){
  const response=await fetch(url+'/assets/'+asset);assert.equal(response.status,200);assert.ok(response.headers.get('content-type').startsWith(type));await response.arrayBuffer();
 }
 console.log('PASS: preview serves SVG and WOFF2 with browser-compatible MIME types');
}finally{const closed=once(server,'exit');server.kill();await closed;}
