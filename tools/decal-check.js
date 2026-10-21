import {BLOOD_DECAL_OFFSET} from '../shared/damage-effects.js';
import {BloodDecals} from '../engine/blood-decals.js';
import {identity,lookAt,perspective,multiply} from '../shared/math.js';

// Isolated GPU readbacks; no production readback or extra frame resources.
export async function checkBloodDecals(renderer){
 const d=renderer.device,resources=[],keep=x=>(resources.push(x),x),results=[];
 d.pushErrorScope('validation');let scopeOpen=true;
 try{
  const size=64,texture=(format,samples=1)=>keep(d.createTexture({size:[size,size],format,sampleCount:samples,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|(samples===1?GPUTextureUsage.COPY_SRC:0)}));
  const color=texture('rgba8unorm',4),normal=texture('rgba8unorm',4),depth=texture('depth32float',4),resolvedColor=texture('rgba8unorm'),resolvedNormal=texture('rgba8unorm');
  const frame=renderer.frameData.slice(),matrix=identity();frame.fill(0);frame.set(matrix);frame.set(matrix,16);frame.set(matrix,32);frame[14]=.5;frame[10]=-.1;frame.set([0,0,4,1],48);frame.set([0,0,1,0],52);frame.set([0,0,0,1],56);frame.set([1,1,1,0],60);frame.set([size,size,1/size,1/size],64);frame.set([0,0,1,0],68);
  const uniform=keep(d.createBuffer({size:frame.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}));
  const cameraGroup=d.createBindGroup({layout:renderer.cameraLayout,entries:[{binding:0,resource:{buffer:uniform}}]});
  const instance=keep(d.createBuffer({size:160,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST})),data=new Float32Array(40);
  // Two perfectly coincident marks of different colours expose unstable layering.
  for(let j=0;j<2;j++){const k=j*20;data.set([.8,0,0,0,0,0,1,0,0,-.8,0,0,0,0,BLOOD_DECAL_OFFSET,1],k);data.set(j?[.05,.3,.04,2]:[.32,.012,.008,2],k+16);}
  const emptyLights=keep(d.createBuffer({size:renderer.localLightData.byteLength,usage:GPUBufferUsage.UNIFORM}));
  const lightGroup=d.createBindGroup({layout:renderer.lightingLayout,entries:[{binding:0,resource:renderer.shadowView},{binding:1,resource:{buffer:emptyLights}},{binding:2,resource:{buffer:renderer.emptyArcLights}}]});
  const probe={cameraGroup,lightGroup,colorView:color.createView(),normalView:normal.createView(),depthView:depth.createView(),resolvedColorView:resolvedColor.createView(),resolvedNormalView:resolvedNormal.createView(),damageCubeBuffer:instance,damageCubeCount:0,damageDecalCount:2};
  const decals=new BloodDecals(d,renderer.cameraLayout,renderer.lightingLayout,renderer.localLightCapacity);
  const source=d.createShaderModule({code:`@group(0) @binding(0) var<uniform> frame:array<vec4<f32>,23>;
@vertex fn v(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{let x=f32((i<<1u)&2u)*2-1;let y=f32(i&2u)*2-1;return mat4x4<f32>(frame[0],frame[1],frame[2],frame[3])*vec4<f32>(x*frame[22].w,y*frame[22].w,0,1);}
struct O{@location(0) color:vec4<f32>,@location(1) normal:vec4<f32>};
@fragment fn f()->O{var o:O;o.color=vec4<f32>(.2,.3,.4,.8);o.normal=vec4<f32>(.5,.5,1,.6);return o;}`});
  const pipeline=d.createRenderPipeline({layout:d.createPipelineLayout({bindGroupLayouts:[renderer.cameraLayout]}),vertex:{module:source,entryPoint:'v'},fragment:{module:source,entryPoint:'f',targets:[{format:'rgba8unorm'},{format:'rgba8unorm'}]},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'always'},multisample:{count:4}});
  const readback=keep(d.createBuffer({size:size*256*2,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}));
  async function sample({slope=0,view=null,occluded=false,gap=.01,opacity=1,repeat=0}){
   let scale=1;
   if(view){const angle=view.angle*Math.PI/180,eye=[Math.sin(angle)*view.distance,0,Math.cos(angle)*view.distance],v=new Float32Array(16),p=new Float32Array(16),vp=new Float32Array(16);lookAt(v,eye,[0,0,0]);perspective(p,Math.PI/3,1,1,4000);multiply(vp,p,v);frame.set(vp);scale=view.distance*.1/Math.cos(angle);}
   else{frame.set(identity());frame[14]=.5;frame[10]=-.1;frame[2]=slope;}
   frame[91]=scale;data[0]=data[20]=.8*scale;data[9]=data[29]=-.8*scale;d.queue.writeBuffer(uniform,0,frame);data[19]=data[39]=3-opacity;d.queue.writeBuffer(instance,0,data);
   const e=d.createCommandEncoder(),p=e.beginRenderPass({colorAttachments:[{view:probe.colorView,clearValue:[.2,.3,.4,.8],loadOp:'clear',storeOp:'store'},{view:probe.normalView,clearValue:[.5,.5,1,.6],loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:probe.depthView,depthClearValue:occluded?.5-gap:1,depthLoadOp:'clear',depthStoreOp:'store'}});
   if(!occluded){p.setPipeline(pipeline);p.setBindGroup(0,cameraGroup);p.draw(3);}p.end();const bloodPass=e.beginRenderPass({colorAttachments:[{view:probe.colorView,resolveTarget:probe.resolvedColorView,loadOp:'load',storeOp:'discard'},{view:probe.normalView,resolveTarget:probe.resolvedNormalView,loadOp:'load',storeOp:'discard'}],depthStencilAttachment:{view:probe.depthView,depthReadOnly:true}});decals.draw(bloodPass,probe);bloodPass.end();
   e.copyTextureToBuffer({texture:resolvedColor},{buffer:readback,bytesPerRow:256},[size,size]);e.copyTextureToBuffer({texture:resolvedNormal},{buffer:readback,offset:size*256,bytesPerRow:256},[size,size]);d.queue.submit([e.finish()]);await readback.mapAsync(GPUMapMode.READ);
   const b=new Uint8Array(readback.getMappedRange()),k=32*256+32*4,actual=Array.from(b.slice(k,k+4)),normal=Array.from(b.slice(size*256+k,size*256+k+4));
   // Ambient-only production lighting on a vertical face is .68.
   let expected=[.2,.3,.4,.8];if(!occluded)for(const rgb of [[.32,.012,.008],[.05,.3,.04]])expected=expected.map((v,i)=>i===3?v*(1-opacity):Math.round((rgb[i]*.68*opacity+v*(1-opacity))*255)/255);
   expected=expected.map(v=>Math.round(v*255));const error=Math.max(...actual.map((v,i)=>Math.abs(v-expected[i])));
   const bytes=new Uint8Array(b.slice(0,size*256));readback.unmap();
   results.push({slope,view,occluded,gap,opacity,repeat,actual,expected,error,normal});return bytes;
  }
  for(const slope of [0,.4,-.4,.49,-.49]){
   const a=await sample({slope});const b=await sample({slope,repeat:1});if(a.some((v,i)=>v!==b[i]))throw new Error('Decal pixels changed on identical replay');
  }
  for(const distance of [3,8,800])for(const angle of [0,75,87]){
   const a=await sample({view:{distance,angle}}),b=await sample({view:{distance,angle},repeat:1});if(a.some((v,i)=>v!==b[i]))throw new Error('Perspective decal replay changed');
  }
  await sample({occluded:true});await sample({occluded:true,gap:.009});await sample({opacity:.5});await sample({opacity:0});
  const error=await d.popErrorScope();scopeOpen=false;if(error)throw new Error(error.message);return{passed:results.every(r=>r.error<=2),results};
 }finally{if(scopeOpen)await d.popErrorScope();for(const resource of resources)resource.destroy();}
}
