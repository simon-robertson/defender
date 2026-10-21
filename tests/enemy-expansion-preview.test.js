// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {MISSILE_LAUNCHER_SOCKETS,GUIDED_MISSILE_MODEL} from '../shared/missile-model.js';
import {TURRET_PITCH,TURRET_RECOIL} from '../shared/arsenal.js';
import {shortestAngle} from '../engine/path-motion.js';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {ENEMY_EXPANSION_RIGS,ENEMY_EXPANSION_IDS} from '../shared/enemy-expansion-rigs.js';
import {ENEMY_EXPANSION_MOVEMENT} from '../engine/enemy-expansion-gait.js';
import {EnemyImpactClearance} from '../engine/enemy-impact.js';

const sources=new Map(await Promise.all(ENEMY_EXPANSION_IDS.map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
function fixture(models=ENEMY_EXPANSION_IDS,configure=null){
 const level=newLevel('expansion-motion');level.size=[16,16];level.path=[[2,2],[3,2],[4,2],[5,2],[5,3],[5,4],[5,5],[6,5],[7,5],[8,5]].map(([x,z])=>[x,0,z]);configure?.(level);
 const actors=models.map((model,i)=>({id:`actor-${i}`,model,variant:'base',distance:24})),world=buildWorld(level,sources,{actors}),preview=new EnemyPreview(world,()=>{},null,actors);
 return{world,preview,dispose(){preview.dispose();disposeWorld(world);}};
}
function point(m,p){return [0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[12+i]);}
function overlaps(a,b,i=0){return a[0]<b[i+3]-1e-5&&a[3]>b[i]+1e-5&&a[1]<b[i+4]-1e-5&&a[4]>b[i+1]+1e-5&&a[2]<b[i+5]-1e-5&&a[5]>b[i+2]+1e-5;}
function partBounds(bone){
 const out=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],m=bone.instance.matrix;
 for(const cell of bone.part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){
  const p=point(m,[cell[0]+dx,cell[1]+dy,cell[2]+dz]);for(let axis=0;axis<3;axis++){out[axis]=Math.min(out[axis],p[axis]);out[axis+3]=Math.max(out[axis+3],p[axis]);}
 }
 return out;
}
function occupiedPartHitsBox(bone,b,o){
 const m=bone.instance.matrix,axes=[[1,0,0],[0,1,0],[0,0,1],[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]],half=[0,1,2].map(i=>(b[o+i+3]-b[o+i])/2);
 for(let i=0;i<3;i++)for(let j=3;j<6;j++){const a=axes[i],c=axes[j];axes.push([a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0]]);}
 return bone.part.voxels.some(cell=>{
  const centre=point(m,cell.slice(0,3).map(v=>v+.5)),delta=centre.map((v,i)=>v-(b[o+i]+b[o+i+3])/2);
  for(const a of axes){
   if(Math.hypot(...a)<1e-8)continue;
   const separation=Math.abs(delta[0]*a[0]+delta[1]*a[1]+delta[2]*a[2]);
   let reach=half[0]*Math.abs(a[0])+half[1]*Math.abs(a[1])+half[2]*Math.abs(a[2]);
   for(let j=3;j<6;j++)reach+=.5*Math.abs(axes[j][0]*a[0]+axes[j][1]*a[1]+axes[j][2]*a[2]);
   if(separation>=reach-1e-5)return false;
  }
  return true;
 });
}

