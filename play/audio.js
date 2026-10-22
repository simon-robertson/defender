import {AUDIO_ASSETS} from '../shared/audio-assets.js';
// One lazy context for the player's future sample bank/mixer. This foundation
// opens no device on the title screen and creates no sound/voice per frame.
export class AudioPlayer {
 constructor(scope=globalThis){this.scope=scope;this.assets=AUDIO_ASSETS;this.context=null;this.disposed=false;this.lastError='';this.onFailure=error=>{if(!this.disposed)this.lastError=error?.message??String(error);};}
 get state(){return this.context?.state??(this.disposed?'closed':'uninitialised');}
 startFromGesture(){
  if(this.disposed)return;
  try{
   if(this.context?.state==='closed')this.context=null;
   if(!this.context){const Context=this.scope.AudioContext??this.scope.webkitAudioContext;if(!Context)return;this.context=new Context({latencyHint:'interactive'});}
   this.lastError='';
   // Keep this call synchronous in the actual click/key handler. Never move it
   // behind loading, decoding, a timer, or a promise callback. Retry on a later
   // gesture even if an earlier resume remains pending under browser policy.
   if(this.context.state!=='running')this.context.resume().catch(this.onFailure);
  }catch(error){this.onFailure(error);}
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;const context=this.context;this.context=null;this.scope=null;
  try{if(context&&context.state!=='closed')context.close().catch(this.onFailure);}catch{/* Page teardown must not fail if the device has disappeared. */}
 }
}
