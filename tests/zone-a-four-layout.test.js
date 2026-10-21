// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {zoneAFourLevel,zoneAFourRemovalManifest,ZONE_A_FOUR_SITES} from '../scripts/zone-a-four.js';
import {zoneAFourLandscape,ZONE_A_FOUR_LANDSCAPE_INFO} from '../scripts/zone-a-four-landscape.js';
import {productionCoverage} from '../scripts/production-layouts.js';
import {TerrainField} from '../shared/terrain.js';
import {validateLevel} from '../shared/level.js';
import {placementMatrix} from '../shared/math.js';
import {TURRET_RECOIL,TURRET_PITCH} from '../shared/arsenal.js';
import {MISSILE_LAUNCHER_SOCKETS,GUIDED_MISSILE_MODEL} from '../shared/missile-model.js';
import {MIXED_PREVIEW_ACTORS} from '../shared/enemy-roster.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {TurretPreview} from '../game/turret-preview.js';
import {DefencePreview} from '../game/defence-preview.js';
import {MISSILE_PREVIEW_ACTORS} from '../game/missile-preview.js';

const sources=new Map(),key=([x,,z])=>`${x},${z}`;
const surveyActors=['dog','roller','moth'].map(model=>({id:'survey-'+model,model,variant:'base',distance:0}));
async function fixture(actors=surveyActors){
 const level=zoneAFourLevel(),runtime=[...actors,...MISSILE_PREVIEW_ACTORS];
 for(const id of new Set([...level.placements,...runtime].map(p=>p.model)))if(!sources.has(id))sources.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 const world=buildWorld(level,sources,{actors:runtime}),enemies=new EnemyPreview(world,()=>{},null,actors);
 return {level,world,enemies,dispose(){enemies.dispose();disposeWorld(world);}};
}
function random(){let value=232;return()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return(value>>>0)/4294967296;};}
function localVertices(part){const points=new Map();for(const c of part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){const p=[c[0]+dx,c[1]+dy,c[2]+dz];points.set(p.join(','),p);}return [...points.values()];}
function transformedBounds(points,m){
 const out=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
 for(const [x,y,z]of points)for(let axis=0;axis<3;axis++){
  const p=m[axis]*x+m[axis+4]*y+m[axis+8]*z+m[axis+12];out[axis]=Math.min(out[axis],p);out[axis+3]=Math.max(out[axis+3],p);
 }return out;
}
function overlap(a,b,i=0){return a[0]<b[i+3]-1e-4&&a[3]>b[i]+1e-4&&a[1]<b[i+4]-1e-4&&a[4]>b[i+1]+1e-4&&a[2]<b[i+5]-1e-4&&a[5]>b[i+2]+1e-4;}
function blocked(bounds,tree){let node=0;while(node<tree.nodeCount){if(overlap(bounds,tree.bounds,node*6)){if(tree.escape[node]===node+1)return true;node++;}else node=tree.escape[node];}return false;}
function defenceEnvelopes(world){
 const envelopes=[];
 for(const data of world.rigs.values())if(data.role==='defence')for(const part of data.parts){
  const vertices=localVertices(part),bounds=transformedBounds(vertices,data.root);
  if(data.model==='missile-launcher')for(const socket of MISSILE_LAUNCHER_SOCKETS[data.variant])bounds[4]=Math.max(bounds[4],data.root[13]+socket[1]+GUIDED_MISSILE_MODEL.height);
  const round=data.model==='turret-study'&&part.id!=='base';let radius=0;
  if(round){
   let bottom=Infinity,top=-Infinity;
   for(const [x,y,z]of vertices)for(const recoil of part.id==='guns'?[0,TURRET_RECOIL.distance]:[0]){
    if(part.id==='head'){radius=Math.max(radius,Math.hypot(x-12,z-12));bottom=Math.min(bottom,y);top=Math.max(top,y);continue;}
    const g=part.pivot,dy=y-g[1],dz=z-g[2]+recoil,angles=[TURRET_PITCH.min,TURRET_PITCH.max];
    for(const critical of [Math.atan2(-dz,dy),Math.atan2(dy,dz)])for(let k=-2;k<=2;k++){const angle=critical+k*Math.PI;if(angle>=TURRET_PITCH.min&&angle<=TURRET_PITCH.max)angles.push(angle);}
    for(const angle of angles){const py=g[1]+Math.cos(angle)*dy-Math.sin(angle)*dz,pz=g[2]+Math.sin(angle)*dy+Math.cos(angle)*dz;bottom=Math.min(bottom,py);top=Math.max(top,py);radius=Math.max(radius,Math.hypot(x-12,pz-12));}
   }
   const cx=data.root[0]*12+data.root[8]*12+data.root[12],cz=data.root[2]*12+data.root[10]*12+data.root[14];
   bounds.splice(0,6,cx-radius,data.root[13]+bottom,cz-radius,cx+radius,data.root[13]+top,cz+radius);
  }
  envelopes.push({id:data.model+'/'+part.id,bounds,round,radius});
 }return envelopes;
}

