import {test,expect} from 'bun:test';
import {MissilePreview,MISSILE_PREVIEW_ACTORS,missileActorsForLevel} from '../game/missile-preview.js';
import {MISSILE_FLIGHT as FLIGHT,MISSILE_FIRING,MISSILE_PHASE as PHASE,MAX_MISSILES,MAX_MISSILE_LIGHTS,MISSILE_THRUST_LIGHT,MISSILE_ATTACK_THRUST} from '../shared/missile-flight.js';
import {MISSILE_LAUNCHER_SOCKETS,MISSILE_LAUNCHER_DECK_Y,GUIDED_MISSILE_MODEL} from '../shared/missile-model.js';
import {missileLauncherModel,guidedMissileModel} from '../scripts/missile-launcher.js';
import {dogModel} from '../scripts/dog.js';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {MISSILE_TRAIL_SMOKE} from '../shared/damage-effects.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {Health} from '../engine/health.js';

const models=new Map([missileLauncherModel(),guidedMissileModel(),dogModel()].map(m=>[m.id,m]));
function fixture(variant='base',turn=0,launchers=1,blockers=[]){
 const level=newLevel('missile-test');level.size=[8,8];level.placements=Array.from({length:launchers},(_,i)=>({id:'launcher-'+i,model:'missile-launcher',variant,box:[3+i,0,3],turn}));
 level.placements.push(...blockers);
 const world=buildWorld(level,models,{actors:[...MISSILE_PREVIEW_ACTORS,{id:'enemy',model:'dog',variant:'base'}]}),visible=new Set(),hits=[],impacts=[],launches=[];
 const target={id:'enemy',x:84,z:36,aimY:34.5,lap:0,velocityX:0,velocityZ:0,health:new Health(3000)},targets=[target],data=world.actors.get(target.id);
 function pose(){data.root[12]=target.x-12;data.root[13]=target.aimY-11.5;data.root[14]=target.z-12;for(const i of data.instances)i.matrix.set(data.root);}
 pose();const preview=new MissilePreview(world,()=>{},(id,value)=>value?visible.add(id):visible.delete(id),targets,(enemy,strength,vx,vy,vz)=>{hits.push({enemy,strength,time:preview.pool.time,vx,vy,vz});return enemy.health.takeDamage(strength);},{onImpact:(...values)=>impacts.push(values),onLaunch:(...values)=>launches.push(values)}),state=preview.states[0];
 const advance=dt=>{pose();for(const state of preview.states){state.target=targets.includes(target)&&target.health.alive?target:null;state.targetLap=target.lap;}preview.advance(dt);};
 return {world,preview,state,target,targets,visible,hits,impacts,launches,pose,advance,dispose(){preview.dispose();disposeWorld(world);}};
}
function launch(f){f.advance(0);expect(f.state.cycle.shots).toBe(1);f.state.cycle.readyAt=Infinity;return f.preview.pool.slots.find(s=>s.phase===PHASE.BOOST);}

test('fixed missiles are seated at actual transformed sockets; loaded rounds never produce thrust',()=>{
 expect(MISSILE_PREVIEW_ACTORS).toHaveLength(MAX_MISSILES);expect(missileActorsForLevel('moss-03')).toBe(MISSILE_PREVIEW_ACTORS);expect(missileActorsForLevel('moss-01')).toHaveLength(0);
 expect(missileActorsForLevel('moss-04')).toBe(MISSILE_PREVIEW_ACTORS);expect(missileActorsForLevel('ochre-04')).toBe(MISSILE_PREVIEW_ACTORS);
 for(const variant of ['base','upgrade1','upgrade2'])for(const turn of [0,1,2,3]){
  const f=fixture(variant,turn);try{
   expect(f.visible.size).toBe(MISSILE_FIRING[variant].magazine);expect(f.state.ammo).toBe(f.state.capacity);expect(f.preview.thrust.instanceCount).toBe(0);
   for(let i=0;i<f.state.capacity;i++){const slot=f.preview.pool.slots[f.state.slots[i]],socket=MISSILE_LAUNCHER_SOCKETS[variant][i],m=slot.instance.matrix,r=f.state.root;
    for(let axis=0;axis<3;axis++)expect(m[axis]*12+m[8+axis]*12+m[12+axis]).toBeCloseTo(r[axis]*socket[0]+r[4+axis]*socket[1]+r[8+axis]*socket[2]+r[12+axis],5);
    expect(slot.phase).toBe(PHASE.LOADED);expect(m[5]).toBe(1);
   }
   expect(f.launches).toHaveLength(0);launch(f);expect(f.launches).toHaveLength(1);
   const socket=MISSILE_LAUNCHER_SOCKETS[variant][0],root=f.state.root;
   for(let axis=0;axis<3;axis++)expect(f.launches[0][axis]).toBeCloseTo(root[axis]*socket[0]+root[4+axis]*MISSILE_LAUNCHER_DECK_Y[variant]+root[8+axis]*socket[2]+root[12+axis],8);
  }finally{f.dispose();}expect(f.visible.size).toBe(0);
 }
});

test('boost, attitude-jet coast and reignition are distinct and keep their exact phase timing',()=>{
 const f=fixture();try{
  const slot=launch(f),start=slot.y,storage=f.preview.thrust.instanceData,mat=slot.instance.matrix;
  expect(f.hits).toHaveLength(0);expect(f.preview.thrust.instanceCount).toBe(2);
  expect(f.preview.thrust.lightCount).toBe(1);expect(f.preview.thrust.lightData[0]).toBe(1);
  expect(storage[3]).toBeCloseTo(1.62,6);expect(storage[7]).toBeCloseTo(10.8,6);expect(storage[19]).toBeCloseTo(1.08,6);expect(storage[11]).toBe(1);
  f.advance(.5);expect(slot.phase).toBe(PHASE.COAST);expect(slot.y-start).toBeCloseTo(32,8);expect(slot.dy).toBe(1);expect(f.preview.thrust.instanceCount).toBe(0);expect(f.hits).toHaveLength(0);
  expect(f.preview.thrust.lightCount).toBe(0);expect(f.preview.thrust.lightData[0]).toBe(0);
  const y=slot.y;f.advance(.2);expect(slot.phase).toBe(PHASE.COAST);expect(slot.y).toBeGreaterThan(y);expect(slot.vy).toBeCloseTo(56,8);expect(slot.dy).toBeLessThan(1);expect([0,2]).toContain(f.preview.thrust.instanceCount);
  f.advance(.2);expect(slot.phase).toBe(PHASE.HOMING);expect(slot.y-y).toBeCloseTo(22.4,8);expect(slot.vy).toBeCloseTo(48,8);expect([2,4]).toContain(f.preview.thrust.instanceCount);
  expect(f.preview.thrust.lightCount).toBe(1);
  const vx=slot.vx,vy=slot.vy,vz=slot.vz;f.advance(1/120);expect(Math.hypot(slot.vx-vx,slot.vy-vy,slot.vz-vz)).toBeLessThanOrEqual(FLIGHT.acceleration/120+1e-8);
  expect(slot.instance.matrix).toBe(mat);expect(f.preview.thrust.instanceData).toBe(storage);
  for(let axis=0;axis<3;axis++){const direction=axis===0?slot.dx:axis===1?slot.dy:slot.dz;expect(storage[4+axis]).toBeCloseTo(-direction,6);}
 }finally{f.dispose();}
});

