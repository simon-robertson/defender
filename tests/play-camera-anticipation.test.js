import {test,expect} from 'bun:test';
import {CameraAnticipation} from '../play/camera-anticipation.js';
import {DroneCamera} from '../play/drone-camera.js';
import {Camera} from '../engine/camera.js';
import {PathMotion} from '../engine/path-motion.js';
import {SceneryVisibility} from '../engine/visibility.js';

const camera=()=>new Camera({clientWidth:1500,clientHeight:1000,addEventListener(){},focus(){}},()=>{});
function fixture(model='turret-study'){
 const path=Array.from({length:20},(_,x)=>[x,0,4]),motion=new PathMotion(path),level={id:'forecast',size:[20,16],path,pathHeight:24,terrain:{defaultHeight:24,boxes:[]},placements:[]},world={level,width:480,length:384,rigs:new Map(),actors:new Map(),visibility:new SceneryVisibility(level,new Map())};
 const target={id:'approach',phase:'active',health:{alive:true},path:motion,distance:128,movement:{speed:20},x:140,y:24,z:108,aimX:140,aimY:34,aimZ:108};
 const gun={id:'idle-defence',model,x:360,z:144,maxRange:66,requiresLineOfSight:true,cycle:{time:0,readyAt:0,nextShotAt:Infinity,remaining:0,lastShotAt:-Infinity},target:null,lineOfSight:null,pitch:{min:-.61,max:.61},ammo:3};
 const engine={time:0,waveTime:0,enemies:{states:[target],activeTargets:[target]},firing:{states:[gun]},wildlife:{states:[]}};
 return {world,target,gun,engine};
}
function tick(f,dt){f.engine.time+=dt;f.engine.waveTime+=dt;f.gun.cycle.time+=dt;f.target.distance+=f.target.movement.speed*dt;f.target.path.sample(f.target.distance,new Float64Array(5));f.target.x=f.target.aimX=12+f.target.distance;}

test('idle gun, Arc and missile forecasts use real future route/range, readiness and a fixed committed event',()=>{
 for(const model of ['turret-study','arc-spire','missile-launcher']){
  const f=fixture(model),a=new CameraAnticipation({speed:34,standoff:128}),position=[45,144,300],snapshot=JSON.stringify({target:f.target,gun:f.gun});
  expect(Math.hypot(f.target.x-f.gun.x,f.target.z-f.gun.z)).toBeGreaterThan(f.gun.maxRange);a.update(f.engine,f.world,position);expect(a.active).toBe(true);expect(a.at).toBeGreaterThan(0);expect(a.defence).toBe(f.gun);expect(Math.hypot(a.point[0]-f.gun.x,a.point[2]-f.gun.z)).toBeLessThanOrEqual(f.gun.maxRange);
  expect(JSON.stringify({target:f.target,gun:f.gun})).toBe(snapshot);const point=[...a.point],at=a.at;tick(f,2);a.update(f.engine,f.world,position);expect([...a.point]).toEqual(point);expect(a.at).toBe(at);
  const b=new CameraAnticipation();f.gun.cycle.readyAt=f.gun.cycle.time+30;b.update(f.engine,f.world,position);expect(b.active).toBe(false);
 }
});

