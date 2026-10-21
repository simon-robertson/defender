// Developer-only GPU regression; this module is never loaded by the game.
import {uniforms,shadowVisibility} from '/engine/shaders.js';
import {lookAt,ortho,multiply} from '/shared/math.js';
const result=document.getElementById('result');
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normalize=a=>{const length=Math.hypot(...a);return a.map(v=>v/length);};
const shadowSource=`
struct Plane {inverseVP:mat4x4<f32>,normal:vec4<f32>,settings:vec4<f32>};
@group(0) @binding(0) var<uniform> plane:Plane;
@vertex fn vertex(@builtin(vertex_index) index:u32)->@builtin(position) vec4<f32>{
 let x=f32((index<<1u)&2u);let y=f32(index&2u);return vec4<f32>(x*2-1,y*2-1,0,1);
}
@fragment fn fragment(@builtin(position) pixel:vec4<f32>)->@builtin(frag_depth) f32{
 let uv=pixel.xy/plane.settings.xy;let ndc=uv*vec2<f32>(2,-2)+vec2<f32>(-1,1);
 let start=(plane.inverseVP*vec4<f32>(ndc,0,1)).xyz;let end=(plane.inverseVP*vec4<f32>(ndc,1,1)).xyz;
 // Independent ray/plane intersection generates true receiver depths.
 var depth=-dot(plane.normal.xyz,start)/dot(plane.normal.xyz,end-start);
 if(plane.settings.z>0&&all(uv>vec2<f32>(.4))&&all(uv<vec2<f32>(.6))){depth-=.00005;}
 return clamp(depth,0,1);
}`;
const checkSource=uniforms+`
@group(1) @binding(0) var shadowMap:texture_depth_2d;
`+shadowVisibility+`
struct Sample {position:vec4<f32>,normal:vec4<f32>};
@group(2) @binding(0) var<storage,read> samples:array<Sample>;
@group(2) @binding(1) var<storage,read_write> results:array<f32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x<arrayLength(&samples)){results[id.x]=visibility(samples[id.x].position.xyz,samples[id.x].normal.xyz);}
}`;
let device;
try{
 device=await (await navigator.gpu.requestAdapter()).requestDevice();const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const depthModule=device.createShaderModule({code:shadowSource}),checkModule=device.createShaderModule({code:checkSource});
 for(const module of [depthModule,checkModule]){const info=await module.getCompilationInfo();for(const message of info.messages)if(message.type==='error')throw new Error(message.message);}
 const depthPipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:depthModule,entryPoint:'vertex'},fragment:{module:depthModule,entryPoint:'fragment',targets:[]},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'always'}});
 const checkPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:checkModule,entryPoint:'main'}});
 const buffer=(size,usage)=>device.createBuffer({size,usage});
 const planeBuffer=buffer(96,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),frameBuffer=buffer(368,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
 const planeGroup=device.createBindGroup({layout:depthPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:planeBuffer}}]}),frameGroup=device.createBindGroup({layout:checkPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:frameBuffer}}]});
 const points=[];for(let y=0;y<15;y++)for(let x=0;x<15;x++)points.push([.25+x*.5/14,.25+y*.5/14]);
 const sampleData=new Float32Array(points.length*8),samples=buffer(sampleData.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),results=buffer(points.length*4,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),readback=buffer(points.length*4,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);
 const sampleGroup=device.createBindGroup({layout:checkPipeline.getBindGroupLayout(2),entries:[{binding:0,resource:{buffer:samples}},{binding:1,resource:{buffer:results}}]});
 let comparisons=0,cases=0,legacyShadowedSamples=0;const reports=[];
 for(const size of [64,2048,4096]){
  const depth=device.createTexture({size:[size,size],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),depthView=depth.createView(),depthGroup=device.createBindGroup({layout:checkPipeline.getBindGroupLayout(1),entries:[{binding:0,resource:depthView}]});
  for(const direction of [[-.65,.924,-.45],[-.65,.15,-.45]])for(const normal of [[0,1,0],[-1,0,0],[0,0,-1],normalize([-.6,.8,.3])]){
   const sun=normalize(direction),eye=sun.map(v=>v*650),view=new Float32Array(16),projection=new Float32Array(16),vp=new Float32Array(16),inverse=new Float32Array(16),radius=231;
   lookAt(view,eye,[0,0,0]);ortho(projection,-radius,radius,-radius,radius,200,1100);multiply(vp,projection,view);
   for(let r=0;r<3;r++){inverse[r]=view[r*4]/projection[0];inverse[4+r]=view[r*4+1]/projection[5];inverse[8+r]=view[r*4+2]/projection[10];inverse[12+r]=eye[r]-view[r*4+2]*projection[14]/projection[10];}inverse[15]=1;
   const right=[view[0],view[4],view[8]],up=[view[1],view[5],view[9]],positionAt=(u,v)=>{const p=right.map((r,i)=>r*(u*2-1)*radius+up[i]*(1-v*2)*radius),along=-dot(normal,p)/dot(normal,sun);return p.map((value,i)=>value+along*sun[i]);};
   const frame=new Float32Array(92);frame.set(vp,16);frame.set(sun,52);device.queue.writeBuffer(frameBuffer,0,frame);
   const plane=new Float32Array(24);plane.set(inverse);plane.set(normal,16);plane.set([size,size,0,0],20);
   const valid=[];
   for(let i=0;i<points.length;i++){
    const [u,v]=points[i],p=positionAt(u,v),d=.5-dot(p,sun)/900;sampleData.set([...p,0,...normal,0],i*8);
    // Keep the entire filter inside the generated plane's depth range.
    const cornerDepths=[[-2,-2],[-2,2],[2,-2],[2,2]].map(([x,y])=>.5-dot(positionAt(u+x/size,v+y/size),sun)/900);
    valid[i]=Math.min(...cornerDepths)>.02&&Math.max(...cornerDepths)<.98;
    // Demonstrate that the previous centre-only comparison rejects the same plane.
    if(valid[i]){const bias=.00018+.0005*(1-dot(normal,sun));for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
     const sampleU=(Math.floor(u*size)+x+.5)/size,sampleV=(Math.floor(v*size)+y+.5)/size,stored=.5-dot(positionAt(sampleU,sampleV),sun)/900;if(d-bias>stored)legacyShadowedSamples++;
    }}
   }
   device.queue.writeBuffer(samples,0,sampleData);
   for(const blocker of [0,1]){
    plane[22]=blocker;device.queue.writeBuffer(planeBuffer,0,plane);const encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:depthView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
    pass.setPipeline(depthPipeline);pass.setBindGroup(0,planeGroup);pass.draw(3);pass.end();const compute=encoder.beginComputePass();compute.setPipeline(checkPipeline);compute.setBindGroup(0,frameGroup);compute.setBindGroup(1,depthGroup);compute.setBindGroup(2,sampleGroup);compute.dispatchWorkgroups(Math.ceil(points.length/64));compute.end();encoder.copyBufferToBuffer(results,0,readback,0,points.length*4);device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);const values=new Float32Array(readback.getMappedRange());
    for(let i=0;i<points.length;i++){
     if(!valid[i])continue;const [u,v]=points[i],inside=u>.4+2/size&&u<.6-2/size&&v>.4+2/size&&v<.6-2/size,outside=u<.4-2/size||u>.6+2/size||v<.4-2/size||v>.6+2/size;
     if(blocker&&!inside&&!outside)continue;const expected=blocker&&inside?0:1;
     if(Math.abs(values[i]-expected)>.0001)throw new Error(`Visibility ${values[i]}, expected ${expected}; size ${size}, normal ${normal}, sun ${direction}, sample ${points[i]}, blocker ${blocker}`);comparisons++;
    }
    readback.unmap();cases++;
   }
  }
  depth.destroy();reports.push(`${size}²: lit faces clean; nearby occluder shadows preserved`);
 }
 if(!legacyShadowedSamples)throw new Error('Regression fixture did not reproduce the old self-shadowing failure.');if(errors.length)throw new Error(errors.join('\n'));
 result.dataset.result='pass';result.textContent=`PASS — ${cases} GPU cases, ${comparisons} depth comparisons\n${reports.join('\n')}\nOld centre-only comparison falsely shadowed ${legacyShadowedSamples} plane samples.\nOccluder separation: 0.045 world units (checks against excessive bias).`;
}catch(error){result.dataset.result='fail';result.textContent='FAIL — '+error.message;console.error(error);}finally{device?.destroy();}
