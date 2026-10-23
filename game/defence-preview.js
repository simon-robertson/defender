import {TurretPreview,holdGunAcquisition} from './turret-preview.js';
import {ArcSpirePreview} from './arc-spire-preview.js';
import {MissilePreview} from './missile-preview.js';
import {EnhancerPreview} from './enhancer-preview.js';
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
  this.states=[...this.turrets.states,...this.arcs.states,...this.missiles.states];this.shots=this.active=this.turning=this.updatedParts=0;
  this.planner=null;
  this.enhancers=new EnhancerPreview(world,this.states,()=>this.planner?.reset());
  this.planner=targets===null?null:new TargetPlanner(this.states,targets,{
   path:world.level.path?.length>1?new PathMotion(world.level.path,0):null,
   incomingDamage:target=>this.missiles.incomingDamage(target),
   eligible:(state,target,recoil)=>state.model==='arc-spire'?this.arcs.eligible(state,target):state.model==='missile-launcher'?this.missiles.eligible(state,target):this.turrets.eligible(state,target,recoil),
   // A route probe has no animated side surfaces. Until it can conservatively
   // certify those random rays or future guided flight, promise only gun damage.
   coverageEnabled:state=>state.model!=='arc-spire'&&state.model!=='missile-launcher',
   coverageVisible:(state,target)=>state.model!=='arc-spire'&&state.model!=='missile-launcher'&&this.turrets.eligible(state,target,0)&&this.turrets.eligible(state,target,TURRET_RECOIL.distance),
   holdTarget:state=>state.model!=='arc-spire'&&state.model!=='missile-launcher'&&holdGunAcquisition(state),
  });
  this.turrets.planner=this.arcs.planner=this.missiles.planner=this.planner;
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid defence delta.');
  this.planner?.advance(deltaSeconds);this.turrets.advance(deltaSeconds);this.arcs.advance(deltaSeconds);this.missiles.advance(deltaSeconds);
  this.shots=this.turrets.shots+this.arcs.shots+this.missiles.shots;this.active=this.turrets.active+this.arcs.active+this.missiles.active;this.turning=this.turrets.turning;this.updatedParts=this.turrets.updatedParts+this.missiles.updatedParts;
 }
 resetTargets(){this.enhancers.reset();this.planner?.reset();this.turrets.resetTargets();this.arcs.resetTargets();this.missiles.resetTargets();}
 dispose(){this.planner?.dispose();this.planner=null;this.enhancers.dispose();this.turrets.dispose();this.arcs.dispose();this.missiles.dispose();this.states.length=0;this.targets=null;this.shots=this.active=this.turning=this.updatedParts=0;}
}
