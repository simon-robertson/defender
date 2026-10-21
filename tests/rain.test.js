import {test,expect} from 'bun:test';
import {RainField,staticRainTop,MAX_RAIN_DROPS,RAIN_INSTANCE_FLOATS,RAIN_HEIGHT,RAIN_SPEED,RAIN_LENGTH,RAIN_WIDTH} from '../engine/rain.js';
import {SceneryVisibility} from '../engine/visibility.js';
import {WorldRenderer} from '../engine/renderer.js';
import {newLevel} from '../shared/level.js';
import {newModel} from '../shared/model.js';
import {TerrainField} from '../shared/terrain.js';

function fixture(){
 const model=newModel('roof');model.role='scenery';
 for(let z=4;z<20;z++)for(let x=4;x<20;x++)if(!(x>=10&&x<14&&z>=10&&z<14))model.variants.base.parts[0].voxels.push([x,10,z,0]);
 const level=newLevel('rain-check');level.size=[2,2];level.placements=[{id:'roof',model:'roof',variant:'base',box:[0,0,0],turn:0}];
 level.terrain.boxes=[{box:[1,0],ground:4,water:12},{box:[1,1],ground:32,water:0}];
 return {level,width:48,length:48,weather:{type:'rain',enabled:true},visibility:new SceneryVisibility(level,new Map([['roof',model]]))};
}

test('rain columns terminate at exact roof, ground and water heights while preserving real sky openings',()=>{
 const world=fixture(),field=new TerrainField(world.level),rain=new RainField(world);
 expect(staticRainTop(world.visibility,5.5,5.5)).toBe(35);expect(staticRainTop(world.visibility,11.5,11.5)).toBe(24);
 expect(staticRainTop(world.visibility,25,25)).toBe(32);expect(staticRainTop(world.visibility,25,5)).toBe(4);
 let waterColumns=0;
 for(let i=0;i<rain.count;i++){
  const at=i*RAIN_INSTANCE_FLOATS,a=rain.instanceData,x=a[at],z=a[at+1],lower=a[at+2];
  expect(x).toBeGreaterThan(0);expect(x).toBeLessThan(world.width);expect(z).toBeGreaterThan(0);expect(z).toBeLessThan(world.length);
  expect(lower).toBe(Math.max(staticRainTop(world.visibility,x,z),field.height(x,z,true)));
  if(x>24&&z<24){expect(lower).toBe(12);waterColumns++;}
  expect(a[at+3]).toBeGreaterThanOrEqual(0);expect(a[at+3]).toBeLessThan(RAIN_HEIGHT);
  expect(a[at+4]).toBeCloseTo(RAIN_LENGTH,6);expect(a[at+5]).toBeCloseTo(RAIN_WIDTH,6);
  // The production shader keeps the lowest streak tip at/above this surface.
  for(const phase of [0,3,RAIN_HEIGHT-.0001]){
   const tip=lower+RAIN_HEIGHT-((a[at+3]+phase)%RAIN_HEIGHT),tail=Math.min(tip+a[at+4],lower+RAIN_HEIGHT);
   expect(tip).toBeGreaterThanOrEqual(lower);expect(tail).toBeLessThanOrEqual(lower+RAIN_HEIGHT);
  }
 }
 expect(waterColumns).toBeGreaterThan(0);
});

test('rain is authored, bounded and deterministic; disabled and clear levels allocate no particle data',()=>{
 const world=fixture(),a=new RainField(world),b=new RainField(world);expect(a.count).toBe(40);expect(a.instanceData).toEqual(b.instanceData);
 expect(a.byteLength).toBe(a.count*RAIN_INSTANCE_FLOATS*4);
 for(const weather of [{type:'rain',enabled:false},{type:'clear',enabled:false},undefined]){
  const off=new RainField({...world,weather});expect(off.count).toBe(0);expect(off.byteLength).toBe(0);off.advance(1);expect(off.phase).toBe(0);
 }
 const level=newLevel('large-rain');level.size=[128,128];
 const large=new RainField({level,width:3072,length:3072,weather:world.weather,visibility:{bounds:new Float32Array([0,0,0,3072,24,3072]),escape:new Uint32Array([1]),nodeCount:1}});
 expect(large.count).toBe(MAX_RAIN_DROPS);expect(large.byteLength).toBe(MAX_RAIN_DROPS*RAIN_INSTANCE_FLOATS*4);
});

test('shared delta seconds drive seamless bounded phase independently of frame subdivisions without changing seeds',()=>{
 const world=fixture(),whole=new RainField(world),split=new RainField(world),data=split.instanceData,copy=data.slice();
 const duration=7.139;whole.advance(duration);for(let i=0;i<1000;i++)split.advance(duration/1000);
 expect(split.time).toBeCloseTo(whole.time,10);expect(split.phase).toBeCloseTo(whole.phase,10);expect(whole.phase).toBeCloseTo((duration*RAIN_SPEED)%RAIN_HEIGHT,10);
 expect(split.instanceData).toBe(data);expect(data).toEqual(copy);
 const previous=split.phase;split.advance(RAIN_HEIGHT/RAIN_SPEED);expect(split.phase).toBeCloseTo(previous,10);
 split.advance(1e9);expect(split.phase).toBeGreaterThanOrEqual(0);expect(split.phase).toBeLessThan(RAIN_HEIGHT);
 for(const delta of [-1,NaN,Infinity])expect(()=>split.advance(delta)).toThrow();
});

test('scene cleanup destroys the rain GPU buffer and releases CPU seeds before a replacement world',()=>{
 const rain=new RainField(fixture());let destroyed=0;
 const renderer=Object.assign(Object.create(WorldRenderer.prototype),{sceneBuffers:new Set([{destroy:()=>destroyed++}]),destroyedSceneBuffers:0,rain,rainInstances:{},rainBytes:rain.byteLength,draws:[],drawMap:new Map(),bytes:100});
 renderer.clearGeometry();expect(destroyed).toBe(1);expect(renderer.destroyedSceneBuffers).toBe(1);expect(renderer.sceneBuffers.size).toBe(0);
 expect(renderer.rain).toBeNull();expect(renderer.rainInstances).toBeNull();expect(renderer.rainBytes).toBe(0);expect(rain.instanceData).toBeNull();expect(rain.count).toBe(0);
 rain.advance(1);expect(rain.phase).toBe(0);renderer.clearGeometry();expect(destroyed).toBe(1);
});
