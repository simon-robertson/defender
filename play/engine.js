import {FISH_MODEL,hasFishWater} from '../shared/fish-habitat.js';
import {buildWorld,disposeWorld,addWorldRigPool} from '../engine/world.js';
import {validateLevel} from '../shared/level.js';
import {TerrainField,placementY} from '../shared/terrain.js';
import {placementMatrix,partMatrices,multiply} from '../shared/math.js';
import {TurretPreview,holdGunAcquisition} from '../game/turret-preview.js';
import {ArcSpirePreview} from '../game/arc-spire-preview.js';
import {MissilePreview,createMissileActors} from '../game/missile-preview.js';
import {EnhancerPreview} from '../game/enhancer-preview.js';
import {TargetPlanner} from '../engine/target-planner.js';
import {TURRET_RECOIL} from '../shared/arsenal.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {PlayEnemies} from './enemies.js';
import {createPlacementRules} from './placement.js';
import {PLAY_CONFIG,validatePlayConfig,playCapacity} from './config.js';

export const PLAY_TICK=1/120,PLAY_MAX_STEPS=240;
function sameEnemyOverrides(a,b){
 if(a===undefined||b===undefined)return a===b;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)||Array.isArray(b))return false;
 const species=Object.keys(a);return species.length===Object.keys(b).length&&species.every(model=>{
  const actual=a[model],expected=b[model];if(!actual||!expected||typeof actual!=='object'||typeof expected!=='object'||Array.isArray(actual)||Array.isArray(expected))return false;
  const keys=Object.keys(actual);return keys.length===Object.keys(expected).length&&keys.every(key=>Object.hasOwn(expected,key)&&actual[key]===expected[key]);
 });
}
function configuredWave(config,wave,levelId=null){
 const expected=config.levels.filter(level=>levelId===null||level.id===levelId).flatMap(level=>level.waves).find(entry=>entry.id===wave?.id);
 if(!expected||!Array.isArray(wave.spawns)||wave.spawns.length!==expected.spawns.length||wave.spawns.some((s,i)=>['id','at','model','routeId'].some(key=>s[key]!==expected.spawns[i][key]))||!sameEnemyOverrides(wave.enemyOverrides,expected.enemyOverrides))throw new Error('Unknown or modified playable wave.');
 return expected;
}
export function composePlayLevel(source,placements=[],{wildlifePoints,models,conditions}={}){
 const level=structuredClone(source);
 if(Number.isFinite(conditions?.timeOfDay))level.environment={...level.environment,timeOfDay:conditions.timeOfDay};
 delete level.previewMode;delete level.previewActors;delete level.actorRoutes;
 // Current A1's approved drone test remains an immutable preview source.
 level.placements=level.placements.filter(p=>models?models.get(p.model)?.role==='scenery':!['turret-study','arc-spire','missile-launcher','power-generator','drone-defence'].includes(p.model));
 level.placements.push(...structuredClone(placements));
 if(wildlifePoints){level.previewWildlife.habitatPoints=structuredClone(wildlifePoints);level.previewWildlife.habitats=wildlifePoints.map(([x,,z])=>[Math.floor(x/24),Math.floor(z/24)]);}
 return level;
}
function deploymentPlan(world,placements,config){
 validateDeployments(placements,config);
 const level={...world.level,placements:[...world.playScenery,...structuredClone(placements)]};validateLevel(level,world.playModels);
 const rigs=new Map(world.playSceneryRigs),field=new TerrainField(level),selected=[],reserved=new Map();
 for(const p of placements){const key=p.model+':'+p.variant,existing=world.rigs.get(p.id);if(existing?.model===p.model&&existing.variant===p.variant){let indices=reserved.get(key);if(!indices){indices=new Set();reserved.set(key,indices);}indices.add(existing.instances[0].index);}}
 for(const p of level.placements.slice(world.playScenery.length)){
  const key=p.model+':'+p.variant,pool=world.playDefencePools.get(key),existing=world.rigs.get(p.id);let used=reserved.get(key);if(!used){used=new Set();reserved.set(key,used);}const index=existing?.model===p.model&&existing.variant===p.variant?existing.instances[0].index:pool?.rigs.findIndex((_,i)=>!used.has(i));
  if(!pool||index<0||index===undefined)throw new Error('Player defence pool capacity exceeded.');
  used.add(index);const template=pool.rigs[index],root=placementMatrix(p.box,p.turn,p.offset);root[13]=placementY(level,p,field);
  if(world.actors.has(p.id))throw new Error('Deployment ID conflicts with a runtime actor.');
  for(const part of template.parts)for(const cell of part.voxels){const x=root[0]*(cell[0]+.5)+root[8]*(cell[2]+.5)+root[12],z=root[2]*(cell[0]+.5)+root[10]*(cell[2]+.5)+root[14];if(field.path.has(Math.floor(x/24)+','+Math.floor(z/24)))throw new Error('A defence blocks the enemy route.');}
  const poses=partMatrices(template.parts),instances=template.instances.map(instance=>{const matrix=new Float32Array(16);multiply(matrix,root,poses.get(instance.part));return {...instance,matrix};});
  const rig={...template,root,instances};rigs.set(p.id,rig);selected.push({id:p.id,rig,pool,index});
 }
 return {level,rigs,selected};
}
function commitDeployments(world,plan){
 for(const pool of world.playDefencePools.values())for(const entry of pool.entries)entry.activeIndices.length=0;
 world.rigs.clear();for(const [id,rig]of world.playSceneryRigs)world.rigs.set(id,rig);
 for(const {id,rig,pool,index}of plan.selected){
  const target=pool.rigs[index];target.root.set(rig.root);for(let i=0;i<target.instances.length;i++)target.instances[i].matrix.set(rig.instances[i].matrix);
  world.rigs.set(id,target);for(const entry of pool.entries)entry.activeIndices.push(index);
 }
 world.level.placements=plan.level.placements;world.visibility.setDefences(world.level,world.playModels,world.rigs);
 world.quads=world.water.mesh.quads.length+world.entries.reduce((n,e)=>n+e.mesh.quads.length*(e.activeIndices?.length??e.transforms.length),0);
}
function assignWave(world,wave){
 for(const id of world.playEnemyIds??[])world.actors.delete(id);
 for(const entries of world.playEnemyEntries.values())for(const entry of entries)entry.lightIndices.length=0;
 const next=new Map();world.playEnemyIds=wave.spawns.map(spawn=>{
  const index=next.get(spawn.model)??0,rig=world.playEnemyPools.get(spawn.model)?.[index];if(!rig)throw new Error('Player enemy pool capacity exceeded.');next.set(spawn.model,index+1);world.actors.set(spawn.id,rig);for(const entry of world.playEnemyEntries.get(spawn.model))entry.lightIndices.push(index);return spawn.id;
 });world.playWave=wave;
}
function validateDeployments(placements,config){
 if(!Array.isArray(placements)||placements.length>playCapacity(config).maxOwnedUnits||placements.some(p=>!p||!config.defences[p.model]?.enabledVariants.includes(p.variant)))throw new Error('Unsupported player deployment.');
}
// Retain only this zone's enemy geometry. Defence pools cover every affordable
// loadout through the zone's finale, so earlier scenes do not allocate the
// final campaign's inventory capacity. No gameplay ownership limit is added.
export function playSceneCapacity(config,id){
 const level=config.levels.find(level=>level.id===id);
 if(!level)throw new Error('Unknown playable level.');
 const end=config.levels.findLastIndex(entry=>entry.zone===level.zone)+1;
 const capacity=playCapacity({...config,levels:config.levels.slice(0,end)});
 const species=new Set(config.levels.filter(entry=>entry.zone===level.zone).flatMap(entry=>entry.waves.flatMap(wave=>wave.spawns.map(spawn=>spawn.model))));
 capacity.maxWaveEnemiesBySpecies=Object.fromEntries(Object.entries(capacity.maxWaveEnemiesBySpecies).filter(([model,count])=>count>0&&species.has(model)));
 capacity.pooledEnemyCount=Object.values(capacity.maxWaveEnemiesBySpecies).reduce((sum,count)=>sum+count,0);
 return capacity;
}
export async function loadPlayWorld(id,{placements=[],wave,config=PLAY_CONFIG,wildlifePoints,conditions,critters=true,signal}={}){
 validatePlayConfig(config);wave=configuredWave(config,wave,id);
 validateDeployments(placements,config);
 async function asset(kind,key){const response=await fetch(`/api/${kind}/${key}`,{signal,cache:'no-store'});if(!response.ok)throw new Error(`Unable to load ${key}.`);return (await response.json()).asset;}
 const source=await asset('levels',id),level=composePlayLevel(source,[],{wildlifePoints:critters?wildlifePoints:undefined,conditions}),capacity=playSceneCapacity(config,id),speciesCapacity=capacity.maxWaveEnemiesBySpecies,slots=Object.entries(speciesCapacity).flatMap(([model,count])=>Array.from({length:count},(_,i)=>({id:`play-${model}-slot-${i+1}`,model,variant:'base'}))),missiles=config.defences['missile-launcher']?createMissileActors():[],actors=[...slots,...missiles,...(critters?wildlifeActorsForLevel(level):[])];
 const ids=[...new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model),...Object.keys(config.defences),...(critters&&hasFishWater(level)?[FISH_MODEL]:[])])],models=new Map(await Promise.all(ids.map(async model=>[model,await asset('models',model)])));
 signal?.throwIfAborted();
 // Supplying a source and exact model responses preserves the world's ordinary
 // validation/load boundary without exposing player state to asset-save APIs.
 const world=buildWorld(level,models,{actors,includeFish:critters});world.playCritters=critters;
 world.playConditions=conditions?Object.freeze({...conditions}):null;world.playSource=source;world.playModels=models;world.playScenery=level.placements.slice();world.playSceneryRigs=new Map(world.rigs);world.playDefencePools=new Map(Object.entries(config.defences).flatMap(([model,family])=>family.enabledVariants.map(variant=>[model+':'+variant,addWorldRigPool(world,models.get(model),variant,capacity.maxOwnedByFamily?.[model]??capacity.maxOwnedUnits)])));
 world.playGunPools=new Map([...world.playDefencePools].filter(([key])=>key.startsWith('turret-study:')).map(([key,pool])=>[key.slice('turret-study:'.length),pool]));
 // Hidden slot identities keep every species' draw group compactable even
 // before that species first appears. Wave IDs alias these same fixed rigs.
 world.playEnemyPools=new Map(Object.keys(speciesCapacity).map(model=>[model,slots.filter(slot=>slot.model===model).map(slot=>world.actors.get(slot.id))]));world.playDogSlots=world.playEnemyPools.get('dog');
 world.playEnemyEntries=new Map([...world.playEnemyPools].map(([model,rigs])=>{const keys=new Set(rigs[0]?.instances.map(instance=>instance.key)??[]),entries=world.entries.filter(entry=>keys.has(entry.key));for(const entry of entries)entry.lightIndices=[];return [model,entries];}));
 const actorKeys=new Set([...world.playEnemyPools.values()].flatMap(rigs=>rigs.flatMap(rig=>rig.instances.map(instance=>instance.key))));for(const missile of missiles)for(const instance of world.actors.get(missile.id).instances)actorKeys.add(instance.key);for(const entry of world.entries)if(actorKeys.has(entry.key))entry.initiallyHidden=true;
 assignWave(world,wave);commitDeployments(world,deploymentPlan(world,placements,config));
 if(critters&&!wildlifePoints){
  const rules=createPlacementRules(source,models,{config});try{const prepared=rules.prepare(placements);if(!prepared.valid)throw new Error(prepared.reason);if(level.previewWildlife){level.previewWildlife.habitatPoints=prepared.wildlifePoints;level.previewWildlife.habitats=prepared.wildlifePoints.map(([x,,z])=>[Math.floor(x/24),Math.floor(z/24)]);}}catch(error){disposePlayWorld(world);throw error;}finally{rules.dispose();}
 }
 return world;
}
export function disposePlayWorld(world){if(!world)return;world.playConditions=null;world.playSource=null;world.playModels?.clear();world.playModels=null;world.playWave=null;world.playDefencePools?.clear();world.playDefencePools=null;world.playGunPools?.clear();world.playGunPools=null;for(const slots of world.playEnemyPools?.values()??[])slots.length=0;world.playEnemyPools?.clear();world.playEnemyPools=null;world.playEnemyEntries?.clear();world.playEnemyEntries=null;world.playDogSlots=null;world.playEnemyIds=null;world.playSceneryRigs?.clear();world.playSceneryRigs=null;world.playScenery=null;disposeWorld(world);}

