import {mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateStudyShot(body){
 const c=body?.camera,s=body?.scene;
 if(!c||!Array.isArray(c.position)||c.position.length!==3||!c.position.every(v=>finite(v,-10000,10000))||!finite(c.yaw,-1000,1000)||!finite(c.pitch,-1.54,1.54)||!finite(c.fov,20,100)||!finite(c.roll,-Math.PI,Math.PI)||!Array.isArray(c.viewport)||c.viewport.length!==2||!c.viewport.every(v=>finite(v,1,16000)))throw new Error('Invalid camera pose.');
 if(!s||s.version!==1||!/^[-a-z0-9]{1,64}$/.test(s.scenarioId)||!/^[-a-z0-9]{1,64}$/.test(s.levelId)||!/^[-a-z0-9]{1,64}$/.test(s.waveId)||!finite(s.seconds,0,120)||!['placements','enemies','defences','missiles','activity'].every(k=>Array.isArray(s[k])&&s[k].length<=512))throw new Error('Invalid frozen scene.');
 if(!['preferred','avoid'].includes(body.verdict)||typeof body.notes!=='string'||body.notes.length>4000)throw new Error('Choose a shot type and keep notes under 4,000 characters.');
 if(typeof body.image!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(body.image)||body.image.length>6*1024*1024)throw new Error('A PNG screenshot is required (maximum 6 MiB).');
 const image=Buffer.from(body.image.slice(22),'base64');
 if(image.length<24||!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||image.readUInt32BE(16)<1||image.readUInt32BE(16)>8192||image.readUInt32BE(20)<1||image.readUInt32BE(20)>8192)throw new Error('Invalid PNG screenshot.');
 const record={version:1,camera:c,scene:s,verdict:body.verdict,notes:body.notes};
 if(JSON.stringify(record).length>512*1024)throw new Error('Scene record is too large.');
 return {record,image};
}
// Append-only, generated names, same-origin writes, and a dedicated notes folder.
// No asset or campaign-save endpoints are used by the study tool.
export function cameraStudyStore(directory){
 return async request=>{
  const url=new URL(request.url);if(url.pathname!=='/api/camera-study/shots')return null;
  if(request.method==='GET'){
   let files;try{files=await readdir(directory);}catch(error){if(error.code==='ENOENT')return json([]);throw error;}
   const records=await Promise.all(files.filter(s=>/^[a-f0-9-]{36}\.json$/.test(s)).sort().map(async file=>JSON.parse(await readFile(join(directory,file),'utf8'))));
   return json(records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
  }
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Same-origin requests only.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Use application/json.'},415);
  if(Number(request.headers.get('content-length'))>8*1024*1024)return json({error:'Shot is too large.'},413);
  let parsed;try{parsed=validateStudyShot(await request.json());}catch(error){return json({error:error.message},400);}
  const id=randomUUID(),record={...parsed.record,id,createdAt:new Date().toISOString(),image:`/docs/drone-camera-study/shots/${id}.png`};
  await mkdir(directory,{recursive:true});
  const imagePath=join(directory,`${id}.png`);
  await writeFile(imagePath,parsed.image,{flag:'wx'});
  try{await writeFile(join(directory,`${id}.json`),JSON.stringify(record,null,2)+'\n',{flag:'wx'});}catch(error){await rm(imagePath,{force:true});throw error;}
  return json(record,201);
 };
}
