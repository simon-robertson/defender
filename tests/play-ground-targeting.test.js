import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {createPlayConfig,PLAY_CONFIG} from '../play/config.js';
import {PlayEngine,PLAY_TICK} from '../play/engine.js';
import {waveActors} from '../play/enemies.js';

const models=new Map(await Promise.all(['dog','moth','turret-study'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));

function fixture(variant){
 const levels=structuredClone(PLAY_CONFIG.levels),wave=levels[0].waves[0];
 wave.spawns=[{id:'air',model:'moth',routeId:'main',at:0},{id:'ground',model:'dog',routeId:'main',at:1.8},{id:'future-ground',model:'dog',routeId:'main',at:10}];
 wave.enemyOverrides={dog:{maxHealth:10000,speed:12},moth:{maxHealth:10000,speed:12}};
 const config=createPlayConfig({levels,defences:{'turret-study':{variants:{[variant]:{stats:{maxRange:300}}}}}}),configured=config.levels[0].waves[0];
 const level=newLevel('ground-priority-test');level.size=[16,7];level.path=Array.from({length:16},(_,x)=>[x,0,5]);
 level.placements=[{id:'gun',model:'turret-study',variant,box:[4,0,0],turn:0}];
 const world=buildWorld(level,models,{actors:waveActors(configured)});world.playCritters=false;
 const engine=new PlayEngine(world,{config,wave:configured});
 return {engine,dispose(){engine.dispose();disposeWorld(world);}};
}

test('real PlayEngine gun tiers yield to ground spawns and resume air after active-list compaction',()=>{
 for(const variant of ['base','upgrade1','upgrade2']){
  const f=fixture(variant),engine=f.engine;
  try{
   engine.startWave();const [air,ground,future]=engine.enemies.states,gun=engine.firing.turrets.states[0];
   for(let i=0;i<200;i++)engine.advance(PLAY_TICK);
   expect(ground.phase).toBe('scheduled');expect(future.phase).toBe('scheduled');expect(gun.lastShotTargetId).toBe(air.id);expect(air.health.hits).toBeGreaterThan(0);
   for(let i=0;i<280;i++){
    const airHits=air.health.hits;engine.advance(PLAY_TICK);
    if(ground.phase==='active'){
     expect(gun.target?.airborne??false).toBe(false);expect(air.health.hits).toBe(airHits);expect(gun.groundInRange).toBe(true);
    }
   }
   expect(ground.health.hits).toBeGreaterThan(0);expect(gun.lastShotTargetId).toBe(ground.id);
   const before=air.health.hits;expect(engine.enemies.takeHit(ground,10000)).toBeGreaterThan(0);expect(engine.enemies.activeTargets).toEqual([air]);
   for(let i=0;i<240;i++)engine.advance(PLAY_TICK);
   expect(gun.groundInRange).toBe(false);expect(gun.target).toBe(air);expect(air.health.hits).toBeGreaterThan(before);expect(future.phase).toBe('scheduled');
   engine.stopWave();engine.startWave();expect(engine.firing.turrets.states[0].cycle.remaining).toBe(0);
   expect(engine.firing.turrets.states[0].groundInRange).toBe(false);expect(engine.enemies.activeTargets).toEqual([air]);
  }finally{f.dispose();}
 }
});
