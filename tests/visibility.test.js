import {test,expect} from 'bun:test';
import {SceneryVisibility} from '../engine/visibility.js';
import {newLevel} from '../shared/level.js';
import {newModel} from '../shared/model.js';

function fixture(cells){
 const model=newModel('test-scenery');model.role='scenery';model.variants.base.parts[0].voxels=cells;
 const level=newLevel('visibility-test');level.size=[3,3];
 level.placements=[{id:'wall',model:model.id,variant:'base',box:[1,0,1],turn:0}];
 return {level,models:new Map([[model.id,model]]),model};
}

test('exact occupied scenery blocks solid walls while retaining a real doorway and over-wall clearance',()=>{
 const cells=[];
 for(let x=11;x<13;x++)for(let y=0;y<14;y++)for(let z=4;z<20;z++)if(!(y<9&&z>=9&&z<15))cells.push([x,y,z,0]);
 const {level,models}=fixture(cells),visibility=new SceneryVisibility(level,models);
 expect(visibility.clear(20,28.5,36,52,28.5,36)).toBe(true); // Within the model's overall bounds, through its doorway.
 expect(visibility.blocked(20,28.5,32,52,28.5,32)).toBe(true); // Jamb.
 expect(visibility.blocked(20,34.5,36,52,34.5,36)).toBe(true); // Lintel.
 expect(visibility.clear(20,39,36,52,39,36)).toBe(true);
 expect(visibility.primitiveCount).toBeLessThan(cells.length+9);
});

test('closed leaf bounds handle grazing faces, corners, endpoints, interior origins and zero-length segments',()=>{
 const {level,models}=fixture([[12,2,12,0]]),visibility=new SceneryVisibility(level,models);
 for(const ray of [
  [35,26.5,36.5,38,26.5,36.5], [38,26.5,36.5,35,26.5,36.5],
  [36.5,25,36.5,36.5,28,36.5], [36.5,26.5,35,36.5,26.5,38],
  [35,26,36.5,38,26,36.5], [35,27,36.5,37,25,36.5],
  [35,26.5,36.5,36,26.5,36.5], [37,26.5,36.5,38,26.5,36.5],
  [36.5,26.5,36.5,38,26.5,36.5], [36.5,26.5,36.5,36.5,26.5,36.5],
 ])expect(visibility.blocked(...ray)).toBe(true);
 expect(visibility.clear(35,26-1e-8,36.5,38,26-1e-8,36.5)).toBe(true);
 expect(visibility.clear(35,26.5,36.5,35,26.5,36.5)).toBe(true);
});

test('cell bounds follow quarter-turns, detail offsets and terrain or absolute placement anchors',()=>{
 for(let turn=0;turn<4;turn++)for(const anchor of ['terrain','absolute']){
  const {level,models}=fixture([[1,2,3,0]]),p=level.placements[0];
  p.turn=turn;p.anchor=anchor;p.box[1]=1;p.kind='detail';p.offset=[2,3,-1];
  level.terrain.boxes=[{box:[1,1],ground:30,water:0}];
  let x=1,z=3;for(let i=0;i<turn;i++){const old=x;x=23-z;z=old;}
  const wx=24+2+x,wy=(anchor==='absolute'?0:30)+24+3+2,wz=24-1+z,visibility=new SceneryVisibility(level,models);
  expect(visibility.blocked(wx-1,wy+.5,wz+.5,wx+2,wy+.5,wz+.5)).toBe(true);
  expect(visibility.clear(wx-1,wy+1.1,wz+.5,wx+2,wy+1.1,wz+.5)).toBe(true);
 }
});

