import {BOX_SIZE} from '../shared/grid.js';
import {PathMotion} from './path-motion.js';

// Integrated smootherstep tangents keep position, velocity and acceleration
// continuous at each join. Authored distance remains the progression clock:
// rounding a corner does not move a finite enemy's scheduled exit earlier.
export const FLIGHT_CORNER_OFFSET=BOX_SIZE/2*5/32;
export class FlightPathMotion extends PathMotion {
 constructor(path,turnDistance=BOX_SIZE/2){
  super(path,turnDistance);this.boundsSample=new Float64Array(3);
 }
 corner(distance){
  if(!this.turnDistance)return -1;
  const i=Math.min(Math.floor(distance/BOX_SIZE),this.heading.length-1),r=this.turnDistance;
  let corner=-1;
  if(i>0&&distance-this.distance[i]<r)corner=i;
  else if(i+1<this.heading.length&&this.distance[i+1]-distance<r)corner=i+1;
  if(corner<0)return -1;
  const ax=this.x[corner]-this.x[corner-1],az=this.z[corner]-this.z[corner-1],bx=this.x[corner+1]-this.x[corner],bz=this.z[corner+1]-this.z[corner];
  return ax*bx+az*bz===0?corner:-1;
 }
 sample(distance,out){
  const d=Math.max(0,Math.min(this.length,distance)),i=this.corner(d);
  if(i<0)return super.sample(d,out);
  const r=this.turnDistance,t=(d-this.distance[i]+r)/(2*r),v=t**4*(5-6*t+2*t*t),u=2*t-1-v;
  const ax=(this.x[i]-this.x[i-1])/BOX_SIZE,az=(this.z[i]-this.z[i-1])/BOX_SIZE,bx=(this.x[i+1]-this.x[i])/BOX_SIZE,bz=(this.z[i+1]-this.z[i])/BOX_SIZE;
  const blend=t*t*t*(10+t*(-15+6*t)),vx=ax+(bx-ax)*blend,vz=az+(bz-az)*blend;
  out[0]=this.x[i]+r*(ax*u+bx*v);out[1]=this.z[i]+r*(az*u+bz*v);out[2]=Math.atan2(-vx,-vz);
  if(out.length>=5){out[3]=vx;out[4]=vz;}
  return out;
 }
 turn(distance,speed,out){
  out[0]=out[1]=0;
  const d=Math.max(0,Math.min(this.length,distance)),i=this.corner(d);if(i<0)return out;
  const r=this.turnDistance,t=(d-this.distance[i]+r)/(2*r),blend=t*t*t*(10+t*(-15+6*t));
  const first=30*t*t*(1-t)**2/(2*r),second=60*t*(1-t)*(1-2*t)/(4*r*r);
  const ax=(this.x[i]-this.x[i-1])/BOX_SIZE,az=(this.z[i]-this.z[i-1])/BOX_SIZE,dx=(this.x[i+1]-this.x[i])/BOX_SIZE-ax,dz=(this.z[i+1]-this.z[i])/BOX_SIZE-az;
  const vx=ax+dx*blend,vz=az+dz*blend,accX=dx*first,accZ=dz*first,numerator=vz*accX-vx*accZ,length2=vx*vx+vz*vz;
  out[0]=numerator/length2*speed;
  out[1]=((vz*dx-vx*dz)*second/length2-numerator*2*(vx*accX+vz*accZ)/(length2*length2))*speed*speed;
  return out;
 }
 bounds(from,to,out){
  const lo=Math.max(0,Math.min(this.length,Math.min(from,to))),hi=Math.max(0,Math.min(this.length,Math.max(from,to))),p=this.boundsSample;
  this.sample(lo,p);out[0]=out[2]=p[0];out[1]=out[3]=p[1];
  this.sample(hi,p);out[0]=Math.min(out[0],p[0]);out[1]=Math.min(out[1],p[1]);out[2]=Math.max(out[2],p[0]);out[3]=Math.max(out[3],p[1]);
  // Each quarter-turn is monotone per axis. Its joins enclose extrema between
  // opposite adjacent bends, which old 24-unit corner samples alone can miss.
  for(let i=Math.max(1,Math.floor((lo-this.turnDistance)/BOX_SIZE));i<this.heading.length&&this.distance[i]-this.turnDistance<hi;i++)for(let side=-1;side<=1;side+=2){
   const d=this.distance[i]+side*this.turnDistance;if(d<=lo||d>=hi)continue;
   this.sample(d,p);out[0]=Math.min(out[0],p[0]);out[1]=Math.min(out[1],p[1]);out[2]=Math.max(out[2],p[0]);out[3]=Math.max(out[3],p[1]);
  }
  return out;
 }
 clearanceSegments(){
  const segments=[],bounds=new Float64Array(4),r=this.turnDistance;let cursor=0;
  const append=(lo,hi)=>{if(hi<=lo)return;this.bounds(lo,hi,bounds);segments.push(Array.from(bounds));};
  for(let i=1;i<this.heading.length;i++)if(this.corner(this.distance[i])===i){
   const start=this.distance[i]-r;append(cursor,start);
   for(let part=0;part<4;part++)append(start+part*r/2,start+(part+1)*r/2);
   cursor=this.distance[i]+r;
  }
  append(cursor,this.length);return segments;
 }
}
