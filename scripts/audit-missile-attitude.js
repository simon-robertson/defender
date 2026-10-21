// Read-only production flight trace: varied turn factors at30/60/120 Hz.
// Optional output path writes evidence only; no source assets are modified.
import {MissilePreview,MISSILE_PREVIEW_ACTORS,missileActorsForLevel} from '../game/missile-preview.js';
import {MISSILE_FLIGHT as FLIGHT,MISSILE_FIRING,MISSILE_PHASE as PHASE,MAX_MISSILES,MAX_MISSILE_LIGHTS,MISSILE_THRUST_LIGHT,MISSILE_ATTACK_THRUST} from '../shared/missile-flight.js';
import {MISSILE_LAUNCHER_SOCKETS,MISSILE_LAUNCHER_DECK_Y,GUIDED_MISSILE_MODEL} from '../shared/missile-model.js';
import {missileLauncherModel,guidedMissileModel} from '../scripts/missile-launcher.js';
import {dogModel} from '../scripts/dog.js';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {Health} from '../engine/health.js';

const models=new Map([missileLauncherModel(),guidedMissileModel(),dogModel()].map(m=>[m.id,m]));
function fixture(variant='base',turn=0,launchers=1){
 const level=newLevel('missile-test');level.size=[8,8];level.placements=Array.from({length:launchers},(_,i)=>({id:'launcher-'+i,model:'missile-launcher',variant,box:[3+i,0,3],turn}));
 const world=buildWorld(level,models,{actors:[...MISSILE_PREVIEW_ACTORS,{id:'enemy',model:'dog',variant:'base'}]}),visible=new Set(),hits=[],impacts=[],launches=[];
 const target={id:'enemy',x:84,z:36,aimY:34.5,lap:0,velocityX:0,velocityZ:0,health:new Health(3000)},targets=[target],data=world.actors.get(target.id);
 function pose(){data.root[12]=target.x-12;data.root[13]=target.aimY-11.5;data.root[14]=target.z-12;for(const i of data.instances)i.matrix.set(data.root);}
 pose();const preview=new MissilePreview(world,()=>{},(id,value)=>value?visible.add(id):visible.delete(id),targets,(enemy,strength,vx,vy,vz)=>{hits.push({enemy,strength,time:preview.pool.time,vx,vy,vz});return enemy.health.takeDamage(strength);},{onImpact:(...values)=>impacts.push(values),onLaunch:(...values)=>launches.push(values)}),state=preview.states[0];
 const advance=dt=>{pose();for(const state of preview.states){state.target=targets.includes(target)&&target.health.alive?target:null;state.targetLap=target.lap;}preview.advance(dt);};
 return {world,preview,state,target,targets,visible,hits,impacts,launches,pose,advance,dispose(){preview.dispose();disposeWorld(world);}};
}
function launch(f){f.advance(0);if(f.state.cycle.shots!==1)throw Error('No launch');f.state.cycle.readyAt=Infinity;return f.preview.pool.slots.find(s=>s.phase===PHASE.BOOST);}


const results=[];
for(const factor of [.85,1,1.15])for(const hz of [30,60,120]){
 const f=fixture();try{const s=launch(f);s.turnFactor=factor;const frames=[];
  for(let n=0;n<6*hz&&s.phase>=PHASE.BOOST;n++){f.advance(1/hz);const t=f.preview.thrust;let jets=0;for(let j=0;j<t.instanceCount;j++)if(t.instanceData[j*16+12]===-1)jets++;frames.push({t:s.age,phase:s.phase,angle:s.steeringAngle??0,rate:s.angularSpeed??0,torque:s.steeringTorque??0,jets});}
  const visible=frames.filter(x=>x.jets);results.push({factor,hz,hits:f.hits.length,collisions:f.preview.pool.collisions,first:visible[0]?.t,last:visible.at(-1)?.t,visibleSeconds:visible.length/hz,frames});
 }finally{f.dispose();}}
const output=process.argv[2];if(output)await Bun.write(output,JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({frames,...r})=>r),null,2));
