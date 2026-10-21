// Conservative swept weapon clearance for independent hypothetical sites.
// Candidate probes share a world only to reuse static geometry. No clearance
// between neighbouring probes is claimed, and none are saved to the level.
import {auditModels,auditRouteGeometry} from './level-layout-audit.js';
import {A1_OPTIONS} from './a1-path-carving-options.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {TURRET_PITCH,TURRET_RECOIL} from '../shared/arsenal.js';

function vertices(part){const points=new Map();for(const c of part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){const p=[c[0]+dx,c[1]+dy,c[2]+dz];points.set(p.join(','),p);}return [...points.values()];}
function box(points,m){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const [x,y,z]of points)for(let a=0;a<3;a++){const p=m[a]*x+m[a+4]*y+m[a+8]*z+m[a+12];b[a]=Math.min(b[a],p);b[a+3]=Math.max(b[a+3],p);}return b;}
function envelope(data,part){
 const points=vertices(part),b=box(points,data.root),round=data.model==='turret-study'&&part.id!=='base';let radius=0;
 if(round){
  let bottom=Infinity,top=-Infinity;
  for(const [x,y,z]of points)for(const recoil of part.id==='guns'?[0,TURRET_RECOIL.distance]:[0]){
   if(part.id==='head'){radius=Math.max(radius,Math.hypot(x-12,z-12));bottom=Math.min(bottom,y);top=Math.max(top,y);continue;}
   const g=part.pivot,dy=y-g[1],dz=z-g[2]+recoil,angles=[TURRET_PITCH.min,TURRET_PITCH.max];
   for(const critical of [Math.atan2(-dz,dy),Math.atan2(dy,dz)])for(let k=-2;k<=2;k++){const angle=critical+k*Math.PI;if(angle>=TURRET_PITCH.min&&angle<=TURRET_PITCH.max)angles.push(angle);}
   for(const angle of angles){const py=g[1]+Math.cos(angle)*dy-Math.sin(angle)*dz,pz=g[2]+Math.sin(angle)*dy+Math.cos(angle)*dz;bottom=Math.min(bottom,py);top=Math.max(top,py);radius=Math.max(radius,Math.hypot(x-12,pz-12));}
  }
  const x=data.root[0]*12+data.root[8]*12+data.root[12],z=data.root[2]*12+data.root[10]*12+data.root[14];b.splice(0,6,x-radius,data.root[13]+bottom,z-radius,x+radius,data.root[13]+top,z+radius);
 }
 return {bounds:b,round,radius};
}
function intersects(a,b,i=0){const c=a.bounds;if(!(c[0]<b[i+3]-1e-4&&c[3]>b[i]+1e-4&&c[1]<b[i+4]-1e-4&&c[4]>b[i+1]+1e-4&&c[2]<b[i+5]-1e-4&&c[5]>b[i+2]+1e-4))return false;
 if(!a.round)return true;const x=(c[0]+c[3])/2,z=(c[2]+c[5])/2,dx=Math.max(b[i]-x,0,x-b[i+3]),dz=Math.max(b[i+2]-z,0,z-b[i+5]);return dx*dx+dz*dz<a.radius*a.radius-1e-4;
}
function staticEnvelopes(data,part){
 if(data.model!=='turret-study'||part.id!=='head')return [envelope(data,part)];
 // A single full-height head cylinder is unnecessarily pessimistic: its
 // widest lower skirt does not occupy the narrower upper cooling panels.
 const layers=new Map();for(const c of part.voxels)for(const x of [c[0],c[0]+1])for(const z of [c[2],c[2]+1])layers.set(c[1],Math.max(layers.get(c[1])??0,Math.hypot(x-12,z-12)));
 const cx=data.root[12]+12,cz=data.root[14]+12;
 return [...layers].map(([y,radius])=>({round:true,radius,bounds:[cx-radius,data.root[13]+y,cz-radius,cx+radius,data.root[13]+y+1,cz+radius]}));
}

