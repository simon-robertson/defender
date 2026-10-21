import {test,expect} from 'bun:test';
import {interceptXZ} from '../engine/aim.js';

function checkSolution(originX,originZ,targetX,targetZ,vx,vz,speed,expectedTime){
 const out=new Float64Array(3);expect(interceptXZ(out,originX,originZ,targetX,targetZ,vx,vz,speed)).toBe(true);
 expect(Math.abs(out[2]-expectedTime)/Math.max(1,expectedTime)).toBeLessThan(1e-10);
 expect(out[0]).toBeCloseTo(targetX+vx*out[2],8);expect(out[1]).toBeCloseTo(targetZ+vz*out[2],8);
 const travelled=Math.hypot(out[0]-originX,out[1]-originZ),projectileDistance=speed*out[2];expect(Math.abs(travelled-projectileDistance)/Math.max(1,projectileDistance)).toBeLessThan(1e-10);
 return out;
}

test('horizontal interception solves stationary, crossing, approaching and retreating targets',()=>{
 checkSolution(0,0,100,0,0,0,50,2);
 checkSolution(0,0,100,0,0,10,50,100/Math.sqrt(50*50-10*10));
 checkSolution(0,0,100,0,-10,0,50,100/60);
 checkSolution(0,0,100,0,10,0,50,100/40);
 checkSolution(10,-20,110,-20,-10,0,50,100/60);
});

test('equal-speed linear cases and two positive roots choose the first reachable intercept',()=>{
 checkSolution(0,0,100,0,-50,0,50,1);
 checkSolution(0,0,100,100,-30,-40,50,20000/14000);
 checkSolution(0,0,100,0,-60,0,50,100/110);
 const out=new Float64Array(3);
 for(const [vx,vz]of [[50,0],[0,50],[60,0],[0,60]]){expect(interceptXZ(out,0,0,100,0,vx,vz,50)).toBe(false);expect(Array.from(out)).toEqual([100,0,0]);}
});

test('a tangent solution is retained while a genuinely unreachable crossing is rejected',()=>{
 checkSolution(0,0,100,0,-10,10,10,10);
 const out=new Float64Array(3);expect(interceptXZ(out,0,0,100,0,-10,10.001,10)).toBe(false);
});

test('optional horizon is inclusive, and failure clears previous scratch without authorising direct fire',()=>{
 const out=new Float64Array(3);expect(interceptXZ(out,0,0,100,0,0,0,50,2)).toBe(true);expect(out[2]).toBe(2);
 expect(interceptXZ(out,0,0,100,0,0,0,50,1.999)).toBe(false);expect(Array.from(out)).toEqual([100,0,0]);
 // This diagonal computes 2.0000000000000004 without a rounding allowance.
 const x=23.999199382142336,z=.19603320172599925;
 for(const timeScale of [1e-120,1,1e120]){
  const horizon=2*timeScale,vx=x/(2*timeScale),vz=z/(2*timeScale),speed=24/timeScale;
  expect(interceptXZ(out,0,0,x,z,vx,vz,speed,horizon)).toBe(true);
  expect(out[2]).toBeLessThanOrEqual(horizon);expect(Math.abs(out[2]-horizon)/horizon).toBeLessThan(2e-15);
  expect(Math.hypot(out[0],out[1])).toBeCloseTo(48,12);
  expect(interceptXZ(out,0,0,x,z,vx,vz,speed,horizon*(1-1e-12))).toBe(false);expect(Array.from(out)).toEqual([x,z,0]);
 }
 expect(interceptXZ(out,5,6,5,6,100,200,50,0)).toBe(true);expect(Array.from(out)).toEqual([5,6,0]);
 expect(interceptXZ(out,0,0,1,0,0,0,50,0)).toBe(false);
});

test('stable roots preserve almost-equal speeds, shifted origins and extreme coefficient scales',()=>{
 const out=new Float64Array(3),speed=1+1e-10,expected=1000/(speed-1);
 expect(interceptXZ(out,0,0,1000,0,1,0,speed)).toBe(true);expect(Math.abs(out[2]-expected)/expected).toBeLessThan(1e-10);
 expect(interceptXZ(out,0,0,1000,0,speed,0,1)).toBe(false);
 checkSolution(1e9,-1e9,1e9+1000,-1e9,-3,0,30,1000/33);
 for(const size of [1e-150,1e150,1e-300,1e300]){
  expect(interceptXZ(out,0,0,size,0,0,0,size)).toBe(true);expect(out[2]).toBeCloseTo(1,12);expect(out[0]).toBe(size);
 }
 expect(interceptXZ(out,-1e308,0,1e308,0,0,0,1e308)).toBe(true);expect(out[2]).toBe(2);expect(out[0]).toBe(1e308);
});

test('invalid intercept configuration fails early and repeated calls reuse caller storage',()=>{
 const out=new Float64Array([7,8,9]),buffer=out.buffer;
 const valid=[0,0,100,0,0,10,50,Infinity];
 for(let index=0;index<7;index++)for(const invalid of [NaN,Infinity,-Infinity]){const args=valid.slice();args[index]=invalid;expect(()=>interceptXZ(out,...args)).toThrow();expect(Array.from(out)).toEqual([7,8,9]);}
 for(const speed of [0,-1])expect(()=>interceptXZ(out,0,0,100,0,0,0,speed)).toThrow();
 for(const horizon of [-1,-Infinity,NaN])expect(()=>interceptXZ(out,0,0,100,0,0,0,50,horizon)).toThrow();
 expect(()=>interceptXZ(new Float64Array(2),0,0,100,0,0,0,50)).toThrow();
 for(let i=0;i<100;i++)expect(interceptXZ(out,0,0,100,0,0,10,50)).toBe(true);expect(out.buffer).toBe(buffer);
});
