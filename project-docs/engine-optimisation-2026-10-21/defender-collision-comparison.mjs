import {PLAY_CONFIG} from '../../play/config.js';
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../../play/engine.js';
import {SceneryVisibility as BeforeVisibility} from './defender-collision-before/visibility.mjs';
import {MissileFlightPool as BeforePool} from './defender-collision-before/missile-flight.mjs';
import {ArcImpactSampler as BeforeArc} from './defender-collision-before/arc-impact.js';
import {ArcImpactSampler} from '../../engine/arc-impact.js';
const repo=new URL('../../',import.meta.url).pathname;
globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(`${repo}/assets/${kind}/${id}.json`).json()})};};
const log=await Bun.file(`${repo}/docs/todo-36-41-2026-10-21/mixed-campaign.json`).json();
const output={kind:'Exact CPU operation/trace comparison, not GPU or frame timing',native:[],arc:[]};
for(const before of [true,false])for(const index of [3,7]){
 const level=PLAY_CONFIG.levels[index],wave=level.waves[0],placements=log.results[0].waves.find(w=>w.wave===wave.id).placements;
 const world=await loadPlayWorld(level.id,{config:PLAY_CONFIG,wave,placements});
 if(before){world.visibility.dispose();world.visibility=new BeforeVisibility(world.level,world.playModels);world.visibility.setDefences(world.level,world.playModels,world.rigs);}
 const engine=new PlayEngine(world,{config:PLAY_CONFIG,wave});engine.startWave();
 const p=engine.firing.missiles.pool;if(before)p.launchClear=BeforePool.prototype.launchClear;
 let forecastSweeps=0,liveSweeps=0,isForecast=false,forecastCalls=0,centerTransforms=0;
 const clear=p.launchClear,sweep=world.visibility.sweepDefences;
 for(const defence of world.visibility.defences)for(const part of defence.parts){const center=part.center;Object.defineProperty(part,'center',{get(){centerTransforms++;return center;}});}
 world.visibility.sweepDefences=function(...args){if(isForecast)forecastSweeps++;else liveSweeps++;return sweep.apply(this,args);};
 p.launchClear=function(...args){forecastCalls++;isForecast=true;try{return clear.apply(this,args);}finally{isForecast=false;}};
 const hash=new Bun.CryptoHasher('sha256');
 for(let f=0;f<1200;f++){engine.advance(1/60);hash.update(JSON.stringify({enemies:engine.enemies.states.map(s=>[s.phase,s.health.current,s.distance,s.x,s.y,s.z]),guns:engine.firing.states.map(s=>[s.id,s.target?.id,s.cycle.shots,s.ammo,s.lastChainTargetId]),flights:p.slots.map(s=>[s.phase,s.x,s.y,s.z,s.age,s.target?.id,s.passedAim])}));}
 const row={before,id:level.id,seconds:20,defences:placements.length,forecastCalls,computedForecasts:p.clearanceChecks,forecastSweeps,liveSweeps,centerTransforms,centerCacheBytes:world.visibility.defenceCenters?.byteLength??0,trace:hash.digest('hex')};output.native.push(row);console.log(JSON.stringify(row));
 engine.dispose();disposePlayWorld(world);
}
function rng(){let n=1234567;return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};}
for(const index of [3,7,11,15]){
 const level=PLAY_CONFIG.levels[index],wave=level.waves[0],world=await loadPlayWorld(level.id,{config:PLAY_CONFIG,wave,placements:[]}),engine=new PlayEngine(world,{config:PLAY_CONFIG,wave});engine.startWave();
 const a=new BeforeArc(world,engine.enemies.states,rng()),b=new ArcImpactSampler(world,engine.enemies.states,rng());let facesA=0,facesB=0,calls=0;
 for(const [sampler,count] of [[a,()=>facesA++],[b,()=>facesB++]]){
  const parts=new Set();for(const r of sampler.records.values())for(const p of r.shape.parts)if(!parts.has(p)){parts.add(p);const quads=p.quads;p.quads={*[Symbol.iterator](){for(const q of quads){count();yield q;}}};}
 }
 const visibility={clear:()=>true};const hashA=new Bun.CryptoHasher('sha256'),hashB=new Bun.CryptoHasher('sha256'),source=new Float64Array(3);
 for(let frame=0;frame<60;frame++){engine.advance(1/30);for(const target of engine.enemies.states){source.set([target.x+45*Math.cos(frame*.7),target.aimY+20*Math.sin(frame*.4),target.z+45*Math.sin(frame*.7)]);for(const [s,h]of [[a,hashA],[b,hashB]]){const ok=s.sample(target,source,visibility,undefined,true);h.update(JSON.stringify([ok,s.attempts,s.partId,[...s.point],[...s.normal],[...s.localPoint]]));}calls++;}}
 const row={id:level.id,calls,facesBefore:facesA,facesAfter:facesB,bytesBefore:a.byteLength,bytesAfter:b.byteLength,traceBefore:hashA.digest('hex'),traceAfter:hashB.digest('hex')};output.arc.push(row);console.log(JSON.stringify(row));a.dispose();b.dispose();engine.dispose();disposePlayWorld(world);
}
await Bun.write(new URL('./defender-collision-comparison.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
