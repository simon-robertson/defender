import {test,expect} from 'bun:test';
import {DroneObstacles,DRONE_OBSTACLE_PREDICTION_SECONDS} from '../engine/drone-obstacles.js';
import {PoseRig} from '../engine/rig.js';
import {identity} from '../shared/math.js';
import {PathMotion} from '../engine/path-motion.js';
import {FlightPathMotion} from '../engine/flight-path-motion.js';
import {Health} from '../engine/health.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {WildlifePreview} from '../game/wildlife-preview.js';
import {actorsForPreview} from '../game/preview-actors.js';
import {newLevel} from '../shared/level.js';

const part=(id,voxels,pivot=[12,0,12],parent=null)=>({id,voxels,pivot,parent});
function data(parts,{model='test',role='enemy',x=60,y=40,z=60}={}){
 const root=identity();root[12]=x-12;root[13]=y;root[14]=z-12;
 const value={model,role,root,parts,instances:parts.map((p,i)=>({part:p.id,key:p.id,index:i,matrix:new Float32Array(root)}))};
 value.pose=new PoseRig(value,()=>{});return value;
}
function state(id,source,extra={}){return {id,x:source.root[12]+12,y:source.root[13],z:source.root[14]+12,health:new Health(100),rig:source.pose,lap:0,...extra};}
function world(actors=[],defences=[]){return {actors:new Map(actors),rigs:new Map(defences)};}
function move(source,s,x,y,z){s.x=x;s.y=y;s.z=z;source.root[12]=x-12;source.root[13]=y;source.root[14]=z-12;source.pose.invalidateRoot();source.pose.update();}

test('current articulated parts obstruct aircraft sweeps while a low ground animal permits overhead flight',()=>{
 const source=data([part('body',[[11,0,11],[12,2,12]])],{role:'scenery',y:24}),hare=state('hare',source,{kind:'ground',radius:3,height:3,hop:1.2,phase:'hop',speed:20,fleeSpeed:30,frightened:false});
 const obstacles=new DroneObstacles(world([['hare',source]]));obstacles.setWildlife([hare]);
 expect(obstacles.pointClear(60,25,60,1)).toBe(false);
 expect(obstacles.clearSegment(20,57,60,100,57,60,16.5)).toBe(true);
 expect(obstacles.clearSegment(20,57,60,100,57,60,16.5,.8)).toBe(true);
 expect(obstacles.clearSegment(20,25,60,100,25,60,1)).toBe(false);
 expect(obstacles.inspect().activeActors).toBe(1);obstacles.dispose();
});

test('a living airborne crossing is anticipated before contact and death removes it immediately',()=>{
 const source=data([part('body',[[11,0,11],[12,2,12]])]),enemy=state('flyer',source),obstacles=new DroneObstacles(world([['flyer',source]]),[enemy]);
 move(source,enemy,60,40,62);obstacles.update(.1);
 expect(obstacles.pointClear(60,41,78,2)).toBe(true);
 expect(obstacles.pointClear(60,41,78,2,.8)).toBe(false);
 expect(obstacles.lastBlockedId).toBe('flyer');enemy.health.takeDamage(100);
 expect(obstacles.pointClear(60,41,62,2)).toBe(true);obstacles.update(.1);
 expect(obstacles.inspect().activeParts).toBe(0);enemy.health.reset();obstacles.reset();
 expect(obstacles.pointClear(60,41,62,2)).toBe(false);obstacles.dispose();
});

