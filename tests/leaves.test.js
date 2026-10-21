import {test,expect} from 'bun:test';
import {LeafField,leafPosition,leafAxes} from '../engine/leaves.js';
import {SceneryVisibility} from '../engine/visibility.js';
import {newLevel} from '../shared/level.js';
import {newModel} from '../shared/model.js';
import {LEAF_COLORS,leafColorIndex,MAX_LEAVES,LEAVES_PER_BOX,LEAF_INSTANCE_FLOATS,LEAF_FALL_SPEED,LEAF_WIDTH_RATIO,LEAF_SWAY_CYCLES} from '../shared/leaf-effects.js';

function fixture(){
 const model=newModel('leaf-roof');model.role='scenery';
 for(let z=0;z<24;z++)for(let x=0;x<24;x++)model.variants.base.parts[0].voxels.push([x,16,z,0]);
 const level=newLevel('leaf-check');level.size=[4,3];level.placements=[{id:'roof',model:model.id,variant:'base',box:[1,0,1],turn:0}];
 level.terrain.boxes=[{box:[2,1],ground:4,water:12},{box:[3,1],ground:32,water:0}];
 return {level,model,width:96,length:72,weather:{type:'leaves',enabled:true},visibility:new SceneryVisibility(level,new Map([[model.id,model]]))};
}
function occupied(world){
 const result=[],v=world.visibility;
 for(let node=0;node<v.nodeCount;node++)if(v.escape[node]===node+1)result.push(Array.from(v.bounds.subarray(node*6,node*6+6)));
 for(const box of world.level.terrain.boxes)if(box.water)result.push([box.box[0]*24,box.water,box.box[1]*24,(box.box[0]+1)*24,box.water,(box.box[1]+1)*24]);
 return result;
}
const intersects=(p,r,b)=>p[0]>b[0]-r+1e-7&&p[0]<b[3]+r-1e-7&&p[1]>b[1]-r+1e-7&&p[1]<b[4]+r-1e-7&&p[2]>b[2]-r+1e-7&&p[2]<b[5]+r-1e-7;

test('leaf flights stop before scenery, ground and water for every tumble orientation',()=>{
 const world=fixture(),leaves=new LeafField(world),data=leaves.instanceData,boxes=occupied(world),point=new Float64Array(3),axes=new Float64Array(6);let roof=0,water=0,ground=0;
 for(let i=0;i<leaves.count;i++){
  const at=i*LEAF_INSTANCE_FLOATS,life=data[at+5],radius=data[at+4]*Math.hypot(LEAF_WIDTH_RATIO,1);
  expect(life).toBeGreaterThan(0);expect(life).toBeLessThanOrEqual(leaves.cycleSeconds);
  for(let sample=0;sample<=40;sample++){
   const age=life*sample/40;leafPosition(point,data,at,age);leafAxes(axes,data,at,age);
   expect(boxes.some(box=>intersects(point,radius,box))).toBe(false);
   expect(Math.hypot(axes[0],axes[1],axes[2])).toBeCloseTo(1,12);expect(Math.hypot(axes[3],axes[4],axes[5])).toBeCloseTo(1,12);
   expect(axes[0]*axes[3]+axes[1]*axes[4]+axes[2]*axes[5]).toBeCloseTo(0,12);
   for(const [u,v] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
    const dx=data[at+4]*(axes[0]*u*LEAF_WIDTH_RATIO+axes[3]*v),dy=data[at+4]*(axes[1]*u*LEAF_WIDTH_RATIO+axes[4]*v),dz=data[at+4]*(axes[2]*u*LEAF_WIDTH_RATIO+axes[5]*v);
    expect(Math.hypot(dx,dy,dz)).toBeLessThanOrEqual(radius+1e-12);
   }
  }
  leafPosition(point,data,at,life);
  if(point[0]>24&&point[0]<48&&point[2]>24&&point[2]<48&&point[1]>41)roof++;
  if(point[0]>48&&point[0]<72&&point[2]>24&&point[2]<48&&point[1]>12&&point[1]<14)water++;
  if(point[0]>0&&point[0]<96&&point[2]>0&&point[2]<72&&point[1]>24&&point[1]<26)ground++;
 }
 expect(roof).toBeGreaterThan(0);expect(water).toBeGreaterThan(0);expect(ground).toBeGreaterThan(0);expect(leaves.tracedSegments).toBeLessThanOrEqual(leaves.count*(LEAF_SWAY_CYCLES*2+2));
});

test('actual roof openings let leaves pass instead of treating a model as one solid bound',()=>{
 const world=fixture(),closed=new LeafField(world),point=new Float64Array(3);let selected=-1;
 for(let i=0;i<closed.count;i++){
  const at=i*LEAF_INSTANCE_FLOATS;leafPosition(point,closed.instanceData,at,closed.instanceData[at+5]);
  if(point[0]>28&&point[0]<44&&point[2]>28&&point[2]<44&&point[1]>41){selected=at;break;}
 }
 expect(selected).toBeGreaterThanOrEqual(0);const x=point[0]-24,z=point[2]-24;
 world.model.variants.base.parts[0].voxels=world.model.variants.base.parts[0].voxels.filter(cell=>Math.abs(cell[0]+.5-x)>4||Math.abs(cell[2]+.5-z)>4);
 world.visibility.dispose();world.visibility=new SceneryVisibility(world.level,new Map([[world.model.id,world.model]]));
 const open=new LeafField(world);expect(open.instanceData[selected+5]).toBeGreaterThan(closed.instanceData[selected+5]+2);
 expect(open.instanceData[selected]).toBe(closed.instanceData[selected]);expect(open.instanceData[selected+2]).toBe(closed.instanceData[selected+2]);
});