// Reuse the accepted controllers and one cooperative planner. Full finite
// targets construct contact/forecast records once; the reused active array
// alone admits live locks, impacts and incoming-damage claims.
class PlayCombat {
 constructor(world,enemies,config,{onPoseChange,onVisible,onShot,onArcShot,onBulletImpact,missileEffects,onHit}){
  const profiles=model=>{
   const variants=config.defences[model]?.variants??{};
   return {stats:Object.fromEntries(Object.entries(variants).map(([variant,p])=>[variant,p.stats])),firing:Object.fromEntries(Object.entries(variants).map(([variant,p])=>[variant,p.firing]))};
  };
  const gun=profiles('turret-study');let seed=1234567;
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  this.turrets=new TurretPreview(world,onPoseChange,()=>.5,onShot,enemies.states,onHit,{sharedPlanner:true,stats:{'turret-study':gun.stats},firing:gun.firing,onImpact:onBulletImpact});
  this.arcs=new ArcSpirePreview(world,enemies.states,random,onArcShot,onHit,profiles('arc-spire'));
  this.missiles=new MissilePreview(world,onPoseChange,onVisible,enemies.states,onHit,missileEffects,{...profiles('missile-launcher'),deferMagazines:true});
  this.states=[...this.turrets.states,...this.arcs.states,...this.missiles.states];for(const state of this.turrets.states)state.model='turret-study';
  this.targets=enemies.activeTargets;this.shots=this.active=this.turning=this.updatedParts=0;
  this.planner=null;
  // Resolve cardinal neighbours only at deployment/controller creation. Combat
  // and forecasts share these effective strengths; missiles capture at launch.
  this.enhancers=new EnhancerPreview(world,this.states,()=>this.planner?.reset());
  this.planner=new TargetPlanner(this.states,enemies.states,{
   incomingDamage:target=>this.missiles.incomingDamage(target),
   eligible:(state,target,recoil)=>this.eligible(state,target,recoil),
   coverageEnabled:state=>state.model==='turret-study',
   coverageVisible:(state,target)=>this.turrets.eligible(state,target,0)&&this.turrets.eligible(state,target,TURRET_RECOIL.distance),
   holdTarget:state=>state.model==='turret-study'&&holdGunAcquisition(state),
  });
  this.planner.targets=this.targets;
  for(const controller of [this.turrets,this.arcs,this.missiles]){controller.targets=this.targets;controller.planner=this.planner;}
  if(this.missiles.pool)this.missiles.pool.targets=this.targets;
  for(const state of this.turrets.states){state.rig.invalidateRoot();state.rig.update();}
 }
 eligible(state,target,recoil=0){return state.model==='arc-spire'?this.arcs.eligible(state,target):state.model==='missile-launcher'?this.missiles.eligible(state,target):this.turrets.eligible(state,target,recoil);}
 targetYaw(state){return this.turrets.targetYaw(state);}
 targetPitch(state,target,yaw){return this.turrets.targetPitch(state,target,yaw);}
 advance(dt){
  this.planner.advance(dt);this.turrets.advance(dt);this.arcs.advance(dt);this.missiles.advance(dt);
  this.shots=this.turrets.shots+this.arcs.shots+this.missiles.shots;this.active=this.turrets.active+this.arcs.active+this.missiles.active;this.turning=this.turrets.turning;this.updatedParts=this.turrets.updatedParts+this.missiles.updatedParts;
 }
 settle(dt){const pool=this.missiles.pool;if(pool){pool.advance(dt);pool.prepare();}}
 resetTargets(){this.enhancers.reset();this.planner.reset();this.turrets.resetTargets();this.arcs.resetTargets();this.missiles.resetTargets();}
 dispose(){this.planner?.dispose();this.planner=null;this.enhancers.dispose();this.turrets.dispose();this.arcs.dispose();this.missiles.dispose();this.states.length=0;this.targets=null;}
}

