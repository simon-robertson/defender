import {test,expect} from 'bun:test';
import {Camera} from '../engine/camera.js';
import {DroneCamera,DRONE_CAMERA_SPEED,DRONE_CAMERA_RADIUS,DRONE_CAMERA_ORBIT_RADIUS,DRONE_CAMERA_MIN_OFFSET,DRONE_CAMERA_MIN_ALTITUDE} from '../play/drone-camera.js';
import {SceneryVisibility} from '../engine/visibility.js';
import {STUDY_SCENARIOS} from '../tools/camera-study-scenarios.js';
import {createStudyScene,advanceStudyScene,describeStudyScene} from '../tools/camera-study-scene.js';
const camera=()=>new Camera({clientWidth:1500,clientHeight:1000,addEventListener(){},focus(){}},()=>{});
function basic(){
 const level={id:'camera-fixture',size:[20,16],path:[[0,0,8],[1,0,8]],pathHeight:24,terrain:{defaultHeight:24,boxes:[]},placements:[]},world={level,width:480,length:384,rigs:new Map(),actors:new Map(),visibility:new SceneryVisibility(level,new Map())},c=camera();c.setLevel(level);const drone=new DroneCamera(c,{random:()=>.35});drone.bind(world);
 const subject={id:'actor',phase:'active',health:{alive:true},x:240,y:24,z:192,aimX:240,aimY:42,aimZ:192,distance:10,path:{length:1000},movement:{speed:12}};
 const engine={time:0,enemies:{states:[],activeTargets:[subject]},firing:{states:[]},wildlife:{states:[]}};return {world,c,drone,engine,subject};
}
function advance(f,seconds,hz=60,phase='wave'){for(let i=0;i<seconds*hz;i++){f.engine.time+=1/hz;f.drone.advance(1/hz,{engine:f.engine,phase});}}
async function assets(run){const before=globalThis.fetch;globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};try{return await run();}finally{globalThis.fetch=before;}}

