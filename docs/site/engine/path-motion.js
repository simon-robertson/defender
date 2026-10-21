import {BOX_SIZE} from '../shared/grid.js';

const TAU=Math.PI*2;
export const shortestAngle=angle=>((angle+Math.PI)%TAU+TAU)%TAU-Math.PI;

// Root positions stay on the authored centre line. Only facing blends around a
// bend, so locomotion does not invent diagonal routes through neighbouring boxes.
export class PathMotion {
 constructor(path,turnDistance=6){
  if(!Array.isArray(path)||path.length<2||!Number.isFinite(turnDistance)||turnDistance<0||turnDistance>BOX_SIZE/2)throw new Error('Invalid locomotion path.');
  const n=path.length;this.x=new Float64Array(n);this.z=new Float64Array(n);this.distance=new Float64Array(n);this.heading=new Float64Array(n-1);this.turnDistance=turnDistance;
  for(let i=0;i<n;i++){
   const p=path[i];if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw new Error('Invalid path point.');
   this.x[i]=(p[0]+.5)*BOX_SIZE;this.z[i]=(p[2]+.5)*BOX_SIZE;
   if(i){const dx=this.x[i]-this.x[i-1],dz=this.z[i]-this.z[i-1];if(Math.abs(dx)+Math.abs(dz)!==BOX_SIZE||p[1]!==path[i-1][1])throw new Error('Path must share box edges.');this.distance[i]=this.distance[i-1]+BOX_SIZE;this.heading[i-1]=Math.atan2(-dx,-dz);}
  }
  this.length=this.distance[n-1];
 }
 sample(distance,out){
  // Validation guarantees every segment is exactly one box long. Select its
  // index directly, retaining the last segment at the inclusive path endpoint.
  const d=Math.max(0,Math.min(this.length,distance)),i=Math.min(Math.floor(d/BOX_SIZE),this.heading.length-1),t=(d-this.distance[i])/BOX_SIZE;
  out[0]=this.x[i]+(this.x[i+1]-this.x[i])*t;out[1]=this.z[i]+(this.z[i+1]-this.z[i])*t;
  let yaw=this.heading[i];const r=this.turnDistance;
  if(r>0){
   let corner=-1;if(i>0&&d-this.distance[i]<r)corner=i;else if(i+1<this.heading.length&&this.distance[i+1]-d<r)corner=i+1;
   if(corner>=0){const p=(d-this.distance[corner]+r)/(2*r),ease=p*p*(3-2*p);yaw=this.heading[corner-1]+shortestAngle(this.heading[corner]-this.heading[corner-1])*ease;}
  }
  out[2]=yaw;
  // Optional actual travel direction, independent of the eased facing. Sampling
  // the route avoids false velocities at corners or the preview's entrance reset.
  if(out.length>=5){out[3]=(this.x[i+1]-this.x[i])/BOX_SIZE;out[4]=(this.z[i+1]-this.z[i])/BOX_SIZE;}
  return out;
 }
}
