import {newLevel} from '../../shared/level.js';
import {buildWorld,disposeWorld} from '../../engine/world.js';
import {DefencePreview} from '../../game/defence-preview.js';
import {Health} from '../../engine/health.js';
const model=await Bun.file(new URL('../../assets/models/drone-defence.json',import.meta.url)).json(),runs=[];
for(const hz of [30,60,120]){
 const level=newLevel('independent-cleared-warning');level.size=[8,8];level.placements=[{id:'drone-1',model:model.id,variant:'base',box:[3,0,3],turn:0}];
 const world=buildWorld(level,new Map([[model.id,model]])),target={id:'living-enemy',x:84,z:36,aimX:84,aimY:34.5,aimZ:36,lap:0,health:new Health(10000),threat:1,movement:{speed:0}},f=new DefencePreview(world,()=>{},()=>.5,null,[target],(t,n)=>t.health.takeDamage(n)),d=f.drones,s=d.states[0];
 s.wantEvade=true;s.avoidanceCause='predicted-trajectory';s.avoidanceActorId='threat-that-has-departed';
 const currentClear=d.dynamicPointClear(s,s.x,s.y,s.z,0),futureClear=d.dynamicPointClear(s,s.x,s.y,s.z,1);let firstShot=null;
 for(let frame=0;frame<hz*3;frame++){f.advance(1/hz);if(s.cycle.shots)firstShot??=d.time;}
 runs.push({hz,currentClear,futureClear,wantEvade:s.wantEvade,evasions:s.evasions,launches:s.launches,firstShot,shots:s.cycle.shots,phase:s.phase,flightElapsed:s.flightElapsed});f.dispose();disposeWorld(world);
}
await Bun.write(new URL('./warning-withdrawal.json',import.meta.url),JSON.stringify({method:'Inject a stale prior threat warning into an otherwise clear production controller with a living target. Verify normal useful launch and fire without an avoidance manoeuvre at30/60/120Hz.',runs},null,2)+'\n');console.log(JSON.stringify(runs));
