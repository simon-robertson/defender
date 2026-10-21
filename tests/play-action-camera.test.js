import {test,expect} from 'bun:test';
import {ActionCamera} from '../play/action-camera.js';
import {Camera} from '../engine/camera.js';
import {PathMotion} from '../engine/path-motion.js';
import {newLevel} from '../shared/level.js';
import {identity} from '../shared/math.js';
import {legacyPlayConfig} from './helpers/legacy-play-config.js';
function fixture(width=1200,height=800){
 const canvas={clientWidth:width,clientHeight:height,addEventListener(){},focus(){}},level=newLevel('camera-test');level.size=[20,16];
 let invalidations=0;const camera=new Camera(canvas,()=>invalidations++);camera.setLevel(level);
 const world={level,width:480,length:384},director=new ActionCamera(camera);director.bind(world);
 const engine={enemies:{activeTargets:[]},firing:{states:[]}};
 return {camera,director,engine,world,get invalidations(){return invalidations;}};
}
function actor(x,z,extra={}){return {phase:'active',health:{alive:true},x,y:24,z,aimX:x,aimY:32,aimZ:z,...extra};}
function run(f,seconds,{phase='wave',hz=60,paused=false}={}){for(let i=0;i<seconds*hz;i++)f.director.advance(1/hz,{engine:f.engine,phase,paused});}
const pose=c=>[...c.target,c.radius,c.yaw,c.pitch];
function projected(camera,x,y,z){camera.update(camera.canvas.clientWidth/camera.canvas.clientHeight);const m=camera.vp;return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13]];}

test('preparation return converges on the same path frame as the Frame button',()=>{
 const f=fixture();f.world.level.path=[[2,0,6],[3,0,6],[4,0,6]];f.camera.setLevel(f.world.level);f.director.bind(f.world);
 const expected=[...f.camera.target,f.camera.radius];f.engine.enemies.activeTargets=[actor(300,250)];run(f,8);run(f,20,{phase:'deploy'});
 for(let i=0;i<4;i++)expect(pose(f.camera)[i]).toBeCloseTo(expected[i],1);
 expect(f.director.stats().returning).toBe(false);expect(f.director.overviewRadius).toBeCloseTo(expected[3],8);
});

test('empty/title preparation never takes camera ownership; bind and release never move a user view',()=>{
 const f=fixture(),before=pose(f.camera);run(f,8,{phase:'title'});run(f,8,{phase:'deploy'});expect(pose(f.camera)).toEqual(before);expect(f.director.stats().owned).toBe(false);
 f.director.noteDeath(actor(50,70));f.director.bind(null);expect(pose(f.camera)).toEqual(before);run(f,2);expect(pose(f.camera)).toEqual(before);expect(f.director.events.every(value=>value===-Infinity)).toBe(true);f.director.dispose();f.director.dispose();expect(f.director.camera).toBeNull();
});

test('sparse combat closes in smoothly with fixed orientation, finite bounded motion and no long-frame leap',()=>{
 const f=fixture(),initial=f.camera.radius,yaw=f.camera.yaw,pitch=f.camera.pitch;f.engine.enemies.activeTargets=[actor(100,110)];let previous=pose(f.camera);
 for(let frame=0;frame<12*60;frame++){
  f.director.advance(1/60,{engine:f.engine,phase:'wave'});const current=pose(f.camera);expect(current.every(Number.isFinite)).toBe(true);expect(Math.abs(current[0]-previous[0])).toBeLessThanOrEqual(72/60+.001);expect(Math.abs(current[2]-previous[2])).toBeLessThanOrEqual(72/60+.001);expect(Math.abs(current[3]-previous[3])).toBeLessThanOrEqual(90/60+.001);previous=current;
 }
 expect(f.camera.radius).toBeLessThan(initial*.6);expect(f.camera.radius).toBeGreaterThanOrEqual(116);expect(f.camera.radius).toBeCloseTo(116,3);expect(f.camera.yaw).toBe(yaw);expect(f.camera.pitch).toBe(pitch);
 const before=pose(f.camera);f.engine.enemies.activeTargets=[actor(450,350)];f.director.advance(1000,{engine:f.engine,phase:'wave'});expect(Math.abs(f.camera.target[0]-before[0])).toBeLessThanOrEqual(18.1);expect(Math.abs(f.camera.target[2]-before[2])).toBeLessThanOrEqual(18.1);
});

