import {test,expect} from 'bun:test';
import {Health} from '../engine/health.js';
import {TurretPreview} from '../game/turret-preview.js';
import {DogPreview,DOG_PREVIEW_ACTORS} from '../game/dog-preview.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {placementMatrix} from '../shared/math.js';
import {firstLevel,sceneryModels} from '../scripts/first-level.js';
import {dogModel} from '../scripts/dog.js';
import {DOG_WALK} from '../engine/dog-gait.js';
import {TURRET_MUZZLES} from '../shared/arsenal.js';

const target=(id='dog',hp=150)=>({id,health:new Health(hp),x:12,z:-18});
function fixture(targets,variant='base',count=1,visibility={clear:()=>true},onShot=null){
 const gunY=TURRET_MUZZLES[variant][0][1];for(const target of targets)target.aimY??=24+gunY;
 const placements=[],rigs=new Map();
 for(let i=0;i<count;i++){
  const id='turret-'+i,root=placementMatrix([0,1,0],0),parts=[{id:'base',parent:null,pivot:[12,0,12]},{id:'head',parent:'base',pivot:[12,17,12]},{id:'guns',parent:'head',pivot:[12,gunY,15]}];
  placements.push({id,model:'turret-study',variant});
  rigs.set(id,{root,parts,instances:parts.map(part=>({part:part.id,key:part.id,index:i,matrix:new Float32Array(root)}))});
 }
 return new TurretPreview({level:{placements},rigs,visibility},()=>{},()=>.5,onShot,targets,(dog,strength)=>dog.health.takeDamage(strength));
}

test('health validates stats, clamps overkill, counts actual hits and never damages a dead actor twice',()=>{
 for(const value of [0,-1,NaN,Infinity,'150',null])expect(()=>new Health(value)).toThrow();
 const health=new Health(150);expect(health.alive).toBe(true);
 expect(health.takeDamage(0)).toBe(0);expect(health.hits).toBe(0);
 expect(health.takeDamage(10)).toBe(10);expect(health.current).toBe(140);
 for(const value of [-1,NaN,Infinity,'10',null])expect(()=>health.takeDamage(value)).toThrow();
 expect(health.current).toBe(140);
 expect(health.takeDamage(200)).toBe(140);expect(health.current).toBe(0);expect(health.alive).toBe(false);expect(health.hits).toBe(2);
 expect(health.takeDamage(10)).toBe(0);expect(health.hits).toBe(2);
});

test('one paired-muzzle pulse applies one strength value; every burst pulse resolves separately',()=>{
 for(const variant of ['base','upgrade1']){
  const dog=target(),events=[],preview=fixture([dog],variant,1,undefined,(...event)=>events.push(event));
  preview.advance(.01);expect(events.length).toBe(1);expect(dog.health.current).toBe(variant==='base'?140:138);expect(dog.health.hits).toBe(1);
  preview.advance(.119);expect(events.length).toBe(1);
  preview.advance(.0011);preview.advance(.1201);
  expect(events.length).toBe(variant==='base'?1:3);expect(dog.health.current).toBe(variant==='base'?140:114);
  expect(dog.health.hits).toBe(events.length);expect(preview.states[0].lastShotDamage).toBe(variant==='base'?10:12);
 }
});

test('range, scenery occlusion and incomplete aiming prevent both damage and firing',()=>{
 for(const cause of ['range','scenery','aim']){
  const dog=target();if(cause==='range')dog.z=-100;if(cause==='aim'){dog.x=42;dog.z=12;}
  const preview=fixture([dog],'base',1,{clear:()=>cause!=='scenery'});preview.advance(.01);
  expect(dog.health.current).toBe(150);expect(dog.health.hits).toBe(0);expect(preview.shots).toBe(0);
 }
});

test('a lethal burst pulse clears its lock and remaining rounds without transferring them to a replacement',()=>{
 const doomed=target('a',12),replacement=target('b'),preview=fixture([doomed,replacement],'upgrade1'),state=preview.states[0];
 preview.advance(.01);expect(doomed.health.alive).toBe(false);expect(state.target).toBeNull();expect(state.cycle.remaining).toBe(0);expect(state.lastShotTargetId).toBe('a');
 preview.advance(.12);expect(state.target).toBe(replacement);expect(replacement.health.current).toBe(150);expect(state.cycle.shots).toBe(1);
 preview.advance(.881);expect(replacement.health.current).toBe(138);expect(state.cycle.shots).toBe(2);expect(state.cycle.remaining).toBe(2);
 // A stall emits only one newly validated pulse, never replays old damage.
 preview.advance(100);expect(replacement.health.current).toBe(126);expect(state.cycle.shots).toBe(3);expect(state.cycle.remaining).toBe(1);
 preview.dispose();expect(preview.onHit).toBeNull();expect(preview.targets).toBeNull();
});

