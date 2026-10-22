import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {Health} from '../engine/health.js';
import {DefencePreview} from '../game/defence-preview.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {actorsForPreview} from '../game/preview-actors.js';
import {DRONE_MODEL as M} from '../shared/drone-model.js';
import {DRONE_PREVIEW as T,DRONE_TUNING} from '../shared/drone.js';
import {droneBoxesOverlap} from '../engine/drone-navigation.js';
import {PathMotion} from '../engine/path-motion.js';
import {PoseRig} from '../engine/rig.js';
import {identity} from '../shared/math.js';
import {WildlifePreview} from '../game/wildlife-preview.js';
import {ENEMY_STATS} from '../shared/enemy.js';

const drone=await Bun.file(new URL('../assets/models/drone-defence.json',import.meta.url)).json();
const placement=(id='drone-1',x=5,z=5,turn=0)=>({id,model:drone.id,variant:'base',box:[x,0,z],turn});
function fixture({turn=0,count=1,intruder=null}={}){
 const level=newLevel('drone-unit');level.size=[12,10];level.placements=[placement('drone-1',5,5,turn)];
 if(count===2)level.placements.push(placement('drone-2',8,5,turn));
 const world=buildWorld(level,new Map([[drone.id,drone]])),target={id:'enemy',x:132,z:84,aimX:132,aimY:34.5,aimZ:84,lap:0,health:new Health(10000),threat:1,movement:{speed:0}},events=[];
 let visitor=null;
 if(intruder){
  const root=identity();root[12]=120;root[13]=57;root[14]=0;
  const part={id:'body',parent:null,pivot:[12,0,12],voxels:[[11,0,11],[12,2,12]]},source={id:'visitor',model:'test-flyer',role:intruder==='bird'?'scenery':'enemy',root,parts:[part],instances:[{part:'body',key:'body',index:0,matrix:new Float32Array(root)}]};
  const rig=new PoseRig(source,()=>{});world.actors.set('visitor',source);
  visitor={id:'visitor',rig,x:132,y:57,z:12,aimX:132,aimY:58,aimZ:12,health:new Health(10000),lap:0,threat:.001,movement:{speed:24},path:new PathMotion(Array.from({length:10},(_,i)=>[5,0,i]),0),distance:0,impact:{radius:2,height:3},kind:intruder==='bird'?'bird':undefined,phase:'flying',radius:2,height:3,fromX:132,fromY:57,fromZ:12,destinationX:132,destinationY:57,destinationZ:228,ceiling:57,duration:9,flightTime:0,frightened:false};
  visitor.advance=dt=>{visitor.flightTime+=dt;const u=Math.min(1,visitor.flightTime/visitor.duration);visitor.distance=Math.min(visitor.path.length,visitor.distance+24*dt);visitor.z=intruder==='bird'?12+216*u*u*(3-2*u):12+visitor.distance;visitor.aimZ=visitor.z;root[14]=visitor.z-12;rig.invalidateRoot();rig.update();};
 }
 const targets=intruder==='enemy'?[target,visitor]:[target],firing=new DefencePreview(world,()=>{},()=>.5,(variant,matrix,at,muzzles)=>events.push({variant,matrix:Array.from(matrix),at,muzzles}),targets,(actor,strength)=>actor.health.takeDamage(strength));
 if(intruder==='bird')firing.drones.setWildlife([visitor]);
 return {world,target,visitor,events,firing,controller:firing.drones,state:firing.drones.states[0],dispose(){firing.dispose();disposeWorld(world);}};
}
function until(f,condition,seconds=30,dt=.01){for(let i=0;i<seconds/dt&&!condition();i++)f.firing.advance(dt);expect(condition()).toBe(true);}
function point(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}

test('station sight checks exclude the requesting drone and retain obstruction rejection',()=>{
 const f=fixture({count:2});try{
  const queries=[];f.world.visibility.clear=(...args)=>{queries.push(args);return true;};
  for(const state of f.controller.states){
   queries.length=0;
   expect(f.controller.stationSight(state,132,80,132,132,34.5,84,0)).toBe(true);
   expect(queries).toHaveLength(M.muzzles.length);
   for(const query of queries){expect(query.every((value,i)=>i===6||Number.isFinite(value))).toBe(true);expect(query[6]).toBe(state.id);}
  }
  f.world.visibility.clear=()=>false;
  expect(f.controller.stationSight(f.state,132,80,132,132,34.5,84,0)).toBe(false);
 }finally{f.dispose();}
});

