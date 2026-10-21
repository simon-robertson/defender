import {test,expect} from 'bun:test';
import {ArcEffects} from '../engine/arc-effects.js';
import {identity} from '../shared/math.js';
import {MAX_ARC_PRIMARY_STRIKES,MAX_ARC_STRIKES,MAX_ARC_SPARKS,ARC_TRUNK_SEGMENTS,ARC_INSTANCE_FLOATS,MAX_ARC_INSTANCES,ARC_LIGHT_FLOATS,ARC_SECONDS,ARC_SPARK_SECONDS,ARC_SPARK_REST_SECONDS,ARC_LIGHT_BYTES,ARC_WIDTH,ARC_LIGHT_STRENGTH} from '../shared/arc-effects.js';

const source=[0,35,0],impact=[64,12,0],normal=[-1,0,0];
const random=()=>{let seed=173;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};};
test('strike joins exact endpoints with one thicker unbranched channel, stronger light and six outward flecks',()=>{
 const effects=new ArcEffects(random());expect(effects.emit(source,impact,normal,0)).toBe(true);effects.prepare();
 expect(effects.strikeCount).toBe(1);expect(effects.lightCount).toBe(1);expect(effects.sparkCount).toBe(6);
 expect(effects.instanceCount-effects.sparkCount).toBe(ARC_TRUNK_SEGMENTS);
 expect(ARC_WIDTH).toBe(.9);expect(ARC_LIGHT_STRENGTH).toBe(4.8);expect(effects.instanceData[3]).toBeCloseTo(.9);expect(effects.lightData[8]).toBeCloseTo(4.8);
 expect(Array.from(effects.instanceData.slice(0,3))).toEqual(source);
 const last=(ARC_TRUNK_SEGMENTS-1)*ARC_INSTANCE_FLOATS;
 expect(Array.from(effects.instanceData.slice(last+4,last+7))).toEqual(impact);
 let bent=false;for(let segment=1;segment<ARC_TRUNK_SEGMENTS;segment++)if(Math.abs(effects.instanceData[segment*ARC_INSTANCE_FLOATS+2])>.01)bent=true;
 expect(bent).toBe(true);for(let i=0;i<6;i++)expect(effects.sparks[i*8+3]).toBeLessThan(0);
 expect(effects.lightData[9]).toBe(8);
 expect(Array.from(effects.lightData).every(Number.isFinite)).toBe(true);
});
test('endpoint attachment follows the live bone without retaining caller point scratch or moving its source',()=>{
 const effects=new ArcEffects(random()),matrix=identity(),local=[1,2,3],copy=[...source];
 matrix[12]=63;matrix[13]=10;matrix[14]=-3;
 effects.emit(copy,impact,normal,0,matrix,local);local.fill(999);copy.fill(999);matrix[12]+=4;
 effects.advance(.02);effects.prepare();const last=(ARC_TRUNK_SEGMENTS-1)*ARC_INSTANCE_FLOATS;
 expect(Array.from(effects.instanceData.slice(0,3))).toEqual(source);
 expect(Array.from(effects.instanceData.slice(last+4,last+7))).toEqual([68,12,0]);
 effects.advance(ARC_SECONDS);effects.prepare();expect(effects.attachments.every(value=>value===null)).toBe(true);expect(effects.strikeCount).toBe(0);
});
test('fixed pools replace the oldest strike and drop excess sparks without changing their backing storage',()=>{
 const effects=new ArcEffects(random()),instances=effects.instanceData,lights=effects.lightData,birth=effects.birth;
 for(let i=0;i<20;i++){effects.emit(source,impact,normal,effects.time);effects.advance(.001);}
 effects.prepare();expect(effects.strikeCount).toBe(MAX_ARC_PRIMARY_STRIKES);expect(effects.sparkCount).toBe(MAX_ARC_SPARKS);
 expect(effects.replacedStrikes).toBe(14);expect(effects.droppedSparks).toBe(24);
 expect(effects.instanceCount).toBeLessThanOrEqual(MAX_ARC_INSTANCES);expect(effects.lightData.byteLength).toBe(ARC_LIGHT_BYTES);
 expect(effects.instanceData).toBe(instances);expect(effects.lightData).toBe(lights);expect(effects.birth).toBe(birth);
});
test('expiry and reset remove lights, particles and attachment references without replay after stalls',()=>{
 const effects=new ArcEffects(random()),matrix=identity();effects.emit(source,impact,normal,0,matrix,impact);effects.prepare();
 effects.advance(2);effects.prepare();expect(effects.instanceCount).toBe(0);expect(effects.lightData[0]).toBe(0);expect(effects.needsCleanup).toBe(false);expect(effects.attachments.every(value=>value===null)).toBe(true);
 expect(effects.emit(source,impact,normal,0)).toBe(false);expect(effects.emit(source,impact,normal,3)).toBe(false);
 effects.emit(source,impact,normal,2,matrix,impact);effects.reset();effects.prepare();
 expect(effects.time).toBe(0);expect(effects.instanceCount).toBe(0);expect(effects.lightCount).toBe(0);expect(effects.attachments.every(value=>value===null)).toBe(true);
});
test('spark tail may remain after the channel but neither light nor attachments persist',()=>{
 const effects=new ArcEffects(random());effects.emit(source,impact,normal,0,identity(),impact);effects.advance(ARC_SECONDS+.001);effects.prepare();
 expect(effects.strikeCount).toBe(0);expect(effects.lightCount).toBe(0);expect(effects.sparkCount).toBe(6);expect(effects.instanceCount).toBe(6);
 expect(effects.attachments.every(value=>value===null)).toBe(true);effects.advance(ARC_SPARK_SECONDS);effects.prepare();expect(effects.instanceCount).toBe(0);
});
test('manual enemy reset can clear effects while preserving the shared firing clock',()=>{
 const effects=new ArcEffects(random());effects.advance(12);effects.emit(source,impact,normal,12);effects.reset(true);effects.prepare();
 expect(effects.time).toBe(12);expect(effects.instanceCount).toBe(0);expect(effects.emit(source,impact,normal,12)).toBe(true);effects.prepare();expect(effects.strikeCount).toBe(1);
});
test('shape is deterministic at equal elapsed time, with finite vertical and coincident inputs',()=>{
 const a=new ArcEffects(random()),b=new ArcEffects(random());a.emit(source,impact,normal,0);b.emit(source,impact,normal,0);
 a.advance(.06);for(let i=0;i<6;i++)b.advance(.01);a.prepare();b.prepare();expect(a.instanceData).toEqual(b.instanceData);expect(a.lightData).toEqual(b.lightData);
 const c=new ArcEffects(random());expect(c.emit(source,source,normal,0)).toBe(false);c.emit([0,0,0],[0,60,0],[0,-1,0],0);c.prepare();
 expect(Array.from(c.instanceData).every(Number.isFinite)).toBe(true);expect(Array.from(c.lightData).every(Number.isFinite)).toBe(true);
 expect(()=>c.advance(-1)).toThrow();expect(()=>c.advance(NaN)).toThrow();
});
test('coarse tube segment endpoints follow the same visible trunk and do not encode endpoint point lights',()=>{
 const effects=new ArcEffects(random());effects.emit(source,impact,normal,0);effects.prepare();
 for(let segment=0;segment<8;segment++){
  const light=4+8+segment*8,start=segment*4*ARC_INSTANCE_FLOATS,end=(segment*4+3)*ARC_INSTANCE_FLOATS;
  expect(Array.from(effects.lightData.slice(light,light+3))).toEqual(Array.from(effects.instanceData.slice(start,start+3)));
  expect(Array.from(effects.lightData.slice(light+4,light+7))).toEqual(Array.from(effects.instanceData.slice(end+4,end+7)));
 }
 expect(effects.lightData.length).toBe(4+MAX_ARC_STRIKES*ARC_LIGHT_FLOATS);
});

