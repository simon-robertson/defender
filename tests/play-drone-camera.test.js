import {test,expect} from 'bun:test';
import {Camera} from '../engine/camera.js';
import {DroneCamera,DRONE_CAMERA_SPEED,DRONE_CAMERA_RADIUS,DRONE_CAMERA_MIN_FOV,DRONE_CAMERA_MAX_FILM_PITCH,DRONE_CAMERA_BOARD_MARGIN,DRONE_CAMERA_MOTION_RATE} from '../play/drone-camera.js';
import {SceneryVisibility} from '../engine/visibility.js';
import {PLAY_CONFIG} from '../play/config.js';
import {legacyPlayConfig} from './helpers/legacy-play-config.js';
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../play/engine.js';

const camera=()=>new Camera({clientWidth:1500,clientHeight:1000,addEventListener(){},focus(){}},()=>{});
function scene(extra={}){
 const level={id:'camera-fixture',size:[20,16],path:[[0,0,8],[1,0,8]],pathHeight:24,terrain:{defaultHeight:24,boxes:[]},placements:[],...extra};
 return {level,width:480,length:384,rigs:new Map(),actors:new Map(),visibility:new SceneryVisibility(level,new Map())};
}
function basic(){
 const world=scene(),c=camera();c.setLevel(world.level);const drone=new DroneCamera(c,{random:()=>.35});drone.bind(world);
 const subject={id:'actor',phase:'active',health:{alive:true},x:240,y:24,z:192,aimX:240,aimY:32,aimZ:192,distance:10,path:{length:100}};
 const engine={time:0,enemies:{states:[],activeTargets:[subject]},firing:{states:[]},wildlife:{states:[]}};
 return {world,c,drone,engine,subject};
}
function advance(f,seconds,hz=60,phase='wave'){for(let i=0;i<seconds*hz;i++){f.engine.time+=1/hz;f.drone.advance(1/hz,{engine:f.engine,phase});}}
const viewPitch=(position,focus)=>Math.atan2(position[1]-focus[1],Math.hypot(position[0]-focus[0],position[2]-focus[2]));

test('faster flight and gimbal motion reach the doubled rates without advancing actors',()=>{
 const f=basic(),d=f.drone;
 try{
  d.setEnabled(true);d.sync('wave',f.engine);const actor=JSON.stringify(f.subject);
  d.position.set([-150,224,192]);d.velocity.fill(0);d.acceleration.fill(0);expect(d.routeTo(600,224,192)).toBe(true);
  let fastest=0;
  for(let n=0;n<4*120;n++){const x=d.position[0];d.move(1/120);fastest=Math.max(fastest,(d.position[0]-x)*120);expect(d.staticClear(...d.position,...d.position)).toBe(true);}
  expect(fastest).toBeGreaterThan(65);expect(fastest).toBeLessThanOrEqual(68+1e-6);expect(d.anticipation.speed).toBe(68);
  d.position.set([240,144,192]);d.focus.set([240,32,392]);d.look.set(d.focus);d.yaw=0;d.pitch=-1;d.yawVelocity=d.pitchVelocity=0;
  let yaw=0,pitch=0;
  for(let n=0;n<4*120;n++){const oldYaw=d.yaw,oldPitch=d.pitch;d.aim(1/120,f.engine);yaw=Math.max(yaw,Math.abs(d.yaw-oldYaw)*120);pitch=Math.max(pitch,Math.abs(d.pitch-oldPitch)*120);}
  expect(yaw).toBeGreaterThan(2);expect(yaw).toBeLessThanOrEqual(2.2+1e-6);expect(pitch).toBeGreaterThan(1.25);expect(pitch).toBeLessThanOrEqual(1.4+1e-6);
  expect(f.engine.time).toBe(0);expect(JSON.stringify(f.subject)).toBe(actor);
 }finally{d.dispose();}
});

test('board coverage favours an inward view from outside an edge over looking out at that edge',()=>{
 const f=basic(),d=f.drone;
 try{
  d.focus.set([48,32,192]);
  for(const aspect of [.5,1.5,3]){
   f.c.canvas.clientWidth=1000*aspect;f.c.canvas.clientHeight=1000;
   const inward=d.boardCoverage(-144,144,192),outward=d.boardCoverage(240,144,192);
   expect(inward).toBeGreaterThan(outward+.12);expect(inward).toBeLessThanOrEqual(1);expect(outward).toBeGreaterThanOrEqual(0);
  }
  expect(d.boardCoverage(48,200,192)).toBe(0);
 }finally{d.dispose();}
});

test('board coverage agrees with independent viewport and board samples through the production camera',()=>{
 const f=basic(),d=f.drone,c=f.c;
 try{
  d.focus.set([48,32,192]);
  for(const aspect of [.5,1.5,3])for(const position of [[-144,144,192],[240,144,192],[48,200,-144]]){
   c.canvas.clientWidth=1000*aspect;c.canvas.clientHeight=1000;c.mode='live';c.position.set(position);c.fov=d.fov;c.roll=0;
   c.yaw=Math.atan2(position[0]-d.focus[0],position[2]-d.focus[2]);c.pitch=viewPitch(position,d.focus);c.update(aspect);
   const transform=(m,x,y,z,w)=>[0,1,2,3].map(r=>m[r]*x+m[4+r]*y+m[8+r]*z+m[12+r]*w);
   let board=0,screen=0;const cols=64,rows=48;
   for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const projected=transform(c.vp,(col+.5)/cols*f.world.width,24,(row+.5)/rows*f.world.length,1);
    if(projected[3]>0&&Math.abs(projected[0])<=projected[3]&&Math.abs(projected[1])<=projected[3]&&projected[2]>=0&&projected[2]<=projected[3])board++;
    const sx=(col+.5)/cols*2-1,sy=(row+.5)/rows*2-1,near=transform(c.inverse,sx,sy,0,1),far=transform(c.inverse,sx,sy,1,1);
    for(let axis=0;axis<3;axis++){near[axis]/=near[3];far[axis]/=far[3];}
    const t=(24-near[1])/(far[1]-near[1]),x=near[0]+(far[0]-near[0])*t,z=near[2]+(far[2]-near[2])*t;
    if(t>=0&&t<=1&&x>=0&&x<=f.world.width&&z>=0&&z<=f.world.length)screen++;
   }
   expect(Math.abs(d.boardCoverage(...position)-(board*.65+screen*.35)/(cols*rows))).toBeLessThan(.025);
  }
 }finally{d.dispose();}
});

