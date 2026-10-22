import {shotLighting} from '/engine/shot-shaders.js';
import {geometry,composite,compositeBloom} from '/engine/shaders.js';
import {damageCubes,damageParticles} from '/engine/damage-shaders.js';
import {GeneratorLights} from '/engine/generator-lights.js';
import {ArcEffects} from '/engine/arc-effects.js';
import {ARC_LIGHT_BYTES} from '/shared/arc-effects.js';
import {MAX_LOCAL_LIGHTS} from '/shared/shot-effects.js';
import {MAX_GENERATOR_LIGHTS,GENERATOR_LIGHT_BYTES} from '/shared/generator-lights.js';
const result=document.getElementById('result');let device;
try{
 device=await(await navigator.gpu.requestAdapter()).requestDevice();const errors=[],checks=[],readbacks={};device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
 const check=(condition,label)=>{if(!condition)throw new Error(label);checks.push(label);};
 const shader=async code=>{const module=device.createShaderModule({code});const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(m=>m.message).join('\n'));return module;};
 for(const [label,code]of [['opaque',geometry],['water/display',composite],['bloom composite',compositeBloom],['debris',damageCubes],['smoke',damageParticles]]){await shader(code);check(true,label+' compiles with independent generator and Arc lighting');}
 const module=await shader(shotLighting(0,true)+`
 struct Sample {position:vec4<f32>,normal:vec4<f32>};
 @group(1) @binding(0) var<storage,read> samples:array<Sample>;
 @group(1) @binding(1) var<storage,read_write> values:array<vec4<f32>>;
 @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){values[id.x]=vec4<f32>(muzzleLighting(samples[id.x].position.xyz,samples[id.x].normal.xyz),1);}`);
 const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}),buffer=(size,usage)=>device.createBuffer({size,usage});
 const points=buffer((4+MAX_LOCAL_LIGHTS*8)*4,GPUBufferUsage.UNIFORM),arcs=buffer(ARC_LIGHT_BYTES,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),generators=buffer(GENERATOR_LIGHT_BYTES,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),samples=buffer(160,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),values=buffer(80,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),read=buffer(80,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);
 const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:points}},{binding:2,resource:{buffer:arcs}},{binding:3,resource:{buffer:generators}}]}),sampleGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:samples}},{binding:1,resource:{buffer:values}}]});
 device.queue.writeBuffer(samples,0,new Float32Array([0,0,0,0,0,1,0,0, 0,-5,0,0,0,1,0,0, 0,-20,0,0,0,1,0,0, 0,0,0,0,0,-1,0,0, 0,5,0,0,0,1,0,0]));
 const run=async()=>{const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.setBindGroup(1,sampleGroup);pass.dispatchWorkgroups(5);pass.end();encoder.copyBufferToBuffer(values,0,read,0,80);device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);const data=new Float32Array(read.getMappedRange()).slice();read.unmap();return data;};
 const lights=new GeneratorLights(),connection={source:[-12,5,0],target:[12,5,0]};lights.setLinks([connection]);device.queue.writeBuffer(generators,0,lights.lightData);const green=await run();readbacks.single=Array.from(green);
 check(green[1]>0&&green[1]>green[0]*5&&green[1]>green[2]*3,'Static midpoint produces the accepted green light');check(green[1]>green[5]&&green[5]>0,'Distance attenuates the point light');check(green[8]===0,'Point light stops outside its radius');check(green[12]===0,'Back faces receive no light');check(Array.from(green).every(Number.isFinite),'Exact light position is finite');
 lights.setLinks(Array.from({length:MAX_GENERATOR_LIGHTS},()=>connection));device.queue.writeBuffer(generators,0,lights.lightData);const full=await run();check(Math.abs(full[1]-green[1]*MAX_GENERATOR_LIGHTS)<.001,'All 128 generator slots contribute without replacing Arc slots');
 const activeArc=new ArcEffects(()=>.5);activeArc.emit([-6,6,0],[6,6,0],[0,1,0],0);activeArc.prepare();device.queue.writeBuffer(arcs,0,activeArc.lightData);const both=await run();check(both[1]>full[1]&&both[0]>full[0],'Combat Arc and generator illumination add independently');
 activeArc.reset();device.queue.writeBuffer(arcs,0,activeArc.lightData);const expired=await run();check(Math.abs(expired[1]-full[1])<.001,'Arc expiry leaves generator lights intact');
 lights.setLinks([]);device.queue.writeBuffer(generators,0,lights.lightData);const clear=await run();check([0,4,8,12,16].every(i=>clear[i]===0),'Empty generator topology clears all illumination');
 await device.queue.onSubmittedWorkDone();check(errors.length===0,'No WebGPU errors');result.textContent=JSON.stringify({passed:checks.length,failed:0,checks,readbacks,resources:{pointLightBankBytes:GENERATOR_LIGHT_BYTES,beamVertices:0,animatedLinkUpdates:0},errors},null,2);
}catch(error){result.textContent='FAILED: '+error.message;console.error(error);}finally{device?.destroy();}
