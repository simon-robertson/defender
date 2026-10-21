import {test,expect} from 'bun:test';
import {missileLauncherLevel} from '../scripts/missile-launcher-levels.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {DefencePreview} from '../game/defence-preview.js';
import {missileActorsForLevel} from '../game/missile-preview.js';
import {MISSILE_LAUNCHER_SOCKETS,GUIDED_MISSILE_MODEL} from '../shared/missile-model.js';
import {ModelLights} from '../engine/model-lights.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {ENEMY_IMPACT} from '../engine/enemy-impact.js';
import {emitMissileImpact} from '../game/missile-impact.js';
import {MAX_BLASTS,MISSILE_IMPACT_EFFECT,CRITTER_GIB} from '../shared/damage-effects.js';

const sources=new Map();
async function fixture(zone,mixed=false){
 const level=missileLauncherLevel(zone);
 if(mixed){const sites=level.placements.filter(p=>p.model==='missile-launcher');sites[0].model='turret-study';sites[1].model='arc-spire';}
 const actors=[...previewActorsForLevel(level.id),...wildlifeActorsForLevel(level.id),...missileActorsForLevel(level.id)],models=new Map();
 for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)])){
  if(!sources.has(id))sources.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
  models.set(id,sources.get(id));
 }
 const world=buildWorld(level,models,{actors}),visible=new Map(actors.map(a=>[a.id,true]));
 const damage=new DamageEffects(()=>.5),enemies=new EnemyPreview(world,()=>{},(id,state)=>{visible.set(id,false);damage.explode(state);}),wildlife=new WildlifePreview(world,()=>{});damage.setWorld(world,enemies.states);
 const defence=new DefencePreview(world,()=>{},()=>.5,null,enemies.states.length?enemies.states:null,(target,strength,vx,vy,vz)=>enemies.takeHit(target,strength,vx,vy,vz),null,(id,value)=>visible.set(id,value),{onLaunch:(x,y,z)=>damage.launchSmoke(x,y,z),onImpact:(x,y,z,nx,ny,nz)=>emitMissileImpact(damage,wildlife,x,y,z,nx,ny,nz)});
 return {world,enemies,wildlife,defence,damage,visible,dispose(){damage.reset();defence.dispose();wildlife.dispose();enemies.dispose();disposeWorld(world);}};
}

