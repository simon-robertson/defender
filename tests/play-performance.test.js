import {test,expect} from 'bun:test';
import {FramePerformance} from '../play/performance.js';

test('performance separates wall frame interval from full app CPU time and renderer diagnostic and limits DOM updates',()=>{
 const element={textContent:''},p=new FramePerformance(element);p.setRunning(true);
 p.sample(0,900);expect(p.stats().samples).toBe(0);
 for(let i=0;i<120;i++)p.sample(1/60,2);
 expect(p.stats().fps).toBeCloseTo(60,6);expect(p.stats().frameMs).toBeCloseTo(1000/60,6);expect(p.stats().cpuRenderMs).toBeCloseTo(2,6);
 expect(element.textContent).toBe('60 FPS · 16.7 ms/frame · 2.0 ms CPU app · GPU unsupported');expect(p.count).toBeLessThanOrEqual(61);
 for(let i=0;i<60;i++)p.sample(1/30,4);
 expect(p.stats().fps).toBeCloseTo(30,6);expect(p.stats().cpuRenderMs).toBeCloseTo(4,6);
 p.sample(2,10);expect(p.stats().fps).toBeCloseTo(.5,6);expect(p.stats().samples).toBe(1);
 for(let i=0;i<120;i++)p.sample(1/60,2);expect(p.stats().fps).toBeCloseTo(60,6);
});

test('pause/loading/hidden resets measurements and first resumed zero frame cannot count idle time',()=>{
 const element={textContent:''},p=new FramePerformance(element);p.setRunning(true);p.sample(.5,3);expect(p.stats().samples).toBe(1);
 p.setRunning(false,'Paused');expect(element.textContent).toBe('Paused');expect(p.stats().fps).toBeNull();p.sample(20,50);expect(p.stats().samples).toBe(0);
 p.setRunning(true);p.sample(0,2);expect(p.stats().samples).toBe(0);
 for(let i=0;i<30;i++)p.sample(1/60,1);expect(p.stats().fps).toBeCloseTo(60,6);
 p.setRunning(true);expect(p.stats().samples).toBe(30);
 for(const dt of [NaN,Infinity,-1])p.sample(dt,1);expect(p.stats().samples).toBe(30);
 p.setRunning(false);expect(element.textContent).toBe('Idle');
});


test('app callback CPU includes simulation and UI while GPU is a separate sampled asynchronous average',()=>{
 const element={textContent:''},p=new FramePerformance(element);p.setRunning(true);
 for(let i=0;i<60;i++)p.sample(1/60,4,{status:'ready',ms:8,samples:9},.75);
 expect(p.stats()).toMatchObject({cpuFrameMs:4,cpuRenderMs:.75,gpuMs:8,gpuStatus:'ready',gpuSamples:9});
 expect(element.textContent).toBe('60 FPS · 16.7 ms/frame · 4.0 ms CPU app · 8.0 ms GPU');
 for(const status of ['pending','stale','unsupported','unavailable']){for(let i=0;i<20;i++)p.sample(1/60,2,{status,ms:null,samples:0},.5);expect(p.stats().gpuMs).toBeNull();expect(element.textContent).toContain('GPU '+status);}
 p.setRunning(false,'Paused');expect(p.stats()).toMatchObject({cpuFrameMs:null,cpuRenderMs:null,gpuMs:null,gpuStatus:'idle',gpuSamples:0});expect(element.textContent).toBe('Paused');
});
