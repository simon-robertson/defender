import {test,expect} from 'bun:test';
import {productionLevel} from '../scripts/production-level.js';
import {wildlifeModels} from '../scripts/wildlife-models.js';
import {fishModel} from '../scripts/fish-model.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {emitMissileImpact} from '../game/missile-impact.js';
import {newLevel} from '../shared/level.js';
import {MAX_DEBRIS,MAX_DAMAGE_CUBES,MAX_CRITTERS,MAX_CRITTER_DEBRIS,CRITTER_FRAGMENTS,CRITTER_SPRAY,CRITTER_GIB,BLOOD_DECAL_OFFSET,critterShockwaveImpulse} from '../shared/damage-effects.js';
import {ENEMY_STATS} from '../shared/enemy.js';
const level=productionLevel('A'),models=new Map(await Promise.all([...new Set(level.placements.map(p=>p.model))].map(async id=>[id,await Bun.file(`assets/models/${id}.json`).json()])));
for(const model of wildlifeModels())models.set(model.id,model);
function fixture(){
 const world=buildWorld(structuredClone(level),models,{actors:wildlifeActorsForLevel(level.id)}),visibility=[],wildlife=new WildlifePreview(world,()=>{},wildlifeActorsForLevel(level.id),(id,visible)=>visibility.push([id,visible])),damage=new DamageEffects(()=>.5);damage.setWorld(world,[]);
 return {world,wildlife,damage,visibility,dispose(){damage.reset();wildlife.dispose();disposeWorld(world);}};
}
const palette=new Float32Array([.4,.2,.1,1]);
function effects(){const damage=new DamageEffects(()=>.5);damage.setWorld({visibility:{bounds:new Float32Array([-2000,0,-2000,2000,24,2000]),escape:new Uint32Array([1]),nodeCount:1}},[]);return damage;}
test('critter blast radii include exact 3D boundaries without a body-radius allowance, for ground and birds',()=>{
 expect([CRITTER_GIB.enemyRadius,CRITTER_GIB.missileRadius]).toEqual([33.6,72]);
 for(const kind of ['ground','bird'])for(const radius of [CRITTER_GIB.enemyRadius,CRITTER_GIB.missileRadius]){
  const f=fixture(),s=f.wildlife.states.find(s=>s.kind===kind),y=s.y+s.centerOffset;
  try{
   f.wildlife.gibExplosion(s.x,y+radius+.001,s.z,radius,f.damage);expect(s.dead).toBe(false);
   expect(f.wildlife.gibExplosion(s.x,y+radius,s.z,radius,f.damage)).toBeGreaterThanOrEqual(1);expect(s.dead).toBe(true);expect(f.visibility).toContainEqual([s.id,false]);
   const bursts=f.damage.critterBursts;f.wildlife.gibExplosion(s.x,y+radius,s.z,radius,f.damage);expect(f.damage.critterBursts).toBe(bursts);expect(s.health).toBeUndefined();
  }finally{f.dispose();}
 }
});
test('missile physical contacts gib fish at 72 units even if the visual blast pool is full',()=>{
 const level=newLevel('gib-fish');level.size=[8,6];level.previewMode='landscape';for(let z=1;z<5;z++)for(let x=1;x<7;x++)level.terrain.boxes.push({box:[x,z],ground:2,water:12});
 const world=buildWorld(level,new Map([['wildlife-fish',fishModel()]]),{includeFish:true}),hidden=[],wildlife=new WildlifePreview(world,()=>{},[],(id,shown)=>hidden.push([id,shown])),damage=new DamageEffects(()=>.5);damage.setWorld(world,[]);
 try{
  for(let i=0;i<4;i++){const b=damage.reserveBlast('death');b.age=0;b.config=ENEMY_STATS.dog.explosion;}
  const s=wildlife.fish.states[0],y=s.y+2;expect(emitMissileImpact(damage,wildlife,s.x,y+72.001,s.z,0,1,0)).toBeNull();expect(s.dead).toBe(false);expect(emitMissileImpact(damage,wildlife,s.x,y+72,s.z,0,1,0)).toBeNull();expect(s.dead).toBe(true);expect(hidden).toContainEqual([s.id,false]);expect(damage.activeCubes).toBeGreaterThan(0);expect(damage.cubes.filter(p=>p.active).every(p=>p.waterEntered)).toBe(true);expect(damage.waterImpacts.entries).toBe(0);
  const before=[s.x,s.y,s.z];for(let i=0;i<300;i++)wildlife.advance(1/60);expect([s.x,s.y,s.z]).toEqual(before);
  wildlife.prepareCritterRun();expect(s.dead).toBe(false);expect(world.fishHabitat.component[s.node]).toBe(s.pool);expect(hidden).toContainEqual([s.id,true]);
 }finally{damage.reset();wildlife.dispose();disposeWorld(world);}
});
test('fragments and persistent solid spray leave in the 3D blast direction and reuse actual model colours',()=>{
 for(const blast of [[-5,30,0],[0,60,0],[0,24,0]]){
  const d=effects(),s={x:0,y:28,z:0,centerOffset:2};d.gibCritter(s,palette,...blast);d.prepare();expect(d.cubeCount).toBe(CRITTER_FRAGMENTS+CRITTER_SPRAY);expect(d.activeSmoke+d.activeBlasts).toBe(0);
  const parts=d.cubes.filter(p=>p.active);expect(parts.filter(p=>p.spray)).toHaveLength(CRITTER_SPRAY);
  for(const p of parts){expect(p.vx*(s.x-blast[0])+p.vy*(s.y+2-blast[1])+p.vz*(s.z-blast[2])).toBeGreaterThan(0);if(!p.spray)expect([p.r,p.g,p.b]).toEqual(Array.from(palette.slice(0,3)));expect(p.config.gravity).toBe(60);}
  d.advance(.1);d.prepare();for(const p of parts)expect(Number.isFinite(p.x+p.y+p.z+p.vx+p.vy+p.vz)).toBe(true);
 }
});
test('all 24 critters retain all 1152 remains alongside full enemy storage until a 2 second run-end fade',()=>{
 const d=effects(),pool=d.cubes,storage=d.cubeData;
 for(let i=0;i<MAX_DEBRIS;i++)Object.assign(d.cubes[i],{active:true,resting:true,restAge:0,config:ENEMY_STATS.dog.explosion});d.activeCubes=MAX_DEBRIS;
 for(let i=0;i<MAX_CRITTERS;i++)d.gibCritter({x:i*3,y:28,z:0,centerOffset:2},palette,-30,30,0);
 d.prepare();expect(d.cubeCount).toBe(MAX_DAMAGE_CUBES);expect(d.droppedCritterCubes).toBe(0);
 const remains=d.cubes.slice(MAX_DEBRIS),origins=remains.map(p=>p.x);d.gibCritter({x:99,y:30,z:0},palette,0,30,0);expect(d.droppedCritterCubes).toBe(CRITTER_FRAGMENTS+CRITTER_SPRAY);expect(remains.map(p=>p.x)).toEqual(origins);
 for(let i=0;i<1200;i++)d.advance(1/120);d.prepare();expect(d.activeCubes).toBe(MAX_CRITTER_DEBRIS);expect(remains.every(p=>p.active&&p.fade===1&&p.resting)).toBe(true);
 for(const p of remains){expect(p.decal?p.y-BLOOD_DECAL_OFFSET:p.y-p.size/2).toBeCloseTo(24,5);expect([p.x,p.y,p.z,p.rx,p.ry,p.rz].every(Number.isFinite)).toBe(true);}
 const snapshot=storage.slice();d.advance(0);d.prepare();expect(storage).toEqual(snapshot);d.endCritterRun();d.advance(1);d.prepare();expect(remains.every(p=>Math.abs(p.fade-.5)<1e-9)).toBe(true);expect(d.cubeData[19]-(d.cubes.find(p=>p.active)?.decal?2:0)).toBeCloseTo(.5,5);
 d.endCritterRun();d.advance(1);d.prepare();expect(d.activeCubes+d.cubeCount).toBe(0);expect(d.cubes).toBe(pool);expect(d.cubeData).toBe(storage);
 d.reset();expect(d.critterFadeAt).toBeNull();expect(d.critterBursts).toBe(0);expect(d.visibility).toBeNull();expect(d.cubes.every(p=>!p.active&&!p.critter&&p.config===null)).toBe(true);
});
test('wave preparation safely restores dead ground/perched/flying actors without replacing rig or route storage',()=>{
 const f=fixture();try{
  for(let i=0;i<300;i++)f.wildlife.advance(1/60);
  const states=f.wildlife.states,rigs=states.map(s=>s.rig),routes=states.map(s=>s.route);expect(f.wildlife.gibExplosion(0,0,0,10000,f.damage)).toBe(6);
  const positions=states.map(s=>[s.x,s.y,s.z]);for(let i=0;i<600;i++)f.wildlife.advance(1/60);expect(states.map(s=>[s.x,s.y,s.z])).toEqual(positions);
  f.wildlife.prepareCritterRun();for(let i=0;i<states.length;i++){const s=states[i];expect(s.dead).toBe(false);expect(s.rig).toBe(rigs[i]);expect(s.route).toBe(routes[i]);expect(f.visibility).toContainEqual([s.id,true]);if(s.kind==='ground'){const n=f.wildlife.nav,c=n.component[s.node];expect(n.heights[s.node]).toBe(s.y);expect(n.starts[c+1]-n.starts[c]).toBeGreaterThanOrEqual(64);}else{expect(s.phase).toBe('perched');expect(f.wildlife.perches[s.perch].y).toBe(s.y);}}
  for(let i=0;i<900;i++)f.wildlife.advance(1/60);expect(states.some(s=>s.journeysCompleted>0)).toBe(true);
 }finally{f.dispose();}
});
test('late settling gibs stay fully opaque until preparation explicitly begins the fade',()=>{
 const d=effects();d.advance(2.5);d.gibCritter({x:0,y:30,z:0},palette,-10,30,0);const parts=d.cubes.filter(p=>p.active);
 d.advance(4);d.prepare();expect(parts.every(p=>p.active&&p.fade===1&&p.fadeStart===null)).toBe(true);
 d.endCritterRun();d.advance(1);expect(parts.every(p=>Math.abs(p.fade-.5)<1e-8)).toBe(true);d.advance(1);d.prepare();expect(d.activeCubes+d.cubeCount).toBe(0);
});

