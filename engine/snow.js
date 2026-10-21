import {BOX_SIZE} from '../shared/grid.js';

// Snow is independent of accepted rain tuning. These are provisional visual
// settings, not a hardware target; large levels share one bounded particle pool.
export const MAX_SNOW_FLAKES=4096,SNOW_FLAKES_PER_BOX=28,SNOW_INSTANCE_FLOATS=12;
export const SNOW_FALL_SPEED=12,SNOW_DRIFT_X=0,SNOW_DRIFT_Z=0,SNOW_HEADROOM=48,SNOW_OPACITY=.76;
export const SNOW_MIN_DIAMETER=.6,SNOW_MAX_DIAMETER=1.2,SNOW_MIN_FLUTTER=.5,SNOW_MAX_FLUTTER=1.2;
export const SNOW_FLUTTER_CYCLES=8;
// Flutter keeps its accepted direction independently of net drift. Each seed's
// amplitude and phase vary, but every complete flutter period returns to its XZ.
const flutterAxisLength=Math.hypot(3,8);
export const SNOW_SIDE_X=-3/flutterAxisLength,SNOW_SIDE_Z=8/flutterAxisLength;
export const snowTriangle=phase=>1-4*Math.abs(phase-Math.floor(phase)-.5);

// Construction/test counterpart of the exact piecewise-linear GPU trajectory.
// Caller owns storage. No runtime particle updates or source-world references.
export function snowPosition(out,data,offset,age){
 const flutter=data[offset+6]*(snowTriangle(age/data[offset+11]+data[offset+7])-snowTriangle(data[offset+7]));
 out[0]=data[offset]+SNOW_DRIFT_X*age+SNOW_SIDE_X*flutter;
 out[1]=data[offset+1]-SNOW_FALL_SPEED*age;
 out[2]=data[offset+2]+SNOW_DRIFT_Z*age+SNOW_SIDE_Z*flutter;return out;
}

function boxEnter(bounds,at,ox,oy,oz,dx,dy,dz,radius,limit){
 let enter=0,exit=limit;
 for(let axis=0;axis<3;axis++){
  const origin=axis===0?ox:axis===1?oy:oz,delta=axis===0?dx:axis===1?dy:dz,low=bounds[at+axis]-radius,high=bounds[at+axis+3]+radius;
  if(delta===0){if(origin<low||origin>high)return Infinity;continue;}
  let near=(low-origin)/delta,far=(high-origin)/delta;if(near>far){const swap=near;near=far;far=swap;}
  enter=Math.max(enter,near);exit=Math.min(exit,far);if(enter>exit)return Infinity;
 }
 return enter;
}

function firstHit(visibility,water,ox,oy,oz,tx,ty,tz,radius){
 const dx=tx-ox,dy=ty-oy,dz=tz-oz,bounds=visibility.bounds,escape=visibility.escape;
 let node=0,best=Infinity;
 while(node<visibility.nodeCount){
  const hit=boxEnter(bounds,node*6,ox,oy,oz,dx,dy,dz,radius,Math.min(1,best));
  if(hit===Infinity){node=escape[node];continue;}
  if(escape[node]===node+1){best=hit;node++;}else node++;
 }
 for(let at=0;at<water.length;at+=6)best=Math.min(best,boxEnter(water,at,ox,oy,oz,dx,dy,dz,radius,Math.min(1,best)));
 return best;
}

