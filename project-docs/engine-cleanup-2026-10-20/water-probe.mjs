import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dir,'../..'),baseline=JSON.parse(await readFile(resolve(import.meta.dir,'baseline.json'),'utf8')).snapshot;
const source=await Bun.file(resolve(root,'assets/levels/moss-02.json')).json(),models=new Map();
for(const id of new Set(source.placements.map(p=>p.model)))models.set(id,await Bun.file(resolve(root,`assets/models/${id}.json`)).json());
const {buildWorld,disposeWorld}=await import(pathToFileURL(resolve(root,'engine/world.js'))),world=buildWorld(source,models);
const wet=source.terrain.boxes.find(b=>b.water>0),x=wet.box[0]*24+12,z=wet.box[1]*24+12,y=wet.water;
const rng=()=>{let seed=19286;return()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);};
const classes=await Promise.all([baseline,root].map(async base=>(await import(pathToFileURL(resolve(base,'engine/water-impact.js')))).WaterImpacts));
function fixture(C,instrument=false){const water=new C(rng());water.setWorld(world);let checks=0;const counts={};let counting=false;
 if(instrument)for(const p of [...water.impacts,...water.drops]){let active=p.active;Object.defineProperty(p,'active',{enumerable:true,get(){if(counting)checks++;return active;},set(value){active=value;}});}
 const packed=new Float32Array(336*12);let cursor=0;const emit=(...values)=>{packed.set(values,cursor);cursor+=12;};
 return {water,packed,emit,counts,call(fn){counting=true;try{return fn();}finally{counting=false;}},get checks(){return checks;},prepare(){cursor=0;water.prepare(emit);return packed.subarray(0,cursor);}};
}
function sequence(f,trace=null){const w=f.water;
 for(let frame=0;frame<720;frame++){
  f.call(()=>{if(frame===120||frame===330)for(let i=0;i<60;i++)w.impact(x,y,z,1.4+(i%3)*.25,28+i,3,-2);const dt=frame===420?.7:frame===510?0:1/120;w.advance(dt);f.prepare();if(frame===480)w.reset(true);});
  if(trace){trace.update(JSON.stringify({impacts:w.impacts,drops:w.drops,count:w.count,activeDrops:w.activeDrops,entries:w.entries,droppedImpacts:w.droppedImpacts,droppedDrops:w.droppedDrops,particleCount:w.particleCount}));trace.update(new Uint8Array(f.packed.buffer));}
 }
}
const runs=[];
try{
 for(const C of classes){const f=fixture(C,true),trace=createHash('sha256'),originals={};for(const name of ['exp','sqrt','cos','sin']){originals[name]=Math[name];f.counts[name]=0;Math[name]=(...args)=>{f.counts[name]++;return originals[name](...args);};}const assign=Object.assign;f.counts.assign=0;Object.assign=(...args)=>{f.counts.assign++;return assign(...args);};
  try{sequence(f,trace);}finally{Object.assign=assign;for(const [name,fn]of Object.entries(originals))Math[name]=fn;}
  const idle=fixture(C,true);for(let frame=0;frame<600;frame++)idle.call(()=>{idle.water.advance(1/120);idle.prepare();});runs.push({digest:trace.digest('hex'),operations:f.counts,slotPredicates:f.checks,idle600FramesSlotPredicates:idle.checks});
 }
 if(runs[0].digest!==runs[1].digest)throw new Error('Water event, drop and packed particle traces differ.');
 const samples=[[],[]];for(let warm=0;warm<2;warm++)for(const C of classes)sequence(fixture(C));
 for(let round=0;round<7;round++)for(const i of round%2?[1,0]:[0,1]){const f=fixture(classes[i]),start=performance.now();for(let repeat=0;repeat<20;repeat++)sequence(f);samples[i].push(performance.now()-start);}
 const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)],result={scene:source.id,fixture:'720 ticks, idle+overflowing seeded splash events, exact states/packed Float32 traces, long/zero delta and reset; timed20 repeats',baseline:baseline,runs,timing:{runtime:Bun.version,samplesMs:samples,medianMs:samples.map(median),scope:'isolated Bun CPU fixture; no browser/GPU frame-rate claim'}};
 await writeFile(resolve(import.meta.dir,'water-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{disposeWorld(world);}