test('A4 is reproducible subtraction from the accepted landscape, with unchanged terrain and useful empty alternatives',async()=>{
 const f=await fixture(),before=zoneAFourLandscape(),manifest=zoneAFourRemovalManifest(),field=new TerrainField(f.level);
 try{
  // The approved visibility correction removes exactly three trees hiding
  // the generator ground. Metadata is additive; every other field is retained.
  const {previewWildlife,...saved}=await Bun.file(new URL('../docs/landscape-reset-2026-10-18/previous-levels/moss-04.json',import.meta.url)).json();
  const visibilityRemovals=new Set(['a4-land-5-6','a4-land-6-6','a4-land-4-7']);
  expect(f.level.placements.filter(p=>visibilityRemovals.has(p.id))).toHaveLength(3);
  expect(saved).toEqual({...f.level,placements:f.level.placements.filter(p=>!visibilityRemovals.has(p.id))});
  expect(await Bun.file(new URL('../docs/zone-a-four-landscape.json',import.meta.url)).json()).toEqual(before);
  expect(f.level.terrain).toEqual(before.terrain);expect(f.level.environment).toEqual(before.environment);expect(f.level.waterMaterial).toEqual(before.waterMaterial);
  expect(f.level.size).toEqual([18,16]);expect(f.level.path).toHaveLength(29);expect(f.enemies.path.length).toBe(672);expect(new Set(f.level.path.map(key)).size).toBe(29);
  for(const [x,,z]of f.level.path)expect(field.flatBox(x,z)).toBe(24);
  expect(manifest.moved).toHaveLength(0);expect(manifest.terrainChanged).toBe(false);
  const retained=f.level.placements.filter(p=>p.id.startsWith('a4-land-')),removed=new Set(manifest.removed.map(p=>p.id));
  expect(retained.length+removed.size).toBe(before.placements.length);expect(retained.length).toBe(manifest.retainedPlacements);
  for(const p of retained)expect(p).toEqual(before.placements.find(item=>item.id===p.id));
  for(const p of before.placements)expect(removed.has(p.id)).toBe(!retained.some(item=>item.id===p.id));
  for(const id of [...ZONE_A_FOUR_LANDSCAPE_INFO.perchCandidates,'a4-land-9-6','a4-land-10-6','a4-land-9-7','a4-land-11-7','a4-land-11-8','a4-land-4-11','a4-land-5-11','a4-land-13-8','a4-land-13-9'])expect(retained.some(p=>p.id===id)).toBe(true);
  expect(f.level.placements.filter(p=>!p.id.startsWith('a4-land-')).map(p=>[p.model,p.variant])).toEqual([['turret-study','base'],['power-generator','base'],['arc-spire','base'],['missile-launcher','base']]);
  for(const site of ZONE_A_FOUR_SITES){
   expect(field.flatBox(...site.box)).toBe(24);expect(f.level.path.some(p=>p[0]===site.box[0]&&p[2]===site.box[1])).toBe(false);
   expect(f.level.placements.filter(p=>p.box[0]===site.box[0]&&p.box[2]===site.box[1]).map(p=>p.id)).toEqual(site.placement?[site.placement]:[]);
   const candidate={...f.level,placements:[...f.level.placements.filter(p=>p.id!==site.placement),{id:'candidate-gun',model:'turret-study',variant:'base',box:[site.box[0],0,site.box[1]],turn:0}]};
   expect(validateLevel(candidate,sources)).toBe(candidate);
  }
 }finally{f.dispose();}
});

