import {newLevel} from '../../shared/level.js';
import {buildWorld,disposeWorld} from '../../engine/world.js';
import {EnemyPreview} from '../../game/enemy-preview.js';
import {MissileFlightPool} from '../../engine/missile-flight.js';
import {MISSILE_PREVIEW_ACTORS} from '../../game/missile-preview.js';
import {MISSILE_PHASE as PHASE} from '../../shared/missile-flight.js';
import {MISSILE_LAUNCHER_SOCKETS,MISSILE_LAUNCHER_DECK_Y} from '../../shared/missile-model.js';

export const FLYERS=['moth','twin-fan','ray','lantern'];
const models=new Map(await Promise.all([...FLYERS,'missile-launcher','guided-missile'].map(async id=>[id,await Bun.file(new URL(`../../assets/models/${id}.json`,import.meta.url)).json()])));
const straight=Array.from({length:12},(_,i)=>[i+2,0,6]);
const bend=[...Array.from({length:6},(_,i)=>[i+2,0,6]),...Array.from({length:6},(_,i)=>[7,0,i+7])];
export const ENCOUNTERS=Object.freeze([
 {name:'close-crossing',route:straight,distance:96,box:[7,0,7]},
 {name:'close-receding',route:straight,distance:132,box:[7,0,7]},
 {name:'close-approaching',route:straight,distance:60,box:[7,0,7]},
 {name:'banking-corner',route:bend,distance:96,box:[8,0,7]},
]);

// Production meshes, EnemyPreview flight curves/bank/aim derivatives, flight
// pool admission and physical nose-vs-animated-face contact. No proxy hit sphere.
export function runEncounter(model,scenario,dt=1/120,Pool=MissileFlightPool,inspect=null){
 const level=newLevel('missile-interception');level.size=[16,16];level.path=scenario.route;level.placements=[{id:'silo',model:'missile-launcher',variant:'base',box:scenario.box,turn:0}];
 const actors=[{id:'flyer',model,variant:'base',distance:scenario.distance}],world=buildWorld(level,models,{actors:[...actors,...MISSILE_PREVIEW_ACTORS]}),enemies=new EnemyPreview(world,()=>{},null,actors),target=enemies.states[0],socket=MISSILE_LAUNCHER_SOCKETS.base[0],owner={id:'silo',hits:0,launchRise:MISSILE_LAUNCHER_DECK_Y.base-socket[1]},root=world.rigs.get('silo').root;
 const impacts=[],hits=[],pool=new Pool(world,enemies.states,()=>{},()=>{},(enemy,strength,vx,vy,vz)=>{hits.push({time:pool.time,position:[enemy.aimX,enemy.aimY,enemy.aimZ],velocity:[vx,vy,vz]});return enemies.takeHit(enemy,strength,vx,vy,vz);},{onImpact:(...args)=>impacts.push(args),random:()=>.5});
 try{
  inspect?.({pool,enemies,target,world});
  // Match the base silo's first real socket, including the missile centre.
  pool.seat(0,owner,root[12]+socket[0],root[13]+socket[1],root[14]+socket[2],root);
  const initial=[target.aimX,target.aimY,target.aimZ],launchDistance=Math.hypot(target.x-(root[12]+12),target.z-(root[14]+12)),slot=pool.slots[0];let admissionMilliseconds=0,maximumAdmissionMilliseconds=0;
  const admit=()=>{const start=performance.now(),clear=pool.launchClear(0,target),milliseconds=performance.now()-start;admissionMilliseconds+=milliseconds;maximumAdmissionMilliseconds=Math.max(maximumAdmissionMilliseconds,milliseconds);return clear;};
  let clear=admit(),wait=0;
  while(!clear&&wait<4){enemies.advance(dt);pool.advance(dt);wait+=dt;clear=admit();}
  const launchDistanceAfterWait=Math.hypot(target.x-(root[12]+12),target.z-(root[14]+12));clear&&=launchDistanceAfterWait<=72;
  if(!clear)return {model,scenario:scenario.name,dt,clear,launchDistance,launchDistanceAfterWait,initial,wait,hits:0};
  pool.launch(0,target,60);
  let nearest=Infinity,nearestState=null,cutoff=null,flightEnd=null;
  for(let frame=0;frame<Math.ceil(8/dt)&&slot.phase>=PHASE.BOOST;frame++){
   enemies.advance(dt);pool.advance(dt);
   if(slot.phase>=PHASE.BOOST){
    const separation=Math.hypot(slot.x+slot.dx*5-target.aimX,slot.y+slot.dy*5-target.aimY,slot.z+slot.dz*5-target.aimZ);if(separation<nearest){nearest=separation;nearestState={age:slot.age,nose:[slot.x+slot.dx*5,slot.y+slot.dy*5,slot.z+slot.dz*5],target:[target.aimX,target.aimY,target.aimZ],aim:[slot.aimX,slot.aimY,slot.aimZ],velocity:[slot.vx,slot.vy,slot.vz],direction:[slot.dx,slot.dy,slot.dz]};}
    if(slot.engineCutoff&&!cutoff){const speed=Math.hypot(slot.vx,slot.vy,slot.vz);cutoff={age:slot.age,speed,aim:[slot.aimX,slot.aimY,slot.aimZ],nose:[slot.x+slot.dx*5,slot.y+slot.dy*5,slot.z+slot.dz*5],velocity:[slot.vx,slot.vy,slot.vz],target:[target.aimX,target.aimY,target.aimZ]};}
   }else flightEnd=pool.time;
  }
  return {model,scenario:scenario.name,dt,clear,launchDistance,launchDistanceAfterWait,initial,wait,admissionMilliseconds,maximumAdmissionMilliseconds,clearanceChecks:pool.clearanceChecks,hits:hits.length,hit:hits[0]??null,nearest,nearestState,cutoff,flightEnd,missed:pool.missed,collisions:pool.collisions,expired:pool.expired,offMap:pool.offMap,lostTargets:pool.lostTargets,impacts};
 }finally{pool.dispose();enemies.dispose();disposeWorld(world);}
}

if(import.meta.main){
 const results=[];for(const model of FLYERS)for(const scenario of ENCOUNTERS)results.push(runEncounter(model,scenario));
 console.log(JSON.stringify(results,null,2));
}