test('base timing is independent and a settled twin-gun burst applies ten single 10HP rounds with five-second cooldown',()=>{
 const f=fixture();try{
  expect(DRONE_TUNING.base.rechargeSeconds).toBe(10);expect(DRONE_TUNING.upgrade1).toBeNull();expect(DRONE_TUNING.upgrade2).toBeNull();
  const pad=Array.from(f.state.rig.byId.get('pad').instance.matrix),cycle=f.state.cycle;
  until(f,()=>cycle.shots===10,8);
  expect(f.events).toHaveLength(10);expect(f.target.health.current).toBe(9900);expect(f.target.health.hits).toBe(10);
  for(let i=1;i<f.events.length;i++)expect(f.events[i].at-f.events[i-1].at).toBeGreaterThanOrEqual(.25-1e-9);
  expect(cycle.readyAt-cycle.lastShotAt).toBeCloseTo(5,8);expect(cycle.remaining).toBe(0);
  expect(f.state.phase).toBe('intercept');expect(Array.from(f.state.rig.byId.get('pad').instance.matrix)).toEqual(pad);
  for(const e of f.events){expect(e.muzzles).toBe(M.muzzles);expect(e.matrix.every(Number.isFinite)).toBe(true);}
 }finally{f.dispose();}
});

test('expiry finishes the current valid burst then begins returning immediately without waiting for weapon cooldown',()=>{
 const f=fixture();try{
  until(f,()=>f.state.cycle.shots===1);const s=f.state;s.flightElapsed=19.9;
  until(f,()=>s.phase==='return',5);
  expect(s.expired).toBe(true);expect(s.cycle.shots).toBe(10);expect(s.cycle.remaining).toBe(0);expect(s.returnStartedAt).toBeCloseTo(s.cycle.lastShotAt,8);
  expect(s.cycle.readyAt-s.returnStartedAt).toBeCloseTo(5,8);expect(s.flightElapsed).toBeGreaterThan(20);expect(s.target).toBeNull();
  const elapsed=s.flightElapsed;f.firing.advance(.1);expect(s.flightElapsed).toBe(elapsed);
 }finally{f.dispose();}
});

test('expiry in cooldown returns without starting a new burst; obstruction or death cancels remaining rounds safely',()=>{
 for(const cause of ['cooldown','occlusion','death']){
  const f=fixture();try{
   until(f,()=>f.state.cycle.shots===(cause==='cooldown'?10:1));const s=f.state,before=s.cycle.shots;s.flightElapsed=19.99;
   if(cause==='occlusion')f.world.visibility.clear=()=>false;
   if(cause==='death')f.target.health.takeDamage(10000);
   f.firing.advance(.02);expect(['return','align-pad','descend']).toContain(s.phase);expect(s.returns).toBe(1);expect(s.cycle.shots).toBe(before);expect(s.cycle.remaining).toBe(0);expect(s.target).toBeNull();
  }finally{f.dispose();}
 }
});

test('return, neutral pad hover and ten-second recharge preserve clocks and reset reuses every fleet slot',()=>{
 const f=fixture({turn:1});try{
  const s=f.state,rig=s.rig,nav=s.nav,cycle=s.cycle,pad=Array.from(rig.byId.get('pad').instance.matrix),point0=point(rig.byId.get('drone').instance.matrix,[12,9,12]);
  until(f,()=>s.cycle.shots>0);expect(Math.hypot(s.x-s.homeX,s.z-s.homeZ)).toBeLessThan(1e-8);
  const body=point(s.bodyMatrix,[12,9,12]);expect(body[0]).toBeCloseTo(s.x,4);expect(body[1]).toBeCloseTo(s.y,4);expect(body[2]).toBeCloseTo(s.z,4);
  s.flightElapsed=20;s.cycle.cancelBurst();until(f,()=>s.phase==='recharge');
  expect(s.x).toBe(s.homeX);expect(s.z).toBe(s.homeZ);expect(s.y).toBeCloseTo(point0[1],8);expect(s.rechargeRemaining).toBe(10);
  const phase=s.rotorPhase;f.firing.advance(9.9);expect(s.phase).toBe('recharge');expect(s.rechargeRemaining).toBeCloseTo(.1,8);expect(s.rotorPhase).not.toBe(phase);
  f.firing.advance(.11);expect(s.phase).toBe('launch');expect(s.launches).toBe(2);expect(s.flightElapsed).toBeCloseTo(.01,8);
  f.firing.resetTargets();expect(s.rig).toBe(rig);expect(s.nav).toBe(nav);expect(s.cycle).toBe(cycle);expect(s.phase).toBe('pad-hover');expect(s.flightElapsed).toBe(0);expect(s.rechargeRemaining).toBe(0);expect(s.cycle.shots).toBe(0);expect(s.target).toBeNull();
  expect([s.lastShotAt,s.lastShotTargetId,s.lastShotDistance,s.lastShotVisible,s.lastShotAimError,s.lastShotPitchError,s.targetDistance]).toEqual([null,null,null,null,null,null,null]);
  expect(Array.from(rig.byId.get('pad').instance.matrix)).toEqual(pad);expect(point(s.bodyMatrix,[12,9,12])).toEqual(point0);
 }finally{f.dispose();}
});

