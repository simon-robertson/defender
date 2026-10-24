import {TerrainField,placementY} from '../shared/terrain.js';
import {levelRoutes} from '../shared/routes.js';
import {identity,placementMatrix,partMatrices,multiply} from '../shared/math.js';
import {TURRET_PITCH,TURRET_RECOIL} from '../shared/arsenal.js';
import {SceneryVisibility} from '../engine/visibility.js';
import {Camera} from '../engine/camera.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {VARIANTS} from '../shared/model.js';
import {GUIDED_MISSILE_MODEL,MISSILE_LAUNCHER_SOCKETS} from '../shared/missile-model.js';
import {ENEMY_EXPANSION_MOVEMENT} from '../engine/enemy-expansion-gait.js';
import {ENEMY_EXPANSION_RIGS} from '../shared/enemy-expansion-rigs.js';
import {FlightPathMotion} from '../engine/flight-path-motion.js';
import {WALKER_WALK,SPIDER_WALK} from '../engine/articulated-gait.js';
import {playCapacity} from './config.js';

const SIZE=24,EPS=1e-6;
// Existing upright Dog locomotion envelope. Continuous route capsules use the
// full twelve-unit horizontal contract; model/gait regressions verify that the
// accepted legs and body remain inside it throughout both playable routes.
// Directional impact recovery retains the production live clearance gate.
export const DOG_ROUTE_RADIUS=12;
const fail=(code,reason)=>({valid:false,code,reason});
const OK=Object.freeze({valid:true,code:null,reason:''});
const overlaps=(a,b,o=0)=>a[0]<b[o+3]-EPS&&a[3]>b[o]+EPS&&a[1]<b[o+4]-EPS&&a[4]>b[o+1]+EPS&&a[2]<b[o+5]-EPS&&a[5]>b[o+2]+EPS;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const boxOf=input=>Array.isArray(input)&&(input.length===2||input.length===3)?input.length===2?[input[0],0,input[1]]:input.slice():null;
const validBox=(box,size)=>box&&box.every(Number.isInteger)&&box[1]===0&&box[0]>=0&&box[2]>=0&&box[0]<size[0]&&box[2]<size[1];
function corners(cell){const points=[];for(const x of [cell[0],cell[0]+1])for(const y of [cell[1],cell[1]+1])for(const z of [cell[2],cell[2]+1])points.push([x,y,z]);return points;}

