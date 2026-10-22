import {MAX_MISSILES,MISSILE_FLIGHT} from '../shared/missile-flight.js';
// Each reused slot needs boost/coast before emitting again. Retain independent
// generations through the two-second fade, including the currently flying one.
export const VOLUME_LIFE=2;
export const VOLUME_TRAILS=MAX_MISSILES*(1+Math.ceil(VOLUME_LIFE/(MISSILE_FLIGHT.boostSeconds+MISSILE_FLIGHT.coastSeconds))),VOLUME_POINTS=64,VOLUME_BLOCK=8,VOLUME_BLOCKS=8;
export const VOLUME_FLOATS=12+VOLUME_POINTS*4+VOLUME_BLOCKS*8;
export class VolumeTrailField {
 constructor(){this.trails=Array.from({length:VOLUME_TRAILS},()=>({id:null,count:0,start:0,points:new Float64Array(VOLUME_POINTS*4)}));this.order=new Uint16Array(VOLUME_TRAILS);this.depth=new Float64Array(VOLUME_TRAILS);this.count=0;this.dropped=0;this.time=0;this.revision=0;this.cpuBytes=VOLUME_TRAILS*VOLUME_POINTS*32+this.order.byteLength+this.depth.byteLength;}
 reset(){for(const t of this.trails){t.id=null;t.count=t.start=0;}this.count=this.dropped=0;this.time=0;this.revision++;}
 sample(id,x,y,z,time){
  if(id==null||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(time))throw new Error('Invalid volume trail sample.');
  if(time>this.time)this.expire(time);let trail=null,free=null;
  // Admission is a hot callback: scan once without allocating find predicates.
  for(const t of this.trails){if(t.id===id){trail=t;break;}if(t.id===null&&!free)free=t;}
  if(!trail){trail=free;if(!trail){this.dropped++;return false;}trail.id=id;trail.start=trail.count=0;}
  if(trail.count){const k=((trail.start+trail.count-1)%VOLUME_POINTS)*4;if(time<trail.points[k+3])throw new Error('Trail samples must be monotonic.');if(time===trail.points[k+3])return false;}
  const k=((trail.start+trail.count)%VOLUME_POINTS)*4;trail.points[k]=x;trail.points[k+1]=y;trail.points[k+2]=z;trail.points[k+3]=time;
  if(trail.count===VOLUME_POINTS)trail.start=(trail.start+1)%VOLUME_POINTS;else trail.count++;
  this.revision++;return true;
 }
 expire(time){if(time===this.time)return;this.time=time;this.revision++;for(const t of this.trails){while(t.count&&t.points[t.start*4+3]<=time-VOLUME_LIFE){t.start=(t.start+1)%VOLUME_POINTS;t.count--;}if(!t.count)t.id=null;}}
 sort(eye){
  let count=0;
  for(let i=0;i<this.trails.length;i++){const t=this.trails[i];if(t.count<2)continue;const k=((t.start+(t.count>>1))%VOLUME_POINTS)*4,depth=(t.points[k]-eye[0])**2+(t.points[k+1]-eye[1])**2+(t.points[k+2]-eye[2])**2;let j=count++;while(j&&this.depth[j-1]<depth){this.depth[j]=this.depth[j-1];this.order[j]=this.order[j-1];j--;}this.depth[j]=depth;this.order[j]=i;}
  this.count=count;return count;
 }
 pack(out,eye){
  const count=this.sort(eye);
  for(let i=0;i<count;i++){
   const t=this.trails[this.order[i]],base=i*VOLUME_FLOATS;out.fill(0,base,base+VOLUME_FLOATS);out[base+8]=t.count;
   for(let a=0;a<3;a++){out[base+a]=Infinity;out[base+4+a]=-Infinity;}
   for(let n=0;n<t.count;n++){
    const src=((t.start+n)%VOLUME_POINTS)*4,dst=base+12+n*4,age=this.time-t.points[src+3],radius=3.2*(1+age*.9);
    out[dst]=t.points[src]+Math.sin(age*1.4+t.points[src+2]*.025)*age*1.8;out[dst+1]=t.points[src+1]+1.2*age;out[dst+2]=t.points[src+2]+Math.sin(age*1.1+t.points[src]*.025)*age*1.4;out[dst+3]=age;
    for(let a=0;a<3;a++){out[base+a]=Math.min(out[base+a],out[dst+a]-radius);out[base+4+a]=Math.max(out[base+4+a],out[dst+a]+radius);}
   }
   for(let b=0;b<VOLUME_BLOCKS;b++){
    const dst=base+12+VOLUME_POINTS*4+b*8;for(let a=0;a<3;a++){out[dst+a]=Infinity;out[dst+4+a]=-Infinity;}
    const first=b*VOLUME_BLOCK,last=Math.min(t.count-1,first+VOLUME_BLOCK);
    if(first>=t.count-1){out.fill(0,dst,dst+8);continue;}
    for(let n=first;n<=last;n++){const k=base+12+n*4,radius=3.2*(1+out[k+3]*.9);for(let a=0;a<3;a++){out[dst+a]=Math.min(out[dst+a],out[k+a]-radius);out[dst+4+a]=Math.max(out[dst+4+a],out[k+a]+radius);}}
   }
  }
  this.count=count;return count;
 }
}
