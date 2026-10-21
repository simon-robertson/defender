import {test,expect} from 'bun:test';
import {productionLevel} from '../scripts/production-level.js';
import {wildlifeModels} from '../scripts/wildlife-models.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {TerrainField} from '../shared/terrain.js';
import {ENEMY_STATS} from '../shared/enemy.js';
import {PoseRig} from '../engine/rig.js';
import {TURRET_TURN,TURRET_PITCH,TURRET_RECOIL} from '../shared/arsenal.js';

const levels=new Map(['A','B','C','D'].map(zone=>[zone,productionLevel(zone)]));
const ids=new Set([...levels.values()].flatMap(l=>l.placements.map(p=>p.model)));for(const level of levels.values())for(const actor of previewActorsForLevel(level.id))ids.add(actor.model);
const library=new Map(await Promise.all([...ids].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));for(const m of wildlifeModels())library.set(m.id,m);
function fixture(zone,combined=false){const level=structuredClone(levels.get(zone)),actors=[...wildlifeActorsForLevel(level.id),...(combined?previewActorsForLevel(level.id):[])],world=buildWorld(level,library,{actors});let updates=0;const preview=new WildlifePreview(world,()=>updates++);return {world,preview,get updates(){return updates;},reset(){updates=0;},dispose(){preview.dispose();disposeWorld(world);}};}
function point(m,x,y,z){return [0,1,2].map(i=>m[i]*x+m[4+i]*y+m[8+i]*z+m[12+i]);}
function overlap(a,b,o=0){return a[0]<b[o+3]-1e-5&&a[3]>b[o]+1e-5&&a[1]<b[o+4]-1e-5&&a[4]>b[o+1]+1e-5&&a[2]<b[o+5]-1e-5&&a[5]>b[o+2]+1e-5;}
function blocked(box,tree){let node=0;while(node<tree.nodeCount){if(overlap(box,tree.bounds,node*6)){if(tree.escape[node]===node+1)return true;node++;}else node=tree.escape[node];}return false;}

test('each zone adds only six cosmetic actors and two shared source models, independently of combat actors',()=>{
 for(const zone of ['A','B','C','D']){
  const f=fixture(zone,true),before=JSON.stringify(f.world.level),enemies=new EnemyPreview(f.world,()=>{});
  try{
   const actors=wildlifeActorsForLevel(f.world.level.id);expect(Object.isFrozen(actors)).toBe(true);expect(actors).toHaveLength(6);expect(new Set(actors.map(a=>a.model)).size).toBe(2);
   expect(f.preview.states.filter(s=>s.kind==='ground')).toHaveLength(3);expect(f.preview.states.filter(s=>s.kind==='bird'&&!s.flight)).toHaveLength(3);
   expect(f.preview.states.every(s=>!('health'in s)&&!('target'in s))).toBe(true);expect(enemies.states).toHaveLength(previewActorsForLevel(f.world.level.id).length);
   const groups=f.world.entries.filter(e=>e.key.startsWith('wildlife-'));expect(groups).toHaveLength(4);for(const group of groups)expect(group.transforms).toHaveLength(3);
   expect(f.preview.states.reduce((n,s)=>n+s.rig.bones.length,0)).toBe(12);expect(JSON.stringify(f.world.level)).toBe(before);
   for(const s of enemies.states)expect(s.health.maximum).toBe(ENEMY_STATS[s.model].maxHealth);
  }finally{enemies.dispose();f.dispose();}
 }
 expect(wildlifeActorsForLevel('unknown')).toHaveLength(0);
});

