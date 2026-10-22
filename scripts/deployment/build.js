// Output-only static packaging. Run with Bun; no external dependencies.
import {readFile,writeFile,mkdir,lstat,rm,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {PLAY_CONFIG} from '../../play/config.js';
import {playSceneCapacity,composePlayLevel} from '../../play/engine.js';
import {wildlifeActorsForLevel} from '../../game/wildlife-preview.js';
import {createMissileActors} from '../../game/missile-preview.js';
import {FISH_MODEL,hasFishWater} from '../../shared/fish-habitat.js';
import {AUDIO_ASSETS} from '../../shared/audio-assets.js';
import {gatherAudioAssets} from './audio.js';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const digest=data=>createHash('sha256').update(data).digest('hex');
const owner='defender-static-deployer',version=1,manifestPath='build/deployment/manifest.json';
const scanner=new Bun.Transpiler({loader:'js'});
function replace(text,from,to){if(!text.includes(from))throw new Error('Packaging boundary changed: '+from.slice(0,100));return text.replace(from,to);}
function cut(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);if(a<0||b<0)throw new Error('Packaging block changed: '+start);return text.slice(0,a)+text.slice(b);}
export function productionSource(file,source){
 let s=source;
 if(file==='play/app.js'){
  // Footer performance data is approved player UI, including its GPU sampler.
  s=replace(s,',lastDiagnostics=-Infinity,diagnosticsPending=false','');
  s=cut(s,'// Keep the review dataset available by default.','function fail(');
  s=s.replace(/diagnostics\([^;]*\);/g,'');
  s=replace(s,'else if(diagnosticsPending)','');
  s=replace(s,"renderer.inspect=new URLSearchParams(location.search).has('inspect');",'');
 }
 if(file==='play/engine.js'){
  s=replace(s,'fetch(`/api/${kind}/${key}`,{signal,cache:\'no-store\'})','fetch(new URL(`../assets/${kind}/${key}.json`,import.meta.url),{signal})');
  s=replace(s,'return (await response.json()).asset;','return await response.json();');
 }
 if(file==='engine/world.js')s=cut(s,'export async function loadWorld(','export function disposeWorld(');
 if(file==='engine/renderer.js'){
  s=replace(s,'render(deltaSeconds,elapsedSeconds,inspectFrame=true)','render(deltaSeconds,elapsedSeconds)');
  s=replace(s,'this.draw(inspectFrame);','this.draw();');
  s=replace(s,'draw(inspectFrame=true)','draw()');
  s=s.split('\n').filter(line=>!line.includes('if(this.inspect&&inspectFrame)')&&!line.includes('delete this.canvas.dataset.inspection;')).join('\n');
 }
 if(file==='engine/camera.js')s=s.split('\n').filter(line=>!line.includes("listen(canvas.ownerDocument??canvas,'keydown'")).join('\n');
 if(file==='engine/drone-obstacles.js')s=s.split('\n').filter(line=>!line.startsWith(' inspect(){')).join('\n');
 if(file==='game/fish-preview.js')s=s.split('\n').filter(line=>!line.startsWith(' stats(){')).join('\n');
 if(file==='engine/generator-lights.js')s=s.split('\n').filter(line=>!line.includes('console.warn(')).join('\n');
 if(file==='engine/model-lights.js')s=replace(s,'console.warn(message);','');
 return s;
}
export async function gather(){
 const outputs=new Map(),inputs=new Map();
 async function input(file){const data=await readFile(path.join(ROOT,file));inputs.set(file,digest(data));return data;}
 function add(file,data,source,transformation){outputs.set(file,{data:Buffer.from(data),source,transformation});}
 async function module(file){
  if(outputs.has('docs/site/'+file))return;
  const original=await input(file),s=productionSource(file,original.toString());
  scanner.transformSync(s); // Parse every transformed module before any writes.
  add('docs/site/'+file,s,file,s===original.toString()?'verbatim':'production boundary adaptation');
  for(const dependency of scanner.scanImports(s)){
   if(!['import-statement','dynamic-import'].includes(dependency.kind))throw new Error('Unsupported resource '+file+': '+dependency.path);
   if(!dependency.path.startsWith('.'))throw new Error('Nonlocal dependency: '+dependency.path);
   const next=path.posix.normalize(path.posix.join(path.posix.dirname(file),dependency.path));
   if(!/^(play|game|engine|shared)\/.+\.js$/.test(next))throw new Error('Unowned module: '+next);
   await module(next);
  }
  // No nonliteral imports or unaccounted runtime resource mechanisms allowed.
  if((s.match(/\bimport\s*\(/g)||[]).length!==scanner.scanImports(s).filter(d=>d.kind==='dynamic-import').length)throw new Error('Unresolved dynamic import: '+file);
  if(/\bfetch\s*\(/.test(s)&&!['play/engine.js','play/audio.js'].includes(file))throw new Error('Unaccounted fetch: '+file);
  if(/new\s+(?:Worker|Image|Audio)\b|\.src\s*=|new\s+URL\s*\(/.test(s)&&!['play/engine.js','play/ui.js','shared/audio-assets.js'].includes(file))throw new Error('Unaccounted resource: '+file);
 }
 await module('play/app.js');
 const audio=await gatherAudioAssets(AUDIO_ASSETS,input);
 for(const file of audio)add('docs/site/'+file.source,file.data,file.source,'manifest-owned mono delivery audio');
 const levels=PLAY_CONFIG.levels.map(l=>l.id),models=new Set();
 for(const id of levels){
  const file=`assets/levels/${id}.json`,raw=await input(file),level=composePlayLevel(JSON.parse(raw));
  if(level.id!==id)throw new Error('Level identity mismatch');
  add('docs/site/'+file,raw,file,'verbatim');
  for(const p of level.placements)models.add(p.model);
  for(const model of Object.keys(playSceneCapacity(PLAY_CONFIG,id).maxWaveEnemiesBySpecies))models.add(model);
  for(const actor of [...createMissileActors(),...wildlifeActorsForLevel(level)])models.add(actor.model);
  for(const model of Object.keys(PLAY_CONFIG.defences))models.add(model);
  if(hasFishWater(level))models.add(FISH_MODEL);
 }
 for(const id of [...models].sort()){
  const file=`assets/models/${id}.json`,raw=await input(file);
  if(JSON.parse(raw).id!==id)throw new Error('Model identity mismatch');
  add('docs/site/'+file,raw,file,'verbatim');
 }
 let html=(await input('play/index.html')).toString();
 add('docs/index.html',html.replaceAll('/play/style.css','./site/play/style.css').replaceAll('/play/app.js','./site/play/app.js'),'play/index.html','relative entry URLs; preserve performance HUD');
 add('docs/site/play/index.html',html.replaceAll('/play/style.css','./style.css').replaceAll('/play/app.js','./app.js'),'play/index.html','relative entry URLs; preserve performance HUD');
 const css=(await input('play/style.css')).toString();
 if(/url\s*\(|@import/.test(css))throw new Error('Unaccounted CSS resource');
 add('docs/site/play/style.css',css,'play/style.css','verbatim; preserve performance HUD styles');
 const forbidden=/\/api\/|localhost|127\.0\.0\.1|dataset\.(?:play|inspection|firing)|diagnosticsPending|\?inspect|console\.(?:log|debug|info|warn)|defenderPreview/;
 for(const [file,{data}]of outputs)if(/\.(?:js|html|css)$/.test(file)&&forbidden.test(data.toString()))throw new Error('Production boundary leak: '+file+' '+data.toString().match(forbidden)[0]);
 // Include build recipe identity as well as every transitive source/asset.
 for(const recipe of ['scripts/deployment/build.js','scripts/deployment/audio.js','scripts/deployment/serve.js','scripts/deployment/validate.js','package.json'])await input(recipe);
 return {outputs,inputs,levels,audio:audio.map(file=>file.source),models:[...models].sort()};
}
async function noSymlinks(file,root=ROOT){let current=root;for(const segment of file.split('/')){current=path.join(current,segment);try{if((await lstat(current)).isSymbolicLink())throw new Error('Symlink in output: '+current);}catch(e){if(e.code!=='ENOENT')throw e;}}}
export async function preflight(outputs,previous,root=ROOT){
 if(previous&&(previous.owner!==owner||previous.version!==version))throw new Error('Unknown deployment manifest owner/version');
 const owned=new Map(previous?.files.map(f=>[f.path,f])??[]);
 // Preflight all collisions/stale paths before touching any output.
 for(const file of new Set([...outputs.keys(),...owned.keys(),manifestPath])){
  if(file!==manifestPath&&file!=='docs/index.html'&&!file.startsWith('docs/site/'))throw new Error('Unsafe owned path: '+file);
  if(path.posix.normalize(file)!==file)throw new Error('Unsafe owned path: '+file);
  await noSymlinks(file,root);
  if(file===manifestPath)continue;
  try{const actual=digest(await readFile(path.join(root,file))),expected=owned.get(file)?.sha256;if(actual!==expected)throw new Error('Preserving unowned or edited output: '+file);}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 return owned;
}
export async function build(){
 const gathered=await gather(),{outputs,inputs,levels,models,audio}=gathered;
 await noSymlinks('docs');
 await noSymlinks(manifestPath);
 await mkdir(path.join(ROOT,'build/deployment'),{recursive:true});
 for(const [file,hash]of inputs)if(digest(await readFile(path.join(ROOT,file)))!==hash)throw new Error('Input changed during build: '+file);
 const files=[...outputs].sort(([a],[b])=>a.localeCompare(b)).map(([file,v])=>({path:file,source:v.source,sourceSha256:inputs.get(v.source),transformation:v.transformation,size:v.data.length,sha256:digest(v.data)}));
 const manifest={owner,version,generatedAt:new Date().toISOString(),entry:'index.html',directEntry:'site/play/index.html',documentRoot:'docs',siteBase:'relative to entry/module; domain root or arbitrary project prefix',inputIdentity:{algorithm:'sha256',revision:null,reason:'workspace has no Git metadata',sha256:digest(JSON.stringify([...inputs].sort())),files:Object.fromEntries([...inputs].sort())},counts:{files:files.length,modules:files.filter(f=>f.path.endsWith('.js')).length,levels:levels.length,models:models.length,audio:audio.length,bytes:files.reduce((n,f)=>n+f.size,0)},levels,models,audio,omissions:['authoring server/APIs, editors and review entry points','inspector datasets/query switch and preview F shortcut','unused development world loader and diagnostic console warnings'],preserved:['bottom-bar FPS/frame/CPU/GPU readout and asynchronous GPU timing'],validation:{moduleSyntax:'passed',moduleClosure:'passed',assetClosure:'passed',productionBoundary:'passed',separateTests:'not requested or run'},files};
 const pending=path.join(ROOT,'build/deployment/pending.json');
 try{await lstat(pending);throw new Error('Unfinished deployment journal exists; inspect before refreshing');}catch(e){if(e.code!=='ENOENT')throw e;}
 await writeFile(pending,JSON.stringify({owner,files},null,2)+'\n',{flag:'wx'});
 // docs/ is exclusively generated hosting output; start each deployment clean.
 await rm(path.join(ROOT,'docs'),{recursive:true,force:true});
 for(const [file,v]of outputs){await mkdir(path.dirname(path.join(ROOT,file)),{recursive:true});await writeFile(path.join(ROOT,file),v.data);}
 for(const f of files)if(digest(await readFile(path.join(ROOT,f.path)))!==f.sha256)throw new Error('Output validation failed: '+f.path);
 await writeFile(path.join(ROOT,manifestPath+'.tmp'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 await rename(path.join(ROOT,manifestPath+'.tmp'),path.join(ROOT,manifestPath));await rm(pending);
 return manifest;
}
if(import.meta.main){const manifest=await build();console.log(JSON.stringify({entry:manifest.documentRoot+'/'+manifest.entry,...manifest.counts,inputIdentity:manifest.inputIdentity.sha256},null,2));}
