// The rAF timestamp is the engine's only time source. Values exposed to systems
// are seconds; the first frame after start/resume has zero delta.
export class FrameClock {
 constructor(){this.previous=null;this.unscaledDeltaSeconds=0;this.deltaSeconds=0;this.elapsedSeconds=0;this.timeScale=1;}
 tick(timestampMilliseconds){
  if(!Number.isFinite(timestampMilliseconds))throw new Error('Frame timestamp must be finite.');
  this.unscaledDeltaSeconds=this.previous===null?0:Math.max(0,(timestampMilliseconds-this.previous)*.001);
  // Scale once, before either simulation delta or shader elapsed time leaves
  // the shared clock. Changing speed never rescales already elapsed time.
  this.deltaSeconds=this.unscaledDeltaSeconds*this.timeScale;
  this.previous=this.previous===null?timestampMilliseconds:Math.max(this.previous,timestampMilliseconds);
  this.elapsedSeconds+=this.deltaSeconds;return this.deltaSeconds;
 }
 setTimeScale(scale){
  if(!Number.isFinite(scale)||scale<=0)throw new Error('Frame time scale must be finite and positive.');
  this.timeScale=scale;
 }
 resetDelta(){this.previous=null;this.unscaledDeltaSeconds=this.deltaSeconds=0;}
}
export class FrameLoop {
 constructor(onFrame,request=callback=>requestAnimationFrame(callback),cancel=id=>cancelAnimationFrame(id)){
  this.clock=new FrameClock();this.onFrame=onFrame;this.request=request;this.cancel=cancel;this.running=false;this.pending=null;
  this.frame=timestamp=>{this.pending=null;if(!this.running)return;
   const delta=this.clock.tick(timestamp);try{this.onFrame(delta,this.clock.elapsedSeconds);}catch(error){this.stop();throw error;}
   if(this.running&&this.pending===null)this.pending=this.request(this.frame);
  };
 }
 start(){if(this.running)return;this.running=true;this.clock.resetDelta();this.pending=this.request(this.frame);}
 stop(){this.running=false;if(this.pending!==null)this.cancel(this.pending);this.pending=null;this.clock.resetDelta();}
}
