// Presentation only. Read live combat state without invoking targeting/planners.
// All motion uses a fixed clock and bounded critically damped translation/zoom.
const TICK=1/120,EVENTS=24,MANUAL_HOLD=6,MIN_ACTION_RADIUS=116;
const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
function segmentDistanceSquared(x,z,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz,t=length?clamp(((x-ax)*dx+(z-az)*dz)/length,0,1):0;return (x-ax-t*dx)**2+(z-az-t*dz)**2;}
const running=phase=>phase==='wave'||phase==='settling';
export class ActionCamera {
 constructor(camera){
  this.camera=camera;this.enabled=true;this.world=null;this.time=0;this.hold=0;this.accumulator=0;this.owned=false;this.returning=false;this.wasRunning=false;this.phase=null;
  this.start=new Float64Array(4);this.position=new Float64Array(4);this.velocity=new Float64Array(4);this.goal=new Float64Array(4);this.sample=new Float64Array(5);this.futureA=new Float64Array(5);this.futureB=new Float64Array(5);this.events=new Float64Array(EVENTS*5);this.events.fill(-Infinity);this.cursor=0;this.deathCursor=0;this.pointCount=0;this.overviewRadius=0;this.settleGoal=false;
 }
 capture(){this.position.set(this.camera.target);this.position[3]=this.camera.radius;this.start.set(this.position);this.velocity.fill(0);this.accumulator=0;}
 bind(world){this.world=world??null;this.time=this.hold=this.accumulator=0;this.events.fill(-Infinity);this.cursor=0;this.deathCursor=0;this.owned=this.returning=this.wasRunning=this.settleGoal=false;this.phase=null;this.engineTime=null;this.pointCount=0;this.capture();this.goal.set(this.position);}
 setEnabled(enabled){this.enabled=Boolean(enabled);if(!this.enabled){this.owned=this.returning=false;this.capture();}return this.enabled;}
 resume(){this.enabled=true;this.hold=0;this.capture();}
 manualOverride(seconds=MANUAL_HOLD){if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid manual camera hold.');this.hold=seconds;this.owned=this.returning=false;this.capture();}
 note(x,y,z,kind,at=this.time){if(!this.world||![x,y,z].every(Number.isFinite))return;const index=kind?this.deathCursor++%12:12+this.cursor++%12,offset=index*5;this.events.set([Number.isFinite(at)?at:this.time,x,y,z,kind],offset);}
 noteShot(matrix,at){if(matrix?.length===16)this.note(matrix[0]*12+matrix[4]*12+matrix[8]*12+matrix[12],matrix[1]*12+matrix[5]*12+matrix[9]*12+matrix[13],matrix[2]*12+matrix[6]*12+matrix[10]*12+matrix[14],0,at);}
 noteDeath(state,at){if(state)this.note(state.aimX??state.x,state.aimY??state.y,state.aimZ??state.z,1,at);}
 overview(){
  this.camera.overviewFrame(this.goal);this.overviewRadius=this.goal[3];
 }
 // Anticipate only guns near a CURRENT active front. Continuous route segments
 // cover corners without asking combat targeting/LOS to choose a camera subject.
 nearGun(gun,enemy){
  const range=gun.maxRange;if(!(range>0))return false;
  if((gun.x-enemy.x)**2+(gun.z-enemy.z)**2<=range*range)return true;
  const path=enemy.path,speed=enemy.movement?.speed;if(!path?.sample||!(speed>0))return false;
  let distance=clamp(enemy.distance,0,path.length),end=Math.min(path.length,distance+speed*3);
  path.sample(distance,this.futureA);
  // Play movement is capped at15u/s, so three seconds spans at most three
  //24u segments; the eight-segment guard bounds even malformed borrowed data.
  for(let step=0;step<8&&distance<end;step++){
   const next=Math.min(end,(Math.floor(distance/24)+1)*24);path.sample(next,this.futureB);
   if(segmentDistanceSquared(gun.x,gun.z,this.futureA[0],this.futureA[1],this.futureB[0],this.futureB[1])<=range*range)return true;
   this.futureA.set(this.futureB);distance=next;
  }
  return false;
 }
 compose(engine){
  const c=this.camera,width=this.world.width,length=this.world.length,y=this.world.level.pathHeight+8,aspect=c.canvas.clientWidth/Math.max(1,c.canvas.clientHeight),sin=Math.sin(c.yaw),cos=Math.cos(c.yaw),pitchSin=Math.sin(c.pitch),pitchCos=Math.cos(c.pitch);
  let weight=0,sumX=0,sumZ=0,minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity,count=0;
  const point=(x,py,z,w)=>{
   if(!Number.isFinite(x)||!Number.isFinite(py)||!Number.isFinite(z))return;
   const u=cos*x-sin*z,v=-sin*pitchSin*x+pitchCos*py-cos*pitchSin*z;
   minU=Math.min(minU,u);maxU=Math.max(maxU,u);minV=Math.min(minV,v);maxV=Math.max(maxV,v);sumX+=x*w;sumZ+=z*w;weight+=w;count++;
  };
  for(const enemy of engine?.enemies?.activeTargets??[]){
   if(enemy.phase!=='active'||enemy.health?.alive===false)continue;
   // Predict on the actual route, clamped at its exit; no wrap or velocity ray
   // through scenery at a bend. Keep the current torso in the safe frame too.
   let x=enemy.x,z=enemy.z;
   if(enemy.path?.sample&&Number.isFinite(enemy.distance)&&Number.isFinite(enemy.movement?.speed)){
    enemy.path.sample(Math.min(enemy.path.length,enemy.distance+enemy.movement.speed*.65),this.sample);x=this.sample[0];z=this.sample[1];
   }
   const seconds=enemy.movement?.speed>0?(enemy.path.length-enemy.distance)/enemy.movement.speed:Infinity,urgency=seconds<8?1.35:1;
   point(enemy.aimX??enemy.x,enemy.aimY??enemy.y,enemy.aimZ??enemy.z,.35*urgency);point(x,enemy.aimY??enemy.y,z,urgency);
  }
  for(const gun of engine?.firing?.states??[]){
   const engaged=gun.target?.phase==='active'&&gun.target.health?.alive!==false&&gun.lineOfSight===true&&gun.pitchReachable!==false;
   const approaching=engaged||(engine?.enemies?.activeTargets??[]).some(enemy=>enemy.phase==='active'&&enemy.health?.alive!==false&&this.nearGun(gun,enemy));
   if(approaching)point(gun.x,(gun.rig?.root[13]??this.world.level.pathHeight)+12,gun.z,.8);
  }
  for(let i=0;i<EVENTS;i++){
   const offset=i*5,age=this.time-this.events[offset],death=this.events[offset+4]===1,lifetime=death?4.5:1.2;
   if(age>=0&&age<lifetime)point(this.events[offset+1],this.events[offset+2],this.events[offset+3],death?1.6:.65);
  }
  this.pointCount=count;if(!count){this.overview();return;}
  // A mild landscape-centre bias keeps close-ups located in their surroundings.
  const x=clamp(sumX/weight*.92+width*.04,24,width-24),z=clamp(sumZ/weight*.92+length*.04,24,length-24),u=cos*x-sin*z,v=-sin*pitchSin*x+pitchCos*y-cos*pitchSin*z;
  const radius=Math.max(MIN_ACTION_RADIUS,(Math.max(u-minU,maxU-u)+34)/aspect,Math.max(v-minV,maxV-v)+38);
  this.goal.set([x,y,z,radius]);
 }
 advance(dt,{engine,phase,paused=false}={}){
  if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid action-camera delta.');
  if(!this.world||paused||!dt)return false;
  // PlayEngine may carry combat backlog after a long browser frame. Age camera
  // interests from the simulation it actually advanced, not the raw frame gap.
  if(Number.isFinite(engine?.time)){
   dt=Math.max(0,engine.time-(this.engineTime??Math.max(0,engine.time-dt)));this.engineTime=engine.time;this.time=engine.time;
  }else this.time+=dt;
  const active=running(phase),previous=this.wasRunning;this.wasRunning=active;
  const oldPhase=this.phase;this.phase=phase;
  if(!active&&previous){this.returning=this.owned&&this.enabled&&this.hold<=0;this.settleGoal=false;}
  if(this.hold>0){this.hold=Math.max(0,this.hold-dt);this.capture();return false;}
  if(!this.enabled||phase==='title'||(!active&&!this.returning)||this.camera.mode!=='overview')return false;
  if(!this.owned){this.capture();this.owned=true;}
  this.overview();
  if(active){
   if(phase==='settling'&&this.settleGoal){this.goal.set(this.settleGoal);}
   else{this.compose(engine);if(phase==='settling'){this.settleGoal=Float64Array.from(this.goal);}}
   if(phase==='wave'&&oldPhase!=='wave')this.settleGoal=false;
  }
  // Long frame gaps may age interest, but cannot cause a violent camera leap.
  this.accumulator+=Math.min(dt,.25);
  while(this.accumulator+1e-12>=TICK){
   this.accumulator-=TICK;
   for(let i=0;i<4;i++){
    const p=this.position[i],v=this.velocity[i],goal=this.goal[i],omega=i===3?1.8:2.2,e=Math.exp(-omega*TICK),error=p-goal,j=v+omega*error;
    let next=(error+j*TICK)*e+goal,nextV=(v-omega*j*TICK)*e;
    const speed=i===3?(goal>p?90:42):72,acceleration=i===3?120:150,bounded=clamp(clamp(nextV,-speed,speed),v-acceleration*TICK,v+acceleration*TICK);
    if(bounded!==nextV){nextV=bounded;next=p+(v+nextV)*TICK/2;}
    const lo=i===3?Math.min(MIN_ACTION_RADIUS,this.start[3]):Math.min(0,this.start[i]),hi=i===3?Math.max(this.overviewRadius,this.goal[3],this.start[3]):Math.max(this.start[i],i===0?this.world.width:i===2?this.world.length:128);
    this.position[i]=clamp(next,lo,hi);this.velocity[i]=this.position[i]===next?nextV:0;
   }
  }
  const changed=this.camera.radius!==this.position[3]||this.camera.target.some((value,i)=>Math.abs(value-this.position[i])>1e-6);
  this.camera.target.set(this.position.subarray(0,3));this.camera.radius=this.position[3];if(changed)this.camera.invalidate();
  if(!active&&this.returning&&this.position.every((value,i)=>Math.abs(value-this.goal[i])<.03)&&this.velocity.every(value=>Math.abs(value)<.03)){this.returning=this.owned=false;this.velocity.fill(0);}
  return changed;
 }
 stats(){return {enabled:this.enabled,owned:this.owned,returning:this.returning,hold:this.hold,focus:Array.from(this.goal.subarray(0,3)),radiusGoal:this.goal[3],points:this.pointCount,time:this.time};}
 dispose(){if(!this.camera)return;this.bind(null);this.camera=null;}
}