test('all third levels isolate missile actors from mixed enemies and cosmetic wildlife',async()=>{
 for(const zone of ['A','B','C','D']){
  const f=await fixture(zone);try{
   expect(missileActorsForLevel(f.world.level.id)).toHaveLength(36);
   expect(missileActorsForLevel(f.world.level.id.replace('-03','-01'))).toHaveLength(0);
   // D retains three Spiders and two Lanterns after Monowheel's removal.
   const enemyCount=zone==='C'?4:zone==='D'?5:7;
   expect(f.world.actors.size).toBe(36+6+enemyCount);
   expect(f.enemies.states).toHaveLength(enemyCount);expect(f.wildlife.states).toHaveLength(6);
   expect(f.defence.missiles.states).toHaveLength(3);expect(f.defence.turrets.states).toHaveLength(0);expect(f.defence.arcs.states).toHaveLength(0);
   expect(missileActorsForLevel(f.world.level.id).filter(a=>f.visible.get(a.id))).toHaveLength(12);
   const sites=[...f.world.rigs.values()].filter(r=>r.role==='defence');
   for(let i=0;i<sites.length;i++)expect(f.wildlife.defences[i*6+4]).toBe(sites[i].root[13]+Math.max(...MISSILE_LAUNCHER_SOCKETS[sites[i].variant].map(s=>s[1]+GUIDED_MISSILE_MODEL.height)));
   const pool=f.defence.missiles.pool,launch=pool.launch.bind(pool);
   let admitted=0,coveredLaunches=0;
   pool.launch=(index,target,strength)=>{
    const before=pool.incomingDamage(target);
    if(before>=target.health.current)coveredLaunches++;
    const result=launch(index,target,strength);
    expect(pool.incomingDamage(target)-before).toBe(strength);admitted++;
    return result;
   };
   let peakOffset=0,peakTilt=0,peakSmoke=0,peakBlasts=0;
   for(let frame=0;frame<2400;frame++){
    f.damage.advance(1/60);f.enemies.advance(1/60);f.defence.advance(1/60);f.damage.prepare();
    peakSmoke=Math.max(peakSmoke,f.damage.launchSmokeCount);peakBlasts=Math.max(peakBlasts,f.damage.missileBlastCount);
    for(const state of f.enemies.states){peakOffset=Math.max(peakOffset,Math.hypot(state.impact.offsetX,state.impact.offsetZ));peakTilt=Math.max(peakTilt,Math.hypot(state.impact.pitch,state.impact.roll));}
   }
   const hits=f.enemies.states.reduce((sum,s)=>sum+s.health.hits,0);
   expect(f.damage.launches).toBe(f.defence.missiles.shots);expect(f.damage.missileImpacts).toBe(f.defence.missiles.pool.hits+f.defence.missiles.pool.collisions);
   expect(f.wildlife.explosionEvents).toBe(f.damage.missileImpacts);
   expect(peakSmoke).toBeLessThanOrEqual(128);expect(peakBlasts).toBeLessThanOrEqual(4);expect(f.damage.droppedMissileBlasts).toBe(0);
   {
    expect(peakSmoke).toBeGreaterThan(0);expect(peakBlasts).toBeGreaterThan(0);
    expect(f.defence.shots).toBeGreaterThan(0);expect(hits).toBeGreaterThan(0);expect(f.defence.planner.thinks).toBe(2400);
    expect(f.enemies.states.reduce((sum,s)=>sum+s.impact.hits,0)).toBeGreaterThan(0);
    if(zone!=='C')expect(peakTilt).toBeGreaterThan(.025);expect(peakOffset).toBeGreaterThan(.01);expect(peakOffset).toBeLessThanOrEqual(ENEMY_IMPACT.maxOffset+1e-9);
   }
   expect(coveredLaunches).toBe(0);expect(admitted).toBe(f.defence.missiles.shots);
   expect(f.defence.missiles.pool.hits).toBe(hits);
   const time=f.defence.missiles.states[0].cycle.time;
   f.damage.reset(true);f.defence.resetTargets();f.enemies.reset();
   expect(f.damage.activeSmoke+f.damage.activeBlasts+f.damage.activeCubes+f.damage.launches+f.damage.missileImpacts).toBe(0);
   expect(f.defence.missiles.states[0].cycle.time).toBe(time);
   expect(f.defence.missiles.thrust.instanceCount).toBe(0);
   expect(f.defence.missiles.pool.orphaned).toBe(0);expect(f.defence.missiles.pool.completedAtLastPosition).toBe(0);
   expect(missileActorsForLevel(f.world.level.id).filter(a=>f.visible.get(a.id))).toHaveLength(12);
   expect(f.enemies.states.every(s=>s.health.current===s.health.maximum)).toBe(true);
   expect(f.enemies.states.every(s=>pool.incomingDamage(s)===0)).toBe(true);
   expect(f.enemies.states.every(s=>!s.impact.active&&s.impact.offsetX===0&&s.impact.offsetZ===0&&s.impact.pitch===0&&s.impact.roll===0&&s.impact.bob===0&&s.impact.hits===0)).toBe(true);
  }finally{f.dispose();}
  expect(f.world.actors.size).toBe(0);expect(f.world.assetIds).toHaveLength(0);expect(f.defence.states).toHaveLength(0);
 }
});

