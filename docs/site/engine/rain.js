import {BOX_SIZE} from '../shared/grid.js';
import {TerrainField} from '../shared/terrain.js';

// Provisional visual tuning, not a hardware/frame-rate budget. Larger authored
// levels share this finite capacity; density decreases once the pool is full.
export const MAX_RAIN_DROPS=4096,RAIN_DROPS_PER_BOX=10,RAIN_INSTANCE_FLOATS=8;
export const RAIN_HEIGHT=72,RAIN_SPEED=120,RAIN_LENGTH=3.8,RAIN_WIDTH=.64,RAIN_OPACITY=.8;

// Exact upward column query over the static visibility BVH. Only construction
// calls this: falling drops then reuse the sampled roof/ground height forever.
export function staticRainTop(visibility,x,z){
 if(!visibility?.bounds||!Number.isFinite(x)||!Number.isFinite(z))throw new Error('Rain requires valid static scene visibility.');
 const bounds=visibility.bounds,escape=visibility.escape;let node=0,top=0;
 while(node<visibility.nodeCount){
  const offset=node*6;
  if(x<bounds[offset]||x>bounds[offset+3]||z<bounds[offset+2]||z>bounds[offset+5]||bounds[offset+4]<=top){node=escape[node];continue;}
  if(escape[node]===node+1){top=bounds[offset+4];node++;}else node++;
 }
 return top;
}

export class RainField {
 constructor(world){
  this.enabled=world.weather?.type==='rain'&&world.weather.enabled===true;this.phase=0;this.time=0;this.disposed=false;
  this.count=this.enabled?Math.min(MAX_RAIN_DROPS,world.level.size[0]*world.level.size[1]*RAIN_DROPS_PER_BOX):0;
  this.instanceData=new Float32Array(this.count*RAIN_INSTANCE_FLOATS);this.byteLength=this.instanceData.byteLength;
  if(!this.count)return;
  const field=new TerrainField(world.level),width=world.width??world.level.size[0]*BOX_SIZE,length=world.length??world.level.size[1]*BOX_SIZE;
  const columns=Math.min(this.count,Math.max(1,Math.ceil(Math.sqrt(this.count*width/length)))),rows=Math.ceil(this.count/columns);
  let seed=2166136261;for(let i=0;i<world.level.id.length;i++)seed=Math.imul(seed^world.level.id.charCodeAt(i),16777619)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<this.count;i++){
   // Query at the exact Float32 coordinates uploaded to the GPU, so rounding
   // cannot put a drop across a cell boundary from its sampled stopping height.
   const x=Math.fround((i%columns+.15+.7*random())*width/columns),z=Math.fround((Math.floor(i/columns)+.15+.7*random())*length/rows),offset=i*RAIN_INSTANCE_FLOATS;
   this.instanceData.set([x,z,Math.max(staticRainTop(world.visibility,x,z),field.height(x,z,true)),random()*RAIN_HEIGHT,RAIN_LENGTH,RAIN_WIDTH,width,length],offset);
  }
  // No world, model, visibility, height-map or random-generator reference is held.
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Rain delta seconds must be finite and non-negative.');
  if(!this.enabled||this.disposed)return;
  this.time+=deltaSeconds;
  // All columns share a speed/span, so wrapping distance is seamless in WGSL
  // and avoids loss of GPU float time precision during a long browser session.
  this.phase=(this.phase+(deltaSeconds%(RAIN_HEIGHT/RAIN_SPEED))*RAIN_SPEED)%RAIN_HEIGHT;
 }
 dispose(){this.enabled=false;this.disposed=true;this.instanceData=null;this.count=this.byteLength=this.phase=this.time=0;}
}