test('spread fronts and engaged gun envelopes fit wide and portrait views without selecting scheduled enemies or mutating targeting',()=>{
 for(const [width,height]of [[1600,800],[500,1000]]){
  const f=fixture(width,height),near=actor(30,30),far=actor(450,350),scheduled=actor(-10000,-10000,{phase:'scheduled'});f.engine.enemies.activeTargets=[near,far,scheduled];
  const gun={x:80,z:80,rig:{root:identity()},target:near,lineOfSight:true,pitchReachable:true};gun.rig.root[13]=24;f.engine.firing.states=[gun];
  f.engine.firing.eligible=()=>{throw new Error('Presentation must not mutate targeting.');};f.engine.firing.planner={choose(){throw new Error('Presentation must not acquire targets.');}};
  run(f,20);expect(f.director.stats().points).toBe(5);
  for(const [x,z,height]of [[30,30,14],[450,350,14],[80,80,22]])for(const dx of [-12,12])for(const dz of [-12,12])for(const y of [24,24+height]){
   const point=projected(f.camera,x+dx,y,z+dz);expect(Math.abs(point[0])).toBeLessThan(.99);expect(Math.abs(point[1])).toBeLessThan(.99);
  }
  expect(f.director.stats().focus[0]).toBeGreaterThan(100);expect(f.director.stats().focus[0]).toBeLessThan(400);
 }
});

test('look-ahead follows actual route through a corner and clamps at exit rather than wrapping',()=>{
 const f=fixture(),path=new PathMotion([[3,0,3],[4,0,3],[4,0,4],[4,0,5]]),sample=new Float64Array(5);path.sample(22,sample);
 const enemy=actor(sample[0],sample[1],{path,distance:22,movement:{speed:12}});f.engine.enemies.activeTargets=[enemy];f.director.advance(1/60,{engine:f.engine,phase:'wave'});
 const focus=f.director.stats().focus;expect(focus[2]).toBeGreaterThan(enemy.z*.92+384*.04);expect(focus[0]).toBeLessThanOrEqual(108*.92+480*.04);
 enemy.distance=path.length-1;path.sample(enemy.distance,sample);enemy.x=enemy.aimX=sample[0];enemy.z=enemy.aimZ=sample[1];f.director.advance(1/60,{engine:f.engine,phase:'wave'});expect(f.director.stats().focus[2]).toBeGreaterThan(130);
});

test('fixed-clock damping agrees at30/60/120Hz and moving-route framing has no material frame-rate drift',()=>{
 const snapshots=[];
 for(const hz of [30,60,120]){const f=fixture();f.engine.enemies.activeTargets=[actor(120,100)];run(f,5,{hz});snapshots.push(pose(f.camera));}
 expect(snapshots[1]).toEqual(snapshots[0]);expect(snapshots[2]).toEqual(snapshots[0]);
 const moving=[];
 for(const hz of [30,60,120]){
  const f=fixture(),path=new PathMotion(Array.from({length:14},(_,i)=>[i,0,8])),sample=new Float64Array(5),enemy=actor(12,204,{path,distance:0,movement:{speed:12}});f.engine.enemies.activeTargets=[enemy];
  for(let i=1;i<=8*hz;i++){enemy.distance=i/hz*12;path.sample(enemy.distance,sample);enemy.x=enemy.aimX=sample[0];enemy.z=enemy.aimZ=sample[1];f.director.advance(1/hz,{engine:f.engine,phase:'wave'});}moving.push(pose(f.camera));
 }
 for(const snapshot of moving.slice(1))for(let i=0;i<4;i++)expect(Math.abs(snapshot[i]-moving[0][i])).toBeLessThan(.3);
});

test('death context survives busy gunfire and holds through four-second settling, then returns smoothly only once',()=>{
 const f=fixture();f.engine.enemies.activeTargets=[actor(100,110)];run(f,8);f.director.noteDeath(f.engine.enemies.activeTargets[0]);f.engine.enemies.activeTargets=[];
 const shot=identity();shot[12]=400;shot[14]=300;for(let i=0;i<50;i++)f.director.noteShot(shot);
 run(f,.1,{phase:'settling'});const focus=f.director.stats().focus,goal=f.director.stats().radiusGoal;run(f,4,{phase:'settling'});expect(f.director.stats().focus).toEqual(focus);expect(f.director.stats().radiusGoal).toBe(goal);
 const before=pose(f.camera);f.director.advance(1/60,{engine:f.engine,phase:'loadout'});expect(Math.abs(f.camera.radius-before[3])).toBeLessThan(2);expect(f.director.stats().returning).toBe(true);run(f,30,{phase:'loadout'});expect(f.director.stats().returning).toBe(false);expect(f.director.stats().owned).toBe(false);
 const settled=pose(f.camera);run(f,10,{phase:'loadout'});expect(pose(f.camera)).toEqual(settled);
});

