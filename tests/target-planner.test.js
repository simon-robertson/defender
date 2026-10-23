// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {TargetPlanner,forecastPulses} from '../engine/target-planner.js';
import {WeaponCycle} from '../engine/weapon.js';
import {DefenceAim} from '../engine/targeting.js';
import {Health} from '../engine/health.js';
import {TurretPreview,holdGunAcquisition} from '../game/turret-preview.js';
import {TURRET_FIRING} from '../shared/arsenal.js';
import {placementMatrix} from '../shared/math.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview,DOG_PREVIEW_ACTORS} from '../game/enemy-preview.js';
import {DefencePreview} from '../game/defence-preview.js';
import {missileActorsForLevel} from '../game/missile-preview.js';

const actor=(id,distance,options={})=>({id,x:distance,z:0,distance,lap:0,aimY:10,
 movement:{speed:10},threat:1,health:new Health(300),...options});
const route={length:300,sample(distance,out){out[0]=distance;out[1]=0;out[2]=0;out[3]=1;out[4]=0;}};
function defence(id,windows=[[0,300]],variant='base'){
 return {id,windows,x:0,z:0,target:null,strength:10,lineOfSight:false,aimError:null,
  targeting:new DefenceAim(TURRET_FIRING[variant],1000),cycle:new WeaponCycle(TURRET_FIRING[variant]),recoil:{sample:()=>0}};
}
function setup(states,targets,{path=route,incomingDamage,coverageVisible,coverageEnabled,holdTarget}={}){
 let scans=0;
 const contains=(state,x)=>state.windows.some(([start,end])=>x>=start&&x<=end);
 const eligible=(state,target)=>{scans++;return target.health.alive&&contains(state,target.x)&&state.targeting.solve(state.x,state.z,target);};
 const planner=new TargetPlanner(states,targets,{path,eligible,incomingDamage,coverageEnabled,holdTarget,coverageVisible:coverageVisible??((state,target)=>contains(state,target.x))});
 return {planner,scans:()=>scans};
}
function select(planner,state,index=0){const result=planner.choose(state,index,0);state.target=result;state.targetLap=result?.lap??0;return result;}
function delegation(hp=30,options){
 const current=actor('current',20,{health:new Health(hp)}),other=actor('other',10),up=defence('up',[[0,80]]),down=defence('down',[[100,200]]);
 const {planner}=setup([up,down],[current,other],options);up.target=current;
 return {planner,up,down,current,other};
}

test('equal threat follows time to exit, explicit threat can outweigh progress, and health breaks close urgency ties',()=>{
 const early=actor('early',20),late=actor('late',100),state=defence('gun'),{planner}=setup([state],[early,late]);
 expect(select(planner,state)).toBe(late);
 state.target=null;early.threat=4;expect(select(planner,state)).toBe(early);
 early.threat=1;early.distance=early.x=99;early.health.takeDamage(290);state.target=null;
 expect(select(planner,state)).toBe(early);
});

test('unknown route metadata still ranks threat but never invents downstream capacity',()=>{
 const a=actor('a',20,{threat:2}),b=actor('b',100),states=[defence('first'),defence('second')],{planner}=setup(states,[a,b],{path:null});
 states[1].target=a;expect(planner.capacity(1,a)).toBe(0);expect(select(planner,states[0])).toBe(a);
});

test('explicitly disabled forecasts skip all route probes while default coverage and live eligibility remain intact',()=>{
 for(const enabled of [undefined,()=>true,()=>false]){
  let samples=0,visibility=0;
  const path={length:route.length,sample(distance,out){samples++;route.sample(distance,out);}},state=defence('gun'),target=actor('target',20);
  const {planner,scans}=setup([state],[target],{path,coverageEnabled:enabled,coverageVisible:()=>{visibility++;return true;}}),disabled=enabled?.()===false;
  expect(samples).toBe(disabled?0:301);expect(visibility).toBe(samples);
  expect(planner.coverage[0].size).toBe(disabled?0:1);
  if(disabled)expect(planner.capacity(0,target)).toBe(0);else expect(planner.capacity(0,target)).toBeGreaterThan(0);
  planner.advance(1/60);expect(state.target).toBe(target);expect(scans()).toBe(1);expect(planner.thinks).toBe(1);
  planner.dispose();
 }
 const states=[defence('gun'),defence('arc'),defence('silo')],target=actor('target',20),queried=[];
 const {planner}=setup(states,[target],{coverageEnabled:state=>state===states[0],coverageVisible:state=>{queried.push(state.id);return true;}});
 expect(queried).toHaveLength(301);expect(new Set(queried)).toEqual(new Set(['gun']));
 for(let i=0;i<3;i++){planner.advance(1/60);expect(planner.lastThinkId).toBe(states[i].id);expect(states[i].target).toBe(target);}
 expect(states.map(s=>s.thinkCount)).toEqual([1,1,1]);expect(planner.capacity(1,target)+planner.capacity(2,target)).toBe(0);planner.dispose();
});