test('autonomous journeys cross paths while avoiding water, scenery and other ground critters in every zone',()=>{
 for(const zone of ['A','B','C','D']){
  const f=fixture(zone),p=f.preview,terrain=new TerrainField(f.world.level),before=JSON.stringify([...library]);
  const geometry=new Map(f.world.entries.map(e=>[e.key,e.mesh.vertices])),visited=p.states.map(()=>new Set()),travel=p.states.map(()=>0);let crossings=0;
  try{
   for(let frame=0;frame<5400;frame++){
    p.advance(1/30);expect(p.lastThinkWork).toBeLessThanOrEqual(512);
    for(let i=0;i<p.states.length;i++){
     const s=p.states[i],box=[s.x-s.radius,s.y,s.z-s.radius,s.x+s.radius,s.y+s.height,s.z+s.radius];
     expect(blocked(box,f.world.visibility)).toBe(false);expect(box[0]).toBeGreaterThanOrEqual(0);expect(box[2]).toBeGreaterThanOrEqual(0);expect(box[3]).toBeLessThanOrEqual(f.world.width);expect(box[5]).toBeLessThanOrEqual(f.world.length);
     for(let j=0;j<p.defences.length;j+=6)expect(overlap(box,p.defences,j)).toBe(false);
     travel[i]=Math.max(travel[i],Math.hypot(s.x-s.homeX,s.z-s.homeZ));
     if(s.kind==='bird'){
      expect(s.wing).toBeGreaterThanOrEqual(-Math.PI/4-1e-9);expect(s.wing).toBeLessThanOrEqual(70*Math.PI/180+1e-9);
      if(s.flight){const destination=p.perches[s.goalPerch];expect(destination.tree).toBe(true);expect(destination.id).not.toBe(p.perches[s.perch].id);expect(s.targetPerch).toBe(destination.id);}
      else{
       const perch=p.perches[s.perch];visited[i].add(perch.id);expect(s.y).toBe(perch.y);
       // Both actual soles must have support, rather than relying on a canopy bounding box.
       const body=s.rig.byId.get('body');for(const cell of f.world.actors.get(s.id).parts.find(part=>part.id==='body').voxels)if(cell[1]===0){const q=point(body.instance.matrix,cell[0]+.5,0,cell[2]+.5);expect(f.world.visibility.blocked(q[0],q[1]-.25,q[2],q[0],q[1]-.01,q[2])).toBe(true);}
      }
     }else{
      const ground=p.nav.heights[s.node];expect(s.y).toBeGreaterThanOrEqual(ground);expect(s.y).toBeLessThanOrEqual(ground+s.hop+1e-8);
      if(s.phase==='idle'||s.phase==='planning')expect(s.y).toBe(ground);
      for(let z=Math.floor(box[2]/24);z<=Math.floor((box[5]-1e-6)/24);z++)for(let x=Math.floor(box[0]/24);x<=Math.floor((box[3]-1e-6)/24);x++){if(terrain.protected(x,z))crossings++;expect(terrain.flatBox(x,z)).toBe(ground);}
      for(const other of p.states)if(other.kind==='ground'&&other!==s)expect(Math.hypot(s.x-other.x,s.z-other.z)).toBeGreaterThanOrEqual(s.radius+other.radius-1e-5);
     }
     // Check the submitted articulated mesh against the conservative navigation
     // envelope periodically through many flights and ground headings.
     if(frame%120===0)for(const bone of s.rig.bones){const v=geometry.get(bone.instance.key),m=bone.instance.matrix;for(let j=0;j<v.length;j+=11){const q=point(m,v[j],v[j+1],v[j+2]);expect(Math.hypot(q[0]-s.x,q[2]-s.z)).toBeLessThanOrEqual(s.radius+1e-4);expect(q[1]).toBeGreaterThanOrEqual(s.y-1e-4);expect(q[1]).toBeLessThanOrEqual(s.y+s.height+1e-4);}}
    }
   }
   for(let i=0;i<p.states.length;i++){
    const s=p.states[i];expect(s.journeysCompleted).toBeGreaterThan(0);
    if(s.kind==='bird')expect(visited[i].size).toBeGreaterThan(1);
    else{const componentSize=p.nav.starts[s.groundComponent+1]-p.nav.starts[s.groundComponent];expect(travel[i]).toBeGreaterThan(componentSize>32?24:4);}
   }
   if(zone==='A')expect(crossings).toBeGreaterThan(0);expect(JSON.stringify([...library])).toBe(before);
  }finally{f.dispose();}
 }
},30000);

