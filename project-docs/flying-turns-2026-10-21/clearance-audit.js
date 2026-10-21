// Bounded native geometry/traffic audit. Writes evidence in this folder only.
// bun docs/flying-turns-2026-10-21/clearance-audit.js [--pin]
import {createHash} from 'node:crypto';
import {buildWorld,disposeWorld} from '../../engine/world.js';
import {EnemyPreview} from '../../game/enemy-preview.js';
import {PathMotion} from '../../engine/path-motion.js';
import {FlightPathMotion} from '../../engine/flight-path-motion.js';
import {ENEMY_EXPANSION_MOVEMENT} from '../../engine/enemy-expansion-gait.js';
import {ENEMY_EXPANSION_RIGS} from '../../shared/enemy-expansion-rigs.js';
import {DOG_WALK} from '../../engine/dog-gait.js';
import {WALKER_WALK,SPIDER_WALK} from '../../engine/articulated-gait.js';
import {PLAY_CONFIG} from '../../play/config.js';
import {createPlacementRules,enemyRouteEnvelope} from '../../play/placement.js';
import {levelRoutes} from '../../shared/routes.js';
import {wildlifeActorsForLevel} from '../../game/wildlife-preview.js';

const ROOT=new URL('../../',import.meta.url),AIR=['moth','twin-fan','ray','lantern'],EPS=1e-5;
const models=new Map(),sources=new Map(),usedPaths=new Set(),started=Date.now();
const policies=['mixed','arc-heavy','missile-heavy','adaptive-gen','adaptive-control'];
const pin=process.argv.includes('--pin');
const runtimePaths=['docs/flying-turns-2026-10-21/clearance-audit.js','engine/flight-path-motion.js','engine/path-motion.js','engine/enemy-expansion-gait.js','engine/enemy-impact.js','engine/dog-gait.js','engine/articulated-gait.js','engine/rig.js','engine/world.js','engine/visibility.js','game/enemy-preview.js','game/wildlife-preview.js','play/config.js','play/placement.js','shared/enemy-expansion-rigs.js','shared/enemy-roster.js','shared/enemy.js','shared/routes.js','shared/grid.js','shared/level.js','shared/model.js','shared/math.js','shared/terrain.js','shared/bridges.js'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const observedHashes=new Map(pin?await Promise.all(runtimePaths.map(async p=>[p,digest(new Uint8Array(await Bun.file(new URL(p,ROOT)).arrayBuffer()))])):[]);
async function json(path){usedPaths.add(path);const bytes=new Uint8Array(await Bun.file(new URL(path,ROOT)).arrayBuffer());if(pin)observedHashes.set(path,digest(bytes));return JSON.parse(new TextDecoder().decode(bytes));}
async function model(id){if(!models.has(id))models.set(id,await json('assets/models/'+id+'.json'));return models.get(id);}
const evidence=new Map();for(const policy of policies)evidence.set(policy,await json('docs/balance-review-2026-10-21/'+policy+'.json'));
const movement={dog:DOG_WALK,walker:WALKER_WALK,spider:SPIDER_WALK,...ENEMY_EXPANSION_MOVEMENT};
const profile=(level,wave,id)=>({...PLAY_CONFIG.enemies[id],...(wave?.enemyOverrides[id]??level.waves[0].enemyOverrides[id])});
function localBox(part){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const c of part.voxels)for(let a=0;a<3;a++){b[a]=Math.min(b[a],c[a]);b[a+3]=Math.max(b[a+3],c[a]+1);}return b;}
function transformBox(b,m,out=new Float64Array(6)){out[0]=out[1]=out[2]=Infinity;out[3]=out[4]=out[5]=-Infinity;for(const x of [b[0],b[3]])for(const y of [b[1],b[4]])for(const z of [b[2],b[5]])for(let a=0;a<3;a++){const p=m[a]*x+m[a+4]*y+m[a+8]*z+m[a+12];out[a]=Math.min(out[a],p);out[a+3]=Math.max(out[a+3],p);}return out;}
function overlap(a,b,o=0){return a[0]<b[o+3]-EPS&&a[3]>b[o]+EPS&&a[1]<b[o+4]-EPS&&a[4]>b[o+1]+EPS&&a[2]<b[o+5]-EPS&&a[5]>b[o+2]+EPS;}
function intersectTree(b,tree){const leaves=[];for(let n=0;n<tree.nodeCount;){if(overlap(b,tree.bounds,n*6)){if(tree.escape[n]===n+1)leaves.push(n);n++;}else n=tree.escape[n];}return leaves;}
function actualPartBox(bone){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],m=bone.instance.matrix;for(const c of bone.part.voxels)for(const x of [c[0],c[0]+1])for(const y of [c[1],c[1]+1])for(const z of [c[2],c[2]+1])for(let a=0;a<3;a++){const p=m[a]*x+m[a+4]*y+m[a+8]*z+m[a+12];b[a]=Math.min(b[a],p);b[a+3]=Math.max(b[a+3],p);}return b;}
function cubeHitsBox(cell,m,b,o){
 const centre=[0,1,2].map(a=>m[a]*(cell[0]+.5)+m[a+4]*(cell[1]+.5)+m[a+8]*(cell[2]+.5)+m[a+12]),t=centre.map((v,a)=>v-(b[o+a]+b[o+a+3])*.5),e=[0,1,2].map(a=>(b[o+a+3]-b[o+a])*.5),axes=[[1,0,0],[0,1,0],[0,0,1]],u=[[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]];
 for(const v of u)axes.push(v);
 for(const v of u)for(let a=0;a<3;a++)axes.push(a===0?[0,v[2],-v[1]]:a===1?[-v[2],0,v[0]]:[v[1],-v[0],0]);
 for(const a of axes){if(Math.hypot(...a)<1e-8)continue;const gap=Math.abs(a[0]*t[0]+a[1]*t[1]+a[2]*t[2]),ra=.5*u.reduce((s,v)=>s+Math.abs(a[0]*v[0]+a[1]*v[1]+a[2]*v[2]),0),rb=Math.abs(a[0])*e[0]+Math.abs(a[1])*e[1]+Math.abs(a[2])*e[2];if(gap>=ra+rb-EPS)return false;}return true;
}
function refineStatic(bone,tree,leaves){const b=actualPartBox(bone);for(const leaf of leaves)if(overlap(b,tree.bounds,leaf*6))for(const cell of bone.part.voxels)if(cubeHitsBox(cell,bone.instance.matrix,tree.bounds,leaf*6))return {leaf,bounds:Array.from(tree.bounds.slice(leaf*6,leaf*6+6)),cell:cell.slice(0,3)};return null;}