test('mixed mechanisms use their own speed, path, bounded lap clocks and reusable matrices across frame partitions',()=>{
 const split=fixture(),single=fixture();try{
  const matrices=split.preview.states.map(s=>s.rig.bones.map(b=>b.instance.matrix)),paths=split.preview.states.map(s=>s.path);
  expect(split.preview.paths.size).toBe(3);
  for(const dt of [.013,.047,.18,1.2,3.1,31.63])split.preview.advance(dt);single.preview.advance(36.17);
  for(let i=0;i<split.preview.states.length;i++){
   const s=split.preview.states[i],other=single.preview.states[i],rule=ENEMY_EXPANSION_MOVEMENT[s.model],contract=ENEMY_EXPANSION_RIGS[s.model],travel=s.seed+36.17*rule.speed;
   expect(s.distance).toBeCloseTo(travel%s.path.length,8);expect(s.lap).toBe(Math.floor(travel/s.path.length));expect(s.time).toBeGreaterThanOrEqual(0);expect(s.time).toBeLessThan(s.loopSeconds);expect(s.path).toBe(paths[i]);
   const velocity=Math.hypot(s.velocityX,s.velocityZ);if(s.airborne){expect(velocity).toBeGreaterThanOrEqual(rule.speed*Math.SQRT1_2-1e-8);expect(velocity).toBeLessThanOrEqual(rule.speed+1e-8);}else expect(velocity).toBeCloseTo(rule.speed,10);expect(s.rig.root[13]).toBeCloseTo(24+(rule.altitude??0)-rule.crouch,5);
   if(s.model!=='tripod')expect(s.gait.feet).toHaveLength(0);
   for(let b=0;b<s.rig.bones.length;b++){expect(s.rig.bones[b].instance.matrix).toBe(matrices[i][b]);for(let c=0;c<16;c++)expect(s.rig.bones[b].instance.matrix[c]).toBeCloseTo(other.rig.bones[b].instance.matrix[c],4);}
   for(const wheel of contract.wheels??[])expect(s.rig.byId.get(wheel.id).rotation[0]).toBeCloseTo((-travel/wheel.radius)%(2*Math.PI),10);
   for(const wing of contract.wings??[])expect(Math.abs(s.rig.byId.get(wing.id).rotation[2])).toBeLessThanOrEqual(contract.maxFlapDegrees*Math.PI/180);
  }
 }finally{split.dispose();single.dispose();}
});

test('wheel, rotor and wing phases remain continuous across each actor clock wrap',()=>{
 for(const model of ENEMY_EXPANSION_IDS.filter(id=>id!=='tripod'&&id!=='ray')){
  const f=fixture([model]);try{
   const s=f.preview.states[0],step=.0002,contract=ENEMY_EXPANSION_RIGS[model];f.preview.advance(s.loopSeconds-step);
   const before=s.rig.bones.map(b=>[...b.rotation]);f.preview.advance(step*2);
   for(let i=0;i<s.rig.bones.length;i++)for(let axis=0;axis<3;axis++)expect(Math.abs(shortestAngle(s.rig.bones[i].rotation[axis]-before[i][axis]))).toBeLessThan(.02);
   const elapsed=s.loopSeconds+step,phase=elapsed+s.seed/s.movement.speed;
   for(const wheel of contract.wheels??[])expect(s.rig.byId.get(wheel.id).rotation[0]).toBeCloseTo((-phase*s.movement.speed/wheel.radius)%(2*Math.PI),9);
   for(let i=0;i<(contract.rotors?.length??0);i++)expect(s.rig.byId.get(contract.rotors[i].id).rotation[1]).toBeCloseTo((phase*2*Math.PI*7*(i%2?-1:1))%(2*Math.PI),9);
   for(let i=0;i<(contract.wings?.length??0);i++){const w=contract.wings[i];expect(s.rig.byId.get(w.id).rotation[2]).toBeCloseTo(w.sign*contract.maxFlapDegrees*Math.PI/180*Math.sin(phase*2*Math.PI*4.5+(i>=2?.35*Math.PI:0)),9);}
  }finally{f.dispose();}
 }
});

test('actual torso positions and analytic aim velocities include offset centres and route banking',()=>{
 const f=fixture();try{
  // Just inside a heading blend, away from the root velocity discontinuity and
  // from the bank saturation boundary. Float32 pose finite difference is only
  // a reference check; runtime derivatives remain analytic Float64 scalars.
  for(const s of f.preview.states){
   s.seed=72-s.path.turnDistance+1;f.preview.reset();const before=[s.aimX,s.aimY,s.aimZ],velocity=[s.aimVelocityX,s.aimVelocityY,s.aimVelocityZ],dt=.002;
   expect(before).toEqual(point(s.aimBone.instance.matrix,s.aimOrigin));f.preview.advance(dt);const after=[s.aimX,s.aimY,s.aimZ];
   for(let i=0;i<3;i++)expect((after[i]-before[i])/dt).toBeCloseTo(velocity[i],1);
   if(s.airborne){expect(s.rig.root[13]).toBe(60);expect(Math.abs(s.gait.bodyRoll)).toBeGreaterThan(0);expect(Math.abs(s.gait.bodyRoll)).toBeLessThanOrEqual(ENEMY_EXPANSION_RIGS[s.model].maxBankDegrees*Math.PI/180);}
  }
 }finally{f.dispose();}
});

