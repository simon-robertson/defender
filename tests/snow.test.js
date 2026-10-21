import {test,expect} from 'bun:test';
import {SnowField,snowPosition,snowTriangle,MAX_SNOW_FLAKES,SNOW_INSTANCE_FLOATS,SNOW_FALL_SPEED,SNOW_DRIFT_X,SNOW_DRIFT_Z,SNOW_SIDE_X,SNOW_SIDE_Z,SNOW_FLUTTER_CYCLES} from '../engine/snow.js';
import {SceneryVisibility} from '../engine/visibility.js';
import {WorldRenderer} from '../engine/renderer.js';
import {newLevel} from '../shared/level.js';
import {newModel} from '../shared/model.js';

function fixture(){
 const model=newModel('snow-roof');model.role='scenery';
 for(let z=2;z<22;z++)for(let x=2;x<22;x++)if(!(x>=10&&x<14&&z>=10&&z<14))model.variants.base.parts[0].voxels.push([x,16,z,0]);
 const level=newLevel('snow-check');level.size=[4,3];level.placements=[{id:'roof',model:model.id,variant:'base',box:[1,0,1],turn:0}];
 level.terrain.boxes=[{box:[2,1],ground:4,water:12},{box:[3,1],ground:32,water:0}];
 return {level,width:96,length:72,weather:{type:'snow',enabled:true},visibility:new SceneryVisibility(level,new Map([[model.id,model]]))};
}

function occupied(world){
 const result=[],v=world.visibility;
 for(let node=0;node<v.nodeCount;node++)if(v.escape[node]===node+1)result.push(Array.from(v.bounds.subarray(node*6,node*6+6)));
 for(const box of world.level.terrain.boxes)if(box.water)result.push([box.box[0]*24,box.water,box.box[1]*24,(box.box[0]+1)*24,box.water,(box.box[1]+1)*24]);
 return result;
}
function intersects(point,radius,box){return point[0]>box[0]-radius+1e-7&&point[0]<box[3]+radius-1e-7&&point[1]>box[1]-radius+1e-7&&point[1]<box[4]+radius-1e-7&&point[2]>box[2]-radius+1e-7&&point[2]<box[5]+radius-1e-7;}

test('precomputed snow trajectories stop before scenery, ground and water for the complete flake radius',()=>{
 const world=fixture(),snow=new SnowField(world),boxes=occupied(world),point=new Float64Array(3);let roofStops=0,waterStops=0,groundStops=0;
 for(let i=0;i<snow.count;i++){
  const at=i*SNOW_INSTANCE_FLOATS,data=snow.instanceData,life=data[at+5],radius=data[at+4];
  expect(life).toBeGreaterThan(0);expect(life).toBeLessThanOrEqual(snow.cycleSeconds);
  for(let step=0;step<=40;step++){
   snowPosition(point,data,at,life*step/40);
   expect(boxes.some(box=>intersects(point,radius,box))).toBe(false);
  }
  snowPosition(point,data,at,life);
  if(point[0]>26&&point[0]<46&&point[2]>26&&point[2]<46&&point[1]>40)roofStops++;
  if(point[0]>48&&point[0]<72&&point[2]>24&&point[2]<48&&point[1]<13&&point[1]>12)waterStops++;
  if(point[0]>0&&point[0]<96&&point[2]>0&&point[2]<72&&point[1]>24&&point[1]<25)groundStops++;
 }
 expect(roofStops).toBeGreaterThan(0);expect(waterStops).toBeGreaterThan(0);expect(groundStops).toBeGreaterThan(0);
 expect(snow.tracedSegments).toBeLessThanOrEqual(snow.count*(SNOW_FLUTTER_CYCLES*2+2));
});

test('snow falls without net sideways drift and keeps bounded continuous flutter',()=>{
 const snow=new SnowField(fixture()),data=snow.instanceData,point=new Float64Array(3),before=new Float64Array(3),after=new Float64Array(3);
 expect(SNOW_DRIFT_X).toBe(0);expect(SNOW_DRIFT_Z).toBe(0);expect(Math.hypot(SNOW_SIDE_X,SNOW_SIDE_Z)).toBeCloseTo(1,12);
 expect(snowTriangle(0)).toBe(-1);expect(snowTriangle(.5)).toBe(1);expect(snowTriangle(1)).toBe(-1);
 for(let i=0;i<12;i++){
  const at=i*SNOW_INSTANCE_FLOATS,period=data[at+11],amplitude=data[at+6],seed=data[at+7];
  for(let cycle=1;cycle<=SNOW_FLUTTER_CYCLES;cycle++){
   snowPosition(point,data,at,period*cycle);
   expect(point[0]).toBeCloseTo(data[at],8);expect(point[2]).toBeCloseTo(data[at+2],8);expect(point[1]-data[at+1]).toBeCloseTo(-SNOW_FALL_SPEED*period*cycle,8);
  }
  let maxExcursion=0;
  for(let phase=0;phase<=16;phase++){
   const time=phase/16*period;snowPosition(point,data,at,time);
   const dx=point[0]-data[at],dz=point[2]-data[at+2];maxExcursion=Math.max(maxExcursion,Math.hypot(dx,dz));
   expect(Math.hypot(dx,dz)).toBeLessThanOrEqual(2*amplitude+1e-10);expect(dx*SNOW_SIDE_Z-dz*SNOW_SIDE_X).toBeCloseTo(0,8);
  }
  expect(maxExcursion).toBeGreaterThan(amplitude*.8);
  const turn=((Math.floor(seed*2)+1)*.5-seed)*period;
  snowPosition(before,data,at,turn-1e-8);snowPosition(after,data,at,turn+1e-8);
  expect(Math.hypot(after[0]-before[0],after[1]-before[1],after[2]-before[2])).toBeLessThan(1e-5);
 }
});

