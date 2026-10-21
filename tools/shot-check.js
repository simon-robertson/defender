// Developer-only GPU regression using the actual production shader functions.
import {uniforms} from '/engine/shaders.js';
import {shotParticles,shotLighting} from '/engine/shot-shaders.js';
import {MAX_LOCAL_LIGHTS} from '/shared/shot-effects.js';
import {identity} from '/shared/math.js';
const result=document.getElementById('result');let device;
try{
 device=await(await navigator.gpu.requestAdapter()).requestDevice();const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const buffer=(size,usage)=>device.createBuffer({size,usage});
 const shader=async code=>{const module=device.createShaderModule({code});for(const m of(await module.getCompilationInfo()).messages)if(m.type==='error')throw new Error(m.message);return module;};
 const check=(condition,message)=>{if(!condition)throw new Error(message);};
 const lightModule=await shader(shotLighting(0)+`
 struct Sample {position:vec4<f32>,normal:vec4<f32>};
 @group(1) @binding(0) var<storage,read> samples:array<Sample>;
 @group(1) @binding(1) var<storage,read_write> values:array<vec4<f32>>;
 @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){values[id.x]=vec4<f32>(muzzleLighting(samples[id.x].position.xyz,samples[id.x].normal.xyz),1);}`);
 const compute=await device.createComputePipelineAsync({layout:'auto',compute:{module:lightModule,entryPoint:'main'}});
 const lights=buffer((4+MAX_LOCAL_LIGHTS*8)*4,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),samples=buffer(5*32,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),values=buffer(5*16,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),read=buffer(5*16,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);
 const lightData=new Float32Array(4+MAX_LOCAL_LIGHTS*8);lightData[0]=1;lightData.set([0,4,0,48,1,.61,.26,10],4);device.queue.writeBuffer(lights,0,lightData);
 device.queue.writeBuffer(samples,0,new Float32Array([0,0,0,0,0,1,0,0, 0,0,0,0,0,-1,0,0, 0,-60,0,0,0,1,0,0, 0,-20,0,0,0,1,0,0, 0,4,0,0,0,1,0,0]));
 const lg=device.createBindGroup({layout:compute.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:lights}}]}),sg=device.createBindGroup({layout:compute.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:samples}},{binding:1,resource:{buffer:values}}]});
 const runLight=async()=>{const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(compute);pass.setBindGroup(0,lg);pass.setBindGroup(1,sg);pass.dispatchWorkgroups(5);pass.end();encoder.copyBufferToBuffer(values,0,read,0,80);device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);const data=new Float32Array(read.getMappedRange()).slice();read.unmap();return data;};
 const lit=await runLight();check(lit[0]>lit[12]&&lit[12]>0,'Light must weaken with distance');check(lit[4]===0,'Back faces must not receive the pulse');check(lit[8]===0,'Light must stop at its finite radius');check(lit[0]>lit[1]&&lit[1]>lit[2],'Light must retain its warm colour');check(Array.from(lit).every(Number.isFinite),'Light at its exact origin must stay finite');
 lightData[0]=0;device.queue.writeBuffer(lights,0,lightData);const dark=await runLight();check([0,4,8,12,16].every(i=>dark[i]===0),'Expired lights must leave no residual illumination');

 const module=await shader(shotParticles(uniforms)),pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vertex',buffers:[{arrayStride:64,stepMode:'instance',attributes:[0,1,2,3].map(shaderLocation=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}]},fragment:{module,entryPoint:'fragment',targets:[{format:'rgba8unorm',blend:{color:{srcFactor:'src-alpha',dstFactor:'one',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:'none'}});
 const frame=buffer(368,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),instances=buffer(64,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST),pixels=buffer(16*256,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);
 const frameData=new Float32Array(92);frameData.set(identity());frameData[70]=1;device.queue.writeBuffer(frame,0,frameData);device.queue.writeBuffer(instances,0,new Float32Array([0,0,.6,.5,0,0,0,0,1,1,1,1,1,0,0,0]));
 const depth=device.createTexture({size:[16,16],format:'depth32float',sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),water=device.createTexture({size:[16,16],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),target=device.createTexture({size:[16,16],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 const depthView=depth.createView(),waterView=water.createView(),targetView=target.createView(),fg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:frame}}]}),dg=device.createBindGroup({layout:pipeline.getBindGroupLayout(1),entries:[{binding:2,resource:depthView},{binding:4,resource:waterView}]});
 const draw=async(opaque,waterHeight)=>{
  const encoder=device.createCommandEncoder();for(const [view,depthClearValue]of [[depthView,opaque],[waterView,waterHeight]])encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view,depthClearValue,depthLoadOp:'clear',depthStoreOp:'store'}}).end();
  const pass=encoder.beginRenderPass({colorAttachments:[{view:targetView,clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'}]});pass.setPipeline(pipeline);pass.setBindGroup(0,fg);pass.setBindGroup(1,dg);pass.setVertexBuffer(0,instances);pass.draw(6,1);pass.end();encoder.copyTextureToBuffer({texture:target},{buffer:pixels,bytesPerRow:256},[16,16]);device.queue.submit([encoder.finish()]);await pixels.mapAsync(GPUMapMode.READ);const value=new Uint8Array(pixels.getMappedRange())[8*256+8*4];pixels.unmap();return value;
 };
 const visible=await draw(.9,1),hidden=await draw(.5,1),underwater=await draw(.9,.4);
 check(visible>150,'Particle in front of geometry must be visible');check(hidden===0,'Opaque geometry must hide the particle');check(underwater>visible*.15&&underwater<visible*.4,'Water must attenuate a particle behind its surface');
 frameData[91]=-1;device.queue.writeBuffer(frame,0,frameData);const dryBinding=await draw(.9,.4);check(dryBinding===visible,'Dry-scene guard must ignore inactive water binding');
 await device.queue.onSubmittedWorkDone();check(errors.length===0,errors.join('\n'));
 result.textContent=JSON.stringify({passed:10,failed:0,checks:'Light falloff, back faces, radius, colour, finite origin, expiry; particle visibility, opaque occlusion, water attenuation',pixelValues:{visible,hidden,underwater,dryBinding}},null,2);
}catch(error){result.textContent='FAILED: '+error.message;console.error(error);}finally{device?.destroy();}