test('mixed missile, Arc and gun families share one thinker and never forecast guided damage',async()=>{
 const f=await fixture('A',true);try{
  const p=f.defence.planner;
  expect(f.defence.missiles.planner).toBe(p);expect(f.defence.arcs.planner).toBe(p);expect(f.defence.turrets.planner).toBe(p);
  for(let frame=0;frame<600;frame++){f.enemies.advance(1/60);f.defence.advance(1/60);expect(p.thinks).toBe(frame+1);}
  expect(f.defence.states).toHaveLength(3);
  for(let i=0;i<f.defence.states.length;i++){
   const state=f.defence.states[i];expect(state.thinkCount).toBe(200);
   if(state.model==='missile-launcher')for(const target of f.enemies.states)expect(p.capacity(i,target)).toBe(0);
  }
 }finally{f.dispose();}
});

test('silo lights survive missile visibility changes and stay within the existing enemy-light budget',async()=>{
 for(const zone of ['A','B','C','D']){
  const f=await fixture(zone);let lights;
  try{
   const draws=new Map(f.world.entries.map(entry=>{
    const transforms=new Float32Array(entry.transforms.length*16),indexToSlot=new Int32Array(entry.transforms.length);
    entry.transforms.forEach((m,i)=>{transforms.set(m,i*16);indexToSlot[i]=i;});
    return [entry.key,{transforms,indexToSlot}];
   }));
   lights=new ModelLights(f.world.entries,draws);lights.prepare();
   const expected=zone==='A'?19:zone==='C'?7:zone==='D'?8:13;
   expect(lights.count).toBe(expected);expect(lights.overflow).toBe(0);
   for(const data of f.world.actors.values())if(data.model==='guided-missile')for(const instance of data.instances){
    expect(lights.keys.has(instance.key)).toBe(false);
    draws.get(instance.key).indexToSlot[instance.index]=-1;lights.invalidate(instance.key);
   }
   lights.prepare();expect(lights.count).toBe(expected);
   for(const state of f.enemies.states)for(const instance of f.world.actors.get(state.id).instances){
    draws.get(instance.key).indexToSlot[instance.index]=-1;lights.invalidate(instance.key);
   }
   lights.prepare();expect(lights.count).toBe(3);
  }finally{lights?.dispose();f.dispose();}
 }
});

test('missile contacts gib ground and perched/flying birds within 72 units despite a full blast pool, retaining the 48 unit fright event',async()=>{
 expect(CRITTER_GIB.missileRadius).toBe(72);expect(MISSILE_IMPACT_EFFECT.frightRadius).toBe(48);
 for(const mode of ['ground','perched','flying']){
  const f=await fixture('A'),p=f.wildlife,s=p.states[mode==='ground'?0:3],events=p.explosions;
  try{
   if(mode==='flying'){
    for(let frame=0;frame<6000&&!s.flight;frame++)p.advance(1/60);
    expect(s.flight).toBe(true);p.moveBird(s,s.duration*.25);
   }else s.readyAt=p.time+60;
   for(let i=0;i<MAX_BLASTS;i++)f.damage.explode(f.enemies.states[0]);
   const x=s.x+CRITTER_GIB.missileRadius,y=s.y+s.centerOffset,z=s.z,thinks=p.thinkCount,before=s.spooks;
   expect(emitMissileImpact(f.damage,p,x+.001,y,z,0,1,0)).toBeNull();expect(s.dead).toBe(false);
   expect(emitMissileImpact(f.damage,p,x,y,z,0,1,0)).toBeNull();expect(f.damage.droppedMissileBlasts).toBe(2);expect(s.dead).toBe(true);
   expect(p.explosionEvents).toBe(2);expect(p.thinkCount).toBe(thinks);expect(Array.from(events.subarray(5,9))).toEqual([x,y,z,MISSILE_IMPACT_EFFECT.frightRadius]);
   const position=[s.x,s.y,s.z],bursts=f.damage.critterBursts;p.thinker=p.states.indexOf(s);p.advance(.000001);
   expect(p.thinkCount).toBe(thinks);expect(s.frightened).toBe(false);expect(s.spooks).toBe(before);expect([s.x,s.y,s.z]).toEqual(position);expect(p.explosions).toBe(events);
   emitMissileImpact(f.damage,p,x,y,z,0,1,0);expect(f.damage.critterBursts).toBe(bursts);
  }finally{f.dispose();}
 }
});
