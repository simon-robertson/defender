import {test,expect} from 'bun:test';
import {FrameClock,FrameLoop} from '../engine/clock.js';
import {Camera} from '../engine/camera.js';
test('rAF timestamp differences become seconds, including first frame and pauses',()=>{
 const clock=new FrameClock();expect(clock.tick(1000)).toBe(0);expect(clock.tick(1016)).toBeCloseTo(.016);expect(clock.tick(1041)).toBeCloseTo(.025);expect(clock.elapsedSeconds).toBeCloseTo(.041);
 expect(clock.tick(1041)).toBe(0);expect(clock.tick(1030)).toBe(0);expect(clock.tick(1051)).toBeCloseTo(.010);
 clock.resetDelta();expect(clock.tick(900000)).toBe(0);expect(clock.elapsedSeconds).toBeCloseTo(.051);
 // Active long frames retain real elapsed time; no silent slow-motion clamp.
 expect(clock.tick(900500)).toBe(.5);expect(()=>clock.tick(NaN)).toThrow();
});
test('a movement rate integrates equally at 30, 60 and 144 Hz with jitter',()=>{
 for(const hz of [30,60,144]){const clock=new FrameClock();let position=0;clock.tick(0);for(let i=1;i<=hz*3;i++){const timestamp=i*1000/hz+(i===hz*3?0:(i%2?1:-1));position+=7*clock.tick(timestamp);}expect(position).toBeCloseTo(21,8);}
});
test('one owned frame loop can stop, resume and stop from its callback without duplicate requests',()=>{
 const pending=new Map();let serial=0,frames=0,lastDelta;const loop=new FrameLoop(delta=>{frames++;lastDelta=delta;},callback=>{pending.set(++serial,callback);return serial;},id=>pending.delete(id));
 const fire=time=>{const [id,fn]=pending.entries().next().value;pending.delete(id);fn(time);};
 loop.start();loop.start();expect(pending.size).toBe(1);fire(100);fire(120);expect(lastDelta).toBeCloseTo(.02);loop.stop();expect(pending.size).toBe(0);
 loop.start();fire(100000);expect(lastDelta).toBe(0);expect(loop.clock.elapsedSeconds).toBeCloseTo(.02);expect(frames).toBe(3);
 loop.onFrame=()=>loop.stop();fire(100016);expect(pending.size).toBe(0);expect(loop.running).toBe(false);
});
test('held keyboard camera movement uses delta seconds, independent of event repeat rate',()=>{
 function move(hz){const c=new Camera({addEventListener(){},clientWidth:1200,clientHeight:800},()=>{});c.target.set([168,24,120]);c.keys.add('d');for(let i=0;i<hz;i++)c.advance(1/hz);return c.target;}
 const a=move(30),b=move(144);for(let i=0;i<3;i++)expect(a[i]).toBeCloseTo(b[i],3);
});
test('preview time scale changes delta and accumulated time once, without jumps or hidden-tab catch-up',()=>{
 const clock=new FrameClock();clock.tick(1000);clock.tick(1100);clock.setTimeScale(.1);
 expect(clock.tick(1300)).toBeCloseTo(.02);expect(clock.unscaledDeltaSeconds).toBeCloseTo(.2);expect(clock.elapsedSeconds).toBeCloseTo(.12);
 expect(clock.tick(1200)).toBe(0);expect(clock.tick(1400)).toBeCloseTo(.01);
 clock.resetDelta();expect(clock.timeScale).toBe(.1);expect(clock.unscaledDeltaSeconds).toBe(0);
 expect(clock.tick(900000)).toBe(0);expect(clock.tick(900500)).toBeCloseTo(.05);expect(clock.elapsedSeconds).toBeCloseTo(.18);
 clock.setTimeScale(1);expect(clock.tick(900700)).toBeCloseTo(.2);expect(clock.elapsedSeconds).toBeCloseTo(.38);
 for(const value of [0,-1,NaN,Infinity])expect(()=>clock.setTimeScale(value)).toThrow();
 expect(clock.timeScale).toBe(1);
});
test('all frame consumers receive the same scaled delta and shader time across loop restarts',()=>{
 const pending=new Map();let serial=0;const motion={position:0},cooldown={remaining:1},effect={age:0};let shaderTime=0;
 const loop=new FrameLoop((delta,elapsed)=>{motion.position+=12*delta;cooldown.remaining-=delta;effect.age+=delta;shaderTime=elapsed;},fn=>{pending.set(++serial,fn);return serial;},id=>pending.delete(id));
 const fire=time=>{const [id,fn]=pending.entries().next().value;pending.delete(id);fn(time);};
 loop.clock.setTimeScale(.1);loop.start();fire(0);for(let frame=1;frame<=60;frame++)fire(frame*1000/60);
 expect(motion.position).toBeCloseTo(1.2);expect(cooldown.remaining).toBeCloseTo(.9);expect(effect.age).toBeCloseTo(.1);expect(shaderTime).toBeCloseTo(.1);
 loop.stop();loop.start();fire(60000);expect(effect.age).toBeCloseTo(.1);expect(loop.clock.timeScale).toBe(.1);
 loop.clock.setTimeScale(1);fire(61000);expect(motion.position).toBeCloseTo(13.2);expect(effect.age).toBeCloseTo(1.1);expect(shaderTime).toBeCloseTo(1.1);
 loop.stop();expect(pending.size).toBe(0);
});

