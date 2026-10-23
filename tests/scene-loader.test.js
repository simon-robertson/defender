import {test,expect} from 'bun:test';
import {SceneLoader} from '../engine/scene-loader.js';
import {disposeWorld} from '../engine/world.js';
import {WorldRenderer} from '../engine/renderer.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {MAX_LOCAL_LIGHTS} from '../shared/shot-effects.js';
import {TURRET_MUZZLES} from '../shared/arsenal.js';
import {identity} from '../shared/math.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('explicit same-level rebuild releases and activates once; ordinary repeat remains a no-op',async()=>{
 const events=[];const loader=new SceneLoader({load:async id=>({id}),activate:()=>events.push('activate'),release:()=>events.push('release'),discard:()=>{}});
 await loader.switchTo('a');expect(await loader.switchTo('a')).toBe(false);expect(await loader.switchTo('a',{force:true})).toBe(true);
 expect(events).toEqual(['activate','release','activate']);expect(loader.loads).toBe(2);expect(loader.unloads).toBe(1);loader.dispose();
});
test('scene replacement releases old resources and waits for submitted work before fetching',async()=>{
 const events=[],drain=deferred();
 const loader=new SceneLoader({load:async id=>{events.push('load '+id);return {id};},activate:w=>events.push('activate '+w.id),release:w=>{events.push('release '+w.id);return drain.promise;},discard:()=>{}});
 await loader.switchTo('a');const switching=loader.switchTo('b');
 expect(loader.world).toBeNull();expect(loader.currentId).toBeNull();expect(events).toEqual(['load a','activate a','release a']);
 drain.resolve();await switching;expect(events).toEqual(['load a','activate a','release a','load b','activate b']);
 expect(loader.loads).toBe(2);expect(loader.unloads).toBe(1);expect(await loader.switchTo('b')).toBe(false);expect(loader.loads).toBe(2);
});
test('a stale fetch cannot activate after a newer request, even when it ignores abort',async()=>{
 const pending=new Map(),signals=new Map(),active=[],discarded=[];
 const loader=new SceneLoader({load:(id,{signal})=>{signals.set(id,signal);const p=deferred();pending.set(id,p);return p.promise;},activate:w=>active.push(w.id),release:()=>{},discard:w=>discarded.push(w.id)});
 const a=loader.switchTo('a');await Promise.resolve();const b=loader.switchTo('b');await Promise.resolve();
 expect(signals.get('a').aborted).toBe(true);pending.get('b').resolve({id:'b'});expect(await b).toBe(true);
 pending.get('a').resolve({id:'a'});expect(await a).toBe(false);expect(active).toEqual(['b']);expect(discarded).toEqual(['a']);expect(loader.currentId).toBe('b');
});
test('rapid requests during unload coalesce before starting replacement network loads',async()=>{
 const drain=deferred(),loads=[];const loader=new SceneLoader({load:async id=>{loads.push(id);return {id};},activate:()=>{},release:()=>drain.promise,discard:()=>{}});
 await loader.switchTo('a');const b=loader.switchTo('b'),c=loader.switchTo('c'),d=loader.switchTo('d');drain.resolve();
 expect(await Promise.all([b,c,d])).toEqual([false,false,true]);expect(loads).toEqual(['a','d']);expect(loader.unloads).toBe(1);
});
test('failed downloads and partial activation release resources and permit retry',async()=>{
 const errors=[],released=[];let attempt=0;
 const loader=new SceneLoader({load:async id=>{if(attempt++===0)throw new Error('offline');return {id};},activate:()=>{if(attempt===2)throw new Error('upload failed');},release:w=>released.push(w.id),discard:()=>{},onError:e=>errors.push(e.message)});
 expect(await loader.switchTo('a')).toBe(false);expect(loader.loading).toBe(false);expect(loader.world).toBeNull();
 expect(await loader.switchTo('a')).toBe(false);expect(released).toEqual(['a']);expect(loader.world).toBeNull();
 expect(await loader.switchTo('a')).toBe(true);expect(errors).toEqual(['offline','upload failed']);expect(loader.currentId).toBe('a');
});
test('disposal cancels a pending load and prevents scene resurrection',async()=>{
 const pending=deferred(),discarded=[];let signal,activations=0;
 const loader=new SceneLoader({load:(id,options)=>{signal=options.signal;return pending.promise;},activate:()=>activations++,release:()=>{},discard:w=>discarded.push(w.id)});
 const loading=loader.switchTo('a');await Promise.resolve();loader.dispose();expect(signal.aborted).toBe(true);pending.resolve({id:'a'});await loading;
 expect(activations).toBe(0);expect(discarded).toEqual(['a']);expect(loader.world).toBeNull();expect(await loader.switchTo('b')).toBe(false);
});
test('scene teardown clears every GPU buffer, camera/CPU reference and live shot without reallocating pools',()=>{
 const effects=new ShotEffects(()=>0),instances=effects.instanceData,lights=effects.lightData;effects.emit(identity(),TURRET_MUZZLES.base,0);effects.prepare();
 const world={level:{id:'a'},entries:[{mesh:{vertices:new Float32Array(100)}}],rigs:new Map([['a',{}]]),assetIds:['turret-study'],water:{},waterMaterial:{},quads:1,uniqueQuads:1};
 let destroyed=0,cleared=0;const r=Object.create(WorldRenderer.prototype),localLights=new Float32Array(4+MAX_LOCAL_LIGHTS*8).fill(1),lightUniform={},uploads=[];
 localLights[0]=MAX_LOCAL_LIGHTS;
 Object.assign(r,{world,sceneBuffers:new Set(Array.from({length:6},()=>({destroy(){destroyed++;}}))),destroyedSceneBuffers:0,draws:[{}],drawMap:new Map([['a',{}]]),waterDraw:{},bytes:123,camera:{clearLevel(){cleared++;}},shotEffects:effects,localLightData:localLights,localLightCount:MAX_LOCAL_LIGHTS,hadTransientLights:true,shotUniform:lightUniform,damageCubeCount:24,damageParticleCount:3,lastDamageCubeRevision:7,device:{queue:{writeBuffer(buffer,offset,data){uploads.push({buffer,offset,data:data.slice()});}}},canvas:{dataset:{inspection:'old',firing:'old'}},ready:false});
 r.clearWorld();disposeWorld(world);expect(destroyed).toBe(6);expect(cleared).toBe(1);expect(r.sceneBuffers.size).toBe(0);expect(r.drawMap.size).toBe(0);expect(r.draws).toEqual([]);expect(r.bytes).toBe(0);expect(r.world).toBeNull();
 expect(world.entries).toEqual([]);expect(world.rigs.size).toBe(0);expect(world.assetIds).toEqual([]);expect(world.level).toBeNull();expect(world.water).toBeNull();
 expect(effects.instanceCount).toBe(0);expect(effects.lightCount).toBe(0);expect(effects.flashMatrix.every(m=>m===null)).toBe(true);expect(effects.instanceData).toBe(instances);expect(effects.lightData).toBe(lights);
 expect(r.localLightData).toBe(localLights);expect(r.localLightCount).toBe(0);expect(r.hadTransientLights).toBe(false);expect(localLights.every(value=>value===0)).toBe(true);
 expect(uploads).toHaveLength(1);expect(uploads[0]).toEqual({buffer:lightUniform,offset:0,data:new Float32Array(4+MAX_LOCAL_LIGHTS*8)});
 expect(r.damageCubeCount).toBe(0);expect(r.damageParticleCount).toBe(0);expect(r.lastDamageCubeRevision).toBe(-1);
 r.clearWorld();expect(destroyed).toBe(6);expect(r.destroyedSceneBuffers).toBe(6);
});
