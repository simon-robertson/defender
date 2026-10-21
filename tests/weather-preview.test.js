// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {MAX_LOCAL_LIGHTS} from '../shared/shot-effects.js';
import {test,expect} from 'bun:test';
import {WorldRenderer} from '../engine/renderer.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {PoseRig} from '../engine/rig.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {DogPreview,DOG_PREVIEW_ACTORS} from '../game/dog-preview.js';
import {TURRET_MUZZLES,TURRET_RECOIL,TURRET_PITCH} from '../shared/arsenal.js';

async function fixture(zone,enabled=true){
 const id={A:'moss-01',B:'ochre-01',C:'ice-01',D:'plum-01'}[zone];
 const level=await Bun.file(new URL(`../docs/landscape-reset-2026-10-18/previous-levels/${id}.json`,import.meta.url)).json();
 if(zone!=='B')level.environment.weather={enabled};
 const actors=zone==='A'?DOG_PREVIEW_ACTORS:[],ids=[...new Set([...level.placements.map(p=>p.model),...actors.map(p=>p.model)])];
 const models=new Map(await Promise.all(ids.map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
 const source=JSON.stringify(level),world=buildWorld(level,models,{actors});
 const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}};freeze(level);
 return {world,level,source};
}

function withBufferUsage(run){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'GPUBufferUsage');
 if(!descriptor)Object.defineProperty(globalThis,'GPUBufferUsage',{configurable:true,value:{COPY_DST:8,INDEX:16,VERTEX:32,UNIFORM:64,STORAGE:128}});
 try{return run();}finally{if(!descriptor)delete globalThis.GPUBufferUsage;}
}

function rendererFixture(){
 const allocated=[],writes=[],modules=[],pipelines=[],draws=[];
 const device={destroyed:false,limits:{maxTextureDimension2D:4096},
 createShaderModule(descriptor){modules.push(descriptor);return descriptor;},createPipelineLayout(descriptor){return descriptor;},
 createRenderPipeline(descriptor){pipelines.push(descriptor);return descriptor;},
 createCommandEncoder(){return {beginComputePass(){throw new Error('Weather must not dispatch compute.');},beginRenderPass(){let pipeline;return {setPipeline(value){pipeline=value;},setBindGroup(){},setVertexBuffer(){},setIndexBuffer(){},draw(...args){draws.push({pipeline,args});},drawIndexed(...args){draws.push({pipeline,args});},end(){}};},finish(){return {};}};},
 createBindGroup(descriptor){return descriptor;},createBuffer({size,usage}){
  const buffer={size,usage,data:new Uint8Array(size),destroyCalls:0,destroy(){if(this.destroyCalls++)throw new Error('GPU buffer destroyed twice.');}};
  allocated.push(buffer);return buffer;
 },queue:{writeBuffer(buffer,offset,data,dataOffset=0,size){
  if(!buffer||buffer.destroyCalls)throw new Error('Upload to a missing or destroyed GPU buffer.');
  const stride=data.BYTES_PER_ELEMENT??1,start=dataOffset*stride,length=size===undefined?data.byteLength-start:size*stride;
  buffer.data.set(new Uint8Array(data.buffer,data.byteOffset+start,length),offset);writes.push(buffer);
 },submit(){}},destroy(){this.destroyed=true;}};
 const canvas={width:960,height:640,clientWidth:960,clientHeight:640,dataset:{},addEventListener(){},focus(){}};
 const renderer=new WorldRenderer(canvas,message=>{throw new Error(message);});renderer.device=device;renderer.format='rgba8unorm';renderer.targets=[];renderer.context={getCurrentTexture:()=>({createView:()=>({})})};
 // Bloom has its own renderer/GPU checks; isolate weather setup and work here.
 renderer.bloom={active:false,draws:0,render(){},clearTargets(){},dispose(){}};
 const effects=new ShotEffects(()=>.5);renderer.setShotEffects(effects);
 renderer.uniform=device.createBuffer({size:368,usage:GPUBufferUsage.UNIFORM});
 renderer.shotUniform=device.createBuffer({size:(4+MAX_LOCAL_LIGHTS*8)*4,usage:GPUBufferUsage.UNIFORM});
 renderer.shotInstances=device.createBuffer({size:effects.instanceData.byteLength,usage:GPUBufferUsage.VERTEX});
 return {renderer,allocated,writes,effects,modules,pipelines,draws};
}