const report={recordedAt:new Date().toISOString(),status:pin?'pinned':'exploratory-unpinned',method:{geometry:'All four flyer models on every current production route at altitude44; finite EnemyPreview current articulated poses; 1 authored-unit sample step plus four wing/rotor phase offsets at corner centres and tangent joins. Conservative transformed part-box versus exact occupied static cuboid BVH; candidate overlaps refined to actual voxel OBB versus cuboid SAT. Terrain and bridges are in the static tree. No GPU, combat, model or browser changes.',traffic:'All64 finite schedules,120Hz unarmed root samples; current FlightPathMotion for air and PathMotion for ground, speed/HP/altitude profiles from each wave; conservative full-animation horizontal circles, vertical envelopes and all same-wave actor pairs. Negative bounds are candidates, not proof of actual mesh overlap.',placements:'Frozen five policy witnesses from the pre-flight balance review, every recorded wave and all recorded simultaneous deployments; current production placement.check with critters false. Includes current support, visibility, movement/scenery/route/unit clearance. Does not rerun wildlife habitat relocation or combat.'},geometry:[],traffic:[],placements:[],sourceHashes:null,limits:['Geometry and traffic are finite samples, not continuous collision proofs.','The four flyer cross-zone cases are stress cases; report distinguishes species actually scheduled in each level.','Natural wing/rotor phases are sampled along the entire route; three additional offsets at bends do not exhaust all independent phases.','Unarmed traffic has no missile impact displacement.','Legal frozen placements establish retained availability, not retained campaign victory or optimality.']};

