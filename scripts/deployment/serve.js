// A static-only fixture: deliberately no development API or source fallback.
import {stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from './build.js';
import {audioMimeType} from '../../shared/audio-assets.js';
export function staticServer({port=4287,onRequest=()=>{}}={}){
 const root=path.join(ROOT,'docs');
 return Bun.serve({hostname:'127.0.0.1',port,async fetch(request){
  const url=new URL(request.url);let pathname;
  try{pathname=decodeURIComponent(url.pathname);}catch{return new Response('Bad path',{status:400});}
  if(pathname==='/favicon.ico')return new Response(null,{status:204});
  if(pathname==='/defender')return Response.redirect(new URL('/defender/',url),301);
  const relative=pathname.startsWith('/defender/')?pathname.slice('/defender/'.length):pathname.slice(1);
  // Expose only manifest-owned runtime, never the existing documentation.
  if(relative!==''&&relative!=='index.html'&&!relative.startsWith('site/'))return new Response('Not found',{status:404});
  let file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep))return new Response('Not found',{status:404});
  try{
   if((await stat(file)).isDirectory()){
    if(!pathname.endsWith('/'))return Response.redirect(new URL(pathname+'/',url),301);
    file=path.join(file,'index.html');
   }
   const resolved=await realpath(file);if(!resolved.startsWith(root+path.sep))throw new Error('Outside root');
   const data=Bun.file(file);if(!await data.exists())throw new Error('Missing');
   onRequest({path:url.pathname,status:200});return new Response(data,{headers:{'Cache-Control':'no-store',...(/\.(ogg|wav)$/.test(file)?{'Content-Type':audioMimeType(file)}:{})}});
  }catch{onRequest({path:url.pathname,status:404});return new Response('Not found',{status:404});}
 }});
}
if(import.meta.main){const server=staticServer({onRequest:entry=>console.log(JSON.stringify(entry))});console.log('Static delivery: '+server.url);}
