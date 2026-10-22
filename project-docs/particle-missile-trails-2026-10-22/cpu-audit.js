import {writeFileSync} from 'node:fs';
import {DamageEffects} from '../../engine/damage-effects.js';
import {ReflectionEffects} from '../../engine/reflection-effects.js';
import {MAX_SMOKE,MAX_EFFECT_SMOKE,MAX_TRAIL_SMOKE,DAMAGE_PARTICLE_FLOATS,MISSILE_TRAIL_SMOKE} from '../../shared/damage-effects.js';

// Synthetic native-format histories exercise the actual two sorting/packing
// methods. GPU writes are stubbed: this measures CPU preparation, not a frame.
const matrix=new Float64Array(16),mirror=new Float64Array(16);matrix[15]=mirror[15]=1;matrix[6]=1;mirror[6]=-1;
const median=values=>[...values].sort((a,b)=>a-b)[values.length>>1];
const scenarios=[{name:'one-full-trail',trails:1},{name:'eight-full-trails',trails:8},{name:'full-bank-adversarial',trails:8,ordinary:true}];
const results=[];
for(const scenario of scenarios){
 const damage=new DamageEffects(()=>.5),points=MISSILE_TRAIL_SMOKE.life*MISSILE_TRAIL_SMOKE.rate;
 for(let n=0;n<points;n++)for(let id=0;id<scenario.trails;id++)damage.missileTrail(id*24+Math.sin(n*.1)*6,20+n*.9,id*8+n*.7,(points-1-n)/MISSILE_TRAIL_SMOKE.rate);
 if(scenario.ordinary){
  for(let i=0;i<MAX_EFFECT_SMOKE/8;i++)damage.launchSmoke(i,0,0);
  // Reverse insertion in both views. This is a conservative sorting stress,
  // not an observed camera or scene. No timed setup/allocations.
  for(let i=0;i<MAX_SMOKE;i++){const p=damage.smoke[i];p.y=i;p.age=0;}
 }
 const reflected={smokeData:new Float32Array(MAX_SMOKE*DAMAGE_PARTICLE_FLOATS),smokeOrder:new Uint32Array(MAX_SMOKE),smokeDepth:new Float64Array(MAX_SMOKE),device:{queue:{writeBuffer(){}}},smokeBuffer:{}};
 const run=kind=>{damage.prepare(matrix);if(kind==='main-and-mirror')ReflectionEffects.prototype.prepareSmoke.call(reflected,damage,mirror);};
 const batches={main:[],'main-and-mirror':[]},iterations=100;
 for(let batch=0;batch<9;batch++)for(const kind of batch%2?['main-and-mirror','main']:['main','main-and-mirror']){
  const start=performance.now();for(let i=0;i<iterations;i++)run(kind);
  if(batch)batches[kind].push((performance.now()-start)/iterations);
 }
 results.push({scenario:scenario.name,trails:scenario.trails,trailParticles:scenario.trails*points,ordinaryParticles:scenario.ordinary?MAX_EFFECT_SMOKE:0,activeParticles:damage.smokeCount,mainMedianMS:median(batches.main),mainAndMirrorMedianMS:median(batches['main-and-mirror']),batches});
}
const report={runtime:process.versions.bun?'Bun '+process.versions.bun:process.version,method:'Isolated actual DamageEffects.prepare plus ReflectionEffects.prepareSmoke, eight measured alternating batches of 100 iterations after one warmup batch. Frozen synthetic native-format two-second histories; GPU writes stubbed. Ordinary and trail capacity fixed at384+768. Main/mirrored depth axes oppose each other; full-bank case deliberately forces reverse insertion for both sorts. Not whole-frame, browser CPU or GPU timing.',capacity:{ordinary:MAX_EFFECT_SMOKE,trails:MAX_TRAIL_SMOKE,total:MAX_SMOKE},results};
writeFileSync(new URL('cpu-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
