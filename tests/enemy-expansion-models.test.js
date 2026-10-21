import {test,expect} from 'bun:test';
import {enemyExpansionModels,enemyExpansionModel} from '../scripts/enemy-expansion.js';
import {ENEMY_EXPANSION_RIGS as R,ENEMY_EXPANSION_IDS} from '../shared/enemy-expansion-rigs.js';
import {validateModel} from '../shared/model.js';
import {meshPart} from '../shared/mesher.js';
import {ModelLights} from '../engine/model-lights.js';
import {PoseRig} from '../engine/rig.js';
import {identity} from '../shared/math.js';
import {PathMotion} from '../engine/path-motion.js';
import {EnemyExpansionGait,ENEMY_EXPANSION_MOVEMENT} from '../engine/enemy-expansion-gait.js';

const models=enemyExpansionModels();
function fixture(m){const parts=m.variants.base.parts,data={parts,root:identity(),instances:parts.map((p,index)=>({part:p.id,key:p.id,index,matrix:identity()}))};return new PoseRig(data,()=>{});}
function connected(part){const remaining=new Map(part.voxels.map(c=>[c.slice(0,3).join(','),c])),queue=[part.voxels[0]];remaining.delete(queue[0].slice(0,3).join(','));for(let i=0;i<queue.length;i++)for(const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const c=queue[i],k=[c[0]+d[0],c[1]+d[1],c[2]+d[2]].join(','),n=remaining.get(k);if(n){remaining.delete(k);queue.push(n);}}return remaining.size;}
function bounds(rig,rootX=12,rootZ=12){let radius=0,minY=Infinity,maxY=-Infinity,maxPart=null;for(const b of rig.bones)for(const c of b.part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){const p=transform(b.instance.matrix,[c[0]+dx,c[1]+dy,c[2]+dz]);const r=Math.hypot(p[0]-rootX,p[2]-rootZ);if(r>radius){radius=r;maxPart={id:b.part.id,cell:c.slice(0,3),point:p};}minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}return{radius,minY,maxY,maxPart};}

test('all seven expansion models reproduce canonical sources with grounded, unique connected grid parts',async()=>{
 expect(models).toHaveLength(7);expect(models.map(m=>m.id)).toEqual(ENEMY_EXPANSION_IDS);
 expect(()=>enemyExpansionModel('concertina')).toThrow('Unknown enemy expansion model');expect(await Bun.file('assets/models/concertina.json').exists()).toBe(false);expect(await Bun.file('build/models/concertina.mesh.json').exists()).toBe(false);
 for(const m of models){validateModel(m);expect(m).toEqual(await Bun.file(`assets/models/${m.id}.json`).json());expect(enemyExpansionModel(m.id)).toEqual(m);expect(m.role).toBe('enemy');expect(m.colorMode).toBe('authored');expect(m.variants.base.parts[0].id).toBe('body');expect(m.variants.base.parts[0].pivot).toEqual([12,0,12]);
  for(const v of ['upgrade1','upgrade2'])expect(m.variants[v].parts.every(p=>!p.voxels.length)).toBe(true);
  const cells=m.variants.base.parts.flatMap(p=>p.voxels);expect(new Set(cells.map(c=>c.slice(0,3).join(','))).size).toBe(cells.length);
  for(const p of m.variants.base.parts){expect({model:m.id,part:p.id,disconnected:connected(p)}).toEqual({model:m.id,part:p.id,disconnected:0});for(const c of p.voxels)expect(c.slice(0,3).every((v,i)=>Number.isInteger(v)&&v>=0&&v<m.size[i])).toBe(true);}
 }
});

