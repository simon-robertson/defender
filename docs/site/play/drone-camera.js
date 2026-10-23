import {DroneFlight} from './drone-flight.js';
import {routePath} from '../shared/routes.js';
export {DRONE_CAMERA_RADIUS,DRONE_CAMERA_SPEED,DRONE_CAMERA_ACCELERATION,DRONE_CAMERA_MIN_ALTITUDE} from './drone-flight.js';
export const DRONE_CAMERA_ORBIT_RADIUS=144,DRONE_CAMERA_MIN_OFFSET=64;
const TICK=1/120,ORBIT_RATE=.035,ORBIT_MOVE_RATE=.12,ORBIT_RESPONSE=1.4,BOB=6,EMPTY=Object.freeze([]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// One world anchor owns both the reticle and the orbit. Enemy activity may
// choose the orbit direction, but never moves the player's viewing target.
export class DroneCamera extends DroneFlight {
 constructor(camera,options={}){
  super(camera,options);this.playerTarget=this.focus;this.minimumOffset=DRONE_CAMERA_MIN_OFFSET;
  this.time=this.accumulator=this.plans=this.relocations=this.explosions=0;this.planIn=0;this.engineTime=null;this.phase=null;this.targeted=false;this.orbitAngle=0;this.orbitDirection=1;this.orbitRate=ORBIT_RATE;this.visibleEnemies=0;this.frameTargets=[];this.frameWeapons=[];this.projected=new Float64Array(32);this.orbitGoalAngle=null;this.frameSince=this.frameHoldUntil=0;this.frameImpact=false;this.activity=new Float64Array([0,0,0,-Infinity,0]);
 }
 bind(world){super.bind(world);this.time=this.accumulator=this.plans=this.relocations=0;this.planIn=0;this.engineTime=null;this.targeted=false;this.activity?.fill(0);if(this.activity)this.activity[3]=-Infinity;this.frameTargets.length=this.frameWeapons.length=0;this.orbitGoalAngle=null;}
 leave(){super.leave();this.targeted=false;if(this.frameTargets)this.frameTargets.length=this.frameWeapons.length=0;this.orbitGoalAngle=null;}
 refresh(){this.leave();this.obstacles?.dispose();this.obstacles=this.obstacleEngine=null;this.engineTime=null;}
 get aspect(){return Math.max(.2,(this.camera.canvas?.clientWidth??1500)/Math.max(1,this.camera.canvas?.clientHeight??1000));}
 surfaceY(x,z){const cols=this.world.level.size[0],rows=this.world.level.size[1],cell=clamp(Math.floor(z/24),0,rows-1)*cols+clamp(Math.floor(x/24),0,cols-1);return this.surfaces[cell];}
 lockTarget(x,y,z,manual=true){
  this.focus.set([x,y,z]);this.targeted=manual;
  this.orbitAngle=Math.atan2(this.position[0]-x,this.position[2]-z);this.orbitGoalAngle=null;this.frameImpact=false;this.frameHoldUntil=0;this.planIn=manual ? .25 : 0;this.aim();this.apply();
 }
 targetAt(x,y,z){
  if(!this.active||!Number.isFinite(x+y+z)||x<0||z<0||x>this.world.width||z>this.world.length)return false;
  this.lockTarget(x,this.surfaceY(x,z),z);return true;
 }
 rotate(dx,dy){
  if(!this.active||!Number.isFinite(dx+dy))return false;
  // The proposed centre ray stays downward and away from a vertical view.
  const p=this.position,yaw=this.yaw-dx*.004,pitch=clamp(this.pitch+dy*.004,.12,Math.atan2(p[1]-this.world.level.pathHeight,this.minimumOffset)),vx=-Math.sin(yaw)*Math.cos(pitch),vy=-Math.sin(pitch),vz=-Math.cos(yaw)*Math.cos(pitch);
  let nearest=Infinity;
  // Intersect the board's terrain/water columns, including raised sides. This
  // happens only on mouse input, never in the per-frame flight loop.
  const cols=this.world.level.size[0],rows=this.world.level.size[1];
  for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){
   let lo=0,hi=Infinity;const height=this.surfaces[z*cols+x];
   for(let axis=0;axis<3;axis++){
    const origin=p[axis],v=axis===0?vx:axis===1?vy:vz,min=axis===0?x*24:axis===1?0:z*24,max=axis===0?(x+1)*24:axis===1?height:(z+1)*24;
    if(Math.abs(v)<1e-12){if(origin<min||origin>max){hi=-1;break;}continue;}
    let a=(min-origin)/v,b=(max-origin)/v;if(a>b){const swap=a;a=b;b=swap;}lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)break;
   }
   if(hi>=lo&&lo<nearest)nearest=lo;
  }
  if(Number.isFinite(nearest))this.lockTarget(clamp(p[0]+vx*nearest,0,this.world.width),p[1]+vy*nearest,clamp(p[2]+vz*nearest,0,this.world.length));
  else{
   // Stop at the board edge instead of allowing the centre target into the
   // background. Re-aiming at this clamped point keeps the reticle truthful.
   const t=(this.world.level.pathHeight-p[1])/vy,x=clamp(p[0]+vx*t,0,this.world.width),z=clamp(p[2]+vz*t,0,this.world.length);this.targetAt(x,this.world.level.pathHeight,z);
  }
  return true;
 }
 noteActivity(x,y,z,at,weight=1){if(Number.isFinite(x+y+z+at+weight))this.activity.set([x,y,z,at,weight]);}
 noteExplosion(state,at=this.engineTime??0){if(state){this.noteActivity(state.aimX??state.x,state.aimY??state.y,state.aimZ??state.z,at,3);this.explosions++;}}
 // Project live participants with the exact lens/anchor, and test real scenery
 // occlusion. Score useful orbital viewpoints; no combat state is changed.
 captureFrame(engine){
  const targets=this.frameTargets,weapons=this.frameWeapons,p=this.position,f=this.focus,dx=p[0]-f[0],dy=p[1]-f[1],dz=p[2]-f[2],horizontal=Math.hypot(dx,dz),distance=Math.hypot(horizontal,dy)||1,sy=horizontal?dx/horizontal:Math.sin(this.yaw),cy=horizontal?dz/horizontal:Math.cos(this.yaw),sp=dy/distance,cp=horizontal/distance,tan=Math.tan(this.fov*Math.PI/360),aspect=this.aspect;
  targets.length=weapons.length=0;
  const visible=(x,y,z,id)=>{const dx=x-p[0],dy=y-p[1],dz=z-p[2],depth=-dx*sy*cp-dy*sp-dz*cy*cp,sx=(dx*cy-dz*sy)/(depth*tan*aspect),up=(-dx*sy*sp+dy*cp-dz*cy*sp)/(depth*tan);return depth>12&&Math.abs(sx)<.9&&Math.abs(up)<.86&&this.world.visibility.clear(...p,x,y,z,id);};
  for(const s of engine.enemies?.activeTargets??EMPTY)if(s.health?.alive!==false&&visible(s.aimX??s.x,s.aimY??s.y,s.aimZ??s.z,s.id))targets.push(s);
  const a=this.activity,age=engine.time-a[3];this.frameImpact=targets.length>0&&age>=0&&age<2&&visible(a[0],a[1],a[2]);
  for(const gun of engine.firing?.states??EMPTY){
   const at=gun.lastShotAt??gun.cycle?.lastShotAt,age=(gun.cycle?.time??engine.time)-at;
   if(gun.target&&targets.includes(gun.target)&&gun.lineOfSight!==false&&age>=0&&age<1.5&&visible(gun.x,gun.y??this.world.level.pathHeight+12,gun.z,gun.id))weapons.push(gun);
  }
 }
 viewScore(angle,engine,targets=engine.enemies?.activeTargets??EMPTY,weapons=EMPTY){
  const f=this.focus,x=f[0]+Math.sin(angle)*DRONE_CAMERA_ORBIT_RADIUS,z=f[2]+Math.cos(angle)*DRONE_CAMERA_ORBIT_RADIUS,y=this.cruiseY+BOB,yaw=angle,pitch=Math.atan2(y-f[1],DRONE_CAMERA_ORBIT_RADIUS),sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch),tan=Math.tan(this.fov*Math.PI/360),anchorDepth=Math.hypot(DRONE_CAMERA_ORBIT_RADIUS,y-f[1]),aspect=this.aspect;
  let score=0,total=0,visible=0,projected=0;
  const measure=(px,py,pz,weight,id,enemy=false)=>{
   total+=weight;
   const dx=px-x,dy=py-y,dz=pz-z,depth=-dx*sy*cp-dy*sp-dz*cy*cp,sx=(dx*cy-dz*sy)/(depth*tan*aspect),up=(-dx*sy*sp+dy*cp-dz*cy*sp)/(depth*tan);
   if(depth>12&&Math.abs(sx)<.9&&Math.abs(up)<.86&&this.world.visibility.clear(x,y,z,px,py,pz,id)){
    // Keep coverage valuable, then prefer a readable near-side subject below
    // the reticle. Fade the bonus near frame edges instead of chasing clipping.
    const edge=clamp((.9-Math.abs(sx))/.2,0,1)*clamp((.86-Math.abs(up))/.2,0,1),lower=clamp(1-Math.abs(up+.3)/.65,0,1),near=clamp((anchorDepth-depth)/80,0,1);
    score+=weight*(1-.2*Math.abs(sx)+edge*(lower*.7+near*.35));if(enemy)visible++;
    if(projected<16){const k=projected++*2;this.projected[k]=sx;this.projected[k+1]=up;}
   }
  };
  for(const s of targets)if(s.health?.alive!==false){let fighting=false;for(const gun of weapons)if(gun.target===s){fighting=true;break;}measure(s.aimX??s.x,s.aimY??s.y,s.aimZ??s.z,fighting?3:1,s.id,true);}
  for(const gun of weapons)measure(gun.x,gun.y??this.world.level.pathHeight+12,gun.z,.8,gun.id);
  if(this.frameImpact){const a=this.activity,age=engine.time-a[3];if(age>=0&&age<2)measure(a[0],a[1],a[2],a[4]*.3*(1-age/2));}
  let overlap=0,pairs=0;for(let i=0;i<projected;i++)for(let j=i+1;j<projected;j++){const a=i*2,b=j*2;overlap+=Math.max(0,1-Math.abs(this.projected[a]-this.projected[b])/.16)*Math.max(0,1-Math.abs(this.projected[a+1]-this.projected[b+1])/.24);pairs++;}
  this.visibleEnemies=visible;return total?score/total-(pairs?overlap/pairs*.15:0):0;
 }
 planOrbit(engine){
  this.plans++;this.captureFrame(engine);this.planIn=.8;
  const p=this.position,f=this.focus,bearing=Math.atan2(p[0]-f[0],p[2]-f[2]),targets=this.frameTargets,weapons=this.frameWeapons;
  this.visibleEnemies=targets.length;
  if(this.time<this.frameHoldUntil)return;
  if(!targets.length){this.orbitGoalAngle=null;return;}
  const current=this.viewScore(bearing,engine,targets,weapons);let best=current+.12,chosen=null;
  // Search the whole orbit for a useful composition of the action that is
  // already visible. Off-screen fights cannot move the anchor or steal focus.
  for(let n=-12;n<12;n++){
   const a=bearing+n*Math.PI/12,score=this.viewScore(a,engine,targets,weapons)-Math.abs(n)*.005;
   if(score>best){best=score;chosen=a;}
  }
  if(chosen!==null){this.orbitGoalAngle=chosen;this.frameSince=this.time;this.frameHoldUntil=this.time+4;this.relocations++;}
  this.viewScore(bearing,engine,targets,weapons);
 }
 steer(dt){
  // Integrate an eased angular velocity exactly, including reversals. The
  // orbital station and its tangent velocity change continuously together.
  const drift=this.orbitGoalAngle===null?null:this.orbitGoalAngle+Math.sin((this.time-this.frameSince)*.35)*.035,error=drift===null?0:Math.atan2(Math.sin(drift-this.orbitAngle),Math.cos(drift-this.orbitAngle)),targetRate=drift===null?this.orbitDirection*ORBIT_RATE:clamp(error*.9,-ORBIT_MOVE_RATE,ORBIT_MOVE_RATE),decay=Math.exp(-ORBIT_RESPONSE*dt),difference=this.orbitRate-targetRate;
  this.orbitAngle+=targetRate*dt+difference*(1-decay)/ORBIT_RESPONSE;this.orbitRate=targetRate+difference*decay;if(targetRate)this.orbitDirection=Math.sign(targetRate);
  const a=this.orbitAngle,r=DRONE_CAMERA_ORBIT_RADIUS,f=this.focus,p=this.position,g=this.goal,want=this.desiredVelocity;
  g[0]=f[0]+Math.sin(a)*r;g[1]=this.cruiseY+BOB+Math.sin(this.time*.35)*BOB;g[2]=f[2]+Math.cos(a)*r;
  // Follow the moving orbital station with tangent feed-forward. There is no
  // board clamp on the aircraft: only its world target is board constrained.
  want[0]=(g[0]-p[0])*1.4+Math.cos(a)*r*this.orbitRate;want[1]=(g[1]-p[1])*1.4+Math.cos(this.time*.35)*BOB*.35;want[2]=(g[2]-p[2])*1.4-Math.sin(a)*r*this.orbitRate;
 }
 enter(engine){
  if(!this.world)return false;this.prepareObstacles(engine);
  const c=this.camera;this.saved.set(c.target);this.saved[3]=c.yaw;this.saved[4]=c.pitch;this.saved[5]=c.radius;
  const path=routePath(this.world.level,engine.wave?.spawns?.[0]?.routeId)??this.world.level.path,spawn=path?.[0],tx=spawn?(spawn[0]+.5)*24:this.world.width/2,tz=spawn?(spawn[2]+.5)*24:this.world.length/2;
  let x=this.world.width/2,z=this.world.length/2;
  if(Math.hypot(x-tx,z-tz)<this.minimumOffset)z+=this.minimumOffset;
  let found=false;for(let lift=0;lift<=128;lift+=32){const y=this.cruiseY+BOB+lift;if(this.clear(x,y,z,x,y,z)){this.position.set([x,y,z]);this.cruiseY+=lift;found=true;break;}}if(!found)return false;
  this.active=true;this.time=this.accumulator=0;this.engineTime=engine.time;this.velocity.fill(0);this.acceleration.fill(0);this.speed=0;this.orbitDirection=1;this.orbitRate=ORBIT_RATE;this.activity[3]=-Infinity;
  this.lockTarget(tx,this.surfaceY(tx,tz),tz,false);this.goal.set(this.position);this.planOrbit(engine);c.setControlsEnabled(false);this.apply();return true;
 }
 sync(phase,engine){this.phase=phase;if(!this.enabled||!['wave','settling'].includes(phase)||!this.world){const preparing=this.active&&['loadout','deploy'].includes(phase);this.leave();if(preparing)this.camera.frame();return false;}if(!this.active&&engine)this.enter(engine);return this.active;}
 advance(dt,{engine,phase,paused=false}={}){
  if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid drone-camera delta.');this.sync(phase,engine);if(!this.active||paused||!dt)return false;
  const elapsed=Math.max(0,engine.time-(this.engineTime??engine.time));this.engineTime=engine.time;if(!elapsed)return false;
  this.accumulator+=Math.min(elapsed,.25);this.waveClock=engine.waveTime??0;this.obstacles.update(elapsed);
  while(this.accumulator>1e-12){const step=Math.min(TICK,this.accumulator);this.accumulator-=step;this.time+=step;this.planIn-=step;if(this.planIn<=0)this.planOrbit(engine);this.steer(step);this.move(step);}
  this.aim();this.apply();return true;
 }
 stats(){return {enabled:this.enabled,active:this.active,time:this.time,style:'orbit',position:Array.from(this.position),focus:Array.from(this.focus),speed:this.speed,velocity:Array.from(this.velocity),acceleration:Array.from(this.acceleration),blockedMoves:this.blockedMoves,travelled:this.travelled,plans:this.plans,relocations:this.relocations,visibleEnemies:this.visibleEnemies,fov:this.fov,pitch:this.pitch,orbitRadius:DRONE_CAMERA_ORBIT_RADIUS,orbitDirection:this.orbitDirection,orbitRate:this.orbitRate,orbitGoalAngle:this.orbitGoalAngle,framingEnemies:this.frameTargets.length,framingWeapons:this.frameWeapons.length,cruiseY:this.cruiseY,actorPredictionSeconds:this.obstacles?.predictionSeconds??null,planningBytes:(this.obstacles?.byteLength??0)+(this.surfaces?.byteLength??0)+this.activity.byteLength+this.projected.byteLength};}
 dispose(){this.bind(null);this.camera=null;}
}