test('later turrets immediately reject a killed dog and acquire replacements on their next think',()=>{
 for(const hasReplacement of [false,true]){
  const doomed=target('a',30),replacement=target('b'),targets=hasReplacement?[doomed,replacement]:[doomed];
  const preview=fixture(targets,'base',2);preview.advance(.01);preview.advance(.01);
  expect(doomed.health.current).toBe(10);expect(preview.states[1].target).toBe(doomed);
  preview.advance(1);expect(doomed.health.current).toBe(0);expect(doomed.health.hits).toBe(3);
  expect(preview.states[0].lastShotTargetId).toBe('a');expect(preview.states[1].cycle.shots).toBe(1);
  expect(preview.states[1].target).toBeNull();expect(replacement.health.current).toBe(150);
  preview.advance(.01);expect(preview.states[1].cycle.shots).toBe(hasReplacement?2:1);
  expect(replacement.health.current).toBe(hasReplacement?140:150);
  expect(preview.states[1].target?.id??null).toBe(hasReplacement?'b':null);
 }
});

const library=new Map(sceneryModels().map(model=>[model.id,model]));
library.set('dog',dogModel());library.set('turret-study',await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json());
library.set('power-generator',await Bun.file(new URL('../assets/models/power-generator.json',import.meta.url)).json());

test('dog death occurs once, stops pose updates and velocity, and never resets health at a path loop',()=>{
 const world=buildWorld(firstLevel(),library,{actors:DOG_PREVIEW_ACTORS}),deaths=[];let updates=0;
 const dogs=new DogPreview(world,()=>updates++,id=>deaths.push(id)),dead=dogs.states[0],living=dogs.states[1];
 dogs.takeHit(living,28);dogs.takeHit(dead,400);const distance=dead.distance,poses=dead.rig.bones.map(b=>b.instance.matrix.slice());
 expect(dogs.alive).toBe(2);expect(dogs.takeHit(dead,10)).toBe(0);expect(deaths).toEqual([dead.id]);
 updates=0;dogs.advance(dogs.path.length/DOG_WALK.speed+1);expect(updates).toBe(26);expect(dead.distance).toBe(distance);expect(dead.velocityX).toBe(0);expect(dead.velocityZ).toBe(0);
 for(let i=0;i<poses.length;i++)expect(dead.rig.bones[i].instance.matrix).toEqual(poses[i]);
 expect(living.health.current).toBe(272);expect(living.health.hits).toBe(1);
 for(const dog of dogs.states)dogs.takeHit(dog,300);
 updates=0;const time=dogs.time;dogs.advance(1);expect(updates).toBe(0);expect(dogs.updatedParts).toBe(0);expect(dogs.time).toBe(time);expect(dogs.alive).toBe(0);expect(deaths.length).toBe(3);
 expect(dogs.takeHit(target(),10)).toBe(0);
 dogs.dispose();disposeWorld(world);expect(dogs.onDeath).toBeNull();expect(dogs.states.length).toBe(0);
});

test('the authored preview survives many real hits then removes all three dogs with unchanged movement, range and LOS',()=>{
 const world=buildWorld(firstLevel(),library,{actors:DOG_PREVIEW_ACTORS}),deaths=[],dogs=new DogPreview(world,()=>{},id=>deaths.push(id));
 const states=dogs.states.slice(),health=states.map(d=>d.health);
 const turrets=new TurretPreview(world,()=>{},()=>.5,null,dogs.states,(dog,strength)=>dogs.takeHit(dog,strength));
 let elapsed=0;
 while(dogs.alive&&elapsed<100){dogs.advance(1/60);turrets.advance(1/60);elapsed+=1/60;}
 expect(dogs.alive).toBe(0);expect(deaths.length).toBe(3);expect(new Set(deaths).size).toBe(3);expect(elapsed).toBeLessThan(70);
 for(let i=0;i<states.length;i++){expect(states[i]).toBe(dogs.states[i]);expect(states[i].health).toBe(health[i]);expect(health[i].current).toBe(0);expect(health[i].hits).toBeGreaterThanOrEqual(25);expect(health[i].hits).toBeLessThanOrEqual(30);}
 const shots=turrets.shots;expect(health.reduce((sum,h)=>sum+h.hits,0)).toBe(shots);
 for(let i=0;i<120;i++){dogs.advance(1/60);turrets.advance(1/60);}
 expect(turrets.shots).toBe(shots);expect(turrets.states.every(s=>s.target===null&&s.cycle.remaining===0)).toBe(true);expect(dogs.updatedParts).toBe(0);
 turrets.dispose();dogs.dispose();disposeWorld(world);
 // A fresh scene is the explicit preview reset; no destroyed slots leak into it.
 const freshWorld=buildWorld(firstLevel(),library,{actors:DOG_PREVIEW_ACTORS}),fresh=new DogPreview(freshWorld,()=>{});
 expect(fresh.states.every(d=>d.health.current===300&&d.health.hits===0)).toBe(true);expect(fresh.alive).toBe(3);
 fresh.dispose();disposeWorld(freshWorld);
});
