import {balanceProbe} from './helpers/enemy-balance-probe.js';
import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {newModel} from '../shared/model.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {ENEMY_STATS} from '../shared/enemy.js';
import {ENEMY_IMPACT,ENEMY_BALANCE} from '../engine/enemy-impact.js';

const sources=new Map(await Promise.all(['dog','walker','spider'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
function fixture(model='dog',configure=null,onDeath=null){
 const level=newLevel('impact-study');level.path=Array.from({length:9},(_,i)=>[i+1,0,2]);
 const models=new Map(sources);configure?.(level,models);
 const actors=[{id:'impact-target',model,variant:'base',distance:48}],world=buildWorld(level,models,{actors}),preview=new EnemyPreview(world,()=>{},onDeath,actors);
 return {world,preview,state:preview.states[0],dispose(){preview.dispose();disposeWorld(world);}};
}
function point(matrix,p){return [0,1,2].map(axis=>matrix[axis]*p[0]+matrix[4+axis]*p[1]+matrix[8+axis]*p[2]+matrix[12+axis]);}
function obstacle(role){
 const model=newModel('impact-block');model.role=role;
 for(let x=0;x<24;x++)for(let y=0;y<12;y++)model.variants.base.parts[0].voxels.push([x,y,0,0]);
 return model;
}

test('a directional hit tilts the body while IK keeps feet flat and public coordinates match the rig',()=>{
 for(const model of sources.keys()){
  const hit=fixture(model),base=fixture(model);try{
   const s=hit.state,reference=base.state,initial=s.rig.bones.map(b=>b.instance.matrix.slice());
   expect(hit.preview.impactClearance).toBeNull();
   expect(hit.preview.takeHit(s,1,0,0,60)).toBe(1);expect(s.impact.active).toBe(true);expect(s.impact.hits).toBe(1);
   expect(s.impact.offsetZ).toBe(0);expect(s.velocityZ).toBe(ENEMY_IMPACT.kick*ENEMY_BALANCE[model].push);
   for(let i=0;i<initial.length;i++)expect(s.rig.bones[i].instance.matrix).toEqual(initial[i]);
   const field=hit.preview.impactClearance,queries=field.queries;
   for(const dt of [.05,.12,.18,.35,1.3]){
    hit.preview.advance(dt);base.preview.advance(dt);
    expect(s.distance).toBe(reference.distance);expect(s.yaw).toBe(reference.yaw);
    expect(s.aimY).toBeCloseTo(point(s.rig.byId.get('body').instance.matrix,ENEMY_STATS[model].effectOrigin.point)[1],9);
    expect(s.x-reference.x).toBeCloseTo(s.impact.offsetX,10);expect(s.z-reference.z).toBeCloseTo(s.impact.offsetZ,10);
    expect(s.velocityX-reference.velocityX).toBeCloseTo(s.impact.velocityX,10);expect(s.velocityZ-reference.velocityZ).toBeCloseTo(s.impact.velocityZ,10);
    if(s.impact.active)expect(Math.hypot(s.impact.pitch,s.impact.roll)).toBeGreaterThan(0);
    for(let i=0;i<s.gait.feet.length;i++){
     const foot=s.gait.feet[i],bone=s.rig.byId.get(foot.paw),actual=point(bone.instance.matrix,bone.part.pivot);
     for(let axis=0;axis<3;axis++)expect(actual[axis]).toBeCloseTo(foot.position[axis],4);
     for(const index of [1,4,6,9])expect(bone.instance.matrix[index]).toBeCloseTo(0,5);expect(bone.instance.matrix[5]).toBeCloseTo(1,5);
     if(foot.stance)expect(actual[1]).toBeCloseTo(25,4);
    }
   }
   expect(s.impact.active).toBe(false);expect(s.impact.offsetZ).toBe(0);expect(field.queries).toBe(queries);
  }finally{hit.dispose();base.dispose();}
 }
});

test('downward hits cause a forward stumble and brace while legacy or invalid hits do not react',()=>{
 const f=fixture();try{
  const s=f.state;
  for(const velocity of [[],[NaN,1,1],[1,Infinity,1],[0,0,0]]){f.preview.takeHit(s,1,...velocity);expect(s.impact.active).toBe(false);}
  expect(s.health.current).toBe(296);expect(s.impact.hits).toBe(0);
  f.preview.takeHit(s,1,0,-80,0);f.preview.advance(1/ENEMY_IMPACT.omega);
  expect(s.impact.active).toBe(true);expect(s.impact.offsetX).toBeGreaterThan(1.8);expect(s.impact.offsetZ).toBeCloseTo(0,9);
  expect(Math.abs(s.impact.pitch)*180/Math.PI).toBeCloseTo(ENEMY_BALANCE.dog.pitch,8);expect(s.impact.bob).toBeCloseTo(ENEMY_BALANCE.dog.bob,8);
  f.preview.reset();f.preview.takeHit(s,1,3,-4,0);expect(s.impact.velocityX).toBeCloseTo(ENEMY_IMPACT.kick*.65*ENEMY_BALANCE.dog.push,10);expect(s.impact.velocityZ).toBe(0);
  f.preview.advance(1/ENEMY_IMPACT.omega);expect(s.impact.offsetX).toBeCloseTo(ENEMY_IMPACT.kick*.65*ENEMY_BALANCE.dog.push/(ENEMY_IMPACT.omega*Math.E),10);
 }finally{f.dispose();}
});

test('closed-form recovery agrees across frame partitions, settles on long deltas and performs no frame queries',()=>{
 const fine=fixture(),coarse=fixture();try{
  for(const f of [fine,coarse])f.preview.takeHit(f.state,1,60,-20,30);
  const queries=fine.preview.impactClearance.queries;
  for(let i=0;i<144;i++)fine.preview.advance(1/120);coarse.preview.advance(1.2);
  for(const key of ['x','z','velocityX','velocityZ'])expect(fine.state[key]).toBeCloseTo(coarse.state[key],9);
  expect(fine.state.impact.offsetX).toBeCloseTo(coarse.state.impact.offsetX,10);expect(fine.preview.impactClearance.queries).toBe(queries);
  coarse.preview.advance(20);expect(coarse.state.impact.active).toBe(false);expect(coarse.state.impact.offsetX).toBe(0);expect(coarse.state.impact.offsetZ).toBe(0);
  expect(Number.isFinite(coarse.state.x)).toBe(true);expect(Math.hypot(coarse.state.velocityX,coarse.state.velocityZ)).toBe(coarse.state.movement.speed);
 }finally{fine.dispose();coarse.dispose();}
});

test('repeated directional hits preserve position continuity and bound the complete recovery peak',()=>{
 const f=fixture();try{
  const s=f.state;
  for(let frame=0;frame<150;frame++){
   if(frame%5===0){const x=s.x,z=s.z;f.preview.takeHit(s,.1,frame%20<10?60:-60,-10,40);expect(s.x).toBe(x);expect(s.z).toBe(z);}
   f.preview.advance(.01);expect(Math.hypot(s.impact.offsetX,s.impact.offsetZ)).toBeLessThanOrEqual(ENEMY_IMPACT.maxOffset+1e-10);expect(Math.hypot(s.impact.velocityX,s.impact.velocityZ)).toBeLessThanOrEqual(ENEMY_IMPACT.maxSpeed+1e-10);
  }
  expect(s.impact.hits).toBe(30);expect(s.impact.restricted).toBeGreaterThan(0);
  f.preview.advance(ENEMY_IMPACT.seconds);expect(s.impact.active).toBe(false);expect(s.impact.offsetX).toBe(0);expect(s.impact.offsetZ).toBe(0);
 }finally{f.dispose();}
});

test('clearance preserves sliding sole support and excludes banks, water, bounds, scenery and defences',()=>{
 for(const type of ['open','lower','higher','water','boundary','scenery','defence']){
  const f=fixture('spider',(level,models)=>{
   if(type==='boundary')level.path=level.path.map(([x,y])=>[x,y,0]);
   if(['lower','higher','water'].includes(type))for(let x=1;x<10;x++)level.terrain.boxes.push({box:[x,3],ground:type==='higher'?30:4,water:type==='water'?12:0});
   if(type==='scenery'||type==='defence'){
    const model=obstacle(type);models.set(model.id,model);
    level.placements.push({id:'block',model:model.id,variant:'base',box:[3,0,3],turn:0});
   }
  });try{
   const s=f.state,direction=type==='boundary'?-60:60;
   f.preview.takeHit(s,1,0,0,direction);f.preview.advance(1/6);
   if(type==='open'){expect(s.impact.offsetZ).toBeGreaterThan(.9);expect(s.impact.restricted).toBe(0);}
   else{expect(s.impact.offsetZ).toBe(0);expect(s.impact.restricted).toBe(1);}
   if(type==='water'){
    // The route itself is not a movement fence: the opposite dry shoulder is safe.
    expect(f.preview.impactClearance.clear([60,24,70,84,40,74])).toBe(false);f.preview.reset();f.preview.takeHit(s,1,0,0,-60);f.preview.advance(1/6);expect(s.impact.offsetZ).toBeLessThan(-.9);
   }
  }finally{f.dispose();}
 }
});

test('clearance checks the future recovery corridor rather than only the impact position',()=>{
 const f=fixture('dog',(level,models)=>{
  const model=obstacle('scenery');models.set(model.id,model);
  level.placements.push({id:'ahead',model:model.id,variant:'base',box:[4,0,3],turn:0});
 });try{
  // At impact the envelope ends at X96 and does not overlap this obstacle.
  // Normal route progress reaches it before the proposed sideways skid settles.
  f.preview.takeHit(f.state,1,0,0,60);expect(f.state.impact.active).toBe(false);expect(f.state.impact.restricted).toBe(1);
  const field=f.preview.impactClearance;expect(field.queries).toBeLessThanOrEqual(ENEMY_IMPACT.maxSpans*(ENEMY_IMPACT.searchSteps+2));
 }finally{f.dispose();}
});

test('a rejected repeat hit leaves the previously certified recovery unchanged before a narrowing corridor',()=>{
 const configure=(level,models)=>{
  const model=obstacle('scenery');model.variants.base.parts[0].voxels=model.variants.base.parts[0].voxels.filter(cell=>cell[0]>=4);models.set(model.id,model);
  level.placements.push({id:'later-obstacle',model:model.id,variant:'base',box:[5,0,3],turn:0});
 },hit=fixture('dog',configure),reference=fixture('dog',configure);
 try{
  for(const f of [hit,reference]){f.preview.takeHit(f.state,1,0,0,60);expect(f.state.impact.active).toBe(true);f.preview.advance(.75);}
  const s=hit.state,r=reference.state;
  hit.preview.takeHit(s,1,0,0,60);expect(s.impact.hits).toBe(2);expect(s.impact.restricted).toBe(1);
  for(const key of ['offsetX','offsetZ','velocityX','velocityZ','age'])expect(s.impact[key]).toBe(r.impact[key]);
  for(let i=0;i<5;i++){
   hit.preview.advance(.25);reference.preview.advance(.25);
   expect(s.x).toBe(r.x);expect(s.z).toBe(r.z);expect(s.velocityX).toBe(r.velocityX);expect(s.velocityZ).toBe(r.velocityZ);
  }
  expect(s.impact.active).toBe(false);expect(s.impact.offsetZ).toBe(0);
 }finally{hit.dispose();reference.dispose();}
});

test('an incomplete visibility fixture suppresses only the impulse and preserves ordinary damage and gait',()=>{
 const f=fixture(),visibility=f.world.visibility;
 try{
  f.world.visibility=null;f.preview.takeHit(f.state,1,0,0,60);
  expect(f.state.health.current).toBe(299);expect(f.state.impact.active).toBe(false);expect(f.state.impact.restricted).toBe(1);expect(f.preview.impactClearance).toBeNull();
  f.preview.advance(.2);expect(f.state.distance).toBeCloseTo(50.4,10);expect(f.state.velocityX).toBe(12);expect(f.state.velocityZ).toBe(0);
 }finally{f.world.visibility=visibility;f.dispose();}
});

test('death freezes the displaced pose, while reset, route wrap and disposal clear reaction storage',()=>{
 let death=null;const f=fixture('walker',null,(_id,state)=>{death={x:state.x,z:state.z,matrix:state.rig.bones[0].instance.matrix.slice()};});
 const s=f.state;try{
  f.preview.takeHit(s,1,0,0,60);f.preview.advance(.17);const x=s.x,z=s.z,hits=s.impact.hits,pose=s.rig.bones.map(b=>b.instance.matrix.slice());
  f.preview.takeHit(s,400,-60,0,0);expect(s.impact.hits).toBe(hits);expect(death.x).toBe(x);expect(death.z).toBe(z);expect(death.matrix).toEqual(pose[0]);
  f.preview.advance(1);for(let i=0;i<pose.length;i++)expect(s.rig.bones[i].instance.matrix).toEqual(pose[i]);expect(s.velocityX).toBe(0);expect(s.velocityZ).toBe(0);
  f.preview.reset();expect(s.health.current).toBe(300);expect(s.impact.hits).toBe(0);expect(s.impact.restricted).toBe(0);expect(s.impact.offsetZ).toBe(0);
  f.preview.time=(f.preview.path.length-s.seed-.1)/s.movement.speed;f.preview.pose();f.preview.takeHit(s,1,0,0,60);f.preview.advance(.02);
  expect(s.lap).toBe(1);expect(s.impact.active).toBe(false);expect(s.impact.offsetX).toBe(0);expect(s.impact.offsetZ).toBe(0);
  const field=f.preview.impactClearance,arrays=[field.heights,field.defences,field.bounds,field.range,field.from,field.to];
  f.preview.reset();expect([field.heights,field.defences,field.bounds,field.range,field.from,field.to]).toEqual(arrays);
  f.dispose();expect(field.visibility).toBeNull();expect(field.heights).toBeNull();expect(f.preview.world).toBeNull();expect(s.impact.active).toBe(false);
 }finally{if(f.preview.world)f.dispose();}
});


test('full torso aim point and analytic velocity remain current after a hit and freeze before death',()=>{
 for(const model of sources.keys()){
  const f=fixture(model);try{
   const s=f.state,rig=s.rig.byId.get('body');const before=[s.aimVelocityX,s.aimVelocityY,s.aimVelocityZ],matrices=s.rig.bones.map(b=>b.instance.matrix.slice());
   f.preview.takeHit(s,1,60,-40,20);
   expect([s.aimVelocityX,s.aimVelocityY,s.aimVelocityZ]).not.toEqual(before);
   expect(s.velocityY).not.toBe(0);for(let i=0;i<matrices.length;i++)expect(s.rig.bones[i].instance.matrix).toEqual(matrices[i]);
   f.preview.advance(.1);
   const p=point(rig.instance.matrix,ENEMY_STATS[model].effectOrigin.point);
   expect([s.aimX,s.aimY,s.aimZ]).toEqual(p);
   const velocity=[s.aimVelocityX,s.aimVelocityY,s.aimVelocityZ],h=.001;
   f.preview.advance(h);
   for(let i=0;i<3;i++)expect(Math.abs(([s.aimX,s.aimY,s.aimZ][i]-p[i])/h-velocity[i])).toBeLessThan(.08);
   f.preview.takeHit(s,1000,60,-40,20);
   for(const key of ['velocityX','velocityY','velocityZ','aimVelocityX','aimVelocityY','aimVelocityZ'])expect(s[key]).toBe(0);
   for(const key of ['pitchRate','rollRate','bobRate','tiltVelocityX','tiltVelocityZ','braceVelocity'])expect(s.impact[key]).toBe(0);
  }finally{f.dispose();}
 }
});

for(const model of ['dog','walker','spider'])test(`impact phase and corner regression certifies actual cells, sole support and IK (${model})`,async()=>{
 const proof=await balanceProbe(model);
 expect(proof.failure).toBeNull();expect(proof.count).toBe(3024);
 expect(proof.maxAngle).toBeCloseTo(ENEMY_BALANCE[model].pitch,6);expect(proof.minY).toBeGreaterThan(24-1e-4);
 expect(proof.maxR).toBeLessThan(13.5);expect(proof.maxSoleR).toBeLessThan(12);
 expect(proof.maxFootError).toBeLessThan(1e-4);expect(proof.contactError).toBeLessThan(1e-6);
},30000);

test('Dog corner guard preserves the accepted whole gait and cannot snap a repeated active balance',()=>{
 const configure=level=>{level.path=[[3,0,3],[4,0,3],[5,0,3],[6,0,3],[6,0,4],[6,0,5],[6,0,6]];},hit=fixture('dog',configure),unhit=fixture('dog',configure);
 try{
  hit.state.seed=unhit.state.seed=68;hit.preview.reset();unhit.preview.reset();hit.preview.takeHit(hit.state,1,-60,-40,0);
  expect(hit.state.impact.balanceAllowed).toBe(false);
  for(let i=0;i<30;i++){hit.preview.advance(1/60);unhit.preview.advance(1/60);expect(hit.state.impact.pitch).toBe(0);expect(hit.state.impact.roll).toBe(0);for(let j=0;j<hit.state.rig.bones.length;j++)expect(hit.state.rig.bones[j].pose).toEqual(unhit.state.rig.bones[j].pose);}
  hit.state.seed=41;hit.preview.reset();hit.preview.takeHit(hit.state,1,60,-40,0);expect(hit.state.impact.balanceAllowed).toBe(true);
  hit.preview.advance(.2);const pose=hit.state.rig.bones.map(b=>b.instance.matrix.slice()),age=hit.state.impact.age;
  hit.preview.takeHit(hit.state,1,60,-40,0);expect(hit.state.impact.balanceAllowed).toBe(true);expect(hit.state.impact.age).toBe(age);
  for(let i=0;i<pose.length;i++)expect(hit.state.rig.bones[i].instance.matrix).toEqual(pose[i]);
 }finally{hit.dispose();unhit.dispose();}
});


test('stagger is visibly larger, slower to recover and remains useful on downward Dog corner hits',()=>{
 for(const model of sources.keys()){
  const f=fixture(model);try{
   f.preview.takeHit(f.state,1,0,0,60);f.preview.advance(1/ENEMY_IMPACT.omega);
   expect(f.state.impact.offsetZ).toBeGreaterThan(2.8);expect(f.state.impact.offsetZ).toBeLessThan(3);
   f.preview.advance(.75-1/ENEMY_IMPACT.omega);expect(f.state.impact.offsetZ).toBeGreaterThan(1.1);
   f.preview.advance(ENEMY_IMPACT.seconds-.75);expect(f.state.impact.active).toBe(false);expect(f.state.impact.offsetZ).toBe(0);
  }finally{f.dispose();}
 }
 const f=fixture('dog',level=>{level.path=[[3,0,3],[4,0,3],[5,0,3],[6,0,3],[6,0,4],[6,0,5],[6,0,6]];});
 try{
  f.state.seed=68;f.preview.reset();f.preview.takeHit(f.state,1,0,-80,0);f.preview.advance(1/ENEMY_IMPACT.omega);
  expect(f.state.impact.balanceAllowed).toBe(false);expect(f.state.impact.pitch).toBe(0);expect(f.state.impact.roll).toBe(0);
  expect(Math.hypot(f.state.impact.offsetX,f.state.impact.offsetZ)).toBeGreaterThan(1.8);
  for(const foot of f.state.gait.feet){const m=f.state.rig.byId.get(foot.paw).instance.matrix;expect(m[5]).toBeCloseTo(1,5);if(foot.stance)expect(foot.position[1]).toBe(25);}
 }finally{f.dispose();}
});