test('Tripod holds three-phase contacts flat through the complete route with a readable stride',()=>{
 const f=fixture(['tripod']);try{
  const s=f.preview.states[0],last=s.gait.feet.map(()=>({contact:NaN,stance:false,p:[0,0,0]}));let maxError=0,contactMotion=0,minStance=3,swings=0;
  expect(s.movement.speed*s.movement.cycleSeconds).toBe(4.2);expect(s.movement.cycleSeconds).toBeCloseTo(.3,12);
  for(let frame=0;frame<s.loopSeconds*120;frame++){
   f.preview.advance(1/120);let stance=0;
   for(let i=0;i<s.gait.feet.length;i++){
    const foot=s.gait.feet[i],bone=s.rig.byId.get(foot.paw),p=point(bone.instance.matrix,bone.part.pivot),prev=last[i];stance+=foot.stance?1:0;swings+=foot.stance?0:1;
    for(let axis=0;axis<3;axis++){maxError=Math.max(maxError,Math.abs(p[axis]-foot.position[axis]));if(foot.stance&&prev.stance&&foot.contact===prev.contact)contactMotion=Math.max(contactMotion,Math.abs(p[axis]-prev.p[axis]));}
    for(const index of [1,4,6,9])maxError=Math.max(maxError,Math.abs(bone.instance.matrix[index]));maxError=Math.max(maxError,Math.abs(bone.instance.matrix[5]-1));
    expect(foot.reach).toBeLessThan(foot.l1+foot.l2);prev.p=p;prev.contact=foot.contact;prev.stance=foot.stance;
   }
   minStance=Math.min(minStance,stance);
  }
  expect(minStance).toBe(2);expect(swings).toBeGreaterThan(100);expect(maxError).toBeLessThan(1e-4);expect(contactMotion).toBeLessThan(1e-4);
 }finally{f.dispose();}
});

function tightDefenceTops(world,bounds){
 // The impact guard deliberately uses full spheres around gun hinges. For
 // flight clearance use the exact continuous mechanical pitch ceiling; yaw
 // preserves Y, and recoil extrema occur at one of its two endpoints.
 let offset=0;const round=new Set();
 for(const data of world.rigs.values())if(data.role==='defence')for(const part of data.parts){
  if(!part.voxels?.length)continue;
  if(data.model==='turret-study'&&part.id!=='base')round.add(offset);
  if(data.model==='missile-launcher')for(const socket of MISSILE_LAUNCHER_SOCKETS[data.variant])bounds[offset+4]=Math.max(bounds[offset+4],data.root[13]+socket[1]+GUIDED_MISSILE_MODEL.height);
  if(data.model==='turret-study'&&part.id==='guns'){
   let top=-Infinity,radius=0;
   for(const cell of part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1])for(const recoil of [0,TURRET_RECOIL.distance]){
    const x=cell[0]+dx-12,y=cell[1]+dy-part.pivot[1],z=cell[2]+dz+recoil-part.pivot[2];
    for(const angle of [TURRET_PITCH.min,TURRET_PITCH.max]){
     top=Math.max(top,part.pivot[1]+Math.cos(angle)*y-Math.sin(angle)*z);radius=Math.max(radius,Math.hypot(x,part.pivot[2]-12+Math.sin(angle)*y+Math.cos(angle)*z));
    }
    const zPeak=Math.atan2(y,z);for(let k=-2;k<=2;k++){const angle=zPeak+k*Math.PI;if(angle>=TURRET_PITCH.min&&angle<=TURRET_PITCH.max)radius=Math.max(radius,Math.hypot(x,part.pivot[2]-12+Math.sin(angle)*y+Math.cos(angle)*z));}
    const peak=Math.atan2(-z,y);if(peak>=TURRET_PITCH.min&&peak<=TURRET_PITCH.max)top=Math.max(top,part.pivot[1]+Math.hypot(y,z));
   }
   bounds[offset+4]=data.root[13]+top;
   const centre=point(data.root,[12,0,12]);bounds[offset]=centre[0]-radius;bounds[offset+3]=centre[0]+radius;bounds[offset+2]=centre[2]-radius;bounds[offset+5]=centre[2]+radius;
  }
  offset+=6;
 }
 return round;
}