test('only one round-robin thinker runs per frame, using stable bounded state and shared scratch',()=>{
 const f=fixture('A'),p=f.preview,states=p.states.slice(),nav=p.nav,queue=nav.queue,parents=nav.parents,seen=nav.seen,routes=states.map(s=>s.route),matrices=states.flatMap(s=>s.rig.bones.map(b=>b.instance.matrix));
 try{
  for(let frame=0;frame<1800;frame++){
   p.advance(1/30);expect(p.thinkCount).toBe(frame+1);expect(p.lastThinkId).toBe(states[frame%6].id);expect(p.lastThinkWork).toBeLessThanOrEqual(512);
   expect(p.nav).toBe(nav);expect(nav.queue).toBe(queue);expect(nav.parents).toBe(parents);expect(nav.seen).toBe(seen);
  }
  for(let i=0;i<6;i++){expect(p.states[i]).toBe(states[i]);expect(states[i].route).toBe(routes[i]);expect(states[i].thinkCount).toBe(300);}
  const current=states.flatMap(s=>s.rig.bones.map(b=>b.instance.matrix));for(let i=0;i<matrices.length;i++)expect(current[i]).toBe(matrices[i]);
  expect(p.planningBytes).toBeGreaterThan(0);expect(p.treePerches.length).toBeGreaterThan(3);
  f.reset();p.advance(0);expect(f.updates).toBe(0);expect(p.updatedParts).toBe(0);expect(p.thinkCount).toBe(1800);for(const dt of [-1,NaN,Infinity])expect(()=>p.advance(dt)).toThrow();
 }finally{f.dispose();}
});

test('accepted journeys use elapsed seconds independent of frame subdivision',()=>{
 // Planning is deliberately one actor per frame. Freeze new decisions after
 // accepting journeys and compare movement of the identical accepted routes.
 for(const kind of ['ground','bird']){
  const reference=fixture('A'),states=reference.preview.states;let selected;
  while(!selected){reference.preview.advance(1/60);selected=states.find(s=>s.kind===kind&&(s.phase==='hop'||s.flight));}
  const duration=kind==='ground'?1.17:1.137,id=selected.id;
  try{
   const data={...selected,route:selected.route?.slice()},snapshots=[];
   for(const step of [duration,1/30,1/144,.073]){
    Object.assign(selected,data);selected.route=data.route?.slice()??null;let elapsed=0;
    while(elapsed<duration){const dt=Math.min(step,duration-elapsed);if(kind==='ground')reference.preview.moveGround(selected,dt);else reference.preview.moveBird(selected,dt);elapsed+=dt;}
    snapshots.push([selected.x,selected.y,selected.z,selected.yaw,selected.wing,selected.phase]);
   }
   for(const s of snapshots.slice(1)){for(let i=0;i<5;i++)expect(s[i]).toBeCloseTo(snapshots[0][i],7);expect(s[5]).toBe(snapshots[0][5]);}
   expect(selected.id).toBe(id);
  }finally{reference.dispose();}
 }
});

test('hares use faster longer low hops and complete short journeys without a final vertical snap',()=>{
 const f=fixture('C'),p=f.preview,s=p.states[0];try{
  let accepted=false;for(let frame=0;frame<6000;frame++){p.advance(1/60);if(s.phase==='hop'&&s.travelled===0&&s.hopSpan<8){accepted=true;break;}}
  expect(accepted).toBe(true);expect(s.speed).toBe(20);expect(s.hop).toBe(1.2);expect(s.hopSpan).toBeLessThan(8);
  const ground=p.nav.heights[s.node],halfHop=s.hopSpan/(2*s.speed),duration=(s.routeLength-1)*4/s.speed;p.moveGround(s,halfHop);expect(s.y).toBeCloseTo(ground+1.2,7);
  p.moveGround(s,duration-halfHop-.0001);expect(s.y-ground).toBeLessThan(.00001);p.moveGround(s,.0001);expect(s.phase).toBe('idle');expect(s.y).toBe(ground);
  // Long open routes normally use the requested8-unit span.
  const other=p.states[1];for(let frame=0;frame<1000&&other.phase!=='hop';frame++)p.advance(1/60);expect(other.hopSpan).toBeGreaterThan(7);expect(other.hopSpan).toBeLessThanOrEqual(8);
 }finally{f.dispose();}
});

