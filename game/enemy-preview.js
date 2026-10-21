import {PoseRig} from '../engine/rig.js';
import {PathMotion,shortestAngle} from '../engine/path-motion.js';
import {FlightPathMotion} from '../engine/flight-path-motion.js';
import {routePath,actorRouteId} from '../shared/routes.js';
import {DogGait,DOG_WALK} from '../engine/dog-gait.js';
import {ArticulatedGait,WALKER_WALK,SPIDER_WALK} from '../engine/articulated-gait.js';
import {EnemyExpansionGait,ENEMY_EXPANSION_MOVEMENT} from '../engine/enemy-expansion-gait.js';
import {Health} from '../engine/health.js';
import {ENEMY_STATS} from '../shared/enemy.js';
import {previewActorsForLevel} from '../shared/enemy-roster.js';
export {previewActorsForLevel,DOG_PREVIEW_ACTORS,WALKER_PREVIEW_ACTORS,SPIDER_PREVIEW_ACTORS} from '../shared/enemy-roster.js';
import {EnemyImpact,EnemyImpactClearance,enemyImpactHeight} from '../engine/enemy-impact.js';

const MOVEMENT=Object.freeze({dog:DOG_WALK,walker:WALKER_WALK,spider:SPIDER_WALK,...ENEMY_EXPANSION_MOVEMENT});
function pathTurn(path,distance,speed,out){
 if(path.turn)return path.turn(distance,speed,out);
 const i=Math.min(Math.floor(distance/24),path.heading.length-1),r=path.turnDistance;let corner=-1;
 if(r>0){if(i>0&&distance-path.distance[i]<r)corner=i;else if(i+1<path.heading.length&&path.distance[i+1]-distance<r)corner=i+1;}
 out[0]=out[1]=0;if(corner<0)return;const p=(distance-path.distance[corner]+r)/(2*r),angle=shortestAngle(path.heading[corner]-path.heading[corner-1]);
 out[0]=angle*6*p*(1-p)*speed/(2*r);out[1]=angle*6*(1-2*p)*(speed/(2*r))**2;
}

function updateAimVelocity(state,yawRate){
 const impact=state.impact,p=impact.pivot,aim=state.aimOrigin,c=Math.cos(state.yaw),s=Math.sin(state.yaw),roll=impact.roll+(state.gait.bodyRoll??0),rollRate=impact.rollRate+(state.gait.bodyRollRate??0);
 const qx=aim[0]-p[0],qy=aim[1]-p[1],qz=aim[2]-p[2],cp=Math.cos(impact.pitch),sp=Math.sin(impact.pitch),cr=Math.cos(roll),sr=Math.sin(roll),ry=cp*qy-sp*qz,rz=sp*qy+cp*qz,rx=cr*qx-sr*ry,by=sr*qx+cr*ry;
 const dx=-rollRate*by+impact.pitchRate*sr*rz,dy=rollRate*rx-impact.pitchRate*cr*rz,dz=impact.pitchRate*ry,lx=p[0]-12+rx,lz=p[2]-12+rz;
 state.velocityY=impact.bobRate;state.aimVelocityX=state.velocityX+c*dx+s*dz+yawRate*(-s*lx+c*lz);state.aimVelocityY=impact.bobRate+dy;state.aimVelocityZ=state.velocityZ-s*dx+c*dz+yawRate*(-c*lx-s*lz);
}

