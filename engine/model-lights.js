import {MAX_MODEL_LIGHTS,MAX_SUPPORTED_MODEL_LIGHTS,MODEL_LIGHT_RADIUS,MODEL_LIGHT_STRENGTH,MODEL_LIGHT_SURFACE_OFFSET} from '../shared/model-lights.js';

// Load-time only: connect matching exposed rectangles along an edge or area,
// never just at one corner. Emission without the opt-in mesh metadata is inert.
function connected(a,b){
 if(a.material!==b.material)return false;
 let positive=0;
 for(let axis=0;axis<3;axis++){
  const aEnd=a.origin[axis]+(axis===(a.axis+1)%3?a.width:axis===(a.axis+2)%3?a.height:0);
  const bEnd=b.origin[axis]+(axis===(b.axis+1)%3?b.width:axis===(b.axis+2)%3?b.height:0);
  const overlap=Math.min(aEnd,bEnd)-Math.max(a.origin[axis],b.origin[axis]);
  if(overlap<0)return false;if(overlap>0)positive++;
 }
 return positive>0;
}
function panelClusters(mesh){
 const indices=mesh.lightQuads;if(!indices?.length)return [];
 const parent=indices.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<indices.length;i++)for(let j=0;j<i;j++)if(connected(mesh.quads[indices[i]],mesh.quads[indices[j]]))parent[find(i)]=find(j);
 const clusters=new Map();
 for(let i=0;i<indices.length;i++){
  const root=find(i),qi=indices[i],q=mesh.quads[qi],area=q.width*q.height,u=(q.axis+1)%3,v=(q.axis+2)%3;
  let c=clusters.get(root);if(!c){const offset=qi*44;c={x:0,y:0,z:0,nx:0,ny:0,nz:0,area:0,red:mesh.vertices[offset+6],green:mesh.vertices[offset+7],blue:mesh.vertices[offset+8],strength:mesh.vertices[offset+9]*MODEL_LIGHT_STRENGTH};clusters.set(root,c);}
  c.x+=(q.origin[0]+(u===0?q.width:v===0?q.height:0)/2)*area;
  c.y+=(q.origin[1]+(u===1?q.width:v===1?q.height:0)/2)*area;
  c.z+=(q.origin[2]+(u===2?q.width:v===2?q.height:0)/2)*area;
  if(q.axis===0)c.nx+=q.sign*area;else if(q.axis===1)c.ny+=q.sign*area;else c.nz+=q.sign*area;c.area+=area;
 }
 for(const c of clusters.values()){
  const n=Math.hypot(c.nx,c.ny,c.nz),offset=n?MODEL_LIGHT_SURFACE_OFFSET/n:0;
  c.x=c.x/c.area+c.nx*offset;c.y=c.y/c.area+c.ny*offset;c.z=c.z/c.area+c.nz*offset;
 }
 return [...clusters.values()];
}

export class ModelLights {
 constructor(entries,drawMap,{capacity=MAX_MODEL_LIGHTS,strict=false}={}){
  if(!Number.isInteger(capacity)||capacity<1||capacity>MAX_SUPPORTED_MODEL_LIGHTS)throw new Error('Unsupported model-light capacity.');
  this.capacity=capacity;
  this.sources=[];this.keys=new Set();this.dirtyKeys=new Set();this.authoredCount=0;this.count=0;this.dirty=false;
  for(const entry of entries){
   if(!entry.mesh.lightQuads?.length)continue;
   const draw=drawMap.get(entry.key);if(!draw)continue;
   const membership=entry.lightIndices??entry.activeIndices,panels=panelClusters(entry.mesh);this.authoredCount+=panels.length*(membership?.length??entry.transforms.length);
   for(const index of membership??entry.transforms.keys())for(const panel of panels){
    if(this.sources.length===capacity)break;
    this.sources.push({draw,index,key:entry.key,px:0,py:0,pz:0,...panel});this.keys.add(entry.key);this.dirtyKeys.add(entry.key);
   }
  }
  this.overflow=this.authoredCount-this.sources.length;
  if(this.overflow){const message=`Model light capacity exceeded: ${this.authoredCount} authored clusters, ${capacity} active; ${this.overflow} unlit. Split the scene or revise its light budget.`;if(strict)throw new Error(message);console.warn(message);}
  this.data=this.sources.length?new Float32Array(4+capacity*8):null;
  this.byteLength=this.data?.byteLength??0;this.dirty=!!this.sources.length;
 }
 invalidate(key){if(this.keys.has(key)){this.dirty=true;this.dirtyKeys.add(key);}}
 prepare(){
  if(!this.dirty)return false;
  this.dirty=false;let changed=false,count=0;const data=this.data;
  for(let i=0;i<this.sources.length;i++){
   const source=this.sources[i],draw=source.draw,index=source.index;
   if(draw.indexToSlot&&draw.indexToSlot[index]<0)continue;
   const k=4+count*8;
   // Match the GPU's float precision before comparing, avoiding spurious
   // uploads when an unchanged pose was submitted again by an animator.
   // A moving actor need not transform every static emitter in the scene.
   // Cache source positions independently of their compacted output slots.
   if(this.dirtyKeys.has(source.key)){
    const m=draw.transforms,p=index*16,x=source.x,y=source.y,z=source.z;
    source.px=Math.fround(m[p]*x+m[p+4]*y+m[p+8]*z+m[p+12]);source.py=Math.fround(m[p+1]*x+m[p+5]*y+m[p+9]*z+m[p+13]);source.pz=Math.fround(m[p+2]*x+m[p+6]*y+m[p+10]*z+m[p+14]);
   }
   const px=source.px,py=source.py,pz=source.pz;
   if(data[k]!==px||data[k+1]!==py||data[k+2]!==pz||data[k+3]!==MODEL_LIGHT_RADIUS||data[k+4]!==source.red||data[k+5]!==source.green||data[k+6]!==source.blue||data[k+7]!==Math.fround(source.strength))changed=true;
   data[k]=px;data[k+1]=py;data[k+2]=pz;data[k+3]=MODEL_LIGHT_RADIUS;data[k+4]=source.red;data[k+5]=source.green;data[k+6]=source.blue;data[k+7]=source.strength;count++;
  }
  this.dirtyKeys.clear();if(this.count!==count)changed=true;this.count=count;data[0]=count;return changed;
 }
 dispose(){this.sources.length=0;this.keys.clear();this.dirtyKeys.clear();this.data=null;this.count=this.authoredCount=this.overflow=this.byteLength=0;this.dirty=false;}
}