test('a ground critter blocked mid-hop settles on the ground before retrying',()=>{
 const f=fixture('A'),p=f.preview,s=p.states[0];try{
  while(s.phase!=='hop')p.advance(1/60);p.moveGround(s,.125);expect(s.y).toBeGreaterThan(p.nav.heights[s.node]);
  const other=p.states[1];other.x=s.x;other.z=s.z;p.moveGround(s,1.01);
  expect(s.phase).toBe('idle');expect(s.y).toBe(p.nav.heights[s.node]);expect(s.goalNode).toBe(-1);expect(s.routeLength).toBe(0);p.moveGround(s,.1);expect(s.y).toBe(p.nav.heights[s.node]);
 }finally{f.dispose();}
});

test('invalid habitats/perches fail closed and unload drops every actor and navigation reference',()=>{
 const f=fixture('A'),actors=wildlifeActorsForLevel(f.world.level.id);
 try{
  const onPath=new WildlifePreview(f.world,()=>{},[{...actors[0],habitat:[0,5]}]);expect(onPath.states[0].y).toBe(24);onPath.dispose();
  const occupied=f.world.level.placements.find(p=>p.kind!=='detail');expect(()=>new WildlifePreview(f.world,()=>{},[{...actors[0],habitat:[occupied.box[0],occupied.box[2]]}])).toThrow();
  expect(()=>new WildlifePreview(f.world,()=>{},[{...actors[3],perch:'missing'}])).toThrow('missing');expect(()=>new WildlifePreview(f.world,()=>{},[{...actors[3],point:[11.5,43,11.5]}])).toThrow('perch');
  expect(()=>new WildlifePreview(f.world,()=>{},[{...actors[0],offset:NaN}])).toThrow();expect(()=>new WildlifePreview(f.world,()=>{},[actors[0],actors[0]])).toThrow();
  const refs=f.preview.states.slice(),states=f.preview.states,world=f.world;f.dispose();expect(states).toHaveLength(0);for(const state of refs){expect(state.rig).toBeNull();expect(state.route).toBeNull();}expect(f.preview.world).toBeNull();expect(f.preview.nav).toBeNull();expect(f.preview.defences).toBeNull();expect(f.preview.bounds).toBeNull();expect(f.preview.threatSources).toHaveLength(0);expect(f.preview.explosions).toBeNull();expect(f.preview.spookExplosion(0,0,0,36)).toBe(false);expect(f.preview.perches).toHaveLength(0);expect(f.preview.treePerches).toHaveLength(0);expect(world.actors.size).toBe(0);expect(world.entries).toHaveLength(0);expect(world.visibility).toBeNull();f.preview.advance(100);expect(f.preview.updatedParts).toBe(0);
 }finally{if(f.world.level)f.dispose();}
 // An empty collection retains no source/scene data after disposal and does no work.
 const empty=fixture('A');try{const one=new WildlifePreview(empty.world,()=>{throw new Error('Unexpected upload');},[]);one.advance(10);expect(one.updatedParts).toBe(0);expect(one.thinkCount).toBe(0);one.dispose();}finally{empty.dispose();}
});