test('an edge-only shot deliberately reframes toward more board and holds the chosen route',()=>{
 const f=basic(),d=f.drone;
 try{
  f.subject.x=f.subject.aimX=48;d.setEnabled(true);d.sync('wave',f.engine);d.focus.set([48,32,192]);d.position.set([240,144,192]);d.routeLength=d.routeIndex=0;d.heldFor=3.5;d.time=10;
  const focus=Array.from(d.focus),before=d.boardCoverage(...d.position);expect(d.shotQuality(...d.position)).toBe(1);expect(d.vantage()).toBe(true);
  const goal=Array.from(d.goal);expect(d.boardCoverage(...goal)).toBeGreaterThanOrEqual(before+.12);expect(d.contextReframes).toBe(1);
  expect(goal[0]<0||goal[0]>f.world.width||goal[2]<0||goal[2]>f.world.length).toBe(true);
  expect(d.shotQuality(...goal)).toBeGreaterThanOrEqual(.86);expect(d.viewFits(...goal)).toBe(true);expect(d.columnClear(...goal)).toBe(true);expect(Array.from(d.focus)).toEqual(focus);
  for(let n=0;n<3;n++){d.time+=.8;d.vantage();expect(Array.from(d.goal)).toEqual(goal);}
  for(let n=0;n<4000&&d.routeIndex<d.routeLength;n++){
   const before=Array.from(d.position);d.move(1/120);
   expect(d.staticClear(...before,...d.position)).toBe(true);expect(viewPitch(d.position,d.focus)).toBeLessThanOrEqual(DRONE_CAMERA_MAX_FILM_PITCH);
  }
  expect(d.routeIndex).toBe(d.routeLength);
 }finally{d.dispose();}
});

test('similar board coverage cannot trigger repeated context repositioning',()=>{
 const f=basic(),d=f.drone;
 try{
  d.setEnabled(true);d.sync('wave',f.engine);d.position.set([24,144,192]);d.focus.set([240,32,192]);d.routeLength=d.routeIndex=0;d.heldFor=3.5;d.boardCoverage=()=>.5;
  expect(d.vantage()).toBe(true);expect(d.holding).toBe(true);expect(d.contextReframes).toBe(0);expect(d.routeLength).toBe(0);
 }finally{d.dispose();}
});

test('opening looks toward the actual area of interest from outside its steep-view footprint',()=>{
 const f=basic(),d=f.drone;
 try{
  f.engine.firing.states.push({id:'centre-gun',x:240,z:192,rig:{root:new Float64Array([1,0,0,0,0,1,0,0,0,0,1,0,240,24,192,1])}});
  d.setEnabled(true);expect(d.sync('wave',f.engine)).toBe(true);
  expect(d.focusKind).toBe('defence');expect(d.focus[0]).toBe(240);expect(d.focus[2]).toBe(192);
  expect(viewPitch(d.position,d.focus)).toBeLessThanOrEqual(DRONE_CAMERA_MAX_FILM_PITCH);
  expect(d.pitch).toBeCloseTo(viewPitch(d.position,d.focus),10);
  expect(d.staticClear(...d.position,...d.position)).toBe(true);
 }finally{d.dispose();}
});

test('high destinations pull back with altitude and abandon a steep but unobstructed leased goal',()=>{
 const f=basic(),d=f.drone;
 try{
  d.setEnabled(true);d.sync('wave',f.engine);d.focus.set([240,32,192]);d.airborneFloor=230;d.cruiseY=320;
  d.position.set([240,280,200]);d.goal.set(d.position);d.route.set(d.goal);d.routeLength=1;d.routeIndex=0;d.goalSince=d.time;d.goalDuration=100;
  const old=Array.from(d.goal);expect(d.shotQuality(...old)).toBe(1);expect(d.vantage()).toBe(true);
  expect(Array.from(d.goal)).not.toEqual(old);expect(viewPitch(d.goal,d.focus)).toBeLessThanOrEqual(DRONE_CAMERA_MAX_FILM_PITCH);
  expect(Math.hypot(d.goal[0]-240,d.goal[2]-192)).toBeGreaterThan(192);expect(d.columnClear(...d.goal)).toBe(true);
  expect(d.viewDistance(300)).toBeGreaterThan(d.viewDistance(180));
  d.position.set([24,240,192]);expect(d.viewTravelCost(456,240,192)).toBeGreaterThan(d.viewTravelCost(24,240,360));
 }finally{d.dispose();}
});

test('an opening over a quiet field checks the remembered battle area before choosing a station',()=>{
 const f=basic(),d=f.drone;
 try{
  f.engine.enemies.activeTargets=[];d.noteExplosion({x:240,y:32,z:192},0);f.engine.time=6;
  d.setEnabled(true);expect(d.sync('wave',f.engine)).toBe(true);expect(Array.from(d.focus)).toEqual([240,32,192]);
  expect(viewPitch(d.position,d.focus)).toBeLessThanOrEqual(DRONE_CAMERA_MAX_FILM_PITCH);
 }finally{d.dispose();}
});

test('a steep view alone cannot trigger a climb that would make its angle worse',()=>{
 const f=basic(),d=f.drone;
 try{
  d.setEnabled(true);d.sync('wave',f.engine);d.focus.set([240,32,192]);d.position.set([240,300,194]);d.airborneFloor=700;d.cruiseY=800;d.routeLength=d.routeIndex=0;
  expect(d.shotQuality(...d.position)).toBe(1);expect(d.separation(...d.position)).toBe(true);
  expect(d.vantage()).toBe(false);expect(d.routeLength).toBe(0);
 }finally{d.dispose();}
});
async function actualFixture(levelIndex=0,{config=legacyPlayConfig(),waveIndex=2,empty=false,placements:customPlacements=null}={}){
 const native=globalThis.fetch;
 globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};
 try{
  const wave=config.levels[levelIndex].waves[waveIndex],boxes=levelIndex?[[5,0,5],[8,0,8]]:[[4,0,9],[12,0,6]],placements=customPlacements??(empty?[]:boxes).map((box,i)=>({id:'player-gun-'+i,model:'turret-study',variant:'upgrade2',box,turn:0})),world=await loadPlayWorld(config.levels[levelIndex].id,{config,wave,placements}),c=camera();c.setLevel(world.level);
  const drone=new DroneCamera(c,{random:()=>.35});drone.bind(world);const engine=new PlayEngine(world,{config,wave,onDeath:(_id,state)=>drone.noteExplosion(state,engine.time)});
  return {world,c,drone,engine,dispose(){drone.dispose();engine.dispose();disposePlayWorld(world);}};
 }finally{globalThis.fetch=native;}
}