test('long frames emit at most one current round and unreachable/occluded targets receive no hits',()=>{
 const f=fixture();try{
  until(f,()=>f.state.cycle.shots===1);f.firing.advance(.9);expect(f.state.cycle.shots).toBe(2);
  f.target.aimY=200;const before=f.target.health.current;f.firing.advance(.3);expect(f.target.health.current).toBe(before);expect(f.state.cycle.remaining).toBe(0);
  expect(f.events.at(-1).matrix.every(Number.isFinite)).toBe(true);
 }finally{f.dispose();}
});

test('mobile burst commitments stop before range exit and never promise unknown or banking future poses',()=>{
 const f=fixture();try{
  until(f,()=>f.state.cycle.shots===1);const s=f.state,t=f.target;
  t.path={length:1000,sample(distance,out){out[0]=132;out[1]=distance;return out;}};t.routeForecastEligible=true;t.movement.speed=12;t.distance=t.z=60.1;t.aimZ=t.z;
  // The current target is at71.9, leaving range before the next .25s round.
  s.targeting.solve(s.x,s.z,t);s.lineOfSight=true;s.aimError=s.pitchError=0;s.targetPitch=-.2;
  t.path.sample=(distance,out)=>{out[0]=132;out[1]=120.2-distance;return out;};
  expect(f.controller.canFire(s,t)).toBe(true);expect(f.controller.commitment(s,t)).toBe(0);
  t.distance=t.z=t.aimZ=84;t.path.sample=(distance,out)=>{out[0]=132;out[1]=84;return out;};
  expect(f.controller.commitment(s,t)).toBe(90);
  t.routeForecastEligible=false;expect(f.controller.commitment(s,t)).toBe(0);
  t.routeForecastEligible=true;t.path=null;expect(f.controller.commitment(s,t)).toBe(0);
 }finally{f.dispose();}
});

test('head-on returning aircraft hold safely, replan around each other and both reach their own pads',()=>{
 const f=fixture({count:2});try{
  const [a,b]=f.controller.states;
  a.x=180;b.x=144;for(const s of [a,b]){s.y=57;s.phase='intercept';f.controller.writePose(s,0);f.controller.beginReturn(s);}
  f.target.health.takeDamage(10000);let holds=0;
  for(let frame=0;frame<3000&&(a.phase!=='recharge'||b.phase!=='recharge');frame++){
   f.firing.advance(.01);expect(f.controller.fleetClear(a,a.x,a.y,a.z,a.x,a.y,a.z,['descend','recharge'].includes(a.phase))).toBe(true);if(a.blocked||b.blocked)holds++;
  }
  expect(holds).toBeGreaterThan(0);expect(a.phase).toBe('recharge');expect(b.phase).toBe('recharge');expect(a.x).toBe(a.homeX);expect(b.x).toBe(b.homeX);
 }finally{f.dispose();}
});

test('an empty held return plan cannot align, descend or snap the aircraft to a distant home goal',()=>{
 const f=fixture();try{
  const s=f.state;s.phase='return';s.x=s.homeX+24;s.y=57;s.goalNode=s.homeNode;s.motion.clear();s.blocked=true;const x=s.x,y=s.y,z=s.z;
  f.controller.move(s,1/60);f.controller.writePose(s,1/60);expect(s.phase).toBe('return');expect(s.blocked).toBe(true);expect([s.x,s.y,s.z]).toEqual([x,y,z]);const body=point(s.bodyMatrix,M.bodyPivot);expect(Math.hypot(body[0]-s.x,body[1]-s.y,body[2]-s.z)).toBeLessThan(.0001);
 }finally{f.dispose();}
});

