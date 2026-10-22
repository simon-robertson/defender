import {MAX_ARC_PRIMARY_STRIKES,MAX_ARC_STRIKES,ARC_TRUNK_SEGMENTS,MAX_ARC_SPARKS,ARC_SPARKS_PER_HIT,ARC_INSTANCE_FLOATS,ARC_CHANNEL_KIND,MAX_ARC_INSTANCES,ARC_LIGHT_FLOATS,ARC_SECONDS,ARC_SPARK_SECONDS,ARC_SPARK_FLIGHT_SECONDS,ARC_SPARK_REST_SECONDS,ARC_SPARK_GRAVITY,ARC_RESTRIKE_AT,ARC_WIDTH,ARC_CHAIN_WIDTH_SCALE,ARC_LIGHT_RADIUS,ARC_LIGHT_STRENGTH} from '../shared/arc-effects.js';
import {sweepScenery,debrisSupport} from './debris-collision.js';
import {packTubeLightBounds} from './tube-light-bounds.js';

const NODES=ARC_TRUNK_SEGMENTS+1,TAU=Math.PI*2;
// These interpolation coefficients depend only on the fixed node index. Retain
// double precision and the original arithmetic so every strike uses the same
// shape/RNG sequence without recomputing sine and neighbour indices per frame.
const nodeParameters=new Float64Array(NODES*5);
for(let node=0;node<NODES;node++){
 const k=node*5,t=node<=4?node/4:(node-4)/(ARC_TRUNK_SEGMENTS-4),coarse=Math.floor(node/4)*4;
 nodeParameters[k]=t;nodeParameters[k+1]=Math.sin(t*Math.PI);
 nodeParameters[k+2]=coarse*2;nodeParameters[k+3]=Math.min(ARC_TRUNK_SEGMENTS,coarse+4)*2;nodeParameters[k+4]=(node-coarse)/4;
}
// Coordinate copies and optional live bone references occupy fixed slots. No
// shot/frame objects, timers or slices; old strikes replace, excess sparks drop.
export class ArcEffects {
 constructor(random=Math.random){
  this.random=random;this.time=0;this.visibility=null;this.strikeCount=this.sparkCount=this.groundedCount=this.instanceCount=this.lightCount=0;
  this.replacedStrikes=this.droppedSparks=0;this.needsCleanup=false;
  this.birth=new Float64Array(MAX_ARC_STRIKES).fill(-Infinity);this.secondary=new Uint8Array(MAX_ARC_STRIKES);this.droppedChainStrikes=0;
  this.ends=new Float64Array(MAX_ARC_STRIKES*6);this.shape=new Float32Array(MAX_ARC_STRIKES*NODES*2);
  this.points=new Float64Array(NODES*3);this.contact=new Float64Array(5);
  this.sourceAttachments=new Array(MAX_ARC_STRIKES).fill(null);this.sourceLocalPoints=new Float64Array(MAX_ARC_STRIKES*3);this.attachments=new Array(MAX_ARC_STRIKES).fill(null);this.localPoints=new Float64Array(MAX_ARC_STRIKES*3);
  this.sparkBirth=new Float64Array(MAX_ARC_SPARKS).fill(-Infinity);this.sparkRest=new Float64Array(MAX_ARC_SPARKS).fill(-Infinity);this.sparks=new Float64Array(MAX_ARC_SPARKS*8);
  this.instanceData=new Float32Array(MAX_ARC_INSTANCES*ARC_INSTANCE_FLOATS);
  this.lightData=new Float32Array(4+MAX_ARC_STRIKES*ARC_LIGHT_FLOATS);
 }
 setWorld(world){this.reset();this.visibility=world?.visibility??null;}
 reset(preserveTime=false){
  if(!preserveTime){this.time=0;this.visibility=null;}this.strikeCount=this.sparkCount=this.groundedCount=this.instanceCount=this.lightCount=0;this.replacedStrikes=this.droppedSparks=0;
  this.birth.fill(-Infinity);this.secondary.fill(0);this.droppedChainStrikes=0;this.sparkBirth.fill(-Infinity);this.sparkRest.fill(-Infinity);this.attachments.fill(null);this.sourceAttachments.fill(null);this.lightData.fill(0);this.needsCleanup=false;
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Arc delta must be finite and non-negative.');
  const previous=this.time;this.time+=deltaSeconds;if(!this.needsCleanup)return;
  let live=false;
  for(let i=0;i<MAX_ARC_STRIKES;i++)if(this.time>=this.birth[i]+ARC_SECONDS){this.birth[i]=-Infinity;this.attachments[i]=null;this.sourceAttachments[i]=null;}else live=true;
  for(let i=0;i<MAX_ARC_SPARKS;i++)if(this.sparkBirth[i]!==-Infinity){this.stepSpark(i,deltaSeconds,previous);if(this.sparkBirth[i]!==-Infinity)live=true;}
  this.needsCleanup=live;
 }
 emit(source,impact,normal,at,attachmentMatrix=null,attachmentLocalPoint=null,isChain=false,sourceMatrix=null,sourceLocalPoint=null){
  const age=this.time-at;if(!Number.isFinite(at)||age<0||age>=ARC_SECONDS)return false;
  for(let axis=0;axis<3;axis++)if(!Number.isFinite(source[axis])||!Number.isFinite(impact[axis])||!Number.isFinite(normal[axis]))throw new Error('Arc endpoints and impact normal must be finite.');
  const dx=impact[0]-source[0],dy=impact[1]-source[1],dz=impact[2]-source[2];if(dx*dx+dy*dy+dz*dz<1e-8)return false;
  if(attachmentMatrix){
   if(!attachmentLocalPoint||attachmentMatrix.length!==16)throw new Error('Arc attachment requires a matrix and local point.');
   for(let axis=0;axis<3;axis++)if(!Number.isFinite(attachmentLocalPoint[axis]))throw new Error('Arc attachment point must be finite.');
  }
  if(sourceMatrix){if(!sourceLocalPoint||sourceMatrix.length!==16)throw new Error('Arc source attachment requires a matrix and local point.');for(let a=0;a<3;a++)if(!Number.isFinite(sourceLocalPoint[a]))throw new Error('Arc source attachment point must be finite.');}
  // Each primary/secondary bank retains six bolts; saturation replaces only
  // the oldest bolt in its own bank. A primary can never suppress all chains.
  const begin=isChain?MAX_ARC_PRIMARY_STRIKES:0,end=begin+MAX_ARC_PRIMARY_STRIKES;
  let slot=-1;for(let i=begin;i<end;i++)if(this.birth[i]===-Infinity){slot=i;break;}
  if(slot<0){slot=begin;for(let i=begin+1;i<end;i++)if(this.birth[i]<this.birth[slot])slot=i;}
  if(this.birth[slot]!==-Infinity)this.replacedStrikes++;
  this.birth[slot]=at;this.secondary[slot]=isChain?1:0;this.attachments[slot]=attachmentMatrix;this.sourceAttachments[slot]=sourceMatrix;const e=slot*6;
  for(let axis=0;axis<3;axis++){this.ends[e+axis]=source[axis];this.ends[e+3+axis]=impact[axis];if(attachmentMatrix)this.localPoints[slot*3+axis]=attachmentLocalPoint[axis];if(sourceMatrix)this.sourceLocalPoints[slot*3+axis]=sourceLocalPoint[axis];}
  const shape=slot*NODES*2;
  for(let node=0;node<NODES;node++){this.shape[shape+node*2]=this.random()*2-1;this.shape[shape+node*2+1]=this.random()*2-1;}
  let nx=normal[0],ny=normal[1],nz=normal[2],nl=Math.hypot(nx,ny,nz);if(nl<1e-8){nx=-dx;ny=-dy;nz=-dz;nl=Math.hypot(nx,ny,nz);}nx/=nl;ny/=nl;nz/=nl;
  let ux=ny,uy=-nx,uz=0;if(Math.abs(nz)>.9){ux=0;uy=nz;uz=-ny;}const ul=Math.hypot(ux,uy,uz);ux/=ul;uy/=ul;uz/=ul;
  const vx=ny*uz-nz*uy,vy=nz*ux-nx*uz,vz=nx*uy-ny*ux;
  for(let particle=0;particle<ARC_SPARKS_PER_HIT;particle++){
   let spark=-1;for(let i=0;i<MAX_ARC_SPARKS;i++)if(this.sparkBirth[i]===-Infinity){spark=i;break;}
   if(spark<0){this.droppedSparks++;continue;}
   const k=spark*8,angle=this.random()*TAU,speed=12+this.random()*12,spread=3+this.random()*8,a=Math.cos(angle)*spread,b=Math.sin(angle)*spread;
   this.sparkBirth[spark]=at;this.sparkRest[spark]=-Infinity;this.sparks[k]=impact[0]+nx*.12;this.sparks[k+1]=impact[1]+ny*.12;this.sparks[k+2]=impact[2]+nz*.12;
   this.sparks[k+3]=nx*speed+ux*a+vx*b;this.sparks[k+4]=ny*speed+uy*a+vy*b+6+this.random()*8;this.sparks[k+5]=nz*speed+uz*a+vz*b;
   this.sparks[k+6]=.13+this.random()*.13;this.sparks[k+7]=.8+this.random()*.2;
   const radius=this.sparks[k+6]*.35,ground=this.visibility?debrisSupport(this.visibility,this.sparks[k],this.sparks[k+2],radius,this.sparks[k+1]+radius):0;
   if(Number.isFinite(ground)&&this.sparks[k+1]<ground+radius)this.sparks[k+1]=ground+radius+.002;
   if(age>0)this.stepSpark(spark,age,at);
  }
  this.needsCleanup=true;return true;
 }
 stepSpark(slot,deltaSeconds,startTime){
  const endTime=startTime+deltaSeconds,rest=this.sparkRest[slot];
  if(rest!==-Infinity){if(endTime>=rest+ARC_SPARK_REST_SECONDS)this.sparkBirth[slot]=-Infinity;return;}
  if(endTime-this.sparkBirth[slot]>=ARC_SPARK_SECONDS){this.sparkBirth[slot]=-Infinity;return;}
  const s=this.sparks,k=slot*8,radius=s[k+6]*.35,hit=this.contact;
  // Exact swept static collision prevents tunnelling; bounded substeps resolve
  // ballistic curvature. Remaining frame time also advances the ground fade.
  const steps=Math.min(120,Math.max(1,Math.ceil(deltaSeconds*120))),dt=deltaSeconds/steps;
  for(let step=0;step<steps;step++){
   let remaining=dt,used=0;
   for(let contact=0;contact<3&&remaining>1e-8;contact++){
    const dx=s[k+3]*remaining,dy=s[k+4]*remaining-.5*ARC_SPARK_GRAVITY*remaining*remaining,dz=s[k+5]*remaining;
    let collided=this.visibility?sweepScenery(this.visibility,s[k],s[k+1],s[k+2],dx,dy,dz,radius,hit):false;
    // The level's zero-height plane remains a floor outside authored cuboids.
    if(dy<0&&s[k+1]+dy<radius){const fraction=Math.max(0,(radius-s[k+1])/dy);if(!collided||fraction<hit[0]){hit[0]=fraction;hit[1]=hit[3]=hit[4]=0;hit[2]=1;collided=true;}}
    if(!collided){s[k]+=dx;s[k+1]+=dy;s[k+2]+=dz;s[k+4]-=ARC_SPARK_GRAVITY*remaining;break;}
    const fraction=hit[0],nx=hit[1],ny=hit[2],nz=hit[3],travel=remaining*fraction;
    s[k]+=dx*fraction+nx*.002;s[k+1]+=dy*fraction+ny*.002;s[k+2]+=dz*fraction+nz*.002;s[k+4]-=ARC_SPARK_GRAVITY*travel;
    if(ny>.5){
     s[k+1]=hit[4]+radius+.002;s[k+3]=s[k+4]=s[k+5]=0;this.sparkRest[slot]=startTime+step*dt+used+travel;
     if(endTime>=this.sparkRest[slot]+ARC_SPARK_REST_SECONDS)this.sparkBirth[slot]=-Infinity;return;
    }
    const normalSpeed=s[k+3]*nx+s[k+4]*ny+s[k+5]*nz;
    if(normalSpeed<0){s[k+3]-=normalSpeed*nx*1.2;s[k+4]-=normalSpeed*ny*1.2;s[k+5]-=normalSpeed*nz*1.2;}
    s[k+3]*=.65;s[k+5]*=.65;used+=travel;remaining-=travel;
   }
  }
  if(endTime-this.sparkBirth[slot]>=ARC_SPARK_FLIGHT_SECONDS)this.sparkBirth[slot]=-Infinity;
 }
 instance(ax,ay,az,bx,by,bz,width,alpha,kind=0,r=.56,g=.74,b=1){
  const data=this.instanceData,k=this.instanceCount++*ARC_INSTANCE_FLOATS;
  data[k]=ax;data[k+1]=ay;data[k+2]=az;data[k+3]=width;data[k+4]=bx;data[k+5]=by;data[k+6]=bz;data[k+7]=alpha;
  data[k+8]=r;data[k+9]=g;data[k+10]=b;data[k+11]=kind;return k;
 }
 lightSegment(k,a,b){
  const p=this.points,l=this.lightData;
  l[k]=p[a];l[k+1]=p[a+1];l[k+2]=p[a+2];l[k+3]=1;
  l[k+4]=p[b];l[k+5]=p[b+1];l[k+6]=p[b+2];l[k+7]=1;
 }
 prepare(){
  this.strikeCount=this.sparkCount=this.groundedCount=this.instanceCount=this.lightCount=0;this.lightData[0]=0;if(!this.needsCleanup)return;
  const p=this.points;
  for(let slot=0;slot<MAX_ARC_STRIKES;slot++){
   const age=this.time-this.birth[slot];if(age<0||age>=ARC_SECONDS)continue;
   const e=slot*6,m=this.attachments[slot],from=this.sourceAttachments[slot];
   if(from){const k=slot*3,x=this.sourceLocalPoints[k],y=this.sourceLocalPoints[k+1],z=this.sourceLocalPoints[k+2];for(let axis=0;axis<3;axis++)this.ends[e+axis]=from[axis]*x+from[4+axis]*y+from[8+axis]*z+from[12+axis];}
   if(m){const k=slot*3,x=this.localPoints[k],y=this.localPoints[k+1],z=this.localPoints[k+2];for(let axis=0;axis<3;axis++)this.ends[e+3+axis]=m[axis]*x+m[4+axis]*y+m[8+axis]*z+m[12+axis];}
   const ax=this.ends[e],ay=this.ends[e+1],az=this.ends[e+2],dx=this.ends[e+3]-ax,dy=this.ends[e+4]-ay,dz=this.ends[e+5]-az,length=Math.hypot(dx,dy,dz);
   if(length<1e-6)continue;
   const tx=dx/length,ty=dy/length,tz=dz/length;
   let ux=ty,uy=-tx,uz=0;if(Math.abs(tz)>.9){ux=0;uy=tz;uz=-ty;}const ul=Math.hypot(ux,uy,uz);ux/=ul;uy/=ul;uz/=ul;
   const vx=ty*uz-tz*uy,vy=tz*ux-tx*uz,vz=tx*uy-ty*ux;
   const fade=1-age/ARC_SECONDS,restrike=age>=ARC_RESTRIKE_AT,shape=slot*NODES*2;
   // One brief dip followed by a weaker restrike; shape stays stable between
   // those events rather than generating noisy random geometry every frame.
   const pulse=age<.033?1:age<ARC_RESTRIKE_AT?.25:Math.max(0,.78*(1-(age-ARC_RESTRIKE_AT)/(ARC_SECONDS-ARC_RESTRIKE_AT)));
   const strength=pulse*(.9+.1*Math.cos(age*310+slot)),amplitude=Math.min(1.8,length*.045);
   // Leave the actual terminal top upward/outward before descending. The first
   // four existing spans make this escape; no detached source or extra branch.
   const horizontal=Math.hypot(dx,dz),escapeX=ax+(this.secondary[slot]?dx*.12:(horizontal>1e-6?dx/horizontal:1)*4),escapeY=ay+(this.secondary[slot]?dy*.12:2),escapeZ=az+(this.secondary[slot]?dz*.12:(horizontal>1e-6?dz/horizontal:0)*4);
   for(let node=0;node<NODES;node++){
    const k=node*3,parameter=node*5,t=nodeParameters[parameter];if(node<=4){p[k]=ax+(escapeX-ax)*t;p[k+1]=ay+(escapeY-ay)*t;p[k+2]=az+(escapeZ-az)*t;continue;}
    const envelope=nodeParameters[parameter+1],coarse=nodeParameters[parameter+2],next=nodeParameters[parameter+3],part=nodeParameters[parameter+4];
    const smoothX=this.shape[shape+coarse]*(1-part)+this.shape[shape+next]*part,smoothY=this.shape[shape+coarse+1]*(1-part)+this.shape[shape+next+1]*part;
    const a=(smoothX+this.shape[shape+node*2]*.33*(restrike?-1:1))*amplitude*envelope,b=(smoothY+this.shape[shape+node*2+1]*.33*(restrike?-1:1))*amplitude*envelope;
    p[k]=escapeX+(this.ends[e+3]-escapeX)*t+ux*a+vx*b;p[k+1]=escapeY+(this.ends[e+4]-escapeY)*t+uy*a+vy*b;p[k+2]=escapeZ+(this.ends[e+5]-escapeZ)*t+uz*a+vz*b;
   }
   // Exact source/hit attachment, independent of trigonometric endpoint error.
   p[0]=ax;p[1]=ay;p[2]=az;for(let axis=0;axis<3;axis++)p[ARC_TRUNK_SEGMENTS*3+axis]=this.ends[e+3+axis];
   const light=4+this.lightCount++*ARC_LIGHT_FLOATS,l=this.lightData;
   l[light]=.43;l[light+1]=.66;l[light+2]=1;l[light+3]=ARC_LIGHT_RADIUS;l[light+4]=ARC_LIGHT_STRENGTH*strength;l[light+5]=8;l[light+6]=l[light+7]=0;
   const width=ARC_WIDTH*(this.secondary[slot]?ARC_CHAIN_WIDTH_SCALE:1)*(.8+.2*fade),alpha=Math.sqrt(strength);
   // One shared tangent makes neighbouring ribbon edges identical.
   for(let segment=0;segment<ARC_TRUNK_SEGMENTS;segment++){
    const a=segment*3,b=a+3;this.instance(p[a],p[a+1],p[a+2],p[b],p[b+1],p[b+2],width,alpha,ARC_CHANNEL_KIND,tx,ty,tz);
   }
   for(let segment=0;segment<8;segment++)this.lightSegment(light+8+segment*8,segment*12,(segment+1)*12);
   packTubeLightBounds(l,light);
   this.strikeCount++;
  }
  this.lightData[0]=this.lightCount;
  for(let slot=0;slot<MAX_ARC_SPARKS;slot++){
   const age=this.time-this.sparkBirth[slot];if(age<0||age>=ARC_SPARK_SECONDS)continue;
   const k=slot*8,s=this.sparks,rest=this.sparkRest[slot],grounded=rest!==-Infinity,fade=grounded?Math.max(0,1-(this.time-rest)/ARC_SPARK_REST_SECONDS):1,heat=Math.min(1,age/.5),width=s[k+6],green=.95-.5*heat,blue=.5-.46*heat;
   if(grounded)this.instance(s[k]-width*.3,s[k+1],s[k+2],s[k]+width*.3,s[k+1],s[k+2],width,fade*fade*s[k+7],1,1,green,blue);else this.instance(s[k]-s[k+3]*.018,s[k+1]-s[k+4]*.018,s[k+2]-s[k+5]*.018,s[k],s[k+1],s[k+2],width,s[k+7],1,1,green,blue);
   this.sparkCount++;if(grounded)this.groundedCount++;
  }
 }
}