test('drone lifecycle arms in preparation, shares the simulation clock, freezes on pause and restores overview',()=>{
 const f=basic(),{drone:d,c,engine:e}=f,original=[...c.target,c.yaw,c.pitch,c.radius];
 d.setEnabled(true);d.sync('loadout',e);expect(d.active).toBe(false);d.sync('wave',e);expect(d.active).toBe(true);expect(c.mode).toBe('live');expect(c.controlsEnabled).toBe(false);
 advance(f,1);const before=d.stats(),pose=[...c.position,c.yaw,c.pitch,c.roll];d.advance(100,{engine:e,phase:'wave'});expect(d.stats()).toEqual(before);expect([...c.position,c.yaw,c.pitch,c.roll]).toEqual(pose);
 d.advance(5,{engine:e,phase:'wave',paused:true});expect(d.stats()).toEqual(before);
 advance(f,.5,60,'settling');expect(d.active).toBe(true);const position=[...d.position];advance(f,1,60,'settling');expect(Math.hypot(...d.position.map((v,i)=>v-position[i]))).toBeGreaterThan(.05);
 d.setEnabled(false);expect([...c.target,c.yaw,c.pitch,c.radius]).toEqual(original);expect(c.controlsEnabled).toBe(true);expect(c.mode).toBe('overview');expect(c.roll).toBe(0);
 d.setEnabled(true);d.sync('wave',e);const obstacles=d.obstacles;d.bind(null);expect(d.active).toBe(false);expect(d.world).toBeNull();expect(d.water).toBeNull();expect(obstacles.disposed).toBe(true);expect(obstacles.records).toHaveLength(0);expect(c.mode).toBe('overview');
});

test('swept flight rejects a wall between clear endpoints and uses a continuous high route',()=>{
 const f=basic(),d=f.drone;
 // A single solid obstacle reaching over low-flight height, with no phantom canopy gaps.
 f.world.visibility={nodeCount:1,bounds:new Float32Array([195,24,120,205,90,270]),escape:new Uint32Array([1]),clear:()=>true};d.cruiseY=144;d.position.set([150,44,192]);
 expect(d.staticClear(150,44,192,150,44,192)).toBe(true);expect(d.staticClear(250,44,192,250,44,192)).toBe(true);expect(d.staticClear(150,44,192,250,44,192)).toBe(false);
 expect(d.routeTo(250,44,192)).toBe(true);expect(d.routeLength).toBe(3);d.phase='wave';let maxY=44,steps=0;
 while(d.routeIndex<d.routeLength&&steps++<3000){const previous=[...d.position];d.move(1/120);expect(d.staticClear(...previous,...d.position)).toBe(true);expect(Math.hypot(...d.position.map((v,i)=>v-previous[i]))).toBeLessThanOrEqual(DRONE_CAMERA_SPEED/120+1e-8);maxY=Math.max(maxY,d.position[1]);}
 expect(steps).toBeLessThan(3000);expect(maxY).toBeGreaterThan(130);expect(maxY).toBeLessThan(155);expect(Math.hypot(d.position[0]-250,d.position[1]-44,d.position[2]-192)).toBeLessThan(6);
 // A clear endpoint under a canopy cannot be selected as a safe filming column.
 f.world.visibility.bounds.set([240,60,180,260,90,205]);expect(d.staticClear(250,44,192,250,44,192)).toBe(true);expect(d.columnClear(250,44,192)).toBe(false);d.position.set([150,44,192]);expect(d.routeTo(250,44,192)).toBe(false);
});

test('water, raised terrain and the extended flight perimeter remain outside the camera hull',()=>{
 const world=scene({terrain:{defaultHeight:24,boxes:[{box:[5,5],ground:4,water:24},{box:[6,5],ground:68,water:0}]}}),d=new DroneCamera(camera());d.bind(world);
 expect(d.staticClear(132,25,132,132,25,132)).toBe(false);expect(d.staticClear(132,28,132,132,28,132)).toBe(true);
 expect(d.staticClear(132,50,132,180,50,132)).toBe(false);expect(d.staticClear(132,75,132,180,75,132)).toBe(true);
 expect(d.staticClear(-100,100,100,20,100,100)).toBe(true);
 expect(d.staticClear(DRONE_CAMERA_RADIUS-DRONE_CAMERA_BOARD_MARGIN-1,100,100,20,100,100)).toBe(false);d.dispose();
});

test('stable subjects retain mostly high flight with occasional safe low shots and broad gimbal aiming',()=>{
 const f=basic(),{drone:d,engine:e,subject:s}=f;d.setEnabled(true);d.sync('wave',e);
 // Start with a certified open low station. The target is an airborne actor.
 d.position.set([240,144,368]);d.focus.set([240,240,192]);d.look.set(d.focus);s.aimY=240;d.routeLength=d.routeIndex=0;d.shotBand=0;d.planIn=0;
 let minY=Infinity,maxY=-Infinity,minPitch=Infinity,maxPitch=-Infinity,moving=0,held=0,high=0,maxDisplacement=0;
 for(let frame=0;frame<54*60;frame++){if(frame===14*60)s.aimY=72;e.time+=1/60;d.advance(1/60,{engine:e,phase:'wave'});minY=Math.min(minY,d.position[1]);maxY=Math.max(maxY,d.position[1]);minPitch=Math.min(minPitch,d.pitch);maxPitch=Math.max(maxPitch,d.pitch);if(d.position[1]>=144)high++;if(d.speed>2)moving++;if(d.holding)held++;maxDisplacement=Math.max(maxDisplacement,Math.hypot(d.position[0]-240,d.position[2]-368));expect(Math.hypot(d.position[0]-s.x,d.position[2]-s.z)).toBeGreaterThan(148);expect(d.staticClear(...d.position,...d.position)).toBe(true);}
 expect(minY).toBeGreaterThanOrEqual(f.world.level.pathHeight+32);expect(minY).toBeLessThan(100);expect(high/(54*60)).toBeGreaterThan(.65);expect(d.lowShots).toBe(1);expect(maxY).toBeGreaterThan(168);expect(minPitch).toBeLessThan(-.25);expect(maxPitch).toBeGreaterThan(.5);expect(d.relocations).toBeGreaterThanOrEqual(3);expect(maxDisplacement).toBeGreaterThan(100);expect(held).toBeGreaterThan(0);expect(moving).toBeGreaterThan(0);expect(d.focus[1]).toBe(72);
});

