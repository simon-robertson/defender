import {settlePipelineFields} from './pipeline-preparation.js';
import {PlanarReflection,waterPlane,waterInView} from './planar-reflection.js';
import {ReflectionEffects} from './reflection-effects.js';
import {ZoneVista,hasZoneVista} from './zone-vista.js';
import {GPUFrameTimer,requestRenderDevice} from './gpu-frame-timer.js';
import {Camera} from './camera.js';
import {levelLighting} from './environment.js';
import {lookAt,ortho,multiply} from '../shared/math.js';
import {geometry,composite,uniforms} from './shaders.js';
import {shotParticles,specializeLocalLights} from './shot-shaders.js';
import {ModelLights} from './model-lights.js';
import {BloomPasses} from './bloom.js';
import {damageCubes,damageParticles} from './damage-shaders.js';
import {shockwaveRefraction} from './shockwave-shaders.js';
import {WATER_RIPPLE_FLOATS} from '../shared/water-impact.js';
import {MAX_DAMAGE_CUBES,MAX_BLASTS,MAX_DAMAGE_PARTICLES,MAX_DAMAGE_LIGHTS,DAMAGE_CUBE_FLOATS,DAMAGE_PARTICLE_FLOATS,SHOCKWAVE_FLOATS} from '../shared/damage-effects.js';
import {MAX_LOCAL_LIGHTS,MAX_SHOT_LIGHTS,MAX_SHOT_INSTANCES,SHOT_INSTANCE_FLOATS} from '../shared/shot-effects.js';
import {arcParticles} from './arc-shaders.js';
import {ARC_EMPTY_LIGHT_BYTES,ARC_LIGHT_BYTES,ARC_LIGHT_FLOATS,ARC_INSTANCE_FLOATS,MAX_ARC_INSTANCES} from '../shared/arc-effects.js';
import {MAX_MISSILE_LIGHTS,MAX_MISSILE_THRUST_INSTANCES,MISSILE_THRUST_FLOATS} from '../shared/missile-flight.js';
import {GENERATOR_LIGHT_BYTES,GENERATOR_EMPTY_LIGHT_BYTES} from '../shared/generator-lights.js';
import {MAX_MODEL_LIGHTS,MAX_SUPPORTED_MODEL_LIGHTS} from '../shared/model-lights.js';

