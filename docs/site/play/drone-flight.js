import {TerrainField} from '../shared/terrain.js';
import {DroneObstacles} from '../engine/drone-obstacles.js';
export const DRONE_CAMERA_MOTION_RATE=2;
export const DRONE_CAMERA_RADIUS=2.5,DRONE_CAMERA_SPEED=68,DRONE_CAMERA_ACCELERATION=96,DRONE_CAMERA_MIN_FOV=52;
export const DRONE_CAMERA_MAX_FILM_PITCH=.8,DRONE_CAMERA_BOARD_MARGIN=240;
const R=DRONE_CAMERA_RADIUS,EMPTY=Object.freeze([]),DRIFT_SPEED=1.3,DRIFT_RADIUS=6,DRIFT_RATE=DRIFT_SPEED/DRIFT_RADIUS,JERK=384;
const YAW_SPEED=2.2,PITCH_SPEED=1.4,YAW_ACCELERATION=7.2,PITCH_ACCELERATION=4.8;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function put(out,x,y,z,k=0){out[k]=x;out[k+1]=y;out[k+2]=z;}
// Exact segment against an expanded box: endpoints alone cannot certify flight.
function hits(box,k,ax,ay,az,bx,by,bz,r=R){
 let lo=0,hi=1;
 for(let axis=0;axis<3;axis++){
  const a=axis===0?ax:axis===1?ay:az,d=(axis===0?bx:axis===1?by:bz)-a,min=box[k+axis]-r,max=box[k+axis+3]+r;
  if(Math.abs(d)<1e-12){if(a<min||a>max)return false;continue;}
  let near=(min-a)/d,far=(max-a)/d;if(near>far){const swap=near;near=far;far=swap;}
  lo=Math.max(lo,near);hi=Math.min(hi,far);if(lo>hi)return false;
 }
 return true;
}

// Geometry and eased flight are shared mechanics, not editorial decisions.
export class DroneFlight {
 constructor(camera,{random=Math.random}={}){
  this.camera=camera;this.random=random;this.world=this.obstacles=this.obstacleEngine=null;this.enabled=this.active=false;this.water=null;
  for(const name of ['position','focus','look','goal','velocity','acceleration','desiredVelocity','driftAnchor'])this[name]=new Float64Array(3);
  this.saved=new Float64Array(6);this.route=new Float64Array(9);this.scratch=new Float64Array(6);this.spawnBounds=new Float64Array(6);this.waveClock=0;this.seed=0;this.drifting=this.emergency=false;
  this.routeLength=this.routeIndex=this.speed=this.travelled=this.blockedMoves=this.heldFor=this.panRoll=this.flinch=this.yawVelocity=this.pitchVelocity=this.fovVelocity=this.yaw=this.pitch=0;this.fov=this.targetFov=64;
 }
 bind(world){
  this.leave();this.obstacles?.dispose();this.obstacles=this.obstacleEngine=null;this.world=world;this.water=null;this.routeLength=this.routeIndex=0;this.travelled=this.blockedMoves=this.speed=0;this.emergency=false;
  this.velocity.fill(0);this.acceleration.fill(0);this.drifting=false;
  if(!world)return;
  const field=new TerrainField(world.level);this.water=new Float32Array(world.level.size[0]*world.level.size[1]);for(let z=0;z<world.level.size[1];z++)for(let x=0;x<world.level.size[0];x++)this.water[z*world.level.size[0]+x]=field.height(x*24,z*24,true);
  this.cruiseY=Math.max(world.level.pathHeight+200,(world.visibility?.bounds?.[4]??0)+32);this.seed=this.random()*Math.PI*2;
 }
 prepareObstacles(engine){
  if(this.obstacles&&this.obstacleEngine!==engine.enemies){this.obstacles.dispose();this.obstacles=null;}
  if(!this.obstacles){const actors=new Map();for(const state of [...(engine.enemies?.states??EMPTY),...(engine.wildlife?.states??EMPTY)]){const rig=this.world.actors?.get(state.id);if(rig)actors.set(state.id,rig);}this.obstacleEngine=engine.enemies;this.obstacles=new DroneObstacles({rigs:this.world.rigs,actors},engine.enemies?.states??EMPTY);this.obstacles.setWildlife(engine.wildlife?.states??EMPTY);this.obstacles.predictionSeconds=3;}
  this.waveClock=engine.waveTime??0;this.obstacles.update(0);
 }
 leave(){
  if(!this.active)return;const c=this.camera;c.mode='overview';c.target.set(this.saved.subarray(0,3));c.yaw=this.saved[3];c.pitch=this.saved[4];c.radius=this.saved[5];c.roll=0;c.setControlsEnabled(true);c.invalidate();this.active=false;this.velocity.fill(0);this.acceleration.fill(0);this.routeLength=this.routeIndex=0;this.speed=0;this.drifting=false;
 }
 setEnabled(enabled){this.enabled=Boolean(enabled);if(!this.enabled)this.leave();return this.enabled;}

