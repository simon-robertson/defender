import {TerrainField} from '../shared/terrain.js';
import {DroneObstacles} from '../engine/drone-obstacles.js';
export const DRONE_CAMERA_RADIUS=2.5,DRONE_CAMERA_SPEED=68,DRONE_CAMERA_ACCELERATION=96;
export const DRONE_CAMERA_MIN_ALTITUDE=200;
const R=DRONE_CAMERA_RADIUS,EMPTY=Object.freeze([]),JERK=384;
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

// Physical flight is independent of reticle targeting and orbit composition.
export class DroneFlight {
 constructor(camera){
  this.camera=camera;this.world=this.obstacles=this.obstacleEngine=null;this.enabled=this.active=false;this.surfaces=null;
  for(const name of ['position','focus','goal','velocity','acceleration','desiredVelocity'])this[name]=new Float64Array(3);
  this.saved=new Float64Array(6);this.scratch=new Float64Array(6);this.spawnBounds=new Float64Array(6);
  this.waveClock=this.speed=this.travelled=this.blockedMoves=this.yaw=this.pitch=0;this.fov=64;
 }
 bind(world){
  this.leave();this.obstacles?.dispose();this.obstacles=this.obstacleEngine=null;this.world=world;this.surfaces=null;
  this.travelled=this.blockedMoves=this.speed=0;this.velocity.fill(0);this.acceleration.fill(0);
  if(!world)return;
  const field=new TerrainField(world.level);this.surfaces=new Float32Array(world.level.size[0]*world.level.size[1]);
  for(let z=0;z<world.level.size[1];z++)for(let x=0;x<world.level.size[0];x++)this.surfaces[z*world.level.size[0]+x]=Math.max(field.height(x*24,z*24),field.height(x*24,z*24,true),field.bridgeBox(x,z)?world.level.pathHeight:0);
  this.cruiseY=Math.max(world.level.pathHeight+DRONE_CAMERA_MIN_ALTITUDE,(world.visibility?.bounds?.[4]??0)+32);
 }
 prepareObstacles(engine){
  if(this.obstacles&&this.obstacleEngine!==engine.enemies){this.obstacles.dispose();this.obstacles=null;}
  if(!this.obstacles){const actors=new Map();for(const state of [...(engine.enemies?.states??EMPTY),...(engine.wildlife?.states??EMPTY)]){const rig=this.world.actors?.get(state.id);if(rig)actors.set(state.id,rig);}this.obstacleEngine=engine.enemies;this.obstacles=new DroneObstacles({rigs:this.world.rigs,actors},engine.enemies?.states??EMPTY);this.obstacles.setWildlife(engine.wildlife?.states??EMPTY);this.obstacles.predictionSeconds=3;}
  this.waveClock=engine.waveTime??0;this.obstacles.update(0);
 }
 leave(){
  if(!this.active)return;const c=this.camera;c.mode='overview';c.target.set(this.saved.subarray(0,3));c.yaw=this.saved[3];c.pitch=this.saved[4];c.radius=this.saved[5];c.roll=0;c.setControlsEnabled(true);c.invalidate();this.active=false;this.velocity.fill(0);this.acceleration.fill(0);this.speed=0;
 }
 setEnabled(enabled){this.enabled=Boolean(enabled);if(!this.enabled)this.leave();return this.enabled;}
 get minimumY(){return this.cruiseY;}
 staticClear(ax,ay,az,bx,by,bz){
  const w=this.world;if(!w)return false;
  const tree=w.visibility;if(!tree?.bounds)return false;
  for(let node=0;node<tree.nodeCount;){
   if(hits(tree.bounds,node*6,ax,ay,az,bx,by,bz)){if(tree.escape[node]===node+1)return false;node++;}else node=tree.escape[node];
  }
  // The visibility BVH contains solids/decks; cached surface slabs also
  // protect ground and water when the camera approaches from outside.
  const cols=w.level.size[0],rows=w.level.size[1],box=this.scratch;
  for(let z=Math.max(0,Math.floor((Math.min(az,bz)-R)/24));z<=Math.min(rows-1,Math.floor((Math.max(az,bz)+R)/24));z++)for(let x=Math.max(0,Math.floor((Math.min(ax,bx)-R)/24));x<=Math.min(cols-1,Math.floor((Math.max(ax,bx)+R)/24));x++){
   const height=this.surfaces[z*cols+x];if(!height)continue;box[0]=x*24;box[1]=0;box[2]=z*24;box[3]=(x+1)*24;box[4]=height;box[5]=(z+1)*24;if(hits(box,0,ax,ay,az,bx,by,bz))return false;
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
 move(dt){
  const p=this.position,v=this.velocity,a=this.acceleration,want=this.desiredVelocity;
  // Critically damped velocity with bounded acceleration and jerk. Each actual
  // movement remains swept against scenery, water and live actor geometry.
  let ax=(want[0]-v[0])*6,ay=(want[1]-v[1])*6,az=(want[2]-v[2])*6,amount=Math.hypot(ax,ay,az),scale=amount>DRONE_CAMERA_ACCELERATION?DRONE_CAMERA_ACCELERATION/amount:1;ax*=scale;ay*=scale;az*=scale;
  const jx=ax-a[0],jy=ay-a[1],jz=az-a[2],jerk=Math.hypot(jx,jy,jz),fraction=jerk>JERK*dt?JERK*dt/jerk:1;a[0]+=jx*fraction;a[1]+=jy*fraction;a[2]+=jz*fraction;
  for(let i=0;i<3;i++)v[i]+=a[i]*dt;
  const speed=Math.hypot(v[0],v[1],v[2]);if(speed>DRONE_CAMERA_SPEED)for(let i=0;i<3;i++)v[i]*=DRONE_CAMERA_SPEED/speed;
  const x=p[0]+v[0]*dt,y=Math.max(this.minimumY,p[1]+v[1]*dt),z=p[2]+v[2]*dt;
  if(y===this.minimumY&&v[1]<0){v[1]=0;a[1]=Math.max(0,a[1]);}
  // Never cut through the anchor's vertical column when changing orbit sides.
  const t=this.focus,dx=x-p[0],dz=z-p[2],along=Math.max(0,Math.min(1,((t[0]-p[0])*dx+(t[2]-p[2])*dz)/(dx*dx+dz*dz||1))),near=Math.hypot(p[0]+dx*along-t[0],p[2]+dz*along-t[2]),old=Math.hypot(p[0]-t[0],p[2]-t[2]);
  const offsetSafe=near>=this.minimumOffset-1e-6||Math.hypot(x-t[0],z-t[2])>=old&&old<this.minimumOffset;
  if(offsetSafe&&this.staticClear(...p,x,y,z)&&this.spawnClear(...p,x,y,z)&&(!this.obstacles||this.obstacles.clearTimedSegment(...p,x,y,z,R,0,dt))){
   this.travelled+=Math.hypot(x-p[0],y-p[1],z-p[2]);p[0]=x;p[1]=y;p[2]=z;
  }else{this.blockedMoves++;v.fill(0);a.fill(0);this.planIn=0;}
  this.speed=Math.hypot(v[0],v[1],v[2]);
 }
 aim(){
  // Derive the gimbal from the exact world anchor after every movement step.
  // Easing this look point independently would make the reticle slide away.
  const dx=this.position[0]-this.focus[0],dy=this.position[1]-this.focus[1],dz=this.position[2]-this.focus[2];
  this.yaw=Math.atan2(dx,dz);this.pitch=Math.atan2(dy,Math.hypot(dx,dz));
 }
 apply(){const c=this.camera;c.mode='live';c.position.set(this.position);c.yaw=this.yaw;c.pitch=this.pitch;c.roll=0;c.fov=this.fov;c.invalidate();}
}
