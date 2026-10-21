// Offline authoring checks. These deliberately use the production controllers;
// no runtime cache, gameplay rule or renderer budget is introduced here.
import {createHash} from 'node:crypto';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {TurretPreview} from '../game/turret-preview.js';
import {DefencePreview} from '../game/defence-preview.js';
import {MISSILE_PREVIEW_ACTORS} from '../game/missile-preview.js';
import {MIXED_PREVIEW_ACTORS} from '../shared/enemy-roster.js';
import {levelRoutes} from '../shared/routes.js';
import {placementMatrix} from '../shared/math.js';
import {TURRET_RECOIL,TURRET_PITCH} from '../shared/arsenal.js';
import {MISSILE_LAUNCHER_SOCKETS,GUIDED_MISSILE_MODEL} from '../shared/missile-model.js';
import {productionCoverage} from './production-layouts.js';

export const sourceHash=text=>createHash('sha256').update(text).digest('hex');
const modelCache=new Map();
export async function auditModels(level){
 const ids=new Set([...level.placements.map(p=>p.model),...MIXED_PREVIEW_ACTORS[level.zone].map(a=>a.model),'turret-study']);
 if(level.placements.some(p=>p.model==='missile-launcher'))ids.add('guided-missile');
 const models=new Map();
 for(const id of ids){if(!modelCache.has(id))modelCache.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());models.set(id,modelCache.get(id));}
 return models;
}
function vertices(part){const points=new Map();for(const c of part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){const p=[c[0]+dx,c[1]+dy,c[2]+dz];points.set(p.join(','),p);}return [...points.values()];}
function boundsFor(points,m){
 const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
 for(const [x,y,z]of points)for(let a=0;a<3;a++){const p=m[a]*x+m[a+4]*y+m[a+8]*z+m[a+12];b[a]=Math.min(b[a],p);b[a+3]=Math.max(b[a+3],p);}return b;
}
const overlap=(a,b,i=0)=>a[0]<b[i+3]-1e-4&&a[3]>b[i]+1e-4&&a[1]<b[i+4]-1e-4&&a[4]>b[i+1]+1e-4&&a[2]<b[i+5]-1e-4&&a[5]>b[i+2]+1e-4;
function blocked(b,tree){let node=0;while(node<tree.nodeCount){if(overlap(b,tree.bounds,node*6)){if(tree.escape[node]===node+1)return true;node++;}else node=tree.escape[node];}return false;}
function defenceEnvelopes(world){
 const result=[];
 for(const [id,data]of world.rigs)if(data.role==='defence')for(const part of data.parts){
  const points=vertices(part),b=boundsFor(points,data.root),round=data.model==='turret-study'&&part.id!=='base';let radius=0;
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
  result.push({id:id+'/'+part.id,bounds:b,round,radius});
 }return result;
}
function intervals(flags){const out=[];let start=-1;for(let i=0;i<=flags.length;i++){if(flags[i]&&start<0)start=i;if(!flags[i]&&start>=0){out.push([start,i]);start=-1;}}return out;}
function probeGun(world,models,site,variant){
 const placement={id:'probe-'+site.id,model:'turret-study',variant,box:[site.box[0],0,site.box[1]],turn:0},root=placementMatrix(placement.box,0);root[13]=world.level.pathHeight;
 const parts=models.get('turret-study').variants[variant].parts,instances=parts.map((part,index)=>({part:part.id,key:part.id,index,matrix:new Float32Array(root)}));
 return new TurretPreview({level:{placements:[placement]},rigs:new Map([[placement.id,{root,parts,instances}]]),visibility:world.visibility},()=>{},()=>.5,null,[]);
}

