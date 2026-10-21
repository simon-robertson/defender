import {test,expect} from 'bun:test';
import {DamageEffects} from '../engine/damage-effects.js';
import {CRITTER_GIB,BLOOD_DECAL_OFFSET} from '../shared/damage-effects.js';
const world={visibility:{bounds:new Float32Array([0,0,0,24,24,24]),escape:new Uint32Array([1]),nodeCount:1}},palette=new Float32Array([.3,.2,.1,1]);
function effects(){const d=new DamageEffects(()=>.5);d.setWorld(world,[]);d.gibCritter({x:12,y:30,z:12},palette,0,30,12);return d;}
test('packing separates solids from a stable decal suffix without replacing shared storage',()=>{
 const d=effects(),buffer=d.cubeData,marks=d.cubes.filter(p=>p.active&&p.spray).slice(0,3);
 for(const [i,p]of marks.entries())Object.assign(p,{x:i+3,y:24,z:12,sx:1,sz:1,nx:0,ny:1,nz:0,decal:true,resting:true});
 d.cubesDirty=true;d.prepare();expect(d.decalCount).toBe(3);expect(d.cubeCount).toBe(48);
 const solidCount=d.cubeCount-d.decalCount;
 for(let i=0;i<solidCount;i++)expect(buffer[i*20+19]).toBe(0);
 for(let i=0;i<3;i++){expect(buffer[(solidCount+i)*20+19]).toBe(2);expect(buffer[(solidCount+i)*20+12]).toBe(i+3);}
 d.cubesDirty=true;d.prepare(new Float32Array(16).fill(1));expect(d.cubeData).toBe(buffer);
 expect([0,1,2].map(i=>buffer[(solidCount+i)*20+12])).toEqual([3,4,5]);
});
test('actual spray collisions convert to larger flat marks on every solid face, never floating past its bounds',()=>{
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const d=effects(),p=d.cubes.find(p=>p.active&&p.spray),position=[12,12,12],velocity=[0,0,0];position[axis]=sign>0?28:-4;velocity[axis]=-sign*45;Object.assign(p,{x:position[0],y:position[1],z:position[2],vx:velocity[0],vy:velocity[1],vz:velocity[2]});
  for(let i=0;i<50&&!p.decal;i++)d.stepCube(p,1/120);expect(p.decal).toBe(true);expect(p.resting).toBe(true);expect(p.active).toBe(true);expect([p.nx,p.ny,p.nz][axis]).toBe(sign);expect([p.x,p.y,p.z][axis]).toBeCloseTo((sign>0?24:0)+sign*BLOOD_DECAL_OFFSET,6);expect(p.sx*2).toBeGreaterThan(p.size);expect(p.sz*2).toBeGreaterThan(p.size);
  d.cubesDirty=true;d.prepare();const index=[...d.cubes.filter(p=>p.active&&!p.decal),...d.cubes.filter(p=>p.active&&p.decal)].indexOf(p),m=d.cubeData.subarray(index*20,index*20+20);
  const normal=[m[4],m[5],m[6]];expect(normal[axis]).toBe(sign);expect(m[19]).toBe(2);
  for(const u of [-1,1])for(const v of [-1,1])for(let a=0;a<3;a++)if(a!==axis){const edge=m[12+a]+u*m[a]+v*m[8+a];expect(edge).toBeGreaterThanOrEqual(-.00001);expect(edge).toBeLessThanOrEqual(24.00001);}
  const point=[p.x,p.y,p.z];d.advance(20);expect([p.x,p.y,p.z]).toEqual(point);expect(p.fade).toBe(1);d.endCritterRun();d.advance(1);expect(p.fade).toBeCloseTo(.5);d.advance(1);expect(p.active).toBe(false);
 }
});
test('blood marks survive next-wave effect rebinding, begin fading in preparation and release old slots before a quick start',()=>{
 const d=effects(),pool=d.cubes,buffer=d.cubeData;Object.assign(d.cubes.find(p=>p.active&&p.spray),{x:12,y:30,z:12,vx:0,vy:-10,vz:0});d.advance(5);const pieces=d.cubes.filter(p=>p.active);expect(pieces.some(p=>p.decal)).toBe(true);
 d.advance(4);expect(pieces.every(p=>p.fade===1)).toBe(true);const time=d.time;
 d.setWorld(world,[],{keepCritters:true});expect(d.time).toBe(time);expect(d.activeCubes).toBe(pieces.length);expect(pieces.every(p=>p.active&&p.fade===1)).toBe(true);
 d.endCritterRun();d.advance(0);expect(pieces.every(p=>p.fade===1)).toBe(true);d.advance(CRITTER_GIB.fadeSeconds/2);expect(pieces.every(p=>p.fade===.5)).toBe(true);
 d.beginCritterRun();expect(d.hasCritterRemains).toBe(false);d.gibCritter({x:12,y:30,z:12},palette,0,30,12);expect(d.cubes.filter(p=>p.active).every(p=>p.fadeStart===null)).toBe(true);expect(d.droppedCritterCubes).toBe(0);expect(d.cubes).toBe(pool);expect(d.cubeData).toBe(buffer);
 d.reset();expect(d.hasCritterRemains).toBe(false);expect(d.visibility).toBeNull();
});