test('route bends, airborne aiming, LOS, pitch, scheduled arrivals and unknown inputs have conservative bounded handling',()=>{
 const f=fixture(),a=new CameraAnticipation({speed:18,standoff:86}),position=[45,144,300];
 f.target.path=new PathMotion([[5,0,4],[6,0,4],[7,0,4],[7,0,5],[7,0,6],[7,0,7],[8,0,7],[9,0,7],[10,0,7],[11,0,7],[12,0,7],[13,0,7]]);f.target.distance=0;f.target.x=132;f.gun.x=240;f.gun.z=180;f.gun.maxRange=52;a.update(f.engine,f.world,position);expect(a.active).toBe(true);expect(a.point[2]).toBeGreaterThan(108);expect(a.samples).toBeLessThanOrEqual(37);
 a.reset();f.target.aimY=200;a.update(f.engine,f.world,position);expect(a.active).toBe(false);
 a.reset();f.gun.model='arc-spire';f.target.aimY=72;a.update(f.engine,f.world,position);expect(a.active).toBe(true);expect(a.point[1]).toBe(72);
 a.reset();f.world.visibility.clear=()=>false;a.update(f.engine,f.world,position);expect(a.active).toBe(false);
 a.reset();f.world.visibility.clear=()=>true;f.gun.model='unknown';a.update(f.engine,f.world,position);expect(a.active).toBe(false);
 a.reset();f.gun.model='arc-spire';f.target.phase='scheduled';f.target.spawnAt=2;a.update(f.engine,f.world,position);expect(a.active).toBe(true);expect(a.at).toBeGreaterThan(2);
 a.reset();f.gun.strength=0;a.update(f.engine,f.world,position);expect(a.active).toBe(false);
 a.reset();f.engine.enemies.states=[];a.update(f.engine,f.world,position);expect(a.active).toBe(false);
});

test('recent real firing keeps attention before a future opportunity and sample work is bounded across large rosters',()=>{
 const f=fixture(),a=new CameraAnticipation(),position=[45,41,300];f.gun.target=f.target;f.gun.lineOfSight=true;f.gun.cycle.lastShotAt=0;a.update(f.engine,f.world,position);expect(a.active).toBe(false);
 f.gun.target=null;f.engine.time=1;f.engine.enemies.states=Array.from({length:20},(_,i)=>({...f.target,id:'target-'+i}));f.engine.firing.states=Array.from({length:20},(_,i)=>({...f.gun,id:'gun-'+i}));a.update(f.engine,f.world,position);expect(a.pairs).toBe(96);expect(a.samples).toBeLessThanOrEqual(96*37);expect(a.active).toBe(true);
});

test('the Drone camera leaves a held current shot and moves toward an idle defence before its enemy enters range, then freezes with pause',()=>{
 for(const Type of [DroneCamera]){
  const f=fixture(),c=camera();c.setLevel(f.world.level);const view=new Type(c);view.bind(f.world);view.setEnabled(true);view.sync('wave',f.engine);
  view.position.set([45,144,300]);view.holding=true;view.routeLength=view.routeIndex=0;
  const start=[...view.position];let first=null;
  for(let frame=0;frame<3*60;frame++){tick(f,1/60);view.advance(1/60,{engine:f.engine,phase:'wave'});if(first===null&&view.anticipation.active)first=[...view.anticipation.point];expect(Math.hypot(f.target.x-f.gun.x,f.target.z-f.gun.z)).toBeGreaterThan(f.gun.maxRange);}
  expect(first).not.toBeNull();expect(view.anticipation.active).toBe(true);expect([...view.anticipation.point]).toEqual(first);expect(Math.hypot(view.position[0]-start[0],view.position[2]-start[2])).toBeGreaterThan(15);expect(view.travelled).toBeGreaterThan(20);
  const goal=view.anticipation.focus;expect(Math.hypot(view.position[0]-goal[0],view.position[2]-goal[2])).toBeLessThan(Math.hypot(start[0]-goal[0],start[2]-goal[2]));
  const pose=[...view.position,c.yaw,c.pitch,c.focusDistance],forecast=JSON.stringify(view.anticipation.stats());view.advance(5,{engine:f.engine,phase:'wave',paused:true});expect([...view.position,c.yaw,c.pitch,c.focusDistance]).toEqual(pose);expect(JSON.stringify(view.anticipation.stats())).toBe(forecast);
  view.dispose();expect(view.anticipation.target).toBeNull();
 }
});

