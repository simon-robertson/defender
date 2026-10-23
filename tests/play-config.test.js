import {test,expect} from 'bun:test';
import {PLAY_CONFIG,createPlayConfig,validatePlayConfig,playCapacity,PLAY_MODEL_LIGHTS} from '../play/config.js';
import {DEFENCE_STATS} from '../shared/defence.js';
import {TURRET_FIRING} from '../shared/arsenal.js';
import {MISSILE_FIRING} from '../shared/missile-flight.js';
import {ENEMY_STATS} from '../shared/enemy.js';

const copy=()=>structuredClone(PLAY_CONFIG);
test('The campaign retains Zone A and adds forty-eight finite later encounters',()=>{
 expect(validatePlayConfig(PLAY_CONFIG)).toBe(PLAY_CONFIG);
 expect([PLAY_CONFIG.startTokens,PLAY_CONFIG.waveReward,PLAY_CONFIG.missLimit,PLAY_CONFIG.waveSettleSeconds]).toEqual([2,2,10,4]);
 expect(PLAY_CONFIG.levels.slice(0,4).map(level=>[level.id,level.waves.length])).toEqual([['moss-01',4],['moss-02',4],['moss-03',4],['moss-04',4]]);
 expect(PLAY_CONFIG.levels.map(level=>level.zone)).toEqual(['A','A','A','A','B','B','B','B','C','C','C','C','D','D','D','D']);
 expect(PLAY_CONFIG.levels.every(level=>level.waves.length===4)).toBe(true);
 const waves=PLAY_CONFIG.levels.flatMap(level=>level.waves);expect(waves).toHaveLength(64);
 expect(waves.every(wave=>wave.name&&wave.description&&wave.spawns.length<=32)).toBe(true);
 expect(new Set(waves.flatMap(wave=>wave.spawns.map(spawn=>spawn.model)))).toEqual(new Set(['dog','roller','moth','walker','dune-tread','twin-fan','tripod','ray','spider','lantern']));
 expect(PLAY_CONFIG.levels[0].waves[0].spawns.every(spawn=>spawn.model==='dog')).toBe(true);
 expect(PLAY_CONFIG.levels[0].waves[2].spawns.some(spawn=>spawn.model==='roller')).toBe(true);
 expect(PLAY_CONFIG.levels[1].waves[0].spawns.some(spawn=>spawn.model==='moth')).toBe(true);
 expect(PLAY_CONFIG.levels[2].waves.every(wave=>new Set(wave.spawns.map(spawn=>spawn.routeId)).size===2)).toBe(true);
 for(const level of PLAY_CONFIG.levels)for(const wave of level.waves)expect(wave.spawns.map(spawn=>spawn.at)).toEqual(wave.spawns.map(spawn=>spawn.at).toSorted((a,b)=>a-b));
});
test('all sixteen multi-entrance encounters open both ground fronts together and align matching flight groups',()=>{
 const airborne=new Set(['moth','twin-fan','ray','lantern']),multi=PLAY_CONFIG.levels.filter(level=>new Set(level.waves[0].spawns.map(spawn=>spawn.routeId)).size>1);
 expect(multi.map(level=>level.id)).toEqual(['moss-03','ochre-03','ochre-04','ice-03']);
 const schedules={
  'moss-03':{branch:'eastern',groundGap:8,ground:[[3,3],[4,4],[4,4],[5,5]],air:[[2,2,2,5],[0,4,5,4],[3,3,3,4],[2,2,2,5]]},
  'ochre-03':{branch:'eastern',groundGap:10,ground:[[5,5],[6,6],[6,6],[6,6]],air:[[4,0,3,6],[0,5,6,6],[4,4,2,6],[4,4,2,6]]},
  'ochre-04':{branch:'lake',groundGap:8,ground:[[6,5],[6,6],[6,6],[7,6]],air:[[3,2,5,6],[3,3,6,6],[4,4,3,6],[4,3,5,6]]},
  'ice-03':{branch:'northern',groundGap:8,ground:[[4,4],[5,5],[5,4],[6,5]],air:[[3,3,2,6],[4,3,2,6],[5,5,2,6],[6,5,2,6]]},
 };
 for(const level of multi){
  const schedule=schedules[level.id];
  for(const [index,wave]of level.waves.entries()){
   const [mainAir,branchAir,airStart,airGap]=schedule.air[index];
   for(const [routeIndex,routeId]of ['main',schedule.branch].entries()){
    const ground=wave.spawns.filter(spawn=>spawn.routeId===routeId&&!airborne.has(spawn.model)),air=wave.spawns.filter(spawn=>spawn.routeId===routeId&&airborne.has(spawn.model));
    expect(ground.map(spawn=>spawn.at)).toEqual(Array.from({length:schedule.ground[index][routeIndex]},(_,i)=>i*schedule.groundGap));
    expect(air.map(spawn=>spawn.at)).toEqual(Array.from({length:routeIndex?branchAir:mainAir},(_,i)=>airStart+i*airGap));
   }
   expect(wave.spawns).toEqual([...wave.spawns].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)));
  }
 }
});
test('family and tier introductions are bounded global encounter numbers',()=>{
 const gun=PLAY_CONFIG.defences['turret-study'],arc=PLAY_CONFIG.defences['arc-spire'],missile=PLAY_CONFIG.defences['missile-launcher'];
 expect([gun.purchaseCost,gun.upgradeCost,arc.purchaseCost,arc.upgradeCost,missile.purchaseCost,missile.upgradeCost]).toEqual([1,1,2,2,3,3]);
 expect([gun.availableFromWave,gun.variants.upgrade2.availableFromWave,arc.availableFromWave,arc.variants.upgrade2.availableFromWave,missile.availableFromWave,missile.variants.upgrade2.availableFromWave]).toEqual([1,5,5,9,9,13]);
 for(const change of [c=>c.defences['arc-spire'].availableFromWave=0,c=>c.defences['arc-spire'].variants.base.availableFromWave=4,c=>c.defences['turret-study'].variants.upgrade2.availableFromWave=65,c=>c.defences['missile-launcher'].variants.upgrade2.availableFromWave=8]){const config=copy();change(config);expect(()=>validatePlayConfig(config)).toThrow();}
});
test('play profiles are immutable and leave all shared preview tuning untouched',()=>{
 const gun=PLAY_CONFIG.defences['turret-study'];expect(gun.variants.base.stats).toEqual(DEFENCE_STATS['turret-study'].base);expect(gun.variants.base.stats).not.toBe(DEFENCE_STATS['turret-study'].base);
 expect(gun.variants.upgrade1.firing).toEqual(TURRET_FIRING.upgrade1);expect(DEFENCE_STATS['turret-study'].upgrade2.strength).toBe(0);expect(TURRET_FIRING.upgrade2).toBeNull();
 expect(PLAY_CONFIG.defences['missile-launcher'].variants.upgrade1.firing).toEqual(MISSILE_FIRING.upgrade1);
 expect(PLAY_CONFIG.enemies.moth.altitude).toBe(44);expect(ENEMY_STATS.dog.maxHealth).toBe(300);expect(ENEMY_STATS.roller.maxHealth).toBe(360);
 const tuned=createPlayConfig({enemies:{dog:{maxHealth:95}},defences:{'turret-study':{variants:{base:{stats:{strength:14}}}}}});
 expect(tuned.enemies.dog.maxHealth).toBe(95);expect(PLAY_CONFIG.enemies.dog.maxHealth).toBe(100);expect(tuned.defences['turret-study'].variants.base.stats.strength).toBe(14);expect(DEFENCE_STATS['turret-study'].base.strength).toBe(10);
 expect(Object.isFrozen(gun.variants.upgrade1.firing)).toBe(true);expect(Object.isFrozen(PLAY_CONFIG.levels[0].waves[0].spawns[0])).toBe(true);
});
test('capacity budgets every affordable family and species without adding disjoint wave peaks',()=>{
 const capacity=playCapacity(PLAY_CONFIG);expect(capacity.maxOwnedUnits).toBe(128);expect(capacity.maxWaveEnemies).toBe(26);
 expect(capacity.maxOwnedByFamily).toEqual({'turret-study':128,'arc-spire':64,'missile-launcher':42,'power-generator':32,'drone-defence':4});expect(capacity.maxWaveEnemiesBySpecies).toEqual({dog:6,roller:6,moth:6,walker:6,'dune-tread':7,'twin-fan':8,tripod:11,ray:11,spider:14,lantern:12});expect(capacity.pooledEnemyCount).toBe(87);expect(capacity.modelLights).toBe(434);
 const final=PLAY_CONFIG.levels[15].waves[3];expect(final.spawns.reduce((sum,spawn)=>sum+PLAY_MODEL_LIGHTS[spawn.model],0)+124*3+4*9).toBe(434);
 expect(()=>createPlayConfig({startTokens:3})).toThrow('capacity');expect(()=>createPlayConfig({waveReward:3})).toThrow('capacity');expect(()=>createPlayConfig({startTokens:1000})).toThrow('capacity');
 expect(playCapacity(createPlayConfig({waveReward:1})).maxOwnedUnits).toBe(65);
});
test('resolved firing profiles preserve actual family delivery and finite cadence',()=>{
 for(const change of [c=>c.defences['turret-study'].variants.base.stats.strength=0,c=>c.defences['arc-spire'].variants.base.stats.requiresLineOfSight=false,c=>c.defences['missile-launcher'].variants.base.stats.requiresLineOfSight=true,c=>c.defences['turret-study'].variants.base.firing.cooldownSeconds=.001,c=>c.defences['turret-study'].variants.upgrade1.firing.shotIntervalSeconds=.001,c=>c.defences['missile-launcher'].variants.base.firing.gap=.8,c=>c.defences['missile-launcher'].variants.base.firing.magazine=3,c=>c.defences['missile-launcher'].variants.base.firing.cycle.projectile=null]){const config=copy();change(config);expect(()=>validatePlayConfig(config)).toThrow('Invalid play configuration');}
 for(const enabledVariants of [[],['upgrade1'],['base','upgrade2'],['base','upgrade1','upgrade1']])expect(()=>createPlayConfig({defences:{'turret-study':{enabledVariants}}})).toThrow();
 expect(createPlayConfig({defences:{'turret-study':{enabledVariants:['base']}}}).defences['turret-study'].enabledVariants).toEqual(['base']);
});
test('bad schedules, unknown routes and invalid species override fields fail before scene creation',()=>{
 for(const overrides of [{startTokens:-1},{waveReward:1.2},{missLimit:0},{enemies:{dog:{speed:16}}},{enemies:{roller:{speed:17}}},{enemies:{moth:{speed:25}}},{enemies:{moth:{maxHealth:0}}},{enemies:{moth:{altitude:35}}},{enemies:{moth:{altitude:61}}},{enemies:{dog:{altitude:44}}},{defences:{'turret-study':{purchaseCost:0}}}])expect(()=>createPlayConfig(overrides)).toThrow('Invalid play configuration');
 for(const change of [c=>c.levels.pop(),c=>c.levels[0].waves.pop(),c=>c.levels[0].waves[0].spawns[0].at=NaN,c=>c.levels[0].waves[0].spawns[1].at=-1,c=>c.levels[0].waves[0].spawns[1].id=c.levels[0].waves[0].spawns[0].id,c=>c.levels[0].waves[0].spawns[0].model='concertina',c=>c.levels[0].waves[0].spawns[0].routeId='eastern']){const config=copy();change(config);expect(()=>validatePlayConfig(config)).toThrow('Invalid play configuration');}
 for(const enemyOverrides of [null,[],{},{dog:{}},{dog:null},{dog:[]},{dog:{missValue:2}},{dog:{strength:5}},{dog:{maxHealth:0}},{dog:{maxHealth:Infinity}},{dog:{speed:0}},{dog:{speed:16}},{moth:{speed:25}},{concertina:{maxHealth:100}}]){const config=copy();config.levels[0].waves[0].enemyOverrides=enemyOverrides;expect(()=>validatePlayConfig(config)).toThrow('Invalid play configuration');}
 for(const rule of [{maxHealth:1},{speed:15}]){const config=copy();config.levels[0].waves[0].enemyOverrides={dog:rule};expect(validatePlayConfig(config)).toBe(config);}
});
test('settling time stays tunable independently of combat tuning',()=>{
 for(const seconds of [0,2.5,4,30])expect(createPlayConfig({waveSettleSeconds:seconds}).waveSettleSeconds).toBe(seconds);
 for(const seconds of [-1,NaN,Infinity,31])expect(()=>createPlayConfig({waveSettleSeconds:seconds})).toThrow();
});

