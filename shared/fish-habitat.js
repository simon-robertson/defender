import {TerrainField} from './terrain.js';

export const FISH_MODEL='wildlife-fish',FISH_STEP=8,FISH_RADIUS=7,FISH_MIN_DEPTH=8;
export const hasFishWater=level=>level.terrain?.boxes.some(b=>b.water-b.ground>=FISH_MIN_DEPTH)??false;
function overlaps(b,k,x0,y0,z0,x1,y1,z1){return x0<b[k+3]&&x1>b[k]&&y0<b[k+4]&&y1>b[k+1]&&z0<b[k+5]&&z1>b[k+2];}
// Load-time certification includes the complete rotating fish and tail, bed,
// shoreline, bridges and submerged scenery. Edges use swept boxes, not endpoints.
export function fishHabitat(world){
 if(!hasFishWater(world.level))return null;
 const cols=world.level.size[0]*3,rows=world.level.size[1]*3,count=cols*rows,field=new TerrainField(world.level),surface=new Float32Array(count),links=new Int32Array(count*4).fill(-1),component=new Int32Array(count).fill(-1),waterSurface=new Float32Array(count),waterComponent=new Int32Array(count).fill(-1),queue=new Uint32Array(count),pools=[];
 const clear=(ax,az,bx,bz,h)=>{
  const x0=Math.min(ax,bx)-FISH_RADIUS,x1=Math.max(ax,bx)+FISH_RADIUS,z0=Math.min(az,bz)-FISH_RADIUS,z1=Math.max(az,bz)+FISH_RADIUS;
  if(x0<0||z0<0||x1>world.width||z1>world.length)return false;
  for(let z=Math.floor(z0/24);z<=Math.floor(z1/24);z++)for(let x=Math.floor(x0/24);x<=Math.floor(x1/24);x++){const box=field.box(x,z);if(!box||box.water!==h||h-box.ground<FISH_MIN_DEPTH)return false;}
  const tree=world.visibility;if(!tree)return false;
  for(let node=0;node<tree.nodeCount;){if(overlaps(tree.bounds,node*6,x0,h-6.3,z0,x1,h-1.7,z1)){if(tree.escape[node]===node+1)return false;node++;}else node=tree.escape[node];}
  return true;
 };
 for(let n=0;n<count;n++){const x=(n%cols+.5)*FISH_STEP,z=(Math.floor(n/cols)+.5)*FISH_STEP,h=field.height(x,z,true);waterSurface[n]=h;if(h&&clear(x,z,x,z,h))surface[n]=h;}
 // Water-body identity includes shallow edges and covered water: an impact
 // beside a bank can frighten fish in that pool, but not across a dry divider.
 let waterId=0;
 for(let n=0;n<count;n++)if(waterSurface[n]&&waterComponent[n]<0){let head=0,tail=1;queue[0]=n;waterComponent[n]=waterId;
  while(head<tail){const node=queue[head++],x=node%cols,z=Math.floor(node/cols);for(let d=0;d<4;d++){const nx=x+(d===0?1:d===1?-1:0),nz=z+(d===2?1:d===3?-1:0),next=nz*cols+nx;if(nx>=0&&nx<cols&&nz>=0&&nz<rows&&waterSurface[next]===waterSurface[node]&&waterComponent[next]<0){waterComponent[next]=waterId;queue[tail++]=next;}}}waterId++;
 }
 for(let n=0;n<count;n++)if(surface[n])for(let d=0;d<4;d++){const x=n%cols,z=Math.floor(n/cols),nx=x+(d===0?1:d===1?-1:0),nz=z+(d===2?1:d===3?-1:0),next=nz*cols+nx;if(nx>=0&&nx<cols&&nz>=0&&nz<rows&&surface[next]===surface[n]&&clear((x+.5)*FISH_STEP,(z+.5)*FISH_STEP,(nx+.5)*FISH_STEP,(nz+.5)*FISH_STEP,surface[n]))links[n*4+d]=next;}
 for(let n=0;n<count;n++)if(surface[n]&&component[n]<0){
  const id=pools.length;let head=0,tail=1,minX=cols,maxX=0,minZ=rows,maxZ=0;queue[0]=n;component[n]=id;
  while(head<tail){const node=queue[head++],x=node%cols,z=Math.floor(node/cols);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);for(let d=0;d<4;d++){const next=links[node*4+d];if(next>=0&&component[next]<0){component[next]=id;queue[tail++]=next;}}}
  pools.push({id,nodes:queue.slice(0,tail),surface:surface[n],usable:tail>=12&&(maxX-minX)*FISH_STEP>=24&&(maxZ-minZ)*FISH_STEP>=16});
 }
 const usable=pools.filter(p=>p.usable).sort((a,b)=>b.nodes.length-a.nodes.length).slice(0,4);
 if(!usable.length)return null;
 return {cols,rows,count,surface,links,component,waterSurface,waterComponent,pools:usable,bytes:waterSurface.byteLength+waterComponent.byteLength+surface.byteLength+links.byteLength+component.byteLength+usable.reduce((n,p)=>n+p.nodes.byteLength,0)};
}