test('uncertified route aim offsets and banking skip probes and credit without excluding live gun hits',()=>{
 for(const options of [{aimX:12,aimZ:-25},{airborne:true,aimX:14,aimY:60,aimZ:-18}]){
  const target=actor('uncertified',20,{x:12,z:-18,aimY:51.5,...options,routeForecastEligible:false}),state=defence('gun');
  let samples=0,visibility=0;
  const path={length:route.length,sample(distance,out){samples++;route.sample(distance,out);}};
  const {planner,scans}=setup([state],[target],{path,coverageVisible:()=>{visibility++;return true;}});
  expect(samples).toBe(0);expect(visibility).toBe(0);expect(planner.coverage[0].size).toBe(0);
  expect(planner.capacity(0,target)).toBe(0);planner.advance(1/60);
  expect(state.target).toBe(target);expect(state.predictedCoverage).toBe(0);expect(scans()).toBe(1);planner.dispose();
  const preview=liveFixture([target],{clear:()=>true});
  preview.onHit=(enemy,strength)=>enemy.health.takeDamage(strength);
  try{
   for(let frame=0;frame<120&&!target.health.hits;frame++)preview.advance(1/60);
   expect(target.health.hits).toBeGreaterThan(0);expect(target.health.current).toBeLessThan(300);
   const fired=preview.states.find(gun=>gun.cycle.shots>0);
   expect(fired?.lastShotTargetId).toBe(target.id);expect(fired?.lastShotDamage).toBe(12);
   expect(fired?.lastShotVisible).toBe(true);
  }finally{preview.dispose();}
 }
 // A shared height profile belongs only to certified actors, even when an
 // unsupported actor follows a supported actor at the same initial aim height.
 for(const flag of [undefined,true]){
  const supported=actor('supported',20,{routeForecastEligible:flag}),unsupported=actor('unsupported',20,{routeForecastEligible:false});
  let samples=0,visibility=0;
  const path={length:route.length,sample(distance,out){samples++;route.sample(distance,out);}};
  const {planner}=setup([defence('gun')],[supported,unsupported],{path,coverageVisible:()=>{visibility++;return true;}});
  expect(samples).toBe(301);expect(visibility).toBe(301);expect(planner.coverage[0].size).toBe(1);
  expect(planner.coverage[0].has(unsupported)).toBe(false);expect(planner.capacity(0,supported)).toBeGreaterThan(0);
  expect(planner.capacity(0,unsupported)).toBe(0);planner.dispose();
 }
});

test('revoking route forecast eligibility clears an existing reservation without rejecting its live target',()=>{
 const {planner,up,down,current,other}=delegation();
 expect(select(planner,up)).toBe(other);expect(down.reservation).toBe(current);expect(planner.capacity(1,current)).toBeGreaterThan(0);
 current.routeForecastEligible=false;
 expect(planner.capacity(1,current)).toBe(0);expect(planner.coverageDamage(current,0)).toBe(0);
 planner.releaseInvalidReservations();expect(down.reservation).toBeNull();
 up.target=null;expect(select(planner,up)).toBe(current);expect(up.predictedCoverage).toBe(0);planner.dispose();
});

