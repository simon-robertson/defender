import {CameraAnticipation} from './camera-anticipation.js';
import {TerrainField} from '../shared/terrain.js';
import {DroneObstacles} from '../engine/drone-obstacles.js';

// Scale velocity, acceleration and jerk together to preserve the eased motion
// at twice its previous pace. Scene holds and the simulation clock stay real-time.
export const DRONE_CAMERA_MOTION_RATE=2;
export const DRONE_CAMERA_RADIUS=2.5,DRONE_CAMERA_SPEED=34*DRONE_CAMERA_MOTION_RATE,DRONE_CAMERA_ACCELERATION=24*DRONE_CAMERA_MOTION_RATE**2,DRONE_CAMERA_MIN_FOV=2*Math.atan(Math.tan(42*Math.PI/360)/.8)*180/Math.PI;
export const DRONE_CAMERA_MAX_FILM_PITCH=Math.PI/4;
export const DRONE_CAMERA_BOARD_MARGIN=240;
const MIN_STANDOFF=168,PREFERRED_STANDOFF=192,VIEW_SLOPE=Math.tan(38*Math.PI/180),MAX_VIEW_SLOPE=Math.tan(DRONE_CAMERA_MAX_FILM_PITCH);
const DRIFT_SPEED=.65*DRONE_CAMERA_MOTION_RATE,DRIFT_RADIUS=6,DRIFT_RATE=DRIFT_SPEED/DRIFT_RADIUS,JERK=48*DRONE_CAMERA_MOTION_RATE**3;
const YAW_SPEED=1.1*DRONE_CAMERA_MOTION_RATE,PITCH_SPEED=.7*DRONE_CAMERA_MOTION_RATE,YAW_ACCELERATION=1.8*DRONE_CAMERA_MOTION_RATE**2,PITCH_ACCELERATION=1.2*DRONE_CAMERA_MOTION_RATE**2;
const TICK=1/120,PLAN_SECONDS=.8,R=DRONE_CAMERA_RADIUS,EMPTY=Object.freeze([]),HEIGHTS=Object.freeze([120,184,152]);
const COMPOSITION_SUBJECTS=12,COMPOSITION_ENEMIES=8,LOW_HEIGHTS=Object.freeze([40,56]);
const ACTIVITY_SLOTS=24,ACTIVITY_RADIUS=60,ACTIVITY_SECONDS=5,ACTIVITY_DECAY=2,SCENE_RADIUS=84,SCENE_HOLD=4,CHALLENGE_SECONDS=.6;
const FOCUS_PRIORITY=Object.freeze({none:-1,enemy:0,defence:1,anticipation:2,combat:3});
function clipDistance(points,k,plane,near,far){const depth=points[k+2];return plane<4?depth+(plane&1?-1:1)*points[k+(plane>>1)]:plane===4?depth-near:far-depth;}
function put(out,x,y,z,k=0){out[k]=x;out[k+1]=y;out[k+2]=z;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const running=phase=>phase==='wave'||phase==='settling';
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

// A camera, not a combat drone. Its navigation only reads scene/actor geometry.
// Every filming destination has an open sky column. When a direct transition is
// obstructed, a three-leg climb/cruise/descent stays above the static canopy.
export class DroneCamera {
 constructor(camera,{random=Math.random}={}){
  this.random=random;this.entries=0;this.relocations=0;this.shotSeconds=6;
  this.camera=camera;this.anticipation=new CameraAnticipation({speed:DRONE_CAMERA_SPEED,standoff:PREFERRED_STANDOFF});this.world=null;this.obstacles=null;this.obstacleEngine=null;this.emergency=false;this.airLanes=null;this.airborneFloor=null;this.water=null;this.enabled=this.active=false;
  this.velocity=new Float64Array(3);this.acceleration=new Float64Array(3);this.desiredVelocity=new Float64Array(3);this.driftAnchor=new Float64Array(3);this.drifting=false;this.driftPhase=0;this.yawVelocity=this.pitchVelocity=this.fovVelocity=0;this.blockedMoves=0;this.saved=new Float64Array(6);this.position=new Float64Array(3);this.focus=new Float64Array(3);this.look=new Float64Array(3);this.goal=new Float64Array(3);this.route=new Float64Array(9);this.scratch=new Float64Array(6);this.lastBattle=new Float64Array(3);
  this.compositionStates=new Array(COMPOSITION_SUBJECTS).fill(null);this.compositionBounds=new Float64Array(COMPOSITION_SUBJECTS*6);this.projectedSubjects=new Float64Array(COMPOSITION_SUBJECTS*4);this.compositionCount=0;this.compositionEngine=null;this.composition=0;this.compositionReframes=0;this.lowShot=this.lowArrived=false;this.lowPendingUntil=-Infinity;this.nextLowAt=24;this.lowPlans=this.lowShots=0;
  this.boardClipA=new Float64Array(80);this.boardClipB=new Float64Array(80);this.levelInView=this.contextReframes=0;
  this.subject=null;this.subjectSince=0;this.engineTime=null;this.phase=null;this.time=this.accumulator=this.speed=this.travelled=this.plans=this.planIn=this.heldFor=this.flinch=this.explosions=0;
  this.activity=new Float64Array(ACTIVITY_SLOTS*5);this.activityWeights=new Float64Array(ACTIVITY_SLOTS);this.activityFocus=new Float64Array(3);this.candidateFocus=new Float64Array(3);this.challengeFocus=new Float64Array(3);this.activitySlot=-1;this.focusKind='none';this.interest=null;this.nextSubjectAt=0;this.challengeKind=null;this.challengeSince=0;this.forecastAt=-Infinity;
  this.sceneExposure=0;this.latestActivityAt=-Infinity;
  this.routeLength=this.routeIndex=0;this.goalDuration=10;this.fov=64;this.yaw=this.pitch=this.panRoll=0;this.quality=0;this.visible=this.holding=false;this.battleAt=-Infinity;this.cruiseY=224;this.shotBand=-1;this.seed=1;
 }
 bind(world){
  this.leave();this.anticipation.reset();this.obstacles?.dispose();this.obstacles=null;this.obstacleEngine=null;this.emergency=false;this.airLanes=null;this.airborneFloor=null;this.world=world??null;this.water=null;
  this.subject=null;this.engineTime=null;this.time=this.accumulator=this.speed=this.travelled=this.plans=this.planIn=this.heldFor=this.flinch=this.explosions=0;this.battleAt=-Infinity;this.routeLength=this.routeIndex=0;this.focus.fill(0);this.velocity.fill(0);this.acceleration.fill(0);this.desiredVelocity.fill(0);this.drifting=false;this.yawVelocity=this.pitchVelocity=this.fovVelocity=0;this.blockedMoves=0;
  this.resetFocus();
  this.compositionStates.fill(null);this.compositionCount=0;this.compositionEngine=null;this.composition=0;this.compositionReframes=0;this.lowShot=this.lowArrived=false;this.lowPendingUntil=-Infinity;this.nextLowAt=24;this.lowPlans=this.lowShots=0;
  this.levelInView=this.contextReframes=0;
  if(!world)return;
  const field=new TerrainField(world.level);this.water=new Float32Array(world.level.size[0]*world.level.size[1]);
  for(let z=0;z<world.level.size[1];z++)for(let x=0;x<world.level.size[0];x++)this.water[z*world.level.size[0]+x]=field.height(x*24,z*24,true);
  this.cruiseY=Math.max(world.level.pathHeight+200,(world.visibility?.bounds?.[4]??0)+24);
  let seed=2166136261;for(const c of world.level.id??'drone')seed=Math.imul(seed^c.charCodeAt(0),16777619);this.seed=((seed>>>0)/4294967296+this.random())*Math.PI*2;this.entries=0;this.relocations=0;this.shotSeconds=5+this.random()*3;
 }
 setEnabled(enabled){this.enabled=Boolean(enabled);if(!this.enabled)this.leave();return this.enabled;}
 leave(){
  if(!this.active)return;
  this.anticipation.reset();
  const c=this.camera;c.mode='overview';c.target.set(this.saved.subarray(0,3));c.yaw=this.saved[3];c.pitch=this.saved[4];c.radius=this.saved[5];c.roll=0;c.setControlsEnabled(true);c.invalidate();
  this.active=false;this.resetFocus();this.compositionStates.fill(null);this.compositionCount=0;this.compositionEngine=null;this.velocity.fill(0);this.acceleration.fill(0);this.drifting=false;this.yawVelocity=this.pitchVelocity=this.fovVelocity=0;this.speed=this.flinch=this.panRoll=0;this.holding=false;this.engineTime=null;this.accumulator=0;this.routeLength=this.routeIndex=0;
 }
 refresh(){this.leave();this.resetFocus();this.anticipation.reset();this.obstacles?.dispose();this.obstacles=null;this.obstacleEngine=null;this.airLanes=null;}
 resetFocus(){this.activity.fill(0);this.activityWeights.fill(0);this.activitySlot=-1;this.focusKind='none';this.subject=this.interest=this.challengeKind=null;this.nextSubjectAt=0;this.subjectSince=-Infinity;this.forecastAt=-Infinity;this.sceneExposure=0;this.latestActivityAt=-Infinity;}
 validSubject(target){return target?.phase==='active'&&target.health?.alive!==false;}
 noteActivity(x,y,z,at,weight=1){
  if(!this.world||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(at))return;
  const events=this.activity;let slot=-1,oldest=Infinity,matched=false;
  for(let k=0;k<events.length;k+=5){
   const age=at-events[k+4];
   if(events[k+3]>0&&age>=0&&age<ACTIVITY_SECONDS&&(events[k]-x)**2+(events[k+2]-z)**2<ACTIVITY_RADIUS**2){slot=k;matched=true;break;}
   if(events[k+4]<oldest||events[k+3]===0){oldest=events[k+4];slot=k;}
  }
  const retained=matched?events[slot+3]*Math.exp(-(at-events[slot+4])/ACTIVITY_DECAY):0;
  const total=retained+weight;
  events[slot]=(events[slot]*retained+x*weight)/total;events[slot+1]=(events[slot+1]*retained+y*weight)/total;events[slot+2]=(events[slot+2]*retained+z*weight)/total;events[slot+3]=Math.min(24,total);events[slot+4]=at;
 }
 // Neighbouring impact cells form one encounter. A shot cadence, kill or
 // recycled activity slot is not a new filming destination.
 sampleActivity(x,z,out){
  let total=0,px=0,py=0,pz=0;this.latestActivityAt=-Infinity;
  for(let n=0;n<ACTIVITY_SLOTS;n++){
   const k=n*5,d=(this.activity[k]-x)**2+(this.activity[k+2]-z)**2;
   if(!this.activityWeights[n]||d>=SCENE_RADIUS**2)continue;
   const weight=this.activityWeights[n]*(1-d/SCENE_RADIUS**2);total+=weight;
   this.latestActivityAt=Math.max(this.latestActivityAt,this.activity[k+4]);
   px+=this.activity[k]*weight;py+=this.activity[k+1]*weight;pz+=this.activity[k+2]*weight;
  }
  if(total)put(out,px/total,py/total,pz/total);return total;
 }
 localSubject(targets){
  if(this.validSubject(this.subject)&&(this.subject.x-this.activityFocus[0])**2+(this.subject.z-this.activityFocus[2])**2<=SCENE_RADIUS**2)return;
  this.subject=null;let nearest=SCENE_RADIUS**2;
  for(const target of targets)if(this.validSubject(target)){const d=(target.x-this.activityFocus[0])**2+(target.z-this.activityFocus[2])**2;if(d<nearest){nearest=d;this.subject=target;}}
 }
 chooseSubject(engine){
  if(this.time<this.nextSubjectAt)return;this.nextSubjectAt=this.time+.3;
  const targets=engine.enemies?.activeTargets??EMPTY,guns=engine.firing?.states??EMPTY,events=this.activity,point=this.candidateFocus;
  for(let n=0;n<ACTIVITY_SLOTS;n++){const k=n*5,age=engine.time-events[k+4];this.activityWeights[n]=age>=0&&age<ACTIVITY_SECONDS?events[k+3]*Math.exp(-age/ACTIVITY_DECAY):0;}
  const currentScore=this.focusKind==='combat'?this.sampleActivity(this.activityFocus[0],this.activityFocus[2],point):0;
  const cx=point[0],cy=point[1],cz=point[2],currentAt=this.latestActivityAt;
  let slot=-1,score=.15,bx=0,by=0,bz=0,target=null,interest=null,kind='none';
  let alternate=-1,alternateScore=.15,ax=0,ay=0,az=0;
  for(let n=0;n<ACTIVITY_SLOTS;n++){
   if(!this.activityWeights[n])continue;
   const k=n*5,value=this.sampleActivity(events[k],events[k+2],point);
   if(value>score){score=value;slot=k;bx=point[0];by=point[1];bz=point[2];}
   if(value>alternateScore&&engine.time-this.latestActivityAt<=.9&&(point[0]-this.activityFocus[0])**2+(point[2]-this.activityFocus[2])**2>SCENE_RADIUS**2){alternateScore=value;alternate=k;ax=point[0];ay=point[1];az=point[2];}
  }
  if(slot>=0)kind='combat';
  else if(this.anticipation.active){kind='anticipation';target=this.anticipation.target;[bx,by,bz]=this.anticipation.focus;}
  else{
   let nearest=Infinity;
   for(const gun of guns)for(const enemy of targets)if(this.validSubject(enemy)){const d=(enemy.x-gun.x)**2+(enemy.z-gun.z)**2;if(d<nearest){nearest=d;interest=gun;}}
   if(interest){kind='defence';bx=interest.x;by=(interest.rig?.root[13]??this.world.level.pathHeight)+18;bz=interest.z;}
   else{
    target=this.validSubject(this.subject)?this.subject:null;
    if(!target){let distance=Infinity;for(const enemy of targets)if(this.validSubject(enemy)){const d=(enemy.x-this.position[0])**2+(enemy.z-this.position[2])**2;if(d<distance){distance=d;target=enemy;}}}
    if(target){kind='enemy';bx=target.aimX??target.x;by=target.aimY??target.y??this.world.level.pathHeight+8;bz=target.aimZ??target.z;}
   }
  }
  const live=this.focusKind==='combat'?currentScore>.15:this.focusKind==='anticipation'?(this.validSubject(this.subject)||this.subject?.phase==='scheduled')&&engine.time<=this.forecastAt+1.5:this.focusKind==='defence'?guns.includes(this.interest):this.validSubject(this.subject);
  let handover=false,confirmation=CHALLENGE_SECONDS;
  if(this.focusKind==='combat'&&alternate>=0){
   const quiet=engine.time-currentAt>.9,burst=alternateScore>currentScore*2+.3,unseenTooLong=this.time-this.subjectSince>=8;
   // Count time actually seen, rather than time spent travelling toward it.
   // An older shot yields to comparable action; a fresh burst wins sooner.
   const older=this.sceneExposure>=5.5||unseenTooLong,ratio=quiet ? .5 : older ? .65 : this.sceneExposure>=3.5 ? .9 : 1.12;
   const seenEnough=this.sceneExposure>=((quiet||burst) ? .6 : 1.5)||!live||unseenTooLong;
   if(seenEnough&&alternateScore>=currentScore*ratio+.08){
    kind='combat';slot=alternate;score=alternateScore;bx=ax;by=ay;bz=az;target=interest=null;handover=true;
    if(quiet||burst)confirmation=.3;
   }
  }
  const sameArea=(bx-this.activityFocus[0])**2+(bz-this.activityFocus[2])**2<=SCENE_RADIUS**2;
  const holdCombat=this.focusKind==='combat'&&live&&(kind!=='combat'||sameArea||!handover);
  const holdOther=this.focusKind!=='none'&&live&&kind!=='combat'&&(FOCUS_PRIORITY[kind]<FOCUS_PRIORITY[this.focusKind]||this.time-this.subjectSince<SCENE_HOLD||kind===this.focusKind&&sameArea);
  if(kind==='none'||holdCombat||holdOther){
   this.challengeKind=null;
   if(this.focusKind==='combat'){if(currentScore>.15)put(this.activityFocus,cx,cy,cz);this.localSubject(targets);}
   return;
  }
  const immediate=this.focusKind==='none'||kind==='combat'&&this.focusKind!=='combat';
  if(!immediate){
   if(this.challengeKind!==kind||(bx-this.challengeFocus[0])**2+(bz-this.challengeFocus[2])**2>60**2){this.challengeKind=kind;put(this.challengeFocus,bx,by,bz);this.challengeSince=this.time;return;}
   if(this.time-this.challengeSince+1e-9<confirmation)return;
  }
  this.focusKind=kind;this.activitySlot=slot;this.subject=target;this.interest=interest;this.subjectSince=this.time;this.challengeKind=null;
  this.sceneExposure=0;
  this.forecastAt=kind==='anticipation'?this.anticipation.at:-Infinity;put(this.activityFocus,bx,by,bz);
  if(kind==='combat')this.localSubject(targets);
  // Reconsider composition without discarding a still-readable flight route.
  this.planIn=0;
 }
 compose(engine,dt=0){
  if(this.focusKind==='none')return;
  let x=this.activityFocus[0],y=this.activityFocus[1],z=this.activityFocus[2];
  if(this.focusKind==='defence'&&this.interest){x=this.interest.x;y=(this.interest.rig?.root[13]??this.world.level.pathHeight)+18;z=this.interest.z;}
  else if(this.focusKind==='enemy'&&this.validSubject(this.subject)){x=this.subject.aimX??this.subject.x;y=this.subject.aimY??this.subject.y??this.world.level.pathHeight+8;z=this.subject.aimZ??this.subject.z;}
  if(!dt){put(this.focus,x,y,z);return;}
  const dx=x-this.focus[0],dy=y-this.focus[1],dz=z-this.focus[2],distance=Math.hypot(dx,dy,dz);
  if(distance<1.5)return;
  const blend=Math.min(1-Math.exp(-1.6*DRONE_CAMERA_MOTION_RATE*dt),40*DRONE_CAMERA_MOTION_RATE*dt/distance);
  this.focus[0]+=dx*blend;this.focus[1]+=dy*blend;this.focus[2]+=dz*blend;
 }
 sceneInView(){
  const dx=this.activityFocus[0]-this.position[0],dy=this.activityFocus[1]-this.position[1],dz=this.activityFocus[2]-this.position[2],sy=Math.sin(this.yaw),cy=Math.cos(this.yaw),sp=Math.sin(this.pitch),cp=Math.cos(this.pitch),depth=-dx*sy*cp-dy*sp-dz*cy*cp;
  if(depth<=0)return false;
  const tan=Math.tan(this.fov*Math.PI/360),aspect=(this.camera.canvas?.clientWidth??1500)/Math.max(1,this.camera.canvas?.clientHeight??1000);
  return Math.abs(dx*cy-dz*sy)<depth*tan*aspect*.7&&Math.abs(-dx*sy*sp+dy*cp-dz*cy*sp)<depth*tan*.7;
 }
 staticClear(ax,ay,az,bx,by,bz){
  const w=this.world;if(!w)return false;
  if(Math.min(ax,bx)<R-DRONE_CAMERA_BOARD_MARGIN||Math.min(az,bz)<R-DRONE_CAMERA_BOARD_MARGIN||Math.max(ax,bx)>w.width+DRONE_CAMERA_BOARD_MARGIN-R||Math.max(az,bz)>w.length+DRONE_CAMERA_BOARD_MARGIN-R)return false;
  const tree=w.visibility;if(!tree?.bounds)return false;
  for(let node=0;node<tree.nodeCount;){
   if(hits(tree.bounds,node*6,ax,ay,az,bx,by,bz)){if(tree.escape[node]===node+1)return false;node++;}else node=tree.escape[node];
  }
  // Reserve the complete authored airborne lanes, including future spawns.
  // A camera must not descend into a flight lane and wait for a Moth to arrive.
  for(let k=0;k<(this.airLanes?.length??0);k+=6)if(hits(this.airLanes,k,ax,ay,az,bx,by,bz))return false;
  // The visibility BVH contains solid ground/decks; water needs its own slab.
  const cols=w.level.size[0],rows=w.level.size[1],box=this.scratch;
  for(let z=Math.max(0,Math.floor((Math.min(az,bz)-R)/24));z<=Math.min(rows-1,Math.floor((Math.max(az,bz)+R)/24));z++)for(let x=Math.max(0,Math.floor((Math.min(ax,bx)-R)/24));x<=Math.min(cols-1,Math.floor((Math.max(ax,bx)+R)/24));x++){
   const height=this.water[z*cols+x];if(!height)continue;box[0]=x*24;box[1]=0;box[2]=z*24;box[3]=(x+1)*24;box[4]=height;box[5]=(z+1)*24;if(hits(box,0,ax,ay,az,bx,by,bz))return false;
  }
  return true;
 }
 clear(ax,ay,az,bx,by,bz,horizon=.8){return this.staticClear(ax,ay,az,bx,by,bz)&&(!this.obstacles||this.obstacles.clearSegment(ax,ay,az,bx,by,bz,R,horizon));}
 columnClear(x,y,z){return this.clear(x,y,z,x,this.cruiseY,z);}
 separation(x,y,z){
  for(const target of this.obstacleEngine?.activeTargets??EMPTY){if(!this.validSubject(target))continue;const horizontal=Math.hypot(x-target.x,z-target.z),vertical=Math.abs(y-(target.aimY??target.y));if(Math.hypot(horizontal,vertical)<150||horizontal<132&&vertical<112)return false;}
  if(this.focusKind==='anticipation'&&this.anticipation.active&&this.anticipation.target===this.subject){const f=this.anticipation.point,h=Math.hypot(x-f[0],z-f[2]),v=Math.abs(y-f[1]);if(Math.hypot(h,v)<150||h<132&&v<112)return false;}
  return true;
 }
 shotQuality(x,y,z){
  const f=this.focus,tree=this.world.visibility,dx=f[0]-x,dy=f[1]-y,dz=f[2]-z,h=Math.hypot(dx,dz),distance=Math.hypot(dx,dy,dz);
  if(distance<1||h<1||!tree.clear(x,y,z,f[0],f[1],f[2]))return 0;
  const rx=dz/h,rz=-dx/h,ux=-dx*dy/(distance*h),uy=h/distance,uz=-dz*dy/(distance*h);let action=1,foreground=0;
  for(let i=0;i<4;i++){const side=i===0?-15:i===1?15:0,up=i===2?14:i===3?-5:0;if(tree.clear(x,y,z,f[0]+rx*side,f[1]+up,f[2]+rz*side))action++;}
  const near=Math.min(42,distance*.6),scale=near/distance,tan=Math.tan(60*Math.PI/360),aspect=clamp((this.camera.canvas?.clientWidth??1500)/Math.max(1,this.camera.canvas?.clientHeight??1000),.6,2.5);
  for(let row=-1;row<=1;row++)for(let col=-1;col<=1;col++){const side=col*near*tan*aspect*.65,up=row*near*tan*.65;if(tree.clear(x,y,z,x+dx*scale+rx*side+ux*up,y+dy*scale+uy*up,z+dz*scale+rz*side+uz*up))foreground++;}
  return action/5*.6+foreground/9*.4;
 }
 gatherComposition(engine=this.compositionEngine){
  const states=this.compositionStates,f=this.focus,primary=this.validSubject(this.subject);states.fill(null);let count=0;
  if(primary)states[count++]=this.subject;
  // Keep the subject plus the seven nearest actors in the local encounter.
  // A large wave cannot grow the projection/pair budget or crowd out its guns.
  for(const target of engine?.enemies?.activeTargets??EMPTY){
   if(!this.validSubject(target)||target===this.subject)continue;
   const distance=(target.x-f[0])**2+(target.z-f[2])**2;if(distance>144**2)continue;
   let at=primary?1:0;while(at<count&&(states[at].x-f[0])**2+(states[at].z-f[2])**2<=distance)at++;
   if(at>=COMPOSITION_ENEMIES)continue;for(let i=Math.min(count,COMPOSITION_ENEMIES-1);i>at;i--)states[i]=states[i-1];states[at]=target;count=Math.min(COMPOSITION_ENEMIES,count+1);
  }
  // Actual participants are more useful context than an arbitrary idle arsenal.
  for(let pass=0;pass<2;pass++)for(const gun of engine?.firing?.states??EMPTY){
   if(count===COMPOSITION_SUBJECTS)break;
   if(!gun.lineOfSight||!this.validSubject(gun.target)||(gun.target===this.subject)!==(pass===0)||Math.hypot(gun.target.x-f[0],gun.target.z-f[2])>144)continue;
   if(!states.includes(gun))states[count++]=gun;
  }
  this.compositionCount=count;
  for(let i=0;i<count;i++){
   const state=states[i],k=i*6,b=this.compositionBounds;let found=false;
   for(let n=0;n<(this.obstacles?.records?.length??0);n++){const record=this.obstacles.records[n];if(record.state!==state&&record.id!==state.id)continue;const source=this.obstacles.actorCurrent,j=n*6;if(!source||!Number.isFinite(source[j])||source[j]>source[j+3])continue;for(let axis=0;axis<6;axis++)b[k+axis]=source[j+axis];found=true;break;}
   if(found)continue;
   const enemy=this.validSubject(state),x=state.aimX??state.x,z=state.aimZ??state.z,y=enemy?(state.aimY??state.y??this.world.level.pathHeight+8):(state.rig?.root[13]??this.world.level.pathHeight)+14,r=enemy?10:12;
   b[k]=x-r;b[k+1]=y-(enemy?10:14);b[k+2]=z-r;b[k+3]=x+r;b[k+4]=y+(enemy?10:16);b[k+5]=z+r;
  }
 }
 compositionCost(x,y,z){
  const count=this.compositionCount;if(count<2)return 0;
  const f=this.focus,dx=f[0]-x,dy=f[1]-y,dz=f[2]-z,h=Math.hypot(dx,dz),distance=Math.hypot(dx,dy,dz);if(h<1||distance<1)return 2;
  // Same perspective basis, vertical FOV and aspect as Camera.update(). Use
  // all eight live model-AABB corners, rather than horizontal world distances.
  const rx=-dz/h,rz=dx/h,ux=-dx*dy/(distance*h),uy=h/distance,uz=-dz*dy/(distance*h),fx=dx/distance,fy=dy/distance,fz=dz/distance,tan=Math.tan(this.fov*Math.PI/360),aspect=Math.max(.01,(this.camera.canvas?.clientWidth??1500)/Math.max(1,this.camera.canvas?.clientHeight??1000)),bounds=this.compositionBounds,out=this.projectedSubjects;
  let clipping=0,left=Infinity,right=-Infinity;
  for(let i=0;i<count;i++){
   const k=i*6,j=i*4;out[j]=out[j+1]=Infinity;out[j+2]=out[j+3]=-Infinity;
   for(let corner=0;corner<8;corner++){
    const ax=bounds[k+(corner&1?3:0)]-x,ay=bounds[k+1+(corner&2?3:0)]-y,az=bounds[k+2+(corner&4?3:0)]-z,depth=ax*fx+ay*fy+az*fz;
    if(depth<=1){clipping+=1/count;continue;}
    const px=(ax*rx+az*rz)/(depth*tan*aspect),py=(ax*ux+ay*uy+az*uz)/(depth*tan);out[j]=Math.min(out[j],px);out[j+1]=Math.min(out[j+1],py);out[j+2]=Math.max(out[j+2],px);out[j+3]=Math.max(out[j+3],py);
   }
   if(!Number.isFinite(out[j]))return 2;
   clipping+=clamp(Math.max(0,-.9-out[j],out[j+2]-.9,-.86-out[j+1],out[j+3]-.86),0,1)/count;
   left=Math.min(left,out[j]);right=Math.max(right,out[j+2]);
  }
  let pairs=0,weights=0,worst=0;
  for(let i=0;i<count;i++)for(let n=i+1;n<count;n++){
   const a=i*4,b=n*4,aw=out[a+2]-out[a],ah=out[a+3]-out[a+1],bw=out[b+2]-out[b],bh=out[b+3]-out[b+1],overlap=Math.max(0,Math.min(out[a+2],out[b+2])-Math.max(out[a],out[b]))*Math.max(0,Math.min(out[a+3],out[b+3])-Math.max(out[a+1],out[b+1]))/Math.max(.0001,Math.min(aw*ah,bw*bh));
   // Nearby silhouettes directly above one another also read as a stack even
   // when their rectangles narrowly miss; a little horizontal space fixes it.
   const sx=Math.abs(out[a]+out[a+2]-out[b]-out[b+2])*.5,sy=Math.abs(out[a+1]+out[a+3]-out[b+1]-out[b+3])*.5,stack=clamp(1-sx/((aw+bw)*.5+.08),0,1)*clamp(1-sy/((ah+bh)*.5+.35),0,1),value=overlap*.7+stack*.3,weight=i===0?2:1;
   pairs+=value*weight;weights+=weight;worst=Math.max(worst,value);
  }
  return clipping*.8+pairs/weights*.7+worst*.3+Math.max(0,.45-(right-left))*.12;
 }
 boardCoverage(x,y,z){
  const f=this.focus,dx=f[0]-x,dy=f[1]-y,dz=f[2]-z,h=Math.hypot(dx,dz),distance=Math.hypot(dx,dy,dz);
  if(h<1||distance<1||!this.world)return 0;
  const width=this.world.width,length=this.world.length,ground=this.world.level.pathHeight,rx=-dz/h,rz=dx/h,ux=-dx*dy/(distance*h),uy=h/distance,uz=-dz*dy/(distance*h),fx=dx/distance,fy=dy/distance,fz=dz/distance,tan=Math.tan(this.fov*Math.PI/360),aspect=Math.max(.01,(this.camera.canvas?.clientWidth??1500)/Math.max(1,this.camera.canvas?.clientHeight??1000)),near=this.camera.near??.1,far=this.camera.far??2200;
  let points=this.boardClipA,out=this.boardClipB,count=4;
  // Clip the board plane in homogeneous view coordinates, carrying its world
  // coordinates along. No ray traces, render targets or per-plan allocations.
  for(let n=0;n<4;n++){
   const k=n*5,wx=n===1||n===2?width:0,wz=n>=2?length:0,ax=wx-x,ay=ground-y,az=wz-z;
   points[k]=(ax*rx+az*rz)/(tan*aspect);points[k+1]=(ax*ux+ay*uy+az*uz)/tan;points[k+2]=ax*fx+ay*fy+az*fz;points[k+3]=wx;points[k+4]=wz;
  }
  for(let plane=0;plane<6;plane++){
   let size=0,previous=(count-1)*5,a=clipDistance(points,previous,plane,near,far);
   for(let n=0;n<count;n++){
    const k=n*5,b=clipDistance(points,k,plane,near,far);
    if((a>=0)!==(b>=0)){const t=a/(a-b);for(let axis=0;axis<5;axis++)out[size*5+axis]=points[previous+axis]+(points[k+axis]-points[previous+axis])*t;size++;}
    if(b>=0){for(let axis=0;axis<5;axis++)out[size*5+axis]=points[k+axis];size++;}
    previous=k;a=b;
   }
   if(size<3)return 0;
   const swap=points;points=out;out=swap;count=size;
  }
  let screenArea=0,worldArea=0;
  for(let n=0;n<count;n++){const a=n*5,b=((n+1)%count)*5;screenArea+=(points[a]*points[b+1]-points[b]*points[a+1])/(points[a+2]*points[b+2]);worldArea+=points[a+3]*points[b+4]-points[b+3]*points[a+4];}
  // Prefer seeing more of the actual level, with a secondary preference for
  // filling the viewport with board rather than scenery beyond its edge.
  return clamp(Math.abs(worldArea)/(2*width*length)*.65+Math.abs(screenArea)/8*.35,0,1);
 }
 altitude(layer){return this.airborneFloor===null?this.world.level.pathHeight+HEIGHTS[layer]:Math.max(this.world.level.pathHeight+HEIGHTS[layer],this.airborneFloor+(layer===1?48:layer===2?24:0));}
 viewDistance(y){return Math.max(PREFERRED_STANDOFF,Math.max(0,y-this.focus[1])/VIEW_SLOPE+16);}
 viewFits(x,y,z,margin=0){return Math.hypot(x-this.focus[0],z-this.focus[2])>=Math.max(MIN_STANDOFF,Math.max(0,y-this.focus[1])/MAX_VIEW_SLOPE)+margin;}
 viewTravelCost(x,y,z){
  // Prefer approaches that skirt the action instead of flying across it.
  const p=this.position,f=this.focus,dx=x-p[0],dz=z-p[2],t=clamp(((f[0]-p[0])*dx+(f[2]-p[2])*dz)/(dx*dx+dz*dz||1),0,1),height=p[1]+(y-p[1])*t;
  return Math.max(0,Math.max(MIN_STANDOFF,Math.max(0,height-f[1])/MAX_VIEW_SLOPE)-Math.hypot(p[0]+dx*t-f[0],p[2]+dz*t-f[2]))*3;
 }
 routeTo(x,y,z){
  if(this.active&&y<this.world.level.pathHeight+32)return false;
  const p=this.position;this.routeLength=this.routeIndex=0;
  if(this.clear(p[0],p[1],p[2],x,y,z)){
   // Certify the sky above the whole straight corridor, preserving the escape
   // column invariant even if a moving actor invalidates this flight later.
   const low=Math.min(p[1],y),box=this.scratch;box[0]=Math.min(p[0],x)-R;box[1]=low-R;box[2]=Math.min(p[2],z)-R;box[3]=Math.max(p[0],x)+R;box[4]=this.cruiseY+R;box[5]=Math.max(p[2],z)+R;
   let blocked=false;const tree=this.world.visibility;
   for(let node=0;node<tree.nodeCount;){const k=node*6,b=tree.bounds;if(box[0]<=b[k+3]&&box[3]>=b[k]&&box[1]<=b[k+4]&&box[4]>=b[k+1]&&box[2]<=b[k+5]&&box[5]>=b[k+2]){if(tree.escape[node]===node+1){blocked=true;break;}node++;}else node=tree.escape[node];}
   for(let k=0;!blocked&&k<(this.airLanes?.length??0);k+=6){const b=this.airLanes;if(box[0]<=b[k+3]&&box[3]>=b[k]&&box[1]<=b[k+4]&&box[4]>=b[k+1]&&box[2]<=b[k+5]&&box[5]>=b[k+2])blocked=true;}
   if(!blocked){put(this.route,x,y,z);this.routeLength=1;return true;}
  }
  if(!this.columnClear(p[0],p[1],p[2])||!this.columnClear(x,y,z)||!this.clear(p[0],this.cruiseY,p[2],x,this.cruiseY,z))return false;
  put(this.route,p[0],this.cruiseY,p[2]);put(this.route,x,this.cruiseY,z,3);put(this.route,x,y,z,6);this.routeLength=3;return true;
 }
 vantage(){
  if(this.emergency&&this.routeIndex<this.routeLength)return true;
  this.gatherComposition();
  const p=this.position,f=this.focus,d=Math.hypot(p[0]-f[0],p[2]-f[2]);this.quality=this.shotQuality(p[0],p[1],p[2]);this.composition=this.compositionCost(p[0],p[1],p[2]);this.levelInView=this.boardCoverage(...p);this.visible=this.quality>=.8;this.plans++;
  const safe=this.clear(p[0],p[1],p[2],p[0],p[1],p[2])&&this.separation(p[0],p[1],p[2]),usable=this.quality>=.84&&this.viewFits(...p)&&d<=this.viewDistance(p[1])+72&&p[1]>=(this.lowShot?this.world.level.pathHeight+32:this.altitude(0))&&safe;
  // A readable shot gets a short hold, then a fresh angle even for a still
  // subject. Keep the selected journey committed until arrival.
  const band=Math.floor(this.time/9)%3,settled=usable&&this.routeIndex>=this.routeLength,timed=settled&&this.heldFor>=this.shotSeconds,unstack=settled&&this.heldFor>=2.5&&this.composition>.22,broaden=settled&&this.heldFor>=3&&this.levelInView<.65,relocate=timed||unstack||broaden;
  // Subject changes can prevent a wave from ever accumulating several timed
  // holds. Offer an occasional low view on the simulation clock instead, and
  // retain its intent briefly if an encounter changes during the approach.
  if(!this.lowShot&&this.time>=this.nextLowAt&&this.lowPendingUntil<this.time){this.lowPendingUntil=this.time+24;this.nextLowAt=this.time+40;}
  const lowOpportunity=this.time<this.lowPendingUntil,desiredY=lowOpportunity?this.world.level.pathHeight+40:this.altitude(band);
  if(usable&&!relocate&&!lowOpportunity&&this.routeIndex>=this.routeLength){this.routeLength=this.routeIndex=0;this.holding=true;return true;}
  this.holding=false;
  if(this.routeIndex<this.routeLength&&this.time-this.goalSince<this.goalDuration&&this.viewFits(...this.goal)&&this.shotQuality(this.goal[0],this.goal[1],this.goal[2])>=.85&&Math.hypot(this.goal[0]-f[0],this.goal[2]-f[2])<this.viewDistance(this.goal[1])+80)return true;
  let best=Infinity,bx=0,by=0,bz=0,selectedLow=false;
  const desiredAngle=Math.atan2(p[0]-f[0],p[2]-f[2])+(this.relocations%2?-1:1)*Math.PI/3;
  // Usually 72 high candidates; an occasional low opportunity also tries 48
  // low ones. A blocked low opportunity falls back to the normal high profile.
  for(let layer=0;layer<(lowOpportunity?5:3);layer++)for(let i=0;i<24;i++){
   const low=layer>=3,a=this.seed+i*Math.PI/12,y=low?this.world.level.pathHeight+LOW_HEIGHTS[layer-3]:this.altitude(layer),span=this.viewDistance(y)+(layer===1?16:0),x=clamp(f[0]+Math.sin(a)*span,R+1-DRONE_CAMERA_BOARD_MARGIN,this.world.width+DRONE_CAMERA_BOARD_MARGIN-R-1),z=clamp(f[2]+Math.cos(a)*span,R+1-DRONE_CAMERA_BOARD_MARGIN,this.world.length+DRONE_CAMERA_BOARD_MARGIN-R-1);
   const horizontal=Math.hypot(x-f[0],z-f[2]);if(!this.viewFits(x,y,z,8)||!this.separation(x,y,z)||!this.columnClear(x,y,z))continue;
   // A low descent is itself a fresh perspective; favor a nearby safe column
   // instead of requiring another long orbit before it can reach the ground.
   if(relocate&&!low&&(Math.hypot(x-p[0],z-p[2])<64||Math.abs(angle(Math.atan2(x-f[0],z-f[2]),Math.atan2(p[0]-f[0],p[2]-f[2])))<.4))continue;
   const quality=this.shotQuality(x,y,z);if(quality<.86)continue;
   const composition=this.compositionCost(x,y,z);if(unstack&&!timed&&composition>this.composition-.08)continue;
   const coverage=this.boardCoverage(x,y,z);
   if(broaden&&!timed&&!unstack&&(coverage<this.levelInView+.12||composition>this.composition+.04||quality<this.quality-.04))continue;
   const preferredAngle=low?Math.atan2(p[0]-f[0],p[2]-f[2]):desiredAngle,score=(timed?Math.abs(angle(Math.atan2(x-f[0],z-f[2]),preferredAngle))*90:0)+Math.hypot(x-p[0],y-p[1],z-p[2])*.42+this.viewTravelCost(x,y,z)+Math.abs(y-desiredY)*1.2+(1-quality)*100+Math.abs(horizontal-span)*.2+composition*220-coverage*190;
   if(score<best){best=score;bx=x;by=y;bz=z;selectedLow=low;}
  }
  if(best<Infinity&&this.routeTo(bx,by,bz)){
   let length=0,ax=p[0],ay=p[1],az=p[2];for(let n=0;n<this.routeLength;n++){const k=n*3;length+=Math.hypot(this.route[k]-ax,this.route[k+1]-ay,this.route[k+2]-az);ax=this.route[k];ay=this.route[k+1];az=this.route[k+2];}
   // Climb/cruise/descent may exceed the old ten-second commitment. Bound the
   // lease by this finite route's length with time for smooth turns/braking.
   this.goalDuration=Math.max(10,length/DRONE_CAMERA_SPEED*1.6+6);put(this.goal,bx,by,bz);this.goalSince=this.time;this.heldFor=0;this.shotBand=band;this.lowShot=selectedLow;this.lowArrived=false;if(selectedLow)this.lowPlans++;if(unstack&&!timed)this.compositionReframes++;if(broaden&&!timed&&!unstack)this.contextReframes++;if(timed){this.relocations++;this.shotSeconds=5+this.random()*3;}return true;
  }
  if(usable){this.holding=true;return true;}
  // A blocked view or encroaching actor can request a safe vertical retreat.
  if(!usable&&(this.quality<.84||!safe)&&p[1]<this.cruiseY-1&&this.columnClear(p[0],p[1],p[2])){put(this.route,p[0],this.cruiseY,p[2]);this.routeLength=1;this.routeIndex=0;this.goal.set(this.route.subarray(0,3));this.goalSince=this.time;this.lowShot=this.lowArrived=false;}
  return false;
 }
 enter(engine){
  if(!this.world)return false;
  if(this.obstacles&&this.obstacleEngine!==engine.enemies){this.obstacles.dispose();this.obstacles=null;this.airLanes=null;}
  if(!this.obstacles){
   this.obstacleEngine=engine.enemies;const actors=new Map();for(const state of engine.enemies?.states??EMPTY){const rig=this.world.actors?.get(state.id);if(rig)actors.set(state.id,rig);}for(const state of engine.wildlife?.states??EMPTY){const rig=this.world.actors?.get(state.id);if(rig)actors.set(state.id,rig);}
   this.obstacles=new DroneObstacles({rigs:this.world.rigs,actors},engine.enemies?.states??EMPTY);this.obstacles.setWildlife(engine.wildlife?.states??EMPTY);
  }
  // A low camera needs time to climb with bounded acceleration/jerk before a
  // known bird flight reaches its height. The combat Drone keeps its default
  // one-second forecast; only this camera-owned analytic cache looks farther.
  this.obstacles.predictionSeconds=3;this.obstacles.update(0);this.compositionEngine=engine;
  if(!this.airLanes){
   this.airborneFloor=null;this.cruiseY=Math.max(this.world.level.pathHeight+200,(this.world.visibility?.bounds?.[4]??0)+24);
   const lanes=[],seen=new Set();
   for(let i=0;i<this.obstacles.records.length;i++){
    const record=this.obstacles.records[i],s=record.state,path=s?.path;if(!s?.airborne||!path?.x)continue;
    const k=i*6,b=this.obstacles.poseEnvelope,y=this.world.level.pathHeight+s.altitude-(s.movement?.crouch??0),low=y+b[k+1]-4,high=y+b[k+4]+4;
    // Normal high stations clear authored/actual flyer aim height and the
    // conservative lane top, including actors that have not spawned yet.
    // Low stations instead need a clear column outside these reserved lanes.
    const authoredAim=y+(s.aimOrigin?.[1]??0),highestAim=Math.max(authoredAim,Number.isFinite(s.aimY)?s.aimY:authoredAim);
    this.airborneFloor=Math.max(this.airborneFloor??0,Math.ceil(highestAim)+100,high+24);
    this.cruiseY=Math.max(this.cruiseY,high+24,this.airborneFloor+24);
    if(seen.has(s.model+':'+s.routeId))continue;seen.add(s.model+':'+s.routeId);let radius=0;
    for(let corner=0;corner<4;corner++)radius=Math.max(radius,Math.hypot(b[k+(corner&1?3:0)]-12,b[k+2+(corner&2?3:0)]-12));
    radius+=4;for(let n=1;n<path.x.length;n++)lanes.push(Math.min(path.x[n-1],path.x[n])-radius,low,Math.min(path.z[n-1],path.z[n])-radius,Math.max(path.x[n-1],path.x[n])+radius,high,Math.max(path.z[n-1],path.z[n])+radius);
   }
   this.airLanes=new Float64Array(lanes);
  }
  // Start inside the middle half of the map, with small cosmetic variation.
  // Widen if central stations lack safe clearance or a comfortable view angle.
  // Later action-driven filming retains its full range of stations.
  const initial=(engine.enemies?.activeTargets??EMPTY).find(s=>this.validSubject(s)),box=this.world.level.path[0];
  put(this.focus,initial?.aimX??initial?.x??(box[0]+.5)*24,initial?.aimY??this.world.level.pathHeight+8,initial?.aimZ??initial?.z??(box[2]+.5)*24);
  this.nextSubjectAt=0;this.chooseSubject(engine);this.compose(engine);
  if(this.focusKind==='none'&&Number.isFinite(this.battleAt))this.focus.set(this.lastBattle);
  const startAngle=this.seed+this.entries++*2.399963229728653,spread=Math.min(this.world.width,this.world.length)*.12,ax=this.world.width*.5+Math.sin(startAngle)*spread,az=this.world.length*.5+Math.cos(startAngle)*spread;
  let best=Infinity,sx=0,sz=0;
  for(let region=0;region<3&&best===Infinity;region++){
   const margin=region===2?DRONE_CAMERA_BOARD_MARGIN:0;
   for(let z=12-margin;z<this.world.length+margin;z+=24)for(let x=12-margin;x<this.world.width+margin;x+=24){
    if(region===0&&(x<this.world.width*.25||x>this.world.width*.75||z<this.world.length*.25||z>this.world.length*.75))continue;
    if(!this.viewFits(x,this.cruiseY,z,16)||!this.clear(x,this.cruiseY,z,x,this.cruiseY,z)||!this.separation(x,this.cruiseY,z))continue;
    const quality=this.shotQuality(x,this.cruiseY,z),score=(x-ax)**2+(z-az)**2+(1-quality)*100000;
    if(score<best){best=score;sx=x;sz=z;}
   }
  }
  if(best===Infinity)return false;
  this.emergency=false;this.lowShot=this.lowArrived=false;this.lowPendingUntil=-Infinity;this.nextLowAt=this.time+24;this.shotBand=-1;this.position.set([sx,this.cruiseY,sz]);this.velocity.fill(0);this.acceleration.fill(0);this.drifting=false;this.yawVelocity=this.pitchVelocity=this.fovVelocity=0;this.speed=this.accumulator=this.panRoll=0;this.heldFor=0;
  this.look.set(this.focus);this.yaw=Math.atan2(sx-this.look[0],sz-this.look[2]);this.pitch=clamp(Math.atan2(this.position[1]-this.look[1],Math.hypot(sx-this.look[0],sz-this.look[2])),-1.35,1.35);
  const c=this.camera;this.saved.set(c.target);this.saved[3]=c.yaw;this.saved[4]=c.pitch;this.saved[5]=c.radius;this.fov=64;
  this.active=true;this.engineTime=engine.time;this.planIn=PLAN_SECONDS;this.goalSince=-Infinity;this.vantage();c.setControlsEnabled(false);this.apply();return true;
 }
 sync(phase,engine){this.phase=phase;if(!this.enabled||!running(phase)||!this.world){const preparing=this.active&&(phase==='loadout'||phase==='deploy');this.leave();if(preparing)this.camera.frame();return false;}if(!this.active&&engine)this.enter(engine);return this.active;}
 noteExplosion(state,at=this.engineTime??0){
  if(!this.world||!state)return;const x=state.aimX??state.x,y=state.aimY??state.y,z=state.aimZ??state.z;if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return;
  this.noteActivity(x,y,z,at,3);
  this.lastBattle.set([x,y,z]);this.battleAt=at;if(!this.active)return;
  const distance=Math.hypot(x-this.position[0],y-this.position[1],z-this.position[2]);if(distance>=90)return;this.flinch=clamp(this.flinch+(1-distance/90)*.35,0,.5);this.explosions++;
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
  if(this.lowShot&&!this.lowArrived&&this.routeLength&&this.routeIndex>=this.routeLength&&this.goal[1]<=this.world.level.pathHeight+LOW_HEIGHTS[1]&&p[1]<=this.world.level.pathHeight+LOW_HEIGHTS[1]+6&&Math.abs(p[1]-this.goal[1])<6){this.lowArrived=true;this.lowShots++;this.lowPendingUntil=-Infinity;this.nextLowAt=Math.max(this.nextLowAt,this.time+24);}
  const travelling=this.phase==='wave'&&this.routeIndex<this.routeLength;
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
  // Keep the normal high station floor while above it. A low station or a
  // continuous climb back from one uses the lower safety floor without a snap.
  const highFloor=this.altitude(0),lowDrift=this.active&&!travelling&&p[1]<highFloor,floor=this.active?(this.lowShot||p[1]<highFloor?this.world.level.pathHeight+32:highFloor):-Infinity;
  if(Number.isFinite(floor)&&want[1]<0)want[1]=Math.max(want[1],-Math.max(0,p[1]-floor)*.6*DRONE_CAMERA_MOTION_RATE);
  // A critically damped velocity response with bounded acceleration change
  // keeps travel, braking and direction changes gradual rather than scalar snaps.
  let ax=(want[0]-v[0])*3*DRONE_CAMERA_MOTION_RATE,ay=(want[1]-v[1])*3*DRONE_CAMERA_MOTION_RATE,az=(want[2]-v[2])*3*DRONE_CAMERA_MOTION_RATE,amount=Math.hypot(ax,ay,az),scale=amount>DRONE_CAMERA_ACCELERATION?DRONE_CAMERA_ACCELERATION/amount:1;ax*=scale;ay*=scale;az*=scale;
  const jx=ax-a[0],jy=ay-a[1],jz=az-a[2],jerk=Math.hypot(jx,jy,jz),fraction=jerk>JERK*dt?JERK*dt/jerk:1;a[0]+=jx*fraction;a[1]+=jy*fraction;a[2]+=jz*fraction;
  for(let i=0;i<3;i++)v[i]+=a[i]*dt;
  const speed=Math.hypot(v[0],v[1],v[2]);if(speed>DRONE_CAMERA_SPEED)for(let i=0;i<3;i++)v[i]*=DRONE_CAMERA_SPEED/speed;
  const x=p[0]+v[0]*dt,y=Math.max(floor,p[1]+v[1]*dt),z=p[2]+v[2]*dt;
  if(y===floor&&v[1]<0){v[1]=0;a[1]=Math.max(0,a[1]);}
  if(this.clear(p[0],p[1],p[2],x,y,z,this.emergency?0:.5)&&(!lowDrift||this.staticClear(x,y,z,x,this.cruiseY,z))){
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
  const distance=Math.hypot(dx,dy,dz),aspect=clamp((this.camera.canvas?.clientWidth??1500)/Math.max(1,this.camera.canvas?.clientHeight??1000),.6,2.5);let radius=25;
  for(const gun of engine.firing?.states??EMPTY)if(this.validSubject(gun.target)&&gun.lineOfSight&&Math.hypot(gun.target.x-this.focus[0],gun.target.z-this.focus[2])<SCENE_RADIUS)radius=Math.max(radius,Math.hypot(gun.x-this.focus[0],gun.z-this.focus[2])*.6+18);
  const desired=clamp(2*Math.atan(radius/Math.min(1,aspect)/Math.max(distance,1))*180/Math.PI+12,DRONE_CAMERA_MIN_FOV,76);const fovRate=clamp((desired-this.fov)*1.1,-9,9);this.fovVelocity+=clamp((fovRate-this.fovVelocity)*(1-Math.exp(-5*dt)),-12*dt,12*dt);this.fovVelocity=clamp(this.fovVelocity,-Math.sqrt(24*Math.max(0,this.fov-DRONE_CAMERA_MIN_FOV)),Math.sqrt(24*Math.max(0,76-this.fov)));this.fov=clamp(this.fov+this.fovVelocity*dt,DRONE_CAMERA_MIN_FOV,76);

 }
 apply(){const c=this.camera;c.mode='live';c.position.set(this.position);c.yaw=this.yaw;c.pitch=this.pitch;c.roll=this.panRoll+Math.sin(this.time*12)*this.flinch*.018;c.fov=this.fov;c.invalidate();}
 advance(dt,{engine,phase,paused=false}={}){
  if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid drone-camera delta.');this.sync(phase,engine);if(!this.active||paused||!dt)return false;
  const elapsed=Math.max(0,engine.time-(this.engineTime??engine.time));this.engineTime=engine.time;if(!elapsed)return false;
  this.accumulator+=Math.min(elapsed,.25);this.flinch*=Math.exp(-4*elapsed);this.obstacles.update(elapsed);
  // Forecast overlap is an early warning, not a solid wall around the camera.
  // Rise through a currently clear sky column before the actor arrives. Current
  // swept hull gates remain active during that escape; actor state is untouched.
  const p=this.position;
  if(phase==='wave'&&!this.emergency&&!this.obstacles.pointClear(p[0],p[1],p[2],R,.8)&&this.staticClear(p[0],p[1],p[2],p[0],this.cruiseY,p[2])&&this.obstacles.clearSegment(p[0],p[1],p[2],p[0],this.cruiseY,p[2],R,0)){
   put(this.route,p[0],this.cruiseY,p[2]);this.routeLength=1;this.routeIndex=0;this.goal.set(this.route.subarray(0,3));this.emergency=true;this.lowShot=this.lowArrived=false;this.holding=false;this.heldFor=0;this.goalSince=this.time;
  }
  while(this.accumulator>1e-12){const step=Math.min(TICK,this.accumulator);this.accumulator-=step;this.time+=step;
   if(phase==='wave'){this.anticipation.update(engine,this.world,this.position);this.chooseSubject(engine);this.compose(engine,step);this.planIn-=step;if(this.planIn<=0){this.vantage();this.planIn=PLAN_SECONDS;}}
   this.move(step);this.heldFor=this.holding&&this.speed<2?this.heldFor+step:0;this.aim(step,engine);
   if(phase==='wave'&&this.focusKind==='combat'&&this.quality>=.8&&this.sceneInView())this.sceneExposure+=step;
  }
  this.apply();return true;
 }
 stats(){return {anticipation:this.anticipation.stats(),enabled:this.enabled,active:this.active,time:this.time,subject:this.subject?.id??null,focusKind:this.focusKind,sceneExposure:this.sceneExposure,position:Array.from(this.position),focus:Array.from(this.focus),speed:this.speed,velocity:Array.from(this.velocity),acceleration:Array.from(this.acceleration),drifting:this.drifting,blockedMoves:this.blockedMoves,yawVelocity:this.yawVelocity,pitchVelocity:this.pitchVelocity,fovVelocity:this.fovVelocity,travelled:this.travelled,plans:this.plans,holding:this.holding,heldFor:this.heldFor,relocations:this.relocations,quality:this.quality,composition:this.composition,levelInView:this.levelInView,contextReframes:this.contextReframes,compositionReframes:this.compositionReframes,compositionSubjects:this.compositionCount,lowShot:this.lowShot,lowArrived:this.lowArrived,lowPlans:this.lowPlans,lowShots:this.lowShots,lowPendingUntil:Number.isFinite(this.lowPendingUntil)?this.lowPendingUntil:null,nextLowAt:this.nextLowAt,visible:this.visible,fov:this.fov,pitch:this.pitch,panRoll:this.panRoll,flinch:this.flinch,explosions:this.explosions,routeLength:this.routeLength,routeIndex:this.routeIndex,goalDuration:this.goalDuration,emergency:this.emergency,airborneFloor:this.airborneFloor,actorPredictionSeconds:this.obstacles?.predictionSeconds??null,cruiseY:this.cruiseY,planningBytes:this.boardClipA.byteLength+this.boardClipB.byteLength+this.activityWeights.byteLength+this.candidateFocus.byteLength+this.challengeFocus.byteLength+this.activity.byteLength+this.activityFocus.byteLength+this.velocity.byteLength+this.acceleration.byteLength+this.desiredVelocity.byteLength+this.driftAnchor.byteLength+this.anticipation.byteLength+this.saved.byteLength+this.position.byteLength+this.focus.byteLength+this.look.byteLength+this.goal.byteLength+this.route.byteLength+this.scratch.byteLength+this.lastBattle.byteLength+this.compositionBounds.byteLength+this.projectedSubjects.byteLength+(this.water?.byteLength??0)+(this.airLanes?.byteLength??0)+(this.obstacles?.byteLength??0)};}
 dispose(){this.bind(null);this.camera=null;}
}
