// Bounded CPU-only A1 observation. Run from any directory with Bun; writes only
// after-trace.json beside this probe. Runtime allocation behaviour is separate
// from this deliberately readable, finite evidence recorder.
import {buildWorld,disposeWorld} from '../../engine/world.js';
import {actorsForPreview} from '../../game/preview-actors.js';
import {EnemyPreview} from '../../game/enemy-preview.js';
import {DefencePreview} from '../../game/defence-preview.js';
import {DRONE_PREVIEW as T} from '../../shared/drone.js';
import {DRONE_MODEL as M} from '../../shared/drone-model.js';

const level=await Bun.file(new URL('../../assets/levels/moss-01.json',import.meta.url)).json(),actors=actorsForPreview(level),models=new Map();
for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)]))models.set(id,await Bun.file(new URL(`../../assets/models/${id}.json`,import.meta.url)).json());
const world=buildWorld(level,models,{actors}),enemies=new EnemyPreview(world,()=>{});
for(const target of enemies.states)target.health.current=target.health.maximum=100000;
const firing=new DefencePreview(world,()=>{},()=>.5,null,enemies.states,()=>0),drones=firing.drones;
const previous=drones.states.map(s=>[s.x,s.y,s.z,0,0,0,0,0,0,s.goalNode]),metrics=drones.states.map(s=>({id:s.id,maxDisplacementSpeed:0,maxDisplacementAcceleration:0,maxReportedAcceleration:0,velocityJumpFrames:0,maxBodyTilt:0,maxBodyUpError:0,maxFanTilt:0,goalChanges:0,staticClear:true})),trace=[];
const dt=1/60;
for(let frame=0;frame<3600;frame++){
 enemies.advance(dt);firing.advance(dt);
 for(let i=0;i<drones.states.length;i++){
  const s=drones.states[i],p=previous[i],r=metrics[i],vx=(s.x-p[0])/dt,vy=(s.y-p[1])/dt,vz=(s.z-p[2])/dt,dv=Math.hypot(vx-p[3],vy-p[4],vz-p[5]);
  r.maxDisplacementSpeed=Math.max(r.maxDisplacementSpeed,Math.hypot(vx,vy,vz));r.maxDisplacementAcceleration=Math.max(r.maxDisplacementAcceleration,dv/dt);r.maxReportedAcceleration=Math.max(r.maxReportedAcceleration,Math.hypot(s.velocityX-p[6],s.velocityY-p[7],s.velocityZ-p[8])/dt);if(dv>8)r.velocityJumpFrames++;
  r.maxBodyTilt=Math.max(r.maxBodyTilt,Math.abs(s.bodyPitch),Math.abs(s.bodyRoll));r.maxBodyUpError=Math.max(r.maxBodyUpError,Math.abs(s.bodyMatrix[4]),Math.abs(s.bodyMatrix[5]-1),Math.abs(s.bodyMatrix[6]));for(const fan of s.fans)r.maxFanTilt=Math.max(r.maxFanTilt,Math.hypot(fan.pitch,fan.roll));
  if(s.goalNode!==p[9])r.goalChanges++;
  if(!['pad-hover','launch','descend','recharge'].includes(s.phase)&&!drones.navigation.clearSegment(s.x,s.y,s.z,s.x,s.y,s.z))r.staticClear=false;
  p[0]=s.x;p[1]=s.y;p[2]=s.z;p[3]=vx;p[4]=vy;p[5]=vz;p[6]=s.velocityX;p[7]=s.velocityY;p[8]=s.velocityZ;p[9]=s.goalNode;
 }
 if(frame%6===0||frame===3599)trace.push({time:(frame+1)*dt,aircraft:drones.states.map(s=>({id:s.id,phase:s.phase,position:[s.x,s.y,s.z],velocity:[s.velocityX,s.velocityY,s.velocityZ],acceleration:[s.accelerationX,s.accelerationY,s.accelerationZ],speed:s.speed,bodyYaw:s.aim.yaw,yawAcceleration:s.yawAcceleration,bodyPitch:s.bodyPitch,bodyRoll:s.bodyRoll,fans:s.fans.map(f=>({id:f.id,pitch:f.pitch,roll:f.roll})),goal:s.goalNode,stationChanges:s.stationChanges,routeChanges:s.routeChanges,emergencyStops:s.emergencyStops}))});
}
for(let i=0;i<metrics.length;i++){const s=drones.states[i];Object.assign(metrics[i],{stationChanges:s.stationChanges,routeChanges:s.routeChanges,emergencyStops:s.emergencyStops,holds:s.holds,launches:s.launches,returns:s.returns,shots:s.cycle.shots,phase:s.phase});}
const nav=drones.navigation,typedBytes=nav.byteLength+drones.states.reduce((total,s)=>total+Object.values(s.nav).reduce((n,v)=>n+(ArrayBuffer.isView(v)?v.byteLength:0),0)+s.candidateNodes.byteLength+s.candidateTimes.byteLength+s.candidateLap.byteLength+s.motion.data.byteLength+s.motion.point.byteLength+s.motion.samplePoint.byteLength,0);
const report={date:'2026-10-18',method:{level:level.id,seconds:60,frames:3600,dt,random:.5,targetHealth:100000,appliedDamage:0,renderer:false,traceHz:10,velocityJumpThreshold:8},tuning:T,fanCone:M.fanTiltMax,minimumFanLift:M.minimumFanTiltLift,plannerThinks:firing.planner.thinks,navigation:{nodes:nav.count,free:nav.free.reduce((n,v)=>n+v,0),sharedTypedBytes:nav.byteLength,planningAndMotionTypedBytes:typedBytes,curveBytesPerAircraft:drones.states[0].motion.data.byteLength},metrics,trace};
await Bun.write(new URL('./after-trace.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({metrics,navigation:report.navigation,plannerThinks:report.plannerThinks,traceSamples:trace.length},null,2));
firing.dispose();enemies.dispose();disposeWorld(world);
