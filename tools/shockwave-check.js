// Isolated numeric readbacks of the production post-composite shader.
import {shockwaveRefraction} from '/engine/shockwave-shaders.js';
import {MAX_BLASTS,SHOCKWAVE_FLOATS} from '/shared/damage-effects.js';
import {identity} from '/shared/math.js';
import {Camera} from '/engine/camera.js';
const result=document.getElementById('result'),size=128;let device;
try{
 device=await(await navigator.gpu.requestAdapter()).requestDevice();const errors=[],checks=[];
 device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
 const check=(value,name)=>{if(!value)throw new Error(name);checks.push(name);};
 const module=device.createShaderModule({code:shockwaveRefraction});for(const message of(await module.getCompilationInfo()).messages)if(message.type==='error')throw new Error(message.message);
 const cameraLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
 const waveLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth',multisampled:true}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth'}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
 const pipeline=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[cameraLayout,waveLayout]}),vertex:{module,entryPoint:'vertex'},fragment:{module,entryPoint:'fragment',targets:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list'}});
 const buffer=(bytes,usage)=>device.createBuffer({size:bytes,usage}),frame=buffer(368,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),wave=buffer((4+MAX_BLASTS*SHOCKWAVE_FLOATS)*4,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),read=buffer(size*size*4,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
 const frameData=new Float32Array(92),waveData=new Float32Array(4+MAX_BLASTS*SHOCKWAVE_FLOATS),vp=identity(),inverse=identity();
 vp[0]=vp[5]=1/32;vp[10]=-1/64;vp[14]=.5;inverse[0]=inverse[5]=32;inverse[10]=-64;inverse[14]=32;
 frameData.set(vp);frameData.set(inverse,32);frameData.set([size,size,1/size,1/size],64);
 const texture=(format,sampleCount=1)=>device.createTexture({size:[size,size],format,sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|(sampleCount===1?GPUTextureUsage.COPY_SRC:0)});
 const source=texture('rgba8unorm'),target=texture('rgba8unorm'),opaque=texture('depth32float',4),water=texture('depth32float');
 const sourceView=source.createView(),targetView=target.createView(),opaqueView=opaque.createView(),waterView=water.createView();
 const cameraGroup=device.createBindGroup({layout:cameraLayout,entries:[{binding:0,resource:{buffer:frame}}]}),waveGroup=device.createBindGroup({layout:waveLayout,entries:[{binding:0,resource:sourceView},{binding:1,resource:device.createSampler({minFilter:'linear',magFilter:'linear'})},{binding:2,resource:opaqueView},{binding:3,resource:waterView},{binding:4,resource:{buffer:wave}}]});
 // Deliberately multicoloured completed-image fixture, independent of depth.
 const fixture=device.createShaderModule({code:`
 @vertex fn vertex(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{let x=f32((i<<1u)&2u);let y=f32(i&2u);return vec4<f32>(x*2-1,y*2-1,0,1);}
 @fragment fn color(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{return vec4<f32>(p.x/128,p.y/128,select(.1,.9,(u32(p.x/8)+u32(p.y/8))%2u==0u),1);}
 @fragment fn edge(@builtin(position) p:vec4<f32>)->@builtin(frag_depth) f32{return select(.95,.1,p.x>=89);}
 `});
 const sourcePipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:fixture,entryPoint:'vertex'},fragment:{module:fixture,entryPoint:'color',targets:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list'}});
 const edgePipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:fixture,entryPoint:'vertex'},fragment:{module:fixture,entryPoint:'edge',targets:[]},primitive:{topology:'triangle-list'},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'always'},multisample:{count:4}});
 const clearDepth=(encoder,view,depth)=>encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view,depthClearValue:depth,depthLoadOp:'clear',depthStoreOp:'store'}}).end();
 async function draw(opaqueValue=.95,waterValue=1,edge=false){
  device.queue.writeBuffer(frame,0,frameData);device.queue.writeBuffer(wave,0,waveData);const encoder=device.createCommandEncoder();
  clearDepth(encoder,opaqueView,opaqueValue);clearDepth(encoder,waterView,waterValue);
  if(edge){const pass=encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:opaqueView,depthLoadOp:'load',depthStoreOp:'store'}});pass.setPipeline(edgePipeline);pass.draw(3);pass.end();}
  const image=encoder.beginRenderPass({colorAttachments:[{view:sourceView,loadOp:'clear',storeOp:'store'}]});image.setPipeline(sourcePipeline);image.draw(3);image.end();
  const pass=encoder.beginRenderPass({colorAttachments:[{view:targetView,loadOp:'clear',storeOp:'store'}]});pass.setPipeline(pipeline);pass.setBindGroup(0,cameraGroup);pass.setBindGroup(1,waveGroup);pass.draw(3);pass.end();
  encoder.copyTextureToBuffer({texture:target},{buffer:read,bytesPerRow:size*4},[size,size]);device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);const data=new Uint8Array(read.getMappedRange()).slice();read.unmap();return data;
 }
 const pixel=(data,x,y)=>Array.from(data.subarray((y*size+x)*4,(y*size+x)*4+4));
 const difference=(a,b)=>Math.max(...a.map((value,i)=>Math.abs(value-b[i]))),same=(a,b)=>a.every((value,i)=>Math.abs(value-b[i])<=1);
 const baseline=await draw();waveData[0]=1;waveData.set([0,0,0,12,4,1.5,0,0],4);
 const refracted=await draw(),baseRim=pixel(baseline,88,64),bentRim=pixel(refracted,88,64);
 check(difference(baseRim,bentRim)>2,'Spherical rim displaces the completed image');
 check(same(pixel(baseline,64,64),pixel(refracted,64,64)),'Sphere interior remains clear without a filled bubble');
 check(same(pixel(baseline,10,10),pixel(refracted,10,10)),'Distant pixels remain unchanged');
 waveData[9]=0;const noStrength=await draw();check(same(baseline,noStrength),'Zero strength is an exact passthrough');waveData[9]=1.5;
 const foreground=await draw(.1),foregroundWater=await draw(.95,.1);check(same(baseline,foreground),'Opaque foreground is not refracted');check(same(baseline,foregroundWater),'Foreground water is not refracted');
 const backgroundWater=await draw(.95,.9);check(difference(baseRim,pixel(backgroundWater,88,64))>2,'Water and image content behind the wave are refracted');
 const guarded=await draw(.95,1,true);check(same(baseRim,pixel(guarded,88,64)),'Displaced-source guard does not pull foreground across its edge');
 waveData[6]=100;const behindCamera=await draw();check(same(baseline,behindCamera),'A sphere behind the camera has no effect');waveData[6]=0;
 waveData[0]=0;const expired=await draw();check(same(baseline,expired),'Expired waves leave no residual distortion');
 waveData.fill(0);waveData[0]=4;for(const [i,x,y] of [[0,-16,0],[1,16,0],[2,0,16],[3,0,-16]])waveData.set([x,y,0,8,3,.65,0,0],4+i*8);
 const simultaneous=await draw();check([[16,64],[112,64],[64,16],[64,112]].every(([x,y])=>difference(pixel(baseline,x,y),pixel(simultaneous,x,y))>1),'All four fixed wave slots contribute without serial image copies');
 const camera=new Camera({addEventListener(){},clientWidth:size,clientHeight:size},()=>{});camera.mode='path';camera.position.set([0,0,40]);camera.yaw=camera.pitch=0;camera.near=.1;camera.far=100;camera.update(1);
 frameData.set(camera.vp);frameData.set(camera.inverse,32);waveData.fill(0);waveData[0]=1;waveData.set([0,0,0,12,4,1.5,0,0],4);
 const perspective=await draw(1);check(difference(pixel(baseline,87,64),pixel(perspective,87,64))>2,'Perspective camera rays produce visible sphere refraction');
 const perspectiveForeground=await draw(.5);check(same(baseline,perspectiveForeground),'Perspective foreground remains undistorted');
 await device.queue.onSubmittedWorkDone();check(errors.length===0,errors.join('\n')||'No WebGPU validation errors');
 result.textContent=JSON.stringify({passed:checks.length,failed:0,checks,pixels:{baseRim,bentRim,guarded:pixel(guarded,88,64),perspective:pixel(perspective,87,64)}},null,2);
}catch(error){result.textContent='FAILED: '+error.message;console.error(error);}finally{device?.destroy();}