test('posed wings and leg chains enclose every transformed occupied cell, including root rotation',()=>{
 const source=data([part('body',[[11,6,11]]),part('wing',[[18,7,10],[21,7,11]],[14,7,11],'body'),part('leg',[[15,1,12],[15,4,12]],[15,6,12],'body'),part('foot',[[15,0,11],[16,0,12]],[15,1,12],'leg')]);
 const enemy=state('posed',source),obstacles=new DroneObstacles(world([['posed',source]]),[enemy]);
 for(let frame=0;frame<20;frame++){
  source.pose.setRotation('body',.15,frame*.17,-.12);source.pose.setRotation('wing',0,0,.9*Math.sin(frame));source.pose.setRotation('leg',frame*.07,0,0);source.pose.setRotation('foot',-.25,0,0);source.pose.update();obstacles.update(1/60);
  for(const p of source.parts){const m=source.instances.find(v=>v.part===p.id).matrix;for(const c of p.voxels){const x=c[0]+.5,y=c[1]+.5,z=c[2]+.5;expect(obstacles.pointClear(m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14],.05)).toBe(false);}}
 }
 obstacles.dispose();
});

test('route prediction includes an intervening corner and stops at exit instead of wrapping across the board',()=>{
 const path=new PathMotion([[0,0,0],[1,0,0],[1,0,1],[2,0,1]],0),source=data([part('body',[[11,0,11]])],{x:24,y:40,z:12}),enemy=state('routed',source,{path,distance:12,movement:{speed:48},velocityY:0}),obstacles=new DroneObstacles(world([['routed',source]]),[enemy]);
 expect(obstacles.pointClear(36,40.5,12,.2)).toBe(true);
 expect(obstacles.pointClear(36,40.5,12,.2,.6)).toBe(false);
 expect(obstacles.pointClear(48,40.5,36,.2,.6)).toBe(false);
 enemy.distance=70;move(source,enemy,58,40,36);obstacles.update(.1);
 expect(obstacles.pointClear(12,40.5,12,1)).toBe(true);expect(obstacles.pointClear(12,40.5,12,1,100)).toBe(false);
 expect(obstacles.predictionSeconds).toBe(DRONE_OBSTACLE_PREDICTION_SECONDS);obstacles.dispose();
});

test('preview wrap predicts a separate entrance region without a false teleport corridor',()=>{
 const path=new PathMotion(Array.from({length:11},(_,i)=>[i,0,0]),0),source=data([part('body',[[11,0,11]])],{x:250,y:40,z:12}),enemy=state('looping',source,{path,distance:238,movement:{speed:12},velocityY:0}),obstacles=new DroneObstacles(world([['looping',source]]),[enemy]);
 const entrance=obstacles.entrancePredicted,flags=obstacles.entranceActive;
 expect(obstacles.pointClear(12,40.5,12,1)).toBe(true);
 expect(obstacles.pointClear(12,40.5,12,1,.8)).toBe(false);expect(obstacles.pointClear(22,40.5,12,1,.8)).toBe(false);
 expect(obstacles.pointClear(252,40.5,12,1,.8)).toBe(false);
 expect(obstacles.pointClear(132,40.5,12,1,.8)).toBe(true);
 // A sufficiently short custom preview route can loop more than once inside
 // the horizon: the entrance region covers the complete route, still bounded.
 enemy.movement.speed=720;obstacles.update(.1);expect(obstacles.pointClear(132,40.5,12,1,.8)).toBe(false);
 enemy.movement.speed=12;enemy.distance=0;enemy.lap++;move(source,enemy,12,40,12);obstacles.update(.1);
 expect(obstacles.entrancePredicted).toBe(entrance);expect(obstacles.entranceActive).toBe(flags);expect(flags[0]).toBe(0);
 expect(obstacles.pointClear(132,40.5,12,1,.8)).toBe(true);expect(obstacles.pointClear(250,40.5,12,1,.8)).toBe(true);
 enemy.distance=238;move(source,enemy,250,40,12);obstacles.reset();enemy.health.takeDamage(100);
 expect(obstacles.pointClear(12,40.5,12,1,.8)).toBe(true);obstacles.dispose();expect(obstacles.entrancePredicted).toBeNull();expect(obstacles.entranceActive).toBeNull();
});