test('every powered missile has one reusable warm exhaust light following its actual tail',()=>{
 const f=fixture();try{
  const pool=f.preview.pool,thrust=pool.thrust,data=thrust.lightData,rule=MISSILE_THRUST_LIGHT;
  expect(data.byteLength).toBe(1168);expect(MAX_MISSILE_LIGHTS).toBe(MAX_MISSILES);expect(thrust.lightCount).toBe(0);
  for(let i=0;i<pool.slots.length;i++){const slot=pool.slots[i];slot.phase=i%2?PHASE.HOMING:PHASE.BOOST;slot.x=10+i;slot.y=50;slot.z=70;slot.dx=.6;slot.dy=.8;slot.dz=0;}
  pool.prepare();expect(thrust.lightCount).toBe(36);expect(data[0]).toBe(36);expect(thrust.instanceCount).toBe(72);
  for(let i=0;i<36;i++){const slot=pool.slots[i],k=4+i*8;expect(data[k]).toBeCloseTo(slot.x-slot.dx*(5+rule.offset),5);expect(data[k+1]).toBeCloseTo(slot.y-slot.dy*(5+rule.offset),5);expect(data[k+2]).toBe(slot.z);expect(data[k+3]).toBe(32);for(let axis=0;axis<3;axis++)expect(data[k+4+axis]).toBeCloseTo(rule.color[axis],6);const strength=slot.phase===PHASE.HOMING?MISSILE_ATTACK_THRUST.lightStrength:rule.strength;expect(data[k+7]).toBeGreaterThanOrEqual(strength*.8-1e-6);expect(data[k+7]).toBeLessThanOrEqual(strength);}
  pool.time=.3;for(let i=0;i<36;i+=2)pool.slots[i].phase=PHASE.COAST;pool.prepare();expect(thrust.lightCount).toBe(18);expect(data[0]).toBe(18);expect(thrust.lightData).toBe(data);
  for(let i=0;i<18;i++)expect(data[4+i*8]).toBeCloseTo(pool.slots[i*2+1].x-.6*8,5);
  pool.reset();expect(thrust.lightCount).toBe(0);expect(data[0]).toBe(0);pool.prepare();expect(thrust.lightCount).toBe(0);expect(thrust.lightData).toBe(data);
 }finally{f.dispose();}
});

test('the second burn enlarges flame and core and strengthens its light without changing boost',()=>{
 const f=fixture();try{
  const pool=f.preview.pool,slot=launch(f),thrust=pool.thrust,data=thrust.instanceData,lights=thrust.lightData;
  const width=data[3],length=data[7],core=data[19],strength=lights[11];
  slot.phase=PHASE.HOMING;pool.prepare();
  expect(FLIGHT.cruiseSpeed).toBe(180);expect(FLIGHT.acceleration).toBe(630);
  expect(data[3]).toBeCloseTo(width*1.3,6);expect(data[7]).toBeCloseTo(length*1.5,6);expect(data[19]).toBeCloseTo(core*1.3,6);expect(lights[11]).toBeCloseTo(strength*1.5,6);
  expect(thrust.lightCount).toBe(1);expect(thrust.instanceCount).toBe(2);
  slot.engineCutoff=true;pool.prepare();expect(thrust.lightCount).toBe(0);expect(lights[0]).toBe(0);expect(thrust.instanceCount).toBe(0);
  pool.reset();expect(slot.engineCutoff).toBe(false);expect(thrust.instanceData).toBe(data);expect(thrust.lightData).toBe(lights);
 }finally{f.dispose();}
});

test('missiles consume finite magazines, never top up early and fully refill only after the last-launch reload',()=>{
 for(const variant of ['base','upgrade1','upgrade2']){
  const f=fixture(variant);try{
   const {magazine,gap,reload}=MISSILE_FIRING[variant];expect(gap).toBe(1);f.advance(0);expect(f.state.ammo).toBe(magazine-1);f.advance(gap-.001);expect(f.state.cycle.shots).toBe(1);
   f.advance(.0011);for(let i=2;i<magazine;i++){f.advance(gap/2);f.advance(gap/2+.00001);}
   expect(f.state.cycle.shots).toBe(magazine);expect(f.state.ammo).toBe(0);expect(f.state.reloading).toBe(true);
   const last=f.state.lastShotAt,until=f.state.reloadUntil;expect(until-last).toBeCloseTo(reload,10);
   f.targets.length=0;f.advance(reload-.001);expect(f.state.ammo).toBe(0);expect(f.state.cycle.shots).toBe(magazine);
   f.advance(.0011);expect(f.state.ammo).toBe(magazine);expect(f.state.reloading).toBe(false);expect(f.state.reloads).toBe(1);expect(f.visible.size).toBe(magazine);
   expect(f.launches).toHaveLength(magazine);
  }finally{f.dispose();}
 }
});

test('real nose contact damages once after travel; prediction intercepts a straight moving enemy beyond launch range',()=>{
 for(const moving of [false,true]){
  const f=fixture();try{
   // Leave acquisition range inside the level, not across its off-map bound.
   if(moving){f.target.x=140;f.target.z=84;f.target.velocityX=12;f.pose();}const slot=launch(f);
   for(let frame=0;frame<960&&!f.hits.length;frame++){f.target.x+=f.target.velocityX/120;f.target.z+=f.target.velocityZ/120;f.advance(1/120);}
   expect(f.hits).toHaveLength(1);expect(f.hits[0].time).toBeGreaterThan(.9);expect(f.hits[0].strength).toBe(60);expect(f.target.health.current).toBe(2940);expect(slot.phase).toBe(PHASE.FREE);expect(slot.target).toBeNull();
   expect([f.hits[0].vx,f.hits[0].vy,f.hits[0].vz]).toEqual([slot.vx,slot.vy,slot.vz]);expect(Math.hypot(f.hits[0].vx,f.hits[0].vy,f.hits[0].vz)).toBeGreaterThan(0);
   expect(f.impacts).toHaveLength(1);const [x,y,z,nx,ny,nz]=f.impacts[0];expect(Math.hypot(nx,ny,nz)).toBeCloseTo(1,8);expect(nx*slot.vx+ny*slot.vy+nz*slot.vz).toBeLessThan(0);
   if(!moving){
    let surface=false;
    for(const part of f.preview.pool.records.get(f.target).parts){const m=part.matrix,wx=x-m[12],wy=y-m[13],wz=z-m[14],p=[m[0]*wx+m[1]*wy+m[2]*wz,m[4]*wx+m[5]*wy+m[6]*wz,m[8]*wx+m[9]*wy+m[10]*wz];
     for(const q of part.quads){const u=(q.axis+1)%3,v=(q.axis+2)%3;if(Math.abs(p[q.axis]-q.origin[q.axis])<1e-6&&p[u]>=q.origin[u]-1e-6&&p[u]<=q.origin[u]+q.width+1e-6&&p[v]>=q.origin[v]-1e-6&&p[v]<=q.origin[v]+q.height+1e-6&&Math.abs(nx*m[q.axis*4]+ny*m[q.axis*4+1]+nz*m[q.axis*4+2]-q.sign)<1e-6)surface=true;}
    }expect(surface).toBe(true);
   }
   f.advance(1);expect(f.hits).toHaveLength(1);expect(f.preview.pool.collisions).toBe(0);
   if(moving)expect(Math.hypot(f.target.x-f.state.x,f.target.z-f.state.z)).toBeGreaterThan(f.state.maxRange);
  }finally{f.dispose();}
 }
});

