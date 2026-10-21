import {test,expect} from 'bun:test';
import {PlasmaLinks} from '../engine/plasma-links.js';
import {PLAY_CONFIG} from '../play/config.js';
import {MAX_PLASMA_LINKS,PLASMA_SEGMENTS,PLASMA_NODES,PLASMA_LIGHT_FLOATS,PLASMA_LIGHT_SEGMENTS,PLASMA_LIGHT_STRENGTH,PLASMA_WIDTH,PLASMA_MOTION_RATE,PLASMA_WAVE_AMPLITUDE,PLASMA_WAVE_LENGTH_RATIO} from '../shared/plasma-links.js';

const link=()=>({source:new Float64Array([77,34.5,155.5]),target:new Float64Array([65,35.5,155.5])});
test('plasma capacity covers every affordable campaign generator with four neighbours',()=>{
 const waves=PLAY_CONFIG.levels.reduce((sum,level)=>sum+level.waves.length,0),budget=PLAY_CONFIG.startTokens+(waves-1)*PLAY_CONFIG.waveReward;
 expect(MAX_PLASMA_LINKS).toBeGreaterThanOrEqual(Math.floor(budget/PLAY_CONFIG.defences['power-generator'].purchaseCost)*4);
});
test('plasma copies fixed endpoints and packs an unbroken green channel with full-length light spans',()=>{
 const effects=new PlasmaLinks(),input=link(),a=Array.from(input.source),b=Array.from(input.target);effects.setLinks([input]);input.source.fill(-99);input.target.fill(99);
 expect(effects.linkCount).toBe(1);expect(effects.instanceCount).toBe(PLASMA_SEGMENTS);expect(effects.lightCount).toBe(1);expect(effects.overflow).toBe(0);
 for(let sample=0;sample<20;sample++){
  effects.advance(.137);effects.prepare();expect(Array.from(effects.points.slice(0,3))).toEqual(a);expect(Array.from(effects.points.slice(PLASMA_SEGMENTS*3,PLASMA_NODES*3))).toEqual(b);
  for(let i=0;i<PLASMA_SEGMENTS;i++){
   const k=i*12,d=effects.instanceData;expect(d[k+3]).toBeCloseTo(PLASMA_WIDTH);expect(d[k+9]).toBe(1);expect(d[k+11]).toBe(2);
   if(i+1<PLASMA_SEGMENTS)for(let axis=0;axis<3;axis++)expect(d[k+4+axis]).toBe(d[k+12+axis]);
  }
  const l=effects.lightData;expect(l[0]).toBe(1);expect(l[8]).toBeCloseTo(PLASMA_LIGHT_STRENGTH);expect(l[9]).toBe(PLASMA_LIGHT_SEGMENTS);
  for(let i=0;i<PLASMA_LIGHT_SEGMENTS;i++)for(let axis=0;axis<3;axis++){
   expect(l[12+i*8+axis]).toBeCloseTo(effects.points[i*12+axis],4);expect(l[16+i*8+axis]).toBeCloseTo(effects.points[(i+1)*12+axis],4);
  }
 }
 expect(effects.time).toBeCloseTo(2.74);
});

test('smooth wave motion stays bounded and handles vertical or very short links without degeneracy',()=>{
 const effects=new PlasmaLinks();
 for(const target of [[12,0,0],[0,12,0],[0,0,12],[.01,0,0]]){
  effects.setLinks([{source:[0,0,0],target}]);effects.reset();const before=effects.points.slice(0,PLASMA_NODES*3);
  effects.advance(.001);effects.prepare();const length=Math.hypot(...target),bound=Math.min(.6,length*.05)*1.1;
  for(let i=0;i<=PLASMA_SEGMENTS;i++){
   const t=i/PLASMA_SEGMENTS,k=i*3,p=effects.points,dx=p[k]-target[0]*t,dy=p[k+1]-target[1]*t,dz=p[k+2]-target[2]*t;
   expect(Math.hypot(dx,dy,dz)).toBeLessThanOrEqual(bound);expect(Math.hypot(p[k]-before[k],p[k+1]-before[k+1],p[k+2]-before[k+2])).toBeLessThan(.01);
  }
  expect(effects.instanceData.every(Number.isFinite)).toBe(true);expect(effects.lightData.every(Number.isFinite)).toBe(true);
 }
});

