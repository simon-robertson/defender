import {test,expect} from 'bun:test';
import {YawTracker,yawError} from '../engine/turn.js';
import {WeaponCycle} from '../engine/weapon.js';
import {DefenceAim} from '../engine/targeting.js';
import {TurretPreview} from '../game/turret-preview.js';
import {DogPreview,DOG_PREVIEW_ACTORS} from '../game/dog-preview.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {TURRET_TURN,TURRET_PITCH,TURRET_FIRING,TURRET_RECOIL,TURRET_MUZZLES,TURRET_AIM_TOLERANCE} from '../shared/arsenal.js';
import {PathMotion} from '../engine/path-motion.js';
import {DEFENCE_STATS} from '../shared/defence.js';
import {DOG_WALK} from '../engine/dog-gait.js';
import {newLevel} from '../shared/level.js';
import {newModel} from '../shared/model.js';
import {placementMatrix} from '../shared/math.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {firstLevel,sceneryModels} from '../scripts/first-level.js';
import {dogModel} from '../scripts/dog.js';

function fixture(variant='base',targets=[],onShot=null,turn=0,visibility={clear:()=>true}){
 const gunY=TURRET_MUZZLES[variant][0][1];for(const target of targets)target.aimY??=24+gunY;
 const root=placementMatrix([0,1,0],turn),parts=[{id:'base',parent:null,pivot:[12,0,12]},{id:'head',parent:'base',pivot:[12,17,12]},{id:'guns',parent:'head',pivot:[12,gunY,15]}],instances=parts.map((part,index)=>({part:part.id,key:part.id,index,matrix:new Float32Array(root)}));
 const world={level:{placements:[{id:'turret',model:'turret-study',variant}]},rigs:new Map([['turret',{root,parts,instances}]]),visibility};
 return new TurretPreview(world,()=>{},()=>.5,onShot,targets);
}

test('continuous yaw retains momentum through retargets while respecting speed and acceleration caps',()=>{
 const aim=new YawTracker(TURRET_TURN);aim.track(Math.PI/2,.06);const velocity=aim.velocity,yaw=aim.yaw;expect(velocity).toBeGreaterThan(0);
 aim.track(-Math.PI/2,0);expect(aim.velocity).toBe(velocity);expect(aim.yaw).toBe(yaw);
 aim.track(-Math.PI/2,.01);expect(aim.velocity).toBeGreaterThan(0);expect(aim.velocity).toBeLessThan(velocity);expect(aim.yaw).toBeGreaterThan(yaw);
 for(const step of [1/30,1/60,1/144]){
  const tracker=new YawTracker(TURRET_TURN);let largestSpeed=0,largestAcceleration=0;
  for(let frame=0;frame<900;frame++){
   const previous=tracker.velocity,target=Math.sin(frame*.04)*Math.PI;tracker.track(target,step);
   largestSpeed=Math.max(largestSpeed,Math.abs(tracker.velocity));largestAcceleration=Math.max(largestAcceleration,Math.abs(tracker.velocity-previous)/step);
  }
  expect(largestSpeed).toBeLessThanOrEqual(TURRET_TURN.maxSpeed+1e-9);expect(largestAcceleration).toBeLessThanOrEqual(TURRET_TURN.acceleration+1e-8);
  tracker.brake(10);expect(tracker.velocity).toBe(0);expect(tracker.active).toBe(false);
 }
 for(const delta of [-1,Infinity,NaN])expect(()=>aim.track(0,delta)).toThrow();expect(()=>aim.track(NaN,.1)).toThrow();
});

test('static target tracking is independent of frame subdivisions with initial motion and angle wrapping',()=>{
 for(const [yaw,velocity,target]of [[0,0,Math.PI/2],[0,2,1],[0,2,-1],[0,4,.02],[3,1,-3]])for(const time of [.13,.37,.8]){
  const reference=new YawTracker(TURRET_TURN);reference.yaw=yaw;reference.velocity=velocity;reference.track(target,time);
  for(const step of [1/30,1/60,1/144,.073]){
   const aim=new YawTracker(TURRET_TURN);aim.yaw=yaw;aim.velocity=velocity;let elapsed=0;
   while(elapsed<time){const dt=Math.min(step,time-elapsed);aim.track(target,dt);elapsed+=dt;}
   expect(yawError(aim.yaw,reference.yaw)).toBeCloseTo(0,8);expect(aim.velocity).toBeCloseTo(reference.velocity,8);
  }
 }
});