test('A4 ground and flying actor poses remain clear of scenery and defence motion through the complete route',async()=>{
 const f=await fixture(),shapes=f.enemies.states.map(s=>s.rig.bones.map(b=>localVertices(b.part))),defences=defenceEnvelopes(f.world),failures=[];let poses=0;
 try{
  for(let distance=0;distance<=672;distance++){
   for(const s of f.enemies.states)s.seed=Math.min(distance,671.999);f.enemies.reset();
   for(let i=0;i<f.enemies.states.length;i++){
    const s=f.enemies.states[i];poses++;
    for(let j=0;j<s.rig.bones.length;j++){
     const bone=s.rig.bones[j],bounds=transformedBounds(shapes[i][j],bone.instance.matrix);
     if(blocked(bounds,f.world.visibility)&&failures.length<12)failures.push(`${s.model}/${bone.part.id} at ${distance}`);
     for(const defence of defences){
      const b=defence.bounds;let intersects=overlap(bounds,b);
      if(intersects&&defence.round){const cx=(b[0]+b[3])/2,cz=(b[2]+b[5])/2,dx=Math.max(bounds[0]-cx,0,cx-bounds[3]),dz=Math.max(bounds[2]-cz,0,cz-bounds[5]);intersects=dx*dx+dz*dz<defence.radius**2-1e-4;}
      if(intersects&&failures.length<12)failures.push(`${s.model}/${bone.part.id} at ${distance}: ${defence.id}`);
     }
     expect(bounds[0]).toBeGreaterThanOrEqual(-1e-4);expect(bounds[2]).toBeGreaterThanOrEqual(-1e-4);expect(bounds[3]).toBeLessThanOrEqual(f.world.width+1e-4);expect(bounds[5]).toBeLessThanOrEqual(f.world.length+1e-4);
    }
   }
  }
  expect(failures).toEqual([]);expect(poses).toBe(2019);
 }finally{f.dispose();}
});

function probeGun(world,site,variant){
 const placement={id:'probe-'+site.id,model:'turret-study',variant,box:[site.box[0],0,site.box[1]],turn:0},root=placementMatrix(placement.box,0);root[13]=24;
 const parts=sources.get('turret-study').variants[variant].parts,instances=parts.map((part,i)=>({part:part.id,key:part.id,index:i,matrix:new Float32Array(root)}));
 return new TurretPreview({level:{placements:[placement]},rigs:new Map([[placement.id,{root,parts,instances}]]),visibility:world.visibility},()=>{},()=>.5,null,[]);
}
function intervals(flags){const out=[];let start=-1;for(let i=0;i<=flags.length;i++){if(flags[i]&&start<0)start=i;if(!flags[i]&&start>=0){out.push([start,i]);start=-1;}}return out;}

