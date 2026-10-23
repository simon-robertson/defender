export const DRONE_CAMERA_FOV=60,DRONE_CAMERA_MIN_FOV=54,DRONE_CAMERA_MAX_FOV=62;
const RESPONSE=1.2,CLOSE_SECONDS=6,NORMAL_SECONDS=8;
const clamp=value=>Math.max(DRONE_CAMERA_MIN_FOV,Math.min(DRONE_CAMERA_MAX_FOV,value));
function validTime(time){if(!Number.isFinite(time)||time<0)throw new Error('Drone lens time must be finite and non-negative.');}

// Simulation-time shot decisions own only the lens. The caller supplies the
// current composition's required field of view and keeps the reticle fixed.
export class DroneLens {
 constructor(){this.reset();}
 reset(){this.fov=this.target=DRONE_CAMERA_FOV;this.velocity=0;this.phase='normal';this.nextDecision=NORMAL_SECONDS;this.zoomCount=0;this.closeUntil=0;}
 defer(time){validTime(time);this.target=DRONE_CAMERA_FOV;this.phase='normal';this.closeUntil=0;this.nextDecision=time+NORMAL_SECONDS;}
 observe(time,requiredFov,visibleCount,settled=true){
  validTime(time);
  if(!Number.isFinite(requiredFov)||requiredFov<0)throw new Error('Drone lens fit must be finite and non-negative.');
  if(!Number.isInteger(visibleCount)||visibleCount<0||typeof settled!=='boolean')throw new Error('Invalid drone lens composition.');
  if(!visibleCount){
   if(this.phase==='close')this.defer(time);else this.target=DRONE_CAMERA_FOV;
   return;
  }
  if(this.phase==='close'){
   if(time<this.closeUntil&&requiredFov<=this.target+.5)return;
   this.phase='normal';this.closeUntil=0;this.target=Math.max(DRONE_CAMERA_FOV,clamp(requiredFov));this.nextDecision=time+NORMAL_SECONDS;
   return;
  }
  // A wider view remains stable under small edge fluctuations. Repeated
  // pressure above the lens ceiling must not keep restarting the shot clock.
  if(requiredFov>this.target+.5||requiredFov<this.target-1)this.target=Math.max(DRONE_CAMERA_FOV,clamp(requiredFov));
  if(time<this.nextDecision)return;
  if(!settled){this.nextDecision=time+2;return;}
  if(requiredFov>58)return;
  this.phase='close';this.target=Math.max(DRONE_CAMERA_MIN_FOV,requiredFov);this.closeUntil=time+CLOSE_SECONDS;this.nextDecision=this.closeUntil+NORMAL_SECONDS;this.zoomCount++;
 }
 advance(dt){
  validTime(dt);if(!dt)return;
  // Exact critically damped spring for a constant target over this substep.
  // Carry velocity through reversals instead of restarting an easing curve.
  const offset=this.fov-this.target,impulse=this.velocity+RESPONSE*offset,decay=Math.exp(-RESPONSE*dt);
  if(!decay){this.fov=this.target;this.velocity=0;return;}
  const next=this.target+(offset+impulse*dt)*decay;
  this.velocity=(this.velocity-RESPONSE*impulse*dt)*decay;this.fov=clamp(next);
  if(this.fov!==next)this.velocity=0;
 }
}