test('powered guidance refreshes the accelerating intercept, then a late turn can miss the inertial terminal flight',()=>{
 const f=fixture();try{
  f.target.velocityZ=-12;const slot=launch(f),pool=f.preview.pool;
  for(let frame=0;frame<108;frame++){f.target.z-=12/120;f.advance(1/120);}
  expect(slot.phase).toBe(PHASE.HOMING);expect(slot.committed).toBe(true);expect(slot.age).toBeCloseTo(.9,10);
  const initial=[slot.aimX,slot.aimY,slot.aimZ],lead=(slot.aimZ-f.target.z)/f.target.velocityZ;
  // A 180-unit/s instantaneous-speed solution cannot account for the upward
  // launch momentum, finite acceleration and unfinished eased turn.
  expect(lead).toBeGreaterThan(Math.hypot(slot.aimX-slot.x,slot.aimY-slot.y,slot.aimZ-slot.z)/FLIGHT.cruiseSpeed);
  f.target.velocityX=20;f.target.velocityZ=0;
  for(let frame=0;frame<240&&!slot.engineCutoff&&slot.phase>=PHASE.BOOST;frame++){f.target.x+=20/120;f.advance(1/120);}
  expect(f.hits).toHaveLength(0);expect(slot.engineCutoff).toBe(true);expect([slot.aimX,slot.aimY,slot.aimZ]).not.toEqual(initial);
  const aim=[slot.aimX,slot.aimY,slot.aimZ],direction=[slot.dx,slot.dy,slot.dz],velocity=[slot.vx,slot.vy,slot.vz];
  f.target.velocityX=180;
  let continuedFrames=0;
  for(let frame=0;frame<240&&slot.phase>=PHASE.BOOST;frame++){
   f.target.x+=180/120;f.advance(1/120);if(slot.phase>=PHASE.BOOST){
    expect([slot.aimX,slot.aimY,slot.aimZ]).toEqual(aim);expect([slot.dx,slot.dy,slot.dz]).toEqual(direction);expect([slot.vx,slot.vy,slot.vz]).toEqual(velocity);
    expect(f.preview.thrust.instanceCount).toBe(0);expect(f.preview.thrust.lightCount).toBe(0);continuedFrames++;
   }
   if(slot.passedAim)expect(pool.incomingDamage(f.target)).toBe(0);
  }
  expect(continuedFrames).toBeGreaterThan(1);expect(slot.phase).toBe(PHASE.FREE);expect(pool.missed).toBe(1);expect(pool.expired).toBe(0);expect(f.hits).toHaveLength(0);expect(f.target.health.current).toBe(3000);
  f.preview.resetTargets();expect(pool.missed).toBe(0);expect(pool.slots.every(s=>!s.committed&&s.lastX===0&&s.lastY===0&&s.lastZ===0)).toBe(true);
 }finally{f.dispose();}
});

test('admission uses inclusive horizontal range without intercept rejection; lost or wrapped targets discard without retargeting',()=>{
 for(const cause of ['remove','lap','height','aim']){
  const f=fixture();try{
   f.target.z=f.state.z-f.state.maxRange;f.target.velocityZ=-1000;expect(f.preview.eligible(f.state,f.target)).toBe(true);f.target.z-=.00001;expect(f.preview.eligible(f.state,f.target)).toBe(false);
   f.target.z=36;f.target.velocityZ=0;const slot=launch(f);
   if(cause==='remove')f.targets.length=0;if(cause==='lap')f.target.lap++;if(cause==='height')f.target.aimY=NaN;if(cause==='aim')f.target.aimX=NaN;
   f.advance(.1);expect(slot.phase).toBe(PHASE.FREE);expect(slot.target).toBeNull();expect(f.hits).toHaveLength(0);expect(f.preview.pool.lostTargets).toBe(1);
  }finally{f.dispose();}
 }
});

test('prediction and a final death destination use the articulated aim point and its full velocity',()=>{
 const f=fixture();try{
  const target=f.target;target.aimX=target.x+3;target.aimZ=target.z+4;target.aimVelocityX=2;target.aimVelocityY=3;target.aimVelocityZ=-4;
  target.velocityX=1000;target.velocityY=-1000;target.velocityZ=1000;
  const slot=launch(f),pool=f.preview.pool;expect([slot.lastX,slot.lastY,slot.lastZ]).toEqual([target.aimX,target.aimY,target.aimZ]);
  f.advance(.9);expect(slot.committed).toBe(true);
  const lead=(slot.aimX-target.aimX)/target.aimVelocityX;
  expect(lead).toBeGreaterThan(0);expect((slot.aimY-target.aimY)/target.aimVelocityY).toBeCloseTo(lead,8);expect((slot.aimZ-target.aimZ)/target.aimVelocityZ).toBeCloseTo(lead,8);
  expect(lead).toBeGreaterThan(Math.hypot(slot.aimX-slot.x,slot.aimY-slot.y,slot.aimZ-slot.z)/FLIGHT.cruiseSpeed);
  target.aimX+=.5;target.aimY-=.3;target.aimZ-=.75;target.health.takeDamage(3000);pool.advance(0);
  const final=[target.aimX,target.aimY,target.aimZ];expect([slot.aimX,slot.aimY,slot.aimZ]).toEqual(final);expect(slot.target).toBeNull();expect(slot.orphaned).toBe(true);
  target.health.reset();target.aimX+=100;target.aimY+=100;target.aimZ+=100;pool.advance(.1);expect([slot.aimX,slot.aimY,slot.aimZ]).toEqual(final);expect(f.hits).toHaveLength(0);
 }finally{f.dispose();}
});

test('quad motion follows actual root translation independently of torso aim and root yaw',()=>{
 const f=fixture();try{
  launch(f);const pool=f.preview.pool,record=pool.records.get(f.target),data=f.world.actors.get(f.target.id);pool.advance(0);
  const part=record.parts[0],q=part.quads.find(q=>q.axis===1&&q.sign===1),local=q.origin.slice();local[(q.axis+1)%3]+=q.width/2;local[(q.axis+2)%3]+=q.height/2;
  const m=part.matrix,p=[0,1,2].map(axis=>m[axis]*local[0]+m[4+axis]*local[1]+m[8+axis]*local[2]+m[12+axis]);
  const original=pool.contact(record,p[0],p[1]+3,p[2],p[0],p[1]-3,p[2],0,1);expect(Number.isFinite(original)).toBe(true);
  f.target.aimX=f.target.x+.5;f.target.aimZ=f.target.z-.25;f.target.aimY+=5;pool.advance(0);
  expect([record.aimDX,record.aimDY,record.aimDZ]).toEqual([.5,5,-.25]);expect([record.dx,record.dy,record.dz]).toEqual([0,0,0]);
  expect(pool.contact(record,p[0],p[1]+3,p[2],p[0],p[1]-3,p[2],0,1)).toBe(original);
  // A two-unit physical bob really moves the surface through this stationary
  // nose, even though the independently sampled torso aim has not changed.
  data.root[13]+=2;for(const instance of data.instances)instance.matrix[13]+=2;pool.advance(0);
  expect([record.aimDX,record.aimDY,record.aimDZ]).toEqual([0,0,0]);expect([record.dx,record.dy,record.dz]).toEqual([0,2,0]);
  expect(pool.contact(record,p[0],p[1]+1,p[2],p[0],p[1]+1,p[2],0,1)).toBeCloseTo(.5,8);
  // Quarter-turn yaw changes pivot-compensating translation, not root travel.
  const root=data.root;root[0]=root[10]=0;root[2]=-1;root[8]=1;root[12]=f.target.x-12;root[14]=f.target.z+12;
  for(const instance of data.instances)instance.matrix.set(root);pool.advance(0);expect([record.dx,record.dy,record.dz]).toEqual([0,0,0]);
  pool.reset();expect([record.dx,record.dy,record.dz,record.aimDX,record.aimDY,record.aimDZ]).toEqual([0,0,0,0,0,0]);expect(f.impacts).toHaveLength(0);
 }finally{f.dispose();}
});

test('contact bounds build only for queried targets and refresh after zero-delta motion or reset',()=>{
 const f=fixture();try{
  const pool=f.preview.pool,record=pool.records.get(f.target),storage=record.bounds,part=record.parts[0];let writes=0;
  record.bounds=new Proxy(storage,{set(target,key,value){writes++;target[key]=value;return true;}});
  pool.advance(1/60);expect(writes).toBe(0);
  const q=part.quads.find(q=>q.axis===1&&q.sign===1),local=q.origin.slice();local[(q.axis+1)%3]+=q.width/2;local[(q.axis+2)%3]+=q.height/2;
  const m=part.matrix,p=[0,1,2].map(axis=>m[axis]*local[0]+m[4+axis]*local[1]+m[8+axis]*local[2]+m[12+axis]);
  const hit=()=>pool.contact(record,p[0],p[1]+3,p[2],p[0],p[1]-3,p[2],1,1);
  const first=hit();expect(Number.isFinite(first)).toBe(true);expect(writes).toBeGreaterThan(0);expect(Array.from(storage).every(Number.isFinite)).toBe(true);
  const initialWrites=writes;expect(hit()).toBe(first);expect(writes).toBe(initialWrites);
  // Retain movement samples even while only loaded rounds exist; a subsequent
  // query must see the new physical surface rather than the previous bounds.
  const data=f.world.actors.get(f.target.id);data.root[13]+=2;for(const instance of data.instances)instance.matrix[13]+=2;
  pool.advance(0);expect(writes).toBe(initialWrites);expect(record.dy).toBe(2);expect(hit()).toBeCloseTo(first-2/6,8);expect(writes).toBeGreaterThan(initialWrites);
  const changedWrites=writes;pool.reset();expect(record.dy).toBe(0);expect(hit()).toBeCloseTo(first-2/6,8);expect(writes).toBeGreaterThan(changedWrites);
  expect(f.hits).toHaveLength(0);expect(f.impacts).toHaveLength(0);
 }finally{f.dispose();}
});

