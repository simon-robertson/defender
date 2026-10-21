import {test,expect} from 'bun:test';
import {PitchTracker} from '../engine/pitch.js';
import {TurretPreview} from '../game/turret-preview.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {Health} from '../engine/health.js';
import {TURRET_PITCH,TURRET_TURN,TURRET_MUZZLES,TURRET_RECOIL,TURRET_AIM_TOLERANCE} from '../shared/arsenal.js';
import {placementMatrix} from '../shared/math.js';
import {turretModel} from '../scripts/turret.js';

const model=turretModel(),radians=degrees=>degrees*Math.PI/180;
function fixture(variant='upgrade1',turn=0,{visibility={clear:()=>true},onShot=null,onHit=null}={}){
 const root=placementMatrix([2,1,3],turn),parts=model.variants[variant].parts,targets=[];
 const instances=parts.map((part,index)=>({part:part.id,key:part.id,index,matrix:new Float32Array(root)}));
 const world={level:{placements:[{id:'gun',model:'turret-study',variant}]},rigs:new Map([['gun',{root,parts,instances}]]),visibility};
 const preview=new TurretPreview(world,()=>{},()=>.5,onShot,targets,onHit);
 return {preview,state:preview.states[0],targets};
}
function targetAt(state,yaw,pitch,distance=36){
 const root=state.rig.root,dx=-Math.sin(yaw),dz=-Math.cos(yaw);
 return {id:'enemy',x:state.x+(root[0]*dx+root[8]*dz)*distance,z:state.z+(root[2]*dx+root[10]*dz)*distance,aimY:root[13]+state.gunPivot[1]+Math.tan(pitch)*(distance+state.gunPivot[2]-state.pivot[2])};
}
function point(matrix,position,axis){return matrix[axis]*position[0]+matrix[4+axis]*position[1]+matrix[8+axis]*position[2]+matrix[12+axis];}

test('pitch servo preserves momentum but never crosses mechanical bounds during reversals, braking or stalls',()=>{
 expect(Object.isFrozen(TURRET_PITCH)).toBe(true);expect(TURRET_TURN.part).toBe('head');expect(TURRET_RECOIL.part).toBe(TURRET_PITCH.part);
 for(const dt of [1/30,1/60,1/144,.073]){
  const servo=new PitchTracker(TURRET_PITCH);let maxSpeed=0,maxAcceleration=0;
  for(let frame=0;frame<1600;frame++){
   const before=servo.velocity,target=(frame%73<36?1:-1)*TURRET_PITCH.max;
   if(frame%11===0)servo.brake(dt);else servo.track(target,dt);
   expect(servo.angle).toBeGreaterThanOrEqual(TURRET_PITCH.min);expect(servo.angle).toBeLessThanOrEqual(TURRET_PITCH.max);
   maxSpeed=Math.max(maxSpeed,Math.abs(servo.velocity));maxAcceleration=Math.max(maxAcceleration,Math.abs(servo.velocity-before)/dt);
  }
  expect(maxSpeed).toBeLessThanOrEqual(TURRET_PITCH.maxSpeed+1e-9);expect(maxAcceleration).toBeLessThanOrEqual(TURRET_PITCH.acceleration+1e-7);
  servo.track(TURRET_PITCH.min,100);expect(servo.angle).toBeCloseTo(TURRET_PITCH.min,12);expect(servo.velocity).toBe(0);
  servo.track(TURRET_PITCH.max,100);servo.brake(100);expect(servo.angle).toBeCloseTo(TURRET_PITCH.max,12);expect(servo.active).toBe(false);
 }
 const servo=new PitchTracker(TURRET_PITCH);servo.track(.3,.03);const velocity=servo.velocity,angle=servo.angle;servo.track(-.3,0);
 expect(servo.velocity).toBe(velocity);expect(servo.angle).toBe(angle);servo.track(-.3,.01);expect(servo.velocity).toBeGreaterThan(0);
 for(const angle of [NaN,Infinity,TURRET_PITCH.min-1e-6,TURRET_PITCH.max+1e-6])expect(()=>servo.track(angle,.1)).toThrow();
 for(const dt of [-1,NaN,Infinity])expect(()=>servo.track(0,dt)).toThrow();
 expect(()=>new PitchTracker({...TURRET_PITCH,min:1})).toThrow();
});

