import {test,expect} from 'bun:test';
import {SceneryVisibility} from '../engine/visibility.js';
import {newLevel} from '../shared/level.js';
import {newModel} from '../shared/model.js';
import {identity} from '../shared/math.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {MAX_SHOT_INSTANCES} from '../shared/shot-effects.js';
test('other defence solids block rays, while self-exclusion, real gaps, pose changes and removal remain exact',()=>{
 const level=newLevel('defence-sight'),model=newModel('sight-blocker');level.size=[3,3];model.role='defence';model.variants.base.parts[0].voxels=[];
 for(let x=11;x<13;x++)for(let y=0;y<14;y++)for(let z=4;z<20;z++)if(!(y<9&&z>=9&&z<15))model.variants.base.parts[0].voxels.push([x,y,z,0]);
 level.placements=[{id:'other',model:model.id,variant:'base',box:[1,0,1],turn:0}];const models=new Map([[model.id,model]]),m=identity();m[12]=m[13]=m[14]=24;
 const v=new SceneryVisibility(level,models);v.setDefences(level,models,new Map([['other',{instances:[{part:'body',matrix:m}]}]]));
 const hit=new Float64Array(7);expect(v.sweepDefences(20,28.5,32,52,28.5,32,.2,'gun',hit)).toBeLessThan(1);expect(hit[1]).toBeCloseTo(35);expect(hit[4]).toBe(-1);expect(v.sweepDefences(20,28.5,32,52,28.5,32,.2,'other',hit)).toBe(Infinity);expect(v.sweepDefences(20,28.5,36,52,28.5,36,.2,'gun',hit)).toBe(Infinity);
 expect(v.clear(20,28.5,32,52,28.5,32,'gun')).toBe(false);expect(v.clear(20,28.5,32,52,28.5,32,'other')).toBe(true);
 expect(v.clear(20,28.5,36,52,28.5,36,'gun')).toBe(true);expect(v.clear(20,34.5,36,52,34.5,36,'gun')).toBe(false);
 m[12]+=100;expect(v.sweepDefences(20,28.5,32,52,28.5,32,.2,'gun',hit)).toBe(Infinity);expect(v.clear(20,34.5,36,52,34.5,36,'gun')).toBe(true);m[12]-=100;v.setDefences({...level,placements:[]},models,new Map());expect(v.clear(20,34.5,36,52,34.5,36,'gun')).toBe(true);v.dispose();
});

test('bullet contact sparks originate on the supplied surface and use bounded storage, pause time and cleanup',()=>{
 const s=new ShotEffects(()=>.5),point=[50,35,80];s.impact(point,[1,0,0]);s.prepare();expect(s.sparkCount).toBe(10);expect(s.lightCount).toBe(0);
 for(let i=0;i<s.instanceCount;i++){expect(s.instanceData[i*16]).toBeCloseTo(50.15,4);expect(s.instanceData[i*16+1]).toBe(35);expect(s.instanceData[i*16+2]).toBe(80);}
 s.advance(.1);s.prepare();expect(s.instanceData[0]).toBeGreaterThan(50.15);for(let i=0;i<40;i++)s.impact(point,[1,0,0]);s.prepare();expect(s.instanceCount).toBeLessThanOrEqual(MAX_SHOT_INSTANCES);expect(s.droppedSparks).toBeGreaterThan(0);
 s.advance(.4);s.prepare();expect(s.instanceCount).toBe(0);s.reset();expect(s.needsCleanup).toBe(false);
});

