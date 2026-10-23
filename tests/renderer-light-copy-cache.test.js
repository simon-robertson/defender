import {expect,test} from 'bun:test';
import {WorldRenderer} from '../engine/renderer.js';
import {MAX_SHOT_LIGHTS} from '../shared/shot-effects.js';
import {MAX_DAMAGE_LIGHTS} from '../shared/damage-effects.js';
import {MAX_MISSILE_LIGHTS} from '../shared/missile-flight.js';

// Retain the former packing algorithm as an independent packet reference.
function referenceMerge(){
 this.localLightUploadBytes=0;
 const models=this.modelLights,modelChanged=models?.prepare()??false,modelCount=models?.count??0;
 const shots=this.shotEffects,damage=this.damageEffects,missiles=this.missileThrust;
 const shotCount=Math.min(shots?.lightCount??0,MAX_SHOT_LIGHTS),damageCount=Math.min(damage?.lightCount??0,MAX_DAMAGE_LIGHTS),missileCount=Math.min(missiles?.lightCount??0,MAX_MISSILE_LIGHTS);
 const priorCount=shotCount+damageCount+modelCount,transientCount=shotCount+damageCount+missileCount,count=priorCount+missileCount;
 if(transientCount||this.hadTransientLights||modelChanged||count!==this.localLightCount){
  const data=this.localLightData;data[0]=count;
  for(let i=0;i<shotCount*8;i++)data[4+i]=shots.lightData[4+i];
  for(let i=0;i<damageCount*8;i++)data[4+shotCount*8+i]=damage.lightData[4+i];
  for(let i=0;i<modelCount*8;i++)data[4+(shotCount+damageCount)*8+i]=models.data[4+i];
  for(let i=0;i<missileCount*8;i++)data[4+priorCount*8+i]=missiles.lightData[4+i];
  this.device.queue.writeBuffer(this.shotUniform,0,data,0,4+count*8);this.localLightUploadBytes=(4+count*8)*4;this.dirty=true;
 }
 this.localLightCount=count;this.missileLightCount=missileCount;this.hadTransientLights=transientCount>0;
}
function modelSource(count,seed=1){
 const raw=Float32Array.from({length:4+count*8},(_,i)=>seed+i*.125);
 const source={count,changed:true,reads:0,raw,sources:[],prepare(){return this.changed;},dispose(){}};
 source.data=new Proxy(raw,{get(target,key){if(typeof key==='string'&&/^\d+$/.test(key))source.reads++;return Reflect.get(target,key,target);}});
 return source;
}
function renderer(models){
 const r=Object.create(WorldRenderer.prototype),packets=[];
 Object.assign(r,{modelLights:models,localLightData:new Float32Array(4+482*8),localLightCount:0,hadTransientLights:false,shotUniform:{},
  shotEffects:{lightCount:0,lightData:Float32Array.from({length:68},(_,i)=>i+10),reset(){}},
  damageEffects:{lightCount:0,lightData:Float32Array.from({length:36},(_,i)=>i+100)},
  missileThrust:{lightCount:0,lightData:Float32Array.from({length:292},(_,i)=>i+200)},
  device:{queue:{writeBuffer(buffer,offset,data,start=0,size=data.length){packets.push({offset,bytes:size*4,data:data.slice(start,start+size)});}}},packets});
 r.clearModelLightCopyCache();return r;
}
function compare(actual,reference){
 actual.mergeLocalLights();referenceMerge.call(reference);
 expect(actual.localLightData).toEqual(reference.localLightData);
 expect(actual.packets).toEqual(reference.packets);
 expect(actual.localLightUploadBytes).toBe(reference.localLightUploadBytes);
 expect(actual.localLightCount).toBe(reference.localLightCount);
 expect(actual.missileLightCount).toBe(reference.missileLightCount);
 actual.packets.length=reference.packets.length=0;
}

test('model blocks survive changing transient payloads without repeated CPU copies',()=>{
 const source=modelSource(434),actual=renderer(source),reference=renderer(modelSource(434));
 for(const r of [actual,reference]){r.shotEffects.lightCount=2;r.damageEffects.lightCount=1;r.missileThrust.lightCount=3;}
 compare(actual,reference);expect(source.reads).toBe(3472);
 source.changed=reference.modelLights.changed=false;source.reads=reference.modelLights.reads=0;
 for(let frame=0;frame<60;frame++){
  for(const r of [actual,reference]){r.shotEffects.lightData[4]=frame;r.damageEffects.lightData[8]=frame*.25;r.missileThrust.lightData[11]=frame*.5;}
  compare(actual,reference);
 }
 expect(source.reads).toBe(0);expect(reference.modelLights.reads).toBe(208320);
});

test('prefix changes, model edits, compaction and source replacement preserve reference packets',()=>{
 const actual=renderer(modelSource(8)),reference=renderer(modelSource(8));
 const step=(shots,damage,missiles,changed=false)=>{
  for(const r of [actual,reference]){r.shotEffects.lightCount=shots;r.damageEffects.lightCount=damage;r.missileThrust.lightCount=missiles;r.modelLights.changed=changed;}
  compare(actual,reference);
 };
 step(0,0,0,true);step(0,0,0);step(4,2,1);step(4,2,36);step(3,3,0);step(1,0,4);
 for(const r of [actual,reference])r.modelLights.raw[9]=99;
 step(1,0,4,true);step(1,0,4);
 // ModelLights reports hide/show compaction as changed output membership.
 for(const r of [actual,reference]){r.modelLights.count=5;r.modelLights.raw.copyWithin(4,12,52);}
 step(1,0,4,true);step(1,0,4);
 for(const r of [actual,reference])r.modelLights.count=8;
 step(1,0,4,true);step(0,0,0);step(0,0,0);
 step(1,0,4);
 for(const r of [actual,reference])r.modelLights=modelSource(8,50);
 // Even an already-prepared replacement must refresh the retained block.
 step(1,0,4);step(8,4,36);step(0,0,0);step(0,0,0);
});

test('world release and runtime membership rebuild release the cached model owner',()=>{
 const source=modelSource(8),r=renderer(source);
 r.mergeLocalLights();expect(r.lastPackedModelLights).toBe(source);
 Object.assign(r,{sceneBuffers:new Set(),draws:[],drawMap:new Map(),camera:{clearLevel(){}},canvas:{dataset:{}},ready:false});
 r.clearWorld();expect(r.lastPackedModelLights).toBeNull();expect(r.lastPackedModelOffset).toBe(-1);expect(r.lastPackedModelCount).toBe(0);
 r.modelLights=source;source.changed=false;r.mergeLocalLights();expect(r.localLightData.slice(4,68)).toEqual(source.raw.slice(4,68));
 r.world={entries:[]};r.modelLightCapacity=32;r.syncRuntimeInstances(r.world);
 expect(r.lastPackedModelLights).toBeNull();expect(r.lastPackedModelOffset).toBe(-1);expect(r.lastPackedModelCount).toBe(0);
});