test('pan, lens, flight and long-frame travel have explicit rate limits; pure camera work leaves actors untouched',()=>{
 const f=basic(),{drone:d,engine:e,subject:s}=f;d.setEnabled(true);d.sync('wave',e);const snapshot=JSON.stringify(s);let previous=d.stats();
 for(let i=0;i<180;i++){e.time+=1/60;d.advance(1/60,{engine:e,phase:'wave'});const now=d.stats();expect(Math.hypot(...d.position.map((v,j)=>v-previous.position[j]))).toBeLessThanOrEqual(DRONE_CAMERA_SPEED/60+1e-7);expect(Math.abs(now.pitch-previous.pitch)).toBeLessThanOrEqual(.8*DRONE_CAMERA_MOTION_RATE/60+1e-8);expect(Math.abs(now.fov-previous.fov)).toBeLessThanOrEqual(9/60+1e-8);previous=now;}
 expect(JSON.stringify(s)).toBe(snapshot);const time=d.time,p=[...d.position];e.time+=30;d.advance(30,{engine:e,phase:'wave'});expect(d.time-time).toBeCloseTo(.25,6);expect(Math.hypot(...d.position.map((v,j)=>v-p[j]))).toBeLessThanOrEqual(DRONE_CAMERA_SPEED*.25+1e-6);
 expect(()=>d.advance(-1,{engine:e,phase:'wave'})).toThrow();
});

test('actual A1/A2 camera flights have swept static and actor clearance and preserve finite combat at 30/60/120 Hz',async()=>{
 for(const levelIndex of [0,1]){
  const outcomes=[];
  for(const hz of [30,60,120]){
   const f=await actualFixture(levelIndex),{drone:d,engine:e,c}=f;
   try{
    e.startWave();d.setEnabled(true);d.sync('wave',e);let frames=0,readable=0,high=0,minY=Infinity,maxY=-Infinity;
    while(e.running&&frames<110*hz){const previous=[...d.position];e.advance(1/hz);d.advance(1/hz,{engine:e,phase:'wave'});c.update(1.5);frames++;if(d.position[1]>=d.altitude(0))high++;if(d.quality>=.84)readable++;minY=Math.min(minY,d.position[1]);maxY=Math.max(maxY,d.position[1]);expect(d.staticClear(...previous,...d.position)).toBe(true);expect(d.obstacles.pointClear(...d.position,DRONE_CAMERA_RADIUS)).toBe(true);expect(Math.abs(c.pitch)).toBeLessThanOrEqual(1.35);expect(c.fov).toBeGreaterThanOrEqual(DRONE_CAMERA_MIN_FOV);expect(c.fov).toBeLessThanOrEqual(76);expect(Array.from(c.vp).every(Number.isFinite)).toBe(true);}
    expect(minY).toBeGreaterThanOrEqual(f.world.level.pathHeight+32);expect(high/frames).toBeGreaterThan(.65);expect(e.completed).toBe(true);expect(e.enemies.escaped).toBe(0);expect(d.travelled).toBeGreaterThan(30);expect(readable/frames).toBeGreaterThan(.5);expect(d.stats().planningBytes).toBeLessThan(50000);
    outcomes.push([e.enemies.killed,e.enemies.escaped,e.firing.shots,e.waveTime]);console.log(JSON.stringify({levelIndex,hz,travelled:d.travelled,readable:readable/frames,highFraction:high/frames,minY,maxY,bytes:d.stats().planningBytes}));
   }finally{f.dispose();}
  }
  expect(outcomes[1]).toEqual(outcomes[0]);expect(outcomes[2]).toEqual(outcomes[0]);
 }
},30000);


test('current A2/A3/A4 Moth and merged-front flights retain the higher profile, track real altitude and leave combat unchanged',async()=>{
 for(const levelIndex of [1,2,3]){
  const results=[];
  for(const enabled of [false,true]){
   const f=await actualFixture(levelIndex,{config:PLAY_CONFIG,waveIndex:levelIndex===1?0:3,empty:true}),{drone:d,engine:e}=f;
   try{
    e.startWave();d.setEnabled(enabled);d.sync('wave',e);if(enabled)expect(d.routeTo(d.position[0],d.world.level.pathHeight+31,d.position[2])).toBe(false);let frames=0,mothFrames=0,minY=Infinity,maxY=-Infinity,minPitch=Infinity,minEnemy3D=Infinity,minFlyer3D=Infinity,minVerticalGap=Infinity,highFrames=0,stalledFrames=0,minStep=Infinity,heldDriftFrames=0;
    while(e.running&&frames<150*60){const previous=[...d.position];e.advance(1/60);d.advance(1/60,{engine:e,phase:'wave'});frames++;
     if(enabled){if(d.position[1]>=d.airborneFloor)highFrames++;if(d.holding&&d.drifting)heldDriftFrames++;const step=Math.hypot(...d.position.map((v,i)=>v-previous[i]));minStep=Math.min(minStep,step);if(step<1e-9)stalledFrames++;for(const target of e.enemies.activeTargets){const gap=Math.hypot(d.position[0]-target.x,d.position[1]-target.aimY,d.position[2]-target.z);minEnemy3D=Math.min(minEnemy3D,gap);if(target.airborne){minFlyer3D=Math.min(minFlyer3D,gap);minVerticalGap=Math.min(minVerticalGap,d.position[1]-target.aimY);if(d.position[1]>=d.airborneFloor)expect(d.position[1]-target.aimY).toBeGreaterThanOrEqual(100-1e-6);}}expect(d.position[1]).toBeGreaterThanOrEqual(f.world.level.pathHeight+32);expect(d.cruiseY).toBeGreaterThanOrEqual(d.airborneFloor);expect(d.staticClear(...previous,...d.position)).toBe(true);expect(d.obstacles.pointClear(...d.position,DRONE_CAMERA_RADIUS)).toBe(true);minY=Math.min(minY,d.position[1]);maxY=Math.max(maxY,d.position[1]);minPitch=Math.min(minPitch,d.pitch);if(d.subject?.model==='moth'){mothFrames++;expect(d.focus[1]).toBe(d.subject.aimY);}}
    }
    expect(e.completed).toBe(true);results.push([e.enemies.killed,e.enemies.escaped,e.firing.shots,e.waveTime]);
    if(enabled){let settleTravel=0;for(let i=0;i<240;i++){const p=[...d.position];e.advance(1/60,{combat:false});d.advance(1/60,{engine:e,phase:'settling'});const step=Math.hypot(...d.position.map((v,k)=>v-p[k]));expect(step).toBeGreaterThan(1e-9);expect(d.staticClear(...p,...d.position)).toBe(true);settleTravel+=step;}expect(settleTravel).toBeGreaterThan(1);}
    if(enabled){expect(mothFrames).toBeGreaterThan(20);expect(minY).toBeGreaterThanOrEqual(f.world.level.pathHeight+32);expect(highFrames/frames).toBeGreaterThan(.65);expect(minY).toBeLessThan(d.airborneFloor+6);expect(maxY).toBeGreaterThan(d.airborneFloor+40);expect(stalledFrames).toBe(0);expect(heldDriftFrames).toBeGreaterThan(30);expect(minStep).toBeGreaterThan(1e-9);expect(minPitch).toBeGreaterThanOrEqual(-1.35);console.log(JSON.stringify({currentLevel:levelIndex+1,mothFrames,highFraction:highFrames/frames,minY,maxY,minPitch,minEnemy3D,minFlyer3D,minVerticalGap,stalledFrames,minStep,heldDriftFrames,meanSpeed:d.travelled/d.time,blockedMoves:d.blockedMoves,airborneFloor:d.airborneFloor,travelled:d.travelled,bytes:d.stats().planningBytes}));}
   }finally{f.dispose();}
  }
  expect(results[1]).toEqual(results[0]);
 }
},30000);