const linearColor=hex=>[1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
const vertexBuffers=[{arrayStride:44,attributes:[
 {shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},
 {shaderLocation:2,offset:24,format:'float32x3'},{shaderLocation:3,offset:36,format:'float32'},{shaderLocation:4,offset:40,format:'float32'}]},
 {arrayStride:64,stepMode:'instance',attributes:[5,6,7,8].map((shaderLocation,i)=>({shaderLocation,offset:i*16,format:'float32x4'}))}];

export class WorldRenderer {
 constructor(canvas,onError,{modelLightCapacity=MAX_MODEL_LIGHTS,strictModelLights=false,gpuTiming=false,waterReflections='planar',renderScale=1}={}){
  if(!Number.isInteger(modelLightCapacity)||modelLightCapacity<1||modelLightCapacity>MAX_SUPPORTED_MODEL_LIGHTS)throw new Error('Unsupported renderer model-light capacity.');
  if(!Number.isFinite(renderScale)||renderScale<=0||renderScale>1)throw new Error('Renderer scale must be greater than zero and at most one.');
  this.renderScale=renderScale;
  this.modelLightCapacity=modelLightCapacity;this.localLightCapacity=MAX_LOCAL_LIGHTS+modelLightCapacity-MAX_MODEL_LIGHTS;this.strictModelLights=strictModelLights;this.gpuTiming=gpuTiming;this.reflectionEffects=null;
  this.waterReflections=waterReflections;this.reflectionsEnabled=true;this.bloomEnabled=true;this.planar=null;this.visibleEmitters=0;this.waterHeight=null;this.waterBounds=null;this.deathEffectsPrepared=false;this.deathEffectsPreparation=null;
  this.canvas=canvas;this.onError=onError;this.draws=[];this.drawMap=new Map();this.frameData=new Float32Array(92);this.localLightData=new Float32Array(4+this.localLightCapacity*8);
  this.localLightCount=this.localLightUploadBytes=this.missileLightCount=0;this.hadTransientLights=false;this.modelLights=null;this.bloom=null;this.clearModelLightCopyCache();
  this.arcEffects=null;this.arcInstances=null;this.arcLightBuffer=null;this.arcBytes=0;this.arcLightCount=0;this.arcUploads=0;this.arcUploadBytes=0;
  this.generatorLights=null;this.generatorLightBuffer=null;this.generatorLightCount=this.generatorUploadBytes=this.generatorBytes=0;this.lastGeneratorRevision=undefined;
  this.missileThrust=null;this.missileThrustInstances=null;this.missileThrustBytes=this.missileThrustUploadBytes=0;
  this.damageCubeCount=0;this.damageParticleCount=0;this.damageBytes=0;this.lastDamageCubeRevision=-1;
  this.waterRippleData=new Float32Array(WATER_RIPPLE_FLOATS);this.hadWaterRipples=false;this.lastWaterRipples=null;this.lastWaterRippleRevision=null;
  this.shockwaveCount=0;this.shockwaveBytes=0;this.shockwaveTargetBytes=0;this.shockwaveData=new Float32Array(4+MAX_BLASTS*SHOCKWAVE_FLOATS);
  this.sceneBuffers=new Set();this.createdSceneBuffers=0;this.destroyedSceneBuffers=0;
  this.lightView=new Float32Array(16);this.lightProjection=new Float32Array(16);this.lightVP=new Float32Array(16);
  this.backgroundColor={r:.38,g:.43,b:.35,a:1};this.opaqueBackgroundColor={r:.38,g:.43,b:.35,a:0};
  this.camera=new Camera(canvas,()=>this.requestDraw());this.dirty=true;this.cameraDirty=true;this.depthDirty=true;this.waterDirty=true;this.uniformDirty=true;this.frames=0;this.ssr=true;
  // Descriptor trees are reused. Only resized attachment views and the current
  // presentation texture view change; command encoders remain frame-owned.
  this.depthPass={label:'Initial camera depth',colorAttachments:[],depthStencilAttachment:{view:null,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}};
  this.shadowPass={label:'Shadow map',colorAttachments:[],depthStencilAttachment:{view:null,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}};
  this.opaquePass={label:'Visible opaque surfaces',colorAttachments:[{view:null,resolveTarget:null,clearValue:this.opaqueBackgroundColor,loadOp:'clear',storeOp:'discard'},{view:null,resolveTarget:null,clearValue:{r:.5,g:1,b:.5,a:0},loadOp:'clear',storeOp:'discard'}],depthStencilAttachment:{view:null,depthReadOnly:true}};
  this.waterPass={label:'Nearest water surface',colorAttachments:[{view:null,clearValue:{r:.5,g:1,b:.5,a:0},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:null,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}};
  this.displayPass={label:'Water, reflections and display',colorAttachments:[{view:null,loadOp:'clear',storeOp:'store'}]};
  this.shockwavePass={label:'Explosion shockwave refraction',colorAttachments:[{view:null,loadOp:'clear',storeOp:'store'}]};
  // Loading clears go straight to the display texture, so use display RGB
  // matching the player's --deep (#15171a), independent of scene lighting.
  this.clearPass={colorAttachments:[{view:null,clearValue:{r:21/255,g:23/255,b:26/255,a:1},loadOp:'clear',storeOp:'store'}]};this.submitBuffers=[null];
 }
 fail(message){if(this.disposed)return;this.failed=true;this.gpuTimer?.dispose();this.onError(message);}
 setTimingActive(active){this.gpuTimer?.setActive(active);}
 setGraphicsOptions(options={}){
  if(!options||typeof options!=='object'||Array.isArray(options))throw new Error('Graphics options must be an object.');
  const {reflections=this.reflectionsEnabled,bloom=this.bloomEnabled}=options;
  if(typeof reflections!=='boolean'||typeof bloom!=='boolean')throw new Error('Graphics reflections and bloom options must be boolean.');
  const changed=reflections!==this.reflectionsEnabled||bloom!==this.bloomEnabled;
  if(reflections!==this.reflectionsEnabled){this.reflectionsEnabled=reflections;this.uniformDirty=true;if(this.planar)this.planar.valid=false;}
  if(bloom!==this.bloomEnabled){this.bloomEnabled=bloom;if(this.bloom){this.bloom.active=false;this.bloom.wasTransient=false;this.bloom.draws=this.bloom.passes=0;}}
  return changed;
 }
 async init(){
  if(!navigator.gpu)throw new Error('WebGPU is unavailable in this browser.');
  const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('No WebGPU adapter is available.');
  const d=this.device=await requestRenderDevice(adapter,this.gpuTiming);d.addEventListener('uncapturederror',e=>this.fail(e.error.message));
  if(this.gpuTiming)this.gpuTimer=new GPUFrameTimer(d);
  d.lost.then(info=>{if(!this.disposed)this.fail(`Graphics device lost: ${info.message}. Reload to reconnect.`);});
  this.context=this.canvas.getContext('webgpu');this.format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device:d,format:this.format,alphaMode:'opaque'});
  const modules=[geometry,composite,shotParticles(uniforms)].map(code=>d.createShaderModule({code:specializeLocalLights(code,this.localLightCapacity)}));
  for(const module of modules){const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(m=>m.message).join('\n'));}
  const cameraLayout=this.cameraLayout=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
  const lightingLayout=this.lightingLayout=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage',minBindingSize:ARC_EMPTY_LIGHT_BYTES}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage',minBindingSize:GENERATOR_EMPTY_LIGHT_BYTES}}]});
  this.screenLayout=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth',multisampled:true}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth'}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:6,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:7,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:8,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
  this.waterRippleUniform=d.createBuffer({label:'Bounded water impact ripples',size:this.waterRippleData.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.uniform=d.createBuffer({size:368,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.cameraGroup=d.createBindGroup({layout:cameraLayout,entries:[{binding:0,resource:{buffer:this.uniform}}]});
  this.shotUniform=d.createBuffer({size:this.localLightData.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  // A zero-initialised one-record binding keeps ordinary scenes independent of
  // ArcEffects pools and lazy full-size GPU resources. Count zero skips all work.
  this.emptyArcLights=d.createBuffer({label:'Inactive arc-light binding',size:ARC_EMPTY_LIGHT_BYTES,usage:GPUBufferUsage.STORAGE});
  this.emptyGeneratorLights=d.createBuffer({label:'Inactive generator-light binding',size:GENERATOR_EMPTY_LIGHT_BYTES,usage:GPUBufferUsage.STORAGE});
  this.shotInstances=d.createBuffer({size:MAX_SHOT_INSTANCES*SHOT_INSTANCE_FLOATS*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  this.effectBytes=this.shotUniform.size+this.shotInstances.size+this.waterRippleUniform.size;
  const depthLayout=d.createPipelineLayout({bindGroupLayouts:[cameraLayout]}),colorLayout=d.createPipelineLayout({bindGroupLayouts:[cameraLayout,lightingLayout]}),screenLayout=d.createPipelineLayout({bindGroupLayouts:[cameraLayout,this.screenLayout,lightingLayout]});
  const primitive={topology:'triangle-list',cullMode:'back'};
  [this.depthPipeline,this.shadowPipeline,this.colorPipeline,this.screenPipeline,this.waterPipeline,this.shotPipeline]=await Promise.all([
   d.createRenderPipelineAsync({label:'Camera depth prepass',layout:depthLayout,vertex:{module:modules[0],entryPoint:'vertex',buffers:vertexBuffers},primitive,depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'},multisample:{count:4}}),
   d.createRenderPipelineAsync({label:'Sky light shadow depth',layout:depthLayout,vertex:{module:modules[0],entryPoint:'shadowVertex',buffers:vertexBuffers},primitive,depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'}}),
   d.createRenderPipelineAsync({label:'Instanced opaque shading',layout:colorLayout,vertex:{module:modules[0],entryPoint:'vertex',buffers:vertexBuffers},fragment:{module:modules[0],entryPoint:'fragment',targets:[{format:'rgba8unorm'},{format:'rgba8unorm'}]},primitive,depthStencil:{format:'depth32float',depthWriteEnabled:false,depthCompare:'equal'},multisample:{count:4}}),
   d.createRenderPipelineAsync({label:'SSR and display conversion',layout:screenLayout,vertex:{module:modules[1],entryPoint:'vertex'},fragment:{module:modules[1],entryPoint:'fragment',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}}),
   d.createRenderPipelineAsync({label:'Water surface visibility',layout:depthLayout,vertex:{module:modules[0],entryPoint:'vertex',buffers:vertexBuffers},fragment:{module:modules[0],entryPoint:'waterMaskFragment',targets:[{format:'rgba8unorm'}]},primitive,depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'}}),
   d.createRenderPipelineAsync({label:'Pooled muzzle flashes and sparks',layout:d.createPipelineLayout({bindGroupLayouts:[cameraLayout,this.screenLayout]}),vertex:{module:modules[2],entryPoint:'vertex',buffers:[{arrayStride:64,stepMode:'instance',attributes:[0,1,2,3].map(shaderLocation=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}]},fragment:{module:modules[2],entryPoint:'fragment',targets:[{format:this.format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:'none'}}),
  ]);
  this.shadow=d.createTexture({size:[2048,2048],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.shadowView=this.shadow.createView();this.shadowPass.depthStencilAttachment.view=this.shadowView;
  this.bindLocalLights();
  this.sampler=d.createSampler({magFilter:'linear',minFilter:'linear'});
  this.resizeObserver=new ResizeObserver(()=>this.requestDraw());this.resizeObserver.observe(this.canvas);this.ready=true;return this;
 }
 bindLocalLights(){
  if(!this.device||!this.emptyArcLights||this.disposed)return;
  this.lightGroup=this.device.createBindGroup({layout:this.lightingLayout,entries:[{binding:0,resource:this.shadowView},{binding:1,resource:{buffer:this.shotUniform}},{binding:2,resource:{buffer:this.arcLightBuffer??this.emptyArcLights}},{binding:3,resource:{buffer:this.generatorLightBuffer??this.emptyGeneratorLights}}]});
 }
 setArcEffects(effects){
  if(this.arcEffects===effects)return;
  this.clearArcResources();this.arcEffects=effects;this.dirty=true;
 }
 setMissileThrust(thrust){
  if(this.missileThrust===thrust)return;
  this.clearMissileThrust();this.missileThrust=thrust;
 }
 clearMissileThrust(){if(this.missileLightCount||this.missileThrust?.lightCount)this.dirty=true;this.missileThrustInstances?.destroy();this.missileThrustInstances=null;this.missileThrust=null;this.missileThrustBytes=this.missileThrustUploadBytes=this.missileLightCount=0;}
 prepareMissileThrust(){
  this.missileThrustUploadBytes=0;const thrust=this.missileThrust;if(!thrust?.instanceCount)return;
  if(!this.missileThrustInstances){this.missileThrustInstances=this.device.createBuffer({label:'Pooled missile thrust',size:MAX_MISSILE_THRUST_INSTANCES*MISSILE_THRUST_FLOATS*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});this.missileThrustBytes=this.missileThrustInstances.size;}
  const floats=thrust.instanceCount*MISSILE_THRUST_FLOATS;this.device.queue.writeBuffer(this.missileThrustInstances,0,thrust.instanceData,0,floats);this.missileThrustUploadBytes=floats*4;
 }
 ensureArcPipeline(){
  const d=this.device;
  if(!this.arcPipeline){
   const module=d.createShaderModule({label:'Procedural electrical strike',code:arcParticles(uniforms)});
   this.arcPipeline=d.createRenderPipeline({label:'Electrical channel and impact sparks',layout:d.createPipelineLayout({bindGroupLayouts:[this.cameraLayout,this.screenLayout]}),vertex:{module,entryPoint:'vertex',buffers:[{arrayStride:ARC_INSTANCE_FLOATS*4,stepMode:'instance',attributes:[0,1,2].map(shaderLocation=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}]},fragment:{module,entryPoint:'fragment',targets:[{format:this.format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:'none'}});
  }
 }
 ensureArcResources(){
  if(this.arcInstances)return;
  const d=this.device;this.ensureArcPipeline();
  this.arcInstances=d.createBuffer({label:'Pooled electrical segments',size:MAX_ARC_INSTANCES*ARC_INSTANCE_FLOATS*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  this.arcLightBuffer=d.createBuffer({label:'Continuous arc tube lights',size:ARC_LIGHT_BYTES,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  this.arcBytes=this.arcInstances.size+this.arcLightBuffer.size;this.bindLocalLights();
 }
 prepareArcs(){
  const arcs=this.arcEffects;this.arcUploads=this.arcUploadBytes=0;
  if(!arcs)return;
  if(arcs.instanceCount){
   this.ensureArcResources();const floats=arcs.instanceCount*ARC_INSTANCE_FLOATS;
   this.device.queue.writeBuffer(this.arcInstances,0,arcs.instanceData,0,floats);this.arcUploads++;this.arcUploadBytes+=floats*4;
  }
  const count=arcs.lightCount;
  if((count||this.arcLightCount)&&this.arcLightBuffer){
   const floats=4+count*ARC_LIGHT_FLOATS;this.device.queue.writeBuffer(this.arcLightBuffer,0,arcs.lightData,0,floats);
   this.arcUploads++;this.arcUploadBytes+=floats*4;this.dirty=true;
  }
  this.arcLightCount=count;
 }
 setGeneratorLights(lights){
  if(this.generatorLights===lights)return;
  this.clearGeneratorLights();this.generatorLights=lights;this.dirty=true;
 }
 prepareGeneratorLights(){
  this.generatorUploadBytes=0;const lights=this.generatorLights,count=lights?.lightCount??0;
  if(count&&!this.generatorLightBuffer){
   this.generatorLightBuffer=this.device.createBuffer({label:'Static generator midpoint lights',size:GENERATOR_LIGHT_BYTES,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this.generatorBytes=GENERATOR_LIGHT_BYTES;this.bindLocalLights();
  }
  if(this.generatorLightBuffer&&lights?.revision!==this.lastGeneratorRevision){
   this.device.queue.writeBuffer(this.generatorLightBuffer,0,lights.lightData,0,4+count*8);this.generatorUploadBytes=(4+count*8)*4;this.dirty=true;
  }
  this.generatorLightCount=count;this.lastGeneratorRevision=lights?.revision;
 }
 clearGeneratorLights(){
  const hadResources=!!this.generatorLightBuffer;this.generatorLightBuffer?.destroy();this.generatorLightBuffer=this.generatorLights=null;
  this.generatorBytes=this.generatorLightCount=this.generatorUploadBytes=0;this.lastGeneratorRevision=undefined;
  if(hadResources)this.bindLocalLights();this.dirty=true;
 }
 clearArcResources(){
  const hadResources=!!(this.arcInstances||this.arcLightBuffer);this.arcEffects?.reset();this.arcInstances?.destroy();this.arcLightBuffer?.destroy();
  this.arcInstances=this.arcLightBuffer=null;this.arcBytes=this.arcLightCount=this.arcUploads=this.arcUploadBytes=0;if(hadResources)this.bindLocalLights();this.dirty=true;
 }
 buffer(data,usage){const b=this.device.createBuffer({size:Math.max(4,data.byteLength),usage:usage|GPUBufferUsage.COPY_DST});this.sceneBuffers.add(b);this.createdSceneBuffers++;if(data.byteLength)this.device.queue.writeBuffer(b,0,data);return b;}
 setWorld(world){
  this.clearGeometry();this.clearShockwaveTarget();this.shockwaveCount=0;this.world=world;this.bytes=0;this.transformBytes=0;this.visibilityBytes=0;
  const actorKeys=new Set();for(const actor of world.actors.values())for(const instance of actor.instances)actorKeys.add(instance.key);
  for(const entry of world.entries){if(!entry.mesh.indices.length)continue;
   const transforms=new Float32Array(entry.transforms.length*16);entry.transforms.forEach((m,i)=>transforms.set(m,i*16));
   const movable=entry.dynamic||actorKeys.has(entry.key),packedTransforms=movable?transforms.slice():transforms;
   const indexToSlot=movable?new Int32Array(entry.transforms.length):null,slotToIndex=movable?new Uint32Array(entry.transforms.length):null;
   if(movable){indexToSlot.fill(-1);const initial=entry.activeIndices??(entry.initiallyHidden?[]:entry.transforms.keys());let slot=0;for(const i of initial){indexToSlot[i]=slot;slotToIndex[slot]=i;packedTransforms.set(transforms.subarray(i*16,i*16+16),slot*16);slot++;}this.visibilityBytes+=packedTransforms.byteLength+indexToSlot.byteLength+slotToIndex.byteLength;}
   let emissive=false;for(let k=9;k<entry.mesh.vertices.length;k+=11)if(entry.mesh.vertices[k]>0){emissive=true;break;}
   const draw={emissive,key:entry.key,transforms,packedTransforms,indexToSlot,slotToIndex,visibleCount:entry.activeIndices?.length??(entry.initiallyHidden?0:entry.transforms.length),dirtyStart:Infinity,dirtyEnd:-1,vertices:this.buffer(entry.mesh.vertices,GPUBufferUsage.VERTEX),indices:this.buffer(entry.mesh.indices,GPUBufferUsage.INDEX),instances:this.buffer(packedTransforms,GPUBufferUsage.VERTEX),count:entry.transforms.length,indexCount:entry.mesh.indices.length};
   this.transformBytes+=transforms.byteLength;this.bytes+=entry.mesh.vertices.byteLength+entry.mesh.indices.byteLength+transforms.byteLength;this.draws.push(draw);this.drawMap.set(entry.key,draw);if(emissive)this.visibleEmitters+=draw.visibleCount;
  }
  const water=world.water;if(water.mesh.indices.length){this.waterDraw={key:water.key,vertices:this.buffer(water.mesh.vertices,GPUBufferUsage.VERTEX),indices:this.buffer(water.mesh.indices,GPUBufferUsage.INDEX),instances:this.buffer(water.transforms[0],GPUBufferUsage.VERTEX),count:1,indexCount:water.mesh.indices.length};this.bytes+=water.mesh.vertices.byteLength+water.mesh.indices.byteLength+64;}
  this.waterHeight=waterPlane(world.level);
  if(this.waterDraw){const b=this.waterBounds=new Float32Array([Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);for(const box of world.level.terrain.boxes)if(box.water>0){b[0]=Math.min(b[0],box.box[0]*24);b[1]=Math.min(b[1],box.ground);b[2]=Math.min(b[2],box.box[1]*24);b[3]=Math.max(b[3],(box.box[0]+1)*24);b[4]=Math.max(b[4],box.water);b[5]=Math.max(b[5],(box.box[1]+1)*24);}}
  const material=world.waterMaterial;this.frameData.set([...linearColor(material.color),material.reflectiveness],80);this.frameData.set([material.opacity,material.absorption,material.refraction,material.rippleStrength],84);this.frameData.set([material.rippleScale,material.rippleSpeed,material.emission,0],88);
  this.vista=hasZoneVista(world.level)?new ZoneVista(this.device,this.cameraLayout,world.width,world.length,world.level.zone):null;this.screenGroup=null;
  this.modelLights=new ModelLights(world.entries,this.drawMap,{capacity:this.modelLightCapacity,strict:this.strictModelLights});
  this.setLighting(levelLighting(world.level.environment));this.camera.setLevel(world.level);this.requestDraw();
 }
 // Fixed application pools: play prepares them asynchronously while loading;
 // previews retain the lazy first-use fallback. No compilation waits in draw.
 ensureDamageCubes(asyncCreate=false){
  if(this.damageCubeBuffer)return this.damageCubeReady;
  const d=this.device,module=d.createShaderModule({label:'Lit solid debris',code:specializeLocalLights(damageCubes,this.localLightCapacity)});
  const buffers=[{arrayStride:DAMAGE_CUBE_FLOATS*4,stepMode:'instance',attributes:Array.from({length:5},(_,shaderLocation)=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}],primitive={topology:'triangle-list',cullMode:'back'};
  const depthLayout=d.createPipelineLayout({bindGroupLayouts:[this.cameraLayout]}),colorLayout=d.createPipelineLayout({bindGroupLayouts:[this.cameraLayout,this.lightingLayout]});
  const create=descriptor=>asyncCreate?d.createRenderPipelineAsync(descriptor):d.createRenderPipeline(descriptor);
  this.damageDepthPipeline=create({label:'Debris camera depth',layout:depthLayout,vertex:{module,entryPoint:'debrisVertex',buffers},primitive,depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'},multisample:{count:4}});
  this.damageShadowPipeline=create({label:'Debris sky shadows',layout:depthLayout,vertex:{module,entryPoint:'debrisShadow',buffers},primitive,depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'}});
  this.damageColorPipeline=create({label:'Lit opaque debris',layout:colorLayout,vertex:{module,entryPoint:'debrisVertex',buffers},fragment:{module,entryPoint:'fragment',targets:[{format:'rgba8unorm'},{format:'rgba8unorm'}]},primitive,depthStencil:{format:'depth32float',depthWriteEnabled:false,depthCompare:'equal'},multisample:{count:4}});
  this.damageReflectionPipeline=create({label:'Mirrored solid debris',layout:colorLayout,vertex:{module,entryPoint:'debrisVertex',buffers},fragment:{module,entryPoint:'debrisReflection',targets:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list',cullMode:'front'},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'}});
  this.damageCubeBuffer=d.createBuffer({size:MAX_DAMAGE_CUBES*DAMAGE_CUBE_FLOATS*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});this.damageBytes+=this.damageCubeBuffer.size;
  if(asyncCreate)return this.damageCubeReady=settlePipelineFields(this,['damageDepthPipeline','damageShadowPipeline','damageColorPipeline','damageReflectionPipeline']);
 }
 ensureDamageParticles(asyncCreate=false){
  if(this.damageParticleBuffer)return this.damageParticleReady;
  const d=this.device,module=d.createShaderModule({label:'Lit smoke and brief blast',code:specializeLocalLights(damageParticles,this.localLightCapacity)}),layout=d.createPipelineLayout({bindGroupLayouts:[this.cameraLayout,this.screenLayout,this.lightingLayout]});
  const buffers=[{arrayStride:DAMAGE_PARTICLE_FLOATS*4,stepMode:'instance',attributes:Array.from({length:3},(_,shaderLocation)=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}];
  const create=descriptor=>asyncCreate?d.createRenderPipelineAsync(descriptor):d.createRenderPipeline(descriptor);
  const pipeline=(label,entryPoint,additive)=>create({label,layout,vertex:{module,entryPoint:'damageVertex',buffers},fragment:{module,entryPoint,targets:[{format:this.format,blend:{color:{srcFactor:'src-alpha',dstFactor:additive?'one':'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:'none'}});
  this.damageSmokePipeline=pipeline('Lit local smoke','smokeFragment',false);this.damageBlastPipeline=pipeline('Brief death blast','blastFragment',true);
  this.damageParticleBuffer=d.createBuffer({size:MAX_DAMAGE_PARTICLES*DAMAGE_PARTICLE_FLOATS*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});this.damageBytes+=this.damageParticleBuffer.size;
  if(asyncCreate)return this.damageParticleReady=settlePipelineFields(this,['damageSmokePipeline','damageBlastPipeline']);
 }
 ensureReflectionEffects(asyncCreate=false){
  if(!this.reflectionEffects){this.reflectionEffects=new ReflectionEffects(this,asyncCreate);this.effectBytes+=this.reflectionEffects.bytes;}
  return this.reflectionEffects.ready;
 }
 async prepareDeathEffects(){
  if(this.deathEffectsPreparation)return this.deathEffectsPreparation;
  if(this.disposed)return false;
  this.deathEffectsPreparation=(async()=>{
   const pending=[this.ensureDamageCubes(true),this.ensureDamageParticles(true),this.ensureShockwavePipeline(true),this.ensureReflectionEffects(true)];
   this.bloom??=new BloomPasses(this.device,this.cameraLayout,this.screenLayout,this.lightingLayout,this.sampler,this.format,this.localLightCapacity,true);
   pending.push(settlePipelineFields(this.bloom,['extractPipeline','horizontalPipeline','verticalPipeline','compositePipeline','shotPipeline','blastPipeline']));
   await Promise.all(pending);if(this.disposed)return false;
   this.deathEffectsPrepared=true;return true;
  })();return this.deathEffectsPreparation;
 }
 setDamageEffects(effects){this.damageEffects=effects;this.lastDamageCubeRevision=-1;}
 clearShockwaveTarget(){this.shockwaveTarget?.destroy();this.shockwaveTarget=null;this.shockwaveView=null;this.shockwaveGroup=null;this.shockwaveTargetBytes=0;}
 ensureShockwavePipeline(asyncCreate=false){
  if(this.shockwavePipeline)return this.shockwaveReady;
  const d=this.device;
  const module=d.createShaderModule({label:'Spherical explosion refraction',code:shockwaveRefraction});
  this.shockwaveLayout=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth',multisampled:true}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth'}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
  this.shockwavePipeline=(asyncCreate?d.createRenderPipelineAsync.bind(d):d.createRenderPipeline.bind(d))({label:'Post-composite shockwave',layout:d.createPipelineLayout({bindGroupLayouts:[this.cameraLayout,this.shockwaveLayout]}),vertex:{module,entryPoint:'vertex'},fragment:{module,entryPoint:'fragment',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}});
  this.shockwaveUniform=d.createBuffer({size:this.shockwaveData.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.shockwaveBytes=this.shockwaveUniform.size;
  if(asyncCreate)return this.shockwaveReady=settlePipelineFields(this,['shockwavePipeline']);
 }
 prepareShockwaves(width,height){
  this.shockwaveCount=Math.min(this.damageEffects?.shockwaveCount??0,MAX_BLASTS);if(!this.shockwaveCount&&!this.deathEffectsPrepared)return;
  const d=this.device;this.ensureShockwavePipeline();
  if(!this.shockwaveTarget){
   this.shockwaveTarget=d.createTexture({label:'Complete display before refraction',size:[width,height],format:this.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.shockwaveView=this.shockwaveTarget.createView();this.shockwaveTargetBytes=width*height*4;
   this.shockwaveGroup=d.createBindGroup({layout:this.shockwaveLayout,entries:[{binding:0,resource:this.shockwaveView},{binding:1,resource:this.sampler},{binding:2,resource:this.depthView},{binding:3,resource:this.waterDepthView},{binding:4,resource:{buffer:this.shockwaveUniform}}]});
  }
  if(!this.shockwaveCount)return;
  const data=this.shockwaveData,source=this.damageEffects.shockwaveData;data[0]=this.shockwaveCount;
  for(let i=0;i<this.shockwaveCount*SHOCKWAVE_FLOATS;i++)data[4+i]=source[i];
  d.queue.writeBuffer(this.shockwaveUniform,0,data,0,4+this.shockwaveCount*SHOCKWAVE_FLOATS);
 }
 prepareDamage(){
  const effects=this.damageEffects;if(!effects)return;
  if(effects.cubeRevision!==this.lastDamageCubeRevision){
   if(effects.cubeCount||this.damageCubeCount){
    this.depthDirty=this.shadowDirty=this.dirty=true;
    if(effects.cubeCount){this.ensureDamageCubes();this.device.queue.writeBuffer(this.damageCubeBuffer,0,effects.cubeData,0,effects.cubeCount*DAMAGE_CUBE_FLOATS);}
   }
   this.damageCubeCount=effects.cubeCount;this.lastDamageCubeRevision=effects.cubeRevision;
  }
  this.damageParticleCount=effects.particleCount;
  if(effects.particleCount){this.ensureDamageParticles();this.device.queue.writeBuffer(this.damageParticleBuffer,0,effects.particleData,0,effects.particleCount*DAMAGE_PARTICLE_FLOATS);}
 }
 prepareWaterRipples(){
  const water=this.waterDraw?this.damageEffects?.waterImpacts:null,revision=water?.revision??-1;
  if(water===this.lastWaterRipples&&revision===this.lastWaterRippleRevision)return;
  this.lastWaterRipples=water;this.lastWaterRippleRevision=revision;
  const data=this.waterRippleData;data[0]=0;const count=water?.writeRipples(data)??0;
  if(count||this.hadWaterRipples)this.device.queue.writeBuffer(this.waterRippleUniform,0,data,0,count?4+count*8:4);
  this.hadWaterRipples=count>0;
 }
 mergeLocalLights(){
  this.localLightUploadBytes=0;
  const models=this.modelLights,modelChanged=models?.prepare()??false,modelCount=models?.count??0;
  const shots=this.shotEffects,damage=this.damageEffects,missiles=this.missileThrust,shotCount=Math.min(shots?.lightCount??0,MAX_SHOT_LIGHTS),damageCount=Math.min(damage?.lightCount??0,MAX_DAMAGE_LIGHTS),missileCount=Math.min(missiles?.lightCount??0,MAX_MISSILE_LIGHTS),priorCount=shotCount+damageCount+modelCount,transientCount=shotCount+damageCount+missileCount,count=priorCount+missileCount;
  if(transientCount||this.hadTransientLights||modelChanged||count!==this.localLightCount){
   const data=this.localLightData;data[0]=count;
   for(let i=0;i<shotCount*8;i++)data[4+i]=shots.lightData[4+i];
   for(let i=0;i<damageCount*8;i++)data[4+shotCount*8+i]=damage.lightData[4+i];
   const modelOffset=4+(shotCount+damageCount)*8;
   // Transient lights animate every frame, but the model block remains valid
   // until its contents, source or packed position changes.
   if(modelChanged||models!==this.lastPackedModelLights||modelOffset!==this.lastPackedModelOffset||modelCount!==this.lastPackedModelCount){
    for(let i=0;i<modelCount*8;i++)data[modelOffset+i]=models.data[4+i];
   }
   this.lastPackedModelLights=models;this.lastPackedModelOffset=modelOffset;this.lastPackedModelCount=modelCount;
   for(let i=0;i<missileCount*8;i++)data[4+priorCount*8+i]=missiles.lightData[4+i];
   this.device.queue.writeBuffer(this.shotUniform,0,data,0,4+count*8);this.localLightUploadBytes=(4+count*8)*4;this.dirty=true;
  }
  this.localLightCount=count;this.missileLightCount=missileCount;this.hadTransientLights=transientCount>0;
 }
 clearModelLightCopyCache(){this.lastPackedModelLights=null;this.lastPackedModelOffset=-1;this.lastPackedModelCount=0;}
 setLighting(sky){
  const dir=sky.direction,len=Math.hypot(...dir),target=[this.world.width/2,20,this.world.length/2],eye=target.map((v,i)=>v+dir[i]/len*650);
  lookAt(this.lightView,eye,target);const radius=Math.hypot(this.world.width,this.world.length)*.56;
  ortho(this.lightProjection,-radius,radius,-radius,radius,200,1100);multiply(this.lightVP,this.lightProjection,this.lightView);
  this.frameData.set(this.lightVP,16);this.frameData.set([dir[0]/len,dir[1]/len,dir[2]/len,sky.intensity],52);
  this.frameData[59]=sky.ambientIntensity;this.frameData[63]=1;this.setLightingColors(sky.color,sky.ambient);
  this.shadowDirty=true;this.uniformDirty=true;this.dirty=true;
 }
 // Colour changes reuse light transforms and shadow depth. The optional flat
 // backdrop follows the night ambient; omitting it restores the day backdrop.
 setLightingColors(color,ambient,background=null){
  this.frameData.set(linearColor(color),56);this.frameData.set(linearColor(ambient),60);
  const b=this.backgroundColor,c=background?linearColor(background):null;b.r=c?c[0]:.38;b.g=c?c[1]:.43;b.b=c?c[2]:.35;// Vista edges resolve over black; the composite supplies uncovered samples.
  this.opaqueBackgroundColor.r=this.vista?0:b.r;this.opaqueBackgroundColor.g=this.vista?0:b.g;this.opaqueBackgroundColor.b=this.vista?0:b.b;
  this.vistaLightingDirty=true;this.uniformDirty=true;this.dirty=true;
 }
 // Retain the packed load-time transform array. Multiple pose changes share
 // one upload per draw buffer, with the latest matrix winning within a frame.
 updateInstance(key,index,matrix){
  const draw=this.drawMap.get(key);if(!draw||index<0||index>=draw.count)throw new Error('Invalid instance.');
  draw.transforms.set(matrix,index*16);const slot=draw.indexToSlot?draw.indexToSlot[index]:index;
  // Hidden logical poses stay current for an optional preview restore, without
  // uploading or invalidating any pass until they become visible again.
  if(slot<0)return;
  this.modelLights?.invalidate(key);
  if(draw.packedTransforms!==draw.transforms)draw.packedTransforms.set(matrix,slot*16);
  draw.dirtyStart=Math.min(draw.dirtyStart,slot);draw.dirtyEnd=Math.max(draw.dirtyEnd,slot);
  this.depthDirty=true;this.shadowDirty=true;this.dirty=true;
 }
 // Compact only actor-containing instance groups; model geometry and logical
 // rig indices never change. No new buffers or arrays are needed at death.
 setActorVisible(actorId,visible){
  if(typeof visible!=='boolean')throw new Error('Actor visibility requires a boolean.');
  const actor=this.world?.actors.get(actorId);if(!actor)throw new Error('Unknown runtime actor: '+actorId);
  let changed=false;for(const instance of actor.instances)changed=this.setInstanceVisible(instance,visible)||changed;return changed;
 }
 setInstanceVisible(instance,visible){
  const draw=this.drawMap.get(instance.key);if(!draw)return false;
   const index=instance.index,slot=draw.indexToSlot[index];if((slot>=0)===visible)return false;

   this.modelLights?.invalidate(instance.key);
   if(draw.emissive)this.visibleEmitters+=visible?1:-1;
   if(visible){
    const next=draw.visibleCount++;draw.indexToSlot[index]=next;draw.slotToIndex[next]=index;
    for(let channel=0;channel<16;channel++)draw.packedTransforms[next*16+channel]=draw.transforms[index*16+channel];
    draw.dirtyStart=Math.min(draw.dirtyStart,next);draw.dirtyEnd=Math.max(draw.dirtyEnd,next);
   }else{
    const last=--draw.visibleCount;draw.indexToSlot[index]=-1;
    if(slot!==last){
     const moved=draw.slotToIndex[last];draw.slotToIndex[slot]=moved;draw.indexToSlot[moved]=slot;
     draw.packedTransforms.copyWithin(slot*16,last*16,(last+1)*16);
     draw.dirtyStart=Math.min(draw.dirtyStart,slot);draw.dirtyEnd=Math.max(draw.dirtyEnd,slot);
    }
   }
  this.depthDirty=this.shadowDirty=this.dirty=true;return true;
 }
 syncRuntimeInstances(world){
  if(world!==this.world)throw new Error('Runtime update requires the active world.');
  for(const entry of world.entries)if(entry.dynamic){
   const active=new Set(entry.activeIndices);
   for(let index=0;index<entry.transforms.length;index++){
    this.updateInstance(entry.key,index,entry.transforms[index]);this.setInstanceVisible({key:entry.key,index},active.has(index));
   }
  }
  const next=new ModelLights(world.entries,this.drawMap,{capacity:this.modelLightCapacity,strict:this.strictModelLights});
  // Keep the lighting upload storage stable; only its bounded CPU sources change.
  if(this.modelLights?.data&&next.data){next.data=this.modelLights.data;next.data.fill(0);}
  this.modelLights?.sources.splice(0);this.clearModelLightCopyCache();this.modelLights=next;this.requestDraw();
 }
 flushInstances(){
  this.lastTransformUploads=0;this.lastTransformUploadBytes=0;
  for(let i=0;i<this.draws.length;i++){
   const draw=this.draws[i];if(draw.dirtyEnd<draw.dirtyStart)continue;
   const start=draw.dirtyStart,count=Math.min(draw.dirtyEnd+1,draw.visibleCount)-start;
   if(count<=0){draw.dirtyStart=Infinity;draw.dirtyEnd=-1;continue;}
   this.device.queue.writeBuffer(draw.instances,start*64,draw.packedTransforms,start*16,count*16);
   this.lastTransformUploads++;this.lastTransformUploadBytes+=count*64;draw.dirtyStart=Infinity;draw.dirtyEnd=-1;
  }
 }
 // Camera/viewport changes affect camera-space passes, not the sky shadow map.
 requestDraw(){this.cameraDirty=true;this.depthDirty=true;this.waterDirty=true;this.dirty=true;}
 setShotEffects(effects){this.shotEffects=effects;this.dirty=true;}
 render(deltaSeconds,elapsedSeconds){
  if(!this.ready||this.failed||!this.world||this.disposed)return;
  this.deltaSeconds=deltaSeconds;this.elapsedSeconds=elapsedSeconds;this.camera.advance(deltaSeconds);
  this.draw();
 }
 resize(w,h){
  this.gpuTimer?.reset();
  this.clearShockwaveTarget();this.bloom?.clearTargets();
  for(const texture of this.targets||[])texture.destroy();const d=this.device;
  const texture=(format,sampleCount)=>d.createTexture({size:[w,h],format,sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
  const depth=texture('depth32float',4),color=texture('rgba8unorm',4),normal=texture('rgba8unorm',4),resolvedColor=texture('rgba8unorm',1),resolvedNormal=texture('rgba8unorm',1);
  this.targets=[depth,color,normal,resolvedColor,resolvedNormal];this.depthView=depth.createView();this.colorView=color.createView();this.normalView=normal.createView();this.resolvedColorView=resolvedColor.createView();this.resolvedNormalView=resolvedNormal.createView();
  const waterSize=this.waterDraw?[w,h]:[1,1],waterTexture=format=>d.createTexture({size:waterSize,format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
  const waterDepth=waterTexture('depth32float'),waterNormal=waterTexture('rgba8unorm');this.waterTargetActive=!!this.waterDraw;this.targets.push(waterDepth,waterNormal);this.waterDepthView=waterDepth.createView();this.waterNormalView=waterNormal.createView();this.requestDraw();
  this.depthPass.depthStencilAttachment.view=this.depthView;this.opaquePass.depthStencilAttachment.view=this.depthView;
  this.opaquePass.colorAttachments[0].view=this.colorView;this.opaquePass.colorAttachments[0].resolveTarget=this.resolvedColorView;
  this.opaquePass.colorAttachments[1].view=this.normalView;this.opaquePass.colorAttachments[1].resolveTarget=this.resolvedNormalView;
  this.waterPass.colorAttachments[0].view=this.waterNormalView;this.waterPass.depthStencilAttachment.view=this.waterDepthView;
  this.vista?.resize(w,h);this.bindScreen();
  this.targetBytes=w*h*(4*4*3+4*2)+(this.waterDraw?w*h:1)*8+2048*2048*4;
 }
 bindScreen(){
  this.screenGroup=this.device.createBindGroup({layout:this.screenLayout,entries:[{binding:0,resource:this.resolvedColorView},{binding:1,resource:this.resolvedNormalView},{binding:2,resource:this.depthView},{binding:3,resource:this.sampler},{binding:4,resource:this.waterDepthView},{binding:5,resource:this.waterNormalView},{binding:6,resource:this.vista?.view??this.resolvedColorView},{binding:7,resource:this.planar?.view??this.resolvedColorView},{binding:8,resource:{buffer:this.waterRippleUniform}}]});
 }
 geometryPass(pass,pipeline,damagePipeline){pass.setPipeline(pipeline);pass.setBindGroup(0,this.cameraGroup);let count=0;
  for(let i=0;i<this.draws.length;i++){const g=this.draws[i];if(!g.visibleCount)continue;pass.setVertexBuffer(0,g.vertices);pass.setVertexBuffer(1,g.instances);pass.setIndexBuffer(g.indices,'uint32');pass.drawIndexed(g.indexCount,g.visibleCount);count++;}
  if(this.damageCubeCount){pass.setPipeline(damagePipeline);pass.setBindGroup(0,this.cameraGroup);if(damagePipeline===this.damageColorPipeline)pass.setBindGroup(1,this.lightGroup);pass.setVertexBuffer(0,this.damageCubeBuffer);pass.draw(36,this.damageCubeCount);count++;}
  pass.end();return count;}
 draw(){
  const start=performance.now(),canvas=this.canvas,dpr=Math.min(devicePixelRatio||1,2),limit=this.device.limits.maxTextureDimension2D;
  // Scale the complete output, including post-processing, before the canvas is
  // enlarged for display. Keep CSS dimensions intact for input and overlays.
  const displayWidth=canvas.clientWidth,displayHeight=canvas.clientHeight,scale=Math.min(dpr,limit/Math.max(1,displayWidth),limit/Math.max(1,displayHeight))*this.renderScale;
  const w=Math.max(1,Math.round(displayWidth*scale)),h=Math.max(1,Math.round(displayHeight*scale));
  if(canvas.width!==w||canvas.height!==h||!this.targets||this.waterTargetActive!==!!this.waterDraw){canvas.width=w;canvas.height=h;this.resize(w,h);}
  if(!this.screenGroup){this.vista?.resize(w,h);this.bindScreen();}
  const effects=this.shotEffects;
  if(effects?.instanceCount)this.device.queue.writeBuffer(this.shotInstances,0,effects.instanceData,0,effects.instanceCount*SHOT_INSTANCE_FLOATS);
  const f=this.frameData,c=this.camera;
  const cameraUpdated=this.cameraDirty;
  if(cameraUpdated){c.update(w/h);f.set(c.vp);f.set(c.inverse,32);f.set(c.eye,48);
   const pitchCos=Math.cos(c.pitch);f[64]=w;f[65]=h;f[66]=1/w;f[67]=1/h;f[68]=Math.sin(c.yaw)*pitchCos;f[69]=Math.sin(c.pitch);f[70]=Math.cos(c.yaw)*pitchCos;f[71]=c.isPerspective?1:0;
  }
  this.damageEffects?.prepare?.(c.vp);this.prepareDamage();this.prepareWaterRipples();this.mergeLocalLights();this.prepareArcs();this.prepareGeneratorLights();this.prepareMissileThrust();
  const reflections=this.reflectionsEnabled&&this.ssr;
  const wantsPlanar=this.waterReflections==='planar'&&this.waterDraw&&this.waterHeight!==null&&reflections&&c.eye[1]>this.waterHeight&&waterInView(this.waterBounds,c.vp);
  if(wantsPlanar){if(!this.planar)this.planar=new PlanarReflection(this,vertexBuffers);if(this.planar.resize(w,h))this.screenGroup=null;}
  if(!this.screenGroup)this.bindScreen();
  const waterMode=this.waterDraw?(wantsPlanar?1:0):-1;if(f[91]!==waterMode){f[91]=waterMode;this.uniformDirty=true;}
  if(this.deathEffectsPrepared&&this.bloomEnabled)this.bloom.ensureTargets(w,h);
  this.prepareShockwaves(w,h);
  f[72]=reflections?1:0;f[73]=c.near;f[74]=c.far;f[75]=this.vista?1:0;f[76]=this.deltaSeconds;f[77]=this.elapsedSeconds;f[78]=(this.elapsedSeconds*this.world.waterMaterial.rippleSpeed*Math.PI*2)%(Math.PI*2);f[79]=0;
  if(cameraUpdated||this.uniformDirty)this.device.queue.writeBuffer(this.uniform,0,f);else this.device.queue.writeBuffer(this.uniform,288,f,72,8);
  this.cameraDirty=false;this.uniformDirty=false;this.flushInstances();
  const encoder=this.device.createCommandEncoder(),timing=this.gpuTimer?.begin(encoder,this.shockwaveCount?this.shockwavePass:this.displayPass),renderEncoder=this.gpuTimer?.renderEncoder?.(encoder,timing)??encoder;
  const depthUpdated=this.depthDirty,opaqueUpdated=this.dirty,shadowUpdated=this.shadowDirty,waterUpdated=this.waterDirty;this.lastDrawCalls=1;
  this.lastDrawCalls+=this.vista?.render(renderEncoder,this.cameraGroup,cameraUpdated||this.vistaLightingDirty)??0;this.vistaLightingDirty=false;
  if(depthUpdated){this.lastDrawCalls+=this.geometryPass(renderEncoder.beginRenderPass(this.depthPass),this.depthPipeline,this.damageDepthPipeline);this.depthDirty=false;}
  if(shadowUpdated){this.lastDrawCalls+=this.geometryPass(renderEncoder.beginRenderPass(this.shadowPass),this.shadowPipeline,this.damageShadowPipeline);this.shadowDirty=false;}
  if(!wantsPlanar&&this.planar&&(cameraUpdated||opaqueUpdated||shadowUpdated))this.planar.valid=false;
  this.planarDraws=wantsPlanar?this.planar.render(renderEncoder,this,this.waterHeight,cameraUpdated||opaqueUpdated||shadowUpdated):0;this.lastDrawCalls+=this.planarDraws;
  if(opaqueUpdated){
   const color=renderEncoder.beginRenderPass(this.opaquePass);color.setBindGroup(1,this.lightGroup);this.lastDrawCalls+=this.geometryPass(color,this.colorPipeline,this.damageColorPipeline);
   this.dirty=false;
  }
  if(waterUpdated&&this.waterDraw){
   const water=renderEncoder.beginRenderPass(this.waterPass);water.setPipeline(this.waterPipeline);water.setBindGroup(0,this.cameraGroup);
   const g=this.waterDraw;water.setVertexBuffer(0,g.vertices);water.setVertexBuffer(1,g.instances);water.setIndexBuffer(g.indices,'uint32');water.drawIndexed(g.indexCount,g.count);this.lastDrawCalls++;
   water.end();
  }
  if(waterUpdated)this.waterDirty=false;
  if(this.bloomEnabled){
   if(!this.bloom&&(this.visibleEmitters||effects?.flashCount||this.damageEffects?.blastCount||this.arcEffects?.strikeCount||this.missileThrust?.instanceCount))this.bloom=new BloomPasses(this.device,this.cameraLayout,this.screenLayout,this.lightingLayout,this.sampler,this.format,this.localLightCapacity);
   this.bloom?.render(renderEncoder,this,w,h,opaqueUpdated,waterUpdated);this.lastDrawCalls+=this.bloom?.draws??0;
  }
  const finalSceneView=this.context.getCurrentTexture().createView();
  this.displayPass.colorAttachments[0].view=this.shockwaveCount?this.shockwaveView:finalSceneView;
  const display=renderEncoder.beginRenderPass(this.displayPass);display.setPipeline(this.bloom?.active?this.bloom.compositePipeline:this.screenPipeline);display.setBindGroup(0,this.cameraGroup);display.setBindGroup(1,this.screenGroup);display.setBindGroup(2,this.lightGroup);if(this.bloom?.active)display.setBindGroup(3,this.bloom.firstGroup);display.draw(3);
  if(this.damageParticleCount){
   const damage=this.damageEffects;display.setBindGroup(0,this.cameraGroup);display.setBindGroup(1,this.screenGroup);display.setBindGroup(2,this.lightGroup);display.setVertexBuffer(0,this.damageParticleBuffer);
   const translucent=damage.smokeCount+(damage.waterParticleCount??0);
   if(translucent){display.setPipeline(this.damageSmokePipeline);display.draw(6,translucent);this.lastDrawCalls++;}
   if(damage.blastCount){display.setPipeline(this.damageBlastPipeline);display.draw(6,damage.blastCount,0,translucent);this.lastDrawCalls++;}
  }
  if(effects?.instanceCount){display.setPipeline(this.shotPipeline);display.setBindGroup(0,this.cameraGroup);display.setBindGroup(1,this.screenGroup);display.setVertexBuffer(0,this.shotInstances);display.draw(6,effects.instanceCount);this.lastDrawCalls++;}
  if(this.missileThrust?.instanceCount){display.setPipeline(this.shotPipeline);display.setBindGroup(0,this.cameraGroup);display.setBindGroup(1,this.screenGroup);display.setVertexBuffer(0,this.missileThrustInstances);display.draw(6,this.missileThrust.instanceCount);this.lastDrawCalls++;}
  if(this.arcEffects?.instanceCount){display.setPipeline(this.arcPipeline);display.setBindGroup(0,this.cameraGroup);display.setBindGroup(1,this.screenGroup);display.setVertexBuffer(0,this.arcInstances);display.draw(6,this.arcEffects.instanceCount);this.lastDrawCalls++;}
  display.end();
  if(this.shockwaveCount){this.shockwavePass.colorAttachments[0].view=finalSceneView;const wave=renderEncoder.beginRenderPass(this.shockwavePass);wave.setPipeline(this.shockwavePipeline);wave.setBindGroup(0,this.cameraGroup);wave.setBindGroup(1,this.shockwaveGroup);wave.draw(3);wave.end();this.lastDrawCalls++;}
  this.gpuTimer?.end(encoder,timing);
  this.submitBuffers[0]=encoder.finish();this.device.queue.submit(this.submitBuffers);this.submitBuffers[0]=null;this.gpuTimer?.submitted(timing);this.frames++;this.lastSubmitMs=performance.now()-start;
 }

 clearGeometry(){this.lastWaterRipples=null;this.lastWaterRippleRevision=null;this.gpuTimer?.reset();this.planar?.clearTargets();this.visibleEmitters=0;this.waterHeight=this.waterBounds=null;this.vista?.dispose();this.vista=null;this.screenGroup=null;this.clearMissileThrust();this.clearGeneratorLights();this.clearArcResources();this.bloom?.clearTargets();this.clearModelLightCopyCache();this.modelLights?.dispose();this.modelLights=null;for(const buffer of this.sceneBuffers){buffer.destroy();this.destroyedSceneBuffers++;}this.sceneBuffers.clear();this.waterDraw=null;this.draws.length=0;this.drawMap.clear();this.bytes=0;this.transformBytes=0;this.visibilityBytes=0;this.lastTransformUploads=0;this.lastTransformUploadBytes=0;}
 clearWorld(){
  this.clearShockwaveTarget();this.shockwaveCount=0;
  this.clearGeometry();this.world=null;this.camera.clearLevel();this.shadowDirty=true;this.uniformDirty=true;this.requestDraw();this.hadTransientLights=false;this.localLightCount=0;this.damageCubeCount=this.damageParticleCount=0;this.lastDamageCubeRevision=-1;
  if(this.shotEffects)this.shotEffects.reset();this.localLightData.fill(0);this.localLightUploadBytes=0;if(this.shotUniform)this.device?.queue.writeBuffer(this.shotUniform,0,this.localLightData);
  if(this.ready&&!this.failed&&!this.disposed){const encoder=this.device.createCommandEncoder();this.clearPass.colorAttachments[0].view=this.context.getCurrentTexture().createView();encoder.beginRenderPass(this.clearPass).end();this.submitBuffers[0]=encoder.finish();this.device.queue.submit(this.submitBuffers);this.submitBuffers[0]=null;}
 }
 dispose(){if(this.disposed)return;this.gpuTimer?.dispose();this.bloom?.dispose();this.bloom=null;this.planar?.dispose();this.planar=null;this.reflectionEffects?.dispose();this.reflectionEffects=null;this.disposed=true;this.resizeObserver?.disconnect();this.clearGeometry();this.clearShockwaveTarget();this.world=null;this.shotEffects=this.damageEffects=this.arcEffects=null;this.camera.dispose();for(const t of this.targets||[])t.destroy();this.shadow?.destroy();this.uniform?.destroy();this.waterRippleUniform?.destroy();this.shotUniform?.destroy();this.emptyArcLights?.destroy();this.emptyGeneratorLights?.destroy();this.shotInstances?.destroy();this.damageCubeBuffer?.destroy();this.damageParticleBuffer?.destroy();this.shockwaveUniform?.destroy();this.device?.destroy();}
}
