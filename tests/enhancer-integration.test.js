// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {DEFENCE_STATS} from '../shared/defence.js';
import {TURRET_FIRING,ARC_SPIRE_FIRING} from '../shared/arsenal.js';
import {MISSILE_FIRING,MISSILE_PHASE} from '../shared/missile-flight.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {DefencePreview} from '../game/defence-preview.js';
import {MISSILE_PREVIEW_ACTORS} from '../game/missile-preview.js';

const sources=new Map();
function rng(){let value=1234567;return ()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return (value>>>0)/4294967296;};}
async function fixture(level,actors=previewActorsForLevel(level.id)){
 const hasMissiles=level.placements.some(p=>p.model==='missile-launcher');
 const runtimeActors=[...actors,...(hasMissiles?MISSILE_PREVIEW_ACTORS:[])],models=new Map();
 for(const id of new Set([...level.placements.map(p=>p.model),...runtimeActors.map(p=>p.model)])){
  if(!sources.has(id))sources.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
  models.set(id,sources.get(id));
 }
 const world=buildWorld(level,models,{actors:runtimeActors}),enemies=new EnemyPreview(world,()=>{},null,actors),hits=[];
 const preview=new DefencePreview(world,()=>{},rng(),null,enemies.states,(target,strength,vx,vy,vz)=>{
  const before=target.health.current,applied=enemies.takeHit(target,strength,vx,vy,vz);
  hits.push({target,strength,applied,before,after:target.health.current});return applied;
 },null,()=>{});
 return {world,enemies,preview,hits,advance(dt){enemies.advance(dt);preview.advance(dt);},dispose(){preview.dispose();enemies.dispose();disposeWorld(world);}};
}
function mixedLevel({generator=true,overlap=false}={}){
 const level=newLevel('enhancer-integration');level.size=[10,8];level.path=Array.from({length:10},(_,x)=>[x,0,1]);
 const site=(id,model,variant,x,z)=>({id,model,variant,box:[x,0,z],turn:0});
 level.placements=[
  site('west-gun','turret-study','upgrade1',2,3),site('south-gun','turret-study','base',3,4),
  site('diagonal-gun','turret-study','base',4,4),site('north-arc','arc-spire','base',3,2),
  site('distant-arc','arc-spire','base',3,5),site('east-silo','missile-launcher','base',4,3),
 ];
 if(generator)level.placements.push(site('generator','power-generator','base',3,3));
 if(overlap){
  level.placements.push(site('other-generator','power-generator','base',1,3));
  // Upgrade strength data exists, but its activation area is still unassigned.
  level.placements.push(site('inactive-upgrade','power-generator','upgrade2',5,4));
 }
 return level;
}
const enemyActors=[{id:'study-dog',model:'dog',variant:'base',distance:48}];
const byId=preview=>new Map(preview.states.map(s=>[s.id,s]));

