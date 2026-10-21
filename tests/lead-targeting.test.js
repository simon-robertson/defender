import {test,expect} from 'bun:test';
import {DefenceAim} from '../engine/targeting.js';
import {TURRET_FIRING} from '../shared/arsenal.js';
import {PathMotion} from '../engine/path-motion.js';

const projectile=speed=>({delivery:'projectile',projectile:{speedUnitsPerSecond:speed}});

test('the current hitscan turret still aims exactly at the present target, without requiring velocity',()=>{
 for(const rule of [TURRET_FIRING.base,TURRET_FIRING.upgrade1]){
  const aim=new DefenceAim(rule,48),point=aim.point;
  for(const target of [{x:12,z:30},{x:12,z:30,velocityX:100,velocityZ:200}]){
   expect(aim.solve(0,0,target)).toBe(true);expect(Array.from(aim.point)).toEqual([12,30,0]);expect(aim.point).toBe(point);
  }
  expect(aim.solve(0,0,{x:49,z:0})).toBe(false);
 }
});

test('projectile aim leads crossing motion according to speed and keeps the intercept inside maximum travel range',()=>{
 const target={x:0,z:30,velocityX:12,velocityZ:0},slow=new DefenceAim(projectile(30),48),fast=new DefenceAim(projectile(60),48);
 expect(slow.solve(0,0,target)).toBe(true);expect(fast.solve(0,0,target)).toBe(true);
 const point=slow.point,time=point[2];expect(time).toBeCloseTo(30/Math.sqrt(30*30-12*12),10);
 expect(point[0]).toBeCloseTo(target.x+target.velocityX*time,10);expect(point[1]).toBe(target.z);expect(Math.hypot(point[0],point[1])).toBeCloseTo(30*time,10);
 expect(fast.point[0]).toBeLessThan(slow.point[0]);expect(fast.point[2]).toBeLessThan(slow.point[2]);
});

test('unreachable, out-of-range and unknown-motion targets cannot fall back to an unled projectile shot',()=>{
 const aim=new DefenceAim(projectile(24),48);
 expect(aim.solve(0,0,{x:0,z:40,velocityX:0,velocityZ:12})).toBe(false); // Intercept exists beyond travel range.
 expect(aim.solve(0,0,{x:0,z:40,velocityX:0,velocityZ:30})).toBe(false); // Cannot catch up.
 expect(aim.solve(0,0,{x:0,z:49,velocityX:0,velocityZ:-12})).toBe(false); // Current target is outside acquisition range.
 expect(aim.solve(0,0,{x:0,z:30})).toBe(false);
 expect(aim.solve(0,0,{x:0,z:40,velocityX:0,velocityZ:-12})).toBe(true);
 expect(aim.solve(0,0,{x:24,z:0,velocityX:12,velocityZ:0})).toBe(true);expect(Array.from(aim.point)).toEqual([48,0,2]);
 for(const angle of [.008168141,.019477875,.1,Math.PI/4,1.7,3.3,5.9]){
  const x=Math.cos(angle),z=Math.sin(angle);
  expect(aim.solve(0,0,{x:24*x,z:24*z,velocityX:12*x,velocityZ:12*z})).toBe(true);
  expect(aim.solve(0,0,{x:(24+1e-8)*x,z:(24+1e-8)*z,velocityX:12*x,velocityZ:12*z})).toBe(false);
 }
 for(const target of [
  {x:23.999199382142336,z:0.19603320172599925,velocityX:11.999599691071168,velocityZ:0.09801660086299963},
  {x:23.995447492814993,z:0.4674394287592309,velocityX:11.997723746407496,velocityZ:0.23371971437961545},
 ])expect(aim.solve(0,0,target)).toBe(true);
});

test('projectile speed is explicit, finite and positive; unknown delivery cannot silently become hitscan',()=>{
 for(const speed of [undefined,0,-1,Infinity,NaN,'30'])expect(()=>new DefenceAim(projectile(speed),48)).toThrow();
 for(const range of [-1,Infinity,NaN])expect(()=>new DefenceAim(projectile(24),range)).toThrow();
 expect(()=>new DefenceAim({delivery:'unknown'},48)).toThrow();expect(()=>new DefenceAim({delivery:'hitscan',projectile:{speedUnitsPerSecond:30}},48)).toThrow();
});

test('route motion reports true travel direction instead of the eased facing through a bend',()=>{
 const path=new PathMotion([[0,0,0],[1,0,0],[1,0,1]]),point=new Float64Array(5);
 path.sample(22,point);expect(Array.from(point.slice(3))).toEqual([1,0]);expect(Math.abs(Math.cos(point[2]))).toBeGreaterThan(.1);
 path.sample(24,point);expect(Array.from(point.slice(3))).toEqual([0,1]);
 path.sample(0,point);expect(Array.from(point.slice(3))).toEqual([1,0]);
});