// Browser-safe extraction of the independently reviewed continuous authoring
// construction. Per-height shapes retain radial/vertical coupling and bound
// whole voxels/recoil intervals, rather than isolated sampled joint poses.
export function gunMovementShapes(model,variant){
 const result=[];
 for(const part of model.variants[variant].parts){
  const layers=new Map();
  if(part.id==='guns'){
   const pivot=part.pivot,steps=70;
   for(const cell of part.voxels)for(let step=0;step<steps;step++){
    const lo=TURRET_PITCH.min+(TURRET_PITCH.max-TURRET_PITCH.min)*step/steps,hi=TURRET_PITCH.min+(TURRET_PITCH.max-TURRET_PITCH.min)*(step+1)/steps;
    let bottom=Infinity,top=-Infinity,radius=0;
    for(const [x,y,z]of corners(cell))for(const recoil of [0,TURRET_RECOIL.distance]){
     const dy=y-pivot[1],dz=z-pivot[2]+recoil,angles=[lo,hi];
     for(const critical of [Math.atan2(-dz,dy),Math.atan2(dy,dz)])for(let k=-2;k<=2;k++){const a=critical+k*Math.PI;if(a>lo&&a<hi)angles.push(a);}
     for(const a of angles){const py=pivot[1]+Math.cos(a)*dy-Math.sin(a)*dz,pz=pivot[2]+Math.sin(a)*dy+Math.cos(a)*dz;bottom=Math.min(bottom,py);top=Math.max(top,py);radius=Math.max(radius,Math.hypot(x-12,pz-12));}
    }
    for(let y=Math.floor(bottom);y<Math.ceil(top);y++)layers.set(y,Math.max(layers.get(y)??0,radius));
   }
  }else for(const cell of part.voxels){
   if(part.id==='head')for(const x of [cell[0],cell[0]+1])for(const z of [cell[2],cell[2]+1])layers.set(cell[1],Math.max(layers.get(cell[1])??0,Math.hypot(x-12,z-12)));
   else{
    let b=layers.get(cell[1]);if(!b){b=[Infinity,cell[1],Infinity,-Infinity,cell[1]+1,-Infinity];layers.set(cell[1],b);}b[0]=Math.min(b[0],cell[0]);b[2]=Math.min(b[2],cell[2]);b[3]=Math.max(b[3],cell[0]+1);b[5]=Math.max(b[5],cell[2]+1);
   }
  }
  for(const [y,value]of layers)result.push(typeof value==='number'?{part:part.id,round:true,radius:value,bounds:[12-value,y,12-value,12+value,y+1,12+value]}:{part:part.id,round:false,radius:0,bounds:value});
 }
 return result;
}
export function defenceMovementShapes(model,variant){
 if(model.id==='turret-study')return gunMovementShapes(model,variant);
 const result=[];
 for(const part of model.variants[variant].parts){
  const layers=new Map();for(const cell of part.voxels){let b=layers.get(cell[1]);if(!b){b=[Infinity,cell[1],Infinity,-Infinity,cell[1]+1,-Infinity];layers.set(cell[1],b);}b[0]=Math.min(b[0],cell[0]);b[2]=Math.min(b[2],cell[2]);b[3]=Math.max(b[3],cell[0]+1);b[5]=Math.max(b[5],cell[2]+1);}
  for(const bounds of layers.values())result.push({part:part.id,round:false,radius:0,bounds});
 }

 return result;
}
// Bound complete spin/flap intervals, then the accepted body bank and free
// route yaw. This protects taller Rollers and airborne Moths independently.
function rotationBounds(bounds,pivot,axis,lo,hi){
 const result=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],u=(axis+1)%3,v=(axis+2)%3;
 for(const x of [bounds[0],bounds[3]])for(const y of [bounds[1],bounds[4]])for(const z of [bounds[2],bounds[5]]){
  const p=[x,y,z],a=p[u]-pivot[u],b=p[v]-pivot[v],angles=[lo,hi];
  for(const critical of [Math.atan2(-b,a),Math.atan2(a,b)])for(let k=-2;k<=2;k++){const angle=critical+k*Math.PI;if(angle>lo&&angle<hi)angles.push(angle);}
  for(const angle of angles){const q=p.slice();q[u]=pivot[u]+Math.cos(angle)*a-Math.sin(angle)*b;q[v]=pivot[v]+Math.sin(angle)*a+Math.cos(angle)*b;for(let i=0;i<3;i++){result[i]=Math.min(result[i],q[i]);result[i+3]=Math.max(result[i+3],q[i]);}}
 }
 return result;
}
export function enemyRouteEnvelope(model,profile={}){
 if(model.id==='dog')return {radius:DOG_ROUTE_RADIUS,bottom:0,top:14,layers:[{radius:DOG_ROUTE_RADIUS,bottom:0,top:14}]};
 const movement=model.id==='walker'?WALKER_WALK:model.id==='spider'?SPIDER_WALK:ENEMY_EXPANSION_MOVEMENT[model.id],parts=model.variants.base.parts,height=(profile.altitude??movement?.altitude??0)-(movement?.crouch??0),layers=new Map(),contract=ENEMY_EXPANSION_RIGS[model.id];let radius=0,bottom=Infinity,top=-Infinity;
 // Keep the twelve-unit navigation contract for low articulated limbs, but
 // retain the actual narrow upper silhouette. Joint intervals enclose the
 // supported walking gaits (including turns); each whole voxel is swept
 // through the hierarchy analytically, rather than testing a few bind poses.
 if((model.id==='walker'&&(profile.speed??movement.speed)<=10)||model.id==='tripod'){
  const byId=new Map(parts.map(part=>[part.id,part])),walker=model.id==='walker';
  for(const part of parts)for(const cell of part.voxels){
   // Grounded IK paws counter-rotate their entire parent chain and remain
   // level through stance/swing. Do not combine mutually cancelling rotations.
   if(part.id.startsWith('foot-')){for(let y=0;y<Math.ceil(2+(movement.lift??0));y++)layers.set(y,12);continue;}
   let bounds=[cell[0],cell[1],cell[2],cell[0]+1,cell[1]+1,cell[2]+1];
   for(let joint=part;joint?.parent;joint=byId.get(joint.parent)){
    const upper=/^(thigh|upper)-/.test(joint.id),rear=joint.id.endsWith('-rear'),left=joint.id.endsWith('-fl');
    const limits=walker?(upper?[[-.2,.2],[0,0],[0,0]]:[[-.25,.25],[-.15,.15],[-.2,.2]]):upper?(rear?[[-.4,0],[-.15,.15],[-.2,.2]]:[[-.2,.3],[-.2,.2],left?[-.3,.15]:[-.15,.3]]):(rear?[[-.15,.7],[-.05,.05],[-.1,.1]]:[[-.4,.2],[-.1,.1],left?[-.15,.5]:[-.5,.15]]);
    for(let axis=0;axis<3;axis++)if(limits[axis][0]||limits[axis][1])bounds=rotationBounds(bounds,joint.pivot,axis,...limits[axis]);
   }
   let r=0;for(const x of [bounds[0],bounds[3]])for(const z of [bounds[2],bounds[5]])r=Math.max(r,Math.hypot(x-12,z-12));r=Math.min(12,r);
   for(let y=Math.floor(bounds[1]);y<Math.ceil(bounds[4]);y++)layers.set(y,Math.max(layers.get(y)??0,r));
  }
  const top=Math.max(...parts.flatMap(part=>part.voxels.map(cell=>cell[1]+1)))+height,result=[...layers].filter(([y])=>y+height<top&&y+1+height>0).map(([y,radius])=>({radius,bottom:Math.max(0,y+height),top:Math.min(top,y+1+height)}));
  return {radius:12,bottom:0,top,layers:result};
 }
 if(model.id==='spider'||model.id==='walker'){
  const top=Math.max(...parts.flatMap(part=>part.voxels.map(cell=>cell[1]+1)))+height;
  return {radius:12,bottom:0,top,layers:[{radius:12,bottom:0,top}]};
 }
 for(const part of parts)for(const cell of part.voxels){
  let bounds=[cell[0],cell[1],cell[2],cell[0]+1,cell[1]+1,cell[2]+1];
  if(contract?.wheels?.some(wheel=>wheel.id===part.id))bounds=rotationBounds(bounds,part.pivot,0,-Math.PI,Math.PI);
  if(contract?.wings?.some(wing=>wing.id===part.id)){const flap=contract.maxFlapDegrees*Math.PI/180;bounds=rotationBounds(bounds,part.pivot,2,-flap,flap);}
  if(contract?.rotors?.some(rotor=>rotor.id===part.id))bounds=rotationBounds(bounds,part.pivot,1,-Math.PI,Math.PI);
  if(contract?.maxBankDegrees){const bank=contract.maxBankDegrees*Math.PI/180;bounds=rotationBounds(bounds,contract.root,2,-bank,bank);}
  let localRadius=0;for(const x of [bounds[0],bounds[3]])for(const z of [bounds[2],bounds[5]])localRadius=Math.max(localRadius,Math.hypot(x-12,z-12));radius=Math.max(radius,localRadius);bottom=Math.min(bottom,bounds[1]);top=Math.max(top,bounds[4]);
  for(let y=Math.floor(bounds[1]);y<Math.ceil(bounds[4]);y++)layers.set(y,Math.max(layers.get(y)??0,localRadius));
 }
 return {radius,bottom:bottom+height,top:top+height,layers:[...layers].map(([y,radius])=>({radius,bottom:y+height,top:y+1+height}))};
}
function translated(shapes,box,height){return shapes.map(s=>({...s,bounds:s.bounds.map((v,i)=>v+(i%3===0?box[0]*SIZE:i%3===1?height:box[2]*SIZE))}));}
function shapeHitsBox(shape,bounds,offset=0){
 const a=shape.bounds;if(!overlaps(a,bounds,offset))return false;if(!shape.round)return true;
 const x=(a[0]+a[3])/2,z=(a[2]+a[5])/2,dx=Math.max(bounds[offset]-x,0,x-bounds[offset+3]),dz=Math.max(bounds[offset+2]-z,0,z-bounds[offset+5]);return dx*dx+dz*dz<shape.radius**2-EPS;
}
function shapesConflict(a,b){
 if(!overlaps(a.bounds,b.bounds))return false;
 if(a.round&&b.round){const dx=(a.bounds[0]+a.bounds[3]-b.bounds[0]-b.bounds[3])/2,dz=(a.bounds[2]+a.bounds[5]-b.bounds[2]-b.bounds[5])/2;return dx*dx+dz*dz<(a.radius+b.radius)**2-EPS;}
 return a.round?shapeHitsBox(a,b.bounds):b.round?shapeHitsBox(b,a.bounds):true;
}
function blocked(shape,tree){for(let node=0;node<tree.nodeCount;){if(shapeHitsBox(shape,tree.bounds,node*6)){if(tree.escape[node]===node+1)return true;node++;}else node=tree.escape[node];}return false;}

