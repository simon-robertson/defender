// Reproducible operation/equivalence and isolated CPU timing; no GPU/FPS claim.
// bun docs/performance/render-operations.mjs BASELINE_ROOT [CURRENT_ROOT] [OUTPUT_JSON]
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cpus,release} from 'node:os';
if(!Bun.argv[2]){console.error('Usage: bun render-operations.mjs BASELINE_ROOT [CURRENT_ROOT] [OUTPUT_JSON]');process.exit(2);}
const baseline=resolve(Bun.argv[2]),repo=resolve(Bun.argv[3]??fileURLToPath(new URL('../../',import.meta.url))),output=Bun.argv[4]?resolve(Bun.argv[4]):null;
const oldPool=await import(baseline+'/engine/plasma-links.js'),newPool=await import(repo+'/engine/plasma-links.js');
const oldArc=await import(baseline+'/shared/arc-effects.js'),newArc=await import(repo+'/shared/arc-effects.js');
const oldPlasma=await import(baseline+'/shared/plasma-links.js'),newPlasma=await import(repo+'/shared/plasma-links.js');
const source=[77,34.5,155.5],target=[65,35.5,155.5],frames=600,deltaSeconds=1/60;
const tracked=['sin','cos','hypot'];
function operations(Pool,count){
 const pool=new Pool();pool.setLinks(Array.from({length:count},()=>({source,target})));
 const calls={sin:0,cos:0,hypot:0},original={};
 for(const name of tracked){original[name]=Math[name];Math[name]=(...args)=>{calls[name]++;return original[name](...args);};}
 try{for(let frame=0;frame<frames;frame++){pool.advance(deltaSeconds);pool.prepare();}}
 finally{for(const name of tracked)Math[name]=original[name];}
 const result={links:count,frames,deltaSeconds,calls,poolCPUBytes:pool.byteLength};pool.dispose();return result;
}
function equivalent(count){
 const before=new oldPool.PlasmaLinks(),after=new newPool.PlasmaLinks(),links=Array.from({length:count},()=>({source,target}));before.setLinks(links);after.setLinks(links);
 let maximumPointError=0,maximumPackedInstanceError=0,maximumPackedLightError=0,changedInstanceFloats=0,changedLightFloats=0;
 for(let frame=0;frame<frames;frame++){
  before.advance(deltaSeconds);after.advance(deltaSeconds);before.prepare();after.prepare();
  for(let i=0;i<count*newPlasma.PLASMA_NODES*3;i++)maximumPointError=Math.max(maximumPointError,Math.abs(before.points[i]-after.points[i]));
  for(let i=0;i<before.instanceCount*newPlasma.PLASMA_INSTANCE_FLOATS;i++){const error=Math.abs(before.instanceData[i]-after.instanceData[i]);maximumPackedInstanceError=Math.max(maximumPackedInstanceError,error);if(error)changedInstanceFloats++;}
  // The appended bounds have no baseline counterpart; compare every original
  // per-source color, radius, strength, count and segment coordinate instead.
  for(let slot=0;slot<count;slot++)for(let i=0;i<oldArc.ARC_LIGHT_FLOATS;i++){
   const error=Math.abs(before.lightData[4+slot*oldArc.ARC_LIGHT_FLOATS+i]-after.lightData[4+slot*newArc.ARC_LIGHT_FLOATS+i]);maximumPackedLightError=Math.max(maximumPackedLightError,error);if(error)changedLightFloats++;
  }
 }
 if(maximumPointError>1e-9||maximumPackedInstanceError>1e-5||maximumPackedLightError>1e-5)throw new Error('Plasma numerical equivalence exceeded recorded tolerances.');
 before.dispose();after.dispose();return{links:count,frames,maximumPointError,maximumPackedInstanceError,maximumPackedLightError,changedInstanceFloats,changedLightFloats};
}
const cases=[1,newPlasma.MAX_PLASMA_LINKS].map(count=>({name:count===1?'Actual A1 connection':'Full bounded plasma pool using the same short span',before:operations(oldPool.PlasmaLinks,count),after:operations(newPool.PlasmaLinks,count),equivalence:equivalent(count)}));
function timings(count){
 const before=new oldPool.PlasmaLinks(),after=new newPool.PlasmaLinks(),links=Array.from({length:count},()=>({source,target}));before.setLinks(links);after.setLinks(links);
 const framesPerSample=30000,warmupRounds=2,measuredRounds=7,beforeMs=[],afterMs=[],order=[];
 const run=pool=>{pool.time=0;const start=performance.now();for(let frame=0;frame<framesPerSample;frame++){pool.advance(deltaSeconds);pool.prepare();}return performance.now()-start;};
 for(let round=0;round<warmupRounds;round++){if(round%2){run(after);run(before);}else{run(before);run(after);}}
 for(let round=0;round<measuredRounds;round++){
  if(round%2){order.push('after,before');afterMs.push(run(after));beforeMs.push(run(before));}
  else{order.push('before,after');beforeMs.push(run(before));afterMs.push(run(after));}
 }
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];before.dispose();after.dispose();
 return{links:count,framesPerSample,warmupRounds,measuredRounds,order,beforeMs,afterMs,beforeMedianMs:median(beforeMs),afterMedianMs:median(afterMs)};
}
const timing={method:'Local Bun CPU only: two warmup rounds then seven measured rounds per link count, alternating baseline/current order. Time only advance+prepare (including bound packing). Reset phase before each sample; exclude construction, endpoint setup, imports, instrumentation, comparisons, GPU upload/draw and browser work. No FPS or GPU timing claim.',environment:{runtime:Bun.version,platform:process.platform,architecture:process.arch,cpu:cpus()[0]?.model,logicalCpuCount:cpus().length,osRelease:release()},cases:[1,newPlasma.MAX_PLASMA_LINKS].map(timings)};
const resources={
 tubeRecordBytes:{before:oldArc.ARC_LIGHT_FLOATS*4,after:newArc.ARC_LIGHT_FLOATS*4},
 inactiveTubeBindingBytes:{before:oldArc.ARC_EMPTY_LIGHT_BYTES,after:newArc.ARC_EMPTY_LIGHT_BYTES},
 arcGPUBytes:{before:oldArc.MAX_ARC_INSTANCES*oldArc.ARC_INSTANCE_FLOATS*4+oldArc.ARC_LIGHT_BYTES,after:newArc.MAX_ARC_INSTANCES*newArc.ARC_INSTANCE_FLOATS*4+newArc.ARC_LIGHT_BYTES},
 plasmaGPUBytes:{before:oldPlasma.PLASMA_INSTANCE_BYTES+oldPlasma.COMBINED_TUBE_LIGHT_BYTES,after:newPlasma.PLASMA_INSTANCE_BYTES+newPlasma.COMBINED_TUBE_LIGHT_BYTES},
 plasmaMergeCPUBytes:{before:oldPlasma.COMBINED_TUBE_LIGHT_BYTES,after:newPlasma.COMBINED_TUBE_LIGHT_BYTES},
 a1ActiveUploadBytes:{before:oldPlasma.PLASMA_SEGMENTS*oldPlasma.PLASMA_INSTANCE_FLOATS*4+(4+oldArc.ARC_LIGHT_FLOATS)*4,after:newPlasma.PLASMA_SEGMENTS*newPlasma.PLASMA_INSTANCE_FLOATS*4+(4+newArc.ARC_LIGHT_FLOATS)*4},
 sharedWaveCacheCPUBytes:newPlasma.PLASMA_NODES*7*Float64Array.BYTES_PER_ELEMENT,
 allocationPolicy:'One module wave table and one fixed geometry array per PlasmaLinks pool. No added recurring allocations. Bounds append four floats per tube source; active-prefix upload and lazy scene ownership are preserved.'
};
const sourceFiles=['engine/plasma-links.js','engine/tube-light-bounds.js','engine/arc-effects.js','engine/arc-lighting.js','engine/shaders.js','shared/arc-effects.js'];
const sourceHashes={};for(const file of sourceFiles){const after=await Bun.file(resolve(repo,file)).text(),prior=Bun.file(resolve(baseline,file));sourceHashes[file]={after:new Bun.CryptoHasher('sha256').update(after).digest('hex'),before:await prior.exists()?new Bun.CryptoHasher('sha256').update(await prior.text()).digest('hex'):null};}
const report={date:'2026-10-18',measurement:'Measured JavaScript math-call counts, numerical equivalence and isolated local CPU timing; no GPU timing or FPS claim.',baselineRoot:baseline,currentRoot:repo,runtime:Bun.version,method:'Instrument Math.sin/cos/hypot only during 600 advance/prepare calls. Pool construction, endpoint setup, shared-table initialization and comparisons are outside the call-count window. Geometry equivalence is measured in a separate uninstrumented replay.',fixture:{level:'moss-01',source,target,frames,deltaSeconds},cases,timing,resources,sourceHashes,gpuEvidence:'Lead separately runs tools/plasma-check.html for exact production lighting equality and instrumented GPU segment-loop counts on 256 ground-box centres from each of moss-01 and moss-02; specular-check.html compares the exact production branch with the old expression. Those counts are not GPU timing.'};
if(output)await Bun.write(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
