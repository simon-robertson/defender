import {BOX_SIZE} from '../shared/grid.js';
import {MAX_LEAVES,LEAVES_PER_BOX,LEAF_INSTANCE_FLOATS,LEAF_FALL_SPEED,LEAF_HEADROOM,LEAF_MIN_LENGTH,LEAF_MAX_LENGTH,LEAF_WIDTH_RATIO,LEAF_MIN_SWAY,LEAF_MAX_SWAY,LEAF_SWAY_CYCLES,LEAF_SPIN_RATE,LEAF_TUMBLE_RATE,leafColorIndex} from '../shared/leaf-effects.js';

export const leafTriangle=phase=>1-4*Math.abs(phase-Math.floor(phase)-.5);
// Exact construction/test counterpart of the shader. The caller owns storage.
export function leafPosition(out,data,offset,age){
 const sway=data[offset+6]*(leafTriangle(age/data[offset+11]+data[offset+7])-leafTriangle(data[offset+7]));
 out[0]=data[offset]+data[offset+12]*sway;out[1]=data[offset+1]-LEAF_FALL_SPEED*age;out[2]=data[offset+2]+data[offset+13]*sway;return out;
}
export function leafAxes(out,data,offset,age){
 const yaw=data[offset+15]*Math.PI*2+age*LEAF_SPIN_RATE,tilt=data[offset+7]*Math.PI*2+age*LEAF_TUMBLE_RATE,c=Math.cos(yaw),s=Math.sin(yaw),t=Math.sin(tilt);
 out[0]=c;out[1]=0;out[2]=-s;out[3]=s*t;out[4]=Math.cos(tilt);out[5]=c*t;return out;
}

function boxEnter(bounds,at,ox,oy,oz,dx,dy,dz,radius,limit){
 let enter=0,exit=limit;
 for(let axis=0;axis<3;axis++){
  const origin=axis===0?ox:axis===1?oy:oz,delta=axis===0?dx:axis===1?dy:dz,low=bounds[at+axis]-radius,high=bounds[at+axis+3]+radius;
  if(delta===0){if(origin<low||origin>high)return Infinity;continue;}
  let near=(low-origin)/delta,far=(high-origin)/delta;if(near>far){const swap=near;near=far;far=swap;}
  enter=Math.max(enter,near);exit=Math.min(exit,far);if(enter>exit)return Infinity;
 }return enter;
}
function firstHit(visibility,water,ox,oy,oz,tx,ty,tz,radius){
 const dx=tx-ox,dy=ty-oy,dz=tz-oz,bounds=visibility.bounds,escape=visibility.escape;let node=0,best=Infinity;
 while(node<visibility.nodeCount){
  const hit=boxEnter(bounds,node*6,ox,oy,oz,dx,dy,dz,radius,Math.min(1,best));
  if(hit===Infinity){node=escape[node];continue;}
  if(escape[node]===node+1)best=hit;node++;
 }
 for(let at=0;at<water.length;at+=6)best=Math.min(best,boxEnter(water,at,ox,oy,oz,dx,dy,dz,radius,Math.min(1,best)));
 return best;
}