test('production gun, Arc and missile scenes retain deterministic combat after omitting unused forecasts',async()=>{
 // Retains the current stationary combat baseline, including physical missile
 // timing; the former [2,15,8] missile snapshot predates that accepted timing.
 const expected=[['moss-01',[24,41,12],[25,26,26]],['moss-02',[6,13,4],[9,8,6]],['moss-03',[0,6,6],[4,4,4]]],sources=new Map();
 for(const [id,shots,hits]of expected){
  const level=await Bun.file(new URL(`../project-docs/landscape-reset-2026-10-18/previous-levels/${id}.json`,import.meta.url)).json(),actors=[...DOG_PREVIEW_ACTORS,...missileActorsForLevel(id)],models=new Map();
  for(const model of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)])){
   if(!sources.has(model))sources.set(model,await Bun.file(new URL(`../assets/models/${model}.json`,import.meta.url)).json());models.set(model,sources.get(model));
  }
  const world=buildWorld(level,models,{actors}),enemies=new EnemyPreview(world,()=>{},null,DOG_PREVIEW_ACTORS);let seed=232;
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  const preview=new DefencePreview(world,()=>{},random,null,enemies.states,(target,strength,vx,vy,vz)=>enemies.takeHit(target,strength,vx,vy,vz),null,()=>{});
  try{
   expect(preview.planner.coverage.map(profile=>profile.size)).toEqual(id==='moss-01'?[3,3,3]:[0,0,0]);
   for(let frame=0;frame<2400;frame++){enemies.advance(1/60);preview.advance(1/60);}
   expect(preview.states.map(state=>state.cycle.shots)).toEqual(shots);expect(enemies.states.map(state=>state.health.hits)).toEqual(hits);
   expect(enemies.states.map(state=>state.health.current)).toEqual([0,0,0]);expect(preview.planner.thinks).toBe(2400);
   expect(preview.states.map(state=>state.thinkCount)).toEqual([800,800,800]);
  }finally{preview.dispose();enemies.dispose();disposeWorld(world);}
 }
});

test('future projectile aiming does not borrow the hitscan damage forecast',()=>{
 const target=actor('target',20),state=defence('gun'),{planner}=setup([state],[target]);
 expect(planner.capacity(0,target)).toBeGreaterThan(0);
 state.targeting=new DefenceAim({delivery:'projectile',projectile:{speedUnitsPerSecond:30}},1000);
 expect(planner.capacity(0,target)).toBe(0);
});

test('impact recovery suspends route promises while keeping actual live shots eligible',()=>{
 const {planner,up,down,current,other}=delegation();
 expect(select(planner,up)).toBe(other);expect(down.reservation).toBe(current);
 current.impact={active:true};
 expect(planner.capacity(1,current)).toBe(0);
 planner.releaseInvalidReservations();expect(down.reservation).toBeNull();
 up.target=null;expect(select(planner,up)).toBe(current);
 current.impact.active=false;
 expect(planner.capacity(1,current)).toBeGreaterThan(0);
});

test('an idle downstream owner accepts one explicit assignment when the upstream gun switches',()=>{
 const {planner,up,down,current,other}=delegation();
 expect(select(planner,up)).toBe(other);expect(down.reservation).toBe(current);expect(down.reservationLap).toBe(0);
 expect(planner.capacity(1,current)).toBe(100);
 // The future owner waits for its assigned actor rather than promising another.
 expect(select(planner,down,1)).toBeNull();expect(down.reservation).toBe(current);
 current.distance=current.x=110;expect(select(planner,down,1)).toBe(current);
});

test('a future reservation yields to a hittable uncovered flyer and revokes its promised damage',()=>{
 const {planner,up,down,current}=delegation();select(planner,up);expect(down.reservation).toBe(current);
 const moth=actor('moth',120,{routeForecastEligible:false});planner.targets.push(moth);
 expect(planner.coverageDamage(current,0)).toBe(100);
 expect(select(planner,down,1)).toBe(moth);expect(down.reservation).toBeNull();
 expect(planner.coverageDamage(current,0)).toBe(0);expect(planner.capacity(1,moth)).toBe(0);
 planner.dispose();
});

test('future reservations still wait when current alternatives are already covered and hold a hittable assignment',()=>{
 let incoming=300;const {planner,up,down,current}=delegation(30,{incomingDamage:t=>t.id==='moth'?incoming:0});select(planner,up);
 const moth=actor('moth',120,{routeForecastEligible:false,threat:100});planner.targets.push(moth);
 expect(select(planner,down,1)).toBeNull();expect(down.reservation).toBe(current);
 incoming=0;current.distance=current.x=110;
 expect(select(planner,down,1)).toBe(current);expect(down.reservation).toBe(current);planner.dispose();
});

test('delegation requires the full margin and respects cooldown, visibility and weapon strength',()=>{
 for(const cause of ['margin','cooldown','blocked','inactive']){
  const f=delegation(cause==='margin'?81:30);
  if(cause==='cooldown')f.down.cycle.readyAt=25;
  if(cause==='blocked')f.planner.coverage[1].get(f.current).intervals=new Float64Array(0);
  if(cause==='inactive')f.down.strength=0;
  expect(select(f.planner,f.up)).toBe(f.current);expect(f.down.reservation).toBeNull();
 }
 const exact=delegation(80);expect(select(exact.planner,exact.up)).toBe(exact.other);
});