function steadyGround(f){
 const p=f.preview,s=p.states[0];for(let frame=0;frame<2400;frame++){p.advance(1/60);if((s.phase==='hop'||s.phase==='scuttle')&&s.edgeNode>=0&&Math.abs(s.x%4-2)+Math.abs(s.z%4-2)>.2)return s;}throw new Error('No moving ground actor');
}
function distance3(s,x,y,z){return Math.hypot(s.x-x,s.y+s.centerOffset-y,s.z-z);}
function tickActor(p,s,dt=1/60){
 const turn=p.states.indexOf(s);while(p.thinker!==turn)p.advance(dt);p.advance(dt);
}

test('nearby live enemies cause continuous ground escape, dead enemies do not and safe flee routes persist',()=>{
 const f=fixture('A',true),p=f.preview,enemies=new EnemyPreview(f.world,()=>{});try{
  p.setThreatSources(enemies.states);expect(p.threatSources).toBe(enemies.states);
  const s=steadyGround(f),n=p.nav,next=s.route[s.routeIndex],nx=(next%n.cols+.5)*4,nz=(Math.floor(next/n.cols)+.5)*4,dx=nx-s.x,dz=nz-s.z,length=Math.hypot(dx,dz),enemy=enemies.states[0];
  // A real live enemy state is placed in front of an accepted mid-edge journey.
  enemy.x=s.x+dx/length*8;enemy.z=s.z+dz/length*8;enemy.aimY=s.y+s.centerOffset;
  for(const other of enemies.states)if(other!==enemy)other.health.takeDamage(300);
  enemy.health.takeDamage(300);tickActor(p,s);expect(s.spooks).toBe(0);enemy.health.current=300;
  const beforeX=s.x,beforeZ=s.z,beforeTime=p.time,beforeThink=p.thinkCount;tickActor(p,s);
  expect(p.thinkCount-beforeThink).toBeLessThanOrEqual(6);expect(s.frightened).toBe(true);expect(s.lastSpookKind).toBe('enemy');expect(s.spooks).toBe(1);
  expect(Math.hypot(s.x-beforeX,s.z-beforeZ)).toBeLessThanOrEqual(20*(p.time-beforeTime)+1e-6);
  for(let frame=0;frame<120&&s.fleeJourneys===0;frame++)p.advance(1/60);expect(s.fleeJourneys).toBeGreaterThan(0);expect(n.offPath[s.goalNode]).toBe(1);
  let previous=(s.x-enemy.x)**2+(s.z-enemy.z)**2;const started=s.journeys;
  for(let frame=0;frame<30;frame++){
   const x=s.x,z=s.z;p.advance(1/60);expect(Math.hypot(s.x-x,s.z-z)).toBeLessThanOrEqual(30/60+1e-6);
   const d=(s.x-enemy.x)**2+(s.z-enemy.z)**2;expect(d).toBeGreaterThanOrEqual(previous-1e-5);previous=d;
   expect(blocked([s.x-s.radius,s.y,s.z-s.radius,s.x+s.radius,s.y+s.height,s.z+s.radius],f.world.visibility)).toBe(false);
  }
  expect(s.journeys).toBe(started);expect(s.spooks).toBe(1);
 }finally{enemies.dispose();f.dispose();}
});

test('explosions use a fixed copied event pool, expire, and only the scheduled actor reacts',()=>{
 const f=fixture('B'),p=f.preview,s=p.states[0],pool=p.explosions;try{
  const x=s.x,y=s.y+s.centerOffset,z=s.z,thinks=p.thinkCount;expect(p.spookExplosion(x,y,z,36)).toBe(true);
  expect(p.thinkCount).toBe(thinks);expect(p.states.every(state=>state.spooks===0)).toBe(true);expect(p.explosionEvents).toBe(1);
  p.advance(1/60);expect(p.thinkCount).toBe(thinks+1);expect(s.spooks).toBe(1);expect(s.lastSpookKind).toBe('explosion');expect(p.states.slice(1).every(state=>state.spooks===0)).toBe(true);
  for(let frame=0;frame<300;frame++)p.advance(1/60);expect(s.frightened).toBe(false);expect(s.spooks).toBe(1);expect(s.fleeJourneys).toBeGreaterThan(0);expect(p.explosions).toBe(pool);
  for(let i=0;i<20;i++)p.spookExplosion(i,2,3,36);expect(p.explosions).toHaveLength(40);expect(p.explosionEvents).toBe(21);
  for(const args of [[NaN,0,0,1],[0,0,0,0]])expect(()=>p.spookExplosion(...args)).toThrow();expect(()=>p.setThreatSources({})).toThrow();
 }finally{f.dispose();}
});

