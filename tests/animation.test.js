import {test,expect} from 'bun:test';
import {TURRET_FIRING,TURRET_RECOIL,TURRET_TURN,TURRET_MUZZLES} from '../shared/arsenal.js';
import {WeaponCycle,RecoilTrack} from '../engine/weapon.js';
import {PoseRig} from '../engine/rig.js';
import {YawTurn} from '../engine/turn.js';
import {TurretPreview} from '../game/turret-preview.js';
import {identity,multiply,pivotMatrix,translation,placementMatrix} from '../shared/math.js';
import {turretModel} from '../scripts/turret.js';
import {sceneryModels,firstLevel} from '../scripts/first-level.js';
import {buildWorld} from '../engine/world.js';

function rigData(parts,root=identity()){return {root,parts,instances:parts.map((p,index)=>({part:p.id,key:p.id,index,matrix:new Float32Array(root)}))};}
const part=(id,parent=null,pivot=[0,0,0])=>({id,parent,pivot});
test('base fires once, rejects firing during its full one-second cooldown, then becomes ready',()=>{
 const events=[],weapon=new WeaponCycle(TURRET_FIRING.base,at=>events.push(at));
 expect(weapon.trigger()).toBe(true);expect(events).toEqual([0]);expect(weapon.trigger()).toBe(false);weapon.advance(.999);expect(weapon.trigger()).toBe(false);weapon.advance(.001);expect(weapon.trigger()).toBe(true);expect(events).toEqual([0,1]);
 expect(TURRET_FIRING.base.projectile).toBeNull();expect(TURRET_FIRING.upgrade2).toBeNull();
});
test('three-shot burst keeps shot times across frame rates and starts cooldown after its final shot',()=>{
 for(const step of [1/30,1/60,1/144,.3]){
  const events=[],w=new WeaponCycle(TURRET_FIRING.upgrade1,at=>events.push(at));w.trigger();while(w.time<1.2)w.advance(Math.min(step,1.2-w.time));
  expect(events.length).toBe(3);for(let i=0;i<3;i++)expect(events[i]).toBeCloseTo(i*.12,10);expect(w.readyAt).toBe(1.24);expect(w.trigger()).toBe(false);w.advance(.041);expect(w.trigger()).toBe(true);
 }
 const events=[],w=new WeaponCycle(TURRET_FIRING.upgrade1,at=>events.push(at));w.trigger();w.advance(100);expect(events).toEqual([0,.12,.24]);expect(w.ready).toBe(true);expect(w.shots).toBe(3);
});
test('invalid weapon rules and deltas fail instead of creating unbounded bursts',()=>{
 for(const rule of [null,{...TURRET_FIRING.base,shotsPerBurst:Infinity},{...TURRET_FIRING.base,shotsPerBurst:33},{...TURRET_FIRING.upgrade1,shotIntervalSeconds:0},{...TURRET_FIRING.base,cooldownSeconds:-1}])expect(()=>new WeaponCycle(rule)).toThrow();
 const w=new WeaponCycle(TURRET_FIRING.base);for(const delta of [-1,NaN,Infinity])expect(()=>w.advance(delta)).toThrow();
});
test('recoil is bounded, continuous on repeated shots and settles exactly at rest',()=>{
 const r=new RecoilTrack(TURRET_RECOIL);expect(r.sample(0)).toBe(0);r.fire(0);expect(r.sample(.045)).toBe(1.25);const previous=r.sample(.12);r.fire(.12);expect(r.sample(.12)).toBeCloseTo(previous,10);
 for(let i=0;i<100;i++){const value=r.sample(.12+i*.005);expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(1.25);}
 expect(r.sample(1)).toBe(0);
 for(const step of [1/30,1/144,.2]){const track=new RecoilTrack(TURRET_RECOIL),w=new WeaponCycle(TURRET_FIRING.upgrade1,at=>track.fire(at));w.trigger();while(w.time<.31)w.advance(Math.min(step,.31-w.time));expect(track.sample(w.time)).toBeCloseTo(1.25*(1-((.31-.24-.045)/.24)**2*(3-2*(.31-.24-.045)/.24)),10);}
});
test('rig translations follow local yaw and parent transforms while reusing instance matrices',()=>{
 // Deliberately shuffled hierarchy; constructor resolves parents before children.
 const parts=[part('barrel','head',[2,3,4]),part('base'),part('head','base',[12,14,12]),part('decoration','base')],root=placementMatrix([2,0,3],1);root[13]=24;
 const data=rigData(parts,root),changed=[],rig=new PoseRig(data,(key,index,matrix)=>changed.push({key,index,matrix})),references=data.instances.map(i=>i.matrix);
 rig.setRotation('head',.1,.6,-.2);rig.setTranslation('head',0,0,1.25);rig.setTranslation('barrel',0,0,.5);expect(rig.update()).toBe(2);
 const head=pivotMatrix([12,14,12],[.1,.6,-.2].map(v=>v*180/Math.PI)),headPose=new Float32Array(16),worldHead=new Float32Array(16),barrelPose=new Float32Array(16),worldBarrel=new Float32Array(16);
 multiply(headPose,head,translation(0,0,1.25));multiply(worldHead,root,headPose);multiply(barrelPose,headPose,translation(0,0,.5));multiply(worldBarrel,root,barrelPose);
 for(const [id,expected]of [['head',worldHead],['barrel',worldBarrel]]){const actual=rig.byId.get(id).instance.matrix;for(let i=0;i<16;i++)expect(actual[i]).toBeCloseTo(expected[i],4);}
 expect(changed.map(c=>c.key)).toEqual(['head','barrel']);expect(Array.from(rig.byId.get('base').instance.matrix)).toEqual(Array.from(root));expect(rig.update()).toBe(0);
 rig.setTranslation('head',0,0,1.25);expect(rig.update()).toBe(0);rig.setTranslation('head',0,0,0);expect(rig.update()).toBe(2);
 for(let i=0;i<references.length;i++)expect(data.instances[i].matrix).toBe(references[i]);root[12]+=3;rig.invalidateRoot();expect(rig.update()).toBe(4);
});
test('random preview uses two base turrets and a central burst upgrade, updates heads/guns only and never rebuilds geometry',async()=>{
 const models=new Map(sceneryModels().map(m=>[m.id,m]));models.set('turret-study',turretModel());models.set('power-generator',await Bun.file(new URL('../assets/models/power-generator.json',import.meta.url)).json());const world=buildWorld(firstLevel(),models),uploads=[];
 let n=0;const random=()=>(++n%4)/4,preview=new TurretPreview(world,(key,index,matrix)=>uploads.push({key,index,matrix}),random);
 expect(preview.states.length).toBe(3);expect(preview.states.map(s=>s.variant)).toEqual(['base','upgrade1','base']);expect(new Set(preview.states.map(s=>s.nextAimAt)).size).toBe(3);
 const buffers=world.entries.map(e=>e.mesh.vertices),matrices=preview.states.map(s=>s.rig.byId.get('head').instance.matrix),lastShots=[0,0,0],lastTimes=[-Infinity,-Infinity,-Infinity];let idle=0,active=0;
 for(let frame=0;frame<1200;frame++){
  preview.advance(1/60);if(preview.updatedParts)active++;else idle++;
  for(let i=0;i<3;i++){
   const s=preview.states[i];if(s.cycle.shots!==lastShots[i]){
    const gap=s.cycle.lastShotAt-lastTimes[i],inBurst=(s.cycle.shots-1)%s.cycle.rule.shotsPerBurst!==0;
    if(inBurst)expect(gap).toBeCloseTo(.12,10);else expect(gap).toBeGreaterThanOrEqual(1);
    lastTimes[i]=s.cycle.lastShotAt;lastShots[i]=s.cycle.shots;
   }
   expect(s.displacement).toBeGreaterThanOrEqual(0);expect(s.displacement).toBeLessThanOrEqual(1.25);
  }
 }
 expect(active).toBeGreaterThan(0);expect(idle).toBeGreaterThan(0);expect(lastShots.every(n=>n>3)).toBe(true);expect(uploads.every(u=>/^turret-study:(base|upgrade1):(head|guns)$/.test(u.key))).toBe(true);expect(new Set(uploads.map(u=>u.key+':'+u.index)).size).toBe(6);
 for(let i=0;i<world.entries.length;i++)expect(world.entries[i].mesh.vertices).toBe(buffers[i]);for(let i=0;i<3;i++)expect(preview.states[i].rig.byId.get('head').instance.matrix).toBe(matrices[i]);
 const before=preview.shots;preview.advance(500);expect(preview.shots-before).toBeLessThanOrEqual(5);expect(preview.states.every(s=>s.displacement===0)).toBe(true);
});
test('yawing shell stays above the fixed pedestal at every turret variant height',()=>{
 const model=turretModel();for(const variant of Object.values(model.variants)){
  const base=variant.parts.find(p=>p.id==='base'),head=variant.parts.find(p=>p.id==='head'),fixedTop=Math.max(...base.voxels.map(v=>v[1]+1)),headBottom=Math.min(...head.voxels.map(v=>v[1]));
  expect(headBottom).toBeGreaterThanOrEqual(fixedTop); // Head yaw never changes Y; Artist tests pitched-gun clearance.
 }
});

