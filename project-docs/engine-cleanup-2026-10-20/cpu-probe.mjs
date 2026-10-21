// Read-only before/after CPU operation/byte-exact trace probe.
// bun docs/engine-cleanup-2026-10-20/cpu-probe.mjs [--baseline-only]
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const current=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,''),baseline='/private/tmp/defender-engine-20261020-euzacphu',baselineOnly=process.argv.includes('--baseline-only');
const record=await Bun.file(current+'/docs/zone-a-completion-2026-10-20/mixed.json').json(),arrangements=record.results[0].waves;
const definitions=[{level:0,wave:2,view:'drone'},{level:1,wave:2,view:'drone'},{level:2,wave:3,view:'live'},{level:3,wave:3,view:'drone'}],nativeFetch=globalThis.fetch;
const imports=new Map(),assets=new Map();
async function runtime(root){if(!imports.has(root))imports.set(root,{...await import(pathToFileURL(root+'/play/engine.js')),...await import(pathToFileURL(root+'/play/config.js')),...await import(pathToFileURL(root+'/engine/camera.js')),...await import(pathToFileURL(root+'/play/drone-camera.js')),...await import(pathToFileURL(root+'/play/live-camera.js'))});return imports.get(root);}
async function asset(kind,id){const key=kind+'/'+id;if(!assets.has(key))assets.set(key,await Bun.file(baseline+'/assets/'+key+'.json').json());return structuredClone(assets.get(key));}
function numbers(s){const out={};for(const [key,value]of Object.entries(s))if(typeof value==='number'||typeof value==='string'||typeof value==='boolean'||value===null)out[key]=value;return out;}
async function fixture(root,definition,capture){
 const api=await runtime(root),level=api.PLAY_CONFIG.levels[definition.level],wave=level.waves[definition.wave],arrangement=arrangements.find(a=>a.wave===wave.id),world=await api.loadPlayWorld(level.id,{config:api.PLAY_CONFIG,wave,placements:arrangement.placements});
 const camera=new api.Camera({clientWidth:1500,clientHeight:1000,addEventListener(){},focus(){}},()=>{});camera.setLevel(world.level);const view=definition.view==='live'?new api.LiveCamera(camera):new api.DroneCamera(camera);view.bind(world);
 const digest=capture?new Bun.CryptoHasher('sha256'):null,count={spawnPhaseReads:0,spawnTimeReads:0,nextPhaseReads:0,nextTimeReads:0,posePhaseReads:0,mothSinCalls:0,cameraTypedIteratorRequests:0,poseCallbacks:0},events=[];let scope='',engine;
 const change=(key,index,matrix)=>{if(!digest)return;count.poseCallbacks++;digest.update(key+':'+index);digest.update(matrix);};
 engine=new api.PlayEngine(world,{config:api.PLAY_CONFIG,wave,onPoseChange:change,onVisible:(id,visible)=>{if(digest)digest.update(id+':'+visible);},onDeath:(id,state)=>{events.push(['death',id,engine.time]);view.noteExplosion(state,engine.time);},onEscape:id=>events.push(['escape',id,engine.time])});
 function instrument(){
  if(!capture)return;for(const state of engine.enemies.states){let phase=state.phase,at=state.spawnAt;Object.defineProperty(state,'phase',{enumerable:true,configurable:true,get(){if(scope==='spawn')count.spawnPhaseReads++;else if(scope==='next')count.nextPhaseReads++;else if(scope==='pose')count.posePhaseReads++;return phase;},set(value){phase=value;}});Object.defineProperty(state,'spawnAt',{enumerable:true,configurable:true,get(){if(scope==='spawn')count.spawnTimeReads++;else if(scope==='next')count.nextTimeReads++;return at;},set(value){at=value;}});
   if(state.model==='moth'){const pose=state.gait.pose;state.gait.pose=function(...args){const old=scope;scope='moth';try{return pose.apply(this,args);}finally{scope=old;}};}
  }
  for(const [object,key,label]of [[engine.enemies,'spawnDue','spawn'],[engine.enemies,'nextSpawn','next'],[engine.enemies.preview,'pose','pose']]){const method=object[key];object[key]=function(...args){const old=scope;scope=label;try{return method.apply(this,args);}finally{scope=old;}};}
 }
 instrument();engine.startWave();view.setEnabled(true);view.sync('wave',engine);
 function frameRecord(){
  if(!digest)return;digest.update(JSON.stringify(engine.stats()));digest.update(JSON.stringify(view.stats()));digest.update(JSON.stringify(engine.enemies.activeTargets.map(s=>s.id)));
  for(const state of engine.enemies.states){digest.update(JSON.stringify([state.id,state.phase,state.distance,state.time,state.health.current,state.health.hits,state.x,state.y,state.z,state.aimX,state.aimY,state.aimZ,state.velocityX,state.velocityY,state.velocityZ,state.aimVelocityX,state.aimVelocityY,state.aimVelocityZ,state.yaw]));for(const bone of state.rig.bones){digest.update(bone.instance.matrix);digest.update(bone.rotation);digest.update(bone.translation);}}
  for(const gun of engine.firing.states)digest.update(JSON.stringify([gun.id,gun.target?.id,gun.reservation?.id,numbers(gun.cycle),gun.aim?.yaw,gun.pitch?.angle,gun.lineOfSight,gun.ammo,gun.reloading,gun.reloadUntil,gun.lastHitDamage,gun.lastShotDamage]));
  for(const animal of engine.wildlife.states){digest.update(JSON.stringify(numbers(animal)));for(const bone of animal.rig.bones)digest.update(bone.instance.matrix);}
 }
 return {run(){
  const sin=Math.sin,prototype=Float64Array.prototype,own=Object.getOwnPropertyDescriptor(prototype,Symbol.iterator),iterate=prototype[Symbol.iterator];
  if(capture){Math.sin=function(value){if(scope==='moth')count.mothSinCalls++;return sin(value);};Object.defineProperty(prototype,Symbol.iterator,{configurable:true,writable:true,value:function(){if(scope==='camera')count.cameraTypedIteratorRequests++;return iterate.call(this);}});}
  const start=performance.now();try{for(let frame=0;frame<2400;frame++){
   if(capture&&frame===1800){view.refresh();engine.stopWave();engine.startWave();view.sync('wave',engine);}
   const paused=capture&&frame>=600&&frame<630,phase=capture&&frame>=1200&&frame<1440?'settling':'wave';
   if(!paused)engine.advance(1/60,{combat:phase==='wave'});scope='camera';view.advance(1/60,{engine,phase,paused});scope='';frameRecord();
  }}finally{Math.sin=sin;if(own)Object.defineProperty(prototype,Symbol.iterator,own);else delete prototype[Symbol.iterator];}
  return {...count,...(digest?{sha256:digest.digest('hex')}:{}),milliseconds:performance.now()-start,events,final:engine.stats()};
 },dispose(){view.dispose();engine.dispose();api.disposePlayWorld(world);}};
}
try{
 globalThis.fetch=async url=>{const match=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(String(url));assert(match);return {ok:true,json:async()=>({asset:await asset(match[1],match[2])})};};
 const proof=[];for(const definition of definitions){const results=[];for(const root of baselineOnly?[baseline]:[baseline,current]){const f=await fixture(root,definition,true);try{results.push(f.run());}finally{f.dispose();}}if(results.length===2)assert.equal(results[0].sha256,results[1].sha256,'Exact CPU/pose/camera trace mismatch: '+JSON.stringify(definition));proof.push({definition,before:results[0],...(results[1]?{after:results[1]}:{})});}
 console.log(JSON.stringify({method:'2400 actual 60Hz scene advances per witness, including current weapon/route/rig/wildlife and live/drone camera; proof includes pause, presentation-only settling and restart; property/trig/iterator counts instrumented separately from optional timings.',baseline,current,proof},null,2));
}finally{globalThis.fetch=nativeFetch;}
