// Routed combat asset requests explicitly read the archived preview sources.
import {test,expect} from 'bun:test';
import {productionLevel} from '../scripts/production-level.js';
import {buildWorld,disposeWorld,loadWorld} from '../engine/world.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {TurretPreview} from '../game/turret-preview.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {ENEMY_STATS} from '../shared/enemy.js';
import {WALKER_PREVIEW_ACTORS,SPIDER_PREVIEW_ACTORS} from '../shared/enemy-roster.js';

async function fixture(zone,actors=previewActorsForLevel(productionLevel(zone).id)){
 const level=productionLevel(zone);
 const ids=[...new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)])];
 const models=new Map(await Promise.all(ids.map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
 return buildWorld(level,models,{actors});
}

test('manual enemy reset revives every model in place and clears old combat commitments and damage effects',async()=>{
 for(const zone of ['A','B','C','D']){
  const world=await fixture(zone),effects=new DamageEffects(()=>.5);let deaths=0;
  const enemies=new EnemyPreview(world,()=>{},(_id,state)=>{deaths++;effects.explode(state);});
  const turrets=new TurretPreview(world,()=>{},()=>.5,null,enemies.states.length?enemies.states:null,(state,strength)=>enemies.takeHit(state,strength));
  effects.setWorld(world,enemies.states);
  const states=enemies.states,refs=states.map(s=>({state:s,health:s.health,gait:s.gait,rig:s.rig,matrices:s.rig.bones.map(b=>b.instance.matrix),poses:s.rig.bones.map(b=>b.instance.matrix.slice())}));
  const pools=[effects.cubes,effects.smoke,effects.blasts,effects.cubeData,effects.shockwaveData],emitters=effects.emitters.slice(),coverage=turrets.planner?.coverage;
  try{
   if(states.length){
    const turret=turrets.states.find(s=>s.variant==='upgrade1');turret.target=states[0];turret.reservation=states[0];turret.cycle.trigger();expect(turret.cycle.remaining).toBe(2);
    enemies.advance(states[0].loopSeconds+1.37);enemies.takeHit(states[0],states[0].health.maximum/2+1);effects.emitSmoke(.125);expect(effects.activeSmoke).toBeGreaterThan(0);
    enemies.takeHit(states[1],states[1].health.maximum);effects.prepare();expect(effects.activeCubes).toBeGreaterThan(0);expect(deaths).toBe(1);
   }
   const clocks=turrets.states.map(s=>s.cycle.time),angles=turrets.states.map(s=>s.aim.yaw);
   effects.reset(true);turrets.resetTargets();enemies.reset();
   expect(enemies.states).toBe(states);expect(enemies.time).toBe(0);expect(enemies.completedLoops).toBe(0);expect(enemies.alive).toBe(states.length);
   for(let i=0;i<states.length;i++){
    const s=states[i],r=refs[i];expect(s).toBe(r.state);expect(s.health).toBe(r.health);expect(s.gait).toBe(r.gait);expect(s.rig).toBe(r.rig);
    expect(s.health.current).toBe(ENEMY_STATS[s.model].maxHealth);expect(s.health.hits).toBe(0);expect(s.distance).toBe(s.seed%s.path.length);expect(s.lap).toBe(Math.floor(s.seed/s.path.length));
    for(let b=0;b<r.matrices.length;b++){expect(s.rig.bones[b].instance.matrix).toBe(r.matrices[b]);expect(s.rig.bones[b].instance.matrix).toEqual(r.poses[b]);}
   }
   expect(turrets.planner?.coverage).toBe(coverage);expect(turrets.states.every(s=>s.target===null&&!s.reservation&&s.cycle.remaining===0)).toBe(true);
   expect(turrets.states.map(s=>s.cycle.time)).toEqual(clocks);expect(turrets.states.map(s=>s.aim.yaw)).toEqual(angles);
   const currentPools=[effects.cubes,effects.smoke,effects.blasts,effects.cubeData,effects.shockwaveData];for(let i=0;i<pools.length;i++)expect(currentPools[i]).toBe(pools[i]);
   expect(effects.activeSmoke+effects.activeCubes+effects.activeBlasts+effects.shockwaveCount+effects.lightCount).toBe(0);
   for(let i=0;i<emitters.length;i++){expect(effects.emitters[i]).toBe(emitters[i]);expect(effects.emitters[i].carry).toBe(0);}
   if(states.length){
    enemies.takeHit(states[0],states[0].health.maximum/2+1);effects.emitSmoke(.125);expect(effects.activeSmoke).toBe(1);enemies.takeHit(states[0],states[0].health.maximum);expect(deaths).toBe(2);expect(effects.activeBlasts).toBe(1);
    enemies.reset();expect(deaths).toBe(2);expect(enemies.alive).toBe(states.length);for(let i=0;i<120;i++){enemies.advance(1/60);turrets.advance(1/60);}expect(turrets.planner.thinks).toBe(120);
   }
  }finally{turrets.dispose();effects.reset();enemies.dispose();disposeWorld(world);}
 }
});

test('enemy lap metadata survives staggered starts and multi-loop stalls without changing movement',async()=>{
 const world=await fixture('B'),preview=new EnemyPreview(world,()=>{});let elapsed=0;
 try{
  for(const dt of [10,preview.states[0].loopSeconds*3+1,.073]){
   elapsed+=dt;preview.advance(dt);
   for(const state of preview.states){
    const travel=state.seed+elapsed*state.movement.speed;
    expect(state.threat).toBe(ENEMY_STATS[state.model].threat);
    expect(state.lap).toBe(Math.floor(travel/state.path.length));
    expect(state.distance).toBeCloseTo(travel%state.path.length,8);
    expect(Math.hypot(state.velocityX,state.velocityZ)).toBeCloseTo(state.movement.speed,10);
   }
  }
 }finally{preview.dispose();disposeWorld(world);}
});

test('B and D combat previews survive many shots, smoke, explode once and stop updating after death',async()=>{
 for(const [zone,model,parts] of [['B','walker',7],['D','spider',13]]){
  const actors=zone==='B'?WALKER_PREVIEW_ACTORS:SPIDER_PREVIEW_ACTORS;
  const world=await fixture(zone,actors),effects=new DamageEffects(()=>.5),deaths=[];
  let updates=0,smokeSeen=false;
  const enemies=new EnemyPreview(world,()=>updates++,(id,state)=>{deaths.push(id);effects.explode(state);},actors);
  const turrets=new TurretPreview(world,()=>{},()=>.5,null,enemies.states,(state,strength)=>enemies.takeHit(state,strength));
  effects.setWorld(world,enemies.states);
  expect(world.entries.filter(e=>e.key.startsWith(model+':'))).toHaveLength(parts);
  expect(enemies.states).toHaveLength(3);
  for(const e of world.entries.filter(e=>e.key.startsWith(model+':')))expect(e.transforms).toHaveLength(3);
  for(const s of enemies.states)expect(s.health.maximum).toBe(300);
  let elapsed=0;
  while(enemies.alive&&elapsed<150){
   effects.advance(1/60);enemies.advance(1/60);turrets.advance(1/60);effects.emitSmoke(1/60);
   smokeSeen||=effects.activeSmoke>0;elapsed+=1/60;
  }
  expect(smokeSeen).toBe(true);expect(enemies.alive).toBe(0);expect(new Set(deaths).size).toBe(3);
  for(const s of enemies.states){expect(s.health.hits).toBeGreaterThanOrEqual(25);expect(s.health.hits).toBeLessThanOrEqual(30);expect(s.health.current).toBe(0);}
  expect(enemies.states.reduce((sum,s)=>sum+s.health.hits,0)).toBe(turrets.shots);
  for(const s of turrets.states){expect(s.cycle.shots).toBeGreaterThan(0);expect(s.lastShotVisible).toBe(true);expect(s.lastShotDistance).toBeLessThanOrEqual(s.maxRange+1e-6);}
  expect(effects.droppedCubes).toBe(0);expect(effects.droppedSmoke).toBe(0);
  updates=0;enemies.advance(1);expect(updates).toBe(0);
  turrets.dispose();effects.reset();enemies.dispose();disposeWorld(world);
  expect(effects.emitters).toHaveLength(0);expect(effects.visibility).toBeNull();expect(enemies.states).toHaveLength(0);expect(world.actors.size).toBe(0);
 }
});

test('new enemy effects originate at each current body centre with model-specific debris settings',async()=>{
 for(const [zone,model] of [['B','walker'],['D','spider']]){
  const world=await fixture(zone),enemies=new EnemyPreview(world,()=>{}),effects=new DamageEffects(()=>.5);
  enemies.advance(.37);effects.setWorld(world,enemies.states);
  const state=enemies.states[0],config=ENEMY_STATS[model],instance=world.actors.get(state.id).instances.find(i=>i.part===config.effectOrigin.part);
  const m=instance.matrix,p=config.effectOrigin.point,origin=[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
  enemies.takeHit(state,151);effects.emitSmoke(.125);expect(effects.activeSmoke).toBe(1);
  expect([effects.smoke[0].x,effects.smoke[0].y,effects.smoke[0].z]).toEqual(origin);
  effects.explode(state);expect(effects.activeCubes).toBe(config.explosion.debrisCount);
  expect([effects.blasts[0].x,effects.blasts[0].y,effects.blasts[0].z]).toEqual(origin);
  for(const c of effects.cubes)if(c.active)expect([c.x,c.y,c.z]).toEqual(origin);
  effects.advance(.2);effects.prepare();expect(effects.blastCount).toBe(1);expect(effects.lightCount).toBe(1);expect(effects.shockwaveCount).toBe(1);
  effects.reset();enemies.dispose();disposeWorld(world);
 }
});

test('mixed zone loads request only assigned combat and cosmetic assets, including C enemies',async()=>{
 const originalFetch=globalThis.fetch;
 try{
 for(const [zone,id] of [['A','moss-01'],['B','ochre-01'],['C','ice-01'],['D','plum-01']]){
  const requests=[];
  globalThis.fetch=async url=>{requests.push(url);const [,kind,key]=/^\/api\/(models|levels)\/([\w-]+)$/.exec(url);return Response.json({asset:await Bun.file(new URL(kind==='levels'?`../docs/landscape-reset-2026-10-18/previous-levels/${key}.json`:`../assets/${kind}/${key}.json`,import.meta.url)).json()});};
  const actors=previewActorsForLevel(id),assigned=new Set(actors.map(a=>a.model)),cosmetics=wildlifeActorsForLevel(id),world=await loadWorld(id,{actors:[...actors,...cosmetics]});
  expect(world.assetIds).not.toContain('concertina');expect(requests).not.toContain('/api/models/concertina');
  // Loading an active model must never pull another zone's actor into memory.
  for(const candidate of Object.keys(ENEMY_STATS))expect(world.assetIds.includes(candidate)).toBe(assigned.has(candidate));
  expect(requests.filter(url=>Object.hasOwn(ENEMY_STATS,url.split('/').at(-1)))).toHaveLength(assigned.size);
  const preview=new EnemyPreview(world,()=>{});expect(preview.states).toHaveLength(actors.length);
  const wildlife=new WildlifePreview(world,()=>{});expect(wildlife.states).toHaveLength(6);expect(world.actors.size).toBe(actors.length+6);
  expect(world.assetIds.filter(id=>id.startsWith('wildlife-')).sort()).toEqual([...new Set(cosmetics.map(a=>a.model))].sort());
  const turrets=new TurretPreview(world,()=>{},()=>.5,null,preview.states.length?preview.states:null);
  for(let frame=0;frame<6;frame++){preview.advance(1/60);wildlife.advance(1/60);turrets.advance(1/60);}
  for(const state of turrets.states)expect(state.target===null||preview.states.includes(state.target)).toBe(true);
  expect(world.level.zone).toBe(zone);expect(world.weather.enabled).toBe(false);
  const targets=turrets.targets;turrets.dispose();wildlife.dispose();preview.dispose();disposeWorld(world);expect(world.actors.size).toBe(0);expect(wildlife.states).toHaveLength(0);if(targets)expect(targets).toHaveLength(0);
 }
 }finally{globalThis.fetch=originalFetch;}
});