export class LeafField {
 constructor(world){
  this.enabled=world.weather?.type==='leaves'&&world.weather.enabled===true;this.phase=0;this.time=0;this.cycleSeconds=0;this.disposed=false;this.tracedSegments=0;
  this.count=this.enabled?Math.min(MAX_LEAVES,world.level.size[0]*world.level.size[1]*LEAVES_PER_BOX):0;
  this.instanceData=new Float32Array(this.count*LEAF_INSTANCE_FLOATS);this.byteLength=this.instanceData.byteLength;if(!this.count)return;
  const visibility=world.visibility;if(!visibility?.bounds)throw new Error('Leaves require static scene visibility.');
  const waterBoxes=world.level.terrain.boxes.filter(box=>box.water>0),water=new Float32Array(waterBoxes.length*6);let top=visibility.nodeCount?visibility.bounds[4]:0;
  for(let i=0;i<waterBoxes.length;i++){
   const box=waterBoxes[i],x=box.box[0]*BOX_SIZE,z=box.box[1]*BOX_SIZE;water.set([x,box.water,z,x+BOX_SIZE,box.water,z+BOX_SIZE],i*6);top=Math.max(top,box.water);
  }
  const width=world.width??world.level.size[0]*BOX_SIZE,length=world.length??world.level.size[1]*BOX_SIZE,spawnY=top+LEAF_HEADROOM;
  const cycle=this.cycleSeconds=Math.fround(spawnY/LEAF_FALL_SPEED),period=Math.fround(cycle/LEAF_SWAY_CYCLES),cornerRadius=Math.hypot(LEAF_WIDTH_RATIO,1);
  const margin=LEAF_MAX_SWAY*2+LEAF_MAX_LENGTH*.5*cornerRadius,minX=-margin,minZ=-margin,spanX=width+margin*2,spanZ=length+margin*2;
  const columns=Math.min(this.count,Math.max(1,Math.ceil(Math.sqrt(this.count*spanX/spanZ)))),rows=Math.ceil(this.count/columns);
  let seed=2166136261;for(const char of 'leaves:'+world.level.id)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const point=new Float64Array(3),rounded=new Float32Array(1),bits=new Uint32Array(rounded.buffer),data=this.instanceData;
  for(let i=0;i<this.count;i++){
   const at=i*LEAF_INSTANCE_FLOATS,x=minX+(i%columns+.1+.8*random())*spanX/columns,z=minZ+(Math.floor(i/columns)+.1+.8*random())*spanZ/rows,axis=random()*Math.PI*2;
   data.set([x,spawnY,z,random(),(LEAF_MIN_LENGTH+(LEAF_MAX_LENGTH-LEAF_MIN_LENGTH)*random())*.5,cycle,LEAF_MIN_SWAY+(LEAF_MAX_SWAY-LEAF_MIN_SWAY)*random(),random(),width,length,cycle,period,Math.cos(axis),Math.sin(axis),leafColorIndex(random()),random()],at);
   let previousTime=0,px=data[at],py=data[at+1],pz=data[at+2],life=cycle;const initialPhase=data[at+7];let nextTurn=(Math.floor(initialPhase*2)+1)*.5;
   // The whole tumbling quad fits inside this sphere, including mask edges.
   // Expand exact occupied bounds, not the full scenery-model bounding box.
   const radius=data[at+4]*cornerRadius+8*2**-23*Math.max(1,width,length,spawnY,Math.abs(minX));
   for(let segment=0;segment<=LEAF_SWAY_CYCLES*2+1&&previousTime<cycle;segment++){
    const endTime=Math.min(cycle,(nextTurn-initialPhase)*period);leafPosition(point,data,at,endTime);
    const hit=firstHit(visibility,water,px,py,pz,point[0],point[1],point[2],radius);this.tracedSegments++;
    if(hit!==Infinity){life=previousTime+(endTime-previousTime)*hit;break;}
    previousTime=endTime;px=point[0];py=point[1];pz=point[2];nextTurn+=.5;
   }
   // First contact ends the flight for its entire cycle; never resume below a
   // roof. The separate flat path litter is an authored surface treatment.
   rounded[0]=life;if(rounded[0]>life)bits[0]--;data[at+5]=rounded[0];
  }
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Leaf delta seconds must be finite and non-negative.');
  if(!this.enabled||this.disposed)return;this.time+=deltaSeconds;this.phase=(this.phase+deltaSeconds%this.cycleSeconds)%this.cycleSeconds;
 }
 dispose(){this.enabled=false;this.disposed=true;this.instanceData=null;this.count=this.byteLength=this.phase=this.time=this.cycleSeconds=this.tracedSegments=0;}
}