test('incoming missile damage is credited once and only residual health needs the gun forecast margin',()=>{
 for(const incoming of [19,20]){
  const f=delegation(100,{incomingDamage:target=>target.id==='current'?incoming:0});
  expect(f.planner.capacity(1,f.current)).toBe(100);expect(f.planner.coverageDamage(f.current,0)).toBe(0);
  expect(f.planner.residualHealth(f.current)).toBe(100-incoming);
  expect(select(f.planner,f.up)).toBe(incoming===20?f.other:f.current);
  expect(f.down.reservation).toBe(incoming===20?f.current:null);
  expect(f.planner.coverageDamage(f.current,0)).toBe(incoming===20?100:0);
 }
 const current=actor('current',100,{health:new Health(100)}),other=actor('other',90),state=defence('gun');let incoming=50;
 const {planner}=setup([state],[current,other],{incomingDamage:target=>target===current?incoming:0});
 expect(planner.coverageDamage(current,0)).toBe(0);expect(select(planner,state)).toBe(current);
 incoming=100;expect(planner.residualHealth(current)).toBe(0);expect(select(planner,state)).toBe(current);
 state.cycle.time=.35;expect(select(planner,state)).toBe(other);
 expect(planner.coverageDamage(current,0)).toBe(0);expect(state.reservation).toBeNull();
});

test('fully claimed missile damage releases old gun reservations and never recruits unnecessary owners',()=>{
 let incoming=0;const f=delegation(30,{incomingDamage:target=>target.id==='current'?incoming:0});
 expect(select(f.planner,f.up)).toBe(f.other);expect(f.down.reservation).toBe(f.current);
 incoming=30;f.planner.releaseInvalidReservations();expect(f.down.reservation).toBeNull();
 f.planner.reserveContributors(f.current,0,1);expect(f.down.reservation).toBeNull();
 expect(select(f.planner,f.up)).toBe(f.other);expect(f.down.reservation).toBeNull();
 f.current.distance=f.current.x=110;f.other.distance=f.other.x=120;
 expect(select(f.planner,f.down,1)).toBe(f.other);expect(f.down.reservation).toBeNull();
 incoming=0;expect(f.planner.residualHealth(f.current)).toBe(30);
 f.current.threat=10;f.down.targetSince=-Infinity;expect(select(f.planner,f.down,1)).toBe(f.current);
});

test('unknown health and invalid incoming values cannot manufacture a lethal damage claim',()=>{
 for(const current of [undefined,NaN,Infinity,-1]){
  const unknown=actor('unknown',100,{threat:2,health:{alive:true,current}}),other=actor('other',110),state=defence('gun');
  const {planner}=setup([state],[unknown,other],{incomingDamage:()=>Number.MAX_VALUE});
  expect(planner.residualHealth(unknown)).toBe(Infinity);expect(select(planner,state)).toBe(unknown);expect(state.reservation).toBeNull();
 }
 for(const incoming of [undefined,NaN,Infinity,-10]){
  const current=actor('current',100,{health:new Health(100)}),other=actor('other',90),state=defence('gun');
  const {planner}=setup([state],[current,other],{incomingDamage:()=>incoming});
  expect(planner.residualHealth(current)).toBe(100);expect(select(planner,state)).toBe(current);
 }
 const f=delegation();expect(f.planner.residualHealth(f.current)).toBe(30);expect(select(f.planner,f.up)).toBe(f.other);
 f.planner.dispose();expect(f.planner.incomingDamage).toBeNull();
});

test('mixed families share actual incoming credit while only one thinker forecasts gun damage',()=>{
 const covered=actor('covered',120,{health:new Health(90)}),other=actor('other',100),targets=[covered,other];
 const states=[defence('gun'),defence('arc'),defence('silo')];states[1].model='arc-spire';states[2].model='missile-launcher';
 const {planner,scans}=setup(states,targets,{incomingDamage:target=>target===covered?90:0,coverageVisible:state=>!state.model});
 for(let frame=0;frame<7;frame++){
  const before=scans();planner.advance(1/60);expect(scans()-before).toBe(2);expect(planner.thinks).toBe(frame+1);
  const state=states[frame%3];expect(planner.lastThinkId).toBe(state.id);expect(state.target).toBe(other);
  expect(state.reservation).toBeNull();expect(planner.coverageDamage(covered,-1)).toBe(0);
 }
 expect(states.map(s=>s.thinkCount)).toEqual([3,2,2]);
 expect(planner.capacity(0,covered)).toBeGreaterThan(0);expect(planner.capacity(1,covered)).toBe(0);expect(planner.capacity(2,covered)).toBe(0);
 // Actual-flight credit survives impact recovery even while route forecasts stop.
 covered.impact={active:true};expect(planner.capacity(0,covered)).toBe(0);expect(planner.residualHealth(covered)).toBe(0);
 // Existing gun/Arc behavior still permits shooting a covered sole candidate.
 targets.pop();expect(select(planner,states[0])).toBe(covered);expect(select(planner,states[1],1)).toBe(covered);
});