test('live targeting retains valid targets, uses stable-ID ties and includes the exact range boundary',()=>{
 const targets=[{id:'z',x:12,z:-36},{id:'a',x:12,z:-36}],preview=fixture('base',targets),state=preview.states[0];preview.advance(.01);
 expect(state.target.id).toBe('a');expect(state.targetDistance).toBe(48);expect(state.maxRange).toBe(48);expect(state.strength).toBe(10);expect(state.cycle.shots).toBe(1);
 targets[0].z=-12;preview.advance(.01);expect(state.target.id).toBe('a'); // Keep an eligible lock, even if another target is nearer.
 targets[1].z=-36.000001;preview.advance(.01);expect(state.target.id).toBe('z');
 targets.length=0;preview.advance(10);expect(state.target).toBeNull();expect(state.targetDistance).toBeNull();expect(state.cycle.remaining).toBe(0);expect(state.cycle.shots).toBe(1);
 expect(DEFENCE_STATS['turret-study'].upgrade1.maxRange).toBe(72);expect(DEFENCE_STATS['turret-study'].upgrade2.maxRange).toBe(96);
});

test('aiming accounts for the placed root rotation and cannot fire before live alignment',()=>{
 const target={id:'dog',x:42,z:12};
 for(const turn of [0,1,2,3]){
  const preview=fixture('base',[target],null,turn),state=preview.states[0];preview.advance(.01);
  if(turn!==1)expect(state.cycle.shots).toBe(0);
  for(let frame=0;frame<60;frame++)preview.advance(1/60);
  const matrix=state.headMatrix,dx=target.x-state.x,dz=target.z-state.z,distance=Math.hypot(dx,dz);
  expect(-matrix[8]).toBeCloseTo(dx/distance,5);expect(-matrix[10]).toBeCloseTo(dz/distance,5);
  expect(state.cycle.shots).toBeGreaterThan(0);expect(Math.abs(state.lastShotAimError)).toBeLessThanOrEqual(TURRET_AIM_TOLERANCE);expect(state.lastShotTargetId).toBe('dog');
 }
});

test('candidate scans retain the selected projectile solution and reject unreachable locks',()=>{
 const near={id:'near',x:12,z:-12,velocityX:12,velocityZ:0},far={id:'far',x:12,z:-24,velocityX:0,velocityZ:0},outside={id:'outside',x:100,z:12,velocityX:0,velocityZ:0};
 const preview=fixture('base',[near,far,outside]),state=preview.states[0];
 // Exercise future projectile aiming without changing any shipped weapon rule.
 state.targeting=new DefenceAim({delivery:'projectile',projectile:{speedUnitsPerSecond:30}},48);
 const reference=new DefenceAim({delivery:'projectile',projectile:{speedUnitsPerSecond:30}},48);reference.solve(state.x,state.z,near);
 const scratch=state.targeting.point;
 expect(preview.selectTarget(state)).toBe(near);expect(Array.from(scratch)).toEqual(Array.from(reference.point));
 state.target=far;expect(preview.selectTarget(state)).toBe(far);expect(scratch[0]).toBe(far.x);expect(scratch[1]).toBe(far.z);
 far.velocityZ=-100;expect(preview.selectTarget(state)).toBe(near);expect(Array.from(scratch)).toEqual(Array.from(reference.point));
 near.velocityX=100;expect(preview.selectTarget(state)).toBeNull();expect(Array.from(scratch)).toEqual([0,0,0]);expect(state.targeting.point).toBe(scratch);
 preview.dispose();
});

