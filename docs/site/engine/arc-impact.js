// Select an exposed point on the animated enemy side facing the spire. Geometry
// comes from the rendered quads; matrices are the current submitted rigid poses.
// All records/scratch are scene-owned. Only actual ready pulses do this work.
export const ARC_CONTACT_ATTEMPTS=16;
function partBounds(quads){
 const bounds=new Float64Array([Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);
 for(const q of quads)for(let a=0;a<3;a++){const high=q.origin[a]+(a===(q.axis+1)%3?q.width:a===(q.axis+2)%3?q.height:0);bounds[a]=Math.min(bounds[a],q.origin[a]-1e-6);bounds[a+3]=Math.max(bounds[a+3],high+1e-6);}
 return bounds;
}
function intersectsPart(bounds,ox,oy,oz,dx,dy,dz){
 let enter=0,exit=1;
 for(let a=0;a<3;a++){
  const origin=a===0?ox:a===1?oy:oz,d=a===0?dx:a===1?dy:dz;
  if(d===0){if(origin<bounds[a]||origin>bounds[a+3])return false;continue;}
  let near=(bounds[a]-origin)/d,far=(bounds[a+3]-origin)/d;if(near>far){const swap=near;near=far;far=swap;}
  enter=Math.max(enter,near);exit=Math.min(exit,far);if(enter>exit)return false;
 }return true;
}
export class ArcImpactSampler {
 constructor(world,targets,random=Math.random){
  this.random=random;this.records=new Map();this.point=new Float64Array(3);this.normal=new Float64Array(3);this.localPoint=new Float64Array(3);this.matrix=null;this.partId=null;this.attempts=0;
  const entries=new Map(world.entries.map(entry=>[entry.key,entry.mesh.quads])),shapes=new Map();let capacity=0,boundsBytes=0;
  for(const target of targets){
   const data=world.actors.get(target.id);if(!data)throw new Error('Arc contact requires an enemy actor.');
   const key=data.model+':'+data.variant;
   let shape=shapes.get(key);
   if(!shape){
    const parts=data.instances.map(instance=>{const quads=entries.get(instance.key),bounds=partBounds(quads);boundsBytes+=bounds.byteLength;return {id:instance.part,quads,bounds};}),faces=[];
    for(let part=0;part<parts.length;part++)for(const quad of parts[part].quads)if(quad.axis!==1)faces.push({part,quad});
    shape={parts,faces};shapes.set(key,shape);capacity=Math.max(capacity,faces.length);
   }
   this.records.set(target,{shape,matrices:shape.parts.map(part=>data.instances.find(instance=>instance.part===part.id).matrix)});
  }
  this.weights=new Float64Array(capacity);this.byteLength=boundsBytes+this.weights.byteLength+this.point.byteLength+this.normal.byteLength+this.localPoint.byteLength;
 }
 // Test exact rendered surfaces in each rigid part's local space. The selected
 // endpoint itself is allowed; any earlier surface means that point is hidden.
 selfClear(record,source){
  const end=this.point;
  for(let part=0;part<record.shape.parts.length;part++){
   const m=record.matrices[part],sx=source[0]-m[12],sy=source[1]-m[13],sz=source[2]-m[14],tx=end[0]-m[12],ty=end[1]-m[13],tz=end[2]-m[14];
   // Rigid rotations have inverse transpose; no inverse matrix allocation.
   const ox=m[0]*sx+m[1]*sy+m[2]*sz,oy=m[4]*sx+m[5]*sy+m[6]*sz,oz=m[8]*sx+m[9]*sy+m[10]*sz;
   const dx=m[0]*tx+m[1]*ty+m[2]*tz-ox,dy=m[4]*tx+m[5]*ty+m[6]*tz-oy,dz=m[8]*tx+m[9]*ty+m[10]*tz-oz;
   // Reject whole parts before visiting their exact faces. Padding matches the
   // face-edge tolerance below; candidate order and random sampling stay intact.
   if(!intersectsPart(record.shape.parts[part].bounds,ox,oy,oz,dx,dy,dz))continue;
   for(const q of record.shape.parts[part].quads){
    const axis=q.axis,origin=axis===0?ox:axis===1?oy:oz,direction=axis===0?dx:axis===1?dy:dz;
    if(Math.abs(direction)<1e-10)continue;
    const t=(q.origin[axis]-origin)/direction;if(t<=1e-6||t>=1-1e-5)continue;
    const u=(axis+1)%3,v=(axis+2)%3,pu=u===0?ox+dx*t:u===1?oy+dy*t:oz+dz*t,pv=v===0?ox+dx*t:v===1?oy+dy*t:oz+dz*t;
    if(pu>=q.origin[u]-1e-6&&pu<=q.origin[u]+q.width+1e-6&&pv>=q.origin[v]-1e-6&&pv<=q.origin[v]+q.height+1e-6)return false;
   }
  }
  return true;
 }
 sample(target,source,visibility,ignoreId,allowDead=false){
  this.matrix=null;this.partId=null;this.attempts=0;
  const record=this.records.get(target);if(!record||(!allowDead&&target.health?.alive===false)||!visibility||!source.every(Number.isFinite))return false;
  const faces=record.shape.faces,weights=this.weights;let total=0;
  for(let i=0;i<faces.length;i++){
   const face=faces[i],q=face.quad,m=record.matrices[face.part],axis=q.axis,u=(axis+1)%3,v=(axis+2)%3;
   let x=q.origin[0],y=q.origin[1],z=q.origin[2];
   if(u===0)x+=q.width/2;else if(u===1)y+=q.width/2;else z+=q.width/2;
   if(v===0)x+=q.height/2;else if(v===1)y+=q.height/2;else z+=q.height/2;
   const px=m[0]*x+m[4]*y+m[8]*z+m[12],py=m[1]*x+m[5]*y+m[9]*z+m[13],pz=m[2]*x+m[6]*y+m[10]*z+m[14];
   const nx=m[axis*4]*q.sign,ny=m[axis*4+1]*q.sign,nz=m[axis*4+2]*q.sign,dx=source[0]-px,dy=source[1]-py,dz=source[2]-pz;
   // Reject roofs/undersides, including leg faces rotated nearly horizontal.
   const facing=nx*dx+ny*dy+nz*dz,side=nx*(source[0]-target.x)+nz*(source[2]-target.z);
   if(Math.abs(ny)<.6&&side>1e-6&&facing>1e-6)total+=q.width*q.height*facing/Math.hypot(dx,dy,dz);
   weights[i]=total;
  }
  if(!(total>0))return false;
  for(let attempt=0;attempt<ARC_CONTACT_ATTEMPTS;attempt++){
   this.attempts++;
   const choice=Math.min(1-Number.EPSILON,Math.max(0,this.random()))*total;let lo=0,hi=faces.length-1;
   while(lo<hi){const mid=(lo+hi)>>>1;if(weights[mid]>choice)hi=mid;else lo=mid+1;}
   const face=faces[lo],q=face.quad,m=record.matrices[face.part],axis=q.axis,u=(axis+1)%3,v=(axis+2)%3,p=this.localPoint;
   p.set(q.origin);p[u]+=(.001+.998*this.random())*q.width;p[v]+=(.001+.998*this.random())*q.height;
   for(let a=0;a<3;a++){this.point[a]=m[a]*p[0]+m[4+a]*p[1]+m[8+a]*p[2]+m[12+a];this.normal[a]=m[axis*4+a]*q.sign;}
   if(!this.selfClear(record,source)||!visibility.clear(source[0],source[1],source[2],this.point[0],this.point[1],this.point[2],ignoreId))continue;
   this.matrix=m;this.partId=record.shape.parts[face.part].id;return true;
  }
  return false;
 }
 dispose(){this.records.clear();this.matrix=null;this.partId=null;this.weights=null;this.byteLength=0;}
}