test('capacity uses only the next continuous window and never counts a later preview lap',()=>{
 const target=actor('target',20),state=defence('gun',[[100,130],[200,280]]),{planner}=setup([state],[target]);
 // The first trimmed window admits three pulses; the later return is not added.
 expect(planner.capacity(0,target)).toBe(30);
 target.distance=target.x=290;expect(planner.capacity(0,target)).toBe(0);
 target.distance=target.x=300;expect(planner.capacity(0,target)).toBe(0);
});

test('one downstream promise cannot be reused to delegate a different actor',()=>{
 const first=actor('first',20,{health:new Health(30)}),second=actor('second',25,{health:new Health(30)}),alternative=actor('alternative',10);
 const a=defence('a',[[0,80]]),b=defence('b',[[0,80]]),down=defence('down',[[100,200]]),{planner}=setup([a,b,down],[first,second,alternative]);
 a.target=first;b.target=second;
 // The other upstream gun cannot supply enough damage, so only the idle owner
 // qualifies. Keep its coverage empty while retaining eligible live targets.
 planner.coverage[1].clear();
 expect(select(planner,a,0)).toBe(second);expect(down.reservation).toBe(first);
 planner.coverage[0].clear();
 expect(select(planner,b,1)).toBe(second);expect(down.reservation).toBe(first);
 expect(planner.coverageDamage(second,1)).toBe(0);
});

test('an owner cannot abandon its reserved actor for a more urgent challenger',()=>{
 const {planner,up,down,current,other}=delegation();select(planner,up);
 current.distance=current.x=110;other.distance=other.x=180;other.threat=10;
 expect(select(planner,down,1)).toBe(current);expect(down.reservation).toBe(current);
});

test('covered targets remain fireable when there is no uncovered alternative',()=>{
 const target=actor('target',120,{health:new Health(20)}),a=defence('a'),b=defence('b'),{planner}=setup([a,b],[target]);
 a.target=b.target=target;a.lineOfSight=b.lineOfSight=true;
 expect(planner.coverageDamage(target,0)).toBeGreaterThan(25);
 expect(select(planner,a)).toBe(target);
});

test('near-equal urgency and a short hold preserve locks; a valid burst finishes before a discretionary switch',()=>{
 const current=actor('current',100),other=actor('other',110),state=defence('gun',[[0,300]],'upgrade1'),{planner}=setup([state],[current,other]);
 state.target=current;state.cycle.time=1;state.targetSince=0;
 expect(select(planner,state)).toBe(current);
 other.threat=3;state.targetSince=.8;expect(select(planner,state)).toBe(current);
 state.targetSince=0;state.cycle.remaining=2;expect(select(planner,state)).toBe(current);
 state.cycle.remaining=0;expect(select(planner,state)).toBe(other);
});

test('forecast counts single attack pulses, partial bursts and real cooldowns',()=>{
 const cycle=new WeaponCycle(TURRET_FIRING.upgrade1);cycle.trigger();
 expect(forecastPulses(cycle,0,.3,true)).toBe(2);
 expect(forecastPulses(cycle,0,1.24,true)).toBe(2);
 expect(forecastPulses(cycle,0,1.37,true)).toBe(4);
 cycle.cancelBurst();expect(forecastPulses(cycle,0,.99,false)).toBe(0);
 expect(forecastPulses(cycle,0,1.13,false)).toBe(2);
});

