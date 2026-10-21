// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {PREVIEW_LEVELS} from '../shared/preview-levels.js';
import {actorRouteId,levelRoutes,routePath,pathBoxUnion} from '../shared/routes.js';
import {TerrainField} from '../shared/terrain.js';
import {MAX_MODEL_LIGHTS} from '../shared/model-lights.js';
import {MAX_MISSILES,MISSILE_PHASE} from '../shared/missile-flight.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {ModelLights} from '../engine/model-lights.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {missileActorsForLevel} from '../game/missile-preview.js';
import {DefencePreview} from '../game/defence-preview.js';
import {carveLevel} from '../scripts/rebuild-level-layouts.js';

const counts={A:7,B:7,C:4,D:5},library=new Map();
async function modelsFor(level,actors){
 const ids=new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)]);
 for(const id of ids)if(!library.has(id))library.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 return new Map([...ids].map(id=>[id,library.get(id)]));
}
function overlap(a,b,o=0){return a[0]<b[o+3]-1e-5&&a[3]>b[o]+1e-5&&a[1]<b[o+4]-1e-5&&a[4]>b[o+1]+1e-5&&a[2]<b[o+5]-1e-5&&a[5]>b[o+2]+1e-5;}
function blocked(box,tree){let node=0;while(node<tree.nodeCount){if(overlap(box,tree.bounds,node*6)){if(tree.escape[node]===node+1)return true;node++;}else node=tree.escape[node];}return false;}
function wildlifeSupport(preview,world,terrain){
 for(const state of preview.states){
  expect([state.x,state.y,state.z,state.yaw].every(Number.isFinite)).toBe(true);
  const box=[state.x-state.radius,state.y,state.z-state.radius,state.x+state.radius,state.y+state.height,state.z+state.radius];
  expect(box[0]>=0&&box[2]>=0&&box[3]<=world.width&&box[5]<=world.length).toBe(true);
  expect(blocked(box,world.visibility)).toBe(false);
  for(let i=0;i<preview.defences.length;i+=6)expect(overlap(box,preview.defences,i)).toBe(false);
  if(state.kind==='ground'){
   const ground=preview.nav.heights[state.node];expect(Number.isFinite(ground)).toBe(true);
   for(let z=Math.floor(box[2]/24);z<=Math.floor((box[5]-1e-6)/24);z++)for(let x=Math.floor(box[0]/24);x<=Math.floor((box[3]-1e-6)/24);x++)expect(terrain.flatBox(x,z)).toBe(ground);
   expect(state.y).toBeGreaterThanOrEqual(ground);expect(state.y).toBeLessThanOrEqual(ground+state.hop+1e-8);
  }else if(!state.flight){
   expect(state.y).toBe(preview.perches[state.perch].y);
   const m=state.rig.byId.get('body').instance.matrix,cells=world.actors.get(state.id).parts.find(p=>p.id==='body').voxels;
   // Actual authored soles, not just the canopy's enclosing box, support the bird.
   for(const cell of cells)if(cell[1]===0){const x=cell[0]+.5,z=cell[2]+.5,px=m[0]*x+m[8]*z+m[12],py=m[1]*x+m[9]*z+m[13],pz=m[2]*x+m[10]*z+m[14];expect(world.visibility.blocked(px,py-.25,pz,px,py-.01,pz)).toBe(true);}
  }
 }
}