test('return releases stale attack braking flags and completes after target invalidation',()=>{
 const f=fixture();try{
  const s=f.state;s.phase='intercept';s.x+=48;s.y=57;s.retargetPending=true;s.stationCommitted=true;s.plannedTarget=f.target;s.target=null;s.motion.clear();f.target.health.takeDamage(10000);
  f.controller.beginReturn(s);expect(s.retargetPending).toBe(false);expect(s.stationCommitted).toBe(false);expect(s.target).toBeNull();
  until(f,()=>s.phase==='recharge',12);expect(s.x).toBe(s.homeX);expect(s.z).toBe(s.homeZ);expect(s.rechargeRemaining).toBe(10);
 }finally{f.dispose();}
});

test('retained head-on intents and a neutral launch share right of way and make useful return progress at30/60/120Hz',()=>{
 for(const hz of [30,60,120])for(const scenario of ['head-on','neutral-launch']){
  const f=fixture({count:2});try{
   const d=f.controller,[a,b]=d.states;a.x=scenario==='head-on'?228:260;b.x=scenario==='head-on'?156:b.homeX;
   f.target.health.takeDamage(10000);
   for(const s of [a,b]){s.y=57;s.phase='intercept';s.expired=true;s.flightElapsed=20;d.beginReturn(s);s.motion.clear();s.motion.add(s.x,s.y,s.z,0,0,0,s.homeX,s.y,s.homeZ,false,0);s.blocked=s.returnPlanning=false;}
   if(scenario==='neutral-launch'){b.phase='launch';b.expired=false;b.flightElapsed=0;b.y=b.ground+9;b.motion.clear();}
   let aArrived=null,bArrived=null,simultaneousEvasion=0;const aa=new Float64Array(6),bb=new Float64Array(6);
   for(let frame=0;frame<30*hz;frame++){
    f.firing.advance(1/hz);
    for(let i=0;i<2;i++){const s=d.states[i],box=i?bb:aa,n=['launch','descend','recharge','pad-hover'].includes(s.phase),r=n?11:T.hullRadius;box.set([s.x-r,s.y-(n?5:T.hullBelow),s.z-r,s.x+r,s.y+(n?5:T.hullAbove),s.z+r]);expect(s.emergencyStops).toBe(0);}
    expect(droneBoxesOverlap(aa,bb)).toBe(false);if((a.evading||a.wantEvade)&&(b.evading||b.wantEvade))simultaneousEvasion++;
    if(aArrived===null&&['pad-hover','recharge'].includes(a.phase))aArrived=(frame+1)/hz;if(bArrived===null&&['pad-hover','recharge'].includes(b.phase))bArrived=(frame+1)/hz;
   }
   expect(aArrived).not.toBeNull();expect(aArrived).toBeLessThan(10);expect(bArrived).not.toBeNull();expect(bArrived).toBeLessThan(25);expect(simultaneousEvasion).toBe(0);expect(a.evasions+b.evasions).toBeLessThanOrEqual(1);expect(a.x).toBe(a.homeX);expect(b.x).toBe(b.homeX);
  }finally{f.dispose();}
 }
});

test('a level fuselage uses collective fan tilt for acceleration and differential tilt for yaw and yaw braking',()=>{
 const f=fixture();try{
  const s=f.state;
  function torque(){let sum=0;const body=s.bodyMatrix;for(let i=0;i<s.fans.length;i++){const fan=s.fans[i],rotor=M.fanTiltMax!==undefined?s.rig.byId.get(fan.gimbal):null;if(!rotor)throw new Error('Production drone requires articulated fan gimbals.');const m=rotor.instance.matrix,rx=rotor.part.pivot[0]-12,rz=rotor.part.pivot[2]-12,nx=body[0]*m[4]+body[2]*m[6],nz=body[8]*m[4]+body[10]*m[6];sum+=rz*nx-rx*nz;}return sum;}
  s.phase='align-pad';s.y=57;s.aim.yaw=.8;s.aim.velocity=0;f.controller.writePose(s,.05);expect(s.yawAcceleration).toBeLessThan(0);expect(torque()).toBeLessThan(0);
  for(const fan of s.fans)fan.pitch=fan.roll=0;s.aim.yaw=.1;s.aim.velocity=-1.5;f.controller.writePose(s,.05);expect(s.yawAcceleration).toBeGreaterThan(0);expect(torque()).toBeGreaterThan(0);
  for(const fan of s.fans)fan.pitch=fan.roll=0;s.phase='intercept';s.aim.yaw=s.aim.velocity=0;s.accelerationX=T.acceleration;s.velocityX=0;s.target=null;
  for(let i=0;i<20;i++)f.controller.writePose(s,.05);
  let forceX=0;for(const fan of s.fans){const m=s.rig.byId.get(fan.gimbal).instance.matrix;forceX+=m[4];expect(Math.hypot(fan.pitch,fan.roll)).toBeLessThanOrEqual(M.fanTiltMax+1e-9);}expect(forceX).toBeGreaterThan(0);
  expect(s.bodyPitch).toBe(0);expect(s.bodyRoll).toBe(0);expect(Math.abs(s.bodyMatrix[4])+Math.abs(s.bodyMatrix[6])).toBe(0);expect(s.bodyMatrix[5]).toBe(1);
  s.y=s.ground+9+M.minimumFanTiltLift-1;f.controller.writePose(s,.05);for(const fan of s.fans){expect(fan.pitch).toBe(0);expect(fan.roll).toBe(0);}
 }finally{f.dispose();}
});