const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function projectedFootprint(bounds,o,ground,slopeX,slopeZ){
 if(bounds[o+4]<=ground)return null;
 const points=[];for(const x of [bounds[o],bounds[o+3]])for(const y of [Math.max(ground,bounds[o+1]),bounds[o+4]])for(const z of [bounds[o+2],bounds[o+5]])points.push([x-(y-ground)*slopeX,z-(y-ground)*slopeZ]);
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const lower=[],upper=[];
 for(const p of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}for(let i=points.length-1;i>=0;i--){const p=points[i];while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}lower.pop();upper.pop();const polygon=[...lower,...upper];
 return {polygon,minX:Math.min(...polygon.map(p=>p[0])),maxX:Math.max(...polygon.map(p=>p[0])),minZ:Math.min(...polygon.map(p=>p[1])),maxZ:Math.max(...polygon.map(p=>p[1]))};
}
function clippedArea(polygon,x,z){
 let points=polygon;
 for(const [axis,limit,sign]of [[0,x,1],[0,x+SIZE,-1],[1,z,1],[1,z+SIZE,-1]]){
  if(!points.length)return 0;const next=[];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],insideA=(a[axis]-limit)*sign>=0,insideB=(b[axis]-limit)*sign>=0;if(insideA)next.push(a);if(insideA!==insideB){const t=(limit-a[axis])/(b[axis]-a[axis]);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}points=next;
 }
 let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=(a[0]-x)*(b[1]-z)-(b[0]-x)*(a[1]-z);}return Math.abs(area)*.5;
}
function routeConflict(shape,segment,radius,height,ground){
 const b=shape.bounds;if(b[1]>=ground+height-EPS||b[4]<=ground+EPS)return false;
 if(shape.round){const x=(b[0]+b[3])/2,z=(b[2]+b[5])/2,dx=x-clamp(x,segment[0],segment[2]),dz=z-clamp(z,segment[1],segment[3]);return dx*dx+dz*dz<(radius+shape.radius)**2-EPS;}
 const dx=Math.max(b[0]-segment[2],segment[0]-b[3],0),dz=Math.max(b[2]-segment[3],segment[1]-b[5],0);return dx*dx+dz*dz<radius*radius-EPS;
}
function rigData(model,variant,root){
 const parts=model.variants[variant].parts,poses=partMatrices(parts),instances=parts.map(part=>{const matrix=identity();multiply(matrix,root,poses.get(part.id));return {part:part.id,key:part.id,index:0,matrix};});
 return {model:model.id,variant,role:model.role,root,parts,instances};
}
function boxClear(bounds,tree,defences){
 const shape={bounds,round:false};if(blocked(shape,tree))return false;return defences.every(b=>!overlaps(bounds,b));
}