test('death during any flight phase freezes the final enemy position without snapping, retargeting or damage',()=>{
 for(const age of [.25,.7,1.2]){
  const f=fixture();try{
   const slot=launch(f),pool=f.preview.pool;
   for(let elapsed=0;elapsed+1e-10<age;){const dt=Math.min(1/120,age-elapsed);f.advance(dt);elapsed+=dt;}
   const phase=slot.phase,pose=[slot.x,slot.y,slot.z,slot.dx,slot.dy,slot.dz,slot.vx,slot.vy,slot.vz],flames=f.preview.thrust.instanceCount;
   // Final death pose can be newer than the flight's last sampled target.
   f.target.x+=2;f.target.aimY+=1;f.target.z-=3;f.pose();f.target.health.takeDamage(3000);f.advance(0);
   const aim=[slot.aimX,slot.aimY,slot.aimZ];expect(aim).toEqual([f.target.x,f.target.aimY,f.target.z]);expect(slot.orphaned).toBe(true);expect(slot.target).toBeNull();expect(slot.phase).toBe(phase);expect(pool.orphaned).toBe(1);expect(pool.lostTargets).toBe(0);
   expect([slot.x,slot.y,slot.z,slot.dx,slot.dy,slot.dz,slot.vx,slot.vy,slot.vz]).toEqual(pose);expect(f.preview.thrust.instanceCount).toBe(flames);
   // A reset/moved old object, changed lap, removal and another living target
   // cannot affect the retained point or create damage to the replacement.
   f.target.health.reset();f.target.x=1000;f.target.aimY=500;f.target.z=1000;f.target.velocityX=f.target.velocityZ=1000;f.target.lap++;f.targets.length=0;
   const other={id:'replacement',x:84,z:36,aimY:34.5,lap:0,health:new Health(3000)};f.targets.push(other);
   for(let frame=0;frame<960&&slot.phase>=PHASE.BOOST;frame++){
    f.advance(1/120);if(slot.phase>=PHASE.BOOST){expect(slot.target).toBeNull();expect([slot.aimX,slot.aimY,slot.aimZ]).toEqual(aim);}
   }
   expect(slot.phase).toBe(PHASE.FREE);expect(pool.completedAtLastPosition).toBe(1);expect(pool.expired).toBe(0);expect(pool.collisions).toBe(1);expect(pool.orphaned).toBe(1);expect(f.hits).toHaveLength(0);expect(f.state.hits).toBe(0);expect(other.health.current).toBe(3000);expect(f.target.health.current).toBe(3000);expect(f.preview.thrust.instanceCount).toBe(0);
   expect(f.impacts).toHaveLength(1);expect(f.impacts[0][1]).toBe(24);expect(f.impacts[0].slice(3)).toEqual([0,1,0]);
   f.preview.resetTargets();expect(pool.orphaned).toBe(0);expect(pool.completedAtLastPosition).toBe(0);expect(pool.slots.every(s=>!s.orphaned&&s.target===null)).toBe(true);
  }finally{f.dispose();}
 }
});

test('frozen-position flights retain fallback coordinates and pass swept arrival before scenery or lifetime limits',()=>{
 for(const outcome of ['arrival','scenery','lifetime']){
  const f=fixture();try{
   const slot=launch(f),pool=f.preview.pool,aim=[slot.aimX,slot.aimY,slot.aimZ];f.target.health.takeDamage(3000);f.target.x=NaN;f.advance(0);
   expect(slot.orphaned).toBe(true);expect([slot.aimX,slot.aimY,slot.aimZ]).toEqual(aim);
   if(outcome==='arrival'){
    // In one step the nose crosses the whole two-unit arrival sphere; neither
    // endpoint is inside. Contact must be swept, never a sampled distance test.
    slot.phase=PHASE.HOMING;slot.age=1;slot.dx=1;slot.dy=slot.dz=0;slot.x=slot.aimX-8;slot.y=slot.aimY;slot.z=slot.aimZ;slot.vx=600;slot.vy=slot.vz=0;f.advance(1/120);
    expect(slot.phase).toBe(PHASE.HOMING);expect(slot.passedAim).toBe(true);expect(pool.completedAtLastPosition).toBe(1);expect(f.impacts).toHaveLength(0);expect(slot.engineCutoff).toBe(true);expect(f.preview.thrust.instanceCount).toBe(0);
    const direction=[slot.dx,slot.dy,slot.dz];f.advance(.02);expect([slot.dx,slot.dy,slot.dz]).toEqual(direction);expect(pool.completedAtLastPosition).toBe(1);f.preview.resetTargets();
   }else if(outcome==='scenery'){
    pool.visibility={nodeCount:1,bounds:new Float32Array([0,slot.y+8,0,192,slot.y+8.05,192]),escape:new Uint32Array([1])};f.advance(.3);
    expect(slot.phase).toBe(PHASE.FREE);expect(pool.collisions).toBe(1);expect(pool.completedAtLastPosition).toBe(0);
   }else{
    slot.aimX=10000;slot.phase=PHASE.HOMING;slot.age=FLIGHT.maxAge-.01;f.advance(.02);
    expect(slot.phase).toBe(PHASE.FREE);expect(pool.expired).toBe(1);expect(pool.completedAtLastPosition).toBe(0);
   }
   expect(f.hits).toHaveLength(0);expect(slot.target).toBeNull();expect(f.preview.thrust.instanceCount).toBe(0);
  }finally{f.dispose();}
 }
});

test('homing maintains full cruise speed through close live-target and frozen-point arrivals',()=>{
 for(const orphaned of [false,true]){
  const f=fixture();try{
   const slot=launch(f),pool=f.preview.pool;if(orphaned){f.target.health.takeDamage(3000);f.advance(0);}
   slot.phase=PHASE.HOMING;slot.age=1;slot.x=slot.aimX;slot.y=slot.aimY;slot.z=slot.aimZ+20;slot.dx=slot.dy=0;slot.dz=-1;slot.vx=slot.vy=0;slot.vz=-FLIGHT.cruiseSpeed;
   for(let frame=0;frame<120&&slot.phase>=PHASE.BOOST;frame++){
    f.advance(1/120);expect(Math.hypot(slot.vx,slot.vy,slot.vz)).toBeCloseTo(FLIGHT.cruiseSpeed,10);
   }
   expect(slot.phase).toBe(PHASE.FREE);expect(pool.completedAtLastPosition).toBe(orphaned?1:0);expect(f.hits).toHaveLength(orphaned?0:1);expect(pool.expired).toBe(0);
  }finally{f.dispose();}
 }
});

