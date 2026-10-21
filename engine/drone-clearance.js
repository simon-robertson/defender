import {DRONE_HULL} from '../shared/drone-model.js';

const EPS=1e-6;

// Exact straight sweep of a constant level axis-aligned enclosing aircraft box
// against one obstacle AABB. Expanding the obstacle by the aircraft extents
// reduces this to slab intersection. No storage or allocation; zero-length and
// reversed segments are valid. Quadratic flight must retain curve certification.
export function sweptDroneBoxIntersects(bounds,offset,ax,ay,az,bx,by,bz,radius=DRONE_HULL.radius,below=DRONE_HULL.below,above=DRONE_HULL.above){
 let enter=0,exit=1;
 for(let axis=0;axis<3;axis++){
  const start=axis===0?ax:axis===1?ay:az,delta=(axis===0?bx:axis===1?by:bz)-start,min=bounds[offset+axis]-(axis===1?above:radius)+EPS,max=bounds[offset+axis+3]+(axis===1?below:radius)-EPS;
  if(delta===0){if(start<min||start>max)return false;continue;}
  let lo=(min-start)/delta,hi=(max-start)/delta;if(lo>hi){const value=lo;lo=hi;hi=value;}enter=Math.max(enter,lo);exit=Math.min(exit,hi);if(enter>exit)return false;
 }
 return true;
}