const snapshotPoses=world=>world.entries.map(entry=>entry.transforms.map(matrix=>matrix.slice()));
const cameraState=c=>({mode:c.mode,yaw:c.yaw,pitch:c.pitch,radius:c.radius,position:Array.from(c.position),target:Array.from(c.target),eye:Array.from(c.eye),keys:[...c.keys],vp:Array.from(c.vp)});
const activeBytes=renderer=>[...renderer.sceneBuffers].reduce((total,buffer)=>total+buffer.size,0);

for(const zone of ['A','C','D'])test(`${zone} weather toggles restore buffers without resetting source, animated poses, camera, lighting or time`,async()=>{
 const {world,level,source}=await fixture(zone);
 withBufferUsage(()=>{
  const {renderer:r,allocated,writes,effects}=rendererFixture();let dogs;
  try{
   r.setWorld(world);const update=r.updateInstance.bind(r);dogs=new DogPreview(world,update);dogs.advance(.37);
   const rigData=[...world.rigs.values()].find(rig=>rig.model==='turret-study'),rig=new PoseRig(rigData,update);
   rig.setRotation('head',0,.72,0);rig.setRotation(TURRET_PITCH.part,-.3,0,0);rig.setTranslation(TURRET_RECOIL.part,0,0,.6);rig.update();
   effects.emit(rigData.instances.find(instance=>instance.part===TURRET_RECOIL.part).matrix,TURRET_MUZZLES.base,0);effects.advance(.01);effects.prepare();
   r.camera.toggleMode(()=>.4);r.camera.yaw+=.21;r.camera.pitch=.17;r.camera.keys.add('w');r.camera.advance(.1);r.camera.update(1.5);
   r.setLightingColors('#708ABA','#263754','#263754');r.elapsedSeconds=17.125;r.deltaSeconds=1/60;r.frames=19;r.shadowDirty=false;r.dirty=false;
   const ground=world.entries.find(entry=>entry.key==='ground'),draw=r.drawMap.get('ground');
   const originalGround=ground.mesh.vertices.slice(),originalIndices=ground.mesh.indices.slice();
   const count=r.sceneBuffers.size,bytes=r.bytes,gpuBytes=activeBytes(r),quads=world.quads,uniqueQuads=world.uniqueQuads;
   const field=()=>zone==='A'?r.rain:zone==='C'?r.snow:r.leaves,seedBuffer=()=>zone==='A'?r.rainInstances:zone==='C'?r.snowInstances:r.leafInstances;
   const initialSeeds=field().instanceData.slice();
   const stableBuffers=[...r.sceneBuffers].filter(buffer=>buffer!==draw.vertices&&buffer!==draw.indices&&buffer!==r.rainInstances&&buffer!==r.snowInstances&&buffer!==r.leafInstances);
   const stableData=stableBuffers.map(buffer=>buffer.data.slice()),poses=snapshotPoses(world),camera=r.camera,cameraBefore=cameraState(camera),groundHeights=camera.groundHeights;
   const lighting=r.frameData.slice(),lightVP=r.lightVP.slice(),background={...r.backgroundColor},rigs=world.rigs,actors=world.actors,visibility=world.visibility,water=world.water,waterDraw=r.waterDraw;
   const dogTime=dogs.time,dogStates=dogs.states.slice(),effectData=effects.instanceData.slice(),effectLights=effects.lightData.slice(),effectTime=effects.time;
   const frameData=r.frameData,shotUniform=r.shotUniform,shotInstances=r.shotInstances,uniform=r.uniform;
   for(let repetition=0;repetition<3;repetition++)for(const enabled of [false,true]){
    const oldField=field(),oldSeeds=seedBuffer(),oldVertices=draw.vertices,oldIndices=draw.indices;
    const created=r.createdSceneBuffers,destroyed=r.destroyedSceneBuffers;writes.length=0;r.dirty=false;
    expect(r.setWeather(enabled)).toBe(true);expect(r.dirty).toBe(true);expect(r.shadowDirty).toBe(false);
    expect(r.createdSceneBuffers-created).toBe(enabled?3:2);expect(r.destroyedSceneBuffers-destroyed).toBe(enabled?2:3);
    expect(oldVertices.destroyCalls).toBe(1);expect(oldIndices.destroyCalls).toBe(1);if(oldSeeds)expect(oldSeeds.destroyCalls).toBe(1);
    if(oldField){expect(oldField.instanceData).toBeNull();expect(oldField.disposed).toBe(true);}
    expect(r.sceneBuffers.size).toBe(count-(enabled?0:1));
    expect(activeBytes(r)).toBe(r.bytes+r.rainBytes+r.snowBytes+r.leafBytes);
    expect(writes.length).toBe(enabled?3:2);expect(writes.every(buffer=>buffer===draw.vertices||buffer===draw.indices||buffer===r.rainInstances||buffer===r.snowInstances||buffer===r.leafInstances)).toBe(true);
    for(let i=0;i<stableBuffers.length;i++){expect(r.sceneBuffers.has(stableBuffers[i])).toBe(true);expect(stableBuffers[i].destroyCalls).toBe(0);expect(stableBuffers[i].data).toEqual(stableData[i]);}
    expect(world.rigs).toBe(rigs);expect(world.actors).toBe(actors);expect(world.visibility).toBe(visibility);expect(world.water).toBe(water);expect(r.waterDraw).toBe(waterDraw);expect(snapshotPoses(world)).toEqual(poses);
    expect(r.camera).toBe(camera);expect(cameraState(camera)).toEqual(cameraBefore);expect(camera.groundHeights).toBe(groundHeights);
    expect(r.frameData).toBe(frameData);expect(r.frameData).toEqual(lighting);expect(r.lightVP).toEqual(lightVP);expect(r.backgroundColor).toEqual(background);
    expect(r.uniform).toBe(uniform);expect(r.shotUniform).toBe(shotUniform);expect(r.shotInstances).toBe(shotInstances);expect(r.elapsedSeconds).toBe(17.125);expect(r.deltaSeconds).toBe(1/60);expect(r.frames).toBe(19);
    expect(dogs.time).toBe(dogTime);for(let i=0;i<dogStates.length;i++)expect(dogs.states[i]).toBe(dogStates[i]);expect(effects.time).toBe(effectTime);expect(effects.instanceData).toEqual(effectData);expect(effects.lightData).toEqual(effectLights);
    expect(world.level).toBe(level);expect(JSON.stringify(level)).toBe(source);expect(level.environment.weather.enabled).toBe(true);expect(world.weather.enabled).toBe(enabled);
    expect((r.rain?.count??0)>0).toBe(enabled&&zone==='A');expect((r.snow?.count??0)>0).toBe(enabled&&zone==='C');expect((r.leaves?.count??0)>0).toBe(enabled&&zone==='D');
    if(enabled){expect(r.bytes).toBe(bytes);expect(activeBytes(r)).toBe(gpuBytes);expect(world.quads).toBe(quads);expect(world.uniqueQuads).toBe(uniqueQuads);expect(ground.mesh.vertices).toEqual(originalGround);expect(ground.mesh.indices).toEqual(originalIndices);expect(field().instanceData).toEqual(initialSeeds);}
    const unchangedCreated=r.createdSceneBuffers,unchangedDestroyed=r.destroyedSceneBuffers;writes.length=0;r.dirty=false;
    expect(r.setWeather(enabled)).toBe(false);expect(r.createdSceneBuffers).toBe(unchangedCreated);expect(r.destroyedSceneBuffers).toBe(unchangedDestroyed);expect(writes.length).toBe(0);expect(r.dirty).toBe(false);
   }
   r.clearWorld();expect(r.sceneBuffers.size).toBe(0);expect(r.bytes).toBe(0);expect(r.rainBytes).toBe(0);expect(r.snowBytes).toBe(0);expect(r.leafBytes).toBe(0);expect(r.leaves).toBeNull();expect(r.rain).toBeNull();expect(r.snow).toBeNull();expect(r.createdSceneBuffers).toBe(r.destroyedSceneBuffers);
   r.clearWorld();expect(r.createdSceneBuffers).toBe(r.destroyedSceneBuffers);
  }finally{dogs?.dispose();r.dispose();disposeWorld(world);}
  expect(allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(r.device.destroyed).toBe(true);
 });
});

test('unassigned B weather requests and invalid toggle input do not mutate or allocate a scene',async()=>{
 for(const zone of ['B']){
  const {world,level,source}=await fixture(zone);
  withBufferUsage(()=>{
   const {renderer:r,allocated,writes}=rendererFixture();
   try{
    r.setWorld(world);const buffers=[...r.sceneBuffers],bytes=r.bytes,weather=world.weather,ground=world.entries[0].mesh,created=r.createdSceneBuffers;writes.length=0;r.dirty=false;
    for(const enabled of [true,false,true,false])expect(r.setWeather(enabled)).toBe(false);
    for(const value of [undefined,null,0,1,'true'])expect(()=>r.setWeather(value)).toThrow('boolean');
    expect([...r.sceneBuffers]).toEqual(buffers);expect(r.createdSceneBuffers).toBe(created);expect(r.destroyedSceneBuffers).toBe(0);expect(writes.length).toBe(0);expect(r.bytes).toBe(bytes);expect(r.dirty).toBe(false);
    expect(world.weather).toBe(weather);expect(world.entries[0].mesh).toBe(ground);expect(world.level).toBe(level);expect(JSON.stringify(level)).toBe(source);expect(r.rain).toBeNull();expect(r.snow).toBeNull();expect(r.leaves).toBeNull();
    r.clearWorld();expect(r.setWeather(true)).toBe(false);expect(r.sceneBuffers.size).toBe(0);expect(r.createdSceneBuffers).toBe(r.destroyedSceneBuffers);
   }finally{r.dispose();disposeWorld(world);}
   expect(allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
  });
 }
});

for(const zone of ['A','B','C','D'])test(`${zone} authored-off rendering performs no weather setup, updates, uploads, draws or dispatches`,async()=>{
 const {world,source}=await fixture(zone,false),dpr=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio');
 Object.defineProperty(globalThis,'devicePixelRatio',{configurable:true,value:1});
 try{withBufferUsage(()=>{
  const {renderer:r,allocated,writes,modules,pipelines,draws}=rendererFixture();
  try{
   r.setWorld(world);r.ready=true;
   expect(r.rain).toBeNull();expect(r.snow).toBeNull();expect(r.leaves).toBeNull();
   expect(r.rainBytes+r.snowBytes+r.leafBytes).toBe(0);expect(modules.length).toBe(0);expect(pipelines.length).toBe(0);
   const coldCount=allocated.length,coldBuffers=[...r.sceneBuffers];writes.length=0;
   for(let frame=0;frame<5;frame++)r.render(1/60,frame/60);
   expect(allocated.length).toBe(coldCount);expect([...r.sceneBuffers]).toEqual(coldBuffers);expect(modules.length).toBe(0);expect(pipelines.length).toBe(0);
   expect(writes.every(buffer=>buffer===r.uniform||buffer===r.shotUniform)).toBe(true);expect(draws.some(draw=>draw.pipeline?.label?.startsWith('Lit '))).toBe(false);
   if(zone!=='B'){
    expect(r.setWeather(true)).toBe(true);expect(modules.length).toBe(1);expect(pipelines.length).toBe(1);
    const field=r.rain??r.snow??r.leaves,seed=r.rainInstances??r.snowInstances??r.leafInstances,pipeline=pipelines[0];
    expect(seed.usage&GPUBufferUsage.STORAGE).toBe(0);expect(r.sceneBuffers.size).toBe(coldBuffers.length+1);
    const seeds=field.instanceData.slice();writes.length=0;draws.length=0;r.render(.125,1);
    expect(field.time).toBe(.125);expect(field.instanceData).toEqual(seeds);expect(draws.filter(draw=>draw.pipeline===pipeline).length).toBe(1);expect(writes.includes(seed)).toBe(false);
    expect(r.setWeather(false)).toBe(true);expect(seed.destroyCalls).toBe(1);expect(field.disposed).toBe(true);
    field.advance=()=>{throw new Error('Disabled weather field was advanced.');};
    expect(r.rain).toBeNull();expect(r.snow).toBeNull();expect(r.leaves).toBeNull();expect(r.rainBytes+r.snowBytes+r.leafBytes).toBe(0);
    const afterOff=allocated.length;writes.length=0;draws.length=0;
    for(let frame=0;frame<5;frame++)r.render(1/60,2+frame/60);
    expect(allocated.length).toBe(afterOff);expect(writes.every(buffer=>buffer===r.uniform)).toBe(true);expect(draws.some(draw=>draw.pipeline===pipeline)).toBe(false);
    expect(modules.length).toBe(1);expect(pipelines.length).toBe(1);
    expect(r.setWeather(true)).toBe(true);expect(modules.length).toBe(1);expect(pipelines.length).toBe(1);expect((r.rain??r.snow??r.leaves).instanceData).toEqual(seeds);
   }
   expect(JSON.stringify(world.level)).toBe(source);
  }finally{r.dispose();disposeWorld(world);}
  expect(allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
 });}finally{if(dpr)Object.defineProperty(globalThis,'devicePixelRatio',dpr);else delete globalThis.devicePixelRatio;}
});

test('renderer initialisation compiles only scene/shot pipelines until weather is explicitly enabled',async()=>{
 const previous=new Map(),set=(name,value)=>{previous.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,value});};
 set('GPUBufferUsage',{COPY_DST:8,INDEX:16,VERTEX:32,UNIFORM:64,STORAGE:128});set('GPUShaderStage',{VERTEX:1,FRAGMENT:2});set('GPUTextureUsage',{RENDER_ATTACHMENT:1,TEXTURE_BINDING:2});
 set('ResizeObserver',class{observe(){}disconnect(){}});
 const {renderer:r,modules,pipelines,allocated}=rendererFixture(),device=r.device;
 device.addEventListener=()=>{};device.lost=new Promise(()=>{});device.createBindGroupLayout=descriptor=>descriptor;
 const createModule=device.createShaderModule.bind(device);device.createShaderModule=descriptor=>({...createModule(descriptor),getCompilationInfo:async()=>({messages:[]})});
 device.createRenderPipelineAsync=async descriptor=>{pipelines.push(descriptor);return descriptor;};
 device.createTexture=()=>({createView:()=>({}),destroy(){}});device.createSampler=()=>({});
 r.canvas.getContext=()=>({configure(){}});
 set('navigator',{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=> 'rgba8unorm'}});
 // The fixture's initial app buffers precede init and are not part of it.
 for(const buffer of allocated)buffer.destroy();allocated.length=0;
 try{
  await r.init();expect(modules.length).toBe(3);expect(pipelines.length).toBe(6);
  expect(modules.some(module=>module.label?.includes('weather'))).toBe(false);expect(pipelines.some(pipeline=>pipeline.label?.includes('weather'))).toBe(false);
  expect(r.rainPipeline).toBeUndefined();expect(r.snowPipeline).toBeUndefined();expect(r.leafPipeline).toBeUndefined();
  const rain=r.ensureWeatherPipeline('rain');expect(modules.length).toBe(4);expect(pipelines.length).toBe(7);expect(r.ensureWeatherPipeline('rain')).toBe(rain);expect(pipelines.length).toBe(7);
  r.ensureWeatherPipeline('snow');r.ensureWeatherPipeline('leaves');expect(modules.length).toBe(6);expect(pipelines.length).toBe(9);
  expect(allocated.length).toBe(4); // Frame, point-light, shot-instance and empty Arc-light buffers.
 }finally{
  r.dispose();for(const [name,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
 }
 expect(allocated.every(buffer=>buffer.destroyCalls===1)).toBe(true);
});