test('a complete-route intercept remains committed through a target corner and holds a useful firing station',()=>{
 const f=fixture();try{
  const t=f.target,s=f.state,route=[];for(let x=5;x<=9;x++)route.push([x,0,1]);for(let z=2;z<=7;z++)route.push([9,0,z]);for(let x=8;x>=2;x--)route.push([x,0,7]);
  t.path=new PathMotion(route,6);t.distance=72;t.y=24;t.movement.speed=12;t.impact={radius:12,height:16};const p=new Float64Array(5);
  function targetStep(dt){t.distance+=12*dt;t.path.sample(t.distance,p);t.x=t.aimX=p[0];t.z=t.aimZ=p[1];t.velocityX=p[3]*12;t.velocityZ=p[4]*12;}
  targetStep(0);expect(f.controller.prediction(t,4,p)).toBe(true);expect(p[0]).toBe(228);expect(p[1]).toBe(60);expect(f.controller.prediction(t,(t.path.length-t.distance)/12,p)).toBe(false);
  let goal=-1,transitChanges=0,held=0,turnHeld=0,settledError=null,commits=0,lastArrival=null;
  for(let frame=0;frame<600;frame++){
   targetStep(1/60);f.firing.advance(1/60);
   if(s.stationCommitted&&s.stationArrivalAt!==lastArrival){commits++;lastArrival=s.stationArrivalAt;}
   if(s.stationCommitted&&!s.motion.done&&s.speed>0){if(goal>=0&&goal!==s.goalNode)transitChanges++;goal=s.goalNode;}
   if(s.stationCommitted&&s.motion.done&&s.speed<.1){held++;if(t.distance>96&&t.distance<144)turnHeld++;if(settledError===null)settledError=f.controller.time-s.stationArrivalAt;}
  }
  expect(transitChanges).toBe(0);expect(held).toBeGreaterThan(180);expect(turnHeld).toBeGreaterThan(60);expect(s.cycle.shots).toBeGreaterThanOrEqual(10);expect(s.committedThinks).toBeGreaterThan(100);expect(commits).toBeLessThan(5);expect(settledError).toBeLessThanOrEqual(.15);expect(s.emergencyStops).toBe(0);
 }finally{f.dispose();}
});

test('committed firing stations reserve space independently of current aircraft positions',()=>{
 const f=fixture({count:2});try{
  until(f,()=>f.controller.states.every(s=>s.stationCommitted),8);
  const [a,b]=f.controller.states,p=new Float64Array(3),q=new Float64Array(3);f.controller.navigation.position(a.goalNode,p);f.controller.navigation.position(b.goalNode,q);
  expect(Math.abs(p[0]-q[0])>=2*T.hullRadius+2||Math.abs(p[1]-q[1])>=2*T.hullRadius+2||Math.abs(p[2]-q[2])>=2*T.hullRadius+2).toBe(true);
  expect(f.controller.stationReserved(a,q[0],q[1],q[2])).toBe(true);
  b.stationCommitted=false;expect(f.controller.stationReserved(a,q[0],q[1],q[2])).toBe(false);
 }finally{f.dispose();}
});