test('obstruction drops a lock, selects a visible in-range dog and cancels the old burst',()=>{
 const near={id:'near',x:12,z:-12},far={id:'far',x:12,z:-24},outside={id:'outside',x:12,z:-100},targets=[near,far,outside];
 let blocked=null;
 const visibility={clear:(ox,oy,oz,x,y,z)=>blocked!=='all'&&z!==blocked};
 const preview=fixture('upgrade1',targets,null,0,visibility),state=preview.states[0];
 preview.advance(.01);expect(state.target).toBe(near);expect(state.cycle.shots).toBe(1);expect(state.cycle.remaining).toBe(2);
 blocked=near.z;preview.advance(.12);expect(state.target).toBe(far);expect(state.occludedTargets).toBe(1);expect(state.cycle.remaining).toBe(0);expect(state.cycle.shots).toBe(1);
 expect(state.cycle.readyAt).toBeCloseTo(1.01,10);preview.advance(.9);expect(state.cycle.shots).toBe(2);expect(state.lastShotTargetId).toBe('far');expect(state.lastShotVisible).toBe(true);
 blocked='all';preview.advance(.12);expect(state.target).toBeNull();expect(state.lineOfSight).toBeNull();expect(state.cycle.remaining).toBe(0);expect(state.cycle.shots).toBe(2);
 blocked=null;preview.advance(1);expect(state.target).toBe(near);expect(state.cycle.shots).toBe(3);
 preview.dispose();expect(preview.visibility).toBeNull();
});

test('both muzzle lines are required, while LOS is an explicit per-defence policy',()=>{
 const target={id:'dog',x:12,z:-18};let calls=0;
 const preview=fixture('base',[target],null,0,{clear:()=>++calls%2===1}),state=preview.states[0];
 preview.advance(.01);expect(calls).toBe(2);expect(state.target).toBeNull();expect(state.cycle.shots).toBe(0);
 state.requiresLineOfSight=false;preview.advance(.01);expect(state.target).toBe(target);expect(state.cycle.shots).toBe(1);expect(calls).toBe(2);
 state.requiresLineOfSight=true;delete target.aimY;preview.advance(2);expect(state.target).toBeNull();expect(state.cycle.shots).toBe(1);
 expect(()=>fixture('base',[target],null,0,null)).toThrow('scene visibility');
});

test('LOS acquires from candidate-facing muzzles but checks actual yaw and recoil before a pulse',()=>{
 const target={id:'dog',x:12,z:-18};let phase='clear';const rays=[],events=[];
 const preview=fixture('upgrade1',[target],(variant,matrix,at)=>events.push({matrix:Array.from(matrix),at}),0,{clear:(...ray)=>{rays.push(ray);return phase==='clear'||rays.length<=2;}}),state=preview.states[0];
 state.aim.yaw=.02;
 phase='actual blocked';preview.advance(0);expect(state.target).toBe(target);expect(state.lineOfSight).toBe(false);expect(state.cycle.shots).toBe(0);expect(Math.abs(state.aimError)).toBeLessThan(TURRET_AIM_TOLERANCE);
 expect(rays[0][0]).not.toBe(rays[2][0]); // Desired-facing and actual-facing origins differ.
 phase='clear';rays.length=0;preview.advance(.1);expect(events.length).toBe(1);
 state.recoil.fire(state.cycle.time);rays.length=0;preview.advance(.12);expect(events.length).toBe(2);
 const matrix=events[1].matrix;
 for(let i=0;i<2;i++){
  const muzzle=TURRET_MUZZLES.upgrade1[i],ray=rays[rays.length-2+i];
  for(let axis=0;axis<3;axis++)expect(ray[axis]).toBeCloseTo(matrix[axis]*muzzle[0]+matrix[4+axis]*muzzle[1]+matrix[8+axis]*muzzle[2]+matrix[12+axis],5);
  expect(ray.slice(3)).toEqual([target.x,target.aimY,target.z]);
 }
});

