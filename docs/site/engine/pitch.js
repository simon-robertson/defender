import {YawTracker} from './turn.js';

// The analytic continuous servo can be reused on a nonwrapping pitch interval
// narrower than pi. Keep a stopping-distance invariant at both hard limits so
// reversals and target loss cannot coast through the mechanism's boundary.
export class PitchTracker extends YawTracker {
 constructor(settings){
  super(settings);const {min,max}=settings;
  if(!Number.isFinite(min)||!Number.isFinite(max)||min>0||max<0||min>=max||max-min>=Math.PI)throw new Error('Invalid pitch limits.');
  this.min=min;this.max=max;
 }
 get angle(){return this.yaw;}
 reachable(angle){return Number.isFinite(angle)&&angle>=this.min&&angle<=this.max;}
 bound(){
  this.yaw=Math.max(this.min,Math.min(this.max,this.yaw));
  const remaining=this.velocity>0?this.max-this.yaw:this.yaw-this.min;
  this.velocity=Math.sign(this.velocity)*Math.min(Math.abs(this.velocity),Math.sqrt(2*this.acceleration*remaining))||0;
 }
 track(target,deltaSeconds){
  if(!this.reachable(target))throw new Error('Pitch target exceeds mechanical limits.');
  this.bound();super.track(target,deltaSeconds);this.bound();
  this.active=Math.abs(target-this.yaw)>1e-8||Math.abs(this.velocity)>1e-8;
 }
 brake(deltaSeconds){this.bound();super.brake(deltaSeconds);this.bound();this.target=this.yaw;this.active=this.velocity!==0;}
}