test('recent death interest expires without a settling phase and paused time freezes view, hold and event lifetime',()=>{
 const f=fixture();f.director.noteDeath(actor(70,70));run(f,1);expect(f.director.stats().points).toBe(1);const before=pose(f.camera),time=f.director.time;run(f,60,{paused:true});expect(pose(f.camera)).toEqual(before);expect(f.director.time).toBe(time);run(f,4);expect(f.director.stats().points).toBe(0);
 f.director.manualOverride();const hold=f.director.hold;run(f,60,{paused:true});expect(f.director.hold).toBe(hold);
});

test('manual drag/key holds, disable/resume and preparation takeover never fight the player or snap on resuming',()=>{
 const f=fixture();f.engine.enemies.activeTargets=[actor(90,100)];run(f,2);f.director.manualOverride();f.camera.target.set([320,30,300]);f.camera.radius=117;f.camera.yaw=1.1;f.camera.pitch=.9;const manual=pose(f.camera);
 for(let frame=0;frame<12*60;frame++){f.director.manualOverride();f.director.advance(1/60,{engine:f.engine,phase:'wave'});}expect(pose(f.camera)).toEqual(manual);
 run(f,5);expect(pose(f.camera)).toEqual(manual);run(f,2);expect(f.camera.yaw).toBe(1.1);expect(f.camera.pitch).toBe(.9);expect(f.camera.target[0]).toBeLessThan(manual[0]);
 f.director.setEnabled(false);const off=pose(f.camera);run(f,20);expect(pose(f.camera)).toEqual(off);f.director.resume();f.director.advance(1/60,{engine:f.engine,phase:'wave'});expect(Math.abs(f.camera.target[0]-off[0])).toBeLessThan(1.3);
 f.director.advance(1/60,{engine:f.engine,phase:'deploy'});expect(f.director.returning).toBe(true);f.director.manualOverride();const prep=pose(f.camera);run(f,15,{phase:'deploy'});expect(pose(f.camera)).toEqual(prep);expect(f.director.returning).toBe(false);
});


test('takeover from extreme manual zoom/pan returns within speed limits instead of clamping to auto bounds',()=>{
 for(const radius of [35,650]){
  const f=fixture();f.engine.enemies.activeTargets=[actor(90,100)];run(f,1);f.director.manualOverride();f.camera.target.set([-144,30,499]);f.camera.radius=radius;run(f,6);const before=pose(f.camera);
  f.director.advance(1/60,{engine:f.engine,phase:'wave'});expect(Math.abs(f.camera.target[0]-before[0])).toBeLessThan(.03);expect(Math.abs(f.camera.target[2]-before[2])).toBeLessThan(.03);expect(Math.abs(f.camera.radius-before[3])).toBeLessThan(.03);
  run(f,20);expect(f.camera.target[0]).toBeGreaterThan(0);expect(f.camera.target[2]).toBeLessThan(384);expect(f.camera.radius).toBeGreaterThan(116-1e-6);
 }
});

test('event timestamps follow actual bounded engine time rather than a longer browser-frame delta',()=>{
 const f=fixture();f.engine.time=1;f.director.advance(1,{engine:f.engine,phase:'wave'});expect(f.director.time).toBe(1);
 f.director.noteDeath(actor(90,100),2.99);f.engine.time=3;f.director.advance(5,{engine:f.engine,phase:'wave'});expect(f.director.time).toBe(3);expect(f.director.stats().points).toBe(1);
 f.engine.time=6;f.director.advance(20,{engine:f.engine,phase:'wave'});expect(f.director.stats().points).toBe(1);f.engine.time=8;f.director.advance(1,{engine:f.engine,phase:'wave'});expect(f.director.stats().points).toBe(0);
});


test('zero-hold preparation takeover cancels the return but lets the next wave own the camera immediately',()=>{
 const f=fixture();f.engine.enemies.activeTargets=[actor(90,100)];run(f,8);f.director.advance(1/60,{engine:f.engine,phase:'deploy'});expect(f.director.returning).toBe(true);
 f.director.manualOverride(0);const before=pose(f.camera);run(f,1,{phase:'deploy'});expect(pose(f.camera)).toEqual(before);expect(f.director.returning).toBe(false);expect(f.director.hold).toBe(0);
 f.engine.enemies.activeTargets=[actor(420,300)];f.director.advance(1/60,{engine:f.engine,phase:'wave'});expect(f.director.owned).toBe(true);expect(f.director.hold).toBe(0);expect(f.camera.target[0]).toBeGreaterThan(before[0]);expect(Math.abs(f.camera.target[0]-before[0])).toBeLessThan(.03);
});

