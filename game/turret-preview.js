import {TURRET_FIRING,TURRET_RECOIL,TURRET_TURN,TURRET_PITCH,TURRET_AIM_TOLERANCE,TURRET_MUZZLES} from '../shared/arsenal.js';
import {DEFENCE_STATS} from '../shared/defence.js';
import {WeaponCycle,RecoilTrack} from '../engine/weapon.js';
import {PoseRig} from '../engine/rig.js';
import {YawTurn,YawTracker,yawError} from '../engine/turn.js';
import {PitchTracker} from '../engine/pitch.js';
import {DefenceAim} from '../engine/targeting.js';
import {TargetPlanner,TARGET_POLICY} from '../engine/target-planner.js';
import {ArcImpactSampler} from '../engine/arc-impact.js';
import {PathMotion} from '../engine/path-motion.js';

const TAU=Math.PI*2;

// A selected gun target gets a real opportunity to receive its first pulse.
// Cooldown after the previous kill is not acquisition time. The bounded grace
// prevents a valid but never hittable lock from trapping the gun indefinitely;
// the planner still releases dead/out-of-range/blocked targets immediately.
export function holdGunAcquisition(state){
 return state.cycle.shots===state.targetShots&&state.cycle.time<Math.max(state.targetSince,state.cycle.readyAt)+TARGET_POLICY.acquireSeconds;
}

