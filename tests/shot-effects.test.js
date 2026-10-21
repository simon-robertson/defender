import {test,expect} from 'bun:test';
import {ShotEffects} from '../engine/shot-effects.js';
import {TURRET_FIRING,TURRET_MUZZLES} from '../shared/arsenal.js';
import {MAX_SHOT_LIGHTS,MAX_SHOT_SPARKS,MAX_SHOT_INSTANCES,FLASH_SECONDS,SPARK_SECONDS} from '../shared/shot-effects.js';
import {identity,placementMatrix} from '../shared/math.js';
import {turretModel} from '../scripts/turret.js';
import {TurretPreview} from '../game/turret-preview.js';

test('shot sockets occupy the real open muzzle centres on all three variants',()=>{
 const model=turretModel();for(const [variant,sockets]of Object.entries(TURRET_MUZZLES)){
  const cells=new Map(model.variants[variant].parts.find(p=>p.id==='guns').voxels.map(v=>[v.slice(0,3).join(','),v]));
  expect(sockets.length).toBe(2);
  for(const [x,y,z]of sockets){
   for(let depth=0;depth<4;depth++)expect(cells.has([Math.floor(x),Math.floor(y),z+depth].join(','))).toBe(false);
   expect(cells.has([Math.floor(x),Math.floor(y),z+4].join(','))).toBe(true);
  }
 }
 expect(TURRET_FIRING.base.delivery).toBe('hitscan');expect(TURRET_FIRING.upgrade1.delivery).toBe('hitscan');expect(TURRET_FIRING.base.projectile).toBeNull();
});
test('paired flashes and local lights follow the recoiling guns; sparks stay in world space',()=>{
 const effects=new ShotEffects(()=>.5),matrix=placementMatrix([2,1,3],1);effects.emit(matrix,TURRET_MUZZLES.base,0);effects.prepare();
 expect(effects.lightCount).toBe(2);expect(effects.flashCount).toBe(2);expect(effects.sparkCount).toBe(12);expect(effects.instanceCount).toBe(16);
 const flashX=effects.instanceData[0],lightX=effects.lightData[4],sparkX=effects.instanceData[4*16];matrix[12]+=1.25;effects.prepare();
 expect(effects.instanceData[0]-flashX).toBeCloseTo(1.25,5);expect(effects.lightData[4]-lightX).toBeCloseTo(1.25,5);expect(effects.instanceData[4*16]).toBe(sparkX);
 // Quarter-turned local -Z points along world +X; light sits ahead of the bore.
 expect(effects.lightData[4]-effects.instanceData[0]).toBeCloseTo(3,5);
 effects.advance(FLASH_SECONDS);effects.prepare();expect(effects.lightCount).toBe(0);expect(effects.sparkCount).toBe(12);
 effects.advance(SPARK_SECONDS);effects.prepare();expect(effects.instanceCount).toBe(0);expect(effects.flashMatrix.every(m=>m===null)).toBe(true);
});
test('shot motion and light fading are independent of frame subdivision',()=>{
 const results=[];for(const step of [1/30,1/60,1/144,.07]){
  const e=new ShotEffects(()=>.5);e.emit(identity(),TURRET_MUZZLES.base,0);let time=0;
  while(time<.07){const delta=Math.min(step,.07-time);e.advance(delta);time+=delta;}e.prepare();results.push(e);
 }
 for(const e of results.slice(1)){expect(Array.from(e.instanceData)).toEqual(Array.from(results[0].instanceData));expect(Array.from(e.lightData)).toEqual(Array.from(results[0].lightData));}
});
test('effect pools remain bounded under overload, expire cleanly and retain their buffers',()=>{
 const e=new ShotEffects(()=>.5),matrix=identity(),instances=e.instanceData,lights=e.lightData,sparks=e.sparks;
 for(let i=0;i<300;i++)e.emit(matrix,TURRET_MUZZLES.base,0);e.prepare();
 expect(e.flashCount).toBe(MAX_SHOT_LIGHTS);expect(e.sparkCount).toBe(MAX_SHOT_SPARKS);expect(e.instanceCount).toBe(MAX_SHOT_INSTANCES);expect(e.droppedSparks).toBeGreaterThan(0);expect(e.replacedFlashes).toBeGreaterThan(0);
 e.advance(100);e.prepare();expect(e.lightCount).toBe(0);expect(e.instanceCount).toBe(0);
 e.emit(matrix,TURRET_MUZZLES.base,0);e.prepare();expect(e.instanceCount).toBe(0); // Old events are discarded.
 e.emit(matrix,TURRET_MUZZLES.base,e.time);e.prepare();expect(e.instanceCount).toBe(16);
 expect(e.instanceData).toBe(instances);expect(e.lightData).toBe(lights);expect(e.sparks).toBe(sparks);
 const boundary=new ShotEffects(()=>.5);boundary.advance(2.4);boundary.emit(matrix,TURRET_MUZZLES.base,boundary.time);boundary.advance(SPARK_SECONDS);boundary.prepare();
 expect(boundary.needsCleanup).toBe(false);expect(boundary.sparkBirth.every(t=>t===-Infinity)).toBe(true);expect(boundary.instanceCount).toBe(0);
 expect(()=>e.advance(-1)).toThrow();expect(()=>e.advance(Infinity)).toThrow();
});
test('burst events reach effects after pose updates and preserve original timestamps across stalls',()=>{
 const root=identity(),parts=[{id:'base',parent:null,pivot:[0,0,0]},{id:'head',parent:'base',pivot:[12,17,12]},{id:'guns',parent:'head',pivot:[12,27.5,15]}],instances=parts.map((p,index)=>({part:p.id,key:p.id,index,matrix:identity()}));
 const world={level:{placements:[{id:'t',model:'turret-study',variant:'upgrade1'}]},rigs:new Map([['t',{root,parts,instances}]])};
 const e=new ShotEffects(()=>.5),times=[],preview=new TurretPreview(world,()=>{},()=>.75,(variant,matrix,at)=>{
  times.push(at);expect(matrix).toBe(instances[2].matrix);expect(matrix[0]).toBeCloseTo(0,5);expect(matrix[2]).toBeCloseTo(-1,5);e.emit(matrix,TURRET_MUZZLES[variant],at);
 });
 const advance=dt=>{e.advance(dt);preview.advance(dt);e.prepare();};
 advance(2);advance(.4);expect(times.length).toBe(1);expect(e.lightCount).toBe(2);
 advance(.12);expect(times.length).toBe(2);expect(e.lightCount).toBe(2);expect(e.sparkCount).toBe(24);
 advance(.12);expect(times.length).toBe(3);expect(times[1]-times[0]).toBeCloseTo(.12,10);expect(times[2]-times[1]).toBeCloseTo(.12,10);
 advance(100);expect(e.instanceCount).toBe(0);expect(e.lightCount).toBe(0);expect(preview.states[0].pendingCount).toBe(0);
});

test('turret light peak is reduced twenty percent while its fade, reach and flash lifetime remain fixed',()=>{
 for(const sockets of Object.values(TURRET_MUZZLES)){
  const effects=new ShotEffects(()=>.5);effects.emit(identity(),sockets,0);
  for(const age of [0,FLASH_SECONDS*.25,FLASH_SECONDS*.5,FLASH_SECONDS-.000001,FLASH_SECONDS]){
   effects.advance(age-effects.time);effects.prepare();expect(effects.lightCount).toBe(age<FLASH_SECONDS?2:0);expect(effects.flashCount).toBe(age<FLASH_SECONDS?2:0);
   if(age<FLASH_SECONDS)for(let light=0;light<effects.lightCount;light++){
    const k=4+light*8;expect(effects.lightData[k+3]).toBe(96);expect(effects.lightData[k+7]).toBeCloseTo(8*(1-age/FLASH_SECONDS)**2,5);
    expect([...effects.lightData.slice(k+4,k+7)]).toEqual([...new Float32Array([1,.61,.26])]);
   }
  }
  expect(effects.sparkCount).toBe(12);effects.advance(SPARK_SECONDS-FLASH_SECONDS);effects.prepare();expect(effects.instanceCount).toBe(0);
 }
});