// Fixed runtime actors are separate from scenery and share all part geometry.
export class EnemyPreview {
 constructor(world,onPoseChange,onDeath=null,actors=previewActorsForLevel(world.level),{finite=false,stats=ENEMY_STATS,movement=MOVEMENT}={}){
  this.finite=finite;
  this.states=[];this.time=0;this.completedLoops=0;this.updatedParts=0;this.path=null;this.paths=new Map();this.onDeath=onDeath;this.alive=0;this.loopSeconds=0;this.world=world;this.impactClearance=null;
  if(!actors.length)return;
  if(world.actors.size<actors.length)throw new Error('Enemy preview requires its runtime actors.');
  const firstMovement=movement[actors[0].model];if(!firstMovement)throw new Error('Unknown preview enemy.');
  const firstRoute=actorRouteId(world.level,actors[0]);
  this.path=new (firstMovement.airborne?FlightPathMotion:PathMotion)(routePath(world.level,firstRoute),firstMovement.turnDistance);this.paths.set(firstRoute+':'+firstMovement.turnDistance+':'+Boolean(firstMovement.airborne),this.path);this.loopSeconds=this.path.length/firstMovement.speed;
  for(const actor of actors){
   const data=world.actors.get(actor.id),rule=movement[actor.model];
   const config=stats[actor.model];if(!data||data.model!==actor.model||data.variant!==actor.variant||!rule||!config||!Number.isFinite(rule.speed)||rule.speed<=0||!Number.isFinite(actor.distance)||actor.distance<0)throw new Error('Enemy preview actor is missing or incompatible.');
   const routeId=actorRouteId(world.level,actor),pathKey=routeId+':'+rule.turnDistance+':'+Boolean(rule.airborne);
   let path=this.paths.get(pathKey);if(!path){path=new (rule.airborne?FlightPathMotion:PathMotion)(routePath(world.level,routeId),rule.turnDistance);this.paths.set(pathKey,path);}
   const rig=new PoseRig(data,onPoseChange),expansion=Boolean(ENEMY_EXPANSION_MOVEMENT[actor.model]),gait=expansion?new EnemyExpansionGait(rig,path,world.level.pathHeight,actor.model,rule):actor.model==='dog'?new DogGait(rig,path,world.level.pathHeight,rule):new ArticulatedGait(rig,path,world.level.pathHeight,actor.model,rule),airborne=rule.airborne??false,altitude=rule.altitude??0,aimBone=rig.byId.get(config.effectOrigin.part);
   if(!aimBone||config.effectOrigin.part!=='body')throw new Error('Enemy preview requires a body effect origin.');
   // Forecast probes currently support only stable, root-centred ground aim.
   // Actual targeting always uses the complete animated torso point below.
   const radius=expansion?gait.radius:12,verticalPadding=airborne?radius*Math.sin((gait.contract.maxBankDegrees??0)*Math.PI/180):0;
   this.states.push({id:actor.id,model:actor.model,health:new Health(config.maxHealth),threat:config.threat,seed:actor.distance,distance:0,lap:0,time:0,completedLoops:0,loopSeconds:path.length/rule.speed,routeId,path,airborne,altitude,routeForecastEligible:!airborne&&config.effectOrigin.point[0]===12&&config.effectOrigin.point[2]===12,x:0,y:0,z:0,aimX:0,aimY:0,aimZ:0,aimOrigin:config.effectOrigin.point,aimBone,velocityX:0,velocityY:0,velocityZ:0,aimVelocityX:0,aimVelocityY:0,aimVelocityZ:0,yaw:0,rig,gait,movement:rule,sample:new Float64Array(5),turn:new Float64Array(2),groundHeight:world.level.pathHeight,impact:new EnemyImpact(enemyImpactHeight(rig,rule.crouch),actor.model,rig.byId.get('body').part.pivot,{airborne,altitude,radius,verticalPadding})});
  }
  this.alive=this.states.length;this.pose();
 }
 takeHit(state,strength,vx,vy,vz){
  if(!this.states.includes(state))return 0;
  const applied=state.health.takeDamage(strength);
  if(applied&&!state.health.alive){this.alive--;state.impact.freeze();state.velocityX=state.velocityY=state.velocityZ=state.aimVelocityX=state.aimVelocityY=state.aimVelocityZ=0;this.onDeath?.(state.id,state);}
  else if(applied&&Number.isFinite(vx)&&Number.isFinite(vy)&&Number.isFinite(vz)){
   const world=this.world;
   if(!this.impactClearance&&Math.hypot(vx,vy,vz)>1e-6&&world?.visibility?.bounds&&world.level?.terrain&&world.rigs)this.impactClearance=new EnemyImpactClearance(world);
   const speed=state.movement.speed,path=state.path;
   if(state.impact.kick(vx,vy,vz,this.impactClearance,path,state.distance,speed,state.yaw)){
    state.velocityX=state.sample[3]*speed+state.impact.velocityX;state.velocityZ=state.sample[4]*speed+state.impact.velocityZ;
    pathTurn(path,state.distance,speed,state.turn);state.impact.orient(state.yaw,state.distance,state.turn[0]);updateAimVelocity(state,state.turn[0]);
   }
  }
  return applied;
 }
 reset(){
  this.time=0;this.completedLoops=0;this.alive=this.states.length;
  for(const state of this.states){state.health.reset();state.impact.clear(true);for(const foot of state.gait.feet)foot.contact=foot.nextContact=NaN;}
  // Distance-keyed gait contacts already support backwards samples. Restore
  // the existing rig/matrix slots before the renderer makes dead actors visible.
  this.pose();
 }
 pose(deltaSeconds=0,states=this.states){
  this.updatedParts=0;
  const elapsed=this.completedLoops*this.loopSeconds+this.time;
  for(let i=0;i<states.length;i++){
   const state=states[i];if(!state.health.alive||(this.finite&&state.phase&&state.phase!=='active'))continue;
   const rule=state.movement,path=state.path,impact=state.impact;
   if(!this.finite){state.time=state.loopSeconds===this.loopSeconds?this.time:elapsed%state.loopSeconds;state.completedLoops=state.loopSeconds===this.loopSeconds?this.completedLoops:Math.floor(elapsed/state.loopSeconds);}
   const travel=state.seed+state.time*rule.speed,distance=this.finite?Math.min(path.length,state.distance):travel%path.length,lap=this.finite?0:state.completedLoops+Math.floor(travel/path.length);
   if(lap!==state.lap)impact.clear();else impact.advance(deltaSeconds);state.lap=lap;
   path.sample(distance,state.sample);state.distance=distance;state.x=state.sample[0]+impact.offsetX;state.z=state.sample[1]+impact.offsetZ;state.yaw=state.sample[2];state.velocityX=state.sample[3]*rule.speed+impact.velocityX;state.velocityZ=state.sample[4]*rule.speed+impact.velocityZ;
   const root=state.rig.root,c=Math.cos(state.yaw),s=Math.sin(state.yaw);
   pathTurn(path,distance,rule.speed,state.turn);const yawRate=state.turn[0];impact.orient(state.yaw,distance,yawRate);
   const balance=impact.active&&impact.balanceAllowed?impact:null;
   state.y=state.groundHeight+state.altitude-rule.crouch+impact.bob;
   root[0]=c;root[2]=-s;root[8]=s;root[10]=c;root[12]=state.x-12*c-12*s;root[13]=state.y;root[14]=state.z+12*s-12*c;
   // Canonical relative contacts stay intact; the supported impact skid translates the root and feet together.
   state.rig.invalidateRoot();
   // The impact slides the grounded support as a unit; only torso lean/brace
   // changes relative leg reach. This permits a strong shove without stretching.
   state.gait.pose(distance,state.sample[0],state.sample[1],state.yaw,balance,this.finite?state.time:elapsed+state.seed/rule.speed,yawRate,state.turn[1]);
   state.rig.setRotation('body',impact.pitch,0,impact.roll+(state.gait.bodyRoll??0));
   if(impact.active)for(const foot of state.gait.feet){foot.position[0]+=impact.offsetX;foot.position[2]+=impact.offsetZ;}
   this.updatedParts+=state.rig.update();
   const body=state.aimBone.instance.matrix,aim=state.aimOrigin;
   state.aimX=body[0]*aim[0]+body[4]*aim[1]+body[8]*aim[2]+body[12];state.aimY=body[1]*aim[0]+body[5]*aim[1]+body[9]*aim[2]+body[13];state.aimZ=body[2]*aim[0]+body[6]*aim[1]+body[10]*aim[2]+body[14];
   updateAimVelocity(state,yawRate);
  }
 }
 advance(deltaSeconds){
  if(this.finite)throw new Error('Finite enemies require explicit lifecycle advancement.');
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid enemy preview delta.');
  if(!deltaSeconds||!this.alive){this.updatedParts=0;return;}
  const time=this.time+deltaSeconds;this.completedLoops+=Math.floor(time/this.loopSeconds);this.time=time%this.loopSeconds;this.pose(deltaSeconds);
 }
 dispose(){for(const state of this.states){state.gait.dispose();state.impact.clear(true);state.path=null;}this.impactClearance?.dispose();this.impactClearance=null;this.world=null;this.states.length=0;this.paths.clear();this.path=null;this.onDeath=null;this.alive=0;this.updatedParts=0;}
}
