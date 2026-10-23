import {TurretPreview,holdGunAcquisition} from './turret-preview.js';
import {ArcSpirePreview} from './arc-spire-preview.js';
import {MissilePreview} from './missile-preview.js';
import {EnhancerPreview} from './enhancer-preview.js';
import {DronePreview} from './drone-preview.js';
import {TargetPlanner} from '../engine/target-planner.js';
import {PathMotion} from '../engine/path-motion.js';
import {TURRET_RECOIL} from '../shared/arsenal.js';

// One coordinator for every defence family: one ranking pass per frame, while
// every weapon continues to validate/animate/fire. This also supports mixed
// authored scenes without two independent planners promising the same damage.
export class DefencePreview {
 constructor(world,onPoseChange,random=Math.random,onGunShot=null,targets=null,onHit=null,onArcShot=null,onVisible=null,missileEffects={}){
  this.targets=targets;
  this.turrets=new TurretPreview(world,onPoseChange,random,onGunShot,targets,onHit,{sharedPlanner:true});
  this.arcs=new ArcSpirePreview(world,targets??[],random,onArcShot,onHit);
  this.missiles=new MissilePreview(world,onPoseChange,onVisible,targets??[],onHit,missileEffects);
  this.drones=new DronePreview(world,onPoseChange,targets??[],onHit,onGunShot);
  this.states=[...this.turrets.states,...this.arcs.states,...this.missiles.states,...this.drones.states];this.shots=this.active=this.turning=this.updatedParts=0;
  this.planner=null;
  // Generator interaction with a mobile aircraft is unassigned. Its parked pad
  // must not grant a permanent neighbour bonus after the weapon flies away.
  this.enhancers=new EnhancerPreview(world,this.states.filter(state=>!state.mobile),()=>this.planner?.reset());
  this.planner=targets===null?null:new TargetPlanner(this.states,targets,{
   path:world.level.path?.length>1?new PathMotion(world.level.path,0):null,
   incomingDamage:target=>this.missiles.incomingDamage(target),
   eligible:(state,target,recoil)=>state.mobile?this.drones.eligible(state,target):state.model==='arc-spire'?this.arcs.eligible(state,target):state.model==='missile-launcher'?this.missiles.eligible(state,target):this.turrets.eligible(state,target,recoil),
   // A route probe has no animated side surfaces. Until it can conservatively
   // certify those random rays or future guided flight, promise only gun damage.
   coverageEnabled:state=>!state.mobile&&state.model!=='arc-spire'&&state.model!=='missile-launcher',
   coverageVisible:(state,target)=>!state.mobile&&state.model!=='arc-spire'&&state.model!=='missile-launcher'&&this.turrets.eligible(state,target,0)&&this.turrets.eligible(state,target,TURRET_RECOIL.distance),
   prepareState:state=>{if(state.mobile)this.drones.prepare(state);},
   onSelected:(state,target)=>{if(state.mobile)this.drones.selected(state,target);},
   scoreTarget:(state,target,score)=>state.mobile?this.drones.priority(state,target,score):score,
   priorityTarget:(state,target)=>state.mobile?this.drones.escapeRank(state,target):0,
   committedDamage:(state,target)=>state.mobile?this.drones.commitment(state,target):0,
   holdTarget:state=>!state.mobile&&state.model!=='arc-spire'&&state.model!=='missile-launcher'&&holdGunAcquisition(state),
  });
  this.turrets.planner=this.arcs.planner=this.missiles.planner=this.drones.planner=this.planner;
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid defence delta.');
  this.drones.prepareCollisionFrame(deltaSeconds);this.planner?.advance(deltaSeconds);this.turrets.advance(deltaSeconds);this.arcs.advance(deltaSeconds);this.missiles.advance(deltaSeconds);this.drones.advance(deltaSeconds);
  this.shots=this.turrets.shots+this.arcs.shots+this.missiles.shots+this.drones.shots;this.active=this.turrets.active+this.arcs.active+this.missiles.active+this.drones.active;this.turning=this.turrets.turning+this.drones.turning;this.updatedParts=this.turrets.updatedParts+this.missiles.updatedParts+this.drones.updatedParts;
 }
 resetTargets(){this.enhancers.reset();this.planner?.reset();this.turrets.resetTargets();this.arcs.resetTargets();this.missiles.resetTargets();this.drones.reset();}
 dispose(){this.planner?.dispose();this.planner=null;this.enhancers.dispose();this.turrets.dispose();this.arcs.dispose();this.missiles.dispose();this.drones.dispose();this.states.length=0;this.targets=null;this.shots=this.active=this.turning=this.updatedParts=0;}
}
