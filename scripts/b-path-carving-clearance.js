// Conservative swept weapon clearance for independent hypothetical sites.
// Candidate probes share a world only to reuse static geometry. No clearance
// between neighbouring probes is claimed, and none are saved to the level.
import {auditModels} from './level-layout-audit.js';
import {B_OUT,digest} from './b-path-carving-options.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {levelRoutes} from '../shared/routes.js';
import {TURRET_PITCH,TURRET_RECOIL} from '../shared/arsenal.js';
import {MISSILE_LAUNCHER_SOCKETS,GUIDED_MISSILE_MODEL} from '../shared/missile-model.js';

function vertices(part){const points=new Map();for(const c of part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){const p=[c[0]+dx,c[1]+dy,c[2]+dz];points.set(p.join(','),p);}return [...points.values()];}
function box(points,m){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const [x,y,z]of points)for(let a=0;a<3;a++){const p=m[a]*x+m[a+4]*y+m[a+8]*z+m[a+12];b[a]=Math.min(b[a],p);b[a+3]=Math.max(b[a+3],p);}return b;}
function envelope(data,part){
 const points=vertices(part),b=box(points,data.root),round=data.model==='turret-study'&&part.id!=='base';let radius=0;
 if(data.model==='missile-launcher')for(const socket of MISSILE_LAUNCHER_SOCKETS[data.variant])b[4]=Math.max(b[4],data.root[13]+socket[1]+GUIDED_MISSILE_MODEL.height);
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
 if(data.model==='turret-study'&&part.id==='guns')return gunEnvelopes(data,part);
 if(data.model!=='turret-study'||part.id!=='head')return [envelope(data,part)];
 // A single full-height head cylinder is unnecessarily pessimistic: its
 // widest lower skirt does not occupy the narrower upper cooling panels.
 const layers=new Map();for(const c of part.voxels)for(const x of [c[0],c[0]+1])for(const z of [c[2],c[2]+1])layers.set(c[1],Math.max(layers.get(c[1])??0,Math.hypot(x-12,z-12)));
 const cx=data.root[12]+12,cz=data.root[14]+12;
 return [...layers].map(([y,radius])=>({round:true,radius,bounds:[cx-radius,data.root[13]+y,cz-radius,cx+radius,data.root[13]+y+1,cz+radius]}));
}

const gunProfiles=new Map();
function gunEnvelopes(data,part){
 // Keep radial reach coupled to actual height. The old full-height cylinder
 // combines extrema from incompatible pitch poses and wrongly rejects low
 // aircraft. Each one-degree interval is bounded continuously using every
 // analytic Y/Z extremum, both recoil endpoints and exact occupied cell corners.
 if(!gunProfiles.has(data.variant)){
  const layers=new Map(),g=part.pivot,steps=70;
  for(const cell of part.voxels)for(let step=0;step<steps;step++){
   const lo=TURRET_PITCH.min+(TURRET_PITCH.max-TURRET_PITCH.min)*step/steps,hi=TURRET_PITCH.min+(TURRET_PITCH.max-TURRET_PITCH.min)*(step+1)/steps;
   let bottom=Infinity,top=-Infinity,radius=0;
   for(const x of [cell[0],cell[0]+1])for(const y of [cell[1],cell[1]+1])for(const z of [cell[2],cell[2]+1])for(const recoil of [0,TURRET_RECOIL.distance]){
    const dy=y-g[1],dz=z-g[2]+recoil,angles=[lo,hi];
    for(const critical of [Math.atan2(-dz,dy),Math.atan2(dy,dz)])for(let k=-2;k<=2;k++){const a=critical+k*Math.PI;if(a>lo&&a<hi)angles.push(a);}
    for(const a of angles){const py=g[1]+Math.cos(a)*dy-Math.sin(a)*dz,pz=g[2]+Math.sin(a)*dy+Math.cos(a)*dz;bottom=Math.min(bottom,py);top=Math.max(top,py);radius=Math.max(radius,Math.hypot(x-12,pz-12));}
   }
   for(let y=Math.floor(bottom);y<Math.ceil(top);y++)layers.set(y,Math.max(layers.get(y)??0,radius));
  }
  gunProfiles.set(data.variant,[...layers].sort((a,b)=>a[0]-b[0]));
 }
 const cx=data.root[12]+12,cz=data.root[14]+12;
 return gunProfiles.get(data.variant).map(([y,radius])=>({round:true,radius,bounds:[cx-radius,data.root[13]+y,cz-radius,cx+radius,data.root[13]+y+1,cz+radius]}));
}
function movingClearance(world,probes){
 const actors=levelRoutes(world.level).flatMap(r=>['walker','dune-tread','twin-fan'].map(model=>({id:'clearance-'+r.id+'-'+model,model,variant:'base',routeId:r.id,distance:0}))),enemies=new EnemyPreview(world,()=>{},null,actors),shapes=enemies.states.map(s=>s.rig.bones.map(b=>vertices(b.part))),envelopes=probes.map(p=>({id:p.id,parts:world.rigs.get(p.id).parts.flatMap(part=>staticEnvelopes(world.rigs.get(p.id),part).map(e=>({...e,part:part.id})))})),failures=new Map();
 let sampledPoses=0,checkedParts=0;
 try{
  const maximum=Math.max(...enemies.states.map(s=>s.path.length));
  for(let distance=0;distance<=maximum;distance++){
   for(const s of enemies.states)s.seed=Math.min(distance,s.path.length-1e-6);enemies.reset();
   for(let i=0;i<enemies.states.length;i++){
    const s=enemies.states[i];if(distance>s.path.length)continue;sampledPoses++;
    for(let j=0;j<s.rig.bones.length;j++){
     const b=box(shapes[i][j],s.rig.bones[j].instance.matrix);checkedParts++;
     for(const probe of envelopes){if(failures.has(probe.id))continue;for(const e of probe.parts)if(intersects(e,b)){failures.set(probe.id,{id:probe.id,route:s.routeId,species:s.model,enemyPart:s.rig.bones[j].part.id,distance,defencePart:e.part,enemyBounds:b,defenceBounds:e.bounds});break;}}
    }
   }
  }
  return {sampledPoses,checkedParts,failures:[...failures.values()]};
 }finally{enemies.dispose();}
}

