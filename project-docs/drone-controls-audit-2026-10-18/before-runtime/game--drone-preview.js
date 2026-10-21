import {DRONE_TUNING,DRONE_PREVIEW as T} from '../shared/drone.js';
import {DRONE_MODEL as M,DRONE_ROTORS} from '../shared/drone-model.js';
import {PoseRig} from '../engine/rig.js';
import {WeaponCycle} from '../engine/weapon.js';
import {YawTracker,yawError} from '../engine/turn.js';
import {PitchTracker} from '../engine/pitch.js';
import {DefenceAim} from '../engine/targeting.js';
import {DroneNavigation,droneBoxesOverlap} from '../engine/drone-navigation.js';
import {DroneMotion} from '../engine/drone-motion.js';
import {DroneObstacles} from '../engine/drone-obstacles.js';

const TAU=2*Math.PI,BASE=DRONE_TUNING.base;
const active=s=>s.phase==='intercept'||s.phase==='attack';
const neutralPhase=s=>s.phase==='pad-hover'||s.phase==='recharge'||s.phase==='launch'||s.phase==='descend';
const living=t=>t&&t.health?.alive!==false;
const exitSeconds=t=>t.path&&t.movement?.speed>0?Math.max(0,(t.path.length-t.distance)/t.movement.speed):Infinity;
function transform(m,x,y,z,out){out[0]=m[0]*x+m[4]*y+m[8]*z+m[12];out[1]=m[1]*x+m[5]*y+m[9]*z+m[13];out[2]=m[2]*x+m[6]*y+m[10]*z+m[14];}

