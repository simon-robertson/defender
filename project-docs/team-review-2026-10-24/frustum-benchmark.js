// Development evidence only; no renderer or production dependency.
import {waterInView} from './rejected-water-culling.js';
import {lookAt,perspective,multiply} from '../../shared/math.js';
import {waterInView as old} from '../../engine/planar-reflection.js';
let seed=9223;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const v=new Float32Array(16),p=new Float32Array(16),m=new Float32Array(16);let mismatches=0,rejects=0,first;
for(let i=0;i<100000;i++){
 lookAt(v,[random()*1000,random()*400+80,random()*1000],[240,24,192]);perspective(p,Math.PI/3,1.5,.1,2200);multiply(m,p,v);
 const plane=i%6,row=plane>>1,sign=plane&1?-1:1;
 const a=[0,4,8,12].map(k=>plane===4?m[k+2]:m[k+3]+sign*m[k+row]);
 const x=random()*480,z=random()*384,y=-(a[0]*x+a[2]*z+a[3])/a[1];
 if(!Number.isFinite(y))continue;const b=[x,y,z,x,y,z],baseline=old(b,m),current=waterInView(b,m);
 if(baseline!==current){mismatches++;if(!current)rejects++;first??={plane,b,m:Array.from(m),baseline,current};}
}
console.log(JSON.stringify({mismatches,newRejects:rejects,first},null,2));
const cases=[];
for(let i=0;i<256;i++){
 lookAt(v,[random()*1000,random()*400+80,random()*1000],[240,24,192]);perspective(p,Math.PI/3,1.5,.1,2200);multiply(m,p,v);
 cases.push({matrix:m.slice(),bounds:[random()*200,0,random()*150,280+random()*200,24,230+random()*154]});
}
let sink=0;const time=fn=>{const start=performance.now();for(let i=0;i<500000;i++){const c=cases[i%cases.length];sink+=fn(c.bounds,c.matrix)?1:0;}return performance.now()-start;};
time(old);time(waterInView);const samples=[];for(let i=0;i<5;i++)samples.push({baselineMs:time(old),currentMs:time(waterInView)});console.log(JSON.stringify({samples,sink}));