test('a same-level next wave rebuilds actor references even if the armed camera was only left in preparation',async()=>{
 const f=await actualFixture(),{drone:d,engine:e}=f;
 try{
  e.startWave();d.setEnabled(true);d.sync('wave',e);const first=d.obstacles,oldEnemies=e.enemies;let frames=0;
  while(e.running&&frames++<100*30)e.advance(1/30);
  expect(e.completed).toBe(true);d.sync('loadout',e);e.prepareWave(e.config.levels[0].waves[3]);e.startWave();d.sync('wave',e);
  expect(e.enemies).not.toBe(oldEnemies);expect(first.disposed).toBe(true);expect(d.obstacles).not.toBe(first);
  const states=new Set(e.enemies.states);for(const record of d.obstacles.records)if(record.kind==='enemy')expect(states.has(record.state)).toBe(true);
  d.refresh();expect(d.obstacles).toBeNull();expect(d.active).toBe(false);
 }finally{f.dispose();}
});

test('an approaching actor forecast triggers a continuous climb through currently clear space',()=>{
 const f=basic(),{drone:d,engine:e}=f;d.setEnabled(true);d.sync('wave',e);d.position.set([240,144,270]);d.speed=0;d.velocity.fill(0);d.acceleration.fill(0);d.holding=true;d.routeLength=d.routeIndex=0;
 const actual=d.obstacles;d.obstacles={update(){},pointClear(_x,_y,_z,_r,horizon=0){return horizon===0;},clearSegment(_ax,_ay,_az,_bx,_by,_bz,_r,horizon=0){return horizon===0;}};
 const start=[...d.position];e.time+=1/60;d.advance(1/60,{engine:e,phase:'wave'});expect(d.emergency).toBe(true);expect(d.position[1]).toBeGreaterThan(start[1]);expect(d.position[1]-start[1]).toBeLessThan(.02);expect(d.position[0]).toBe(start[0]);expect(d.position[2]).toBe(start[2]);
 d.obstacles=actual;d.dispose();
});

test('interrupting a low approach with either high retreat never records a low success or consumes its pending window',()=>{
 for(const cause of ['actor-forecast','blocked-view']){
  const f=basic(),{drone:d,engine:e}=f;d.setEnabled(true);d.sync('wave',e);const actual=d.obstacles;
  try{
   d.position.set([240,64,368]);d.goal.set(d.position);d.route.set(d.position);d.routeLength=1;d.routeIndex=0;d.velocity.fill(0);d.acceleration.fill(0);d.time=24;d.lowShot=true;d.lowArrived=false;d.lowPendingUntil=48;
   if(cause==='actor-forecast'){
    d.obstacles={update(){},pointClear(_x,_y,_z,_r,horizon=0){return horizon===0;},clearSegment(_ax,_ay,_az,_bx,_by,_bz,_r,horizon=0){return horizon===0;}};e.time+=1/60;d.advance(1/60,{engine:e,phase:'wave'});expect(d.emergency).toBe(true);
   }else{d.shotQuality=()=>0;d.goalSince=-Infinity;expect(d.vantage()).toBe(false);}
   expect(d.goal[1]).toBe(d.cruiseY);expect(d.lowShot).toBe(false);expect(d.lowArrived).toBe(false);expect(d.lowPendingUntil).toBe(48);
   d.position.set(d.goal);d.obstacles=actual;d.move(1/120);expect(d.lowShots).toBe(0);expect(d.lowArrived).toBe(false);expect(d.lowPendingUntil).toBe(48);
   // Defence in depth also rejects the previously reachable stale-flag state.
   d.lowShot=true;d.routeLength=1;d.routeIndex=0;d.route.set(d.goal);d.move(1/120);expect(d.lowShots).toBe(0);expect(d.lowPendingUntil).toBe(48);
  }finally{d.obstacles=actual;d.dispose();}
 }
});

test('low holding drift keeps its escape column outside an overhanging canopy while open drift continues',()=>{
 const f=basic(),{drone:d}=f;d.setEnabled(true);d.sync('wave',f.engine);const open=f.world.visibility;
 try{
  f.world.visibility={nodeCount:1,bounds:new Float32Array([102.6,80,90,120,110,112]),escape:new Uint32Array([1]),clear:()=>true};d.position.set([100,64,100]);d.phase='settling';d.velocity.set([.65,0,0]);d.acceleration.fill(0);d.routeLength=d.routeIndex=0;d.drifting=false;
  expect(d.staticClear(105,64,100,105,64,100)).toBe(true);expect(d.staticClear(105,64,100,105,d.cruiseY,100)).toBe(false);let maximumX=100;
  for(let i=0;i<3*120;i++){d.move(1/120);maximumX=Math.max(maximumX,d.position[0]);expect(d.staticClear(...d.position,d.position[0],d.cruiseY,d.position[2])).toBe(true);}
  expect(maximumX).toBeLessThan(100.101);expect(d.blockedMoves).toBeGreaterThan(0);
  f.world.visibility=open;const previous=Array.from(d.position),blocked=d.blockedMoves;for(let i=0;i<2*120;i++)d.move(1/120);expect(Math.hypot(...d.position.map((value,i)=>value-previous[i]))).toBeGreaterThan(.5);expect(d.blockedMoves).toBe(blocked);
 }finally{d.dispose();}
});

