// Timestamp queries report nanoseconds, independently of CPU submission time.
// Sample at most 10 Hz. If all three readbacks are busy, skip rather than wait.
const SAMPLE_MS=100,WINDOW_MS=1000,STALE_MS=1500,SLOTS=3;

export async function requestRenderDevice(adapter,timing=false){
 if(timing&&adapter.features.has('timestamp-query')){
  try{return await adapter.requestDevice({requiredFeatures:['timestamp-query']});}catch{/* Timing must not prevent ordinary rendering. */}
 }
 return adapter.requestDevice();
}

export class GPUFrameTimer {
 constructor(device,now=()=>performance.now()){
  this.device=device;this.now=now;this.supported=device.features.has('timestamp-query');this.active=true;this.disposed=false;this.failed=false;this.generation=0;this.sequence=0;this.latestSequence=0;
  this.values=new Float64Array(16);this.times=new Float64Array(16);this.slots=[];this.snapshot={status:'pending',ms:null,samples:0,pending:0,bufferBytes:0,queryCount:0};
  if(this.supported){
   this.query=device.createQuerySet({label:'Production frame timestamps',type:'timestamp',count:2});
   this.resolve=device.createBuffer({label:'Production frame timestamp resolve',size:16,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC});
   for(let i=0;i<SLOTS;i++)this.slots.push({buffer:device.createBuffer({label:'Production frame timestamp readback',size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),busy:false});
   this.startWrites={querySet:this.query,beginningOfPassWriteIndex:0};
   this.endWrites={querySet:this.query,endOfPassWriteIndex:1};
   this.fullWrites={querySet:this.query,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1};
   // The first pass may belong to the vista or bloom. A retained render-only
   // facade catches that pass without changing their invalidation rules.
   this.encoderFacade={beginRenderPass:descriptor=>{
    const first=this.firstPass,last=descriptor===this.lastPass;this.firstPass=false;
    if(!first&&!last)return this.currentEncoder.beginRenderPass(descriptor);
    const previous=descriptor.timestampWrites;descriptor.timestampWrites=first?(last?this.fullWrites:this.startWrites):this.endWrites;
    try{return this.currentEncoder.beginRenderPass(descriptor);}finally{descriptor.timestampWrites=previous;}
   }};
   this.snapshot.bufferBytes=64;this.snapshot.queryCount=2;
  }
  this.reset();
 }
 reset(){this.generation++;this.count=this.cursor=0;this.lastSampleAt=null;this.lastAttempt=-Infinity;this.startedAt=this.now();this.currentEncoder=this.lastPass=null;}
 setActive(active){if(this.active===active)return;this.active=active;this.reset();}
 begin(encoder,lastPass){
  const now=this.now();if(!this.supported||!this.active||this.failed||this.disposed||now-this.lastAttempt<SAMPLE_MS)return null;
  const slot=this.slots.find(slot=>!slot.busy);if(!slot)return null;
  slot.busy=true;slot.generation=this.generation;slot.sequence=++this.sequence;slot.at=now;this.lastAttempt=now;
  this.currentEncoder=encoder;this.firstPass=true;this.lastPass=lastPass;return slot;
 }
 renderEncoder(encoder,slot){return slot?this.encoderFacade:encoder;}
 end(encoder,slot){
  if(!slot)return;
  encoder.resolveQuerySet(this.query,0,2,this.resolve,0);
  encoder.copyBufferToBuffer(this.resolve,0,slot.buffer,0,16);
  this.currentEncoder=this.lastPass=null;
 }
 submitted(slot){
  if(!slot)return;
  // Mapping starts only after submission. Its completion never blocks the rAF
  // loop, and each staging buffer remains owned until its mapping settles.
  slot.buffer.mapAsync(GPUMapMode.READ).then(()=>{
   try{
    if(this.disposed||this.failed||!this.active||slot.generation!==this.generation||slot.sequence<=this.latestSequence||this.now()-slot.at>STALE_MS)return;
    const ticks=new BigUint64Array(slot.buffer.getMappedRange());
    if(ticks[1]<ticks[0])return;
    const ms=Number(ticks[1]-ticks[0])/1e6;if(!Number.isFinite(ms))return;
    this.latestSequence=slot.sequence;this.lastSampleAt=slot.at;
    this.values[this.cursor]=ms;this.times[this.cursor]=slot.at;this.cursor=(this.cursor+1)%this.values.length;this.count=Math.min(this.count+1,this.values.length);
   }finally{if(!this.disposed)slot.buffer.unmap();}
  }).catch(()=>{if(!this.disposed&&slot.generation===this.generation){this.failed=true;this.reset();}}).finally(()=>{slot.busy=false;});
 }
 read(){
  const state=this.snapshot,now=this.now();state.pending=0;for(const slot of this.slots)if(slot.busy)state.pending++;
  state.ms=null;state.samples=0;
  state.status=this.disposed||this.failed?'unavailable':!this.supported?'unsupported':!this.active?'idle':'pending';
  if(state.status!=='pending')return state;
  if(now-(this.lastSampleAt??this.startedAt)>STALE_MS){state.status='stale';return state;}
  let sum=0;for(let i=0;i<this.count;i++){const index=(this.cursor-1-i+this.values.length)%this.values.length;if(now-this.times[index]>WINDOW_MS)break;sum+=this.values[index];state.samples++;}
  if(state.samples){state.ms=sum/state.samples;state.status='ready';}else if(this.lastSampleAt!==null)state.status='stale';
  return state;
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.reset();for(const slot of this.slots)slot.buffer.destroy();this.resolve?.destroy();this.query?.destroy();this.snapshot.bufferBytes=this.snapshot.queryCount=0;}
}