test('flying bird prediction covers its full wing envelope and the cubic flight peak',()=>{
 const source=data([part('body',[[11,0,11]])],{role:'scenery',x:20,y:24,z:60}),bird=state('bird',source,{kind:'bird',phase:'flying',radius:7,height:8,fromX:20,fromY:24,fromZ:60,destinationX:100,destinationY:24,destinationZ:60,ceiling:80,duration:1,flightTime:0,frightened:false}),obstacles=new DroneObstacles(world([['bird',source]]));
 obstacles.setWildlife([bird]);expect(obstacles.pointClear(60,66,60,1)).toBe(true);
 // Equal endpoint heights: peak is .75*ceiling+.25*endpoint = 66.
 expect(obstacles.pointClear(60,66,60,1,.8)).toBe(false);
 expect(obstacles.pointClear(100,27,66,1,.8)).toBe(false);
 bird.phase='perched';move(source,bird,100,24,60);obstacles.update(.1);
 expect(obstacles.pointClear(60,66,60,1,.8)).toBe(true);obstacles.dispose();
});

test('time-matched bird sweeps catch ascent crossings and allow escape after the bird has vacated the origin',()=>{
 const source=data([part('body',[[11,0,11]])],{role:'scenery',x:20,y:24,z:60}),bird=state('bird',source,{kind:'bird',phase:'flying',radius:7,height:8,fromX:20,fromY:24,fromZ:60,destinationX:100,destinationY:24,destinationZ:60,ceiling:80,duration:1,flightTime:0,frightened:false}),obstacles=new DroneObstacles(world([['bird',source]]));
 obstacles.setWildlife([bird]);const base=obstacles.baseEnvelope,timed=obstacles.timedBounds;
 // Endpoint-only certification misses this intermediate upward-path crossing.
 expect(obstacles.pointClear(60,108,60,1,1)).toBe(true);
 expect(obstacles.clearTimedSegment(60,57.6,60,60,74.4,60,1,.4,.6)).toBe(false);
 expect(obstacles.clearTimedSegment(60,57.6,60,60,74.4,60,1,.8,1)).toBe(true);
 // Full-window unions still contain the initial bird position; this later
 // escape interval correctly omits that already-vacated position.
 expect(obstacles.clearSegment(20,25,60,25,30,60,1,1)).toBe(false);
 expect(obstacles.clearTimedSegment(20,25,60,25,30,60,1,.6,.7)).toBe(true);
 // Fright may expire during a future interval. Both normal and boosted bird
 // phases remain covered, avoiding a falsely-clear space behind its forecast.
 bird.frightened=true;obstacles.update(.01);
 expect(obstacles.clearTimedSegment(60,66,60,60,66,60,1,.45,.5)).toBe(false);
 expect(obstacles.clearTimedSegment(80,60,60,80,60,60,1,.45,.5)).toBe(false);
 for(let i=0;i<100;i++)obstacles.clearTimedSegment(20,25,60,25,30,60,1,.6,.7);
 expect(obstacles.baseEnvelope).toBe(base);expect(obstacles.timedBounds).toBe(timed);obstacles.dispose();
});

test('time-matched route sweeps retain separate wrap regions and include intervening corners',()=>{
 const path=new PathMotion(Array.from({length:11},(_,i)=>[i,0,0]),0),source=data([part('body',[[11,0,11]])],{x:250,y:40,z:12}),enemy=state('enemy',source,{path,distance:238,movement:{speed:12},velocityY:0}),obstacles=new DroneObstacles(world([['enemy',source]]),[enemy]);
 expect(obstacles.clearTimedSegment(250,40.5,12,250,40.5,12,1,0,.1)).toBe(false);
 expect(obstacles.clearTimedSegment(250,40.5,12,250,40.5,12,1,.4,.5)).toBe(true);
 expect(obstacles.clearTimedSegment(16,40.5,12,16,40.5,12,1,.4,.5)).toBe(false);
 expect(obstacles.clearTimedSegment(132,40.5,12,132,40.5,12,1,.1,.2)).toBe(true);
 expect(obstacles.clearTimedSegment(12,40.5,12,12,40.5,12,1,.1,.2)).toBe(false);
 enemy.health.takeDamage(100);expect(obstacles.clearTimedSegment(12,40.5,12,12,40.5,12,1,.1,.2)).toBe(true);obstacles.dispose();
 const cornerPath=new PathMotion([[0,0,0],[1,0,0],[1,0,1],[2,0,1]],0),other=data([part('body',[[11,0,11]])],{x:24,y:40,z:12}),turning=state('turning',other,{path:cornerPath,distance:12,movement:{speed:48},velocityY:0}),turnObstacles=new DroneObstacles(world([['turning',other]]),[turning]);
 expect(turnObstacles.clearTimedSegment(36,40.5,12,36,40.5,12,.2,.2,.3)).toBe(false);
 expect(turnObstacles.clearTimedSegment(36,40.5,12,36,40.5,12,.2,.7,.9)).toBe(true);turnObstacles.dispose();
});

