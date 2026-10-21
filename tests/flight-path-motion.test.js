import {test,expect} from 'bun:test';
import {FlightPathMotion,FLIGHT_CORNER_OFFSET} from '../engine/flight-path-motion.js';
import {PathMotion,shortestAngle} from '../engine/path-motion.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {ENEMY_EXPANSION_RIGS} from '../shared/enemy-expansion-rigs.js';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {PlayEngine} from '../play/engine.js';
import {waveActors} from '../play/enemies.js';
import {PLAY_CONFIG,validatePlayConfig} from '../play/config.js';

const flyers=['moth','twin-fan','ray','lantern'],models=new Map(await Promise.all([...flyers,'tripod'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
const route=[[1,0,2],[2,0,2],[3,0,2],[3,0,3],[3,0,4],[4,0,4],[5,0,4]];
function fixture(){
 const level=newLevel('flying-turns');level.size=[8,8];level.path=route;
 const actors=[...flyers,'tripod'].map(model=>({id:model,model,variant:'base',distance:0})),world=buildWorld(level,models,{actors}),preview=new EnemyPreview(world,()=>{},null,actors);
 return {world,preview,dispose(){preview.dispose();disposeWorld(world);}};
}

test('flight curves preserve endpoints and authored timing, with continuous actual tangents through both turn directions',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const path=route.map(([x,y,z])=>rotation===0?[x,y,z]:rotation===1?[-z,y,x]:rotation===2?[-x,y,-z]:[z,y,-x]);
  const flight=new FlightPathMotion(path),ground=new PathMotion(path,12),p=new Float64Array(5),a=new Float64Array(5),b=new Float64Array(5),turn=new Float64Array(2),h=.0001;
  expect(flight.length).toBe(ground.length);
  for(const distance of [0,flight.length]){flight.sample(distance,p);ground.sample(distance,a);expect([...p]).toEqual([...a]);}
  for(let d=1;d<flight.length;d+=.25){
   flight.sample(d,p);flight.sample(d-h,a);flight.sample(d+h,b);flight.turn(d,1,turn);
   expect((b[0]-a[0])/(2*h)).toBeCloseTo(p[3],7);expect((b[1]-a[1])/(2*h)).toBeCloseTo(p[4],7);
   expect(shortestAngle(b[2]-a[2])/(2*h)).toBeCloseTo(turn[0],7);
   const speed=Math.hypot(p[3],p[4]);expect(speed).toBeGreaterThanOrEqual(Math.SQRT1_2-1e-10);expect(speed).toBeLessThanOrEqual(1+1e-10);
   let clearance=Infinity;
   for(let i=0;i<ground.heading.length;i++){
    const x=Math.max(Math.min(ground.x[i],ground.x[i+1]),Math.min(Math.max(ground.x[i],ground.x[i+1]),p[0]));
    const z=Math.max(Math.min(ground.z[i],ground.z[i+1]),Math.min(Math.max(ground.z[i],ground.z[i+1]),p[1]));
    clearance=Math.min(clearance,Math.hypot(p[0]-x,p[1]-z));
   }
   expect(clearance).toBeLessThanOrEqual(FLIGHT_CORNER_OFFSET+1e-8);
  }
  for(const d of [36,48,60,84,96,108]){
   flight.sample(d-h,a);flight.sample(d+h,b);expect(Math.hypot(b[0]-a[0],b[1]-a[1])).toBeLessThan(2.01*h);
   expect(Math.abs(shortestAngle(b[2]-a[2]))).toBeLessThan(.001);
  }
 }
});

test('flight bounds include extrema between consecutive opposing bends',()=>{
 const path=new FlightPathMotion([[1,0,1],[2,0,1],[2,0,2],[1,0,2]]),bounds=new Float64Array(4),p=new Float64Array(5),a=new Float64Array(3),b=new Float64Array(3);
 path.sample(24,a);path.sample(48,b);path.bounds(24,48,bounds);
 expect(bounds[2]).toBeGreaterThan(Math.max(a[0],b[0])+1);expect(bounds[2]).toBe(60);
 for(let lo=0;lo<path.length;lo+=3.5)for(const width of [1,12,25,100]){
  const hi=Math.min(path.length,lo+width);path.bounds(lo,hi,bounds);
  for(let t=0;t<=40;t++){path.sample(lo+(hi-lo)*t/40,p);expect(p[0]).toBeGreaterThanOrEqual(bounds[0]-1e-9);expect(p[1]).toBeGreaterThanOrEqual(bounds[1]-1e-9);expect(p[0]).toBeLessThanOrEqual(bounds[2]+1e-9);expect(p[1]).toBeLessThanOrEqual(bounds[3]+1e-9);}
 }
});

test('all four rendered flyers bank into turns and their analytic root/torso velocities follow the curve',()=>{
 const f=fixture();try{
  const ground=f.preview.states.find(s=>s.model==='tripod');expect(ground.path instanceof FlightPathMotion).toBe(false);
  const h=.001;
  for(const s of f.preview.states.filter(s=>s.airborne)){
   expect(s.path instanceof FlightPathMotion).toBe(true);expect(s.path).not.toBe(ground.path);
   for(const d of [36,39,42,48,54,57,60,84,90,96,102,108]){
    s.seed=d;f.preview.reset();
    const body=s.rig.byId.get('body'),roll=s.gait.bodyRoll,velocity=[s.velocityX,s.velocityZ],aimVelocity=[s.aimVelocityX,s.aimVelocityY,s.aimVelocityZ],limit=ENEMY_EXPANSION_RIGS[s.model].maxBankDegrees*Math.PI/180;
    expect(body.rotation[2]).toBe(roll);expect(Math.abs(roll)).toBeLessThanOrEqual(limit);
    if(d===48)expect(roll).toBeLessThan(-limit*.9);if(d===96)expect(roll).toBeGreaterThan(limit*.9);
    s.seed=d-h*s.movement.speed;f.preview.reset();const before=[s.x,s.z,s.aimX,s.aimY,s.aimZ];
    s.seed=d+h*s.movement.speed;f.preview.reset();const after=[s.x,s.z,s.aimX,s.aimY,s.aimZ];
    for(let i=0;i<2;i++)expect((after[i]-before[i])/(2*h)).toBeCloseTo(velocity[i],3);
    for(let i=0;i<3;i++)expect(Math.abs((after[i+2]-before[i+2])/(2*h)-aimVelocity[i])).toBeLessThan(.025);
   }
  }
 }finally{f.dispose();}
});

test('finite curved flight reaches the same exit at the authored time',()=>{
 const config=structuredClone(PLAY_CONFIG),wave=config.levels[1].waves[0];wave.spawns=[{id:'finite-flyer',model:'moth',at:0,routeId:'main'}];wave.enemyOverrides={moth:{maxHealth:100,speed:20}};validatePlayConfig(config);
 const level=newLevel('finite-flight');level.size=[8,8];level.path=route;
 const world=buildWorld(level,models,{actors:waveActors(wave)}),engine=new PlayEngine(world,{config,wave});
 try{
  engine.startWave();const s=engine.enemies.states[0],seconds=s.path.length/s.movement.speed;
  for(let i=0;i<Math.floor((seconds-.01)*120);i++)engine.advance(1/120);
  expect(engine.completed).toBe(false);engine.advance(.02);expect(engine.completed).toBe(true);expect(engine.enemies.escaped).toBe(1);expect(engine.waveTime).toBeCloseTo(seconds,8);
 }finally{engine.dispose();disposeWorld(world);}
});