// These contracts replace the retired automatic director/low-shot expectations.
function centred(d){
 const dx=d.focus[0]-d.position[0],dy=d.focus[1]-d.position[1],dz=d.focus[2]-d.position[2],length=Math.hypot(dx,dy,dz);
 expect(dx/length).toBeCloseTo(-Math.sin(d.yaw)*Math.cos(d.pitch),10);
 expect(dy/length).toBeCloseTo(-Math.sin(d.pitch),10);
 expect(dz/length).toBeCloseTo(-Math.cos(d.yaw)*Math.cos(d.pitch),10);
}
function inwardOpening(d,world){
 const dx=d.position[0]-d.focus[0],dz=d.position[2]-d.focus[2],cx=world.width/2-d.focus[0],cz=world.length/2-d.focus[2];
 expect(Math.hypot(dx,dz)).toBeCloseTo(DRONE_CAMERA_ORBIT_RADIUS,8);
 if(Math.hypot(cx,cz)>1e-6){expect(dx*cx+dz*cz).toBeLessThan(0);expect(dx*cz-dz*cx).toBeCloseTo(0,7);}
 centred(d);
}
test('waves start high on the opposite entrance orbit, facing into the board with a fixed spawn reticle',()=>{
 const f=basic(),d=f.drone;
 try{d.setEnabled(true);d.sync('wave',f.engine);inwardOpening(d,f.world);expect(d.position[1]).toBeGreaterThanOrEqual(24+DRONE_CAMERA_MIN_ALTITUDE);expect([...d.focus]).toEqual([12,24,204]);expect(d.fov).toBe(60);centred(d);
  const anchor=[...d.focus];advance(f,20);expect([...d.focus]).toEqual(anchor);expect(d.targeted).toBe(false);expect(d.position[1]).toBeGreaterThanOrEqual(d.cruiseY);centred(d);
 }finally{d.dispose();}
});
test('the selected wave route determines the opening entrance and each wave resets manual targeting',()=>{
 const f=basic(),d=f.drone;f.world.level.routes=[{id:'other',path:[[19,0,3],[18,0,3]]}];f.engine.wave={spawns:[{routeId:'other'}]};
 try{d.setEnabled(true);d.sync('wave',f.engine);expect([...d.focus]).toEqual([468,24,84]);inwardOpening(d,f.world);d.targetAt(100,24,200);d.sync('loadout',f.engine);expect(d.targeted).toBe(false);d.sync('wave',f.engine);expect([...d.focus]).toEqual([468,24,84]);inwardOpening(d,f.world);centred(d);}finally{d.dispose();}
});
test('entrances on every edge face inward and central or missing paths retain a finite offset',()=>{
 for(const path of [[[0,0,8],[1,0,8]],[[20,0,8],[19,0,8]],[[10,0,0],[10,0,1]],[[10,0,16],[10,0,15]],[[10,0,8],[11,0,8]],[]]){
  const f=basic(),d=f.drone;f.world.level.size=[21,17];f.world.width=504;f.world.length=408;f.world.level.path=path;f.world.visibility=new SceneryVisibility(f.world.level,new Map());d.bind(f.world);
  try{d.setEnabled(true);d.sync('wave',f.engine);expect(d.active).toBe(true);inwardOpening(d,f.world);expect([...d.position,d.yaw,d.pitch].every(Number.isFinite)).toBe(true);
   if(path[0]?.[0]===10&&path[0]?.[2]===8){expect(d.position[0]).toBeLessThan(d.focus[0]);expect(d.position[2]).toBeCloseTo(d.focus[2],8);}
  }finally{d.dispose();}
 }
});
test('pause, settling, disabling and rebinding preserve camera ownership and release caches',()=>{
 const f=basic(),d=f.drone,original=[...f.c.target,f.c.yaw,f.c.pitch,f.c.radius];
 try{d.setEnabled(true);d.sync('deploy',f.engine);expect(d.active).toBe(false);d.sync('wave',f.engine);advance(f,.5);const before=d.stats();d.advance(30,{engine:f.engine,phase:'wave',paused:true});expect(d.stats()).toEqual(before);advance(f,.5,60,'settling');expect(d.time).toBeGreaterThan(before.time);d.setEnabled(false);expect([...f.c.target,f.c.yaw,f.c.pitch,f.c.radius]).toEqual(original);expect(f.c.mode).toBe('overview');d.setEnabled(true);d.sync('wave',f.engine);const obstacles=d.obstacles;d.bind(null);expect(obstacles.disposed).toBe(true);expect(d.obstacles).toBeNull();expect(d.world).toBeNull();expect(d.active).toBe(false);}finally{d.dispose();}
});
test('drag rotation changes the exact world target and subsequent movement keeps it under the reticle',()=>{
 const f=basic(),d=f.drone;
 try{d.setEnabled(true);d.sync('wave',f.engine);const old=[...d.focus],yaw=d.yaw;expect(d.rotate(45,-25)).toBe(true);expect(d.yaw).toBeCloseTo(yaw-.18,6);expect([...d.focus]).not.toEqual(old);const anchor=[...d.focus];centred(d);
  f.subject.x=f.subject.aimX=470;f.subject.z=f.subject.aimZ=370;
  for(let n=0;n<600;n++){f.engine.time+=1/60;d.advance(1/60,{engine:f.engine,phase:'wave'});expect([...d.focus]).toEqual(anchor);centred(d);}expect(d.targeted).toBe(true);expect(d.travelled).toBeGreaterThan(60);
 }finally{d.dispose();}
});
test('large drags and skyward input clamp the reticle to board edges without losing the target',()=>{
 const f=basic(),d=f.drone;
 try{d.setEnabled(true);d.sync('wave',f.engine);
  for(let n=0;n<80;n++){expect(d.rotate(n%2?2500:-1750,n%3?-2400:2400)).toBe(true);expect(d.focus[0]).toBeGreaterThanOrEqual(0);expect(d.focus[0]).toBeLessThanOrEqual(480);expect(d.focus[2]).toBeGreaterThanOrEqual(0);expect(d.focus[2]).toBeLessThanOrEqual(384);expect([...d.focus,d.yaw,d.pitch].every(Number.isFinite)).toBe(true);centred(d);advance(f,.05);}
  const target=[...d.focus];expect(d.targetAt(-1,24,30)).toBe(false);expect(d.targetAt(30,24,385)).toBe(false);expect(d.rotate(NaN,0)).toBe(false);expect([...d.focus]).toEqual(target);d.setEnabled(false);expect(d.rotate(1,1)).toBe(false);
 }finally{d.dispose();}
});
test('rotation hits raised terrain surfaces rather than a hidden point beneath them',()=>{
 const f=basic(),d=f.drone;f.world.level.terrain.boxes.push({box:[9,5],ground:100,water:0});f.world.visibility=new SceneryVisibility(f.world.level,new Map());d.bind(f.world);
 try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(228,24,132);expect(d.focus[1]).toBe(100);expect(d.rotate(0,0)).toBe(true);expect(d.focus[1]).toBeCloseTo(100,8);expect(d.focus[0]).toBeCloseTo(228,8);expect(d.focus[2]).toBeCloseTo(132,8);centred(d);}finally{d.dispose();}
});
test('reticle targets actual lower water and bridge tops',()=>{
 const f=basic(),d=f.drone;f.world.level.terrain.boxes.push({box:[9,5],ground:0,water:8},{box:[10,5],ground:0,water:8});f.world.level.bridges=[{boxes:[[10,5]]}];d.bind(f.world);
 try{d.setEnabled(true);d.sync('wave',f.engine);d.position.set([240,230,192]);d.targetAt(228,24,132);expect(d.focus[1]).toBe(8);d.rotate(0,0);expect(d.focus[1]).toBeCloseTo(8,8);centred(d);d.targetAt(252,0,132);expect(d.focus[1]).toBe(24);d.rotate(0,0);expect(d.focus[1]).toBeCloseTo(24,8);centred(d);}finally{d.dispose();}
});
test('a distant target approaches a persistent offset orbit with only high gentle altitude changes',()=>{
 const f=basic(),d=f.drone;
 try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(470,24,370);const initial=Math.hypot(d.position[0]-470,d.position[2]-370);let minY=Infinity,maxY=0;
  for(let n=0;n<30*60;n++){f.engine.time+=1/60;d.advance(1/60,{engine:f.engine,phase:'wave'});minY=Math.min(minY,d.position[1]);maxY=Math.max(maxY,d.position[1]);expect(Math.hypot(d.position[0]-470,d.position[2]-370)).toBeGreaterThanOrEqual(DRONE_CAMERA_MIN_OFFSET-1e-5);centred(d);}
  const radius=Math.hypot(d.position[0]-470,d.position[2]-370);expect(radius).toBeLessThan(initial);expect(radius).toBeCloseTo(DRONE_CAMERA_ORBIT_RADIUS,0);expect(minY).toBeGreaterThanOrEqual(d.minimumY);expect(maxY-minY).toBeGreaterThan(8);expect(maxY-minY).toBeLessThan(14);const p=[...d.position];advance(f,3);expect(Math.hypot(d.position[0]-p[0],d.position[2]-p[2])).toBeGreaterThan(10);
 }finally{d.dispose();}
});
test('edge targets allow exterior camera orbits while the reticle remains on the board',()=>{
 for(const target of [[0,24,0],[480,24,384]]){
  const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(...target);let exterior=false;for(let n=0;n<80*30;n++){f.engine.time+=1/30;d.advance(1/30,{engine:f.engine,phase:'wave'});exterior ||=d.position[0]<0||d.position[0]>480||d.position[2]<0||d.position[2]>384;expect([...d.focus]).toEqual(target);centred(d);}expect(exterior).toBe(true);}finally{d.dispose();}
 }
});
test('orbit scoring uses actual enemy projection and scenery visibility',()=>{
 const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(240,24,192);f.subject.x=f.subject.aimX=420;
  expect(d.viewScore(-Math.PI/2,f.engine)).toBeGreaterThan(.8);expect(d.viewScore(Math.PI/2,f.engine)).toBe(0);f.world.visibility.clear=()=>false;expect(d.viewScore(-Math.PI/2,f.engine)).toBe(0);expect([...d.focus]).toEqual([240,24,192]);
 }finally{d.dispose();}
});
test('equally visible action is preferred on the readable foreground side of the anchor',()=>{
 const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(240,24,192);f.subject.x=f.subject.aimX=300;
  const foreground=d.viewScore(Math.PI/2,f.engine),foregroundCount=d.visibleEnemies,background=d.viewScore(-Math.PI/2,f.engine);expect(foregroundCount).toBe(1);expect(d.visibleEnemies).toBe(1);expect(foreground).toBeGreaterThan(background+.35);expect([...d.focus]).toEqual([240,24,192]);
  f.subject.health.alive=false;expect(d.viewScore(Math.PI/2,f.engine)).toBe(0);
 }finally{d.dispose();}
});
test('a single visible enemy can guide the orbit toward the foreground without retargeting',()=>{
 const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);d.position.set([240,230,336]);d.targetAt(240,24,192);d.orbitAngle=0;f.subject.x=f.subject.aimX=180;
  expect(d.viewScore(.3,f.engine)).toBeGreaterThan(0);expect(d.viewScore(-.3,f.engine)).toBeGreaterThan(0);d.planOrbit(f.engine);expect(d.orbitGoalAngle).toBeLessThan(-.3);expect([...d.focus]).toEqual([240,24,192]);
 }finally{d.dispose();}
});
test('orbit reversals ease continuously with bounded flight motion at 30/60/120 Hz',()=>{
 const results=[];
 for(const hz of [30,60,120]){const f=basic(),d=f.drone;
  try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(240,24,192);advance(f,10,hz);d.viewScore=()=>0;d.orbitDirection=-1;const anchor=[...d.focus],rate=d.orbitRate;let previousRate=rate,acceleration=[...d.acceleration];
   for(let n=0;n<hz*4;n++){const position=[...d.position];f.engine.time+=1/hz;d.advance(1/hz,{engine:f.engine,phase:'wave'});expect(d.orbitRate).toBeLessThan(previousRate);expect(Math.abs(d.orbitRate-previousRate)).toBeLessThanOrEqual(.098/hz+1e-8);expect(Math.hypot(...d.position.map((v,i)=>v-position[i]))).toBeLessThanOrEqual(DRONE_CAMERA_SPEED/hz+1e-6);expect(Math.hypot(...d.acceleration.map((v,i)=>v-acceleration[i]))*hz).toBeLessThanOrEqual(384+1e-4);if(n===0)expect(d.orbitRate).toBeGreaterThan(0);previousRate=d.orbitRate;acceleration=[...d.acceleration];centred(d);}
   expect(d.orbitRate).toBeLessThan(-.034);expect([...d.focus]).toEqual(anchor);const snapshot=d.stats();d.advance(10,{engine:f.engine,phase:'wave',paused:true});expect(d.stats()).toEqual(snapshot);results.push(d.orbitRate);
  }finally{d.dispose();}
 }
 expect(results[0]).toBeCloseTo(results[1],10);expect(results[1]).toBeCloseTo(results[2],10);
});
test('a useful framing destination holds through brief changes and ignores off-screen action',()=>{
 const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(240,24,192);d.position.set([240,230,336]);d.orbitAngle=0;d.aim();f.subject.x=f.subject.aimX=180;d.planOrbit(f.engine);const goal=d.orbitGoalAngle;expect(goal).not.toBeNull();
  f.subject.x=f.subject.aimX=300;d.planOrbit(f.engine);expect(d.orbitGoalAngle).toBe(goal);d.time+=4.1;d.planOrbit(f.engine);expect(d.orbitGoalAngle).toBeGreaterThan(0);
  f.subject.x=f.subject.aimX=2000;d.time+=4.1;d.planOrbit(f.engine);expect(d.orbitGoalAngle).toBeNull();expect(d.frameTargets).toHaveLength(0);expect([...d.focus]).toEqual([240,24,192]);
 }finally{d.dispose();}
});
test('global orbit composition improves foreground action sooner and includes its participating defence',()=>{
 const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(240,24,192);d.position.set([240,230,336]);d.orbitAngle=0;d.velocity.fill(0);d.acceleration.fill(0);d.aim();f.subject.x=f.subject.aimX=180;
  const gun={id:'fighting-gun',x:200,y:36,z:210,target:f.subject,lineOfSight:true,cycle:{time:0,lastShotAt:0}},idle={id:'idle',x:280,z:200,target:null};f.engine.firing.states=[gun,idle];d.captureFrame(f.engine);expect(d.frameTargets).toEqual([f.subject]);expect(d.frameWeapons).toEqual([gun]);const initial=d.viewScore(0,f.engine,d.frameTargets,d.frameWeapons);d.planOrbit(f.engine);expect(d.orbitGoalAngle).not.toBeNull();expect(Math.abs(d.orbitGoalAngle)).toBeGreaterThan(.3);
  expect(d.viewScore(d.orbitGoalAngle,f.engine,d.frameTargets,d.frameWeapons)).toBeGreaterThan(initial+.12);const anchor=[...d.focus];let maximumRate=0;
  for(let n=0;n<12*60;n++){f.engine.time+=1/60;gun.cycle.time=gun.cycle.lastShotAt=f.engine.time;d.advance(1/60,{engine:f.engine,phase:'wave'});maximumRate=Math.max(maximumRate,Math.abs(d.orbitRate));centred(d);}
  expect(maximumRate).toBeGreaterThan(.06);expect(maximumRate).toBeLessThanOrEqual(.12+1e-8);const bearing=Math.atan2(d.position[0]-240,d.position[2]-192);expect(d.viewScore(bearing,f.engine,[f.subject],[gun])).toBeGreaterThan(initial+.12);expect([...d.focus]).toEqual(anchor);expect(d.blockedMoves).toBe(0);
 }finally{d.dispose();}
});
test('off-screen fights and stale firing cannot displace the visible exchange',()=>{
 const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(240,24,192);d.position.set([240,230,336]);d.orbitAngle=0;d.yaw=-2;d.pitch=-.5;f.subject.x=f.subject.aimX=180;
  const gun={id:'real-y-fallback',x:200,z:210,target:f.subject,lineOfSight:true,cycle:{time:0,lastShotAt:0}};f.engine.firing.states=[gun];d.planOrbit(f.engine);const goal=d.orbitGoalAngle;expect(goal).not.toBeNull();expect(d.frameWeapons).toEqual([gun]);
  const remote={...f.subject,id:'remote',x:2000,aimX:2000},remoteGun={...gun,id:'remote-gun',x:2024,target:remote},stale={...gun,id:'stale-gun',cycle:{time:0,lastShotAt:-3}};f.engine.enemies.activeTargets.push(remote);f.engine.firing.states.push(remoteGun,stale);d.noteActivity(2000,24,192,f.engine.time,20);d.frameHoldUntil=0;d.planOrbit(f.engine);
  expect(d.frameTargets).toEqual([f.subject]);expect(d.frameWeapons).toEqual([gun]);expect(d.frameImpact).toBe(false);expect(d.orbitGoalAngle).toBe(goal);expect([...d.focus]).toEqual([240,24,192]);
 }finally{d.dispose();}
});
test('purposeful framing reversals preserve continuous angular and physical movement at every display rate',()=>{
 const rates=[];for(const hz of [30,60,120]){const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);advance(f,8,hz);d.frameHoldUntil=d.time+100;d.orbitGoalAngle=d.orbitAngle+Math.PI/2;advance(f,3,hz);expect(d.orbitRate).toBeGreaterThan(.09);d.orbitGoalAngle=d.orbitAngle-Math.PI/2;const focus=[...d.focus];let rate=d.orbitRate,acceleration=[...d.acceleration];
   for(let n=0;n<hz*3;n++){const angle=d.orbitAngle,p=[...d.position];f.engine.time+=1/hz;d.advance(1/hz,{engine:f.engine,phase:'wave'});expect(Math.abs(d.orbitRate-rate)).toBeLessThanOrEqual(.336/hz+1e-7);expect(Math.abs(d.orbitAngle-angle)).toBeLessThanOrEqual(.12/hz+1e-7);expect(Math.hypot(...d.position.map((v,i)=>v-p[i]))).toBeLessThanOrEqual(DRONE_CAMERA_SPEED/hz+1e-6);expect(Math.hypot(...d.acceleration.map((v,i)=>v-acceleration[i]))*hz).toBeLessThanOrEqual(384+1e-4);if(n===0)expect(d.orbitRate).toBeGreaterThan(0);rate=d.orbitRate;acceleration=[...d.acceleration];centred(d);}
   expect(d.orbitRate).toBeLessThan(-.1);expect([...d.focus]).toEqual(focus);expect(d.blockedMoves).toBe(0);rates.push(d.orbitRate);
  }finally{d.dispose();}}
 expect(rates[0]).toBeCloseTo(rates[1],8);expect(rates[1]).toBeCloseTo(rates[2],8);
});
test('swept geometry retains solid terrain, water, scenery and imminent spawn reservations outside or inside the board',()=>{
 const f=basic(),d=f.drone;
 try{expect(d.staticClear(-100,224,100,20,224,100)).toBe(true);expect(d.staticClear(132,25,132,132,25,132)).toBe(false);expect(d.staticClear(132,28,132,132,28,132)).toBe(true);f.world.visibility={nodeCount:1,bounds:new Float32Array([195,24,120,205,290,270]),escape:new Uint32Array([1]),clear:()=>true};expect(d.staticClear(150,224,192,250,224,192)).toBe(false);
  d.waveClock=5;const state={phase:'scheduled',spawnAt:7,movement:{speed:12}},root=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,150,240,190,1]);d.obstacles={records:[{state,root}],poseEnvelope:new Float64Array([-10,-8,-10,10,8,10]),dispose(){}};expect(d.spawnClear(150,240,190,150,240,190)).toBe(false);state.spawnAt=20;expect(d.spawnClear(150,240,190,150,240,190)).toBe(true);
 }finally{d.dispose();}
});
test('near-overhead retargeting moves outward without crossing the target column or dropping altitude',()=>{
 const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);d.position.set([240,230,192]);d.targetAt(241,24,192);let previous=1;for(let n=0;n<2*120;n++){f.engine.time+=1/120;d.advance(1/120,{engine:f.engine,phase:'wave'});const r=Math.hypot(d.position[0]-241,d.position[2]-192);if(r<64)expect(r).toBeGreaterThanOrEqual(previous-1e-6);previous=r;expect(d.position[1]).toBeGreaterThanOrEqual(d.minimumY);}expect(previous).toBeGreaterThan(64);}finally{d.dispose();}
});
test('flight has bounded speed, acceleration and jerk, and capped recovery after long frames',()=>{
 const f=basic(),d=f.drone,acceleration=[0,0,0];try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(480,24,384);for(let n=0;n<6*120;n++){const p=[...d.position];f.engine.time+=1/120;d.advance(1/120,{engine:f.engine,phase:'wave'});expect(Math.hypot(...d.position.map((v,i)=>v-p[i]))).toBeLessThanOrEqual(DRONE_CAMERA_SPEED/120+1e-6);expect(Math.hypot(...d.acceleration)).toBeLessThanOrEqual(96+1e-6);expect(Math.hypot(...d.acceleration.map((v,i)=>v-acceleration[i]))*120).toBeLessThanOrEqual(384+1e-4);acceleration.splice(0,3,...d.acceleration);}const time=d.time;f.engine.time+=30;d.advance(30,{engine:f.engine,phase:'wave'});expect(d.time-time).toBeCloseTo(.25,6);expect(()=>d.advance(-1,{})).toThrow();}finally{d.dispose();}
});
test('all seven native study scenes open inward across the entrance, high and clear without changing combat',()=>assets(async()=>{
 for(const recipe of STUDY_SCENARIOS){const scene=await createStudyScene(recipe),d=new DroneCamera(camera());d.bind(scene.world);try{await advanceStudyScene(scene,recipe.seconds,{yieldControl:async()=>{}});const before=describeStudyScene(scene);d.setEnabled(true);d.sync('wave',scene.engine);expect(d.active).toBe(true);inwardOpening(d,scene.world);expect(d.position[1]).toBeGreaterThanOrEqual(scene.world.level.pathHeight+200);expect(d.staticClear(...d.position,...d.position)).toBe(true);expect(d.obstacles.pointClear(...d.position,DRONE_CAMERA_RADIUS)).toBe(true);centred(d);expect(describeStudyScene(scene)).toEqual(before);}finally{d.dispose();scene.dispose();}}
}),30000);
test('occasional close views preserve the exact anchor, pause, manual deferral and fresh-wave lens',()=>{
 const f=basic(),d=f.drone;
 try{d.setEnabled(true);d.sync('wave',f.engine);d.position.set([240,230,336]);d.targetAt(240,24,192);const anchor=[...d.focus];
  advance(f,11);expect(d.lens.zoomCount).toBe(1);expect(d.fov).toBeLessThan(55);expect(f.c.fov).toBe(d.fov);expect([...d.focus]).toEqual(anchor);centred(d);
  const paused=d.stats();d.advance(20,{engine:f.engine,phase:'wave',paused:true});expect(d.stats()).toEqual(paused);
  const fov=d.fov,velocity=d.lens.velocity;d.rotate(1,0);expect(d.fov).toBe(fov);expect(d.lens.velocity).toBe(velocity);expect(d.lens.target).toBe(60);expect(d.lens.nextDecision).toBeCloseTo(d.time+8,8);
  advance(f,5);expect(d.fov).toBeGreaterThan(59.8);expect(d.lens.zoomCount).toBe(1);
  d.sync('loadout',f.engine);d.sync('wave',f.engine);expect(d.fov).toBe(60);expect(d.lens.zoomCount).toBe(0);expect(d.lens.nextDecision).toBe(8);
 }finally{d.dispose();}
});
test('zoom fit protects subjects at the actual frame edge and ignores hidden or off-screen action',()=>{
 const f=basic(),d=f.drone;
 try{d.setEnabled(true);d.sync('wave',f.engine);d.position.set([240,230,336]);d.targetAt(240,24,192);
  const depth=(206*188+144*144)/Math.hypot(206,144);f.subject.aimX=240+Math.tan(Math.PI/6)*1.5*depth*.95;
  d.captureFrame(f.engine);expect(d.frameTargets).toHaveLength(0);d.fitZoom(f.engine);expect(d.lensVisible).toBe(1);expect(d.lensRequired).toBeGreaterThan(62);
  d.lens.observe(8,d.lensRequired,d.lensVisible);expect(d.lens.target).toBe(62);expect(d.lens.zoomCount).toBe(0);
  f.subject.aimX=1000;d.fitZoom(f.engine);expect(d.lensVisible).toBe(0);f.subject.aimX=240;f.world.visibility.clear=()=>false;d.fitZoom(f.engine);expect(d.lensVisible).toBe(0);
 }finally{d.dispose();}
});
test('zoom fit includes recent participating weapons with missing height, excluding stale or remote fire',()=>{
 const f=basic(),d=f.drone;
 try{d.setEnabled(true);d.sync('wave',f.engine);d.position.set([240,230,336]);d.targetAt(240,24,192);f.engine.time=2;
  const gun={id:'gun',x:290,z:210,target:f.subject,cycle:{time:2,lastShotAt:1.5}};f.engine.firing.states=[gun];d.fitZoom(f.engine);expect(d.lensVisible).toBe(2);expect(Number.isFinite(d.lensRequired)).toBe(true);
  gun.cycle.lastShotAt=0;d.fitZoom(f.engine);expect(d.lensVisible).toBe(1);gun.cycle.lastShotAt=2;gun.target={...f.subject,aimX:1000};d.fitZoom(f.engine);expect(d.lensVisible).toBe(1);
  gun.target=f.subject;gun.lineOfSight=false;d.fitZoom(f.engine);expect(d.lensVisible).toBe(1);
 }finally{d.dispose();}
});
test('native A2/B4/D4 battles at 30/60/120 Hz preserve combat outcomes and swept clearance with edge targeting and WASD',()=>assets(async()=>{
 for(const id of ['skirmish','split','late']){
  const recipe=STUDY_SCENARIOS.find(s=>s.id===id),baseline=await createStudyScene(recipe);let expected;try{await advanceStudyScene(baseline,100,{yieldControl:async()=>{}});expected=[baseline.engine.enemies.killed,baseline.engine.enemies.escaped,baseline.engine.firing.shots,baseline.engine.steps];}finally{baseline.dispose();}
  const outcomes=[];
  for(const hz of [30,60,120]){const scene=await createStudyScene(recipe),d=new DroneCamera(camera());d.bind(scene.world);d.setEnabled(true);d.sync('wave',scene.engine);let retargeted=false,keyboardStage=-1;
   try{while(scene.engine.running&&scene.engine.time<100){if(!retargeted&&scene.engine.time>3){d.targetAt(0,24,0);retargeted=true;}const stage=scene.engine.time<4?0:scene.engine.time<7?1:scene.engine.time<10?2:3;if(stage!==keyboardStage){keyboardStage=stage;if(stage===1)d.setKeyboard(1,-1);else if(stage===2)d.setKeyboard(-1,1);else d.setKeyboard(0,0,false);}const old=[...d.position];scene.engine.advance(1/hz);d.advance(1/hz,{engine:scene.engine,phase:'wave'});expect(d.position[1]).toBeGreaterThanOrEqual(d.minimumY);expect(d.staticClear(...old,...d.position)).toBe(true);expect(d.obstacles.pointClear(...d.position,DRONE_CAMERA_RADIUS,0)).toBe(true);expect([...d.position,...d.focus,d.yaw,d.pitch,d.fov].every(Number.isFinite)).toBe(true);centred(d);}outcomes.push([scene.engine.enemies.killed,scene.engine.enemies.escaped,scene.engine.firing.shots,scene.engine.steps]);expect(d.blockedMoves).toBe(0);}finally{d.dispose();scene.dispose();}
  }expect(outcomes[0]).toEqual(expected);expect(outcomes[1]).toEqual(expected);expect(outcomes[2]).toEqual(expected);
 }
}),90000);

