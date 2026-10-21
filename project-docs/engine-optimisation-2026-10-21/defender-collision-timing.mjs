import {PLAY_CONFIG} from '../../play/config.js';
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../../play/engine.js';
import {SceneryVisibility as BeforeVisibility} from './defender-collision-before/visibility.mjs';
import {MissileFlightPool as BeforePool} from './defender-collision-before/missile-flight.mjs';
const repo=new URL('../../',import.meta.url).pathname;
globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(`${repo}/assets/${kind}/${id}.json`).json()})};};
const log=await Bun.file(`${repo}/docs/todo-36-41-2026-10-21/mixed-campaign.json`).json(),rows=[];
for(let round=0;round<7;round++)for(const before of round%2?[false,true]:[true,false]){
 const level=PLAY_CONFIG.levels[7],wave=level.waves[0],placements=log.results[0].waves.find(w=>w.wave===wave.id).placements,world=await loadPlayWorld(level.id,{config:PLAY_CONFIG,wave,placements});
 if(before){world.visibility.dispose();world.visibility=new BeforeVisibility(world.level,world.playModels);world.visibility.setDefences(world.level,world.playModels,world.rigs);}
 const e=new PlayEngine(world,{config:PLAY_CONFIG,wave});e.startWave();const p=e.firing.missiles.pool;if(before)p.launchClear=BeforePool.prototype.launchClear;
 let forecastMs=0,forecastCalls=0;const clear=p.launchClear;
 p.launchClear=function(...args){const start=performance.now();try{return clear.apply(this,args);}finally{forecastMs+=performance.now()-start;forecastCalls++;}};
 const start=performance.now();for(let f=0;f<1200;f++)e.advance(1/60);const advanceMs=performance.now()-start;
 const row={round,before,id:level.id,seconds:20,advanceMs,forecastMs,forecastCalls,forecasts:p.clearanceChecks};rows.push(row);console.log(JSON.stringify(row));e.dispose();disposePlayWorld(world);
}
const median=a=>{a.sort((x,y)=>x-y);return(a[(a.length-1)>>1]+a[a.length>>1])/2;};
const summary=[true,false].map(before=>{const sample=rows.filter(r=>r.before===before&&r.round>0);return{before,samples:sample.length,advanceMedianMs:median(sample.map(s=>s.advanceMs)),forecastMedianMs:median(sample.map(s=>s.forecastMs)),advanceRangeMs:[Math.min(...sample.map(s=>s.advanceMs)),Math.max(...sample.map(s=>s.advanceMs))],forecastRangeMs:[Math.min(...sample.map(s=>s.forecastMs)),Math.max(...sample.map(s=>s.forecastMs))]};});
console.log(JSON.stringify(summary));await Bun.write(new URL('./defender-collision-timing.json',import.meta.url),JSON.stringify({method:'Bun synchronous CPU work for 20 simulated B4 seconds; current 11-defence mixed witness; setup excluded; per-forecast timer; alternating order; first pair warmup excluded; no renderer/GPU/browser/frame-rate claim',rows,summary},null,2)+'\n');
