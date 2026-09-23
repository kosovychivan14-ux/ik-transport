import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import {createLiveService} from './server/live-service.mjs';
const handleLive=createLiveService();
const root = resolve('dist');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2', '.json':'application/json', '.mp4':'video/mp4', '.wasm':'application/wasm', '.pdf':'application/pdf' };
createServer(async (req,res) => {
  try {
    const requestUrl=new URL(req.url,'http://localhost');
    if(requestUrl.pathname==='/live-config.js'){
      res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
      return res.end("export const LIVE_API_ORIGIN='';\n");
    }
    if(requestUrl.pathname.startsWith('/api/live/')){
      let length=0;const chunks=[];
      for await (const chunk of req){length+=chunk.length;if(length>24000){res.writeHead(413);return res.end();}chunks.push(chunk);}
      const response=await handleLive(new Request(requestUrl,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}));
      res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
    }
    const path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type':types[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(Number(process.env.PORT)||4173,process.env.HOST||'127.0.0.1',() => console.log('Webinar server ready'));