// Keyboard translations and turns share the production smooth flight path.
test('W/S translate the target in the current view and ease to a fixed anchor after release',()=>{
 for(const forward of [1,-1])for(const bearing of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const f=basic(),d=f.drone;d.setEnabled(true);d.sync('wave',f.engine);f.engine.enemies.activeTargets=[];d.focus.set([240,24,192]);d.position.set([240+Math.sin(bearing)*144,d.cruiseY+6,192+Math.cos(bearing)*144]);d.orbitAngle=bearing;d.orbitRate=0;d.aim();
  const start=[...d.focus];d.setKeyboard(forward,0);advance(f,1);const dx=d.focus[0]-start[0],dz=d.focus[2]-start[2];expect((-dx*Math.sin(bearing)-dz*Math.cos(bearing))*forward).toBeGreaterThan(30);expect(Math.abs(dx*Math.cos(bearing)-dz*Math.sin(bearing))).toBeLessThan(.001);centred(d);
  const speed=d.targetSpeed;d.setKeyboard(0,0,false);expect(d.targetSpeed).toBe(speed);advance(f,3);expect(d.targetSpeed).toBe(0);const anchor=[...d.focus],angle=d.orbitAngle;advance(f,2);expect([...d.focus]).toEqual(anchor);expect(Math.abs(d.orbitAngle-angle)).toBeGreaterThan(.01);expect(d.blockedMoves).toBe(0);d.dispose();
 }
});
test('A is clockwise and D counter-clockwise, with eased reversal and automatic resumption',()=>{
 const f=basic(),d=f.drone;d.setEnabled(true);d.sync('wave',f.engine);f.engine.enemies.activeTargets=[];const anchor=[...d.focus],start=d.orbitAngle;
 d.setKeyboard(0,-1);advance(f,2);expect(d.orbitAngle).toBeLessThan(start-.3);expect(d.orbitRate).toBeLessThan(-.2);const rate=d.orbitRate;d.setKeyboard(0,1);advance(f,1/60);expect(Math.abs(d.orbitRate-rate)).toBeLessThan(.02);advance(f,3);expect(d.orbitRate).toBeGreaterThan(.25);expect([...d.focus]).toEqual(anchor);
 d.setKeyboard(0,0,false);advance(f,4);expect(d.orbitRate).toBeCloseTo(.035,2);expect([...d.focus]).toEqual(anchor);centred(d);d.dispose();
});
test('combined keyboard movement preserves smooth physical limits, board bounds and display-rate agreement',()=>{
 const results=[];
 for(const hz of [30,60,120]){
  const f=basic(),d=f.drone;d.setEnabled(true);d.sync('wave',f.engine);f.engine.enemies.activeTargets=[];let velocity=[...d.velocity],acceleration=[...d.acceleration];
  for(const [forward,turn,seconds] of [[1,-1,3],[-1,1,3],[0,0,3],[1,0,12],[-1,0,12]]){
   d.setKeyboard(forward,turn);
   for(let n=0;n<seconds*hz;n++){advance(f,1/hz,hz);expect(d.speed).toBeLessThanOrEqual(DRONE_CAMERA_SPEED+1e-8);expect(Math.hypot(...d.acceleration)).toBeLessThanOrEqual(96+1e-7);expect(Math.hypot(...d.acceleration.map((a,i)=>a-acceleration[i]))*hz).toBeLessThanOrEqual(384+1e-6);expect(Math.hypot(...d.velocity.map((v,i)=>v-velocity[i]))*hz).toBeLessThanOrEqual(96+1e-6);expect(d.focus[0]).toBeGreaterThanOrEqual(0);expect(d.focus[0]).toBeLessThanOrEqual(480);expect(d.focus[2]).toBeGreaterThanOrEqual(0);expect(d.focus[2]).toBeLessThanOrEqual(384);expect(d.position[1]).toBeGreaterThanOrEqual(d.cruiseY);velocity=[...d.velocity];acceleration=[...d.acceleration];centred(d);}
  }
  expect(d.blockedMoves).toBe(0);results.push([...d.position,...d.focus,d.orbitAngle]);d.dispose();
 }
 for(const result of results.slice(1))for(let i=0;i<result.length;i++)expect(result[i]).toBeCloseTo(results[0][i],6);
});
test('keyboard pause is exact and wave changes clear all keyboard motion',()=>{
 const f=basic(),d=f.drone;d.setEnabled(true);d.sync('wave',f.engine);d.setKeyboard(1,-1);advance(f,.5);const before=d.stats();d.advance(1,{engine:f.engine,phase:'wave',paused:true});expect(d.stats()).toEqual(before);
 d.sync('loadout',f.engine);expect(d.keyboardActive).toBe(false);expect(d.targetSpeed).toBe(0);d.sync('wave',f.engine);expect([...d.focus]).toEqual([12,24,204]);expect(d.keyboardForward).toBe(0);expect(d.keyboardTurn).toBe(0);d.dispose();
});