test('individual leaf sway is bounded and returns to its source while gentle falling and tumble use seconds',()=>{
 const leaves=new LeafField(fixture()),data=leaves.instanceData,point=new Float64Array(3),before=new Float64Array(3),after=new Float64Array(3),axes=new Float64Array(6),later=new Float64Array(6);
 const directions=new Set();
 for(let i=0;i<leaves.count;i++){
  const at=i*LEAF_INSTANCE_FLOATS,period=data[at+11],amplitude=data[at+6];directions.add(data[at+12]);
  for(let cycle=1;cycle<=LEAF_SWAY_CYCLES;cycle++){
   leafPosition(point,data,at,cycle*period);expect(point[0]).toBeCloseTo(data[at],8);expect(point[2]).toBeCloseTo(data[at+2],8);expect(point[1]-data[at+1]).toBeCloseTo(-LEAF_FALL_SPEED*cycle*period,8);
  }
  for(let sample=0;sample<=16;sample++){
   leafPosition(point,data,at,period*sample/16);expect(Math.hypot(point[0]-data[at],point[2]-data[at+2])).toBeLessThanOrEqual(amplitude*2*(1+1e-7));
  }
  const phase=data[at+7],turn=((Math.floor(phase*2)+1)*.5-phase)*period;
  leafPosition(before,data,at,turn-1e-8);leafPosition(after,data,at,turn+1e-8);expect(Math.hypot(after[0]-before[0],after[1]-before[1],after[2]-before[2])).toBeLessThan(1e-5);
  leafAxes(axes,data,at,0);leafAxes(later,data,at,1);expect(later).not.toEqual(axes);
 }
 expect(directions.size).toBe(leaves.count);
});

test('purple and muted-rust leaf palettes share deterministic 80/20 weights without duplicate material slots',()=>{
 expect(Object.isFrozen(LEAF_COLORS)).toBe(true);expect(LEAF_COLORS).toEqual(['#875B79','#A77B97','#6B4B6E','#A37058','#98624E']);
 const frequencies=[0,0,0,0,0];for(let i=0;i<1000;i++)frequencies[leafColorIndex((i+.5)/1000)]++;
 expect(frequencies).toEqual([300,300,200,100,100]);
 const leaves=new LeafField(fixture());for(let i=0;i<leaves.count;i++){const index=leaves.instanceData[i*LEAF_INSTANCE_FLOATS+14];expect(Number.isInteger(index)).toBe(true);expect(index).toBeGreaterThanOrEqual(0);expect(index).toBeLessThan(LEAF_COLORS.length);}
});

test('leaf seeds stay bounded and unchanged across frame subdivisions, wraps, disabled weather and teardown',()=>{
 const world=fixture(),whole=new LeafField(world),split=new LeafField(world),data=split.instanceData,snapshot=data.slice();
 expect(whole.instanceData).toEqual(data);expect(split.count).toBe(world.level.size[0]*world.level.size[1]*LEAVES_PER_BOX);expect(split.byteLength).toBe(split.count*64);
 whole.advance(53.712);for(let i=0;i<1000;i++)split.advance(53.712/1000);expect(split.time).toBeCloseTo(whole.time,8);expect(split.phase).toBeCloseTo(whole.phase,8);
 const phase=split.phase;split.advance(split.cycleSeconds*1e6);expect(split.phase).toBeCloseTo(phase,7);expect(split.instanceData).toBe(data);expect(data).toEqual(snapshot);
 for(const delta of [-1,Infinity,NaN])expect(()=>split.advance(delta)).toThrow();
 for(const weather of [{type:'rain',enabled:true},{type:'snow',enabled:true},{type:'clear',enabled:false},{type:'leaves',enabled:false},undefined]){
  const off=new LeafField({...world,weather});off.advance(5);expect(off.count).toBe(0);expect(off.byteLength).toBe(0);expect(off.phase).toBe(0);
 }
 const level=newLevel('many-leaves');level.size=[128,128];const large=new LeafField({level,weather:world.weather,visibility:{bounds:new Float32Array([0,0,0,3072,24,3072]),escape:new Uint32Array([1]),nodeCount:1}});
 expect(large.count).toBe(MAX_LEAVES);expect(large.byteLength).toBe(MAX_LEAVES*64);expect(large.tracedSegments).toBeLessThanOrEqual(MAX_LEAVES*18);
 expect(()=>new LeafField({...world,visibility:null})).toThrow('visibility');split.dispose();split.advance(2);expect(split.instanceData).toBeNull();expect(split.count).toBe(0);expect(split.byteLength).toBe(0);expect(split.phase).toBe(0);expect(split.cycleSeconds).toBe(0);
});
