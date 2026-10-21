import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {PlayEnemies,waveActors} from '../play/enemies.js';
import {PLAY_CONFIG} from '../play/config.js';

const species=Object.keys(PLAY_CONFIG.enemies),models=new Map(await Promise.all(species.map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
function fixture(fraction=1){
 const level=newLevel('ordinary-health-motion');level.size=[18,10];level.path=[...Array.from({length:7},(_,x)=>[x,0,6]),...Array.from({length:4},(_,i)=>[6,0,5-i]),...Array.from({length:11},(_,i)=>[7+i,0,2])];
 const wave={spawns:species.map((model,i)=>({id:'ordinary-'+i,model,at:0,routeId:'main'}))},world=buildWorld(level,models,{actors:waveActors(wave)}),enemies=new PlayEnemies(world,{config:PLAY_CONFIG,wave});
 enemies.prepare();enemies.spawnDue(0);
 for(const state of enemies.states)if(fraction<1)enemies.takeHit(state,state.health.maximum*(1-fraction));
 return {world,enemies,dispose(){enemies.dispose();disposeWorld(world);}};
}
function trace(enemies){
 return enemies.states.map(s=>({model:s.model,distance:s.distance,time:s.time,x:s.x,y:s.y,z:s.z,yaw:s.yaw,velocity:[s.velocityX,s.velocityY,s.velocityZ],aim:[s.aimX,s.aimY,s.aimZ,s.aimVelocityX,s.aimVelocityY,s.aimVelocityZ],parts:s.rig.bones.map(b=>[...b.instance.matrix])}));
}

test('all ten species retain identical ordinary route, aim and articulated poses at full, half and 10% health',()=>{
 const fixtures=[1,.5,.1].map(fraction=>fixture(fraction));
 try{
  const initialForecasts=fixtures[0].enemies.states.map(s=>s.routeForecastEligible);
  for(let frame=0;frame<1920;frame++){
   for(const f of fixtures)f.enemies.advance(1/120);
   if(frame%60===59){const healthy=trace(fixtures[0].enemies);expect(trace(fixtures[1].enemies)).toEqual(healthy);expect(trace(fixtures[2].enemies)).toEqual(healthy);}
  }
  for(const f of fixtures)for(let i=0;i<species.length;i++){
   const state=f.enemies.states[i];expect(state.distance).toBeCloseTo(16*PLAY_CONFIG.enemies[state.model].speed,7);expect(state.health.alive).toBe(true);expect(state.routeForecastEligible).toBe(initialForecasts[i]);
  }
 }finally{for(const f of fixtures)f.dispose();}
});

test('health alone never creates a queue delay and preexisting physical missile-hit recovery remains active',()=>{
 const f=fixture();try{
  const e=f.enemies,[dog,roller]=e.states;dog.distance=60;roller.distance=54;e.preview.pose();e.takeHit(dog,dog.health.maximum*.5);e.takeHit(roller,roller.health.maximum*.9);
  e.advance(2);expect(dog.distance).toBeCloseTo(84,8);expect(roller.distance).toBeCloseTo(78,8);expect(dog.distance-roller.distance).toBeCloseTo(6,8);
  const before=dog.distance,maximum=dog.health.maximum;e.takeHit(dog,1,80,0,0);expect(dog.impact.active).toBe(true);expect(dog.health.current).toBeCloseTo(maximum*.5-1,8);
  e.advance(.1);expect(dog.distance-before).toBeCloseTo(dog.movement.speed*.1,8);expect(dog.impact.active).toBe(true);expect([dog.aimVelocityX,dog.aimVelocityY,dog.aimVelocityZ].every(Number.isFinite)).toBe(true);
 }finally{f.dispose();}
});
