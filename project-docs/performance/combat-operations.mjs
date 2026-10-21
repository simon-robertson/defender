// Deterministic operation counts and exact-state equivalence, NOT a timing benchmark.
// bun docs/performance/combat-operations.mjs BASELINE_ROOT [CURRENT_ROOT] [OUTPUT_JSON]
// Baseline/current roots need engine/, game/ and shared/. Both runs use current assets/.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
if(!Bun.argv[2]){console.error('Usage: bun combat-operations.mjs BASELINE_ROOT [CURRENT_ROOT] [OUTPUT_JSON]');process.exit(2);}
const baseline=resolve(Bun.argv[2]),repo=resolve(Bun.argv[3]??fileURLToPath(new URL('../../',import.meta.url))),output=Bun.argv[4]?resolve(Bun.argv[4]):null;
const results=[];
for(const [kind,base] of [['before',baseline],['after',repo]]){
 const {buildWorld,disposeWorld}=await import(base+'/engine/world.js');
 const {EnemyPreview,previewActorsForLevel}=await import(base+'/game/enemy-preview.js');
 const {DefencePreview}=await import(base+'/game/defence-preview.js');
 const {missileActorsForLevel}=await import(base+'/game/missile-preview.js');
 const {PathMotion}=await import(base+'/engine/path-motion.js');
 const sample=PathMotion.prototype.sample;let profileSamples=0,countSamples=false;
 PathMotion.prototype.sample=function(distance,out){if(countSamples)profileSamples++;return sample.call(this,distance,out);};
 for(const id of ['moss-01','moss-02','moss-03','ochre-03','plum-03']){
  const level=await Bun.file(resolve(repo,`assets/levels/${id}.json`)).json(),actors=[...previewActorsForLevel(id),...missileActorsForLevel(id)],models=new Map();
  for(const model of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)]))models.set(model,await Bun.file(resolve(repo,`assets/models/${model}.json`)).json());
  const world=buildWorld(level,models,{actors}),enemies=new EnemyPreview(world,()=>{});let seed=232;
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  const trace=new Bun.CryptoHasher('sha256'),hitTrace=new Bun.CryptoHasher('sha256');
  profileSamples=0;countSamples=true;
  const defences=new DefencePreview(world,()=>{},random,null,enemies.states,(target,strength,vx,vy,vz)=>{const hit=enemies.takeHit(target,strength,vx,vy,vz);hitTrace.update(JSON.stringify([enemies.time,target.id,strength,hit,vx,vy,vz]));return hit;},null,()=>{});countSamples=false;
  const pool=defences.missiles.pool;let boundBuilds=0,neededBuilds=0;
  const needed=new Set();if(pool){const contact=pool.contact;pool.contact=function(record,...args){needed.add(record);if(kind==='after'&&record.boundsDirty)boundBuilds++;return contact.call(this,record,...args);};}
  for(let frame=0;frame<2400;frame++){
   enemies.advance(1/60);needed.clear();if(pool&&kind==='before'&&pool.active)boundBuilds+=pool.recordList.length;
   defences.advance(1/60);neededBuilds+=needed.size;
   trace.update(JSON.stringify([enemies.states.map(s=>[s.id,s.health.current,s.health.hits,s.x,s.z,s.distance,s.lap,s.aimX,s.aimY,s.aimZ,s.velocityX,s.velocityZ,s.aimVelocityX,s.aimVelocityY,s.aimVelocityZ]),defences.states.map(s=>[s.id,s.target?.id,s.cycle.shots,s.cycle.remaining,s.cycle.readyAt,s.lastShotDamage,s.ammo]),pool?.slots.map(s=>[s.phase,s.age,s.x,s.y,s.z,s.vx,s.vy,s.vz,s.strength,s.target?.id,s.targetLap,s.orphaned,s.passedAim,s.engineCutoff])]));
   for(const actor of world.actors.values())for(const instance of actor.instances){const m=instance.matrix;trace.update(new Uint8Array(m.buffer,m.byteOffset,m.byteLength));}
  }
  const result={kind,id,frames:2400,profileSamples,boundBuilds,neededBuilds,shots:defences.states.map(s=>s.cycle.shots),hits:enemies.states.map(s=>s.health.hits),health:enemies.states.map(s=>s.health.current),trace:trace.digest('hex'),hitTrace:hitTrace.digest('hex')};results.push(result);console.log(JSON.stringify(result));
  defences.dispose();enemies.dispose();disposeWorld(world);
 }
 PathMotion.prototype.sample=sample;
}
const comparisons=results.filter(r=>r.kind==='before').map(before=>{const after=results.find(r=>r.kind==='after'&&r.id===before.id);return{id:before.id,exactTrace:before.trace===after.trace,exactHits:before.hitTrace===after.hitTrace,routeSamples:[before.profileSamples,after.profileSamples],worldBoundBuilds:[before.boundBuilds,after.boundBuilds]};});
const report={measurement:'Operation counts and exact deterministic equivalence; no CPU/GPU timing or FPS measurement.',baselineRoot:baseline,currentRoot:repo,framesPerScene:2400,deltaSeconds:1/60,randomSeed:232,assetPolicy:'Both runs use the current root assets. This comparison assumes no model or level changes.',actors:'Production enemies and missiles; no wildlife, renderer or cosmetic effect pools.',trace:'Every-frame health, aiming/movement, weapon target/cadence, missile flight state, all actor matrix bytes; separate exact hit-event digest.',results,comparisons};
if(output)await Bun.write(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({measurement:report.measurement,comparisons},null,2));