test('the connected terminal escape rises before the descending main channel',()=>{
 const e=new ArcEffects(random());e.emit([20,78,20],[75,32,48],[-1,0,0],0);e.prepare();
 for(let segment=0;segment<4;segment++){
  const k=segment*ARC_INSTANCE_FLOATS;expect(e.instanceData[k+5]).toBeGreaterThan(e.instanceData[k+1]);
  expect(e.instanceData[k+1]).toBeGreaterThanOrEqual(78);
 }
 const k=3*ARC_INSTANCE_FLOATS;expect(e.instanceData[k+5]).toBe(80);
 expect(Math.hypot(e.instanceData[k+4]-20,e.instanceData[k+6]-20)).toBeCloseTo(4);
 expect(e.instanceCount-e.sparkCount).toBe(32);
});

const groundWorld=height=>({visibility:{bounds:new Float32Array([-256,0,-256,256,height,256]),escape:new Uint32Array([1]),nodeCount:1}});
test('hot metal flecks fall onto actual support, remain still with finite nonzero geometry, then fade away',()=>{
 const e=new ArcEffects(()=>.5);e.setWorld(groundWorld(24));e.emit([0,78,0],[50,44,0],[-1,0,0],0);e.advance(.75);e.prepare();
 expect(e.sparkCount).toBe(6);expect(e.groundedCount).toBe(6);expect(e.strikeCount).toBe(0);
 const alpha=e.instanceData[7],x=e.sparks[0],y=e.sparks[1],z=e.sparks[2];
 expect(y).toBeCloseTo(24+e.sparks[6]*.35+.002);expect(alpha).toBeGreaterThan(0);
 for(let i=0;i<6;i++){
  const k=i*ARC_INSTANCE_FLOATS;expect(e.instanceData[k+8]).toBeGreaterThan(e.instanceData[k+9]);expect(e.instanceData[k+9]).toBeGreaterThan(e.instanceData[k+10]);
  expect(Math.hypot(e.instanceData[k+4]-e.instanceData[k],e.instanceData[k+5]-e.instanceData[k+1],e.instanceData[k+6]-e.instanceData[k+2])).toBeGreaterThan(0);
 }
 expect(Array.from(e.instanceData).every(Number.isFinite)).toBe(true);e.advance(.1);e.prepare();
 expect(e.groundedCount).toBe(6);expect(e.sparks[0]).toBe(x);expect(e.sparks[1]).toBe(y);expect(e.sparks[2]).toBe(z);expect(e.instanceData[7]).toBeLessThan(alpha);
 e.advance(ARC_SPARK_REST_SECONDS);e.prepare();expect(e.sparkCount).toBe(0);expect(e.groundedCount).toBe(0);expect(e.needsCleanup).toBe(false);
});

