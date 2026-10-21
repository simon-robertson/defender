// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {ENEMY_STATS} from '../shared/enemy.js';
import {ENEMY_EXPANSION_IDS,ENEMY_EXPANSION_RIGS} from '../shared/enemy-expansion-rigs.js';
import {ENEMY_MOVEMENT,MIXED_PREVIEW_ACTORS,DOG_PREVIEW_ACTORS,WALKER_PREVIEW_ACTORS,SPIDER_PREVIEW_ACTORS,previewActorsForLevel} from '../shared/enemy-roster.js';
import {DEFENCE_STATS} from '../shared/defence.js';
import {MISSILE_PHASE} from '../shared/missile-flight.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {DefencePreview} from '../game/defence-preview.js';
import {MISSILE_PREVIEW_ACTORS} from '../game/missile-preview.js';
import {DamageEffects} from '../engine/damage-effects.js';

const sources=new Map();
async function source(id){if(!sources.has(id))sources.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());return sources.get(id);}
function rng(){let value=232;return ()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return(value>>>0)/4294967296;};}
const prefix={A:'moss',B:'ochre',C:'ice',D:'plum'};
const defaults=[['roller',360,16],['dune-tread',420,10],['tripod',280,14],['moth',180,20],['twin-fan',240,18],['ray',220,22],['lantern',260,16]];

test('expanded enemy defaults and finite mixed rosters preserve original values and actor identities',()=>{
 expect(ENEMY_EXPANSION_IDS.slice().sort()).toEqual(defaults.map(r=>r[0]).sort());
 for(const data of [ENEMY_STATS,ENEMY_MOVEMENT,ENEMY_EXPANSION_RIGS])expect(Object.hasOwn(data,'concertina')).toBe(false);
 for(const [id,hp,speed]of defaults){
  const stats=ENEMY_STATS[id],motion=ENEMY_MOVEMENT[id],rig=ENEMY_EXPANSION_RIGS[id];
  expect(stats.maxHealth).toBe(hp);expect(stats.threat).toBe(1);expect(motion.speed).toBe(speed);
  expect(motion.airborne).toBe(rig.movement==='air');expect(motion.altitude).toBe(motion.airborne?36:0);
  expect(stats.effectOrigin).toEqual(rig.effectOrigin);expect(stats.smoke.threshold).toBe(.5);
  for(const value of [stats,stats.effectOrigin,stats.effectOrigin.point,stats.smoke,stats.explosion,motion])expect(Object.isFrozen(value)).toBe(true);
 }
 for(const [zone,legacy,distances]of [['A',DOG_PREVIEW_ACTORS,[72,232,392]],['B',WALKER_PREVIEW_ACTORS,[72,232,720]],['D',SPIDER_PREVIEW_ACTORS,[72,232,624]]]){
  expect(legacy.map(a=>a.distance)).toEqual(distances);expect(MIXED_PREVIEW_ACTORS[zone].slice(0,3)).toEqual(legacy);
  for(let i=0;i<3;i++)expect(MIXED_PREVIEW_ACTORS[zone][i]).toBe(legacy[i]);
  expect(ENEMY_STATS[legacy[0].model].maxHealth).toBe(300);expect(ENEMY_STATS[legacy[0].model].threat).toBe(1);
 }
 for(const zone of Object.keys(prefix)){
  const actors=MIXED_PREVIEW_ACTORS[zone];expect(actors).toHaveLength({A:7,B:7,C:4,D:5}[zone]);expect(Object.isFrozen(actors)).toBe(true);
  expect(actors.some(actor=>actor.model==='concertina')).toBe(false);
  expect(new Set(actors.map(a=>a.id)).size).toBe(actors.length);expect(new Set(actors.map(a=>a.distance)).size).toBe(actors.length);
  expect(actors.filter(a=>ENEMY_MOVEMENT[a.model]?.airborne)).toHaveLength(2);
  for(let number=1;number<=3;number++)expect(previewActorsForLevel(`${prefix[zone]}-0${number}`)).toBe(actors);
  for(const actor of actors){expect(Object.isFrozen(actor)).toBe(true);expect(actor.variant).toBe('base');}
 }
 expect(MIXED_PREVIEW_ACTORS.D.slice(3)).toEqual([
  {id:'preview-lantern-1',model:'lantern',variant:'base',distance:184},
  {id:'preview-lantern-2',model:'lantern',variant:'base',distance:472},
 ]);
 expect(previewActorsForLevel('unknown')).toHaveLength(0);
});

