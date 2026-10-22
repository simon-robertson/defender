// Offline sampled physical audit. Production poses, exact occupied-box unions,
// independent 15-axis OBB SAT. This is not continuous collision certification.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PLAY_CONFIG} from '../play/config.js';
import {PlayEnemies} from '../play/enemies.js';
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../play/engine.js';
import {TURRET_RECOIL} from '../shared/arsenal.js';
import {defenceMovementShapes} from '../play/placement.js';

const ROOT=new URL('../',import.meta.url),args=process.argv.slice(2),option=name=>args.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3),hz=Number(option('hz')??4),EPS=1e-4;
assert(hz>=1&&hz<=120);
const cache=new Map(),localBoxes=new WeakMap(),nativeFetch=globalThis.fetch;
globalThis.fetch=async url=>{const match=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);assert(match);const key=match[1]+'/'+match[2];if(!cache.has(key))cache.set(key,await Bun.file(new URL('assets/'+key+'.json',ROOT)).json());return {ok:true,json:async()=>({asset:structuredClone(cache.get(key))})};};
const hash=async path=>createHash('sha256').update(new Uint8Array(await Bun.file(new URL(path,ROOT)).arrayBuffer())).digest('hex');
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function occupied(part){
 if(localBoxes.has(part))return localBoxes.get(part);
 const cells=new Set(part.voxels.map(c=>c.slice(0,3).join(','))),boxes=[],key=(x,y,z)=>x+','+y+','+z;
 for(const [x,y,z]of part.voxels){if(!cells.has(key(x,y,z)))continue;let ex=x+1,ez=z+1,ey=y+1;
  while(cells.has(key(ex,y,z)))ex++;
  outerZ:while(true){for(let ix=x;ix<ex;ix++)if(!cells.has(key(ix,y,ez)))break outerZ;ez++;}
  outerY:while(true){for(let iz=z;iz<ez;iz++)for(let ix=x;ix<ex;ix++)if(!cells.has(key(ix,ey,iz)))break outerY;ey++;}
  for(let iy=y;iy<ey;iy++)for(let iz=z;iz<ez;iz++)for(let ix=x;ix<ex;ix++)cells.delete(key(ix,iy,iz));boxes.push([x,y,z,ex,ey,ez]);
 }
 assert.equal(boxes.reduce((n,b)=>n+(b[3]-b[0])*(b[4]-b[1])*(b[5]-b[2]),0),part.voxels.length,'Merged boxes preserve exact occupied volume');localBoxes.set(part,boxes);return boxes;
}
function boxOBB(b,m,part='static'){
 const p=[(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2],half=[(b[3]-b[0])/2,(b[4]-b[1])/2,(b[5]-b[2])/2],axes=[[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]],centre=[0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]),bounds=[];
 for(let i=0;i<3;i++){const r=axes.reduce((n,a,j)=>n+Math.abs(a[i])*half[j],0);bounds[i]=centre[i]-r;bounds[i+3]=centre[i]+r;}
 return {centre,half,axes,bounds,part};
}
const ID=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function broad(a,b,offset=0){return a[0]<b[offset+3]-EPS&&a[3]>b[offset]+EPS&&a[1]<b[offset+4]-EPS&&a[4]>b[offset+1]+EPS&&a[2]<b[offset+5]-EPS&&a[5]>b[offset+2]+EPS;}
function intersects(a,b){
 if(!broad(a.bounds,b.bounds))return false;
 const d=a.centre.map((v,i)=>v-b.centre[i]),axes=[...a.axes,...b.axes];
 for(const u of a.axes)for(const v of b.axes)axes.push([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]);
 for(const axis of axes){const length=Math.hypot(...axis);if(length<1e-7)continue;const radius=a.axes.reduce((n,u,i)=>n+Math.abs(dot(axis,u))*a.half[i],0)+b.axes.reduce((n,u,i)=>n+Math.abs(dot(axis,u))*b.half[i],0);if(Math.abs(dot(axis,d))>=radius-EPS*length)return false;}
 return true;
}
function posed(data){
 const parts=data.bones?data.bones.map(b=>({part:b.part,matrix:b.instance.matrix})):data.parts.map(part=>({part,matrix:data.instances.find(i=>i.part===part.id).matrix})),boxes=[];
 for(const {part,matrix}of parts)for(const b of occupied(part))boxes.push(boxOBB(b,matrix,part.id));
 const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const box of boxes)for(let i=0;i<3;i++){bounds[i]=Math.min(bounds[i],box.bounds[i]);bounds[i+3]=Math.max(bounds[i+3],box.bounds[i+3]);}return {boxes,bounds};
}
function pairHit(a,b){if(!broad(a.bounds,b.bounds))return null;for(const x of a.boxes)for(const y of b.boxes)if(intersects(x,y))return {partA:x.part,partB:y.part};return null;}
function staticHit(actor,tree,staticCache){
 for(const box of actor.boxes){let node=0;while(node<tree.nodeCount){if(!broad(box.bounds,tree.bounds,node*6)){node=tree.escape[node];continue;}if(tree.escape[node]===node+1){let obstacle=staticCache.get(node);if(!obstacle){obstacle=boxOBB(tree.bounds.slice(node*6,node*6+6),ID);staticCache.set(node,obstacle);}if(intersects(box,obstacle))return {part:box.part,obstacle:obstacle.bounds};}node++;}}
 return null;
}
function record(row,kind,key,event){row.counts[kind]++;const id=kind+':'+key;if(!row.examples.has(id))row.examples.set(id,event);}
function sample(row,enemies,world,time,defences=[]){
 row.samples++;const actors=enemies.activeTargets.map(state=>({state,...posed(state.rig)}));row.actorPoses+=actors.length;
 for(let i=0;i<actors.length;i++){const actor=actors[i],s=actor.state;row.minY[s.model]=Math.min(row.minY[s.model]??Infinity,actor.bounds[1]);
  const hit=staticHit(actor,world.visibility,row.staticCache);if(hit)record(row,'static',s.model+':'+s.routeId+':'+hit.part,{time,id:s.id,model:s.model,route:s.routeId,distance:s.distance,...hit});
  for(const defence of defences){const hit=pairHit(actor,defence);if(hit)record(row,'defence',s.id+':'+defence.id,{time,id:s.id,model:s.model,defence:defence.id,...hit});}
  for(let j=i+1;j<actors.length;j++){const other=actors[j],hit=pairHit(actor,other);if(hit)record(row,'enemy',s.id+':'+other.state.id,{time,id:s.id,other:other.state.id,models:[s.model,other.state.model],routes:[s.routeId,other.state.routeId],distances:[s.distance,other.state.distance],...hit});}
 }
}
function rowFor(wave,mode){return {wave:wave.id,mode,samples:0,actorPoses:0,counts:{static:0,defence:0,enemy:0},examples:new Map(),staticCache:new Map(),minY:{}};}
function result(row){const {examples,staticCache,...rest}=row;return {...rest,examples:[...examples.values()].slice(0,40),uniqueOverlaps:examples.size};}
async function unopposed(level,wave){
 const world=await loadPlayWorld(level.id,{wave,config:PLAY_CONFIG,conditions:{night:false}}),row=rowFor(wave,'unopposed'),enemies=new PlayEnemies(world,{config:PLAY_CONFIG,wave});
 try{
  enemies.prepare();enemies.spawnDue(0);let nextSample=0;
  while(!enemies.complete&&enemies.time<180){
   if(enemies.time>=nextSample-1e-9){sample(row,enemies,world,enemies.time);nextSample+=1/hz;}
   const step=Math.min(nextSample-enemies.time,enemies.nextSpawn()-enemies.time,enemies.nextExit());
   if(step>1e-10)enemies.advance(step);enemies.spawnDue(enemies.time);enemies.resolveExits();
  }
  assert(enemies.complete,'Unopposed timeline completes');return result(row);
 }finally{enemies.dispose();disposePlayWorld(world);}
}
async function mixed(level,wave,placements){
 const world=await loadPlayWorld(level.id,{wave,config:PLAY_CONFIG,placements,conditions:{night:false}}),row=rowFor(wave,'actual-mixed-combat'),engine=new PlayEngine(world,{config:PLAY_CONFIG,wave});
 try{
  engine.startWave();sample(row,engine.enemies,world,0,[...world.rigs].filter(([,r])=>r.role==='defence').map(([id,r])=>({id,...posed(r)})));
  while(engine.running&&engine.waveTime<180){engine.advance(1/hz);const defences=[...world.rigs].filter(([,r])=>r.role==='defence').map(([id,r])=>({id,...posed(r)}));sample(row,engine.enemies,world,engine.waveTime,defences);}
  assert(engine.completed);return {...result(row),killed:engine.enemies.killed,escaped:engine.enemies.escaped,shots:engine.firing.shots};
 }finally{engine.dispose();disposePlayWorld(world);}
}
async function pitchWindows(placements){
 const level=PLAY_CONFIG.levels[1],wave=level.waves[0],guns=placements.filter(p=>p.model==='turret-study'),world=await loadPlayWorld(level.id,{wave,config:PLAY_CONFIG,placements:guns}),engine=new PlayEngine(world,{config:PLAY_CONFIG,wave}),rows=[];
 try{
  const target=engine.enemies.states.find(s=>s.model==='moth');assert(target);target.phase='active';target.health.reset();engine.enemies.activeTargets.push(target);
  for(const gun of engine.firing.turrets.states){let eligible=0,pitchReachable=0,inRange=0,minPitch=Infinity,maxPitch=-Infinity;const windows=[];let start=null;
   for(let distance=0;distance<target.path.length;distance++){
    target.distance=distance+.5;target.time=target.distance/target.movement.speed;engine.enemies.preview.pose();gun.targeting.solve(gun.x,gun.z,target);const yaw=engine.firing.turrets.targetYaw(gun),pitch=engine.firing.turrets.targetPitch(gun,target,yaw),range=(gun.x-target.x)**2+(gun.z-target.z)**2<=gun.maxRange**2,reachable=gun.pitch.reachable(pitch),good=engine.firing.turrets.eligible(gun,target,0)&&engine.firing.turrets.eligible(gun,target,TURRET_RECOIL.distance);
    if(range)inRange++;if(range&&reachable){pitchReachable++;minPitch=Math.min(minPitch,pitch);maxPitch=Math.max(maxPitch,pitch);}if(good){eligible++;if(start===null)start=distance;}else if(start!==null){windows.push([start,distance]);start=null;}
   }
   if(start!==null)windows.push([start,target.path.length]);rows.push({id:gun.id,variant:gun.variant,range:gun.maxRange,altitude:target.altitude,routeLength:target.path.length,inRangeUnits:inRange,pitchReachableUnits:pitchReachable,eligibleUnits:eligible,eligibleSeconds:eligible/target.movement.speed,windows,pitchDegrees:eligible?[minPitch*180/Math.PI,maxPitch*180/Math.PI]:null});
  }
  return rows;
 }finally{engine.dispose();disposePlayWorld(world);}
}
try{
 // Sanity-check the independent SAT at contact, genuine overlap and separation.
 const a=boxOBB([0,0,0,1,1,1],ID);assert(!intersects(a,boxOBB([1,0,0,2,1,1],ID)));assert(intersects(a,boxOBB([.5,.5,.5,1.5,1.5,1.5],ID)));assert(!intersects(a,boxOBB([2,0,0,3,1,1],ID)));
 const paths=['play/config.js','play/engine.js','play/enemies.js','play/placement.js','engine/enemy-expansion-gait.js','engine/dog-gait.js',...PLAY_CONFIG.levels.map(l=>'assets/levels/'+l.id+'.json'),...Object.keys(PLAY_CONFIG.enemies).concat(['turret-study','arc-spire','missile-launcher']).map(id=>'assets/models/'+id+'.json')],sourceHashes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,await hash(p)]))),rows=[];
 if(!args.includes('--mixed-only'))for(const level of PLAY_CONFIG.levels)for(const wave of [level.waves.at(-1)]){const row=await unopposed(level,wave);rows.push(row);console.log(JSON.stringify(row));}
 let gunPitch=[];const mixedPath=option('mixed');
 if(mixedPath){const report=await Bun.file(mixedPath).json(),witness=report.results.find(r=>r.name==='mixed');assert(witness);for(const entry of witness.waves){const level=PLAY_CONFIG.levels.find(l=>l.waves.some(w=>w.id===entry.wave)),wave=level.waves.find(w=>w.id===entry.wave);if(args.includes('--mixed-all')||wave===level.waves.at(-1)){const row=await mixed(level,wave,entry.placements);rows.push(row);console.log(JSON.stringify(row));}}
  gunPitch=await pitchWindows(witness.waves.find(w=>w.wave==='a2-wave-1').placements);
 }
 for(const path of paths)assert.equal(await hash(path),sourceHashes[path],'Audit source did not change: '+path);
 const gunModel=await Bun.file(new URL('assets/models/turret-study.json',ROOT)).json(),gunFullSweepTop=Object.fromEntries(['base','upgrade1','upgrade2'].map(v=>[v,24+Math.max(...defenceMovementShapes(gunModel,v).map(s=>s.bounds[4]))])),sampledMothMinimumY=Math.min(...rows.map(r=>r.minY.moth??Infinity));
 const report={recordedAt:new Date().toISOString(),method:`Final wave of every campaign level. Production poses and exact release/exit boundaries, sampled at ${hz}Hz; no defence fire in unopposed schedules; actual120Hz production combat for mixed-placement probes in fresh isolated scenes using witness placements (not a retained-state balance replay). Exact disjoint local occupied-box unions transformed through current articulated part matrices; independent15-axis separating-axis tests after AABB broad phase, strict overlap tolerance1e-4. Static checks use exact scenery/terrain BVH leaves. No within-actor joint checks, missile/wildlife contact test, between-sample sweep or guarantee for other deployments. Pitch windows use1-unit route midpoint samples and actual gun eligibility with zero/full recoil. Gun sweep tops reuse the conservative placement envelope; their gap to sampled Moth bottom is not a continuous-motion proof.`,sourceHashes,hz,rows,gunPitch,gunFullSweepTop,sampledMothMinimumY,sampledMothGapAboveHighestGun:sampledMothMinimumY-Math.max(...Object.values(gunFullSweepTop)),overlapSamples:rows.reduce((n,r)=>n+r.counts.static+r.counts.defence+r.counts.enemy,0)};
 if(option('output'))await Bun.write(option('output'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.rows.map(({examples,minY,...r})=>r),gunPitch,overlapSamples:report.overlapSamples}));
}finally{globalThis.fetch=nativeFetch;}