test('swept flecks cannot tunnel through elevated ground after fast travel or a frame stall',()=>{
 const e=new ArcEffects(()=>.5);e.setWorld(groundWorld(36));e.emit([0,90,0],[50,200,0],[-1,0,0],0);e.sparks[4]=-6000;e.advance(.04);e.prepare();
 expect(e.sparkRest[0]).toBeGreaterThanOrEqual(0);expect(e.sparks[1]).toBeCloseTo(36+e.sparks[6]*.35+.002);expect(e.sparks[4]).toBe(0);
 const stalled=new ArcEffects(()=>.5);stalled.setWorld(groundWorld(24));stalled.emit([0,78,0],[50,44,0],[-1,0,0],0);stalled.advance(.8);stalled.prepare();
 expect(stalled.groundedCount).toBe(6);expect(stalled.sparkCount).toBe(6);stalled.advance(4);stalled.prepare();expect(stalled.sparkCount).toBe(0);expect(stalled.needsCleanup).toBe(false);
});

test('reset preserves the collider only for the in-place reset and releases every scene reference on unload',()=>{
 const world=groundWorld(24),next=groundWorld(36),e=new ArcEffects(()=>.5);e.setWorld(world);e.advance(10);e.emit(source,impact,normal,10,identity(),impact);e.reset(true);
 expect(e.time).toBe(10);expect(e.visibility).toBe(world.visibility);expect(e.attachments.every(v=>v===null)).toBe(true);expect(e.sparkBirth.every(v=>v===-Infinity)).toBe(true);
 e.setWorld(next);expect(e.visibility).toBe(next.visibility);expect(e.time).toBe(0);e.reset();expect(e.visibility).toBe(null);expect(e.groundedCount).toBe(0);
});

test('reserved secondary bank remains visible under primary saturation and follows both enemies',()=>{
 const e=new ArcEffects(random()),mat=identity(),from=identity(),bytes=[e.instanceData.byteLength,e.lightData.byteLength];
 for(let i=0;i<MAX_ARC_PRIMARY_STRIKES;i++){
  expect(e.emit([i,60,0],[i+20,30,0],[-1,0,0],0,mat,[i+20,30,0])).toBe(true);
  expect(e.emit([i+20,30,0],[i+30,30,0],[-1,0,0],0,mat,[i+30,30,0],true,from,[i+20,30,0])).toBe(true);
 }
 e.prepare();expect(e.strikeCount).toBe(MAX_ARC_STRIKES);expect(Array.from(e.secondary).filter(Boolean)).toHaveLength(MAX_ARC_PRIMARY_STRIKES);expect(e.droppedChainStrikes).toBe(0);
 const primaries=[...e.ends.slice(0,MAX_ARC_PRIMARY_STRIKES*6)];
 expect(e.emit(source,impact,normal,0,mat,impact,true,from,source)).toBe(true);expect([...e.ends.slice(0,MAX_ARC_PRIMARY_STRIKES*6)]).toEqual(primaries);
 from[12]=3;mat[14]=4;e.prepare();const k=MAX_ARC_PRIMARY_STRIKES*6;expect(e.ends[k]).toBe(source[0]+3);expect(e.ends[k+5]).toBe(impact[2]+4);
 expect([e.instanceData.byteLength,e.lightData.byteLength]).toEqual(bytes);
 e.reset(true);expect(e.droppedChainStrikes).toBe(0);expect(e.attachments.every(v=>v===null)).toBe(true);expect(e.sourceAttachments.every(v=>v===null)).toBe(true);
 expect(e.emit(source,impact,normal,0,mat,impact,true,from,source)).toBe(true);e.advance(ARC_SECONDS);e.prepare();expect(e.strikeCount).toBe(0);expect(e.sourceAttachments.every(v=>v===null)).toBe(true);
});