test('terminal cutoff latches at the nose threshold and preserves velocity and attitude through a later death',()=>{
 const f=fixture();try{
  const slot=launch(f),pool=f.preview.pool;
  f.target.aimY=100;f.pose();pool.advance(0);slot.phase=PHASE.HOMING;slot.committed=true;slot.aimX=slot.x=84;slot.aimY=slot.y=100;slot.aimZ=36;
  slot.z=slot.aimZ+5+FLIGHT.terminalCutoffRadius+.5;slot.dx=slot.dy=slot.vx=slot.vy=0;slot.dz=-1;slot.vz=-FLIGHT.cruiseSpeed;slot.aimDX=slot.aimDY=0;slot.aimDZ=-1;
  pool.prepare();expect(slot.engineCutoff).toBe(false);expect(pool.thrust.lightCount).toBe(1);expect(pool.thrust.instanceCount).toBe(2);
  f.advance(1/120);expect(slot.engineCutoff).toBe(true);expect(pool.thrust.lightCount).toBe(0);expect(pool.thrust.instanceCount).toBe(0);
  const pose=[slot.x,slot.y,slot.z],velocity=[slot.vx,slot.vy,slot.vz],direction=[slot.dx,slot.dy,slot.dz];
  // The final death point is deliberately elsewhere. It changes accounting,
  // never a terminal trajectory or the latched engine state.
  f.target.x=20;f.target.z=20;f.target.aimY=80;f.target.health.takeDamage(3000);f.advance(0);
  expect([slot.aimX,slot.aimY,slot.aimZ]).toEqual([20,80,20]);expect(slot.orphaned).toBe(true);expect(slot.target).toBeNull();expect([slot.x,slot.y,slot.z]).toEqual(pose);
  f.target.health.reset();f.target.x=160;f.target.z=160;f.target.aimY=150;
  for(let i=1;i<=5;i++){
   f.advance(.05);expect(slot.engineCutoff).toBe(true);expect([slot.vx,slot.vy,slot.vz]).toEqual(velocity);expect([slot.dx,slot.dy,slot.dz]).toEqual(direction);expect([slot.aimX,slot.aimY,slot.aimZ]).toEqual([20,80,20]);
   expect(slot.x).toBeCloseTo(pose[0]+velocity[0]*i*.05,8);expect(slot.y).toBeCloseTo(pose[1]+velocity[1]*i*.05,8);expect(slot.z).toBeCloseTo(pose[2]+velocity[2]*i*.05,8);expect(pool.thrust.instanceCount).toBe(0);expect(pool.thrust.lightCount).toBe(0);
  }
  expect(f.hits).toHaveLength(0);expect(f.impacts).toHaveLength(0);
  f.preview.resetTargets();expect(pool.slots.every(s=>!s.engineCutoff)).toBe(true);
  // Reuse the same physical slot as a fresh loaded round and launch it again.
  pool.release(slot);const index=pool.slots.indexOf(slot);pool.seat(index,f.state,84,31,84,f.state.root);
  expect(pool.launch(index,f.target,60)).toBe(true);pool.prepare();expect(slot.engineCutoff).toBe(false);expect(slot.phase).toBe(PHASE.BOOST);expect(pool.thrust.instanceCount).toBe(2);expect(pool.thrust.lightCount).toBe(1);
 }finally{f.dispose();}
});

test('swept scenery collision blocks travel, and uneven frames or stalls cannot tunnel or replay damage',()=>{
 const f=fixture();try{
  const slot=launch(f),y=slot.y;
  // One thin overhead slab: even a .35s vertical boost sweep must encounter it.
  const prior=f.preview.pool.visibility;f.preview.pool.visibility={nodeCount:1,bounds:new Float32Array([0,y+8,0,192,y+8.05,192]),escape:new Uint32Array([1])};
  f.advance(.35);expect(slot.phase).toBe(PHASE.FREE);expect(f.preview.pool.collisions).toBe(1);expect(f.hits).toHaveLength(0);f.preview.pool.visibility=prior;
  f.preview.resetTargets();f.state.cycle.readyAt=0;f.advance(0);f.state.cycle.readyAt=Infinity;const again=f.preview.pool.slots.find(s=>s.phase===PHASE.BOOST);
  for(const dt of [.073,.107,.001,.019,.3])f.advance(dt);expect(again.phase).toBe(PHASE.COAST);expect(Number.isFinite(again.y)).toBe(true);
  const shots=f.state.cycle.shots,time=f.preview.pool.time;f.advance(100);expect(f.preview.pool.time).toBe(time+100);expect(f.state.cycle.time).toBe(time+100);expect(again.phase).toBe(PHASE.FREE);expect(f.preview.pool.stallDiscards).toBe(1);expect(f.state.cycle.shots).toBe(shots);expect(f.hits).toHaveLength(0);
 }finally{f.dispose();}
});

test('surface events choose the earliest static face regardless of BVH leaf order',()=>{
 const f=fixture();try{
  const slot=launch(f),pool=f.preview.pool,y=slot.y;
  // Far leaf first: choosing traversal order would put the flash on the wrong slab.
  pool.visibility={nodeCount:3,bounds:new Float32Array([0,y+8,0,192,y+16.05,192,0,y+16,0,192,y+16.05,192,0,y+8,0,192,y+8.05,192]),escape:new Uint32Array([3,2,3])};
  f.advance(.3);expect(slot.phase).toBe(PHASE.FREE);expect(pool.collisions).toBe(1);expect(f.impacts).toHaveLength(1);expect(f.hits).toHaveLength(0);
  expect(f.impacts[0]).toEqual([slot.x,y+8,slot.z,0,-1,0]);
  // The actor centre was stopped by the conservative radius, but the effect
  // belongs to the actual slab surface, not that elevated collision centre.
  expect(Math.abs(f.impacts[0][1]-slot.y)).toBeGreaterThan(5);
  f.advance(.5);expect(f.impacts).toHaveLength(1);
 }finally{f.dispose();}
});

test('animated quad contacts report world surface coordinates and outward rotated normals',()=>{
 const f=fixture();try{
  const pool=f.preview.pool,matrix=new Float32Array([0,0,-1,0,0,1,0,0,1,0,0,0,10,20,30,1]);
  const record={bounds:new Float64Array([10,20,28,10,22,30]),dx:4,dy:0,dz:0,parts:[{matrix,bounds:new Float64Array([0,0,0,2,2,0]),quads:[{axis:2,sign:1,origin:[0,0,0],width:2,height:2}]}]};
  expect(pool.contact(record,12,21,29,4,21,29,0,1)).toBeCloseTo(.5,10);
  expect([pool.contactX,pool.contactY,pool.contactZ]).toEqual([8,21,29]);expect([pool.contactNX,pool.contactNY,pool.contactNZ]).toEqual([1,0,0]);
  expect(f.impacts).toHaveLength(0);expect(f.launches).toHaveLength(0);
 }finally{f.dispose();}
});

test('missile effects are absent on stalls, reset, invalidation, expiry and off-map release',()=>{
 for(const reason of ['stall','reset','invalid','expiry','off-map','dispose']){
  const f=fixture();try{
   const slot=launch(f),pool=f.preview.pool;expect(f.launches).toHaveLength(1);
   if(reason==='stall')f.advance(2);
   else if(reason==='reset')f.preview.resetTargets();
   else if(reason==='invalid'){f.targets.length=0;f.advance(.1);}
   else if(reason==='dispose')f.preview.dispose();
   else{
    slot.phase=PHASE.HOMING;slot.committed=slot.passedAim=true;slot.target=null;slot.dx=1;slot.dy=slot.dz=0;slot.vx=FLIGHT.cruiseSpeed;slot.vy=slot.vz=0;slot.y=150;
    if(reason==='expiry'){slot.age=FLIGHT.maxAge-.01;f.advance(.02);expect(pool.expired).toBe(1);}
    else{slot.x=f.world.width-.1;f.advance(1/120);expect(pool.offMap).toBe(1);}
   }
   expect(slot.phase).toBeLessThan(PHASE.BOOST);expect(f.impacts).toHaveLength(0);expect(f.hits).toHaveLength(0);expect(f.launches).toHaveLength(1);
   if(reason==='dispose'){expect(pool.onLaunch).toBeNull();expect(pool.onImpact).toBeNull();}
   else{f.preview.resetTargets();expect(pool.offMap).toBe(0);expect(f.impacts).toHaveLength(0);expect(f.launches).toHaveLength(1);}
  }finally{f.dispose();}
 }
});