test('approved sensors alone emit and each of the seven meshes exposes exactly one local-light cluster',()=>{
 const entries=[],drawMap=new Map();
 for(const m of models){for(const [i,mat]of m.materials.entries()){expect(mat.reflectiveness).toBe(0);expect(mat.emission).toBe(i===6?1:0);expect(mat.castsLight===true).toBe(i===6);}
  const local=[],draws=new Map();let quads=0;
  for(const p of m.variants.base.parts){const mesh=meshPart(m,p),key=`${m.id}:${p.id}`,transforms=[identity()],entry={key,mesh,transforms};quads+=mesh.quads.length;expect(Array.from(mesh.vertices).every(Number.isFinite)).toBe(true);expect(mesh.indices.length).toBe(mesh.quads.length*6);local.push(entry);draws.set(key,{transforms:new Float32Array(transforms[0])});entries.push(entry);drawMap.set(key,draws.get(key));}
  const lights=new ModelLights(local,draws);expect({id:m.id,clusters:lights.authoredCount,overflow:lights.overflow}).toEqual({id:m.id,clusters:1,overflow:0});lights.dispose();expect(quads).toBeGreaterThan(20);
 }
 const lights=new ModelLights(entries,drawMap);expect(lights.authoredCount).toBe(7);expect(lights.overflow).toBe(0);lights.dispose();
});

test('animated part IDs, parents and pivots agree with the immutable geometry contracts',()=>{
 for(const m of models){const r=R[m.id],parts=new Map(m.variants.base.parts.map(p=>[p.id,p]));expect(Object.isFrozen(r)).toBe(true);expect(r.root).toEqual([12,0,12]);expect(r.forward).toEqual([0,0,-1]);
  for(const a of [r.wheels,r.wings,r.rotors])for(const p of a??[]){expect(parts.get(p.id).pivot).toEqual(p.pivot);expect(parts.get(p.id).parent).toBe(p.parent??'body');}
  for(const l of r.legs??[])for(let i=0;i<3;i++){expect(parts.get(l.ids[i]).pivot).toEqual([l.hip,l.knee,l.ankle][i]);expect(parts.get(l.ids[i]).parent).toBe(i?l.ids[i-1]:'body');}
  const point=r.effectOrigin.point;expect(r.effectOrigin.part).toBe('body');expect(parts.get('body').voxels.some(c=>point.every((v,i)=>v>=c[i]&&v<=c[i]+1))).toBe(true);
 }
});

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
  const a=bones[i],b=bones[j];relative(m,a.pose,b.pose);
  for(const c of b.part.voxels){
   const p=transform(m,[c[0]+.5,c[1]+.5,c[2]+.5]);
   // A rotated unit cube has maximum centre-to-vertex extent sqrt(3)/2.
   for(let x=Math.floor(p[0]-.867);x<=Math.floor(p[0]+.867);x++)for(let y=Math.floor(p[1]-.867);y<=Math.floor(p[1]+.867);y++)for(let z=Math.floor(p[2]-.867);z<=Math.floor(p[2]+.867);z++){
    const other=hashes[i].get(`${x},${y},${z}`);if(other&&overlaps(m,c,other))return {a:a.part.id,b:b.part.id,cell:c.slice(0,3),other:other.slice(0,3)};
   }
  }
 }
 return null;
}


function hashed(rig){return rig.bones.map(b=>new Map(b.part.voxels.map(c=>[c.slice(0,3).join(','),c])));}
function rootPose(rig,x,y,z,yaw,bank=0){const c=Math.cos(yaw),s=Math.sin(yaw),cb=Math.cos(bank),sb=Math.sin(bank),m=rig.root;m.fill(0);m[0]=c*cb;m[1]=sb;m[2]=-s*cb;m[4]=-c*sb;m[5]=cb;m[6]=s*sb;m[8]=s;m[10]=c;m[12]=x-m[0]*12-m[8]*12;m[13]=y-m[1]*12;m[14]=z-m[2]*12-m[10]*12;m[15]=1;rig.invalidateRoot();}

