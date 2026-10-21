import {test,expect} from 'bun:test';
import {PLAY_CONFIG,validatePlayConfig,playCapacity} from '../play/config.js';
import {PlayEngine,loadPlayWorld,disposePlayWorld} from '../play/engine.js';
import {createPlacementRules,defenceMovementShapes} from '../play/placement.js';
import {waveActors} from '../play/enemies.js';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {createMissileActors} from '../game/missile-preview.js';
import {WorldRenderer} from '../engine/renderer.js';

const models=new Map(await Promise.all(['dog','turret-study','arc-spire','missile-launcher','power-generator','guided-missile'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
const placed=(id,model,box,variant='base')=>({id,model,variant,box,turn:0});
const generator=(id,box)=>placed(id,'power-generator',box);
function fixture(model,variant='base',{overlap=false}={}){
 const config=structuredClone(PLAY_CONFIG),wave=config.levels[2].waves[0];
 wave.spawns=[{id:'enhancer-dog',model:'dog',at:0,routeId:'main'}];wave.enemyOverrides={dog:{maxHealth:10000,speed:12}};validatePlayConfig(config);
 const level=newLevel('play-enhancer');level.size=[12,9];level.path=Array.from({length:12},(_,x)=>[x,0,3]);
 const box=model==='missile-launcher'?[2,0,0]:[4,0,4],sourceBox=model==='missile-launcher'?[3,0,0]:[4,0,5];
 level.placements=[placed('weapon',model,box,variant),generator('source',sourceBox)];
 if(overlap)level.placements.push(generator('second',[3,0,4]),generator('diagonal',[5,0,5]),generator('distant',[8,0,7]));
 const world=buildWorld(level,models,{actors:[...waveActors(wave),...createMissileActors()]}),hits=[];
 const engine=new PlayEngine(world,{config,wave});
 const original=engine.enemies.takeHit.bind(engine.enemies);engine.enemies.takeHit=(target,strength,...rest)=>{const before=target.health.current,result=original(target,strength,...rest);hits.push({strength,result,before,after:target.health.current});return result;};
 return {world,engine,config,wave,hits,dispose(){engine.dispose();disposeWorld(world);}};
}

test('play generator enhances real gun and Arc damage at every tier, including active Upgrade II gun',()=>{
 for(const model of ['turret-study','arc-spire'])for(const variant of ['base','upgrade1','upgrade2']){
  const f=fixture(model,variant);
  try{
   const e=f.engine,original=f.config.defences[model].variants[variant],strength=original.stats.strength*1.25;e.startWave();
   const state=e.firing.states[0];expect(state.strength).toBe(strength);expect(state.baseStrength).toBe(original.stats.strength);expect(state.cycle.rule).toBe(original.firing);
   expect(e.firing.enhancers.states[0].recipientIds).toEqual(['weapon']);expect(e.firing.states).toHaveLength(1);
   for(let i=0;i<2400&&!f.hits.length;i++)e.advance(1/120);
   expect(f.hits.length).toBeGreaterThan(0);const hit=f.hits[0];expect(hit.strength).toBe(strength);expect(hit.before-hit.after).toBe(strength);expect(state.lastShotDamage).toBe(strength);
   expect(e.firing.planner.states).toBe(e.firing.states);expect(e.firing.planner.targets).toBe(e.enemies.activeTargets);
  }finally{f.dispose();}
 }
});

test('play missile captures enhanced strength once for incoming claims and eventual contact at every tier',()=>{
 for(const variant of ['base','upgrade1','upgrade2']){
  const f=fixture('missile-launcher',variant);
  try{
   const e=f.engine;e.startWave();const state=e.firing.states[0],pool=e.firing.missiles.pool,target=e.enemies.states[0],strength=f.config.defences['missile-launcher'].variants[variant].stats.strength*1.25;
   for(let i=0;i<120&&!pool.incomingDamage(target);i++)e.advance(1/120);
   const flying=pool.slots.filter(slot=>slot.target===target&&slot.strength>0);expect(flying.length).toBeGreaterThan(0);expect(pool.incomingDamage(target)).toBe(flying.length*strength);for(const slot of flying)expect(slot.strength).toBe(strength);
   // An already airborne missile owns its launch strength even if the borrowed
   // launcher state changes later. Planner and contact use the captured value.
   state.strength=1;
   expect(e.firing.planner.residualHealth(target)).toBe(target.health.current-pool.incomingDamage(target));
   for(let i=0;i<1200&&!f.hits.length;i++)e.advance(1/120);
   expect(f.hits[0]?.strength).toBe(strength);expect(f.hits[0]?.before-f.hits[0]?.after).toBe(strength);expect(state.lastHitDamage).toBe(strength);
  }finally{f.dispose();}
 }
});

test('play bonuses never stack, inactive generators do not join the planner, and combat performs no adjacency search',()=>{
 const f=fixture('turret-study','upgrade1',{overlap:true});
 try{
  const e=f.engine;e.startWave();const enhancers=e.firing.enhancers,state=e.firing.states[0],bindings=enhancers.bindings,recipients=enhancers.states.map(s=>s.recipientIds);
  expect(enhancers.states.map(s=>s.active)).toEqual([true,true,false,false]);expect(state.strength).toBe(15);expect(state.strengthIncrease).toBe(.25);expect(e.firing.states).toHaveLength(1);
  const capacity=e.firing.planner.capacity(0,e.enemies.states[0]);expect(capacity).toBeGreaterThan(0);state.strength=12;expect(e.firing.planner.capacity(0,e.enemies.states[0])).toBeCloseTo(capacity/1.25,8);enhancers.reset();
  const placements=f.world.level.placements;
  Object.defineProperty(f.world.level,'placements',{configurable:true,get(){throw new Error('Combat must use prepared adjacency.');}});
  try{for(let i=0;i<120;i++)e.advance(1/120);for(let i=0;i<4;i++)e.firing.resetTargets();}
  finally{Object.defineProperty(f.world.level,'placements',{configurable:true,writable:true,value:placements});}
  expect(enhancers.bindings).toBe(bindings);for(let i=0;i<recipients.length;i++)expect(enhancers.states[i].recipientIds).toBe(recipients[i]);expect(state.strength).toBe(15);
  const borrowed=state;e.makeGuns();expect(borrowed.strength).toBe(12);expect(borrowed.strengthIncrease).toBe(0);expect(enhancers.bindings).toEqual([]);expect(e.firing.states[0].strength).toBe(15);
  e.stopWave();e.startWave();expect(e.firing.states[0].strength).toBe(15);
 }finally{f.dispose();}
});

test('generator placement uses fixed solid geometry, only enabled base tier, and existing dry ground/path guards',()=>{
 const level=newLevel('generator-placement');level.size=[12,9];level.path=Array.from({length:12},(_,x)=>[x,0,3]);
 level.terrain.boxes=[{box:[8,7],ground:25,water:0},{box:[9,7],ground:24,water:26}];
 const rules=createPlacementRules(level,models,{config:PLAY_CONFIG,critters:false}),source=generator('source',[4,0,5]);
 try{
  const shapes=defenceMovementShapes(models.get('power-generator'),'base');expect(shapes.length).toBeGreaterThan(0);expect(shapes.every(shape=>!shape.round&&shape.bounds.every(Number.isFinite))).toBe(true);
  expect(rules.check(source.box,'base',[],null,'power-generator').valid).toBe(true);
  for(const variant of ['upgrade1','upgrade2']){expect(rules.check(source.box,variant,[],null,'power-generator').code).toBe('variant');expect(rules.prepare([{...source,variant}]).valid).toBe(false);}
  expect(rules.check([4,0,3],'base',[],null,'power-generator').code).toBe('route');
  for(const box of [[8,0,7],[9,0,7]])expect(rules.check(box,'base',[],null,'power-generator').code).toBe('ground');
  expect(rules.check(source.box,'base',[source],null,'turret-study').code).toBe('occupied');expect(rules.prepare([source]).valid).toBe(true);
 }finally{rules.dispose();}
});

test('generator solid voxels block other defence rays with normal shooter self-exclusion and retain open space',()=>{
 const level=newLevel('generator-solid');level.size=[8,8];level.path=[[0,0,1],[1,0,1]];level.placements=[generator('source',[3,0,4])];
 const world=buildWorld(level,models);
 try{
  const rig=world.rigs.get('source'),part=rig.parts[0],cell=part.voxels[0],matrix=rig.instances.find(instance=>instance.part===part.id).matrix;
  const point=[0,1,2].map(axis=>matrix[axis]*(cell[0]+.5)+matrix[axis+4]*(cell[1]+.5)+matrix[axis+8]*(cell[2]+.5)+matrix[axis+12]);
  const ray=[point[0]-.25,point[1],point[2],point[0]+.25,point[1],point[2]];
  expect(world.visibility.blockedDefences(...ray,'weapon')).toBe(true);expect(world.visibility.blockedDefences(...ray,'source')).toBe(false);
  expect(world.visibility.blockedDefences(12,60,12,36,60,12,'weapon')).toBe(false);
 }finally{disposeWorld(world);}
});

// Actual scene draw buffers validate the existing pool contract; this is a
// resource-ownership check, not a shader execution or GPU timing claim.
function gpuFixture(modelLightCapacity){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'GPUBufferUsage');Object.defineProperty(globalThis,'GPUBufferUsage',{configurable:true,value:{COPY_DST:8,INDEX:16,VERTEX:32,UNIFORM:64,STORAGE:128}});
 const buffers=[],device={createShaderModule:d=>d,createPipelineLayout:d=>d,createRenderPipeline:d=>d,createBuffer({size}){const buffer={size,destroyCalls:0,destroy(){this.destroyCalls++;}};buffers.push(buffer);return buffer;},queue:{writeBuffer(buffer){if(buffer.destroyCalls)throw new Error('Write after disposal.');}},destroy(){}};
 const canvas={width:960,height:640,clientWidth:960,clientHeight:640,dataset:{},addEventListener(){},focus(){}},renderer=new WorldRenderer(canvas,message=>{throw new Error(message);},{modelLightCapacity,strictModelLights:true});renderer.device=device;
 return {renderer,buffers,dispose(){renderer.dispose();if(previous)Object.defineProperty(globalThis,'GPUBufferUsage',previous);else delete globalThis.GPUBufferUsage;}};
}

test('campaign move/remove/upgrade/start/prepare reuse generator pools and scene buffers and restore old strengths',async()=>{
 const native=globalThis.fetch;
 globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(String(url));return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};
 let world,e,rules,gpu;
 try{
  const level=PLAY_CONFIG.levels[0];world=await loadPlayWorld(level.id,{wave:level.waves[0],critters:false});
  gpu=gpuFixture(playCapacity(PLAY_CONFIG).modelLights);const r=gpu.renderer;r.setWorld(world);
  e=new PlayEngine(world,{onDeploymentsChanged:world=>r.syncRuntimeInstances(world)});rules=createPlacementRules(world.playSource,world.playModels,{config:PLAY_CONFIG,critters:false});
  expect([...world.playDefencePools.keys()].filter(key=>key.startsWith('power-generator:'))).toEqual(['power-generator:base']);
  let pair;
  for(const cell of rules.eligibleCells('base',[],null,'power-generator').filter(cell=>cell.valid)){
   const source=generator('source',cell.box);
   for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const weapon=placed('weapon','turret-study',[cell.box[0]+dx,0,cell.box[2]+dz]);if(['base','upgrade1','upgrade2'].every(variant=>rules.check(weapon.box,variant,[source],null,'turret-study').valid)){pair=[source,weapon];break;}}
   if(pair)break;
  }
  expect(pair).toBeDefined();const [source,weapon]=pair;
  const far=rules.eligibleCells('base',[weapon],source.id,'power-generator').find(cell=>cell.valid&&Math.abs(cell.box[0]-weapon.box[0])+Math.abs(cell.box[2]-weapon.box[2])>1);expect(far).toBeDefined();
  const entries=world.entries.slice(),buffers=gpu.buffers.slice(),sceneBuffers=[...r.sceneBuffers];
  const rows=[[source,weapon],[{...source,box:far.box},weapon],[source,{...weapon,variant:'upgrade1'}],[source,{...weapon,variant:'upgrade2'}],[weapon],[]];
  for(let cycle=0;cycle<3;cycle++)for(const row of rows){
   const old=e.firing,borrowed=old.states.slice();expect(rules.prepare(row).valid).toBe(true);expect(e.updateDeployments(row).valid).toBe(true);
   for(const state of borrowed){expect(state.strength).toBe(state.baseStrength);expect(state.strengthIncrease).toBe(0);}expect(old.enhancers.states).toEqual([]);
   const state=e.firing.states[0];if(state)expect(state.strength).toBe(state.baseStrength*(row.length===2&&row[0].box===source.box?1.25:1));
   expect(world.visibility.defences.map(d=>d.id).sort()).toEqual(row.map(p=>p.id).sort());
   r.flushInstances();r.modelLights.prepare();expect(r.modelLights.overflow).toBe(0);
   expect(world.entries).toEqual(entries);expect([...r.sceneBuffers]).toEqual(sceneBuffers);expect(gpu.buffers).toEqual(buffers);
  }
  expect(e.updateDeployments(pair).valid).toBe(true);for(let retry=0;retry<3;retry++){const old=e.firing.states[0];e.startWave();expect(old.strength).toBe(10);expect(e.firing.states[0].strength).toBe(12.5);e.stopWave();e.prepareWave(level.waves[1]);expect(e.firing.states[0].strength).toBe(12.5);}
  expect(gpu.buffers).toEqual(buffers);
 }finally{globalThis.fetch=native;e?.dispose();rules?.dispose();gpu?.dispose();disposePlayWorld(world);}
 expect(gpu.buffers.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(world.entries).toEqual([]);
},30000);
