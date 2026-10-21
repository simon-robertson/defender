import {GUIDED_MISSILE_MODEL,MISSILE_LAUNCHER_SOCKETS,MISSILE_LAUNCHER_DECK_Y} from '../shared/missile-model.js';
import {MAX_MISSILES,MISSILE_FIRING} from '../shared/missile-flight.js';
import {DEFENCE_STATS} from '../shared/defence.js';
import {previewLevelForId} from '../shared/preview-levels.js';
import {isNonCombatPreview} from '../shared/preview-mode.js';
import {DefenceAim} from '../engine/targeting.js';
import {WeaponCycle} from '../engine/weapon.js';
import {MissileFlightPool} from '../engine/missile-flight.js';

const EMPTY=Object.freeze([]),NO_RECOIL=Object.freeze({sample:()=>0}),RANGE_ONLY=Object.freeze({delivery:'hitscan',projectile:null});
const remainingHealth=target=>{const value=target.health?.current;return Number.isFinite(value)&&value>=0?value:Infinity;};
export function createMissileActors(){return Object.freeze(Array.from({length:MAX_MISSILES},(_,i)=>Object.freeze({id:'preview-missile-'+(i+1),model:GUIDED_MISSILE_MODEL.id,variant:GUIDED_MISSILE_MODEL.variant})));}
export const MISSILE_PREVIEW_ACTORS=createMissileActors();
export function missileActorsForLevel(levelOrId){
 const level=typeof levelOrId==='object'&&levelOrId!==null?levelOrId:null;
 if(level)return !isNonCombatPreview(level)&&level.placements.some(p=>p.model==='missile-launcher')?MISSILE_PREVIEW_ACTORS:EMPTY;
 return previewLevelForId(levelOrId)?.missiles?MISSILE_PREVIEW_ACTORS:EMPTY;
}