async function fixture(level,actors){
 const runtime=[...actors,...(level.placements.some(p=>p.model==='missile-launcher')?MISSILE_PREVIEW_ACTORS:[])],models=new Map();
 for(const id of new Set([...level.placements.map(p=>p.model),...runtime.map(a=>a.model)]))models.set(id,await source(id));
 const world=buildWorld(level,models,{actors:runtime}),hits=[],deaths=[],visible=new Map(runtime.map(a=>[a.id,true])),damage=new DamageEffects(rng());
 const enemies=new EnemyPreview(world,()=>{},(id,state)=>{deaths.push(id);visible.set(id,false);damage.explode(state);},actors);
 damage.setWorld(world,enemies.states);
 let contactChecks=0;
 const preview=new DefencePreview(world,()=>{},rng(),null,enemies.states,(target,strength,vx,vy,vz)=>{
  const before=target.health.current,applied=enemies.takeHit(target,strength,vx,vy,vz);hits.push({id:target.id,strength,applied,before,vx,vy,vz});return applied;
 },(from,point,normal,_at,matrix,local)=>{
  contactChecks++;expect(normal[0]*(from[0]-point[0])+normal[1]*(from[1]-point[1])+normal[2]*(from[2]-point[2])).toBeGreaterThan(0);
  for(let axis=0;axis<3;axis++)expect(point[axis]).toBeCloseTo(matrix[axis]*local[0]+matrix[4+axis]*local[1]+matrix[8+axis]*local[2]+matrix[12+axis],5);
 },(id,value)=>visible.set(id,value));
 return {world,enemies,preview,damage,hits,deaths,visible,get contactChecks(){return contactChecks;},advance(dt){damage.advance(dt);enemies.advance(dt);preview.advance(dt);},dispose(){preview.dispose();damage.reset();enemies.dispose();disposeWorld(world);}};
}

test('every zone study loads its complete mixed roster with separate route timing, real aim points and one shared thinker',async()=>{
 for(const zone of Object.keys(prefix))for(let number=1;number<=3;number++){
  const id=`${prefix[zone]}-0${number}`,level=await Bun.file(new URL(`../docs/landscape-reset-2026-10-18/previous-levels/${id}.json`,import.meta.url)).json(),actors=previewActorsForLevel(id),f=await fixture(level,actors);
  try{
   expect(f.enemies.states.map(s=>s.model)).toEqual(actors.map(a=>a.model));expect(f.preview.planner.targets).toBe(f.enemies.states);
   for(const target of f.enemies.states){
    const movement=ENEMY_MOVEMENT[target.model],original={dog:12,walker:18,spider:12}[target.model];
    expect(target.movement.speed).toBe(movement?.speed??original);expect(target.loopSeconds).toBe(target.path.length/target.movement.speed);
    // Historical catalogue seeds can exceed a later archived route's length;
    // legacy previews wrap them, retaining the corresponding lap identity.
    expect(target.seed).toBe(actors.find(a=>a.id===target.id).distance);expect(target.distance).toBeCloseTo(target.seed%target.path.length,8);expect(target.lap).toBe(Math.floor(target.seed/target.path.length));expect(target.health.current).toBe(ENEMY_STATS[target.model].maxHealth);
    const config=ENEMY_STATS[target.model].effectOrigin,m=target.rig.byId.get(config.part).instance.matrix,p=config.point;
    expect([target.aimX,target.aimY,target.aimZ]).toEqual([m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]);
    if(movement?.airborne)expect(target.rig.root[13]).toBe(level.pathHeight+36);
   }
   for(let frame=0;frame<12;frame++)f.advance(1/60);
   expect(f.preview.planner.thinks).toBe(12);expect(f.preview.states.map(s=>s.thinkCount)).toEqual([4,4,4]);
   for(const target of f.enemies.states){const travel=target.seed+.2*target.movement.speed;expect(target.distance).toBeCloseTo(travel%target.path.length,8);expect(target.lap).toBe(Math.floor(travel/target.path.length));expect([target.x,target.z,target.aimX,target.aimY,target.aimZ,target.aimVelocityX,target.aimVelocityY,target.aimVelocityZ].every(Number.isFinite)).toBe(true);}
  }finally{f.dispose();}
  expect(f.world.actors.size+f.world.rigs.size).toBe(0);expect(f.preview.states).toHaveLength(0);expect(f.enemies.states).toHaveLength(0);
 }
});

