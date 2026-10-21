import {test,expect} from 'bun:test';
import {InspectionSampler} from '../engine/inspection-sampler.js';
import {FrameClock} from '../engine/clock.js';

test('inspection snapshots publish immediately, at ten Hz, and after invalidation',()=>{
 const sampler=new InspectionSampler();expect(sampler.advance(0)).toBe(true);
 let writes=0;for(let i=0;i<600;i++)writes+=Number(sampler.advance(1/60));
 expect(writes).toBe(100);sampler.reset();expect(sampler.advance(0)).toBe(true);
 expect(sampler.advance(5)).toBe(true);expect(sampler.advance(0)).toBe(false);
});

test('slow motion changes simulation time without slowing inspection publishing',()=>{
 const clock=new FrameClock(),sampler=new InspectionSampler();clock.setTimeScale(.1);
 clock.tick(0);sampler.advance(0);let writes=0;
 for(let frame=1;frame<=600;frame++){clock.tick(frame*1000/60);writes+=Number(sampler.advance(clock.unscaledDeltaSeconds));}
 expect(writes).toBe(100);expect(clock.elapsedSeconds).toBeCloseTo(1,10);
});