test('one roster scan per frame rotates fairly and releases all planner references on disposal',()=>{
 const targets=[actor('a',20),actor('b',40)],states=[defence('first'),defence('second'),defence('third')],{planner,scans}=setup(states,targets);
 for(let frame=0;frame<7;frame++){
  const before=scans();planner.advance(1/60);expect(scans()-before).toBe(targets.length);
  expect(planner.lastThinkId).toBe(states[frame%3].id);
 }
 expect(states.map(s=>s.thinkCount)).toEqual([3,2,2]);expect(planner.thinks).toBe(7);
 states[0].reservation=targets[0];planner.dispose();expect(states.every(s=>s.reservation===null)).toBe(true);
 expect(planner.coverage.length).toBe(0);expect(planner.targets.length).toBe(0);expect(planner.path).toBeNull();
});

test('death, departure and lap changes invalidate reservations instead of preserving spent promises',()=>{
 for(const reason of ['dead','departure','lap','removed']){
  const {planner,up,down,current}=delegation();select(planner,up);expect(down.reservation).toBe(current);
  if(reason==='dead')current.health.takeDamage(1000);
  if(reason==='departure')current.distance=current.x=220;
  if(reason==='lap')current.lap++;
  if(reason==='removed')planner.targets.splice(planner.targets.indexOf(current),1);
  planner.releaseInvalidReservations();expect(down.reservation).toBeNull();
 }
});

test('a stale current-target lock cannot recreate downstream confidence after its reservation lapses',()=>{
 const {planner,up,down,current}=delegation();select(planner,up);
 current.distance=current.x=190;down.target=current;down.lineOfSight=true;down.aimError=0;
 // The actor wraps while this gun still holds last frame's target pointer.
 current.lap++;current.distance=current.x=20;planner.releaseInvalidReservations();
 expect(down.reservation).toBeNull();expect(planner.coverageDamage(current,0)).toBe(0);
});

test('an unreserved lock in a coverage gap cannot promise a disconnected later window',()=>{
 const target=actor('target',150),state=defence('gun',[[100,130],[200,280]]),{planner}=setup([state],[target]);
 state.target=target;state.lineOfSight=true;state.aimError=0;
 expect(planner.capacity(0,target)).toBeGreaterThan(0);
 expect(planner.commitment(0,target)).toBe(false);expect(planner.coverageDamage(target,-1)).toBe(0);
});

test('current turret capacity never covers itself and spent weapon time reduces a promise',()=>{
 const current=actor('current',120,{health:new Health(40)}),other=actor('other',110),state=defence('gun'),{planner}=setup([state],[current,other]);
 state.target=current;state.lineOfSight=true;state.aimError=0;
 expect(planner.capacity(0,current)).toBeGreaterThan(50);expect(planner.coverageDamage(current,0)).toBe(0);
 expect(select(planner,state)).toBe(current);
 const before=planner.capacity(0,current);state.cycle.trigger();
 expect(planner.capacity(0,current)).toBeLessThan(before);
});

test('roster growth reuses spare slots and gives unprofiled actors no speculative capacity',()=>{
 const targets=[actor('first',20)],state=defence('gun'),{planner}=setup([state],targets),original=planner.covered;
 for(let i=1;i<31;i++)targets.push(actor('new-'+i,20+i));
 select(planner,state);expect(planner.covered).toBe(original);expect(planner.capacity(0,targets[30])).toBe(0);
 for(let i=31;i<40;i++)targets.push(actor('new-'+i,20+i));
 select(planner,state);expect(planner.covered.length).toBeGreaterThanOrEqual(40);
 const grown=planner.covered;select(planner,state);expect(planner.covered).toBe(grown);
 expect(planner.candidates.every(value=>value==null)).toBe(true);
});

test('continuing burst forecasts require pitch alignment as well as yaw',()=>{
 const target=actor('target',120),state=defence('gun',[[0,140]],'upgrade1'),{planner}=setup([state],[target]);
 state.target=target;state.lineOfSight=true;state.aimError=0;state.cycle.trigger();
 const aligned=planner.capacity(0,target);state.pitchError=.3;const moving=planner.capacity(0,target);
 expect(aligned).toBeGreaterThan(moving);state.pitchError=0;expect(planner.capacity(0,target)).toBe(aligned);
});

function liveFixture(targets,visibility){
 const placements=[],rigs=new Map();
 for(let i=0;i<2;i++){
  const id='turret-'+i,root=placementMatrix([0,1,0],0),parts=[{id:'base',parent:null,pivot:[12,0,12]},{id:'head',parent:'base',pivot:[12,17,12]},{id:'guns',parent:'head',pivot:[12,27.5,15]}];
  placements.push({id,model:'turret-study',variant:'upgrade1'});
  rigs.set(id,{root,parts,instances:parts.map(part=>({part:part.id,key:part.id,index:i,matrix:new Float32Array(root)}))});
 }
 return new TurretPreview({level:{placements},rigs,visibility},()=>{},()=>.5,null,targets);
}

