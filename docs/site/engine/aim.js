// Horizontal constant-velocity interception for a stationary firing origin.
// The caller owns out[0..2] = [aimX, aimZ, interceptSeconds]. No allocations,
// iterations, projectile state or gameplay defaults are introduced here.
// False resets scratch to the current point; it means DO NOT FIRE, not a direct
// aim fallback policy. An optional horizon is inclusive; Infinity adds no cap.
export function interceptXZ(out,originX,originZ,targetX,targetZ,velocityX,velocityZ,projectileSpeed,maxTime=Infinity){
 if(!out||out.length<3||!Number.isFinite(originX)||!Number.isFinite(originZ)||!Number.isFinite(targetX)||!Number.isFinite(targetZ)||!Number.isFinite(velocityX)||!Number.isFinite(velocityZ)||!Number.isFinite(projectileSpeed)||projectileSpeed<=0||!(maxTime===Infinity||Number.isFinite(maxTime)&&maxTime>=0))throw new Error('Invalid projectile intercept inputs.');
 out[0]=targetX;out[1]=targetZ;out[2]=0;
 const relativeX=targetX-originX,relativeZ=targetZ-originZ;
 if(relativeX===0&&relativeZ===0)return true;

 // Scale position and velocity independently before squaring, preserving tiny
 // and large authored units without overflowing the quadratic coefficients.
 let positionScale,rx,rz;
 if(Number.isFinite(relativeX)&&Number.isFinite(relativeZ)){
  positionScale=Math.max(Math.abs(relativeX),Math.abs(relativeZ));rx=relativeX/positionScale;rz=relativeZ/positionScale;
 }else{
  // Finite endpoints can still overflow when subtracted at opposite extremes.
  positionScale=Math.max(Math.abs(originX),Math.abs(originZ),Math.abs(targetX),Math.abs(targetZ));rx=targetX/positionScale-originX/positionScale;rz=targetZ/positionScale-originZ/positionScale;
 }
 const velocityScale=Math.max(Math.abs(velocityX),Math.abs(velocityZ),projectileSpeed),vx=velocityX/velocityScale,vz=velocityZ/velocityScale,speed=projectileSpeed/velocityScale;
 const magnitude=Math.hypot(velocityX,velocityZ),scaledMagnitude=Math.hypot(vx,vz);
 // Factoring the speed difference avoids cancellation for nearly equal speeds.
 const a=Number.isFinite(magnitude)?((magnitude-projectileSpeed)/velocityScale)*(magnitude/velocityScale+speed):(scaledMagnitude-speed)*(scaledMagnitude+speed),b=2*(rx*vx+rz*vz),c=rx*rx+rz*rz;
 let root=Infinity;
 if(a===0){
  if(b>=0)return false;root=-c/b;
 }else{
  const product=4*a*c,square=b*b;let discriminant=square-product;
  if(discriminant<0){
   // Permit only a rounding-sized negative at a tangent, not an unreachable
   // target with a genuinely negative discriminant.
   if(discriminant< -8*Number.EPSILON*(square+Math.abs(product)))return false;
   discriminant=0;
  }
  const q=-.5*(b+(b<0?-1:1)*Math.sqrt(discriminant)),first=q/a,second=q===0?Infinity:c/q;
  if(first>=0)root=first;if(second>=0&&second<root)root=second;
 }
 if(!Number.isFinite(root))return false;
 const scale=positionScale/velocityScale;let time=Number.isFinite(scale)?root*scale:(root*positionScale)/velocityScale;
 if(!Number.isFinite(time)||time<0)return false;
 if(time>maxTime){
  // A rotated exact-boundary solution can round a few ULPs beyond the cap.
  // Admit only relative roundoff and keep the returned time inside the horizon.
  if(time-maxTime>8*Number.EPSILON*Math.max(time,maxTime))return false;
  time=maxTime;
 }
 const x=targetX+velocityX*time,z=targetZ+velocityZ*time;if(!Number.isFinite(x)||!Number.isFinite(z))return false;
 out[0]=x;out[1]=z;out[2]=time;return true;
}