test('symmetric flutter padding reaches all level edges at low altitude with a bounded field',()=>{
 const world=fixture(),snow=new SnowField(world),point=new Float64Array(3);let outsideStarts=0,westLow=0,eastLow=0,northLow=0,southLow=0;
 for(let i=0;i<snow.count;i++){
  const at=i*SNOW_INSTANCE_FLOATS,data=snow.instanceData;
  if(data[at]<0||data[at+2]<0)outsideStarts++;
  const age=(data[at+1]-30)/SNOW_FALL_SPEED;if(age>=data[at+5])continue;snowPosition(point,data,at,age);
  if(point[2]>0&&point[2]<world.length){if(point[0]>0&&point[0]<24)westLow++;if(point[0]>world.width-24&&point[0]<world.width)eastLow++;}
  if(point[0]>0&&point[0]<world.width){if(point[2]>0&&point[2]<24)northLow++;if(point[2]>world.length-24&&point[2]<world.length)southLow++;}
 }
 expect(outsideStarts).toBeGreaterThan(0);expect(westLow).toBeGreaterThan(0);expect(eastLow).toBeGreaterThan(0);expect(northLow).toBeGreaterThan(0);expect(southLow).toBeGreaterThan(0);
 expect(snow.count).toBe(336);expect(snow.byteLength).toBe(336*48);
});

test('snow phase uses shared seconds and wraps whole trajectories without changing seed storage',()=>{
 const world=fixture(),whole=new SnowField(world),split=new SnowField(world),data=split.instanceData,snapshot=data.slice();
 whole.advance(15.317);for(let i=0;i<1000;i++)split.advance(15.317/1000);
 expect(split.time).toBeCloseTo(whole.time,9);expect(split.phase).toBeCloseTo(whole.phase,9);
 const phase=split.phase;split.advance(split.cycleSeconds);expect(split.phase).toBeCloseTo(phase,10);
 split.advance(split.cycleSeconds*1e6);expect(split.phase).toBeCloseTo(phase,7);expect(split.instanceData).toBe(data);expect(data).toEqual(snapshot);
 for(const delta of [-1,Infinity,NaN])expect(()=>split.advance(delta)).toThrow();
});

test('snow is deterministic, capped, and absent in rain, clear or disabled weather',()=>{
 const world=fixture(),first=new SnowField(world),second=new SnowField(world);expect(first.instanceData).toEqual(second.instanceData);
 for(const weather of [{type:'rain',enabled:true},{type:'clear',enabled:false},{type:'snow',enabled:false},undefined]){
  const off=new SnowField({...world,weather});expect(off.count).toBe(0);expect(off.byteLength).toBe(0);off.advance(2);expect(off.phase).toBe(0);
 }
 const level=newLevel('large-snow');level.size=[128,128];
 const large=new SnowField({level,width:3072,length:3072,weather:world.weather,visibility:{bounds:new Float32Array([0,0,0,3072,24,3072]),escape:new Uint32Array([1]),nodeCount:1}});
 expect(large.count).toBe(MAX_SNOW_FLAKES);expect(large.byteLength).toBe(MAX_SNOW_FLAKES*48);expect(large.tracedSegments).toBeLessThanOrEqual(MAX_SNOW_FLAKES*18);
 expect(()=>new SnowField({...world,visibility:null})).toThrow('visibility');
});

test('scene cleanup destroys snow storage and releases all CPU data before a replacement world',()=>{
 const snow=new SnowField(fixture());let destroyed=0;
 const renderer=Object.assign(Object.create(WorldRenderer.prototype),{sceneBuffers:new Set([{destroy:()=>destroyed++}]),destroyedSceneBuffers:0,snow,snowInstances:{},snowBytes:snow.byteLength,draws:[],drawMap:new Map(),bytes:0});
 renderer.clearGeometry();expect(destroyed).toBe(1);expect(renderer.destroyedSceneBuffers).toBe(1);expect(renderer.sceneBuffers.size).toBe(0);expect(renderer.snow).toBeNull();expect(renderer.snowInstances).toBeNull();expect(renderer.snowBytes).toBe(0);
 expect(snow.instanceData).toBeNull();expect(snow.count).toBe(0);expect(snow.cycleSeconds).toBe(0);snow.advance(1);expect(snow.phase).toBe(0);renderer.clearGeometry();expect(destroyed).toBe(1);
});