export async function auditA1Clearance(id='southern-hook'){
 const level=await Bun.file(new URL(`../docs/a1-path-carving-2026-10-18/${id}.level.json`,import.meta.url)).json();delete level.previewMode;
 const models=await auditModels(level);models.set('arc-spire',await Bun.file(new URL('../assets/models/arc-spire.json',import.meta.url)).json());
 const sites=A1_OPTIONS[id].sites,rows=[];
 for(const model of ['turret-study','arc-spire'])for(const variant of ['base','upgrade1']){
  const probes=sites.map(s=>({id:s.id,model,variant,box:[s.box[0],0,s.box[1]],turn:0})),probeLevel={...level,placements:[...level.placements,...probes]},world=buildWorld(probeLevel,models),staticFailures=[];
  try{for(const p of probes){const data=world.rigs.get(p.id);for(const part of data.parts){let hit=false;for(const e of staticEnvelopes(data,part)){for(let node=0;node<world.visibility.nodeCount;node++){if(world.visibility.escape[node]!==node+1)continue;if(intersects(e,world.visibility.bounds,node*6)){staticFailures.push({id:p.id,part:part.id,bounds:e.bounds,obstacle:Array.from(world.visibility.bounds.slice(node*6,node*6+6))});hit=true;break;}}if(hit)break;}}}}finally{disposeWorld(world);}
  const motion=auditRouteGeometry(probeLevel,[],models);
  rows.push({model,variant,independentSites:sites.length,staticFailures,routeMotionFailures:motion.failures,sampledPoses:motion.sampledPoses,checkedParts:motion.checkedParts});
 }
 const excluded=[{site:'late-17-11',model:'turret-study',variant:'upgrade1',reason:'Retained southern oak canopy intersects the rotating upper head. Base gun and both tested Arc stages pass; preserve the user-approved landscape and use another position for an upgraded gun.'}];
 const known=(r,f)=>excluded.some(e=>e.site===f.id&&e.model===r.model&&e.variant===r.variant);
 const cell=models.get('turret-study').variants.upgrade1.parts.find(p=>p.id==='head').voxels.find(c=>c[0]===2&&c[1]===28&&c[2]===20);
 if(!cell)throw new Error('Upgrade1 head witness cell changed.');
 const localPoint=[2.05,28.5,20.95],dx=localPoint[0]-12,dz=localPoint[2]-12,yaw=Math.atan2(-dx,dz),worldPoint=[420,52.5,276+Math.hypot(dx,dz)];
 const witness={site:'late-17-11',model:'turret-study',variant:'upgrade1',part:'head',occupiedCell:cell.slice(0,3),interiorLocalPoint:localPoint,yawRadians:yaw,interiorWorldPoint:worldPoint,retainedObstacle:[413,51,289,422,59,290],interpretation:'An interior point of an occupied rotating-head voxel lies strictly inside the retained canopy cuboid: this upgrade restriction is a real intersection, not merely a coarse-cylinder rejection.'};
 if(!(worldPoint[0]>413&&worldPoint[0]<422&&worldPoint[1]>51&&worldPoint[1]<59&&worldPoint[2]>289&&worldPoint[2]<290))throw new Error('Exact canopy intersection witness no longer holds.');
 return {id,method:'Each candidate considered independently. Turret heads use complete yaw cylinders separately for every occupied Y layer; gun envelope encloses full yaw, analytic pitch extrema and zero/full recoil. Arc parts use fixed occupied-vertex bounds. Test static exact cuboids and production Dog/Roller/Moth occupied-part poses at every1-unit route distance and endpoints. Conservative envelopes may reject a harmless pose; no simultaneous-neighbour compatibility is claimed.',rows,excluded,witness,allProbedCombinationsClear:rows.every(r=>!r.staticFailures.length&&!r.routeMotionFailures.length),declaredSuitabilityPassed:rows.every(r=>!r.routeMotionFailures.length&&r.staticFailures.every(f=>known(r,f)))};
}
if(import.meta.main){const report=await auditA1Clearance(process.argv[2]??'southern-hook');await Bun.write(new URL(`../docs/a1-path-carving-2026-10-18/${report.id}.clearance.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
