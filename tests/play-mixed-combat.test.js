import {test,expect} from 'bun:test';
import {PLAY_CONFIG,validatePlayConfig,playCapacity} from '../play/config.js';
import {PlayEngine,loadPlayWorld,disposePlayWorld} from '../play/engine.js';
import {waveActors} from '../play/enemies.js';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {createMissileActors} from '../game/missile-preview.js';
import {MissilePreview} from '../game/missile-preview.js';
import {enemyRouteEnvelope,defenceMovementShapes,createPlacementRules} from '../play/placement.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {ENEMY_STATS} from '../shared/enemy.js';
import {ModelLights} from '../engine/model-lights.js';

const models=new Map(await Promise.all(['dog','roller','moth','turret-study','arc-spire','missile-launcher','guided-missile'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
function configFor(spawns,overrides={}){
 const config=structuredClone(PLAY_CONFIG),wave=config.levels[2].waves[0];wave.spawns=spawns.map((s,i)=>({id:'finite-mixed-'+i,at:0,routeId:'main',...s}));wave.enemyOverrides={dog:{maxHealth:80,speed:12},roller:{maxHealth:140,speed:12},moth:{maxHealth:60,speed:20},...overrides};
 validatePlayConfig(config);return {config,wave};
}
function fixture({model='arc-spire',spawns=[{model:'dog'},{model:'roller',at:3},{model:'moth',at:6}],overrides,callbacks={}}={}){
 const {config,wave}=configFor(spawns,overrides),level=newLevel('finite-mixed-test');level.size=[12,8];level.path=Array.from({length:12},(_,x)=>[x,0,3]);
 level.routes=[{id:'eastern',path:[[5,0,0],[5,0,1],[5,0,2],...level.path.slice(5)]}];level.placements=[{id:'finite-weapon',model,variant:'base',box:model==='missile-launcher'?[2,0,0]:[4,0,4],turn:0}];
 const world=buildWorld(level,models,{actors:[...waveActors(wave),...createMissileActors()]}),visible=new Map(),engine=new PlayEngine(world,{config,wave,onVisible:(id,value)=>visible.set(id,value),...callbacks});
 return {world,engine,visible,config,wave,dispose(){engine.dispose();disposeWorld(world);}};
}
function finish(engine,seconds=60,hz=60){for(let i=0;i<seconds*hz&&engine.running;i++)engine.advance(1/hz);}

test('finite mixed species preserve movement, routes, health, lifecycle and active-only contacts',()=>{
 const f=fixture({spawns:[{model:'dog',at:0},{model:'roller',at:1,routeId:'eastern'},{model:'moth',at:2}],overrides:{dog:{maxHealth:40,speed:12},roller:{maxHealth:60,speed:12},moth:{maxHealth:30,speed:20}}});
 try{
  const e=f.engine,[dog,roller,moth]=e.enemies.states;expect(e.enemies.activeTargets).toEqual([]);expect(roller.routeId).toBe('eastern');expect(roller.path.length).not.toBe(dog.path.length);expect(moth.airborne).toBe(true);expect(moth.altitude).toBe(f.config.enemies.moth.altitude);
  e.startWave();expect(e.enemies.takeHit(roller,999)).toBe(0);e.advance(.5);expect(dog.distance).toBeCloseTo(6,8);expect(roller.distance).toBe(0);expect(moth.distance).toBe(0);
  finish(e);expect(e.completed).toBe(true);expect(e.enemies.resolved).toBe(3);expect(e.enemies.killed).toBe(3);expect(e.enemies.escaped).toBe(0);expect(e.firing.arcs.shots).toBeGreaterThan(0);expect(e.firing.planner.targets).toBe(e.enemies.activeTargets);expect(e.enemies.activeTargets).toEqual([]);
  for(const state of e.enemies.states){expect(state.health.alive).toBe(false);expect(f.visible.get(state.id)).toBe(false);expect(e.enemies.takeHit(state,10)).toBe(0);}
  expect(ENEMY_STATS.roller.maxHealth).toBe(360);expect(ENEMY_STATS.moth.maxHealth).toBe(180);
 }finally{f.dispose();}
});

test('play Arc effects use absolute presentation time after preparation and preserve surface attachment',()=>{
 let f;const events=[];f=fixture({spawns:[{model:'dog'}],callbacks:{onArcShot:(from,to,normal,at,matrix,local)=>events.push({at,engineTime:f.engine.time,from:[...from],to:[...to],normal:[...normal],matrix:matrix.slice(),local:[...local]})}});
 try{
  f.engine.advance(25,{combat:false});f.engine.startWave();finish(f.engine);expect(events.length).toBeGreaterThan(0);
  for(const event of events){expect(event.at).toBe(event.engineTime);expect(event.at).toBeGreaterThanOrEqual(25);for(let axis=0;axis<3;axis++)expect(event.to[axis]).toBeCloseTo(event.matrix[axis]*event.local[0]+event.matrix[axis+4]*event.local[1]+event.matrix[axis+8]*event.local[2]+event.matrix[axis+12],4);}
 }finally{f.dispose();}
});

test('Arc surface retries stay with their enemy after active deaths, escapes and later spawns',()=>{
 for(const resolution of ['killed','escaped']){
  const f=fixture({spawns:[{model:'dog'},{model:'dog'},{model:'dog'},{model:'dog',at:1}]});
  try{
   const e=f.engine;e.startWave();
   const arcs=e.firing.arcs,state=arcs.states[0],[first,blocked,other,later]=e.enemies.states;
   expect(arcs.targets).toBe(e.enemies.activeTargets);expect(arcs.targets).toEqual([first,blocked,other]);
   // Isolate contact failure from range and centre LOS. Use the real retry
   // writer and production active-list compaction for both resolution paths.
   state.targeting.rangeSquared=500**2;state.requiresLineOfSight=false;
   state.target=blocked;state.targetLap=blocked.lap;arcs.contacts.sample=()=>false;
   arcs.advance(.01);expect(state.surfaceRejects).toBe(1);expect(arcs.eligible(state,blocked)).toBe(false);
   if(resolution==='killed')e.enemies.takeHit(first,99999);else e.enemies.resolve(first,'escaped');
   expect(arcs.targets).toEqual([blocked,other]);
   expect(arcs.eligible(state,blocked)).toBe(false);expect(arcs.eligible(state,other)).toBe(true);
   e.enemies.resolve(other,'escaped');e.enemies.spawnDue(1);
   expect(arcs.targets).toEqual([blocked,later]);
   expect(arcs.eligible(state,blocked)).toBe(false);expect(arcs.eligible(state,later)).toBe(true);
   arcs.advance(.501);expect(arcs.eligible(state,blocked)).toBe(true);
   state.target=blocked;state.targetLap=blocked.lap;arcs.advance(.01);expect(arcs.eligible(state,blocked)).toBe(false);
   arcs.resetTargets();expect(arcs.eligible(state,blocked)).toBe(true);
  }finally{f.dispose();}
 }
});

test('finite physical missiles seat real actors, delay damage until contact and settle without launching new rounds',()=>{
 let launchCount=0;const f=fixture({model:'missile-launcher',spawns:[{model:'dog'}],overrides:{dog:{maxHealth:80,speed:12}},callbacks:{missileEffects:{onLaunch:()=>launchCount++}}});
 try{
  const e=f.engine;e.startWave();e.advance(1/120);const target=e.enemies.states[0];expect(launchCount).toBe(1);expect(target.health.current).toBe(80);expect(e.firing.missiles.pool.incomingDamage(target)).toBe(f.config.defences['missile-launcher'].variants.base.stats.strength);
  finish(e);expect(e.enemies.killed).toBe(1);expect(e.firing.missiles.pool.hits).toBe(1);expect(e.firing.missiles.states[0].lastHitDamage).toBe(80);
  const launches=launchCount,shots=e.firing.shots;e.advance(4,{combat:false});expect(launchCount).toBe(launches);expect(e.firing.shots).toBe(shots);expect(e.firing.missiles.pool.active).toBe(0);
  e.stopWave();e.startWave();expect(e.firing.missiles.pool.hits).toBe(0);expect(e.enemies.states[0].health.current).toBe(80);expect(e.firing.missiles.pool.slots).toHaveLength(36);
 }finally{f.dispose();}
});

test('real swept voxel envelopes are finite, retain radial-height coupling and contain actual Roller/Moth poses',()=>{
 const f=fixture({spawns:[{model:'roller'},{model:'moth'}]});
 try{
  const actors=waveActors(f.wave),preview=new EnemyPreview(f.world,()=>{},null,actors);
  try{
   for(const state of preview.states){const envelope=enemyRouteEnvelope(models.get(state.model));expect(Number.isFinite(envelope.radius)).toBe(true);expect(envelope.radius).toBeLessThan(15);expect(envelope.layers.every(layer=>Object.values(layer).every(Number.isFinite))).toBe(true);
    for(let frame=0;frame<180;frame++){
     preview.advance(1/120);const c=Math.cos(state.yaw),s=Math.sin(state.yaw);
     for(const bone of state.rig.bones)for(const cell of bone.part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){
      const m=bone.instance.matrix,x=cell[0]+dx,y=cell[1]+dy,z=cell[2]+dz,wx=m[0]*x+m[4]*y+m[8]*z+m[12]-state.x,wy=m[1]*x+m[5]*y+m[9]*z+m[13]-f.world.level.pathHeight,wz=m[2]*x+m[6]*y+m[10]*z+m[14]-state.z;
      const radius=Math.hypot(c*wx-s*wz,s*wx+c*wz);if(!envelope.layers.some(layer=>wy>=layer.bottom-1e-4&&wy<=layer.top+1e-4&&radius<=layer.radius+1e-4))throw new Error(`${state.model} escaped swept voxel envelope at ${frame}`);
     }
    }
   }
  }finally{preview.dispose();}
  for(const model of ['arc-spire','missile-launcher'])for(const variant of ['base','upgrade1','upgrade2'])expect(defenceMovementShapes(models.get(model),variant).every(shape=>shape.bounds.every(Number.isFinite))).toBe(true);
 }finally{f.dispose();}
});

test('deferred play magazines share36physical actors fairly and keep default preview exhaustion explicit',()=>{
 const {config,wave}=configFor([{model:'dog'}]),level=newLevel('moss-03');level.size=[20,16];level.path=Array.from({length:20},(_,x)=>[x,0,14]);level.placements=Array.from({length:8},(_,i)=>({id:'silo-'+i,model:'missile-launcher',variant:'upgrade2',box:[i*2+1,0,2],turn:0}));
 const world=buildWorld(level,models,{actors:[...waveActors(wave),...createMissileActors()]}),enemies=new EnemyPreview(world,()=>{},null,waveActors(wave));let preview;
 try{
  expect(()=>new MissilePreview(world,()=>{},()=>{},enemies.states,()=>0)).toThrow('fixed pool capacity');
  const profiles=Object.fromEntries(Object.entries(config.defences['missile-launcher'].variants).map(([variant,p])=>[variant,p.stats]));preview=new MissilePreview(world,()=>{},()=>{},enemies.states,()=>0,{}, {stats:profiles,deferMagazines:true});
  expect(preview.pool.slots).toHaveLength(36);expect(preview.states.every(s=>s.ammo>=4)).toBe(true);expect(preview.states.reduce((sum,s)=>sum+s.ammo,0)).toBe(36);
  const waiting=preview.states[7],other=preview.states[0];for(const slot of preview.pool.slots)if(slot.owner===waiting)preview.pool.release(slot);waiting.slots.fill(-1);waiting.ammo=0;waiting.awaitingRounds=true;waiting.reloading=true;waiting.reloadUntil=0;
  preview.advance(0);expect(waiting.ammo).toBeGreaterThan(0);expect(waiting.reloading).toBe(false);expect(other.ammo).toBeGreaterThan(0);expect(preview.pool.slots.filter(s=>s.phase!==0)).toHaveLength(36);
 }finally{preview?.dispose();enemies.dispose();disposeWorld(world);}
});

test('same-map mixed pools retain all rig geometry and wildlife through first species appearances',async()=>{
 const native=globalThis.fetch;globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(String(url));return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};
 let world,engine,rules;
 try{
  const level=PLAY_CONFIG.levels[2];world=await loadPlayWorld(level.id,{wave:level.waves[0]});engine=new PlayEngine(world);rules=createPlacementRules(world.playSource,world.playModels,{config:PLAY_CONFIG});
  const before={entries:world.entries.slice(),pools:new Map([...world.playDefencePools].map(([key,pool])=>[key,pool.rigs.slice()])),enemies:new Map([...world.playEnemyPools].map(([key,rigs])=>[key,rigs.slice()])),wildlife:engine.wildlife,states:engine.wildlife.states.slice()};
  globalThis.fetch=()=>{throw new Error('Same-map waves must reuse assets.');};
  for(const wave of level.waves){engine.prepareWave(wave);expect(engine.wildlife).toBe(before.wildlife);expect(engine.wildlife.states).toEqual(before.states);expect(world.entries).toEqual(before.entries);expect(engine.enemies.states.map(s=>s.routeId)).toEqual(wave.spawns.map(s=>s.routeId));engine.startWave();for(const state of [...engine.enemies.activeTargets])engine.enemies.takeHit(state,99999);engine.stopWave();}
  for(const [key,rigs]of before.enemies)expect(world.playEnemyPools.get(key)).toEqual(rigs);for(const [key,rigs]of before.pools)expect(world.playDefencePools.get(key).rigs).toEqual(rigs);expect(world.playEnemyPools.get('moth')).toHaveLength(playCapacity(PLAY_CONFIG).maxWaveEnemiesBySpecies.moth);
  const sites=rules.eligibleCells('base',[],null,'arc-spire').filter(cell=>cell.valid);expect(sites.length).toBeGreaterThan(5);expect(rules.check(sites[0].box,'base',[],null,'arc-spire').valid).toBe(true);
 }finally{globalThis.fetch=native;rules?.dispose();engine?.dispose();disposePlayWorld(world);}
},30000);

test('32gun capacity plus actual finale uses only wave members and updates lights without stale pooled indices',async()=>{
 const native=globalThis.fetch;globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(String(url));return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};
 let world,engine,lights;
 try{
  const level=PLAY_CONFIG.levels[3],finale=level.waves[3];world=await loadPlayWorld(level.id,{wave:finale});
  const gun=world.playDefencePools.get('turret-study:base');for(const entry of gun.entries)for(let i=0;i<32;i++)entry.activeIndices.push(i);
  const draws=new Map(world.entries.map(entry=>[entry.key,{transforms:new Float32Array(entry.transforms.flatMap(matrix=>Array.from(matrix)))}]));
  lights=new ModelLights(world.entries,draws,{capacity:128,strict:true});lights.prepare();expect(lights.overflow).toBe(0);expect(lights.authoredCount).toBe(116);expect(lights.count).toBe(116);expect(lights.byteLength).toBe(4112);
  const oldMembership=Object.fromEntries([...world.playEnemyEntries].map(([model,entries])=>[model,entries[0].lightIndices.slice()]));let synchronizations=0;
  engine=new PlayEngine(world,{onDeploymentsChanged:()=>{synchronizations++;lights.dispose();lights=new ModelLights(world.entries,draws,{capacity:128,strict:true});}});
  engine.prepareWave(level.waves[0]);expect(synchronizations).toBe(1);lights.prepare();expect(lights.authoredCount).toBe(120);expect(lights.overflow).toBe(0);
  for(const [model,entries]of world.playEnemyEntries){const count=level.waves[0].spawns.filter(spawn=>spawn.model===model).length;for(const entry of entries)expect(entry.lightIndices).toEqual(Array.from({length:count},(_,i)=>i));}
  expect(oldMembership.dog).toHaveLength(2);expect(world.playEnemyEntries.get('dog')[0].lightIndices).toHaveLength(4);
  engine.prepareWave(finale);lights.prepare();expect(lights.authoredCount).toBe(116);expect(lights.overflow).toBe(0);expect(synchronizations).toBe(2);
 }finally{globalThis.fetch=native;lights?.dispose();engine?.dispose();disposePlayWorld(world);}
},30000);

test('real turret hits report actual animated enemy surface contacts for bullet sparks before resolving damage',()=>{
 const contacts=[],f=fixture({model:'turret-study',spawns:[{model:'dog'}],overrides:{dog:{maxHealth:40,speed:12}},callbacks:{onBulletImpact:(point,normal,at)=>contacts.push({point:[...point],normal:[...normal],at})}});
 try{f.engine.startWave();finish(f.engine);expect(contacts.length).toBeGreaterThan(0);for(const c of contacts){expect(c.point.every(Number.isFinite)).toBe(true);expect(Math.hypot(...c.normal)).toBeCloseTo(1,5);expect(c.at).toBeGreaterThanOrEqual(0);}expect(f.engine.enemies.killed).toBe(1);}finally{f.dispose();}
});
