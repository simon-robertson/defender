// Geometry/startup audit only; run from the repository with Bun.
import {biomeVistaGeometry} from '../../engine/vista-geometry.js';
const previous={A:3307536,B:3714480,C:4159584,D:4042944},zones={};
for(const zone of ['A','B','C','D']){
 const samples=[];let a;
 biomeVistaGeometry(zone);
 for(let i=0;i<9;i++){const start=performance.now();a=biomeVistaGeometry(zone);samples.push(performance.now()-start);}
 let minY=Infinity,maxY=-Infinity,minColor=Infinity,maxColor=-Infinity,meanLuminance=0;
 for(let i=0;i<a.length;i+=6){minY=Math.min(minY,a[i+1]);maxY=Math.max(maxY,a[i+1]);for(let c=3;c<6;c++){minColor=Math.min(minColor,a[i+c]);maxColor=Math.max(maxColor,a[i+c]);}meanLuminance+=a[i+3]*.2126+a[i+4]*.7152+a[i+5]*.0722;}
 samples.sort((a,b)=>a-b);
 zones[zone]={bytes:a.byteLength,previousBytes:previous[zone],changeBytes:a.byteLength-previous[zone],vertices:a.length/6,triangles:a.length/18,minY,maxY,minColor,maxColor,meanVertexLuminance:meanLuminance/(a.length/6),sha256:new Bun.CryptoHasher('sha256').update(a).digest('hex'),geometryGenerationMilliseconds:{samples:9,min:samples[0],median:samples[4],max:samples.at(-1)}};
}
const result={scope:'Pure geometry and one-time CPU generation only; not render timings or GPU performance.',zones};
await Bun.write(new URL('./vista-geometry.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
