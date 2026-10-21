// Swept conservative sphere over the existing exact static-scenery cuboids.
// Radius encloses a spinning cube. Output: fraction, normalXYZ, hit plane.
// No new BVH, temporary vectors or broad model boxes are constructed per query.
export function sweepScenery(visibility,ox,oy,oz,dx,dy,dz,radius,out){
 const bounds=visibility?.bounds,escape=visibility?.escape;
 if(!bounds)throw new Error('Debris requires active static visibility.');
 let node=0,best=1,hit=false;
 while(node<visibility.nodeCount){
  const offset=node*6;let enter=0,exit=best,axisHit=-1,sign=0,intersects=true;
  for(let axis=0;axis<3;axis++){
   const origin=axis===0?ox:axis===1?oy:oz,direction=axis===0?dx:axis===1?dy:dz,low=bounds[offset+axis]-radius,high=bounds[offset+axis+3]+radius;
   if(direction===0){if(origin<low||origin>high){intersects=false;break;}continue;}
   let near=(low-origin)/direction,far=(high-origin)/direction,n=-1;
   if(near>far){const swap=near;near=far;far=swap;n=1;}
   if(near>=enter){enter=near;axisHit=axis;sign=n;}if(far<exit)exit=far;
   if(enter>exit){intersects=false;break;}
  }
  if(!intersects){node=escape[node];continue;}
  if(escape[node]===node+1&&axisHit>=0&&enter<=best){
   best=enter;hit=true;out[0]=enter;out[1]=out[2]=out[3]=0;out[1+axisHit]=sign;out[4]=bounds[offset+axisHit+(sign>0?3:0)];out[5]=node;
  }
  node++;
 }
 return hit;
}

// A resting cube aligns flat to a real top face beneath its footprint, avoiding
// the hovering gap of the conservative flight sphere. Water is not solid.
export function debrisSupport(visibility,x,z,halfSize,ceiling){
 const bounds=visibility.bounds,escape=visibility.escape;let node=0,top=-Infinity;
 while(node<visibility.nodeCount){
  const k=node*6;
  if(x+halfSize<=bounds[k]||x-halfSize>=bounds[k+3]||z+halfSize<=bounds[k+2]||z-halfSize>=bounds[k+5]||bounds[k+4]<=top||bounds[k+1]>ceiling){node=escape[node];continue;}
  if(escape[node]===node+1&&bounds[k+4]<=ceiling+.001)top=bounds[k+4];
  node++;
 }
 return top;
}