for(const levelConfig of PLAY_CONFIG.levels){
 const source=await json('assets/levels/'+levelConfig.id+'.json');sources.set(source.id,source);
 for(const id of new Set([...source.placements.map(p=>p.model),...Object.keys(PLAY_CONFIG.defences),...Object.keys(PLAY_CONFIG.enemies),...wildlifeActorsForLevel(source).map(a=>a.model)]))await model(id);
 const level=structuredClone(source);level.placements=level.placements.filter(p=>models.get(p.model).role==='scenery');delete level.previewMode;delete level.previewActors;delete level.actorRoutes;
 const actors=levelRoutes(level).flatMap(r=>AIR.map(id=>({id:'flight-'+r.id+'-'+id,model:id,variant:'base',routeId:r.id,distance:0}))),world=buildWorld(level,models,{actors});
 const settings=Object.fromEntries(AIR.map(id=>[id,{...movement[id],speed:profile(levelConfig,null,id).speed,altitude:44}])),preview=new EnemyPreview(world,()=>{},null,actors,{finite:true,movement:settings});
 try{
  for(const s of preview.states){
   s.phase='active';const local=s.rig.bones.map(b=>localBox(b.part)),out=new Float64Array(6),row={level:source.id,route:s.routeId,species:s.model,scheduledHere:levelConfig.waves.some(w=>w.spawns.some(p=>p.model===s.model&&p.routeId===s.routeId)),speed:s.movement.speed,length:s.path.length,poses:0,partChecks:0,coarseCandidates:0,refinedCandidates:0,maxBank:0,minWorldMargin:Infinity,failures:[]};
   const cornerDistances=[];for(let i=1;i<s.path.heading.length;i++)if(s.path.heading[i]!==s.path.heading[i-1])cornerDistances.push(s.path.distance[i]-12,s.path.distance[i],s.path.distance[i]+12);
   const samples=[];for(let d=0;d<=s.path.length;d++)samples.push([d,0]);for(const d of cornerDistances)for(const phase of [1/18,1/9,1/6])samples.push([d,phase]);
   for(const[d,phase]of samples){s.distance=d;s.time=d/s.movement.speed+phase;preview.pose(0,[s]);row.poses++;row.maxBank=Math.max(row.maxBank,Math.abs(s.gait.bodyRoll));
    for(let i=0;i<s.rig.bones.length;i++){const bone=s.rig.bones[i],b=transformBox(local[i],bone.instance.matrix,out);row.partChecks++;row.minWorldMargin=Math.min(row.minWorldMargin,b[0],b[2],world.width-b[3],world.length-b[5]);const leaves=intersectTree(b,world.visibility);if(leaves.length){row.coarseCandidates++;const hit=refineStatic(bone,world.visibility,leaves);row.refinedCandidates++;if(hit&&row.failures.length<12)row.failures.push({distance:d,phase,part:bone.part.id,...hit});}}
   }
   if(row.minWorldMargin< -EPS)row.failures.push({kind:'world-bound',margin:row.minWorldMargin});report.geometry.push(row);
  }
 }finally{preview.dispose();disposeWorld(world);}
 console.log(JSON.stringify({section:'geometry',level:source.id,poses:report.geometry.filter(r=>r.level===source.id).reduce((s,r)=>s+r.poses,0),failures:report.geometry.filter(r=>r.level===source.id).flatMap(r=>r.failures).length,elapsedSeconds:(Date.now()-started)/1000}));

 const routes=new Map(levelRoutes(source).map(r=>[r.id,r.path]));
 for(const wave of levelConfig.waves){
  const a=wave.spawns.map(spawn=>{const p=profile(levelConfig,wave,spawn.model),rule=movement[spawn.model],path=new(rule.airborne?FlightPathMotion:PathMotion)(routes.get(spawn.routeId),rule.turnDistance),envelope=enemyRouteEnvelope(models.get(spawn.model),p);return {...spawn,speed:p.speed,path,envelope,radius:envelope.radius,airborne:!!rule.airborne,sample:new Float64Array(5)};}),end=Math.max(...a.map(s=>s.at+s.path.length/s.speed)),row={level:source.id,wave:wave.id,end,checks:0,airChecks:0,minimum:Infinity,airMinimum:Infinity,worst:null,airWorst:null,candidates:[]},pairs=new Map();
  for(let tick=0;tick<=Math.ceil(end*120);tick++){const time=tick/120,active=a.filter(s=>time>=s.at&&time<s.at+s.path.length/s.speed);for(const s of active)s.path.sample((time-s.at)*s.speed,s.sample);
   for(let i=0;i<active.length;i++)for(let j=0;j<i;j++){const x=active[i],y=active[j];if(x.envelope.top<=y.envelope.bottom||y.envelope.top<=x.envelope.bottom)continue;const distance=Math.hypot(x.sample[0]-y.sample[0],x.sample[1]-y.sample[1]),clearance=distance-x.radius-y.radius,detail={time,first:x.id,second:y.id,firstModel:x.model,secondModel:y.model,distance,firstRoute:x.routeId,secondRoute:y.routeId};row.checks++;if(clearance<row.minimum){row.minimum=clearance;row.worst=detail;}if(x.airborne||y.airborne){row.airChecks++;if(clearance<row.airMinimum){row.airMinimum=clearance;row.airWorst=detail;}}if(clearance< -EPS){const key=x.id+':'+y.id;if(!pairs.has(key))pairs.set(key,{...detail,clearance});}}
  }
  row.candidates=[...pairs.values()];report.traffic.push(row);
 }
 const rules=createPlacementRules(source,models,{config:PLAY_CONFIG,critters:false});
 try{for(const[policy,data]of evidence){const rows=data.results[0].waves.filter(w=>w.wave.startsWith(levelConfig.waves[0].id.split('-wave-')[0]+'-wave-'));for(const w of rows){const row={policy,wave:w.wave,level:source.id,checked:w.placements.length,failures:[]};for(const p of w.placements){const result=rules.check(p.box,p.variant,w.placements,p.id,p.model);if(!result.valid)row.failures.push({id:p.id,model:p.model,variant:p.variant,box:p.box,...result});}report.placements.push(row);}}}finally{rules.dispose();}
 console.log(JSON.stringify({section:'traffic-placements',level:source.id,trafficCandidates:report.traffic.filter(r=>r.level===source.id).reduce((s,r)=>s+r.candidates.length,0),placementFailures:report.placements.filter(r=>r.level===source.id).reduce((s,r)=>s+r.failures.length,0),elapsedSeconds:(Date.now()-started)/1000}));
}