export class SnowField {
 constructor(world){
  this.enabled=world.weather?.type==='snow'&&world.weather.enabled===true;this.phase=0;this.time=0;this.cycleSeconds=0;this.disposed=false;this.tracedSegments=0;
  this.count=this.enabled?Math.min(MAX_SNOW_FLAKES,world.level.size[0]*world.level.size[1]*SNOW_FLAKES_PER_BOX):0;
  this.instanceData=new Float32Array(this.count*SNOW_INSTANCE_FLOATS);this.byteLength=this.instanceData.byteLength;
  if(!this.count)return;
  const visibility=world.visibility;if(!visibility?.bounds)throw new Error('Snow requires static scene visibility.');
  const waterBoxes=world.level.terrain.boxes.filter(box=>box.water>0),water=new Float32Array(waterBoxes.length*6);
  let top=visibility.nodeCount?visibility.bounds[4]:0;
  for(let i=0;i<waterBoxes.length;i++){
   const box=waterBoxes[i],x=box.box[0]*BOX_SIZE,z=box.box[1]*BOX_SIZE;water.set([x,box.water,z,x+BOX_SIZE,box.water,z+BOX_SIZE],i*6);top=Math.max(top,box.water);
  }
  const width=world.width??world.level.size[0]*BOX_SIZE,length=world.length??world.level.size[1]*BOX_SIZE,spawnY=top+SNOW_HEADROOM;
  const cycle=this.cycleSeconds=Math.fround(spawnY/SNOW_FALL_SPEED),period=Math.fround(cycle/SNOW_FLUTTER_CYCLES);
  const radiusMax=SNOW_MAX_DIAMETER*.5,margin=SNOW_MAX_FLUTTER*2+radiusMax;
  // Symmetric padding covers bounded flutter at each level edge, with no
  // prevailing wind. The shader clips all visible fragments to level XZ.
  const minX=-margin,minZ=-margin,spanX=width+margin*2,spanZ=length+margin*2;
  const columns=Math.min(this.count,Math.max(1,Math.ceil(Math.sqrt(this.count*spanX/spanZ)))),rows=Math.ceil(this.count/columns);
  let seed=2166136261;const seedText='snow:'+world.level.id;for(let i=0;i<seedText.length;i++)seed=Math.imul(seed^seedText.charCodeAt(i),16777619)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const point=new Float64Array(3),rounded=new Float32Array(1),bits=new Uint32Array(rounded.buffer),data=this.instanceData;
  for(let i=0;i<this.count;i++){
   const at=i*SNOW_INSTANCE_FLOATS,x=minX+(i%columns+.1+.8*random())*spanX/columns,z=minZ+(Math.floor(i/columns)+.1+.8*random())*spanZ/rows;
   data.set([x,spawnY,z,random(),(SNOW_MIN_DIAMETER+(SNOW_MAX_DIAMETER-SNOW_MIN_DIAMETER)*random())*.5,cycle,SNOW_MIN_FLUTTER+(SNOW_MAX_FLUTTER-SNOW_MIN_FLUTTER)*random(),random(),width,length,cycle,period],at);
   let previousTime=0,px=data[at],py=data[at+1],pz=data[at+2],life=cycle;
   const initialPhase=data[at+7];let nextTurn=(Math.floor(initialPhase*2)+1)*.5;
   // Conservative radius encloses the soft circular flake at any billboard
   // orientation; a machine-precision guard covers float GPU evaluation.
   const radius=data[at+4]+8*2**-23*Math.max(1,width,length,spawnY,Math.abs(minX),Math.abs(minZ));
   for(let segment=0;segment<=SNOW_FLUTTER_CYCLES*2+1&&previousTime<cycle;segment++){
    const endTime=Math.min(cycle,(nextTurn-initialPhase)*period);snowPosition(point,data,at,endTime);
    const hit=firstHit(visibility,water,px,py,pz,point[0],point[1],point[2],radius);this.tracedSegments++;
    if(hit!==Infinity){life=previousTime+(endTime-previousTime)*hit;break;}
    previousTime=endTime;px=point[0];py=point[1];pz=point[2];nextTurn+=.5;
   }
   // Round lifetime down, never past the first intersection. Once expired, a
   // flake stays hidden until a new cycle; it cannot reappear under an overhang.
   rounded[0]=life;if(rounded[0]>life)bits[0]--;data[at+5]=rounded[0];
  }
  // Build scratch, visibility, water bounds and source world are not retained.
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Snow delta seconds must be finite and non-negative.');
  if(!this.enabled||this.disposed)return;this.time+=deltaSeconds;this.phase=(this.phase+deltaSeconds%this.cycleSeconds)%this.cycleSeconds;
 }
 dispose(){this.enabled=false;this.disposed=true;this.instanceData=null;this.count=this.byteLength=this.phase=this.time=this.cycleSeconds=this.tracedSegments=0;}
}
