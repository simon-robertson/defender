import {mkdir,mkdtemp,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {renderRecipe,encodeWav,readWav,analyse} from './pcm.js';
import {reviewPage,validateReview} from './review.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),outputRoot=join(root,'build/audio');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function run(command){
 const result=Bun.spawnSync(command,{stdout:'pipe',stderr:'pipe'}),stdout=result.stdout.toString(),stderr=result.stderr.toString();
 if(result.exitCode!==0)throw new Error(`${command[0]} failed: ${stderr||stdout||result.error||result.exitCode}`);
 return {stdout,stderr};
}
export function doctor(){
 const tools={};
 for(const [name,flag]of [['opusenc','--version'],['opusdec','--version'],['opusinfo','-V']]){
  const path=Bun.which(name);if(!path)throw new Error(`${name} is missing; install outside this repository with: brew install opus-tools`);
  const result=run([path,flag]);tools[name]={path,version:(result.stdout+result.stderr).trim()};
 }
 return tools;
}
export async function buildAudio(recipePath=join(root,'audio/diagnostics.json'),{wavOnly=false,publishLatest=true}={}){
 const recipeBytes=await readFile(recipePath),bundle=JSON.parse(recipeBytes);
 if(bundle.version!==1||Object.keys(bundle).some(k=>!['version','recipes','review'].includes(k))||!Array.isArray(bundle.recipes)||!bundle.recipes.length||bundle.recipes.length>32)throw new Error('Expected version 1 bundle with 1..32 recipes');
 if(new Set(bundle.recipes.map(r=>r.id)).size!==bundle.recipes.length)throw new Error('Duplicate recipe ids');
 validateReview(bundle.review,bundle.recipes);
 const tools=wavOnly?null:doctor();await mkdir(outputRoot,{recursive:true});
 const staging=await mkdtemp(join(outputRoot,'.staging-'));
 try{
  for(const folder of ['masters','delivery','decoded'])await mkdir(join(staging,folder));
  const entries=[];
  for(const recipe of bundle.recipes){
   const {samples,analysis}=renderRecipe(recipe),wav=encodeWav(samples,recipe.sampleRate,recipe.channels),recipeHash=hash(JSON.stringify(recipe));
   const paths={master:`masters/${recipe.id}.wav`};await writeFile(join(staging,paths.master),wav);
   const files={master:{sha256:hash(wav),bytes:wav.length}},entry={recipe,recipeHash,paths,files,analysis,decodedAnalysis:null};
   if(tools){
    paths.ogg=`delivery/${recipe.id}.ogg`;paths.decoded=`decoded/${recipe.id}.wav`;
    // Fixed serial + recorded flags/tool versions make regeneration inspectable.
    const flags=['--bitrate','80','--vbr','--comp','10','--framesize','20','--serial',String(parseInt(recipeHash.slice(0,8),16))];
    entry.encoding={flags};entry.encoding.log=run([tools.opusenc.path,...flags,join(staging,paths.master),join(staging,paths.ogg)]);
    entry.inspection=run([tools.opusinfo.path,join(staging,paths.ogg)]);
    if(/WARNING|ERROR/.test(entry.inspection.stdout+entry.inspection.stderr))throw new Error(`${recipe.id}: opusinfo reported a stream warning`);
    run([tools.opusdec.path,'--quiet','--float',join(staging,paths.ogg),join(staging,paths.decoded)]);
    const ogg=await readFile(join(staging,paths.ogg)),decodedBytes=await readFile(join(staging,paths.decoded)),decoded=readWav(decodedBytes);
    if(ogg.toString('ascii',0,4)!=='OggS'||!ogg.includes(Buffer.from('OpusHead')))throw new Error('Encoder did not produce Ogg Opus');
    if(decoded.sampleRate!==recipe.sampleRate||decoded.channels!==recipe.channels||decoded.frames!==analysis.frames)throw new Error(`${recipe.id}: decoded shape does not match master`);
    entry.decodedAnalysis=analyse(decoded.samples,decoded.channels,recipe.loop);
    let squared=0;for(let i=0;i<samples.length;i++)squared+=(samples[i]-decoded.samples[i])**2;
    entry.decodedAnalysis.errorRms=Math.sqrt(squared/samples.length);
    files.ogg={sha256:hash(ogg),bytes:ogg.length};files.decoded={sha256:hash(decodedBytes),bytes:decodedBytes.length};
   }
   const waveform=new Array(512).fill(0);for(let i=0;i<samples.length;i++){const bin=Math.min(511,Math.floor(i/samples.length*512));waveform[bin]=Math.max(waveform[bin],Math.abs(samples[i]));}
   entries.push({...entry,waveform});
  }
  const sources={};for(const file of ['pcm.js','dsp.js','build.js','review.js','review-player.js'])sources[file]=hash(await readFile(new URL(file,import.meta.url)));
  const manifest={version:1,pipelineVersion:1,sources,review:bundle.review,createdAt:new Date().toISOString(),recipeFile:relative(root,resolve(recipePath)),recipeSha256:hash(recipeBytes),tools,entries};
  await writeFile(join(staging,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(staging,'recipes.json'),recipeBytes);await writeFile(join(staging,'review.html'),reviewPage(entries,bundle.review));
  const name=new Date().toISOString().replace(/[:.]/g,'-')+'-'+staging.slice(-6),output=join(outputRoot,name);await rename(staging,output);
  if(publishLatest){const pointer=join(outputRoot,`.latest-${name}.tmp`);await writeFile(pointer,JSON.stringify({directory:name})+'\n');await rename(pointer,join(outputRoot,'latest.json'));}
  return {output,manifest};
 }catch(error){await rm(staging,{recursive:true,force:true});throw error;}
}
export async function serveReview(port=4292,directory){
 if(!directory)({directory}=JSON.parse(await readFile(join(outputRoot,'latest.json'),'utf8')));
 if(!/^[a-zA-Z0-9-]+$/.test(directory))throw new Error('Invalid review directory');
 const base=join(outputRoot,directory);
 return Bun.serve({hostname:'127.0.0.1',port,async fetch(request){
  const path=new URL(request.url).pathname;
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const name=path==='/'?'review.html':path.slice(1);
  if(!/^(review\.html|manifest\.json|recipes\.json|(masters|delivery|decoded)\/[a-z][a-z0-9-]{0,63}\.(wav|ogg))$/.test(name))return new Response('Not found',{status:404});
  const file=Bun.file(join(base,name));if(!await file.exists())return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:file,{headers:{'Content-Type':name.endsWith('.wav')?'audio/wav':name.endsWith('.ogg')?'audio/ogg':name.endsWith('.json')?'application/json':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }});
}
if(import.meta.main){
 try{
  const [command='build',...args]=process.argv.slice(2);
  if(command==='doctor'){if(args.length)throw new Error('doctor takes no arguments');console.log(JSON.stringify(doctor(),null,2));}
  else if(command==='build'){
   let recipePath,wavOnly=false;for(let i=0;i<args.length;i++){if(args[i]==='--wav-only')wavOnly=true;else if(args[i]==='--recipes'&&args[i+1])recipePath=resolve(args[++i]);else throw new Error(`Unknown/incomplete argument ${args[i]}`);}
   const result=await buildAudio(recipePath,{wavOnly});console.log(`Built ${result.manifest.entries.length} diagnostic/recipe sounds: ${result.output}\nAudition: bun run audio:preview`);
  }else if(command==='preview'){if(args.length)throw new Error('preview takes no arguments');const server=await serveReview(Number(process.env.AUDIO_PORT||4292));console.log(`Audio review: ${server.url}`);}
  else throw new Error('Usage: bun scripts/audio/build.js doctor|build [--recipes file] [--wav-only]|preview');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
