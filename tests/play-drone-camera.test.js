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
test('waves start centrally, high, and aimed exactly at a spawn rather than the current fight',()=>{
 const f=basic(),d=f.drone;
 try{d.setEnabled(true);d.sync('wave',f.engine);expect([...d.position].filter((_,i)=>i!==1)).toEqual([240,192]);expect(d.position[1]).toBeGreaterThanOrEqual(24+DRONE_CAMERA_MIN_ALTITUDE);expect([...d.focus]).toEqual([12,24,204]);expect(d.fov).toBe(64);centred(d);
  const anchor=[...d.focus];advance(f,20);expect([...d.focus]).toEqual(anchor);expect(d.targeted).toBe(false);expect(d.position[1]).toBeGreaterThanOrEqual(d.cruiseY);centred(d);
 }finally{d.dispose();}
});
test('the selected wave route determines the opening entrance and each wave resets manual targeting',()=>{
 const f=basic(),d=f.drone;f.world.level.routes=[{id:'other',path:[[19,0,3],[18,0,3]]}];f.engine.wave={spawns:[{routeId:'other'}]};
 try{d.setEnabled(true);d.sync('wave',f.engine);expect([...d.focus]).toEqual([468,24,84]);d.targetAt(100,24,200);d.sync('loadout',f.engine);expect(d.targeted).toBe(false);d.sync('wave',f.engine);expect([...d.focus]).toEqual([468,24,84]);centred(d);}finally{d.dispose();}
});
test('pause, settling, disabling and rebinding preserve camera ownership and release caches',()=>{
 const f=basic(),d=f.drone,original=[...f.c.target,f.c.yaw,f.c.pitch,f.c.radius];
 try{d.setEnabled(true);d.sync('deploy',f.engine);expect(d.active).toBe(false);d.sync('wave',f.engine);advance(f,.5);const before=d.stats();d.advance(30,{engine:f.engine,phase:'wave',paused:true});expect(d.stats()).toEqual(before);advance(f,.5,60,'settling');expect(d.time).toBeGreaterThan(before.time);d.setEnabled(false);expect([...f.c.target,f.c.yaw,f.c.pitch,f.c.radius]).toEqual(original);expect(f.c.mode).toBe('overview');d.setEnabled(true);d.sync('wave',f.engine);const obstacles=d.obstacles;d.bind(null);expect(obstacles.disposed).toBe(true);expect(d.obstacles).toBeNull();expect(d.world).toBeNull();expect(d.active).toBe(false);}finally{d.dispose();}
});
test('drag rotation changes the exact world target and subsequent movement keeps it under the reticle',()=>{
 const f=basic(),d=f.drone;
 try{d.setEnabled(true);d.sync('wave',f.engine);const old=[...d.focus],yaw=d.yaw;expect(d.rotate(45,25)).toBe(true);expect(d.yaw).toBeCloseTo(yaw-.18,6);expect([...d.focus]).not.toEqual(old);const anchor=[...d.focus];centred(d);
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
 try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(228,24,132);expect(d.focus[1]).toBe(8);d.rotate(0,0);expect(d.focus[1]).toBeCloseTo(8,8);centred(d);d.targetAt(252,0,132);expect(d.focus[1]).toBe(24);d.rotate(0,0);expect(d.focus[1]).toBeCloseTo(24,8);centred(d);}finally{d.dispose();}
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
 const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(240,24,192);d.orbitAngle=0;f.subject.x=f.subject.aimX=180;
  expect(d.viewScore(.3,f.engine)).toBeGreaterThan(0);expect(d.viewScore(-.3,f.engine)).toBeGreaterThan(0);d.planOrbit(f.engine);expect(d.orbitDirection).toBe(-1);expect([...d.focus]).toEqual([240,24,192]);
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
test('orbit direction favours visible enemies without moving the target, with a reversal hold',()=>{
 const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);const target=[...d.focus];d.viewScore=a=>a<d.orbitAngle?1:0;d.planOrbit(f.engine);expect(d.orbitDirection).toBe(-1);d.viewScore=a=>a>d.orbitAngle?1:0;d.planOrbit(f.engine);expect(d.orbitDirection).toBe(-1);d.time+=4.1;d.planOrbit(f.engine);expect(d.orbitDirection).toBe(1);expect([...d.focus]).toEqual(target);}finally{d.dispose();}
});
test('swept geometry retains solid terrain, water, scenery and imminent spawn reservations outside or inside the board',()=>{
 const f=basic(),d=f.drone;
 try{expect(d.staticClear(-100,224,100,20,224,100)).toBe(true);expect(d.staticClear(132,25,132,132,25,132)).toBe(false);expect(d.staticClear(132,28,132,132,28,132)).toBe(true);f.world.visibility={nodeCount:1,bounds:new Float32Array([195,24,120,205,290,270]),escape:new Uint32Array([1]),clear:()=>true};expect(d.staticClear(150,224,192,250,224,192)).toBe(false);
  d.waveClock=5;const state={phase:'scheduled',spawnAt:7,movement:{speed:12}},root=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,150,240,190,1]);d.obstacles={records:[{state,root}],poseEnvelope:new Float64Array([-10,-8,-10,10,8,10]),dispose(){}};expect(d.spawnClear(150,240,190,150,240,190)).toBe(false);state.spawnAt=20;expect(d.spawnClear(150,240,190,150,240,190)).toBe(true);
 }finally{d.dispose();}
});
test('near-overhead retargeting moves outward without crossing the target column or dropping altitude',()=>{
 const f=basic(),d=f.drone;try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(241,24,192);let previous=1;for(let n=0;n<2*120;n++){f.engine.time+=1/120;d.advance(1/120,{engine:f.engine,phase:'wave'});const r=Math.hypot(d.position[0]-241,d.position[2]-192);if(r<64)expect(r).toBeGreaterThanOrEqual(previous-1e-6);previous=r;expect(d.position[1]).toBeGreaterThanOrEqual(d.minimumY);}expect(previous).toBeGreaterThan(64);}finally{d.dispose();}
});
test('flight has bounded speed, acceleration and jerk, and capped recovery after long frames',()=>{
 const f=basic(),d=f.drone,acceleration=[0,0,0];try{d.setEnabled(true);d.sync('wave',f.engine);d.targetAt(480,24,384);for(let n=0;n<6*120;n++){const p=[...d.position];f.engine.time+=1/120;d.advance(1/120,{engine:f.engine,phase:'wave'});expect(Math.hypot(...d.position.map((v,i)=>v-p[i]))).toBeLessThanOrEqual(DRONE_CAMERA_SPEED/120+1e-6);expect(Math.hypot(...d.acceleration)).toBeLessThanOrEqual(96+1e-6);expect(Math.hypot(...d.acceleration.map((v,i)=>v-acceleration[i]))*120).toBeLessThanOrEqual(384+1e-4);acceleration.splice(0,3,...d.acceleration);}const time=d.time;f.engine.time+=30;d.advance(30,{engine:f.engine,phase:'wave'});expect(d.time-time).toBeCloseTo(.25,6);expect(()=>d.advance(-1,{})).toThrow();}finally{d.dispose();}
});
test('all seven native study scenes open centrally, high and aimed at a real entrance without changing combat',()=>assets(async()=>{
 for(const recipe of STUDY_SCENARIOS){const scene=await createStudyScene(recipe),d=new DroneCamera(camera());d.bind(scene.world);try{await advanceStudyScene(scene,recipe.seconds,{yieldControl:async()=>{}});const before=describeStudyScene(scene);d.setEnabled(true);d.sync('wave',scene.engine);expect(d.active).toBe(true);expect(d.position[0]).toBe(scene.world.width/2);expect(d.position[2]).toBe(scene.world.length/2);expect(d.position[1]).toBeGreaterThanOrEqual(scene.world.level.pathHeight+200);expect(d.staticClear(...d.position,...d.position)).toBe(true);expect(d.obstacles.pointClear(...d.position,DRONE_CAMERA_RADIUS)).toBe(true);centred(d);expect(describeStudyScene(scene)).toEqual(before);}finally{d.dispose();scene.dispose();}}
}),30000);
test('native A2/B4/D4 battles at 30/60/120 Hz preserve combat outcomes and swept clearance with manual edge retargeting',()=>assets(async()=>{
 for(const id of ['skirmish','split','late']){
  const recipe=STUDY_SCENARIOS.find(s=>s.id===id),baseline=await createStudyScene(recipe);let expected;try{await advanceStudyScene(baseline,100,{yieldControl:async()=>{}});expected=[baseline.engine.enemies.killed,baseline.engine.enemies.escaped,baseline.engine.firing.shots,baseline.engine.steps];}finally{baseline.dispose();}
  const outcomes=[];
  for(const hz of [30,60,120]){const scene=await createStudyScene(recipe),d=new DroneCamera(camera());d.bind(scene.world);d.setEnabled(true);d.sync('wave',scene.engine);let retargeted=false;
   try{while(scene.engine.running&&scene.engine.time<100){if(!retargeted&&scene.engine.time>3){d.targetAt(0,24,0);retargeted=true;}const old=[...d.position];scene.engine.advance(1/hz);d.advance(1/hz,{engine:scene.engine,phase:'wave'});expect(d.position[1]).toBeGreaterThanOrEqual(d.minimumY);expect(d.staticClear(...old,...d.position)).toBe(true);expect(d.obstacles.pointClear(...d.position,DRONE_CAMERA_RADIUS,0)).toBe(true);expect([...d.position,...d.focus,d.yaw,d.pitch,d.fov].every(Number.isFinite)).toBe(true);centred(d);}outcomes.push([scene.engine.enemies.killed,scene.engine.enemies.escaped,scene.engine.firing.shots,scene.engine.steps]);expect(d.blockedMoves).toBe(0);}finally{d.dispose();scene.dispose();}
  }expect(outcomes[0]).toEqual(expected);expect(outcomes[1]).toEqual(expected);expect(outcomes[2]).toEqual(expected);
 }
}),90000);