function previewFixture(variant='base',turn=0){
 const rig=rigData([part('base'),part('head','base',[12,14,12]),part('guns','head',[12,TURRET_MUZZLES[variant][0][1],15])],placementMatrix([2,1,3],turn));
 return new TurretPreview({level:{placements:[{id:'turret',model:'turret-study',variant}]},rigs:new Map([['turret',rig]])},()=>{},()=>.75);
}
test('weighted turns accelerate and brake without overshoot, including tiny and half-circle moves',()=>{
 const turn=new YawTurn(TURRET_TURN);
 turn.begin(0,Math.PI/2);expect(turn.duration).toBeCloseTo(.4,10);
 turn.begin(0,Math.PI);expect(turn.duration).toBeCloseTo(.65,10);
 for(const degrees of [.000001,2,20,90,180,-2,-180]){
  const target=degrees*Math.PI/180;turn.begin(0,target);expect(turn.velocity).toBe(0);
  const step=turn.duration/20;let previous=0,peak=0,firstSpeed=0,lastSpeed=0;
  for(let i=1;i<20;i++){
   turn.advance(step);const progress=turn.yaw/target,speed=Math.abs(turn.velocity);
   expect(progress).toBeGreaterThanOrEqual(previous);expect(progress).toBeLessThan(1);
   expect(speed).toBeLessThanOrEqual(TURRET_TURN.maxSpeed+1e-10);expect(Number.isFinite(progress)).toBe(true);
   if(i===1)firstSpeed=speed;peak=Math.max(peak,speed);lastSpeed=speed;previous=progress;
  }
  expect(firstSpeed).toBeLessThan(peak);expect(lastSpeed).toBeLessThan(peak);
  turn.advance(100);expect(turn.yaw).toBe(target);expect(turn.velocity).toBe(0);expect(turn.active).toBe(false);
 }
 turn.begin(1,1);turn.advance(100);expect(turn.yaw).toBe(1);expect(turn.velocity).toBe(0);expect(turn.duration).toBe(0);
 expect(()=>new YawTurn({...TURRET_TURN,acceleration:0})).toThrow();expect(()=>turn.advance(-1)).toThrow();expect(()=>turn.begin(0,NaN)).toThrow();
});
test('weighted yaw and velocity agree across frame rates and uneven frames',()=>{
 for(const target of [2,90,180].map(d=>d*Math.PI/180))for(const fraction of [.2,.5,.8]){
  const reference=new YawTurn(TURRET_TURN);reference.begin(0,target);const time=reference.duration*fraction;reference.advance(time);
  for(const step of [1/30,1/60,1/144,.073]){
   const turn=new YawTurn(TURRET_TURN);turn.begin(0,target);let elapsed=0;
   while(elapsed<time){const dt=Math.min(step,time-elapsed);turn.advance(dt);elapsed+=dt;}
   expect(turn.yaw).toBeCloseTo(reference.yaw,10);expect(turn.velocity).toBeCloseTo(reference.velocity,10);
  }
 }
});
test('random turns integrate delta seconds and cannot fire before facing their target',()=>{
 for(const step of [1/30,1/60,1/144]){
  const preview=previewFixture(),state=preview.states[0];preview.advance(2);
  // A long waiting frame chooses a direction but does not teleport to it.
  expect(state.aim.target).toBe(Math.PI/2);expect(state.aim.yaw).toBe(0);expect(state.cycle.shots).toBe(0);
  let elapsed=0;while(elapsed<.1){const dt=Math.min(step,.1-elapsed);preview.advance(dt);elapsed+=dt;}
  expect(state.aim.yaw).toBeCloseTo(.5*TURRET_TURN.acceleration*.1*.1,10);expect(state.cycle.shots).toBe(0);
  while(elapsed<.41){const dt=Math.min(step,.41-elapsed);preview.advance(dt);elapsed+=dt;}
  expect(state.aim.yaw).toBe(state.aim.target);expect(state.turning).toBe(false);expect(state.aim.velocity).toBe(0);expect(state.cycle.shots).toBe(1);
  const yaw=state.aim.yaw;preview.advance(.9);expect(state.aim.yaw).toBe(yaw);expect(state.turning).toBe(false);expect(state.cycle.shots).toBe(1);
 }
});
test('turning crosses the angle boundary by the short arc and long frames cannot replay shots',()=>{
 for(const sign of [-1,1]){
  const preview=previewFixture(),state=preview.states[0];state.aim.begin(sign*179*Math.PI/180,-sign*179*Math.PI/180);state.turning=true;
  const start=state.aim.yaw;preview.advance(1/180);
  expect(state.aim.yaw-start).toBeCloseTo(sign*.5*TURRET_TURN.acceleration*(1/180)**2,10);expect(state.cycle.shots).toBe(0);
  preview.advance(100);expect(state.aim.yaw).toBe(state.aim.target);expect(state.cycle.shots).toBe(1);
  preview.advance(100);expect(state.cycle.shots).toBe(1);expect(state.turning).toBe(true);
 }
});
test('a rotated burst holds its aim and recoils along the barrels while the pedestal stays fixed',()=>{
 for(const turn of [0,1]){
  const preview=previewFixture('upgrade1',turn),state=preview.states[0],base=state.rig.byId.get('base').instance.matrix,baseRest=Array.from(base),head=state.gunMatrix;
  preview.advance(2);preview.advance(1);expect(state.cycle.shots).toBe(1);const aim=state.aim.yaw,rest=Array.from(head);
  preview.advance(.045);expect(state.displacement).toBe(1.25);
  // Matrix column Z is the current world-space barrel recoil axis.
  for(let axis=0;axis<3;axis++)expect(head[12+axis]-rest[12+axis]).toBeCloseTo(rest[8+axis]*1.25,5);
  preview.advance(.075);expect(state.cycle.shots).toBe(2);preview.advance(.12);expect(state.cycle.shots).toBe(3);
  expect(state.aim.yaw).toBe(aim);expect(state.aim.target).toBe(aim);expect(state.turning).toBe(false);expect(Array.from(base)).toEqual(baseRest);
  preview.advance(.3);expect(state.displacement).toBe(0);expect(Array.from(head)).toEqual(rest);expect(preview.updatedParts).toBe(1);
  preview.advance(.1);expect(preview.updatedParts).toBe(0);
 }
});