test('link overflow is bounded and reported, with fixed buffers reused across replacement and frames',()=>{
 const effects=new PlasmaLinks(),arrays=[effects.ends,effects.geometry,effects.points,effects.instanceData,effects.lightData],warning=console.warn,records=[];
 console.warn=message=>records.push(message);
 try{effects.setLinks(Array.from({length:MAX_PLASMA_LINKS+3},link));}finally{console.warn=warning;}
 expect(records).toHaveLength(1);expect(records[0]).toContain('3 connections');expect(effects.requestedCount).toBe(MAX_PLASMA_LINKS+3);expect(effects.linkCount).toBe(MAX_PLASMA_LINKS);expect(effects.overflow).toBe(3);
 expect(effects.instanceCount).toBe(MAX_PLASMA_LINKS*PLASMA_SEGMENTS);expect(effects.lightData.length).toBe(4+MAX_PLASMA_LINKS*PLASMA_LIGHT_FLOATS);
 for(let i=0;i<20;i++){effects.advance(1/60);effects.prepare();}
 effects.setLinks([link()]);expect(effects.overflow).toBe(0);expect(effects.instanceCount).toBe(PLASMA_SEGMENTS);
 expect([effects.ends,effects.geometry,effects.points,effects.instanceData,effects.lightData].every((array,i)=>array===arrays[i])).toBe(true);
 expect(effects.byteLength).toBe(arrays.reduce((bytes,array)=>bytes+array.byteLength,0));
});

test('reset changes phase only; empty replacement and disposal remove every visible/light instance',()=>{
 const effects=new PlasmaLinks();effects.setLinks([link()]);const initial=effects.points.slice();effects.advance(.5);effects.prepare();expect(effects.points).not.toEqual(initial);
 effects.reset();expect(effects.time).toBe(0);expect(effects.linkCount).toBe(1);expect(effects.points).toEqual(initial);
 effects.setLinks([]);expect(effects.instanceCount).toBe(0);expect(effects.lightCount).toBe(0);expect(effects.lightData[0]).toBe(0);
 effects.setLinks([link()]);effects.dispose();expect(effects.requestedCount).toBe(0);expect(effects.linkCount).toBe(0);expect(effects.instanceCount).toBe(0);expect(effects.lightData.every(n=>n===0)).toBe(true);expect(effects.ends.every(n=>n===0)).toBe(true);
 effects.advance(1);effects.prepare();expect(effects.instanceCount).toBe(0);expect(effects.lightCount).toBe(0);
});

test('invalid data and timing fail before changing a valid link set',()=>{
 const effects=new PlasmaLinks();effects.setLinks([link()]);const ends=effects.ends.slice();
 for(const input of [null,{},[{}],[{source:[0,1],target:[1,2,3]}],[{source:[0,0,0],target:[NaN,2,3]}],[{source:[0,0,0],target:[0,0,0]}]])expect(()=>effects.setLinks(input)).toThrow();
 for(const delta of [-1,NaN,Infinity])expect(()=>effects.advance(delta)).toThrow();expect(effects.ends).toEqual(ends);expect(effects.linkCount).toBe(1);expect(effects.time).toBe(0);
});

test('factored wave math matches the original formula across orientations and long running phases',()=>{
 const effects=new PlasmaLinks(),records=[link(),{source:[0,0,0],target:[0,12,0]},{source:[-40,3,81],target:[-39.99,3,81]},{source:[2,5,-13],target:[2,5,10]}];effects.setLinks(records);
 for(const time of [0,.001,.14,1,10,100,1000]){
  effects.time=time;effects.prepare();
  for(let slot=0;slot<records.length;slot++){
   const {source:a,target:b}=records[slot],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz),tx=dx/length,ty=dy/length,tz=dz/length;
   let ux=ty,uy=-tx,uz=0;if(Math.abs(tz)>.9){ux=0;uy=tz;uz=-ty;}const ul=Math.hypot(ux,uy,uz);ux/=ul;uy/=ul;uz/=ul;
   const vx=ty*uz-tz*uy,vy=tz*ux-tx*uz,vz=tx*uy-ty*ux,phase=time*PLASMA_MOTION_RATE+slot*2.399963,amplitude=Math.min(PLASMA_WAVE_AMPLITUDE,length*PLASMA_WAVE_LENGTH_RATIO);
   for(let node=1;node<PLASMA_SEGMENTS;node++){
    const t=node/PLASMA_SEGMENTS,envelope=Math.sin(t*Math.PI),wa=amplitude*envelope*(.74*Math.sin(t*Math.PI*2*1.3-phase)+.26*Math.sin(t*Math.PI*2*2.1+phase*.63)),wb=amplitude*envelope*.45*Math.sin(t*Math.PI*2*1.1+phase*.81),k=(slot*PLASMA_NODES+node)*3;
    expect(effects.points[k]).toBeCloseTo(a[0]+dx*t+ux*wa+vx*wb,9);expect(effects.points[k+1]).toBeCloseTo(a[1]+dy*t+uy*wa+vy*wb,9);expect(effects.points[k+2]).toBeCloseTo(a[2]+dz*t+uz*wa+vz*wb,9);
   }
  }
 }
});
