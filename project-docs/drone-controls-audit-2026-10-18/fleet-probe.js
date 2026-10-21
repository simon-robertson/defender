import {createHash} from 'node:crypto';
// Controller-level adversarial probe: retained valid straight return intents
// can meet after either aircraft replans. No runtime source or level is edited.
import {newLevel} from '../../shared/level.js';
import {buildWorld,disposeWorld} from '../../engine/world.js';
import {DefencePreview} from '../../game/defence-preview.js';
import {DRONE_PREVIEW as T} from '../../shared/drone.js';
import {droneBoxesOverlap} from '../../engine/drone-navigation.js';
const sourceHashes={};for(const name of ['game/drone-preview.js','engine/drone-motion.js','engine/drone-navigation.js','engine/drone-clearance.js','engine/drone-obstacles.js','shared/drone.js'])sourceHashes[name]=createHash('sha256').update(new Uint8Array(await Bun.file(new URL('../../'+name,import.meta.url)).arrayBuffer())).digest('hex');
const model=await Bun.file(new URL('../../assets/models/drone-defence.json',import.meta.url)).json(),runs=[];
for(const hz of [30,60,120])for(const scenario of ['head-on','crossing','neutral-launch']){
 const level=newLevel('independent-fleet-'+scenario);level.size=[16,12];level.placements=[{id:'drone-1',model:model.id,variant:'base',box:[3,0,5],turn:0},{id:'drone-2',model:model.id,variant:'base',box:[8,0,5],turn:0}];
 const world=buildWorld(level,new Map([[model.id,model]])),f=new DefencePreview(world,()=>{},()=>.5,null,[],()=>0),d=f.drones,[a,b]=d.states,events=[],m=d.states.map(s=>({id:s.id,yieldFrames:0,evadeFrames:0,distance:0,last:[s.x,s.y,s.z],yieldTo:null,arrivedAt:null,maxBodyUpError:0}));
 if(scenario==='head-on'){a.x=180;a.z=132;b.x=108;b.z=132;}else if(scenario==='crossing'){a.x=204;a.z=228;b.x=84;b.z=228;}else{a.x=260;a.z=132;b.x=b.homeX;b.z=b.homeZ;}
 for(const s of d.states){s.y=s.ground+9+T.lift;s.phase='intercept';s.flightElapsed=20;s.expired=true;s.retargetPending=false;d.writePose(s,0,true);d.beginReturn(s);s.motion.clear();s.motion.add(s.x,s.y,s.z,0,0,0,s.homeX,s.y,s.homeZ,false,0);s.blocked=false;s.returnPlanning=false;}
 if(scenario==='neutral-launch'){b.phase='launch';b.flightElapsed=0;b.expired=false;b.y=b.ground+9;b.motion.clear();d.writePose(b,0,true);}
 for(let i=0;i<m.length;i++)m[i].last=[d.states[i].x,d.states[i].y,d.states[i].z];
 let overlapFrames=0,simultaneousYieldFrames=0,simultaneousEvasionFrames=0,minCentres=Infinity,maxThinks=0;
 for(let frame=0;frame<30*hz;frame++){
  const thinks=f.planner.thinks;f.advance(1/hz);maxThinks=Math.max(maxThinks,f.planner.thinks-thinks);const boxes=[];
  for(let i=0;i<2;i++){const s=d.states[i],r=m[i],neutral=['pad-hover','recharge','launch','descend'].includes(s.phase),rad=neutral?11:T.hullRadius,below=neutral?5:T.hullBelow,above=neutral?5:T.hullAbove;
   boxes.push([s.x-rad,s.y-below,s.z-rad,s.x+rad,s.y+above,s.z+rad]);r.distance+=Math.hypot(s.x-r.last[0],s.y-r.last[1],s.z-r.last[2]);r.last=[s.x,s.y,s.z];if(s.fleetWait||s.fleetYieldTo)r.yieldFrames++;if(s.evading||s.wantEvade)r.evadeFrames++;
   if(s.fleetYieldTo!==r.yieldTo){events.push({time:d.time,id:s.id,type:'yield',from:r.yieldTo,to:s.fleetYieldTo,position:r.last,phase:s.phase});r.yieldTo=s.fleetYieldTo;}
   if(r.arrivedAt===null&&['recharge','pad-hover'].includes(s.phase)&&Math.hypot(s.x-s.homeX,s.z-s.homeZ,s.y-s.ground-9)<1e-4)r.arrivedAt=d.time;
   r.maxBodyUpError=Math.max(r.maxBodyUpError,Math.abs(s.bodyMatrix[4]),Math.abs(s.bodyMatrix[5]-1),Math.abs(s.bodyMatrix[6]));
  }
  minCentres=Math.min(minCentres,Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z));if(droneBoxesOverlap(boxes[0],boxes[1]))overlapFrames++;if((a.fleetWait||a.fleetYieldTo)&&(b.fleetWait||b.fleetYieldTo))simultaneousYieldFrames++;if((a.evading||a.wantEvade)&&(b.evading||b.wantEvade))simultaneousEvasionFrames++;
 }
 for(let i=0;i<2;i++){const s=d.states[i];m[i].final={phase:s.phase,position:[s.x,s.y,s.z],emergencies:s.emergencyStops,holds:s.holds,evasions:s.evasions,action:s.flightAction};}
 runs.push({hz,scenario,seconds:30,overlapFrames,simultaneousYieldFrames,simultaneousEvasionFrames,minCentres,maxThinks,aircraft:m,events});f.dispose();disposeWorld(world);
}
await Bun.write(new URL('./'+(process.argv[2]??'fleet')+'.json',import.meta.url),JSON.stringify({date:'2026-10-18',sourceHashes,method:'Actual production rigs and controllers in a flat scene, with two pre-existing straight return intents intentionally meeting head-on/diagonally, or meeting an independently prioritized neutral launch. Timings/models unchanged; fixtures are in memory only. Measures useful arrival and reciprocal avoidance as well as 3D declared-envelope clearance.',runs},null,2)+'\n');console.log(JSON.stringify(runs));