test('critter gore doubles both burst components and adds a stronger outward impulse without extra blast lights',()=>{
 const d=effects();d.gibCritter({x:0,y:28,z:0,centerOffset:2},palette,-5,30,0);
 const fragments=d.cubes.filter(p=>p.active&&!p.spray),spray=d.cubes.filter(p=>p.active&&p.spray);
 expect(fragments).toHaveLength(16);expect(spray).toHaveLength(32);
 expect(fragments[0].vx).toBeCloseTo(27.5*1.3+critterShockwaveImpulse(5,CRITTER_GIB.enemyRadius),8);expect(spray[0].vx).toBeCloseTo(34.5*1.3+critterShockwaveImpulse(5,CRITTER_GIB.enemyRadius),8);
 expect(spray[0].vy).toBeCloseTo(16.5*1.25,8);expect(spray[0].size).toBeCloseTo(.46,8);
 expect(spray.every(p=>p.r>p.g*10&&p.r>p.b*10)).toBe(true);
 expect(d.activeBlasts+d.activeSmoke).toBe(0);
});

test('shockwave launch is bounded at the core, strongest nearby and weaker at the inclusive lethal radius',()=>{
 for(const radius of [CRITTER_GIB.enemyRadius,CRITTER_GIB.missileRadius]){
  const velocities=[];
  for(const fraction of [0,.125,.5,1]){
   const distance=radius*fraction,d=effects();d.gibCritter({x:distance,y:28,z:0,centerOffset:2},palette,0,30,0,radius);
   const parts=d.cubes.filter(p=>p.active),fragment=parts[0];expect(parts).toHaveLength(48);
   expect(parts.every(p=>Number.isFinite(p.vx+p.vy+p.vz))).toBe(true);
   const impulse=critterShockwaveImpulse(distance,radius);expect(impulse).toBeGreaterThanOrEqual(32);expect(impulse).toBeLessThanOrEqual(112);
   if(distance){expect(fragment.vx).toBeCloseTo(27.5*1.3+impulse,8);expect(fragment.vy).toBeCloseTo(16.5*1.25,8);velocities.push(fragment.vx);}
  }
  expect(velocities[0]).toBeGreaterThan(velocities[1]);expect(velocities[1]).toBeGreaterThan(velocities[2]);
  expect(critterShockwaveImpulse(0,radius)).toBe(112);expect(critterShockwaveImpulse(radius,radius)).toBe(32);
 }
 expect(critterShockwaveImpulse(24,72)).toBeGreaterThan(critterShockwaveImpulse(24,48));
 for(const args of [[-1,48],[NaN,48],[1,0],[1,Infinity]])expect(()=>critterShockwaveImpulse(...args)).toThrow();
});
test('the actual blast radius reaches the impulse model and vertical blasts push away in 3D',()=>{
 const f=fixture();try{
  const s=f.wildlife.states[0],calls=[],damage={gibCritter:(...args)=>calls.push(args)};
  f.wildlife.gibExplosion(s.x,s.y+s.centerOffset,s.z,72,damage);expect(calls[0][5]).toBe(72);
 }finally{f.dispose();}
 for(const offset of [-6,6]){
  const d=effects();d.gibCritter({x:0,y:28,z:0,centerOffset:2},palette,0,30+offset,0,48);
  const fragment=d.cubes.find(p=>p.active);expect(fragment.vy*(-offset)).toBeGreaterThan(0);
 }
});