test('live burst pulses revalidate alignment and cancel after target departure, removal or replacement',()=>{
 for(const change of ['range','turn','remove','replace']){
  const dog={id:'dog',x:12,z:-18},targets=[dog],events=[],preview=fixture('upgrade1',targets,(variant,matrix,at)=>events.push(at)),state=preview.states[0];preview.advance(.01);expect(events.length).toBe(1);
  if(change==='range')dog.x=200;
  else if(change==='turn'){dog.x=42;dog.z=12;}
  else if(change==='remove')targets.length=0;
  else targets[0]={id:'dog-new',x:12,z:-18,aimY:dog.aimY};
  preview.advance(.12);expect(events.length).toBe(1);expect(state.cycle.remaining).toBe(0);expect(state.cycle.readyAt).toBeCloseTo(events[0]+1,10);
 }
});

test('live weapon stalls emit at most one currently validated shot and never compress pending burst gaps',()=>{
 const events=[],weapon=new WeaponCycle(TURRET_FIRING.upgrade1,at=>events.push(at));weapon.trigger();weapon.advanceLive(100,true);
 expect(events).toEqual([0,100]);expect(weapon.remaining).toBe(1);weapon.advanceLive(.119,true);expect(events.length).toBe(2);weapon.advanceLive(.002,true);expect(events.length).toBe(3);expect(events[2]-events[1]).toBeGreaterThanOrEqual(.12);
 expect(weapon.readyAt).toBeCloseTo(events[2]+1,10);
 const invalid=[],cancelled=new WeaponCycle(TURRET_FIRING.upgrade1,at=>invalid.push(at));cancelled.trigger();cancelled.advanceLive(100,false);expect(invalid).toEqual([0]);expect(cancelled.remaining).toBe(0);expect(cancelled.ready).toBe(true);
 const effects=new ShotEffects(()=>.5),dog={id:'dog',x:12,z:-18},targets=[dog],times=[],preview=fixture('upgrade1',targets,(variant,matrix,at)=>{times.push(at);effects.emit(matrix,TURRET_MUZZLES[variant],at);});
 effects.advance(.01);preview.advance(.01);effects.prepare();expect(effects.lightCount).toBe(2);dog.x=300;
 effects.advance(100);preview.advance(100);effects.prepare();expect(times.length).toBe(1);expect(effects.instanceCount).toBe(0);expect(effects.lightCount).toBe(0);
});

test('the real dog loop is tracked with bounded errors and valid shot snapshots while reusing rig state',async()=>{
 const models=new Map(sceneryModels().map(model=>[model.id,model]));models.set('dog',dogModel());models.set('turret-study',await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json());
 models.set('power-generator',await Bun.file(new URL('../assets/models/power-generator.json',import.meta.url)).json());
 const world=buildWorld(firstLevel(),models,{actors:DOG_PREVIEW_ACTORS}),dogs=new DogPreview(world,()=>{});let verifiedMuzzles=0;
 const turrets=new TurretPreview(world,()=>{},()=>.5,(variant,matrix)=>{
  const state=turrets.states.find(s=>s.gunMatrix===matrix),target=state.target;
  for(const muzzle of TURRET_MUZZLES[variant]){
   const x=matrix[0]*muzzle[0]+matrix[4]*muzzle[1]+matrix[8]*muzzle[2]+matrix[12],y=matrix[1]*muzzle[0]+matrix[5]*muzzle[1]+matrix[9]*muzzle[2]+matrix[13],z=matrix[2]*muzzle[0]+matrix[6]*muzzle[1]+matrix[10]*muzzle[2]+matrix[14];
   expect(world.visibility.clear(x,y,z,target.x,target.aimY,target.z)).toBe(true);verifiedMuzzles++;
  }
 },dogs.states),matrices=turrets.states.map(state=>state.headMatrix),queues=turrets.states.map(state=>state.pendingTimes);
 let validShots=0,trackedSamples=0,largestSettledError=0;const lastTarget=turrets.states.map(()=>null),heldTime=turrets.states.map(()=>0),lastShots=turrets.states.map(()=>0);
 for(let frame=0;frame<Math.ceil(dogs.path.length/DOG_WALK.speed*60);frame++){
  dogs.advance(1/60);turrets.advance(1/60);
  for(let i=0;i<turrets.states.length;i++){
   const state=turrets.states[i];heldTime[i]=state.target&&state.target===lastTarget[i]?heldTime[i]+1/60:0;lastTarget[i]=state.target;
   if(state.target){expect(state.targetDistance).toBeLessThanOrEqual(state.maxRange);if(heldTime[i]>.8){largestSettledError=Math.max(largestSettledError,Math.abs(state.aimError));trackedSamples++;}}
   if(state.cycle.shots!==lastShots[i]){expect(state.cycle.shots-lastShots[i]).toBe(1);expect(state.lastShotDistance).toBeLessThanOrEqual(state.maxRange);expect(Math.abs(state.lastShotAimError)).toBeLessThanOrEqual(TURRET_AIM_TOLERANCE);expect(state.lastShotTargetId).toBe(state.target.id);validShots++;lastShots[i]=state.cycle.shots;}
  }
 }
 expect(validShots).toBeGreaterThan(10);expect(verifiedMuzzles).toBe(validShots*2);expect(trackedSamples).toBeGreaterThan(100);expect(largestSettledError).toBeLessThan(TURRET_AIM_TOLERANCE);
 for(let i=0;i<3;i++){expect(turrets.states[i].headMatrix).toBe(matrices[i]);expect(turrets.states[i].pendingTimes).toBe(queues[i]);}
 const states=turrets.states.slice(),visibility=world.visibility;turrets.dispose();expect(turrets.targets).toBeNull();expect(turrets.visibility).toBeNull();expect(states.every(state=>state.target===null)).toBe(true);dogs.dispose();disposeWorld(world);expect(world.visibility).toBeNull();expect(visibility.byteLength).toBe(0);
});

