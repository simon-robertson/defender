import {composite} from '../engine/shaders.js';
import {specializeLocalLights} from '../engine/shot-shaders.js';
// Review-only synthetic MSAA coverage probe using the production composite.
export async function checkVistaEdges(renderer){
 const d=renderer.device,resources=[],keep=x=>(resources.push(x),x),results=[];
 const texture=(format,samples=1)=>keep(d.createTexture({size:[1,1],format,sampleCount:samples,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST}));
 let scopeOpen=true;d.pushErrorScope('validation');
 try{
  const msColor=texture('rgba8unorm',4),depth=texture('depth32float',4),color=texture('rgba8unorm'),normal=texture('rgba8unorm'),water=texture('depth32float'),vista=texture('rgba8unorm'),output=texture('rgba8unorm');
  d.queue.writeTexture({texture:vista},new Uint8Array([40,60,80,255]),{bytesPerRow:4},[1,1]);
  const data=renderer.frameData.slice();data.set([1,1,1,1],64);data[72]=0;data[75]=1;
  const uniform=keep(d.createBuffer({size:data.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}));d.queue.writeBuffer(uniform,0,data);
  const camera=d.createBindGroup({layout:renderer.cameraLayout,entries:[{binding:0,resource:{buffer:uniform}}]});
  const screen=d.createBindGroup({layout:renderer.screenLayout,entries:[{binding:0,resource:color.createView()},{binding:1,resource:normal.createView()},{binding:2,resource:depth.createView()},{binding:3,resource:renderer.sampler},{binding:4,resource:water.createView()},{binding:5,resource:normal.createView()},{binding:6,resource:vista.createView()},{binding:7,resource:color.createView()}]});
  const module=d.createShaderModule({code:specializeLocalLights(composite,renderer.localLightCapacity)}),pipeline=d.createRenderPipeline({layout:d.createPipelineLayout({bindGroupLayouts:[renderer.cameraLayout,renderer.screenLayout,renderer.lightingLayout]}),vertex:{module,entryPoint:'vertex'},fragment:{module,entryPoint:'fragment',targets:[{format:'rgba8unorm'}]}});
  const source=d.createShaderModule({code:`@vertex fn v(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{return vec4<f32>(f32((i<<1u)&2u)*2-1,f32(i&2u)*2-1,.5,1);}
@fragment fn f()->@location(0) vec4<f32>{return vec4<f32>(64.0/255,96.0/255,32.0/255,.75);}`});
  const readback=keep(d.createBuffer({size:512,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}));
  const srgb=x=>255*(x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055);
  for(let covered=0;covered<=4;covered++){
   const sourcePipeline=d.createRenderPipeline({layout:'auto',vertex:{module:source,entryPoint:'v'},fragment:{module:source,entryPoint:'f',targets:[{format:'rgba8unorm'}]},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'always'},multisample:{count:4,mask:(1<<covered)-1}});
   const encoder=d.createCommandEncoder();
   const clearWater=encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:water.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});clearWater.end();
   const first=encoder.beginRenderPass({colorAttachments:[{view:msColor.createView(),resolveTarget:color.createView(),clearValue:[0,0,0,0],loadOp:'clear',storeOp:'discard'}],depthStencilAttachment:{view:depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});first.setPipeline(sourcePipeline);first.draw(3);first.end();
   const display=encoder.beginRenderPass({colorAttachments:[{view:output.createView(),loadOp:'clear',storeOp:'store'}]});display.setPipeline(pipeline);display.setBindGroup(0,camera);display.setBindGroup(1,screen);display.setBindGroup(2,renderer.lightGroup);display.draw(3);display.end();
   encoder.copyTextureToBuffer({texture:output},{buffer:readback,bytesPerRow:256},[1,1]);encoder.copyTextureToBuffer({texture:color},{buffer:readback,offset:256,bytesPerRow:256},[1,1]);d.queue.submit([encoder.finish()]);await readback.mapAsync(GPUMapMode.READ);
   const bytes=new Uint8Array(readback.getMappedRange()),actual=Array.from(bytes.slice(0,4)),resolved=Array.from(bytes.slice(256,260)),coverage=covered/4;
   const expected=[64,96,32].map((value,i)=>Math.round(srgb(value/255*coverage+[40,60,80][i]/255*.76*(1-coverage))));
   const error=Math.max(...expected.map((value,i)=>Math.abs(actual[i]-value)));readback.unmap();if(error>2||Math.abs(resolved[3]-Math.round(191.25*coverage))>1)throw new Error('Vista edge coverage mismatch at '+covered+' samples');results.push({coveredSamples:covered,actual,expected,maxChannelError:error,resolvedEmission:resolved[3]});
  }
  const error=await d.popErrorScope();scopeOpen=false;if(error)throw new Error(error.message);return {passed:true,results};
 }finally{if(scopeOpen)await d.popErrorScope();for(const resource of resources)resource.destroy();}
}
