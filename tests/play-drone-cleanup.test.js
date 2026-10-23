import {test,expect} from 'bun:test';
import {DroneFlight} from '../play/drone-flight.js';
import {SceneryVisibility} from '../engine/visibility.js';
const random=(()=>{let s=42;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};})();
function fixture(){
 const level={size:[20,16],pathHeight:24,path:[],placements:[],terrain:{defaultHeight:24,boxes:[{box:[2,2],ground:100,water:0},{box:[3,2],ground:4,water:180}]}};
 const world={level,width:480,length:384,visibility:new SceneryVisibility(level,new Map())},d=new DroneFlight({});d.bind(world);return {d,world};
}
// Deliberately exhaustive oracle: expanded slabs for every leaf/surface, with
// no hierarchical or altitude shortcut.
function intersects(a,b,box,r=2.5){
 let from=0,to=1;for(let i=0;i<3;i++){const v=b[i]-a[i],lo=box[i]-r,hi=box[i+3]+r;if(v===0){if(a[i]<lo||a[i]>hi)return false;}else{const u=(lo-a[i])/v,w=(hi-a[i])/v;from=Math.max(from,Math.min(u,w));to=Math.min(to,Math.max(u,w));if(from>to)return false;}}return true;
}
function exhaustiveStatic(d,a,b){
 const tree=d.world.visibility;for(let n=0;n<tree.nodeCount;n++)if(tree.escape[n]===n+1&&intersects(a,b,tree.bounds.subarray(n*6,n*6+6)))return false;
 const cols=d.world.level.size[0];for(let i=0;i<d.surfaces.length;i++){const h=d.surfaces[i];if(h&&intersects(a,b,[i%cols*24,0,Math.floor(i/cols)*24,(i%cols+1)*24,h,(Math.floor(i/cols)+1)*24]))return false;}return true;
}
function exhaustiveSpawn(d,a,b){
 const o=d.obstacles;for(let i=0;i<o.records.length;i++){const {state:s,root:m}=o.records[i],wait=(s.spawnAt??Infinity)-d.waveClock;if(s.phase!=='scheduled'||wait>3||wait<0)continue;const k=i*6,e=o.poseEnvelope,box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(let corner=0;corner<8;corner++){const x=e[k+(corner&1?3:0)],y=e[k+1+(corner&2?3:0)],z=e[k+2+(corner&4?3:0)];for(let axis=0;axis<3;axis++){const v=m[axis]*x+m[axis+4]*y+m[axis+8]*z+m[axis+12];box[axis]=Math.min(box[axis],v);box[axis+3]=Math.max(box[axis+3],v);}}
  const travel=(s.movement?.speed??0)*(3-wait);box[0]-=travel;box[2]-=travel;box[3]+=travel;box[5]+=travel;if(intersects(a,b,box))return false;
 }return true;
}
test('high static shortcut matches exhaustive solids/water including contact and replacement geometry',()=>{
 const {d,world}=fixture();try{
  for(let n=0;n<1500;n++){const a=[random()*600-60,random()*400,random()*500-60],b=a.map((v,i)=>v+(random()-.5)*(i===1?240:120));expect(d.staticClear(...a,...b)).toBe(exhaustiveStatic(d,a,b));}
  expect(d.staticClear(84,182.5,60,84,182.5,60)).toBe(false);expect(d.staticClear(84,182.500001,60,84,182.500001,60)).toBe(true);
  let reads=0;d.surfaces=new Proxy(d.surfaces,{get(t,p){if(/^\d+$/.test(String(p)))reads++;return Reflect.get(t,p,t);}});expect(d.staticClear(240,1000,192,250,1000,192)).toBe(true);expect(reads).toBe(0);
  world.visibility={nodeCount:1,bounds:new Float32Array([230,0,180,260,1200,210]),escape:new Uint32Array([1])};expect(d.staticClear(240,1000,192,250,1000,192)).toBe(false);
 }finally{d.bind(null);world.visibility.dispose?.();}
});
test('spawn vertical rejection matches exhaustive transformed reservations across scheduling and arbitrary affine poses',()=>{
 const {d,world}=fixture(),records=[],envelopes=[];d.waveClock=5;
 for(let i=0;i<24;i++){const root=Float64Array.from({length:16},()=>random()*2-1);root[12]=random()*480;root[13]=random()*280;root[14]=random()*384;root[15]=1;records.push({root,state:{phase:i%5?'scheduled':'active',spawnAt:4+random()*6,movement:{speed:random()*60}}});envelopes.push(-20,-10,-25,20,80,25);}
 d.obstacles={records,poseEnvelope:new Float64Array(envelopes),dispose(){}};
 try{for(let n=0;n<3000;n++){const a=[random()*600-60,random()*450,random()*500-60],b=a.map(v=>v+(random()-.5)*180);expect(d.spawnClear(...a,...b)).toBe(exhaustiveSpawn(d,a,b));}}finally{d.bind(null);world.visibility.dispose();}
});
test('high spawn checks avoid full corner transforms without adding reservation buffers',()=>{
 const {d,world}=fixture();let reads=0;const root=new Proxy([1,0,0,0,0,1,0,0,0,0,1,0,240,24,192,1],{get(t,p){if(/^\d+$/.test(String(p)))reads++;return t[p];}}),records=Array.from({length:16},()=>({root,state:{phase:'scheduled',spawnAt:1,movement:{speed:12}}}));d.obstacles={records,poseEnvelope:Float64Array.from({length:16*6},(_,i)=>[-10,0,-10,10,80,10][i%6]),dispose(){}};
 try{const a=[240,1000,192];expect(d.spawnClear(...a,...a)).toBe(true);const fast=reads;reads=0;expect(exhaustiveSpawn(d,a,a)).toBe(true);expect(fast).toBe(128);expect(reads).toBe(1536);}finally{d.bind(null);world.visibility.dispose();}
});