test('the saved A1 generator boosts only the first turret actual damage and survives R without compounding',async()=>{
 const level=await Bun.file(new URL('../project-docs/level-rebuild-2026-10-18/previous-levels/moss-01.json',import.meta.url)).json(),before=JSON.stringify(level),stats=JSON.stringify(DEFENCE_STATS),f=await fixture(level);
 try{
  const generators=level.placements.filter(p=>p.model==='power-generator'),guns=level.placements.filter(p=>p.model==='turret-study');
  expect(generators).toHaveLength(1);expect(guns).toHaveLength(3);expect(f.preview.turrets.states).toHaveLength(3);
  const generator=generators[0],recipients=guns.filter(p=>p.box[1]===generator.box[1]&&Math.abs(p.box[0]-generator.box[0])+Math.abs(p.box[2]-generator.box[2])===1);
  expect(generator.variant).toBe('base');expect(recipients).toHaveLength(1);expect(recipients[0].variant).toBe('base');
  const first=f.preview.turrets.states.find(s=>s.id===recipients[0].id),middle=f.preview.turrets.states.find(s=>s.variant==='upgrade1'),last=f.preview.turrets.states.find(s=>s.variant==='base'&&s!==first);
  expect([first.variant,middle.variant,last.variant]).toEqual(['base','upgrade1','base']);
  expect(f.preview.enhancers.states).toHaveLength(1);expect(f.preview.enhancers.states[0].id).toBe(generator.id);expect(f.preview.enhancers.states[0].recipientIds).toEqual([first.id]);
  expect([first.baseStrength,middle.baseStrength,last.baseStrength]).toEqual([10,12,10]);
  expect([first.strength,middle.strength,last.strength]).toEqual([12.5,12,10]);
  expect([first.strengthIncrease,middle.strengthIncrease,last.strengthIncrease]).toEqual([.25,0,0]);
  let frames=0;
  for(;frames<2400&&!f.preview.states.every(s=>s.cycle.shots>0);frames++)f.advance(1/60);
  expect(frames).toBeLessThan(2400);expect(f.preview.planner.thinks).toBe(frames);
  expect(first.lastShotDamage).toBe(12.5);expect(middle.lastShotDamage).toBe(12);expect(last.lastShotDamage).toBe(10);
  for(const hit of f.hits)expect(hit.before-hit.after).toBeCloseTo(hit.applied,10);
  for(let reset=0;reset<3;reset++){
   const rules=f.preview.states.map(s=>s.cycle.rule),clock=first.cycle.time,shotCount=first.cycle.shots;
   f.preview.resetTargets();f.enemies.reset();
   expect([first.strength,middle.strength,last.strength]).toEqual([12.5,12,10]);expect(first.cycle.time).toBe(clock);
   expect(f.preview.planner.thinks).toBe(0);expect(f.preview.states.map(s=>s.cycle.rule)).toEqual(rules);
   for(let frame=0;frame<240&&first.cycle.shots===shotCount;frame++)f.advance(1/60);
   expect(first.cycle.shots).toBeGreaterThan(shotCount);expect(first.lastShotDamage).toBe(12.5);
  }
  expect(JSON.stringify(level)).toBe(before);expect(JSON.stringify(DEFENCE_STATS)).toBe(stats);
 }finally{f.dispose();}
 expect(f.world.rigs.size+f.world.actors.size).toBe(0);expect(f.preview.states).toHaveLength(0);
});