test('a settled firing aircraft actively evades approaching birds and living flyers without current solid overlap',()=>{
 for(const intruder of ['bird','enemy']){
  const f=fixture({intruder});try{
   const s=f.state,o=f.controller.obstacles;let heldBefore=0,firstEvade=null,overlaps=0;
   for(let frame=0;frame<540;frame++){
    f.visitor.advance(1/60);f.firing.advance(1/60);
    if(!s.evasions&&s.stationCommitted&&s.speed<.1)heldBefore++;
    if(s.evasions&&firstEvade===null)firstEvade=frame/60;
    if(!f.controller.dynamicPointClear(s,s.x,s.y,s.z))overlaps++;
   }
   expect(heldBefore).toBeGreaterThan(60);expect(firstEvade).not.toBeNull();expect(firstEvade).toBeLessThan(5);expect(s.evasions).toBeGreaterThan(0);expect(overlaps).toBe(0);expect(s.emergencyStops).toBe(0);expect(s.bodyPitch).toBe(0);expect(s.bodyRoll).toBe(0);
   const current=o.current;f.firing.resetTargets();expect(o.current).toBe(current);expect(s.evading).toBe(false);expect(s.wantEvade).toBe(false);expect(s.stationCommitted).toBe(false);expect(s.evasions).toBe(0);
  }finally{f.dispose();}
 }
});

test('a target dying during travel releases its station and brakes without splicing a new path into momentum',()=>{
 const f=fixture();try{
  f.target.x=f.target.aimX=252;f.target.z=f.target.aimZ=84;
  until(f,()=>f.state.stationCommitted&&f.state.speed>30,8);const s=f.state,x=s.x,z=s.z,old=s.speed;f.target.health.takeDamage(10000);f.firing.advance(1/60);
  expect(s.stationCommitted).toBe(false);expect(Math.hypot(s.x-x,s.z-z)).toBeLessThanOrEqual(old/60+.1);
  until(f,()=>s.speed===0,3);expect(s.target).toBeNull();expect(s.emergencyStops).toBe(0);expect(s.retargetPending).toBe(true);
 }finally{f.dispose();}
});

test('range exit and a target passing underneath invalidate the station, reposition and resume the same enemy after the real cooldown',()=>{
 for(const cause of ['range','underneath']){
  const f=fixture();try{
   until(f,()=>f.state.cycle.shots===1);const s=f.state,t=f.target,oldGoal=s.goalNode,oldX=s.x,oldZ=s.z,lastShot=s.cycle.lastShotAt,path=[];
   if(cause==='range'){for(let z=3;z<=8;z++)path.push([9,0,z]);for(let x=8;x>=3;x--)path.push([x,0,8]);t.distance=0;}
   else{for(let z=3;z<=8;z++)path.push([5,0,z]);for(let x=6;x<=10;x++)path.push([x,0,8]);t.distance=48;}
   t.path=new PathMotion(path,6);t.movement.speed=12;t.y=24;t.impact={radius:12,height:16};const p=new Float64Array(5);
   const step=()=>{t.distance+=12/60;t.path.sample(t.distance,p);t.x=t.aimX=p[0];t.z=t.aimZ=p[1];f.firing.advance(1/60);};
   step();expect(s.cycle.remaining).toBe(0);expect(s.cycle.readyAt).toBeCloseTo(lastShot+5,8);
   for(let frame=0;frame<600&&s.cycle.shots===1;frame++)step();
   expect(s.cycle.shots).toBeGreaterThan(1);expect(s.lastShotTargetId).toBe(t.id);expect(s.goalNode).not.toBe(oldGoal);expect(Math.hypot(s.x-oldX,s.z-oldZ)).toBeGreaterThan(12);expect(f.events[1].at-lastShot).toBeGreaterThanOrEqual(5-1e-9);expect(s.emergencyStops).toBe(0);
  }finally{f.dispose();}
 }
});

