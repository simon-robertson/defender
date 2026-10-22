import {test,expect} from 'bun:test';
import {Camera} from '../engine/camera.js';
import {DroneCamera,DRONE_CAMERA_SPEED,DRONE_CAMERA_RADIUS,DRONE_CAMERA_MIN_FOV,DRONE_CAMERA_MAX_FILM_PITCH,DRONE_CAMERA_MIN_ALTITUDE} from '../play/drone-camera.js';
import {SceneryVisibility} from '../engine/visibility.js';
import {STUDY_SCENARIOS} from '../tools/camera-study-scenarios.js';
import {createStudyScene,advanceStudyScene,describeStudyScene,seededRandom} from '../tools/camera-study-scene.js';
const camera=()=>new Camera({clientWidth:1500,clientHeight:1000,addEventListener(){},focus(){}},()=>{});
function basic(){
 const level={id:'camera-fixture',size:[20,16],path:[[0,0,8],[1,0,8]],pathHeight:24,terrain:{defaultHeight:24,boxes:[]},placements:[]},world={level,width:480,length:384,rigs:new Map(),actors:new Map(),visibility:new SceneryVisibility(level,new Map())},c=camera();c.setLevel(level);const drone=new DroneCamera(c,{random:()=>.35});drone.bind(world);
 const subject={id:'actor',phase:'active',health:{alive:true},x:240,y:24,z:192,aimX:240,aimY:42,aimZ:192,distance:10,path:{length:1000},movement:{speed:12}};
 const engine={time:0,enemies:{states:[],activeTargets:[subject]},firing:{states:[]},wildlife:{states:[]}};return {world,c,drone,engine,subject};
}
function advance(f,seconds,hz=60,phase='wave'){for(let i=0;i<seconds*hz;i++){f.engine.time+=1/hz;f.drone.advance(1/hz,{engine:f.engine,phase});}}
async function assets(run){const before=globalThis.fetch;globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};try{return await run();}finally{globalThis.fetch=before;}}