export async function auditBClearance(id){
 const sourceText=await Bun.file(new URL(id+'.level.json',B_OUT)).text(),level=JSON.parse(sourceText);delete level.previewMode;
 const models=await auditModels(level);models.set('arc-spire',await Bun.file(new URL('../assets/models/arc-spire.json',import.meta.url)).json());
 models.set('missile-launcher',await Bun.file(new URL('../assets/models/missile-launcher.json',import.meta.url)).json());models.set('guided-missile',await Bun.file(new URL('../assets/models/guided-missile.json',import.meta.url)).json());
 const sites=(await Bun.file(new URL(id+'.manifest.json',B_OUT)).json()).sites,rows=[];
 for(const model of ['turret-study','arc-spire','missile-launcher'])for(const variant of ['base','upgrade1','upgrade2']){
  const probes=sites.map(s=>({id:s.id,model,variant,box:[s.box[0],0,s.box[1]],turn:0})),probeLevel={...level,placements:[...level.placements,...probes]},actors=levelRoutes(probeLevel).flatMap(r=>['walker','dune-tread','twin-fan'].map(species=>({id:'clearance-'+r.id+'-'+species,model:species,variant:'base',routeId:r.id,distance:0}))),world=buildWorld(probeLevel,models,{actors}),staticFailures=[];
  try{
   for(const p of probes){const data=world.rigs.get(p.id);for(const part of data.parts){let hit=false;for(const e of staticEnvelopes(data,part)){for(let node=0;node<world.visibility.nodeCount;node++){if(world.visibility.escape[node]!==node+1)continue;if(intersects(e,world.visibility.bounds,node*6)){staticFailures.push({id:p.id,part:part.id,bounds:e.bounds,obstacle:Array.from(world.visibility.bounds.slice(node*6,node*6+6))});hit=true;break;}}if(hit)break;}}}
   const motion=movingClearance(world,probes);rows.push({model,variant,independentSites:sites.length,staticFailures,routeMotionFailures:motion.failures,sampledPoses:motion.sampledPoses,checkedParts:motion.checkedParts});
  }finally{disposeWorld(world);}
 }
 const excluded=rows.flatMap(r=>[...new Set([...r.staticFailures,...r.routeMotionFailures].map(f=>f.id))].map(site=>({site,model:r.model,variant:r.variant,reason:r.routeMotionFailures.some(f=>f.id===site)?'Complete yaw/pitch/recoil envelope can intersect a routed airborne body at the sampled pose.':'Complete weapon movement envelope intersects retained static scenery.'})));
 const ready=rows.map(r=>({model:r.model,variant:r.variant,sites:sites.filter(s=>!excluded.some(e=>e.site===s.id&&e.model===r.model&&e.variant===r.variant)).map(s=>s.id)}));
 return {id,sourceHash:digest(sourceText),method:'Each candidate considered independently. Turret heads use complete yaw cylinders separately for every occupied Y layer. Gun occupied voxels use continuous one-degree pitch-interval extrema, both recoil endpoints and full yaw, retaining horizontal radius separately in one-unit Y layers. Arc parts use fixed occupied-vertex bounds. Launcher bounds include the tallest loaded missile tip across the full casing footprint. Test exact static cuboids and actual production Walker/DuneTread/TwinFan occupied-part poses at every1-unit route distance and endpoints. Conservative envelopes can reject a harmless pose; an overlap is a restriction, not proof of an actual joint collision. Separate finite flights probe actual launches. No simultaneous-neighbour compatibility is claimed; upgrade2 gun is physically surveyed only and remains inactive.',rows,excluded,ready,allProbedCombinationsClear:rows.every(r=>!r.staticFailures.length&&!r.routeMotionFailures.length),zeroRouteMotionOverlaps:rows.every(r=>!r.routeMotionFailures.length),testedCombinations:rows.length*sites.length,restrictedCombinations:excluded.length,readyCombinations:ready.reduce((sum,r)=>sum+r.sites.length,0)};
}
if(import.meta.main)for(const id of process.argv.slice(2).length?process.argv.slice(2):['cistern-mesa-circuit','riverfold-crossing','mesa-confluence','aqueduct-shore-tour']){const report=await auditBClearance(id);await Bun.write(new URL(id+'.clearance.json',B_OUT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id,ready:report.readyCombinations,restricted:report.restrictedCombinations,routeMotionClear:report.zeroRouteMotionOverlaps,exclusions:report.excluded},null,2));}
