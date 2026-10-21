import {newLevel} from '../../shared/level.js';
import {buildWorld,disposeWorld} from '../../engine/world.js';
import {ENEMY_IMPACT} from '../../engine/enemy-impact.js';
import {EnemyPreview} from '../../game/enemy-preview.js';

// Independent actual-cell and foot-support verification for the impact gait.
// Dog joint interfaces and pairs already intersecting in the simultaneous
// accepted unhit pose are excluded; body/new cross-chain collisions are not.
export async function balanceProbe(model,step=11,directionArg){
function transform(m,p){return [0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);}

// Independent oriented-cell SAT, performed in the other part's local space.
// It checks all distinct rigid parts, including both feet and adjacent chains.
function relative(out,a,b){
 for(let col=0;col<3;col++)for(let row=0;row<3;row++)out[col*4+row]=a[row*4]*b[col*4]+a[row*4+1]*b[col*4+1]+a[row*4+2]*b[col*4+2];
 for(let row=0;row<3;row++)out[12+row]=a[row*4]*(b[12]-a[12])+a[row*4+1]*(b[13]-a[13])+a[row*4+2]*(b[14]-a[14]);
}
function overlaps(m,c,f){
 const d=transform(m,[c[0]+.5,c[1]+.5,c[2]+.5]).map((v,i)=>v-f[i]-.5),axes=[[1,0,0],[0,1,0],[0,0,1],[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]];
 for(let i=0;i<3;i++)for(let j=3;j<6;j++){const a=axes[i],b=axes[j];axes.push([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]);}
 for(const a of axes){
  const length=Math.hypot(...a);if(length<1e-6)continue;
  const separation=Math.abs(d[0]*a[0]+d[1]*a[1]+d[2]*a[2]),extent=(Math.abs(a[0])+Math.abs(a[1])+Math.abs(a[2])+Math.abs(a[0]*m[0]+a[1]*m[1]+a[2]*m[2])+Math.abs(a[0]*m[4]+a[1]*m[5]+a[2]*m[6])+Math.abs(a[0]*m[8]+a[1]*m[9]+a[2]*m[10]))*.5;
  if(separation>=extent-1e-5*length)return false;
 }
 return true;
}
function firstOverlap(bones,hashes,m){
 for(let i=0;i<bones.length;i++)for(let j=i+1;j<bones.length;j++){
  const a=bones[i],b=bones[j];if(model==='dog'&&a.part.id!=='body'&&b.part.id!=='body'&&(a.parent===b||b.parent===a))continue;relative(m,a.pose,b.pose);
  for(const c of b.part.voxels){
   const p=transform(m,[c[0]+.5,c[1]+.5,c[2]+.5]);
   // A rotated unit cube has maximum centre-to-vertex extent sqrt(3)/2.
   for(let x=Math.floor(p[0]-.867);x<=Math.floor(p[0]+.867);x++)for(let y=Math.floor(p[1]-.867);y<=Math.floor(p[1]+.867);y++)for(let z=Math.floor(p[2]-.867);z<=Math.floor(p[2]+.867);z++){
    const other=hashes[i].get(`${x},${y},${z}`);if(other&&overlaps(m,c,other)){if(model==='dog'){relative(baselineMatrix,baselinePoses[i],baselinePoses[j]);if(baselinePairs.has(i+','+j))continue;}return {a:a.part.id,b:b.part.id,cell:c.slice(0,3),other:other.slice(0,3)};}
   }
  }
 }
 return null;
}



const source=await Bun.file(new URL(`../../assets/models/${model}.json`,import.meta.url)).json();
const route=[[1,1],[2,1],[3,1],[4,1],[4,2],[4,3],[4,4],[3,4],[2,4],[2,5],[2,6],[3,6],[4,6],[5,6]],level=newLevel('balance-probe');level.size=[16,16];level.path=route.map(([x,z])=>[x+2,0,z+2]);
const actors=[{id:'target',model,variant:'base',distance:0}],world=buildWorld(level,new Map([[model,source]]),{actors}),preview=new EnemyPreview(world,()=>{},null,actors),s=preview.states[0];
const bones=s.rig.bones,hashes=bones.map(b=>new Map(b.part.voxels.map(c=>[c.slice(0,3).join(','),c]))),matrix=new Float64Array(16),meshes=new Map(world.entries.map(e=>[e.key,e.mesh.vertices]));
const baselinePairs=new Set();
const baselinePoses=bones.map(()=>new Float32Array(16)),baselineMatrix=new Float64Array(16);
const refWorld=buildWorld(level,new Map([[model,source]]),{actors}),reference=new EnemyPreview(refWorld,()=>{},null,actors),ref=reference.states[0];
let failure=null,count=0,maxAngle=0,maxFootError=0,minY=Infinity,maxR=0,maxSoleR=0,contactError=0;
const lastFeet=s.gait.feet.map(()=>({contact:NaN,stance:false,position:[0,0,0]}));
outer:for(let d=24;d<preview.path.length-30;d+=step)for(let direction=0;direction<9;direction++){
 if(directionArg!==undefined&&direction!==Number(directionArg))continue;s.seed=ref.seed=d;preview.reset();reference.reset();for(const foot of lastFeet)foot.contact=NaN;const a=direction*Math.PI/4;
 preview.takeHit(s,.001,direction===8?0:60*Math.cos(a),direction===8?-80:-40,direction===8?0:60*Math.sin(a));
 for(let frame=1;frame<=ENEMY_IMPACT.seconds*60;frame++){
  try{preview.advance(1/60);reference.advance(1/60);}catch(e){failure={d,direction,age:s.impact.age,error:e.message};break outer;}
  maxAngle=Math.max(maxAngle,Math.hypot(s.impact.pitch,s.impact.roll)*180/Math.PI);
  if(frame%10!==0&&frame!==3&&frame!==Math.round(60/ENEMY_IMPACT.omega)&&frame!==ENEMY_IMPACT.seconds*60)continue;
  for(let i=0;i<bones.length;i++)baselinePoses[i].set(ref.rig.bones[i].pose);
  baselinePairs.clear();if(model==='dog')for(let i=0;i<bones.length;i++)for(let j=i+1;j<bones.length;j++){relative(baselineMatrix,baselinePoses[i],baselinePoses[j]);outerPair:for(const cell of bones[j].part.voxels){const p=transform(baselineMatrix,[cell[0]+.5,cell[1]+.5,cell[2]+.5]);for(let x=Math.floor(p[0]-.867);x<=Math.floor(p[0]+.867);x++)for(let y=Math.floor(p[1]-.867);y<=Math.floor(p[1]+.867);y++)for(let z=Math.floor(p[2]-.867);z<=Math.floor(p[2]+.867);z++){const f=hashes[i].get(`${x},${y},${z}`);if(f&&overlaps(baselineMatrix,cell,f)){baselinePairs.add(i+','+j);break outerPair;}}}}const hit=firstOverlap(bones,hashes,matrix);if(hit){failure={d,direction,age:s.impact.age,yaw:s.yaw,pitch:s.impact.pitch,roll:s.impact.roll,bob:s.impact.bob,phases:s.gait.feet.map(f=>f.phase),...hit};break outer;}
  for(const f of s.gait.feet){const b=s.rig.byId.get(f.paw),m=b.instance.matrix,p=transform(m,b.part.pivot);for(let i=0;i<3;i++)maxFootError=Math.max(maxFootError,Math.abs(p[i]-f.position[i]));maxFootError=Math.max(maxFootError,Math.abs(m[1]),Math.abs(m[4]),Math.abs(m[6]),Math.abs(m[9]),Math.abs(m[5]-1));}
  for(const b of bones){const m=b.instance.matrix,v=meshes.get(b.instance.key);for(let i=0;i<v.length;i+=11){const p=transform(m,[v[i],v[i+1],v[i+2]]);minY=Math.min(minY,p[1]);maxR=Math.max(maxR,Math.hypot(p[0]-s.x,p[2]-s.z));if(s.gait.feet.some(f=>f.paw===b.part.id)){maxSoleR=Math.max(maxSoleR,Math.hypot(p[0]-s.x,p[2]-s.z));}}}
  for(let i=0;i<s.gait.feet.length;i++){const foot=s.gait.feet[i],last=lastFeet[i],p=[foot.position[0]-s.impact.offsetX,foot.position[1],foot.position[2]-s.impact.offsetZ];if(foot.stance&&last.stance&&last.contact===foot.contact)for(let axis=0;axis<3;axis++)contactError=Math.max(contactError,Math.abs(p[axis]-last.position[axis]));last.contact=foot.contact;last.stance=foot.stance;last.position=p;}
  count++;
 }
}
preview.dispose();reference.dispose();disposeWorld(world);disposeWorld(refWorld);
return {model,step,count,failure,maxAngle,minY,maxR,maxSoleR,maxFootError,contactError};
}
if(import.meta.main)console.log(JSON.stringify(await balanceProbe(process.argv[2]??'dog',Number(process.argv[3]??11),process.argv[4])));
