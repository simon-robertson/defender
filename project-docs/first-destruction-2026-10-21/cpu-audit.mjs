import {PLAY_CONFIG} from '../../play/config.js';
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../../play/engine.js';
import {DamageEffects} from '../../engine/damage-effects.js';
import {CRITTER_GIB} from '../../shared/damage-effects.js';
const repo=new URL('../../',import.meta.url).pathname;
globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(`${repo}/assets/${kind}/${id}.json`).json()})};};
const log=await Bun.file(`${repo}/docs/engine-optimisation-2026-10-21/mixed-campaign.json`).json(),level=PLAY_CONFIG.levels[0],wave=level.waves[0],placements=log.results[0].waves[0].placements,output=[];
for(let round=0;round<5;round++){
 const rows=Array.from({length:3},()=>({}));let n=0,step=0,e;const d=new DamageEffects(()=>.5);
 const world=await loadPlayWorld(level.id,{config:PLAY_CONFIG,wave,placements});
 e=new PlayEngine(world,{config:PLAY_CONFIG,wave,onStep:dt=>{const a=performance.now();d.advance(dt);if(n&&step-rows[n-1].step<=2)rows[n-1].followingPhysicsMs=(rows[n-1].followingPhysicsMs??0)+performance.now()-a;},onAfterStep:(dt,combat)=>{if(combat)d.emitSmoke(dt);},onDeath:(_id,state)=>{
  const row=rows[n++];row.step=step;row.time=e.time;const a=performance.now();const blast=d.explode(state);const b=performance.now();row.explodeMs=b-a;const bursts=d.critterBursts;
  if(blast){e.wildlife.gibExplosion(blast.x,blast.y,blast.z,CRITTER_GIB.enemyRadius,d);const c=performance.now();row.gibMs=c-b;e.wildlife.spookExplosion(blast.x,blast.y,blast.z,blast.config.frightRadius);row.spookMs=performance.now()-c;}
  row.callbackMs=performance.now()-a;row.critterBursts=d.critterBursts-bursts;row.pieces=d.activeCubes;row.smoke=d.activeSmoke;
 }});
 d.setWorld(world,e.enemies.states);e.startWave();let before=0;
 try{while(e.running&&step++<120*90){before=n;const a=performance.now();e.advance(1/120);const ms=performance.now()-a;if(n>before)rows[n-1].advanceFrameMs=ms;if(n&&step-rows[n-1].step<=2)rows[n-1].followingAdvanceMs=Math.max(rows[n-1].followingAdvanceMs??0,ms);}output.push({round,rows,kills:e.enemies.killed});}
 finally{d.reset();e.dispose();disposePlayWorld(world);}
}
const median=a=>{a.sort((x,y)=>x-y);return a[a.length>>1];};
const summary=[0,1,2].map(i=>({death:i+1,samples:output.length,callbackMedianMs:median(output.map(x=>x.rows[i].callbackMs)),callbackMaxMs:Math.max(...output.map(x=>x.rows[i].callbackMs)),advanceFrameMedianMs:median(output.map(x=>x.rows[i].advanceFrameMs)),nextTwoPhysicsMedianMs:median(output.map(x=>x.rows[i].followingPhysicsMs)),bursts:output.map(x=>x.rows[i].critterBursts)}));
const report={method:'Bun CPU-only native A1 wave1 with recorded two-base-gun deployment, production enemies/wildlife/damage. Five fresh worlds; no renderer, browser, GPU or camera. Each death callback times explode, gib/spook; actual 1/120 advance frame and first next-two physics work. Timing instrumentation and JS warm-up are included; no FPS claim.',summary,output};
await Bun.write(new URL('./cpu-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
