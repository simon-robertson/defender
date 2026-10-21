import {ARC_SPIRE_FIRING,ARC_SPIRE_TERMINALS} from '../shared/arsenal.js';
import {DEFENCE_STATS} from '../shared/defence.js';
import {WeaponCycle} from '../engine/weapon.js';
import {DefenceAim} from '../engine/targeting.js';
import {ArcImpactSampler} from '../engine/arc-impact.js';

const NO_RECOIL=Object.freeze({sample:()=>0});
const SURFACE_RETRY_SECONDS=.5;
export const ARC_CHAIN_RANGE_SCALE=.5,ARC_CHAIN_STRENGTH=.25;
// Fixed crown, no invented aiming joint. The shared DefencePreview planner owns
// acquisition; each locked spire still validates its current target every frame.
export class ArcSpirePreview {
 constructor(world,targets,random=Math.random,onShot=null,onHit=null,{stats=DEFENCE_STATS['arc-spire'],firing=ARC_SPIRE_FIRING}={}){
  this.targets=targets;this.visibility=world.visibility;this.states=[];this.planner=null;this.onShot=onShot;this.onHit=onHit;this.shots=0;this.active=0;this.random=random;this.chainHits=0;
  this.chainEye=new Float64Array(3);this.chainSource=new Float64Array(3);this.chainSourceLocal=new Float64Array(3);this.chainCandidateSource=new Float64Array(3);this.chainPoint=new Float64Array(3);this.chainNormal=new Float64Array(3);this.chainLocal=new Float64Array(3);
  for(const placement of world.level.placements){
   if(placement.model!=='arc-spire')continue;
   const profile=stats[placement.variant],rule=firing[placement.variant],data=world.rigs.get(placement.id),m=data.root,sockets=ARC_SPIRE_TERMINALS[placement.variant];
   if(!profile||!rule)throw new Error('Arc Spire profile is missing.');
   const sources=new Float64Array(sockets.length*3);
   for(let i=0;i<sockets.length;i++)for(let axis=0;axis<3;axis++)sources[i*3+axis]=m[axis]*sockets[i][0]+m[4+axis]*sockets[i][1]+m[8+axis]*sockets[i][2]+m[12+axis];
   const state={id:placement.id,model:'arc-spire',variant:placement.variant,...profile,x:m[0]*12+m[8]*12+m[12],z:m[2]*12+m[10]*12+m[14],sources,source:new Float64Array(3),terminal:0,recoil:NO_RECOIL,targeting:new DefenceAim(rule,profile.maxRange),cycle:null,target:null,targetDistance:null,lineOfSight:null,aimError:0,occludedTargets:0,lastShotTargetId:null,lastShotAt:-Infinity,lastShotDamage:0,lastShotDistance:null,lastChainSourceLocal:new Float64Array(3),lastImpact:new Float64Array(3),lastNormal:new Float64Array(3),lastImpactPart:null,surfaceRejects:0};
   // Active target arrays compact on death/escape. Keep retries on the enemy
   // identity so another enemy cannot inherit its temporary surface rejection.
   state.surfaceRetryAt=new WeakMap();
   state.cycle=new WeaponCycle(rule,at=>{
    const target=state.target,contact=this.contacts;
    state.lastShotTargetId=target.id;state.lastShotAt=at;state.lastShotDistance=state.targetDistance;state.lastImpact.set(contact.point);state.lastNormal.set(contact.normal);state.lastImpactPart=contact.partId;
    // Resolve one hitscan pulse; visual flicker does not create extra damage.
    state.lastShotDamage=this.onHit?.(target,state.strength)??0;
    this.onShot?.(state.source,contact.point,contact.normal,at,contact.matrix,contact.localPoint);
    if(state.variant!=='base'&&state.lastShotDamage>0)this.chain(state,target,at);
    if(target.health?.alive===false){state.cycle.cancelBurst();state.target=null;state.targetDistance=state.lineOfSight=null;}
   });
   this.states.push(state);
  }
  this.contacts=this.states.length?new ArcImpactSampler(world,targets,random):null;
  this.chainContacts=this.states.some(state=>state.variant!=='base')?new ArcImpactSampler(world,targets,random):null;
 }
 chain(state,primary,at){
  // Both upgraded tiers transfer from the struck enemy's outgoing surface,
  // then reservoir-select uniformly among physically clear recipients. There
  // is no speculative secondary promise and no recursive invocation.
  const sampler=this.chainContacts,source=this.chainCandidateSource,record=sampler.records.get(primary),range=state.maxRange*ARC_CHAIN_RANGE_SCALE;
  let count=0,chosen=null,matrix=null,sourceMatrix=null;
  state.lastChainTargetId=null;state.lastChainDamage=0;
  for(const target of this.targets){
   if(target===primary||target.health?.alive===false||(target.phase&&target.phase!=='active')||!Number.isFinite(target.aimY))continue;
   const dx=target.x-primary.x,dy=target.aimY-primary.aimY,dz=target.z-primary.z;
   if(dx*dx+dy*dy+dz*dz>range**2+1e-8)continue;
   this.chainEye[0]=target.aimX??target.x;this.chainEye[1]=target.aimY;this.chainEye[2]=target.aimZ??target.z;
   // The incoming hit often faces away from the next enemy. Select an exposed
   // departure surface facing the recipient instead of threading the body.
   // A lethal primary hit may still conduct this pulse through its final pose.
   let candidateMatrix=null,connected=false;
   for(let attempt=0;attempt<16;attempt++){
    if(!sampler.sample(primary,this.chainEye,this.visibility,undefined,true))break;
    source.set(sampler.point);candidateMatrix=sampler.matrix;this.chainSourceLocal.set(sampler.localPoint);
    if(!sampler.sample(target,source,this.visibility))continue;
    if(sampler.selfClear(record,source)){connected=true;break;}
   }
   if(!connected)continue;
   if(this.random()*++count>=1)continue;
   chosen=target;matrix=sampler.matrix;sourceMatrix=candidateMatrix;this.chainSource.set(source);state.lastChainSourceLocal.set(this.chainSourceLocal);this.chainPoint.set(sampler.point);this.chainNormal.set(sampler.normal);this.chainLocal.set(sampler.localPoint);
  }
  if(!chosen)return;
  state.lastChainDamage=this.onHit?.(chosen,state.strength*ARC_CHAIN_STRENGTH)??0;
  if(!(state.lastChainDamage>0))return;
  state.lastChainTargetId=chosen.id;this.chainHits++;
  this.onShot?.(this.chainSource,this.chainPoint,this.chainNormal,at,matrix,this.chainLocal,true,sourceMatrix,state.lastChainSourceLocal);
 }
 chooseTerminal(state,target){
  let selected=0,best=Infinity;
  for(let i=0;i<state.sources.length;i+=3){const d=(target.x-state.sources[i])**2+(target.z-state.sources[i+2])**2;if(d<best){selected=i;best=d;}}
  state.terminal=selected/3;for(let axis=0;axis<3;axis++)state.source[axis]=state.sources[selected+axis];
 }
 eligible(state,target){
  if(!target||target.health?.alive===false||typeof target.id!=='string'||!Number.isFinite(target.aimY)||!state.targeting.solve(state.x,state.z,target))return false;
  if(state.cycle.time<(state.surfaceRetryAt.get(target)??0))return false;
  this.chooseTerminal(state,target);const p=state.source;
  if(state.requiresLineOfSight&&!this.visibility?.clear(p[0],p[1],p[2],state.targeting.point[0],target.aimY,state.targeting.point[1],state.id)){state.occludedTargets++;return false;}
  return true;
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid Arc Spire delta.');
  this.shots=0;this.active=0;
  for(const state of this.states){
   const cycle=state.cycle;let target=state.target;
   if(target&&(!this.targets.includes(target)||state.targetLap!==(target.lap??0)||!this.eligible(state,target))){cycle.cancelBurst();state.target=target=null;}
   state.targetDistance=target?Math.hypot(target.x-state.x,target.z-state.z):null;state.lineOfSight=target?true:null;
   let canFire=target!==null;
   const now=cycle.time+deltaSeconds,due=cycle.remaining?now>=cycle.nextShotAt:now>=cycle.readyAt;
   if(canFire&&due&&!this.contacts.sample(target,state.source,this.visibility,state.id)){
    state.surfaceRetryAt.set(target,now+SURFACE_RETRY_SECONDS);
    state.surfaceRejects++;state.target=null;state.targetDistance=state.lineOfSight=null;canFire=false;
   }
   const shots=cycle.shots;cycle.advanceLive(deltaSeconds,canFire);
   if(canFire&&cycle.ready&&cycle.shots===shots)cycle.trigger();
   this.shots+=cycle.shots;if(cycle.remaining)this.active++;
  }
 }
 resetTargets(){
  for(const state of this.states){state.cycle.cancelBurst();state.target=null;state.targetDistance=state.lineOfSight=null;state.targeting.point.fill(0);state.surfaceRetryAt=new WeakMap();}
 }
 dispose(){this.contacts?.dispose();this.chainContacts?.dispose();this.contacts=this.chainContacts=null;this.resetTargets();this.states.length=0;this.targets=null;this.visibility=null;this.planner=null;this.onShot=this.onHit=this.random=null;this.shots=this.active=this.chainHits=0;}
}