test('occupied scenery blocks a target at the exact range boundary and a clear dog replaces that lock',async()=>{
 const wall=newModel('sight-wall');wall.role='scenery';
 for(let y=0;y<24;y++)for(let z=0;z<24;z++)wall.variants.base.parts[0].voxels.push([12,y,z,0]);
 const level=newLevel('sight-level');level.size=[8,8];level.placements=[
  {id:'turret',model:'turret-study',variant:'upgrade1',box:[3,0,3],turn:0},
  {id:'wall',model:wall.id,variant:'base',box:[5,0,3],turn:0}
 ];
 const models=new Map([[wall.id,wall],['turret-study',await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json()]]);
 const world=buildWorld(level,models),blocked={id:'blocked',x:156,z:84,aimY:34.5},clear={id:'clear',x:84,z:36,aimY:34.5},targets=[blocked];
 const preview=new TurretPreview(world,()=>{},()=>.5,null,targets),state=preview.states.find(s=>s.variant==='upgrade1');
 expect(state.maxRange).toBe(72);expect(Math.hypot(blocked.x-state.x,blocked.z-state.z)).toBe(72);
 for(const recoil of [0,1.25]){expect(preview.selectTarget(state,recoil)).toBeNull();expect(state.occludedTargets).toBe(1);}
 state.target=blocked;targets.push(clear);expect(preview.selectTarget(state)).toBe(clear);
 preview.advance(1);expect(state.target).toBe(clear);expect(state.cycle.shots).toBe(1);expect(state.lastShotVisible).toBe(true);
 preview.dispose();disposeWorld(world);
});