// The pad's placement root never changes. A separate aircraft root carries all
// flight/attitude, four always-powered rotors and independent fine gun servos.
export class DronePreview {
 constructor(world,onPoseChange,targets=[],onHit=null,onShot=null){
  this.world=world;this.targets=targets??[];this.onHit=onHit;this.onShot=onShot;this.states=[];this.navigation=null;this.planner=null;this.time=0;this.shots=this.active=this.turning=this.updatedParts=0;
  this.point=new Float64Array(3);this.sample=new Float64Array(5);this.fleetBounds=new Float64Array(6);this.disposed=false;this.obstacles=null;
  for(const placement of world.level.placements){
   if(placement.model!==M.id)continue;
   if(placement.variant!=='base')throw new Error('Drone upgrade combat tuning is unassigned.');
   this.navigation??=new DroneNavigation(world);
   this.obstacles??=new DroneObstacles(world,this.targets);
   const rig=new PoseRig(world.rigs.get(placement.id),onPoseChange),root=rig.root;
   transform(root,12,9,12,this.point);
   const state={id:placement.id,model:M.id,variant:placement.variant,mobile:true,rig,x:this.point[0],y:this.point[1],z:this.point[2],homeX:this.point[0],homeZ:this.point[2],ground:root[13],padIndex:this.navigation.padIndices.get(placement.id),
    phase:'pad-hover',flightElapsed:0,rechargeRemaining:0,expired:false,launches:0,returns:0,shotsAtExpiry:null,returnStartedAt:null,
    cycle:null,recoil:{sample:()=>0},targeting:new DefenceAim(BASE.weapon,T.maxRange),maxRange:T.maxRange,strength:BASE.weapon.strength,requiresLineOfSight:true,
    aim:new YawTracker(T.bodyTurn),gunYaw:new PitchTracker(T.fineYaw),pitch:new PitchTracker(T.pitch),bodyPitch:0,bodyRoll:0,rotorPhase:0,fanPitch:0,fanRoll:0,yawAcceleration:0,
    fans:DRONE_ROTORS.map(rotor=>({id:rotor.id,gimbal:rotor.gimbal,pitch:0,roll:0,targetPitch:0,targetRoll:0})),
    gunMatrix:rig.byId.get(M.gunPitch).instance.matrix,yawMatrix:rig.byId.get(M.gunYaw).instance.matrix,bodyMatrix:rig.byId.get(M.body).instance.matrix,
    target:null,targetLap:0,targetDistance:null,aimError:null,pitchError:null,lineOfSight:false,occludedTargets:0,lastShotAt:null,lastShotTargetId:null,lastShotDamage:0,lastShotDistance:null,lastShotVisible:null,lastShotAimError:null,lastShotPitchError:null,
    nav:this.navigation.createSearch(),motion:new DroneMotion(this.navigation.count*2),homeNode:-1,goalNode:-1,plannedTarget:null,plannedLap:0,nextPlanAt:0,planReady:false,planVersion:0,routeVersion:-1,blocked:false,holds:0,replans:0,velocityX:0,velocityY:0,velocityZ:0,accelerationX:0,accelerationY:0,accelerationZ:0,speed:0,verticalSpeed:0,stationChanges:0,routeChanges:0,emergencyStops:0,returnPlanning:false,retargetPending:false,
    candidateNodes:new Int32Array(this.targets.length).fill(-1),candidateTimes:new Float64Array(this.targets.length),candidateLap:new Float64Array(this.targets.length),
    candidateWindows:new Float64Array(this.targets.length*5),shortNodes:new Int32Array(T.stationShortlist),shortScores:new Float64Array(T.stationShortlist),shortTimes:new Float64Array(T.stationShortlist),window:new Float64Array(5),stationCommitted:false,stationInvalidated:false,stationHasFired:false,stationArrivalAt:null,stationFireAt:null,stationWindowEnd:null,stationPulses:0,stationScore:0,committedThinks:0,evasions:0,evading:false,wantEvade:false,evadeNeutral:false,evadeResume:null,resumeRecharge:null,
   };
   state.homeNode=this.navigation.home(state);
   if(state.homeNode<0)throw new Error('Drone pad has no safe neutral departure lane: '+state.id);
   state.cycle=new WeaponCycle(BASE.weapon,at=>{
    const target=state.target;state.lastShotAt=at;state.lastShotTargetId=target.id;state.lastShotDistance=state.targetDistance;state.lastShotVisible=state.lineOfSight;state.lastShotAimError=state.aimError;state.lastShotPitchError=state.pitchError;state.stationHasFired=true;
    state.lastShotDamage=this.onHit?.(target,state.strength)??0;
    this.onShot?.(state.variant,state.gunMatrix,at,M.muzzles);
    if(!living(target)){state.cycle.cancelBurst();state.target=null;state.lineOfSight=false;}
   });this.states.push(state);this.writePose(state,0,true);
  }
 }
 setWildlife(states){this.obstacles?.setWildlife(states);}
 prepareCollisionFrame(dt){
  this.obstacles?.update(dt);
  for(const state of this.states){
   // A parked firing position is not protection against an incoming flyer.
   // The obstacle cache reserves its complete next-second movement envelope.
   if(!state.evading&&!this.dynamicPointClear(state,state.x,state.y,state.z,1)){
    if(state.phase==='pad-hover'&&this.hasLivingTargets())this.startLaunch(state);
    state.wantEvade=true;state.cycle.cancelBurst();state.target=state.reservation=null;state.stationCommitted=false;state.planReady=false;state.retargetPending=true;
   }
  }
 }
 dynamicPointClear(state,x,y,z,horizon=0){
  if(!neutralPhase(state))return this.obstacles?.pointClear(x,y,z,T.hullRadius,horizon)??true;
  const b=this.fleetBounds;b[0]=x-11;b[1]=y-5;b[2]=z-11;b[3]=x+11;b[4]=y+5;b[5]=z+11;return this.obstacles?.clearBox(b,horizon)??true;
 }
 prediction(target,seconds,out=this.sample){
  if(target.path&&target.movement?.speed>0){
   if(seconds>=exitSeconds(target))return false;
   target.path.sample(target.distance+target.movement.speed*seconds,out);const x=out[0],z=out[1];out[0]=x;out[1]=z;out[2]=x+((target.aimX??target.x)-target.x);out[3]=target.aimY;out[4]=z+((target.aimZ??target.z)-target.z);
  }else{out[0]=target.x;out[1]=target.z;out[2]=target.aimX??target.x;out[3]=target.aimY;out[4]=target.aimZ??target.z;}
  return Number.isFinite(out[3]);
 }
 travelSeconds(distance){
  const a=T.acceleration,b=T.braking,v=T.speed,full=v*v/(2*a)+v*v/(2*b);
  if(distance<=full){const peak=Math.sqrt(2*Math.max(0,distance)/(1/a+1/b));return peak/a+peak/b;}
  return v/a+v/b+(distance-full)/v;
 }
 targetHullClear(target,x,y,z,rx,rz,previousX=rx,previousZ=rz){
  const radius=target.impact?.radius??12,padding=target.impact?.verticalPadding??0,low=(target.y??target.aimY-8)-padding,high=low+(target.impact?.height??16)+2*padding,r=T.hullRadius;
  return y+r<=low||y-r>=high||x+r<=Math.min(rx,previousX)-radius||x-r>=Math.max(rx,previousX)+radius||z+r<=Math.min(rz,previousZ)-radius||z-r>=Math.max(rz,previousZ)+radius;
 }
 stationReserved(state,x,y,z){
  const p=this.sample;
  for(const other of this.states){
   if(other===state)continue;
   const home=other.phase==='launch'||other.phase==='return'||other.phase==='align-pad'||other.phase==='descend',node=home?other.homeNode:other.stationCommitted?other.goalNode:-1;if(node<0)continue;
   this.navigation.position(node,p);if(Math.abs(x-p[0])<T.hullRadius*2+2&&Math.abs(y-p[1])<T.hullRadius*2+2&&Math.abs(z-p[2])<T.hullRadius*2+2)return true;
  }return false;
 }
 forecastWindow(state,target,node,arrival,out=state.window){
  const p=this.point,q=this.sample;this.navigation.position(node,p);const x=p[0],y=p[1],z=p[2],start=Math.max(arrival,state.cycle.readyAt-state.cycle.time,0),left=BASE.flightSeconds-state.flightElapsed;
  out.fill(0);if(start>=left||!this.fleetClear(state,x,y,z,x,y,z)||this.stationReserved(state,x,y,z)||!this.obstacles.pointClear(x,y,z,T.hullRadius,1))return 0;
  let rounds=0,lastX=0,lastZ=0;
  for(let i=0;i<BASE.weapon.shotsPerBurst;i++){
   const at=start+i*BASE.weapon.shotIntervalSeconds;if(!this.prediction(target,at,q))break;
   const horizontal=Math.hypot(q[0]-x,q[1]-z),pitch=Math.atan2(q[3]-(y-4),Math.hypot(q[2]-x,q[4]-z)+3);
   if(horizontal>state.maxRange||horizontal<24||!state.pitch.reachable(pitch)||!this.targetHullClear(target,x,y,z,q[0],q[1],i?lastX:q[0],i?lastZ:q[1])||!this.stationSight(x,y,z,q[2],q[3],q[4],pitch))break;
   lastX=q[0];lastZ=q[1];rounds++;
  }
  out[0]=arrival;out[1]=start;out[2]=start+rounds*BASE.weapon.shotIntervalSeconds;out[3]=rounds;out[4]=rounds*4-start*.6-Math.max(0,y-(state.ground+9+T.lift))*.025;
  return rounds;
 }
 // Called only on this defence's shared round-robin thinking turn.
 prepare(state){
  if(state.wantEvade||state.evading){
   state.planReady=false;
   if(state.evading&&!state.motion.done&&!state.wantEvade)return;
   if(state.wantEvade&&state.speed>.1)return;
   if(state.wantEvade){this.planEvasion(state);return;}
   this.finishEvasion(state);
  }
  if(state.phase==='return'){
   if(state.returnPlanning)return;
   if(state.blocked&&this.time>=state.nextPlanAt){
    state.nextPlanAt=this.time+T.replanSeconds;state.replans++;
    if(this.navigation.search(state,this)){
     if(state.speed<.1&&this.route(state,state.homeNode))state.goalNode=state.homeNode;
     else{
      // A head-on pair can temporarily occupy each other's home corridor.
      // Stable ID gives one aircraft the upper passing lane while the other
      // holds; both climbing together would merely repeat the obstruction.
      let yields=true;for(const other of this.states)if(other!==state&&other.phase==='return'&&other.id<state.id)yields=false;
      if(yields){let goal=-1,best=Infinity;const p=this.point,nav=this.navigation;
       for(let node=0;node<nav.count;node++)if(Number.isFinite(state.nav.distance[node])){nav.position(node,p);if(p[1]<state.y+36)continue;const cost=state.nav.distance[node]+Math.hypot(p[0]-state.x,p[2]-state.z)*4;if(cost<best){best=cost;goal=node;}}
       if(state.speed<.1&&goal>=0&&this.route(state,goal))state.goalNode=goal;
      }
     }
    }
   }
   return;
  }
  if(state.cycle.remaining)return;
  if(!active(state)||state.expired){state.planReady=false;return;}
  const current=state.plannedTarget,valid=state.stationCommitted&&living(current)&&state.plannedLap===(current?.lap??0),travelling=!state.motion.done&&!state.retargetPending||state.speed>.1;
  let urgent=false;
  if(valid){const score=this.planner?.score(current,state)??1;for(const other of this.targets)if(other!==current&&living(other)&&(this.planner?.score(other,state)??1)>=score*T.urgentSwitchRatio){urgent=true;break;}}
  if(valid&&!state.blocked&&!urgent){
   const index=this.targets.indexOf(current),minimum=Math.min(T.minimumUsefulPulses,Math.ceil((this.planner?.residualHealth(current)??current.health?.current??100)/state.strength));
   const pitch=Math.atan2(current.aimY-(state.y-4),Math.hypot((current.aimX??current.x)-state.x,(current.aimZ??current.z)-state.z)+3),lostScope=!travelling&&(state.stationHasFired||this.time>=(state.stationFireAt??0))&&(Math.hypot(current.x-state.x,current.z-state.z)>state.maxRange||!state.pitch.reachable(pitch));
   if(lostScope){state.stationInvalidated=true;state.stationCommitted=false;}
   const usable=!lostScope&&(travelling?this.time<(state.stationWindowEnd??0):this.forecastWindow(state,current,state.goalNode,0)>=Math.max(1,minimum));
   if(usable){state.candidateNodes.fill(-1);state.candidateNodes[index]=state.goalNode;state.candidateLap[index]=current.lap??0;state.planReady=true;state.committedThinks++;return;}
   if(travelling)state.retargetPending=true;
  }
  if(!valid)state.stationCommitted=false;
  // A changed/dead target never splices a new route into moving momentum.
  // Finish braking, then search from the actual settled position.
  if(travelling){state.planReady=false;state.retargetPending=true;return;}
  if(this.time<state.nextPlanAt&&state.planReady)return;
  state.nextPlanAt=this.time+T.replanSeconds;state.replans++;state.planVersion++;state.planReady=this.navigation.search(state,this);state.candidateNodes.fill(-1);
  if(!state.planReady)return;
  for(let i=0;i<this.targets.length;i++)if(living(this.targets[i])){
   state.candidateNodes[i]=this.station(state,this.targets[i],i);state.candidateLap[i]=this.targets[i].lap??0;
  }
  const preferred=this.targets.indexOf(current);
  if(preferred>=0&&living(current)&&state.plannedLap===(current.lap??0)&&!urgent&&state.candidateNodes[preferred]>=0)for(let i=0;i<this.targets.length;i++)if(i!==preferred)state.candidateNodes[i]=-1;
  state.motion.clear();
 }
 station(state,target,index=this.targets.indexOf(target)){
  const nav=this.navigation,p=this.point,q=this.sample,left=BASE.flightSeconds-state.flightElapsed;let count=0;
  state.shortScores.fill(-Infinity);state.shortNodes.fill(-1);
  for(let node=0;node<nav.count;node++){
   if(state.stationInvalidated&&state.plannedTarget===target&&node===state.goalNode)continue;
   const distance=state.nav.distance[node];if(!Number.isFinite(distance))continue;
   nav.position(node,p);const x=p[0],y=p[1],z=p[2],travel=this.travelSeconds(distance);let arrival=travel+.35;
   if(arrival>=left||!this.prediction(target,arrival,q))continue;
   const approach=distance>.1?Math.atan2(-(x-state.x),-(z-state.z)):state.aim.yaw+Math.atan2(state.rig.root[8],state.rig.root[0]),facing=Math.atan2(-(q[2]-x),-(q[4]-z));
   arrival=travel+.2+Math.abs(yawError(facing,approach))/T.bodyTurn.maxSpeed;
   const start=Math.max(arrival,state.cycle.readyAt-state.cycle.time,0);if(start>=left)continue;
   let samples=0,horizontal=0;
   for(let sample=0;sample<3;sample++)if(this.prediction(target,start+sample*(BASE.weapon.shotsPerBurst-1)*BASE.weapon.shotIntervalSeconds/2,q)){
    const range=Math.hypot(q[0]-x,q[1]-z),pitch=Math.atan2(q[3]-(y-4),Math.hypot(q[2]-x,q[4]-z)+3);if(!sample)horizontal=range;
    if(range>=24&&range<=state.maxRange&&state.pitch.reachable(pitch)&&this.targetHullClear(target,x,y,z,q[0],q[1]))samples++;
   }
   if(!samples||this.stationReserved(state,x,y,z))continue;
   const score=samples*5-start*.6-Math.abs(horizontal-50)*.02-Math.max(0,y-(state.ground+9+T.lift))*.025;
   let slot=Math.min(count,T.stationShortlist-1);if(count>=T.stationShortlist&&score<=state.shortScores[slot])continue;
   while(slot>0&&score>state.shortScores[slot-1]){state.shortScores[slot]=state.shortScores[slot-1];state.shortNodes[slot]=state.shortNodes[slot-1];state.shortTimes[slot]=state.shortTimes[slot-1];slot--;}
   state.shortScores[slot]=score;state.shortNodes[slot]=node;state.shortTimes[slot]=arrival;count=Math.min(T.stationShortlist,count+1);
  }
  let best=-1,score=-Infinity;const offset=index*5,minimum=Math.min(T.minimumUsefulPulses,Math.ceil((this.planner?.residualHealth(target)??target.health?.current??100)/state.strength));
  for(let i=0;i<count;i++){
   const node=state.shortNodes[i];
   // Only the small coarse shortlist gets full static/dynamic route rounding
   // and a timed acceleration/braking pass. Nothing ranks on every frame.
   if(!nav.route(state,node)||!nav.smooth(state,this))continue;
   const duration=state.motion.duration(left),arrival=duration+Math.max(.35,state.shortTimes[i]-this.travelSeconds(state.nav.distance[node]));
   const rounds=this.forecastWindow(state,target,node,arrival);
   if(rounds<Math.max(1,minimum)&&exitSeconds(target)>3)continue;
   if(rounds&&state.window[4]>score){best=node;score=state.window[4];for(let field=0;field<5;field++)state.candidateWindows[offset+field]=state.window[field];}
  }
  return best;
 }
 stationSight(x,y,z,tx,ty,tz,pitch){
  const yaw=Math.atan2(-(tx-x),-(tz-z)),c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  for(let i=0;i<M.muzzles.length;i++){
   const muzzle=M.muzzles[i],dx=muzzle[0]-12,dy=muzzle[1]-5,dz=muzzle[2]-9;
   const qz=-3+sp*dy+cp*dz,wx=x+c*dx+s*qz,wy=y-4+cp*dy-sp*dz,wz=z-s*dx+c*qz;
   if(!this.world.visibility.clear(wx,wy,wz,tx,ty,tz))return false;
  }return true;
 }
 eligible(state,target){
  if(state.wantEvade||state.evading)return false;
  if(!active(state)||!living(target)||!Number.isFinite(target.aimY))return false;
  if(state.cycle.remaining&&state.target===target)return this.liveTarget(state,target);
  if(state.expired)return false;
  if(this.planner?.residualHealth(target)===0)return false;
  const index=this.targets.indexOf(target);return index>=0&&state.planReady&&state.candidateNodes[index]>=0&&state.candidateLap[index]===(target.lap??0);
 }
 selected(state,target){
  if(!active(state)||state.cycle.remaining||state.wantEvade||state.evading)return;
  if(!target){state.stationCommitted=false;if(state.speed>.1)state.retargetPending=true;return;}
  const index=this.targets.indexOf(target),goal=state.candidateNodes[index];
  if(goal<0)return;
  if(state.speed>.1||!state.motion.done&&!state.blocked&&!state.retargetPending){if(state.plannedTarget!==target)state.retargetPending=true;return;}
  if(!state.stationCommitted||state.goalNode!==goal||state.plannedTarget!==target||state.plannedLap!==(target.lap??0)||state.blocked){
   if(this.navigation.search(state,this)&&this.route(state,goal)){
    if(state.goalNode!==goal)state.stationChanges++;state.goalNode=goal;state.plannedTarget=target;state.plannedLap=target.lap??0;state.blocked=false;state.routeVersion=state.planVersion;state.retargetPending=state.stationInvalidated=state.stationHasFired=false;state.stationCommitted=true;
    const offset=index*5;state.stationArrivalAt=this.time+state.candidateWindows[offset];state.stationFireAt=this.time+state.candidateWindows[offset+1];state.stationWindowEnd=this.time+state.candidateWindows[offset+2];state.stationPulses=state.candidateWindows[offset+3];state.stationScore=state.candidateWindows[offset+4];
   }
  }
 }
 route(state,goal){if(!this.navigation.route(state,goal)||!this.navigation.smooth(state,this))return false;state.routeChanges++;return true;}
 priority(state,target,score){
  const hp=this.planner.residualHealth(target);if(!(hp>0&&hp<=T.finishHealth))return score;
  for(const other of this.planner.states){
   if(other===state||!(other.strength>0)||other.mobile&&!active(other))continue;
   if((target.x-other.x)**2+(target.z-other.z)**2<=other.maxRange**2)return score;
  }
  return score*(1+(T.finishPriority-1)*(1-hp/T.finishHealth));
 }
 commitment(state,target){
  if(state.target!==target||state.targetLap!==(target.lap??0)||!active(state)||!state.cycle.remaining||!this.canFire(state,target))return 0;
  // Pursuit/loaded rounds are never promises. Unknown/off-centre/banking poses
  // cannot certify later torso rays. Stable route-centred ground actors get
  // only the next contiguous set of future, in-range and clear firing poses.
  if(!target.path||target.routeForecastEligible!==true||target.impact?.active||!Number.isFinite(target.distance)||!(target.movement?.speed>0))return 0;
  const first=Math.max(0,state.cycle.nextShotAt-state.cycle.time),exit=exitSeconds(target),p=this.sample;let rounds=0;
  for(let i=0;i<state.cycle.remaining;i++){
   const at=first+i*BASE.weapon.shotIntervalSeconds;if(at>=exit)break;
   target.path.sample(target.distance+target.movement.speed*at,p);
   const horizontal=Math.hypot(p[0]-state.x,p[1]-state.z),pitch=Math.atan2(target.aimY-(state.y-4),horizontal+3);
   if(horizontal>state.maxRange||!state.pitch.reachable(pitch)||!this.stationSight(state.x,state.y,state.z,p[0],target.aimY,p[1],pitch))break;
   rounds++;
  }
  return rounds*state.strength;
 }
 fleetClear(state,ax,ay,az,bx,by,bz,neutral=false,lookahead=0){
  const nav=this.navigation,b=nav.sweptBounds(ax,ay,az,bx,by,bz);
  if(neutral){b[0]=Math.min(ax,bx)-11;b[1]=Math.min(ay,by)-5;b[2]=Math.min(az,bz)-11;b[3]=Math.max(ax,bx)+11;b[4]=Math.max(ay,by)+5;b[5]=Math.max(az,bz)+11;}
  return this.fleetBoxClear(state,b,lookahead);
 }
 fleetBoxClear(state,b,lookahead=0){
  if(this.obstacles&&!this.obstacles.clearBox(b,lookahead))return false;
  const other=this.fleetBounds;
  for(let i=0;i<this.states.length;i++){
   const s=this.states[i];if(s===state)continue;
   const r=s.phase==='pad-hover'||s.phase==='recharge'||s.phase==='launch'||s.phase==='descend'?11:T.hullRadius;
   const x=s.x+s.velocityX*lookahead,y=s.y+s.velocityY*lookahead,z=s.z+s.velocityZ*lookahead;
   other[0]=Math.min(s.x,x)-r;other[1]=Math.min(s.y,y)-(r===11?5:r);other[2]=Math.min(s.z,z)-r;other[3]=Math.max(s.x,x)+r;other[4]=Math.max(s.y,y)+(r===11?5:r);other[5]=Math.max(s.z,z)+r;
   if(droneBoxesOverlap(b,other))return false;
  }return true;
 }
 startLaunch(state){state.phase='launch';state.flightElapsed=0;state.expired=false;state.rechargeRemaining=0;state.launches++;state.goalNode=-1;state.planReady=state.stationCommitted=false;state.nextPlanAt=0;state.returnStartedAt=null;state.shotsAtExpiry=null;}
 beginReturn(state){
  if(!active(state)&&state.phase!=='launch')return;
  state.phase='return';state.returnStartedAt=this.time;state.returns++;state.target=state.reservation=null;state.lineOfSight=false;state.cycle.cancelBurst();state.planReady=state.stationCommitted=false;state.plannedTarget=null;state.goalNode=state.homeNode;state.returnPlanning=true;
  if(state.speed<.1)this.planReturn(state);
 }
 planReturn(state){
  state.returnPlanning=false;
  if(this.navigation.search(state,this)&&this.route(state,state.homeNode)){state.goalNode=state.homeNode;state.blocked=false;return true;}
  // A live actor may temporarily occupy a certified static corridor. Keep the
  // settled aircraft airborne and let its normal shared thinking turn retry.
  state.motion.clear();state.blocked=true;state.nextPlanAt=this.time+T.replanSeconds;return false;
 }
 liveTarget(state,target){return living(target)&&this.targets.includes(target)&&state.targetLap===(target.lap??0)&&state.targeting.solve(state.x,state.z,target);}
 sight(state,target){
  const m=state.gunMatrix,p=this.point;
  for(let i=0;i<M.muzzles.length;i++){const socket=M.muzzles[i];transform(m,socket[0],socket[1],socket[2],p);if(!this.world.visibility.clear(p[0],p[1],p[2],target.aimX??target.x,target.aimY,target.aimZ??target.z))return false;}
  return true;
 }
 canFire(state,target){return !state.wantEvade&&!state.evading&&Math.hypot(state.velocityX,state.velocityY,state.velocityZ)<.1&&this.liveTarget(state,target)&&state.lineOfSight&&Math.abs(state.aimError??Infinity)<=T.aimTolerance&&Math.abs(state.pitchError??Infinity)<=T.aimTolerance&&state.pitch.reachable(state.targetPitch);}
 planEvasion(state){
  const nav=this.navigation,neutral=neutralPhase(state),top=state.ground+M.bodyPivot[1]+T.transitLayers[T.transitLayers.length-1];let x=0,y=0,z=0,found=false;
  // Prefer a vertical departure from the incoming flight corridor. Six axes
  // and four lengths are a bounded local yield, not a second crowd planner.
  for(let direction=0;direction<6&&!found;direction++)for(let distance=24;distance<=96;distance+=24){
   if(neutral&&direction!==0)continue;
   x=state.x+(direction===1?distance:direction===2?-distance:0);y=state.y+(direction===0?distance:direction===5?-distance:0);z=state.z+(direction===3?distance:direction===4?-distance:0);
   if(y>top||y<state.ground+M.bodyPivot[1]+T.lift)continue;
   if(!(neutral?nav.neutralVertical(state,y):nav.clearSegment(state.x,state.y,state.z,x,y,z))||!this.fleetClear(state,state.x,state.y,state.z,x,y,z,neutral)||!nav.clearSegment(x,y,z,x,y,z)||!this.fleetClear(state,x,y,z,x,y,z,false,1))continue;
   state.motion.clear();state.motion.add(state.x,state.y,state.z,0,0,0,x,y,z,false,0);if(!this.evasionClear(state,neutral))continue;
   found=true;break;
  }
  if(!found){state.blocked=true;state.holds++;return false;}
  if(!state.evading){state.evadeResume=state.phase;if(state.phase==='recharge')state.resumeRecharge=state.rechargeRemaining;else if(state.phase==='pad-hover')state.resumeRecharge=0;}
  state.motion.clear();state.motion.add(state.x,state.y,state.z,0,0,0,x,y,z,false,0);state.evading=true;state.evadeNeutral=neutral;state.wantEvade=false;state.retargetPending=false;state.stationCommitted=state.planReady=false;state.plannedTarget=null;state.target=state.reservation=null;state.evasions++;state.routeChanges++;state.blocked=false;return true;
 }
 evasionClear(state,neutral=false){
  const m=state.motion,distance=m.distance,speed=m.speed,index=m.segmentIndex,p=m.point,x=p[0],y=p[1],z=p[2],dx=p[3],dy=p[4],dz=p[5];let ax=state.x,ay=state.y,az=state.z,clear=true;
  // Time-matched envelopes distinguish escaping an approaching corridor from
  // entering the actor's later path. The union of the entire future corridor
  // would reject the threatened origin of every otherwise safe departure.
  for(let step=0;step<10&&clear;step++){
   for(let sub=0;sub<4;sub++)m.advance(.025);
   clear=this.obstacles.clearTimedSegment(ax,ay,az,p[0],p[1],p[2],neutral?11:T.hullRadius+.5,step*.1,(step+1)*.1,neutral?5:undefined);
   ax=p[0];ay=p[1];az=p[2];
  }
  m.distance=distance;m.speed=speed;m.segmentIndex=index;p[0]=x;p[1]=y;p[2]=z;p[3]=dx;p[4]=dy;p[5]=dz;return clear;
 }
 finishEvasion(state){
  const resume=state.evadeResume;state.evading=state.evadeNeutral=state.wantEvade=state.retargetPending=false;state.evadeResume=null;state.motion.clear();state.goalNode=-1;state.nextPlanAt=0;state.planReady=state.stationCommitted=false;
  if(resume==='return'||resume==='align-pad'||resume==='descend'||resume==='pad-hover'||resume==='recharge'){
   state.phase='return';state.goalNode=state.homeNode;state.returnPlanning=true;this.planReturn(state);
  }else state.phase='intercept';
 }
 move(state,dt){
  const nav=this.navigation,p=this.point,oldVX=state.velocityX,oldVY=state.velocityY,oldVZ=state.velocityZ;
  state.blocked=false;
  const steps=Math.max(1,Math.min(64,Math.ceil(dt/.02))),h=dt/steps;
  if(!state.evading&&(state.phase==='launch'||state.phase==='descend')){
   const destination=state.phase==='launch'?(nav.position(state.homeNode,p),p[1]):state.ground+9;
   for(let i=0;i<steps;i++){
    const remaining=Math.abs(destination-state.y),direction=Math.sign(destination-state.y),old=state.verticalSpeed,limit=state.wantEvade?0:Math.min(T.verticalSpeed,Math.sqrt(2*T.braking*Math.max(0,remaining-old*h))),rate=old>limit?T.braking:T.acceleration;
    state.verticalSpeed=old<limit?Math.min(limit,old+rate*h):Math.max(limit,old-rate*h);
    const step=Math.min(remaining,(old+state.verticalSpeed)*.5*h),y=state.y+direction*step;
    if(this.fleetClear(state,state.x,state.y,state.z,state.x,y,state.z,true))state.y=y;else{state.blocked=true;state.holds++;state.verticalSpeed=0;break;}
    if(remaining<.001||step>=remaining){state.y=destination;state.verticalSpeed=0;break;}
   }
   state.velocityX=state.velocityZ=0;state.velocityY=Math.sign(destination-state.y)*state.verticalSpeed;state.speed=state.verticalSpeed;
   if(Math.abs(state.y-destination)<1e-7&&state.verticalSpeed===0){
    if(state.phase==='launch'){state.phase='intercept';state.nextPlanAt=0;}
    else{state.phase=state.resumeRecharge===0?'pad-hover':'recharge';state.rechargeRemaining=state.resumeRecharge??BASE.rechargeSeconds;state.resumeRecharge=null;state.nav.pathLength=state.nav.pathIndex=0;}
   }
  }else if(active(state)||state.phase==='return'||state.evading){
   const motion=state.motion;
   if(state.evading&&!state.wantEvade&&!this.evasionClear(state,state.evadeNeutral))state.wantEvade=true;
   for(let i=0;i<steps;i++){
    let stop=state.evading?state.wantEvade:state.wantEvade||state.returnPlanning||state.retargetPending||Boolean(state.cycle.remaining)||!state.target&&active(state);
    if(!state.evading&&motion.segmentCount&&!motion.done){const ahead=motion.sample(Math.min(motion.length,motion.distance+motion.speed**2/T.braking+motion.speed*.2+T.step*.5),motion.samplePoint);if(!this.fleetClear(state,state.x,state.y,state.z,ahead[0],ahead[1],ahead[2],false,motion.speed/T.braking+.2)){stop=true;state.blocked=true;}}
    const oldDistance=motion.distance,oldSpeed=motion.speed,q=motion.advance(h,stop);
    if(motion.segmentCount){
     const neutral=state.evading&&state.evadeNeutral;
     if(!(neutral?nav.neutralVertical(state,q[1]):nav.clearSegment(state.x,state.y,state.z,q[0],q[1],q[2]))||!this.fleetClear(state,state.x,state.y,state.z,q[0],q[1],q[2],neutral)){motion.distance=oldDistance;motion.speed=0;state.blocked=true;state.holds++;if(oldSpeed>.1)state.emergencyStops++;if(state.evading)state.wantEvade=true;break;}
     state.x=q[0];state.y=q[1];state.z=q[2];state.velocityX=q[3]*motion.speed;state.velocityY=q[4]*motion.speed;state.velocityZ=q[5]*motion.speed;
    }
    if(!state.evading&&state.returnPlanning&&motion.speed<.1){state.velocityX=state.velocityY=state.velocityZ=0;this.planReturn(state);}
   }
   state.speed=motion.speed;
   if(state.blocked&&motion.speed===0)state.velocityX=state.velocityY=state.velocityZ=0;
   if(motion.done){state.nav.pathIndex=state.nav.pathLength;if(!state.evading&&state.phase==='return'&&!state.returnPlanning&&!state.blocked){nav.position(state.homeNode,p);if(state.goalNode===state.homeNode&&Math.hypot(state.x-p[0],state.y-p[1],state.z-p[2])<1e-5)state.phase='align-pad';else state.blocked=true;}}
  }else{state.velocityX=state.velocityY=state.velocityZ=state.speed=0;}
  if(dt>0){state.accelerationX=(state.velocityX-oldVX)/dt;state.accelerationY=(state.velocityY-oldVY)/dt;state.accelerationZ=(state.velocityZ-oldVZ)/dt;}
  else state.accelerationX=state.accelerationY=state.accelerationZ=0;
 }
 writePose(state,dt,neutral=false){
  const rig=state.rig,root=rig.root,p=this.point;
  let desired=0;
  if(!neutral&&(state.phase==='return'||active(state))&&Math.hypot(state.velocityX,state.velocityZ)>1)desired=Math.atan2(-state.velocityX,-state.velocityZ)-Math.atan2(root[8],root[0]);
  else if(!neutral&&active(state)&&state.target){desired=Math.atan2(-(state.target.aimX??state.target.x)+state.x,-(state.target.aimZ??state.target.z)+state.z)-Math.atan2(root[8],root[0]);}
  const previousYawSpeed=state.aim.velocity;
  if(neutral||state.phase==='launch'||state.phase==='descend'||state.phase==='pad-hover'||state.phase==='recharge')state.aim.yaw=state.aim.velocity=0;
  else state.aim.track(desired,dt);
  state.bodyPitch=state.bodyRoll=0;state.yawAcceleration=dt?(state.aim.velocity-previousYawSpeed)/dt:0;
  const ry=state.aim.yaw,sy=Math.sin(ry),cy=Math.cos(ry);
  // PoseRig applies translation in the part's rotated axes. Invert both the
  // authored quarter-turn root and current aircraft rotation before assigning
  // displacement, so pad rotations never rotate the desired world trajectory.
  const wx=state.x-state.homeX,wy=state.y-(state.ground+9),wz=state.z-state.homeZ,lx=root[0]*wx+root[2]*wz,lz=root[8]*wx+root[10]*wz;
  rig.setRotation(M.body,0,ry,0);rig.setTranslation(M.body,cy*lx-sy*lz,wy,sy*lx+cy*lz);
  const worldYaw=ry+Math.atan2(root[8],root[0]),cw=Math.cos(worldYaw),sw=Math.sin(worldYaw),ax=cw*state.accelerationX-sw*state.accelerationZ,az=sw*state.accelerationX+cw*state.accelerationZ,cap=M.fanTiltMax??10*Math.PI/180;
  const powered=!neutral&&(active(state)||state.phase==='return'||state.phase==='align-pad')&&state.y-state.ground-9>=(M.minimumFanTiltLift??5),response=1-Math.exp(-T.fanResponse*dt),collective=cap*(1-T.fanYawShare)/T.acceleration,yawTorque=Math.max(-1,Math.min(1,state.yawAcceleration/T.bodyTurn.acceleration))*cap*T.fanYawShare;
  state.fanPitch=state.fanRoll=0;
  for(let i=0;i<DRONE_ROTORS.length;i++){
   const rotor=DRONE_ROTORS[i],fan=state.fans[i],rx=rotor.pivot[0]-12,rz=rotor.pivot[2]-12,radius=Math.hypot(rx,rz);let pitch=powered?az*collective-rx/radius*yawTorque:0,roll=powered?-ax*collective-rz/radius*yawTorque:0;
   const length=Math.hypot(pitch,roll);if(length>cap){pitch*=cap/length;roll*=cap/length;}fan.targetPitch=pitch;fan.targetRoll=roll;
   if(neutral||!powered&&state.phase!=='align-pad'){fan.pitch=fan.roll=0;}else{fan.pitch+=(pitch-fan.pitch)*response;fan.roll+=(roll-fan.roll)*response;}
   if(rotor.gimbal&&rig.byId.has(rotor.gimbal))rig.setRotation(rotor.gimbal,fan.pitch,0,fan.roll);
   rig.setRotation(rotor.id,0,state.rotorPhase*rotor.spin,0);state.fanPitch+=fan.pitch*.25;state.fanRoll+=fan.roll*.25;
  }
  // First update makes the level aircraft frame current. Fine aim then uses
  // its actual inverse yaw orientation before the final gun update.
  this.updatedParts+=rig.update();
  let fine=0,pitch=0;const target=state.target;
  if(!neutral&&active(state)&&target){
   const m=state.bodyMatrix;transform(m,12,5,9,p);const dx=(target.aimX??target.x)-p[0],dy=target.aimY-p[1],dz=(target.aimZ??target.z)-p[2];
   const localX=m[0]*dx+m[1]*dy+m[2]*dz,localY=m[4]*dx+m[5]*dy+m[6]*dz,localZ=m[8]*dx+m[9]*dy+m[10]*dz;
   fine=Math.atan2(-localX,-localZ);pitch=Math.atan2(localY,Math.hypot(localX,localZ));state.targetPitch=pitch;
   state.gunYaw.track(Math.max(M.gunYawMin,Math.min(M.gunYawMax,fine)),dt);state.pitch.track(Math.max(M.gunPitchMin,Math.min(M.gunPitchMax,pitch)),dt);
   state.aimError=yawError(fine,state.gunYaw.angle);state.pitchError=pitch-state.pitch.angle;
  }else{state.gunYaw.track(0,dt);state.pitch.track(0,dt);state.aimError=state.pitchError=state.targetPitch=null;}
  if(neutral||state.phase==='launch'||state.phase==='descend'||state.phase==='pad-hover'||state.phase==='recharge')state.gunYaw.yaw=state.gunYaw.velocity=state.pitch.yaw=state.pitch.velocity=0;
  rig.setRotation(M.gunYaw,0,state.gunYaw.angle,0);rig.setRotation(M.gunPitch,state.pitch.angle,0,0);this.updatedParts+=rig.update();
 }
 advance(dt){
  if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid drone delta.');if(this.disposed)return;
  this.time+=dt;this.active=this.turning=this.shots=this.updatedParts=0;
  for(const state of this.states){
   let motionDelta=dt;
   state.rotorPhase=(state.rotorPhase+T.rotorSpeed*dt)%TAU;
   if(!state.evading&&!state.wantEvade&&state.phase==='pad-hover'&&this.hasLivingTargets())this.startLaunch(state);
   else if(!state.evading&&!state.wantEvade&&state.phase==='recharge'){const remaining=state.rechargeRemaining;state.rechargeRemaining=Math.max(0,remaining-dt);if(!state.rechargeRemaining){state.phase='pad-hover';motionDelta=Math.max(0,dt-remaining);if(this.hasLivingTargets())this.startLaunch(state);}}
   if(active(state)||state.phase==='launch'){
    state.flightElapsed+=motionDelta;
    if(!state.expired&&state.flightElapsed>=BASE.flightSeconds){state.expired=true;state.shotsAtExpiry=state.cycle.shots;}
    if(state.expired&&!state.cycle.remaining&&state.phase!=='launch'&&!state.evading&&!state.wantEvade)this.beginReturn(state);
   }
   if(state.target&&(!living(state.target)||!this.targets.includes(state.target)||state.targetLap!==(state.target.lap??0))){state.cycle.cancelBurst();state.target=null;}
   this.move(state,motionDelta);this.writePose(state,dt);
   const target=state.target,valid=active(state)&&target&&this.liveTarget(state,target);
   state.targetDistance=valid?Math.hypot(target.x-state.x,target.z-state.z):null;state.lineOfSight=Boolean(valid&&this.sight(state,target));
   const canFire=Boolean(valid&&this.canFire(state,target)),shots=state.cycle.shots;
   state.cycle.advanceLive(dt,canFire);
   if(canFire&&!state.expired&&state.cycle.ready&&state.cycle.shots===shots){state.phase='attack';state.cycle.trigger();}
   else if(active(state)&&!state.cycle.remaining)state.phase='intercept';
   if(state.expired&&active(state)&&!state.cycle.remaining&&!state.evading&&!state.wantEvade)this.beginReturn(state);
   if(!state.evading&&!state.wantEvade&&state.phase==='align-pad'&&Math.abs(yawError(0,state.aim.yaw))<.001&&Math.abs(state.aim.velocity)<.001&&Math.abs(state.gunYaw.angle)<.001&&Math.abs(state.pitch.angle)<.001&&this.fansNeutral(state)&&this.fleetClear(state,state.homeX,state.y,state.homeZ,state.homeX,state.ground+9,state.homeZ,true,1)){state.phase='descend';state.x=state.homeX;state.z=state.homeZ;}
   if(active(state)||state.phase==='launch'||state.phase==='return')this.active++;
   if(state.aim.active||state.pitch.active||state.gunYaw.active)this.turning++;
   this.shots+=state.cycle.shots;
  }
 }
 hasLivingTargets(){for(let i=0;i<this.targets.length;i++)if(living(this.targets[i]))return true;return false;}
 fansNeutral(state){for(const fan of state.fans)if(Math.hypot(fan.pitch,fan.roll)>.001)return false;return true;}
 reset(){
  for(const state of this.states){
   const c=state.cycle;c.time=this.time;c.readyAt=this.time;c.nextShotAt=Infinity;c.remaining=c.shots=0;c.lastShotAt=-Infinity;
   state.motion.clear();state.speed=state.verticalSpeed=state.accelerationX=state.accelerationY=state.accelerationZ=state.stationChanges=state.routeChanges=state.emergencyStops=0;state.returnPlanning=state.retargetPending=false;
   state.stationCommitted=state.stationInvalidated=state.stationHasFired=state.evading=state.wantEvade=state.evadeNeutral=false;state.stationArrivalAt=state.stationFireAt=state.stationWindowEnd=state.evadeResume=state.resumeRecharge=null;state.stationPulses=state.stationScore=state.committedThinks=state.evasions=0;state.candidateWindows.fill(0);state.shortNodes.fill(-1);state.shortScores.fill(-Infinity);state.shortTimes.fill(0);state.window.fill(0);
   state.target=state.reservation=state.plannedTarget=null;state.phase='pad-hover';state.x=state.homeX;state.y=state.ground+9;state.z=state.homeZ;state.flightElapsed=state.rechargeRemaining=state.launches=state.returns=state.replans=state.holds=0;state.expired=state.blocked=state.planReady=false;state.goalNode=-1;state.planVersion=0;state.routeVersion=-1;state.nextPlanAt=0;state.nav.pathLength=state.nav.pathIndex=state.nav.visited=0;state.candidateNodes.fill(-1);state.lastShotAt=state.lastShotTargetId=state.lastShotDistance=state.lastShotVisible=state.lastShotAimError=state.lastShotPitchError=state.targetDistance=state.shotsAtExpiry=state.returnStartedAt=null;state.lastShotDamage=0;state.lineOfSight=false;state.velocityX=state.velocityY=state.velocityZ=0;this.writePose(state,0,true);
  }this.obstacles?.reset();this.shots=this.active=this.turning=0;
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  for(const s of this.states){s.target=s.reservation=s.plannedTarget=null;s.cycle.cancelBurst();s.motion.dispose();s.motion=null;s.fans.length=0;s.nav=s.rig=s.candidateNodes=s.candidateTimes=s.candidateLap=s.candidateWindows=s.shortNodes=s.shortScores=s.shortTimes=s.window=null;s.stationCommitted=s.evading=s.wantEvade=false;}
  this.obstacles?.dispose();this.obstacles=null;this.navigation?.dispose();this.navigation=null;this.states.length=0;this.world=this.targets=this.onHit=this.onShot=this.planner=null;this.point=this.sample=this.fleetBounds=null;this.shots=this.active=this.turning=this.updatedParts=0;
 }
}
