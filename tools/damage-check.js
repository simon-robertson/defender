import {GENERATOR_EMPTY_LIGHT_BYTES} from '/shared/generator-lights.js';
import {ARC_EMPTY_LIGHT_BYTES} from '/shared/arc-effects.js';
// Developer-only numeric checks of complete production smoke/blast/cube shaders.
import {damageParticles,damageCubes} from '/engine/damage-shaders.js';
import {MAX_LOCAL_LIGHTS} from '/shared/shot-effects.js';
import {identity} from '/shared/math.js';
const result=document.getElementById('result');let device;
try{
 device=await(await navigator.gpu.requestAdapter()).requestDevice();const errors=[],checks=[];
 device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
 const check=(condition,name)=>{if(!condition)throw new Error(name);checks.push(name);};
 const generatorLights=device.createBuffer({size:GENERATOR_EMPTY_LIGHT_BYTES,usage:GPUBufferUsage.STORAGE});
 const arcLights=device.createBuffer({size:ARC_EMPTY_LIGHT_BYTES,usage:GPUBufferUsage.STORAGE});
 const particleModule=device.createShaderModule({code:damageParticles}),cubeModule=device.createShaderModule({code:damageCubes});
 for(const module of [particleModule,cubeModule])for(const message of(await module.getCompilationInfo()).messages)if(message.type==='error')throw new Error(message.message);
 const frameLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
 const screenLayout=device.createBindGroupLayout({entries:[{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth',multisampled:true}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth'}}]});
 const lightLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage',minBindingSize:ARC_EMPTY_LIGHT_BYTES}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage',minBindingSize:GENERATOR_EMPTY_LIGHT_BYTES}}]});
 const layout=device.createPipelineLayout({bindGroupLayouts:[frameLayout,screenLayout,lightLayout]});
 const particleBuffers=[{arrayStride:48,stepMode:'instance',attributes:[0,1,2].map(shaderLocation=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}];
 const particlePipeline=(entryPoint,additive)=>device.createRenderPipelineAsync({layout,vertex:{module:particleModule,entryPoint:'damageVertex',buffers:particleBuffers},fragment:{module:particleModule,entryPoint,targets:[{format:'rgba8unorm',blend:{color:{srcFactor:'src-alpha',dstFactor:additive?'one':'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:'none'}});
 const smokePipeline=await particlePipeline('smokeFragment',false),blastPipeline=await particlePipeline('blastFragment',true);
 const buffer=(size,usage)=>device.createBuffer({size,usage});
 const frame=buffer(368,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),lights=buffer((4+MAX_LOCAL_LIGHTS*8)*4,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),particle=buffer(48,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST),cube=buffer(80,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST),read=buffer(64*256,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
 const frameData=new Float32Array(92),lightData=new Float32Array(4+MAX_LOCAL_LIGHTS*8),vp=identity();vp[12]=vp[13]=-1;vp[10]=-.5;vp[14]=1;
 frameData.set(vp);frameData.set(vp,16);frameData.set([0,0,1,1],52);frameData[59]=.3;frameData[70]=1;frameData.set([64,64,1/64,1/64],64);
 const particleData=new Float32Array([1,1,1,.7,.4,.4,.4,.8,0,.5,.2,0]);device.queue.writeBuffer(particle,0,particleData);
 const texture=(format='depth32float',sampleCount=1,copy=false)=>device.createTexture({size:[64,64],format,sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|(copy?GPUTextureUsage.COPY_SRC:0)});
 const depth=texture('depth32float',4),water=texture(),shadow=texture('depth32float',1,true),target=texture('rgba8unorm',1,true),colorMS=texture('rgba8unorm',4),normalMS=texture('rgba8unorm',4),normal=texture('rgba8unorm',1,true);
 const depthView=depth.createView(),waterView=water.createView(),shadowView=shadow.createView(),targetView=target.createView(),colorView=colorMS.createView(),normalView=normalMS.createView(),resolvedNormalView=normal.createView();
 const frameGroup=device.createBindGroup({layout:frameLayout,entries:[{binding:0,resource:{buffer:frame}}]}),screenGroup=device.createBindGroup({layout:screenLayout,entries:[{binding:2,resource:depthView},{binding:4,resource:waterView}]}),lightGroup=device.createBindGroup({layout:lightLayout,entries:[{binding:0,resource:shadowView},{binding:1,resource:{buffer:lights}},{binding:2,resource:{buffer:arcLights}},{binding:3,resource:{buffer:generatorLights}}]});
 async function readPixel(encoder,source=target,depthValue=false,point=[32,32]){
  encoder.copyTextureToBuffer({texture:source,...(depthValue?{aspect:'depth-only'}:{})},{buffer:read,bytesPerRow:256},[64,64]);device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);
  const bytes=new Uint8Array(read.getMappedRange()),offset=point[1]*256+point[0]*4,value=depthValue?new Float32Array(bytes.buffer)[point[1]*64+point[0]]:Array.from(bytes.subarray(offset,offset+4));read.unmap();return value;
 }
 const clearDepth=(encoder,view,value)=>encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view,depthClearValue:value,depthLoadOp:'clear',depthStoreOp:'store'}}).end();
 const drawParticle=async(pipeline=smokePipeline,opaque=.9,waterHeight=1,shadowHeight=.9,point=[32,32])=>{
  device.queue.writeBuffer(frame,0,frameData);device.queue.writeBuffer(lights,0,lightData);device.queue.writeBuffer(particle,0,particleData);const encoder=device.createCommandEncoder();
  clearDepth(encoder,depthView,opaque);clearDepth(encoder,waterView,waterHeight);clearDepth(encoder,shadowView,shadowHeight);
  const pass=encoder.beginRenderPass({colorAttachments:[{view:targetView,clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'}]});pass.setPipeline(pipeline);pass.setBindGroup(0,frameGroup);pass.setBindGroup(1,screenGroup);pass.setBindGroup(2,lightGroup);pass.setVertexBuffer(0,particle);pass.draw(6,1);pass.end();return readPixel(encoder,target,false,point);
 };
 const energy=rgba=>rgba[0]+rgba[1]+rgba[2];frameData.set([1,.95,.85],56);frameData.set([.25,.3,.4],60);
 const day=await drawParticle(),shadowed=await drawParticle(smokePipeline,.9,1,.1);check(energy(day)>70,'Lit smoke responds to sky and ambient');check(energy(shadowed)<energy(day)*.8&&energy(shadowed)>0,'Smoke receives sky shadows with ambient retained');
 frameData.set([.035,.05,.1],56);frameData.set([.006,.01,.022],60);const night=await drawParticle();check(energy(night)>0&&energy(night)<energy(day)*.6,'Smoke follows night light colours');
 // Put the only active light in slot11, beyond the original eight muzzle slots.
 lightData[0]=12;lightData.set([1,1,7,64,1,.61,.26,4],4+11*8);const blastLit=await drawParticle();check(energy(blastLit)>energy(night)+50&&blastLit[0]>blastLit[2],'Twelfth merged local light illuminates smoke');
 lightData.fill(0);lightData[0]=MAX_LOCAL_LIGHTS;lightData.set([1,1,7,32,1,.61,.26,3],4+(MAX_LOCAL_LIGHTS-1)*8);const thrustLit=await drawParticle();check(energy(thrustLit)>energy(night)+50&&thrustLit[0]>thrustLit[2],`Final slot${MAX_LOCAL_LIGHTS} carries warm missile exhaust light onto smoke`);
 lightData.fill(0);lightData[0]=1;lightData.set([1,1,7,32,1,.61,.26,3],4);const firstThrust=await drawParticle();check(firstThrust.every((value,i)=>value===thrustLit[i]),'Last exhaust slot has the same smoke response as the first point-light slot');
 lightData.fill(0);frameData.fill(0,56,59);frameData.fill(0,60,63);const unlit=await drawParticle();check(energy(unlit)===0,'Smoke has no emissive floor');
 frameData.set([1,.95,.85],56);frameData.set([.25,.3,.4],60);const hidden=await drawParticle(smokePipeline,.1),underwater=await drawParticle(smokePipeline,.9,.1);check(energy(hidden)===0,'Opaque depth fully occludes smoke');check(energy(underwater)>0&&energy(underwater)<energy(day)*.5,'Water attenuates smoke behind its surface');
 particleData.set([1,.25,.04,1],4);const blast=await drawParticle(blastPipeline),blastHidden=await drawParticle(blastPipeline,.1);check(energy(blast)>100&&blast[0]>blast[2],'Compact additive blast produces a warm luminous core');check(energy(blastHidden)===0,'Blast respects opaque depth');
 particleData.set([.52,.67,.7,.94,4,0,1,0],4);const dropDay=await drawParticle(),dropHidden=await drawParticle(smokePipeline,.1);check(energy(dropDay)>100,'Weighted water droplets render in the production translucent pipeline');check(energy(dropHidden)===0,'Water droplets respect opaque depth');
 frameData.fill(0,56,59);frameData.fill(0,60,63);const dropDark=await drawParticle();check(energy(dropDark)===0,'Water droplets have no emissive floor');frameData.set([1,.95,.85],56);frameData.set([.25,.3,.4],60);
 particleData[8]=3;particleData[11]=1;const crown=await drawParticle(smokePipeline,.9,1,.9,[32,44]);check(energy(crown)>30,'Water crown sheet renders above the impact');
 const beforeWater=new Float32Array(frameData),top=identity(),inverse=identity();top.fill(0);top[0]=1;top[9]=1;top[6]=-.1;top[12]=top[13]=-1;top[14]=.8;top[15]=1;inverse.fill(0);inverse[0]=1;inverse[6]=1;inverse[9]=-10;inverse[12]=inverse[14]=1;inverse[13]=8;inverse[15]=1;
 frameData.set(top);frameData.set(inverse,32);frameData.set([.2747,.4969,.6583,.85],80);frameData.set([0,1,0,1],52);particleData.set([1,1.12,1,.7,.55,.69,.7,.9,2,0,.2,1]);
 const ring=await drawParticle(smokePipeline,.9,.7,.9,[52,32]),ringDry=await drawParticle(smokePipeline,.9,1,.9,[52,32]),ringOtherHeight=await drawParticle(smokePipeline,.9,.4,.9,[52,32]),ringCentre=await drawParticle(smokePipeline,.9,.7);
 check(energy(ring)>30,'Expanding ripple is visible on its matching water plane');check(energy(ringDry)===0&&energy(ringOtherHeight)===0,'Ripple clips off dry pixels and unrelated water heights');check(energy(ringCentre)===0,'Ripple retains an open centre');frameData.set(beforeWater);
 const cubeBuffers=[{arrayStride:80,stepMode:'instance',attributes:[0,1,2,3,4].map(shaderLocation=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}],primitive={topology:'triangle-list',cullMode:'back'};
 const cubeDepth=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[frameLayout]}),vertex:{module:cubeModule,entryPoint:'debrisVertex',buffers:cubeBuffers},primitive,depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'},multisample:{count:4}});
 const cubeShadow=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[frameLayout]}),vertex:{module:cubeModule,entryPoint:'debrisShadow',buffers:cubeBuffers},primitive,depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'}});
 const cubeColor=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[frameLayout,lightLayout]}),vertex:{module:cubeModule,entryPoint:'debrisVertex',buffers:cubeBuffers},fragment:{module:cubeModule,entryPoint:'fragment',targets:[{format:'rgba8unorm'},{format:'rgba8unorm'}]},primitive,depthStencil:{format:'depth32float',depthWriteEnabled:false,depthCompare:'equal'},multisample:{count:4}});
 const cubeData=new Float32Array(20);cubeData.set(identity());cubeData[0]=cubeData[5]=cubeData[10]=.7;cubeData[12]=cubeData[13]=cubeData[14]=1;cubeData.set([.4,.2,.1,0],16);device.queue.writeBuffer(cube,0,cubeData);
 const drawCube=async(clear=.9,copy=target)=>{
  device.queue.writeBuffer(frame,0,frameData);device.queue.writeBuffer(lights,0,lightData);const encoder=device.createCommandEncoder();
  for(const [view,pipeline,samples] of [[depthView,cubeDepth,4],[shadowView,cubeShadow,1]]){const pass=encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view,depthClearValue:clear,depthLoadOp:'clear',depthStoreOp:'store'}});pass.setPipeline(pipeline);pass.setBindGroup(0,frameGroup);pass.setVertexBuffer(0,cube);pass.draw(36,1);pass.end();}
  const pass=encoder.beginRenderPass({colorAttachments:[{view:colorView,resolveTarget:targetView,clearValue:{r:0,g:0,b:0,a:0},loadOp:'clear',storeOp:'discard'},{view:normalView,resolveTarget:resolvedNormalView,clearValue:{r:0,g:0,b:0,a:0},loadOp:'clear',storeOp:'discard'}],depthStencilAttachment:{view:depthView,depthReadOnly:true}});pass.setPipeline(cubeColor);pass.setBindGroup(0,frameGroup);pass.setBindGroup(1,lightGroup);pass.setVertexBuffer(0,cube);pass.draw(36,1);pass.end();return readPixel(encoder,copy,copy===shadow);
 };
 const cubeDay=await drawCube(),cubeNormal=await drawCube(.9,normal),shadowDepth=await drawCube(.9,shadow),cubeOccluded=await drawCube(.1);check(cubeDay[0]>cubeDay[1]&&cubeDay[1]>cubeDay[2]&&energy(cubeDay)>50,'Opaque cubes preserve model-colour hierarchy under scene lighting');check(cubeNormal[2]>240&&cubeNormal[3]===0,'Cube normal buffer carries physical face normals and zero reflectiveness');check(shadowDepth>.3&&shadowDepth<.35,'Cube casts into the production shadow-depth pass');check(energy(cubeOccluded)===0,'Cube depth prepass rejects scenery-hidden fragments');
 frameData.fill(0,56,59);frameData.fill(0,60,63);lightData[0]=12;lightData.set([1,1,7,64,1,.61,.26,4],4+11*8);const cubeLocal=await drawCube();check(energy(cubeLocal)>50,'Twelfth merged light illuminates opaque debris');
 await device.queue.onSubmittedWorkDone();check(errors.length===0,errors.join('\n')||'No WebGPU validation errors');
 result.textContent=JSON.stringify({passed:checks.length,failed:0,checks,pixelValues:{day,shadowed,night,blastLit,thrustLit,firstThrust,unlit,hidden,underwater,blast,blastHidden,dropDay,dropHidden,dropDark,crown,ring,ringDry,ringOtherHeight,ringCentre,cubeDay,cubeNormal,shadowDepth,cubeOccluded,cubeLocal}},null,2);
}catch(error){result.textContent='FAILED: '+error.message;console.error(error);}finally{device?.destroy();}