// Reused live targets opt into tracking; null retains the random zone studies.
// One state/rig per placed turret; no entities or event objects are spawned.
export class TurretPreview {
 constructor(world,onPoseChange,random=Math.random,onShot=null,targets=null,onHit=null,{sharedPlanner=false,stats=DEFENCE_STATS,firing=TURRET_FIRING,onImpact=null}={}){
  if(targets!==null&&!Array.isArray(targets))throw new Error('Live targets must be a reused array.');
  let impactSeed=21437;const impactRandom=()=>{impactSeed=(Math.imul(impactSeed,1664525)+1013904223)>>>0;return impactSeed/4294967296;};
  this.contacts=onImpact&&targets!==null?new ArcImpactSampler(world,targets,impactRandom):null;this.impactSource=new Float64Array(3);
  this.random=random;this.onShot=onShot;this.onHit=onHit;this.targets=targets;this.visibility=world.visibility??null;this.states=[];this.active=0;this.turning=0;this.shots=0;this.updatedParts=0;
  for(const placement of world.level.placements){
   if(placement.model!=='turret-study')continue;
   const rule=firing[placement.variant];if(!rule)continue;
   const recoil=new RecoilTrack(TURRET_RECOIL);
   const rig=new PoseRig(world.rigs.get(placement.id),onPoseChange);
   const head=rig.byId.get(TURRET_TURN.part),guns=rig.byId.get(TURRET_PITCH.part);
   if(!head||!guns||guns.parent!==head)throw new Error('Turret requires head yaw and child guns pitch joints.');
   const defence=stats[placement.model]?.[placement.variant];if(!defence)throw new Error('Defence statistics are missing.');
   if(targets!==null&&defence.requiresLineOfSight&&!this.visibility)throw new Error('Live turret targeting requires scene visibility.');
   const pivot=head.part.pivot,root=rig.root;
   const state={id:placement.id,variant:placement.variant,groundFirst:true,cycle:null,recoil,rig,aim:targets===null?new YawTurn(TURRET_TURN):new YawTracker(TURRET_TURN),pitch:new PitchTracker(TURRET_PITCH),gunPivot:guns.part.pivot,nextAimAt:targets===null?.2+this.random()*1.8:Infinity,turning:false,displacement:0,headMatrix:head.instance.matrix,gunMatrix:guns.instance.matrix,pendingTimes:new Float64Array(rule.shotsPerBurst),pendingCount:0,
    maxRange:defence.maxRange,strength:defence.strength,requiresLineOfSight:defence.requiresLineOfSight,pivot,muzzles:TURRET_MUZZLES[placement.variant],targeting:new DefenceAim(rule,defence.maxRange),x:root[0]*pivot[0]+root[8]*pivot[2]+root[12],z:root[2]*pivot[0]+root[10]*pivot[2]+root[14],target:null,targetDistance:null,aimError:null,lineOfSight:null,occludedTargets:0,lastShotTargetId:null,lastShotDistance:null,lastShotAimError:null,lastShotVisible:null};
   state.targetPitch=state.pitchError=state.pitchReachable=state.lastShotPitchError=null;state.lastShotDamage=0;
   state.cycle=new WeaponCycle(rule,at=>{
    recoil.fire(at);
    if(this.targets!==null){
     const target=state.target;
     state.lastShotTargetId=target.id;state.lastShotDistance=state.targetDistance;state.lastShotAimError=state.aimError;state.lastShotPitchError=state.pitchError;state.lastShotVisible=state.lineOfSight;
     // One hit for the paired barrels. Resolve before the next turret selects
     // its target; visual callbacks are deferred until the final muzzle pose.
     if(this.contacts){const m=state.gunMatrix,p=state.muzzles[0],source=this.impactSource;for(let a=0;a<3;a++)source[a]=m[a]*p[0]+m[4+a]*p[1]+m[8+a]*p[2]+m[12+a];
      if(this.contacts.sample(target,source,this.visibility,state.id))onImpact(this.contacts.point,this.contacts.normal,at);
     }
     state.lastShotDamage=rule.delivery==='hitscan'?(this.onHit?.(target,state.strength)??0):0;
     if(target.health?.alive===false){
      state.cycle.cancelBurst();state.target=null;state.targetDistance=state.aimError=state.lineOfSight=state.targetPitch=state.pitchError=state.pitchReachable=null;
     }
    }
    if(this.onShot)state.pendingTimes[state.pendingCount++]=at;
   });this.states.push(state);
  }
  this.ownsPlanner=!sharedPlanner;
  this.planner=targets===null||sharedPlanner?null:new TargetPlanner(this.states,targets,{path:world.level.path?.length>1?new PathMotion(world.level.path,0):null,eligible:(state,target,recoil)=>this.eligible(state,target,recoil),coverageVisible:(state,target)=>this.eligible(state,target,0)&&this.eligible(state,target,TURRET_RECOIL.distance),holdTarget:holdGunAcquisition});
 }
 targetYaw(state){
  const point=state.targeting.point,dx=point[0]-state.x,dz=point[1]-state.z,root=state.rig.root;
  return dx===0&&dz===0?state.aim.yaw:Math.atan2(-(root[0]*dx+root[2]*dz),-(root[8]*dx+root[10]*dz));
 }
 targetPitch(state,target,yaw){
  if(!Number.isFinite(target.aimY))return NaN;
  const root=state.rig.root,h=state.pivot,g=state.gunPivot,c=Math.cos(yaw),s=Math.sin(yaw),point=state.targeting.point;
  const x=h[0]+c*(g[0]-h[0])+s*(g[2]-h[2]),y=g[1],z=h[2]-s*(g[0]-h[0])+c*(g[2]-h[2]);
  const wx=root[0]*x+root[4]*y+root[8]*z+root[12],wy=root[1]*x+root[5]*y+root[9]*z+root[13],wz=root[2]*x+root[6]*y+root[10]*z+root[14];
  return Math.atan2(target.aimY-wy,Math.hypot(point[0]-wx,point[1]-wz));
 }
 hasSight(state,target,yaw,pitch,recoil){
  if(!state.requiresLineOfSight)return true;
  if(!Number.isFinite(target.aimY))return false;
  const root=state.rig.root,pivot=state.pivot,g=state.gunPivot,c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),point=state.targeting.point;
  // Match PoseRig: guns X pitch and local +Z recoil, then parent head yaw.
  // Candidate transforms acquire targets; actual angles validate each pulse.
  for(let i=0;i<state.muzzles.length;i++){
   const muzzle=state.muzzles[i],dy=muzzle[1]-g[1],dz=muzzle[2]-g[2]+recoil;
   const gx=muzzle[0]-pivot[0],gz=g[2]+sp*dy+cp*dz-pivot[2];
   const x=pivot[0]+c*gx+s*gz,y=g[1]+cp*dy-sp*dz,z=pivot[2]-s*gx+c*gz;
   const wx=root[0]*x+root[4]*y+root[8]*z+root[12],wy=root[1]*x+root[5]*y+root[9]*z+root[13],wz=root[2]*x+root[6]*y+root[10]*z+root[14];
   if(!this.visibility.clear(wx,wy,wz,point[0],target.aimY,point[1],state.id))return false;
  }
  return true;
 }
 eligible(state,target,recoil){
  if(!target||target.health?.alive===false||typeof target.id!=='string'||!state.targeting.solve(state.x,state.z,target))return false;
  const yaw=this.targetYaw(state),pitch=this.targetPitch(state,target,yaw);
  if(!state.pitch.reachable(pitch))return false;
  if(!this.hasSight(state,target,yaw,pitch,recoil)){state.occludedTargets++;return false;}
  return true;
 }
 selectTarget(state,recoil=state.recoil.sample(state.cycle.time)){
  return this.planner.choose(state,this.states.indexOf(state),recoil);
 }
 track(state,deltaSeconds){
  const cycle=state.cycle,aim=state.aim,pitch=state.pitch,recoil=state.recoil.sample(cycle.time+deltaSeconds);let target=state.target;
  // The thinker has already checked candidate-facing visibility this frame.
  // Other weapons only validate their lock. Ground presence is cached once by
  // the planner, so the air-priority shot gate adds no per-gun roster scan.
  if(target&&(!this.planner.targetAllowed(state,target)||!this.targets.includes(target)||target.health?.alive===false||state.targetLap!==(target.lap??0)||!(this.planner.lastThinkId===state.id?state.targeting.solve(state.x,state.z,target):this.eligible(state,target,recoil)))){cycle.cancelBurst();state.target=target=null;}
  const angle=target?this.targetYaw(state):0,targetPitch=target?this.targetPitch(state,target,angle):NaN;
  if(target&&!pitch.reachable(targetPitch)){cycle.cancelBurst();state.target=target=null;}
  if(target){
   aim.track(angle,deltaSeconds);pitch.track(targetPitch,deltaSeconds);state.targetDistance=Math.hypot(target.x-state.x,target.z-state.z);state.aimError=yawError(angle,aim.yaw);
   state.targetPitch=targetPitch;state.pitchError=targetPitch-pitch.angle;state.pitchReachable=true;
   state.lineOfSight=this.hasSight(state,target,aim.yaw,pitch.angle,recoil);
  }else{aim.brake(deltaSeconds);pitch.brake(deltaSeconds);state.targetDistance=state.aimError=state.lineOfSight=state.targetPitch=state.pitchError=state.pitchReachable=null;}
  state.turning=aim.active||pitch.active;
  const canFire=target!==null&&state.lineOfSight&&Math.abs(state.aimError)<=TURRET_AIM_TOLERANCE&&Math.abs(state.pitchError)<=TURRET_PITCH.tolerance,shots=cycle.shots;
  cycle.advanceLive(deltaSeconds,canFire);
  // Never emit a second current pulse even if a future rule uses zero cooldown.
  if(canFire&&cycle.ready&&cycle.shots===shots)cycle.trigger();
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid turret delta.');
  this.active=0;this.turning=0;this.shots=0;this.updatedParts=0;
  if(this.ownsPlanner)this.planner?.advance(deltaSeconds);
  for(let i=0;i<this.states.length;i++){
   const state=this.states[i],cycle=state.cycle,aim=state.aim;
   if(this.targets!==null)this.track(state,deltaSeconds);
   else{
    cycle.advance(deltaSeconds);
    if(state.turning){
     aim.advance(deltaSeconds);
     if(!aim.active){
      state.turning=false;
      cycle.trigger();state.nextAimAt=cycle.readyAt+.35+this.random()*1.65;
     }
    }else if(cycle.ready&&cycle.time>=state.nextAimAt){
     aim.begin(aim.yaw,this.random()*TAU-Math.PI);state.turning=true;
    }
   }
   // Random studies begin new turns next frame and hold burst headings. Live
   // targets keep turning through recoil/cooldown, with every pulse revalidated.
   state.displacement=state.recoil.sample(cycle.time);
   state.rig.setRotation(TURRET_TURN.part,0,aim.yaw,0);
   state.rig.setRotation(TURRET_PITCH.part,state.pitch.angle,0,0);
   state.rig.setTranslation(TURRET_RECOIL.part,0,0,state.displacement);this.updatedParts+=state.rig.update();
   // Emit after the final pose update, so yaw/recoil and muzzle effects agree.
   // Random studies retain scheduled times; live pulses use the current time.
   for(let shot=0;shot<state.pendingCount;shot++)this.onShot(state.variant,state.gunMatrix,state.pendingTimes[shot]);state.pendingCount=0;
   if(state.displacement>0)this.active++;if(state.turning)this.turning++;this.shots+=cycle.shots;
  }
 }
 resetTargets(){
  if(this.ownsPlanner)this.planner?.reset();
  for(const state of this.states){state.cycle.cancelBurst();state.target=null;state.pendingCount=0;state.targetDistance=state.aimError=state.lineOfSight=state.targetPitch=state.pitchError=state.pitchReachable=null;state.targeting.point.fill(0);}
 }
 dispose(){this.contacts?.dispose();this.contacts=null;if(this.ownsPlanner)this.planner?.dispose();this.planner=null;for(const state of this.states)state.target=null;this.states.length=0;this.targets=null;this.visibility=null;this.onShot=this.onHit=null;this.active=this.turning=this.shots=this.updatedParts=0;}
}
