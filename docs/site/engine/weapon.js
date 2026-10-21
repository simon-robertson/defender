// No timers, projectiles or rendering dependencies. One reusable state per weapon.
export class WeaponCycle {
 constructor(rule,onShot=null){
  if(!rule||!Number.isInteger(rule.shotsPerBurst)||rule.shotsPerBurst<1||rule.shotsPerBurst>32||!Number.isFinite(rule.shotIntervalSeconds)||rule.shotIntervalSeconds<0||(rule.shotsPerBurst>1&&rule.shotIntervalSeconds===0)||!Number.isFinite(rule.cooldownSeconds)||rule.cooldownSeconds<0)throw new Error('Invalid firing rule.');
  this.rule=rule;this.onShot=onShot;this.time=0;this.readyAt=0;this.nextShotAt=Infinity;this.remaining=0;this.shots=0;this.lastShotAt=-Infinity;
 }
 get ready(){return this.remaining===0&&this.time>=this.readyAt;}
 trigger(){
  if(!this.ready)return false;
  const r=this.rule;this.remaining=r.shotsPerBurst-1;this.nextShotAt=this.remaining?this.time+r.shotIntervalSeconds:Infinity;
  // Cooldown begins after the final shot, not at the start of a burst.
  this.readyAt=this.time+this.remaining*r.shotIntervalSeconds+r.cooldownSeconds;this.fire(this.time);return true;
 }
 fire(at){this.shots++;this.lastShotAt=at;this.onShot?.(at);}
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Delta seconds must be finite and non-negative.');
  this.time+=deltaSeconds;
  // Bounded by the burst size, even after a long frame. Preserve shot timestamps
  // so animation evaluates the true age, rather than replaying old shots now.
  while(this.remaining&&this.nextShotAt<=this.time){const at=this.nextShotAt;this.remaining--;this.nextShotAt=this.remaining?at+this.rule.shotIntervalSeconds:Infinity;this.fire(at);}
 }
 // Live targeting has only the current validated pose, not a historical target
 // trajectory. Emit at most one current pulse, never catch up old burst shots.
 advanceLive(deltaSeconds,canFire){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Delta seconds must be finite and non-negative.');
  this.time+=deltaSeconds;
  if(!canFire){this.cancelBurst();return;}
  if(this.remaining&&this.nextShotAt<=this.time){
   this.remaining--;this.nextShotAt=this.remaining?this.time+this.rule.shotIntervalSeconds:Infinity;
   this.readyAt=this.time+this.remaining*this.rule.shotIntervalSeconds+this.rule.cooldownSeconds;this.fire(this.time);
  }
 }
 cancelBurst(){
  if(!this.remaining)return false;
  this.remaining=0;this.nextShotAt=Infinity;this.readyAt=this.lastShotAt+this.rule.cooldownSeconds;return true;
 }
}

export class RecoilTrack {
 constructor({distance,kickSeconds,returnSeconds}){
  if(![distance,kickSeconds,returnSeconds].every(Number.isFinite)||distance<0||kickSeconds<=0||returnSeconds<=0)throw new Error('Invalid recoil settings.');
  this.distance=distance;this.kickSeconds=kickSeconds;this.returnSeconds=returnSeconds;this.shotAt=-Infinity;this.startValue=0;
 }
 fire(at){this.startValue=this.sample(at);this.shotAt=at;}
 sample(time){
  const age=time-this.shotAt;if(age<0||age>=this.kickSeconds+this.returnSeconds)return 0;
  if(age<this.kickSeconds){const u=1-age/this.kickSeconds;return this.startValue+(this.distance-this.startValue)*(1-u*u*u);}
  const u=(age-this.kickSeconds)/this.returnSeconds;return this.distance*(1-u*u*(3-2*u));
 }
}
