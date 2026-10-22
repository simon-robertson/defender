import {test,expect} from 'bun:test';
import {PLAY_CONFIG,playCapacity} from '../play/config.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine,playSceneCapacity} from '../play/engine.js';
import {MAX_MODEL_LIGHTS,MAX_SUPPORTED_MODEL_LIGHTS} from '../shared/model-lights.js';
import {WorldRenderer} from '../engine/renderer.js';
import {specializeLocalLights} from '../engine/shot-shaders.js';
import {geometry,composite} from '../engine/shaders.js';
import {damageCubes,damageParticles} from '../engine/damage-shaders.js';

test('campaign light capacity fits the portable uniform limit and preserves preview allocation',()=>{
 const capacity=playCapacity(PLAY_CONFIG),canvas={addEventListener(){},clientWidth:960,clientHeight:768};
 expect(capacity.maxOwnedUnits).toBe(128);expect(capacity.modelLights).toBeLessThanOrEqual(MAX_SUPPORTED_MODEL_LIGHTS);
 const preview=new WorldRenderer(canvas,()=>{}),campaign=new WorldRenderer(canvas,()=>{},{modelLightCapacity:capacity.modelLights,strictModelLights:true});
 expect(preview.modelLightCapacity).toBe(MAX_MODEL_LIGHTS);expect(preview.localLightCapacity).toBe(77);
 expect(campaign.localLightCapacity).toBe(capacity.modelLights+48);expect(campaign.localLightData.byteLength).toBeLessThanOrEqual(16384);
 const boundary=new WorldRenderer(canvas,()=>{},{modelLightCapacity:MAX_SUPPORTED_MODEL_LIGHTS,strictModelLights:true});
 expect(boundary.localLightCapacity).toBe(511);expect(boundary.localLightData.byteLength).toBe(16368);
 for(const shader of [geometry,composite,damageCubes,damageParticles]){
  expect(specializeLocalLights(shader)).toBe(shader);
  expect(specializeLocalLights(shader,511)).toContain('array<ShotLight,511>');
  expect(()=>specializeLocalLights(shader,512)).toThrow();
 }
});

test('each zone loads only its own enemy geometry with affordable defence pools and finite native poses',async()=>{
 const native=globalThis.fetch,requests=[];
 globalThis.fetch=async url=>{requests.push(String(url));const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};
 try{
  for(let zi=0;zi<4;zi++){
   const level=PLAY_CONFIG.levels[zi*4+3],wave=level.waves[3],capacity=playSceneCapacity(PLAY_CONFIG,level.id),species=new Set(PLAY_CONFIG.levels.filter(l=>l.zone===level.zone).flatMap(l=>l.waves.flatMap(w=>w.spawns.map(s=>s.model))));
   expect(capacity.maxOwnedUnits).toBe((zi+1)*32);expect(new Set(Object.keys(capacity.maxWaveEnemiesBySpecies))).toEqual(species);
   requests.length=0;let world,engine;
   try{
    world=await loadPlayWorld(level.id,{wave,conditions:{night:false}});
    expect(new Set(world.playEnemyPools.keys())).toEqual(species);
    for(const id of Object.keys(PLAY_CONFIG.enemies))expect(requests.includes('/api/models/'+id)).toBe(species.has(id));
    for(const [key,pool]of world.playDefencePools)expect(pool.rigs.length).toBe(capacity.maxOwnedByFamily[key.split(':')[0]]);
    expect(world.playConditions).toEqual({night:false});
    engine=new PlayEngine(world,{wave});engine.startWave();engine.advance(1);
    expect(engine.enemies.spawned).toBeGreaterThan(0);
    for(const state of engine.enemies.states.filter(s=>s.phase==='active'))for(const bone of state.rig.bones)expect([...bone.instance.matrix].every(Number.isFinite)).toBe(true);
    expect(engine.stats().escaped).toBe(0);
   }finally{engine?.dispose();disposePlayWorld(world);}
   expect(world.playModels).toBeNull();expect(world.playEnemyPools).toBeNull();expect(world.entries).toEqual([]);
  }
 }finally{globalThis.fetch=native;}
},120000);

test('the maximum affordable42 launchers defer safely and empty launchers receive freed missiles first',async()=>{
 const [{newLevel},{buildWorld,disposeWorld},{MissilePreview,createMissileActors}]=await Promise.all([import('../shared/level.js'),import('../engine/world.js'),import('../game/missile-preview.js')]);
 const models=new Map(await Promise.all(['missile-launcher','guided-missile'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()]))),level=newLevel('campaign-magazines');
 level.size=[20,16];level.path=Array.from({length:20},(_,x)=>[x,0,15]);level.placements=Array.from({length:42},(_,i)=>({id:'silo-'+i,model:'missile-launcher',variant:'base',box:[i%9*2+1,0,Math.floor(i/9)*2+1],turn:0}));
 const world=buildWorld(level,models,{actors:createMissileActors()});let preview;
 try{
  preview=new MissilePreview(world,()=>{},()=>{},[],()=>0,{}, {deferMagazines:true});
  expect(preview.states).toHaveLength(42);expect(preview.pool.slots).toHaveLength(36);
  const waiting=preview.states.filter(s=>s.ammo===0);expect(waiting).toHaveLength(6);expect(waiting.every(s=>s.reloading&&s.poolDeferrals>0)).toBe(true);
  for(let i=0;i<6;i++){const owner=preview.states[i],index=owner.slots.find(i=>i>=0);preview.pool.release(preview.pool.slots[index]);owner.slots.fill(-1);owner.ammo=0;owner.awaitingRounds=true;owner.reloading=true;owner.reloadUntil=Infinity;}
  preview.refillWaiting();expect(waiting.every(s=>s.ammo===1&&!s.reloading)).toBe(true);
  preview.advance(1/120);expect(preview.shots).toBe(0);expect(preview.states.every(s=>s.cycle.shots===0)).toBe(true);expect(preview.pool.freeCount()).toBe(0);
  preview.resetTargets();expect(preview.states.reduce((sum,s)=>sum+s.ammo,0)).toBe(36);expect(preview.pool.active).toBe(0);
 }finally{preview?.dispose();disposeWorld(world);}
});