test('open three-leg travel eases continuously into drift with bounded actual acceleration, gimbal acceleration and optical zoom',()=>{
 const f=basic(),d=f.drone;d.setEnabled(true);d.sync('wave',f.engine);d.position.set([120,192,250]);d.velocity.fill(0);d.acceleration.fill(0);d.phase='wave';d.cruiseY=240;d.route.set([120,240,250,250,240,250,250,144,250]);d.routeLength=3;d.routeIndex=0;
 const dt=1/120,previous=[...d.position],oldVelocity=[0,0,0],oldAcceleration=[0,0,0];let maxAcceleration=0,maxJerk=0,minStep=Infinity,driftFrames=0,lastYaw=d.yaw,lastPitch=d.pitch,lastFov=d.fov,lastYawRate=0,lastPitchRate=0,lastFovRate=0;
 for(let frame=0;frame<40*120;frame++){
  if(frame===5*120)d.focus.set([400,72,80]);if(frame===10*120)d.focus.set([100,160,300]);d.move(dt);d.aim(dt,f.engine);const velocity=d.position.map((value,i)=>(value-previous[i])/dt),acceleration=velocity.map((value,i)=>(value-oldVelocity[i])/dt),jerk=acceleration.map((value,i)=>(value-oldAcceleration[i])/dt),step=Math.hypot(...d.position.map((value,i)=>value-previous[i]));
  minStep=Math.min(minStep,step);maxAcceleration=Math.max(maxAcceleration,Math.hypot(...acceleration));maxJerk=Math.max(maxJerk,Math.hypot(...jerk));if(d.drifting)driftFrames++;
  const yawRate=(d.yaw-lastYaw)/dt,pitchRate=(d.pitch-lastPitch)/dt,fovRate=(d.fov-lastFov)/dt;expect(Math.abs(yawRate-lastYawRate)/dt).toBeLessThanOrEqual(1.8*DRONE_CAMERA_MOTION_RATE**2+1e-6);expect(Math.abs(pitchRate-lastPitchRate)/dt).toBeLessThanOrEqual(1.2*DRONE_CAMERA_MOTION_RATE**2+1e-6);expect(Math.abs(fovRate-lastFovRate)/dt).toBeLessThanOrEqual(12+1e-6);expect(d.fov).toBeGreaterThanOrEqual(DRONE_CAMERA_MIN_FOV);expect(d.fov).toBeLessThanOrEqual(76);expect(d.staticClear(...previous,...d.position)).toBe(true);
  for(let i=0;i<3;i++){previous[i]=d.position[i];oldVelocity[i]=velocity[i];oldAcceleration[i]=acceleration[i];}lastYaw=d.yaw;lastPitch=d.pitch;lastFov=d.fov;lastYawRate=yawRate;lastPitchRate=pitchRate;lastFovRate=fovRate;
 }
 expect(minStep).toBeGreaterThan(1e-9);expect(maxAcceleration).toBeLessThanOrEqual(24*DRONE_CAMERA_MOTION_RATE**2+.01);expect(maxJerk).toBeLessThanOrEqual(48*DRONE_CAMERA_MOTION_RATE**3+.01);expect(driftFrames).toBeGreaterThan(20*120);expect(d.blockedMoves).toBe(0);expect(Math.tan(42*Math.PI/360)/Math.tan(DRONE_CAMERA_MIN_FOV*Math.PI/360)).toBeCloseTo(.8,10);console.log(JSON.stringify({smoothMotion:{minStep,maxAcceleration,maxJerk,driftFrames,blocked:d.blockedMoves}}));
});

 test('opening stations vary across cosmetic seeds and repeated entries while staying clear',()=>{
 const starts=[];
 for(const seed of [0,.2,.4,.6,.8]){
  const f=basic();f.drone.dispose();f.drone=new DroneCamera(f.c,{random:()=>seed});f.drone.bind(f.world);f.drone.setEnabled(true);f.drone.sync('wave',f.engine);
  starts.push([...f.drone.position]);expect(f.drone.staticClear(...f.drone.position,...f.drone.position)).toBe(true);
  expect(f.drone.shotQuality(...f.drone.position)).toBeGreaterThan(.85);
  const before=[...f.drone.position];f.drone.leave();f.drone.sync('wave',f.engine);expect(Math.hypot(...f.drone.position.map((v,i)=>v-before[i]))).toBeGreaterThan(30);f.drone.dispose();
 }
 expect(new Set(starts.map(p=>p.join(','))).size).toBe(5);
});

test('every campaign opening stays in the central half across seeds and repeated wave entries',async()=>{
 for(let levelIndex=0;levelIndex<PLAY_CONFIG.levels.length;levelIndex++){
  const f=await actualFixture(levelIndex,{config:PLAY_CONFIG,waveIndex:0,empty:true}),d=f.drone;
  try{
   f.engine.startWave();d.setEnabled(true);
   for(const seed of [0,.2,.4,.6,.8]){
    d.random=()=>seed;d.bind(f.world);
    for(let entry=0;entry<2;entry++){
     expect(d.sync('wave',f.engine)).toBe(true);
     const [x,y,z]=d.position;
     expect(x).toBeGreaterThanOrEqual(f.world.width*.25);expect(x).toBeLessThanOrEqual(f.world.width*.75);
     expect(z).toBeGreaterThanOrEqual(f.world.length*.25);expect(z).toBeLessThanOrEqual(f.world.length*.75);
     expect(d.staticClear(x,y,z,x,y,z)).toBe(true);expect(d.obstacles.pointClear(x,y,z,DRONE_CAMERA_RADIUS)).toBe(true);
     expect(y).toBeGreaterThanOrEqual(d.airborneFloor??f.world.level.pathHeight+120);d.leave();
    }
   }
  }finally{f.dispose();}
 }
},30000);

test('a blocked centre uses a safe outer opening; a completely blocked scene never activates',()=>{
 const f=basic(),d=f.drone;
 // Model a central live-clearance exclusion independently of the automatic
 // static-canopy cruise height (which correctly rises above tall scenery).
 const clear=d.clear.bind(d);let blockedAll=false;
 d.clear=(ax,ay,az,bx,by,bz)=>!blockedAll&&(ax<120||ax>360||az<96||az>288)&&clear(ax,ay,az,bx,by,bz);
 d.setEnabled(true);expect(d.sync('wave',f.engine)).toBe(true);
 const [x,y,z]=d.position;expect(x<120||x>360||z<96||z>288).toBe(true);expect(d.staticClear(x,y,z,x,y,z)).toBe(true);
 d.leave();blockedAll=true;expect(d.sync('wave',f.engine)).toBe(false);expect(f.c.mode).toBe('overview');d.dispose();
});

function stackedFixture(){
 const f=basic(),{drone:d,engine:e,subject:s}=f;s.z=s.aimZ=160;
 e.enemies.activeTargets.push(...[192,224].map((z,i)=>({...s,id:'neighbour-'+i,z,aimZ:z})));
 e.firing.states.push({id:'participating-gun',x:240,z:128,target:s,lineOfSight:true});
 d.setEnabled(true);d.sync('wave',e);d.position.set([240,144,368]);d.velocity.fill(0);d.acceleration.fill(0);d.subject=s;d.compose(e);d.look.set(d.focus);d.routeLength=d.routeIndex=0;d.heldFor=3;d.gatherComposition();
 return f;
}

