import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {VolumeTrailField,VOLUME_TRAILS,VOLUME_FLOATS} from '../../engine/volume-trail-field.js';
const revision='3136e67',source=execFileSync('git',['show',revision+':engine/volume-trail-field.js'],{encoding:'utf8'}).replace("'../shared/missile-flight.js'",JSON.stringify(new URL('../../shared/missile-flight.js',import.meta.url).href));
const {VolumeTrailField:Before}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const eye=[10,220,40],mirror=[10,-180,40],results=[];
const seed=(field,count)=>{for(let n=0;n<64;n++)for(let id=0;id<count;id++)field.sample(id,id*3+Math.sin(n*.1)*14,35+n*1.2,id*2+n*.7,n*.025);field.expire(1.8);};
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[sorted.length>>1];};
for(const count of [1,8,36,VOLUME_TRAILS]){
 const before=new Before(),after=new VolumeTrailField(),data=new Float32Array(VOLUME_TRAILS*VOLUME_FLOATS),reflected=new Float32Array(data.length),expected=new Float32Array(data.length),offsets=new Uint32Array(VOLUME_TRAILS);seed(before,count);seed(after,count);
 before.pack(expected,eye);after.pack(data,eye);if(!Buffer.from(data.buffer).equals(Buffer.from(expected.buffer)))throw new Error('Main packets differ: '+count);
 for(let i=0;i<count;i++)offsets[after.order[i]]=i*VOLUME_FLOATS;
 const reorder=()=>{after.sort(mirror);for(let i=0;i<count;i++){const from=offsets[after.order[i]],to=i*VOLUME_FLOATS;for(let k=0;k<VOLUME_FLOATS;k++)reflected[to+k]=data[from+k];}};
 reorder();before.pack(expected,mirror);if(!Buffer.from(reflected.buffer).equals(Buffer.from(expected.buffer)))throw new Error('Mirror packets differ: '+count);
 const iterations=300,batches={before:[],after:[]};
 for(let batch=0;batch<9;batch++)for(const kind of batch%2?['after','before']:['before','after']){
  const start=performance.now();for(let i=0;i<iterations;i++){if(kind==='before'){before.pack(data,eye);before.pack(reflected,mirror);}else{after.pack(data,eye);for(let j=0;j<count;j++)offsets[after.order[j]]=j*VOLUME_FLOATS;reorder();}}
  if(batch)batches[kind].push((performance.now()-start)/iterations);
 }
 results.push({trails:count,pointsPerTrail:64,exactMainAndMirrorPackets:true,beforeMedianMS:median(batches.before),afterMedianMS:median(batches.after),batches});
}
const report={revision,method:'Bun isolated CPU path packing, original two complete packs versus one complete pack plus sort/copy, eight measured alternating batches of 300 iterations after warmup. 64 native-format points per synthetic path; not whole-frame or browser CPU timing.',results};
writeFileSync(new URL('cpu-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
