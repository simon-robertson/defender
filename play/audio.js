import {AUDIO_ASSETS,audioAssetURL} from '../shared/audio-assets.js';
import {loadSoundLevel,saveSoundLevel,soundLevel} from './audio-options.js';
export const AUDIO_VOICES=32,AUDIO_ADMISSIONS=64,AUDIO_QUEUE=128;
const MAX_AGE=.08,LOOKAHEAD=.012,REFERENCE_DISTANCE=320;
const clamp=value=>Math.max(-1,Math.min(1,value));
// Cached mono samples; fixed event/voice storage. Native buffer sources are
// single-use, so their creation is capped rather than claimed allocation-free.
export class AudioPlayer {
 constructor(scope=globalThis){
  this.scope=scope;this.volume=loadSoundLevel(scope);this.assets=AUDIO_ASSETS;this.context=null;this.disposed=false;this.lastError='';this.ready=false;this.loading=null;this.abort=null;this.enabled=false;this.generation=0;
  this.buffers=[];this.voices=[];this.master=null;this.queue=new Float64Array(AUDIO_QUEUE*4);this.queued=0;this.admissions=new Float64Array(AUDIO_ADMISSIONS);this.admissions.fill(-Infinity);this.admission=0;this.take=0;this.played=0;this.dropped=0;this.active=0;this.nextSpatial=0;
  this.onFailure=error=>{if(!this.disposed)this.lastError=error?.message??String(error);};
 }
 get state(){return this.context?.state??(this.disposed||this.volume===0?'closed':'uninitialised');}
 startFromGesture(){
  if(this.disposed||this.volume===0)return;
  try{
   if(!this.context){const Context=this.scope.AudioContext??this.scope.webkitAudioContext;if(!Context)return;this.context=new Context({latencyHint:'interactive'});}
   this.lastError='';
   // Invoke resume inside the genuine input handler, before any await/fetch.
   const context=this.context,generation=this.generation;
   if(context.state!=='running')context.resume().catch(error=>{if(this.context===context)this.onFailure(error);});
   if(!this.ready&&!this.loading&&context.createGain)this.prepare().catch(error=>{if(this.generation===generation)this.onFailure(error);});
  }catch(error){this.onFailure(error);}
 }
 async prepare(){
  const context=this.context,abort=new AbortController();this.abort=abort;
  const task=(async()=>{
   const buffers=[];
   for(const asset of this.assets){
    let buffer;
    try{buffer=await this.load(asset.id,false,context,abort.signal);}catch(error){if(abort.signal.aborted||!asset.fallback)throw error;buffer=await this.load(asset.id,true,context,abort.signal);}
    if(abort.signal.aborted||this.context!==context)return;
    if(buffer.numberOfChannels!==1)throw new Error('Expected mono game audio: '+asset.id);
    buffers.push(buffer);
   }
   if(this.disposed||abort.signal.aborted)return;
   if(!this.master){
    this.master=context.createGain();this.master.gain.value=this.volume;this.master.connect(context.destination);
    for(let i=0;i<AUDIO_VOICES;i++){
     const gain=context.createGain(),pan=context.createStereoPanner(),voice={gain,pan,source:null,x:0,y:0,z:0,level:0,balance:0};gain.connect(pan);pan.connect(this.master);
     voice.ended=event=>{if(voice.source!==event.target)return;voice.source.disconnect();voice.source=null;this.active--;};this.voices.push(voice);
    }
   }
   this.buffers=buffers;this.ready=buffers.length>0;
  })();
  this.loading=task;
  try{await task;}finally{if(this.loading===task)this.loading=null;if(this.abort===abort)this.abort=null;}
 }
 async load(id,fallback,context,signal){
  const response=await this.scope.fetch(audioAssetURL(id,fallback),{signal});if(!response.ok)throw new Error('Audio load failed: '+id+' ('+response.status+')');
  return context.decodeAudioData(await response.arrayBuffer());
 }
 setVolume(value){this.volume=soundLevel(value);if(this.volume===0)this.shutdown();else if(this.master)this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.015);saveSoundLevel(this.volume,this.scope);}
 setActive(active){if(this.enabled===active)return;this.enabled=active;if(!active)this.stop();}
 stop(){
  this.queued=0;this.nextSpatial=0;
  for(const voice of this.voices)if(voice.source){try{voice.source.stop();}catch{}voice.source.disconnect();voice.source=null;}
  this.active=0;
 }
 gunShot(matrix,muzzles,at){
  if(!this.enabled||!this.ready||this.state!=='running')return;
  // Both barrels belong to one validated damage pulse and one sound.
  const x=(muzzles[0][0]+muzzles[1][0])*.5,y=(muzzles[0][1]+muzzles[1][1])*.5,z=(muzzles[0][2]+muzzles[1][2])*.5;
  this.enqueue(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12],matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13],matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14],at);
 }
 enqueue(x,y,z,at){
  if(!this.enabled||!this.ready||this.state!=='running')return;
  if(this.queued===AUDIO_QUEUE){this.dropped++;return;}
  const p=this.queued++*4;this.queue[p]=x;this.queue[p+1]=y;this.queue[p+2]=z;this.queue[p+3]=at;
 }
 spatial(voice,camera,now,initial=false){
  const dx=voice.x-camera.eye[0],dy=voice.y-camera.eye[1],dz=voice.z-camera.eye[2],level=REFERENCE_DISTANCE/(REFERENCE_DISTANCE+Math.hypot(dx,dy,dz));
  const m=camera.vp,x=m[0]*voice.x+m[4]*voice.y+m[8]*voice.z+m[12],w=m[3]*voice.x+m[7]*voice.y+m[11]*voice.z+m[15],balance=clamp(x/Math.max(.01,Math.abs(w)));
  if(initial){voice.gain.gain.cancelScheduledValues(0);voice.pan.pan.cancelScheduledValues(0);voice.gain.gain.setValueAtTime(level,now);voice.pan.pan.setValueAtTime(balance,now);}
  else{
   if(Math.abs(level-voice.level)>.003)voice.gain.gain.setTargetAtTime(level,now,.025);
   if(Math.abs(balance-voice.balance)>.01)voice.pan.pan.setTargetAtTime(balance,now,.025);
  }
  voice.level=level;voice.balance=balance;
 }
 advance(time,camera){
  if(!this.enabled||!this.ready||this.state!=='running'){this.queued=0;return;}
  const context=this.context,now=context.currentTime;
  if(now>=this.nextSpatial){for(const voice of this.voices)if(voice.source)this.spatial(voice,camera,now);this.nextSpatial=now+.05;}
  for(let n=0;n<this.queued;n++){
   const p=n*4,age=time-this.queue[p+3];
   if(age>MAX_AGE||age<-.001||now-this.admissions[this.admission]<1){this.dropped++;continue;}
   let voice=null;for(let i=0;i<this.voices.length;i++)if(!this.voices[i].source){voice=this.voices[i];break;}
   if(!voice){this.dropped++;continue;}
   let source;
   try{
    source=context.createBufferSource();source.buffer=this.buffers[this.take++%this.buffers.length];source.connect(voice.gain);source.onended=voice.ended;
    voice.x=this.queue[p];voice.y=this.queue[p+1];voice.z=this.queue[p+2];this.spatial(voice,camera,now,true);
    const start=now+LOOKAHEAD+MAX_AGE-Math.max(0,age);source.start(start);voice.source=source;this.active++;this.played++;this.admissions[this.admission]=now;this.admission=(this.admission+1)%AUDIO_ADMISSIONS;
   }catch(error){source?.disconnect();this.onFailure(error);this.dropped++;}
  }
  this.queued=0;
 }
 shutdown(){
  this.generation++;this.abort?.abort();this.abort=null;this.loading=null;this.stop();const context=this.context;this.context=null;this.buffers=[];this.ready=false;this.admissions.fill(-Infinity);this.admission=0;
  for(const voice of this.voices){voice.gain.disconnect();voice.pan.disconnect();}this.voices=[];this.master?.disconnect();this.master=null;
  try{if(context&&context.state!=='closed')context.close().catch(()=>{});}catch{/* Device teardown must never prevent leaving the game. */}
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.shutdown();this.scope=null;}
}