function combatLevel(family){
 const level=newLevel('expanded-enemy-combat');level.size=[20,6];level.path=Array.from({length:20},(_,x)=>[x,0,2]);
 level.placements=[{id:'test-defence',model:family,variant:'upgrade1',box:[4,0,3],turn:0}];return level;
}
for(const family of ['turret-study','arc-spire','missile-launcher'])test(`real ${family} attacks reach all seven active new enemy meshes, kill once and reset without stale claims`,async()=>{
 for(const model of ENEMY_EXPANSION_IDS){
  const actors=[{id:'test-'+model,model,variant:'base',distance:72}],f=await fixture(combatLevel(family),actors);
  try{
   const target=f.enemies.states[0],weapon=f.preview.states[0],strength=DEFENCE_STATS[family].upgrade1.strength,initial=target.rig.bones.map(b=>b.instance.matrix.slice()),refs=target.rig.bones.map(b=>b.instance.matrix);
   // Leave one full configured attack of HP: physical delivery must cause the
   // death, independently of how many route laps a full-health balance trial takes.
   target.health.takeDamage(target.health.current-strength);
   let launches=0;
   const pool=f.preview.missiles.pool;
   if(pool){
    const launch=pool.launch.bind(pool);
    pool.launch=(index,enemy,amount)=>{
     const before=pool.incomingDamage(enemy),accepted=launch(index,enemy,amount);
     if(accepted){launches++;expect(before).toBeLessThan(enemy.health.current);expect(amount).toBe(strength);expect(pool.incomingDamage(enemy)-before).toBe(strength);}
     return accepted;
    };
   }
   let frames=0;
   for(;frames<3600&&target.health.alive;frames++)f.advance(1/60);
   expect(frames).toBeLessThan(3600);expect(f.preview.planner.thinks).toBe(frames);
   expect(f.hits).toHaveLength(1);expect(f.hits[0].strength).toBe(strength);expect(f.hits[0].applied).toBe(strength);expect(target.health.current).toBe(0);
   expect(f.deaths).toEqual([target.id]);expect(f.visible.get(target.id)).toBe(false);expect(f.enemies.alive).toBe(0);
   expect(f.damage.activeBlasts).toBe(1);const blast=f.damage.blasts.find(b=>b.active);expect([blast.x,blast.y,blast.z]).toEqual([target.aimX,target.aimY,target.aimZ]);
   if(family==='turret-study'){
    expect(weapon.lastShotVisible).toBe(true);expect(weapon.lastShotDistance).toBeLessThanOrEqual(weapon.maxRange);
    expect(Math.abs(weapon.pitch.angle)).toBeLessThanOrEqual(35*Math.PI/180+1e-8);expect(Math.abs(weapon.lastShotPitchError)).toBeLessThanOrEqual(2*Math.PI/180);
    if(ENEMY_MOVEMENT[model].airborne)expect(weapon.gunMatrix[9]).not.toBe(0);
   }else if(family==='arc-spire')expect(f.contactChecks).toBe(1);
   else{
    expect(launches).toBeGreaterThan(0);expect(pool.hits).toBe(1);expect(pool.incomingDamage(target)).toBe(0);
    expect([f.hits[0].vx,f.hits[0].vy,f.hits[0].vz].every(Number.isFinite)).toBe(true);expect(Math.hypot(f.hits[0].vx,f.hits[0].vy,f.hits[0].vz)).toBeGreaterThan(0);
   }
   const deathPose=target.rig.bones.map(b=>b.instance.matrix.slice());f.advance(.2);expect(f.deaths).toHaveLength(1);expect(f.hits).toHaveLength(1);
   expect(target.rig.bones.map(b=>b.instance.matrix)).toEqual(deathPose);
   f.damage.reset(true);f.enemies.reset();f.preview.resetTargets();
   expect(target.health.current).toBe(ENEMY_STATS[model].maxHealth);expect(target.health.hits).toBe(0);expect(target.distance).toBe(72);
   expect(f.preview.planner.thinks).toBe(0);expect(weapon.target).toBeNull();expect(weapon.reservation).toBeNull();expect(f.damage.activeBlasts+f.damage.activeCubes+f.damage.activeSmoke).toBe(0);
   for(let i=0;i<refs.length;i++){expect(target.rig.bones[i].instance.matrix).toBe(refs[i]);expect(refs[i]).toEqual(initial[i]);}
   if(pool){expect(pool.incomingDamage(target)).toBe(0);expect(pool.slots.some(s=>s.phase>=MISSILE_PHASE.BOOST)).toBe(false);expect(weapon.ammo).toBe(4);}
  }finally{f.dispose();}
  expect(f.world.actors.size+f.world.rigs.size).toBe(0);expect(f.preview.states).toHaveLength(0);expect(f.enemies.states).toHaveLength(0);
 }
});
