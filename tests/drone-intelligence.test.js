import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {Health} from '../engine/health.js';
import {DefencePreview} from '../game/defence-preview.js';

const models=new Map(await Promise.all(['drone-defence','turret-study'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
function enemy(id,{hp=100,z=84,distance=120,length=276,speed=12,forecast=true}={}){
 const path={length,sample(d,out){out[0]=d;out[1]=z;out[2]=0;out[3]=1;out[4]=0;return out;}};
 return {id,x:distance,y:24,z,aimX:distance,aimY:34.5,aimZ:z,distance,path,lap:0,movement:{speed},health:new Health(hp),threat:1,routeForecastEligible:forecast};
}
function fixture(targets){
 const level=newLevel('drone-intelligence');level.size=[12,10];level.placements=[{id:'drone',model:'drone-defence',variant:'base',box:[5,0,5],turn:0},{id:'gun',model:'turret-study',variant:'base',box:[8,0,4],turn:0}];
 const world=buildWorld(level,models),firing=new DefencePreview(world,()=>{},()=>.5,null,targets,(target,damage)=>target.health.takeDamage(damage));
 return {world,firing,planner:firing.planner,d:firing.drones,s:firing.drones.states[0],gun:firing.turrets.states[0],dispose(){firing.dispose();disposeWorld(world);}};
}
function select(f){const {s,d,planner}=f;d.prepare(s);const target=planner.choose(s,planner.states.indexOf(s),0);s.target=target;s.targetLap=target?.lap??0;d.selected(s,target);return target;}
function airborne(f){const s=f.s;s.phase='intercept';s.y=s.homeY;s.nextPlanAt=0;f.d.writePose(s,0);}

test('likely escapees outrank a nearly dead enemy with enough downstream gun time',()=>{
 const safe=enemy('weak-covered',{hp:10,distance:180}),risk=enemy('escaping',{hp:100,z:36,distance:132}),f=fixture([safe,risk]);try{
  airborne(f);expect(f.planner.capacity(0,safe)).toBeGreaterThan(20);expect(f.planner.capacity(0,risk)).toBe(0);
  expect(f.d.escapeRank(f.s,safe)).toBe(1);expect(f.d.escapeRank(f.s,risk)).toBe(2);expect(select(f)).toBe(risk);
 }finally{f.dispose();}
});

test('potential escapees remain a usable fallback when the priority enemy cannot be intercepted',()=>{
 const potential=enemy('potential',{hp:10,distance:180}),gone=enemy('too-late',{hp:100,z:12,distance:270}),f=fixture([potential,gone]);try{
  airborne(f);expect(f.d.escapeRank(f.s,gone)).toBe(2);expect(select(f)).toBe(potential);expect(f.s.candidateNodes[f.d.targetIndices.get(gone)]).toBe(-1);
 }finally{f.dispose();}
});

test('unknown and banking routes get no invented safety forecast, and imminent exits raise their priority',()=>{
 const target=enemy('uncertain',{forecast:false}),f=fixture([target]);try{
  expect(f.d.escapeRank(f.s,target)).toBe(1);target.distance=240;expect(f.d.escapeRank(f.s,target)).toBe(2);
  target.distance=120;target.routeForecastEligible=true;target.impact={active:true};expect(f.d.escapeRank(f.s,target)).toBe(1);
  target.movement.speed=0;expect(f.d.escapeRank(f.s,target)).toBe(1);
 }finally{f.dispose();}
});

test('validated incoming lethal damage excludes a target and active gun commitments lower escape priority',()=>{
 const target=enemy('covered',{hp:10,distance:210}),f=fixture([target]);try{
  airborne(f);f.gun.target=target;f.gun.targetLap=0;f.gun.lineOfSight=true;f.gun.aimError=f.gun.pitchError=0;
  expect(f.d.escapeRank(f.s,target)).toBe(0);
  f.planner.incomingDamage=()=>10;expect(select(f)).toBeNull();expect(f.s.stationCommitted).toBe(false);
 }finally{f.dispose();}
});

test('a higher escape class releases a held firing station after the current burst',()=>{
 const safe=enemy('old',{hp:10,distance:180}),risk=enemy('new',{hp:100,z:36,distance:132}),f=fixture([safe]);try{
  airborne(f);expect(select(f)).toBe(safe);expect(f.s.stationCommitted).toBe(true);
  // Model a wave spawn using the controller's lifecycle slots, as campaign
  // construction does before its active target array starts to compact.
  f.d.targetIndices.set(risk,1);f.s.candidateNodes=new Int32Array(2).fill(-1);f.s.candidateLap=new Float64Array(2);f.s.candidateWindows=new Float64Array(10);f.planner.targets.push(risk);
  f.s.cycle.remaining=2;f.d.prepare(f.s);expect(f.s.plannedTarget).toBe(safe);
  f.s.cycle.remaining=0;f.s.motion.clear();f.s.speed=0;expect(select(f)).toBe(risk);expect(f.s.plannedTarget).toBe(risk);
 }finally{f.dispose();}
});

test('urgency accounts for real travel and cooldown time and keeps equal-risk locks stable',()=>{
 const target=enemy('target'),f=fixture([target]);try{
  const index=f.d.targetIndices.get(target),base=f.planner.score(target,f.s);f.s.candidateNodes[index]=f.s.homeNode;f.s.candidateWindows[index*5+1]=5;
  expect(f.planner.score(target,f.s)).toBeGreaterThan(base);airborne(f);expect(select(f)).toBe(target);
  const goal=f.s.goalNode,changes=f.s.stationChanges;for(let i=0;i<20;i++)expect(select(f)).toBe(target);
  expect(f.s.goalNode).toBe(goal);expect(f.s.stationChanges).toBe(changes);
 }finally{f.dispose();}
});