test('ground mounds and carved beds block in 3D while water, defences and enemies remain excluded',()=>{
 const {level,models,model}=fixture([[12,8,12,0]]);level.placements=[];
 level.terrain.boxes=[{box:[1,1],ground:32,water:0},{box:[0,1],ground:4,water:12}];
 let visibility=new SceneryVisibility(level,models);
 expect(visibility.blocked(12,30,36,60,30,36)).toBe(true); // Raised middle box.
 expect(visibility.clear(12,33,36,60,33,36)).toBe(true);
 expect(visibility.blocked(12,40,36,36,26,36)).toBe(true); // Sloping muzzle-to-torso ray into a mound.
 expect(visibility.clear(1,8,25,23,8,47)).toBe(true); // Within water, above its real bed.
 expect(visibility.blocked(1,3,25,23,3,47)).toBe(true);
 expect(visibility.blocked(1,4,25,23,4,47)).toBe(true); // Bed surface is closed.
 for(const role of ['defence','enemy','scenery',undefined]){
  level.terrain.boxes=[];model.role=role;level.placements=[{id:'item',model:model.id,variant:'base',box:[1,0,1],turn:0}];
  visibility=new SceneryVisibility(level,models);
  expect(visibility.blocked(35,32.5,36.5,38,32.5,36.5)).toBe(role==='scenery'||role===undefined);
 }
});

// Independent closed-segment/slab reference using individual occupied cells.
function bruteBlocked(boxes,origin,target){
 return boxes.some(box=>{
  let lo=0,hi=1;
  for(let axis=0;axis<3;axis++){
   const delta=target[axis]-origin[axis];
   if(!delta){if(origin[axis]<box[axis]||origin[axis]>box[axis+3])return false;continue;}
   const a=(box[axis]-origin[axis])/delta,b=(box[axis+3]-origin[axis])/delta;
   lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
  }
  return lo<=hi;
 });
}

test('merged cuboids and stackless branches agree with original cell geometry over deterministic 3D rays',()=>{
 let seed=4731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},cells=[];
 for(let y=0;y<9;y++)for(let z=5;z<19;z++)for(let x=5;x<19;x++)if(random()<.4)cells.push([x,y,z,0]);
 const {level,models}=fixture(cells);level.size=[1,1];level.placements[0].box=[0,0,0];
 const visibility=new SceneryVisibility(level,models),boxes=[[0,0,0,24,24,24],...cells.map(([x,y,z])=>[x,y+24,z,x+1,y+25,z+1])];
 for(let i=0;i<600;i++){
  const origin=[random()*32-4,random()*18+20,random()*32-4],target=[random()*32-4,random()*18+20,random()*32-4];
  const expected=bruteBlocked(boxes,origin,target);
  expect(visibility.blocked(...origin,...target)).toBe(expected);expect(visibility.blocked(...target,...origin)).toBe(expected);
 }
});

test('queries reuse typed storage, retain no source dependency and fail closed after disposal or for invalid rays',()=>{
 const {level,models,model}=fixture([[12,2,12,0]]),visibility=new SceneryVisibility(level,models),bounds=visibility.bounds,escape=visibility.escape;
 expect(visibility.byteLength).toBe(bounds.byteLength+escape.byteLength);expect(visibility.nodeCount).toBe(visibility.primitiveCount*2-1);
 model.variants.base.parts[0].voxels.length=0;level.placements.length=0;models.clear();
 for(let i=0;i<100;i++)expect(visibility.blocked(35,26.5,36.5,38,26.5,36.5)).toBe(true);
 expect(visibility.bounds).toBe(bounds);expect(visibility.escape).toBe(escape);
 for(let axis=0;axis<6;axis++)for(const invalid of [NaN,Infinity,-Infinity]){
  const ray=[35,28,36.5,38,28,36.5];ray[axis]=invalid;expect(visibility.clear(...ray)).toBe(false);
 }
 visibility.dispose();visibility.dispose();
 expect(visibility.bounds).toBeNull();expect(visibility.escape).toBeNull();expect(visibility.byteLength).toBe(0);expect(visibility.nodeCount).toBe(0);expect(visibility.primitiveCount).toBe(0);
 expect(visibility.clear(0,40,0,70,40,70)).toBe(false);
 const emptyLevel=newLevel('empty-visibility');emptyLevel.size=[1,1];emptyLevel.terrain.boxes=[{box:[0,0],ground:0,water:12}];
 const empty=new SceneryVisibility(emptyLevel,new Map());expect(empty.nodeCount).toBe(0);expect(empty.byteLength).toBe(0);expect(empty.clear(0,6,0,24,6,24)).toBe(true);
});