test('smooth double speed integrates equally at every frame rate and reaches both endpoints',()=>{
 for(const hz of [30,60,120,144]){
  const c=new FrameClock();c.tick(0);c.setTimeScale(2,{transitionSeconds:.6});let last=1;
  for(let n=1;n<=hz;n++){c.tick(n*1000/hz);expect(c.timeScale).toBeGreaterThanOrEqual(last);expect(c.timeScale).toBeLessThanOrEqual(2);last=c.timeScale;}
  expect(c.timeScale).toBe(2);expect(c.elapsedSeconds).toBeCloseTo(1.7,10);
  c.setTimeScale(1,{transitionSeconds:.6});last=2;
  for(let n=hz+1;n<=hz*2;n++){c.tick(n*1000/hz);expect(c.timeScale).toBeLessThanOrEqual(last);expect(c.timeScale).toBeGreaterThanOrEqual(1);last=c.timeScale;}
  expect(c.timeScale).toBe(1);expect(c.elapsedSeconds).toBeCloseTo(3,10);
 }
});
test('reversing a ramp is continuous and pause/hidden time never advances it',()=>{
 const c=new FrameClock();c.tick(0);c.setTimeScale(2,{transitionSeconds:.6});c.tick(300);expect(c.timeScale).toBeCloseTo(1.5);
 c.setTimeScale(1,{transitionSeconds:.6});expect(c.timeScale).toBeCloseTo(1.5);c.tick(400);expect(c.timeScale).toBeLessThan(1.5);expect(c.timeScale).toBeGreaterThan(1);
 const scale=c.timeScale,elapsed=c.elapsedSeconds;c.resetDelta();expect(c.tick(900000)).toBe(0);expect(c.timeScale).toBe(scale);expect(c.elapsedSeconds).toBe(elapsed);c.tick(900500);expect(c.timeScale).toBe(1);
 for(const transitionSeconds of [-1,NaN,Infinity])expect(()=>c.setTimeScale(2,{transitionSeconds})).toThrow();
});
test('a long frame integrates the ramp and remaining time without truncation',()=>{
 const c=new FrameClock();c.tick(0);c.setTimeScale(2,{transitionSeconds:.6});expect(c.tick(3000)).toBeCloseTo(5.7,10);expect(c.timeScale).toBe(2);expect(c.unscaledDeltaSeconds).toBe(3);
 c.setTimeScale(1);expect(c.tick(4000)).toBe(1);expect(c.targetTimeScale).toBe(1);
});
