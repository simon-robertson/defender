// The rAF timestamp is the engine's only time source. Values exposed to systems
// are seconds; the first frame after start/resume has zero delta.
const smoothstepIntegral=u=>u*u*u-.5*u*u*u*u;
export class FrameClock {
 constructor(){this.previous=null;this.unscaledDeltaSeconds=0;this.deltaSeconds=0;this.elapsedSeconds=0;this.timeScale=this.targetTimeScale=this.scaleFrom=1;this.scaleDuration=this.scaleElapsed=0;}
 tick(timestampMilliseconds){
  if(!Number.isFinite(timestampMilliseconds))throw new Error('Frame timestamp must be finite.');
  this.unscaledDeltaSeconds=this.previous===null?0:Math.max(0,(timestampMilliseconds-this.previous)*.001);
  // Scale once, before either simulation delta or shader elapsed time leaves
  // the shared clock. Changing speed never rescales already elapsed time.
  const real=this.unscaledDeltaSeconds;
  if(this.scaleElapsed<this.scaleDuration){
   const duration=this.scaleDuration,used=Math.min(real,duration-this.scaleElapsed),a=this.scaleElapsed/duration,b=(this.scaleElapsed+used)/duration;
   // Integrate smoothstep exactly: consistent simulation time at any display
   // rate, including frames crossing the end of a transition.
   this.deltaSeconds=this.scaleFrom*used+(this.targetTimeScale-this.scaleFrom)*duration*(smoothstepIntegral(b)-smoothstepIntegral(a))+(real-used)*this.targetTimeScale;
   this.scaleElapsed+=used;this.timeScale=this.scaleFrom+(this.targetTimeScale-this.scaleFrom)*b*b*(3-2*b);
  }else this.deltaSeconds=real*this.timeScale;
  this.previous=this.previous===null?timestampMilliseconds:Math.max(this.previous,timestampMilliseconds);
  this.elapsedSeconds+=this.deltaSeconds;return this.deltaSeconds;
 }
 setTimeScale(scale,{transitionSeconds=0}={}){
  if(!Number.isFinite(scale)||scale<=0)throw new Error('Frame time scale must be finite and positive.');
  if(!Number.isFinite(transitionSeconds)||transitionSeconds<0)throw new Error('Frame scale transition must be finite and nonnegative.');
  this.scaleFrom=this.timeScale;this.targetTimeScale=scale;this.scaleElapsed=0;this.scaleDuration=transitionSeconds;
  if(!transitionSeconds)this.timeScale=scale;
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
