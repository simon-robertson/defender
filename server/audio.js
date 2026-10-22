import {realpath} from 'node:fs/promises';
import {join,sep} from 'node:path';
import {AUDIO_ASSETS,validateAudioAssets,audioMimeType} from '../shared/audio-assets.js';
export function audioResponder(assetRoot,assets=AUDIO_ASSETS){
 validateAudioAssets(assets);const files=new Set();for(const asset of assets){files.add(asset.file);if(asset.fallback)files.add(asset.fallback);}
 return async function serveAudio(request,pathname){
  if(!pathname.startsWith('/assets/audio/'))return null;
  const name=pathname.slice('/assets/audio/'.length);if(!files.has(name))return new Response('Not found',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  try{const directory=await realpath(join(assetRoot,'audio')),path=await realpath(join(directory,name));if(!path.startsWith(directory+sep))return new Response('Not found',{status:404});
   const file=Bun.file(path);return new Response(request.method==='HEAD'?null:file,{headers:{'Content-Type':audioMimeType(name),'Content-Length':String(file.size),'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
  }catch(error){if(error.code==='ENOENT')return new Response('Not found',{status:404});throw error;}
 };
}
