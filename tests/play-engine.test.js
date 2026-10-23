import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {createPlayConfig,PLAY_CONFIG,playCapacity,validatePlayConfig} from '../play/config.js';
import {PlayEngine,PLAY_TICK,PLAY_MAX_STEPS,loadPlayWorld,disposePlayWorld,composePlayLevel} from '../play/engine.js';
import {waveActors} from '../play/enemies.js';
import {ENEMY_STATS} from '../shared/enemy.js';
import {DEFENCE_STATS} from '../shared/defence.js';
import {TURRET_FIRING} from '../shared/arsenal.js';
import {ModelLights} from '../engine/model-lights.js';
import {WorldRenderer} from '../engine/renderer.js';
import {specializeLocalLights} from '../engine/shot-shaders.js';
import {geometry,composite} from '../engine/shaders.js';
import {damageCubes,damageParticles} from '../engine/damage-shaders.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {PlaySession} from '../play/session.js';
import {createPlacementRules} from '../play/placement.js';

const models=new Map(await Promise.all(['dog','turret-study'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
function configWith({spawns=1,hp=80,speed=12,gap=.05,gunStats,gunFiring}={}){
 const levels=structuredClone(PLAY_CONFIG.levels);levels[0].waves[0].spawns=levels[0].waves[0].spawns.slice(0,spawns).map((s,i)=>({...s,at:i*gap}));
 // These bounded lifecycle fixtures explicitly exercise the global profile;
 // real campaign witnesses below retain every authored wave override.
 for(const level of levels)for(const wave of level.waves)delete wave.enemyOverrides;
 const override={levels,enemies:{dog:{maxHealth:hp,speed}}};
 if(gunStats||gunFiring)override.defences={'turret-study':{variants:{base:{...(gunStats?{stats:gunStats}:{}),...(gunFiring?{firing:gunFiring}:{})}}}};
 return createPlayConfig(override);
}
function fixture({config=configWith(),variant=null,box=[2,0,1],callbacks={}}={}){
 const level=newLevel('play-test');level.size=[8,5];level.path=Array.from({length:8},(_,x)=>[x,0,2]);if(variant)level.placements=[{id:'player-gun-1',model:'turret-study',variant,box,turn:0}];
 const wave=config.levels[0].waves[0],world=buildWorld(level,models,{actors:waveActors(wave)}),visible=new Map(),engine=new PlayEngine(world,{config,wave,onVisible:(id,value)=>visible.set(id,value),...callbacks});
 return {engine,world,visible,dispose(){engine.dispose();disposeWorld(world);}};
}
function run(engine,seconds,hz=60){for(let i=0;i<seconds*hz;i++)engine.advance(1/hz);}

test('finite lifecycle excludes positive-HP future and escaped actors, accounts spawn-relative movement and resolves once',()=>{
 const escapes=[],complete=[],f=fixture({config:configWith({spawns:2,gap:.05}),callbacks:{onEscape:(...args)=>escapes.push(args),onWaveComplete:s=>complete.push(s)}}),e=f.engine;
 try{
  expect(e.enemies.states.every(s=>s.health.current===80&&s.health.alive===false)).toBe(true);expect(e.enemies.activeTargets).toEqual([]);expect([...f.visible.values()]).toEqual([false,false]);
  e.advance(12,{combat:false});expect(e.waveTime).toBe(0);expect(e.enemies.spawned).toBe(0);
  e.startWave();const [first,future]=e.enemies.states;expect(e.enemies.activeTargets).toEqual([first]);expect(e.enemies.takeHit(future,100)).toBe(0);
  e.advance(1);expect(first.distance).toBeCloseTo(12,8);expect(future.distance).toBeCloseTo(11.4,8);expect(first.distance).toBeGreaterThan(future.distance);expect(future.time).toBeCloseTo(.95,8);expect(e.enemies.activeTargets).toHaveLength(2);
  run(e,20);expect(escapes).toHaveLength(2);expect(complete).toHaveLength(1);expect(e.enemies.states.map(s=>s.phase)).toEqual(['escaped','escaped']);expect(e.enemies.activeTargets).toEqual([]);expect(e.enemies.states.every(s=>s.health.current===80&&!s.health.alive)).toBe(true);expect(e.enemies.takeHit(first,100)).toBe(0);
  const waveTime=e.waveTime;run(e,40);expect(e.waveTime).toBe(waveTime);expect(escapes).toHaveLength(2);expect(complete).toHaveLength(1);
 }finally{f.dispose();}
});

test('real gun tier models, configured health/movement/strength/cadence and active target profiles drive physical hits',()=>{
 for(const variant of ['base','upgrade1','upgrade2']){
  const hits=[],config=configWith({hp:30,speed:15,gunStats:{strength:17},gunFiring:{cooldownSeconds:.3}}),f=fixture({config,variant,callbacks:{onDeath:(_id,s)=>hits.push(s)}}),e=f.engine;
  try{
   expect(f.world.rigs.get('player-gun-1').variant).toBe(variant);expect(f.world.rigs.get('player-gun-1').parts).toBe(models.get('turret-study').variants[variant].parts);const gun=e.firing.states[0];expect(gun.strength).toBe(variant==='base'?17:variant==='upgrade1'?12:14);expect(gun.cycle.rule.cooldownSeconds).toBe(variant==='base'?.3:1);expect(gun.cycle.rule.shotsPerBurst).toBe(variant==='base'?1:variant==='upgrade1'?3:5);expect(e.enemies.states[0].gait.settings.speed).toBe(15);expect(e.enemies.states[0].health.maximum).toBe(30);
   e.startWave();run(e,20);expect(hits).toHaveLength(1);expect(e.enemies.killed).toBe(1);expect(e.enemies.escaped).toBe(0);expect(e.firing.shots).toBeGreaterThanOrEqual(2);expect(e.enemies.activeTargets).toEqual([]);
   expect(e.firing.states[0].lastShotDamage).toBeGreaterThan(0);
  }finally{f.dispose();}
 }
 expect(ENEMY_STATS.dog.maxHealth).toBe(300);expect(DEFENCE_STATS['turret-study'].base.strength).toBe(10);expect(TURRET_FIRING.base.cooldownSeconds).toBe(1);expect(TURRET_FIRING.upgrade2).toBeNull();expect(DEFENCE_STATS['turret-study'].upgrade2.strength).toBe(0);
});

test('a killing hit at the exit instant wins over escape and stopping at the miss threshold suppresses clear',()=>{
 const deaths=[],escapes=[],f=fixture({config:configWith({hp:10}),variant:'base',box:[7,0,1],callbacks:{onDeath:(_id,s)=>deaths.push(s.id),onEscape:id=>escapes.push(id)}}),e=f.engine;
 try{
  e.startWave();const s=e.enemies.states[0],g=e.firing.states[0];s.distance=s.path.length-s.movement.speed*PLAY_TICK;e.enemies.preview.pose();expect(e.firing.eligible(g,s,0)).toBe(true);g.aim.yaw=e.firing.targetYaw(g);g.pitch.yaw=e.firing.targetPitch(g,s,g.aim.yaw);
  e.advance(PLAY_TICK);expect(s.phase).toBe('killed');expect(deaths).toHaveLength(1);expect(escapes).toEqual([]);
 }finally{f.dispose();}
 let clears=0,count=0;const loss=fixture({config:configWith({spawns:2,gap:0}),callbacks:{onEscape:()=>{count++;loss.engine.stopWave();},onWaveComplete:()=>clears++}});
 try{loss.engine.startWave();run(loss.engine,20);expect(count).toBe(1);expect(clears).toBe(0);expect(loss.engine.running).toBe(false);}finally{loss.dispose();}
});

test('fixed bounded ticks agree at 30/60/120Hz, retain long-frame work and reset gun clocks uniformly',()=>{
 const outcomes=[];
 for(const hz of [30,60,120]){
  const f=fixture({config:configWith({spawns:3,hp:30,gap:.73}),variant:'upgrade1'});
  try{f.engine.startWave();run(f.engine,20,hz);outcomes.push([f.engine.enemies.killed,f.engine.enemies.escaped,f.engine.firing.shots,f.engine.waveTime]);}finally{f.dispose();}
 }
 expect(outcomes[1]).toEqual(outcomes[0]);expect(outcomes[2]).toEqual(outcomes[0]);
 const f=fixture({variant:'base'}),e=f.engine;
 try{
  e.startWave();e.advance(5);expect(e.lastSteps).toBe(PLAY_MAX_STEPS);expect(e.waveTime).toBeCloseTo(2,8);expect(e.accumulator).toBeCloseTo(3,8);
  e.advance(.00000001);expect(e.waveTime).toBeCloseTo(4,8);expect(e.accumulator).toBeCloseTo(1,7);const wave=e.waveTime,gun=e.firing.states[0].cycle.time;e.advance(2,{combat:false});expect(e.waveTime).toBe(wave);expect(e.firing.states[0].cycle.time).toBe(gun);
  expect(e.startWave()).toBe(false);e.stopWave();e.startWave();expect(e.accumulator).toBe(0);expect(e.waveTime).toBe(0);expect(e.firing.states[0].cycle.time).toBe(0);expect(e.firing.states[0].cycle.ready).toBe(true);expect(e.firing.states[0].cycle.remaining).toBe(0);expect(e.firing.states[0].aim.yaw).toBe(0);expect(e.firing.states[0].pitch.angle).toBe(0);
 }finally{f.dispose();}
});

test('all scheduled actors retain death-effect emitters but inactive lifecycle cannot produce smoke or targeting',()=>{
 const damage=new DamageEffects(()=>.5),f=fixture({config:configWith({spawns:2,hp:10}),callbacks:{onDeath:(_id,state)=>expect(damage.explode(state)).not.toBeNull()}});
 try{
  damage.setWorld(f.world,f.engine.enemies.states);expect(damage.emitters).toHaveLength(2);f.engine.startWave();expect(f.engine.enemies.takeHit(f.engine.enemies.states[0],10)).toBe(10);expect(damage.blastCount+damage.activeBlasts).toBeGreaterThan(0);
  f.engine.advance(.1);const survivor=f.engine.enemies.states[1];survivor.distance=survivor.path.length;f.engine.enemies.resolveExits();expect(survivor.phase).toBe('escaped');damage.emitSmoke(1);expect(damage.activeSmoke).toBe(0);
 }finally{damage.reset();f.dispose();}
});

test('play load composes immutable A source, requests only player assets, carries safe wildlife and releases extras',async()=>{
 const native=globalThis.fetch,requests=[];globalThis.fetch=async url=>{requests.push(String(url));const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};
 let world,engine;
 try{
  await expect(loadPlayWorld('moss-01',{wave:PLAY_CONFIG.levels[0].waves[0],placements:[{id:'bad',model:'drone-defence',variant:'upgrade1',box:[1,0,1],turn:0}]})).rejects.toThrow('Unsupported player deployment');expect(requests).toEqual([]);
  await expect(loadPlayWorld('moss-01',{wave:{...PLAY_CONFIG.levels[0].waves[0],spawns:[]}})).rejects.toThrow('modified playable wave');expect(requests).toEqual([]);
  const levels=structuredClone(PLAY_CONFIG.levels);levels[0].waves[0].enemyOverrides={dog:{maxHealth:150,speed:15}};const overridden=createPlayConfig({levels}),authorized=overridden.levels[0].waves[0];
  for(const enemyOverrides of [undefined,null,{dog:{maxHealth:151,speed:15}},{dog:{maxHealth:150,speed:15,missValue:2}}])await expect(loadPlayWorld('moss-01',{config:overridden,wave:{...authorized,enemyOverrides}})).rejects.toThrow('modified playable wave');
  await expect(loadPlayWorld('moss-01',{wave:{...PLAY_CONFIG.levels[0].waves[0],enemyOverrides:{dog:{maxHealth:150}}}})).rejects.toThrow('modified playable wave');expect(requests).toEqual([]);
  const source=await Bun.file(new URL('../assets/levels/moss-01.json',import.meta.url)).json(),before=JSON.stringify(source);world=await loadPlayWorld('moss-01',{wave:PLAY_CONFIG.levels[0].waves[0]});expect(JSON.stringify(world.playSource)).toBe(before);expect(world.playModels.has('turret-study')).toBe(true);expect(world.level.placements.some(p=>p.model==='drone-defence')).toBe(false);expect(world.playModels.has('drone-defence')).toBe(false);expect([...world.playDefencePools.keys()].some(key=>key.startsWith('drone-defence:'))).toBe(false);for(const id of ['roller','moth','arc-spire','missile-launcher','guided-missile'])expect(world.playModels.has(id)).toBe(true);expect(world.level.previewMode).toBeUndefined();expect(world.level.previewActors).toBeUndefined();
  const points=world.level.previewWildlife.habitatPoints,composed=composePlayLevel(source,[],{wildlifePoints:points});expect(composed.previewWildlife.habitatPoints).toEqual(points);expect(JSON.stringify(source)).toBe(before);
  engine=new PlayEngine(world,{wave:PLAY_CONFIG.levels[0].waves[0]});engine.advance(2,{combat:false});expect(engine.enemies.spawned).toBe(0);expect(engine.wildlife.states).toHaveLength(9);
 }finally{engine?.dispose();disposePlayWorld(world);globalThis.fetch=native;}
 expect(world.playSource).toBeNull();expect(world.playModels).toBeNull();expect(world.entries).toEqual([]);expect(engine.enemies.states).toEqual([]);expect(engine.wildlife.world).toBeNull();expect(engine.firing.targets).toBeNull();
});

test('128light boundary retains every source while preview shaders/capacity remain unchanged',async()=>{
 const capacity=playCapacity({...PLAY_CONFIG,levels:PLAY_CONFIG.levels.slice(0,4)});expect(capacity.maxOwnedUnits).toBe(32);expect(capacity.modelLights).toBe(128);
 const level=newLevel('play-lights');level.size=[20,16];level.path=Array.from({length:20},(_,x)=>[x,0,2]);level.placements=Array.from({length:32},(_,i)=>({id:'gun-'+i,model:'turret-study',variant:'base',box:[i%16+1,0,i<16?0:4],turn:0}));
 const actors=Array.from({length:8},(_,i)=>({id:'light-dog-'+i,model:'dog',variant:'base'})),world=buildWorld(level,models,{actors}),draws=new Map(world.entries.map(e=>[e.key,{transforms:new Float32Array(e.transforms.flatMap(m=>Array.from(m)))}])),lights=new ModelLights(world.entries,draws,{capacity:128,strict:true});
 try{
  lights.prepare();expect(lights.authoredCount).toBe(128);expect(lights.count).toBe(128);expect(lights.overflow).toBe(0);expect(lights.byteLength).toBe(4112);expect(()=>new ModelLights(world.entries,draws,{capacity:127,strict:true})).toThrow('capacity exceeded');
  const canvas={addEventListener(){},clientWidth:800,clientHeight:600},preview=new WorldRenderer(canvas,()=>{}),play=new WorldRenderer(canvas,()=>{},{modelLightCapacity:128,strictModelLights:true});expect(preview.localLightCapacity).toBe(77);expect(preview.modelLightCapacity).toBe(29);expect(play.localLightCapacity).toBe(176);expect(play.localLightData.byteLength).toBe(5648);
  for(const code of [geometry,composite,damageCubes,damageParticles]){expect(specializeLocalLights(code)).toBe(code);const specialized=specializeLocalLights(code,176);expect(specialized).toContain('array<ShotLight,176>');expect(specialized).not.toContain('shotLights.count.x),77u');expect(specialized).toContain('shotLights.count.x),176u');}
 }finally{lights.dispose();disposeWorld(world);}
});

test('real session with ineffective defence accumulates ten misses and suppresses the failing-wave reward',async()=>{
 const native=globalThis.fetch,cache=new Map();globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url),key=kind+'/'+id;if(!cache.has(key))cache.set(key,await Bun.file(new URL(`../assets/${key}.json`,import.meta.url)).json());return {ok:true,json:async()=>({asset:structuredClone(cache.get(key))})};};
 // Keep a real paid/deployed unit, with a test-only range too short to fight.
 const session=new PlaySession(createPlayConfig({defences:{'turret-study':{variants:{base:{stats:{maxRange:.001}}}}}}));session.reset();const gun=session.buy();session.prepare('deploy');session.place(gun,[13,0,9]);let clears=0,missEvents=0;
 try{
  for(let attempt=0;attempt<3;attempt++){
   const wave=session.wave,world=await loadPlayWorld(session.level.id,{wave,config:session.config,placements:session.placements});let engine;
   try{
    engine=new PlayEngine(world,{config:session.config,wave,onEscape:id=>{expect(session.resolve(id,'escaped')).toBe(true);missEvents++;if(session.phase==='defeat')engine.stopWave();},onDeath:id=>session.resolve(id,'killed'),onWaveComplete:()=>{expect(session.beginSettling(wave.id)).toBe(true);expect(session.advanceSettlement(session.config.waveSettleSeconds)).toBe(true);expect(session.finishWave(wave.id)).toBe(true);clears++;}});
    expect(session.prepare('deploy')).toBe(true);expect(session.startWave()).toBe(true);engine.startWave();
    for(let frame=0;frame<180*30&&session.phase==='wave';frame++)engine.advance(1/30);
    expect(session.phase).toBe(attempt<2?'loadout':'defeat');
   }finally{engine?.dispose();disposePlayWorld(world);}
  }
  expect(session.misses).toBe(10);expect(missEvents).toBe(10);expect(clears).toBe(2);expect(session.completedWaves).toBe(2);expect(session.tokens).toBe(5);expect(session.units).toHaveLength(1);expect(session.units[0].box).toEqual([13,0,9]);
  expect(session.finishWave(session.wave.id)).toBe(false);expect(session.resolve(session.wave.spawns[3].id,'escaped')).toBe(false);expect(session.tokens).toBe(5);
 }finally{globalThis.fetch=native;}
},30000);

test('historical eight-wave profile preserves paid ownership and transfers48kills into the next landscape',async()=>{
 const native=globalThis.fetch,cache=new Map();globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url),key=kind+'/'+id;if(!cache.has(key))cache.set(key,await Bun.file(new URL(`../assets/${key}.json`,import.meta.url)).json());return {ok:true,json:async()=>({asset:structuredClone(cache.get(key))})};};
 const historical=structuredClone(PLAY_CONFIG);historical.defences={'turret-study':historical.defences['turret-study']};historical.enemies={dog:historical.enemies.dog};
 for(const profile of Object.values(historical.defences['turret-study'].variants))profile.availableFromWave=1;historical.defences['turret-study'].variants.upgrade1.stats.maxRange=72;historical.defences['turret-study'].variants.upgrade2.stats.maxRange=96;
 for(let li=0;li<historical.levels.length;li++)for(let wi=0;wi<4;wi++){
  const wave=historical.levels[li].waves[wi],number=li*4+wi,count=[3,4,5,6,6,7,8,9][number]??4,gap=[3,2.8,2.6,2.4,2.3,2.2,2.1,2][number]??3;
  wave.enemyOverrides={dog:{maxHealth:[100,120,140,160,180,200,220,240][number]??240,speed:[12,13,14,15][Math.min(number,3)]}};wave.spawns=Array.from({length:count},(_,i)=>({id:wave.id+'-legacy-dog-'+i,model:'dog',routeId:'main',at:i*gap}));
 }
 const session=new PlaySession(validatePlayConfig(historical));session.reset();const owned=[session.buy(),session.buy()],results=[];
 try{
  expect(session.tokens).toBe(0);expect(owned.every(Boolean)).toBe(true);
  for(let number=0;number<8;number++){
   if(number===1||number===2){expect(session.upgrade(owned[0])).toBe(true);expect(session.upgrade(owned[1])).toBe(true);expect(session.tokens).toBe(0);}
   if(number===4){expect(session.level.id).toBe('moss-02');expect(session.units.map(u=>u.id)).toEqual(owned);expect(session.units.every(u=>u.variant==='upgrade2'&&u.box===null)).toBe(true);expect(session.tokens).toBe(4);}
   expect(session.prepare('deploy')).toBe(true);const boxes=session.level.id==='moss-01'?[[13,0,9],[4,0,9]]:[[5,0,5],[8,0,8]];
   for(let i=0;i<owned.length;i++)expect(session.place(owned[i],boxes[i])).toBe(true);
   const wave=session.wave,level=session.level.id,preflight=await loadPlayWorld(level,{wave,config:session.config});let arrangement,rules;
   try{rules=createPlacementRules(preflight.playSource,preflight.playModels,{config:session.config});arrangement=rules.prepare(session.placements);expect(arrangement.valid).toBe(true);}finally{rules?.dispose();disposePlayWorld(preflight);}
   const world=await loadPlayWorld(level,{wave,config:session.config,placements:session.placements,wildlifePoints:arrangement.wildlifePoints});let engine,clearCalls=0;
   try{
    engine=new PlayEngine(world,{config:session.config,wave,onDeath:id=>expect(session.resolve(id,'killed')).toBe(true),onEscape:id=>{expect(session.resolve(id,'escaped')).toBe(true);if(session.phase==='defeat')engine.stopWave();},onWaveComplete:()=>{clearCalls++;expect(session.beginSettling(wave.id)).toBe(true);expect(session.advanceSettlement(session.config.waveSettleSeconds)).toBe(true);expect(session.finishWave(wave.id)).toBe(true);expect(session.finishWave(wave.id)).toBe(false);}});
    const wallet=session.tokens;expect(session.startWave()).toBe(true);engine.startWave();for(let frame=0;frame<180*30&&session.phase==='wave';frame++)engine.advance(1/30);
    expect(clearCalls).toBe(1);expect(engine.enemies.killed).toBe(wave.spawns.length);expect(engine.enemies.escaped).toBe(0);expect(session.tokens).toBe(wallet+2);expect(session.completedWaves).toBe(number+1);expect(session.units.map(u=>u.id)).toEqual(owned);results.push({wave:wave.id,killed:engine.enemies.killed,shots:engine.firing.shots,time:engine.waveTime});
   }finally{engine?.dispose();disposePlayWorld(world);}
  }
  expect(results).toHaveLength(8);expect(results.map(result=>result.killed)).toEqual([3,4,5,6,6,7,8,9]);expect(results.reduce((sum,result)=>sum+result.killed,0)).toBe(48);expect(session.phase).toBe('loadout');expect(session.level.id).toBe('moss-03');expect(session.units.every(unit=>unit.box===null)).toBe(true);expect(session.tokens).toBe(12);expect(session.misses).toBe(0);expect(session.units.every(u=>u.variant==='upgrade2')).toBe(true);
 }finally{globalThis.fetch=native;}
},30000);

