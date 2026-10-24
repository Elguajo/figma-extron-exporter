import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../output/sites/extron-kit-docs/dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.zip':'application/zip','.md':'text/markdown; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),relative=decodeURIComponent(url.pathname),file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}await stat(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end('Not found');}});
server.listen(Number(process.env.PORT??4318),'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port));
