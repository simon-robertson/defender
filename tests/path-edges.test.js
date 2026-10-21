// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {pathShoulderQuads,pathSurfaceQuads,PATH_SHOULDER_MAX_WIDTH,PATH_SHOULDER_MATERIALS} from '../shared/path-surface.js';
import {TERRAIN_MATERIALS} from '../shared/zone-style.js';
import {TerrainField,placementY} from '../shared/terrain.js';
import {newLevel} from '../shared/level.js';
import {terrainGeometry} from '../engine/world.js';

const routeOf=points=>new Set(points.map(([x,z])=>x+','+z));
function boxCells(quads,bx,bz,y){
 const cells=new Int8Array(576).fill(-1),coverage=new Uint8Array(576);
 for(const q of quads){
  expect([q.axis,q.sign,q.origin[1]]).toEqual([1,1,y]);
  expect([q.origin[0],q.origin[2],q.width,q.height].every(Number.isInteger)).toBe(true);
  expect(q.width>0&&q.height>0).toBe(true);
  const ix=q.origin[0]-bx*24,iz=q.origin[2]-bz*24;
  expect(ix>=0&&iz>=0&&ix+q.height<=24&&iz+q.width<=24).toBe(true);
  for(let z=iz;z<iz+q.width;z++)for(let x=ix;x<ix+q.height;x++){coverage[z*24+x]++;cells[z*24+x]=q.material;}
 }
 expect(coverage.every(count=>count===1)).toBe(true);
 return cells;
}
function distanceToRoute(x,z,points){
 let distance=Infinity;
 for(const [bx,bz]of points){
  const dx=Math.max(bx*24-x,0,x-(bx+1)*24),dz=Math.max(bz*24-z,0,z-(bz+1)*24);
  distance=Math.min(distance,Math.hypot(dx,dz));
 }
 return distance;
}
const inRoute=(q,route)=>route.has(Math.floor(q.origin[0]/24)+','+Math.floor(q.origin[2]/24));
const isTop=q=>q.axis===1&&q.sign===1;
const resolvedQuads=(mesh,include)=>mesh.quads.flatMap((q,i)=>include(q)?[{...q,material:Array.from(mesh.vertices.subarray(i*44+6,i*44+11))}]:[]);

test('shoulder tops cover each box exactly once, retain ground material zero and respect exposed sides/convex corners',()=>{
 const shapes=[[[2,2]],[[1,2],[2,2],[3,2]],[[1,1],[2,1],[2,2]],[[1,1],[2,1],[3,1],[3,2],[3,3],[2,3],[1,3]]];
 let diagonalCells=0,ordinaryCells=0;
 const scratch=new Int8Array(576);
 for(const points of shapes){
  const route=routeOf(points),reverse=new Set([...route].reverse());
  for(let bz=0;bz<5;bz++)for(let bx=0;bx<5;bx++){
   const quads=pathShoulderQuads(route,bx,bz,24,0,16,scratch);
   expect(pathShoulderQuads(reverse,bx,bz,24,0,16,scratch)).toEqual(quads);
   if(route.has(bx+','+bz)){expect(quads).toBeNull();continue;}
   if(!quads)continue;
   const cells=boxCells(quads,bx,bz,24);
   const cardinal=points.some(([x,z])=>Math.abs(x-bx)+Math.abs(z-bz)===1);
   for(let iz=0;iz<24;iz++)for(let ix=0;ix<24;ix++){
    if(cells[iz*24+ix]===0){ordinaryCells++;continue;}
    expect(distanceToRoute(bx*24+ix+.5,bz*24+iz+.5,points)).toBeLessThan(PATH_SHOULDER_MAX_WIDTH);
    if(!cardinal)diagonalCells++;
   }
  }
 }
 expect(diagonalCells).toBeGreaterThan(0);expect(ordinaryCells).toBeGreaterThan(0);
 expect(pathShoulderQuads(routeOf([[2,2]]),0,0,24,0,16)).toBeNull();
 for(const start of [undefined,null,0,15,16.5,124])expect(()=>pathShoulderQuads(routeOf([[2,2]]),1,2,24,0,start)).toThrow('explicit appended material offset');
});

test('world-space contours retain quiet runs and ground gaps with a dedicated matte soil/stone palette',()=>{
 const route=routeOf(Array.from({length:12},(_,x)=>[x,1])),widths=[],counts={soil:0,stone:0},paletteBefore=JSON.stringify(TERRAIN_MATERIALS);
 for(let bx=0;bx<12;bx++){
  const cells=boxCells(pathShoulderQuads(route,bx,0,24,0,16),bx,0,24);
  for(let ix=0;ix<24;ix++){
   let width=0;
   for(let iz=20;iz<24;iz++)if(cells[iz*24+ix]!==0){width++;counts[cells[iz*24+ix]>=19?'stone':'soil']++;}
   widths.push(width);
  }
 }
 expect(widths.every(width=>width>=0&&width<=4)).toBe(true);expect(widths.includes(0)).toBe(true);expect(widths.includes(3)).toBe(true);
 // Same-width neighbouring runs may merge; interior changes remain >=6 apart,
 // including where the 24-unit chunk boundary cuts through a contour run.
 const changes=[];for(let i=1;i<widths.length;i++)if(widths[i]!==widths[i-1])changes.push(i);
 expect(changes.length).toBeGreaterThan(10);
 for(let i=1;i<changes.length;i++)expect(changes[i]-changes[i-1]).toBeGreaterThanOrEqual(6);
 expect(changes.some(at=>at%24!==0)).toBe(true);
 expect(counts.stone/(counts.soil+counts.stone)).toBeGreaterThan(.1);expect(counts.stone/(counts.soil+counts.stone)).toBeLessThan(.25);
 expect(Object.isFrozen(PATH_SHOULDER_MATERIALS)).toBe(true);
 expect(PATH_SHOULDER_MATERIALS.map(m=>m.color)).toEqual(['#76583F','#876A50','#654B37','#929292','#737373']);
 for(const material of PATH_SHOULDER_MATERIALS){
  expect(Object.isFrozen(material)).toBe(true);expect(material.reflectiveness).toBe(0);expect(material.emission).toBe(0);
 }
 const unshifted=pathShoulderQuads(route,2,0,24,0,16);
 for(const start of [16,19,20,21]){
  const shifted=pathShoulderQuads(route,2,0,24,0,start);
  expect(shifted.every(q=>q.material===0||q.material>=start&&q.material<start+5)).toBe(true);
  expect(shifted.map(q=>({...q,material:q.material===0?0:q.material-start+16}))).toEqual(unshifted);
 }
 expect(JSON.stringify(TERRAIN_MATERIALS)).toBe(paletteBefore);
});

