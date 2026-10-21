import {ARC_EMPTY_LIGHT_BYTES} from '/shared/arc-effects.js';
// Developer-only readback of the full production snow shader. A large fixture
// flake gives a deterministic covered pixel; game sizes remain author tuning.
import {snowParticles} from '/engine/snow-shaders.js';
import {SNOW_DRIFT_X,SNOW_DRIFT_Z,SNOW_FALL_SPEED} from '/engine/snow.js';
import {MAX_LOCAL_LIGHTS} from '/shared/shot-effects.js';
import {identity} from '/shared/math.js';
const result=document.getElementById('result');let device;
try{
 device=await(await navigator.gpu.requestAdapter()).requestDevice();const errors=[];
 device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
 const check=(condition,message)=>{if(!condition)throw new Error(message);};
 const arcLights=device.createBuffer({size:ARC_EMPTY_LIGHT_BYTES,usage:GPUBufferUsage.STORAGE});
 const module=device.createShaderModule({code:snowParticles});
 for(const message of(await module.getCompilationInfo()).messages)if(message.type==='error')throw new Error(message.message);
 const pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vertex',buffers:[{arrayStride:48,stepMode:'instance',attributes:[{shaderLocation:0,offset:0,format:'float32x4'},{shaderLocation:1,offset:16,format:'float32x4'},{shaderLocation:2,offset:32,format:'float32x4'}]}]},fragment:{module,entryPoint:'fragment',targets:[{format:'rgba8unorm',blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:'none'}});
 const buffer=(size,usage)=>device.createBuffer({size,usage});
 const frame=buffer(368,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),lights=buffer((4+MAX_LOCAL_LIGHTS*8)*4,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),instance=buffer(48,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST),read=buffer(64*256,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
 const frameData=new Float32Array(92),lightData=new Float32Array(4+MAX_LOCAL_LIGHTS*8),instanceData=new Float32Array([1,1,1,0,.7,2,0,0,2,2,4,.5]),vp=identity();vp[12]=vp[13]=-1;vp[10]=.5;
 frameData.set(vp);frameData.set(vp,16);frameData.set([0,Math.SQRT1_2,Math.SQRT1_2,1],52);frameData[59]=.3;frameData[70]=1;frameData.set([64,64,1/64,1/64],64);
 const texture=(sampleCount=1)=>device.createTexture({size:[64,64],format:'depth32float',sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
 const depth=texture(4),water=texture(),shadow=texture(),target=device.createTexture({size:[64,64],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 const depthView=depth.createView(),waterView=water.createView(),shadowView=shadow.createView(),targetView=target.createView();
 const groups=[
  device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:frame}}]}),
  device.createBindGroup({layout:pipeline.getBindGroupLayout(1),entries:[{binding:2,resource:depthView},{binding:4,resource:waterView}]}),
  device.createBindGroup({layout:pipeline.getBindGroupLayout(2),entries:[{binding:0,resource:shadowView},{binding:1,resource:{buffer:lights}},{binding:2,resource:{buffer:arcLights}}]}),
 ];
 const draw=async(opaque=.9,waterDepth=1,shadowDepth=.9)=>{
  device.queue.writeBuffer(frame,0,frameData);device.queue.writeBuffer(lights,0,lightData);device.queue.writeBuffer(instance,0,instanceData);
  const encoder=device.createCommandEncoder();
  for(const [view,depthClearValue]of [[depthView,opaque],[waterView,waterDepth],[shadowView,shadowDepth]])encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view,depthClearValue,depthLoadOp:'clear',depthStoreOp:'store'}}).end();
  const pass=encoder.beginRenderPass({colorAttachments:[{view:targetView,clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'}]});
  pass.setPipeline(pipeline);for(let i=0;i<groups.length;i++)pass.setBindGroup(i,groups[i]);pass.setVertexBuffer(0,instance);pass.draw(6,1);pass.end();
  encoder.copyTextureToBuffer({texture:target},{buffer:read,bytesPerRow:256},[64,64]);device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);
  const rgb=Array.from(new Uint8Array(read.getMappedRange()).subarray(32*256+32*4,32*256+32*4+3));read.unmap();return rgb;
 };
 const energy=rgb=>rgb[0]+rgb[1]+rgb[2];
 frameData.set([1,.95,.85],56);frameData.set([.25,.3,.4],60);
 const day=await draw(),shadowed=await draw(.9,1,.1);
 check(energy(day)>90,'Day snow must respond to authored sky and ambient light');
 check(energy(shadowed)>0&&energy(shadowed)<energy(day)*.8,'Sky shadows must reduce sunlight while preserving ambient illumination');
 frameData.set([.035,.05,.1],56);frameData.set([.006,.01,.022],60);
 const night=await draw();check(energy(night)>0&&energy(night)<energy(day)*.55,'Night snow must inherit the changed light colours');
 lightData[0]=1;lightData.set([1,1,7,96,1,.61,.26,4],4);
 const muzzle=await draw();check(energy(muzzle)>energy(night)+80&&muzzle[0]>muzzle[2],'Muzzle lighting must brighten flakes and tint them warm');
 lightData[6]=130;const outsideRadius=await draw();check(outsideRadius.every((n,i)=>n===night[i]),'Point lighting must stop at its actual radius');
 lightData[0]=0;const expired=await draw();check(expired.every((n,i)=>n===night[i]),'Expired muzzle lights must leave no residual glow');
 frameData.fill(0,56,59);frameData.fill(0,60,63);const unlit=await draw();check(energy(unlit)===0,'Snow must have no emissive floor');
 frameData.set([1,.95,.85],56);frameData.set([.25,.3,.4],60);
 const opaqueHidden=await draw(.25),waterHidden=await draw(.9,.25);
 check(energy(opaqueHidden)===0,'Opaque depth must hide flakes behind actors and scenery');check(energy(waterHidden)===0,'Water must hide flakes beneath its surface');
 // Hold the test flake's world centre fixed while advancing its trajectory age,
 // so disappearance proves the first-hit lifetime gate rather than screen exit.
 instanceData[5]=.1;
 for(const age of [.2,1]){
  frameData[79]=age;instanceData[0]=1-SNOW_DRIFT_X*age;instanceData[1]=1+SNOW_FALL_SPEED*age;instanceData[2]=1-SNOW_DRIFT_Z*age;
  check(energy(await draw())===0,'An expired flake must not reappear later under an overhang');
 }
 frameData[79]=0;instanceData[0]=instanceData[1]=instanceData[2]=1;const restarted=await draw();check(energy(restarted)>0,'A new flight cycle must restore the flake');
 instanceData[8]=.5;const outsideLevel=await draw();check(energy(outsideLevel)===0,'Snow must clip to the level footprint even with padded flutter spawn bounds');
 await device.queue.onSubmittedWorkDone();check(errors.length===0,errors.join('\n'));
 result.textContent=JSON.stringify({passed:13,failed:0,checks:'Production snow lighting, shadows, muzzle radius/expiry, zero emission, opaque/water depth, first-hit lifetime, cycle restart and level clipping',pixelValues:{day,shadowed,night,muzzle,outsideRadius,expired,unlit,opaqueHidden,waterHidden,restarted,outsideLevel}},null,2);
}catch(error){result.textContent='FAILED: '+error.message;console.error(error);}finally{device?.destroy();}
