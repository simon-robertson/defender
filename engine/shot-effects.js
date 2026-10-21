import {MAX_SHOT_LIGHTS,MAX_SHOT_SPARKS,MAX_SHOT_INSTANCES,SHOT_INSTANCE_FLOATS,FLASH_SECONDS,SPARK_SECONDS,MUZZLE_FLASH_SCALE,SHOT_LIGHT_RADIUS} from '../shared/shot-effects.js';

const IMPACT_SECONDS=.32;

// Fixed pools. Flashes replace the oldest flash at capacity; sparks drop new
// particles at capacity. No per-shot/per-frame objects, timers or array slices.
export class ShotEffects {
 constructor(random=Math.random){
  this.random=random;this.time=0;this.flashCount=0;this.sparkCount=0;this.instanceCount=0;this.lightCount=0;this.droppedSparks=0;this.replacedFlashes=0;this.liveUntil=-Infinity;this.needsCleanup=false;
  this.flashBirth=new Float64Array(MAX_SHOT_LIGHTS).fill(-Infinity);this.flashMatrix=new Array(MAX_SHOT_LIGHTS).fill(null);this.flashSocket=new Array(MAX_SHOT_LIGHTS).fill(null);this.flashSeed=new Float32Array(MAX_SHOT_LIGHTS);
  this.sparkBirth=new Float64Array(MAX_SHOT_SPARKS).fill(-Infinity);this.sparks=new Float32Array(MAX_SHOT_SPARKS*8);
  this.instanceData=new Float32Array(MAX_SHOT_INSTANCES*SHOT_INSTANCE_FLOATS);this.lightData=new Float32Array(4+MAX_SHOT_LIGHTS*8);
  this.point=new Float64Array(3);
 }
 reset(){
  this.time=0;this.flashCount=this.sparkCount=this.instanceCount=this.lightCount=this.droppedSparks=this.replacedFlashes=0;
  this.liveUntil=-Infinity;this.needsCleanup=false;this.flashBirth.fill(-Infinity);this.sparkBirth.fill(-Infinity);
  this.flashMatrix.fill(null);this.flashSocket.fill(null);this.lightData.fill(0);
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Delta seconds must be finite and non-negative.');this.time+=deltaSeconds;
  if(!this.needsCleanup)return;
  for(let i=0;i<MAX_SHOT_LIGHTS;i++)if(this.time>=this.flashBirth[i]+FLASH_SECONDS){this.flashBirth[i]=-Infinity;this.flashMatrix[i]=null;this.flashSocket[i]=null;}
  for(let i=0;i<MAX_SHOT_SPARKS;i++)if(this.time>=this.sparkBirth[i]+(this.sparks[i*8+7]>=1?IMPACT_SECONDS:SPARK_SECONDS))this.sparkBirth[i]=-Infinity;
  if(this.time>=this.liveUntil)this.needsCleanup=false;
 }
 muzzle(matrix,socket){
  const x=socket[0],y=socket[1],z=socket[2]-.15,p=this.point;
  for(let axis=0;axis<3;axis++)p[axis]=matrix[axis]*x+matrix[4+axis]*y+matrix[8+axis]*z+matrix[12+axis];
 }
 emit(matrix,sockets,at){
  const age=this.time-at;if(age<0||age>=SPARK_SECONDS)return; // Never replay expired shots after a stall.
  this.liveUntil=Math.max(this.liveUntil,at+SPARK_SECONDS);this.needsCleanup=true;
  for(let mouth=0;mouth<sockets.length;mouth++){
   const socket=sockets[mouth];
   if(age<FLASH_SECONDS){
    let slot=0;for(let i=1;i<MAX_SHOT_LIGHTS;i++)if(this.flashBirth[i]<this.flashBirth[slot])slot=i;
    if(this.flashBirth[slot]!==-Infinity)this.replacedFlashes++;
    this.flashBirth[slot]=at;this.flashMatrix[slot]=matrix;this.flashSocket[slot]=socket;this.flashSeed[slot]=this.random()*6.28;
   }
   this.muzzle(matrix,socket);const p=this.point;
   for(let n=0;n<6;n++){
    let slot=-1;for(let i=0;i<MAX_SHOT_SPARKS;i++)if(this.sparkBirth[i]===-Infinity){slot=i;break;}
    if(slot<0){this.droppedSparks++;continue;}
    const k=slot*8,angle=this.random()*Math.PI*2,spread=5+this.random()*12,speed=10+this.random()*16;
    this.sparkBirth[slot]=at;this.sparks[k]=p[0];this.sparks[k+1]=p[1];this.sparks[k+2]=p[2];
    for(let axis=0;axis<3;axis++)this.sparks[k+3+axis]=-matrix[8+axis]*speed+matrix[axis]*Math.cos(angle)*spread+matrix[4+axis]*Math.sin(angle)*spread;
    this.sparks[k+6]=.22+this.random()*.24;this.sparks[k+7]=this.random();
   }
  }
 }
 impact(point,normal,at=this.time){
  if(this.time-at<0||this.time-at>=IMPACT_SECONDS)return;
  this.liveUntil=Math.max(this.liveUntil,at+IMPACT_SECONDS);this.needsCleanup=true;
  for(let n=0;n<10;n++){
   let slot=-1;for(let i=0;i<MAX_SHOT_SPARKS;i++)if(this.sparkBirth[i]===-Infinity){slot=i;break;}
   if(slot<0){this.droppedSparks++;break;}
   const k=slot*8,s=this.sparks;this.sparkBirth[slot]=at;
   for(let a=0;a<3;a++){s[k+a]=point[a]+normal[a]*.15;s[k+3+a]=normal[a]*(14+this.random()*16)+(this.random()-.5)*24;}
   s[k+6]=.35+this.random()*.35;s[k+7]=1+this.random();
  }
 }
 instance(x,y,z,r,dx,dy,dz,length,red,green,blue,alpha,kind,seed){
  const a=this.instanceData,k=this.instanceCount++*SHOT_INSTANCE_FLOATS;
  a[k]=x;a[k+1]=y;a[k+2]=z;a[k+3]=r;a[k+4]=dx;a[k+5]=dy;a[k+6]=dz;a[k+7]=length;
  a[k+8]=red;a[k+9]=green;a[k+10]=blue;a[k+11]=alpha;a[k+12]=kind;a[k+13]=seed;a[k+14]=0;a[k+15]=0;
 }
 prepare(){
  this.flashCount=0;this.sparkCount=0;this.instanceCount=0;this.lightCount=0;
  this.lightData[0]=0;if(!this.needsCleanup)return;
  for(let i=0;i<MAX_SHOT_LIGHTS;i++){
   const age=this.time-this.flashBirth[i];if(age>=FLASH_SECONDS)continue;
   const m=this.flashMatrix[i];this.muzzle(m,this.flashSocket[i]);const p=this.point,dx=-m[8],dy=-m[9],dz=-m[10],fade=1-age/FLASH_SECONDS,pulse=fade*fade;
   const size=(.65+.35*fade)*MUZZLE_FLASH_SCALE,seed=this.flashSeed[i];
   this.instance(p[0],p[1],p[2],3.1*size,dx,dy,dz,(10+Math.sin(seed)*2)*size,1,.62,.18,fade,0,seed);
   this.instance(p[0]+dx*.5,p[1]+dy*.5,p[2]+dz*.5,3.2*size,0,0,0,0,1,.8,.43,fade,1,seed);
   const k=4+this.lightCount++*8,l=this.lightData;l[k]=p[0]+dx*3;l[k+1]=p[1]+dy*3;l[k+2]=p[2]+dz*3;l[k+3]=SHOT_LIGHT_RADIUS;
   l[k+4]=1;l[k+5]=.61;l[k+6]=.26;l[k+7]=8*pulse;this.flashCount++;
  }
  this.lightData[0]=this.lightCount;
  for(let i=0;i<MAX_SHOT_SPARKS;i++){
   const age=this.time-this.sparkBirth[i],impact=this.sparks[i*8+7]>=1,life=impact?IMPACT_SECONDS:SPARK_SECONDS;if(age>=life)continue;
   const k=i*8,a=this.sparks,fade=1-age/life;
   this.instance(a[k]+a[k+3]*age,a[k+1]+a[k+4]*age-12*age*age,a[k+2]+a[k+5]*age,a[k+6]*(.5+.5*fade),0,0,0,0,1,impact?.85:.44+a[k+7]*.26,impact?.48:.09,fade*fade,2,a[k+7]);this.sparkCount++;
  }
 }
}