test('actual A1 first sorties launch safely, attack productively and finish returns at30/60/120Hz, including a live-wildlife reset',async()=>{
 const level=await Bun.file(new URL('../assets/levels/moss-01.json',import.meta.url)).json(),actors=actorsForPreview(level),models=new Map();
 for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(p=>p.model)]))models.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 for(const hz of [30,60,120]){
  const world=buildWorld(level,models,{actors}),wildlife=new WildlifePreview(world,()=>{}),enemies=new EnemyPreview(world,()=>{},(_,s)=>wildlife.spookExplosion(s.aimX,s.aimY,s.aimZ,ENEMY_STATS[s.model].explosion.frightRadius));wildlife.setThreatSources(enemies.states);
  const firing=new DefencePreview(world,()=>{},()=>.5,null,enemies.states,(target,strength)=>enemies.takeHit(target,strength)),d=firing.drones;d.setWildlife(wildlife.states,wildlife.defences);
  const records=d.states.map(()=>({launch:null,firstShot:null,returnAt:null,land:null,shots:0,evadeSeconds:0}));
  try{
   for(let frame=0;frame<45*hz;frame++){
    enemies.advance(1/hz);wildlife.advance(1/hz);firing.advance(1/hz);
    for(let i=0;i<2;i++){
     const s=d.states[i],r=records[i],now=(frame+1)/hz;if(s.launches&&r.launch===null)r.launch=now;
     if(s.launches===1&&r.returnAt===null){if(s.cycle.shots&&r.firstShot===null)r.firstShot=now;r.shots=s.cycle.shots;if(s.evading||s.wantEvade)r.evadeSeconds+=1/hz;if(s.phase==='return')r.returnAt=now;}
     if(r.returnAt!==null&&r.land===null&&s.phase==='recharge')r.land=now;
     expect(d.dynamicPointClear(s,s.x,s.y,s.z)).toBe(true);expect(s.emergencyStops).toBe(0);
     if(s.phase==='pad-hover'&&!s.launches)expect(s.flightElapsed).toBe(0);
     if(s.phase==='descend')for(const fan of s.fans){expect(fan.pitch).toBe(0);expect(fan.roll).toBe(0);}
    }
   }
   for(const r of records){expect(r.firstShot).not.toBeNull();expect(r.firstShot-r.launch).toBeLessThan(8);expect(r.shots).toBeGreaterThanOrEqual(10);expect(r.evadeSeconds).toBeLessThan(5);expect(r.returnAt-r.launch).toBeGreaterThanOrEqual(20-1/hz-1e-8);expect(r.land).not.toBeNull();expect(r.land-r.returnAt).toBeLessThan(12);}
   const intents=d.states.map(s=>s.intent),brake=d.brakeIntent;enemies.reset();firing.resetTargets();for(let i=0;i<2;i++){const s=d.states[i];expect(s.intent).toBe(intents[i]);expect(s.yieldOwner).toBeNull();expect(s.fleetYieldTo).toBeNull();expect(s.returnReason).toBeNull();expect(s.avoidanceCause).toBeNull();expect(s.planningFailure).toBeNull();expect(s.flightElapsed).toBe(0);}expect(d.brakeIntent).toBe(brake);
   for(let frame=0;frame<45*hz;frame++){enemies.advance(1/hz);wildlife.advance(1/hz);firing.advance(1/hz);for(const s of d.states){expect(d.dynamicPointClear(s,s.x,s.y,s.z)).toBe(true);expect(s.emergencyStops).toBe(0);}}
   expect(d.shots).toBeGreaterThanOrEqual(20);
  }finally{firing.dispose();enemies.dispose();wildlife.dispose();disposeWorld(world);}
 }
});

