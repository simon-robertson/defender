// Cooperative, allocation-free runtime planning. Geometry is sampled once when
// the scene loads; every real shot still requires live range/aim/visibility.
export const TARGET_POLICY=Object.freeze({holdSeconds:.35,switchRatio:1.25,coverageMargin:1.25,acquireSeconds:.75,exitEmergencySeconds:3,sampleUnits:1,edgeTrimUnits:1});
const NO_INCOMING_DAMAGE=()=>0;
const ALL_COVERAGE=()=>true;

function alive(target){return target&&target.health?.alive!==false;}
function airborne(target){return target?.airborne??target?.movement?.airborne??false;}
function speed(target){return target.movement?.speed??Math.hypot(target.velocityX??0,target.velocityZ??0);}
function health(target){const value=target.health?.current;return Number.isFinite(value)&&value>=0?value:Infinity;}
function threat(target){return Number.isFinite(target.threat)&&target.threat>0?target.threat:1;}

// Count pulses, not barrels. The partial burst and its real cooldown come first;
// later full bursts use the configured cadence without an unbounded time loop.
export function forecastPulses(cycle,startSeconds,endSeconds,continuing=false){
 if(!cycle||!Number.isFinite(endSeconds)||endSeconds<=startSeconds)return 0;
 const rule=cycle.rule,n=rule.shotsPerBurst,gap=rule.shotIntervalSeconds,cooldown=rule.cooldownSeconds,period=(n-1)*gap+cooldown;
 if(!(period>0))return 0;
 let count=0,first=Math.max(startSeconds,cycle.readyAt-cycle.time);
 if(continuing&&cycle.remaining){
  let at=Math.max(0,cycle.nextShotAt-cycle.time);
  for(let i=0;i<cycle.remaining;i++,at+=gap)if(at>=startSeconds&&at<endSeconds)count++;
  first=Math.max(startSeconds,at-gap+cooldown);
 }
 if(first>=endSeconds)return count;
 const full=Math.floor((endSeconds-first)/period);count+=full*n;first+=full*period;
 for(let i=0;i<n;i++)if(first+i*gap<endSeconds-1e-9)count++;
 return count;
}

