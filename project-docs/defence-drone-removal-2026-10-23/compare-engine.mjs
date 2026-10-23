import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {deepStrictEqual,strictEqual} from 'node:assert';
const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
const loadBefore=async file=>{
 const original=pathToFileURL(root+'/engine/'+file),source=execFileSync('git',['show','df8ce98:engine/'+file],{cwd:root,encoding:'utf8'}).replace(/from '([^']+)'/g,(_,path)=>`from '${new URL(path,original).href}'`);
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
};
const [{ArcEffects:BeforeArc},{ModelLights:BeforeLights},{ArcEffects},{ModelLights},{meshQuads},{identity}]=await Promise.all([
 loadBefore('arc-effects.js'),loadBefore('model-lights.js'),import(root+'/engine/arc-effects.js'),import(root+'/engine/model-lights.js'),import(root+'/shared/mesher.js'),import(root+'/shared/math.js')
]);
const seeded=seed=>{let calls=0;const fn=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};fn.calls=()=>calls;return fn;};
let arcFrames=0;
for(const seed of [1,22,99,400]){
 const ar=seeded(seed),br=seeded(seed),a=new BeforeArc(ar),b=new ArcEffects(br),source=[0,70,0],impact=[50,30,0],normal=[-1,0,0],attachment=identity(),sourceMatrix=identity();
 const world={visibility:{bounds:new Float32Array([-256,0,-256,256,24,256]),escape:new Uint32Array([1]),nodeCount:1}};
 a.setWorld(world);b.setWorld(world);
 for(let frame=0;frame<400;frame++){
  const dt=[0,1/60,1/120,.04,.016,.2][frame%6];
  for(const e of [a,b])e.advance(dt);
  if(frame%77===0){a.reset(true);b.reset(true);}
  attachment[12]=Math.sin(frame*.03)*3;sourceMatrix[14]=Math.cos(frame*.02)*2;
  const count=frame%29===0?24:frame%2===0?2:0;
  for(let i=0;i<count;i++){
   const at=a.time-(frame%3===0?.025:0),chain=i%2===1;
   strictEqual(a.emit(source,impact,normal,at,attachment,impact,chain,sourceMatrix,source),b.emit(source,impact,normal,at,attachment,impact,chain,sourceMatrix,source));
  }
  a.prepare();b.prepare();
  for(const key of ['birth','secondary','ends','shape','sparkBirth','sparkRest','sparks','instanceData','lightData'])deepStrictEqual(a[key],b[key],`Arc ${seed}/${frame} ${key}`);
  for(const key of ['time','strikeCount','sparkCount','groundedCount','instanceCount','lightCount','replacedStrikes','droppedSparks','droppedChainStrikes','needsCleanup'])strictEqual(a[key],b[key],`Arc ${seed}/${frame} ${key}`);
  strictEqual(ar.calls(),br.calls());arcFrames++;
 }
}
const mesh=meshQuads([{origin:[0,1,0],axis:1,sign:1,width:1,height:1,material:0}],[{color:'#804020',emission:1,reflectiveness:0,castsLight:true}]),entries=[],draws=new Map(),r=seeded(703);
for(let group=0;group<5;group++){
 const key='group'+group,transforms=new Float32Array(80*16);for(let i=0;i<80;i++)transforms.set(identity(),i*16);
 entries.push({key,mesh,transforms:new Array(80)});draws.set(key,{transforms,indexToSlot:new Int32Array(80).fill(0)});
}
const a=new BeforeLights(entries,draws,{capacity:463}),b=new ModelLights(entries,draws,{capacity:463});
strictEqual(a.prepare(),b.prepare());deepStrictEqual(a.data,b.data);
let lightFrames=0;
for(let frame=0;frame<1200;frame++){
 const key='group'+frame%5,draw=draws.get(key);
 for(let i=0;i<5;i++){
  const index=Math.floor(r()*80),offset=index*16;
  draw.transforms[offset+12]=Math.sin(frame*.01+index)*20;draw.transforms[offset+13]=Math.cos(frame*.008)*4;
  draw.indexToSlot[index]=r()<.2?-1:0;
 }
 if(frame%97===0)draw.transforms[(frame%80)*16+12]=NaN;
 a.invalidate(key);b.invalidate(key);
 strictEqual(a.prepare(),b.prepare(),`Lights ${frame} dirty`);strictEqual(a.count,b.count);deepStrictEqual(a.data,b.data,`Lights ${frame} packet`);lightFrames++;
}
const countReads=(Ctor,free)=>{
 const e=new Ctor(()=>.5),birth=e.sparkBirth;birth.fill(0);for(let i=96-free;i<96;i++)birth[i]=-Infinity;
 let reads=0;e.sparkBirth=new Proxy(birth,{get(target,key){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,target);}});e.emit([0,70,0],[50,30,0],[-1,0,0],0);return reads;
};
const lightFixture=Ctor=>{
 const transforms=identity(),staticTransforms=new Float32Array(433*16);for(let i=0;i<433;i++)staticTransforms.set(identity(),i*16);
 const moving={transforms},stable={transforms:staticTransforms},lights=new Ctor([{key:'moving',mesh,transforms:[null]},{key:'static',mesh,transforms:new Array(433)}],new Map([['moving',moving],['static',stable]]),{capacity:463});lights.prepare();return {lights,moving};
};
const countPacked=Ctor=>{
 const {lights,moving}=lightFixture(Ctor),data=lights.data;let reads=0,writes=0;
 lights.data=new Proxy(data,{get(target,key){if(typeof key==='string'&&/^\d+$/.test(key)&&Number(key)>=12)reads++;return Reflect.get(target,key,target);},set(target,key,value){if(typeof key==='string'&&/^\d+$/.test(key)&&Number(key)>=12)writes++;return Reflect.set(target,key,value,target);}});
 moving.transforms[12]=1;lights.invalidate('moving');lights.prepare();return {reads,writes};
};
const timeLights=Ctor=>{
 const {lights,moving}=lightFixture(Ctor);for(let i=0;i<3000;i++){moving.transforms[12]=i;lights.invalidate('moving');lights.prepare();}
 const start=performance.now();for(let i=0;i<30000;i++){moving.transforms[12]=i;lights.invalidate('moving');lights.prepare();}return (performance.now()-start)/30000;
};
const timings={before:[],after:[]};for(let i=0;i<5;i++){if(i%2){timings.after.push(timeLights(ModelLights));timings.before.push(timeLights(BeforeLights));}else{timings.before.push(timeLights(BeforeLights));timings.after.push(timeLights(ModelLights));}}
console.log(JSON.stringify({arcFrames,lightFrames,arcReadCounts:{full:{before:countReads(BeforeArc,0),after:countReads(ArcEffects,0)},threeFree:{before:countReads(BeforeArc,3),after:countReads(ArcEffects,3)}},static433:{before:countPacked(BeforeLights),after:countPacked(ModelLights)},modelPackingMsPerCall:timings}));