test('a wave uses perspective immediately; pause, settling and preparation preserve ownership',()=>{
 const f=basic(),d=f.drone,original=[...f.c.target,f.c.yaw,f.c.pitch,f.c.radius];
 try{d.setEnabled(true);d.sync('loadout',f.engine);expect(d.active).toBe(false);d.sync('wave',f.engine);expect(d.active).toBe(true);expect(f.c.mode).toBe('live');advance(f,.5);const before=d.stats();d.advance(30,{engine:f.engine,phase:'wave',paused:true});expect(d.stats()).toEqual(before);advance(f,.5,60,'settling');expect(d.time).toBeGreaterThan(before.time);d.setEnabled(false);expect([...f.c.target,f.c.yaw,f.c.pitch,f.c.radius]).toEqual(original);expect(f.c.mode).toBe('overview');}finally{d.dispose();}
});
test('a wave opens high and broad for three simulation seconds before normal lower shots resume',()=>{
 const f=basic(),d=f.drone,gun={id:'gun',x:265,z:192,target:f.subject,lineOfSight:true,cycle:{time:0,lastShotAt:0}};f.engine.firing.states=[gun];
 const tick=()=>{f.engine.time+=1/60;gun.cycle.time=gun.cycle.lastShotAt=f.engine.time;d.advance(1/60,{engine:f.engine,phase:'wave'});};
 try{
  d.setEnabled(true);d.sync('wave',f.engine);const floor=d.cruiseY;expect(d.position[1]).toBeGreaterThanOrEqual(floor);expect(d.fov).toBe(64);expect(d.currentFrame().board).toBeGreaterThan(.55);
  for(let n=0;n<174;n++){tick();expect(d.position[1]).toBeGreaterThan(floor-3);expect(d.targetFov).toBe(64);}
  const before=d.stats();d.advance(30,{engine:f.engine,phase:'wave',paused:true});expect(d.stats()).toEqual(before);
  for(let n=0;n<42;n++)tick();expect(d.targetFov).toBe(56);expect(d.goal[1]).toBeLessThan(floor);expect(d.director.intent.subject).toBe(f.subject);
 }finally{d.dispose();}
});
test('camera work leaves enemy/weapon state unchanged and has bounded translation, turn and lens rates',()=>{
 const f=basic(),d=f.drone;d.setEnabled(true);d.sync('wave',f.engine);const actor=JSON.stringify(f.subject);
 try{let previous=d.stats();for(let n=0;n<180;n++){f.engine.time+=1/60;d.advance(1/60,{engine:f.engine,phase:'wave'});const now=d.stats();expect(Math.hypot(...d.position.map((v,i)=>v-previous.position[i]))).toBeLessThanOrEqual(DRONE_CAMERA_SPEED/60+1e-6);expect(Math.abs(now.pitch-previous.pitch)).toBeLessThanOrEqual(1.4/60+1e-8);expect(Math.abs(now.fov-previous.fov)).toBeLessThanOrEqual(9/60+1e-8);previous=now;}expect(JSON.stringify(f.subject)).toBe(actor);const time=d.time;f.engine.time+=30;d.advance(30,{engine:f.engine,phase:'wave'});expect(d.time-time).toBeCloseTo(.25,6);expect(()=>d.advance(-1,{})).toThrow();}finally{d.dispose();}
});
test('a calm survey is wider than a dominant fight, and dramatic views respect the new altitude floor',()=>{
 const f=basic(),d=f.drone;
 try{d.setEnabled(true);d.sync('wave',f.engine);expect(d.director.intent.style).toBe('survey');expect(d.targetFov).toBe(64);
 advance(f,3.2);const at=f.engine.time+1;f.engine.firing.states=[{id:'gun',x:265,z:192,model:'turret-study',target:f.subject,lineOfSight:true,cycle:{time:at,lastShotAt:at}}];f.engine.time=at;d.chooseSubject(f.engine);expect(d.director.intent.style).toBe('battle');d.compose(f.engine);d.planShot();expect(d.targetFov).toBe(56);
 for(let shot=0;shot<3;shot++){d.director.exposure=6.1;f.engine.time+=.4;d.chooseSubject(f.engine);}expect(d.director.intent.style).toBe('dramatic');expect(d.planShot()).toBe(true);expect(d.goal[1]).toBeGreaterThanOrEqual(f.world.level.pathHeight+DRONE_CAMERA_MIN_ALTITUDE);expect(d.staticClear(...d.goal,...d.goal)).toBe(true);expect(d.director.intent.subject).toBe(f.subject);
 }finally{d.dispose();}
});
test('every random seed starts at the board centre above the opening height',()=>{
 for(const seed of [17,97,177,257,337,417]){
  const f=basic(),d=f.drone;d.random=seededRandom(seed);
  try{d.setEnabled(true);d.sync('wave',f.engine);expect(d.position[0]).toBe(f.world.width/2);expect(d.position[2]).toBe(f.world.length/2);expect(d.position[1]).toBeGreaterThanOrEqual(d.cruiseY);expect(d.currentFrame().action).toBe(1);expect(d.columnClear(...d.position)).toBe(true);}finally{d.dispose();}
 }
});
test('an enclosed fight selects a clear interior station when surrounding terrain hides exterior shots',()=>{
 const f=basic(),d=f.drone,level=f.world.level;
 for(let z=2;z<=13;z++)for(let x=4;x<=15;x++)if(x===4||x===15||z===2||z===13)level.terrain.boxes.push({box:[x,z],ground:220,water:0});
 f.world.visibility=new SceneryVisibility(level,new Map());d.bind(f.world);
 f.engine.firing.states=[{id:'gun',x:265,z:192,target:f.subject,lineOfSight:true,cycle:{time:0,lastShotAt:0}}];
 try{d.setEnabled(true);d.sync('wave',f.engine);expect(d.active).toBe(true);expect(d.position[0]).toBeGreaterThan(120);expect(d.position[0]).toBeLessThan(360);expect(d.position[2]).toBeGreaterThan(96);expect(d.position[2]).toBeLessThan(288);expect(d.currentFrame().action).toBe(1);expect(d.columnClear(...d.position)).toBe(true);}finally{d.dispose();}
});
test('after the central opening, terrain-obscured fronts can choose higher coverage inside the board',()=>{
 const f=basic(),d=f.drone;
 const targets=[f.subject,...[[80,70],[400,70],[80,314],[400,314]].map(([x,z],i)=>({...f.subject,id:`other-${i}`,x,z,aimX:x,aimZ:z}))];
 f.engine.enemies.activeTargets=targets;f.engine.firing.states=targets.map((target,i)=>({id:`gun-${i}`,x:target.x+25,z:target.z,target,lineOfSight:true,cycle:{time:0,lastShotAt:0}}));
 for(let z=4;z<=11;z++)for(let x=6;x<=13;x++)if(x===6||x===13||z===4||z===11)f.world.level.terrain.boxes.push({box:[x,z],ground:100,water:0});
 f.world.visibility=new SceneryVisibility(f.world.level,new Map());d.bind(f.world);
 try{
  d.setEnabled(true);d.sync('wave',f.engine);d.time=d.openingUntil;expect(d.planShot()).toBe(true);
  const frame=d.framing.evaluate(d.orientShot(...d.goal,d.focus,d.targetFov),d.director,d.aspect,true);
  expect(frame.global).toBeGreaterThan(.85);expect(d.goal[1]-f.world.level.pathHeight).toBeGreaterThan(150);expect(d.staticClear(...d.goal,...d.goal)).toBe(true);
 }finally{d.dispose();}
});
test('a readable local shot yields to substantially better coverage of the same wide battle',()=>{
 const f=basic(),d=f.drone;
 const targets=[f.subject,...[[80,70],[400,70],[80,314],[400,314]].map(([x,z],i)=>({...f.subject,id:`other-${i}`,x,z,aimX:x,aimZ:z}))];
 f.engine.enemies.activeTargets=targets;f.engine.firing.states=targets.map((target,i)=>({id:`gun-${i}`,x:target.x+25,z:target.z,target,lineOfSight:true,cycle:{time:0,lastShotAt:0}}));
 try{
  d.setEnabled(true);d.sync('wave',f.engine);d.time=d.openingUntil;d.position.set([240,d.minimumY,300]);const pose=d.framing.orient(...d.position,d.focus,d.fov);d.yaw=pose.yaw;d.pitch=pose.pitch;d.routeIndex=d.routeLength=0;d.goalSince=d.time-3;
  const before={...d.currentFrame()};expect(before.action).toBe(1);expect(before.global).toBeLessThan(.85);const relocations=d.relocations;
  expect(d.planShot()).toBe(true);expect(d.relocations).toBe(relocations+1);
  const after=d.framing.evaluate(d.framing.orient(...d.goal,d.focus,d.targetFov),d.director,d.aspect,true);expect(after.global).toBeGreaterThan(before.global+.15);expect(after.action).toBe(1);
 }finally{d.dispose();}
});
test('swept flight rejects an intervening wall and retains continuous high detours',()=>{
 const f=basic(),d=f.drone;f.world.visibility={nodeCount:1,bounds:new Float32Array([195,24,120,205,90,270]),escape:new Uint32Array([1]),clear:()=>true};d.cruiseY=144;d.position.set([150,44,192]);d.phase='wave';
 try{expect(d.staticClear(150,44,192,250,44,192)).toBe(false);expect(d.routeTo(250,44,192)).toBe(true);expect(d.routeLength).toBe(3);let highest=0,steps=0;while(d.routeIndex<d.routeLength&&steps++<3000){const prev=[...d.position];d.move(1/120);highest=Math.max(highest,d.position[1]);expect(d.staticClear(...prev,...d.position)).toBe(true);}expect(steps).toBeLessThan(3000);expect(highest).toBeGreaterThan(130);}finally{d.dispose();}
});
test('rejecting an unsafe replacement destination does not discard the committed route',()=>{
 const f=basic(),d=f.drone;d.position.set([150,180,180]);d.phase='wave';d.active=true;
 try{expect(d.routeTo(260,180,200)).toBe(true);const route=[...d.route],length=d.routeLength,index=d.routeIndex;expect(d.routeTo(260,30,200)).toBe(false);expect([...d.route]).toEqual(route);expect(d.routeLength).toBe(length);expect(d.routeIndex).toBe(index);}finally{d.dispose();}
});
test('scene release drops actor references and obstacle caches',()=>{
 const f=basic(),d=f.drone;d.setEnabled(true);d.sync('wave',f.engine);const obstacles=d.obstacles;d.bind(null);expect(obstacles.disposed).toBe(true);expect(d.obstacles).toBeNull();expect(d.director.subjects.every(p=>p.state===null)).toBe(true);expect(d.director.areas.every(a=>a.enemy===null)).toBe(true);expect(d.framing.world).toBeNull();d.dispose();
});
test('imminent scheduled enemies reserve their entrance while distant future spawns do not',()=>{
 const f=basic(),d=f.drone;d.waveClock=5;const state={phase:'scheduled',spawnAt:7,movement:{speed:12}},root=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,150,40,190,1]);d.obstacles={records:[{state,root}],poseEnvelope:new Float64Array([-10,-8,-10,10,8,10]),dispose(){}};
 try{expect(d.spawnClear(150,40,190,150,40,190)).toBe(false);state.spawnAt=20;expect(d.spawnClear(150,40,190,150,40,190)).toBe(true);state.phase='active';state.spawnAt=7;expect(d.spawnClear(150,40,190,150,40,190)).toBe(true);}finally{d.dispose();}
});
test('water, terrain, board boundaries and the raised physical floor remain solid',()=>{
 const f=basic(),d=f.drone;f.world.visibility={nodeCount:0,bounds:new Float32Array(0),escape:[],clear:()=>true};d.water[5*20+5]=24;
 try{expect(d.staticClear(132,25,132,132,25,132)).toBe(false);expect(d.staticClear(132,28,132,132,28,132)).toBe(true);expect(d.staticClear(-100,100,100,20,100,100)).toBe(false);expect(d.staticClear(DRONE_CAMERA_RADIUS,100,100,20,100,100)).toBe(true);expect(d.staticClear(-241,100,100,20,100,100)).toBe(false);d.active=true;expect(d.routeTo(250,37,192)).toBe(false);}finally{d.dispose();}
});
test('outward momentum and settling drift stay inside all four board corners and above the altitude floor',()=>{
 for(const sideX of [-1,1])for(const sideZ of [-1,1]){
  const f=basic(),d=f.drone;d.active=true;d.phase='wave';d.position.set([sideX<0?DRONE_CAMERA_RADIUS+4:f.world.width-DRONE_CAMERA_RADIUS-4,d.minimumY+1,sideZ<0?DRONE_CAMERA_RADIUS+4:f.world.length-DRONE_CAMERA_RADIUS-4]);d.velocity.set([sideX*48,-30,sideZ*48]);
  try{for(let n=0;n<360;n++){if(n===180)d.phase='settling';d.move(1/120);expect(d.position[0]).toBeGreaterThanOrEqual(DRONE_CAMERA_RADIUS);expect(d.position[0]).toBeLessThanOrEqual(f.world.width-DRONE_CAMERA_RADIUS);expect(d.position[2]).toBeGreaterThanOrEqual(DRONE_CAMERA_RADIUS);expect(d.position[2]).toBeLessThanOrEqual(f.world.length-DRONE_CAMERA_RADIUS);expect(d.position[1]).toBeGreaterThanOrEqual(d.minimumY);}}finally{d.dispose();}
 }
});
test('clear-space flight preserves the accepted 68-unit speed and bounded acceleration/jerk',()=>{
 const f=basic(),d=f.drone;d.position.set([15,224,192]);d.phase='wave';expect(d.routeTo(465,224,192)).toBe(true);let fastest=0;const acceleration=[0,0,0];
 try{for(let n=0;n<6*120;n++){const x=d.position[0];d.move(1/120);fastest=Math.max(fastest,(d.position[0]-x)*120);expect(Math.hypot(...d.acceleration)).toBeLessThanOrEqual(96+1e-6);expect(Math.hypot(...d.acceleration.map((v,i)=>v-acceleration[i]))*120).toBeLessThanOrEqual(384+1e-4);acceleration.splice(0,3,...d.acceleration);}expect(fastest).toBeGreaterThan(65);expect(fastest).toBeLessThanOrEqual(68+1e-6);}finally{d.dispose();}
});
test('all seven native study situations produce safe, finite filming stations with the relevant battle in view',()=>assets(async()=>{
 for(const recipe of STUDY_SCENARIOS){let d;const scene=await createStudyScene(recipe,{onActivity:(kind,x,y,z,at,w)=>{if(kind!=='shot')d?.noteActivity(x,y,z,at,w);}}),c=camera();d=new DroneCamera(c,{random:()=>.35});d.bind(scene.world);
 try{await advanceStudyScene(scene,recipe.seconds,{yieldControl:async()=>{}});const before=describeStudyScene(scene);d.setEnabled(true);d.sync('wave',scene.engine);expect(d.active).toBe(true);expect(d.staticClear(...d.position,...d.position)).toBe(true);expect(d.obstacles.pointClear(...d.position,DRONE_CAMERA_RADIUS)).toBe(true);expect(d.sceneInView()).toBe(true);expect(d.pitch).toBeLessThanOrEqual(DRONE_CAMERA_MAX_FILM_PITCH);expect(d.fov).toBeGreaterThanOrEqual(DRONE_CAMERA_MIN_FOV);expect(describeStudyScene(scene)).toEqual(before);console.log(JSON.stringify({scenario:recipe.id,style:d.director.intent.style,position:[...d.position],focus:[...d.focus],score:d.currentFrame().score,coverage:d.currentFrame().board}));}finally{d.dispose();scene.dispose();}
 }
}),30000);
test('native battles at 30/60/120 Hz preserve combat outcomes and swept static/actor clearance',()=>assets(async()=>{
 for(const id of ['skirmish','split','late']){
  const baseline=await createStudyScene(STUDY_SCENARIOS.find(s=>s.id===id));let expected;try{await advanceStudyScene(baseline,100,{yieldControl:async()=>{}});expected=[baseline.engine.enemies.killed,baseline.engine.enemies.escaped,baseline.engine.firing.shots,baseline.engine.steps];}finally{baseline.dispose();}
  const results=[];
  for(const hz of [30,60,120]){
   const recipe=STUDY_SCENARIOS.find(s=>s.id===id);let d;const scene=await createStudyScene(recipe,{onActivity:(kind,x,y,z,at,w)=>{if(kind!=='shot')d?.noteActivity(x,y,z,at,w);}}),c=camera();d=new DroneCamera(c,{random:()=>.35});d.bind(scene.world);d.setEnabled(true);d.sync('wave',scene.engine);let shown=0,frames=0,low=0,high=0,interior=0,maxAltitude=0;
   try{while(scene.engine.running&&scene.engine.time<100){const old=[...d.position];scene.engine.advance(1/hz);d.advance(1/hz,{engine:scene.engine,phase:'wave'});frames++;if(d.sceneInView())shown++;if(d.position[1]<scene.world.level.pathHeight+70)low++;if(d.position[1]>scene.world.level.pathHeight+150)high++;if(d.position[0]>scene.world.width*.25&&d.position[0]<scene.world.width*.75&&d.position[2]>scene.world.length*.25&&d.position[2]<scene.world.length*.75)interior++;maxAltitude=Math.max(maxAltitude,d.position[1]-scene.world.level.pathHeight);expect(d.position[1]).toBeGreaterThanOrEqual(d.minimumY);expect(d.staticClear(...old,...d.position)).toBe(true);expect(d.obstacles.pointClear(...d.position,DRONE_CAMERA_RADIUS,0)).toBe(true);expect([...d.position,...d.focus,d.yaw,d.pitch,d.fov].every(Number.isFinite)).toBe(true);}
   results.push([scene.engine.enemies.killed,scene.engine.enemies.escaped,scene.engine.firing.shots,scene.engine.steps]);expect(shown/frames).toBeGreaterThan(.55);console.log({scenario:id,hz,shown:shown/frames,low:low/frames,high:high/frames,interior:interior/frames,maxAltitude,travel:d.travelled,blocked:d.blockedMoves});
   }finally{d.dispose();scene.dispose();}
  }
  expect(results[0]).toEqual(expected);expect(results[0]).toEqual(results[1]);expect(results[1]).toEqual(results[2]);
 }
}),90000);