test('pitch integration agrees across frame subdivisions within the hard stops',()=>{
 for(const target of [TURRET_PITCH.min,TURRET_PITCH.max,.03])for(const time of [.07,.21,.7]){
  const reference=new PitchTracker(TURRET_PITCH);reference.track(.3,.04);reference.track(target,time);
  for(const dt of [1/30,1/60,1/144,.073]){
   const servo=new PitchTracker(TURRET_PITCH);servo.track(.3,.04);let elapsed=0;
   while(elapsed<time){const step=Math.min(dt,time-elapsed);servo.track(target,step);elapsed+=step;}
   expect(servo.angle).toBeCloseTo(reference.angle,9);expect(servo.velocity).toBeCloseTo(reference.velocity,9);
  }
 }
});

test('real gun joints aim their shared centreline above and below across every placed root turn',()=>{
 for(const variant of ['base','upgrade1'])for(const turn of [0,1,2,3])for(const pitch of [radians(-30),radians(30)]){
  const effects=new ShotEffects(()=>.5),events=[],rays=[];
  const f=fixture(variant,turn,{onShot:(variant,matrix,at)=>{events.push(matrix);effects.emit(matrix,TURRET_MUZZLES[variant],at);},visibility:{clear:(...ray)=>{rays.push(ray);return true;}}});
  const {preview,state,targets}=f,target=targetAt(state,.7,pitch);targets.push(target);
  effects.advance(1);preview.advance(1);effects.prepare();expect(events.length).toBe(1);expect(events[0]).toBe(state.gunMatrix);expect(state.gunMatrix).not.toBe(state.headMatrix);
  expect(state.targetPitch).toBeCloseTo(pitch,10);expect(state.pitch.angle).toBeCloseTo(pitch,10);expect(state.lastShotPitchError).toBeCloseTo(0,10);
  expect(state.headMatrix[9]).toBe(0);expect(state.gunMatrix[9]).not.toBe(0);
  const sockets=TURRET_MUZZLES[variant],mid=sockets[0].map((value,axis)=>(value+sockets[1][axis])/2),targetPoint=[target.x,target.aimY,target.z];
  const direction=targetPoint.map((value,axis)=>value-point(state.gunMatrix,mid,axis)),length=Math.hypot(...direction);
  for(let axis=0;axis<3;axis++){
   expect(-state.gunMatrix[8+axis]).toBeCloseTo(direction[axis]/length,5);
   expect(effects.instanceData[4+axis]).toBeCloseTo(-state.gunMatrix[8+axis],6);
  }
  // Fixed random .5 gives speed18; spread is perpendicular to the barrel axis.
  let forwardSpeed=0;for(let axis=0;axis<3;axis++)forwardSpeed-=state.gunMatrix[8+axis]*effects.sparks[3+axis];expect(forwardSpeed).toBeCloseTo(18,5);
  for(let i=0;i<2;i++)for(let axis=0;axis<3;axis++)expect(rays[rays.length-2+i][axis]).toBeCloseTo(point(state.gunMatrix,sockets[i],axis),4);
  const head=Array.from(state.headMatrix),guns=Array.from(state.gunMatrix);effects.advance(.045);preview.advance(.045);effects.prepare();
  expect(Array.from(state.headMatrix)).toEqual(head);expect(state.displacement).toBe(1.25);
  for(let axis=0;axis<3;axis++)expect(state.gunMatrix[12+axis]-guns[12+axis]).toBeCloseTo(guns[8+axis]*1.25,4);
  for(let axis=0;axis<3;axis++)expect(effects.lightData[4+axis]).toBeCloseTo(point(state.gunMatrix,sockets[0],axis)-state.gunMatrix[8+axis]*3.15,4);
  expect(effects.flashMatrix[0]).toBe(state.gunMatrix);preview.dispose();effects.reset();expect(effects.flashMatrix.every(matrix=>matrix===null)).toBe(true);
 }
});

