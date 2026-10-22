import {specializeLocalLights} from '../engine/shot-shaders.js';
// Isolated A/B reference: the complete pre-optimisation shader is frozen with
// its source revision. No alternate shader or fetch enters the player package.
export async function prepareVolumeReference(volume){
 const reference=await(await fetch('/docs/engine-performance-2026-10-22/reference-shaders.json')).json(),d=volume.device,r=volume.renderer;
 const pipelines=await Promise.all([false,true].map(async reflected=>{
  const module=d.createShaderModule({label:'Reference '+(reflected?'reflected ':'')+'3D smoke',code:specializeLocalLights(reference[reflected?'reflected':'main'],r.localLightCapacity)});
  const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(m=>m.message).join('\n'));
  return d.createRenderPipelineAsync({label:'Reference ray-marched smoke',layout:d.createPipelineLayout({bindGroupLayouts:reflected?[r.cameraLayout,r.lightingLayout,volume.reflectedLayout]:[r.cameraLayout,r.screenLayout,r.lightingLayout,volume.layout]}),vertex:{module,entryPoint:'vertex'},fragment:{module,entryPoint:'fragment',targets:[{format:reflected?'rgba8unorm':r.format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:reflected?'one':'zero',dstFactor:reflected?'one-minus-src-alpha':'one',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:reflected?'back':'front'}});
 }));
 return {revision:reference.revision,original:pipelines,current:[volume.pipeline,volume.reflectionPipeline]};
}

export async function verifyVolumeReference(volume,reference){
 const r=volume.renderer,d=volume.device,results=[];
 for(const reflected of [false,true]){
  if(reflected&&!r.planarDraws)continue;
  const width=reflected?r.planar.width:r.canvas.width,height=reflected?r.planar.height:r.canvas.height,row=Math.ceil(width*4/256)*256;
  const texture=d.createTexture({size:[width,height],format:reflected?'rgba8unorm':r.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),view=texture.createView(),buffer=d.createBuffer({size:row*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const images=[];
  try{for(const pipelines of [reference.original,reference.current]){
   const encoder=d.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view,clearValue:[0,0,0,0],loadOp:'clear',storeOp:'store'}]});
   pass.setPipeline(pipelines[reflected?1:0]);pass.setBindGroup(0,reflected?r.planar.cameraGroup:r.cameraGroup);pass.setBindGroup(1,reflected?r.lightGroup:r.screenGroup);pass.setBindGroup(2,reflected?volume.reflectedGroup:r.lightGroup);if(!reflected)pass.setBindGroup(3,volume.group);pass.draw(36,volume.count);pass.end();
   encoder.copyTextureToBuffer({texture},{buffer,bytesPerRow:row},[width,height]);d.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);images.push(new Uint8Array(buffer.getMappedRange()).slice());buffer.unmap();
  }
  let maxDifference=0,differentChannels=0,visiblePixels=0,totalDifference=0;
  for(let y=0;y<height;y++)for(let x=0;x<width*4;x++){const k=y*row+x,delta=Math.abs(images[0][k]-images[1][k]);maxDifference=Math.max(maxDifference,delta);totalDifference+=delta;if(delta)differentChannels++;if(x%4===0&&(images[0][k]||images[0][k+1]||images[0][k+2]||images[0][k+3]))visiblePixels++;}
  results.push({reflected,width,height,visiblePixels,maxDifference,differentChannels,meanAbsoluteDifference:totalDifference/(width*height*4)});
  }finally{texture.destroy();buffer.destroy();}
 }
 return {referenceRevision:reference.revision,results,note:'Raw isolated smoke RGBA8 readback; identical real scene depth/light/field bindings. Floating-point algebra may round differently; 0–255 channel units.'};
}

export async function measureVolumeReference(volume,reference,elapsed){
 const {GPUFrameTimer}=await import('../engine/gpu-frame-timer.js'),r=volume.renderer,saved=r.gpuTimer,clock={now:0},timer=new GPUFrameTimer(r.device,()=>clock.now),samples={original:[],volume:[],off:[]},cpu={original:[],volume:[],off:[]};r.gpuTimer=timer;
 const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return(sorted[(sorted.length-1)>>1]+sorted[sorted.length>>1])/2;};
 try{if(!timer.supported)throw new Error('GPU timestamps unsupported.');for(let i=0;i<108;i++){
  const mode=['original','volume','off'][i%3];volume.enabled=mode!=='off';[volume.pipeline,volume.reflectionPipeline]=reference[mode==='original'?'original':'current'];clock.now+=110;const before=timer.latestSequence,start=performance.now();r.render(0,elapsed,false);const ms=performance.now()-start;
  await r.device.queue.onSubmittedWorkDone();await new Promise(requestAnimationFrame);
  if(i>=12){cpu[mode].push(ms);if(timer.latestSequence>before)samples[mode].push(timer.values[(timer.cursor-1+timer.values.length)%timer.values.length]);}
 }
 return{referenceRevision:reference.revision,canvas:[r.canvas.width,r.canvas.height],level:r.world.level.id,steps:volume.steps,volumes:volume.count,planarActive:!!r.planarDraws,method:'Alternating original/current/off every frame, 12 warmup + 96 measured frozen complete frames; queue completion and rAF between samples. No player state or timing changes. Local timestamp measurements, not campaign FPS.',runs:Object.keys(samples).map(mode=>({mode,gpuSamples:samples[mode].length,gpuMedianMS:median(samples[mode]),cpuFrames:cpu[mode].length,cpuMedianMS:median(cpu[mode]),gpuSamplesMS:samples[mode]}))};
 }finally{r.gpuTimer=saved;timer.dispose();volume.enabled=true;[volume.pipeline,volume.reflectionPipeline]=reference.current;}
}