test('simultaneous finite spawns keep source callback order, share one pose batch and restart after exhaustion',()=>{
 const visible=[],f=fixture({config:configWith({spawns:3,gap:0}),callbacks:{onVisible:(id,active)=>{if(active)visible.push(id);}}}),enemies=f.engine.enemies,active=enemies.activeTargets;
 try{
  enemies.prepare();const original=enemies.preview.pose;let poseBatches=0;enemies.preview.pose=function(...args){poseBatches++;return original.apply(this,args);};
  const expected=enemies.states.map(s=>s.id);expect(enemies.nextSpawn()).toBe(0);enemies.spawnDue(0);expect(visible).toEqual(expected);expect(active.map(s=>s.id)).toEqual(expected);expect(poseBatches).toBe(1);expect(enemies.nextSpawn()).toBe(Infinity);expect(enemies.pending).toBe(0);
  enemies.spawnDue(100);expect(poseBatches).toBe(1);expect(visible).toEqual(expected);for(const state of enemies.states)enemies.resolve(state,'escaped');expect(enemies.complete).toBe(true);
  enemies.prepare();expect(enemies.activeTargets).toBe(active);expect(enemies.nextSpawn()).toBe(0);expect(enemies.spawned).toBe(0);expect(enemies.pending).toBe(3);poseBatches=0;visible.length=0;
  enemies.spawnDue(0);expect(visible).toEqual(expected);expect(poseBatches).toBe(1);expect(enemies.nextSpawn()).toBe(Infinity);expect(active.every(s=>s.health.alive&&s.distance===0&&s.time===0)).toBe(true);
 }finally{f.dispose();}
});