test('authored wildlife seeds retain preload identity, copy their coordinates and reject malformed metadata',()=>{
 const level={id:'moss-01',zone:'A',size:[20,18],previewWildlife:{habitats:[[1,2],[3,4],[5,6]],perches:[{id:'tree-a',point:[11.5,40,11.5]},{id:'tree-b',point:[11.5,42,11.5]},{id:'tree-c',point:[11.5,44,11.5]}]}};
 const result=wildlifeActorsForLevel(level),preload=wildlifeActorsForLevel(level.id),identity=a=>[a.id,a.model,a.variant,a.kind];
 expect(result.map(identity)).toEqual(preload.map(identity));expect(Object.isFrozen(result)).toBe(true);
 for(const actor of result){expect(Object.isFrozen(actor)).toBe(true);expect(Object.isFrozen(actor.habitat??actor.point)).toBe(true);}
 level.previewWildlife.habitats[0][0]=9;level.previewWildlife.perches[0].point[1]=90;
 expect(result[0].habitat).toEqual([1,2]);expect(result[3].point).toEqual([11.5,40,11.5]);
 expect(wildlifeActorsForLevel({id:'moss-01'})).toBe(preload);expect(wildlifeActorsForLevel('unknown')).toHaveLength(0);
 const cases=[l=>l.previewWildlife=null,l=>l.previewWildlife.habitats.pop(),l=>l.previewWildlife.habitats[0]=[20,1],l=>l.previewWildlife.habitats[0]=[1,-1],l=>l.previewWildlife.habitats[0]=[1.5,1],l=>l.previewWildlife.perches.pop(),l=>l.previewWildlife.perches[1].id='tree-a',l=>l.previewWildlife.perches[0].point=[1,Infinity,2]];
 for(const change of cases){const invalid=structuredClone(level);change(invalid);expect(()=>wildlifeActorsForLevel(invalid)).toThrow();}
});

test('saved fourth levels reproduce their current landscape-first carve including runtime metadata',async()=>{
 for(const id of ['moss-04','ochre-04','ice-04','plum-04'])expect(await Bun.file(new URL(`../docs/landscape-reset-2026-10-18/previous-levels/${id}.json`,import.meta.url)).json()).toEqual((await carveLevel(id)).level);
},20000);