export function connectedWildlifePoints(nav,homes,radius,{offPath=false}={}){
 const points=[],componentRanges=[];
 // This is a placement authoring guard, not a new animal confinement rule:
 // reject single-node/tiny cages and require several destinations plus48units
 // of actual connected reach for each new seed.
 for(let c=0;c<nav.starts.length-1;c++){const start=nav.starts[c],end=nav.starts[c+1];if(end-start<64)continue;let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;for(let i=start;i<end;i++){const n=nav.members[i],x=(n%nav.cols+.5)*4,z=(Math.floor(n/nav.cols)+.5)*4;x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);}if(Math.hypot(x1-x0,z1-z0)>=48)componentRanges.push({c,start,end});}
 for(const home of homes){
  let chosen=null,best=Infinity;
  for(const component of componentRanges)for(let i=component.start;i<component.end;i++){
   const node=nav.members[i];if(offPath&&!nav.offPath[node])continue;const x=(node%nav.cols+.5)*4,z=(Math.floor(node/nav.cols)+.5)*4,y=nav.heights[node],distance=(x-home[0])**2+(z-home[2])**2+(y-home[1])**2;
   if(distance>=best||points.some(p=>Math.hypot(p[0]-x,p[2]-z)<radius*2+2))continue;
   let reach=false;for(let j=component.start;j<component.end;j++){const n=nav.members[j],px=(n%nav.cols+.5)*4,pz=(Math.floor(n/nav.cols)+.5)*4;if(Math.hypot(px-x,pz-z)>=48){reach=true;break;}}
   if(reach){best=distance;chosen=[x,y,z];}
  }
  if(!chosen)return null;points.push(chosen);
 }
 return points;
}

