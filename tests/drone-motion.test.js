import {test,expect} from 'bun:test';
import {DroneMotion} from '../engine/drone-motion.js';
import {DRONE_PREVIEW as T} from '../shared/drone.js';

test('a zero-speed join advances to the next segment at an exact native-frame distance',()=>{
 for(const dt of [1/60,.02]){
  const m=new DroneMotion(4),length=T.acceleration*dt*dt;
  m.add(0,0,0,0,0,0,length,0,0,false,0);m.add(length,0,0,0,0,0,length,0,12,false,0);
  for(let i=0;i<600&&!m.done;i++)m.advance(dt);
  expect(m.done).toBe(true);expect(m.point[0]).toBeCloseTo(length,8);expect(m.point[2]).toBe(12);expect(m.speed).toBe(0);m.dispose();
 }
});

test('rounded paths have continuous position/tangent, bounded speed and acceleration and exact resting endpoints',()=>{
 const m=new DroneMotion(6);m.add(0,0,0,0,0,0,30,0,0,false);m.add(30,0,0,48,0,0,48,0,18,true);m.add(48,0,18,0,0,0,48,0,60,false,0);
 let maxAcceleration=0,lastX=0,lastY=0,lastZ=0,maxSpeed=0;
 for(let frame=0;frame<2000&&!m.done;frame++){
  const p=m.advance(1/120),vx=p[3]*m.speed,vy=p[4]*m.speed,vz=p[5]*m.speed;
  maxAcceleration=Math.max(maxAcceleration,Math.hypot(vx-lastX,vy-lastY,vz-lastZ)*120);maxSpeed=Math.max(maxSpeed,m.speed);lastX=vx;lastY=vy;lastZ=vz;
  expect(Array.from(p).every(Number.isFinite)).toBe(true);
 }
 expect(m.done).toBe(true);expect(maxSpeed).toBeLessThanOrEqual(T.speed);expect(maxAcceleration).toBeLessThan(Math.hypot(T.braking,T.turnAcceleration)*1.15);expect(Array.from(m.point).slice(0,3)).toEqual([48,0,60]);m.dispose();
});

test('station arrival estimates use the actual rounded route controller without mutating retained motion',()=>{
 const m=new DroneMotion(4);m.add(0,0,0,0,0,0,30,0,0,false);m.add(30,0,0,48,0,0,48,0,18,true);m.add(48,0,18,0,0,0,48,0,60,false,0);
 const data=m.data,point=m.point,expectedPoint=Array.from(point),duration=m.duration();expect(m.distance).toBe(0);expect(m.speed).toBe(0);expect(m.segmentIndex).toBe(0);expect(m.data).toBe(data);expect(m.point).toBe(point);expect(Array.from(m.point)).toEqual(expectedPoint);
 let elapsed=0;for(let step=0;step<1000&&!m.done;step++){m.advance(.02);elapsed+=.02;}expect(duration).toBeCloseTo(elapsed,10);expect(duration).toBeGreaterThan(m.length/T.speed);m.dispose();
});