test('cardinal generator coverage reaches real gun, Arc and missile attacks without changing weapon timing or forecasts twice',async()=>{
 const f=await fixture(mixedLevel(),enemyActors),control=await fixture(mixedLevel({generator:false}),enemyActors);
 try{
  const states=byId(f.preview),baseline=byId(control.preview),gun=states.get('west-gun'),arc=states.get('north-arc'),silo=states.get('east-silo'),target=f.enemies.states[0],pool=f.preview.missiles.pool,slots=pool.slots;
  expect(f.preview.enhancers.states[0].recipientIds.slice().sort()).toEqual(['east-silo','north-arc','south-gun','west-gun']);
  expect(f.preview.states).toHaveLength(6);expect(f.preview.planner.states).toBe(f.preview.states);
  for(const [id,state]of states){
   const original=baseline.get(id),boost=['west-gun','south-gun','north-arc','east-silo'].includes(id)?1.25:1;
   expect(state.strength).toBeCloseTo(original.strength*boost,10);expect(state.baseStrength).toBe(original.strength);
   expect(state.maxRange).toBe(original.maxRange);expect(state.targeting.maxRange).toBe(original.targeting.maxRange);expect(state.requiresLineOfSight).toBe(original.requiresLineOfSight);
   expect(state.cycle.rule).toBe(original.cycle.rule);expect(state.cycle.readyAt).toBe(original.cycle.readyAt);
  }
  expect(gun.cycle.rule).toBe(TURRET_FIRING.upgrade1);expect(arc.cycle.rule).toBe(ARC_SPIRE_FIRING.base);expect(silo.cycle.rule).toBe(MISSILE_FIRING.base.cycle);
  expect(silo.rule).toBe(MISSILE_FIRING.base);expect(silo.ammo).toBe(2);expect(silo.rule.reload).toBe(baseline.get('east-silo').rule.reload);
  const gunIndex=f.preview.states.indexOf(gun),plainIndex=control.preview.states.indexOf(baseline.get('west-gun')),plainCapacity=control.preview.planner.capacity(plainIndex,control.enemies.states[0]);
  expect(plainCapacity).toBeGreaterThan(0);expect(f.preview.planner.capacity(gunIndex,target)).toBeCloseTo(plainCapacity*1.25,8);
  expect(f.preview.planner.capacity(f.preview.states.indexOf(arc),target)).toBe(0);expect(f.preview.planner.capacity(f.preview.states.indexOf(silo),target)).toBe(0);
  const claims=[],launch=pool.launch.bind(pool);
  pool.launch=(index,enemy,strength)=>{
   const before=pool.incomingDamage(enemy),accepted=launch(index,enemy,strength);
   if(accepted){expect(strength).toBe(75);expect(pool.slots[index].strength).toBe(75);expect(pool.incomingDamage(enemy)-before).toBe(75);claims.push(pool.slots[index]);}
   return accepted;
  };
  let frames=0;
  for(;frames<180&&(!f.hits.some(h=>Math.abs(h.strength-15)<1e-9)||!f.hits.some(h=>h.strength===37.5)||!claims.length);frames++)f.advance(1/60);
  expect(frames).toBeLessThan(180);expect(f.preview.planner.thinks).toBe(frames);
  expect(gun.lastShotDamage).toBeCloseTo(15,10);expect(arc.lastShotDamage).toBe(37.5);expect(claims.length).toBeGreaterThan(0);
  for(const strength of [15,37.5]){const hit=f.hits.find(h=>Math.abs(h.strength-strength)<1e-9);expect(hit.applied).toBeCloseTo(strength,10);expect(hit.before-hit.after).toBeCloseTo(strength,10);}
  const active=slots.filter(s=>s.target===target&&s.phase>=MISSILE_PHASE.BOOST&&!s.passedAim&&!s.orphaned),incoming=active.reduce((sum,s)=>sum+s.strength,0);
  expect(incoming).toBeGreaterThan(0);expect(pool.incomingDamage(target)).toBe(incoming);expect(f.preview.planner.residualHealth(target)).toBeCloseTo(Math.max(0,target.health.current-incoming),10);
  expect(pool.slots).toBe(slots);expect(slots).toHaveLength(36);
  for(const state of f.preview.states){expect(state.thinkCount).toBeGreaterThanOrEqual(Math.floor(frames/6));expect(state.thinkCount).toBeLessThanOrEqual(Math.ceil(frames/6));}
  expect(silo.ammo+silo.cycle.shots).toBe(silo.capacity);expect(silo.reloading).toBe(silo.ammo===0);
  expect(silo.cycle.readyAt-silo.cycle.lastShotAt).toBeCloseTo(MISSILE_FIRING.base.gap,12);
  for(let frame=0;frame<360&&!f.hits.some(h=>h.strength===75);frame++)f.advance(1/60);
  const missileHit=f.hits.find(h=>h.strength===75);expect(missileHit).toBeDefined();expect(missileHit.applied).toBe(75);expect(missileHit.before-missileHit.after).toBe(75);
  expect(pool.hits).toBeGreaterThan(0);expect(pool.slots).toBe(slots);
  f.preview.resetTargets();f.enemies.reset();expect(pool.incomingDamage(target)).toBe(0);expect(pool.slots).toBe(slots);expect(silo.ammo).toBe(2);
  expect(gun.strength).toBeCloseTo(15,10);expect(arc.strength).toBe(37.5);expect(silo.strength).toBe(75);
  expect(f.preview.planner.thinks).toBe(0);
 }finally{f.dispose();control.dispose();}
});

test('overlapping production generators apply one bonus and unassigned upgrade coverage stays inactive',async()=>{
 const f=await fixture(mixedLevel({overlap:true}),enemyActors),states=byId(f.preview),enhancers=f.preview.enhancers,weapons=[...f.preview.states];
 try{
  expect(enhancers.states).toHaveLength(3);expect(enhancers.states.find(s=>s.id==='inactive-upgrade').active).toBe(false);
  expect(states.get('west-gun').strength).toBeCloseTo(15,10);expect(states.get('west-gun').strengthIncrease).toBe(.25);
  expect(states.get('diagonal-gun').strength).toBe(10);expect(states.get('distant-arc').strength).toBe(30);
  for(const state of f.preview.states)expect(state.model==='power-generator').toBe(false);
  for(let i=0;i<3;i++){f.preview.resetTargets();expect(states.get('west-gun').strength).toBeCloseTo(15,10);expect(states.get('diagonal-gun').strength).toBe(10);}
 }finally{f.dispose();}
 expect(enhancers.states).toHaveLength(0);for(const state of weapons)expect(state.strength).toBe(state.baseStrength);
 expect(f.world.rigs.size+f.world.actors.size).toBe(0);expect(f.preview.states).toHaveLength(0);
});