test('the actual A1 fleet navigates, attacks ground and air, returns/recharges and releases without changing the landscape',async()=>{
 const level=await Bun.file(new URL('../assets/levels/moss-01.json',import.meta.url)).json(),actors=actorsForPreview(level),models=new Map();
 for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(p=>p.model)]))models.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 const world=buildWorld(level,models,{actors}),before=JSON.stringify(level),wildlife=new WildlifePreview(world,()=>{}),enemies=new EnemyPreview(world,()=>{},(id,s)=>wildlife.spookExplosion(s.aimX,s.aimY,s.aimZ,ENEMY_STATS[s.model].explosion.frightRadius)),hits=new Set();wildlife.setThreatSources(enemies.states);let deathsDuringTravel=0;
 const firing=new DefencePreview(world,()=>{},()=>.5,(variant,matrix,at,muzzles)=>{
  const state=firing.drones.states.find(s=>s.gunMatrix===matrix),target=state.target;
  expect(muzzles).toBe(M.muzzles);expect(state.lastShotDamage).toBe(10);expect(state.targetDistance).toBeLessThanOrEqual(T.maxRange);expect(Math.abs(state.aimError)).toBeLessThanOrEqual(T.aimTolerance);expect(Math.abs(state.pitchError)).toBeLessThanOrEqual(T.aimTolerance);
  for(const muzzle of muzzles){const p=point(matrix,muzzle);expect(world.visibility.clear(p[0],p[1],p[2],target.aimX,target.aimY,target.aimZ,state.id)).toBe(true);}
 },enemies.states,(target,strength)=>{hits.add(target.model);const applied=enemies.takeHit(target,strength);if(!target.health.alive&&firing.drones.states.some(s=>s.plannedTarget===target&&s.speed>1))deathsDuringTravel++;return applied;}),drones=firing.drones,nav=drones.navigation;drones.setWildlife(wildlife.states,wildlife.defences);
 try{
  expect(drones.states).toHaveLength(2);expect(nav.count).toBe(5412);expect(firing.enhancers.bindings).toEqual([]);
  const originalSlots=drones.states.map(s=>s.nav.path),pads=drones.states.map(s=>Array.from(s.rig.byId.get('pad').instance.matrix)),a=new Float64Array(6),b=new Float64Array(6);
  let minPairDistance=Infinity,maxThinks=0,returns=0,recharges=0;
  for(let frame=0;frame<9000;frame++){
   enemies.advance(1/60);wildlife.advance(1/60);const thinks=firing.planner.thinks;firing.advance(1/60);maxThinks=Math.max(maxThinks,firing.planner.thinks-thinks);
   for(let i=0;i<2;i++){
    const s=drones.states[i];expect([s.x,s.y,s.z,s.aim.yaw,s.pitch.angle].every(Number.isFinite)).toBe(true);
    const body=point(s.bodyMatrix,[12,9,12]);expect(Math.hypot(body[0]-s.x,body[1]-s.y,body[2]-s.z)).toBeLessThan(.0001);
    expect(s.bodyPitch).toBe(0);expect(s.bodyRoll).toBe(0);expect(Math.abs(s.bodyMatrix[4])+Math.abs(s.bodyMatrix[6])).toBe(0);expect(s.bodyMatrix[5]).toBe(1);for(const fan of s.fans)expect(Math.hypot(fan.pitch,fan.roll)).toBeLessThanOrEqual(M.fanTiltMax+1e-9);
    expect(Array.from(s.rig.byId.get('pad').instance.matrix)).toEqual(pads[i]);expect(s.nav.path).toBe(originalSlots[i]);
    if(s.phase==='return')returns++;if(s.phase==='recharge')recharges++;
    if(s.phase!=='launch'&&s.phase!=='descend'&&s.phase!=='pad-hover'&&s.phase!=='recharge')expect(nav.clearSegment(s.x,s.y,s.z,s.x,s.y,s.z)).toBe(true);
    const bounds=i?b:a,r=['launch','descend','pad-hover','recharge'].includes(s.phase)?11:T.hullRadius;
    bounds[0]=s.x-r;bounds[1]=s.y-(r===11?5:T.hullBelow);bounds[2]=s.z-r;bounds[3]=s.x+r;bounds[4]=s.y+(r===11?5:T.hullAbove);bounds[5]=s.z+r;
    expect(drones.obstacles.clearBox(bounds)).toBe(true);expect(s.emergencyStops).toBe(0);
   }
   expect(droneBoxesOverlap(a,b)).toBe(false);minPairDistance=Math.min(minPairDistance,Math.hypot(drones.states[0].x-drones.states[1].x,drones.states[0].y-drones.states[1].y,drones.states[0].z-drones.states[1].z));
  }
  expect(maxThinks).toBe(1);expect(hits).toEqual(new Set(['dog','moth']));expect(returns).toBeGreaterThan(0);expect(recharges).toBeGreaterThan(0);expect(enemies.alive).toBe(0);expect(minPairDistance).toBeGreaterThan(T.hullBelow+T.hullAbove-1e-6);expect(JSON.stringify(level)).toBe(before);
  const state=drones.states[0],slot=state.nav;firing.resetTargets();expect(state.nav).toBe(slot);expect(state.phase).toBe('pad-hover');
  // Keep the actual roster moving through a second deterministic60-second
  // flight study. This includes a perpendicular convergence around54s which
  // previously forced an abrupt54→0 speed emergency at the faster cruise.
  enemies.reset();for(const target of enemies.states)target.health.current=target.health.maximum=100000;drones.onHit=()=>0;drones.onShot=null;
  const velocity=drones.states.map(()=>[0,0,0]);let peak=0;
  for(let frame=0;frame<3600;frame++){
   enemies.advance(1/60);wildlife.advance(1/60);firing.advance(1/60);
   for(let i=0;i<drones.states.length;i++){
    const s=drones.states[i],last=velocity[i];expect(s.emergencyStops).toBe(0);expect(Math.hypot(s.velocityX-last[0],s.velocityY-last[1],s.velocityZ-last[2])).toBeLessThan(8);peak=Math.max(peak,s.speed);last[0]=s.velocityX;last[1]=s.velocityY;last[2]=s.velocityZ;
   }
  }
  expect(peak).toBeCloseTo(T.speed,8);
 }finally{firing.dispose();enemies.dispose();wildlife.dispose();disposeWorld(world);}
 expect(drones.states).toEqual([]);expect(drones.world).toBeNull();expect(drones.navigation).toBeNull();expect(nav.byteLength).toBe(0);expect(()=>drones.advance(.1)).not.toThrow();
});