export class TargetPlanner {
 constructor(states,targets,{path=null,eligible,coverageVisible=eligible,coverageEnabled=ALL_COVERAGE,incomingDamage=NO_INCOMING_DAMAGE,prepareState=null,onSelected=null,scoreTarget=null,committedDamage=null,holdTarget=null}={}){
  this.states=states;this.targets=targets;this.path=path;this.eligible=eligible;this.incomingDamage=incomingDamage;this.next=0;this.thinks=0;this.lastThinkId=null;
  this.prepareState=prepareState;this.onSelected=onSelected;this.scoreTarget=scoreTarget;this.committedDamage=committedDamage;this.holdTarget=holdTarget;
  this.groundFirstStates=states.filter(state=>state.groundFirst);
  this.coverage=states.map(()=>new Map());this.candidates=new Array(Math.max(32,targets.length));this.covered=new Uint8Array(this.candidates.length);this.urgency=new Float64Array(this.candidates.length);
  this.reset();
  if(path||targets.some(target=>target.path)){
   const point=new Float64Array(5),probe={id:'coverage-probe',x:0,z:0,aimY:0,velocityX:0,velocityZ:0};
   for(let i=0;i<states.length;i++){
    // Some families deliberately promise no future damage. Avoid sampling a
    // complete route merely to produce empty intervals; live eligibility and
    // the shared thinker order remain independent of this construction policy.
    if(!coverageEnabled(states[i]))continue;
    const byRoute=new Map();
    for(const target of targets){
     // Route-centre probes cannot certify an off-centre or banking aim point.
     // Such actors still participate in live acquisition and validated attacks.
     const route=target.path??path,routeKey=target.routeId??route;
     if(target.routeForecastEligible===false||!Number.isFinite(target.aimY)||!route)continue;
     let byHeight=byRoute.get(routeKey);if(!byHeight){byHeight=new Map();byRoute.set(routeKey,byHeight);}
     let profile=byHeight.get(target.aimY);
     if(!profile){
      const intervals=[];let begin=-1,last=-1;probe.aimY=target.aimY;
      for(let distance=0;distance<=route.length;distance+=TARGET_POLICY.sampleUnits){
       route.sample(distance,point);probe.x=point[0];probe.z=point[1];probe.velocityX=point[3]*speed(target);probe.velocityZ=point[4]*speed(target);
       const visible=coverageVisible(states[i],probe);
       if(visible){if(begin<0)begin=distance;last=distance;}
       if((!visible||distance===route.length)&&begin>=0){
        const start=begin+TARGET_POLICY.edgeTrimUnits,end=last-TARGET_POLICY.edgeTrimUnits;
        if(end>start)intervals.push(start,end);begin=-1;
       }
      }
      profile={height:target.aimY,routeKey,path:route,intervals:new Float64Array(intervals)};byHeight.set(target.aimY,profile);
     }
     this.coverage[i].set(target,profile);
    }
    states[i].targeting?.point.fill(0);states[i].occludedTargets=0;
   }
  }
 }
 reset(){
  this.next=0;this.thinks=0;this.lastThinkId=null;
  for(const state of this.states){state.target=null;state.reservation=null;state.reservationLap=0;state.targetLap=0;state.targetSince=-Infinity;state.targetShots=state.cycle.shots;state.thinkCount=0;state.predictedCoverage=0;state.groundInRange=false;}
  this.candidates.fill(null);this.covered.fill(0);this.urgency.fill(0);
 }
 timeToExit(target){
  const path=target?.path??this.path,velocity=target&&speed(target);
  return path&&Number.isFinite(target?.distance)&&velocity>0?Math.max(0,(path.length-target.distance)/velocity):Infinity;
 }
 exitEmergency(state,target){return state.groundFirst&&this.timeToExit(target)<=TARGET_POLICY.exitEmergencySeconds;}
 targetAllowed(state,target){return !(state.groundFirst&&state.groundInRange&&airborne(target)&&!this.exitEmergency(state,target));}
 refreshGroundPriority(){
  // One cheap roster traversal supplies every gun's per-tick gate. Presence
  // uses living actor roots and inclusive horizontal range, regardless of LOS,
  // pitch or incoming damage; the one ranked thinker still validates shots.
  if(!this.groundFirstStates.length)return;
  for(const state of this.groundFirstStates)state.groundInRange=false;
  for(const target of this.targets){
   if(!alive(target)||airborne(target)||!Number.isFinite(target.x)||!Number.isFinite(target.z))continue;
   for(const state of this.groundFirstStates)if(!state.groundInRange){
    const dx=target.x-state.x,dz=target.z-state.z;
    if(dx*dx+dz*dz<=state.targeting.rangeSquared)state.groundInRange=true;
   }
  }
  for(const state of this.groundFirstStates)if(state.groundInRange){
   if(state.reservation&&!this.targetAllowed(state,state.reservation))state.reservation=null;
   // All guns yield before any weapon fires, including the guns that do not
   // own this tick's thinker. An imminent escape overrides the ground gate.
   if(state.target&&!this.targetAllowed(state,state.target)){state.cycle.cancelBurst();state.target=null;state.targeting.point.fill(0);}
  }
 }
 capacity(index,target,requireFuture=false){
  const state=this.states[index],profile=this.coverage[index].get(target),travel=speed(target),distance=target.distance,route=target.path??this.path;
  if(!this.targetAllowed(state,target))return 0;
  // A moving weapon has no stationary route profile. Its owner may certify
  // only an already active burst, never pursuit or future flight coverage.
  if(state.mobile)return requireFuture?0:(this.committedDamage?.(state,target)??0);
  // Coverage intervals were sampled on the route centre. A displaced actor is
  // still eligible for real shots, but cannot support a route-based promise.
  if(!alive(target)||target.routeForecastEligible===false||target.impact?.active||!(state.strength>0)||state.targeting.speed>0||!profile||!route||profile.routeKey!==(target.routeId??route)||profile.path.length!==route.length||profile.height!==target.aimY||!(travel>0)||!Number.isFinite(distance)||distance<0||distance>=route.length)return 0;
  const intervals=profile.intervals;
  for(let i=0;i<intervals.length;i+=2){
   const begin=intervals[i],end=intervals[i+1];if(end<=distance)continue;
   if(requireFuture&&begin<=distance)return 0;
   const start=Math.max(0,(begin-distance)/travel),finish=(end-distance)/travel;
   const continuing=start===0&&state.target===target&&state.lineOfSight===true&&Math.abs(state.aimError??Infinity)<.035&&Math.abs(state.pitchError??0)<.035;
   // Use only the next continuous window. A gap or preview wrap is never free
   // firing time; new windows allow a conservative turn/settling delay.
   return forecastPulses(state.cycle,start+(continuing?0:TARGET_POLICY.acquireSeconds),finish,continuing)*state.strength;
  }
  return 0;
 }
 commitment(index,target){
  const state=this.states[index];
  if(!this.targetAllowed(state,target))return false;
  if(state.mobile)return (this.committedDamage?.(state,target)??0)>0;
  if(state.reservation)return state.reservation===target&&state.reservationLap===(target.lap??0);
  if(state.target!==target||state.targetLap!==(target.lap??0)||state.lineOfSight!==true)return false;
  // A stale pointer after a wrap/range exit is not a future promise. Only an
  // explicit reservation may credit a later disconnected coverage window.
  const intervals=this.coverage[index].get(target)?.intervals;if(!intervals)return false;
  for(let i=0;i<intervals.length;i+=2)if(target.distance>=intervals[i]&&target.distance<intervals[i+1])return true;
  return false;
 }
 coverageDamage(target,except){
  let damage=0;
  for(let i=0;i<this.states.length;i++)if(i!==except&&this.commitment(i,target))damage+=this.capacity(i,target);
  return damage;
 }
 residualHealth(target){
  const remaining=health(target);if(!Number.isFinite(remaining))return Infinity;
  // Launched missiles are independent of a weapon's current lock. Credit them
  // once, including the current silo's flights, before forecasting gun damage.
  const incoming=this.incomingDamage(target);
  return Math.max(0,remaining-(Number.isFinite(incoming)&&incoming>0?incoming:0));
 }
 releaseInvalidReservations(){
  for(let i=0;i<this.states.length;i++){
   const state=this.states[i],target=state.reservation;
   if(target&&(!this.targets.includes(target)||state.reservationLap!==(target.lap??0)||this.residualHealth(target)===0||!this.capacity(i,target)))state.reservation=null;
  }
 }
 score(target,state){
  const velocity=speed(target),distance=target.distance,path=target.path??this.path;
  const score=path&&Number.isFinite(distance)&&velocity>0?threat(target)/Math.max(1,(path.length-distance)/velocity):threat(target);
  if(this.scoreTarget)return this.scoreTarget(state,target,score);
  // Unknown routes can still prioritize explicit threat. Distance breaks ties;
  // downstream confidence stays disabled without route/health information.
  return score;
 }
 better(a,b,state){
  if(b<0)return true;
  const ea=this.exitEmergency(state,this.candidates[a]),eb=this.exitEmergency(state,this.candidates[b]);
  if(ea!==eb)return ea;
  if(ea){const ta=this.timeToExit(this.candidates[a]),tb=this.timeToExit(this.candidates[b]);if(Math.abs(ta-tb)>.1)return ta<tb;}
  if(this.covered[a]!==this.covered[b])return this.covered[a]<this.covered[b];
  const ua=this.urgency[a],ub=this.urgency[b];
  if(Math.abs(ua-ub)>.1*Math.max(ua,ub))return ua>ub;
  const ta=this.candidates[a],tb=this.candidates[b],ha=Math.ceil(health(ta)/state.strength),hb=Math.ceil(health(tb)/state.strength);
  if(ha!==hb)return ha<hb;
  const pa=ta.path??this.path,pb=tb.path??this.path;
  if(pa&&pb&&(ta.routeId??pa)!==(tb.routeId??pb)){
   // Absolute distance is not comparable across unequal approaches.
   const sa=speed(ta),sb=speed(tb),ea=sa>0?(pa.length-ta.distance)/sa:Infinity,eb=sb>0?(pb.length-tb.distance)/sb:Infinity;
   if(Number.isFinite(ea)&&Number.isFinite(eb)&&ea!==eb)return ea<eb;
  }else if(Number.isFinite(ta.distance)&&Number.isFinite(tb.distance)&&ta.distance!==tb.distance)return ta.distance>tb.distance;
  const da=(ta.x-state.x)**2+(ta.z-state.z)**2,db=(tb.x-state.x)**2+(tb.z-state.z)**2;
  return da!==db?da<db:ta.id<tb.id;
 }
 reserveContributors(target,except,recruit=-1){
  if(this.residualHealth(target)===0)return;
  for(let i=0;i<this.states.length;i++){
   if(i===except||!(this.commitment(i,target)||i===recruit)||!this.capacity(i,target))continue;
   const owner=this.states[i];owner.reservation=target;owner.reservationLap=target.lap??0;
  }
 }
 choose(state,index,recoil){
  // A larger roster is a lifecycle change, not a per-frame allocation. Existing
  // slots are reused; newly spawned actors without profiles get no forecasts.
  if(this.targets.length>this.candidates.length){const size=2**Math.ceil(Math.log2(this.targets.length));this.candidates.length=size;this.covered=new Uint8Array(size);this.urgency=new Float64Array(size);}
  this.refreshGroundPriority();this.releaseInvalidReservations();state.occludedTargets=0;
  const current=state.target;let currentIndex=-1,count=0,best=-1;
  for(let i=0;i<this.targets.length;i++){
   const target=this.targets[i];if(!this.targetAllowed(state,target)||!this.eligible(state,target,recoil))continue;
   this.candidates[count]=target;this.urgency[count]=this.score(target,state);
   const residual=this.residualHealth(target);
   this.covered[count]=residual===0||this.coverageDamage(target,index)>=residual*TARGET_POLICY.coverageMargin?1:0;
   if(target===current)currentIndex=count;
   if(this.better(count,best,state))best=count;count++;
  }
  let recruit=-1;
  // An idle downstream weapon may accept one explicit future assignment. Never
  // promise a busy gun's time twice, or reserve one gun for several enemies.
  if(currentIndex>=0&&count>1&&!this.covered[currentIndex]&&!state.reservation&&!state.cycle.remaining){
   const needed=this.residualHealth(current)*TARGET_POLICY.coverageMargin-this.coverageDamage(current,index);
   for(let i=0;i<this.states.length;i++){
    const owner=this.states[i];if(i===index||owner.target||owner.reservation)continue;
    if(this.capacity(i,current,true)>=needed){recruit=i;this.covered[currentIndex]=1;break;}
   }
   best=-1;for(let i=0;i<count;i++)if(this.better(i,best,state))best=i;
  }
  let chosen=best;
  const emergency=best>=0&&this.exitEmergency(state,this.candidates[best])&&(state.reservation&&state.reservation!==this.candidates[best]||currentIndex<0||!this.exitEmergency(state,current)||this.timeToExit(this.candidates[best])<this.timeToExit(current)-.1);
  if(emergency){
   // The scheduled thinker already validated this target's real shot geometry.
   // Future promises, bursts and acquisition grace cannot retain a lower lock.
   state.reservation=null;
  }else if(state.reservation){
   chosen=-1;for(let i=0;i<count;i++)if(this.candidates[i]===state.reservation){chosen=i;break;}
   // A future assignment must not park a usable weapon while an uncovered
   // enemy is hittable now. Revoke the promise before taking that work so
   // upstream weapons cannot still count this gun's future damage twice.
   if(chosen<0&&best>=0&&!this.covered[best]){state.reservation=null;chosen=best;}
  }else if(currentIndex>=0&&best!==currentIndex){
   const currentCovered=this.covered[currentIndex],challengerUncovered=best>=0&&!this.covered[best];
   if(state.cycle.remaining||this.holdTarget?.(state)||state.cycle.time-state.targetSince<TARGET_POLICY.holdSeconds||!(currentCovered&&challengerUncovered||best>=0&&this.urgency[best]>=this.urgency[currentIndex]*TARGET_POLICY.switchRatio))chosen=currentIndex;
  }
  const result=chosen<0?null:this.candidates[chosen];
  if(result){
   for(let i=0;i<count;i++)if(i!==chosen&&this.covered[i])this.reserveContributors(this.candidates[i],index,i===currentIndex?recruit:-1);
  }
  state.predictedCoverage=result?this.coverageDamage(result,index):0;
  if(result!==current){state.targetSince=state.cycle.time;state.targetShots=state.cycle.shots;}
  // Restore the chosen live aiming solution after all candidate rays.
  if(result)state.targeting.solve(state.x,state.z,result);else state.targeting.point.fill(0);
  for(let i=0;i<count;i++)this.candidates[i]=null;
  return result;
 }
 advance(deltaSeconds){
  if(!this.states.length)return;
  const index=this.next,state=this.states[index];this.next=(index+1)%this.states.length;this.thinks++;this.lastThinkId=state.id;state.thinkCount++;
  this.prepareState?.(state);
  const target=this.choose(state,index,state.recoil.sample(state.cycle.time+deltaSeconds));
  if(target!==state.target||state.targetLap!==(target?.lap??0)){state.cycle.cancelBurst();state.targetSince=state.cycle.time;state.targetShots=state.cycle.shots;}state.target=target;state.targetLap=target?.lap??0;
  this.onSelected?.(state,target);
 }
 dispose(){for(const state of this.states)state.reservation=null;this.coverage.length=0;this.candidates.length=0;this.groundFirstStates.length=0;this.states=[];this.targets=[];this.path=null;this.eligible=this.incomingDamage=this.prepareState=this.onSelected=this.scoreTarget=this.committedDamage=this.holdTarget=null;}
}
