// Production panel extraction and local-light shader readback; no game UI state.
import {ModelLights} from '/engine/model-lights.js';
import {meshPart} from '/shared/mesher.js';
import {identity} from '/shared/math.js';
import {modelForZone} from '/shared/zone-style.js';
import {MAX_LOCAL_LIGHTS} from '/shared/shot-effects.js';
import {MODEL_LIGHT_RADIUS,MODEL_LIGHT_STRENGTH} from '/shared/model-lights.js';
import {shotLighting,shotParticles} from '/engine/shot-shaders.js';
import {geometry,composite,uniforms} from '/engine/shaders.js';
import {damageCubes,damageParticles} from '/engine/damage-shaders.js';
const output=document.getElementById('result');let device;
try{
 device=await(await navigator.gpu.requestAdapter()).requestDevice();const errors=[],checks=[],readbacks={};device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
 const check=(condition,label)=>{if(!condition)throw new Error(label);checks.push(label);};
 const shader=async(code,label)=>{const module=device.createShaderModule({label,code});const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');if(errors.length)throw new Error(label+': '+errors.map(m=>m.message).join('\n'));return module;};
 for(const [label,code] of [['opaque models',geometry],['water and SSR',composite],['muzzle particles',shotParticles(uniforms)],['debris',damageCubes],['smoke and blast',damageParticles]]){await shader(code,label);check(true,label+' compiles with expanded light capacity');}
 const module=await shader(shotLighting(0)+`
 struct Sample {position:vec4<f32>,normal:vec4<f32>};
 @group(1) @binding(0) var<storage,read> samples:array<Sample>;
 @group(1) @binding(1) var<storage,read_write> values:array<vec4<f32>>;
 @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){values[id.x]=vec4<f32>(muzzleLighting(samples[id.x].position.xyz,samples[id.x].normal.xyz),1);}`,'Local lighting numeric check');
 const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}),buffer=(size,usage)=>device.createBuffer({size,usage});
 const lightData=new Float32Array(4+MAX_LOCAL_LIGHTS*8),sampleData=new Float32Array(40);
 const lights=buffer(lightData.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),samples=buffer(160,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),values=buffer(80,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),read=buffer(80,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);
 const lg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:lights}}]}),sg=device.createBindGroup({layout:pipeline.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:samples}},{binding:1,resource:{buffer:values}}]});
 const run=async()=>{device.queue.writeBuffer(lights,0,lightData);device.queue.writeBuffer(samples,0,sampleData);const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,lg);pass.setBindGroup(1,sg);pass.dispatchWorkgroups(5);pass.end();encoder.copyBufferToBuffer(values,0,read,0,80);device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);const data=new Float32Array(read.getMappedRange()).slice();read.unmap();return data;};
 const sampleAround=(x,y,z)=>{sampleData.set([x,y-2,z,0,0,1,0,0, x,y-8,z,0,0,1,0,0, x,y-MODEL_LIGHT_RADIUS,z,0,0,1,0,0, x,y-2,z,0,0,-1,0,0, x,y,z,0,0,1,0,0]);};
 const {asset:turret}=await(await fetch('/api/models/turret-study')).json();let field,lastLit;
 for(const zone of ['A','B','C','D']){
  const model=modelForZone(turret,zone),entries=model.variants.base.parts.map(part=>({key:part.id,mesh:meshPart(model,part),transforms:[identity()]})),draws=new Map(entries.map(entry=>[entry.key,{transforms:identity()}]));
  field=new ModelLights(entries,draws);field.prepare();check(field.count===3&&field.overflow===0,zone+' exposes only its three authored panel clusters');
  lightData.fill(0);lightData[0]=1;lightData.set(field.data.subarray(4,12),4);sampleAround(lightData[4],lightData[5],lightData[6]);const lit=await run();readbacks[zone]=Array.from(lit.slice(0,3));
  const relative=4/(MODEL_LIGHT_RADIUS*MODEL_LIGHT_RADIUS),falloff=MODEL_LIGHT_STRENGTH*(1-relative)**2/(1+relative*13.824);
  check([0,1,2].every(i=>Math.abs(lit[i]-field.data[8+i]*falloff)<1e-5),zone+' local spill retains exact linear zone colour and configured strength');lastLit=lit;
  if(zone!=='D')field.dispose();
 }
 check(lastLit[0]>lastLit[4]&&lastLit[4]>0,'Model light weakens smoothly across its local radius');
 check([8,9,10].every(i=>Math.abs(lastLit[i])<1e-12),'No light beyond the finite panel radius');
 check([12,13,14].every(i=>lastLit[i]===0),'Back-facing opaque surfaces receive no panel light');
 check(Array.from(lastLit).every(Number.isFinite),'Exact-origin and boundary values remain finite');
 const original=lightData.slice(4,12);lightData.fill(0);lightData[0]=MAX_LOCAL_LIGHTS;lightData.set(original,4+(MAX_LOCAL_LIGHTS-1)*8);
 const lastSlot=await run();check([0,1,2].every(i=>Math.abs(lastSlot[i]-lastLit[i])<1e-7),`The final slot of the ${MAX_LOCAL_LIGHTS}-light uniform reaches the production shader`);
 lightData.set(original,4);lightData.set(original,4+8*8);const combined=await run();check([0,1,2].every(i=>Math.abs(combined[i]-lastLit[i]*3)<1e-6),'Muzzle, explosion and final model slots combine without overwriting one another');
 lightData.fill(0);lightData[0]=1;lightData.set(original,4);lightData[4]+=30;const moved=await run();check(moved[0]===0&&moved[1]===0&&moved[2]===0,'Moving a panel leaves no light at its old position');
 lightData[0]=0;const off=await run();check([0,4,8,12,16].every(i=>off[i]===0&&off[i+1]===0&&off[i+2]===0),'Scene removal leaves no residual local illumination');
 field.dispose();await device.queue.onSubmittedWorkDone();check(errors.length===0,'No WebGPU validation errors');
 output.textContent=JSON.stringify({passed:checks.length,failed:0,checks,linearRGB:readbacks,uniformBytes:lightData.byteLength,capacity:MAX_LOCAL_LIGHTS,errors},null,2);
}catch(error){output.textContent='FAILED: '+error.message;console.error(error);}finally{device?.destroy();}
