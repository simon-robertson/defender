// Bounded CPU integration observation with the actual A1 combat and wildlife
// controllers. This finite evidence recorder may allocate; runtime code must not.
import {buildWorld,disposeWorld} from '../../engine/world.js';
import {actorsForPreview} from '../../game/preview-actors.js';
import {EnemyPreview} from '../../game/enemy-preview.js';
import {WildlifePreview} from '../../game/wildlife-preview.js';
import {DefencePreview} from '../../game/defence-preview.js';
import {DRONE_PREVIEW as T} from '../../shared/drone.js';
import {ENEMY_STATS} from '../../shared/enemy.js';
import {droneBoxesOverlap} from '../../engine/drone-navigation.js';

const level=await Bun.file(new URL('../../assets/levels/moss-01.json',import.meta.url)).json();
const before=JSON.stringify(level),actors=actorsForPreview(level),models=new Map();
for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)]))
 models.set(id,await Bun.file(new URL(`../../assets/models/${id}.json`,import.meta.url)).json());
const world=buildWorld(level,models,{actors}),wildlife=new WildlifePreview(world,()=>{});
const enemies=new EnemyPreview(world,()=>{},(id,state)=>wildlife.spookExplosion(state.aimX,state.aimY,state.aimZ,ENEMY_STATS[state.model].explosion.frightRadius));
wildlife.setThreatSources(enemies.states);
const hits=new Set(),firing=new DefencePreview(world,()=>{},()=>.5,null,enemies.states,(target,strength)=>{hits.add(target.model);return enemies.takeHit(target,strength);});
const drones=firing.drones;drones.setWildlife(wildlife.states);
const dt=1/60,seconds=150,metrics=drones.states.map(s=>({id:s.id,goal:s.goalNode,goalChanges:0,attackGoalChanges:0,maxSpeed:0,maxFanDegrees:0,maxBodyTilt:0,maxBodyPositionError:0,heldWhileTargetMovedFrames:0,obstacleOverlapFrames:0,staticOverlapFrames:0,arrivalErrorSeconds:[],lastCommitAt:null,awaitingArrival:false}));
const boxes=drones.states.map(()=>new Float64Array(6)),events=[],samples=[];let pairOverlapFrames=0,maxThinks=0;
for(let frame=0;frame<seconds/dt;frame++){
 enemies.advance(dt);wildlife.advance(dt);const thinks=firing.planner.thinks;firing.advance(dt);maxThinks=Math.max(maxThinks,firing.planner.thinks-thinks);
 for(let i=0;i<drones.states.length;i++){
  const s=drones.states[i],m=metrics[i],neutral=['pad-hover','recharge','launch','descend'].includes(s.phase),r=neutral?11:T.hullRadius,h=neutral?5:r,b=boxes[i];
  b.set([s.x-r,s.y-h,s.z-r,s.x+r,s.y+h,s.z+r]);
  const matrix=s.bodyMatrix;m.maxBodyPositionError=Math.max(m.maxBodyPositionError,Math.hypot(matrix[0]*12+matrix[4]*9+matrix[8]*12+matrix[12]-s.x,matrix[1]*12+matrix[5]*9+matrix[9]*12+matrix[13]-s.y,matrix[2]*12+matrix[6]*9+matrix[10]*12+matrix[14]-s.z));
  m.maxSpeed=Math.max(m.maxSpeed,s.speed);m.maxBodyTilt=Math.max(m.maxBodyTilt,Math.abs(s.bodyPitch),Math.abs(s.bodyRoll));
  for(const f of s.fans)m.maxFanDegrees=Math.max(m.maxFanDegrees,Math.hypot(f.pitch,f.roll)*180/Math.PI);
  if(s.goalNode!==m.goal){m.goal=s.goalNode;m.goalChanges++;if(['attack','intercept'].includes(s.phase))m.attackGoalChanges++;}
  if(s.stationCommitted&&s.stationArrivalAt!==m.lastCommitAt){m.lastCommitAt=s.stationArrivalAt;m.awaitingArrival=true;}
  if(m.awaitingArrival&&s.stationCommitted&&s.motion.done&&s.speed<.1){m.arrivalErrorSeconds.push((frame+1)*dt-s.stationArrivalAt);m.awaitingArrival=false;}
  if(!s.stationCommitted)m.awaitingArrival=false;
  if(s.stationCommitted&&s.speed<.1&&s.target&&Math.hypot(s.target.velocityX??0,s.target.velocityZ??0)>1)m.heldWhileTargetMovedFrames++;
  if(!drones.obstacles.clearBox(b,0)){m.obstacleOverlapFrames++;if(events.length<16)events.push({time:(frame+1)*dt,id:s.id,phase:s.phase,obstacle:drones.obstacles.lastBlockedId,position:[s.x,s.y,s.z]});}
  if(!neutral&&!drones.navigation.clearSegment(s.x,s.y,s.z,s.x,s.y,s.z))m.staticOverlapFrames++;
 }
 if(droneBoxesOverlap(boxes[0],boxes[1]))pairOverlapFrames++;
 if(frame%30===0||frame===seconds/dt-1)samples.push({time:(frame+1)*dt,alive:enemies.alive,aircraft:drones.states.map(s=>({id:s.id,phase:s.phase,position:[s.x,s.y,s.z],speed:s.speed,target:s.target?.id??null,goal:s.goalNode,committed:s.stationCommitted,arrival:s.stationArrivalAt,fireAt:s.stationFireAt,windowEnd:s.stationWindowEnd,pulses:s.stationPulses,shots:s.cycle.shots,evasions:s.evasions,emergencyStops:s.emergencyStops}))});
}
for(let i=0;i<metrics.length;i++){const s=drones.states[i];Object.assign(metrics[i],{stationChanges:s.stationChanges,routeChanges:s.routeChanges,committedThinks:s.committedThinks,evasions:s.evasions,emergencyStops:s.emergencyStops,holds:s.holds,shots:s.cycle.shots,launches:s.launches,returns:s.returns,phase:s.phase});}
const obstacle=drones.obstacles,nav=drones.navigation,summary={method:{level:level.id,seconds,dt,random:.5,realDamage:true,wildlife:true,deathExplosionSpook:true,renderer:false,sampleHz:2,collisionMeaning:'Conservative current part AABBs against the declared drone flight envelope; not exact mesh contact.'},tuning:T,metrics,pairOverlapFrames,maxThinks,hits:[...hits],enemiesAlive:enemies.alive,wildlifeJourneys:wildlife.states.map(s=>({id:s.id,completed:s.journeysCompleted,phase:s.phase})),obstacles:obstacle.inspect(),sourceUnchanged:JSON.stringify(level)===before,events,samples};
enemies.reset();firing.resetTargets();summary.reset=drones.states.map(s=>({phase:s.phase,shots:s.cycle.shots,stationCommitted:s.stationCommitted,evasions:s.evasions}));
firing.dispose();enemies.dispose();wildlife.dispose();disposeWorld(world);summary.disposal={aircraft:drones.states.length,obstacles:drones.obstacles,oldObstacleBytes:obstacle.byteLength,oldObstacleActors:obstacle.records.length,oldNavigationBytes:nav.byteLength};
await Bun.write(new URL('./interception-trace.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
const {samples:_,...compact}=summary;console.log(JSON.stringify(compact,null,2));
