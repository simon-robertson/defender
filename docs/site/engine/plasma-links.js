import {MAX_PLASMA_LINKS,PLASMA_SEGMENTS,PLASMA_NODES,PLASMA_INSTANCE_FLOATS,PLASMA_LIGHT_SEGMENTS,PLASMA_LIGHT_FLOATS,PLASMA_WIDTH,PLASMA_WAVE_AMPLITUDE,PLASMA_WAVE_LENGTH_RATIO,PLASMA_MOTION_RATE,PLASMA_LIGHT_RADIUS,PLASMA_LIGHT_STRENGTH,PLASMA_COLOR} from '../shared/plasma-links.js';
import {packTubeLightBounds} from './tube-light-bounds.js';

const TAU=Math.PI*2;
// Spatial terms are shared by every link. Phase factoring keeps the accepted
// waves while moving their 33-node trigonometry out of the frame loop.
const waves=new Float64Array(PLASMA_NODES*7);
for(let node=0;node<PLASMA_NODES;node++){
 const t=node/PLASMA_SEGMENTS,k=node*7;waves[k]=Math.sin(t*Math.PI);
 waves[k+1]=Math.sin(t*TAU*1.3);waves[k+2]=Math.cos(t*TAU*1.3);
 waves[k+3]=Math.sin(t*TAU*2.1);waves[k+4]=Math.cos(t*TAU*2.1);
 waves[k+5]=Math.sin(t*TAU*1.1);waves[k+6]=Math.cos(t*TAU*1.1);
}
// Fixed endpoint copies and packed render/light storage. No world, rig, target
// or caller arrays are retained; waves only deform the interior of each link.
export class PlasmaLinks {
 constructor(){
  this.time=0;this.requestedCount=this.overflow=this.linkCount=this.instanceCount=this.lightCount=0;
  this.ends=new Float64Array(MAX_PLASMA_LINKS*6);
  this.geometry=new Float64Array(MAX_PLASMA_LINKS*10);
  this.points=new Float64Array(MAX_PLASMA_LINKS*PLASMA_NODES*3);
  this.instanceData=new Float32Array(MAX_PLASMA_LINKS*PLASMA_SEGMENTS*PLASMA_INSTANCE_FLOATS);
  this.lightData=new Float32Array(4+MAX_PLASMA_LINKS*PLASMA_LIGHT_FLOATS);
  this.byteLength=this.ends.byteLength+this.geometry.byteLength+this.points.byteLength+this.instanceData.byteLength+this.lightData.byteLength;
 }
 setLinks(links){
  if(!Array.isArray(links))throw new Error('Plasma links must be an array.');
  const count=Math.min(links.length,MAX_PLASMA_LINKS);
  for(let i=0;i<count;i++){
   const source=links[i]?.source,target=links[i]?.target;
   if(source?.length!==3||target?.length!==3)throw new Error('Plasma endpoints require three coordinates.');
   for(let axis=0;axis<3;axis++)if(!Number.isFinite(source[axis])||!Number.isFinite(target[axis]))throw new Error('Plasma endpoints must be finite.');
   if(Math.hypot(target[0]-source[0],target[1]-source[1],target[2]-source[2])<1e-6)throw new Error('Plasma endpoints must be distinct.');
  }
  this.ends.fill(0);this.points.fill(0);this.requestedCount=links.length;this.linkCount=count;this.overflow=links.length-count;
  for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++){this.ends[i*6+axis]=links[i].source[axis];this.ends[i*6+3+axis]=links[i].target[axis];}
  this.geometry.fill(0);
  for(let i=0;i<count;i++){
   const e=i*6,k=i*10,g=this.geometry,dx=this.ends[e+3]-this.ends[e],dy=this.ends[e+4]-this.ends[e+1],dz=this.ends[e+5]-this.ends[e+2],length=Math.hypot(dx,dy,dz),tx=dx/length,ty=dy/length,tz=dz/length;
   let ux=ty,uy=-tx,uz=0;if(Math.abs(tz)>.9){ux=0;uy=tz;uz=-ty;}const ul=Math.hypot(ux,uy,uz);ux/=ul;uy/=ul;uz/=ul;
   g[k]=dx;g[k+1]=dy;g[k+2]=dz;g[k+3]=ux;g[k+4]=uy;g[k+5]=uz;
   g[k+6]=ty*uz-tz*uy;g[k+7]=tz*ux-tx*uz;g[k+8]=tx*uy-ty*ux;g[k+9]=Math.min(PLASMA_WAVE_AMPLITUDE,length*PLASMA_WAVE_LENGTH_RATIO);
  }
  this.prepare();
 }
 advance(deltaSeconds){if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Plasma delta must be finite and non-negative.');this.time+=deltaSeconds;}
 reset(){this.time=0;this.prepare();}
 prepare(){
  this.instanceCount=0;this.lightCount=this.linkCount;this.lightData[0]=this.linkCount;
  const p=this.points,l=this.lightData,data=this.instanceData;
  for(let slot=0;slot<this.linkCount;slot++){
   const e=slot*6,base=slot*PLASMA_NODES*3,g=this.geometry,j=slot*10,ax=this.ends[e],ay=this.ends[e+1],az=this.ends[e+2],dx=g[j],dy=g[j+1],dz=g[j+2],ux=g[j+3],uy=g[j+4],uz=g[j+5],vx=g[j+6],vy=g[j+7],vz=g[j+8];
   const phase=this.time*PLASMA_MOTION_RATE+slot*2.399963,amplitude=g[j+9],alpha=.78+.06*Math.sin(phase*.7);
   const sa=Math.sin(phase),ca=Math.cos(phase),sb=Math.sin(phase*.63),cb=Math.cos(phase*.63),sc=Math.sin(phase*.81),cc=Math.cos(phase*.81);
   for(let node=0;node<=PLASMA_SEGMENTS;node++){
    const k=base+node*3,t=node/PLASMA_SEGMENTS,w=node*7,envelope=waves[w];
    const a=amplitude*envelope*(.74*(waves[w+1]*ca-waves[w+2]*sa)+.26*(waves[w+3]*cb+waves[w+4]*sb));
    const b=amplitude*envelope*.45*(waves[w+5]*cc+waves[w+6]*sc);
    p[k]=ax+dx*t+ux*a+vx*b;p[k+1]=ay+dy*t+uy*a+vy*b;p[k+2]=az+dz*t+uz*a+vz*b;
   }
   // Exactly anchored despite sin(pi) roundoff, also for vertical links.
   for(let axis=0;axis<3;axis++){p[base+axis]=this.ends[e+axis];p[base+PLASMA_SEGMENTS*3+axis]=this.ends[e+3+axis];}
   for(let segment=0;segment<PLASMA_SEGMENTS;segment++){
    const a=base+segment*3,b=a+3,k=this.instanceCount++*PLASMA_INSTANCE_FLOATS;
    data[k]=p[a];data[k+1]=p[a+1];data[k+2]=p[a+2];data[k+3]=PLASMA_WIDTH;
    data[k+4]=p[b];data[k+5]=p[b+1];data[k+6]=p[b+2];data[k+7]=alpha;
    data[k+8]=PLASMA_COLOR[0];data[k+9]=PLASMA_COLOR[1];data[k+10]=PLASMA_COLOR[2];data[k+11]=2;
   }
   const light=4+slot*PLASMA_LIGHT_FLOATS;
   l[light]=PLASMA_COLOR[0];l[light+1]=PLASMA_COLOR[1];l[light+2]=PLASMA_COLOR[2];l[light+3]=PLASMA_LIGHT_RADIUS;
   l[light+4]=PLASMA_LIGHT_STRENGTH;l[light+5]=PLASMA_LIGHT_SEGMENTS;l[light+6]=l[light+7]=0;
   for(let segment=0;segment<PLASMA_LIGHT_SEGMENTS;segment++){
    const a=base+segment*(PLASMA_SEGMENTS/PLASMA_LIGHT_SEGMENTS)*3,b=a+(PLASMA_SEGMENTS/PLASMA_LIGHT_SEGMENTS)*3,k=light+8+segment*8;
    l[k]=p[a];l[k+1]=p[a+1];l[k+2]=p[a+2];l[k+3]=1;l[k+4]=p[b];l[k+5]=p[b+1];l[k+6]=p[b+2];l[k+7]=1;
   }
   packTubeLightBounds(l,light);
  }
 }
 dispose(){this.time=0;this.requestedCount=this.overflow=this.linkCount=this.instanceCount=this.lightCount=0;this.ends.fill(0);this.geometry.fill(0);this.points.fill(0);this.instanceData.fill(0);this.lightData.fill(0);}
}
