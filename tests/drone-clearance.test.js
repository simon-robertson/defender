import {test,expect} from 'bun:test';
import {sweptDroneBoxIntersects as hit} from '../engine/drone-clearance.js';

test('diagonal aircraft sweep clears unused bounding-rectangle corners but catches intermediate contact',()=>{
 const offLine=new Float64Array([10,0,80,20,20,90]),onLine=new Float64Array([40,0,40,45,20,45]);
 expect(hit(offLine,0,0,10,0,100,10,100,2,2,2)).toBe(false);
 expect(hit(onLine,0,0,10,0,100,10,100,2,2,2)).toBe(true);
 expect(hit(offLine,0,100,10,100,0,10,0,2,2,2)).toBe(false);
 expect(hit(onLine,0,100,10,100,0,10,0,2,2,2)).toBe(true);
});

test('asymmetric Y admits safe overhead/underneath travel and rejects actual volume contact',()=>{
 const ground=new Float64Array([40,24,40,60,38,60]),bird=new Float64Array([40,65,40,60,71,60]);
 expect(hit(ground,0,0,57,50,100,57,50)).toBe(false);
 expect(hit(ground,0,0,45,50,100,45,50)).toBe(true);
 expect(hit(bird,0,0,57,50,100,57,50)).toBe(false);
 expect(hit(bird,0,0,60,50,100,60,50)).toBe(true);
 expect(hit(bird,0,0,81,50,100,81,50)).toBe(false);
 expect(hit(bird,0,0,79,50,100,79,50)).toBe(true);
});

test('vertical launch sweep can use unchanged neutral footprint independently of airborne hull',()=>{
 const neighbour=new Float64Array([45,0,45,55,40,55]);
 expect(hit(neighbour,0,31,33,50,31,57,50,11,5,5)).toBe(false);
 expect(hit(neighbour,0,31,33,50,31,57,50,16.5,9,6)).toBe(true);
 expect(hit(neighbour,0,34,33,50,34,57,50,11,5,5)).toBe(false);
 expect(hit(neighbour,0,34.01,33,50,34.01,57,50,11,5,5)).toBe(true);
});

test('stationary aircraft, packed offsets, face contact and tiny positive penetration agree',()=>{
 const packed=new Float64Array([-100,-100,-100,-90,-90,-90,40,20,40,50,30,50]);
 expect(hit(packed,6,45,25,45,45,25,45,1,1,1)).toBe(true);
 expect(hit(packed,0,45,25,45,45,25,45,1,1,1)).toBe(false);
 expect(hit(packed,6,39,25,45,39,25,45,1,1,1)).toBe(false);
 expect(hit(packed,6,39.0001,25,45,39.0001,25,45,1,1,1)).toBe(true);
 expect(hit(packed,6,45,31,45,45,31,45,1,1,1)).toBe(false);
 expect(hit(packed,6,45,30.9999,45,45,30.9999,45,1,1,1)).toBe(true);
});

test('a thin mid-flight obstacle cannot be skipped by a long segment or reversed segment',()=>{
 const thin=new Float64Array([50,0,20,50.001,100,21]);
 expect(hit(thin,0,0,50,20.5,1000,50,20.5,0,0,0)).toBe(true);
 expect(hit(thin,0,1000,50,20.5,0,50,20.5,0,0,0)).toBe(true);
 expect(hit(thin,0,0,50,21.001,1000,50,21.001,0,0,0)).toBe(false);
});