export function createPlacementRules(source,models,{config,critters=true}={}){
 if(!source||!models?.get('turret-study'))throw new Error('Placement requires the source and gun model.');
 const level=structuredClone(source);level.placements=level.placements.filter(p=>models.get(p.model)?.role==='scenery');delete level.previewMode;delete level.previewActors;delete level.actorRoutes;
 const relevant=config?.levels.find(entry=>entry.id===source.id),species=relevant?new Set(relevant.waves.flatMap(wave=>wave.spawns.map(spawn=>spawn.model))):null;
 const enemyProfile=model=>{const base=config?.enemies[model];return base&&relevant?{...base,speed:Math.max(base.speed,...relevant.waves.map(wave=>wave.enemyOverrides?.[model]?.speed??base.speed))}:base;};
 const enabled=new Map(Object.entries(config?.defences??{'turret-study':{enabledVariants:VARIANTS},'arc-spire':{enabledVariants:VARIANTS},'missile-launcher':{enabledVariants:VARIANTS},'power-generator':{enabledVariants:['base']}}).filter(([model])=>models.has(model)).map(([model,family])=>[model,family.enabledVariants]));
 const supportedVariant=(model,variant)=>enabled.get(model)?.includes(variant)??false;
 const field=new TerrainField(level),tree=new SceneryVisibility(level,models),width=level.size[0]*SIZE,length=level.size[1]*SIZE,families=[...enabled.keys()],enemies=['dog','walker','spider',...Object.keys(ENEMY_EXPANSION_MOVEMENT)].filter(model=>models.has(model)&&(!species||species.has(model))).flatMap(model=>enemyRouteEnvelope(models.get(model),enemyProfile(model)).layers.map(layer=>({...layer,airborne:Boolean(ENEMY_EXPANSION_MOVEMENT[model]?.airborne)}))),maxUnits=config?playCapacity(config).maxOwnedUnits:128;
 const routes=levelRoutes(level),shapes=Object.fromEntries(families.flatMap(model=>enabled.get(model).map(v=>[model+':'+v,defenceMovementShapes(models.get(model),v)]))),segments=routes.flatMap(r=>r.path.slice(1).map((p,i)=>{const a=r.path[i];return [Math.min(a[0],p[0])*SIZE+12,Math.min(a[2],p[2])*SIZE+12,Math.max(a[0],p[0])*SIZE+12,Math.max(a[2],p[2])*SIZE+12];})),flightSegments=enemies.some(e=>e.airborne)?routes.flatMap(r=>new FlightPathMotion(r.path).clearanceSegments()):[];
 const camera=new Camera({clientWidth:960,clientHeight:768,addEventListener(){}},()=>{}),projections=[];camera.setLevel(level);const slopeX=Math.sin(camera.yaw)/Math.tan(camera.pitch),slopeZ=Math.cos(camera.yaw)/Math.tan(camera.pitch);
 for(let node=0;node<tree.nodeCount;node++)if(tree.escape[node]===node+1){const footprint=projectedFootprint(tree.bounds,node*6,level.pathHeight,slopeX,slopeZ);if(footprint)projections.push(footprint);}
 const staticCells=new Map(),worldShapes=new Map();let disposed=false,lastPreparedKey=null,lastPrepared=null;
 const geometryFor=(box,variant,model)=>{const key=`${model}:${variant}:${box[0]},${box[2]}`;if(!worldShapes.has(key))worldShapes.set(key,translated(shapes[model+':'+variant],box,level.pathHeight));return worldShapes.get(key);};
 function staticCheck(box,variant,model){
  const key=`${model}:${variant}:${box[0]},${box[2]}`;if(staticCells.has(key))return staticCells.get(key);
  let result=OK;
  if(field.bridgeBox(box[0],box[2]))result=fail('bridge','Keep the bridge clear for enemies.');
  else if(field.protected(box[0],box[2]))result=fail('route','Keep the enemy path clear.');
  else if(field.flatBox(box[0],box[2])!==level.pathHeight)result=fail('ground','Choose flat, dry ground at path height.');
  else{
   const x=box[0]*SIZE,z=box[2]*SIZE;
   if(projections.some(p=>p.maxX>x+EPS&&p.minX<x+SIZE-EPS&&p.maxZ>z+EPS&&p.minZ<z+SIZE-EPS&&clippedArea(p.polygon,x,z)>1e-8))result=fail('hidden','Choose a full ground area visible from the overview.');
   else for(const shape of geometryFor(box,variant,model)){
    const b=shape.bounds;if(b[0]<-EPS||b[2]<-EPS||b[3]>width+EPS||b[5]>length+EPS){result=fail('bounds','The defence needs room inside the landscape.');break;}
    if(blocked(shape,tree)){result=fail('scenery','The defence would touch the scenery.');break;}
    if(enemies.some(enemy=>(enemy.airborne?flightSegments:segments).some(s=>routeConflict(shape,s,enemy.radius,enemy.top-enemy.bottom,level.pathHeight+enemy.bottom)))){result=fail('enemy-clearance','The defence would obstruct a passing enemy.');break;}
   }
   if(result.valid&&model==='missile-launcher')for(const socket of MISSILE_LAUNCHER_SOCKETS[variant]){
    const x=box[0]*SIZE+socket[0],z=box[2]*SIZE+socket[2],r=GUIDED_MISSILE_MODEL.radius,shape={round:true,radius:r,bounds:[x-r,level.pathHeight+socket[1],z-r,x+r,level.pathHeight+socket[1]+32+GUIDED_MISSILE_MODEL.height,z+r]};
    if(blocked(shape,tree)){result=fail('launch-clearance','Leave clear space above the missile launcher.');break;}
   }
  }
  staticCells.set(key,result);return result;
 }
 function check(input,variant,existing=[],ownId=null,model='turret-study'){
  if(disposed)return fail('disposed','This landscape is no longer active.');
  const box=boxOf(input);if(!supportedVariant(model,variant))return fail('variant','Choose a supported defence tier.');
  if(!validBox(box,level.size))return fail('bounds','Choose ground inside the landscape.');
  if(!Array.isArray(existing))return fail('placement','The current deployment is invalid.');
  const result=staticCheck(box,variant,model);if(!result.valid)return {...result};
  const candidate=geometryFor(box,variant,model);
  for(const placement of existing){
   if(!placement||typeof placement!=='object')return fail('placement','The current deployment contains an unsupported unit.');
   if(placement.id===ownId)continue;
   const other=boxOf(placement.box);if(!validBox(other,level.size)||!supportedVariant(placement.model,placement.variant)||(placement.turn??0)!==0)return fail('placement','The current deployment contains an unsupported unit.');
   if(other[0]===box[0]&&other[2]===box[2])return fail('occupied','Another defence occupies this ground.');
   if(candidate.some(a=>geometryFor(other,placement.variant,placement.model).some(b=>shapesConflict(a,b))))return fail('unit-clearance','Leave more room between the defences.');
  }

  return {...OK};
 }
 function eligibleCells(variant,existing=[],ownId=null,model='turret-study'){const cells=[];for(let z=0;z<level.size[1];z++)for(let x=0;x<level.size[0];x++){const box=[x,0,z];cells.push({box,...check(box,variant,existing,ownId,model)});}return cells;}
 function prepare(existing=[]){
  if(disposed)return fail('disposed','This landscape is no longer active.');
  if(!Array.isArray(existing)||existing.length>maxUnits)return fail('placement','The deployment exceeds the supported unit count.');
  const ids=new Set();for(const placement of existing){if(!placement||!families.includes(placement.model)||(placement.turn??0)!==0)return fail('placement','The current deployment contains an unsupported unit.');if(typeof placement.id!=='string'||!placement.id||ids.has(placement.id))return fail('placement','Every deployed unit needs a unique identity.');ids.add(placement.id);const result=check(placement.box,placement.variant,existing,placement.id,placement.model);if(!result.valid)return result;}
  const key=JSON.stringify(existing.map(p=>[p.id,p.model,p.variant,p.box]));if(key===lastPreparedKey)return structuredClone(lastPrepared);

  const actors=critters?wildlifeActorsForLevel(level):[];
  if(!actors.length){const result={...OK,wildlifePoints:[]};lastPreparedKey=key;lastPrepared=result;return structuredClone(result);}
  const probeLevel={...level,placements:[...level.placements,...existing]},rigs=new Map(),actorRigs=new Map();
  for(const placement of probeLevel.placements){const model=models.get(placement.model);if(!model)return fail('assets','A placement model is unavailable.');const root=placementMatrix(placement.box,placement.turn??0,placement.offset);root[13]=placementY(probeLevel,placement,field);rigs.set(placement.id,rigData(model,placement.variant,root));}
  let radius=0,height=0;
  for(const actor of actors){const model=models.get(actor.model);if(!model)return fail('assets','Wildlife models must be loaded before deployment.');actorRigs.set(actor.id,rigData(model,actor.variant,identity()));if(actor.kind==='ground')for(const part of model.variants[actor.variant].parts)for(const cell of part.voxels)for(const [x,y,z]of corners(cell)){radius=Math.max(radius,Math.hypot(x-12,z-12));height=Math.max(height,y+(actor.model.includes('-hare-')?1.2:0));}}
  radius+=1e-5;height+=1e-5;
  const defenceBoxes=existing.map(p=>{let r=0;for(const part of models.get(p.model).variants[p.variant].parts)for(const cell of part.voxels)for(const [x,,z]of corners(cell))r=Math.max(r,Math.hypot(x-12,z-12));if(p.model==='turret-study')r+=TURRET_RECOIL.distance;const cx=(p.box[0]+.5)*SIZE,cz=(p.box[2]+.5)*SIZE;return [cx-r,level.pathHeight,cz-r,cx+r,Math.max(...geometryFor(p.box,p.variant,p.model).map(s=>s.bounds[4])),cz+r];});
  const groundCount=actors.filter(a=>a.kind==='ground').length,initial=[];
  for(let z=2;z<length&&initial.length<groundCount;z+=4)for(let x=2;x<width&&initial.length<groundCount;x+=4){
   const y=field.height(x,z),bounds=[x-radius,y,z-radius,x+radius,y+height,z+radius];if(bounds[0]<0||bounds[2]<0||bounds[3]>width||bounds[5]>length)continue;
   let supported=true;for(let bz=Math.floor(bounds[2]/SIZE);bz<=Math.floor((bounds[5]-EPS)/SIZE);bz++)for(let bx=Math.floor(bounds[0]/SIZE);bx<=Math.floor((bounds[3]-EPS)/SIZE);bx++)if(field.flatBox(bx,bz)!==y)supported=false;
   if(supported&&boxClear(bounds,tree,defenceBoxes)&&initial.every(p=>Math.hypot(p[0]-x,p[2]-z)>=radius*2+2))initial.push([x,y,z]);
  }
  if(initial.length<groundCount)return fail('wildlife','Leave connected, open ground for the wildlife.');
  const probeActors=actors.map((a,i)=>a.kind==='ground'?{...a,point:initial[i],habitat:[Math.floor(initial[i][0]/SIZE),Math.floor(initial[i][2]/SIZE)]}:a),world={level:probeLevel,width,length,rigs,actors:actorRigs,visibility:tree};
  let life;
  try{
   life=new WildlifePreview(world,()=>{},probeActors);const nav=life.nav;
   if(!nav||life.treePerches.length<2)return fail('wildlife','Leave connected ground and clear bird perches.');
   const homes=actors.filter(a=>a.kind==='ground').map(a=>a.point??[(a.habitat[0]+.5)*SIZE,field.flatBox(...a.habitat),(a.habitat[1]+.5)*SIZE]),points=connectedWildlifePoints(nav,homes,radius);
   if(!points)return fail('wildlife','Leave connected roaming ground with room for wildlife journeys.');
   // Probe the actual bounded flight planner from the retained supported
   // perches. This virtual preparation check allocates no rendered scene and
   // does not advance the real animals; a clear perch alone is insufficient.
   const birds=life.states.filter(s=>s.kind==='bird');
   for(let frame=0;frame<30*30&&birds.some(s=>s.journeysCompleted===0);frame++)life.advance(1/30);
   if(birds.some(s=>s.journeysCompleted===0))return fail('wildlife','Leave clear departure and arrival routes for the birds.');
   const result={...OK,wildlifePoints:points};lastPreparedKey=key;lastPrepared=result;return structuredClone(result);
  }catch(error){return fail('wildlife','This deployment leaves no safe wildlife habitat or supported bird perch.');}
  finally{life?.dispose();rigs.clear();actorRigs.clear();}
 }
 function dispose(){if(disposed)return;disposed=true;tree.dispose();staticCells.clear();worldShapes.clear();projections.length=0;segments.length=0;level.placements.length=0;lastPrepared=null;lastPreparedKey=null;}
 return {check,eligibleCells,prepare,dispose,width:level.size[0],length:level.size[1],pathHeight:level.pathHeight};
}
