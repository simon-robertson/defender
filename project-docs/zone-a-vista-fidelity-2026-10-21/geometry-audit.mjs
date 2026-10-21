// One-time startup/geometry audit; no GPU or frame-rate claim.
import {biomeVistaGeometry as before} from './baseline-vista-geometry.js';
import {biomeVistaGeometry as after} from '../../engine/vista-geometry.js';
const hash=data=>new Bun.CryptoHasher('sha256').update(data).digest('hex'),result={};
for(const zone of ['A','B','C','D']){
 const a=before(zone),b=after(zone),times={};
 for(const [label,generate]of [['before',before],['after',after]]){
  generate(zone);const samples=[];for(let i=0;i<5;i++){const start=performance.now();generate(zone);samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);times[label]={samples:5,min:samples[0],median:samples[2],max:samples[4]};
 }
 result[zone]={before:{bytes:a.byteLength,vertices:a.length/6,sha256:hash(a)},after:{bytes:b.byteLength,vertices:b.length/6,sha256:hash(b)},unchanged:hash(a)===hash(b),generationMs:times};
}
await Bun.write(new URL('./geometry-audit.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
