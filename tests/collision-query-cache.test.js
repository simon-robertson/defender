import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {newModel} from '../shared/model.js';
import {identity,rotation} from '../shared/math.js';
import {SceneryVisibility} from '../engine/visibility.js';
import {ArcImpactSampler} from '../engine/arc-impact.js';

function random(){let n=321043;return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};}

test('forecast query batches match live posed LOS and swept contacts, then release their pose snapshot',()=>{
 const model=newModel('cache-defence');model.role='defence';
 for(let y=0;y<8;y++)for(let z=2;z<10;z++)model.variants.base.parts[0].voxels.push([5,y,z,0]);
 const level=newLevel('query-cache');level.size=[4,4];level.placements=[{id:'tower',model:model.id,variant:'base',box:[1,0,1],turn:0}];
 const matrix=identity(),models=new Map([[model.id,model]]),rigs=new Map([['tower',{instances:[{part:'body',matrix}]}]]),v=new SceneryVisibility(level,models);
 v.setDefences(level,models,rigs);const cache=v.defenceCenters,rand=random();
 try{
  for(let pose=0;pose<4;pose++){
   rotation(1,pose*.53,matrix);matrix[12]=24;matrix[13]=24;matrix[14]=24;
   const rays=Array.from({length:100},()=>Array.from({length:6},(_,a)=>a%3===1?24+rand()*14:14+rand()*36));
   const expected=rays.map(ray=>{const out=new Float64Array(7);return [v.blockedDefences(...ray),v.sweepDefences(...ray,.4,undefined,out),[...out]];});
   v.beginDefenceQueryBatch();v.beginDefenceQueryBatch();v.endDefenceQueryBatch();
   try{for(let i=0;i<rays.length;i++){const out=new Float64Array(7);expect([v.blockedDefences(...rays[i]),v.sweepDefences(...rays[i],.4,undefined,out),[...out]]).toEqual(expected[i]);}}
   finally{v.endDefenceQueryBatch();}
   expect(v.defenceBatchDepth).toBe(0);expect(v.defenceCenters).toBe(cache);
  }
  identity(matrix);matrix[12]=24;matrix[13]=24;matrix[14]=24;
  expect(v.blockedDefences(27,28,30,32,28,30)).toBe(true);
  matrix[12]+=100;expect(v.blockedDefences(27,28,30,32,28,30)).toBe(false);expect(v.sweepDefences(27,28,30,32,28,30,.4)).toBe(Infinity);
  v.beginDefenceQueryBatch();try{expect(v.blockedDefences(127,28,30,132,28,30)).toBe(true);}finally{v.endDefenceQueryBatch();}
  v.setDefences({...level,placements:[]},models,new Map());expect(v.defenceCenters.byteLength).toBe(0);expect(v.defenceBatchDepth).toBe(0);
 }finally{v.dispose();}
 expect(v.defenceCenters).toBeNull();expect(v.byteLength).toBe(0);
});

function cubeQuads(){return [0,1,2].flatMap(axis=>[-1,1].map(sign=>({axis,sign,origin:[5,5,5].map((x,a)=>a===axis&&sign>0?x+1:x),width:1,height:1})));}
// Independent world-plane reference: test every rendered face, with no part
// bounds. This checks arbitrary rigid poses and the existing endpoint/edge rules.
function allFacesClear(record,start,end){
 for(let part=0;part<record.shape.parts.length;part++){
  const m=record.matrices[part],local=p=>[0,1,2].map(a=>m[a*4]*(p[0]-m[12])+m[a*4+1]*(p[1]-m[13])+m[a*4+2]*(p[2]-m[14])),s=local(start),e=local(end),d=e.map((x,a)=>x-s[a]);
  for(const q of record.shape.parts[part].quads){
   if(Math.abs(d[q.axis])<1e-10)continue;const t=(q.origin[q.axis]-s[q.axis])/d[q.axis];if(t<=1e-6||t>=1-1e-5)continue;
   const u=(q.axis+1)%3,w=(q.axis+2)%3,p=s.map((x,a)=>x+d[a]*t);
   if(p[u]>=q.origin[u]-1e-6&&p[u]<=q.origin[u]+q.width+1e-6&&p[w]>=q.origin[w]-1e-6&&p[w]<=q.origin[w]+q.height+1e-6)return false;
  }
 }return true;
}

test('Arc part rejection preserves rotated faces, grazing tolerances, endpoint exclusions and zero-length rays',()=>{
 const target={id:'target',x:5,z:5,health:{alive:true}},matrices=[identity(),rotation(1,.83),rotation(2,-.37)],instances=matrices.map((matrix,i)=>({part:'part-'+i,key:'part-'+i,matrix}));matrices[1][12]=14;matrices[2][14]=18;
 const world={entries:instances.map(i=>({key:i.key,mesh:{quads:cubeQuads()}})),actors:new Map([['target',{model:'test',variant:'base',instances}]])},s=new ArcImpactSampler(world,[target],()=>.5),record=s.records.get(target),rand=random();
 try{
  const rays=[[[4,6+5e-7,5.5],[7,6+5e-7,5.5]],[[4,6+2e-6,5.5],[7,6+2e-6,5.5]],[[4,5.5,5.5],[5,5.5,5.5]],[[5.5,5.5,5.5],[5.5,5.5,5.5]]];
  expect(allFacesClear(record,...rays[0])).toBe(false);expect(allFacesClear(record,...rays[1])).toBe(true);
  for(let i=0;i<1500;i++)rays.push([Array.from({length:3},()=>rand()*35-5),Array.from({length:3},()=>rand()*35-5)]);
  for(const [start,end]of rays){s.point.set(end);expect(s.selfClear(record,start)).toBe(allFacesClear(record,start,end));}
 }finally{s.dispose();}
});