test('time-matched queries preserve neutral half-height and discard observed velocity on reset',()=>{
 const source=data([part('body',[[11,0,11]])],{y:40}),enemy=state('enemy',source),obstacles=new DroneObstacles(world([['enemy',source]]),[enemy]);
 expect(obstacles.clearTimedSegment(60,49,60,60,49,60,11,0,.1)).toBe(false);
 expect(obstacles.clearTimedSegment(60,49,60,60,49,60,11,0,.1,5)).toBe(true);
 move(source,enemy,62,40,60);obstacles.update(.1);
 expect(obstacles.clearTimedSegment(80,40.5,60,80,40.5,60,1,.8,1)).toBe(false);
 expect(obstacles.clearTimedSegment(62,40.5,60,62,40.5,60,1,.8,1)).toBe(true);
 obstacles.reset();expect(obstacles.clearTimedSegment(80,40.5,60,80,40.5,60,1,.8,1)).toBe(true);
 obstacles.dispose();expect(obstacles.clearTimedSegment(60,40,60,60,40,60)).toBe(true);expect(obstacles.baseEnvelope).toBeNull();expect(obstacles.observedVelocity).toBeNull();expect(obstacles.timedBounds).toBeNull();
});

test('explicit asymmetric queries reject real above/below contact while preserving cube defaults',()=>{
 const source=data([part('body',[[11,0,11]])],{y:40}),enemy=state('enemy',source),obstacles=new DroneObstacles(world([['enemy',source]]),[enemy]);
 expect(obstacles.pointClear(60,49,60,16.5)).toBe(false);
 expect(obstacles.pointClear(60,49,60,16.5,0,7,6)).toBe(true);
 expect(obstacles.clearSegment(60,49,60,60,49,60,16.5,0,9,6)).toBe(false);
 expect(obstacles.clearTimedSegment(60,30,60,60,30,60,16.5,0,.1,9,6)).toBe(true);
 expect(obstacles.clearTimedSegment(60,30,60,60,30,60,16.5,0,.1,9,12)).toBe(false);obstacles.dispose();
});

