import {test,expect} from 'bun:test';
import {DroneNavigation} from '../engine/drone-navigation.js';
import {DroneMotion} from '../engine/drone-motion.js';
import {DRONE_PREVIEW as T} from '../shared/drone.js';

function fixture(boxes=[],rigs=new Map()){
 const bounds=new Float64Array(boxes.length?(boxes.length+1)*6:0),escape=new Uint32Array(boxes.length+1);
 if(boxes.length){
  bounds.set([Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);
  for(let i=0;i<boxes.length;i++){const box=boxes[i];bounds.set(box,(i+1)*6);escape[i+1]=i+2;for(let axis=0;axis<3;axis++){bounds[axis]=Math.min(bounds[axis],box[axis]);bounds[axis+3]=Math.max(bounds[axis+3],box[axis+3]);}}
  escape[0]=boxes.length+1;
 }
 const world={width:240,length:180,level:{pathHeight:0},rigs,visibility:{bounds,escape,nodeCount:boxes.length?boxes.length+1:0}},nav=new DroneNavigation(world),state={x:48,y:33,z:72,nav:nav.createSearch(),motion:new DroneMotion(nav.count*2)};
 return {nav,state,dispose(){state.motion.dispose();nav.dispose();}};
}
const fleet={fleetClear:()=>true,fleetBoxClear:()=>true};
function node(nav,x,z,layer=0){return layer*nav.plane+z*nav.cols+x;}

test('ordinary scenery retains the four standard bands and first fixed-clear pad home',()=>{
 const f=fixture([[100,0,0,112,80,180]]);try{
  const {nav,state}=f;expect(Array.from(nav.layers)).toEqual(T.transitLayers);expect(nav.ceiling).toBe(105);expect(nav.count).toBe(nav.plane*4);
  state.homeX=state.x;state.homeZ=state.z;nav.neutralVertical=()=>true;
  expect(nav.home(state)).toBe(node(nav,4,6));
 }finally{f.dispose();}
});

test('a tall continuous scenery wall gets one hull-clear overflight lane and a smooth return to standard height',()=>{
 for(const hz of [30,60,120]){
  const f=fixture([[100,0,0,112,160,180]]);try{
   const {nav,state}=f,goal=node(nav,16,6);expect(nav.layers.length).toBe(5);expect(nav.ceiling-T.hullBelow).toBe(164);expect(nav.clearSegment(48,33,72,192,33,72)).toBe(false);
   expect(nav.search(state,fleet)).toBe(true);expect(nav.route(state,goal)).toBe(true);expect(nav.smooth(state,fleet)).toBe(true);
   const data=state.motion.data,point=state.motion.point;let peak=state.y,lastX=state.x,lastY=state.y,lastZ=state.z;
   for(let frame=0;frame<30*hz&&!state.motion.done;frame++){
    state.motion.advance(1/hz);expect(nav.clearSegment(lastX,lastY,lastZ,point[0],point[1],point[2])).toBe(true);peak=Math.max(peak,point[1]);lastX=point[0];lastY=point[1];lastZ=point[2];
   }
   expect(state.motion.done).toBe(true);expect(peak).toBeGreaterThan(160+T.hullBelow);expect(Array.from(point).slice(0,3)).toEqual([192,33,72]);expect(state.motion.data).toBe(data);expect(state.motion.speed).toBe(0);
  }finally{f.dispose();}
 }
});

test('overflight covers tall deployed solids without approving a home available only at the extra ceiling',()=>{
 const root=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),rigs=new Map([['tower',{role:'defence',model:'test-tower',root,parts:[{voxels:[[108,200,80]]}]}]]),f=fixture([],rigs);
 try{
  const {nav,state}=f;expect(nav.ceiling).toBe(214);expect(nav.ceiling-T.hullBelow).toBeGreaterThan(201);
  state.homeX=state.x;state.homeZ=state.z;nav.neutralVertical=(_,top)=>top>105;expect(nav.home(state)).toBe(-1);
 }finally{f.dispose();}
});

test('a disconnected nearest low entry does not hide a certified route through an upper band',()=>{
 const f=fixture();try{
  const {nav,state}=f,start=node(nav,4,6),goal=node(nav,16,6);nav.edges[start]=0;
  expect(nav.search(state,fleet)).toBe(true);expect(state.nav.start).toBe(start);expect(nav.route(state,goal)).toBe(true);
  expect(state.nav.path[0]).toBeGreaterThanOrEqual(nav.plane);expect(nav.smooth(state,fleet)).toBe(true);expect(state.motion.segmentCount).toBeGreaterThan(0);
 }finally{f.dispose();}
});

test('weighted navigation chooses a shorter low detour over fewer, more expensive climbing edges',()=>{
 const f=fixture();try{
  const {nav,state}=f;state.x=36;state.z=36;nav.free.fill(0);nav.edges.fill(0);
  const low=[[3,3],[3,4],[3,5],[3,6],[4,6],[5,6],[5,5],[5,4],[5,3]].map(([x,z])=>node(nav,x,z));
  const high=[node(nav,3,3),node(nav,3,3,1),node(nav,3,3,2),node(nav,4,3,2),node(nav,5,3,2),node(nav,5,3,1),node(nav,5,3)];
  for(const path of [low,high])for(let i=0;i<path.length;i++){nav.free[path[i]]=1;if(!i)continue;const a=path[i-1],b=path[i],dir=Array.from(nav.offsets).indexOf(b-a);nav.edges[a]|=1<<dir;nav.edges[b]|=1<<((dir+3)%6);}
  expect(nav.search(state,fleet)).toBe(true);expect(state.nav.distance[low.at(-1)]).toBe(96);expect(nav.route(state,low.at(-1))).toBe(true);expect(Array.from(state.nav.path.slice(0,state.nav.pathLength))).toEqual(low);
 }finally{f.dispose();}
});

test('every alternate entry and route edge retains live fleet clearance and bounded reused storage',()=>{
 const f=fixture();try{
  const {nav,state}=f,queue=state.nav.queue,positions=state.nav.heapPositions,parents=state.nav.parents,distance=state.nav.distance,path=state.nav.path,entries=nav.entries,costs=nav.entryCosts;
  let checks=0;expect(nav.search(state,{fleetClear(){checks++;return false;}})).toBe(false);expect(checks).toBeGreaterThan(nav.layers.length);expect(state.nav.visited).toBe(0);expect(nav.route(state,node(nav,16,6))).toBe(false);
  for(let i=0;i<3;i++){expect(nav.search(state,fleet)).toBe(true);expect(state.nav.visited).toBeLessThanOrEqual(nav.count);expect(state.nav.queue).toBe(queue);expect(state.nav.heapPositions).toBe(positions);expect(state.nav.parents).toBe(parents);expect(state.nav.distance).toBe(distance);expect(state.nav.path).toBe(path);expect(nav.entries).toBe(entries);expect(nav.entryCosts).toBe(costs);}
 }finally{f.dispose();}expect(f.nav.byteLength).toBe(0);expect(f.nav.layers).toBeNull();expect(f.nav.entries).toBeNull();expect(f.nav.entryCosts).toBeNull();
});
