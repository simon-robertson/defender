import {interceptXZ} from './aim.js';

// Reused horizontal shot solution. This chooses an aim point, not a projectile
// simulation, hit test or damage event. No active weapon is changed to projectile.
export class DefenceAim {
 constructor(rule,maxRange){
  if(!Number.isFinite(maxRange)||maxRange<0)throw new Error('Invalid targeting range.');
  if(rule?.delivery==='hitscan'){
   if(rule.projectile!==null)throw new Error('Hitscan must not configure a projectile.');
   this.speed=0;
  }else if(rule?.delivery==='projectile'){
   const speed=rule.projectile?.speedUnitsPerSecond;
   if(!Number.isFinite(speed)||speed<=0)throw new Error('Projectile aiming requires a positive speed in units per second.');
   this.speed=speed;
  }else throw new Error('Unknown attack delivery.');
  this.maxRange=maxRange;this.rangeSquared=maxRange*maxRange;
  this.maxTime=this.speed?maxRange/this.speed:0;this.point=new Float64Array(3);
 }
 solve(originX,originZ,target){
  const point=this.point;point[0]=point[1]=point[2]=0;
  if(!target||!Number.isFinite(originX)||!Number.isFinite(originZ)||!Number.isFinite(target.x)||!Number.isFinite(target.z))return false;
  const x=target.aimX??target.x,z=target.aimZ??target.z;
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  point[0]=x;point[1]=z;
  // Range stays tied to the actor root; articulated aim points may move inside
  // the body during a brace without changing that shared targeting contract.
  const dx=target.x-originX,dz=target.z-originZ;
  if(dx*dx+dz*dz>this.rangeSquared)return false;
  if(!this.speed)return true;
  const vx=target.aimVelocityX??target.velocityX,vz=target.aimVelocityZ??target.velocityZ;
  if(!Number.isFinite(vx)||!Number.isFinite(vz))return false;
  // Maximum travel distance supplies the prediction horizon. An unreachable
  // intercept is ineligible; never silently fire at its unled position instead.
  if(!interceptXZ(point,originX,originZ,x,z,vx,vz,this.speed,this.maxTime))return false;
  const aimX=point[0]-originX,aimZ=point[1]-originZ;
  // Derived diagonal coordinates may square just above an exact boundary.
  // Allow floating-point roundoff only, not a world-unit range allowance.
  return aimX*aimX+aimZ*aimZ<=this.rangeSquared*(1+8*Number.EPSILON);
 }
}
