const TAU=Math.PI*2;
export function yawError(target,current){let angle=(target-current)%TAU;if(angle>Math.PI)angle-=TAU;else if(angle< -Math.PI)angle+=TAU;return angle;}

// A rest-to-rest yaw move: accelerate, optionally cruise, then brake to the
// target. Evaluate the profile analytically so long/uneven frames cannot cause
// overshoot or change the motion. All state is reused; units are radians/seconds.
export class YawTurn {
 constructor({maxSpeed,acceleration}){
  if(!Number.isFinite(maxSpeed)||maxSpeed<=0||!Number.isFinite(acceleration)||acceleration<=0)throw new Error('Invalid turn settings.');
  this.maxSpeed=maxSpeed;this.acceleration=acceleration;this.yaw=0;this.target=0;this.velocity=0;this.active=false;
  this.start=0;this.direction=0;this.distance=0;this.elapsed=0;this.duration=0;this.ramp=0;this.cruise=0;this.peakSpeed=0;
 }
 begin(from,target){
  if(!Number.isFinite(from)||!Number.isFinite(target))throw new Error('Turn angles must be finite.');
  let angle=(target-from)%TAU;if(angle>Math.PI)angle-=TAU;else if(angle< -Math.PI)angle+=TAU;
  this.start=from;this.yaw=from;this.target=target;this.direction=Math.sign(angle);this.distance=Math.abs(angle);this.elapsed=0;this.velocity=0;
  this.active=this.distance>0;
  if(!this.active){this.yaw=target;this.duration=this.ramp=this.cruise=this.peakSpeed=0;return;}
  // Short turns use a triangular speed profile; longer turns reach the cap.
  this.peakSpeed=Math.min(this.maxSpeed,Math.sqrt(this.distance*this.acceleration));
  this.ramp=this.peakSpeed/this.acceleration;this.cruise=Math.max(0,this.distance/this.peakSpeed-this.ramp);
  this.duration=2*this.ramp+this.cruise;
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Delta seconds must be finite and non-negative.');
  if(!this.active)return;
  this.elapsed+=deltaSeconds;
  if(this.elapsed>=this.duration){this.yaw=this.target;this.velocity=0;this.active=false;return;}
  const t=this.elapsed,a=this.acceleration;let distance,speed;
  if(t<this.ramp){distance=.5*a*t*t;speed=a*t;}
  else if(t<this.ramp+this.cruise){distance=.5*this.peakSpeed*this.ramp+this.peakSpeed*(t-this.ramp);speed=this.peakSpeed;}
  else{const left=this.duration-t;distance=this.distance-.5*a*left*left;speed=a*left;}
  this.yaw=this.start+this.direction*distance;this.velocity=this.direction*speed;
 }
}

// Continuous target servo. Replanning keeps the current angular velocity;
// retargeting never restarts a rest-to-rest animation. Each sampled target uses
// at most one initial braking interval and one analytic bounded-speed profile.
export class YawTracker {
 constructor({maxSpeed,acceleration}){
  if(!Number.isFinite(maxSpeed)||maxSpeed<=0||!Number.isFinite(acceleration)||acceleration<=0)throw new Error('Invalid turn settings.');
  this.maxSpeed=maxSpeed;this.acceleration=acceleration;this.yaw=0;this.target=0;this.velocity=0;this.active=false;
 }
 track(target,deltaSeconds){
  if(!Number.isFinite(target)||!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid tracking target or delta.');
  this.target=target;let time=deltaSeconds,angle=yawError(target,this.yaw);const a=this.acceleration;
  if(this.velocity&&(this.velocity*angle<=0||this.velocity*this.velocity/(2*a)>Math.abs(angle))){
   const direction=Math.sign(this.velocity),duration=Math.abs(this.velocity)/a,t=Math.min(time,duration);
   this.yaw+=this.velocity*t-direction*.5*a*t*t;this.velocity=t===duration?0:this.velocity-direction*a*t;time-=t;
  }
  angle=yawError(target,this.yaw);
  if(time>0&&angle){
   const direction=Math.sign(angle),distance=Math.abs(angle),speed=this.velocity*direction;
   const peak=Math.min(this.maxSpeed,Math.sqrt(a*distance+speed*speed/2)),ramp=Math.max(0,(peak-speed)/a),accelerated=(peak*peak-speed*speed)/(2*a);
   const cruise=Math.max(0,(distance-accelerated-peak*peak/(2*a))/peak),duration=ramp+cruise+peak/a;
   let travel,velocity;
   if(time>=duration){travel=distance;velocity=0;}
   else if(time<ramp){travel=speed*time+.5*a*time*time;velocity=speed+a*time;}
   else if(time<ramp+cruise){travel=accelerated+peak*(time-ramp);velocity=peak;}
   else{const left=duration-time;travel=distance-.5*a*left*left;velocity=a*left;}
   this.yaw+=direction*travel;this.velocity=direction*velocity;
  }
  this.yaw=yawError(this.yaw,0);this.active=Math.abs(yawError(target,this.yaw))>1e-8||Math.abs(this.velocity)>1e-8;
 }
 brake(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid tracking delta.');
  const direction=Math.sign(this.velocity),duration=Math.abs(this.velocity)/this.acceleration,t=Math.min(deltaSeconds,duration);
  this.yaw=yawError(this.yaw+this.velocity*t-direction*.5*this.acceleration*t*t,0);this.velocity=t===duration?0:this.velocity-direction*this.acceleration*t;
  this.target=this.yaw;this.active=this.velocity!==0;
 }
}
