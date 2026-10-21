import {BOX_SIZE} from '../../../shared/grid.js';
import {TerrainField,placementY} from '../../../shared/terrain.js';
import {BRIDGE_THICKNESS} from '../../../shared/bridges.js';

// Exact, disjoint occupied cuboids. These merges never fill an empty source
// cell, so a model's doorway or foliage gap remains a gap in the visibility tree.
// Construction may allocate; the resulting query path does not.
function occupiedCuboids(model,variant,parts=model.variants[variant].parts){
 const width=BOX_SIZE,layer=width*width,height=model.size[1],cells=new Uint8Array(layer*height),boxes=[];
 for(const part of parts)for(const [x,y,z]of part.voxels)cells[x+width*z+layer*y]=1;
 for(let y=0;y<height;y++)for(let z=0;z<width;z++)for(let x=0;x<width;x++){
  if(!cells[x+width*z+layer*y])continue;
  let endX=x+1;while(endX<width&&cells[endX+width*z+layer*y])endX++;
  let endZ=z+1;
  extendZ:for(;endZ<width;endZ++)for(let ix=x;ix<endX;ix++)if(!cells[ix+width*endZ+layer*y])break extendZ;
  let endY=y+1;
  extendY:for(;endY<height;endY++)for(let iz=z;iz<endZ;iz++)for(let ix=x;ix<endX;ix++)if(!cells[ix+width*iz+layer*endY])break extendY;
  for(let iy=y;iy<endY;iy++)for(let iz=z;iz<endZ;iz++)for(let ix=x;ix<endX;ix++)cells[ix+width*iz+layer*iy]=0;
  boxes.push([x,y,z,endX,endY,endZ]);
 }
 return boxes;
}

function segmentHitsBox(bounds,offset,ox,oy,oz,dx,dy,dz){
 let enter=0,exit=1;
 for(let axis=0;axis<3;axis++){
  const origin=axis===0?ox:axis===1?oy:oz,direction=axis===0?dx:axis===1?dy:dz,low=bounds[offset+axis],high=bounds[offset+axis+3];
  if(direction===0){if(origin<low||origin>high)return false;continue;}
  let near=(low-origin)/direction,far=(high-origin)/direction;
  if(near>far){const swap=near;near=far;far=swap;}
  if(near>enter)enter=near;if(far<exit)exit=far;
  if(enter>exit)return false;
 }
 return true;
}

