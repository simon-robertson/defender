// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {MAX_MODEL_LIGHTS} from '../shared/model-lights.js';
import {MAX_LOCAL_LIGHTS} from '../shared/shot-effects.js';
import {MAX_DAMAGE_CUBES,MAX_DAMAGE_PARTICLES,MAX_SMOKE,DAMAGE_CUBE_FLOATS,DAMAGE_PARTICLE_FLOATS} from '../shared/damage-effects.js';
import {test,expect} from 'bun:test';
import {WorldRenderer} from '../engine/renderer.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {newLevel,defaultEnvironment} from '../shared/level.js';
import {identity} from '../shared/math.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {DogPreview,DOG_PREVIEW_ACTORS} from '../game/dog-preview.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {TurretPreview} from '../game/turret-preview.js';
import {PoseRig} from '../engine/rig.js';
import {ENEMY_STATS} from '../shared/enemy.js';
import {ArcEffects} from '../engine/arc-effects.js';
import {ARC_EMPTY_LIGHT_BYTES,ARC_LIGHT_BYTES,ARC_SECONDS,ARC_SPARK_SECONDS} from '../shared/arc-effects.js';
import {MAX_MISSILE_LIGHTS,MAX_MISSILE_THRUST_INSTANCES,MISSILE_THRUST_FLOATS} from '../shared/missile-flight.js';
import {PlasmaLinks} from '../engine/plasma-links.js';
import {MAX_PLASMA_LINKS,PLASMA_INSTANCE_BYTES,COMBINED_TUBE_LIGHT_BYTES} from '../shared/plasma-links.js';
import {MAX_ARC_STRIKES,ARC_LIGHT_FLOATS} from '../shared/arc-effects.js';

const DEPTH='Initial camera depth',SHADOW='Shadow map',OPAQUE='Visible opaque surfaces',WATER='Nearest water surface',DISPLAY='Water, reflections and display';
function mockRenderer(options={}){
 const descriptors=new Map(),globals={GPUBufferUsage:{COPY_DST:8,INDEX:16,VERTEX:32,UNIFORM:64,STORAGE:128},GPUShaderStage:{VERTEX:1,FRAGMENT:2},GPUTextureUsage:{RENDER_ATTACHMENT:1,TEXTURE_BINDING:2,COPY_SRC:4,COPY_DST:8},devicePixelRatio:1};
 for(const [key,value] of Object.entries(globals)){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,value});}
 const allocated=[],writes=[],passes=[],submissions=[],textures=[];
 const device={features:new Set(),limits:{maxTextureDimension2D:4096},createBuffer({size,usage}){const buffer={size,usage,data:new Uint8Array(size),destroyCalls:0,destroy(){this.destroyCalls++;}};allocated.push(buffer);return buffer;},
  createTexture(){const texture={destroyCalls:0,createView(){return {texture};},destroy(){this.destroyCalls++;}};textures.push(texture);return texture;},createBindGroup:descriptor=>descriptor,
  createShaderModule:descriptor=>({...descriptor,getCompilationInfo:async()=>({messages:[]})}),createBindGroupLayout:descriptor=>descriptor,createPipelineLayout:descriptor=>descriptor,createRenderPipeline:descriptor=>descriptor,createRenderPipelineAsync:async descriptor=>descriptor,
  queue:{writeBuffer(buffer,offset,data,dataOffset=0,size){if(buffer.destroyCalls)throw new Error('Stale buffer upload.');const stride=data.BYTES_PER_ELEMENT,start=dataOffset*stride,length=size===undefined?data.byteLength-start:size*stride;buffer.data.set(new Uint8Array(data.buffer,data.byteOffset+start,length),offset);writes.push({buffer,offset,bytes:length});},submit(buffers){submissions.push(buffers);}},
  createCommandEncoder(){return {beginRenderPass(descriptor){const record={label:descriptor.label,descriptor,indexed:[],direct:[]};passes.push(record);let instances,pipeline;return {setPipeline(value){pipeline=value;},setBindGroup(){},setVertexBuffer(slot,buffer){if(slot===1)instances=buffer;},setIndexBuffer(){},draw(...args){record.direct.push({pipeline,args});},drawIndexed(indexCount,instanceCount){record.indexed.push({instances,indexCount,instanceCount});},end(){}};},finish(){return {};}};},destroy(){}};
 const canvas={width:960,height:640,clientWidth:960,clientHeight:640,dataset:{},addEventListener(){},focus(){}};
 const r=new WorldRenderer(canvas,message=>{throw new Error(message);},{waterReflections:'ssr',...options});r.device=device;r.context={getCurrentTexture:()=>({createView:()=>({})})};r.ready=true;
 r.uniform=device.createBuffer({size:368,usage:64});const effects=new ShotEffects(()=>.5);r.setShotEffects(effects);r.shotUniform=device.createBuffer({size:r.localLightData.byteLength,usage:64});r.shotInstances=device.createBuffer({size:effects.instanceData.byteLength,usage:32});
 r.emptyArcLights=device.createBuffer({size:ARC_EMPTY_LIGHT_BYTES,usage:128});r.bindLocalLights();
 let cameraUpdates=0;const update=r.camera.update.bind(r.camera);r.camera.update=aspect=>{cameraUpdates++;update(aspect);};
 const reset=()=>{writes.length=0;passes.length=0;cameraUpdates=0;};
 return {r,effects,allocated,writes,passes,submissions,textures,reset,get cameraUpdates(){return cameraUpdates;},cleanup(){r.dispose();for(const [key,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}
function smallWorld(){
 const level=newLevel('render-test');level.size=[3,2];level.environment=defaultEnvironment();level.path=[[0,0,0],[1,0,0]];level.terrain.boxes=[{box:[2,1],ground:4,water:12}];
 const world=buildWorld(level,new Map()),mesh=world.entries[0].mesh;
 world.entries.push({key:'movable',mesh,transforms:[identity(),identity(),identity()]});return world;
}
const labels=f=>f.passes.map(pass=>pass.label);
const BLOOM=['Selective bloom emitters','Selective bloom horizontal','Selective bloom vertical'];

test('graphics options default on, validate atomically and leave geometry caches intact',()=>{
 const f=mockRenderer(),r=f.r,w=smallWorld();
 try{
  expect(r.reflectionsEnabled).toBe(true);expect(r.bloomEnabled).toBe(true);
  r.setWorld(w);r.render(0,0);f.reset();
  expect(r.setGraphicsOptions({critters:false})).toBe(false);
  expect(()=>r.setGraphicsOptions({reflections:false,bloom:0})).toThrow('boolean');
  expect(r.reflectionsEnabled).toBe(true);expect(r.bloomEnabled).toBe(true);
  expect(()=>r.setGraphicsOptions(null)).toThrow('object');expect(()=>r.setGraphicsOptions([])).toThrow('object');
  expect(r.setGraphicsOptions({reflections:false,bloom:false})).toBe(true);r.render(0,1);
  expect(labels(f)).toEqual([DISPLAY]);expect(f.cameraUpdates).toBe(0);expect(r.frameData[72]).toBe(0);
  expect(r.setGraphicsOptions({reflections:false,bloom:false})).toBe(false);
  r.clearWorld();r.setWorld(w);r.render(0,1);expect(r.reflectionsEnabled).toBe(false);expect(r.bloomEnabled).toBe(false);
 }finally{f.cleanup();disposeWorld(w);}
});

test('reflection switches gate planar and SSR while preserving water refraction and refreshing disabled captures',()=>{
 for(const mode of ['planar','ssr']){
  const f=mockRenderer({waterReflections:mode}),r=f.r,w=smallWorld();
  try{
   r.setGraphicsOptions({reflections:false});r.setWorld(w);r.render(0,0);
   expect(r.planar).toBeNull();expect(r.frameData[72]).toBe(0);expect(r.frameData[91]).toBe(0);expect(labels(f)).toContain(WATER);
   const material=r.frameData.slice(80,91),targets=r.targets,sceneBuffers=r.sceneBuffers.size;
   f.reset();r.setGraphicsOptions({reflections:true});r.render(0,1);
   expect(r.frameData[72]).toBe(1);expect(labels(f)).not.toContain(DEPTH);expect(labels(f)).not.toContain(OPAQUE);expect(labels(f)).not.toContain(WATER);
   expect(labels(f).includes('Planar water reflection')).toBe(mode==='planar');
   const planar=r.planar,allocated=f.allocated.length,textures=f.textures.length;
   f.reset();r.setGraphicsOptions({reflections:false});r.render(0,2);
   expect(labels(f)).toEqual([DISPLAY]);expect(r.planarDraws).toBe(0);expect(r.frameData[72]).toBe(0);expect(r.frameData[91]).toBe(0);
   expect(r.frameData.slice(80,91)).toEqual(material);expect(r.frameData[78]).not.toBe(0);
   r.setLightingColors('#102030','#405060');r.render(0,3);if(planar)expect(planar.valid).toBe(false);
   f.reset();r.setGraphicsOptions({reflections:true});r.render(0,4);
   expect(labels(f).includes('Planar water reflection')).toBe(mode==='planar');expect(r.frameData.slice(80,91)).toEqual(material);
   expect(r.targets).toBe(targets);expect(r.sceneBuffers.size).toBe(sceneBuffers);expect(f.allocated.length).toBe(allocated);expect(f.textures.length).toBe(textures);
   r.ssr=false;r.render(0,4);expect(r.frameData[72]).toBe(0);expect(r.planarDraws).toBe(0);
  }finally{f.cleanup();disposeWorld(w);}
  expect(f.allocated.every(b=>b.destroyCalls===1)).toBe(true);expect(f.textures.every(t=>t.destroyCalls===1)).toBe(true);
 }
});

test('bloom off skips lazy setup, extraction, blur and composite without suppressing source effects or light',()=>{
 const f=mockRenderer(),r=f.r,w=smallWorld();
 try{
  r.setGraphicsOptions({bloom:false});r.setWorld(w);f.effects.emit(identity(),[[0,0,0],[2,0,0]],0);f.effects.prepare();r.render(0,0);
  expect(r.bloom).toBeNull();expect(r.localLightCount).toBeGreaterThan(0);expect(labels(f)).not.toContain(BLOOM[0]);
  expect(f.passes.find(p=>p.label===DISPLAY).direct.some(call=>call.pipeline===r.shotPipeline&&call.args[1]===f.effects.instanceCount)).toBe(true);
  f.reset();r.setGraphicsOptions({bloom:true});r.render(0,0);const b=r.bloom,buffers=f.allocated.length,textures=f.textures.length;
  expect(b.active).toBe(true);expect(labels(f)).toEqual([OPAQUE,...BLOOM,DISPLAY]);
  const render=b.render;b.render=()=>{throw new Error('Disabled bloom rendered');};
  f.reset();r.setGraphicsOptions({bloom:false});r.render(0,0);
  expect(labels(f)).toEqual([OPAQUE,DISPLAY]);expect(b.active).toBe(false);expect(b.passes).toBe(0);expect(b.draws).toBe(0);
  expect(f.passes.find(p=>p.label===DISPLAY).direct[0].pipeline).toBe(r.screenPipeline);expect(f.writes.some(write=>write.buffer===b.settings)).toBe(false);
  b.render=render;f.reset();r.setGraphicsOptions({bloom:true});r.render(0,0);
  expect(labels(f)).toEqual([OPAQUE,...BLOOM,DISPLAY]);expect(b.active).toBe(true);expect(r.bloom).toBe(b);expect(f.allocated.length).toBe(buffers);expect(f.textures.length).toBe(textures);
 }finally{f.cleanup();disposeWorld(w);}
});

test('disabled bloom retains asynchronous death preparation but allocates no bloom images at load or resize',async()=>{
 const f=mockRenderer(),r=f.r,w=smallWorld();let pipelines=0;const create=r.device.createRenderPipelineAsync;r.device.createRenderPipelineAsync=async descriptor=>{pipelines++;return create(descriptor);};
 try{
  r.setGraphicsOptions({bloom:false});await r.prepareDeathEffects();expect(pipelines).toBe(17);expect(r.deathEffectsPrepared).toBe(true);
  const b=r.bloom;b.ensureTargets=()=>{throw new Error('Disabled bloom allocated images');};b.render=()=>{throw new Error('Disabled bloom rendered');};
  r.setWorld(w);r.render(0,0);r.canvas.clientWidth=1000;f.reset();r.render(0,1);
  expect(b.bytes).toBe(0);expect(b.first).toBeNull();expect(labels(f)).not.toContain(BLOOM[0]);expect(pipelines).toBe(17);
 }finally{f.cleanup();disposeWorld(w);}
 expect(f.allocated.every(b=>b.destroyCalls===1)).toBe(true);expect(f.textures.every(t=>t.destroyCalls===1)).toBe(true);
});

test('enemy debris uses the shared opaque/depth/shadow passes and retires without new images',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld(),damage={cubeCount:3,cubeRevision:1,cubeData:new Float32Array(60),particleCount:0,lightCount:0};
 try{
  r.setDamageEffects(damage);r.setWorld(world);r.render(0,0);
  expect(labels(f)).toEqual([DEPTH,SHADOW,OPAQUE,WATER,DISPLAY]);
  for(const label of [DEPTH,SHADOW,OPAQUE])expect(f.passes.find(p=>p.label===label).direct.map(call=>call.args)).toEqual([[36,3]]);
  const buffers=f.allocated.length,textures=f.textures.length;expect(r.damageBytes).toBe(MAX_DAMAGE_CUBES*DAMAGE_CUBE_FLOATS*4);
  f.reset();r.render(0,0);expect(labels(f)).toEqual([DISPLAY]);
  r.setLightingColors('#708ABA','#263754','#263754');f.reset();r.render(0,0);expect(labels(f)).toEqual([OPAQUE,DISPLAY]);
  damage.cubeCount=0;damage.cubeRevision++;f.reset();r.render(0,0);expect(labels(f)).toEqual([DEPTH,SHADOW,OPAQUE,DISPLAY]);
  expect(f.allocated.length).toBe(buffers);expect(f.textures.length).toBe(textures);
  f.reset();r.render(0,0);expect(labels(f)).toEqual([DISPLAY]);
 }finally{f.cleanup();disposeWorld(world);}
});

test('render invalidation refreshes only dependent passes for lights, camera, poses and resize',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld();let elapsed=0;const render=()=>{f.reset();r.render(1/60,elapsed+=1/60);};
 try{
  r.setWorld(world);render();expect(r.bloom).toBeNull();expect(labels(f)).toEqual([DEPTH,SHADOW,OPAQUE,WATER,DISPLAY]);expect(f.cameraUpdates).toBe(1);
  render();expect(labels(f)).toEqual([DISPLAY]);expect(f.cameraUpdates).toBe(0);expect(f.writes.map(write=>write.bytes)).toEqual([32]);
  f.effects.lightCount=1;render();expect(labels(f)).toEqual([OPAQUE,DISPLAY]);expect(f.cameraUpdates).toBe(0);
  f.effects.lightCount=0;render();expect(labels(f)).toEqual([OPAQUE,DISPLAY]);expect(f.cameraUpdates).toBe(0);
  render();expect(labels(f)).toEqual([DISPLAY]);
  r.setLightingColors('#708ABA','#263754','#263754');render();expect(labels(f)).toEqual([OPAQUE,DISPLAY]);expect(f.cameraUpdates).toBe(0);expect(f.writes.find(write=>write.buffer===r.uniform).bytes).toBe(368);
  r.camera.yaw+=.1;r.requestDraw();render();expect(labels(f)).toEqual([DEPTH,OPAQUE,WATER,DISPLAY]);expect(f.cameraUpdates).toBe(1);
  const matrix=identity();matrix[12]=2;r.updateInstance('movable',1,matrix);render();expect(labels(f)).toEqual([DEPTH,SHADOW,OPAQUE,DISPLAY]);expect(f.cameraUpdates).toBe(0);expect(r.lastTransformUploads).toBe(1);expect(r.lastTransformUploadBytes).toBe(64);
  r.setLighting({...world.level.environment.sky,direction:[-.3,1,-.4]});render();expect(labels(f)).toEqual([SHADOW,OPAQUE,DISPLAY]);expect(f.cameraUpdates).toBe(0);
  r.canvas.clientWidth=1000;render();expect(labels(f)).toEqual([DEPTH,OPAQUE,WATER,DISPLAY]);expect(f.cameraUpdates).toBe(1);
  r.clearWorld();r.setWorld(world);render();expect(labels(f)).toEqual([DEPTH,SHADOW,OPAQUE,WATER,DISPLAY]);expect(f.cameraUpdates).toBe(1);
 }finally{f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(f.textures.every(texture=>texture.destroyCalls===1)).toBe(true);
});

test('pass descriptor trees and submission storage are reused while resized views and commands are fresh',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld();
 try{
  r.setWorld(world);r.render(1/60,0);const first=new Map(f.passes.map(pass=>[pass.label,pass.descriptor])),depthView=r.depthPass.depthStencilAttachment.view,displayView=r.displayPass.colorAttachments[0].view;
  const submit=f.submissions[0];expect(submit[0]).toBeNull();
  f.reset();r.requestDraw();r.shadowDirty=true;r.render(1/60,1/60);
  for(const pass of f.passes)expect(pass.descriptor).toBe(first.get(pass.label));expect(r.displayPass.colorAttachments[0].view).not.toBe(displayView);expect(f.submissions.every(storage=>storage===submit)).toBe(true);
  r.canvas.clientHeight=700;r.render(1/60,2/60);expect(r.depthPass.depthStencilAttachment.view).not.toBe(depthView);expect(r.depthPass.depthStencilAttachment.view).toBe(r.opaquePass.depthStencilAttachment.view);expect(r.waterPass.depthStencilAttachment.view).toBe(r.waterDepthView);
 }finally{f.cleanup();disposeWorld(world);}
});

test('instance updates batch the latest matrices into one contiguous range and never survive scene release',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld();
 try{
  r.setWorld(world);r.render(1/60,0);const draw=r.drawMap.get('movable'),packed=draw.transforms,initialMiddle=packed.slice(16,32),matrix=identity();f.reset();
  matrix[12]=7;r.updateInstance('movable',0,matrix);matrix[12]=9;r.updateInstance('movable',2,matrix);matrix[12]=11;r.updateInstance('movable',0,matrix);matrix[12]=99;
  expect(f.writes.length).toBe(0);expect(draw.transforms).toBe(packed);expect(packed[12]).toBe(11);expect(packed[44]).toBe(9);expect(packed.slice(16,32)).toEqual(initialMiddle);
  r.render(1/60,1/60);const uploads=f.writes.filter(write=>write.buffer===draw.instances);expect(uploads).toHaveLength(1);expect(uploads[0]).toEqual({buffer:draw.instances,offset:0,bytes:192});expect(new Float32Array(draw.instances.data.buffer)).toEqual(packed);
  f.reset();r.render(1/60,2/60);expect(r.lastTransformUploads).toBe(0);expect(r.lastTransformUploadBytes).toBe(0);expect(f.writes.some(write=>write.buffer===draw.instances)).toBe(false);
  matrix[12]=3;r.updateInstance('movable',1,matrix);r.clearWorld();expect(draw.instances.destroyCalls).toBe(1);expect(r.draws).toHaveLength(0);expect(r.drawMap.size).toBe(0);expect(r.transformBytes).toBe(0);
  f.reset();r.flushInstances();expect(f.writes.length).toBe(0);expect(()=>r.updateInstance('movable',0,matrix)).toThrow('Invalid instance');
 }finally{f.cleanup();disposeWorld(world);}
});

