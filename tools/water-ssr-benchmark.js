import {GPUFrameTimer} from '../engine/gpu-frame-timer.js';
// Review-only paired timestamps of the cached scene's complete display draw.
export async function benchmarkWaterSSR(renderer){
 if(!renderer.device.features.has('timestamp-query'))return{status:'Enable GPU timer and load first.'};
 const savedTimer=renderer.gpuTimer,savedSSR=renderer.ssr,savedMode=renderer.waterReflections,clock={now:0},timer=new GPUFrameTimer(renderer.device,()=>clock.now),on=[],off=[];
 renderer.gpuTimer=timer;renderer.waterReflections='ssr';
 try{
  for(let i=0;i<60;i++){
   renderer.ssr=i%2===1;clock.now+=110;const sequence=timer.latestSequence;renderer.render(0,renderer.elapsedSeconds);
   await renderer.device.queue.onSubmittedWorkDone();await new Promise(requestAnimationFrame);
   if(i>=12&&timer.latestSequence>sequence)(renderer.ssr?on:off).push(timer.values[(timer.cursor-1+timer.values.length)%timer.values.length]);
  }
  const median=a=>{const s=[...a].sort((a,b)=>a-b);return s.length?(s[(s.length-1)>>1]+s[s.length>>1])/2:null;};
  return{status:'complete',width:renderer.canvas.width,height:renderer.canvas.height,samplesOn:on.length,samplesOff:off.length,onMedianMs:median(on),offMedianMs:median(off),differenceMs:median(on)-median(off),on,off,note:'Frozen camera and ripple phase, alternating SSR on/off after warmup; local exploratory GPU timestamps, not a campaign guarantee.'};
 }finally{renderer.gpuTimer=savedTimer;renderer.ssr=savedSSR;renderer.waterReflections=savedMode;timer.dispose();renderer.render(0,renderer.elapsedSeconds);}
}