// Static scenery/terrain tree plus separately queried live defence parts. Inputs pass the
// shared model/level validators. Quarter-turn placements preserve integer bounds
// exactly in Float32 storage; animated/arbitrarily rotated scenery needs a rebuild
// or an explicitly extended representation, not a silently enlarged model AABB.
export class SceneryVisibility {
 constructor(level,models){
  const field=new TerrainField(level),boxes=[],localCache=new Map();
  for(let z=0;z<level.size[1];z++)for(let x=0;x<level.size[0];x++){
   const height=field.height(x*BOX_SIZE,z*BOX_SIZE);
   if(height)boxes.push([x*BOX_SIZE,0,z*BOX_SIZE,(x+1)*BOX_SIZE,height,(z+1)*BOX_SIZE]);
  }
  for(const bridge of level.bridges??[])for(const [x,z]of bridge.boxes)boxes.push([x*BOX_SIZE,level.pathHeight-BRIDGE_THICKNESS,z*BOX_SIZE,(x+1)*BOX_SIZE,level.pathHeight,(z+1)*BOX_SIZE]);
  for(const placement of level.placements){
   const model=models.get(placement.model);
   // Runtime actors are not in placements; also exclude authored enemies and
   // every defence so the firing turret cannot obstruct its own muzzle rays.
   if(model.role==='defence'||model.role==='enemy')continue;
   const key=placement.model+':'+placement.variant;
   let local=localCache.get(key);if(!local){local=occupiedCuboids(model,placement.variant);localCache.set(key,local);}
   const baseX=placement.box[0]*BOX_SIZE+(placement.offset?.[0]??0),baseY=placementY(level,placement,field),baseZ=placement.box[2]*BOX_SIZE+(placement.offset?.[2]??0);
   for(const box of local){
    let minX=box[0],minZ=box[2],maxX=box[3],maxZ=box[5];
    for(let turn=0;turn<placement.turn;turn++){
     const nextMinX=BOX_SIZE-maxZ,nextMaxX=BOX_SIZE-minZ;minZ=minX;maxZ=maxX;minX=nextMinX;maxX=nextMaxX;
    }
    boxes.push([baseX+minX,baseY+box[1],baseZ+minZ,baseX+maxX,baseY+box[4],baseZ+maxZ]);
   }
  }
  this.primitiveCount=boxes.length;this.nodeCount=boxes.length?2*boxes.length-1:0;
  this.bounds=new Float32Array(this.nodeCount*6);this.escape=new Uint32Array(this.nodeCount);
  this.byteLength=this.bounds.byteLength+this.escape.byteLength;this.staticByteLength=this.byteLength;this.defenceBytes=0;
  const order=new Uint32Array(boxes.length);for(let i=0;i<order.length;i++)order[i]=i;
  let nextNode=0;
  const build=(start,end)=>{
   const node=nextNode++,offset=node*6,bounds=this.bounds;
   for(let axis=0;axis<3;axis++){bounds[offset+axis]=Infinity;bounds[offset+axis+3]=-Infinity;}
   for(let i=start;i<end;i++){
    const box=boxes[order[i]];
    for(let axis=0;axis<3;axis++){bounds[offset+axis]=Math.min(bounds[offset+axis],box[axis]);bounds[offset+axis+3]=Math.max(bounds[offset+axis+3],box[axis+3]);}
   }
   if(end-start>1){
    let axis=0;for(let i=1;i<3;i++)if(bounds[offset+i+3]-bounds[offset+i]>bounds[offset+axis+3]-bounds[offset+axis])axis=i;
    order.subarray(start,end).sort((a,b)=>(boxes[a][axis]+boxes[a][axis+3])-(boxes[b][axis]+boxes[b][axis+3]));
    const middle=(start+end)>>>1;build(start,middle);build(middle,end);
   }
   this.escape[node]=nextNode;
  };
  if(boxes.length)build(0,boxes.length);
  // No source arrays, terrain maps, temporary cuboids or build closures survive.
 }
 setDefences(level,models,rigs){
  this.defenceRevision=(this.defenceRevision??0)+1;this.defences=[];this.defenceBytes=0;const cache=new Map();
  for(const placement of level.placements){
   const model=models.get(placement.model),rig=rigs.get(placement.id);if(model?.role!=='defence'||!rig)continue;
   const parts=[];for(const part of model.variants[placement.variant].parts){
    const key=model.id+':'+placement.variant+':'+part.id;let boxes=cache.get(key);if(!boxes){boxes=new Float32Array(occupiedCuboids(model,placement.variant,[part]).flat());cache.set(key,boxes);this.defenceBytes+=boxes.byteLength;}
    const instance=rig.instances.find(instance=>instance.part===part.id);if(instance&&boxes.length){const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let k=0;k<boxes.length;k+=6)for(let a=0;a<3;a++){bounds[a]=Math.min(bounds[a],boxes[k+a]);bounds[a+3]=Math.max(bounds[a+3],boxes[k+a+3]);}
     const center=[0,1,2].map(a=>(bounds[a]+bounds[a+3])*.5),radiusSquared=[0,1,2].reduce((sum,a)=>sum+(bounds[a+3]-bounds[a])**2*.25,1e-5);parts.push({matrix:instance.matrix,boxes,center,radiusSquared});}
   }this.defences.push({id:placement.id,parts});
  }this.byteLength=this.staticByteLength+this.defenceBytes;
 }
 blockedDefences(ox,oy,oz,tx,ty,tz,ignoreId){
  for(const defence of this.defences??[]){if(defence.id===ignoreId)continue;
   for(const part of defence.parts){const m=part.matrix,p=part.center,cx=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],cy=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],cz=m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14];
    const vx=tx-ox,vy=ty-oy,vz=tz-oz,length=vx*vx+vy*vy+vz*vz,t=length?Math.max(0,Math.min(1,((cx-ox)*vx+(cy-oy)*vy+(cz-oz)*vz)/length)):0;
    if((ox+vx*t-cx)**2+(oy+vy*t-cy)**2+(oz+vz*t-cz)**2>part.radiusSquared)continue;
    const sx=ox-m[12],sy=oy-m[13],sz=oz-m[14],ex=tx-m[12],ey=ty-m[13],ez=tz-m[14];
    const x=m[0]*sx+m[1]*sy+m[2]*sz,y=m[4]*sx+m[5]*sy+m[6]*sz,z=m[8]*sx+m[9]*sy+m[10]*sz,dx=m[0]*ex+m[1]*ey+m[2]*ez-x,dy=m[4]*ex+m[5]*ey+m[6]*ez-y,dz=m[8]*ex+m[9]*ey+m[10]*ez-z;
    for(let k=0;k<part.boxes.length;k+=6)if(segmentHitsBox(part.boxes,k,x,y,z,dx,dy,dz))return true;
   }
  }return false;
 }
 // Sweep the missile's existing conservative body sphere against the same
 // live, posed occupied cuboids used by LOS. No model AABB fills real gaps.
 // Optional output: fraction, world contact XYZ, world outward normal XYZ.
 sweepDefences(ox,oy,oz,tx,ty,tz,radius,ignoreId,out){
  let first=Infinity;
  for(const defence of this.defences??[]){if(defence.id===ignoreId)continue;
   for(const part of defence.parts){
    const m=part.matrix,p=part.center,cx=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],cy=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],cz=m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14];
    const vx=tx-ox,vy=ty-oy,vz=tz-oz,length=vx*vx+vy*vy+vz*vz,t=length?Math.max(0,Math.min(first,1,((cx-ox)*vx+(cy-oy)*vy+(cz-oz)*vz)/length)):0;
    if((ox+vx*t-cx)**2+(oy+vy*t-cy)**2+(oz+vz*t-cz)**2>(Math.sqrt(part.radiusSquared)+radius)**2)continue;
    const sx=ox-m[12],sy=oy-m[13],sz=oz-m[14],x=m[0]*sx+m[1]*sy+m[2]*sz,y=m[4]*sx+m[5]*sy+m[6]*sz,z=m[8]*sx+m[9]*sy+m[10]*sz,dx=m[0]*vx+m[1]*vy+m[2]*vz,dy=m[4]*vx+m[5]*vy+m[6]*vz,dz=m[8]*vx+m[9]*vy+m[10]*vz,b=part.boxes;
    for(let k=0;k<b.length;k+=6){
     let enter=0,exit=Math.min(1,first),face=-1,sign=0;
     for(let axis=0;axis<3;axis++){
      const origin=axis===0?x:axis===1?y:z,d=axis===0?dx:axis===1?dy:dz;
      if(Math.abs(d)<1e-12){if(origin<b[k+axis]-radius||origin>b[k+axis+3]+radius){exit=-1;break;}continue;}
      let near=(b[k+axis]-radius-origin)/d,far=(b[k+axis+3]+radius-origin)/d,n=-1;
      if(near>far){const swap=near;near=far;far=swap;n=1;}
      if(near>=enter){enter=near;face=axis;sign=n;}exit=Math.min(exit,far);if(enter>exit)break;
     }
     if(enter>exit||enter>=first)continue;
     if(face<0){face=Math.abs(dx)>Math.abs(dy)?0:1;if(Math.abs(dz)>Math.abs(face===0?dx:dy))face=2;sign=(face===0?dx:face===1?dy:dz)>0?-1:1;}
     first=enter;if(!out)continue;
     let hx=Math.max(b[k],Math.min(b[k+3],x+dx*enter)),hy=Math.max(b[k+1],Math.min(b[k+4],y+dy*enter)),hz=Math.max(b[k+2],Math.min(b[k+5],z+dz*enter));
     const surface=b[k+face+(sign>0?3:0)];if(face===0)hx=surface;else if(face===1)hy=surface;else hz=surface;
     out[0]=enter;for(let a=0;a<3;a++){out[1+a]=m[a]*hx+m[4+a]*hy+m[8+a]*hz+m[12+a];out[4+a]=m[face*4+a]*sign;}
    }
   }
  }return first;
 }
 blocked(ox,oy,oz,tx,ty,tz,ignoreId){
  const bounds=this.bounds,escape=this.escape;
  if(!bounds||!Number.isFinite(ox)||!Number.isFinite(oy)||!Number.isFinite(oz)||!Number.isFinite(tx)||!Number.isFinite(ty)||!Number.isFinite(tz))return true;
  const dx=tx-ox,dy=ty-oy,dz=tz-oz;
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(dz))return true;
  let node=0;
  while(node<this.nodeCount){
   if(segmentHitsBox(bounds,node*6,ox,oy,oz,dx,dy,dz)){
    // Preorder leaves end immediately; branches continue into their first child.
    if(escape[node]===node+1)return true;
    node++;
   }else node=escape[node];
  }
  return this.blockedDefences(ox,oy,oz,tx,ty,tz,ignoreId);
 }
 clear(ox,oy,oz,tx,ty,tz,ignoreId){return !this.blocked(ox,oy,oz,tx,ty,tz,ignoreId);}
 dispose(){this.defences=null;this.bounds=null;this.escape=null;this.primitiveCount=this.nodeCount=this.byteLength=this.staticByteLength=this.defenceBytes=0;}
}
