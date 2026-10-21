// Independent offline authoring/runtime probe. The reach/travel thresholds are
// diagnostics for usable roaming ground, never new wildlife movement rules.
import {createHash} from 'node:crypto';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {TerrainField} from '../shared/terrain.js';
import {levelRoutes,pathBoxUnion} from '../shared/routes.js';
import {actorsForPreview} from '../game/preview-actors.js';
import {previewActorsForLevel,EnemyPreview} from '../game/enemy-preview.js';
import {missileActorsForLevel} from '../game/missile-preview.js';
import {WildlifePreview} from '../game/wildlife-preview.js';
import {DefencePreview} from '../game/defence-preview.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const overlap=(a,b,o)=>a[0]<b[o+3]-1e-5&&a[3]>b[o]+1e-5&&a[1]<b[o+4]-1e-5&&a[4]>b[o+1]+1e-5&&a[2]<b[o+5]-1e-5&&a[5]>b[o+2]+1e-5;
function clearEnvelope(box,world){
 assert(box[0]>=0&&box[2]>=0&&box[3]<=world.width&&box[5]<=world.length,'Wildlife envelope leaves level.');
 const tree=world.visibility;let node=0;
 while(node<tree.nodeCount){if(overlap(box,tree.bounds,node*6)){assert(tree.escape[node]!==node+1,'Wildlife envelope intersects scenery/terrain.');node++;}else node=tree.escape[node];}
}
function checkPose(s,life,world,terrain,meshPose){
 assert([s.x,s.y,s.z,s.yaw].every(Number.isFinite),'Nonfinite wildlife pose.');
 const box=[s.x-s.radius,s.y,s.z-s.radius,s.x+s.radius,s.y+s.height,s.z+s.radius];clearEnvelope(box,world);
 if(s.kind==='ground'){
  const y=life.nav.heights[s.node];
  for(let z=Math.floor(box[2]/24);z<=Math.floor((box[5]-1e-6)/24);z++)for(let x=Math.floor(box[0]/24);x<=Math.floor((box[3]-1e-6)/24);x++)assert(terrain.flatBox(x,z)===y,'Ground wildlife left continuous dry equal-height support.');
  assert(s.y>=y-1e-6&&s.y<=y+s.hop+1e-6,'Ground wildlife lost vertical support.');
 }else if(!s.flight){
  assert(s.y===life.perches[s.perch].y,'Resting bird left perch height.');
  const data=world.actors.get(s.id),m=s.rig.byId.get('body').instance.matrix;
  for(const c of data.parts.find(p=>p.id==='body').voxels)if(c[1]===0)for(const dx of [.1,.9])for(const dz of [.1,.9]){
   const x=c[0]+dx,z=c[2]+dz,px=m[0]*x+m[8]*z+m[12],py=m[1]*x+m[9]*z+m[13],pz=m[2]*x+m[10]*z+m[14];
   assert(world.visibility.blocked(px,py-.25,pz,px,py-.01,pz),'Resting bird lacks sole support.');
  }
 }
 if(meshPose)for(const bone of s.rig.bones){const m=bone.instance.matrix;
  for(const cell of bone.part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){
   const x=cell[0]+dx,y=cell[1]+dy,z=cell[2]+dz,p=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
   assert(p.every((v,i)=>v>=box[i]-1e-4&&v<=box[i+3]+1e-4),'Animated voxel leaves checked wildlife envelope.');
  }
 }
}
export async function auditDPathRuntime(id,seconds=60){
 assert(/^plum-0[1-4]$/.test(id),'Expected D1–D4 source ID.');assert(Number.isInteger(seconds)&&seconds>=1&&seconds<=180,'Expected bounded integer duration.');
 const source=await Bun.file(new URL(`../assets/levels/${id}.json`,import.meta.url)).text(),level=JSON.parse(source),before=JSON.stringify(level),actors=actorsForPreview(level),models=new Map();
 assert(level.previewMode==='layout'&&level.zone==='D'&&level.size[0]===20&&level.size[1]===16,'Expected 20×16 D layout preview.');
 assert(!previewActorsForLevel(level).length&&!missileActorsForLevel(level).length,'Layout restored archived combat actors.');
 for(const model of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)])){const data=await Bun.file(new URL(`../assets/models/${model}.json`,import.meta.url)).json();assert(data.role==='scenery','Layout requested noncosmetic asset.');models.set(model,data);}
 const world=buildWorld(level,models,{actors}),life=new WildlifePreview(world,()=>{}),enemy=new EnemyPreview(world,()=>{}),firing=new DefencePreview(world,()=>{}),terrain=new TerrainField(level),visibility=world.visibility;
 let report;
 try{
  assert(life.states.length===6&&life.states.filter(s=>s.kind==='ground').length===3,'Expected three ground and three bird actors.');
  assert(!enemy.states.length&&!enemy.path&&!firing.states.length&&!firing.planner&&!firing.missiles.pool&&!firing.enhancers.states.length,'Noncombat runtime created combat state.');
  const nav=life.nav,rows=life.states.map(s=>{
   let nodes=0,reach=0;if(s.kind==='ground'){const start=nav.starts[s.groundComponent],end=nav.starts[s.groundComponent+1];nodes=end-start;for(let i=start;i<end;i++){const n=nav.members[i];reach=Math.max(reach,Math.hypot((n%nav.cols+.5)*4-s.x,(Math.floor(n/nav.cols)+.5)*4-s.z));}}
   return {id:s.id,kind:s.kind,start:[s.x,s.y,s.z],reachableNodes:nodes,farthestReach:reach,maxDisplacement:0,visitedPerches:new Set(),flightFrames:0};
  }),identities={nav:life.nav,parents:life.nav.parents,queue:life.nav.queue,explosions:life.explosions,routes:life.states.map(s=>s.route)};
  let maxThinkWork=0,envelopeChecks=0,meshChecks=0;
  for(let frame=0;frame<=seconds*30;frame++){
   if(frame){life.advance(1/30);maxThinkWork=Math.max(maxThinkWork,life.lastThinkWork);assert(life.lastThinkWork<=512,'Wildlife exceeded scheduled planning budget.');}
   for(let i=0;i<life.states.length;i++){
    const s=life.states[i],r=rows[i];try{checkPose(s,life,world,terrain,frame%30===0);}catch(error){throw new Error(`${id} / ${s.id} at frame ${frame}: ${error.message}`,{cause:error});}envelopeChecks++;if(frame%30===0)meshChecks++;
    r.maxDisplacement=Math.max(r.maxDisplacement,Math.hypot(s.x-r.start[0],s.z-r.start[2]));if(s.kind==='bird'){if(s.flight)r.flightFrames++;else r.visitedPerches.add(life.perches[s.perch].id);}
    assert(s.route===identities.routes[i],'Wildlife replaced fixed waypoint storage.');
   }
  }
  assert(life.nav===identities.nav&&life.nav.parents===identities.parents&&life.nav.queue===identities.queue&&life.explosions===identities.explosions,'Wildlife replaced bounded planner/event storage.');assert(life.thinkCount===seconds*30,'Expected one scheduled thinker per frame.');
  for(let i=0;i<rows.length;i++){
   const s=life.states[i],r=rows[i];r.accepted=s.journeys;r.completed=s.journeysCompleted;r.thinkCount=s.thinkCount;r.visitedPerches=[...r.visitedPerches];
   r.passed=r.kind==='ground'?r.farthestReach>=48&&r.maxDisplacement>=24&&r.completed>0:r.flightFrames>0&&r.completed>0&&r.visitedPerches.length>=2;
  }
  const time=life.time;enemy.reset();firing.resetTargets();assert(life.time===time,'Combat reset disturbed cosmetic time.');assert(JSON.stringify(level)===before,'Runtime mutated source.');
  report={id,sourceSha256:createHash('sha256').update(source).digest('hex'),seconds,hz:30,routes:levelRoutes(level).map(r=>({id:r.id,boxes:r.path.length})),unionPathBoxes:pathBoxUnion(level).length,bridgeBoxes:level.bridges?.reduce((n,b)=>n+b.boxes.length,0)??0,resources:{modelAssets:world.assetIds.length,opaqueEntries:world.entries.length,waterQuads:world.water.mesh.quads.length,visibilityPrimitives:visibility.primitiveCount,visibilityBytes:visibility.byteLength,planningBytes:life.planningBytes,explosionEventBytes:life.explosions.byteLength,groundNodes:nav.members.length,treePerches:life.treePerches.length},thinkCount:life.thinkCount,maxThinkWork,envelopeChecks,meshPoseChecks:meshChecks,rows,passed:rows.every(r=>r.passed)};
 }finally{firing.dispose();enemy.dispose();life.dispose();disposeWorld(world);}
 const released=!life.world&&!life.nav&&!life.defences&&!life.explosions&&!life.bounds&&!life.states.length&&!life.perches.length&&!life.treePerches.length&&!world.level&&!world.entries.length&&!world.actors.size&&!world.rigs.size&&!world.visibility&&!visibility.bounds&&!visibility.escape;
 assert(released,'Runtime retained released scene references.');report.released=released;return report;
}
if(import.meta.main){
 const args=process.argv.slice(2),ids=[];let seconds=60;
 for(let i=0;i<args.length;i++){if(args[i]==='--seconds'&&args[i+1])seconds=Number(args[++i]);else ids.push(args[i]);}
 for(const id of ids.length?ids:['plum-01','plum-02','plum-03','plum-04']){
  const report=await auditDPathRuntime(id,seconds);await Bun.write(new URL(`../docs/campaign-completion-2026-10-20/zone-d-${id}-runtime.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id,passed:report.passed,resources:report.resources,completed:report.rows.map(r=>r.completed),released:report.released}));if(!report.passed)process.exitCode=1;
 }
}
