import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {DefencePreview} from '../game/defence-preview.js';
import {ArcImpactSampler} from '../engine/arc-impact.js';
import {arcSpireLevel} from '../scripts/arc-spire-levels.js';

const sources=new Map();
async function source(id){if(!sources.has(id))sources.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());return sources.get(id);}
function rng(){let value=1234567;return ()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return (value>>>0)/4294967296;};}
async function fixture({zone='A',production=false,mixed=false,one=false,twoEnemies=false,variant='base',onShot=null,onDeath=null}={}){
 const level=production?arcSpireLevel(zone):newLevel('arc-combat-study');
 const actors=production?previewActorsForLevel(level.id):[{id:'test-dog',model:'dog',variant:'base',distance:36}];
 if(twoEnemies)actors.push({id:'other-dog',model:'dog',variant:'base',distance:60});
 if(!production){level.size=[8,5];level.path=Array.from({length:8},(_,x)=>[x,0,2]);level.placements=(one?[variant]:['base','upgrade1','upgrade2']).map((variant,i)=>({id:'spire-'+i,model:mixed&&i===0?'turret-study':'arc-spire',variant,box:[1+i*2,0,3],turn:0}));}
 const ids=new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)]),models=new Map();for(const id of ids)models.set(id,await source(id));
 const world=buildWorld(level,models,{actors}),enemies=new EnemyPreview(world,()=>{},onDeath,actors),random=rng();
 const preview=new DefencePreview(world,()=>{},random,null,enemies.states.length?enemies.states:null,(target,strength)=>enemies.takeHit(target,strength),onShot);
 return {world,enemies,preview,dispose(){preview.dispose();enemies.dispose();disposeWorld(world);}};
}

test('Arc studies hit once per pulse and destroy the mixed ground/air rosters',async()=>{
 for(const zone of ['A','B','C','D']){
  let effects=0,deaths=0;const f=await fixture({zone,production:true,onShot:(source,point,normal,at,matrix,local)=>{
   effects++;expect(at).toBeGreaterThanOrEqual(0);expect(source.every(Number.isFinite)).toBe(true);expect(point.every(Number.isFinite)).toBe(true);
   expect(Math.hypot(...normal)).toBeCloseTo(1,5);expect(Math.abs(normal[1])).toBeLessThan(.6);
   expect(normal[0]*(source[0]-point[0])+normal[1]*(source[1]-point[1])+normal[2]*(source[2]-point[2])).toBeGreaterThan(0);
   for(let axis=0;axis<3;axis++)expect(point[axis]).toBeCloseTo(matrix[axis]*local[0]+matrix[4+axis]*local[1]+matrix[8+axis]*local[2]+matrix[12+axis],5);
  },onDeath:()=>deaths++});
  try{
   for(let frame=0;frame<12000&&f.enemies.alive;frame++){f.enemies.advance(1/60);f.preview.advance(1/60);}
   expect(f.enemies.alive).toBe(0);expect(deaths).toBe(f.enemies.states.length);
   expect(f.preview.turrets.states).toHaveLength(0);expect(f.preview.arcs.states).toHaveLength(3);
   expect(effects).toBe(f.enemies.states.reduce((n,s)=>n+s.health.hits,0));expect(effects).toBe(f.preview.shots+f.preview.arcs.chainHits);
   for(const state of f.preview.states){
    // C's shorter four-actor roster may die before a downstream tier gets a shot.
    if(zone!=='C')expect(state.cycle.shots).toBeGreaterThan(0);
    if(state.cycle.shots){expect(state.lastShotDistance).toBeLessThanOrEqual(state.maxRange+1e-6);expect(state.lastShotDamage).toBeGreaterThan(0);expect(state.lastShotDamage).toBeLessThanOrEqual(state.strength);}
   }
  }finally{f.dispose();}
 }
});

test('mixed defences share exactly one thinker and do not promise unverified Arc coverage',async()=>{
 const f=await fixture({mixed:true});try{
  const planner=f.preview.planner;expect(f.preview.turrets.planner).toBe(planner);expect(f.preview.arcs.planner).toBe(planner);
  for(let frame=0;frame<600;frame++){f.enemies.advance(1/60);f.preview.advance(1/60);expect(planner.thinks).toBe(frame+1);}
  for(const state of f.preview.states)expect(state.thinkCount).toBe(200);
  for(let index=0;index<f.preview.states.length;index++)if(f.preview.states[index].model==='arc-spire')expect(planner.capacity(index,f.enemies.states[0])).toBe(0);
  expect(f.preview.turrets.states).toHaveLength(1);expect(f.preview.arcs.states).toHaveLength(2);
  f.preview.resetTargets();expect(planner.thinks).toBe(0);for(const state of f.preview.states){expect(state.target).toBeNull();expect(state.reservation).toBeNull();}
 }finally{f.dispose();}
});

