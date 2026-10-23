import {test,expect} from 'bun:test';
import {DroneLens,DRONE_CAMERA_FOV,DRONE_CAMERA_MIN_FOV,DRONE_CAMERA_MAX_FOV} from '../play/drone-lens.js';

test('the lens begins slightly tighter and alternates occasional close shots with normal holds',()=>{
 const lens=new DroneLens();expect(lens.fov).toBe(60);expect(lens.target).toBe(60);expect(lens.velocity).toBe(0);expect(lens.nextDecision).toBe(8);
 lens.observe(7.9,50,2);expect(lens.phase).toBe('normal');lens.observe(8,50,2);expect(lens.phase).toBe('close');expect(lens.target).toBe(54);expect(lens.zoomCount).toBe(1);
 lens.advance(3);expect(lens.fov).toBeLessThan(55);lens.observe(13.99,50,2);expect(lens.phase).toBe('close');lens.observe(14,50,2);expect(lens.phase).toBe('normal');expect(lens.target).toBe(60);expect(lens.nextDecision).toBe(22);
 lens.observe(21.99,56,2);expect(lens.phase).toBe('normal');lens.observe(22,56,2);expect(lens.phase).toBe('close');expect(lens.target).toBe(56);expect(lens.zoomCount).toBe(2);
});

test('edge pressure cancels a close shot once, widens safely and leaves its cooldown stable',()=>{
 const lens=new DroneLens();lens.observe(8,54,2);lens.advance(1);const fov=lens.fov,velocity=lens.velocity;
 lens.observe(9,75,3);expect(lens.phase).toBe('normal');expect(lens.target).toBe(62);expect(lens.nextDecision).toBe(17);expect(lens.fov).toBe(fov);expect(lens.velocity).toBe(velocity);
 for(const time of [9.1,10,12,16,20,30]){lens.observe(time,75,3);expect(lens.target).toBe(62);expect(lens.nextDecision).toBe(17);}
 expect(lens.zoomCount).toBe(1);lens.observe(31,61.2,3);expect(lens.target).toBe(62);lens.observe(32,59,3);expect(lens.target).toBe(60);
});

test('small fit fluctuations do not thrash a wider target or interrupt a safe close shot',()=>{
 const lens=new DroneLens();lens.observe(1,61,2);expect(lens.target).toBe(61);
 for(const fit of [61.2,60.8,61.3,60.2]){lens.observe(2,fit,2);expect(lens.target).toBe(61);}
 lens.observe(8,56,2);expect(lens.target).toBe(56);lens.observe(9,56.4,2);expect(lens.phase).toBe('close');expect(lens.target).toBe(56);
 lens.observe(10,56.6,2);expect(lens.phase).toBe('normal');expect(lens.target).toBe(60);
});

test('quiet scenes ease to normal and moving compositions defer a due close decision',()=>{
 const lens=new DroneLens();lens.observe(8,54,1,false);expect(lens.phase).toBe('normal');expect(lens.nextDecision).toBe(10);
 lens.observe(9,54,1,true);expect(lens.phase).toBe('normal');lens.observe(10,54,1,true);lens.advance(1);const fov=lens.fov,velocity=lens.velocity;
 lens.observe(11,0,0);expect(lens.target).toBe(60);expect(lens.phase).toBe('normal');expect(lens.nextDecision).toBe(19);expect(lens.fov).toBe(fov);expect(lens.velocity).toBe(velocity);
 lens.observe(12,0,0);expect(lens.nextDecision).toBe(19);lens.advance(5);expect(Math.abs(lens.fov-60)).toBeLessThan(.1);
});

test('mid-ramp reversal preserves value and velocity with bounded rate and acceleration',()=>{
 const lens=new DroneLens();lens.observe(8,54,1);lens.advance(.75);expect(lens.velocity).toBeLessThan(0);
 const before=[lens.fov,lens.velocity];lens.observe(8.75,62,1);expect([lens.fov,lens.velocity]).toEqual(before);
 let previousFov=lens.fov,previousVelocity=lens.velocity;
 for(let n=0;n<1200;n++){
  lens.advance(1/120);expect(lens.fov).toBeGreaterThanOrEqual(DRONE_CAMERA_MIN_FOV);expect(lens.fov).toBeLessThanOrEqual(DRONE_CAMERA_MAX_FOV);
  expect(Math.abs(lens.velocity)).toBeLessThan(5);expect(Math.abs(lens.fov-previousFov)).toBeLessThan(5/120);expect(Math.abs(lens.velocity-previousVelocity)*120).toBeLessThan(16);
  previousFov=lens.fov;previousVelocity=lens.velocity;
 }
 expect(lens.fov).toBeCloseTo(62,3);expect(lens.velocity).toBeCloseTo(0,3);
});

test('analytical lens transitions agree at 30, 60 and 120 Hz and zero delta freezes motion',()=>{
 const results=[];
 for(const hz of [30,60,120]){
  const lens=new DroneLens();lens.observe(8,54,2);
  for(let n=0;n<hz*2;n++)lens.advance(1/hz);
  lens.observe(10,62,2);for(let n=0;n<hz*3;n++)lens.advance(1/hz);
  const before={...lens};lens.advance(0);expect({...lens}).toEqual(before);results.push([lens.fov,lens.velocity]);
 }
 for(let n=1;n<results.length;n++)for(let axis=0;axis<2;axis++)expect(results[n][axis]).toBeCloseTo(results[0][axis],10);
 const lens=new DroneLens();lens.observe(8,54,1);lens.advance(Number.MAX_VALUE);expect(lens.fov).toBe(54);expect(lens.velocity).toBe(0);
});

test('manual deferral carries lens motion, while reset restores fresh-wave state',()=>{
 const lens=new DroneLens();lens.observe(8,54,1);lens.advance(1);const before=[lens.fov,lens.velocity];lens.defer(9);
 expect([lens.fov,lens.velocity]).toEqual(before);expect(lens.target).toBe(DRONE_CAMERA_FOV);expect(lens.phase).toBe('normal');expect(lens.nextDecision).toBe(17);expect(lens.zoomCount).toBe(1);
 lens.reset();expect({...lens}).toEqual({...new DroneLens()});
});

test('invalid clock or composition inputs reject atomically',()=>{
 const lens=new DroneLens(),before={...lens};
 for(const input of [NaN,Infinity,-1]){expect(()=>lens.advance(input)).toThrow();expect(()=>lens.defer(input)).toThrow();expect(()=>lens.observe(input,54,1)).toThrow();expect(()=>lens.observe(0,input,1)).toThrow();}
 for(const count of [NaN,Infinity,-1,.5])expect(()=>lens.observe(0,54,count)).toThrow();
 expect(()=>lens.observe(0,54,1,1)).toThrow();expect({...lens}).toEqual(before);
});