test('later encounters use only their existing zone species, real branches and stable level profiles',()=>{
 const species={A:['dog','roller','moth'],B:['walker','dune-tread','twin-fan'],C:['tripod','ray'],D:['spider','lantern']};
 for(const level of PLAY_CONFIG.levels){
  const profiles=level.waves.map(wave=>wave.enemyOverrides);for(const profile of profiles)expect(profile).toEqual(profiles[0]);
  for(const wave of level.waves)for(const spawn of wave.spawns)expect(species[level.zone]).toContain(spawn.model);
 }
 expect(PLAY_CONFIG.levels[6].waves.every(w=>w.spawns.some(s=>s.routeId==='eastern'))).toBe(true);
 expect(PLAY_CONFIG.levels[10].waves.every(w=>w.spawns.some(s=>s.routeId==='northern'))).toBe(true);
 for(const model of ['moth','twin-fan','ray','lantern'])expect(PLAY_CONFIG.enemies[model].altitude).toBe(44);
 // Current A-only configuration includes four affordable Drone pads.
 const prefix=createPlayConfig({levels:PLAY_CONFIG.levels.slice(0,4)});expect(playCapacity(prefix).maxOwnedUnits).toBe(32);expect(playCapacity(prefix).modelLights).toBe(152);
});


test('Power generator is a costly single-version enhancer with no weapon or upgrade profile',()=>{
 const family=PLAY_CONFIG.defences['power-generator'];
 expect(family).toEqual({kind:'enhancer',purchaseCost:4,upgradeCost:null,availableFromWave:1,enabledVariants:['base'],variants:{base:{stats:{strengthIncrease:.25,fireRateIncrease:0,cooldownDecrease:0},firing:null}}});
 expect(family.purchaseCost).toBeGreaterThan(PLAY_CONFIG.defences['missile-launcher'].purchaseCost);expect(PLAY_MODEL_LIGHTS['power-generator']).toBe(4);
 expect(Object.isFrozen(family.variants.base.stats)).toBe(true);
 for(const change of [
  f=>f.kind='defence',f=>delete f.kind,f=>f.upgradeCost=4,f=>f.enabledVariants.push('upgrade1'),f=>f.variants.upgrade1=structuredClone(f.variants.base),
  f=>f.variants.base.firing={},f=>f.variants.base.stats.strength=10,f=>f.variants.base.stats.maxRange=48,
  f=>f.variants.base.stats.strengthIncrease=.5,f=>f.variants.base.stats.fireRateIncrease=.1,f=>f.variants.base.stats.cooldownDecrease=.1,
 ]){const config=copy();change(config.defences['power-generator']);expect(()=>validatePlayConfig(config)).toThrow('Invalid play configuration');}
});
