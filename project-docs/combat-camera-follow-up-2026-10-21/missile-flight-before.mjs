// Frozen pre-fix flight module for the paired native encounter reproduction only.
import {GUIDED_MISSILE_MODEL} from '../../shared/missile-model.js';
import {MAX_MISSILES,MAX_MISSILE_LIGHTS,MISSILE_THRUST_LIGHT,MISSILE_ATTACK_THRUST,MAX_MISSILE_THRUST_INSTANCES,MISSILE_STEERING_JET_LENGTH,MISSILE_THRUST_FLOATS,MISSILE_PHASE as PHASE,MISSILE_FLIGHT as FLIGHT} from '../../shared/missile-flight.js';

// Whole-model enclosing sphere for conservative scenery collision, centred on
// the missile's centre of mass. Enemy damage instead requires nose contact with
// an actual exposed quad of the assigned animated actor.
const HALF=GUIDED_MISSILE_MODEL.height/2,RADIUS=Math.hypot(HALF,GUIDED_MISSILE_MODEL.radius);
const targetX=target=>target.aimX??target.x,targetZ=target=>target.aimZ??target.z;
const finiteSpeed=value=>Number.isFinite(value)?value:0;
const finiteAim=target=>Number.isFinite(targetX(target))&&Number.isFinite(target.aimY)&&Number.isFinite(targetZ(target));
function retainRecord(record){
 const target=record.target,m=record.root;
 record.aimX=targetX(target);record.aimY=target.aimY;record.aimZ=targetZ(target);
 // The authored root centre is independent of yaw's pivot compensation and
 // the torso's local tilt. Only this translation moves every articulated part.
 record.x=m[0]*12+m[8]*12+m[12];record.y=m[1]*12+m[9]*12+m[13];record.z=m[2]*12+m[10]*12+m[14];
}
function quadBounds(quads){
 const bounds=new Float64Array([Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);
 for(const q of quads)for(let axis=0;axis<3;axis++){bounds[axis]=Math.min(bounds[axis],q.origin[axis]);bounds[axis+3]=Math.max(bounds[axis+3],q.origin[axis]+(axis===(q.axis+1)%3?q.width:axis===(q.axis+2)%3?q.height:0));}
 return bounds;
}
function worldBounds(record){
 const bounds=record.bounds;bounds[0]=bounds[1]=bounds[2]=Infinity;bounds[3]=bounds[4]=bounds[5]=-Infinity;
 for(const part of record.parts){const b=part.bounds,m=part.matrix;
  for(let corner=0;corner<8;corner++){const x=b[corner&1?3:0],y=b[corner&2?4:1],z=b[corner&4?5:2];
   for(let axis=0;axis<3;axis++){const value=m[axis]*x+m[4+axis]*y+m[8+axis]*z+m[12+axis];bounds[axis]=Math.min(bounds[axis],value);bounds[axis+3]=Math.max(bounds[axis+3],value);}
  }
 }
 record.boundsDirty=false;
}
function intersectsBox(bounds,at,ox,oy,oz,dx,dy,dz,radius){
 let enter=0,exit=1;
 for(let axis=0;axis<3;axis++){
  const origin=axis===0?ox:axis===1?oy:oz,direction=axis===0?dx:axis===1?dy:dz,lo=bounds[at+axis]-radius,hi=bounds[at+axis+3]+radius;
  if(Math.abs(direction)<1e-12){if(origin<lo||origin>hi)return false;continue;}
  let near=(lo-origin)/direction,far=(hi-origin)/direction;if(near>far){const swap=near;near=far;far=swap;}
  enter=Math.max(enter,near);exit=Math.min(exit,far);if(enter>exit)return false;
 }
 return true;
}
function sceneryContact(pool,ox,oy,oz,tx,ty,tz,ignoreId,recordImpact=true){
 const tree=pool.visibility;if(!tree?.bounds)return Infinity;
 let node=0,first=Infinity;const b=tree.bounds,dx=tx-ox,dy=ty-oy,dz=tz-oz;
 while(node<tree.nodeCount){
  const at=node*6;
  if(!intersectsBox(b,at,ox,oy,oz,dx,dy,dz,RADIUS)){node=tree.escape[node];continue;}
  if(tree.escape[node]!==node+1){node++;continue;}
  let enter=0,exit=1,faceAxis=-1,sign=0;
  for(let axis=0;axis<3;axis++){
   const o=axis===0?ox:axis===1?oy:oz,d=axis===0?dx:axis===1?dy:dz;if(Math.abs(d)<1e-12)continue;
   let near=(b[at+axis]-RADIUS-o)/d,far=(b[at+axis+3]+RADIUS-o)/d,s=-1;if(near>far){const swap=near;near=far;far=swap;s=1;}
   if(near>=enter){enter=near;faceAxis=axis;sign=s;}exit=Math.min(exit,far);
  }
  // An already-overlapping/unknown exterior has no trustworthy impact face.
  // Never invent a flash at an off-map boundary or inside an expanded volume.
  if(faceAxis>=0&&enter<=exit&&enter<=1&&enter<first){
   const surface=b[at+faceAxis+(sign>0?3:0)];
   if(!((faceAxis===0&&(surface===0||surface===pool.width))||(faceAxis===2&&(surface===0||surface===pool.length)))){
    if(recordImpact){pool.staticX=Math.max(b[at],Math.min(b[at+3],ox+dx*enter));pool.staticY=Math.max(b[at+1],Math.min(b[at+4],oy+dy*enter));pool.staticZ=Math.max(b[at+2],Math.min(b[at+5],oz+dz*enter));
    if(faceAxis===0)pool.staticX=surface;else if(faceAxis===1)pool.staticY=surface;else pool.staticZ=surface;
    pool.staticNX=faceAxis===0?sign:0;pool.staticNY=faceAxis===1?sign:0;pool.staticNZ=faceAxis===2?sign:0;}first=enter;
   }
  }
  node++;
 }
 const contact=pool.defenceContact,fraction=tree.sweepDefences?.(ox,oy,oz,tx,ty,tz,RADIUS,ignoreId,recordImpact?contact:null)??Infinity;
 if(fraction<first){first=fraction;if(recordImpact){pool.staticX=contact[1];pool.staticY=contact[2];pool.staticZ=contact[3];pool.staticNX=contact[4];pool.staticNY=contact[5];pool.staticNZ=contact[6];}}
 return first;
}
function pointContact(slot,ox,oy,oz,tx,ty,tz){
 const x=ox-slot.aimX,y=oy-slot.aimY,z=oz-slot.aimZ,dx=tx-ox,dy=ty-oy,dz=tz-oz;
 const c=x*x+y*y+z*z-FLIGHT.lastPositionRadius**2;if(c<=0)return 0;
 const a=dx*dx+dy*dy+dz*dz,b=x*dx+y*dy+z*dz,disc=b*b-a*c;if(a<1e-20||disc<0)return Infinity;
 const fraction=(-b-Math.sqrt(disc))/a;return fraction>=0&&fraction<=1?fraction:Infinity;
}
function aimDirection(slot){
 const x=slot.aimX-slot.x-slot.dx*HALF,y=slot.aimY-slot.y-slot.dy*HALF,z=slot.aimZ-slot.z-slot.dz*HALF,length=Math.hypot(x,y,z);
 slot.aimDX=length?x/length:slot.dx;slot.aimDY=length?y/length:slot.dy;slot.aimDZ=length?z/length:slot.dz;
}
function aimPassed(slot,ox,oy,oz,tx,ty,tz){
 const near=pointContact(slot,ox,oy,oz,tx,ty,tz),before=(slot.aimX-ox)*slot.aimDX+(slot.aimY-oy)*slot.aimDY+(slot.aimZ-oz)*slot.aimDZ,after=(slot.aimX-tx)*slot.aimDX+(slot.aimY-ty)*slot.aimDY+(slot.aimZ-tz)*slot.aimDZ;
 return after<=0?Math.min(near,before<=0?0:before/(before-after)):near;
}
function interceptTime(x,y,z,vx,vy,vz,horizon){
 const speed=FLIGHT.cruiseSpeed,a=vx*vx+vy*vy+vz*vz-speed*speed,b=2*(x*vx+y*vy+z*vz),c=x*x+y*y+z*z;
 let time=Infinity;
 if(Math.abs(a)<1e-8){if(b<0)time=-c/b;}
 else{
  const discriminant=b*b-4*a*c;
  if(discriminant>=0){const root=Math.sqrt(discriminant),near=(-b-root)/(2*a),far=(-b+root)/(2*a);if(near>=0)time=near;if(far>=0)time=Math.min(time,far);}
 }
 // An unreachable prediction does not cancel an already authorised launch.
 // Commit to a bounded best estimate; actual swept contact still decides hits.
 return Math.min(horizon,Number.isFinite(time)?time:Math.sqrt(c)/speed);
}
function turn(slot,x,y,z,rate,dt){
 const length=Math.hypot(x,y,z);if(length<1e-8){slot.steeringAngle=0;return;}
 x/=length;y/=length;z/=length;const dot=Math.max(-1,Math.min(1,slot.dx*x+slot.dy*y+slot.dz*z)),angle=Math.acos(dot);
 // A gentler angular acceleration and a longer proportional tail give the
 // actual orientation a visible ease-in and ease-out, including forecasts.
 const oldRate=slot.angularSpeed??0,maxRate=rate*(slot.turnFactor??1),desired=Math.min(maxRate,Math.sqrt(2*16*angle),angle*6);
 slot.angularSpeed=Math.max(0,oldRate+Math.max(-16*dt,Math.min(16*dt,desired-oldRate)));
 const amount=Math.min(angle,slot.angularSpeed*dt);slot.steeringTorque=(slot.angularSpeed-oldRate)/Math.max(dt,1e-9);slot.steeringAngle=Math.max(0,angle-amount);
 // Two short attitude impulses: spin up, then brake. A latched impulse of
 // each polarity avoids re-firing a long pulse train during tiny corrections.
 const sign=Math.sign(slot.steeringTorque),bit=sign>0?1:2;
 if(angle>Math.PI/90&&Math.abs(slot.steeringTorque)>1&&!((slot.steeringKickMask??0)&bit)){
  slot.steeringKickMask=(slot.steeringKickMask??0)|bit;slot.steeringJetUntil=slot.age+.065;slot.steeringJetSign=sign;
 }
 if(angle<1e-6){slot.angularSpeed=slot.steeringTorque=0;return;}
 let tx=x-dot*slot.dx,ty=y-dot*slot.dy,tz=z-dot*slot.dz,n=Math.hypot(tx,ty,tz);
 if(n<1e-8){tx=slot.rx;ty=slot.ry;tz=slot.rz;n=Math.hypot(tx,ty,tz);}
 slot.steerX=tx/n;slot.steerY=ty/n;slot.steerZ=tz/n;
 const c=Math.cos(amount),s=Math.sin(amount)/n;slot.dx=slot.dx*c+tx*s;slot.dy=slot.dy*c+ty*s;slot.dz=slot.dz*c+tz*s;
}

function integrateFlight(slot,dt){
 const tx=slot.aimX,ty=slot.aimY,tz=slot.aimZ,nx=slot.x+slot.dx*HALF,ny=slot.y+slot.dy*HALF,nz=slot.z+slot.dz*HALF;
  if(slot.phase===PHASE.BOOST)slot.y+=slot.vy*dt;
  else if(slot.phase===PHASE.COAST){
   turn(slot,tx-slot.x,ty-slot.y,tz-slot.z,FLIGHT.coastTurn,dt);
   slot.x+=slot.vx*dt;slot.y+=slot.vy*dt-.5*FLIGHT.coastGravity*dt*dt;slot.z+=slot.vz*dt;slot.vy-=FLIGHT.coastGravity*dt;
  }else{
   if(!slot.engineCutoff&&(nx-tx)**2+(ny-ty)**2+(nz-tz)**2<=FLIGHT.terminalCutoffRadius**2)slot.engineCutoff=true;
   if(slot.engineCutoff){
    // Terminal flight is inertial: neither attitude nor velocity changes, even
    // when a later death supplies a different final point for accounting.
    slot.x+=slot.vx*dt;slot.y+=slot.vy*dt;slot.z+=slot.vz*dt;
   }else{
    if(!slot.passedAim)turn(slot,tx-slot.x,ty-slot.y,tz-slot.z,FLIGHT.homingTurn,dt);
    const speed=FLIGHT.cruiseSpeed,vx=slot.dx*speed-slot.vx,vy=slot.dy*speed-slot.vy,vz=slot.dz*speed-slot.vz,length=Math.hypot(vx,vy,vz),scale=length?Math.min(1,FLIGHT.acceleration*dt/length):0;
    const nextX=slot.vx+vx*scale,nextY=slot.vy+vy*scale,nextZ=slot.vz+vz*scale;
    slot.x+=(slot.vx+nextX)*.5*dt;slot.y+=(slot.vy+nextY)*.5*dt;slot.z+=(slot.vz+nextZ)*.5*dt;slot.vx=nextX;slot.vy=nextY;slot.vz=nextZ;
   }
  }
}

// Fixed scene-owned records. Only actor matrices/visibility reach the existing
// renderer. Every launch reuses the loaded actor; no projectile object is born.
export class MissileFlightPool {
 constructor(world,targets,onPoseChange,onVisible,onHit,{onImpact=null,onLaunch=null,onTrail=null,random=null}={}){
  let seed=7919;this.random=random??(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;});this.targets=targets;this.visibility=world.visibility;this.width=world.width;this.length=world.length;this.onPoseChange=onPoseChange;this.onVisible=onVisible;this.onHit=onHit;this.onImpact=onImpact;this.onLaunch=onLaunch;this.onTrail=onTrail;this.forecast={};this.defenceContact=new Float64Array(7);this.forecastRecord={aimDX:0,aimDY:0,aimDZ:0};this.clearanceChecks=0;this.time=0;this.slots=[];this.records=new Map();this.recordList=[];this.updatedParts=0;
  this.active=0;this.hits=0;this.collisions=0;this.expired=0;this.lostTargets=0;this.stallDiscards=0;this.orphaned=0;this.completedAtLastPosition=0;this.missed=0;
  this.offMap=0;this.contactX=this.contactY=this.contactZ=this.contactNX=this.contactNY=this.contactNZ=this.staticX=this.staticY=this.staticZ=this.staticNX=this.staticNY=this.staticNZ=0;
  this.thrust={instanceData:new Float32Array(MAX_MISSILE_THRUST_INSTANCES*MISSILE_THRUST_FLOATS),instanceCount:0,lightData:new Float32Array(4+MAX_MISSILE_LIGHTS*8),lightCount:0,time:0};
  for(const [id,data]of world.actors)if(data.model===GUIDED_MISSILE_MODEL.id){
   if(data.instances.length!==1||data.instances[0].part!==GUIDED_MISSILE_MODEL.part||this.slots.length>=MAX_MISSILES)throw new Error('Missile actor pool has incompatible geometry or capacity.');
   const instance=data.instances[0];this.slots.push({id,data,instance,phase:PHASE.FREE,visible:true,owner:null,target:null,targetLap:0,orphaned:false,committed:false,passedAim:false,engineCutoff:false,aimDX:0,aimDY:0,aimDZ:0,aimX:0,aimY:0,aimZ:0,lastX:0,lastY:0,lastZ:0,strength:0,age:0,trailCarry:0,clearanceTarget:null,clearanceAt:-Infinity,x:0,y:0,z:0,dx:0,dy:1,dz:0,rx:1,ry:0,rz:0,vx:0,vy:0,vz:0});this.onVisible(id,false);this.slots[this.slots.length-1].visible=false;
  }
  if(this.slots.length!==MAX_MISSILES)throw new Error('Missile preview requires its complete fixed actor pool.');
  const entries=new Map(world.entries.map(entry=>[entry.key,entry.mesh.quads]));
  for(const target of targets){
   const data=world.actors.get(target.id);if(!data)throw new Error('Missile contact requires an enemy actor.');
   const record={target,root:data.root,parts:data.instances.map(instance=>{const quads=entries.get(instance.key);return {matrix:instance.matrix,quads,bounds:quadBounds(quads)};}),bounds:new Float64Array(6),boundsDirty:true,x:0,y:0,z:0,dx:0,dy:0,dz:0,aimX:0,aimY:0,aimZ:0,aimDX:0,aimDY:0,aimDZ:0};retainRecord(record);this.records.set(target,record);this.recordList.push(record);
  }
 }
 freeCount(){let count=0;for(const slot of this.slots)if(slot.phase===PHASE.FREE)count++;return count;}
 freeSlot(){for(let i=0;i<this.slots.length;i++)if(this.slots[i].phase===PHASE.FREE)return i;return -1;}
 incomingDamage(target){
  // The planner runs before flight simulation. Recheck identity/liveness here
  // rather than waiting for advance() to retire a dead or wrapped target.
  if(!target||target.health?.alive===false||!this.targets?.includes(target)||!Number.isFinite(target.x)||!Number.isFinite(target.z)||!finiteAim(target))return 0;
  const lap=target.lap??0;let damage=0;
  for(const slot of this.slots)if(slot.phase>=PHASE.BOOST&&slot.phase<=PHASE.HOMING&&slot.target===target&&slot.targetLap===lap&&!slot.orphaned&&!slot.passedAim&&slot.age<FLIGHT.maxAge)damage+=slot.strength;
  return damage;
 }
 release(slot){
  slot.phase=PHASE.FREE;slot.target=null;slot.owner=null;slot.orphaned=slot.committed=slot.passedAim=slot.engineCutoff=false;slot.aimX=slot.aimY=slot.aimZ=slot.lastX=slot.lastY=slot.lastZ=slot.aimDX=slot.aimDY=slot.aimDZ=0;slot.age=slot.trailCarry=0;slot.angularSpeed=slot.steeringTorque=slot.steeringAngle=slot.steeringKickMask=slot.steeringJetUntil=slot.steeringJetSign=0;slot.clearanceTarget=slot.clearanceVisibility=null;slot.clearanceAt=-Infinity;
  if(slot.visible){slot.visible=false;this.onVisible(slot.id,false);}
 }
 pose(slot){
  // Parallel-transport the right axis, avoiding a roll snap near vertical.
  const dot=slot.rx*slot.dx+slot.ry*slot.dy+slot.rz*slot.dz;
  let rx=slot.rx-dot*slot.dx,ry=slot.ry-dot*slot.dy,rz=slot.rz-dot*slot.dz,length=Math.hypot(rx,ry,rz);
  if(length<1e-8){rx=slot.dy;ry=-slot.dx;rz=0;length=Math.hypot(rx,ry);if(length<1e-8){rx=1;ry=0;rz=0;length=1;}}
  slot.rx=rx/=length;slot.ry=ry/=length;slot.rz=rz/=length;
  const zx=ry*slot.dz-rz*slot.dy,zy=rz*slot.dx-rx*slot.dz,zz=rx*slot.dy-ry*slot.dx,m=slot.instance.matrix;
  m[0]=rx;m[1]=ry;m[2]=rz;m[3]=0;m[4]=slot.dx;m[5]=slot.dy;m[6]=slot.dz;m[7]=0;m[8]=zx;m[9]=zy;m[10]=zz;m[11]=0;
  m[12]=slot.x-rx*12-slot.dx*HALF-zx*12;m[13]=slot.y-ry*12-slot.dy*HALF-zy*12;m[14]=slot.z-rz*12-slot.dz*HALF-zz*12;m[15]=1;
  slot.data.root.set(m);this.onPoseChange(slot.instance.key,slot.instance.index,m);this.updatedParts++;
 }
 seat(index,owner,x,y,z,root){
  const slot=this.slots[index];if(slot.phase!==PHASE.FREE)throw new Error('Missile slot is occupied.');
  slot.turnFactor=.85+this.random()*.3;slot.angularSpeed=slot.steeringTorque=slot.steeringAngle=slot.steeringKickMask=slot.steeringJetUntil=slot.steeringJetSign=0;slot.steerX=slot.steerY=slot.steerZ=0;slot.jetPhase=this.random();slot.owner=owner;slot.phase=PHASE.LOADED;slot.x=x;slot.y=y+HALF;slot.z=z;slot.dx=0;slot.dy=1;slot.dz=0;slot.rx=root[0];slot.ry=root[1];slot.rz=root[2];slot.vx=slot.vy=slot.vz=0;slot.age=slot.trailCarry=0;slot.clearanceTarget=slot.clearanceVisibility=null;slot.clearanceAt=-Infinity;
  this.pose(slot);this.onVisible(slot.id,true);slot.visible=true;
 }
 // Certify the actual boost/coast/turning corridor before spending a round.
 // A constant-velocity forecast is cosmetic-free and bounded to the flight's
 // existing lifetime; physical swept contacts remain authoritative after launch.
 launchClear(index,target){
  const loaded=this.slots[index];if(!loaded||loaded.phase!==PHASE.LOADED||!finiteAim(target))return false;
  const ax=targetX(target),ay=target.aimY,az=targetZ(target),vx=finiteSpeed(target.aimVelocityX??target.velocityX),vy=finiteSpeed(target.aimVelocityY??target.velocityY),vz=finiteSpeed(target.aimVelocityZ??target.velocityZ);
  if(loaded.clearanceRevision===this.visibility?.defenceRevision&&loaded.clearanceVisibility===this.visibility&&loaded.clearanceTarget===target&&loaded.clearanceAt===this.time&&loaded.clearanceX===ax&&loaded.clearanceY===ay&&loaded.clearanceZ===az&&loaded.clearanceVX===vx&&loaded.clearanceVY===vy&&loaded.clearanceVZ===vz)return loaded.clearance;
  const slot=this.forecast;slot.x=loaded.x;slot.y=loaded.y;slot.z=loaded.z;slot.dx=slot.dz=slot.vx=slot.vz=0;slot.dy=1;slot.rx=loaded.rx;slot.ry=loaded.ry;slot.rz=loaded.rz;slot.vy=FLIGHT.boostSpeed;slot.phase=PHASE.BOOST;slot.age=0;slot.engineCutoff=slot.passedAim=slot.committed=false;slot.target=target;slot.lastX=slot.aimX=ax;slot.lastY=slot.aimY=ay;slot.lastZ=slot.aimZ=az;
  slot.turnFactor=loaded.turnFactor;slot.angularSpeed=slot.steeringTorque=slot.steeringAngle=slot.steeringKickMask=slot.steeringJetUntil=slot.steeringJetSign=0;this.clearanceChecks++;let clear=true;
  const visibility=this.visibility;visibility?.beginDefenceQueryBatch?.();
  try{for(let step=0;step<962&&slot.age<FLIGHT.maxAge;step++){
   const boundary=slot.phase===PHASE.BOOST?FLIGHT.boostSeconds:slot.phase===PHASE.COAST?FLIGHT.boostSeconds+FLIGHT.coastSeconds:FLIGHT.maxAge,dt=Math.min(FLIGHT.stepSeconds,boundary-slot.age);
   if(slot.phase===PHASE.COAST){slot.lastX=ax+vx*slot.age;slot.lastY=ay+vy*slot.age;slot.lastZ=az+vz*slot.age;this.predict(slot,this.forecastRecord,1,Math.max(0,FLIGHT.boostSeconds+FLIGHT.coastSeconds-slot.age));}
   const ox=slot.x,oy=slot.y,oz=slot.z,nx=ox+slot.dx*HALF,ny=oy+slot.dy*HALF,nz=oz+slot.dz*HALF;
   integrateFlight(slot,dt);
   const obstacle=sceneryContact(this,ox,oy,oz,slot.x,slot.y,slot.z,loaded.owner?.id,false),passed=slot.committed?aimPassed(slot,nx,ny,nz,slot.x+slot.dx*HALF,slot.y+slot.dy*HALF,slot.z+slot.dz*HALF):Infinity;
   if(obstacle<=1&&obstacle<=passed){clear=false;break;}
   if(passed<=1||slot.x<0||slot.x>this.width||slot.z<0||slot.z>this.length)break;
   slot.age+=dt;
   if(slot.age>=boundary-1e-10){if(slot.phase===PHASE.BOOST)slot.phase=PHASE.COAST;else if(slot.phase===PHASE.COAST){slot.phase=PHASE.HOMING;slot.lastX=ax+vx*slot.age;slot.lastY=ay+vy*slot.age;slot.lastZ=az+vz*slot.age;this.commit(slot,this.forecastRecord,1);}}
  }}finally{visibility?.endDefenceQueryBatch?.();}
  loaded.clearance=clear;loaded.clearanceRevision=this.visibility?.defenceRevision;loaded.clearanceVisibility=this.visibility;loaded.clearanceTarget=target;loaded.clearanceAt=this.time;loaded.clearanceX=ax;loaded.clearanceY=ay;loaded.clearanceZ=az;loaded.clearanceVX=vx;loaded.clearanceVY=vy;loaded.clearanceVZ=vz;return clear;
 }
 launch(index,target,strength){
  const slot=this.slots[index];if(slot.phase!==PHASE.LOADED)return false;
  slot.target=target;slot.targetLap=target.lap??0;slot.orphaned=slot.committed=slot.passedAim=slot.engineCutoff=false;slot.aimX=slot.lastX=targetX(target);slot.aimY=slot.lastY=target.aimY;slot.aimZ=slot.lastZ=targetZ(target);slot.strength=strength;slot.phase=PHASE.BOOST;slot.age=slot.trailCarry=0;slot.vx=0;slot.vy=FLIGHT.boostSpeed;slot.vz=0;this.active++;this.onLaunch?.(slot.x,slot.y-HALF+slot.owner.launchRise,slot.z);return true;
 }
 predict(slot,record,fraction,coast=0){
  const target=slot.target,ax=target.aimVelocityX??target.velocityX,ay=target.aimVelocityY??target.velocityY,az=target.aimVelocityZ??target.velocityZ,vx=Number.isFinite(ax)?ax:0,vy=Number.isFinite(ay)?ay:0,vz=Number.isFinite(az)?az:0;
  const tx=slot.lastX+(fraction-1)*record.aimDX+vx*coast,ty=slot.lastY+(fraction-1)*record.aimDY+vy*coast,tz=slot.lastZ+(fraction-1)*record.aimDZ+vz*coast;
  const x=slot.x+slot.vx*coast,y=slot.y+slot.vy*coast-.5*FLIGHT.coastGravity*coast*coast,z=slot.z+slot.vz*coast;
  const time=interceptTime(tx-x,ty-y,tz-z,vx,vy,vz,Math.max(0,FLIGHT.maxAge-slot.age-coast));
  slot.aimX=tx+vx*time;slot.aimY=ty+vy*time;slot.aimZ=tz+vz*time;
 }
 commit(slot,record,fraction){if(!slot.orphaned)this.predict(slot,record,fraction);slot.committed=true;aimDirection(slot);}
 contact(record,ox,oy,oz,tx,ty,tz,fromFraction,toFraction){
  // Enemy poses are finalized before missile advance. Hits update health and
  // impact velocity, but apply the next articulated pose on the next frame.
  // Build only queried targets, once for any number of flights/substeps.
  if(record.boundsDirty)worldBounds(record);
  let first=Infinity;
  // Translate the current articulated surface between the previous/current
  // root samples. Rotation/limb pose is the current frame's actual pose.
  const ax=(fromFraction-1)*record.dx,ay=(fromFraction-1)*record.dy,az=(fromFraction-1)*record.dz,bx=(toFraction-1)*record.dx,by=(toFraction-1)*record.dy,bz=(toFraction-1)*record.dz;
  if(!intersectsBox(record.bounds,0,ox-ax,oy-ay,oz-az,tx-bx-ox+ax,ty-by-oy+ay,tz-bz-oz+az,0))return first;
  for(const part of record.parts){
   const m=part.matrix,sx=ox-ax-m[12],sy=oy-ay-m[13],sz=oz-az-m[14],ex=tx-bx-m[12],ey=ty-by-m[13],ez=tz-bz-m[14];
   const x=m[0]*sx+m[1]*sy+m[2]*sz,y=m[4]*sx+m[5]*sy+m[6]*sz,z=m[8]*sx+m[9]*sy+m[10]*sz;
   const dx=m[0]*ex+m[1]*ey+m[2]*ez-x,dy=m[4]*ex+m[5]*ey+m[6]*ez-y,dz=m[8]*ex+m[9]*ey+m[10]*ez-z;
   if(!intersectsBox(part.bounds,0,x,y,z,dx,dy,dz,0))continue;
   for(const q of part.quads){
    const axis=q.axis,d=axis===0?dx:axis===1?dy:dz;if(Math.abs(d)<1e-10)continue;
    const origin=axis===0?x:axis===1?y:z,t=(q.origin[axis]-origin)/d;if(t<0||t>1||t>=first)continue;
    const u=(axis+1)%3,v=(axis+2)%3,pu=u===0?x+dx*t:u===1?y+dy*t:z+dz*t,pv=v===0?x+dx*t:v===1?y+dy*t:z+dz*t;
    if(pu>=q.origin[u]-1e-7&&pu<=q.origin[u]+q.width+1e-7&&pv>=q.origin[v]-1e-7&&pv<=q.origin[v]+q.height+1e-7){
     first=t;this.contactX=ox+(tx-ox)*t;this.contactY=oy+(ty-oy)*t;this.contactZ=oz+(tz-oz)*t;this.contactNX=m[axis*4]*q.sign;this.contactNY=m[axis*4+1]*q.sign;this.contactNZ=m[axis*4+2]*q.sign;
    }
   }
  }
  return first;
 }
 step(slot,record,dt,fromFraction,toFraction){
  const ox=slot.x,oy=slot.y,oz=slot.z,nx=ox+slot.dx*HALF,ny=oy+slot.dy*HALF,nz=oz+slot.dz*HALF,target=slot.target;
  if(slot.phase===PHASE.COAST&&!slot.orphaned)this.predict(slot,record,fromFraction,Math.max(0,FLIGHT.boostSeconds+FLIGHT.coastSeconds-slot.age));
  else if(slot.phase===PHASE.HOMING&&!slot.committed)this.commit(slot,record,fromFraction);
  const tx=slot.aimX,ty=slot.aimY,tz=slot.aimZ;
  const powered=slot.phase===PHASE.HOMING&&!slot.engineCutoff,tailX=ox-slot.dx*HALF,tailY=oy-slot.dy*HALF,tailZ=oz-slot.dz*HALF;
  integrateFlight(slot,dt);
  const ex=slot.x+slot.dx*HALF,ey=slot.y+slot.dy*HALF,ez=slot.z+slot.dz*HALF;
  if(slot.phase===PHASE.HOMING&&!slot.engineCutoff&&(ex-tx)**2+(ey-ty)**2+(ez-tz)**2<=FLIGHT.terminalCutoffRadius**2)slot.engineCutoff=true;
  const hit=record?this.contact(record,nx,ny,nz,ex,ey,ez,fromFraction,toFraction):Infinity,obstacle=sceneryContact(this,ox,oy,oz,slot.x,slot.y,slot.z,slot.owner?.id);
  const passed=slot.committed&&!slot.passedAim?aimPassed(slot,nx,ny,nz,ex,ey,ez):Infinity;
  if(powered&&this.onTrail){
   const fraction=Math.min(1,hit,obstacle),duration=dt*fraction;slot.trailCarry+=duration;
   while(slot.trailCarry>=1/24){slot.trailCarry-=1/24;const t=dt?Math.max(0,fraction-slot.trailCarry/dt):0;
    this.onTrail(tailX+(slot.x-slot.dx*HALF-tailX)*t,tailY+(slot.y-slot.dy*HALF-tailY)*t,tailZ+(slot.z-slot.dz*HALF-tailZ)*t);
   }
  }
  if(passed<=1&&passed<hit&&passed<obstacle){slot.passedAim=true;if(slot.orphaned)this.completedAtLastPosition++;else this.missed++;}
  if(obstacle<=1&&obstacle<=hit){this.collisions++;this.release(slot);this.onImpact?.(this.staticX,this.staticY,this.staticZ,this.staticNX,this.staticNY,this.staticNZ);return;}
  if(hit<=1){
   const owner=slot.owner,strength=slot.strength,vx=slot.vx,vy=slot.vy,vz=slot.vz;
   // Remove this claim before callbacks observe health or incoming damage.
   this.release(slot);owner.hits++;this.hits++;
   this.onImpact?.(this.contactX,this.contactY,this.contactZ,this.contactNX,this.contactNY,this.contactNZ);
   owner.lastHitTargetId=target.id;owner.lastHitDamage=this.onHit?.(target,strength,vx,vy,vz)??0;return;
  }
  if(slot.x<0||slot.x>this.width||slot.z<0||slot.z>this.length){this.offMap++;this.release(slot);}
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid missile delta.');
  this.time+=deltaSeconds;this.updatedParts=0;this.active=0;
  for(const record of this.recordList){const target=record.target,m=record.root;
   record.boundsDirty=true;
   record.aimDX=targetX(target)-record.aimX;record.aimDY=target.aimY-record.aimY;record.aimDZ=targetZ(target)-record.aimZ;
   record.dx=m[0]*12+m[8]*12+m[12]-record.x;record.dy=m[1]*12+m[9]*12+m[13]-record.y;record.dz=m[2]*12+m[10]*12+m[14]-record.z;
  }
  for(const slot of this.slots){
   if(slot.phase<PHASE.BOOST)continue;
   const target=slot.target;let record=null;
   if(slot.passedAim){
    record=this.records.get(target);
    if(!record||target.health?.alive===false||!this.targets.includes(target)||slot.targetLap!==(target.lap??0)||!Number.isFinite(target.x)||!Number.isFinite(target.z)||!finiteAim(target)){slot.target=null;record=null;}
    else{slot.lastX=targetX(target);slot.lastY=target.aimY;slot.lastZ=targetZ(target);}
   }else if(!slot.orphaned){
    if(target?.health?.alive===false){
     // Death freezes the final actual pose when available; later reset, roster
     // replacement or movement cannot redirect this independent fixed aim.
     if(finiteAim(target)){slot.lastX=targetX(target);slot.lastY=target.aimY;slot.lastZ=targetZ(target);}
     slot.aimX=slot.lastX;slot.aimY=slot.lastY;slot.aimZ=slot.lastZ;
     if(slot.committed)aimDirection(slot);
     slot.orphaned=true;slot.target=null;this.orphaned++;
    }else{
     record=this.records.get(target);
     if(!record||!this.targets.includes(target)||slot.targetLap!==(target.lap??0)||!Number.isFinite(target.x)||!Number.isFinite(target.z)||!finiteAim(target)){this.lostTargets++;this.release(slot);continue;}
     slot.lastX=targetX(target);slot.lastY=target.aimY;slot.lastZ=targetZ(target);
    }
   }
   if(deltaSeconds>FLIGHT.maxFrameSeconds){this.stallDiscards++;this.release(slot);continue;}
   let elapsed=0;
   for(let steps=0;elapsed+1e-10<deltaSeconds&&slot.phase>=PHASE.BOOST&&steps<123;steps++){
    const boundary=slot.phase===PHASE.BOOST?FLIGHT.boostSeconds:slot.phase===PHASE.COAST?FLIGHT.boostSeconds+FLIGHT.coastSeconds:FLIGHT.maxAge;
    const dt=Math.min(FLIGHT.stepSeconds,deltaSeconds-elapsed,boundary-slot.age);
    if(dt>1e-10){this.step(slot,record,dt,elapsed/deltaSeconds,(elapsed+dt)/deltaSeconds);if(slot.phase>=PHASE.BOOST)slot.age+=dt;elapsed+=dt;}
    if(slot.phase<PHASE.BOOST)break;
    if(slot.age>=boundary-1e-10){if(slot.phase===PHASE.BOOST)slot.phase=PHASE.COAST;else if(slot.phase===PHASE.COAST){slot.phase=PHASE.HOMING;this.commit(slot,record,elapsed/deltaSeconds);}else{this.expired++;this.release(slot);}}
   }
   if(slot.phase>=PHASE.BOOST){this.active++;this.pose(slot);}
  }
  for(const record of this.recordList)retainRecord(record);
 }
 steeringJets(slot,i){
  const thrust=this.thrust,a=thrust.instanceData;
    const sign=slot.steeringJetSign,tx=slot.steerX*sign,ty=slot.steerY*sign,tz=slot.steerZ*sign;
    for(const end of [-1,1]){const k=thrust.instanceCount++*MISSILE_THRUST_FLOATS;a[k]=slot.x+slot.dx*HALF*.65*end;a[k+1]=slot.y+slot.dy*HALF*.65*end;a[k+2]=slot.z+slot.dz*HALF*.65*end;a[k+3]=.5;
     a[k+4]=-tx*end;a[k+5]=-ty*end;a[k+6]=-tz*end;a[k+7]=MISSILE_STEERING_JET_LENGTH;a[k+8]=1;a[k+9]=.96;a[k+10]=.9;a[k+11]=1;a[k+12]=-1;a[k+13]=this.time*53+i;a[k+14]=a[k+15]=0;
    }
 }
 prepare(){
  const thrust=this.thrust,a=thrust.instanceData,l=thrust.lightData,light=MISSILE_THRUST_LIGHT;thrust.instanceCount=thrust.lightCount=l[0]=0;thrust.time=this.time;
  for(let i=0;i<this.slots.length;i++){
   const slot=this.slots[i];
   const steering=(slot.phase===PHASE.COAST||slot.phase===PHASE.HOMING)&&!slot.engineCutoff&&!slot.passedAim&&(slot.steeringAngle??0)>Math.PI/180&&slot.age<(slot.steeringJetUntil??0);
   if(slot.phase===PHASE.COAST){
    if(steering)this.steeringJets(slot,i);
    if(steering){const k=4+thrust.lightCount++*8;l[k]=slot.x;l[k+1]=slot.y;l[k+2]=slot.z;l[k+3]=16;l[k+4]=1;l[k+5]=.96;l[k+6]=.9;l[k+7]=2.2;}
    continue;
   }
   if((slot.phase!==PHASE.BOOST&&slot.phase!==PHASE.HOMING)||slot.engineCutoff)continue;
   const attack=slot.phase===PHASE.HOMING,width=attack?MISSILE_ATTACK_THRUST.widthScale:1,length=attack?MISSILE_ATTACK_THRUST.lengthScale:1,strength=attack?MISSILE_ATTACK_THRUST.lightStrength:light.strength;
   const x=slot.x-slot.dx*HALF,y=slot.y-slot.dy*HALF,z=slot.z-slot.dz*HALF,pulse=.9+.1*Math.sin(this.time*83+i*2.17),seed=this.time*53+i*1.73;
   let k=thrust.instanceCount++*MISSILE_THRUST_FLOATS;
   a[k]=x;a[k+1]=y;a[k+2]=z;a[k+3]=1.8*width*pulse;a[k+4]=-slot.dx;a[k+5]=-slot.dy;a[k+6]=-slot.dz;a[k+7]=12*length*pulse;a[k+8]=1;a[k+9]=.55;a[k+10]=.12;a[k+11]=1;a[k+12]=0;a[k+13]=seed;a[k+14]=a[k+15]=0;
   k=thrust.instanceCount++*MISSILE_THRUST_FLOATS;
   a[k]=x-slot.dx*.2;a[k+1]=y-slot.dy*.2;a[k+2]=z-slot.dz*.2;a[k+3]=1.2*width*pulse;a[k+4]=a[k+5]=a[k+6]=a[k+7]=0;a[k+8]=1;a[k+9]=.85;a[k+10]=.45;a[k+11]=.85;a[k+12]=1;a[k+13]=seed;a[k+14]=a[k+15]=0;
   k=4+thrust.lightCount++*8;
   l[k]=x-slot.dx*light.offset;l[k+1]=y-slot.dy*light.offset;l[k+2]=z-slot.dz*light.offset;l[k+3]=light.radius;
   l[k+4]=light.color[0];l[k+5]=light.color[1];l[k+6]=light.color[2];l[k+7]=strength*pulse;
   if(steering){
    this.steeringJets(slot,i);
    // One bounded light record per missile: add the white steering energy to
    // the engine light while preserving its independent flame and idle light.
    // This co-located approximation avoids enlarging the portable light block.
    const engine=strength*pulse,total=engine+2.2;
    l[k]=(l[k]*engine+slot.x*2.2)/total;l[k+1]=(l[k+1]*engine+slot.y*2.2)/total;l[k+2]=(l[k+2]*engine+slot.z*2.2)/total;
    l[k+4]=1;l[k+5]=(light.color[1]*engine+.96*2.2)/total;l[k+6]=(light.color[2]*engine+.9*2.2)/total;
    l[k+7]=total;
   }

  }
  l[0]=thrust.lightCount;
 }
 reset(){for(const slot of this.slots)this.release(slot);this.active=this.orphaned=this.completedAtLastPosition=this.missed=this.offMap=0;this.thrust.instanceCount=this.thrust.lightCount=this.thrust.lightData[0]=0;this.forecast.target=null;this.clearanceChecks=0;for(const record of this.recordList){retainRecord(record);record.boundsDirty=true;record.dx=record.dy=record.dz=record.aimDX=record.aimDY=record.aimDZ=0;}}
 dispose(){this.reset();this.records.clear();this.recordList.length=0;this.slots.length=0;this.targets=this.visibility=this.onPoseChange=this.onVisible=this.onHit=this.onImpact=this.onLaunch=this.onTrail=null;this.forecast.target=null;}
}
