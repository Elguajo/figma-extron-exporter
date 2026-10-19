// ZIP/download flow adapted from Baolv/figma-export ui.html (6312d15).
// Root entries, deterministic metadata, SHA-256 and .exui limits are our contract.
import { zipSync, strToU8, type Zippable } from 'fflate';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { fail, type Bundle } from './model.ts';

export function packageExui(bundle:Bundle):Uint8Array {
  if(!bundle || !['tlp-pro-1025m','tlp-pro-300m-portrait'].includes(bundle.profile) || bundle.screen.schema!=='exui-screen/1') fail('package','Неизвестный профиль или контракт.');
  const resources=[...bundle.resources].sort((a,b)=>a.path.localeCompare(b.path,'en'));
  if(resources.length>16||new Set(resources.map(r=>r.path)).size!==resources.length) fail('package','Лимит ресурсов или повтор PNG пути.');
  const declared=new Set(bundle.screen.assets.map(a=>a.file));
  if(declared.size!==resources.length||resources.some(r=>!declared.has(r.path))) fail('package','Ресурсы не совпадают с assets.');
  const files:Zippable={};
  const manifest={schema:'exui/1',profile:bundle.profile,screen:'screen.json',resources:resources.map(r=>({path:r.path,sha256:bytesToHex(sha256(r.bytes)).toUpperCase()}))};
  const manifestBytes=strToU8(JSON.stringify(manifest,null,2)+'\n'), screenBytes=strToU8(JSON.stringify(bundle.screen,null,2)+'\n');
  if(manifestBytes.length>64*1024||screenBytes.length>256*1024) fail('package-size','Превышен размер JSON.');
  files['manifest.json']=manifestBytes;files['screen.json']=screenBytes;
  let total=manifestBytes.length+screenBytes.length;
  for(const resource of resources) {
    if(!/^assets\/[a-z0-9][a-z0-9-]{0,63}\.png$/.test(resource.path)||/[\r\n]/.test(resource.path)) fail('package','Недопустимый PNG путь.');
    const bytes=new Uint8Array(resource.bytes);
    if(bytes.length<33||bytes.length>4*1024*1024||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) fail('package-image',`${resource.path}: недопустимый PNG.`);
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(view.getUint32(16)<1||view.getUint32(16)>4096||view.getUint32(20)<1||view.getUint32(20)>4096) fail('package-image','PNG больше 4096 px.');
    total+=bytes.length;files[resource.path]=[bytes,{level:0}];
  }
  if(total>16*1024*1024) fail('package-size','Распакованный пакет больше 16 MiB.');
  const zip=zipSync(files,{level:6,mtime:new Date(2000,0,1)});
  if(zip.length>20*1024*1024) fail('package-size','Пакет больше 20 MiB.');
  return zip;
}