// Magazine state is independent of target selection. Each actual launch binds
// one actor to that enemy; later launcher retargets never redirect flying rounds.
export class MissilePreview {
 constructor(world,onPoseChange,onVisible,targets,onHit,effects={},{stats=DEFENCE_STATS['missile-launcher'],firing=MISSILE_FIRING,deferMagazines=false}={}){
  this.targets=targets;this.states=[];this.planner=null;this.pool=null;this.thrust=null;this.shots=this.active=this.updatedParts=0;this.deferMagazines=deferMagazines;this.refillIndex=0;
  for(const placement of world.level.placements){
   if(placement.model!=='missile-launcher')continue;
   const rule=firing[placement.variant],profile=stats[placement.variant],data=world.rigs.get(placement.id),root=data.root,sockets=MISSILE_LAUNCHER_SOCKETS[placement.variant],sources=new Float64Array(sockets.length*3);
   if(!profile||!rule)throw new Error('Missile launcher profile is missing.');
   for(let i=0;i<sockets.length;i++)for(let axis=0;axis<3;axis++)sources[i*3+axis]=root[axis]*sockets[i][0]+root[4+axis]*sockets[i][1]+root[8+axis]*sockets[i][2]+root[12+axis];
   const state={id:placement.id,model:'missile-launcher',variant:placement.variant,...profile,root,rule,sources,slots:new Int16Array(rule.magazine).fill(-1),capacity:rule.magazine,ammo:0,reloading:false,reloadUntil:0,reloads:0,poolDeferrals:0,recoil:NO_RECOIL,targeting:new DefenceAim(RANGE_ONLY,profile.maxRange),cycle:null,x:root[0]*12+root[8]*12+root[12],z:root[2]*12+root[10]*12+root[14],target:null,targetDistance:null,lineOfSight:null,aimError:0,occludedTargets:0,lastShotTargetId:null,lastShotAt:-Infinity,lastShotDistance:null,hits:0,lastHitTargetId:null,lastHitDamage:0};
   state.launchRise=MISSILE_LAUNCHER_DECK_Y[placement.variant]-sockets[0][1];state.awaitingRounds=deferMagazines;
   state.cycle=new WeaponCycle(rule.cycle,at=>{
    let socket=0;while(state.slots[socket]<0)socket++;
    const slot=state.slots[socket];this.pool.launch(slot,state.target,state.strength);state.slots[socket]=-1;state.ammo--;state.awaitingRounds=false;
    state.lastShotTargetId=state.target.id;state.lastShotAt=at;state.lastShotDistance=state.targetDistance;
    if(!state.ammo){state.reloading=true;state.reloadUntil=at+rule.reload;state.awaitingRounds=deferMagazines;}
   });this.states.push(state);
  }
  if(this.states.length){
   this.pool=new MissileFlightPool(world,targets,onPoseChange,onVisible,onHit,effects);this.thrust=this.pool.thrust;
   let total=0;for(const state of this.states)total+=state.capacity;if(total>MAX_MISSILES&&!deferMagazines)throw new Error('Loaded missiles exceed the fixed pool capacity.');
   if(deferMagazines)this.refillWaiting();else for(const state of this.states)this.refill(state);
  }
 }
 refill(state){
  if(this.pool.freeCount()<state.capacity){state.poolDeferrals++;return false;}
  for(let i=0;i<state.capacity;i++){const slot=this.pool.freeSlot();state.slots[i]=slot;this.pool.seat(slot,state,state.sources[i*3],state.sources[i*3+1],state.sources[i*3+2],state.root);}
  state.ammo=state.capacity;state.reloading=false;state.reloadUntil=0;return true;
 }
 // Player scenes retain the same fixed projectile pool. If an unusual loadout
 // cannot seat every magazine, rotate one round per waiting launcher before
 // filling second rounds. No launcher can hoard all newly freed actors.
 refillWaiting(){
  const count=this.states.length;if(!count)return;
  let progress=true;
  while(progress&&this.pool.freeCount()){
   progress=false;
   for(let priority=0;priority<2;priority++)for(let offset=0;offset<count&&this.pool.freeCount();offset++){
    const state=this.states[(this.refillIndex+offset)%count];
    if(!state.awaitingRounds||state.ammo>=state.capacity||this.pool.time<state.reloadUntil||(priority===0?state.ammo!==0:state.ammo===0))continue;
    let socket=0;while(state.slots[socket]>=0)socket++;
    const slot=this.pool.freeSlot();state.slots[socket]=slot;this.pool.seat(slot,state,state.sources[socket*3],state.sources[socket*3+1],state.sources[socket*3+2],state.root);state.ammo++;progress=true;
    if(state.reloading){state.reloading=false;state.reloads++;}
   }
  }
  this.refillIndex=(this.refillIndex+1)%count;
  for(const state of this.states)if(!state.ammo&&this.pool.time>=state.reloadUntil){state.reloading=true;state.poolDeferrals++;}
 }
 incomingDamage(target){return this.pool?.incomingDamage(target)??0;}
 eligible(state,target){
  return state.ammo>0&&!state.reloading&&!!target&&target.health?.alive!==false&&typeof target.id==='string'&&Number.isFinite(target.aimY)&&this.targets.includes(target)&&remainingHealth(target)>this.incomingDamage(target)&&state.targeting.solve(state.x,state.z,target)&&this.clearShot(state,target);
 }
 clearShot(state,target){
  let socket=0;while(socket<state.slots.length&&state.slots[socket]<0)socket++;
  return socket<state.slots.length&&this.pool.launchClear(state.slots[socket],target);
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid missile preview delta.');
  if(!this.pool)return;
  this.pool.advance(deltaSeconds);this.shots=0;if(this.deferMagazines)this.refillWaiting();
  for(const state of this.states){
   if(!this.deferMagazines&&state.reloading&&this.pool.time>=state.reloadUntil&&this.refill(state))state.reloads++;
   let target=state.target;
   if(target&&(state.targetLap!==(target.lap??0)||!this.eligible(state,target))){state.cycle.cancelBurst();state.target=target=null;}
   state.targetDistance=target?Math.hypot(target.x-state.x,target.z-state.z):null;state.lineOfSight=target?true:null;
   const cycle=state.cycle;cycle.advanceLive(deltaSeconds,!!target);
   // Earlier silos in this same frame may already cover the remaining HP.
   // Holding a partial magazine never spends ammunition or moves readyAt.
   if(target&&cycle.ready&&remainingHealth(target)>this.incomingDamage(target))cycle.trigger();this.shots+=cycle.shots;
  }
  this.pool.prepare();this.active=this.pool.active;this.updatedParts=this.pool.updatedParts;
 }
 resetTargets(){
  if(!this.pool)return;this.pool.reset();
  for(const state of this.states){state.cycle.cancelBurst();state.target=null;state.targetDistance=state.lineOfSight=null;state.targeting.point.fill(0);state.slots.fill(-1);state.ammo=0;state.reloads=state.poolDeferrals=0;state.reloading=false;state.reloadUntil=0;state.awaitingRounds=this.deferMagazines;if(!this.deferMagazines)this.refill(state);}
  if(this.deferMagazines)this.refillWaiting();
  this.pool.collisions=this.pool.expired=this.pool.lostTargets=this.pool.stallDiscards=0;this.pool.prepare();this.active=0;this.updatedParts=this.pool.updatedParts;
 }
 dispose(){this.pool?.dispose();this.pool=null;this.thrust=null;for(const state of this.states)state.target=null;this.states.length=0;this.targets=this.planner=null;this.shots=this.active=this.updatedParts=0;}
}