test('non-thinking turrets still reject invalid shots and cancel bursts every frame',()=>{
 for(const cause of ['dead','range','LOS','removed','pitch']){
  const target=actor('target',0,{x:12,z:-18,aimY:51.5}),targets=[target];let clear=true;
  const preview=liveFixture(targets,{clear:()=>clear});
  preview.advance(.01);preview.advance(.01);
  const nonThinker=preview.states[1];expect(nonThinker.cycle.shots).toBe(1);expect(nonThinker.cycle.remaining).toBe(2);
  if(cause==='dead')target.health.takeDamage(1000);
  if(cause==='range')target.x=500;
  if(cause==='LOS')clear=false;
  if(cause==='removed')targets.length=0;
  if(cause==='pitch')target.aimY=200;
  const before=nonThinker.cycle.shots;preview.advance(.12);
  expect(preview.planner.lastThinkId).toBe(preview.states[0].id);
  expect(nonThinker.cycle.shots).toBe(before);expect(nonThinker.cycle.remaining).toBe(0);expect(nonThinker.target).toBeNull();
  preview.dispose();
 }
});

test('gun acquisition survives priority changes through cooldown and its first valid burst',()=>{
 const target=actor('chosen',100),other=actor('challenger',90),state=defence('gun',[[0,300]],'upgrade1');
 const {planner}=setup([state],[target,other],{holdTarget:holdGunAcquisition});
 // The previous target died on a pulse; selection time may equal lastShotAt.
 state.cycle.trigger();state.cycle.cancelBurst();expect(select(planner,state)).toBe(target);
 other.threat=5;state.cycle.time=.4;expect(select(planner,state)).toBe(target);
 state.cycle.time=1.4;expect(select(planner,state)).toBe(target);
 state.cycle.trigger();expect(select(planner,state)).toBe(target);
 state.cycle.advanceLive(.12,true);expect(select(planner,state)).toBe(target);
 state.cycle.advanceLive(.12,true);expect(state.cycle.remaining).toBe(0);
 expect(select(planner,state)).toBe(other);expect(state.targetShots).toBe(state.cycle.shots);
 planner.dispose();expect(planner.holdTarget).toBeNull();
});

test('gun acquisition hold is bounded and cannot retain dead, blocked, removed or out-of-range targets',()=>{
 for(const cause of ['dead','blocked','removed','range','timeout']){
  const target=actor('chosen',100),other=actor('challenger',90),state=defence('gun',[[0,300]],'upgrade1');
  const {planner}=setup([state],[target,other],{holdTarget:holdGunAcquisition});
  state.cycle.readyAt=1;expect(select(planner,state)).toBe(target);
  state.cycle.time=.4;other.threat=5;
  if(cause==='dead')target.health.takeDamage(300);
  if(cause==='blocked')state.windows=[[0,95]];
  if(cause==='removed')planner.targets.splice(0,1);
  if(cause==='range')target.x=1001;
  if(cause==='timeout')state.cycle.time=1.75;
  expect(select(planner,state)).toBe(other);planner.reset();
  expect(state.target).toBeNull();expect(state.targetShots).toBe(state.cycle.shots);planner.dispose();
 }
});

test('ground-first guns override air urgency, covered health, reservations and acquisition or burst holds',()=>{
 for(const hold of ['acquisition','burst','reservation']){
  const air=actor('air',100,{airborne:true,threat:100}),ground=actor('ground',20),state=defence('gun',[[0,300]],'upgrade1');state.groundFirst=true;
  ground.x=1001;
  const {planner}=setup([state],[air,ground],{holdTarget:holdGunAcquisition,incomingDamage:target=>target===ground?300:0});
  expect(select(planner,state)).toBe(air);expect(planner.capacity(0,air)).toBeGreaterThan(0);
  state.lineOfSight=true;state.aimError=0;state.targetSince=state.cycle.time;
  if(hold==='burst')state.cycle.trigger();
  if(hold==='reservation'){state.reservation=air;state.reservationLap=0;}
  ground.x=20;
  expect(select(planner,state)).toBe(ground);expect(state.groundInRange).toBe(true);expect(state.cycle.remaining).toBe(0);expect(state.reservation).toBeNull();
  expect(planner.residualHealth(ground)).toBe(0);expect(planner.capacity(0,air)).toBe(0);expect(planner.commitment(0,air)).toBe(false);
  planner.dispose();expect(planner.groundFirstStates).toHaveLength(0);
 }
});