test('rolling, wing and rotor envelopes preserve actual occupied-part separation',()=>{
 const report={};
 for(const m of models.filter(m=>m.id!=='tripod')){
  const r=R[m.id],rig=fixture(m),hashes=hashed(rig),relativeMatrix=new Float64Array(16);let collision=null,minY=Infinity,maxY=0,radius=0,poses=0;
  for(let i=0;i<36;i++){
   const phase=i*Math.PI/18;
   for(const w of r.wheels??[])rig.setRotation(w.id,phase,0,0);
   for(const [j,w]of(r.wings??[]).entries())rig.setRotation(w.id,0,0,w.sign*r.maxFlapDegrees*Math.PI/180*Math.sin(phase+(j>=2?.35*Math.PI:0)));
   for(const [j,f]of(r.rotors??[]).entries())rig.setRotation(f.id,0,(j%2?-1:1)*phase,0);
   rootPose(rig,12,r.groundOffset,12,0,(r.maxBankDegrees??0)*Math.PI/180*Math.sin(phase));rig.update();
   collision=firstOverlap(rig.bones,hashes,relativeMatrix);if(collision)break;
   const b=bounds(rig);minY=Math.min(minY,b.minY);maxY=Math.max(maxY,b.maxY);radius=Math.max(radius,b.radius);poses++;
  }
  expect({model:m.id,collision}).toEqual({model:m.id,collision:null});if(r.movement==='ground')expect(minY).toBeGreaterThanOrEqual(-1e-5);
  report[m.id]={poses,minY,maxY,radius};
 }
 console.log('EXPANSION_MECHANISM_BOUNDS',JSON.stringify(report));
},60000);

test('Tripod full gait keeps flat planted feet, reach, ground and actual-part clearance through both turns',()=>{
 const m=enemyExpansionModel('tripod'),rig=fixture(m),path=new PathMotion([[1,0,1],[2,0,1],[3,0,1],[3,0,2],[3,0,3],[2,0,3],[1,0,3],[1,0,4],[2,0,4]],12),gait=new EnemyExpansionGait(rig,path,0,'tripod'),hashes=hashed(rig),relativeMatrix=new Float64Array(16),p=new Float64Array(3);
 let collision=null,minY=Infinity,radius=0,footError=0,poses=0,maxPart=null,maxDistance=0,soleRadius=0;const previous=gait.feet.map(()=>({contact:NaN,stance:false,matrix:identity()}));let plantedError=0;
 for(let sample=0;sample<path.length*4;sample++){
  const distance=sample/4;path.sample(distance,p);rootPose(rig,p[0],-gait.settings.crouch,p[1],p[2]);gait.pose(distance,p[0],p[1],p[2]);rig.update();
  for(const [i,f]of gait.feet.entries()){const b=rig.byId.get(f.paw),pos=transform(b.instance.matrix,b.part.pivot),last=previous[i];for(let k=0;k<3;k++)footError=Math.max(footError,Math.abs(pos[k]-f.position[k]));footError=Math.max(footError,Math.abs(b.instance.matrix[1]),Math.abs(b.instance.matrix[4]),Math.abs(b.instance.matrix[6]),Math.abs(b.instance.matrix[9]),Math.abs(b.instance.matrix[5]-1));if(last.stance&&f.stance&&last.contact===f.contact)for(let k=0;k<16;k++)plantedError=Math.max(plantedError,Math.abs(last.matrix[k]-b.instance.matrix[k]));last.stance=f.stance;last.contact=f.contact;last.matrix.set(b.instance.matrix);}
  const b=bounds(rig,p[0],p[1]);minY=Math.min(minY,b.minY);if(b.radius>radius){radius=b.radius;maxPart=b.maxPart;maxDistance=distance;}for(const bone of rig.bones.filter(b=>b.part.id.startsWith('foot-')))for(const cell of bone.part.voxels)for(const dx of [0,1])for(const dz of [0,1]){const q=transform(bone.instance.matrix,[cell[0]+dx,cell[1],cell[2]+dz]);soleRadius=Math.max(soleRadius,Math.hypot(q[0]-p[0],q[2]-p[1]));}poses++;
  collision=firstOverlap(rig.bones,hashes,relativeMatrix);if(collision){collision.distance=distance;collision.bounds=b;break;}
 }
 console.log('EXPANSION_TRIPOD_BOUNDS',JSON.stringify({poses,minY,radius,soleRadius,maxPart,maxDistance,footError,plantedError,rule:gait.settings,collision}));
 expect(collision).toBeNull();expect(minY).toBeGreaterThan(-1e-4);expect(radius).toBeLessThan(12);expect(footError).toBeLessThan(1e-4);expect(plantedError).toBeLessThan(1e-4);gait.dispose();
},60000);
