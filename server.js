import {mkdir,readFile,readdir,rename} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {canonicalModel,upgradeModel} from './shared/model.js';
import {validateLevel,upgradeLevel} from './shared/level.js';
import {serveDocs,PUBLIC_CSP} from './server/docs.js';
import {cameraStudyStore} from './server/camera-study.js';
import {audioResponder} from './server/audio.js';

const root=import.meta.dir, assetRoot=process.env.DEFENDER_ASSET_ROOT || join(root,'assets');
const serveAudio=audioResponder(assetRoot);
const docsRoot=process.env.DEFENDER_DOCS_ROOT || join(root,'project-docs');
const cameraStudy=cameraStudyStore(join(docsRoot,'drone-camera-study','shots'));
for(const kind of ['models','levels'])await mkdir(join(assetRoot,kind),{recursive:true});
const revision=text=>createHash('sha256').update(text).digest('hex');
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const locks=new Set();
async function load(kind,id){const text=await readFile(join(assetRoot,kind,`${id}.json`),'utf8');const source=JSON.parse(text),asset=kind==='models'?upgradeModel(source):upgradeLevel(source);return {asset,revision:revision(text),migrated:asset.version!==source.version};}
async function modelMap(){const map=new Map();for(const file of await readdir(join(assetRoot,'models')))if(file.endsWith('.json')){const {asset}=await load('models',file.slice(0,-5));map.set(asset.id,canonicalModel(asset));}return map;}
export const server=Bun.serve({hostname:'127.0.0.1',port:Number(process.env.PORT||4173),maxRequestBodySize:8*1024*1024,
  async fetch(request){
    const url=new URL(request.url);const api=url.pathname.match(/^\/api\/(models|levels)(?:\/([a-z][a-z0-9-]{0,63}))?$/);
    if(!['127.0.0.1','localhost'].includes(url.hostname))return json({error:'Localhost only.'},403);
    try {
      const study=await cameraStudy(request);if(study)return study;
      if(api){
        const [,kind,id]=api;
        if(request.method==='GET'){
          if(id)return json(await load(kind,id));
          const items=[];for(const file of (await readdir(join(assetRoot,kind))).sort())if(file.endsWith('.json')){const item=await load(kind,file.slice(0,-5));items.push({id:item.asset.id,name:item.asset.name,revision:item.revision});}return json(items);
        }
        if(request.method==='PUT'&&id){
          const origin=request.headers.get('origin');if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Same-origin requests only.'},403);
          if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Use application/json.'},415);
          const body=await request.json();if(body.asset?.id!==id)return json({error:'Asset ID and URL must match.'},400);
          // Serialize saves across both kinds so reference validation and the write
          // observe one consistent library, including model changes affecting levels.
          const key='library';if(locks.has(key))return json({error:'Another save is in progress. Retry.'},409);locks.add(key);
          try{
            const models=await modelMap();
            const asset=kind==='models'?canonicalModel(upgradeModel(body.asset)):validateLevel(upgradeLevel(body.asset),models);
            if(kind==='models'){
              models.set(id,asset);
              for(const file of await readdir(join(assetRoot,'levels')))if(file.endsWith('.json')){
                const {asset:level}=await load('levels',file.slice(0,-5));
                if(level.placements.some(p=>p.model===id))try{validateLevel(level,models);}catch(error){throw new Error(`This model change invalidates level ${level.id}: ${error.message}`);}
              }
            }
            let current=null;try{current=await load(kind,id);}catch(error){if(error.code!=='ENOENT')throw error;}
            if((body.revision??null)!==(current?.revision??null))return json({error:'This file changed on disk. Reload it before saving, or save with a new ID.'},409);
            const text=JSON.stringify(asset,null,2)+'\n',destination=join(assetRoot,kind,`${id}.json`),temp=destination+'.tmp';
            await Bun.write(temp,text);await rename(temp,destination);return json({revision:revision(text),asset});
          }finally{locks.delete(key);}
        }
        return json({error:'Method not allowed.'},405);
      }
      if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
      const pathname=decodeURIComponent(url.pathname),relative=pathname==='/'?'tools/index.html':/^\/(game|play)\/?$/.test(pathname)?pathname.split('/')[1]+'/index.html':pathname.slice(1);
      const audio=await serveAudio(request,pathname);if(audio)return audio;
      const document=await serveDocs(request,pathname,docsRoot,root);if(document)return document;
      if(!/^(tools|shared|engine|game|play)\//.test(relative))return new Response('Not found',{status:404});
      const filePath=resolve(root,relative);
      if(!['tools','shared','engine','game','play'].some(dir=>filePath.startsWith(join(root,dir)+'/')))return new Response('Not found',{status:404});
      if(!['.html','.js','.css'].includes(extname(filePath)))return new Response('Not found',{status:404});
      const file=Bun.file(filePath);if(!await file.exists())return new Response('Not found',{status:404});
      return new Response(file,{headers:{'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':PUBLIC_CSP}});
    }catch(error){return json({error:error.code==='ENOENT'?'Asset not found.':error.message},error.code==='ENOENT'?404:400);}
  }
});
console.log(`Defender Workshop: http://127.0.0.1:${server.port}`);