test('ground prediction respects supplied fixed-defence exclusions without hiding protruding or current contact',()=>{
 const source=data([part('body',[[11,0,11]])],{role:'scenery',x:20,y:24,z:60}),hare=state('hare',source,{kind:'ground',radius:1,height:3,hop:0,phase:'hop',speed:30,fleeSpeed:30,frightened:false}),pad=data([part('pad',[[1,0,1],[22,13,22]])],{role:'defence',model:'drone-defence',x:50,y:24,z:60}),obstacles=new DroneObstacles(world([['hare',source]],[['pad',pad]])),exclusions=new Float64Array([40,24,50,60,38,70]),inside=new Float64Array([43,25,58,47,27,62]),protruding=new Float64Array([35,25,58,45,27,62]);
 obstacles.setWildlife([hare]);expect(obstacles.clearBox(inside,1)).toBe(false);
 obstacles.setWildlife([hare],exclusions);expect(obstacles.groundExclusions).toBe(exclusions);expect(obstacles.clearBox(inside,1)).toBe(true);expect(obstacles.clearBox(protruding,1)).toBe(false);
 expect(obstacles.clearTimedSegment(45,28,60,45,50,60,2,0,1,2)).toBe(true);
 expect(obstacles.clearTimedSegment(39,28,60,39,50,60,2,0,1,2)).toBe(false);
 // A current overlap is still rejected even if a malformed/spawned actor has
 // entered a supposedly forbidden volume. The optimisation cannot hide it.
 move(source,hare,45,25,60);obstacles.update(.1);expect(obstacles.clearBox(inside,0)).toBe(false);expect(obstacles.clearBox(inside,1)).toBe(false);expect(obstacles.clearTimedSegment(45,26,60,45,26,60,1,0,.1)).toBe(false);
 expect(()=>obstacles.setWildlife([hare],new Float64Array(12))).toThrow('capacity');expect(()=>obstacles.setWildlife([hare],new Float64Array([0,0,0,1,NaN,1]))).toThrow('bounds');
 obstacles.dispose();expect(obstacles.groundExclusions).toBeNull();expect(Array.from(exclusions)).toEqual([40,24,50,60,38,70]);
});

test('source-derived Dog Y envelope contains legal extreme impact, brace, gait and recovery poses',async()=>{
 const dog=await Bun.file(new URL('../assets/models/dog.json',import.meta.url)).json(),level=newLevel('dog-envelope-contract');level.size=[16,10];level.path=Array.from({length:12},(_,i)=>[i+1,0,2]);
 const actors=[{id:'dog',model:'dog',variant:'base',distance:48}],scene=buildWorld(level,new Map([['dog',dog]]),{actors}),preview=new EnemyPreview(scene,()=>{},null,actors),s=preview.states[0],obstacles=new DroneObstacles(scene,preview.states),record=obstacles.records[0],cap=record.dogY;
 try{
  expect(cap).not.toBeNull();expect(cap.high).toBeCloseTo(9+10*Math.sin(8*Math.PI/180)+4+Math.sqrt(13.5),10);expect(cap.high).toBeLessThan(18.1);
  expect(cap.low).toBeCloseTo(9-10*Math.sin(8*Math.PI/180)-4-Math.sqrt(13.5),10);
  let poses=0,maxPitch=0,maxRoll=0,maxBrace=0,maxOffset=0;
  for(let phase=0;phase<8;phase++)for(let direction=0;direction<9;direction++){
   s.seed=48+phase*.6;preview.reset();const a=direction*Math.PI/4;preview.takeHit(s,.001,direction===8?0:60*Math.cos(a),direction===8?-80:0,direction===8?0:60*Math.sin(a));
   for(let frame=0;frame<120;frame++){
    preview.advance(1/60);obstacles.update(1/60);maxPitch=Math.max(maxPitch,Math.abs(s.impact.pitch));maxRoll=Math.max(maxRoll,Math.abs(s.impact.roll));maxBrace=Math.max(maxBrace,s.impact.brace);maxOffset=Math.max(maxOffset,Math.hypot(s.impact.offsetX,s.impact.offsetZ));if(frame%5)continue;
    let low=Infinity,high=-Infinity;
    for(const bone of s.rig.bones){const m=bone.instance.matrix;for(const cell of bone.part.voxels)for(let c=0;c<8;c++){const y=m[1]*(cell[0]+(c&1?1:0))+m[5]*(cell[1]+(c&2?1:0))+m[9]*(cell[2]+(c&4?1:0))+m[13];low=Math.min(low,y);high=Math.max(high,y);}}
    const nominal=s.groundHeight-s.gait.settings.crouch;expect(low).toBeGreaterThanOrEqual(nominal+cap.low+cap.bob-1e-5);expect(high).toBeLessThanOrEqual(nominal+cap.high+1e-5);
    expect(obstacles.baseEnvelope[1]).toBeLessThanOrEqual(low+1e-5);expect(obstacles.baseEnvelope[4]).toBeGreaterThanOrEqual(high-1e-5);poses++;
   }
  }
  expect(poses).toBe(1728);expect(maxPitch*180/Math.PI).toBeCloseTo(8,6);expect(maxRoll*180/Math.PI).toBeCloseTo(8,6);expect(maxBrace).toBeCloseTo(1,6);expect(maxOffset).toBeGreaterThan(2.9);
  // A configured model with a longer lower-part occupied reach must enlarge
  // the proof. Unknown additional parts disable the special cap completely.
  const altered=structuredClone(dog.variants.base.parts);altered.find(p=>p.id==='shin-fl').voxels.push([5,0,7,0]);const custom=data(altered,{model:'dog'}),customState=state('custom',custom,{gait:{settings:s.gait.settings},groundHeight:24}),customObstacles=new DroneObstacles(world([['custom',custom]]),[customState]);
  expect(customObstacles.records[0].dogY.high).toBeGreaterThan(cap.high);customObstacles.dispose();
  const unknown=data([...altered,part('unknown',[[12,30,12]])],{model:'dog'}),unknownState=state('unknown',unknown,{gait:{settings:s.gait.settings},groundHeight:24}),fallback=new DroneObstacles(world([['unknown',unknown]]),[unknownState]);expect(fallback.records[0].dogY).toBeNull();fallback.dispose();
 }finally{obstacles.dispose();preview.dispose();disposeWorld(scene);}
});

