// Roughly one second of rAF wall intervals and synchronous app callback costs.
// GPU duration arrives independently from sampled asynchronous timestamp queries.
export class FramePerformance {
 constructor(element){this.element=element;this.intervals=new Float64Array(120);this.cpu=new Float64Array(120);this.render=new Float64Array(120);this.running=false;this.reset();}
 reset(){this.count=this.cursor=this.seconds=this.cpuMs=this.renderTotalMs=this.sincePaint=0;this.fps=this.frameMs=this.cpuFrameMs=this.renderMs=this.gpuMs=null;this.gpuStatus='pending';this.gpuSamples=0;}
 setRunning(running,status='Idle'){
  if(this.running===running&&this.status===status)return;
  this.running=running;this.status=status;this.reset();this.paint();
 }
 sample(seconds,cpuMs,gpu,cpuRenderMs=cpuMs){
  if(!this.running||!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(cpuMs)||cpuMs<0||!Number.isFinite(cpuRenderMs)||cpuRenderMs<0)return;
  if(this.count===this.intervals.length){this.seconds-=this.intervals[this.cursor];this.cpuMs-=this.cpu[this.cursor];this.renderTotalMs-=this.render[this.cursor];}else this.count++;
  this.intervals[this.cursor]=seconds;this.cpu[this.cursor]=cpuMs;this.render[this.cursor]=cpuRenderMs;this.seconds+=seconds;this.cpuMs+=cpuMs;this.renderTotalMs+=cpuRenderMs;this.cursor=(this.cursor+1)%this.intervals.length;
  // Keep roughly the most recent second, while retaining one slow frame.
  while(this.count>1){const oldest=(this.cursor-this.count+this.intervals.length)%this.intervals.length;if(this.seconds-this.intervals[oldest]<1)break;this.seconds-=this.intervals[oldest];this.cpuMs-=this.cpu[oldest];this.renderTotalMs-=this.render[oldest];this.count--;}
  this.fps=this.count/this.seconds;this.frameMs=this.seconds*1000/this.count;this.cpuFrameMs=this.cpuMs/this.count;this.renderMs=this.renderTotalMs/this.count;
  this.gpuStatus=gpu?.status??'unsupported';this.gpuMs=this.gpuStatus==='ready'?gpu.ms:null;this.gpuSamples=gpu?.samples??0;
  this.sincePaint+=seconds;if(this.sincePaint>=.25){this.sincePaint=0;this.paint();}
 }
 paint(){
  if(!this.element)return;
  const gpu=this.gpuMs===null?`GPU ${this.gpuStatus}`:`${this.gpuMs.toFixed(1)} ms GPU`;
  this.element.textContent=this.fps===null?(this.running?'— FPS · — ms/frame · — ms CPU app · GPU pending':this.status):`${Math.round(this.fps)} FPS · ${this.frameMs.toFixed(1)} ms/frame · ${this.cpuFrameMs.toFixed(1)} ms CPU app · ${gpu}`;
 }
 stats(){return {running:this.running,fps:this.fps,frameMs:this.frameMs,cpuFrameMs:this.cpuFrameMs,cpuRenderMs:this.renderMs,samples:this.count,gpuMs:this.gpuMs,gpuStatus:this.running?this.gpuStatus:'idle',gpuSamples:this.gpuSamples};}
}
