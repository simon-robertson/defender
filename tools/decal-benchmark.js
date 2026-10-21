import {GPUFrameTimer} from '../engine/gpu-frame-timer.js';
// Review-only paired timestamps. Deliberately waits outside the game loop.
export async function benchmarkBloodDecals(renderer){
 if(!renderer.device.features.has('timestamp-query'))return{status:'unsupported'};
 const marks=renderer.damageDecalCount;if(!marks)return{status:'need settled blood marks first'};
 const original=renderer.gpuTimer,clock={now:0},timer=new GPUFrameTimer(renderer.device,()=>clock.now),on=[],off=[];
 renderer.gpuTimer=timer;
 try{
  for(let i=0;i<60;i++){
   const enabled=i%2===1;renderer.damageDecalCount=enabled?marks:0;renderer.dirty=true;clock.now+=110;
   const sequence=timer.latestSequence;renderer.render(0,renderer.elapsedSeconds);
   await renderer.device.queue.onSubmittedWorkDone();await new Promise(requestAnimationFrame);
   if(i>=12&&timer.latestSequence>sequence)(enabled?on:off).push(timer.values[(timer.cursor-1+timer.values.length)%timer.values.length]);
  }
  const median=a=>{const sorted=[...a].sort((a,b)=>a-b);return sorted.length?(sorted[(sorted.length-1)>>1]+sorted[sorted.length>>1])/2:null;};
  return{status:'complete',width:renderer.canvas.width,height:renderer.canvas.height,marks,samplesOn:on.length,samplesOff:off.length,opaqueRefreshWithDecalsMedianMs:median(on),opaqueRefreshWithoutDecalsMedianMs:median(off),medianDifferenceMs:median(on)-median(off),on,off,note:'Alternating fixed-camera colour refresh + display; includes the decal stage within the opaque pass. Exploratory local timestamps, not a campaign frame-rate guarantee.'};
 }finally{renderer.gpuTimer=original;timer.dispose();renderer.damageDecalCount=marks;renderer.dirty=true;renderer.render(0,renderer.elapsedSeconds);}
}