test('articulated defence prediction covers later yaw/pitch/recoil and excludes every drone part and pad',()=>{
 const turret=data([part('base',[[11,0,11]]),part('head',[[11,10,11]],[12,10,12],'base'),part('guns',[[11,10,2],[12,10,2]],[12,10,9],'head')],{role:'defence',model:'turret-study'}),drone=data([part('pad',[[11,0,11]]),part('drone',[[11,20,11]])],{role:'defence',model:'drone-defence',x:150});
 const obstacles=new DroneObstacles(world([],[['turret',turret],['drone',drone]])),point=new Float64Array(3);
 for(let i=0;i<20;i++){
  turret.pose.setRotation('head',0,i*Math.PI/10,0);turret.pose.setRotation('guns',Math.sin(i)*.6,0,0);turret.pose.setTranslation('guns',0,0,1.25);turret.pose.update();
  // Prediction remains conservative even before the next snapshot, covering
  // the other defence's later-in-frame articulation.
  const m=turret.instances[2].matrix;point[0]=m[0]*11.5+m[4]*10.5+m[8]*2.5+m[12];point[1]=m[1]*11.5+m[5]*10.5+m[9]*2.5+m[13];point[2]=m[2]*11.5+m[6]*10.5+m[10]*2.5+m[14];
  expect(obstacles.pointClear(point[0],point[1],point[2],.1,.8)).toBe(false);expect(obstacles.pointClear(point[0],point[1],point[2],.1)).toBe(false);obstacles.update(1/60);expect(obstacles.pointClear(point[0],point[1],point[2],.1)).toBe(false);
 }
 expect(obstacles.pointClear(150,40.5,60,1)).toBe(true);expect(obstacles.inspect().actors).toBe(1);obstacles.dispose();
});

test('launcher wells reserve seated round tips while launched missile actor matrices are excluded',()=>{
 const launcher=data([part('body',[[11,0,11],[12,13,12]])],{role:'defence',model:'missile-launcher',y:24});launcher.variant='base';
 const missile=data([part('body',[[11,0,11],[12,9,12]])],{model:'guided-missile',x:120,y:80,z:120});
 const obstacles=new DroneObstacles(world([['missile',missile]],[['launcher',launcher]]));
 expect(obstacles.pointClear(55,40.5,60,.5)).toBe(false);expect(obstacles.pointClear(120,85,120,2)).toBe(true);
 expect(obstacles.inspect().actors).toBe(1);obstacles.dispose();
});