// One representative of every current zone species on every complete route.
// Coverage uses 1-unit midpoint bins; clearance also samples both endpoints.
// The bounds enclose actual occupied vertices, not an inflated bind-pose box.
export function auditRouteGeometry(level,sites,models){
 const types=[...new Set(MIXED_PREVIEW_ACTORS[level.zone].map(a=>a.model))],routes=levelRoutes(level),actors=routes.flatMap(route=>types.map(model=>({id:'survey-'+route.id+'-'+model,model,variant:'base',routeId:route.id,distance:0})));
 const world=buildWorld(level,models,{actors}),enemies=new EnemyPreview(world,()=>{},null,actors),shapes=enemies.states.map(s=>s.rig.bones.map(b=>vertices(b.part))),envelopes=defenceEnvelopes(world),failures=[],coverage=[];
 let sampledPoses=0,checkedParts=0;
 const fail=message=>{if(failures.length<32)failures.push(message);};
 try{
  const maximum=Math.max(...enemies.states.map(s=>s.path.length));
  for(let distance=0;distance<=maximum;distance++){
   for(const s of enemies.states)s.seed=Math.min(distance,s.path.length-1e-6);enemies.reset();
   for(let i=0;i<enemies.states.length;i++){
    const s=enemies.states[i];if(distance>s.path.length)continue;sampledPoses++;
    for(let j=0;j<s.rig.bones.length;j++){
     const bone=s.rig.bones[j],b=boundsFor(shapes[i][j],bone.instance.matrix),at=`${s.routeId}/${s.model}/${bone.part.id}@${distance}`;checkedParts++;
     if(blocked(b,world.visibility))fail(at+': scenery/terrain');
     if(b[0]<-1e-4||b[2]<-1e-4||b[3]>world.width+1e-4||b[5]>world.length+1e-4)fail(at+': outside map');
     for(const defence of envelopes){let hit=overlap(b,defence.bounds);if(hit&&defence.round){const d=defence.bounds,x=(d[0]+d[3])/2,z=(d[2]+d[5])/2,dx=Math.max(b[0]-x,0,x-b[3]),dz=Math.max(b[2]-z,0,z-b[5]);hit=dx*dx+dz*dz<defence.radius**2-1e-4;}if(hit)fail(at+': '+defence.id);}
    }
   }
  }
  const probes=sites.flatMap(site=>['base','upgrade1'].map(variant=>({site,variant,gun:probeGun(world,models,site,variant),flags:enemies.states.map(s=>new Uint8Array(s.path.length))})));
  try{
   for(let distance=0;distance<maximum;distance++){
    for(const s of enemies.states)s.seed=Math.min(distance+.5,s.path.length-1e-6);enemies.reset();
    for(const probe of probes)for(let i=0;i<enemies.states.length;i++){const target=enemies.states[i];if(distance<target.path.length)probe.flags[i][distance]=Number(probe.gun.eligible(probe.gun.states[0],target,0)&&probe.gun.eligible(probe.gun.states[0],target,TURRET_RECOIL.distance));}
   }
   for(const site of sites){
    const row={id:site.id,group:site.group,box:site.box,routes:{}};
    for(const route of routes){
     const routeRow={length:(route.path.length-1)*24,ideal:Object.fromEntries([48,72,96,120].map(range=>[range,+productionCoverage(route.path,...site.box,range).toFixed(2)])),eligible:{}};
     for(const probe of probes.filter(p=>p.site===site))routeRow.eligible[probe.variant]=Object.fromEntries(enemies.states.flatMap((s,i)=>s.routeId===route.id?[[s.model,intervals(probe.flags[i])]]:[]));
     row.routes[route.id]=routeRow;
    }coverage.push(row);
   }
  }finally{for(const p of probes)p.gun.dispose();}
 }finally{enemies.dispose();disposeWorld(world);}
 return {sampling:'Clearance: 1-unit canonical route poses and endpoints, actual occupied-part vertex envelopes against exact static cuboids and complete defence motion envelopes. Coverage: 1-unit midpoint bins, both actual muzzle rays at zero/full recoil; base/upgrade1 guns only. Ideal120 is missile range geometry, not a flight prediction.',sampledPoses,checkedParts,failures,coverage};
}

export function auditCombat(level,models,frames=7200){
 const hasMissiles=level.placements.some(p=>p.model==='missile-launcher'),actors=MIXED_PREVIEW_ACTORS[level.zone],world=buildWorld(level,models,{actors:[...actors,...(hasMissiles?MISSILE_PREVIEW_ACTORS:[])]}),enemies=new EnemyPreview(world,()=>{},null,actors),hits={},failures=[];
 let seed=232,launches=0,claimsSeen=false;
 const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const defence=new DefencePreview(world,()=>{},random,null,enemies.states,(target,strength,vx,vy,vz)=>{const applied=enemies.takeHit(target,strength,vx,vy,vz);if(applied){const key=target.routeId+'/'+target.model+'/'+strength;hits[key]=(hits[key]??0)+applied;}return applied;},null,()=>{});
 const originalStrengths=defence.states.map(s=>s.strength),initial=enemies.states.map(s=>s.rig.bones.map(b=>Array.from(b.instance.matrix)));let result;
 try{
  const pool=defence.missiles.pool;
  if(pool){const launch=pool.launch.bind(pool);pool.launch=(index,target,strength)=>{const before=pool.incomingDamage(target),accepted=launch(index,target,strength);if(accepted){launches++;if(before>=target.health.current)failures.push('Surplus missile launch');if(Math.abs(pool.incomingDamage(target)-before-strength)>1e-6)failures.push('Missile claim mismatch');}return accepted;};}
  for(let i=0;i<frames;i++){enemies.advance(1/60);defence.advance(1/60);if(pool)for(const target of enemies.states)claimsSeen||=pool.incomingDamage(target)>0;}
  const counts=defence.states.map(s=>s.thinkCount);
  if(defence.planner.thinks!==frames||Math.max(...counts)-Math.min(...counts)>1)failures.push('Shared thinker allocation mismatch');
  result={seconds:frames/60,frames,thinkCounts:counts,shots:Object.fromEntries(defence.states.map(s=>[s.id,s.cycle.shots])),strengths:originalStrengths,hits,launches,claimsSeen,missileHits:pool?.hits??0,remaining:enemies.states.map(s=>({id:s.id,route:s.routeId,health:s.health.current})),enhancers:defence.enhancers.states.map(s=>({id:s.id,active:s.active,recipientIds:[...s.recipientIds]}))};
  for(let repeat=0;repeat<2;repeat++){
   enemies.reset();defence.resetTargets();
   if(JSON.stringify(defence.states.map(s=>s.strength))!==JSON.stringify(originalStrengths))failures.push('Reset compounded enhancement');
   if(defence.planner.thinks!==0)failures.push('Planner reset failed');
   for(let i=0;i<enemies.states.length;i++){const s=enemies.states[i];if(s.health.current!==s.health.maximum||(pool?.incomingDamage(s)??0)!==0||JSON.stringify(s.rig.bones.map(b=>Array.from(b.instance.matrix)))!==JSON.stringify(initial[i]))failures.push('Enemy/claim/pose reset failed: '+s.id);}
  }
 }finally{defence.dispose();enemies.dispose();disposeWorld(world);}
 if(world.actors.size||world.rigs.size||defence.states.length)failures.push('Scene references survived disposal');
 return {...result,failures};
}