test('composition projects live model bounds with the actual Camera perspective at wide, tall and narrow aspects',()=>{
 const f=stackedFixture(),{drone:d,c}=f;
 try{
  // Replace the first fallback box with an asymmetric live model envelope.
  d.obstacles.records=[{id:f.subject.id,state:f.subject}];d.obstacles.actorCurrent=new Float64Array([228,24,152,252,53,168]);d.gatherComposition();
  expect(Array.from(d.compositionBounds.subarray(0,6))).toEqual([228,24,152,252,53,168]);
  for(const aspect of [.5,1.5,3])for(const fov of [DRONE_CAMERA_MIN_FOV,76]){
   c.canvas.clientWidth=1000*aspect;c.canvas.clientHeight=1000;d.fov=fov;d.position.set([360,164,350]);
   const [x,y,z]=d.position,dx=x-d.focus[0],dy=y-d.focus[1],dz=z-d.focus[2];d.yaw=Math.atan2(dx,dz);d.pitch=Math.atan2(dy,Math.hypot(dx,dz));d.panRoll=d.flinch=0;d.apply();c.update(aspect);d.compositionCost(x,y,z);
   for(let i=0;i<d.compositionCount;i++){
    const b=d.compositionBounds,k=i*6,rect=[Infinity,Infinity,-Infinity,-Infinity];
    for(let corner=0;corner<8;corner++){const ax=b[k+(corner&1?3:0)],ay=b[k+1+(corner&2?3:0)],az=b[k+2+(corner&4?3:0)],m=c.vp,w=m[3]*ax+m[7]*ay+m[11]*az+m[15],px=(m[0]*ax+m[4]*ay+m[8]*az+m[12])/w,py=(m[1]*ax+m[5]*ay+m[9]*az+m[13])/w;rect[0]=Math.min(rect[0],px);rect[1]=Math.min(rect[1],py);rect[2]=Math.max(rect[2],px);rect[3]=Math.max(rect[3],py);}
    for(let n=0;n<4;n++)expect(d.projectedSubjects[i*4+n]).toBeCloseTo(rect[n],4);
   }
  }
 }finally{d.dispose();}
});

test('stacked enemy and participating-defence silhouettes trigger one committed, materially clearer camera angle',()=>{
 const f=stackedFixture(),{drone:d}=f;
 try{
  const before=d.compositionCost(...d.position);expect(before).toBeGreaterThan(.22);expect(d.compositionCount).toBe(4);expect(d.vantage()).toBe(true);
  const goal=Array.from(d.goal),after=d.compositionCost(...goal);expect(after).toBeLessThan(before-.08);expect(d.compositionReframes).toBe(1);expect(d.lowShot).toBe(false);expect(Math.abs(goal[0]-240)).toBeGreaterThan(64);
  // A valid journey is held, and arriving at a useful angle starts a fresh hold.
  for(let n=0;n<3;n++){d.time+=.8;expect(d.vantage()).toBe(true);expect(Array.from(d.goal)).toEqual(goal);}
  d.position.set(goal);d.routeIndex=d.routeLength;d.heldFor=0;expect(d.vantage()).toBe(true);expect(d.holding).toBe(true);expect(d.compositionReframes).toBe(1);
  console.log(JSON.stringify({stackedComposition:{before,after,position:[240,144,368],focus:Array.from(d.focus),goal,subjects:d.compositionCount}}));
 }finally{d.dispose();}
});

test('composition collection remains finite after subject death, with no subject, and at its bounded crowded-scene capacity',()=>{
 const f=stackedFixture(),{drone:d,engine:e,subject:s}=f;
 try{
  s.health={alive:false};expect(()=>d.gatherComposition()).not.toThrow();expect(d.compositionCount).toBe(2);expect(Number.isFinite(d.compositionCost(...d.position))).toBe(true);
  d.subject=null;d.gatherComposition();expect(d.compositionCount).toBe(2);expect(Number.isFinite(d.compositionCost(...d.position))).toBe(true);
  s.health={alive:true};d.subject=s;for(let n=0;n<40;n++)e.enemies.activeTargets.push({...s,id:'crowd-'+n,x:220+n,z:180,aimX:220+n,aimZ:180});
  for(let n=0;n<9;n++)e.firing.states.push({id:'gun-'+n,x:200+n*12,z:140,target:s,lineOfSight:true});
  d.gatherComposition();expect(d.compositionCount).toBe(12);expect(d.compositionStates[0]).toBe(s);expect(d.compositionStates.slice(8).every(gun=>gun.target===s)).toBe(true);expect(Number.isFinite(d.compositionCost(...d.position))).toBe(true);expect(d.compositionBounds.byteLength+d.projectedSubjects.byteLength).toBe(960);
 }finally{d.dispose();}
});

test('occasional clock windows offer safe low stations, with full sky-column, water and future-air-lane rejection',()=>{
 for(const blocked of [false,true]){
  const f=basic(),{drone:d}=f;
  try{
   d.setEnabled(true);d.sync('wave',f.engine);d.subject=f.subject;d.compose(f.engine);d.position.set([240,144,368]);d.routeLength=d.routeIndex=0;
   if(blocked)f.world.visibility={nodeCount:1,bounds:new Float32Array([0,90,0,480,110,384]),escape:new Uint32Array([1]),clear:()=>true};
   const low=[];
   for(let n=1;n<=8;n++){
    d.routeIndex=d.routeLength;d.position.set(n===1?[240,144,368]:d.goal);d.move(1/120);d.time=[0,8,16,24,32,40,56,64][n-1];d.heldFor=d.shotSeconds;expect(d.vantage()).toBe(true);expect(d.relocations).toBe(n);if(d.lowShot){low.push(n);expect(d.goal[1]).toBeGreaterThanOrEqual(64);expect(d.goal[1]).toBeLessThanOrEqual(80);expect(d.columnClear(...d.goal)).toBe(true);expect(d.obstacles.pointClear(...d.goal,DRONE_CAMERA_RADIUS,.8)).toBe(true);}
   }
   expect(low).toEqual(blocked?[]:[4,8]);
   // Even a presently empty future flight lane invalidates a low filming
   // column. A low point over water must also keep the complete camera hull dry.
   d.airLanes=new Float64Array([90,75,90,110,100,110]);expect(d.staticClear(100,64,100,100,64,100)).toBe(true);expect(d.columnClear(100,64,100)).toBe(false);
   d.water.fill(64);expect(d.staticClear(100,64,100,100,64,100)).toBe(false);
  }finally{d.dispose();}
 }
});