test('all four flyers clear scenery, terrain and all three defence studies over their complete route',async()=>{
 let poses=0;
 for(const [zone,model] of [['moss','moth'],['ochre','twin-fan'],['ice','ray'],['plum','lantern']])for(const stage of [1,2,3]){
  const id=`${zone}-0${stage}`;
  const level=await Bun.file(new URL(`../docs/landscape-reset-2026-10-18/previous-levels/${id}.json`,import.meta.url)).json(),models=new Map(sources);
  for(const placement of level.placements)if(!models.has(placement.model))models.set(placement.model,await Bun.file(new URL(`../assets/models/${placement.model}.json`,import.meta.url)).json());
  const actors=[{id:'flyer',model,variant:'base',distance:0}],world=buildWorld(level,models,{actors}),preview=new EnemyPreview(world,()=>{},null,actors),clearance=new EnemyImpactClearance(world),s=preview.states[0];
  try{
   const round=tightDefenceTops(world,clearance.defences);
   // Each exact animated part is enclosed by its transformed occupied-cell
   // AABB, tested against the production BVH leaves and swept defence bounds.
   for(let distance=0;distance<s.path.length;distance++){
    s.seed=distance;preview.reset();expect(s.rig.root[13]).toBe(level.pathHeight+36);
    for(const bone of s.rig.bones){
     const bounds=partBounds(bone),tree=world.visibility;let node=0;
     while(node<tree.nodeCount){if(overlaps(bounds,tree.bounds,node*6)){expect(tree.escape[node],`${model}/${bone.part.id} at ${distance}: scenery`).not.toBe(node+1);node++;}else node=tree.escape[node];}
     for(let i=0;i<clearance.defences.length;i+=6){
      const b=clearance.defences;let overlap=overlaps(bounds,b,i);
      if(overlap&&round.has(i)){const cx=(b[i]+b[i+3])/2,cz=(b[i+2]+b[i+5])/2,dx=Math.max(bounds[0]-cx,0,cx-bounds[3]),dz=Math.max(bounds[2]-cz,0,cz-bounds[5]),r=(b[i+3]-b[i])/2;overlap=dx*dx+dz*dz<r*r;}
      // Banked parts can overlap only at the empty corners of their AABBs.
      // Refine those candidates using occupied voxel OBBs before reporting contact.
      if(overlap)overlap=occupiedPartHitsBox(bone,b,i);
      expect(overlap,`${model}/${bone.part.id} at ${distance}: defence ${i} ${bounds} / ${[...b.slice(i,i+6)]}`).toBe(false);
     }
     expect(bounds[0]).toBeGreaterThanOrEqual(-1e-4);expect(bounds[2]).toBeGreaterThanOrEqual(-1e-4);expect(bounds[3]).toBeLessThanOrEqual(level.size[0]*24+1e-4);expect(bounds[5]).toBeLessThanOrEqual(level.size[1]*24+1e-4);
    }
    poses++;
   }
  }finally{clearance.dispose();preview.dispose();disposeWorld(world);}
 }
 expect(poses).toBeGreaterThan(6000);
},20000);

