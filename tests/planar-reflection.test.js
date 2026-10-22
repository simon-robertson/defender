import {test,expect} from 'bun:test';
import {reflectedFrame,waterPlane,waterInView} from '../engine/planar-reflection.js';
import {identity} from '../shared/math.js';
test('mirrored frame preserves arbitrary projection and reflects camera and water-plane points exactly',()=>{
 const frame=new Float32Array(92);frame.set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);frame[49]=60;frame[69]=.6;const out=new Float32Array(92);reflectedFrame(out,frame,20);
 for(const p of [[2,20,4],[3,30,7],[1,-5,8]])for(let r=0;r<4;r++)expect(out[r]*p[0]+out[4+r]*p[1]+out[8+r]*p[2]+out[12+r]).toBe(frame[r]*p[0]+frame[4+r]*(40-p[1])+frame[8+r]*p[2]+frame[12+r]);
 expect(out[49]).toBe(-20);expect(out[69]).toBeCloseTo(-.6);expect(out[79]).toBe(20);expect(frame[49]).toBe(60);
});
test('horizontal pools share one plane, mixed heights fall back safely, and water culling is conservative',()=>{
 expect(waterPlane({terrain:{boxes:[]}})).toBeNull();expect(waterPlane({terrain:{boxes:[{water:20},{water:0},{water:20}]}})).toBe(20);expect(waterPlane({terrain:{boxes:[{water:20},{water:22}]}})).toBeNull();
 const vp=identity();expect(waterInView([-2,-2,-1,2,2,2],vp)).toBe(true);expect(waterInView([2,0,0,3,1,1],vp)).toBe(false);expect(waterInView([0,0,-2,1,1,-1],vp)).toBe(false);expect(waterInView(null,vp)).toBe(false);
});
test('mirrored inverse reconstructs reflected world coordinates for volume rays',()=>{
 const f=new Float32Array(92);for(let n=0;n<16;n++)f[32+n]=(n+1)*.25;const out=new Float32Array(92);reflectedFrame(out,f,17);
 for(const p of [[.3,.7,.9,1],[-.2,.4,0,1]]){
  const original=Array.from({length:4},(_,r)=>p.reduce((sum,v,c)=>sum+f[32+c*4+r]*v,0));
  const mirrored=Array.from({length:4},(_,r)=>p.reduce((sum,v,c)=>sum+out[32+c*4+r]*v,0));
  expect(mirrored[0]).toBeCloseTo(original[0]);expect(mirrored[1]).toBeCloseTo(34*original[3]-original[1]);expect(mirrored[2]).toBeCloseTo(original[2]);expect(mirrored[3]).toBeCloseTo(original[3]);
 }
});