test('A showcase and alternative plots retain actual muzzle sightlines and complete yaw/pitch/recoil sweep clearance',async()=>{
 const models=new Map(sceneryModels().map(model=>[model.id,model])),turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json();models.set(turret.id,turret);
 models.set('power-generator',await Bun.file(new URL('../assets/models/power-generator.json',import.meta.url)).json());
 const world=buildWorld(firstLevel(),models),preview=new TurretPreview(world,()=>{},()=>.5,null,[]),path=new PathMotion(world.level.path),sample=new Float64Array(5),target={id:'probe',x:0,z:0,aimY:34.5};
 try{
  for(const [x,z] of [[2,6],[5,6],[6,6],[7,6],[5,10],[9,10],[13,10]])for(const variant of ['base','upgrade1']){
   // Alternatives are inspected one at a time. This does not assert that two
   // neighbouring full-size defences can be deployed simultaneously.
   const template=preview.states.find(state=>state.variant===variant),root=new Float32Array(template.rig.root),cx=(x+.5)*24,cz=(z+.5)*24;
   root[12]+=cx-template.x;root[14]+=cz-template.z;
   const state={...template,x:cx,z:cz,rig:{root},targeting:new DefenceAim(TURRET_FIRING[variant],template.maxRange)};
   let samples=0,blocked=0;
   for(let distance=0;distance<=path.length;distance++){
    path.sample(distance,sample);target.x=sample[0];target.z=sample[1];if(!state.targeting.solve(cx,cz,target))continue;
    samples++;const yaw=preview.targetYaw(state),pitch=preview.targetPitch(state,target,yaw);for(const recoil of [0,.625,1.25])if(!preview.hasSight(state,target,yaw,pitch,recoil))blocked++;
   }
   expect(samples).toBeGreaterThan(0);expect(blocked).toBe(0);
   // Continuous extrema of a*cos(pitch)+b*sin(pitch), including endpoints
   // and stationary points. The enclosing cylinder covers all yaw headings.
   const limits=(a,b)=>{
    let min=Infinity,max=-Infinity;
    const include=angle=>{const value=a*Math.cos(angle)+b*Math.sin(angle);min=Math.min(min,value);max=Math.max(max,value);};
    include(TURRET_PITCH.min);include(TURRET_PITCH.max);
    for(let k=-1;k<=1;k++){const angle=Math.atan2(b,a)+k*Math.PI;if(angle>TURRET_PITCH.min&&angle<TURRET_PITCH.max)include(angle);}
    return [min,max];
   };
   const head=turret.variants[variant].parts.find(part=>part.id==='head'),guns=turret.variants[variant].parts.find(part=>part.id==='guns');let radius=0,bottom=Infinity,top=-Infinity;
   for(const cell of head.voxels){bottom=Math.min(bottom,cell[1]+24);top=Math.max(top,cell[1]+25);for(const dx of [0,1])for(const dz of [0,1])radius=Math.max(radius,Math.hypot(cell[0]+dx-head.pivot[0],cell[2]+dz-head.pivot[2]));}
   for(const cell of guns.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1])for(const recoil of [0,TURRET_RECOIL.distance]){
    const y=cell[1]+dy-guns.pivot[1],z=cell[2]+dz-guns.pivot[2]+recoil,ys=limits(y,-z),zs=limits(z,y);
    bottom=Math.min(bottom,24+guns.pivot[1]+ys[0]);top=Math.max(top,24+guns.pivot[1]+ys[1]);
    for(const extent of zs)radius=Math.max(radius,Math.hypot(cell[0]+dx-head.pivot[0],guns.pivot[2]-head.pivot[2]+extent));
   }
   const {bounds,escape,nodeCount}=world.visibility;let overlaps=0;
   for(let node=0;node<nodeCount;node++){
    if(escape[node]!==node+1)continue;const at=node*6;if(bounds[at+4]<bottom||bounds[at+1]>top)continue;
    const dx=Math.max(bounds[at]-cx,0,cx-bounds[at+3]),dz=Math.max(bounds[at+2]-cz,0,cz-bounds[at+5]);if(Math.hypot(dx,dz)<=radius)overlaps++;
   }
   expect(overlaps).toBe(0);
  }
 }finally{preview.dispose();disposeWorld(world);}
});

test('articulated torso aim and velocity are distinct from the shared root range contract',()=>{
 const hit=new DefenceAim({delivery:'hitscan',projectile:null},48),target={x:48,z:0,aimX:48.3,aimZ:.2,velocityX:12,velocityZ:0,aimVelocityX:0,aimVelocityZ:3};
 expect(hit.solve(0,0,target)).toBe(true);expect(Array.from(hit.point)).toEqual([48.3,.2,0]);
 target.x=48.01;target.aimX=47.7;expect(hit.solve(0,0,target)).toBe(false);
 target.x=30;target.aimX=30.3;
 const projectile=new DefenceAim({delivery:'projectile',projectile:{speedUnitsPerSecond:90}},96);
 expect(projectile.solve(0,0,target)).toBe(true);expect(projectile.point[0]).toBe(30.3);expect(projectile.point[1]).toBeCloseTo(.2+3*projectile.point[2],10);
});