test('ground presence uses inclusive horizontal actor-root range and excludes dead or departed actors',()=>{
 const air=actor('air',100,{airborne:true,threat:100}),ground=actor('ground',20,{x:600,z:800,aimX:2000,aimY:20000}),state=defence('gun');state.groundFirst=true;
 const targets=[air,ground],{planner}=setup([state],targets);
 // The ground has no valid shot, but its root is exactly 1000 units away.
 expect(select(planner,state)).toBeNull();expect(state.groundInRange).toBe(true);
 ground.x=600.001;expect(select(planner,state)).toBe(air);expect(state.groundInRange).toBe(false);
 ground.x=600;ground.health.takeDamage(300);expect(select(planner,state)).toBe(air);
 ground.health.reset();targets.pop();expect(select(planner,state)).toBe(air);
 targets.push(ground);ground.x=NaN;expect(select(planner,state)).toBe(air);
 planner.dispose();
});

test('ground-priority cache is local to each gun and leaves Arc and missile ranking unchanged',()=>{
 const air=actor('air',100,{airborne:true,threat:100}),ground=actor('ground',20),states=['near-gun','far-gun','arc','silo'].map(id=>defence(id,[[-1000,300]]));
 states[0].groundFirst=states[1].groundFirst=true;states[1].x=-990;air.x=-900;
 states[2].model='arc-spire';states[3].model='missile-launcher';
 const {planner,scans}=setup(states,[air,ground],{path:null});
 for(let i=0;i<states.length;i++){
  const before=scans();planner.advance(1/60);
  expect(planner.lastThinkId).toBe(states[i].id);expect(states[i].target).toBe(i===0?ground:air);
  expect(scans()-before).toBe(i===0?1:2);
 }
 expect(states.map(state=>state.thinkCount)).toEqual([1,1,1,1]);
 expect(states[0].groundInRange).toBe(true);expect(states[1].groundInRange).toBe(false);planner.reset();expect(states[0].groundInRange).toBe(false);planner.dispose();
});

test('a newly present ground enemy cancels non-thinking live gun air bursts before the next pulse',()=>{
 const air=actor('air',0,{x:12,z:-18,aimY:51.5,airborne:true}),targets=[air],preview=liveFixture(targets,{clear:()=>true});
 try{
  preview.advance(.01);preview.advance(.01);
  const nonThinker=preview.states[1];expect(nonThinker.target).toBe(air);expect(nonThinker.cycle.remaining).toBe(2);
  const before=nonThinker.cycle.shots,ground=actor('ground',0,{x:12,z:-18,aimY:51.5});targets.push(ground);
  preview.advance(.12);
  expect(preview.planner.lastThinkId).toBe(preview.states[0].id);expect(preview.planner.thinks).toBe(3);
  expect(preview.states[0].target).toBe(ground);expect(nonThinker.groundInRange).toBe(true);expect(nonThinker.target).toBeNull();
  expect(nonThinker.cycle.shots).toBe(before);expect(nonThinker.cycle.remaining).toBe(0);
  preview.advance(.01);expect(nonThinker.target).toBe(ground);expect(preview.planner.thinks).toBe(4);
 }finally{preview.dispose();}
});

test('blocked or pitch-unreachable ground suppresses live air shots until it dies, leaves or is removed',()=>{
 for(const obstruction of ['LOS','pitch'])for(const departure of ['dead','range','removed']){
  const air=actor('air',0,{x:12,z:-18,aimY:51.5,airborne:true}),ground=actor('ground',0,{x:24,z:-18,aimY:obstruction==='pitch'?200:51.5}),targets=[air,ground];
  const preview=liveFixture(targets,{clear:(_x,_y,_z,tx)=>obstruction!=='LOS'||tx!==ground.x});
  try{
   for(let i=0;i<10;i++)preview.advance(.1);
   expect(preview.states.every(state=>state.target===null&&state.cycle.shots===0&&state.groundInRange)).toBe(true);
   if(departure==='dead')ground.health.takeDamage(300);
   if(departure==='range')ground.x=1000;
   if(departure==='removed')targets.pop();
   for(let i=0;i<30;i++)preview.advance(.1);
   expect(preview.states.every(state=>state.target===air&&!state.groundInRange&&state.cycle.shots>0)).toBe(true);
  }finally{preview.dispose();}
 }
});