test('three live dogs share thirteen instance uploads rather than uploading every part separately',async()=>{
 const level=await Bun.file(new URL('../project-docs/level-rebuild-2026-10-18/previous-levels/moss-01.json',import.meta.url)).json(),ids=[...new Set([...level.placements.map(p=>p.model),'dog'])];
 const models=new Map(await Promise.all(ids.map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
 const world=buildWorld(level,models,{actors:DOG_PREVIEW_ACTORS}),f=mockRenderer(),r=f.r;let dogs,turrets;
 try{
  r.setWorld(world);let updates=0;const changed=new Set(),update=(key,index,matrix)=>{updates++;changed.add(key);r.updateInstance(key,index,matrix);};
  dogs=new DogPreview(world,update);turrets=new TurretPreview(world,update,()=>.5,()=>{},dogs.states);r.render(1/60,0);updates=0;changed.clear();f.reset();
  dogs.advance(1/60);expect(updates).toBe(39);expect(changed.size).toBe(13);turrets.advance(1/60);const changedGroups=changed.size,changedMatrices=updates;expect(f.writes.length).toBe(0);
  r.render(1/60,1/60);expect(r.lastTransformUploads).toBe(changedGroups);expect(r.lastTransformUploadBytes).toBe(changedMatrices*64);
  const expectedBytes=world.entries.reduce((bytes,entry)=>bytes+(entry.mesh.indices.length?entry.transforms.length*64:0),0);expect(r.transformBytes).toBe(expectedBytes);
  for(const entry of world.entries){const draw=r.drawMap.get(entry.key);if(!draw)continue;const gpu=new Float32Array(draw.instances.data.buffer);for(let i=0;i<entry.transforms.length;i++)expect(gpu.slice(i*16,(i+1)*16)).toEqual(entry.transforms[i]);}
 }finally{dogs?.dispose();turrets?.dispose();f.cleanup();disposeWorld(world);}
});

test('actor visibility compacts instance slots without geometry allocation and preserves latest hidden poses',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld(),entry=world.entries.find(entry=>entry.key==='movable');
 for(let index=0;index<3;index++){entry.transforms[index][12]=(index+1)*10;world.actors.set('actor-'+index,{instances:[{key:'movable',index,matrix:entry.transforms[index]}]});}
 try{
  r.setWorld(world);r.render(1/60,0);const draw=r.drawMap.get('movable'),buffers=[...r.sceneBuffers],packed=draw.packedTransforms,maps=[draw.indexToSlot,draw.slotToIndex],allocated=f.allocated.length;
  expect(r.visibilityBytes).toBe(216);expect(draw.visibleCount).toBe(3);f.reset();
  expect(r.setActorVisible('actor-1',false)).toBe(true);expect(r.setActorVisible('actor-1',false)).toBe(false);expect(f.writes.length).toBe(0);expect(draw.visibleCount).toBe(2);
  r.render(1/60,1/60);expect(labels(f)).toEqual([DEPTH,SHADOW,OPAQUE,DISPLAY]);expect(r.lastTransformUploads).toBe(1);expect(r.lastTransformUploadBytes).toBe(64);expect(f.cameraUpdates).toBe(0);
  for(const pass of f.passes.filter(pass=>[DEPTH,SHADOW,OPAQUE].includes(pass.label))){expect(pass.indexed.find(call=>call.instances===draw.instances).instanceCount).toBe(2);}
  const gpu=new Float32Array(draw.instances.data.buffer);expect(gpu[12]).toBe(10);expect(gpu[28]).toBe(30);expect(Array.from(draw.indexToSlot)).toEqual([0,-1,1]);
  f.reset();const matrix=identity();matrix[12]=99;r.updateInstance('movable',1,matrix);r.render(1/60,2/60);
  expect(labels(f)).toEqual([DISPLAY]);expect(r.lastTransformUploads).toBe(0);expect(draw.transforms[28]).toBe(99);expect(gpu[28]).toBe(30);
  // Idle frames preserve compacted visibility and its storage.
  r.render(1/60,3/60);r.render(1/60,4/60);expect(draw.visibleCount).toBe(2);expect(draw.indexToSlot).toBe(maps[0]);expect(draw.slotToIndex).toBe(maps[1]);expect(draw.packedTransforms).toBe(packed);
  f.reset();expect(r.setActorVisible('actor-1',true)).toBe(true);expect(r.setActorVisible('actor-1',true)).toBe(false);r.render(1/60,5/60);
  expect(draw.visibleCount).toBe(3);expect(gpu[44]).toBe(99);expect(draw.indexToSlot[1]).toBe(2);expect(r.lastTransformUploadBytes).toBe(64);
  // Hiding every actor removes the group's draw from depth, colour and shadows.
  for(let i=0;i<3;i++)r.setActorVisible('actor-'+i,false);f.reset();r.render(1/60,6/60);
  expect(draw.visibleCount).toBe(0);for(const pass of f.passes)expect(pass.indexed.some(call=>call.instances===draw.instances)).toBe(false);expect(r.lastTransformUploads).toBe(0);expect(r.lastDrawCalls).toBe(4);
  for(const index of [1,0,2])r.setActorVisible('actor-'+index,true);matrix[12]=42;r.updateInstance('movable',0,matrix);r.render(1/60,7/60);
  expect(draw.visibleCount).toBe(3);expect(gpu[draw.indexToSlot[0]*16+12]).toBe(42);expect(gpu[draw.indexToSlot[1]*16+12]).toBe(99);expect(gpu[draw.indexToSlot[2]*16+12]).toBe(30);
  // Visibility reuses all original scene buffers.
  expect(f.allocated.length-allocated).toBe(0);expect(buffers.every(buffer=>r.sceneBuffers.has(buffer))).toBe(true);
  expect(()=>r.setActorVisible('missing',false)).toThrow('Unknown runtime actor');expect(()=>r.setActorVisible('actor-0',0)).toThrow('boolean');
  r.updateInstance('movable',0,matrix);r.setActorVisible('actor-0',false);r.clearWorld();expect(r.visibilityBytes).toBe(0);expect(draw.instances.destroyCalls).toBe(1);expect(()=>r.setActorVisible('actor-0',true)).toThrow('Unknown runtime actor');
  r.setWorld(world);r.render(1/60,0);expect(r.drawMap.get('movable').visibleCount).toBe(3);expect(Array.from(r.drawMap.get('movable').indexToSlot)).toEqual([0,1,2]);
 }finally{f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
});

test('hiding a complete dog removes all thirteen parts from camera and shadow draws with fixed resources',async()=>{
 const level=await Bun.file(new URL('../project-docs/level-rebuild-2026-10-18/previous-levels/moss-01.json',import.meta.url)).json(),ids=[...new Set([...level.placements.map(p=>p.model),'dog'])];
 const models=new Map(await Promise.all(ids.map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
 const world=buildWorld(level,models,{actors:DOG_PREVIEW_ACTORS}),f=mockRenderer(),r=f.r;let dogs;
 try{
  r.setWorld(world);dogs=new DogPreview(world,r.updateInstance.bind(r));const actor=world.actors.get(DOG_PREVIEW_ACTORS[1].id),allocated=f.allocated.length,count=r.sceneBuffers.size;
  expect(r.visibilityBytes).toBe(2808);expect(actor.instances).toHaveLength(13);expect(r.setActorVisible(DOG_PREVIEW_ACTORS[1].id,false)).toBe(true);
  // The initial pending pose upload must honor compaction too.
  r.render(1/60,0);for(const instance of actor.instances){const draw=r.drawMap.get(instance.key);expect(draw.visibleCount).toBe(2);expect(draw.indexToSlot[instance.index]).toBe(-1);const gpu=new Float32Array(draw.instances.data.buffer);for(let slot=0;slot<draw.visibleCount;slot++){const logical=draw.slotToIndex[slot];expect(gpu.slice(slot*16,(slot+1)*16)).toEqual(draw.transforms.slice(logical*16,(logical+1)*16));}for(const pass of f.passes.filter(pass=>[DEPTH,SHADOW,OPAQUE].includes(pass.label)))expect(pass.indexed.find(call=>call.instances===draw.instances).instanceCount).toBe(2);}
  f.reset();r.setActorVisible(DOG_PREVIEW_ACTORS[1].id,true);r.render(1/60,1/60);expect(r.lastTransformUploads).toBe(13);expect(r.lastTransformUploadBytes).toBe(832);
  expect(f.allocated.length).toBe(allocated+1);expect(r.bloom.settings.size).toBe(16);expect(r.sceneBuffers.size).toBe(count);
 }finally{dogs?.dispose();f.cleanup();disposeWorld(world);}
});

test('Walker and Spider instance uploads and whole-actor removal reuse GPU geometry',async()=>{
 for(const [levelId,model,parts] of [['ochre-01','walker',7],['plum-01','spider',13]]){
  const level=await Bun.file(new URL(`../project-docs/level-rebuild-2026-10-18/previous-levels/${levelId}.json`,import.meta.url)).json(),actors=previewActorsForLevel(levelId).filter(actor=>actor.model===model);
  const ids=[...new Set([...level.placements.map(p=>p.model),model])];
  const models=new Map(await Promise.all(ids.map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
  const world=buildWorld(level,models,{actors}),f=mockRenderer(),r=f.r;let enemies;
  try{
   r.setWorld(world);enemies=new EnemyPreview(world,r.updateInstance.bind(r),null,actors);r.render(1/60,0);
   const allocated=f.allocated.length,buffers=r.sceneBuffers.size;
   f.reset();enemies.advance(1/60);r.render(1/60,1/60);
   expect(r.lastTransformUploads).toBe(parts);expect(r.lastTransformUploadBytes).toBe(parts*3*64);
   expect(r.setActorVisible(actors[1].id,false)).toBe(true);
   f.reset();r.render(1/60,2/60);
   for(const instance of world.actors.get(actors[1].id).instances){
    const draw=r.drawMap.get(instance.key);expect(draw.visibleCount).toBe(2);expect(draw.indexToSlot[instance.index]).toBe(-1);
    for(const pass of f.passes.filter(p=>[DEPTH,SHADOW,OPAQUE].includes(p.label)))expect(pass.indexed.find(call=>call.instances===draw.instances).instanceCount).toBe(2);
   }
   expect(f.allocated.length).toBe(allocated);expect(r.sceneBuffers.size).toBe(buffers);
   enemies.dispose();enemies=null;r.clearWorld();expect(r.sceneBuffers.size).toBe(0);expect(r.drawMap.size).toBe(0);expect(r.world).toBeNull();
  }finally{enemies?.dispose();f.cleanup();disposeWorld(world);}
  expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
 }
});

test('damage pools allocate lazily, share lit cube passes, merge every local light and retire cleanly',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld();
 const damage={cubeCount:0,cubeRevision:0,cubeData:new Float32Array(20),smokeCount:0,waterParticleCount:0,blastCount:0,particleCount:0,particleData:new Float32Array(48),lightCount:0,lightData:new Float32Array(36)};
 damage.cubeData.set(identity());damage.cubeData.set([.1,.2,.3,0],16);
 try{
  r.setDamageEffects(damage);r.setWorld(world);r.render(1/60,0);f.reset();const allocated=f.allocated.length,scene=r.sceneBuffers.size;
  r.render(1/60,1/60);expect(r.damageBytes).toBe(0);expect(r.damageCubeBuffer).toBeUndefined();expect(r.damageParticleBuffer).toBeUndefined();expect(f.allocated.length).toBe(allocated);expect(labels(f)).toEqual([DISPLAY]);
  damage.cubeCount=1;damage.cubeRevision++;damage.smokeCount=damage.blastCount=1;damage.waterParticleCount=2;damage.particleCount=4;
  f.effects.lightCount=8;f.effects.lightData[0]=8;for(let i=0;i<64;i++)f.effects.lightData[4+i]=i+1;
  damage.lightCount=4;damage.lightData[0]=4;for(let i=0;i<32;i++)damage.lightData[4+i]=101+i;
  f.reset();r.render(1/60,2/60);
  expect(labels(f)).toEqual([DEPTH,SHADOW,OPAQUE,...BLOOM,DISPLAY]);expect(f.cameraUpdates).toBe(0);expect(r.damageBytes).toBe((MAX_DAMAGE_CUBES*DAMAGE_CUBE_FLOATS+MAX_DAMAGE_PARTICLES*DAMAGE_PARTICLE_FLOATS)*Float32Array.BYTES_PER_ELEMENT);expect(r.sceneBuffers.size).toBe(scene);expect(f.allocated.length).toBe(allocated+3);
  for(const label of [DEPTH,SHADOW,OPAQUE]){const direct=f.passes.find(pass=>pass.label===label).direct;expect(direct).toHaveLength(1);expect(direct[0].args).toEqual([36,1]);}
  const display=f.passes.find(pass=>pass.label===DISPLAY).direct;expect(display.filter(call=>call.pipeline===r.damageSmokePipeline)[0].args).toEqual([6,3]);expect(display.filter(call=>call.pipeline===r.damageBlastPipeline)[0].args).toEqual([6,1,0,3]);
  expect(f.writes.find(write=>write.buffer===r.damageCubeBuffer).bytes).toBe(80);expect(f.writes.find(write=>write.buffer===r.damageParticleBuffer).bytes).toBe(192);
  expect(new Float32Array(r.damageCubeBuffer.data.buffer).slice(0,20)).toEqual(damage.cubeData);
  const merged=new Float32Array(r.shotUniform.data.buffer);expect(merged[0]).toBe(12);expect(merged.slice(4,68)).toEqual(f.effects.lightData.slice(4,68));expect(merged.slice(68,100)).toEqual(damage.lightData.slice(4,36));
  // Settled cubes keep cached depth/shadows. Transparent particles and lights
  // can disappear without rebuilding unchanged opaque debris geometry.
  damage.particleCount=damage.smokeCount=damage.waterParticleCount=damage.blastCount=damage.lightCount=0;f.effects.lightCount=0;f.reset();r.render(1/60,3/60);
  expect(labels(f)).toEqual([OPAQUE,DISPLAY]);expect(f.writes.some(write=>write.buffer===r.damageCubeBuffer||write.buffer===r.damageParticleBuffer)).toBe(false);expect(merged[0]).toBe(0);
  f.reset();r.render(1/60,4/60);expect(labels(f)).toEqual([DISPLAY]);expect(f.writes.every(write=>write.buffer===r.uniform)).toBe(true);
  damage.cubeCount=0;damage.cubeRevision++;f.reset();r.render(1/60,5/60);expect(labels(f)).toEqual([DEPTH,SHADOW,OPAQUE,DISPLAY]);expect(f.passes.every(pass=>pass.direct.every(call=>call.args[0]!==36))).toBe(true);expect(f.writes.some(write=>write.buffer===r.damageCubeBuffer)).toBe(false);
  f.reset();r.render(1/60,6/60);expect(labels(f)).toEqual([DISPLAY]);expect(f.writes.every(write=>write.buffer===r.uniform)).toBe(true);expect(f.allocated.length).toBe(allocated+3);
  r.clearWorld();expect(r.damageCubeCount).toBe(0);expect(r.damageParticleCount).toBe(0);expect(r.localLightCount).toBe(0);expect(merged[0]).toBe(0);expect(r.sceneBuffers.size).toBe(0);
 }finally{f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
});

test('smoke packs against the current camera before uploading, including rotation and an unchanged camera',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld(),damage=new DamageEffects(()=>.5);let preparations=0;
 const prepare=damage.prepare.bind(damage);damage.prepare=vp=>{preparations++;expect(vp).toBe(r.camera.vp);prepare(vp);};
 try{
  r.setWorld(world);r.setDamageEffects(damage);r.camera.yaw=0;r.camera.pitch=0;
  for(let i=0;i<2;i++)Object.assign(damage.smoke[i],{active:true,age:.5,life:2,x:36,y:30,z:i*48,vx:0,vz:0,rise:0,radius:2,seed:0});damage.activeSmoke=2;
  r.render(1/60,0);expect(f.cameraUpdates).toBe(1);expect(preparations).toBe(1);expect(r.damageParticleCount).toBe(2);
  const packed=new Float32Array(r.damageParticleBuffer.data.buffer);expect([packed[2],packed[14]]).toEqual([0,48]);
  // A half turn reverses near/far order immediately, not one frame later.
  r.camera.yaw=Math.PI;r.requestDraw();f.reset();r.render(1/60,1/60);
  expect(f.cameraUpdates).toBe(1);expect(preparations).toBe(2);expect([packed[2],packed[14]]).toEqual([48,0]);
  // Particle motion still repacks with the retained current view matrix.
  damage.smoke[0].z=96;f.reset();r.render(1/60,2/60);
  expect(f.cameraUpdates).toBe(0);expect(preparations).toBe(3);expect([packed[2],packed[14]]).toEqual([96,48]);
  expect(f.writes.find(write=>write.buffer===r.damageParticleBuffer).bytes).toBe(96);
 }finally{damage.reset();f.cleanup();disposeWorld(world);}
});

test('shockwave refraction lazily snapshots the full display, reuses bounded storage and adds no inactive pass',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld(),waveLabel='Explosion shockwave refraction';
 const damage={cubeCount:0,cubeRevision:0,cubeData:new Float32Array(20),smokeCount:0,blastCount:0,particleCount:0,particleData:new Float32Array(12),lightCount:0,lightData:new Float32Array(36),shockwaveCount:0,shockwaveData:new Float32Array(32)};
 try{
  r.setWorld(world);r.setDamageEffects(damage);r.render(1/60,0);const allocated=f.allocated.length,textures=f.textures.length;
  expect(r.shockwavePipeline).toBeUndefined();expect(r.shockwaveUniform).toBeUndefined();expect(r.shockwaveTargetBytes).toBe(0);
  damage.shockwaveCount=1;damage.shockwaveData.set([36,32,24,12,3,.65,0,0]);damage.particleCount=damage.smokeCount=1;f.effects.instanceCount=1;
  f.reset();r.render(1/60,1/60);expect(labels(f)).toEqual([DISPLAY,waveLabel]);expect(f.allocated.length).toBe(allocated+2);expect(f.textures.length).toBe(textures+1);
  const target=r.shockwaveTarget,view=r.shockwaveView,group=r.shockwaveGroup,buffer=r.shockwaveUniform;
  expect(r.shockwaveBytes).toBe(144);expect(r.shockwaveTargetBytes).toBe(960*640*4);
  expect(f.passes[0].descriptor.colorAttachments[0].view).toBe(view);expect(f.passes[1].descriptor.colorAttachments[0].view).not.toBe(view);
  expect(f.passes[0].direct.map(call=>call.pipeline)).toEqual([r.screenPipeline,r.damageSmokePipeline,r.shotPipeline]);expect(f.passes[1].direct).toEqual([{pipeline:r.shockwavePipeline,args:[3]}]);
  expect(f.writes.find(write=>write.buffer===buffer).bytes).toBe(48);expect(new Float32Array(buffer.data.buffer).slice(0,12)).toEqual(new Float32Array([1,0,0,0,36,32,24,12,3,.65,0,0]));
  damage.shockwaveCount=2;damage.shockwaveData.set([40,32,24,8,3,.4,0,0],8);f.reset();r.render(1/60,2/60);
  expect(r.shockwaveTarget).toBe(target);expect(r.shockwaveGroup).toBe(group);expect(r.shockwaveUniform).toBe(buffer);expect(f.writes.find(write=>write.buffer===buffer).bytes).toBe(80);expect(f.textures.length).toBe(textures+1);
  damage.shockwaveCount=0;f.reset();r.render(1/60,3/60);expect(labels(f)).toEqual([DISPLAY]);expect(f.writes.some(write=>write.buffer===buffer)).toBe(false);expect(r.displayPass.colorAttachments[0].view).not.toBe(view);expect(target.destroyCalls).toBe(0);
  // An inactive resize discards the old snapshot without replacing it.
  r.canvas.clientWidth=1000;f.reset();r.render(1/60,4/60);expect(target.destroyCalls).toBe(1);expect(r.shockwaveTarget).toBeNull();expect(r.shockwaveTargetBytes).toBe(0);expect(f.passes.some(pass=>pass.label===waveLabel)).toBe(false);
  damage.shockwaveCount=1;f.reset();r.render(1/60,5/60);const replacement=r.shockwaveTarget;expect(replacement).not.toBe(target);expect(r.shockwaveTargetBytes).toBe(1000*640*4);expect(r.shockwaveUniform).toBe(buffer);
  r.clearWorld();expect(replacement.destroyCalls).toBe(1);expect(r.shockwaveTarget).toBeNull();expect(r.shockwaveCount).toBe(0);expect(r.shockwaveTargetBytes).toBe(0);expect(buffer.destroyCalls).toBe(0);
  damage.shockwaveCount=0;r.setWorld(world);f.reset();r.render(1/60,0);expect(r.shockwaveTarget).toBeNull();expect(f.passes.some(pass=>pass.label===waveLabel)).toBe(false);
 }finally{f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(f.textures.every(texture=>texture.destroyCalls===1)).toBe(true);
});

test('authored model lights follow lit rig parts, preserve idle passes and merge with all transient slots',async()=>{
 const turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json(),level=newLevel('light-test');
 level.environment=defaultEnvironment();level.size=[6,3];level.path=[[0,0,0],[1,0,0],[2,0,0]];
 level.placements=[{id:'left',model:turret.id,variant:'base',box:[1,0,1],turn:0},{id:'middle',model:turret.id,variant:'upgrade1',box:[3,0,1],turn:1},{id:'right',model:turret.id,variant:'base',box:[5,0,1],turn:2}];
 const world=buildWorld(level,new Map([[turret.id,turret]])),f=mockRenderer(),r=f.r;
 try{
  r.inspect=true;r.setWorld(world);r.render(1/60,0);const lights=r.modelLights,data=lights.data,sources=lights.sources,allocated=f.allocated.length;
  expect(lights.count).toBe(9);expect(r.localLightCount).toBe(9);expect(JSON.parse(r.canvas.dataset.inspection).modelLights).toBe(9);expect(r.shotUniform.size).toBe(16+MAX_LOCAL_LIGHTS*32);
  f.reset();r.render(1/60,1/60);expect(labels(f)).toEqual([DISPLAY]);expect(f.writes.some(w=>w.buffer===r.shotUniform)).toBe(false);
  const head=world.rigs.get('middle').instances.find(i=>i.part==='head'),draw=r.drawMap.get(head.key),before=data.slice();
  const rig=new PoseRig(world.rigs.get('middle'),r.updateInstance.bind(r));rig.setRotation('head',0,Math.PI/2,0);rig.setTranslation('head',0,0,1.25);rig.update();f.reset();r.render(1/60,2/60);
  for(let i=0;i<sources.length;i++){
   const moved=sources[i].draw===draw&&sources[i].index===head.index;
   const source=sources[i],m=head.matrix;for(let axis=0;axis<3;axis++)expect(data[4+i*8+axis]).toBeCloseTo(moved?m[axis]*source.x+m[4+axis]*source.y+m[8+axis]*source.z+m[12+axis]:before[4+i*8+axis],5);
  }
  expect(labels(f)).toEqual([DEPTH,SHADOW,OPAQUE,...BLOOM,DISPLAY]);expect(f.writes.filter(w=>w.buffer===r.shotUniform)).toHaveLength(1);expect(f.writes.find(w=>w.buffer===r.shotUniform).bytes).toBe(304);
  const damage={lightCount:4,lightData:new Float32Array(36)},shot=f.effects;shot.lightCount=8;for(let i=0;i<64;i++)shot.lightData[4+i]=100+i;for(let i=0;i<32;i++)damage.lightData[4+i]=200+i;r.damageEffects=damage;
  f.reset();r.mergeLocalLights();expect(r.localLightCount).toBe(21);expect(f.writes.find(w=>w.buffer===r.shotUniform).bytes).toBe(688);expect(Array.from(r.localLightData.slice(4,68))).toEqual(Array.from(shot.lightData.slice(4,68)));expect(Array.from(r.localLightData.slice(68,100))).toEqual(Array.from(damage.lightData.slice(4,36)));expect(Array.from(r.localLightData.slice(100,172))).toEqual(Array.from(data.slice(4,76)));
  shot.lightCount=damage.lightCount=0;r.mergeLocalLights();expect(r.localLightCount).toBe(9);expect(Array.from(r.localLightData.slice(4,76))).toEqual(Array.from(data.slice(4,76)));f.reset();r.mergeLocalLights();expect(f.writes).toHaveLength(0);
  expect(f.allocated.length).toBe(allocated);expect(lights.data).toBe(data);r.damageEffects=null;
  expect(r.modelLights).toBe(lights);expect(lights.sources).toBe(sources);
  r.clearWorld();expect(lights.data).toBeNull();expect(sources).toHaveLength(0);expect(r.modelLights).toBeNull();expect(r.localLightCount).toBe(0);expect(new Float32Array(r.shotUniform.data.buffer).every(v=>v===0)).toBe(true);
  r.setWorld(world);r.render(1/60,0);expect(r.modelLights.count).toBe(9);expect(r.modelLights).not.toBe(lights);
 }finally{f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
});

test('hidden lit actors lose their lights and restore their latest logical pose without resources',async()=>{
 const turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json(),level=newLevel('light-actors');level.environment=defaultEnvironment();level.size=[2,2];level.path=[[0,0,0],[1,0,0]];
 const actors=[0,1,2].map(i=>({id:'light-'+i,model:turret.id,variant:'base'})),world=buildWorld(level,new Map([[turret.id,turret]]),{actors}),f=mockRenderer(),r=f.r;
 try{
  r.setWorld(world);r.render(1/60,0);const allocated=f.allocated.length;expect(r.modelLights.count).toBe(9);
  r.setActorVisible('light-1',false);r.render(1/60,1/60);expect(r.modelLights.count).toBe(6);expect(r.localLightCount).toBe(6);
  const instance=world.actors.get('light-1').instances.find(i=>i.part==='head'),matrix=instance.matrix.slice();matrix[12]=30;r.updateInstance(instance.key,instance.index,matrix);r.render(1/60,2/60);expect(r.modelLights.count).toBe(6);
  r.setActorVisible('light-1',true);r.render(1/60,3/60);expect(r.modelLights.count).toBe(9);
  const i=r.modelLights.sources.findIndex(s=>s.draw.key===instance.key&&s.index===instance.index),s=r.modelLights.sources[i];expect(r.modelLights.data[4+i*8]).toBeCloseTo(s.x+30,5);expect(f.allocated.length).toBe(allocated);
  r.clearWorld();const empty=smallWorld();r.setWorld(empty);r.render(1/60,0);expect(r.modelLights.data).toBeNull();expect(r.localLightCount).toBe(0);f.reset();r.render(1/60,1/60);expect(f.writes.some(w=>w.buffer===r.shotUniform)).toBe(false);disposeWorld(empty);
 }finally{f.cleanup();disposeWorld(world);}
});

test('enemy eye emitters follow real poses, vanish on death, return on reset and release every scene reference',async()=>{
 for(const [prefix,model,eyes]of [['moss','dog',4],['ochre','walker',2],['plum','spider',1]])for(const number of ['01','02']){
  const levelId=prefix+'-'+number,level=await Bun.file(new URL(`../project-docs/level-rebuild-2026-10-18/previous-levels/${levelId}.json`,import.meta.url)).json(),actors=previewActorsForLevel(levelId);
  const ids=[...new Set([...level.placements.map(p=>p.model),...actors.map(actor=>actor.model)])],models=new Map(await Promise.all(ids.map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
  const world=buildWorld(level,models,{actors}),f=mockRenderer(),r=f.r;let enemies;
  try{
   r.inspect=true;r.setWorld(world);enemies=new EnemyPreview(world,r.updateInstance.bind(r),id=>r.setActorVisible(id,false));r.render(1/60,0);
   const panels=levelId==='moss-01'?13:number==='01'?9:5,total=panels+eyes*3+(prefix==='plum'?2:4),lights=r.modelLights,data=lights.data,sources=lights.sources,initial=data.slice(),allocated=f.allocated.length;
   expect(lights.count).toBe(total);expect(lights.authoredCount).toBe(total);expect(lights.overflow).toBe(0);expect(lights.byteLength).toBe(16+MAX_MODEL_LIGHTS*32);expect(r.shotUniform.size).toBe(16+MAX_LOCAL_LIGHTS*32);
   expect(sources.filter(s=>s.draw.key.startsWith(model+':'))).toHaveLength(eyes*3);
   expect(JSON.parse(r.canvas.dataset.inspection).modelLights).toBe(total);expect(JSON.parse(r.canvas.dataset.inspection).modelLightOverflow).toBe(0);expect(r.bloom.active).toBe(true);
   const checkPoses=()=>{
    let packed=0;
    for(const source of sources){
     if(source.draw.indexToSlot&&source.draw.indexToSlot[source.index]<0)continue;
     if(source.draw.key.startsWith(model+':')){
      const instance=[...world.actors.values()].flatMap(actor=>actor.instances).find(i=>i.key===source.draw.key&&i.index===source.index),m=instance.matrix;
      for(let axis=0;axis<3;axis++)expect(data[4+packed*8+axis]).toBe(Math.fround(m[axis]*source.x+m[axis+4]*source.y+m[axis+8]*source.z+m[axis+12]));
     }
     packed++;
    }
    expect(packed).toBe(lights.count);
   };
   enemies.advance(.27);f.reset();r.render(1/60,.27);checkPoses();expect(data).not.toEqual(initial);
   expect(f.writes.filter(write=>write.buffer===r.shotUniform)).toHaveLength(1);expect(f.writes.find(write=>write.buffer===r.shotUniform).bytes).toBe(16+total*32);
   enemies.takeHit(enemies.states[1],300);r.render(1/60,.28);expect(lights.count).toBe(total-eyes);expect(r.localLightCount).toBe(total-eyes);checkPoses();
   for(const state of enemies.states)enemies.takeHit(state,state.health.maximum);
   r.render(1/60,.29);expect(lights.count).toBe(panels);expect(r.localLightCount).toBe(panels);
   // Match R: restore hidden logical poses first, then reveal the actor slots.
   enemies.reset();for(const state of enemies.states)r.setActorVisible(state.id,true);
   r.render(1/60,.30);expect(lights.count).toBe(total);expect(data).toEqual(initial);checkPoses();
   expect(lights.data).toBe(data);expect(lights.sources).toBe(sources);expect(f.allocated.length).toBe(allocated);
   if(levelId==='moss-01'){
    f.effects.lightCount=8;r.damageEffects={lightCount:4,lightData:new Float32Array(36)};f.reset();r.mergeLocalLights();
    expect(r.localLightCount).toBe(12+total);expect(f.writes.find(write=>write.buffer===r.shotUniform).bytes).toBe(16+(12+total)*32);
    expect(r.localLightData.slice(4+12*8,4+(12+total)*8)).toEqual(data.slice(4,4+total*8));
    const thrust={instanceCount:0,lightCount:MAX_MISSILE_LIGHTS,lightData:new Float32Array(4+MAX_MISSILE_LIGHTS*8)};for(let i=4;i<thrust.lightData.length;i++)thrust.lightData[i]=300+i;
    const prior=r.localLightData.slice(4,4+(12+total)*8);r.setMissileThrust(thrust);f.reset();r.mergeLocalLights();
    expect(MAX_LOCAL_LIGHTS).toBe(77);expect(r.localLightCount).toBe(77);expect(r.missileLightCount).toBe(36);expect(r.localLightUploadBytes).toBe(16+MAX_LOCAL_LIGHTS*32);expect(f.writes.find(write=>write.buffer===r.shotUniform).bytes).toBe(16+MAX_LOCAL_LIGHTS*32);
    expect(r.localLightData.slice(4,4+(12+total)*8)).toEqual(prior);expect(r.localLightData.slice(4+(12+total)*8)).toEqual(thrust.lightData.slice(4));expect(f.allocated.length).toBe(allocated);
    r.setMissileThrust(null);r.mergeLocalLights();expect(r.missileLightCount).toBe(0);expect(r.localLightCount).toBe(12+total);
    f.effects.lightCount=0;r.damageEffects=null;r.mergeLocalLights();expect(r.localLightCount).toBe(total);
   }
   r.clearWorld();expect(sources).toHaveLength(0);expect(lights.data).toBeNull();expect(lights.keys.size).toBe(0);expect(r.modelLights).toBeNull();expect(r.localLightCount).toBe(0);
   expect(new Float32Array(r.shotUniform.data.buffer).every(value=>value===0)).toBe(true);expect(r.bloom.bytes).toBe(0);expect(r.sceneBuffers.size).toBe(0);
  }finally{enemies?.dispose();f.cleanup();disposeWorld(world);}
  expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
 }
});

test('selective bloom caches steady emission, invalidates visibility and releases reduced targets on resize/unload',async()=>{
 const turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json(),level=newLevel('bloom');level.size=[3,2];level.environment=defaultEnvironment();level.path=[[0,0,0],[1,0,0]];
 level.placements=[{id:'turret',model:turret.id,variant:'base',box:[1,0,1],turn:0}];
 const world=buildWorld(level,new Map([[turret.id,turret]])),f=mockRenderer(),r=f.r;let time=0;const render=()=>{f.reset();r.render(1/60,time+=1/60);};
 try{
  expect(r.bloom).toBeNull();r.setWorld(world);render();const b=r.bloom,settings=b.settings,first=b.first,second=b.second,sourceDescriptor=b.extractPass;
  expect(labels(f)).toEqual([DEPTH,SHADOW,OPAQUE,...BLOOM,DISPLAY]);expect(b.bytes).toBe(240*160*16);expect(b.settings.size).toBe(16);expect(b.draws).toBe(3);
  expect(r.opaquePass.colorAttachments[0].clearValue.a).toBe(0);expect(r.clearPass.colorAttachments[0].clearValue.a).toBe(1);expect(f.passes.at(-1).direct[0].pipeline).toBe(b.compositePipeline);
  render();expect(labels(f)).toEqual([DISPLAY]);expect(b.draws).toBe(0);expect(b.passes).toBe(0);expect(f.writes.some(w=>w.buffer===settings)).toBe(false);
  // Even an unchanged steady source must refresh after the display option
  // returns, then resume ordinary cached bloom without reallocating images.
  const buffers=f.allocated.length,textures=f.textures.length;
  r.setGraphicsOptions({bloom:false});render();expect(labels(f)).toEqual([DISPLAY]);expect(b.active).toBe(false);
  r.setGraphicsOptions({bloom:true});render();expect(labels(f)).toEqual([...BLOOM,DISPLAY]);expect(b.active).toBe(true);
  render();expect(labels(f)).toEqual([DISPLAY]);expect(f.allocated.length).toBe(buffers);expect(f.textures.length).toBe(textures);
  // Lighting, camera and posed geometry all affect source
  // visibility/colour. The expensive geometry dependency rules stay unchanged.
  r.setLightingColors('#101828','#05080C');render();expect(labels(f)).toEqual([OPAQUE,...BLOOM,DISPLAY]);
  r.requestDraw();render();expect(labels(f)).toEqual([DEPTH,OPAQUE,...BLOOM,DISPLAY]);
  const rig=new PoseRig(world.rigs.get('turret'),r.updateInstance.bind(r));rig.setRotation('head',0,.2,0);rig.update();render();expect(labels(f)).toEqual([DEPTH,SHADOW,OPAQUE,...BLOOM,DISPLAY]);
  expect(b.first).toBe(first);expect(b.second).toBe(second);expect(b.extractPass).toBe(sourceDescriptor);
  r.canvas.clientWidth=963;r.canvas.clientHeight=641;render();expect(b.width).toBe(241);expect(b.height).toBe(161);expect(b.bytes).toBe(241*161*16);expect(b.settingsData[0]).toBe(Math.fround(963/241));expect(b.settingsData[1]).toBe(Math.fround(641/161));expect(first.destroyCalls).toBe(1);expect(second.destroyCalls).toBe(1);expect(b.settings).toBe(settings);
  const replacement=b.first;r.clearWorld();expect(replacement.destroyCalls).toBe(1);expect(b.bytes).toBe(0);expect(b.active).toBe(false);expect(b.passes).toBe(0);expect(settings.destroyCalls).toBe(0);
  const empty=smallWorld();r.setWorld(empty);render();expect(b.first).toBeNull();expect(labels(f).some(label=>BLOOM.includes(label))).toBe(false);expect(f.passes.at(-1).direct[0].pipeline).toBe(r.screenPipeline);disposeWorld(empty);
  r.setWorld(world);render();expect(b.bytes).toBe(241*161*16);expect(r.bloom).toBe(b);expect(b.settings).toBe(settings);
 }finally{f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(f.textures.every(texture=>texture.destroyCalls===1)).toBe(true);
});

test('transient bloom excludes sparks/smoke, clears on reset, preserves panels and precedes refraction',async()=>{
 const turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json(),level=newLevel('bloom-reset');level.size=[3,2];level.environment=defaultEnvironment();level.path=[[0,0,0],[1,0,0]];level.placements=[{id:'turret',model:turret.id,variant:'base',box:[1,0,1],turn:0}];
 const world=buildWorld(level,new Map([[turret.id,turret]])),f=mockRenderer(),r=f.r,damage=new DamageEffects(()=>.5);let time=0;const render=()=>{f.reset();r.render(1/60,time+=1/60);};
 try{
  r.setWorld(world);r.setDamageEffects(damage);render();const b=r.bloom;
  f.effects.emit(identity(),[[0,0,0],[2,0,0]],0);f.effects.prepare();render();
  const sources=f.passes.find(p=>p.label===BLOOM[0]).direct;expect(sources.map(call=>call.pipeline)).toEqual([b.extractPipeline,b.shotPipeline]);expect(sources[1].args).toEqual([6,4]);expect(f.effects.instanceCount).toBeGreaterThan(4);expect(b.draws).toBe(4);
  // A populated blast pool includes exactly its hot billboard range; smoke
  // retains its original full-resolution lit draw and creates no halo source.
  Object.assign(damage.blasts[0],{active:true,age:.05,x:36,y:30,z:24,seed:0,config:ENEMY_STATS.dog.explosion});
  damage.activeBlasts=1;render();expect(damage.blastCount).toBe(1);expect(b.draws).toBe(5);expect(labels(f).at(-1)).toBe('Explosion shockwave refraction');
  const display=f.passes.find(p=>p.label===DISPLAY);expect(display.direct[0].pipeline).toBe(b.compositePipeline);expect(display.descriptor.colorAttachments[0].view).toBe(r.shockwaveView);expect(labels(f).indexOf(BLOOM[2])).toBeLessThan(labels(f).indexOf(DISPLAY));
  const buffers=f.allocated.length,images=f.textures.length;f.effects.reset();damage.reset(true);render();expect(damage.blastCount).toBe(0);expect(b.active).toBe(true);expect(b.draws).toBe(3);expect(labels(f)).toContain(BLOOM[0]);expect(f.passes.find(p=>p.label===BLOOM[0]).direct).toHaveLength(1);
  render();expect(labels(f)).toEqual([DISPLAY]);expect(b.draws).toBe(0);expect(f.allocated.length).toBe(buffers);expect(f.textures.length).toBe(images);
  // Sparks without a flame and smoke without a blast leave the cached panel
  // image untouched, including after the transient-clearing frame.
  f.effects.instanceCount=1;Object.assign(damage.smoke[0],{active:true,age:.2,life:1,x:36,y:30,z:24,radius:2,seed:0});damage.activeSmoke=1;render();expect(labels(f)).toEqual([DISPLAY]);expect(b.passes).toBe(0);expect(damage.smokeCount).toBe(1);
 }finally{damage.reset();f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(f.textures.every(texture=>texture.destroyCalls===1)).toBe(true);
});

test('arc rendering allocates lazily, lights only colour passes, expires once and releases scene resources',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld(),arcs=new ArcEffects(()=>.5);
 try{
  r.setWorld(world);r.render(0,0);expect(r.arcBytes).toBe(0);expect(r.arcPipeline).toBeUndefined();
  r.setArcEffects(arcs);arcs.prepare();r.render(0,0);expect(r.arcBytes).toBe(0);expect(r.arcPipeline).toBeUndefined();
  const cold=f.allocated.length;arcs.emit([12,40,12],[55,26,20],[-1,0,0],0);arcs.prepare();f.reset();r.render(0,0);
  expect(f.allocated.length-cold).toBe(3); // Instances, tube lights, existing lazy bloom settings.
  expect(r.arcLightBuffer.size).toBe(ARC_LIGHT_BYTES);expect(r.arcBytes).toBe(arcs.instanceData.byteLength+ARC_LIGHT_BYTES);
  expect(r.lightGroup.entries.find(entry=>entry.binding===2).resource.buffer).toBe(r.arcLightBuffer);
  expect(labels(f)).toEqual([OPAQUE,...BLOOM,DISPLAY]);expect(r.arcUploads).toBe(2);
  const display=f.passes.find(pass=>pass.label===DISPLAY),bloom=f.passes.find(pass=>pass.label===BLOOM[0]);
  expect(display.direct.some(draw=>draw.pipeline===r.arcPipeline&&draw.args[1]===arcs.instanceCount)).toBe(true);
  expect(bloom.direct.some(draw=>draw.pipeline===r.bloom.arcPipeline&&draw.args[1]===arcs.instanceCount-arcs.sparkCount)).toBe(true);
  const instanceBuffer=r.arcInstances,lightBuffer=r.arcLightBuffer,steady=f.allocated.length;
  arcs.advance(.02);arcs.prepare();f.reset();r.render(.02,.02);expect(f.allocated.length).toBe(steady);expect(labels(f)).toEqual([OPAQUE,...BLOOM,DISPLAY]);
  arcs.advance(ARC_SECONDS);arcs.prepare();f.reset();r.render(ARC_SECONDS,ARC_SECONDS+.02);
  expect(r.arcLightCount).toBe(0);expect(r.arcUploads).toBe(2);expect(new Float32Array(lightBuffer.data.buffer)[0]).toBe(0);expect(r.bloom.active).toBe(false);
  arcs.advance(ARC_SPARK_SECONDS);arcs.prepare();f.reset();r.render(ARC_SPARK_SECONDS,1);expect(r.arcUploads).toBe(0);expect(labels(f)).toEqual([DISPLAY]);
  arcs.emit([12,40,12],[55,26,20],[-1,0,0],arcs.time);arcs.prepare();r.render(0,1);arcs.reset(true);arcs.prepare();f.reset();r.render(0,1);
  expect(r.arcLightCount).toBe(0);expect(r.arcUploads).toBe(1);expect(new Float32Array(lightBuffer.data.buffer)[0]).toBe(0);
  r.clearWorld();expect(r.arcBytes).toBe(0);expect(instanceBuffer.destroyCalls).toBe(1);expect(lightBuffer.destroyCalls).toBe(1);expect(r.lightGroup.entries.find(entry=>entry.binding===2).resource.buffer).toBe(r.emptyArcLights);
  r.setArcEffects(null);r.setWorld(world);f.reset();r.render(0,0);expect(r.arcBytes).toBe(0);expect(r.arcUploads).toBe(0);
 }finally{f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
});

test('missile thrust allocates only on a burn, reuses shot rendering and bloom, and disposes its scene buffer',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld(),thrust={instanceData:new Float32Array(MAX_MISSILE_THRUST_INSTANCES*MISSILE_THRUST_FLOATS),instanceCount:0,lightData:new Float32Array(4+MAX_MISSILE_LIGHTS*8),lightCount:0};
 r.shotPipeline={label:'Existing shot pipeline'};let time=0;const render=()=>{f.reset();r.render(1/60,time+=1/60);};
 try{
  r.setWorld(world);r.setMissileThrust(thrust);render();const cold=f.allocated.length;
  render();expect(r.missileThrustBytes).toBe(0);expect(r.missileThrustInstances).toBeNull();expect(r.missileThrustUploadBytes).toBe(0);expect(f.allocated.length).toBe(cold);expect(r.bloom).toBeNull();
  thrust.instanceCount=2;thrust.lightCount=1;thrust.lightData.set([10,30,10,32,1,.61,.26,3],4);render();const buffer=r.missileThrustInstances,bloom=r.bloom;
  expect(buffer.size).toBe(MAX_MISSILE_THRUST_INSTANCES*MISSILE_THRUST_FLOATS*4);expect(r.missileThrustBytes).toBe(MAX_MISSILE_THRUST_INSTANCES*MISSILE_THRUST_FLOATS*4);expect(r.missileThrustUploadBytes).toBe(128);expect(f.writes.filter(w=>w.buffer===buffer).map(w=>w.bytes)).toEqual([128]);
  expect(labels(f)).toEqual([OPAQUE,...BLOOM,DISPLAY]);expect(r.localLightCount).toBe(1);expect(r.missileLightCount).toBe(1);expect(r.arcLightCount).toBe(0);expect(r.localLightUploadBytes).toBe(48);expect(f.writes.filter(w=>w.buffer===r.shotUniform).map(w=>w.bytes)).toEqual([48]);
  expect(f.passes.find(p=>p.label===DISPLAY).direct.filter(d=>d.pipeline===r.shotPipeline).map(d=>d.args)).toEqual([[6,2]]);
  expect(f.passes.find(p=>p.label===BLOOM[0]).direct.filter(d=>d.pipeline===bloom.shotPipeline).map(d=>d.args)).toEqual([[6,2]]);
  const allocated=f.allocated.length;thrust.instanceCount=thrust.lightCount=0;render();expect(labels(f)).toEqual([OPAQUE,DISPLAY]);expect(bloom.active).toBe(false);expect(r.localLightCount).toBe(0);expect(r.missileLightCount).toBe(0);expect(r.localLightUploadBytes).toBe(16);expect(new Float32Array(r.shotUniform.data.buffer)[0]).toBe(0);expect(r.missileThrustUploadBytes).toBe(0);expect(f.writes.some(w=>w.buffer===buffer)).toBe(false);expect(r.missileThrustInstances).toBe(buffer);
  render();expect(labels(f)).toEqual([DISPLAY]);expect(r.localLightUploadBytes).toBe(0);expect(f.writes.some(w=>w.buffer===r.shotUniform)).toBe(false);
  thrust.instanceCount=4;thrust.lightCount=2;render();expect(r.missileThrustInstances).toBe(buffer);expect(r.missileThrustUploadBytes).toBe(256);expect(r.localLightUploadBytes).toBe(80);expect(f.allocated.length).toBe(allocated);
  r.setMissileThrust(null);expect(r.missileThrust).toBeNull();expect(r.missileThrustInstances).toBeNull();expect(r.missileThrustBytes).toBe(0);expect(r.missileLightCount).toBe(0);expect(buffer.destroyCalls).toBe(1);render();expect(labels(f)).toEqual([OPAQUE,DISPLAY]);expect(r.localLightCount).toBe(0);expect(r.localLightUploadBytes).toBe(16);
  r.setMissileThrust(thrust);render();const replacement=r.missileThrustInstances;expect(replacement).not.toBe(buffer);r.clearWorld();expect(replacement.destroyCalls).toBe(1);expect(r.missileThrust).toBeNull();expect(r.missileThrustBytes).toBe(0);
 }finally{f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(f.textures.every(texture=>texture.destroyCalls===1)).toBe(true);
});

test('missile coast clears its bloom contribution while ordinary flashes and steady model lights remain independent',async()=>{
 const model=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json(),level=newLevel('missile-bloom');level.size=[3,2];level.environment=defaultEnvironment();level.placements=[{id:'turret',model:model.id,variant:'base',box:[1,0,1],turn:0}];
 const world=buildWorld(level,new Map([[model.id,model]])),f=mockRenderer(),r=f.r,thrust={instanceData:new Float32Array(MAX_MISSILE_THRUST_INSTANCES*MISSILE_THRUST_FLOATS),instanceCount:2,lightCount:1,lightData:new Float32Array(4+MAX_MISSILE_LIGHTS*8)};
 let time=0;const render=()=>{f.reset();r.render(1/60,time+=1/60);};
 try{
  r.setWorld(world);r.setMissileThrust(thrust);f.effects.emit(identity(),[[0,0,0],[2,0,0]],0);f.effects.prepare();render();const b=r.bloom,lights=r.localLightCount;
  expect(f.passes.find(p=>p.label===BLOOM[0]).direct.filter(d=>d.pipeline===b.shotPipeline).map(d=>d.args)).toEqual([[6,4],[6,2]]);
  thrust.instanceCount=thrust.lightCount=0;render();expect(r.localLightCount).toBe(lights-1);expect(r.missileLightCount).toBe(0);expect(f.passes.find(p=>p.label===BLOOM[0]).direct.filter(d=>d.pipeline===b.shotPipeline).map(d=>d.args)).toEqual([[6,4]]);
  f.effects.reset();render();expect(b.active).toBe(true);expect(f.passes.find(p=>p.label===BLOOM[0]).direct.map(d=>d.pipeline)).toEqual([b.extractPipeline]);
  render();expect(labels(f)).toEqual([DISPLAY]);expect(r.missileThrustUploadBytes).toBe(0);
 }finally{f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
});

test('plasma links allocate lazily, refresh colour and bloom only, and release every scene reference',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld(),links=new PlasmaLinks();
 try{
  r.setWorld(world);r.setPlasmaLinks(links);r.render(0,0);expect(r.plasmaBytes).toBe(0);expect(r.plasmaLightData).toBeNull();expect(r.arcPipeline).toBeUndefined();
  links.setLinks([{source:[12,34,12],target:[24,35,12]}]);f.reset();r.render(0,0);
  expect(r.arcBytes).toBe(0);expect(r.arcInstances).toBeNull();expect(r.arcLightBuffer).toBeNull();expect(r.plasmaBytes).toBe(PLASMA_INSTANCE_BYTES+COMBINED_TUBE_LIGHT_BYTES);
  expect(r.plasmaUploadBytes).toBe(32*48+(4+ARC_LIGHT_FLOATS)*4);expect(r.plasmaLightCount).toBe(1);expect(r.lightGroup.entries[2].resource.buffer).toBe(r.plasmaLightBuffer);expect(labels(f)).toEqual([OPAQUE,...BLOOM,DISPLAY]);
  expect(f.passes.find(p=>p.label===DISPLAY).direct.some(draw=>draw.pipeline===r.arcPipeline&&draw.args[1]===32)).toBe(true);
  expect(f.passes.find(p=>p.label===BLOOM[0]).direct.some(draw=>draw.pipeline===r.bloom.arcPipeline&&draw.args[1]===32)).toBe(true);
  const buffers=[r.plasmaInstances,r.plasmaLightBuffer],merged=r.plasmaLightData,count=f.allocated.length;
  links.advance(.1);links.prepare();f.reset();r.render(.1,.1);expect(f.allocated.length).toBe(count);expect(r.plasmaLightData).toBe(merged);expect(labels(f)).toEqual([OPAQUE,...BLOOM,DISPLAY]);
  r.setPlasmaLinks(null);expect(r.plasmaBytes).toBe(0);expect(r.plasmaLinks).toBeNull();expect(r.plasmaLightData).toBeNull();expect(buffers.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(r.lightGroup.entries[2].resource.buffer).toBe(r.emptyArcLights);
  f.reset();r.render(0,.1);expect(r.bloom.active).toBe(false);expect(r.plasmaUploadBytes).toBe(0);
  r.setPlasmaLinks(links);r.render(0,.1);const replacements=[r.plasmaInstances,r.plasmaLightBuffer];r.clearWorld();expect(r.plasmaLinks).toBeNull();expect(replacements.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(r.plasmaBytes).toBe(0);
 }finally{links.dispose();f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
});

test('all plasma links coexist with primary and secondary combat Arcs, and detached plasma cannot resurrect expired arc light',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld(),links=new PlasmaLinks(),arcs=new ArcEffects(()=>.5);
 try{
  r.setWorld(world);r.setArcEffects(arcs);
  for(let i=0;i<MAX_ARC_STRIKES;i++)arcs.emit([12+i,40,12],[55+i,26,20],[-1,0,0],0,null,null,i>=MAX_ARC_STRIKES/2);
  arcs.prepare();r.render(0,0);expect(r.arcLightCount).toBe(MAX_ARC_STRIKES);const arcBuffer=r.arcLightBuffer,arcBytes=r.arcBytes;
  links.setLinks(Array.from({length:MAX_PLASMA_LINKS},(_,i)=>({source:[12,34,12+i],target:[24,35,12+i]})));r.setPlasmaLinks(links);f.reset();r.render(0,0);
  const merged=new Float32Array(r.plasmaLightBuffer.data.buffer);expect(merged[0]).toBe(MAX_ARC_STRIKES+MAX_PLASMA_LINKS);expect(r.arcBytes).toBe(arcBytes);expect(arcs.strikeCount).toBe(MAX_ARC_STRIKES);
  expect(merged.slice(4,4+MAX_ARC_STRIKES*ARC_LIGHT_FLOATS)).toEqual(arcs.lightData.slice(4));expect(merged.slice(4+MAX_ARC_STRIKES*ARC_LIGHT_FLOATS)).toEqual(links.lightData.slice(4));
  // The activation frame uploads Arc before creating the merged binding;
  // subsequent frames write only the bound combined prefix.
  f.reset();r.render(0,0);expect(f.writes.some(write=>write.buffer===arcBuffer)).toBe(false);
  arcs.advance(ARC_SECONDS);arcs.prepare();links.advance(ARC_SECONDS);links.prepare();r.render(ARC_SECONDS,ARC_SECONDS);expect(merged[0]).toBe(MAX_PLASMA_LINKS);expect(r.arcLightCount).toBe(0);
  expect(new Float32Array(arcBuffer.data.buffer)[0]).toBe(MAX_ARC_STRIKES);
  r.setPlasmaLinks(null);expect(new Float32Array(arcBuffer.data.buffer)[0]).toBe(0);expect(r.lightGroup.entries[2].resource.buffer).toBe(arcBuffer);r.render(0,ARC_SECONDS);
 }finally{links.dispose();f.cleanup();disposeWorld(world);}
});

test('empty plasma replacement uploads one cleared light header and returns to idle work',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld(),links=new PlasmaLinks();
 try{
  r.setWorld(world);links.setLinks([{source:[12,34,12],target:[24,35,12]}]);r.setPlasmaLinks(links);r.render(0,0);const lightBuffer=r.plasmaLightBuffer;
  links.setLinks([]);f.reset();r.render(0,0);expect(new Float32Array(lightBuffer.data.buffer)[0]).toBe(0);expect(r.plasmaUploadBytes).toBe(16);expect(r.bloom.active).toBe(false);expect(labels(f)).toEqual([OPAQUE,DISPLAY]);
  f.reset();r.render(0,0);expect(r.plasmaUploadBytes).toBe(0);expect(labels(f)).toEqual([DISPLAY]);expect(f.writes.some(write=>write.buffer===lightBuffer)).toBe(false);
 }finally{links.dispose();f.cleanup();disposeWorld(world);}
});

test('frozen plasma reuses uploads and bloom, but camera, same-time replacements and Arc expiry still refresh',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld(),links=new PlasmaLinks(),arcs=new ArcEffects(()=>.5);
 try{
  r.setWorld(world);links.setLinks([{source:[12,34,12],target:[24,35,12]}]);r.setPlasmaLinks(links);r.setArcEffects(arcs);r.render(0,0);
  const vertex=r.plasmaInstances,light=r.plasmaLightBuffer,images=f.textures.length,buffers=f.allocated.length;
  f.reset();links.advance(0);links.prepare();r.render(0,0);expect(r.plasmaUploadBytes).toBe(0);expect(labels(f)).toEqual([DISPLAY]);expect(r.bloom.active).toBe(true);expect(f.passes[0].direct.some(call=>call.args[1]===links.instanceCount)).toBe(true);
  r.requestDraw();f.reset();r.render(0,0);expect(r.plasmaUploadBytes).toBe(0);expect(labels(f)).toContain(BLOOM[0]);expect(f.textures.length).toBe(images);expect(f.allocated.length).toBe(buffers);
  arcs.emit([12,40,12],[55,26,20],[-1,0,0],0);arcs.prepare();f.reset();r.render(0,0);expect(new Float32Array(light.data.buffer)[0]).toBe(2);expect(f.writes.some(w=>w.buffer===vertex)).toBe(false);expect(labels(f)).toContain(BLOOM[0]);
  arcs.advance(ARC_SECONDS);arcs.prepare();r.render(0,0);expect(new Float32Array(light.data.buffer)[0]).toBe(1);
  f.reset();r.render(0,0);expect(r.plasmaUploadBytes).toBe(0);expect(f.writes.some(w=>w.buffer===light)).toBe(false);
  links.setLinks([{source:[12,34,12],target:[48,35,12]}]);f.reset();r.render(0,0);expect(f.writes.some(w=>w.buffer===vertex)).toBe(true);expect(labels(f)).toContain(BLOOM[0]);
 }finally{links.dispose();f.cleanup();disposeWorld(world);}
});

test('inspection sampling skips JSON only while rendering and simulation still advance',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld();
 try{
  r.inspect=true;r.setWorld(world);r.render(0,0);const first=r.canvas.dataset.inspection,frames=r.frames;
  r.render(.1,.1,false);expect(r.frames).toBe(frames+1);expect(r.elapsedSeconds).toBe(.1);expect(r.canvas.dataset.inspection).toBe(first);
  r.render(.1,.2);expect(r.frames).toBe(frames+2);expect(JSON.parse(r.canvas.dataset.inspection).elapsedSeconds).toBe(.2);
 }finally{f.cleanup();disposeWorld(world);}
});

test('a separately sized player renderer retains72 authored lights, specializes lit effects and uploads every reserved slot',async()=>{
 const models=new Map(await Promise.all(['dog','turret-study'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()]))),level=newLevel('player-capacity');level.size=[20,16];level.environment=defaultEnvironment();
 level.placements=Array.from({length:16},(_,i)=>({id:'gun-'+i,model:'turret-study',variant:i%2?'upgrade1':'base',box:[i+1,0,0],turn:0}));
 const actors=Array.from({length:6},(_,i)=>({id:'dog-'+i,model:'dog',variant:'base'})),world=buildWorld(level,models,{actors}),f=mockRenderer({modelLightCapacity:72,strictModelLights:true}),r=f.r;
 try{
  r.setWorld(world);r.mergeLocalLights();expect(r.modelLights.authoredCount).toBe(72);expect(r.modelLights.count).toBe(72);expect(r.modelLights.overflow).toBe(0);expect(r.shotUniform.size).toBe(3856);
  for(const actor of actors)r.setActorVisible(actor.id,false);r.mergeLocalLights();expect(r.modelLights.count).toBe(48);
  for(const actor of actors)r.setActorVisible(actor.id,true);r.mergeLocalLights();expect(r.modelLights.count).toBe(72);
  r.ensureDamageCubes();r.ensureDamageParticles();expect(r.damageColorPipeline.fragment.module.code).toContain('array<ShotLight,120>');expect(r.damageSmokePipeline.fragment.module.code).toContain('shotLights.count.x),120u');
  f.effects.lightCount=8;r.damageEffects={lightCount:4,lightData:new Float32Array(36)};r.missileThrust={lightCount:36,lightData:new Float32Array(292)};
  f.reset();r.mergeLocalLights();expect(r.localLightCount).toBe(120);expect(r.localLightUploadBytes).toBe(3856);expect(f.writes.find(w=>w.buffer===r.shotUniform).bytes).toBe(3856);
  r.damageEffects=r.missileThrust=null;r.clearWorld();expect(r.modelLights).toBeNull();expect(new Float32Array(r.shotUniform.data.buffer).every(n=>n===0)).toBe(true);
 }finally{r.damageEffects=r.missileThrust=null;f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
});

test('Drone perspective renders sharply to the display without a lens pass or extra viewport image',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld();
 try{
  r.setWorld(world);r.render(0,0);const buffers=f.allocated.length,textures=f.textures.length;expect(r.frameData[71]).toBe(0);
  r.camera.mode='live';r.camera.position.set([80,120,80]);r.camera.pitch=.7;r.requestDraw();f.reset();r.render(1/60,1);
  expect(labels(f)).not.toContain('Camera depth of field');expect(labels(f).at(-1)).toBe(DISPLAY);expect(f.allocated.length).toBe(buffers);expect(f.textures.length).toBe(textures);expect(r.frameData[71]).toBe(1);
  f.reset();r.render(0,1);expect(labels(f)).toEqual([DISPLAY]);
  r.camera.frame();r.render(0,1);expect(r.frameData[71]).toBe(0);expect(f.allocated.length).toBe(buffers);expect(f.textures.length).toBe(textures);
 }finally{f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(f.textures.every(texture=>texture.destroyCalls===1)).toBe(true);
});

test('bloom shares the player light capacity and excludes smoke and water from blast emission',()=>{
 const f=mockRenderer({modelLightCapacity:128}),r=f.r,world=smallWorld();
 const damage={cubeCount:0,cubeRevision:0,cubeData:new Float32Array(20),smokeCount:1,waterParticleCount:2,blastCount:1,particleCount:4,particleData:new Float32Array(48),lightCount:0,lightData:new Float32Array(36)};
 try{
  r.setWorld(world);r.setDamageEffects(damage);r.render(1/60,0);
  const bloom=r.bloom,code=bloom.compositePipeline.fragment.module.code;
  expect(code).toContain('array<ShotLight,176>');expect(code).toContain('min(u32(shotLights.count.x),176u)');expect(code).not.toContain('array<ShotLight,77>');
  const emission=f.passes.find(pass=>pass.label===BLOOM[0]).direct.find(draw=>draw.pipeline===bloom.blastPipeline);
  expect(emission.args).toEqual([6,1,0,3]);
  const display=f.passes.find(pass=>pass.label===DISPLAY).direct.find(draw=>draw.pipeline===r.damageBlastPipeline);expect(display.args).toEqual([6,1,0,3]);
  r.dispose();r.dispose();expect(()=>r.fail('Late error from a retired graphics device.')).not.toThrow();expect(r.camera.listeners).toHaveLength(0);expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
 }finally{f.cleanup();disposeWorld(world);}
});

test('Zone A vista is isolated, cached, resized, relit and released across zone changes',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld();world.level.id='moss-01';world.level.zone='A';
 try{
  r.setWorld(world);r.render(0,0);const vista=r.vista,geometry=vista.vertices,first=vista.color;
  expect(r.opaqueBackgroundColor).toEqual({r:0,g:0,b:0,a:0});expect(vista.vertexCount).toBeGreaterThan(50000);expect(labels(f)).toContain('Zone A distant vista');expect(r.frameData[75]).toBe(1);expect(r.screenGroup.entries.find(e=>e.binding===6).resource).toBe(vista.view);
  f.reset();r.render(0,0);expect(labels(f)).toEqual([DISPLAY]);expect(f.writes.some(write=>write.buffer===geometry)).toBe(false);
  r.requestDraw();f.reset();r.render(0,0);expect(labels(f)).toContain('Zone A distant vista');
  r.setLightingColors('#708ABA','#263754','#263754');f.reset();r.render(0,0);expect(labels(f)).toContain('Zone A distant vista');
  r.canvas.clientWidth=1001;r.canvas.clientHeight=701;r.render(0,0);expect(first.destroyCalls).toBe(1);expect(vista.width).toBe(751);expect(vista.height).toBe(526);expect(vista.targetBytes).toBe(751*526*8);
  world.level.zone='B';r.setWorld(world);f.reset();r.render(0,0);expect(r.vista).toBeNull();expect(r.opaqueBackgroundColor).toEqual({...r.backgroundColor,a:0});expect(geometry.destroyCalls).toBe(1);expect(r.frameData[75]).toBe(0);expect(labels(f)).not.toContain('Zone A distant vista');expect(r.screenGroup.entries.find(e=>e.binding===6).resource).toBe(r.resolvedColorView);
  for(const [zone,id]of [['B','ochre-01'],['C','ice-01'],['D','plum-01'],['A','moss-01']]){
   const previous=r.vista,buffer=previous?.vertices,colour=previous?.color;world.level.zone=zone;world.level.id=id;r.setWorld(world);f.reset();r.render(0,0);
   expect(r.vista.zone).toBe(zone);expect(labels(f)).toContain('Zone '+zone+' distant vista');expect(r.frameData[75]).toBe(1);expect(r.vista.width).toBe(Math.ceil(1001*.75));if(buffer){expect(buffer.destroyCalls).toBe(1);expect(colour.destroyCalls).toBe(1);}
   f.reset();r.render(0,0);expect(labels(f)).toEqual([DISPLAY]);
  }
  expect(r.vista).not.toBe(vista);r.clearWorld();expect(r.vista).toBeNull();
 }finally{f.cleanup();disposeWorld(world);}
 expect(f.allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(f.textures.every(texture=>texture.destroyCalls===1)).toBe(true);
});

test('production GPU timing surrounds every submitted pass including vista, bloom, display and shockwaves',()=>{
 const f=mockRenderer(),r=f.r,world=smallWorld(),damage=new DamageEffects(()=>.5),record=[];world.level.zone='A';world.level.id='moss-01';
 const slot={},timer={reset(){record.push('reset');},setActive(active){record.push(active);},begin(){expect(f.passes).toHaveLength(0);record.push('begin');return slot;},end(encoder,value){expect(value).toBe(slot);record.push(labels(f));},submitted(value){expect(value).toBe(slot);expect(f.submissions.length).toBeGreaterThan(0);record.push('submitted');},dispose(){record.push('dispose');},read(){return {status:'pending'};}};r.gpuTimer=timer;
 try{
  r.setWorld(world);r.setDamageEffects(damage);Object.assign(damage.blasts[0],{active:true,age:.05,x:36,y:30,z:24,seed:0,config:ENEMY_STATS.dog.explosion});damage.activeBlasts=1;
  r.render(0,0);const span=record.find(Array.isArray);expect(span[0]).toBe('Zone A distant vista');expect(span).toContain(BLOOM[0]);expect(span).toContain(DISPLAY);expect(span.at(-1)).toBe('Explosion shockwave refraction');expect(record.at(-1)).toBe('submitted');
  r.setTimingActive(false);expect(record.at(-1)).toBe(false);record.length=0;r.resize(961,641);expect(record).toEqual(['reset']);record.length=0;r.clearWorld();expect(record).toEqual(['reset']);
 }finally{damage.reset();f.cleanup();disposeWorld(world);}expect(record).toContain('dispose');
});

test('hidden emission disables bloom while visible material emission without a model light still enables it',async()=>{
 const dog=await Bun.file(new URL('../assets/models/dog.json',import.meta.url)).json(),level=newLevel('hidden-emission');level.size=[3,2];level.environment=defaultEnvironment();
 const w=buildWorld(level,new Map([[dog.id,dog]]),{actors:[{id:'dog',model:dog.id,variant:'base',initiallyHidden:true}]}),f=mockRenderer(),r=f.r;
 try{
  r.setWorld(w);r.setActorVisible('dog',false);r.render(0,0);expect(r.visibleEmitters).toBe(0);expect(r.bloom).toBeNull();expect(labels(f)).not.toContain(BLOOM[0]);
  r.setActorVisible('dog',true);r.render(0,0);expect(r.visibleEmitters).toBeGreaterThan(0);expect(r.bloom.active).toBe(true);
  f.reset();r.setActorVisible('dog',false);r.render(0,0);expect(r.bloom.active).toBe(false);expect(labels(f)).not.toContain(BLOOM[0]);
  // Emission is a material property independent of castsLight metadata.
  const draw=r.draws.find(x=>x.emissive);draw.visibleCount=1;r.visibleEmitters=1;r.modelLights.count=0;f.reset();r.dirty=true;r.render(0,0);expect(r.bloom.active).toBe(true);expect(labels(f)).toContain(BLOOM[0]);
 }finally{f.cleanup();disposeWorld(w);}
});

test('planar capture shares scene buffers and shadows, caches static frames and retires on scene release',()=>{
 const f=mockRenderer({waterReflections:'planar'}),r=f.r,w=smallWorld();
 try{
  r.setWorld(w);r.render(0,0);const p=r.planar,bufferCount=r.sceneBuffers.size;expect(p).not.toBeNull();expect(p.width).toBe(480);expect(p.height).toBe(320);expect(p.bytes).toBe(480*320*8);
  expect(labels(f)).toContain('Planar water reflection');expect(r.frameData[91]).toBe(1);expect(r.screenGroup.entries.find(e=>e.binding===7).resource).toBe(p.view);
  f.reset();r.render(0,1);expect(labels(f)).toEqual([DISPLAY]);expect(r.planarDraws).toBe(0);expect(r.sceneBuffers.size).toBe(bufferCount);
  r.ssr=false;r.setLightingColors('#102030','#405060');f.reset();r.render(0,1);expect(labels(f)).not.toContain('Planar water reflection');expect(p.valid).toBe(false);
  f.reset();r.ssr=true;r.render(0,1);expect(labels(f)).toContain('Planar water reflection');expect(labels(f)).not.toContain(OPAQUE);
  f.reset();r.camera.yaw+=.1;r.requestDraw();r.render(0,1);expect(labels(f)).toContain('Planar water reflection');expect(labels(f)).not.toContain(SHADOW);
  f.reset();r.camera.mode='live';r.camera.position.set([100,50,100]);r.camera.yaw=Math.PI;r.camera.pitch=0;r.requestDraw();r.render(0,1);expect(labels(f)).not.toContain('Planar water reflection');
  const color=p.color,uniform=p.uniform;r.clearWorld();expect(color.destroyCalls).toBe(1);expect(uniform.destroyCalls).toBe(0);expect(r.planar).toBe(p);expect(p.bytes).toBe(0);r.setWorld(w);r.camera.frame();r.render(0,0);expect(r.planar).toBe(p);expect(p.uniform).toBe(uniform);
 }finally{f.cleanup();disposeWorld(w);}
 expect(f.allocated.every(b=>b.destroyCalls===1)).toBe(true);expect(f.textures.every(t=>t.destroyCalls===1)).toBe(true);
});

test('dry scenes use tiny inactive water bindings and skip the empty water pass, including wet/dry reloads',()=>{
 const f=mockRenderer(),r=f.r,wet=smallWorld(),level=newLevel('dry');level.size=[3,2];level.environment=defaultEnvironment();const dry=buildWorld(level,new Map());
 try{
  r.setWorld(dry);r.render(0,0);expect(r.frameData[91]).toBe(-1);expect(r.waterTargetActive).toBe(false);expect(labels(f)).not.toContain(WATER);expect(r.targetBytes).toBe(960*640*56+8+2048*2048*4);
  r.setWorld(wet);f.reset();r.render(0,0);expect(r.waterTargetActive).toBe(true);expect(labels(f)).toContain(WATER);expect(r.targetBytes).toBe(960*640*64+2048*2048*4);
  r.setWorld(dry);f.reset();r.render(0,0);expect(r.waterTargetActive).toBe(false);expect(labels(f)).not.toContain(WATER);
 }finally{f.cleanup();disposeWorld(wet);disposeWorld(dry);}
});

test('play effect preparation awaits asynchronous pipelines once and leaves first destruction allocation-free',async()=>{
 const f=mockRenderer(),r=f.r,w=smallWorld(),d={cubeCount:0,cubeRevision:0,cubeData:new Float32Array(20),particleCount:0,particleData:new Float32Array(48),lightCount:0,shockwaveCount:0,shockwaveData:new Float32Array(8),blastCount:0,smokeCount:0};
 const device=r.device;let asyncPipelines=0;const createAsync=device.createRenderPipelineAsync;device.createRenderPipelineAsync=async descriptor=>{asyncPipelines++;return createAsync(descriptor);};
 try{
  device.createRenderPipeline=()=>{throw new Error('Synchronous compilation during loading');};
  await Promise.all([r.prepareDeathEffects(),r.prepareDeathEffects()]);expect(asyncPipelines).toBe(17);expect(r.deathEffectsPrepared).toBe(true);
  expect(r.damageDepthPipeline.then).toBeUndefined();expect(r.shockwavePipeline.then).toBeUndefined();expect(r.bloom.blastPipeline.then).toBeUndefined();
  r.setWorld(w);r.setDamageEffects(d);r.render(0,0);expect(r.bloom.active).toBe(false);expect(labels(f)).not.toContain('Explosion shockwave refraction');
  const buffers=f.allocated.length,textures=f.textures.length;d.cubeCount=1;d.cubeRevision++;d.particleCount=d.blastCount=d.shockwaveCount=1;f.reset();r.render(0,.01);
  expect(f.allocated.length).toBe(buffers);expect(f.textures.length).toBe(textures);expect(labels(f)).toContain('Explosion shockwave refraction');
  d.blastCount=d.particleCount=d.shockwaveCount=0;
  r.canvas.clientWidth=1000;d.cubeCount=0;d.cubeRevision++;r.render(0,.03);const resized=f.textures.length;
  d.blastCount=d.shockwaveCount=d.particleCount=1;r.render(0,.04);expect(f.textures.length).toBe(resized);expect(asyncPipelines).toBe(17);
 }finally{f.cleanup();disposeWorld(w);}
 expect(f.allocated.every(b=>b.destroyCalls===1)).toBe(true);expect(f.textures.every(t=>t.destroyCalls===1)).toBe(true);
});

test('failed asynchronous effect compilation rejects loading instead of declaring combat effects ready',async()=>{
 const f=mockRenderer(),r=f.r;
 try{r.device.createRenderPipelineAsync=async()=>{throw new Error('Effect pipeline failed');};await expect(r.prepareDeathEffects()).rejects.toThrow('Effect pipeline failed');expect(r.deathEffectsPrepared).not.toBe(true);}
 finally{f.cleanup();}
});

test('disposing during effect preparation prevents a late ready state and releases every allocated pool',async()=>{
 const f=mockRenderer(),r=f.r,pending=[];r.device.createRenderPipelineAsync=descriptor=>new Promise(resolve=>pending.push(()=>resolve(descriptor)));
 try{
  const preparation=r.prepareDeathEffects();expect(pending).toHaveLength(17);r.dispose();const buffers=f.allocated.length;
  for(const finish of pending)finish();expect(await preparation).toBe(false);expect(r.deathEffectsPrepared).not.toBe(true);expect(f.allocated.length).toBe(buffers);expect(f.allocated.every(b=>b.destroyCalls===1)).toBe(true);
 }finally{f.cleanup();}
});

test('dense particle trails reuse main and mirrored smoke draws without a volume pass',async()=>{
 const f=mockRenderer({waterReflections:'planar'}),r=f.r,w=smallWorld(),damage=new DamageEffects(()=>.5);
 try{
  await r.prepareDeathEffects();r.setWorld(w);damage.setWorld(w,[]);r.setDamageEffects(damage);
  for(let i=0;i<100;i++)damage.missileTrail(24+i*.1,30,24,i/100);r.render(0,1);
  expect(damage.smokeCount).toBe(100);expect(r.damageParticleBuffer.size).toBe(MAX_DAMAGE_PARTICLES*DAMAGE_PARTICLE_FLOATS*4);expect(r.reflectionEffects.smokeBuffer.size).toBe(MAX_SMOKE*DAMAGE_PARTICLE_FLOATS*4);
  expect(labels(f)).toContain('Planar water reflection');expect(labels(f).some(label=>label.includes('Volume'))).toBe(false);
  const mirror=f.passes.find(p=>p.label==='Planar water reflection');expect(mirror.direct.some(call=>call.pipeline.label==='Mirrored sorted smoke'&&call.args[1]===100)).toBe(true);
  expect(mirror.descriptor.depthStencilAttachment.depthStoreOp).toBe('discard');
  const buffers=f.allocated.length;damage.advance(2);r.render(0,3);expect(damage.smokeCount).toBe(0);expect(f.allocated.length).toBe(buffers);
 }finally{f.cleanup();disposeWorld(w);}
});