test('A4 alternate sites have positive actual gun LOS and pitch coverage, a real re-entry pocket and a distinct late catch',async()=>{
 const f=await fixture(),probes=ZONE_A_FOUR_SITES.flatMap(site=>['base','upgrade1'].map(variant=>({site,variant,gun:probeGun(f.world,site,variant),flags:f.enemies.states.map(()=>new Uint8Array(672))}))),report=[];
 try{
  for(let distance=0;distance<672;distance++){
   for(const s of f.enemies.states)s.seed=distance+.5;f.enemies.reset();
   for(const probe of probes)for(let i=0;i<f.enemies.states.length;i++)probe.flags[i][distance]=probe.gun.eligible(probe.gun.states[0],f.enemies.states[i],0)&&probe.gun.eligible(probe.gun.states[0],f.enemies.states[i],TURRET_RECOIL.distance)?1:0;
  }
  for(const site of ZONE_A_FOUR_SITES){
   const row={id:site.id,box:site.box,world:[(site.box[0]+.5)*24,24,(site.box[1]+.5)*24],rangeLengths:[48,72,96].map(range=>+productionCoverage(f.level.path,...site.box,range).toFixed(2)),eligible:{}};
   for(const probe of probes.filter(p=>p.site===site)){
    row.eligible[probe.variant]=Object.fromEntries(f.enemies.states.map((s,i)=>[s.model,intervals(probe.flags[i])]));
    for(const flags of probe.flags)expect(flags.reduce((sum,n)=>sum+n,0),site.id+'/'+probe.variant).toBeGreaterThan(0);
   }report.push(row);
  }
  const base=id=>report.find(row=>row.id===id).eligible.base;
  for(const model of ['dog','roller','moth']){
   expect(base('repeat-upper')[model].some(([a,b])=>a<360&&b>300)).toBe(true);
   expect(base('repeat-upper')[model].some(([a,b])=>a>430&&b>500)).toBe(true);
   expect(base('late-middle')[model].some(([a,b])=>a>448&&b>600)).toBe(true);
   expect(base('early-turn')[model].every(([,b])=>b<448)).toBe(true);
  }
  if(process.env.A4_AUDIT_OUTPUT)await Bun.write(process.env.A4_AUDIT_OUTPUT,JSON.stringify({sampling:'1-unit midpoint bins; both barrel rays at zero/full recoil; actual canonical poses',sites:report,manifest:zoneAFourRemovalManifest()},null,2)+'\n');
 }finally{for(const p of probes)p.gun.dispose();f.dispose();}
});

test('A4 mixed production combat uses all three weapons, captures missile claims and resets without compounding the generator',async()=>{
 const f=await fixture(MIXED_PREVIEW_ACTORS.A),damage=new Map(),hitModels=new Set(),initial=f.enemies.states.map(s=>s.rig.bones.map(b=>b.instance.matrix.slice()));let claimSeen=false,launches=0;
 const defence=new DefencePreview(f.world,()=>{},random(),null,f.enemies.states,(target,strength,vx,vy,vz)=>{
  const applied=f.enemies.takeHit(target,strength,vx,vy,vz);damage.set(strength,(damage.get(strength)??0)+applied);if(applied>0)hitModels.add(target.model);return applied;
 },null,()=>{});
 try{
  const pool=defence.missiles.pool,launch=pool.launch.bind(pool);
  pool.launch=(index,target,strength)=>{const before=pool.incomingDamage(target),accepted=launch(index,target,strength);if(accepted){launches++;expect(before).toBeLessThan(target.health.current);expect(strength).toBe(60);expect(pool.incomingDamage(target)-before).toBe(60);}return accepted;};
  expect(defence.states.map(s=>s.strength)).toEqual([12.5,30,60]);expect(defence.enhancers.states[0].recipientIds).toEqual(['a4-gun']);
  for(let frame=0;frame<3600;frame++){
   f.enemies.advance(1/60);defence.advance(1/60);
   for(const target of f.enemies.states)claimSeen||=defence.missiles.incomingDamage(target)>0;
  }
  for(const strength of [12.5,30,60])expect(damage.get(strength)??0).toBeGreaterThan(0);
  expect([...hitModels].sort()).toEqual(['dog','moth','roller']);expect(launches).toBeGreaterThan(0);
  expect(claimSeen).toBe(true);expect(defence.planner.thinks).toBe(3600);expect(defence.states.map(s=>s.thinkCount)).toEqual([1200,1200,1200]);
  expect(defence.missiles.pool.hits).toBeGreaterThan(0);
  for(let repeat=0;repeat<3;repeat++){
   f.enemies.reset();defence.resetTargets();expect(defence.states.map(s=>s.strength)).toEqual([12.5,30,60]);
   expect(defence.missiles.states[0].ammo).toBe(2);expect(defence.planner.thinks).toBe(0);
   for(let i=0;i<f.enemies.states.length;i++){const s=f.enemies.states[i];expect(s.health.current).toBe(s.health.maximum);expect(defence.missiles.incomingDamage(s)).toBe(0);expect(s.rig.bones.map(b=>b.instance.matrix)).toEqual(initial[i]);}
  }
 }finally{defence.dispose();f.dispose();}
 expect(f.world.actors.size+f.world.rigs.size).toBe(0);expect(defence.states).toHaveLength(0);
});