 staticClear(ax,ay,az,bx,by,bz){
  const w=this.world;if(!w)return false;
  if(Math.min(ax,bx)<R-DRONE_CAMERA_BOARD_MARGIN||Math.min(az,bz)<R-DRONE_CAMERA_BOARD_MARGIN||Math.max(ax,bx)>w.width+DRONE_CAMERA_BOARD_MARGIN-R||Math.max(az,bz)>w.length+DRONE_CAMERA_BOARD_MARGIN-R)return false;
  const tree=w.visibility;if(!tree?.bounds)return false;
  for(let node=0;node<tree.nodeCount;){
   if(hits(tree.bounds,node*6,ax,ay,az,bx,by,bz)){if(tree.escape[node]===node+1)return false;node++;}else node=tree.escape[node];
  }
  // The visibility BVH contains solid ground/decks; water needs its own slab.
  const cols=w.level.size[0],rows=w.level.size[1],box=this.scratch;
  for(let z=Math.max(0,Math.floor((Math.min(az,bz)-R)/24));z<=Math.min(rows-1,Math.floor((Math.max(az,bz)+R)/24));z++)for(let x=Math.max(0,Math.floor((Math.min(ax,bx)-R)/24));x<=Math.min(cols-1,Math.floor((Math.max(ax,bx)+R)/24));x++){
   const height=this.water[z*cols+x];if(!height)continue;box[0]=x*24;box[1]=0;box[2]=z*24;box[3]=(x+1)*24;box[4]=height;box[5]=(z+1)*24;if(hits(box,0,ax,ay,az,bx,by,bz))return false;
  }
  return true;
 }
 spawnClear(ax,ay,az,bx,by,bz){
  const o=this.obstacles;if(!o)return true;const b=this.spawnBounds;
  // Hidden actors do not enter the live collision cache until spawning. Reserve
  // their imminent entrance envelope early enough to leave without a snap.
  for(let i=0;i<o.records.length;i++){
   const record=o.records[i],s=record.state,wait=(s?.spawnAt??Infinity)-this.waveClock;if(s?.phase!=='scheduled'||wait>3||wait<0)continue;
   b[0]=b[1]=b[2]=Infinity;b[3]=b[4]=b[5]=-Infinity;const k=i*6,m=record.root,e=o.poseEnvelope;
   for(let corner=0;corner<8;corner++){const x=e[k+(corner&1?3:0)],y=e[k+1+(corner&2?3:0)],z=e[k+2+(corner&4?3:0)];for(let axis=0;axis<3;axis++){const v=m[axis]*x+m[axis+4]*y+m[axis+8]*z+m[axis+12];b[axis]=Math.min(b[axis],v);b[axis+3]=Math.max(b[axis+3],v);}}
   const travel=(s.movement?.speed??0)*(3-wait);b[0]-=travel;b[2]-=travel;b[3]+=travel;b[5]+=travel;
   if(hits(b,0,ax,ay,az,bx,by,bz))return false;
  }
  return true;
 }
 clear(ax,ay,az,bx,by,bz,horizon=.8){return this.staticClear(ax,ay,az,bx,by,bz)&&this.spawnClear(ax,ay,az,bx,by,bz)&&(!this.obstacles||this.obstacles.clearSegment(ax,ay,az,bx,by,bz,R,horizon));}
 columnClear(x,y,z){return this.clear(x,y,z,x,this.cruiseY,z);}
 routeTo(x,y,z){
  if(this.active&&y<this.world.level.pathHeight+14)return false;
  const p=this.position;
  if(this.clear(p[0],p[1],p[2],x,y,z)){
   // Certify the sky above the whole straight corridor, preserving the escape
   // column invariant even if a moving actor invalidates this flight later.
   const low=Math.min(p[1],y),box=this.scratch;box[0]=Math.min(p[0],x)-R;box[1]=low-R;box[2]=Math.min(p[2],z)-R;box[3]=Math.max(p[0],x)+R;box[4]=this.cruiseY+R;box[5]=Math.max(p[2],z)+R;
   let blocked=false;const tree=this.world.visibility;
   for(let node=0;node<tree.nodeCount;){const k=node*6,b=tree.bounds;if(box[0]<=b[k+3]&&box[3]>=b[k]&&box[1]<=b[k+4]&&box[4]>=b[k+1]&&box[2]<=b[k+5]&&box[5]>=b[k+2]){if(tree.escape[node]===node+1){blocked=true;break;}node++;}else node=tree.escape[node];}
   if(!blocked){put(this.route,x,y,z);this.routeLength=1;this.routeIndex=0;return true;}
  }
  if(!this.columnClear(p[0],p[1],p[2])||!this.columnClear(x,y,z)||!this.clear(p[0],this.cruiseY,p[2],x,this.cruiseY,z))return false;
  put(this.route,p[0],this.cruiseY,p[2]);put(this.route,x,this.cruiseY,z,3);put(this.route,x,y,z,6);this.routeLength=3;this.routeIndex=0;return true;
 }
 startDrift(){
  const v=this.velocity,h=Math.hypot(v[0],v[2]);this.driftPhase=h>.01?Math.atan2(-v[0],v[2]):this.seed;
  put(this.driftAnchor,this.position[0]-Math.cos(this.driftPhase)*DRIFT_RADIUS,this.position[1],this.position[2]-Math.sin(this.driftPhase)*DRIFT_RADIUS);this.drifting=true;
 }
 driftVelocity(dt){
  if(!this.drifting)this.startDrift();this.driftPhase+=DRIFT_RATE*dt;
  const p=this.position,a=this.driftAnchor,t=this.driftPhase,r=DRIFT_RADIUS,v=this.desiredVelocity;
  v[0]=-Math.sin(t)*DRIFT_SPEED+(a[0]+Math.cos(t)*r-p[0])*.8*DRONE_CAMERA_MOTION_RATE;v[1]=(a[1]-p[1])*.8*DRONE_CAMERA_MOTION_RATE;v[2]=Math.cos(t)*DRIFT_SPEED+(a[2]+Math.sin(t)*r-p[2])*.8*DRONE_CAMERA_MOTION_RATE;
 }
 move(dt){
  const p=this.position,v=this.velocity,a=this.acceleration,want=this.desiredVelocity;
  // Look through a certified high waypoint instead of stopping at each axis
  // change. Swept live gates still validate every actual, eased movement step.
  while(this.routeIndex<this.routeLength){const k=this.routeIndex*3,d=Math.hypot(this.route[k]-p[0],this.route[k+1]-p[1],this.route[k+2]-p[2]),next=this.routeIndex+1<this.routeLength;if(d>2&&!(!next&&d<5&&this.speed<6*DRONE_CAMERA_MOTION_RATE)&&!(next&&d<8&&this.clear(p[0],p[1],p[2],this.route[k+3],this.route[k+4],this.route[k+5])))break;this.routeIndex++;}
  const travelling=(this.phase==='wave'||this.emergency)&&this.routeIndex<this.routeLength;
  if(travelling){
   this.drifting=false;const k=this.routeIndex*3,dx=this.route[k]-p[0],dy=this.route[k+1]-p[1],dz=this.route[k+2]-p[2],distance=Math.hypot(dx,dy,dz),last=this.routeIndex===this.routeLength-1;
   let tx=dx/distance,ty=dy/distance,tz=dz/distance,desired=Math.min(DRONE_CAMERA_SPEED,Math.sqrt(20*distance)*DRONE_CAMERA_MOTION_RATE);
   if(!last){
    const nx=this.route[k+3]-this.route[k],ny=this.route[k+4]-this.route[k+1],nz=this.route[k+5]-this.route[k+2],nd=Math.hypot(nx,ny,nz),blend=clamp((12-distance)/12,0,1);
    desired=Math.min(DRONE_CAMERA_SPEED,Math.sqrt((12*DRONE_CAMERA_MOTION_RATE)**2+2*DRONE_CAMERA_ACCELERATION*Math.max(0,distance-12)));
    if(nd>0){tx=tx*(1-blend)+nx/nd*blend;ty=ty*(1-blend)+ny/nd*blend;tz=tz*(1-blend)+nz/nd*blend;}
   }else if(distance<12){
    // Blend into a slow sideways survey before reaching the last point. A
    // stable shot stays alive without a stop/restart at its nominal anchor.
    const blend=clamp((12-distance)/12,0,1),heading=Math.hypot(v[0],v[2])>.1?Math.atan2(-v[0],v[2]):this.seed;
    tx=tx*(1-blend)-Math.sin(heading)*blend;ty*=1-blend;tz=tz*(1-blend)+Math.cos(heading)*blend;desired=Math.max(DRIFT_SPEED,desired*(1-blend)+DRIFT_SPEED*blend);
   }
   const length=Math.hypot(tx,ty,tz)||1;put(want,tx/length*desired,ty/length*desired,tz/length*desired);
  }else{this.emergency=false;this.driftVelocity(dt);}
  // Keep a small physical floor; dramatic filming has no arbitrary high band.
  const highFloor=this.cruiseY,lowDrift=this.active&&!travelling&&p[1]<highFloor,floor=this.active?this.world.level.pathHeight+14:-Infinity;
  if(Number.isFinite(floor)&&want[1]<0)want[1]=Math.max(want[1],-Math.max(0,p[1]-floor)*.6*DRONE_CAMERA_MOTION_RATE);
  // A critically damped velocity response with bounded acceleration change
  // keeps travel, braking and direction changes gradual rather than scalar snaps.
  let ax=(want[0]-v[0])*3*DRONE_CAMERA_MOTION_RATE,ay=(want[1]-v[1])*3*DRONE_CAMERA_MOTION_RATE,az=(want[2]-v[2])*3*DRONE_CAMERA_MOTION_RATE,amount=Math.hypot(ax,ay,az),scale=amount>DRONE_CAMERA_ACCELERATION?DRONE_CAMERA_ACCELERATION/amount:1;ax*=scale;ay*=scale;az*=scale;
  const jx=ax-a[0],jy=ay-a[1],jz=az-a[2],jerk=Math.hypot(jx,jy,jz),fraction=jerk>JERK*dt?JERK*dt/jerk:1;a[0]+=jx*fraction;a[1]+=jy*fraction;a[2]+=jz*fraction;
  for(let i=0;i<3;i++)v[i]+=a[i]*dt;
  const speed=Math.hypot(v[0],v[1],v[2]);if(speed>DRONE_CAMERA_SPEED)for(let i=0;i<3;i++)v[i]*=DRONE_CAMERA_SPEED/speed;
  const x=p[0]+v[0]*dt,y=Math.max(floor,p[1]+v[1]*dt),z=p[2]+v[2]*dt;
  if(y===floor&&v[1]<0){v[1]=0;a[1]=Math.max(0,a[1]);}
  if(this.staticClear(p[0],p[1],p[2],x,y,z)&&(!this.obstacles||this.obstacles.clearTimedSegment(p[0],p[1],p[2],x,y,z,R,0,dt))&&(!lowDrift||this.staticClear(x,y,z,x,this.cruiseY,z))){
   this.travelled+=Math.hypot(x-p[0],y-p[1],z-p[2]);p[0]=x;p[1]=y;p[2]=z;
  }else{
   // Safety wins in a packed scene. Pick another gentle direction, never snap
   // through a hull just to satisfy the non-stopping presentation preference.
   this.blockedMoves++;v.fill(0);a.fill(0);this.routeLength=this.routeIndex=0;this.planIn=Math.min(this.planIn,.15);this.heldFor=0;this.drifting=false;
   for(let n=1;n<=16;n++){const heading=this.seed+n*Math.PI/8,dx=Math.cos(heading),dz=Math.sin(heading),nx=p[0]+dx*3,nz=p[2]+dz*3;if(this.clear(p[0],p[1],p[2],nx,p[1],nz,this.emergency?0:.5)&&(!lowDrift||this.staticClear(nx,p[1],nz,nx,this.cruiseY,nz))){this.driftPhase=Math.atan2(-dx,dz);put(this.driftAnchor,p[0]-Math.cos(this.driftPhase)*DRIFT_RADIUS,p[1],p[2]-Math.sin(this.driftPhase)*DRIFT_RADIUS);this.drifting=true;break;}}
  }
  this.speed=Math.hypot(v[0],v[1],v[2]);
 }
 aim(dt,engine){
  const smoothing=1-Math.exp(-3*DRONE_CAMERA_MOTION_RATE*dt);for(let i=0;i<3;i++)this.look[i]+=(this.focus[i]-this.look[i])*smoothing;
  const dx=this.position[0]-this.look[0],dy=this.position[1]-this.look[1],dz=this.position[2]-this.look[2],yaw=Math.atan2(dx,dz),pitch=clamp(Math.atan2(dy,Math.hypot(dx,dz)),-1.35,1.35);
  const yawRate=clamp(angle(yaw,this.yaw)*2.4*DRONE_CAMERA_MOTION_RATE,-YAW_SPEED,YAW_SPEED),pitchRate=clamp((pitch-this.pitch)*1.2*DRONE_CAMERA_MOTION_RATE,-PITCH_SPEED,PITCH_SPEED);
  this.yawVelocity+=clamp((yawRate-this.yawVelocity)*(1-Math.exp(-5*DRONE_CAMERA_MOTION_RATE*dt)),-YAW_ACCELERATION*dt,YAW_ACCELERATION*dt);this.pitchVelocity+=clamp((pitchRate-this.pitchVelocity)*(1-Math.exp(-5*DRONE_CAMERA_MOTION_RATE*dt)),-PITCH_ACCELERATION*dt,PITCH_ACCELERATION*dt);
  this.pitchVelocity=clamp(this.pitchVelocity,-Math.sqrt(2*PITCH_ACCELERATION*Math.max(0,this.pitch+1.35)),Math.sqrt(2*PITCH_ACCELERATION*Math.max(0,1.35-this.pitch)));
  this.yaw+=this.yawVelocity*dt;this.pitch=clamp(this.pitch+this.pitchVelocity*dt,-1.35,1.35);this.panRoll+=(clamp(-this.yawVelocity*.012,-.018,.018)-this.panRoll)*(1-Math.exp(-5*dt));
  const desired=this.targetFov,fovRate=clamp((desired-this.fov)*1.1,-9,9);this.fovVelocity+=clamp((fovRate-this.fovVelocity)*(1-Math.exp(-5*dt)),-12*dt,12*dt);this.fov=clamp(this.fov+this.fovVelocity*dt,DRONE_CAMERA_MIN_FOV,64);

 }
 apply(){const c=this.camera;c.mode='live';c.position.set(this.position);c.yaw=this.yaw;c.pitch=this.pitch;c.roll=this.panRoll+Math.sin(this.time*12)*this.flinch*.018;c.fov=this.fov;c.invalidate();}
}
