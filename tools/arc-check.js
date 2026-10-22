import {GENERATOR_EMPTY_LIGHT_BYTES} from '/shared/generator-lights.js';
// Isolated production-shader readback. Does not start the game or its clock.
import {geometry,composite,compositeBloom,uniforms} from '/engine/shaders.js';
import {shotLighting} from '/engine/shot-shaders.js';
import {arcParticles} from '/engine/arc-shaders.js';
import {damageCubes,damageParticles} from '/engine/damage-shaders.js';
import {ArcEffects} from '/engine/arc-effects.js';
import {ARC_LIGHT_BYTES,ARC_EMPTY_LIGHT_BYTES,ARC_LIGHT_FLOATS,ARC_LIGHT_STRENGTH,ARC_TRUNK_SEGMENTS} from '/shared/arc-effects.js';
import {MAX_LOCAL_LIGHTS} from '/shared/shot-effects.js';
import {identity,perspective} from '/shared/math.js';
const result=document.getElementById('result');let device;
try{
 device=await(await navigator.gpu.requestAdapter()).requestDevice();const errors=[],checks=[],readbacks={};
 device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
 const check=(condition,label)=>{if(!condition)throw new Error(label);checks.push(label);};
 const shader=async(code,label)=>{const module=device.createShaderModule({label,code});const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');if(errors.length)throw new Error(label+': '+errors.map(m=>m.message).join('\n'));return module;};
 for(const [label,code]of [['opaque',geometry],['water and SSR',composite],['bloom display',compositeBloom],['debris',damageCubes],['smoke and blast',damageParticles]]){await shader(code,label);check(true,label+' production module compiles with tube lighting');}
 const numeric=await shader(uniforms+shotLighting(0,true)+`
 struct Sample {position:vec4<f32>,normal:vec4<f32>};
 @group(1) @binding(0) var<storage,read> samples:array<Sample>;
 @group(1) @binding(1) var<storage,read_write> values:array<vec4<f32>>;
 @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){
  let s=samples[id.x];var value=muzzleLighting(s.position.xyz,s.normal.xyz);
  values[id.x]=vec4<f32>(value,1);
 }`,'Production local material responses');
 const compute=await device.createComputePipelineAsync({layout:'auto',compute:{module:numeric,entryPoint:'main'}});
 const buffer=(size,usage)=>device.createBuffer({size,usage}),pointData=new Float32Array(4+MAX_LOCAL_LIGHTS*8),arcData=new Float32Array(ARC_LIGHT_BYTES/4),sampleData=new Float32Array(5*8);
 const points=buffer(pointData.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),arcs=buffer(ARC_LIGHT_BYTES,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),empty=buffer(ARC_EMPTY_LIGHT_BYTES,GPUBufferUsage.STORAGE),samples=buffer(sampleData.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),values=buffer(80,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),read=buffer(80,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);
 const generatorLights=device.createBuffer({size:GENERATOR_EMPTY_LIGHT_BYTES,usage:GPUBufferUsage.STORAGE});
 const lightGroup=arc=>device.createBindGroup({layout:compute.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:points}},{binding:2,resource:{buffer:arc}},{binding:3,resource:{buffer:generatorLights}}]}),lg=lightGroup(arcs),emptyGroup=lightGroup(empty),sg=device.createBindGroup({layout:compute.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:samples}},{binding:1,resource:{buffer:values}}]});
 const run=async(group=lg)=>{device.queue.writeBuffer(points,0,pointData);device.queue.writeBuffer(arcs,0,arcData);device.queue.writeBuffer(samples,0,sampleData);const e=device.createCommandEncoder(),p=e.beginComputePass();p.setPipeline(compute);p.setBindGroup(0,group);p.setBindGroup(1,sg);p.dispatchWorkgroups(5);p.end();e.copyBufferToBuffer(values,0,read,0,80);device.queue.submit([e.finish()]);await read.mapAsync(GPUMapMode.READ);const data=new Float32Array(read.getMappedRange()).slice();read.unmap();return data;};
 const close=(a,b)=>Math.abs(a-b)<1e-5;
 arcData[0]=1;arcData.set([.43,.66,1,18,ARC_LIGHT_STRENGTH,1,0,0,-60,5,0,1,60,5,0,1],4);
 sampleData.set([0,0,0,0,0,1,0,0, 90,0,0,0,0,1,0,0, 0,0,0,0,0,-1,0,0, 0,-13,0,0,0,1,0,0, 0,5,0,0,0,1,0,0]);
 const lit=await run(),relative=25/324,expected=ARC_LIGHT_STRENGTH*(1-relative)**2/(1+13.824*relative);readbacks.midpoint=Array.from(lit.slice(0,3));
 check([0,1,2].every(i=>close(lit[i],[.43,.66,1][i]*expected)),'Finite tube illuminates its middle although both endpoints lie beyond the radius');
 check(lit[4]===0,'Light stops beyond the finite end cap');
 check(lit[8]===0,'Opaque back faces remain dark');
 check(lit[12]===0,'Light stops exactly at the radial boundary');
 check(Array.from(lit).every(Number.isFinite),'Exact tube centre and boundaries stay finite');
 const inactive=await run(emptyGroup);check([0,4,8,12,16].every(i=>inactive[i]===0),'Minimal inactive storage binding produces no arc illumination');
 arcData[9]=2;arcData.set([-60,5,0,1,0,5,0,1, 0,5,0,1,60,5,0,1],12);
 const split=await run();check([0,1,2].every(i=>close(split[i],lit[i])),'Splitting one tube at a joint does not multiply its brightness');
 arcData[0]=2;arcData.set(arcData.slice(4,4+ARC_LIGHT_FLOATS),4+ARC_LIGHT_FLOATS);const doubled=await run();check([0,1,2].every(i=>close(doubled[i],lit[i]*2)),'Independent strikes add their light');
 arcData[0]=1;arcData[9]=1;
 sampleData[7]=0;sampleData[5]=1;pointData[0]=1;pointData.set([0,4,0,48,1,.61,.26,10],4);
 const mixed=await run();arcData[0]=0;const point=await run();check([0,1,2].every(i=>close(mixed[i],lit[i]+point[i])),'Existing point lights and new tube lights combine without replacing either');
 check(point[0]>point[1]&&point[1]>point[2]&&point[0]>0,'Existing point light colour and contribution are preserved');pointData.fill(0);
 let seed=37;const effects=new ArcEffects(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;});
 effects.emit([-60,5,0],[60,5,0],[-1,0,0],0);effects.prepare();arcData.set(effects.lightData);const actual=await run();check(actual[0]>0&&actual[2]>actual[0],'The actual pooled jagged arc lights surfaces along its interior');
 check(effects.instanceCount-effects.sparkCount===ARC_TRUNK_SEGMENTS&&effects.lightData[9]===8,'The production strike contains one unbranched channel and eight tube spans');
 effects.advance(.3);effects.prepare();arcData.set(effects.lightData);const expired=await run();check([0,4,8,12,16].every(i=>expired[i]===0),'Actual pool expiry removes every tube light');

 const module=await shader(arcParticles(uniforms),'Arc ribbon and bloom'),W=64,H=64;
 const vertex={module,entryPoint:'vertex',buffers:[{arrayStride:48,stepMode:'instance',attributes:[0,1,2].map(shaderLocation=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}]};
 const pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex,fragment:{module,entryPoint:'fragment',targets:[{format:'rgba8unorm',blend:{color:{srcFactor:'src-alpha',dstFactor:'one',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:'none'}});
 const bloom=await device.createRenderPipelineAsync({layout:'auto',vertex,fragment:{module,entryPoint:'bloomFragment',targets:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list',cullMode:'none'}});
 check(true,'Both full-resolution ribbon and reduced bloom pipelines compile');
 const frame=buffer(368,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),instances=buffer(48,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST),pixels=buffer(H*256,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),settings=buffer(16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
 const frameData=new Float32Array(92),instanceData=new Float32Array([-.7,0,.6,.08,.7,0,.6,1,.56,.74,1,0]);frameData.set(identity());frameData[70]=1;device.queue.writeBuffer(settings,0,new Float32Array([4,4,0,0]));
 const texture=(format,sampleCount=1,size=W)=>device.createTexture({size:[size,size],format,sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|(sampleCount===1?GPUTextureUsage.COPY_SRC:0)});
 const depth=texture('depth32float',4),water=texture('depth32float'),target=texture('rgba8unorm'),reduced=texture('rgba8unorm',1,16),depthView=depth.createView(),waterView=water.createView();
 const bindings=p=>[device.createBindGroup({layout:p.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:frame}}]}),device.createBindGroup({layout:p.getBindGroupLayout(1),entries:[{binding:2,resource:depthView},{binding:4,resource:waterView}]})];
 const normalGroups=bindings(pipeline),bloomGroups=bindings(bloom),bloomEmpty=device.createBindGroup({layout:bloom.getBindGroupLayout(2),entries:[]}),bloomSettings=device.createBindGroup({layout:bloom.getBindGroupLayout(3),entries:[{binding:0,resource:{buffer:settings}}]});
 const draw=async(opaque=.9,waterDepth=1,reducedPass=false)=>{
  device.queue.writeBuffer(frame,0,frameData);device.queue.writeBuffer(instances,0,instanceData);const e=device.createCommandEncoder();
  for(const [view,depthClearValue]of [[depthView,opaque],[waterView,waterDepth]])e.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view,depthClearValue,depthLoadOp:'clear',depthStoreOp:'store'}}).end();
  const tex=reducedPass?reduced:target,size=reducedPass?16:W,p=e.beginRenderPass({colorAttachments:[{view:tex.createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'}]}),groups=reducedPass?bloomGroups:normalGroups;p.setPipeline(reducedPass?bloom:pipeline);p.setBindGroup(0,groups[0]);p.setBindGroup(1,groups[1]);if(reducedPass){p.setBindGroup(2,bloomEmpty);p.setBindGroup(3,bloomSettings);}p.setVertexBuffer(0,instances);p.draw(6,1);p.end();
  e.copyTextureToBuffer({texture:tex},{buffer:pixels,bytesPerRow:256},[size,size]);device.queue.submit([e.finish()]);await pixels.mapAsync(GPUMapMode.READ);const data=new Uint8Array(pixels.getMappedRange());let sum=0,count=0;for(let y=0;y<size;y++)for(let x=0;x<size;x++){const k=y*256+x*4;sum+=data[k]+data[k+1]+data[k+2];if(data[k]+data[k+1]+data[k+2])count++;}const centre=Array.from(data.slice(Math.floor(size/2)*256+Math.floor(size/2)*4,Math.floor(size/2)*256+Math.floor(size/2)*4+3));pixels.unmap();return {sum,count,centre};
 };
 const visible=await draw(),hidden=await draw(.5),underwater=await draw(.9,.4);readbacks.ribbon={visible,hidden,underwater};
 check(visible.sum>0&&visible.centre[0]>100,'The actual ribbon renders a bright narrow channel');
 check(hidden.sum===0,'Opaque depth completely hides a channel behind it');
 check(underwater.sum>visible.sum*.2&&underwater.sum<visible.sum*.4,'Water attenuates the channel behind its surface');
 const halo=await draw(.9,1,true),haloHidden=await draw(.5,1,true),haloWet=await draw(.9,.4,true);readbacks.bloom={halo,haloHidden,haloWet};
 check(halo.sum>0&&haloHidden.sum===0,'Reduced channel emission observes full-resolution opaque depth');
 check(haloWet.sum>0&&haloWet.sum<halo.sum*.4,'Reduced channel emission observes water attenuation');
 instanceData.set([1,.55,.08,1],8);const metal=await draw();readbacks.metal=metal;
 check(metal.sum>0&&metal.centre[0]>metal.centre[1]&&metal.centre[1]>metal.centre[2],'Hot metal flecks reach the display in warm yellow-orange colours');
 check((await draw(.9,1,true)).sum===0,'Metal flecks stay crisp without extra bloom');instanceData[11]=0;
 perspective(frameData.subarray(0,16),Math.PI/2,1,.1,10);frameData[71]=1;instanceData.set([-.4,0,-1,.015,.2,0,.25,1,.56,.74,1,0]);
 const crossing=await draw(1);check(crossing.sum>0&&crossing.count<W*H*.25,'Perspective near-plane clipping retains a narrow crossing ribbon without screen-filling triangles');
 instanceData.set([-.4,0,.3,.015,.2,0,.25,1,.56,.74,1,0]);check((await draw(1)).sum===0,'A channel wholly behind the perspective near plane is hidden');
 await device.queue.onSubmittedWorkDone();check(errors.length===0,errors.join('\n')||'No WebGPU validation errors');
 result.textContent=JSON.stringify({passed:checks.length,failed:0,checks,readbacks,resources:{inactiveLightBytes:ARC_EMPTY_LIGHT_BYTES,activeLightBytes:ARC_LIGHT_BYTES},errors},null,2);
}catch(error){result.textContent='FAILED: '+error.message;console.error(error);}finally{device?.destroy();}