test('doubled explosion fright radii reach ground, perched and flying wildlife in the new 3D annulus',()=>{
 for(const [zone,enemy,oldRadius]of [['A','dog',36],['B','walker',42],['D','spider',36]])for(const mode of ['ground','perched','flying']){
  const f=fixture(zone),p=f.preview,s=p.states[mode==='ground'?0:3],radius=ENEMY_STATS[enemy].explosion.frightRadius,pool=p.explosions;
  try{
   expect(radius).toBe(oldRadius*2);
   if(mode==='flying'){
    for(let frame=0;frame<6000&&!s.flight;frame++)p.advance(1/60);
    expect(s.flight).toBe(true);p.moveBird(s,s.duration*.25);expect(s.flightTime/s.duration).toBeGreaterThanOrEqual(.25);
   }else{
    expect(s.phase).toBe(mode==='ground'?'idle':'perched');s.readyAt=p.time+60;
   }
   const check=(eventRadius,dx,dy,dz,reacts)=>{
    // Isolate each radius check without changing the existing movement/flight.
    pool.fill(0);const thinks=p.thinkCount,before=p.states.map(state=>state.spooks);
    p.thinker=p.states.indexOf(s);
    expect(p.spookExplosion(s.x+dx,s.y+s.centerOffset+dy,s.z+dz,eventRadius)).toBe(true);
    expect(p.thinkCount).toBe(thinks);expect(s.spooks).toBe(before[p.thinker]);
    p.advance(.000001);
    expect(p.thinkCount).toBe(thinks+1);expect(p.lastThinkId).toBe(s.id);expect(p.lastThinkWork).toBeLessThanOrEqual(512);
    for(let i=0;i<p.states.length;i++)expect(p.states[i].spooks).toBe(before[i]+(p.states[i]===s&&reacts?1:0));
    expect(s.frightened).toBe(reacts);expect(p.explosions).toBe(pool);
   };
   const distance=(oldRadius+radius)/2+s.radius;
   // Same actual position is outside the former body-expanded radius and
   // inside the doubled radius, for ground bodies and both bird states.
   check(oldRadius,distance*.8,distance*.6,0,false);
   // Horizontal distance alone is inside: the vertical separation must keep
   // this event outside the new radius, including the animal's body bound.
   const horizontal=radius/2,outside=radius+s.radius+2;
   check(radius,horizontal,Math.sqrt(outside*outside-horizontal*horizontal),0,false);
   check(radius,distance*.8,distance*.6,0,true);
   expect(s.lastSpookKind).toBe('explosion');
  }finally{f.dispose();}
 }
});