// Actual animated exposed meshes during a complete combat transition: a settled
// framing test alone cannot catch a gun entering the shot before the zoom fits.
test('real A1/A2 fights anticipate guns before engagement and keep their animated meshes readable on laptop/desktop frames',async()=>{
 const {loadPlayWorld,PlayEngine,disposePlayWorld}=await import('../play/engine.js'),config=legacyPlayConfig();
 const native=globalThis.fetch,assets=new Map();
 globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url),key=kind+'/'+id;if(!assets.has(key))assets.set(key,await Bun.file(new URL(`../assets/${key}.json`,import.meta.url)).json());return {ok:true,json:async()=>({asset:structuredClone(assets.get(key))})};};
 try{
  for(const [levelIndex,waveIndex,width,height,variant]of [[0,0,1500,1000,'base'],[0,1,1500,1000,'upgrade1'],[0,3,1920,1080,'upgrade2'],[1,3,1500,1000,'upgrade2']]){
   const level=config.levels[levelIndex],wave=level.waves[waveIndex],boxes=levelIndex===0?[[13,0,9],[4,0,9]]:[[5,0,5],[8,0,8]],placements=boxes.map((box,index)=>({id:'player-gun-'+(index+1),model:'turret-study',variant,box,turn:0}));
   const world=await loadPlayWorld(level.id,{config,wave,placements}),f=fixture(width,height),shots=new Set();f.camera.setLevel(world.level);f.director.bind(world);let engine,phase='wave',settleAt=Infinity,clippedFrames=0,clippedShots=0,firstClip=null,maxNDC=0,actualShotFrames=0,minRadius=f.camera.radius,overviewRadius=f.camera.radius;
   try{
    engine=new PlayEngine(world,{config,wave,onShot:(_variant,matrix,at)=>{f.director.noteShot(matrix,at);const gun=engine.firing.states.find(g=>g.gunMatrix===matrix);if(gun)shots.add(gun.id);},onDeath:(_id,state)=>f.director.noteDeath(state,engine.time),onWaveComplete:()=>{phase='settling';settleAt=engine.time;}});
    const vertices=new Map(world.entries.map(entry=>{const unique=new Map();for(let i=0;i<entry.mesh.vertices.length;i+=11){const p=entry.mesh.vertices.subarray(i,i+3);unique.set(p.join(','),p);}return [entry.key,[...unique.values()]];}));
    engine.startWave();
    for(let frame=0;frame<120*60&&engine.time<settleAt+4;frame++){
     shots.clear();engine.advance(1/60,{combat:phase==='wave'});f.director.advance(1/60,{engine,phase});f.camera.update(width/height);minRadius=Math.min(minRadius,f.camera.radius);let clipped=false;
     if(shots.size)actualShotFrames++;
     for(const gun of engine.firing.states){
      const engaged=gun.target?.phase==='active'&&gun.target.health.alive&&gun.lineOfSight===true&&gun.pitchReachable!==false;if(!engaged&&!shots.has(gun.id))continue;
      for(const bone of gun.rig.bones){const m=bone.instance.matrix;for(const [x,y,z]of vertices.get(bone.instance.key)){
       const wx=m[0]*x+m[4]*y+m[8]*z+m[12],wy=m[1]*x+m[5]*y+m[9]*z+m[13],wz=m[2]*x+m[6]*y+m[10]*z+m[14],v=f.camera.vp,ndc=Math.max(Math.abs(v[0]*wx+v[4]*wy+v[8]*wz+v[12]),Math.abs(v[1]*wx+v[5]*wy+v[9]*wz+v[13]));maxNDC=Math.max(maxNDC,ndc);
       if(ndc>1.001){clipped=true;if(shots.has(gun.id))clippedShots++;firstClip??={level:level.id,width,time:engine.time,gun:gun.id,ndc};}
      }}
     }
     if(clipped)clippedFrames++;
    }
    expect({clippedFrames,firstClip}).toEqual({clippedFrames:0,firstClip:null});expect(clippedShots).toBe(0);expect(maxNDC).toBeLessThanOrEqual(1.001);expect(actualShotFrames).toBeGreaterThan(0);expect(minRadius).toBeLessThan(overviewRadius*.85);expect(engine.enemies.killed).toBe(wave.spawns.length);expect(engine.enemies.escaped).toBe(0);
   }finally{engine?.dispose();f.director.dispose();disposePlayWorld(world);}
  }
 }finally{globalThis.fetch=native;}
},30000);