export class PlayEngine {
 constructor(world,{config=PLAY_CONFIG,wave=world.playWave,onPoseChange=()=>{},onVisible=()=>{},onShot=()=>{},onArcShot=()=>{},onBulletImpact=null,missileEffects={},onDeath=()=>{},onEscape=()=>{},onWaveComplete=()=>{},onStep=()=>{},onAfterStep=()=>{},onDeploymentsChanged=()=>{}}={}){
  validatePlayConfig(config);wave=configuredWave(config,wave);this.world=world;this.config=config;this.wave=wave;this.time=this.waveTime=this.accumulator=this.steps=this.lastSteps=0;this.running=false;this.disposed=false;this.completed=false;this.onPoseChange=onPoseChange;this.onShot=onShot;this.onWaveComplete=onWaveComplete;this.onStep=onStep;this.onAfterStep=onAfterStep;this.continuing=()=>this.running;this.onDeploymentsChanged=onDeploymentsChanged;this.enemyCallbacks={onPoseChange,onVisible,onDeath,onEscape};
  this.combatCallbacks={onPoseChange,onVisible,onBulletImpact:onBulletImpact?((point,normal)=>onBulletImpact(point,normal,this.time)):null,onShot:(variant,matrix)=>this.onShot(variant,matrix,this.time),onArcShot:(from,to,normal,_at,matrix,localPoint,isChain,sourceMatrix,sourceLocalPoint)=>onArcShot(from,to,normal,this.time,matrix,localPoint,isChain,sourceMatrix,sourceLocalPoint),missileEffects,onHit:(target,strength,vx,vy,vz)=>this.enemies.takeHit(target,strength,vx,vy,vz)};
  this.enemies=new PlayEnemies(world,{config,wave,onPoseChange,onVisible,onDeath,onEscape});
  this.wildlife=new WildlifePreview(world,onPoseChange,world.playCritters===false?[]:wildlifeActorsForLevel(world.level));this.wildlife.setThreatSources(this.enemies.activeTargets);
  this.makeGuns();this.capacity=playCapacity(config);
 }
 makeGuns(){
  this.firing?.dispose();this.firing=new PlayCombat(this.world,this.enemies,this.config,this.combatCallbacks);
 }
 updateDeployments(placements){
  if(this.disposed||this.running)return {valid:false,code:'phase',reason:'Defences can only change during preparation.'};
  let plan;try{plan=deploymentPlan(this.world,placements,this.config);}catch(error){return {valid:false,code:'deployment',reason:error.message};}
  const wildlife=this.world.playCritters===false?null:this.wildlife.prepareDeployment({...this.world,level:plan.level,rigs:plan.rigs});if(wildlife&&!wildlife.valid)return wildlife;
  commitDeployments(this.world,plan);if(wildlife)this.wildlife.commitDeployment(wildlife);this.makeGuns();this.onDeploymentsChanged(this.world);return {valid:true};
 }
 prepareWave(wave){
  if(this.disposed||this.running)throw new Error('A wave can only be prepared outside combat.');
  wave=configuredWave(this.config,wave,this.world.level.id);
  for(const state of this.enemies.states)this.enemyCallbacks.onVisible(state.id,false);
  this.firing.dispose();this.enemies.dispose();assignWave(this.world,wave);this.wave=wave;
  this.enemies=new PlayEnemies(this.world,{config:this.config,wave,...this.enemyCallbacks});this.wildlife.setThreatSources(this.enemies.activeTargets);
  if(this.world.playCritters!==false)this.wildlife.clearFearEvents();this.makeGuns();this.waveTime=this.accumulator=0;this.completed=false;this.onDeploymentsChanged(this.world);return true;
 }
 startWave(){if(this.disposed)throw new Error('Playable engine is disposed.');if(this.running)return false;this.stopWave();this.enemies.prepare();this.makeGuns();this.waveTime=0;this.completed=false;this.running=true;this.enemies.spawnDue(0);return true;}
 stopWave(){this.running=false;this.accumulator=0;}
 presentation(dt,combat){this.time+=dt;this.onStep(dt,combat);if(this.world.playCritters!==false)this.wildlife.advance(dt);if(!combat)this.firing.settle(dt);}
 tick(dt){
  // Fixed outer ticks are split at actual schedule/exit boundaries. A due spawn
  // receives only its remaining time; hits at an exit instant resolve first.
  let remaining=dt,guard=0;
  while(remaining>1e-12&&this.running){
   if(++guard>this.enemies.states.length*2+4)throw new Error('Finite wave event budget exceeded.');
   this.enemies.spawnDue(this.waveTime);
   const untilSpawn=this.enemies.nextSpawn()-this.waveTime,untilExit=this.enemies.nextExit(),step=Math.min(remaining,untilSpawn>1e-10?untilSpawn:Infinity,untilExit>1e-10?untilExit:Infinity);
   this.presentation(step,true);this.enemies.advance(step);this.waveTime+=step;this.enemies.spawnDue(this.waveTime);this.firing.advance(step);
   this.enemies.resolveExits(this.continuing);this.onAfterStep(step,true);remaining-=step;
   if(this.running&&this.enemies.complete){this.completed=true;this.stopWave();this.onWaveComplete(this.stats());}
  }
 }
 advance(dt,options){
  if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid playable delta.');if(this.disposed||!dt)return;
  const combat=options?.combat??true;
  this.lastSteps=0;
  if(!combat||!this.running){this.presentation(dt,false);return;}
  this.accumulator+=dt;
  while(this.accumulator+1e-12>=PLAY_TICK&&this.lastSteps<PLAY_MAX_STEPS&&this.running){this.accumulator=Math.max(0,this.accumulator-PLAY_TICK);this.tick(PLAY_TICK);this.lastSteps++;this.steps++;}
 }
 stats(){return {time:this.time,waveTime:this.waveTime,running:this.running,completed:this.completed,spawned:this.enemies.spawned,pending:this.enemies.pending,active:this.enemies.alive,killed:this.enemies.killed,escaped:this.enemies.escaped,resolved:this.enemies.resolved,total:this.enemies.states.length,shots:this.firing.shots,gunShots:this.firing.turrets.shots,arcShots:this.firing.arcs.shots,missileShots:this.firing.missiles.shots,activeMissiles:this.firing.missiles.pool?.active??0,steps:this.steps,lastSteps:this.lastSteps,backlogSeconds:this.accumulator,modelLightCapacity:this.capacity.modelLights};}
 dispose(){if(this.disposed)return;this.stopWave();this.disposed=true;this.firing.dispose();this.enemies.dispose();this.wildlife.dispose();this.world=this.config=this.wave=null;this.onPoseChange=this.onShot=this.onWaveComplete=this.onStep=this.onAfterStep=this.continuing=this.onDeploymentsChanged=this.enemyCallbacks=this.combatCallbacks=null;}
}