test('actual A2 posed enemies and participating guns gain projected separation; planner work and storage stay bounded',async()=>{
 const f=await actualFixture(1,{config:PLAY_CONFIG,waveIndex:3}),{drone:d,engine:e,c}=f;
 try{
  e.startWave();for(let n=0;n<24*60;n++)e.advance(1/60);d.setEnabled(true);d.sync('wave',e);d.anticipation.reset();d.subject=e.enemies.activeTargets.find(s=>s.id==='a2-wave-4-moth-7');d.position.set([156,173,360]);d.compose(e);d.look.set(d.focus);d.routeIndex=d.routeLength=0;d.heldFor=3;d.gatherComposition();expect(d.shotQuality(...d.position)).toBe(1);expect(d.separation(...d.position)).toBe(true);
  // Measure independent screen-space centres through the production Camera VP,
  // including its Float32 precision. This does not reuse compositionCost().
  const screen=position=>{
   c.position.set(position);c.mode='live';c.roll=0;c.fov=d.fov;const dx=position[0]-d.focus[0],dy=position[1]-d.focus[1],dz=position[2]-d.focus[2];c.yaw=Math.atan2(dx,dz);c.pitch=Math.atan2(dy,Math.hypot(dx,dz));c.update(1.5);
   const points=[];for(let n=0;n<d.compositionCount;n++){const k=n*6,b=d.compositionBounds,x=(b[k]+b[k+3])*.5,y=(b[k+1]+b[k+4])*.5,z=(b[k+2]+b[k+5])*.5,m=c.vp,w=m[3]*x+m[7]*y+m[11]*z+m[15];points.push([(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w]);}
   let stacks=0;for(let i=0;i<points.length;i++)for(let n=i+1;n<points.length;n++)if(Math.abs(points[i][0]-points[n][0])<.1&&Math.abs(points[i][1]-points[n][1])<.6)stacks++;return {stacks,primaryGap:Math.abs(points[0][0]-points[1][0])};
  };
  const before={cost:d.compositionCost(...d.position),...screen(d.position)},stateBefore=JSON.stringify(e.stats());expect(d.vantage()).toBe(true);const goal=Array.from(d.goal),after={cost:d.compositionCost(...goal),...screen(goal)};
  expect(d.compositionCount).toBe(9);expect(d.compositionStates.filter(gun=>gun?.lineOfSight).length).toBe(2);expect(after.cost).toBeLessThan(before.cost-.08);expect(after.stacks).toBeLessThan(before.stacks);expect(before.primaryGap).toBeLessThan(.001);expect(after.primaryGap).toBeGreaterThan(.2);expect(d.staticClear(...d.position,...goal)).toBe(true);expect(d.obstacles.clearSegment(...d.position,...goal,DRONE_CAMERA_RADIUS,.8)).toBe(true);expect(JSON.stringify(e.stats())).toBe(stateBefore);
  const bounds=d.compositionBounds,projected=d.projectedSubjects,states=d.compositionStates,normalCost=d.compositionCost,timing=[];
  for(const enabled of [false,true]){
   d.compositionCost=enabled?normalCost:()=>0;const samples=[];
   for(let n=0;n<120;n++){d.position.set([156,173,360]);d.routeIndex=d.routeLength=0;d.heldFor=10;d.lowShot=false;d.relocations=0;const start=performance.now();d.vantage();const elapsed=performance.now()-start;if(n>=20)samples.push(elapsed);}
   samples.sort((a,b)=>a-b);timing.push({composition:enabled,medianMS:samples[50],p95MS:samples[95],samples:samples.length});
  }
  d.compositionCost=normalCost;expect(d.compositionBounds).toBe(bounds);expect(d.projectedSubjects).toBe(projected);expect(d.compositionStates).toBe(states);expect(bounds.byteLength+projected.byteLength).toBe(960);
  console.log(JSON.stringify({actualComposition:{encounter:e.wave.id,at:e.time,position:[156,173,360],focus:Array.from(d.focus),goal,before,after,subjects:d.compositionCount,maxCandidates:120,maxProjectedCorners:120*12*8,maxSubjectPairs:120*66,addedTypedBytes:960,timing}}));
 }finally{f.dispose();}
},10000);

test('an ordinary unprimed production wave achieves and holds a safe low shot while spending most time high',async()=>{
 const replay=await Bun.file(new URL('../docs/b4-missile-follow-up-2026-10-20/mixed-campaign.json',import.meta.url)).json(),placements=replay.results.find(result=>result.name==='mixed').waves[3].placements,f=await actualFixture(0,{config:PLAY_CONFIG,waveIndex:3,placements}),{drone:d,engine:e}=f;
 try{
  d.random=()=>.7;d.bind(f.world);e.startWave();d.setEnabled(true);d.sync('wave',e);let frames=0,high=0,lowHold=0,minY=Infinity,arrival=null,plans=0;
  while(e.running&&frames<100*60){
   const previous=Array.from(d.position);e.advance(1/60);d.advance(1/60,{engine:e,phase:'wave'});frames++;if(d.position[1]>=d.altitude(0))high++;if(d.lowArrived&&d.holding&&d.speed<2&&d.position[1]<f.world.level.pathHeight+80)lowHold++;minY=Math.min(minY,d.position[1]);plans=Math.max(plans,d.lowPlans);
   expect(d.staticClear(...previous,...d.position)).toBe(true);expect(d.obstacles.pointClear(...d.position,DRONE_CAMERA_RADIUS)).toBe(true);expect(Math.hypot(...d.position.map((v,i)=>v-previous[i]))).toBeLessThanOrEqual(DRONE_CAMERA_SPEED/60+1e-7);
   if(d.lowShots&&!arrival)arrival={elapsedSeconds:e.waveTime,nativeSteps:frames,target:d.subject?.id,position:Array.from(d.position),goal:Array.from(d.goal),focus:Array.from(d.focus),look:Array.from(d.look),yaw:d.yaw,pitch:d.pitch,fov:d.fov,roll:f.c.roll,goalDuration:d.goalDuration};
  }
  expect(e.completed).toBe(true);expect(e.enemies.escaped).toBe(0);expect(d.lowShots).toBe(1);expect(plans).toBeGreaterThanOrEqual(d.lowShots);expect(arrival).not.toBeNull();expect(arrival.position[1]).toBeLessThan(86);expect(lowHold).toBeGreaterThan(60);expect(high/frames).toBeGreaterThan(.65);expect(minY).toBeGreaterThanOrEqual(f.world.level.pathHeight+32);
  console.log(JSON.stringify({ordinaryLow:{encounter:e.wave.id,cosmeticRandomSample:.7,arrival,minY,highFraction:high/frames,lowHoldSeconds:lowHold/60,lowPlans:plans,achievedLowShots:d.lowShots,elapsedSeconds:e.waveTime,frames,placements}}));
 }finally{f.dispose();}
},10000);