report.summary={levels:PLAY_CONFIG.levels.length,routes:report.geometry.length/AIR.length,geometryCases:report.geometry.length,geometryPoses:report.geometry.reduce((s,r)=>s+r.poses,0),geometryPartChecks:report.geometry.reduce((s,r)=>s+r.partChecks,0),geometryFailures:report.geometry.reduce((s,r)=>s+r.failures.length,0),trafficWaves:report.traffic.length,trafficPairChecks:report.traffic.reduce((s,r)=>s+r.checks,0),airTrafficPairChecks:report.traffic.reduce((s,r)=>s+r.airChecks,0),airMinimumClearance:Math.min(...report.traffic.map(r=>r.airMinimum)),trafficCandidatePairs:report.traffic.reduce((s,r)=>s+r.candidates.length,0),airTrafficCandidatePairs:report.traffic.reduce((s,r)=>s+r.candidates.filter(c=>AIR.includes(c.firstModel)||AIR.includes(c.secondModel)).length,0),frozenArrangements:report.placements.length,frozenPlacementChecks:report.placements.reduce((s,r)=>s+r.checked,0),frozenPlacementFailures:report.placements.reduce((s,r)=>s+r.failures.length,0),elapsedSeconds:(Date.now()-started)/1000};
if(pin){report.sourceHashes=Object.fromEntries(await Promise.all([...new Set([...usedPaths,...runtimePaths])].map(async p=>{const hash=digest(new Uint8Array(await Bun.file(new URL(p,ROOT)).arrayBuffer()));if(hash!==observedHashes.get(p))throw new Error('Source changed during pinned audit: '+p);return[p,hash];})));report.sourceIdentityVerifiedBeforeAndAfter=true;}
await Bun.write(new URL(pin?'clearance.json':'clearance-exploratory.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