test('orbit-only keys preserve a manually selected raised terrain wall anchor',()=>{
 const f=basic(),d=f.drone;f.world.level.terrain.boxes=[{box:[9,5],ground:100,water:0}];d.bind(f.world);d.setEnabled(true);d.sync('wave',f.engine);d.position.set([228,230,300]);d.focus.set([228,50,144]);d.aim();d.rotate(0,0);const anchor=[...d.focus];expect(anchor[1]).toBeGreaterThan(24);expect(anchor[1]).toBeLessThan(100);
 d.setKeyboard(0,-1);advance(f,1);expect([...d.focus]).toEqual(anchor);centred(d);d.dispose();
});


test('the last A/D choice survives release, opposing framing, translation and retargeting at every display rate',()=>{
 for(const hz of [30,60,120])for(const direction of [-1,1]){
  const f=basic(),d=f.drone;d.setEnabled(true);d.sync('wave',f.engine);d.setKeyboard(0,direction);advance(f,2,hz);d.setKeyboard(0,0,false);const anchor=[...d.focus],angle=d.orbitAngle;
  // A destination behind the selected direction must not reverse the orbit,
  // including after passing a previously useful composition.
  for(let n=0;n<6*hz;n++){d.orbitGoalAngle=d.orbitAngle-direction*.4;d.frameHoldUntil=d.time+10;advance(f,1/hz,hz);expect(d.orbitRate*direction).toBeGreaterThan(0);}
  expect((d.orbitAngle-angle)*direction).toBeGreaterThan(.2);expect([...d.focus]).toEqual(anchor);
  d.setKeyboard(1,0);advance(f,.5,hz);d.setKeyboard(0,0,false);d.targetAt(240,24,192);advance(f,2,hz);expect(d.playerOrbitDirection).toBe(direction);expect(d.orbitRate*direction).toBeGreaterThan(0);centred(d);
  d.setKeyboard(0,-direction);advance(f,3,hz);d.setKeyboard(0,0,false);advance(f,2,hz);expect(d.playerOrbitDirection).toBe(-direction);expect(d.orbitRate*-direction).toBeGreaterThan(0);expect(d.blockedMoves).toBe(0);d.dispose();
 }
});
test('a quick rotation tap is remembered before a frame and automatic framing searches only the chosen direction',()=>{
 for(const direction of [-1,1]){
  const f=basic(),d=f.drone;d.setEnabled(true);d.sync('wave',f.engine);d.setKeyboard(0,direction);d.setKeyboard(0,0,false);expect(d.playerOrbitDirection).toBe(direction);advance(f,1);expect(d.orbitRate*direction).toBeGreaterThan(0);
  const bearing=Math.atan2(d.position[0]-d.focus[0],d.position[2]-d.focus[2]),sampled=[];d.captureFrame=()=>{d.frameTargets=[f.subject];};d.viewScore=angle=>{const delta=angle-bearing;sampled.push(delta);return Math.abs(delta)<.01?0:1;};d.frameHoldUntil=0;d.planOrbit(f.engine);
  expect(d.orbitGoalAngle).not.toBeNull();expect((d.orbitGoalAngle-bearing)*direction).toBeGreaterThan(0);for(const delta of sampled)expect(delta*direction).toBeGreaterThanOrEqual(-1e-10);
  d.sync('loadout',f.engine);expect(d.playerOrbitDirection).toBe(0);d.sync('wave',f.engine);expect(d.playerOrbitDirection).toBe(0);d.dispose();
 }
});
