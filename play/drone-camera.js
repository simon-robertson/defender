import {DroneFlight,DRONE_CAMERA_SPEED,DRONE_CAMERA_RADIUS,DRONE_CAMERA_MAX_FILM_PITCH} from './drone-flight.js';
import {BattleDirector} from './battle-director.js';
import {BattleFraming,BATTLE_SHOTS,projectBattlePoint} from './battle-framing.js';
export {DRONE_CAMERA_MOTION_RATE,DRONE_CAMERA_RADIUS,DRONE_CAMERA_SPEED,DRONE_CAMERA_ACCELERATION,DRONE_CAMERA_MIN_FOV,DRONE_CAMERA_MAX_FILM_PITCH,DRONE_CAMERA_BOARD_MARGIN,DRONE_CAMERA_MIN_ALTITUDE} from './drone-flight.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),TICK=1/120,PLAN_SECONDS=.8,OPENING_SECONDS=3;

// The director chooses the story, the framer composes it, and the flight layer
// certifies and executes a continuous safe journey. Combat is read-only.
export class DroneCamera extends DroneFlight {
 constructor(camera,options={}){
  super(camera,options);this.director=new BattleDirector();this.framing=new BattleFraming();this.candidates=Array.from({length:144},()=>({x:0,y:0,z:0,score:-Infinity,adjustment:0,certified:false,action:0,global:0,board:0}));
  this.time=this.accumulator=this.plans=this.relocations=this.explosions=0;this.planIn=0;this.plannedVersion=-1;this.quality=this.levelInView=0;this.visible=this.holding=false;this.engineTime=null;this.subject=null;this.focusKind='none';this.phase=null;
  this.openingUntil=0;this.plannedOpening=false;this.openingFocus=new Float64Array(3);this.playerTarget=new Float64Array(3);this.targeted=false;this.lookYawOffset=this.lookPitchOffset=0;this.targetVersion=0;this.plannedTarget=-1;
 }
 bind(world){super.bind(world);this.director?.reset();this.framing?.bind(world);this.time=this.accumulator=this.plans=this.relocations=0;this.plannedVersion=-1;this.planIn=0;this.engineTime=null;this.subject=null;this.focusKind='none';this.openingUntil=0;this.plannedOpening=false;}
 leave(){super.leave();this.targeted=false;this.lookYawOffset=this.lookPitchOffset=0;}
 refresh(){this.leave();this.director.reset();this.obstacles?.dispose();this.obstacles=this.obstacleEngine=null;this.engineTime=null;this.plannedVersion=-1;}
 rotate(dx,dy){if(!this.active||!Number.isFinite(dx+dy))return false;this.lookYawOffset-=dx*.004;this.lookYawOffset=Math.atan2(Math.sin(this.lookYawOffset),Math.cos(this.lookYawOffset));this.lookPitchOffset=clamp(this.lookPitchOffset+dy*.004,-1.2,1.2);return true;}
 targetAt(x,y,z){
  if(!this.active||!Number.isFinite(x+y+z)||x<0||z<0||x>this.world.width||z>this.world.length)return false;
  const cols=this.world.level.size[0],cell=Math.min(this.world.level.size[1]-1,Math.floor(z/24))*cols+Math.min(cols-1,Math.floor(x/24));
  this.playerTarget.set([x,Math.max(this.world.level.pathHeight,this.water[cell]),z]);this.targeted=true;this.targetVersion++;this.lookYawOffset=this.lookPitchOffset=0;this.openingUntil=0;this.planIn=0;this.routeLength=this.routeIndex=0;return true;
 }
 noteActivity(x,y,z,at,weight=1){if(this.world)this.director.note(x,y,z,at,weight);}
 noteExplosion(state,at=this.engineTime??0){
  if(!state)return;const x=state.aimX??state.x,y=state.aimY??state.y,z=state.aimZ??state.z;this.noteActivity(x,y,z,at,3);
  if(this.active&&Number.isFinite(x+y+z)){const distance=Math.hypot(x-this.position[0],y-this.position[1],z-this.position[2]);if(distance<90){this.flinch=Math.min(.5,this.flinch+(1-distance/90)*.35);this.explosions++;}}
 }
 chooseSubject(engine){const changed=this.director.update(engine,this.world);this.subject=this.director.intent.subject;this.focusKind=this.director.intent.kind;if(changed)this.planIn=0;return changed;}
 compose(_engine,dt=0){let f=this.director.intent.focus;
  if(this.targeted){
   const t=this.playerTarget,o=this.openingFocus,near=Math.hypot(f[0]-t[0],f[2]-t[2])<80;
   for(let i=0;i<3;i++)o[i]=t[i]+(near?(f[i]-t[i])*.25:0);f=o;
  }
  if(this.world&&this.time<this.openingUntil){
   const t=clamp(1-(this.openingUntil-this.time)/OPENING_SECONDS,0,1),o=this.openingFocus;
   let blend=.15+.85*t*t*(3-2*t);
   // Start toward the board centre, but retain the real action anchor in the
   // shot on tall, wide or narrow-aspect levels. No scene/collision rules change.
   for(let attempt=0;attempt<18;attempt++){
    o[0]=this.world.width/2+(f[0]-this.world.width/2)*blend;o[1]=f[1];o[2]=this.world.length/2+(f[2]-this.world.length/2)*blend;
    const pose=this.orientShot(...this.position,o,64),q=projectBattlePoint(pose,...this.director.intent.anchor,this.aspect,this.framing.point);
    if(blend===1||q[2]>20&&Math.abs(q[0])<.88&&Math.abs(q[1])<.85)break;blend=Math.min(1,blend+.05);
   }
   f=o;
  }
  if(!dt){this.focus.set(f);return;}const distance=Math.hypot(f[0]-this.focus[0],f[1]-this.focus[1],f[2]-this.focus[2]),blend=Math.min(1-Math.exp(-3.2*dt),80*dt/(distance||1));for(let axis=0;axis<3;axis++)this.focus[axis]+=(f[axis]-this.focus[axis])*blend;}
 actionLineClear(x,y,z){
  const d=this.director;if(!d.count)return true;let total=0,visible=0,checked=0;
  // A weighted centre can fall inside scenery. Inspect real participants.
  for(let i=0;i<d.count&&checked<12;i++){const p=d.subjects[i];if(p.area!==d.intent.area)continue;checked++;total+=p.weight;if(this.world.visibility.clear(x,y,z,p.x,p.y,p.z,p.kind===1?p.state.id:undefined))visible+=p.weight;}
  return !total||visible/total>=.4;
 }
 currentFrame(){const p=this.framing.pose;p.x=this.position[0];p.y=this.position[1];p.z=this.position[2];p.yaw=this.yaw;p.pitch=this.pitch;p.fov=this.fov;return this.framing.evaluate(p,this.director,this.aspect,true,this.time<this.openingUntil?'survey':this.director.intent.style);}
 get aspect(){return Math.max(.2,(this.camera.canvas?.clientWidth??1500)/Math.max(1,this.camera.canvas?.clientHeight??1000));}
 sceneInView(){const p=this.framing.pose;p.x=this.position[0];p.y=this.position[1];p.z=this.position[2];p.yaw=this.yaw;p.pitch=this.pitch;p.fov=this.fov;const q=projectBattlePoint(p,...this.director.intent.anchor,this.aspect,this.framing.point);return q[2]>20&&Math.abs(q[0])<.88&&Math.abs(q[1])<.85;}
 orientShot(x,y,z,focus,fov){const pose=this.framing.orient(x,y,z,focus,fov);pose.pitch=Math.min(pose.pitch,DRONE_CAMERA_MAX_FILM_PITCH);return pose;}
 planShot(){
  if(this.targeted)return this.planTarget();
  const d=this.director,intent=d.intent,opening=this.time<this.openingUntil,style=opening?'survey':intent.style,profile=BATTLE_SHOTS[style],focus=intent.focus,p=this.position,changed=intent.version!==this.plannedVersion||opening!==this.plannedOpening;
  this.plans++;this.targetFov=profile.fov;let currentScore=0,currentBoard=0,currentGlobal=0,readable=false;
  {
   const result=this.currentFrame();this.quality=result.action;this.levelInView=result.board;this.visible=result.primary&&result.action>=.55;
   const safe=p[1]>=this.minimumY&&this.staticClear(...p,...p)&&this.obstacles.pointClear(...p,DRONE_CAMERA_RADIUS,1);
   if(opening&&safe){this.holding=true;this.plannedVersion=intent.version;this.plannedOpening=true;return true;}
   // Finish accepted journeys. A locally readable view may still miss the
   // wider battle; only a material coverage gain can dislodge that shot.
   if(!changed&&this.routeIndex<this.routeLength&&this.time-this.goalSince<this.goalDuration&&this.clear(...this.goal,...this.goal))return true;
   readable=safe&&this.visible;currentScore=result.score;currentBoard=result.board;currentGlobal=result.global;
   const wide=style==='survey'||style==='overview',missingContext=wide&&(result.board<profile.board*.85||result.global<.85);
   if(!changed&&readable&&(!missingContext||this.time-this.goalSince<2.4)){this.holding=true;return true;}
  }
  let count=0;const ranges=this.framing.searchRanges(d,this.aspect,style);
  // All stations stay inside the board and above the altitude floor. A steeper
  // supported angle keeps nearby action visible from these higher positions.
  for(let elevation=0;elevation<3;elevation++)for(let span=0;span<3;span++)for(let angle=0;angle<16;angle++){
   const a=this.seed+angle*Math.PI/8,range=ranges[span],pitch=elevation===0?(style==='dramatic'?.05:.22):elevation===1?.5:.76,y=Math.max(opening?this.cruiseY:this.minimumY,focus[1]+Math.tan(pitch)*range),inset=DRONE_CAMERA_RADIUS+16,x=clamp(focus[0]+Math.sin(a)*range,inset,this.world.width-inset),z=clamp(focus[2]+Math.cos(a)*range,inset,this.world.length-inset),pose=this.orientShot(x,y,z,focus,profile.fov),candidate=this.candidates[count++];
   candidate.x=x;candidate.y=y;candidate.z=z;candidate.score=-Infinity;candidate.certified=false;if(pose.pitch<-.35)continue;
   const result=this.framing.evaluate(pose,d,this.aspect,false,style);if(!result.primary||result.action<.45)continue;
   if(!changed&&readable&&(result.score<currentScore+.05||result.board<currentBoard+.1&&result.global<currentGlobal+.15))continue;
   candidate.action=result.action;candidate.global=result.global;candidate.board=result.board;
   candidate.adjustment=-Math.min(.08,Math.hypot(x-p[0],y-p[1],z-p[2])*.00015);candidate.score=result.score+candidate.adjustment;
  }
  let inspected=0;
  for(let attempt=0;attempt<count+24;attempt++){
   let best=null;for(let i=0;i<count;i++){const c=this.candidates[i];if((inspected<24||c.certified)&&c.score>(best?.score??-Infinity))best=c;}if(!best)break;
   const {x,y,z}=best;
   if(!best.certified){
    best.certified=true;
    if(!this.columnClear(x,y,z)||!this.actionLineClear(x,y,z)){best.score=-Infinity;continue;}
    inspected++;
    const result=this.framing.evaluate(this.orientShot(x,y,z,focus,profile.fov),d,this.aspect,true,style);
    if(result.action<.55||!changed&&readable&&(result.score<currentScore+.05||result.board<currentBoard+.1&&result.global<currentGlobal+.15)){best.score=-Infinity;continue;}
    best.action=result.action;best.global=result.global;best.board=result.board;best.score=result.score+best.adjustment;continue;
   }
   best.score=-Infinity;if(!this.routeTo(x,y,z))continue;
   this.goal.set([x,y,z]);this.goalSince=this.time;this.goalDuration=Math.max(10,Math.hypot(x-p[0],y-p[1],z-p[2])/DRONE_CAMERA_SPEED*1.8+6);this.plannedVersion=intent.version;this.plannedOpening=opening;this.holding=false;
   this.relocations++;return true;
  }
  return false;
 }
 planTarget(){
  const p=this.position,t=this.playerTarget,changed=this.plannedTarget!==this.targetVersion;
  this.plans++;this.targetFov=56;
  // Hold the selected neighbourhood; remote fights cannot move its anchor.
  if(!changed&&this.clear(...this.goal,...this.goal)&&(this.routeIndex<this.routeLength||this.time-this.goalSince<5))return true;
  let count=0;const bearing=Math.atan2(p[0]-t[0],p[2]-t[2]);
  for(let height=0;height<3;height++)for(let range=0;range<3;range++)for(let n=0;n<16;n++){
   const a=bearing+n*Math.PI/8,r=72+range*32,inset=DRONE_CAMERA_RADIUS+8,x=clamp(t[0]+Math.sin(a)*r,inset,this.world.width-inset),z=clamp(t[2]+Math.cos(a)*r,inset,this.world.length-inset),y=Math.max(this.minimumY+height*24,height===2?this.cruiseY:0),c=this.candidates[count++];
   c.x=x;c.y=y;c.z=z;c.score=-Infinity;c.certified=false;
   if(Math.hypot(x-t[0],z-t[2])<64)continue;
   const pose=this.orientShot(x,y,z,t,56),q=projectBattlePoint(pose,...t,this.aspect,this.framing.point);
   if(q[2]<=20||Math.abs(q[0])>.8||Math.abs(q[1])>.8)continue;
   let action=0;for(let i=0;i<this.director.count;i++){const s=this.director.subjects[i];if(Math.hypot(s.x-t[0],s.z-t[2])>80)continue;const v=projectBattlePoint(pose,s.x,s.y,s.z,this.aspect,this.framing.point);if(v[2]>20&&Math.abs(v[0])<.8&&Math.abs(v[1])<.8)action+=s.weight;}
   c.score=Math.min(1,action*.08)-Math.hypot(x-p[0],y-p[1],z-p[2])*.001-Math.abs(Math.hypot(x-t[0],z-t[2])-96)*.002;
  }
  let inspected=0;
  for(let attempt=0;attempt<48;attempt++){
   let best=null;for(let i=0;i<count;i++)if((inspected<24||this.candidates[i].certified)&&this.candidates[i].score>(best?.score??-Infinity))best=this.candidates[i];if(!best)break;
   const {x,y,z}=best;
   if(!best.certified){best.certified=true;inspected++;if(!this.columnClear(x,y,z)){best.score=-Infinity;continue;}if(!this.world.visibility.clear(x,y,z,t[0],t[1]+2,t[2]))best.score-=.4;continue;}
   best.score=-Infinity;if(!this.routeTo(x,y,z))continue;
   this.goal.set([x,y,z]);this.goalSince=this.time;this.plannedTarget=this.targetVersion;this.holding=true;this.relocations++;return true;
  }
  return false;
 }
 enter(engine){
  if(!this.world)return false;this.prepareObstacles(engine);this.director.nextScan=-Infinity;this.openingUntil=this.time+OPENING_SECONDS;this.chooseSubject(engine);
  // Raise the central start if a live actor occupies its first height. Never
  // fall back to an edge station or a lower opening.
  const x=this.world.width/2,z=this.world.length/2;let found=false;
  for(let lift=0;lift<=128;lift+=32){const y=this.cruiseY+lift;if(this.clear(x,y,z,x,y,z)){this.position.set([x,y,z]);found=true;break;}}if(!found)return false;
  this.goal.set(this.position);this.routeLength=this.routeIndex=0;this.goalSince=this.time;this.plannedVersion=this.director.intent.version;this.plannedOpening=true;this.holding=true;this.targetFov=64;this.compose(engine);
  const c=this.camera;this.saved.set(c.target);this.saved[3]=c.yaw;this.saved[4]=c.pitch;this.saved[5]=c.radius;
  this.active=true;this.engineTime=engine.time;this.accumulator=0;this.velocity.fill(0);this.acceleration.fill(0);this.drifting=false;this.yawVelocity=this.pitchVelocity=this.fovVelocity=0;this.speed=this.heldFor=this.panRoll=0;this.look.set(this.focus);
  const pose=this.orientShot(...this.position,this.focus,this.targetFov);this.yaw=pose.yaw;this.pitch=pose.pitch;this.fov=this.targetFov;const frame=this.currentFrame();this.quality=frame.action;this.levelInView=frame.board;this.visible=frame.primary&&frame.action>=.55;this.planIn=PLAN_SECONDS;c.setControlsEnabled(false);this.apply();return true;
 }
 sync(phase,engine){this.phase=phase;if(!this.enabled||!['wave','settling'].includes(phase)||!this.world){const preparing=this.active&&['loadout','deploy'].includes(phase);this.leave();if(preparing)this.camera.frame();return false;}if(!this.active&&engine)this.enter(engine);return this.active;}
 advance(dt,{engine,phase,paused=false}={}){
  if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid drone-camera delta.');this.sync(phase,engine);if(!this.active||paused||!dt)return false;
  const elapsed=Math.max(0,engine.time-(this.engineTime??engine.time));this.engineTime=engine.time;if(!elapsed)return false;
  this.accumulator+=Math.min(elapsed,.25);this.waveClock=engine.waveTime??0;this.obstacles.update(elapsed);this.flinch*=Math.exp(-4*elapsed);const p=this.position;
  // Future occupancy protects low views without banning an entire air lane.
  if(!this.emergency&&(!this.obstacles.pointClear(...p,DRONE_CAMERA_RADIUS,3)||!this.spawnClear(...p,...p))&&p[1]<this.cruiseY-1&&this.staticClear(...p,p[0],this.cruiseY,p[2])&&this.obstacles.clearSegment(...p,p[0],this.cruiseY,p[2],DRONE_CAMERA_RADIUS,0)){
   this.route.set([p[0],this.cruiseY,p[2]]);this.routeLength=1;this.routeIndex=0;this.emergency=true;this.goal.set(this.route.subarray(0,3));this.goalSince=this.time;
  }
  while(this.accumulator>1e-12){const step=Math.min(TICK,this.accumulator);this.accumulator-=step;this.time+=step;
   if(phase==='wave'){this.chooseSubject(engine);this.compose(engine,step);this.planIn-=step;if(this.planIn<=0&&!this.emergency){this.planShot();this.planIn=PLAN_SECONDS;}}
   this.move(step);this.heldFor=this.holding&&this.speed<2?this.heldFor+step:0;this.aim(step,engine);
   this.director.expose(step,phase==='wave'&&this.visible&&this.sceneInView());
  }
  this.apply();return true;
 }
 stats(){return {enabled:this.enabled,active:this.active,time:this.time,subject:this.subject?.id??null,focusKind:this.focusKind,style:this.director.intent.style,reason:this.director.intent.reason,busyAreas:this.director.intent.busyAreas,sceneExposure:this.director.exposure,position:Array.from(this.position),focus:Array.from(this.focus),speed:this.speed,velocity:Array.from(this.velocity),acceleration:Array.from(this.acceleration),drifting:this.drifting,blockedMoves:this.blockedMoves,yawVelocity:this.yawVelocity,pitchVelocity:this.pitchVelocity,fovVelocity:this.fovVelocity,travelled:this.travelled,plans:this.plans,holding:this.holding,heldFor:this.heldFor,relocations:this.relocations,quality:this.quality,levelInView:this.levelInView,visible:this.visible,fov:this.fov,pitch:this.pitch,panRoll:this.panRoll,flinch:this.flinch,explosions:this.explosions,routeLength:this.routeLength,routeIndex:this.routeIndex,goalDuration:this.goalDuration,emergency:this.emergency,actorPredictionSeconds:this.obstacles?.predictionSeconds??null,cruiseY:this.cruiseY,planningBytes:this.director.byteLength+(this.obstacles?.byteLength??0)+(this.water?.byteLength??0)};}
 dispose(){this.bind(null);this.camera=null;}
}