test('unreachable moving targets receive a bounded prediction and retire without damage',()=>{
 const f=fixture();try{
  const slot=launch(f);f.target.velocityZ=-FLIGHT.cruiseSpeed*1.25;
  for(let frame=0;frame<1000&&slot.phase>=PHASE.BOOST;frame++){f.target.z+=f.target.velocityZ/120;f.advance(1/120);}
  expect(slot.phase).toBe(PHASE.FREE);expect(f.preview.pool.collisions+f.preview.pool.expired+f.preview.pool.offMap).toBe(1);expect(f.preview.pool.time).toBeLessThanOrEqual(FLIGHT.maxAge+1/120);expect(f.hits).toHaveLength(0);expect(slot.target).toBeNull();expect(f.impacts).toHaveLength(f.preview.pool.collisions);
 }finally{f.dispose();}
});

test('pool exhaustion defers a complete refill and reset releases every flight while keeping clocks',()=>{
 const f=fixture('upgrade2');try{
  const slot=launch(f),pool=f.preview.pool;f.advance(.107);const time=pool.time,queue=f.state.slots;
  f.preview.resetTargets();expect(pool.time).toBe(time);expect(f.state.cycle.time).toBe(time);expect(slot.target).toBeNull();expect(f.state.ammo).toBe(6);expect(f.state.slots).toBe(queue);expect(f.visible.size).toBe(6);expect(pool.thrust.instanceCount).toBe(0);
  pool.reset();f.state.slots.fill(-1);f.state.ammo=0;f.state.reloading=true;
  for(let i=0;i<32;i++)pool.slots[i].phase=PHASE.LOADED;
  expect(f.preview.refill(f.state)).toBe(false);expect(f.state.ammo).toBe(0);expect(f.state.slots.every(i=>i===-1)).toBe(true);expect(f.state.poolDeferrals).toBe(1);
  for(const s of pool.slots)pool.release(s);expect(f.preview.refill(f.state)).toBe(true);expect(f.state.ammo).toBe(6);
  const thrust=pool.thrust;f.preview.dispose();expect(pool.targets).toBeNull();expect(pool.visibility).toBeNull();expect(pool.records.size).toBe(0);expect(pool.recordList).toHaveLength(0);expect(pool.slots).toHaveLength(0);expect(thrust.instanceCount).toBe(0);expect(f.visible.size).toBe(0);
 }finally{f.dispose();}
});


test('three same-frame 75-damage launches cover225HP exactly across silos and hold the fourth',()=>{
 const f=fixture('upgrade1',0,4);try{
  const pool=f.preview.pool,states=f.preview.states;f.target.health=new Health(225);
  expect(f.preview.incomingDamage(f.target)).toBe(0);expect(states.every(s=>f.preview.eligible(s,f.target))).toBe(true);
  const claims=[];const launchCallback=pool.onLaunch;pool.onLaunch=(x,y,z)=>{claims.push(pool.incomingDamage(f.target));launchCallback(x,y,z);};
  f.advance(0);expect(claims).toEqual([75,150,225]);expect(states.map(s=>s.cycle.shots)).toEqual([1,1,1,0]);expect(states.map(s=>s.ammo)).toEqual([3,3,3,4]);
  expect(pool.incomingDamage(f.target)).toBe(225);expect(f.target.health.current).toBe(225);expect(states.every(s=>!f.preview.eligible(s,f.target))).toBe(true);
  const deadlines=states.map(s=>s.cycle.readyAt);f.advance(MISSILE_FIRING.upgrade1.gap);
  expect(states.map(s=>s.cycle.readyAt)).toEqual(deadlines);expect(states.map(s=>s.cycle.shots)).toEqual([1,1,1,0]);expect(states.map(s=>s.ammo)).toEqual([3,3,3,4]);expect(states.every(s=>!s.reloading)).toBe(true);
  // One uncovered HP is enough for one real round; the125% forecast margin
  // never applies to ammunition already in flight.
  f.target.health.current=226;f.advance(0);expect(states.map(s=>s.cycle.shots)).toEqual([2,1,1,0]);expect(pool.incomingDamage(f.target)).toBe(300);expect(f.launches).toHaveLength(4);
 }finally{f.dispose();}
});

test('a silo credits its own captured round and resumes a held partial magazine only when that claim ends',()=>{
 const f=fixture('upgrade1');try{
  const pool=f.preview.pool,state=f.state,gap=state.rule.gap;f.target.health=new Health(75);f.advance(0);
  const slot=pool.slots.find(s=>s.phase===PHASE.BOOST),strength=state.strength;state.strength=900;
  expect(pool.incomingDamage(f.target)).toBe(75);state.strength=strength;
  f.advance(gap);expect(state.ammo).toBe(3);expect(state.cycle.shots).toBe(1);expect(state.cycle.ready).toBe(true);expect(state.cycle.readyAt).toBe(gap);expect(state.reloading).toBe(false);
  slot.passedAim=true;expect(pool.incomingDamage(f.target)).toBe(0);expect(f.preview.eligible(state,f.target)).toBe(true);
  f.advance(0);expect(state.ammo).toBe(2);expect(state.cycle.shots).toBe(2);expect(state.cycle.readyAt).toBe(2*gap);expect(pool.incomingDamage(f.target)).toBe(75);
  f.preview.resetTargets();expect(pool.incomingDamage(f.target)).toBe(0);expect(state.ammo).toBe(4);expect(state.cycle.readyAt).toBe(2*gap);
 }finally{f.dispose();}
});

test('flight claims validate exact live identity and lap before simulation and ignore loaded or failed launches',()=>{
 for(const cause of ['death','lap','remove','replacement','invalid-root','invalid-aim','orphan','passed','expiry','stall','reset']){
  const f=fixture();try{
   const pool=f.preview.pool;expect(pool.incomingDamage(f.target)).toBe(0);
   expect(pool.launch(pool.freeSlot(),f.target,999)).toBe(false);expect(pool.incomingDamage(f.target)).toBe(0);
   const slot=launch(f);expect(pool.incomingDamage(f.target)).toBe(60);
   if(cause==='death')f.target.health.takeDamage(3000);
   else if(cause==='lap')f.target.lap++;
   else if(cause==='remove')f.targets.length=0;
   else if(cause==='replacement'){const replacement={...f.target,health:new Health(3000)};f.targets[0]=replacement;expect(pool.incomingDamage(replacement)).toBe(0);}
   else if(cause==='invalid-root')f.target.x=NaN;
   else if(cause==='invalid-aim')f.target.aimX=NaN;
   else if(cause==='orphan')slot.orphaned=true;
   else if(cause==='passed')slot.passedAim=true;
   else if(cause==='expiry')slot.age=FLIGHT.maxAge;
   else if(cause==='stall')f.advance(2);
   else f.preview.resetTargets();
   // Invalidation above is deliberately queried before advance can clean up.
   expect(pool.incomingDamage(f.target)).toBe(0);
   if(cause==='expiry'){slot.phase=PHASE.HOMING;f.advance(.01);expect(slot.phase).toBe(PHASE.FREE);expect(pool.expired).toBe(1);}
   f.preview.dispose();expect(pool.incomingDamage(f.target)).toBe(0);expect(f.preview.incomingDamage(f.target)).toBe(0);
  }finally{f.dispose();}
 }
});

