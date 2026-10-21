import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {ArcSpirePreview,ARC_CHAIN_RANGE_SCALE,ARC_CHAIN_STRENGTH} from '../game/arc-spire-preview.js';

const models=new Map(await Promise.all(['dog','moth','arc-spire'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
function rng(){let n=1234567;return ()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};}
function fixture({variant='upgrade1',air=false}={}){
 const level=newLevel('chain-test');level.size=[10,5];level.path=Array.from({length:10},(_,x)=>[x,0,2]);level.placements=[{id:'spire',model:'arc-spire',variant,box:[3,0,1],turn:0}];
 const actors=[{id:'primary',model:'dog',variant:'base',distance:48},{id:'second',model:air?'moth':'dog',variant:'base',distance:72},{id:'third',model:'dog',variant:'base',distance:84}],world=buildWorld(level,models,{actors}),enemies=new EnemyPreview(world,()=>{},null,actors),events=[];
 const arcs=new ArcSpirePreview(world,enemies.states,rng(),(source,point,normal,at,matrix,local,isChain,sourceMatrix,sourceLocal)=>events.push({source:[...source],point:[...point],normal:[...normal],at,matrix,local:[...local],isChain,sourceMatrix,sourceLocal:sourceLocal?[...sourceLocal]:null}),(target,strength)=>enemies.takeHit(target,strength));
 return {world,enemies,arcs,events,state:arcs.states[0],dispose(){arcs.dispose();enemies.dispose();disposeWorld(world);}};
}
function rightSurface(f){
 const primary=f.enemies.states[0],sampler=f.arcs.contacts;
 expect(sampler.sample(primary,new Float64Array([primary.x+50,primary.aimY,primary.z]),f.world.visibility,'spire')).toBe(true);
 f.state.lastImpact.set(sampler.point);
}

test('upgraded actual hits chain once at25percent through exposed departure and arrival surfaces',()=>{
 const f=fixture();try{
  const [primary,...others]=f.enemies.states,s=f.state;for(let i=0;i<s.sources.length;i+=3)s.sources.set([primary.x+50,primary.aimY+4,primary.z],i);s.target=primary;s.targetLap=0;
  f.arcs.advance(.01);expect(s.cycle.shots).toBe(1);expect(s.lastShotDamage).toBe(40);expect(f.arcs.chainHits).toBe(1);
  expect(others.reduce((n,t)=>n+t.health.hits,0)).toBe(1);expect(others.reduce((n,t)=>n+t.health.maximum-t.health.current,0)).toBe(10);expect(f.events).toHaveLength(2);
  const [direct,chain]=f.events;expect(chain.isChain).toBe(true);expect(chain.sourceMatrix).toBeTruthy();for(let a=0;a<3;a++)expect(chain.source[a]).toBeCloseTo(chain.sourceMatrix[a]*chain.sourceLocal[0]+chain.sourceMatrix[a+4]*chain.sourceLocal[1]+chain.sourceMatrix[a+8]*chain.sourceLocal[2]+chain.sourceMatrix[a+12],5);expect(chain.at).toBe(direct.at);
  for(let axis=0;axis<3;axis++)expect(chain.point[axis]).toBeCloseTo(chain.matrix[axis]*chain.local[0]+chain.matrix[axis+4]*chain.local[1]+chain.matrix[axis+8]*chain.local[2]+chain.matrix[axis+12],5);
  expect(primary.health.hits).toBe(1);expect(s.lastChainTargetId).not.toBe(primary.id);
 }finally{f.dispose();}
});

test('base never chains; Upgrade II and lethal primary hits conduct25percent of full strength',()=>{
 for(const variant of ['base']){
  const f=fixture({variant});try{const s=f.state;s.target=f.enemies.states[0];s.targetLap=0;f.arcs.advance(.01);expect(f.arcs.chainHits).toBe(0);expect(f.events).toHaveLength(1);expect(f.enemies.states.slice(1).every(t=>t.health.hits===0)).toBe(true);}finally{f.dispose();}
 }
 const u2=fixture({variant:'upgrade2'});try{u2.state.target=u2.enemies.states[0];u2.state.targetLap=0;u2.arcs.advance(.01);expect(u2.arcs.chainHits).toBe(1);expect(u2.state.lastChainDamage).toBe(55*.25);}finally{u2.dispose();}
 const f=fixture();try{const primary=f.enemies.states[0];primary.health.takeDamage(299);for(let i=0;i<f.state.sources.length;i+=3)f.state.sources.set([primary.x+50,primary.aimY+4,primary.z],i);f.state.target=primary;f.state.targetLap=0;f.arcs.advance(.01);expect(f.state.lastShotDamage).toBe(1);expect(f.state.lastChainDamage).toBe(10);expect(f.state.target).toBeNull();expect(f.state.cycle.remaining).toBe(0);}finally{f.dispose();}
});

test('random selection reaches both valid neighbours including the inclusive half-range boundary and never self or dead actors',()=>{
 const f=fixture();try{
  const [primary,a,b]=f.enemies.states;rightSurface(f);expect(ARC_CHAIN_RANGE_SCALE).toBe(.5);expect(ARC_CHAIN_STRENGTH).toBe(.25);expect(b.x-primary.x).toBe(f.state.maxRange*.5);
  const ids=new Set();
  for(let i=0;i<80;i++){a.health.reset();b.health.reset();f.arcs.chain(f.state,primary,i);ids.add(f.state.lastChainTargetId);expect(f.state.lastChainDamage).toBe(10);expect(a.health.hits+b.health.hits).toBe(1);}
  expect(ids).toEqual(new Set([a.id,b.id]));expect(primary.health.hits).toBe(0);
  a.health.takeDamage(999);b.health.takeDamage(999);f.arcs.chain(f.state,primary,100);expect(f.state.lastChainTargetId).toBeNull();expect(f.state.lastChainDamage).toBe(0);
 }finally{f.dispose();}
});

test('transfer rejects blocked scenery and out-of-range3D recipients but can depart the opposite side of the primary',()=>{
 const f=fixture();try{
  const [primary,a,b]=f.enemies.states;rightSurface(f);const source=[...f.state.lastImpact];
  f.arcs.visibility={clear:()=>false};f.arcs.chain(f.state,primary,0);expect(f.arcs.chainHits).toBe(0);
  f.arcs.visibility=f.world.visibility;a.aimY=primary.aimY+f.state.maxRange*.5+.001;b.x=primary.x+f.state.maxRange*.5+.001;f.arcs.chain(f.state,primary,1);expect(f.arcs.chainHits).toBe(0);
  a.aimY=primary.aimY;a.seed=24;b.seed=0;f.enemies.pose();f.state.lastImpact.set(source);f.arcs.chain(f.state,primary,2);expect(f.arcs.chainHits).toBe(1);expect(f.events).toHaveLength(1);
 }finally{f.dispose();}
});

test('clear nearby airborne recipients use the same physical surface test and release sampler attachments on disposal',()=>{
 const f=fixture({air:true});f.state.maxRange=192;try{
  const [primary,air,b]=f.enemies.states;b.health.takeDamage(999);rightSurface(f);
  expect(air.airborne).toBe(true);expect(Math.hypot(air.x-primary.x,air.aimY-primary.aimY,air.z-primary.z)).toBeLessThanOrEqual(f.state.maxRange*.5);
  f.arcs.chain(f.state,primary,0);expect(f.state.lastChainTargetId).toBe(air.id);expect(air.health.hits).toBe(1);
  const sampler=f.arcs.chainContacts;f.arcs.dispose();expect(sampler.records.size).toBe(0);expect(sampler.matrix).toBeNull();expect(f.arcs.chainContacts).toBeNull();
 }finally{f.dispose();}
});
