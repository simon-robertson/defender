import {DroneFlight,DRONE_CAMERA_SPEED,DRONE_CAMERA_RADIUS} from './drone-flight.js';
import {BattleDirector} from './battle-director.js';
import {BattleFraming,BATTLE_SHOTS,projectBattlePoint} from './battle-framing.js';
export {DRONE_CAMERA_MOTION_RATE,DRONE_CAMERA_RADIUS,DRONE_CAMERA_SPEED,DRONE_CAMERA_ACCELERATION,DRONE_CAMERA_MIN_FOV,DRONE_CAMERA_MAX_FILM_PITCH,DRONE_CAMERA_BOARD_MARGIN} from './drone-flight.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),TICK=1/120,PLAN_SECONDS=.8;

// The director chooses the story, the framer composes it, and the flight layer
// certifies and executes a continuous safe journey. Combat is read-only.
export class DroneCamera extends DroneFlight {
 constructor(camera,options={}){
  super(camera,options);this.director=new BattleDirector();this.framing=new BattleFraming();this.candidates=Array.from({length:96},()=>({x:0,y:0,z:0,score:-Infinity,action:0,board:0}));
  this.time=this.accumulator=this.plans=this.relocations=this.explosions=0;this.planIn=0;this.plannedVersion=-1;this.quality=this.levelInView=0;this.visible=this.holding=false;this.engineTime=null;this.subject=null;this.focusKind='none';this.phase=null;
 }
 bind(world){super.bind(world);this.director?.reset();this.framing?.bind(world);this.time=this.accumulator=this.plans=this.relocations=0;this.plannedVersion=-1;this.planIn=0;this.engineTime=null;this.subject=null;this.focusKind='none';}
 refresh(){this.leave();this.director.reset();this.obstacles?.dispose();this.obstacles=this.obstacleEngine=null;this.engineTime=null;this.plannedVersion=-1;}
 noteActivity(x,y,z,at,weight=1){if(this.world)this.director.note(x,y,z,at,weight);}
 noteExplosion(state,at=this.engineTime??0){
  if(!state)return;const x=state.aimX??state.x,y=state.aimY??state.y,z=state.aimZ??state.z;this.noteActivity(x,y,z,at,3);
  if(this.active&&Number.isFinite(x+y+z)){const distance=Math.hypot(x-this.position[0],y-this.position[1],z-this.position[2]);if(distance<90){this.flinch=Math.min(.5,this.flinch+(1-distance/90)*.35);this.explosions++;}}
 }
 chooseSubject(engine){const changed=this.director.update(engine,this.world);this.subject=this.director.intent.subject;this.focusKind=this.director.intent.kind;if(changed)this.planIn=0;return changed;}
 compose(_engine,dt=0){const f=this.director.intent.focus;if(!dt){this.focus.set(f);return;}const distance=Math.hypot(f[0]-this.focus[0],f[1]-this.focus[1],f[2]-this.focus[2]),blend=Math.min(1-Math.exp(-3.2*dt),80*dt/(distance||1));for(let axis=0;axis<3;axis++)this.focus[axis]+=(f[axis]-this.focus[axis])*blend;}
 actionLineClear(x,y,z){
  const d=this.director;if(!d.count)return true;let total=0,visible=0,checked=0;
  // A weighted centre can fall inside scenery. Inspect real participants.
  for(let i=0;i<d.count&&checked<12;i++){const p=d.subjects[i];if(p.area!==d.intent.area)continue;checked++;total+=p.weight;if(this.world.visibility.clear(x,y,z,p.x,p.y,p.z,p.kind===1?p.state.id:undefined))visible+=p.weight;}
  return !total||visible/total>=.4;
 }
 currentFrame(){const p=this.framing.pose;p.x=this.position[0];p.y=this.position[1];p.z=this.position[2];p.yaw=this.yaw;p.pitch=this.pitch;p.fov=this.fov;return this.framing.evaluate(p,this.director,this.aspect);}
 get aspect(){return Math.max(.2,(this.camera.canvas?.clientWidth??1500)/Math.max(1,this.camera.canvas?.clientHeight??1000));}
 sceneInView(){const p=this.framing.pose;p.x=this.position[0];p.y=this.position[1];p.z=this.position[2];p.yaw=this.yaw;p.pitch=this.pitch;p.fov=this.fov;const q=projectBattlePoint(p,...this.director.intent.anchor,this.aspect,this.framing.point);return q[2]>20&&Math.abs(q[0])<.88&&Math.abs(q[1])<.85;}
 planShot(initial=false){
  const d=this.director,intent=d.intent,profile=BATTLE_SHOTS[intent.style],focus=intent.focus,p=this.position,changed=intent.version!==this.plannedVersion;
  this.plans++;this.targetFov=profile.fov;
  if(!initial){
   const result=this.currentFrame();this.quality=result.action;this.levelInView=result.board;this.visible=result.primary&&result.action>=.55;
   const safe=this.staticClear(...p,...p)&&this.obstacles.pointClear(...p,DRONE_CAMERA_RADIUS,1);
   // Commit readable views and journeys. No rotating height band or timed orbit.
   if(!changed&&safe&&this.visible&&this.actionLineClear(...p)){this.holding=this.routeIndex>=this.routeLength;return true;}
   if(!changed&&this.routeIndex<this.routeLength&&this.time-this.goalSince<this.goalDuration&&this.clear(...this.goal,...this.goal))return true;
  }
  let count=0;
  for(let height=0;height<2;height++)for(let span=0;span<2;span++)for(let angle=0;angle<24;angle++){
   const a=this.seed+angle*Math.PI/12,range=profile.range+intent.radius*.25+span*52,y=this.world.level.pathHeight+profile.height+height*(intent.style==='dramatic'?16:32),x=clamp(focus[0]+Math.sin(a)*range,-236,this.world.width+236),z=clamp(focus[2]+Math.cos(a)*range,-236,this.world.length+236),pose=this.framing.orient(x,y,z,focus,profile.fov),candidate=this.candidates[count++];
   candidate.x=x;candidate.y=y;candidate.z=z;candidate.score=-Infinity;if(pose.pitch<-.35||pose.pitch>.8)continue;
   const result=this.framing.evaluate(pose,d,this.aspect);if(!result.primary||result.action<.45)continue;
   candidate.action=result.action;candidate.board=result.board;candidate.score=result.score-(initial?0:Math.hypot(x-p[0],y-p[1],z-p[2])*.0006);
  }
  for(let attempt=0;attempt<24;attempt++){
   let best=null;for(let i=0;i<count;i++)if(this.candidates[i].score>(best?.score??-Infinity))best=this.candidates[i];if(!best)break;
   const {x,y,z}=best;best.score=-Infinity;if(!this.columnClear(x,y,z)||!this.actionLineClear(x,y,z))continue;if(!initial&&!this.routeTo(x,y,z))continue;
   this.goal.set([x,y,z]);this.goalSince=this.time;this.goalDuration=Math.max(10,Math.hypot(x-p[0],y-p[1],z-p[2])/DRONE_CAMERA_SPEED*1.8+6);this.plannedVersion=intent.version;this.holding=false;
   if(initial){this.position.set(this.goal);this.routeLength=this.routeIndex=0;this.quality=best.action;this.levelInView=best.board;this.visible=best.action>=.55;}else this.relocations++;return true;
  }
  return false;
 }
 enter(engine){
  if(!this.world)return false;this.prepareObstacles(engine);this.director.nextScan=-Infinity;this.chooseSubject(engine);this.compose(engine);
  if(!this.planShot(true)){
   let found=false;for(let z=12;!found&&z<this.world.length;z+=24)for(let x=12;x<this.world.width;x+=24)if(this.clear(x,this.cruiseY,z,x,this.cruiseY,z)){this.position.set([x,this.cruiseY,z]);found=true;break;}if(!found)return false;
  }
  const c=this.camera;this.saved.set(c.target);this.saved[3]=c.yaw;this.saved[4]=c.pitch;this.saved[5]=c.radius;
  this.active=true;this.engineTime=engine.time;this.accumulator=0;this.velocity.fill(0);this.acceleration.fill(0);this.drifting=false;this.yawVelocity=this.pitchVelocity=this.fovVelocity=0;this.speed=this.heldFor=this.panRoll=0;this.look.set(this.focus);
  this.yaw=Math.atan2(this.position[0]-this.focus[0],this.position[2]-this.focus[2]);this.pitch=Math.atan2(this.position[1]-this.focus[1],Math.hypot(this.position[0]-this.focus[0],this.position[2]-this.focus[2]));this.fov=this.targetFov;this.planIn=PLAN_SECONDS;c.setControlsEnabled(false);this.apply();return true;
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
