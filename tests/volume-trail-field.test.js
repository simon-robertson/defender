import {test,expect} from 'bun:test';
import {VolumeTrailField,VOLUME_TRAILS,VOLUME_FLOATS,VOLUME_POINTS} from '../engine/volume-trail-field.js';
const buffer=()=>new Float32Array(VOLUME_TRAILS*VOLUME_FLOATS);
test('independent trail identities, bounded lifetime and reset retain fixed storage',()=>{
 const f=new VolumeTrailField(),out=buffer(),storage=f.trails[0].points;
 f.sample('first',0,20,0,0);f.sample('second',50,20,0,0);f.sample('first',2,21,0,.1);f.sample('second',52,21,0,.1);expect(f.pack(out,[0,50,0])).toBe(2);expect(out[12]).toBeGreaterThan(40);expect(out[VOLUME_FLOATS+12]).toBeLessThan(5);
 expect(Array.from(out.slice(0,2*VOLUME_FLOATS)).every(Number.isFinite)).toBe(true);f.expire(2.2);expect(f.pack(out,[0,0,0])).toBe(0);f.reset();expect(f.trails[0].points).toBe(storage);expect(f.trails.every(t=>t.id===null&&t.count===0)).toBe(true);
});
test('capacity exhaustion is explicit, circular histories and generations never join',()=>{
 const f=new VolumeTrailField();for(let i=0;i<VOLUME_TRAILS;i++)expect(f.sample(i,i,0,0,0)).toBe(true);expect(f.sample('overflow',0,0,0,0)).toBe(false);expect(f.dropped).toBe(1);f.reset();
 for(let n=0;n<100;n++)f.sample('old',n,30,0,n*.01);expect(f.trails[0].count).toBe(VOLUME_POINTS);f.sample('new',400,30,0,1);f.sample('new',402,30,0,1.1);const out=buffer();expect(f.pack(out,[0,0,0])).toBe(2);expect(out[8]).toBe(2);expect(out[VOLUME_FLOATS+8]).toBe(VOLUME_POINTS);
 for(let i=0;i<f.count;i++)for(let n=0;n<out[i*VOLUME_FLOATS+8];n++){const k=i*VOLUME_FLOATS+12+n*4;for(let a=0;a<3;a++){expect(out[k+a]).toBeGreaterThanOrEqual(out[i*VOLUME_FLOATS+a]);expect(out[k+a]).toBeLessThanOrEqual(out[i*VOLUME_FLOATS+4+a]);}}
});
test('invalid samples cannot poison density packets or run time backwards',()=>{
 const f=new VolumeTrailField();expect(()=>f.sample('x',NaN,0,0,0)).toThrow();f.sample('x',0,0,0,1);expect(f.sample('x',0,0,0,1)).toBe(false);expect(()=>f.sample('x',0,0,0,.5)).toThrow();
});
test('fixed-step samples can arrive within the last presentation frame without reversing its clock',()=>{
 const f=new VolumeTrailField();f.sample('a',0,20,0,.94);f.expire(.98);expect(f.sample('a',2,20,0,.975)).toBe(true);expect(f.time).toBe(.98);expect(f.trails[0].count).toBe(2);expect(()=>f.sample('a',3,20,0,.95)).toThrow('monotonic');
});