test('reset and lap discontinuity discard old velocity, storage is reused, and teardown releases source references',()=>{
 const source=data([part('body',[[11,0,11]])]),enemy=state('enemy',source),obstacles=new DroneObstacles(world([['enemy',source]]),[enemy]);
 const current=obstacles.current,predicted=obstacles.predicted,locals=obstacles.localBounds,matrices=obstacles.matrices;
 move(source,enemy,62,40,60);obstacles.update(.1);expect(obstacles.pointClear(80,40.5,60,1,.8)).toBe(false);
 move(source,enemy,20,40,60);enemy.lap++;obstacles.update(.1);expect(obstacles.pointClear(0,40.5,60,1,.8)).toBe(true);
 move(source,enemy,60,40,60);obstacles.reset();expect(obstacles.pointClear(80,40.5,60,1,.8)).toBe(true);
 for(let i=0;i<100;i++){obstacles.update(1/60);obstacles.segmentClear(1,100,1,200,100,200,16.5,.8);}
 expect(obstacles.current).toBe(current);expect(obstacles.predicted).toBe(predicted);expect(obstacles.localBounds).toBe(locals);expect(obstacles.matrices).toBe(matrices);
 expect(()=>obstacles.setWildlife([{id:'not-loaded'}])).toThrow('capacity');expect(()=>obstacles.update(-1)).toThrow('delta');
 obstacles.dispose();obstacles.dispose();obstacles.reset();expect(obstacles.inspect().bytes).toBe(0);expect(obstacles.records).toEqual([]);expect(matrices).toEqual([]);expect(obstacles.current).toBeNull();expect(obstacles.pointClear(60,40,60)).toBe(true);
});

test('curved route predictions include the intervening extremum between opposing bends',()=>{
 const path=new FlightPathMotion([[1,0,1],[2,0,1],[2,0,2],[1,0,2]]),p=new Float64Array(3);path.sample(24,p);
 const source=data([part('body',[[12,0,12]])],{x:p[0],y:40,z:p[1]}),enemy=state('curved',source,{path,distance:24,movement:{speed:24},velocityY:0}),obstacles=new DroneObstacles(world([['curved',source]]),[enemy]);
 try{
  expect(obstacles.pointClear(60.5,40.5,48.5,.1)).toBe(true);
  expect(obstacles.pointClear(60.5,40.5,48.5,.1,1)).toBe(false);
  expect(obstacles.clearTimedSegment(60.5,40.5,48.5,60.5,40.5,48.5,.1,.4,.6)).toBe(false);
 }finally{obstacles.dispose();}
});

test('actual A1 enemy and wildlife poses remain enclosed throughout moving flight, turns and hops',async()=>{
 const level=await Bun.file(new URL('../assets/levels/moss-01.json',import.meta.url)).json(),actors=actorsForPreview(level),models=new Map();
 for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(p=>p.model)]))models.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 const scene=buildWorld(level,models,{actors}),enemies=new EnemyPreview(scene,()=>{}),wildlife=new WildlifePreview(scene,()=>{}),obstacles=new DroneObstacles(scene,enemies.states);obstacles.setWildlife(wildlife.states,wildlife.defences);
 try{
  expect(obstacles.inspect().actors).toBe(enemies.states.length+wildlife.states.length);
  for(let frame=0;frame<600;frame++){
   enemies.advance(1/30);wildlife.advance(1/30);obstacles.update(1/30);
   if(frame%10)continue;
   for(const record of obstacles.records){const source=scene.actors.get(record.id);for(const instance of source.instances){const p=source.parts.find(p=>p.id===instance.part),cell=p.voxels[0],m=instance.matrix,x=cell[0]+.5,y=cell[1]+.5,z=cell[2]+.5;expect(obstacles.pointClear(m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14],.01)).toBe(false);}}
  }
  expect(obstacles.inspect().bytes).toBeGreaterThan(0);
 }finally{obstacles.dispose();wildlife.dispose();enemies.dispose();disposeWorld(scene);}
});