test('mechanically unreachable and missing heights cannot damage even with LOS disabled; reachable alternatives remain selectable',()=>{
 for(const pitch of [radians(-35.01),radians(35.01),NaN]){
  let hits=0;const {preview,state,targets}=fixture('base',0,{onHit:()=>{hits++;}});
  const bad=targetAt(state,0,pitch);bad.threat=100;state.requiresLineOfSight=false;targets.push(bad);preview.advance(10);
  expect(state.target).toBeNull();expect(state.cycle.shots).toBe(0);expect(hits).toBe(0);
  const good=targetAt(state,0,radians(-20));good.id='reachable';targets.push(good);preview.advance(1);
  expect(state.target).toBe(good);expect(state.cycle.shots).toBe(1);expect(hits).toBe(1);preview.dispose();
 }
 for(const pitch of [TURRET_PITCH.min,TURRET_PITCH.max]){
  const {preview,state,targets}=fixture();targets.push(targetAt(state,0,pitch));preview.advance(1);
  expect(state.target).toBe(targets[0]);expect(state.pitchReachable).toBe(true);expect(state.cycle.shots).toBe(1);preview.dispose();
 }
});

test('candidate pitch is separate from actual pose; height changes cancel bursts until both axes align',()=>{
 const rays=[],events=[];let actualBlocked=true;
 const {preview,state,targets}=fixture('upgrade1',0,{onShot:(variant,matrix,at)=>events.push({matrix:Array.from(matrix),at}),visibility:{clear:(...ray)=>{rays.push(ray);return !actualBlocked||rays.length<=2;}}});
 const target=targetAt(state,0,radians(-25));targets.push(target);preview.advance(0);
 expect(state.target).toBe(target);expect(state.lineOfSight).toBe(false);expect(state.cycle.shots).toBe(0);expect(state.aimError).toBeCloseTo(0,12);expect(Math.abs(state.pitchError)).toBeGreaterThan(TURRET_PITCH.tolerance);
 expect(rays[0][1]).not.toBe(rays[2][1]);actualBlocked=false;rays.length=0;preview.advance(1);
 expect(events.length).toBe(1);expect(state.cycle.remaining).toBe(2);
 state.recoil.fire(state.cycle.time);rays.length=0;preview.advance(.12);expect(events.length).toBe(2);
 const matrix=events[1].matrix;for(let i=0;i<2;i++)for(let axis=0;axis<3;axis++)expect(rays[rays.length-2+i][axis]).toBeCloseTo(point(matrix,state.muzzles[i],axis),4);
 Object.assign(target,targetAt(state,0,radians(30)));preview.advance(.12);expect(events.length).toBe(2);expect(state.cycle.remaining).toBe(0);expect(state.aimError).toBeCloseTo(0,12);expect(Math.abs(state.pitchError)).toBeGreaterThan(TURRET_PITCH.tolerance);
 preview.advance(100);expect(events.length).toBe(3);expect(state.lastShotPitchError).toBeCloseTo(0,10);expect(Math.abs(state.lastShotAimError)).toBeLessThanOrEqual(TURRET_AIM_TOLERANCE);
 preview.advance(.119);expect(events.length).toBe(3);preview.advance(.002);expect(events.length).toBe(4);expect(events[3].at-events[2].at).toBeGreaterThanOrEqual(.12);preview.dispose();
});

test('reset and lethal hits clear pitch lock state while preserving weapon time, rig matrices and bounded braking',()=>{
 const {preview,state,targets}=fixture('upgrade1',0,{onHit:(target,strength)=>target.health.takeDamage(strength)}),target=targetAt(state,0,radians(-25));target.health=new Health(300);targets.push(target);
 const head=state.headMatrix,guns=state.gunMatrix,pitch=state.pitch,queue=state.pendingTimes;preview.advance(1);const time=state.cycle.time,angle=pitch.angle;
 preview.resetTargets();expect(state.target).toBeNull();expect(state.pitchError).toBeNull();expect(state.targetPitch).toBeNull();expect(state.cycle.time).toBe(time);expect(pitch.angle).toBe(angle);expect(state.cycle.remaining).toBe(0);
 target.health.current=12;preview.advance(2);expect(target.health.alive).toBe(false);expect(state.target).toBeNull();expect(state.pitchError).toBeNull();expect(state.cycle.remaining).toBe(0);const shots=state.cycle.shots;
 preview.advance(100);expect(state.cycle.shots).toBe(shots);expect(pitch.reachable(pitch.angle)).toBe(true);expect(state.headMatrix).toBe(head);expect(state.gunMatrix).toBe(guns);expect(state.pitch).toBe(pitch);expect(state.pendingTimes).toBe(queue);
 preview.dispose();expect(state.target).toBeNull();expect(preview.states.length).toBe(0);expect(preview.targets).toBeNull();expect(preview.visibility).toBeNull();expect(preview.onShot).toBeNull();expect(preview.onHit).toBeNull();
});