test('an arriving round releases its claim before visibility, impact and damage callbacks without dropping other flights',()=>{
 const f=fixture();try{
  const pool=f.preview.pool,slot=launch(f);const second=pool.slots[f.state.slots.find(i=>i>=0)];
  expect(pool.launch(pool.slots.indexOf(second),f.target,60)).toBe(true);second.x=150;second.y=150;second.z=150;
  expect(pool.incomingDamage(f.target)).toBe(120);
  const visibility=pool.onVisible,impact=pool.onImpact,damage=pool.onHit,events=[];
  pool.onVisible=(id,value)=>{if(id===slot.id&&!value){events.push('hidden');expect(slot.phase).toBe(PHASE.FREE);expect(slot.target).toBeNull();expect(pool.incomingDamage(f.target)).toBe(60);}visibility(id,value);};
  pool.onImpact=(...args)=>{events.push('impact');expect(pool.incomingDamage(f.target)).toBe(60);impact(...args);};
  pool.onHit=(target,...args)=>{events.push('damage');expect(pool.incomingDamage(target)).toBe(60);const applied=damage(target,...args);expect(pool.incomingDamage(target)).toBe(60);return applied;};
  slot.phase=PHASE.HOMING;slot.age=1;slot.x=f.target.x;slot.y=f.target.aimY;slot.z=f.target.z+15;slot.dx=slot.dy=slot.vx=slot.vy=0;slot.dz=-1;slot.vz=-FLIGHT.cruiseSpeed;
  for(let i=0;i<60&&!f.hits.length;i++)f.advance(1/120);
expect(events).toEqual(['hidden','impact','damage']);expect(f.hits).toHaveLength(1);expect(f.target.health.current).toBe(2940);expect(pool.incomingDamage(f.target)).toBe(60);
 }finally{f.dispose();}
});

test('static contact drops its incoming claim before the impact callback',()=>{
 const f=fixture();try{
  const slot=launch(f),pool=f.preview.pool,y=slot.y,impact=pool.onImpact;
  pool.onImpact=(...args)=>{expect(slot.phase).toBe(PHASE.FREE);expect(pool.incomingDamage(f.target)).toBe(0);impact(...args);};
  pool.visibility={nodeCount:1,bounds:new Float32Array([0,y+8,0,192,y+8.05,192]),escape:new Uint32Array([1])};
  f.advance(.3);expect(pool.collisions).toBe(1);expect(pool.incomingDamage(f.target)).toBe(0);expect(f.impacts).toHaveLength(1);expect(f.hits).toHaveLength(0);
 }finally{f.dispose();}
});

test('unknown health cannot falsely mark a missile target as lethally covered',()=>{
 for(const current of [undefined,NaN,Infinity,-1]){
  const f=fixture();try{
   f.target.health={alive:true,current};expect(f.preview.eligible(f.state,f.target)).toBe(true);
   launch(f);expect(f.preview.incomingDamage(f.target)).toBe(60);expect(f.preview.eligible(f.state,f.target)).toBe(true);
  }finally{f.dispose();}
 }
});



test('launch admission waits for a clear full flight, preserves ammo and readiness, and rechecks a changed target',()=>{
 const f=fixture();try{
  const pool=f.preview.pool,original=pool.visibility,ammo=f.state.ammo,ready=f.state.cycle.readyAt;
  const wall=height=>({nodeCount:1,bounds:new Float32Array([0,24,58,192,height,61]),escape:new Uint32Array([1])});
  pool.visibility=wall(150);
  expect(f.preview.eligible(f.state,f.target)).toBe(false);f.advance(0);
  expect(f.state.ammo).toBe(ammo);expect(f.state.cycle.readyAt).toBe(ready);expect(f.launches).toHaveLength(0);expect(pool.collisions).toBe(0);
  // A low obstruction blocks a ground ray but the real lofted flight clears it.
  pool.visibility=wall(40);pool.time+=.01;expect(f.preview.eligible(f.state,f.target)).toBe(true);
  const checks=pool.clearanceChecks;expect(f.preview.eligible(f.state,f.target)).toBe(true);expect(pool.clearanceChecks).toBe(checks);
  f.target.z+=1;f.preview.eligible(f.state,f.target);expect(pool.clearanceChecks).toBe(checks+1);
  pool.visibility=original;pool.time+=.01;const slot=launch(f);
  for(let i=0;i<600&&slot.phase>=PHASE.BOOST;i++)f.advance(1/120);
  expect(f.hits).toHaveLength(1);expect(pool.collisions).toBe(0);
 }finally{f.dispose();}
});

test('flight smoke follows the real powered attack tail at fixed cadence and stops on terminal cutoff',()=>{
 const counts=[];
 for(const hz of [30,60,120]){
  const f=fixture();try{
   const puffs=[];f.preview.pool.onTrail=(...point)=>puffs.push(point);const slot=launch(f);
   f.advance(.5);f.advance(.4);expect(puffs).toHaveLength(0);
   for(let i=0;i<4*hz&&!slot.engineCutoff&&slot.phase>=PHASE.BOOST;i++)f.advance(1/hz);
   expect(puffs.length).toBeGreaterThan(5);expect(puffs.every(p=>p.every(Number.isFinite))).toBe(true);
   for(let i=1;i<puffs.length;i++)expect(Math.hypot(...puffs[i].slice(0,3).map((v,j)=>v-puffs[i-1][j]))).toBeLessThan(FLIGHT.cruiseSpeed/MISSILE_TRAIL_SMOKE.rate+1);
   const before=puffs.length;f.advance(.1);expect(puffs).toHaveLength(before);counts.push(before);
   f.preview.resetTargets();expect(slot.trailCarry).toBe(0);
  }finally{f.dispose();}
 }
 expect(counts[1]).toBe(counts[0]);expect(counts[2]).toBe(counts[0]);
});

test('each seated missile varies its turn rate and steering jets pulse as opposite white torque couples while accelerating and braking',()=>{
 const f=fixture();try{
  const loaded=f.preview.pool.slots.filter(s=>s.phase===PHASE.LOADED);expect(loaded[0].turnFactor).not.toBe(loaded[1].turnFactor);for(const s of loaded){expect(s.turnFactor).toBeGreaterThanOrEqual(.85);expect(s.turnFactor).toBeLessThanOrEqual(1.15);}
  const slot=launch(f);let accelerate=false,brake=false,pulse=false;
  for(let n=0;n<240&&slot.phase>=PHASE.BOOST;n++){
   f.advance(1/120);accelerate||=slot.steeringTorque>.3;brake||=slot.steeringTorque<-.3;
   const a=f.preview.thrust.instanceData,count=f.preview.thrust.instanceCount;
   for(let i=0;i+1<count;i++){const k=i*16;if(a[k+7]!==5.25||a[k+9]<.9)continue;pulse=true;for(let axis=0;axis<3;axis++)expect(a[k+4+axis]).toBeCloseTo(-a[k+20+axis],5);expect(a[k+8]).toBe(1);expect(a[k+12]).toBe(-1);expect(a[k+10]).toBeCloseTo(.9,5);break;}
  }
  expect(accelerate).toBe(true);expect(brake).toBe(true);expect(pulse).toBe(true);expect(f.preview.thrust.instanceCount).toBeLessThanOrEqual(MAX_MISSILES*4);
 }finally{f.dispose();}
});

test('steering light and jets stop at alignment and pulse together within the fixed 36-light budget',()=>{
 const f=fixture();try{
  const pool=f.preview.pool,s=launch(f),t=pool.thrust;s.phase=PHASE.COAST;s.steerX=1;s.steerY=s.steerZ=0;s.steeringTorque=-15;s.steeringJetSign=-1;s.age=.01;s.steeringJetUntil=.065;pool.time=.01;
  for(const factor of [.85,1,1.15]){
   s.turnFactor=factor;s.steeringAngle=.1;pool.prepare();expect(t.instanceCount).toBe(2);expect(t.instanceData[7]).toBe(5.25);expect(t.lightCount).toBe(1);expect(t.lightData[7]).toBe(16);expect(t.lightData[11]).toBeCloseTo(2.2,6);
   s.steeringAngle=0;pool.prepare();expect(t.instanceCount).toBe(0);expect(t.lightCount).toBe(0);
   s.steeringAngle=.1;s.age=.07;pool.time=.06;pool.prepare();expect(t.instanceCount).toBe(0);expect(t.lightCount).toBe(0);pool.time=.01;s.age=.01;
  }
  s.phase=PHASE.HOMING;s.steeringAngle=0;pool.prepare();const engine=Array.from(t.instanceData.slice(0,32)),warm=Array.from(t.lightData.slice(4,12));
  s.steeringAngle=.1;pool.prepare();expect(t.instanceCount).toBe(4);expect(Array.from(t.instanceData.slice(0,32))).toEqual(engine);expect(t.lightCount).toBe(1);expect(t.lightData[11]).toBeCloseTo(warm[7]+2.2,5);expect(t.lightData[9]).toBeGreaterThan(warm[5]);
  for(const slot of pool.slots){Object.assign(slot,{phase:PHASE.HOMING,steeringAngle:.1,steeringTorque:15,steeringJetSign:1,age:.01,steeringJetUntil:.065,steerX:1,steerY:0,steerZ:0,jetPhase:0});}pool.prepare();expect(t.lightCount).toBe(36);expect(t.instanceCount).toBe(144);expect(Array.from(t.lightData).every(Number.isFinite)).toBe(true);
  pool.reset();pool.prepare();expect(t.lightCount).toBe(0);expect(t.instanceCount).toBe(0);expect(pool.slots.every(slot=>slot.steeringAngle===0)).toBe(true);
 }finally{f.dispose();}
});