test('terrain integration stops at water and height changes without altering paving, banks or water geometry',()=>{
 const level=newLevel('edge-test');level.size=[5,5];level.path=[[2,0,2]];
 level.terrain.boxes=[{box:[1,2],ground:24,water:30},{box:[3,2],ground:25,water:0},{box:[2,1],ground:12,water:0}];
 const source=JSON.stringify(level),actual=terrainGeometry(level),plain=terrainGeometry({...level,path:[]});
 expect(actual.water).toEqual(plain.water);
 expect(actual.ground.quads.filter(q=>!isTop(q))).toEqual(plain.ground.quads.filter(q=>!isTop(q)));
 for(const [bx,bz]of [[1,2],[3,2],[2,1],[0,0]]){
  const within=q=>isTop(q)&&Math.floor(q.origin[0]/24)===bx&&Math.floor(q.origin[2]/24)===bz;
  expect(actual.ground.quads.filter(within)).toEqual(plain.ground.quads.filter(within));
 }
 const route=routeOf([[2,2]]);
 expect(actual.ground.quads.filter(q=>isTop(q)&&inRoute(q,route))).toEqual(pathSurfaceQuads(route,2,2,24,false));
 expect(actual.ground.quads.filter(q=>isTop(q)&&Math.floor(q.origin[0]/24)===2&&Math.floor(q.origin[2]/24)===3).length).toBeGreaterThan(1);
 expect(JSON.stringify(level)).toBe(source);
});

test('all eight saved previews retain exact terrain coverage, flat dry routes and defence supports across weather toggles',async()=>{
 // Soil-vs-stone cell masks recorded before the brown/grey palette correction:
 // colour partitions can merge differently, but the accepted footprint/chips cannot move.
 const acceptedMasks={A:'2ecbd80d79116b6bea542e14a8621340d3b4a36789f6c64e98e5d55d9fac0fe6',B:'b51de431a0fb36ad42e5948f1e7964078f0429345b5b782e27e710bab2867dff',C:'0d1444da1f0d9373a530ff1d129a071ca5b9762c40eb7917da47afded4044a2f',D:'28d6006c160852e1227cd1b56bd5097ad2d127f9f7f6d8f771a1251bd34c9d0a'};
 for(const prefix of ['moss','ochre','ice','plum'])for(const number of ['01','02']){
  const level=await Bun.file(new URL(`../docs/landscape-reset-2026-10-18/previous-levels/${prefix}-${number}.json`,import.meta.url)).json(),source=JSON.stringify(level);
  const dry=terrainGeometry(level,{type:'clear',enabled:false}),field=new TerrainField(level),route=new Set(level.path.map(([x,,z])=>x+','+z));
  const width=level.size[0]*24,length=level.size[1]*24,coverage=new Uint8Array(width*length),shoulderMask=new Uint8Array(width*length);let wrongHeight=0,overlaps=0;
  const shades=new Uint32Array(5);
  for(const q of dry.ground.quads){
   if(!isTop(q))continue;
   for(let z=q.origin[2];z<q.origin[2]+q.width;z++)for(let x=q.origin[0];x<q.origin[0]+q.height;x++){
    if(++coverage[z*width+x]!==1)overlaps++;
    if(q.origin[1]!==field.height(x,z))wrongHeight++;
    if(q.material>=16){shoulderMask[z*width+x]=q.material>=19?2:1;shades[q.material-16]++;}
   }
  }
  expect(overlaps).toBe(0);expect(wrongHeight).toBe(0);expect(coverage.every(count=>count===1)).toBe(true);
  expect(new Bun.CryptoHasher('sha256').update(shoulderMask).digest('hex')).toBe(acceptedMasks[level.zone]);
  expect(shades.every(count=>count>0)).toBe(true);expect(shades[0]).toBeGreaterThan(shades[1]);expect(shades[0]).toBeGreaterThan(shades[2]);
  for(const [bx,,bz]of level.path)expect(field.flatBox(bx,bz)).toBe(level.pathHeight);
  for(const placement of level.placements)if(placement.model==='turret-study'||placement.model==='arc-spire')expect(placementY(level,placement,field)).toBe(level.pathHeight);
  const weather={A:'rain',B:'clear',C:'snow',D:'leaves'}[level.zone],wet=terrainGeometry(level,{type:weather,enabled:weather!=='clear'});
  expect(wet.water).toEqual(dry.water);
  expect(resolvedQuads(wet.ground,q=>!isTop(q)||!inRoute(q,route))).toEqual(resolvedQuads(dry.ground,q=>!isTop(q)||!inRoute(q,route)));
  expect(terrainGeometry(level,{type:'clear',enabled:false})).toEqual(dry);
  expect(JSON.stringify(level)).toBe(source);
 }
});
