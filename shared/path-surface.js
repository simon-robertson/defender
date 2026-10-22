import {BOX_SIZE} from './grid.js';

// Matte soil and stone shoulders use separate appended material slots.
export const PATH_SHOULDER_MAX_WIDTH=4;
export const PATH_SHOULDER_MATERIALS=Object.freeze(['#76583F','#876A50','#654B37','#929292','#737373'].map(color=>Object.freeze({color,emission:0,reflectiveness:0})));

function hash(index,salt){let n=Math.imul(index^salt,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}

// Broad flagstones share a world-space partition across route boxes. Sparse
// three-unit steps create simple L/stepped edges without fine sawtooth noise.
// This is load-time geometry only; nothing is evaluated in a shader or frame.
function courseBoundary(row,x){
 const run=hash(row,0x735a)<.5?18:24,offset=Math.floor(hash(row,0x29e1)*run);
 return row*14+(hash(Math.floor((x+offset)/run),row^0x51b3)<.5?0:3);
}
function slabBoundary(row,column,offset){return column*14+offset+Math.floor(hash(column,row^0x6c21)*5)-2;}
function slabId(x,z){
 let row=Math.floor(z/14);
 while(z<courseBoundary(row,x))row--;
 while(z>=courseBoundary(row+1,x))row++;
 const offset=Math.floor(hash(row,0x47af)*14);let column=Math.floor((x-offset)/14);
 while(x<slabBoundary(row,column,offset))column--;
 while(x>=slabBoundary(row,column+1,offset))column++;
 // The validated 128-box level limit keeps both coordinates well within this
 // collision-free packing range, including the one-cell world-edge halo.
 return row*65536+column+32768;
}
function slabMaterials(x,z){
 const stride=BOX_SIZE+1,ids=new Int32Array(stride*stride),materials=new Uint8Array(BOX_SIZE*BOX_SIZE);
 for(let iz=0;iz<stride;iz++)for(let ix=0;ix<stride;ix++)ids[iz*stride+ix]=slabId(x+ix+.5,z+iz+.5);
 for(let iz=0;iz<BOX_SIZE;iz++)for(let ix=0;ix<BOX_SIZE;ix++){
  const k=iz*stride+ix,id=ids[k],shade=hash(id,0x739d);
  // A single cell on the east/south side owns each joint: full coverage, no
  // duplicate coplanar face, and no seam introduced just by a box boundary.
  materials[iz*BOX_SIZE+ix]=id!==ids[k+1]||id!==ids[k+stride]?9:shade<.6?6:shade<.85?7:8;
 }
 return materials;
}
// Two unequal runs per 20 units give coherent 6–14-unit contours, independent
// of chunk boundaries. Occasional zero-width runs leave real ground breaks.
function shoulderWidth(along,plane,axis){
 const salt=Math.imul(plane+19,15731)^Math.imul(axis+1,789221);
 const shifted=along+Math.floor(hash(0,salt)*20),span=Math.floor(shifted/20),split=6+Math.floor(hash(span,salt)*9);
 const run=span*2+(shifted-span*20>=split?1:0),value=hash(run,salt^0x61a7);
 return value<.07?0:value<.30?1:value<.72?2:value<.96?3:PATH_SHOULDER_MAX_WIDTH;
}
function shoulderMaterial(x,z){
 // Sparse 2–4-unit chips occupy about one sixth of the shoulder, in small
 // groups rather than individual-cell noise. Everything is a flat material.
 const tx=Math.floor(x/6),tz=Math.floor(z/6),salt=Math.imul(tz+43,0x735a);
 if(hash(tx,salt)<.8){
  const w=2+Math.floor(hash(tx,salt^0x21af)*3),d=2+Math.floor(hash(tx,salt^0x47af)*3);
  const ox=Math.floor(hash(tx,salt^0x56bd)*(7-w)),oz=Math.floor(hash(tx,salt^0x39e1)*(7-d));
  if(x-tx*6>=ox&&x-tx*6<ox+w&&z-tz*6>=oz&&z-tz*6<oz+d)return 3+Math.floor(hash(tx,salt^0x73ac)*2);
 }
 const shade=hash(Math.floor(x/12),Math.floor(z/12)^0x819b);
 return shade<.6?0:shade<.85?1:2;
}

// Replace a dry, non-route box's complete top, never overlay a shoulder on it.
// The caller checks terrain height/water; null keeps distant tops as one quad.
// The explicit material offset must follow the caller's base palette.
// Optional scratch belongs to one terrain build and is reused across boxes.
export function pathShoulderQuads(route,bx,bz,y,ground,materialStart,cells=new Int8Array(BOX_SIZE*BOX_SIZE)){
 if(!Number.isInteger(materialStart)||materialStart<16||materialStart+PATH_SHOULDER_MATERIALS.length>128)throw new Error('Path shoulders require an explicit appended material offset.');
 if(route.has(bx+','+bz))return null;
 const west=route.has((bx-1)+','+bz),east=route.has((bx+1)+','+bz),north=route.has(bx+','+(bz-1)),south=route.has(bx+','+(bz+1));
 const nw=!west&&!north&&route.has((bx-1)+','+(bz-1)),ne=!east&&!north&&route.has((bx+1)+','+(bz-1));
 const sw=!west&&!south&&route.has((bx-1)+','+(bz+1)),se=!east&&!south&&route.has((bx+1)+','+(bz+1));
 if(!west&&!east&&!north&&!south&&!nw&&!ne&&!sw&&!se)return null;
 const x=bx*BOX_SIZE,z=bz*BOX_SIZE,quads=[];
 // Round exposed convex corners on the same unit grid. Union with side strips
 // in this single mask so bends and nearby path runs cannot overlap faces.
 const cornerWidth=(cx,cz)=>Math.max(shoulderWidth(cz,cx,0),shoulderWidth(cx,cz,1));
 const rnw=nw?cornerWidth(x,z)**2:0,rne=ne?cornerWidth(x+BOX_SIZE,z)**2:0;
 const rsw=sw?cornerWidth(x,z+BOX_SIZE)**2:0,rse=se?cornerWidth(x+BOX_SIZE,z+BOX_SIZE)**2:0;
 cells.fill(ground);
 for(let iz=0;iz<BOX_SIZE;iz++)for(let ix=0;ix<BOX_SIZE;ix++){
  const px=ix+.5,pz=iz+.5,ex=BOX_SIZE-px,sz=BOX_SIZE-pz;
  if(px>=PATH_SHOULDER_MAX_WIDTH&&ex>=PATH_SHOULDER_MAX_WIDTH&&pz>=PATH_SHOULDER_MAX_WIDTH&&sz>=PATH_SHOULDER_MAX_WIDTH)continue;
  const shoulder=(west&&px<shoulderWidth(z+pz,x,0))||(east&&ex<shoulderWidth(z+pz,x+BOX_SIZE,0))||
   (north&&pz<shoulderWidth(x+px,z,1))||(south&&sz<shoulderWidth(x+px,z+BOX_SIZE,1))||
   (nw&&px*px+pz*pz<rnw)||(ne&&ex*ex+pz*pz<rne)||(sw&&px*px+sz*sz<rsw)||(se&&ex*ex+sz*sz<rse);
  if(shoulder)cells[iz*BOX_SIZE+ix]=materialStart+shoulderMaterial(x+ix,z+iz);
 }
 for(let iz=0;iz<BOX_SIZE;iz++)for(let ix=0;ix<BOX_SIZE;ix++){
  const material=cells[iz*BOX_SIZE+ix];if(material<0)continue;
  let dx=1,dz=1;while(ix+dx<BOX_SIZE&&cells[iz*BOX_SIZE+ix+dx]===material)dx++;
  rows:while(iz+dz<BOX_SIZE){for(let k=0;k<dx;k++)if(cells[(iz+dz)*BOX_SIZE+ix+k]!==material)break rows;dz++;}
  for(let j=0;j<dz;j++)cells.fill(-1,(iz+j)*BOX_SIZE+ix,(iz+j)*BOX_SIZE+ix+dx);
  quads.push({origin:[x+ix,y,z+iz],axis:1,sign:1,width:dz,height:dx,material});
 }
 return quads;
}

// Partition dry flagstones once on load; merge equal cells without overlays.
export function pathSurfaceQuads(bx,bz,y){
 const x=bx*BOX_SIZE,z=bz*BOX_SIZE,quads=[],cells=slabMaterials(x,z);
 for(let iz=0;iz<BOX_SIZE;iz++)for(let ix=0;ix<BOX_SIZE;ix++){
  const material=cells[iz*BOX_SIZE+ix];if(!material)continue;
  let dx=1,dz=1;while(ix+dx<BOX_SIZE&&cells[iz*BOX_SIZE+ix+dx]===material)dx++;
  rows:while(iz+dz<BOX_SIZE){for(let k=0;k<dx;k++)if(cells[(iz+dz)*BOX_SIZE+ix+k]!==material)break rows;dz++;}
  for(let j=0;j<dz;j++)cells.fill(0,(iz+j)*BOX_SIZE+ix,(iz+j)*BOX_SIZE+ix+dx);
  quads.push({origin:[x+ix,y,z+iz],axis:1,sign:1,width:dz,height:dx,material});
 }
 return quads;
}