test('bird flights are twice as fast, use 3D threat distance and react from both perch and mid-flight',()=>{
 const f=fixture('A'),p=f.preview,bird=p.states[3];try{
  const enemy={x:bird.x,z:bird.z,aimY:24+10.5,health:{alive:true}};p.setThreatSources([enemy]);tickActor(p,bird);expect(bird.spooks).toBe(0);
  // Nearby in3D: leave a supported perch quickly, without an extra thinker.
  enemy.x=bird.x+8;enemy.aimY=bird.y+bird.centerOffset;tickActor(p,bird);expect(bird.spooks).toBe(1);expect(bird.frightened).toBe(true);
  for(let frame=0;frame<240&&!bird.flight;frame++)p.advance(1/60);expect(bird.flight).toBe(true);expect(bird.fleeJourneys).toBeGreaterThan(0);
  expect(bird.duration).toBeCloseTo(Math.max(1,(Math.hypot(bird.destinationX-bird.fromX,bird.destinationZ-bird.fromZ)+2*(bird.ceiling-Math.min(bird.fromY,bird.destinationY)))/44),8);
  enemy.health.alive=false;
  // Move to an interior point and introduce a threat ahead at the same height.
  p.moveBird(bird,bird.duration*.25);const goal=p.perches[bird.goalPerch],dx=goal.x-bird.x,dz=goal.z-bird.z,length=Math.hypot(dx,dz),x=bird.x+dx/length*8,z=bird.z+dz/length*8,y=bird.y+bird.centerOffset;
  p.spookExplosion(x,y,z,36);const beforeX=bird.x,beforeY=bird.y,beforeZ=bird.z,beforeThink=p.thinkCount;p.thinker=3;p.advance(.000001);
  expect(p.thinkCount).toBe(beforeThink+1);expect(bird.lastSpookKind).toBe('explosion');expect(Math.hypot(bird.x-beforeX,bird.y-beforeY,bird.z-beforeZ)).toBeLessThan(.001);
  expect(bird.phase==='startled'||bird.fleeJourneys>1).toBe(true);let minimum=distance3(bird,x,y,z),resumed=false;
  for(let frame=0;frame<120;frame++){p.advance(1/60);if(bird.phase==='flying')resumed=true;expect(distance3(bird,x,y,z)).toBeGreaterThanOrEqual(minimum-1e-4);expect(blocked([bird.x-bird.radius,bird.y,bird.z-bird.radius,bird.x+bird.radius,bird.y+bird.height,bird.z+bird.radius],f.world.visibility)).toBe(false);}
  expect(resumed).toBe(true);expect(bird.fleeJourneys).toBeGreaterThan(1);
 }finally{f.dispose();}
});


test('bird clearance encloses all turret variants through pitched recoil and yaw',()=>{
 const level=structuredClone(levels.get('A')),variants=['base','upgrade1','upgrade2'];
 level.placements.filter(p=>p.model==='turret-study').forEach((p,i)=>p.variant=variants[i]);
 const world=buildWorld(level,library,{actors:wildlifeActorsForLevel(level.id)}),preview=new WildlifePreview(world,()=>{});
 try{
  let index=0;
  for(const data of world.rigs.values())if(data.role==='defence'){
   const bounds=preview.defences.subarray(index*6,index*6+6);index++;
   const rig=new PoseRig(data,()=>{});let violation=0,maxHeight=0;
   const meshes=new Map(world.entries.map(entry=>[entry.key,entry.mesh.vertices]));
   for(const yaw of [0,.7,Math.PI/2])for(let degree=-35;degree<=35;degree+=5)for(const recoil of [0,TURRET_RECOIL.distance/2,TURRET_RECOIL.distance]){
    rig.setRotation(TURRET_TURN.part,0,yaw,0);rig.setRotation(TURRET_PITCH.part,degree*Math.PI/180,0,0);rig.setTranslation(TURRET_RECOIL.part,0,0,recoil);rig.update();
    for(const bone of rig.bones){const vertices=meshes.get(bone.instance.key),m=bone.instance.matrix;
     for(let i=0;i<vertices.length;i+=11){const q=point(m,vertices[i],vertices[i+1],vertices[i+2]);maxHeight=Math.max(maxHeight,q[1]);for(let axis=0;axis<3;axis++)violation=Math.max(violation,bounds[axis]-q[axis],q[axis]-bounds[axis+3]);}
    }
   }
   expect(violation).toBeLessThan(1e-4);
   const neutral=Math.max(...data.parts.flatMap(part=>part.voxels.map(c=>c[1]+1)))+data.root[13];
   expect(maxHeight).toBeGreaterThan(neutral+4);expect(bounds[4]-maxHeight).toBeLessThan(.05);
  }
  expect(index).toBe(3);
 }finally{preview.dispose();disposeWorld(world);}
});
