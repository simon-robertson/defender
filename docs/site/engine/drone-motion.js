import {DRONE_PREVIEW as T} from '../shared/drone.js';

const STRIDE=13,EPS=1e-8;
function norm(x,y,z){return Math.hypot(x,y,z);}
// Exact arc length of a quadratic Bezier. A collinear curve has a separate
// stable branch, avoiding log/asinh singularities at a straight corner.
function arc(d,k,t){
 const vx=2*(d[k+3]-d[k]),vy=2*(d[k+4]-d[k+1]),vz=2*(d[k+5]-d[k+2]);
 const wx=2*(d[k+6]-2*d[k+3]+d[k]),wy=2*(d[k+7]-2*d[k+4]+d[k+1]),wz=2*(d[k+8]-2*d[k+5]+d[k+2]),a=wx*wx+wy*wy+wz*wz;
 if(a<EPS)return norm(vx,vy,vz)*t;
 const b=(vx*wx+vy*wy+vz*wz)/a,h=Math.max(0,(vx*vx+vy*vy+vz*vz)/a-b*b),q=t+b;
 if(h<1e-12)return .5*Math.sqrt(a)*(q*Math.abs(q)-b*Math.abs(b));
 const r=Math.sqrt(h);
 return .5*Math.sqrt(a)*(q*Math.sqrt(q*q+h)+h*Math.asinh(q/r)-b*Math.sqrt(b*b+h)-h*Math.asinh(b/r));
}