for(const profile of PREVIEW_LEVELS)test(`${profile.level}: saved routes, wildlife support and bounded preview ownership`,async()=>{
 const level=await Bun.file(new URL(`../docs/landscape-reset-2026-10-18/previous-levels/${profile.level}.json`,import.meta.url)).json(),before=JSON.stringify(level);
 const enemyActors=previewActorsForLevel(level.id),animals=wildlifeActorsForLevel(level),missileActors=missileActorsForLevel(level.id),actors=[...enemyActors,...animals,...missileActors];
 expect(level.previewWildlife).toBeDefined();expect(enemyActors).toHaveLength(counts[profile.zone]);expect(animals).toHaveLength(6);expect(missileActors).toHaveLength(profile.number>=3?36:0);expect(MAX_MISSILES).toBe(36);
 expect(animals.map(a=>[a.id,a.model,a.variant])).toEqual(wildlifeActorsForLevel(level.id).map(a=>[a.id,a.model,a.variant]));
 const world=buildWorld(level,await modelsFor(level,actors),{actors}),terrain=new TerrainField(level),draws=new Map(world.entries.map(entry=>[entry.key,{transforms:Float32Array.from(entry.transforms.flatMap(m=>Array.from(m)))}]));
 let enemies,wildlife,firing,lights,pool,planner;const changed=(key,index,matrix)=>{draws.get(key).transforms.set(matrix,index*16);lights?.invalidate(key);};
 try{
  enemies=new EnemyPreview(world,changed);wildlife=new WildlifePreview(world,changed);wildlife.setThreatSources(enemies.states);
  firing=new DefencePreview(world,changed,()=>.5,null,enemies.states,null,null,()=>{});pool=firing.missiles.pool;planner=firing.planner;
  lights=new ModelLights(world.entries,draws);lights.prepare();
  expect(world.actors.size).toBe(counts[profile.zone]+6+missileActors.length);expect(lights.authoredCount).toBeLessThanOrEqual(29);expect(lights.authoredCount).toBeLessThanOrEqual(MAX_MODEL_LIGHTS);expect(lights.overflow).toBe(0);expect(lights.count).toBe(lights.authoredCount);
  expect(Boolean(pool)).toBe(profile.number>=3);if(pool)expect(pool.slots).toHaveLength(36);
  expect(wildlife.treePerches.length).toBeGreaterThanOrEqual(3);expect(animals.filter(a=>a.kind==='bird').every(a=>world.rigs.has(a.perch))).toBe(true);wildlifeSupport(wildlife,world,terrain);
  const routes=levelRoutes(level),occupied=new Set(),initial=enemies.states.map(s=>({path:s.path,matrices:s.rig.bones.map(b=>b.instance.matrix),pose:s.rig.bones.map(b=>Array.from(b.instance.matrix))}));
  for(const box of pathBoxUnion(level))expect(terrain.flatBox(box[0],box[2])).toBe(level.pathHeight);
  for(const id of Object.keys(level.actorRoutes??{}))expect(enemyActors.some(a=>a.id===id)).toBe(true);
  for(let i=0;i<enemies.states.length;i++){
   const state=enemies.states[i],routeId=actorRouteId(level,enemyActors[i]),path=routePath(level,routeId);occupied.add(state.routeId);
   expect(state.routeId).toBe(routeId);expect(state.path.length).toBe((path.length-1)*24);expect(state.distance).toBe(state.seed%state.path.length);expect(state.loopSeconds).toBe(state.path.length/state.movement.speed);
  }
  expect([...occupied].sort()).toEqual(routes.map(r=>r.id).sort());
  // Eight seconds lets each authored seed plan and travel, without duplicating
  // long wildlife navigation or per-site damage/coverage audits.
  for(let frame=0;frame<240;frame++){
   const thinks=planner.thinks;enemies.advance(1/30);firing.advance(1/30);wildlife.advance(1/30);lights.prepare();
   expect(planner.thinks-thinks).toBeLessThanOrEqual(1);expect(wildlife.lastThinkWork).toBeLessThanOrEqual(512);
   if(frame%30===0){
    wildlifeSupport(wildlife,world,terrain);expect(Array.from(lights.data).every(Number.isFinite)).toBe(true);
    for(const state of firing.states){expect(Number.isFinite(state.predictedCoverage)).toBe(true);if(state.reservation){expect(enemies.states.includes(state.reservation)).toBe(true);expect(state.reservationLap).toBe(state.reservation.lap);}}
    for(const enemy of enemies.states){expect(Number.isFinite(firing.missiles.incomingDamage(enemy))).toBe(true);for(let i=0;i<firing.states.length;i++)expect(Number.isFinite(planner.capacity(i,enemy))).toBe(true);}
   }
  }
  expect(wildlife.thinkCount).toBe(240);expect(wildlife.states.some(s=>s.journeys>0)).toBe(true);
  const wildlifeTime=wildlife.time;enemies.takeHit(enemies.states[0],1e9);enemies.reset();firing.resetTargets();
  expect(wildlife.time).toBe(wildlifeTime);expect(enemies.alive).toBe(counts[profile.zone]);expect(planner.thinks).toBe(0);
  for(let i=0;i<enemies.states.length;i++){
   const state=enemies.states[i];expect(state.path).toBe(initial[i].path);expect(state.health.current).toBe(state.health.maximum);expect(firing.missiles.incomingDamage(state)).toBe(0);
   for(let j=0;j<state.rig.bones.length;j++){expect(state.rig.bones[j].instance.matrix).toBe(initial[i].matrices[j]);expect(Array.from(state.rig.bones[j].instance.matrix)).toEqual(initial[i].pose[j]);}
  }
  for(const state of firing.states){expect(state.target).toBeNull();expect(state.reservation).toBeNull();}
  if(pool){expect(pool.active).toBe(0);expect(pool.slots.every(s=>s.phase===MISSILE_PHASE.FREE||s.phase===MISSILE_PHASE.LOADED)).toBe(true);for(const state of firing.missiles.states)expect(state.ammo).toBe(state.capacity);}
  expect(JSON.stringify(level)).toBe(before);
 }finally{lights?.dispose();firing?.dispose();wildlife?.dispose();enemies?.dispose();disposeWorld(world);}
 expect(world.actors.size).toBe(0);expect(world.rigs.size).toBe(0);expect(world.entries).toHaveLength(0);expect(world.assetIds).toHaveLength(0);
 expect(wildlife.world).toBeNull();expect(wildlife.nav).toBeNull();expect(wildlife.threatSources).toHaveLength(0);expect(wildlife.perches).toHaveLength(0);
 expect(enemies.world).toBeNull();expect(enemies.paths.size).toBe(0);expect(planner.targets).toHaveLength(0);expect(planner.coverage).toHaveLength(0);expect(lights.sources).toHaveLength(0);
 if(pool){expect(pool.slots).toHaveLength(0);expect(pool.records.size).toBe(0);expect(pool.targets).toBeNull();expect(pool.visibility).toBeNull();}
},20000);