test('new ground skid and small airborne sway preserve actual poses, guards, death freeze, reset and scene ownership',()=>{
 const f=fixture();try{
  const initial=f.preview.states.map(s=>s.rig.bones.map(b=>b.instance.matrix.slice())),matrices=f.preview.states.map(s=>s.rig.bones.map(b=>b.instance.matrix));
  for(const s of f.preview.states){expect(f.preview.takeHit(s,1,0,0,60)).toBe(1);expect(s.impact.active).toBe(true);}
  const field=f.preview.impactClearance,queries=field.queries;f.preview.advance(.25);
  for(const s of f.preview.states){
   expect(s.impact.offsetZ).toBeGreaterThan(0);expect(s.impact.offsetZ).toBeLessThanOrEqual(s.airborne?.75:3);expect(s.impact.pitch).toBe(0);expect(Math.abs(s.impact.roll)).toBe(0);
   expect([s.aimX,s.aimY,s.aimZ]).toEqual(point(s.aimBone.instance.matrix,s.aimOrigin));
   const pose=s.rig.bones.map(b=>b.instance.matrix.slice());f.preview.takeHit(s,s.health.maximum,0,0,60);f.preview.advance(.01);
   expect([s.velocityX,s.velocityY,s.velocityZ,s.aimVelocityX,s.aimVelocityY,s.aimVelocityZ]).toEqual([0,0,0,0,0,0]);for(let b=0;b<pose.length;b++)expect(s.rig.bones[b].instance.matrix).toEqual(pose[b]);
  }
  expect(field.queries).toBe(queries);f.preview.reset();
  for(let i=0;i<f.preview.states.length;i++){const s=f.preview.states[i];expect(s.impact.active).toBe(false);expect(s.impact.hits).toBe(0);for(let b=0;b<s.rig.bones.length;b++){expect(s.rig.bones[b].instance.matrix).toBe(matrices[i][b]);expect(s.rig.bones[b].instance.matrix).toEqual(initial[i][b]);}}
  const states=[...f.preview.states],paths=f.preview.paths;f.preview.dispose();expect(paths.size).toBe(0);expect(field.visibility).toBeNull();expect(field.heights).toBeNull();for(const s of states){expect(s.path).toBeNull();expect(s.gait.path).toBeNull();expect(s.gait.rig).toBeNull();}
 }finally{f.dispose();}
 // Air must not borrow grounded sole support. Water alongside the route is
 // acceptable; a tall solid obstruction at the same height is not.
 for(const raised of [false,true]){
  const air=fixture(['ray'],level=>{level.path=Array.from({length:9},(_,i)=>[i+1,0,2]);for(let x=1;x<10;x++)level.terrain.boxes.push({box:[x,3],ground:raised?80:4,water:raised?0:12});});
  try{air.preview.takeHit(air.preview.states[0],1,0,0,60);expect(air.preview.states[0].impact.active).toBe(!raised);}finally{air.dispose();}
 }
});

test('new ground actors retain terrain support and clear route scenery through their complete production paths',async()=>{
 for(const [zone,model] of [['moss','roller'],['ochre','dune-tread'],['ice','tripod']]){
  const level=await Bun.file(new URL(`../docs/landscape-reset-2026-10-18/previous-levels/${zone}-01.json`,import.meta.url)).json(),models=new Map(sources);
  for(const placement of level.placements)if(!models.has(placement.model))models.set(placement.model,await Bun.file(new URL(`../assets/models/${placement.model}.json`,import.meta.url)).json());
  const actors=[{id:'ground-unit',model,variant:'base',distance:0}],world=buildWorld(level,models,{actors}),preview=new EnemyPreview(world,()=>{},null,actors),s=preview.states[0];
  const heights=new Map(level.terrain.boxes.map(b=>[b.box.join(','),b]));
  try{
   for(let distance=0;distance<s.path.length;distance++){
    s.seed=distance;preview.reset();
    for(const bone of s.rig.bones){
     const bounds=partBounds(bone),tree=world.visibility;let node=0;
     while(node<tree.nodeCount){if(overlaps(bounds,tree.bounds,node*6)){expect(tree.escape[node],`${model}/${bone.part.id} at ${distance}: scenery`).not.toBe(node+1);node++;}else node=tree.escape[node];}
     for(const cell of bone.part.voxels)for(const dx of [0,1])for(const dz of [0,1]){
      const p=point(bone.instance.matrix,[cell[0]+dx,cell[1],cell[2]+dz]);
      if(p[1]>level.pathHeight+.15)continue;
      const box=heights.get(`${Math.floor(p[0]/24)},${Math.floor(p[2]/24)}`);
      expect(p[0]).toBeGreaterThanOrEqual(0);expect(p[2]).toBeGreaterThanOrEqual(0);expect(p[0]).toBeLessThan(level.size[0]*24);expect(p[2]).toBeLessThan(level.size[1]*24);
      expect(box?.ground??24,`${model}/${bone.part.id} at ${distance}: support`).toBe(level.pathHeight);expect(box?.water??0).toBe(0);
     }
    }
   }
  }finally{preview.dispose();disposeWorld(world);}
 }
});
