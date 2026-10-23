import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {PLAY_CONFIG,createPlayConfig} from '../play/config.js';
import {PlayEngine,loadPlayWorld} from '../play/engine.js';
import {waveActors} from '../play/enemies.js';
import {DRONE_MODEL,DRONE_HULL} from '../shared/drone-model.js';
import {DRONE_PREVIEW} from '../shared/drone.js';
import {DRONE_CAMERA_MIN_ALTITUDE,DRONE_CAMERA_RADIUS} from '../play/drone-flight.js';
import {createPlacementRules} from '../play/placement.js';
import {composePlayLevel} from '../play/engine.js';
import {DronePreview} from '../game/drone-preview.js';

const models=new Map(await Promise.all(['dog','drone-defence','power-generator'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
const placement=(id='drone-1',x=5,z=5)=>({id,model:'drone-defence',variant:'base',box:[x,0,z],turn:0});
function fixture({hp=40,speed=6,spawnTimes=[0,5],generator=false}={}){
 const levels=structuredClone(PLAY_CONFIG.levels);levels[0].waves[0].spawns=spawnTimes.map((at,i)=>({...levels[0].waves[0].spawns[0],id:`finite-drone-enemy-${i+1}`,at}));for(const level of levels)for(const wave of level.waves)delete wave.enemyOverrides;
 const config=createPlayConfig({levels,enemies:{dog:{maxHealth:hp,speed}}}),wave=config.levels[0].waves[0],level=newLevel('drone-play-fixture');level.size=[12,10];level.path=Array.from({length:12},(_,x)=>[x,0,3]);level.placements=[placement()];if(generator)level.placements.push({id:'generator',model:'power-generator',variant:'base',box:[6,0,5],turn:0});
 const world=buildWorld(level,models,{actors:waveActors(wave)}),shots=[],engine=new PlayEngine(world,{config,wave,onShot:(variant,matrix,at,muzzles)=>shots.push({variant,matrix:Array.from(matrix),at,muzzles})});
 return {world,engine,shots,dispose(){engine.dispose();disposeWorld(world);}};
}
function run(engine,seconds,hz=60){for(let frame=0;frame<seconds*hz;frame++)engine.advance(1/hz);}
function until(f,predicate,seconds=30,hz=60){for(let frame=0;frame<seconds*hz&&!predicate();frame++)f.engine.advance(1/hz);expect(predicate()).toBe(true);}

test('finite Drone targets use stable slots through spawn, death compaction and escape',()=>{
 const f=fixture({hp:1000,spawnTimes:[0,5,10]});try{
  const e=f.engine,d=e.firing.drones,s=d.states[0];expect(d.targets).toBe(e.enemies.activeTargets);expect(d.targetIndices.size).toBe(3);expect(s.candidateNodes).toHaveLength(3);expect(d.obstacles.records).toHaveLength(3);
  e.advance(1,{combat:false});expect(s.launches).toBe(0);e.startWave();const controller=e.firing.drones,[first,second,third]=e.enemies.states;
  run(e,5.1);expect(e.enemies.activeTargets).toHaveLength(2);expect(controller.targetIndices.get(second)).toBe(1);e.enemies.takeHit(first,10000);expect(e.enemies.activeTargets[0]).toBe(second);expect(controller.targetIndices.get(second)).toBe(1);expect(controller.eligible(controller.states[0],third)).toBe(false);
  run(e,5);expect(e.enemies.activeTargets.includes(third)).toBe(true);expect(controller.targetIndices.get(third)).toBe(2);second.distance=second.path.length;e.enemies.resolveExits();expect(e.enemies.activeTargets).toEqual([third]);expect(controller.eligible(controller.states[0],second)).toBe(false);
 }finally{f.dispose();}
});

test('campaign Drone applies real hits, forwards aircraft muzzle sockets, returns during settling and does not relaunch',()=>{
 const f=fixture({generator:true});try{
  const e=f.engine;e.startWave();const d=e.firing.drones,s=d.states[0],pad=Array.from(s.rig.byId.get('pad').instance.matrix),nav=s.nav.path,motion=s.motion.data;
  expect(s.flightSeconds).toBe(20);expect(s.rechargeSeconds).toBe(10);expect(s.cycle.rule.shotsPerBurst).toBe(10);expect(s.strength).toBe(10);expect(e.firing.enhancers.bindings.some(b=>b.target===s||b.defence===s)).toBe(false);
  until(f,()=>e.completed,60);expect(e.enemies.killed).toBe(2);expect(e.enemies.escaped).toBe(0);expect(e.stats().droneShots).toBe(8);expect(f.shots).toHaveLength(8);expect(f.shots.every(event=>event.muzzles===DRONE_MODEL.muzzles&&event.matrix.every(Number.isFinite))).toBe(true);expect(s.cycle.shots).toBe(8);
  until(f,()=>s.phase==='pad-hover',30);expect(s.returnReason).toBe('wave-complete');expect(s.x).toBe(s.homeX);expect(s.y).toBeCloseTo(s.ground+9,8);expect(s.z).toBe(s.homeZ);expect(s.nav.path).toBe(nav);expect(s.motion.data).toBe(motion);expect(Array.from(s.rig.byId.get('pad').instance.matrix)).toEqual(pad);const launches=s.launches;run(e,15);expect(s.launches).toBe(launches);
 }finally{f.dispose();}
});

test('fixed campaign ticks retain pause, flight clearance and identical Drone outcomes at 30/60/120 Hz',()=>{
 const outcomes=[];for(const hz of [30,60,120]){const f=fixture();try{
  const e=f.engine;e.startWave();const d=e.firing.drones,s=d.states[0];run(e,2,hz);const before=[s.x,s.y,s.z,s.flightElapsed,s.cycle.time,...s.bodyMatrix];e.advance(0);expect([s.x,s.y,s.z,s.flightElapsed,s.cycle.time,...s.bodyMatrix]).toEqual(before);
  for(let i=0;i<60*hz&&!e.completed;i++){e.advance(1/hz);expect(d.dynamicPointClear(s,s.x,s.y,s.z)).toBe(true);expect(s.emergencyStops).toBe(0);}
  expect(e.completed).toBe(true);outcomes.push([e.enemies.killed,e.enemies.escaped,s.cycle.shots,e.waveTime]);
 }finally{f.dispose();}}expect(outcomes[1]).toEqual(outcomes[0]);expect(outcomes[2]).toEqual(outcomes[0]);
});

test('a stopped wave returns its aircraft despite living enemies and restarting resets the same world rigs',()=>{
 const f=fixture({hp:10000,spawnTimes:[0]});try{
  const e=f.engine;e.startWave();run(e,6);const old=e.firing.drones,s=old.states[0],rig=f.world.rigs.get(s.id);expect(s.launches).toBe(1);e.stopWave();until(f,()=>s.phase==='pad-hover',30);const shots=s.cycle.shots,launches=s.launches;run(e,12);expect(s.cycle.shots).toBe(shots);expect(s.launches).toBe(launches);
  e.startWave();const next=e.firing.drones.states[0];expect(old.disposed).toBe(true);expect(f.world.rigs.get(next.id)).toBe(rig);expect(next.phase).toBe('pad-hover');expect(next.flightElapsed).toBe(0);expect(next.cycle.shots).toBe(0);expect(next.y).toBe(next.ground+9);
 }finally{f.dispose();}
});

test('unassigned Drone upgrades remain rejected and campaign fleet overflow fails before fetching',async()=>{
 const level=newLevel('unassigned-drone');level.size=[12,10];level.placements=[{...placement(),variant:'upgrade1'}];const world=buildWorld(level,models);
 try{expect(()=>new DronePreview(world,()=>{})).toThrow('unassigned');}finally{disposeWorld(world);}
 const native=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('unexpected fetch');};try{
  await expect(loadPlayWorld('moss-02',{wave:PLAY_CONFIG.levels[1].waves[0],placements:Array.from({length:5},(_,i)=>placement(`drone-${i}`,i+2))})).rejects.toThrow('family capacity');expect(calls).toBe(0);
 }finally{globalThis.fetch=native;}
});


test('base aircraft highest flight/evasion envelope leaves the spectator camera a positive vertical gap',()=>{
 const mobileTop=DRONE_MODEL.bodyPivot[1]+Math.max(...DRONE_PREVIEW.transitLayers)+DRONE_HULL.above;
 expect(DRONE_CAMERA_MIN_ALTITUDE-DRONE_CAMERA_RADIUS-mobileTop).toBe(86.5);
});

test('four native A2 aircraft coexist with mixed defences, clear each other and finish their first return at 30/60/120 Hz',async()=>{
 const source=await Bun.file(new URL('../assets/levels/moss-02.json',import.meta.url)).json(),wave=PLAY_CONFIG.levels[1].waves[0],modelMap=new Map(models);
 for(const id of new Set([...source.placements.map(p=>p.model),...Object.keys(PLAY_CONFIG.defences),...wave.spawns.map(s=>s.model)]))if(!modelMap.has(id))modelMap.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 const rules=createPlacementRules(source,modelMap,{config:PLAY_CONFIG,critters:false}),placements=[];
 try{
  // Spread the four legal pads so this source fixture has genuine independent
  // fronts; live fleet checks still certify each moving hull every frame.
  for(let i=0;i<4;i++){
   const cells=rules.eligibleCells('base',placements,null,'drone-defence').filter(c=>c.valid);expect(cells.length).toBeGreaterThan(0);
   cells.sort((a,b)=>{const score=c=>placements.length?Math.min(...placements.map(p=>Math.hypot(c.box[0]-p.box[0],c.box[2]-p.box[2]))):-Math.hypot(c.box[0]-source.path[0][0],c.box[2]-source.path[0][2]);return score(b)-score(a);});placements.push({...placement(`native-drone-${i+1}`),box:cells[0].box});
  }
  for(const model of ['turret-study','arc-spire']){const cells=rules.eligibleCells('base',placements,null,model).filter(c=>c.valid);cells.sort((a,b)=>{const nearest=c=>Math.min(...placements.map(p=>Math.hypot(c.box[0]-p.box[0],c.box[2]-p.box[2])));return nearest(b)-nearest(a);});const cell=cells[0];expect(cell).toBeDefined();placements.push({id:`native-${model}`,model,variant:'base',box:cell.box,turn:0});}
 }finally{rules.dispose();}
 const outcomes=[];
 for(const hz of [30,60,120]){
  const level=composePlayLevel(source,placements,{models:modelMap}),world=buildWorld(level,modelMap,{actors:waveActors(wave),includeFish:false});world.playCritters=false;const engine=new PlayEngine(world,{wave}),landed=new Set(),returned=new Set();
  try{
   engine.startWave();const d=engine.firing.drones;expect(d.states).toHaveLength(4);
   for(let frame=0;frame<65*hz&&landed.size<4;frame++){
    engine.advance(1/hz);
    for(const s of d.states){expect(s.y+DRONE_HULL.above).toBeLessThanOrEqual(level.pathHeight+111+1e-6);expect(d.dynamicPointClear(s,s.x,s.y,s.z)).toBe(true);expect(d.fleetClear(s,s.x,s.y,s.z,s.x,s.y,s.z,s.phase==='pad-hover'||s.phase==='recharge'||s.phase==='launch'||s.phase==='descend')).toBe(true);if(s.returns)returned.add(s.id);if(returned.has(s.id)&&(s.phase==='recharge'||s.phase==='pad-hover'))landed.add(s.id);}
   }
   expect(landed.size).toBe(4);expect(d.states.every(s=>s.launches>0)).toBe(true);expect(d.shots).toBeGreaterThan(0);outcomes.push([engine.enemies.killed,engine.enemies.escaped,d.shots]);
  }finally{engine.dispose();disposeWorld(world);}
 }
 expect(outcomes[1]).toEqual(outcomes[0]);expect(outcomes[2]).toEqual(outcomes[0]);
},30000);
