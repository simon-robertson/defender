// Compare the exact production opaque specular block with its prior expression.
import {geometry,uniforms} from '/engine/shaders.js';
const result=document.getElementById('result');let device;
try{
 device=await(await navigator.gpu.requestAdapter()).requestDevice();const errors=[],checks=[],readbacks=[];device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
 const check=(condition,label)=>{if(!condition)throw new Error(label);checks.push(label);};
 const begin=geometry.indexOf(' var specular=0.0;'),end=geometry.indexOf(' var o:Surface;',begin),block=geometry.slice(begin,end);
 check(begin>=0&&end>begin&&block.includes('i.reflectiveness>0&&light>0'),'Checks use the exact production matte/reflective branch');
 const code=uniforms+`
 struct Probe {normalReflect:vec4<f32>,worldLight:vec4<f32>};
 struct Input {world:vec3<f32>,reflectiveness:f32};
 @group(1) @binding(0) var<storage,read> probes:array<Probe>;
 @group(1) @binding(1) var<storage,read_write> values:array<vec4<f32>>;
 @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){
  let probe=probes[id.x];let i=Input(probe.worldLight.xyz,probe.normalReflect.w);let n=normalize(probe.normalReflect.xyz);let light=probe.worldLight.w;
 ${block}
  let halfVector=normalize(frame.sun.xyz+toEye(i.world));
  let reference=pow(max(dot(n,halfVector),0),48)*i.reflectiveness*.38*light;
  values[id.x]=vec4<f32>(specular,reference,select(0.0,1.0,i.reflectiveness>0&&light>0),1);
 }`;
 const module=device.createShaderModule({code}),info=await module.getCompilationInfo();check(!info.messages.some(message=>message.type==='error'),info.messages.map(message=>message.message).join('\n')||'Production branch compiles in GPU numeric harness');
 const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
 const cases=[{name:'dry matte',reflect:0,light:1},{name:'rainy stone',reflect:.4,light:1},{name:'rainy mortar',reflect:.1,light:1},{name:'edge puddle',reflect:.85,light:.65},{name:'shadowed reflective',reflect:.4,light:0},{name:'shadowed matte',reflect:0,light:0}];
 const data=new Float32Array(cases.length*8);for(let i=0;i<cases.length;i++)data.set([0,.8,.6,cases[i].reflect,2,3,1,cases[i].light],i*8);
 const buffer=(size,usage)=>device.createBuffer({size,usage}),frame=buffer(368,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),probes=buffer(data.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),values=buffer(cases.length*16,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),read=buffer(cases.length*16,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);
 const fg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:frame}}]}),sg=device.createBindGroup({layout:pipeline.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:probes}},{binding:1,resource:{buffer:values}}]});
 device.queue.writeBuffer(probes,0,data);const frameData=new Float32Array(92);frameData.set([0,.8,.6],52);frameData.set([0,.8,.6],68);frameData.set([2,83,61],48);
 for(const mode of [0,1]){
  frameData[71]=mode;device.queue.writeBuffer(frame,0,frameData);const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,fg);pass.setBindGroup(1,sg);pass.dispatchWorkgroups(cases.length);pass.end();encoder.copyBufferToBuffer(values,0,read,0,cases.length*16);device.queue.submit([encoder.finish()]);
  await read.mapAsync(GPUMapMode.READ);const output=new Float32Array(read.getMappedRange());let evaluated=0;
  for(let i=0;i<cases.length;i++){const current=output[i*4],reference=output[i*4+1];check(current===reference,(mode?'path':'overview')+' '+cases[i].name+' retains exact specular output');evaluated+=output[i*4+2];readbacks.push({mode,material:cases[i].name,current,reference});}
  check(evaluated===3,(mode?'path':'overview')+' matte and shadowed samples skip specular work, reflective samples retain it');read.unmap();
 }
 await device.queue.onSubmittedWorkDone();check(errors.length===0,errors.join('\n')||'No WebGPU validation errors');result.textContent=JSON.stringify({passed:checks.length,failed:0,checks,readbacks,errors},null,2);
}catch(error){result.textContent='FAILED: '+error.message;console.error(error);}finally{device?.destroy();}