test('real slow and fast turns extinguish attitude jets while residual sub-degree steering settles',()=>{
 for(const factor of [.85,1.15]){
  const f=fixture();try{const s=launch(f);s.turnFactor=factor;let turning=false,aligned=false;
   for(let n=0;n<600&&s.phase>=PHASE.BOOST;n++){f.advance(1/120);if(s.phase!==PHASE.COAST&&s.phase!==PHASE.HOMING)continue;if(s.steeringAngle>Math.PI/180)turning=true;
    if(s.steeringAngle<=Math.PI/180){aligned=true;const t=f.preview.thrust;for(let j=0;j<t.instanceCount;j++)expect(t.instanceData[j*16+12]).not.toBe(-1);if(s.phase===PHASE.COAST)expect(t.lightCount).toBe(0);}
   }expect(turning).toBe(true);expect(aligned).toBe(true);
  }finally{f.dispose();}
 }
});

test('eased real turns use only short spin-up and braking impulses without late correction pulse trains',()=>{
 for(const hz of [30,60,120])for(const factor of [.85,1.15]){
  const f=fixture();try{
   const s=launch(f);s.turnFactor=factor;let visible=0,lastJet=0,peak=0,braked=false,firstRate=null;
   for(let n=0;n<6*hz&&s.phase>=PHASE.BOOST;n++){
    f.advance(1/hz);if(s.phase!==PHASE.COAST&&s.phase!==PHASE.HOMING)continue;
    if(s.age>.5&&firstRate===null)firstRate=s.angularSpeed;
    peak=Math.max(peak,s.angularSpeed);braked||=s.steeringTorque< -1;
    const t=f.preview.thrust;let jets=false;for(let i=0;i<t.instanceCount;i++)jets||=t.instanceData[i*16+12]===-1;
    if(jets){visible+=1/hz;lastJet=s.age;expect(s.steeringAngle).toBeGreaterThan(Math.PI/180);}
    if(s.age>1.1)expect(jets).toBe(false);
   }
   expect(firstRate).toBeLessThanOrEqual(16/hz+1e-8);expect(peak).toBeGreaterThan(2);expect(braked).toBe(true);
   expect(visible).toBeGreaterThan(0);expect(visible).toBeLessThanOrEqual(.15);expect(lastJet).toBeLessThan(1.1);
   expect(f.hits).toHaveLength(1);expect(f.preview.pool.collisions).toBe(0);
  }finally{f.dispose();}
 }
});

const arcTower=await Bun.file(new URL('../assets/models/arc-spire.json',import.meta.url)).json();models.set(arcTower.id,arcTower);
test('missiles collide with actual Arc tower geometry in terminal flight at30/60/120Hz',()=>{
 for(const hz of [30,60,120])for(const variant of ['base','upgrade1','upgrade2']){
  const f=fixture('base',0,1,[{id:'blocker',model:'arc-spire',variant,box:[3,0,2],turn:0}]);
  try{
   const pool=f.preview.pool,index=f.state.slots[0],slot=pool.slots[index];expect(pool.launch(index,f.target,75)).toBe(true);f.state.cycle.readyAt=Infinity;
   slot.phase=PHASE.HOMING;slot.engineCutoff=slot.committed=true;slot.x=84;slot.y=44;slot.z=94;slot.dx=slot.dy=slot.vx=slot.vy=0;slot.dz=-1;slot.vz=-180;
   for(let i=0;i<hz&&slot.phase!==PHASE.FREE;i++)f.advance(1/hz);
   expect(pool.collisions).toBe(1);expect(f.impacts).toHaveLength(1);expect(f.hits).toHaveLength(0);expect(slot.phase).toBe(PHASE.FREE);expect(pool.incomingDamage(f.target)).toBe(0);
   const [x,y,z,nx,ny,nz]=f.impacts[0];expect([x,y,z,nx,ny,nz].every(Number.isFinite)).toBe(true);expect(Math.hypot(nx,ny,nz)).toBeCloseTo(1,5);expect(z).toBeGreaterThan(48);expect(z).toBeLessThanOrEqual(72);
  }finally{f.dispose();}
 }
});

test('missile admission sees a live defence blocker and releases the result after deployment removal',()=>{
 const f=fixture('base',0,1,[{id:'blocker',model:'arc-spire',variant:'upgrade2',box:[3,0,2],turn:0}]);
 try{
  const p=f.preview.pool,index=f.state.slots[0],ammo=f.state.ammo;
  expect(p.launchClear(index,f.target)).toBe(false);f.advance(0);expect(f.state.ammo).toBe(ammo);expect(f.state.cycle.shots).toBe(0);
  f.world.visibility.setDefences({...f.world.level,placements:f.world.level.placements.filter(s=>s.id!=='blocker')},models,f.world.rigs);
  expect(p.launchClear(index,f.target)).toBe(true);f.advance(0);expect(f.state.ammo).toBe(ammo-1);
 }finally{f.dispose();}
});

test('a failed missile forecast always releases cached defence poses before later live queries',()=>{
 const f=fixture();try{
  const visibility=f.world.visibility,sweep=visibility.sweepDefences,pool=f.preview.pool,index=f.state.slots[0];
  visibility.sweepDefences=()=>{throw new Error('collision query failure');};
  expect(()=>pool.launchClear(index,f.target)).toThrow('collision query failure');expect(visibility.defenceBatchDepth).toBe(0);
  visibility.sweepDefences=sweep;expect(pool.launchClear(index,f.target)).toBe(true);expect(visibility.defenceBatchDepth).toBe(0);
 }finally{f.dispose();}
});

test('dense particle timestamps retain fixed emission ages without changing native flight',()=>{
 for(const hz of [30,60,120]){
  const f=fixture(),control=fixture(),damage=new DamageEffects(()=>.5),events=[];let now=0;
  try{
   f.preview.pool.onTrail=(x,y,z,lag)=>{events.push({at:now-lag,lag});damage.missileTrail(x,y,z,lag);};
   launch(f);launch(control);
   for(let i=0;i<hz*2;i++){const dt=1/hz;now+=dt;damage.advance(dt);f.advance(dt);control.advance(dt);}
   expect(events.length).toBeGreaterThan(10);
   for(let i=1;i<events.length;i++){expect(events[i].at-events[i-1].at).toBeCloseTo(1/MISSILE_TRAIL_SMOKE.rate,8);expect(events[i].lag).toBeGreaterThanOrEqual(0);expect(events[i].lag).toBeLessThanOrEqual(1/hz+1e-9);}
   expect(events[0].at).toBeCloseTo(FLIGHT.boostSeconds+FLIGHT.coastSeconds+1/MISSILE_TRAIL_SMOKE.rate,8);
   expect(f.hits).toEqual(control.hits.map(hit=>({...hit,enemy:f.target})));expect(f.impacts).toEqual(control.impacts);
   expect(f.preview.pool.random()).toBe(control.preview.pool.random());
   const oldest=damage.smoke.filter(p=>p.active&&p.trail).reduce((age,p)=>Math.max(age,p.age),0);expect(oldest).toBeCloseTo(now-events[0].at,7);
  }finally{f.dispose();control.dispose();}
 }
});