// Bounded, reused line/quadratic commands. Tangents agree at rounded joins;
// uncertified corners retain a deliberate zero-speed join. No path allocation
// or historical-time replay occurs during advance/sample.
export class DroneMotion {
 constructor(capacity){this.data=new Float64Array(capacity*STRIDE);this.capacity=capacity;this.segmentCount=0;this.segmentIndex=0;this.distance=0;this.length=0;this.speed=0;this.point=new Float64Array(6);this.samplePoint=new Float64Array(6);this.overflow=0;}
 get done(){return this.distance>=this.length-EPS;}
 clear(){this.segmentCount=this.segmentIndex=this.distance=this.length=this.speed=0;}
 add(ax,ay,az,cx,cy,cz,bx,by,bz,curve,exitSpeed=T.speed){
  if(norm(bx-ax,by-ay,bz-az)<EPS)return true;
  if(this.segmentCount>=this.capacity){this.overflow++;return false;}
  const d=this.data,k=this.segmentCount*STRIDE;d[k]=ax;d[k+1]=ay;d[k+2]=az;d[k+3]=cx;d[k+4]=cy;d[k+5]=cz;d[k+6]=bx;d[k+7]=by;d[k+8]=bz;d[k+11]=curve?1:0;d[k+12]=exitSpeed;
  const length=curve?arc(d,k,1):norm(bx-ax,by-ay,bz-az);d[k+9]=length;d[k+10]=T.speed;
  if(curve){
   const vx=2*(cx-ax),vy=2*(cy-ay),vz=2*(cz-az),wx=2*(bx-2*cx+ax),wy=2*(by-2*cy+ay),wz=2*(bz-2*cz+az),a=wx*wx+wy*wy+wz*wz;
   const u=a>EPS?Math.max(0,Math.min(1,-(vx*wx+vy*wy+vz*wz)/a)):0,s=norm(vx+wx*u,vy+wy*u,vz+wz*u),cross=norm(vy*wz-vz*wy,vz*wx-vx*wz,vx*wy-vy*wx),curvature=s>EPS?cross/(s*s*s):Infinity;
   if(curvature>EPS)d[k+10]=Math.min(T.speed,Math.sqrt(T.turnAcceleration/curvature));
  }
  this.length+=length;this.segmentCount++;return true;
 }
 sample(distance,out=this.point){
  const d=this.data;let travelled=0,index=0;
  while(index+1<this.segmentCount&&travelled+d[index*STRIDE+9]<distance-EPS){travelled+=d[index*STRIDE+9];index++;}
  const k=index*STRIDE,length=d[k+9],local=Math.max(0,Math.min(length,distance-travelled));let u=length>EPS?local/length:1;
  if(d[k+11]&&u>0&&u<1){
   let low=0,high=1;
   for(let i=0;i<10;i++){const value=arc(d,k,u);if(Math.abs(value-local)<1e-9)break;if(value<local)low=u;else high=u;const v=2*norm((1-u)*(d[k+3]-d[k])+u*(d[k+6]-d[k+3]),(1-u)*(d[k+4]-d[k+1])+u*(d[k+7]-d[k+4]),(1-u)*(d[k+5]-d[k+2])+u*(d[k+8]-d[k+5]));const next=v>EPS?u-(value-local)/v:NaN;u=next>low&&next<high?next:(low+high)*.5;}
  }
  if(d[k+11]){
   const q=1-u;for(let axis=0;axis<3;axis++){out[axis]=q*q*d[k+axis]+2*q*u*d[k+3+axis]+u*u*d[k+6+axis];out[3+axis]=2*q*(d[k+3+axis]-d[k+axis])+2*u*(d[k+6+axis]-d[k+3+axis]);}
  }else for(let axis=0;axis<3;axis++){out[axis]=d[k+axis]+(d[k+6+axis]-d[k+axis])*u;out[3+axis]=d[k+6+axis]-d[k+axis];}
  const speed=norm(out[3],out[4],out[5]);if(speed>EPS){out[3]/=speed;out[4]/=speed;out[5]/=speed;}else out[3]=out[4]=out[5]=0;
  if(out===this.point)this.segmentIndex=index;return out;
 }
 advance(dt,stop=false){
  if(!this.segmentCount)return this.point;
  const d=this.data;let cursor=0,limit=stop?0:T.speed;
  for(let i=0;i<this.segmentCount;i++){
   const k=i*STRIDE,end=cursor+d[k+9];
   if(end>this.distance+EPS||i===this.segmentCount-1){
    const ahead=Math.max(0,cursor-this.distance),remaining=Math.max(0,end-this.distance),anticipation=this.speed*dt;
    limit=Math.min(limit,Math.sqrt(d[k+10]**2+2*T.braking*Math.max(0,ahead-anticipation)),Math.sqrt(d[k+12]**2+2*T.braking*Math.max(0,remaining-anticipation)));
   }cursor=end;
  }
  const old=this.speed,rate=limit<old?T.braking:T.acceleration;
  this.speed=old<limit?Math.min(limit,old+rate*dt):Math.max(limit,old-rate*dt);
  let next=Math.min(this.length,this.distance+(old+this.speed)*.5*dt),end=0;
  for(let i=0;i<this.segmentCount;i++){const k=i*STRIDE;end+=d[k+9];if(end>this.distance+EPS&&end<=next+EPS&&d[k+12]===0){next=end;this.speed=0;break;}}
  this.distance=next;
  if(this.done){this.distance=this.length;this.speed=0;}
  return this.sample(this.distance);
 }
 duration(maxSeconds=20){
  // A bounded planning-only dry run of the actual curve speed controller.
  // Scalar/point state is restored; the retained command buffer is untouched.
  const distance=this.distance,speed=this.speed,index=this.segmentIndex,p=this.point,x=p[0],y=p[1],z=p[2],dx=p[3],dy=p[4],dz=p[5];let seconds=0;
  for(let step=0;step<Math.ceil(maxSeconds/.02)&&!this.done;step++){this.advance(.02);seconds+=.02;}
  const result=this.done?seconds:Infinity;
  this.distance=distance;this.speed=speed;this.segmentIndex=index;p[0]=x;p[1]=y;p[2]=z;p[3]=dx;p[4]=dy;p[5]=dz;return result;
 }
 dispose(){this.data=this.point=this.samplePoint=null;this.clear();}
}
