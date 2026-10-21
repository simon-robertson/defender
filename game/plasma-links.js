import {BOX_SIZE} from '../shared/grid.js';

const EPSILON=1e-6;
const FIXED_PARTS={'turret-study':'base','arc-spire':'body','missile-launcher':'body'};

function fixedPart(rig,id){
 if(rig?.role!=='defence'||!rig.root)return null;
 const part=rig.parts?.find(p=>p.id===id&&p.parent===null);
 return part?.voxels.length?part:null;
}
function height(part){
 let low=Infinity,high=-Infinity;
 for(const cell of part.voxels){low=Math.min(low,cell[1]);high=Math.max(high,cell[1]+1);}
 return {low,high};
}
function centre(rig){
 const r=rig.root,h=BOX_SIZE/2;
 return [r[0]*h+r[8]*h+r[12],r[2]*h+r[10]*h+r[14]];
}

// Select an existing horizontal outward face, rather than a socket floating at
// the bounds of a tapered model. Within the preferred height/centre lane, the
// furthest solid cell is necessarily exposed toward the neighbouring box.
// World-space tie breaking keeps independent quarter-turns consistent.
function surface(rig,part,dx,dz,preferredY){
 const r=rig.root,c=centre(rig),axis=Math.abs(r[0]*dx+r[2]*dz)>.5?0:2;
 const sign=Math.round(axis===0?r[0]*dx+r[2]*dz:r[8]*dx+r[10]*dz);
 let best=null,bestY=Infinity,bestAcross=Infinity,bestOut=-Infinity,bestLane=Infinity;
 for(const cell of part.voxels){
  const x=r[0]*(cell[0]+.5)+r[8]*(cell[2]+.5)+r[12],y=cell[1]+.5+r[13],z=r[2]*(cell[0]+.5)+r[10]*(cell[2]+.5)+r[14];
  const dy=Math.abs(y-preferredY),across=Math.abs((x-c[0])*dz-(z-c[1])*dx),out=x*dx+z*dz,lane=dx?z:x;
  if(dy<bestY-EPSILON||Math.abs(dy-bestY)<EPSILON&&
   (across<bestAcross-EPSILON||Math.abs(across-bestAcross)<EPSILON&&
   (out>bestOut+EPSILON||Math.abs(out-bestOut)<EPSILON&&lane<bestLane))){
   best=cell;bestY=dy;bestAcross=across;bestOut=out;bestLane=lane;
  }
 }
 const x=best[0]+.5+(axis===0?sign*.5:0),z=best[2]+.5+(axis===2?sign*.5:0);
 return new Float64Array([r[0]*x+r[8]*z+r[12],best[1]+.5+r[13],r[2]*x+r[10]*z+r[14]]);
}

// Call once after the scene's enhancer topology is created. The returned records
// own only numeric snapshots: no rig/state references, animation updates, scene
// searches or per-frame allocations. The caller releases them on scene unload.
// Eligibility belongs to EnhancerPreview; this helper never discovers receivers.
export function createPlasmaLinks(world,enhancerStates){
 const links=[],seen=new Map();
 for(const state of enhancerStates){
  if(!state.active||state.model!=='power-generator')continue;
  const sourceRig=world.rigs.get(state.id);
  if(sourceRig?.model!==state.model||sourceRig.variant!==state.variant)continue;
  const sourcePart=fixedPart(sourceRig,'body');if(!sourcePart)continue;
  const a=centre(sourceRig),sourceBounds=height(sourcePart);
  // Upper shoulder rather than the broad lower plinth: the base's actual face
  // is 10.5 units above ground, leaving room for a short visible suspended link.
  const preferredY=sourceRig.root[13]+sourceBounds.low+(sourceBounds.high-sourceBounds.low)*.75;
  let recipients=seen.get(state.id);if(!recipients){recipients=new Set();seen.set(state.id,recipients);}
  for(const targetId of state.recipientIds){
   if(recipients.has(targetId))continue;
   const targetRig=world.rigs.get(targetId),partId=FIXED_PARTS[targetRig?.model];
   const targetPart=partId&&fixedPart(targetRig,partId);if(!targetPart)continue;
   const b=centre(targetRig),dx=b[0]-a[0],dz=b[1]-a[1];
   // Defensively reject stale/non-cardinal entries; dry support and strength
   // eligibility are already established by the supplied active state.
   if(Math.abs(targetRig.root[13]-sourceRig.root[13])>EPSILON||
    !((Math.abs(Math.abs(dx)-BOX_SIZE)<EPSILON&&Math.abs(dz)<EPSILON)||
      (Math.abs(Math.abs(dz)-BOX_SIZE)<EPSILON&&Math.abs(dx)<EPSILON)))continue;
   const nx=Math.round(dx/BOX_SIZE),nz=Math.round(dz/BOX_SIZE),source=surface(sourceRig,sourcePart,nx,nz,preferredY);
   const targetTop=targetRig.root[13]+height(targetPart).high;
   const target=surface(targetRig,targetPart,-nx,-nz,Math.min(source[1]+1,targetTop-1.5));
   links.push({source,target,sourceId:state.id,targetId});recipients.add(targetId);
  }
 }
 return links;
}