test('actual surface LOS, range exits and death cancel live bursts; a stall never replays hits',async()=>{
 const f=await fixture({one:true});try{
  const state=f.preview.states[0],target=f.enemies.states[0],arcs=f.preview.arcs;
  expect(arcs.eligible(state,{...target,x:state.x+state.maxRange,z:state.z})).toBe(true);
  expect(arcs.eligible(state,{...target,x:state.x+state.maxRange+.001,z:state.z})).toBe(false);
  // Centre eligibility is not sufficient: obstruct every actual surface ray.
  arcs.visibility={clear:(_x,_y,_z,x,y,z)=>x===target.x&&y===target.aimY&&z===target.z};
  f.preview.advance(.01);expect(state.cycle.shots).toBe(0);expect(target.health.current).toBe(300);expect(state.surfaceRejects).toBe(1);
  arcs.visibility=f.world.visibility;f.preview.advance(.5);expect(state.cycle.shots).toBe(0);f.preview.advance(.01);expect(state.cycle.shots).toBe(1);expect(target.health.current).toBe(270);
  f.preview.advance(100);expect(state.cycle.shots).toBe(2);expect(target.health.current).toBe(240);
  target.health.takeDamage(239);f.preview.advance(1.5);expect(state.lastShotDamage).toBe(1);expect(target.health.alive).toBe(false);expect(state.target).toBeNull();
  const count=state.cycle.shots;f.preview.advance(100);expect(state.cycle.shots).toBe(count);
 }finally{f.dispose();}
});

test('a surface-blocked priority target yields to hittable alternatives and retries later',async()=>{
 const f=await fixture({one:true,twoEnemies:true});try{
  const state=f.preview.states[0],[blocked,other]=f.enemies.states,arcs=f.preview.arcs;
  blocked.threat=10;other.threat=1;
  const sample=arcs.contacts.sample.bind(arcs.contacts);
  arcs.contacts.sample=(target,...args)=>target===blocked?false:sample(target,...args);
  f.preview.advance(.01);expect(state.surfaceRejects).toBe(1);expect(state.cycle.shots).toBe(0);
  f.preview.advance(.01);expect(state.lastShotTargetId).toBe(other.id);expect(other.health.current).toBe(270);expect(blocked.health.current).toBe(300);
  expect(arcs.eligible(state,blocked)).toBe(false);f.preview.advance(.5);expect(arcs.eligible(state,blocked)).toBe(true);
  f.preview.resetTargets();expect(arcs.eligible(state,blocked)).toBe(true);expect(arcs.eligible(state,other)).toBe(true);
 }finally{f.dispose();}
});

test('upgrade bursts respect real gaps and cooldowns and stop immediately on obstruction',async()=>{
 const f=await fixture({one:true,variant:'upgrade2'});try{
  const state=f.preview.states[0];
  f.preview.advance(.01);expect(state.cycle.shots).toBe(1);expect(state.cycle.remaining).toBe(2);
  f.preview.advance(.199);expect(state.cycle.shots).toBe(1);f.preview.advance(.0011);expect(state.cycle.shots).toBe(2);
  f.preview.arcs.visibility={clear:()=>false};f.preview.advance(.2);expect(state.cycle.shots).toBe(2);expect(state.cycle.remaining).toBe(0);
  f.preview.arcs.visibility=f.world.visibility;f.preview.advance(1.399);expect(state.cycle.shots).toBe(2);
  f.preview.advance(.002);expect(state.cycle.shots).toBe(3);
 }finally{f.dispose();}
});

test('random contacts use exposed facing sides of current articulated poses and release all matrix references',async()=>{
 for(const zone of ['A','B','D']){
  const f=await fixture({zone,production:true}),sampler=new ArcImpactSampler(f.world,f.enemies.states,rng()),points=new Set();
  try{
   const target=f.enemies.states[0],source=new Float64Array(3);
   for(let step=0;step<24;step++){
    f.enemies.advance(.13);source.set([target.x+35*Math.cos(step),target.aimY+30,target.z+35*Math.sin(step)]);
    expect(sampler.sample(target,source,{clear:()=>true})).toBe(true);
    expect(sampler.selfClear(sampler.records.get(target),source)).toBe(true);expect(sampler.attempts).toBeLessThanOrEqual(16);
    const normal=sampler.normal;expect(normal[0]*(source[0]-target.x)+normal[2]*(source[2]-target.z)).toBeGreaterThan(0);
    const part=target.rig.byId.get(sampler.partId).part,m=sampler.matrix,p=sampler.localPoint;
    const localNormal=[m[0]*normal[0]+m[1]*normal[1]+m[2]*normal[2],m[4]*normal[0]+m[5]*normal[1]+m[6]*normal[2],m[8]*normal[0]+m[9]*normal[1]+m[10]*normal[2]];
    const occupied=new Set(part.voxels.map(c=>c.slice(0,3).join(',')));
    const inside=Array.from(p,(v,i)=>Math.floor(v-localNormal[i]*.001)).join(','),outside=Array.from(p,(v,i)=>Math.floor(v+localNormal[i]*.001)).join(',');
    expect(occupied.has(inside)).toBe(true);expect(occupied.has(outside)).toBe(false);

    points.add(Array.from(sampler.localPoint).map(n=>n.toFixed(3)).join(','));
   }
   expect(points.size).toBeGreaterThan(20);
   expect(sampler.sample(target,source,{clear:()=>false})).toBe(false);expect(sampler.matrix).toBeNull();
  }finally{sampler.dispose();expect(sampler.records.size).toBe(0);expect(sampler.matrix).toBeNull();f.dispose();}
 }
});