test('drone keeps its gradual gimbal turn without restoring removed depth-of-field state',()=>{
 const c=camera(),d=new DroneCamera(c);d.position.set([100,120,100]);d.look.set([200,120,0]);d.focus.set([200,120,0]);d.yaw=0;d.pitch=0;
 const position=[...d.position],look=[...d.look];d.aim(1/120,{firing:{states:[]}});
 expect(d.yaw).toBeLessThan(0);expect(Math.abs(d.yaw)).toBeLessThan(.01);expect(d.pitch).toBe(0);expect([...d.position]).toEqual(position);expect([...d.look]).toEqual(look);
 d.apply();expect(c.yaw).toBe(d.yaw);expect(c.pitch).toBe(d.pitch);expect(d.focusDistance).toBeUndefined();expect(c.focusDistance).toBeUndefined();
});

test('accepted A1 source and actual weapons demonstrate advance forecasting and useful pre-shot coverage',async()=>{
 const {PLAY_CONFIG}=await import('../play/config.js'),{loadPlayWorld,PlayEngine,disposePlayWorld}=await import('../play/engine.js'),native=globalThis.fetch;
 globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};
 try{
  for(const Type of [DroneCamera]){
   const wave=PLAY_CONFIG.levels[0].waves[0],placements=[[7,0,11],[12,0,7]].map((box,i)=>({id:'player-gun-'+i,model:'turret-study',variant:'base',box,turn:0})),world=await loadPlayWorld('moss-01',{config:PLAY_CONFIG,wave,placements}),c=camera();c.setLevel(world.level);const view=new Type(c);view.bind(world);const engine=new PlayEngine(world,{config:PLAY_CONFIG,wave});
   try{
    engine.startWave();
    const gun=engine.firing.states[0],anticipation=view.anticipation,x=132,y=34.5,z=276;
    anticipation.sourceAt(gun,x,z,world.level.pathHeight);const source=[...anticipation.source];
    // A real gun pivot lies inside its own posed chassis/cradle. Ignore only
    // that gun; a second actual defence must still obstruct the forecast.
    expect(world.visibility.clear(...source,x,y,z)).toBe(false);expect(world.visibility.clear(...source,x,y,z,gun.id)).toBe(true);expect(anticipation.eligible(gun,x,y,z,world)).toBe(true);
    const other=engine.firing.states[1],instances=world.rigs.get(other.id).instances,dx=(source[0]+x)*.5-other.x,dz=(source[2]+z)*.5-other.z;
    for(const instance of instances){instance.matrix[12]+=dx;instance.matrix[14]+=dz;}
    try{expect(anticipation.eligible(gun,x,y,z,world)).toBe(false);}finally{for(const instance of instances){instance.matrix[12]-=dx;instance.matrix[14]-=dz;}}
    expect(anticipation.eligible(gun,x,y,z,world)).toBe(true);
    view.setEnabled(true);view.sync('wave',engine);let frames=0,forecastFrames=0,leadTravel=0,firstForecastAt=null,totalTravel=0;
    while(engine.firing.shots===0&&frames++<60*90){const old=[...view.position];engine.advance(1/60);view.advance(1/60,{engine,phase:'wave'});totalTravel+=Math.hypot(...view.position.map((v,i)=>v-old[i]));if(view.anticipation.active&&engine.firing.shots===0){forecastFrames++;firstForecastAt??=engine.time;leadTravel+=Math.hypot(...view.position.map((v,i)=>v-old[i]));}}
    expect(engine.firing.shots).toBeGreaterThan(0);expect(forecastFrames).toBeGreaterThan(30);expect(totalTravel).toBeGreaterThan(10);if(leadTravel<10){expect(view.holding).toBe(true);expect(view.quality).toBeGreaterThanOrEqual(.84);}expect(firstForecastAt).toBeLessThan(engine.time-1);
    console.log(JSON.stringify({actualCamera:Type.name,firstForecastAt,firstShotAt:engine.time,forecastFrames,leadTravel,totalTravel}));
   }finally{view.dispose();engine.dispose();disposePlayWorld(world);}
  }
 }finally{globalThis.fetch=native;}
},15000);
