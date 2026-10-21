import {test,expect} from 'bun:test';
import {turretModel} from '../scripts/turret.js';
import {PoseRig} from '../engine/rig.js';
import {identity} from '../shared/math.js';
import {TURRET_PITCH,TURRET_RECOIL,TURRET_TURN,TURRET_MUZZLES} from '../shared/arsenal.js';

function transform(m,p){return [0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);}

// Independent oriented-cell SAT, performed in the other part's local space.
// It checks every base/head/guns pair using the authored occupied cells.
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

const model=turretModel();
for(const [variant,{parts}] of Object.entries(model.variants))test(`turret ${variant} pitch/yaw/recoil keeps actual rigid cells separate`,()=>{
 const rig=new PoseRig({parts,root:identity(),instances:parts.map((p,index)=>({part:p.id,key:p.id,index,matrix:identity()}))},()=>{});
 const hashes=rig.bones.map(b=>new Map(b.part.voxels.map(c=>[c.slice(0,3).join(','),c]))),matrix=new Float64Array(16);let collision=null,samples=0;
 // Both pitch endpoints, intervening poses, full kick and partial recovery,
 // axial/diagonal headings plus asymmetric pedestal corner orientations.
 outer:for(const yaw of [0,22.5,45,67.5,90,135,180,270])for(let step=0;step<=28;step++)for(const recoil of [0,TURRET_RECOIL.distance/2,TURRET_RECOIL.distance]){
  const pitch=TURRET_PITCH.min+(TURRET_PITCH.max-TURRET_PITCH.min)*step/28;
  rig.setRotation(TURRET_TURN.part,0,yaw*Math.PI/180,0);rig.setRotation(TURRET_PITCH.part,pitch,0,0);rig.setTranslation(TURRET_RECOIL.part,0,0,recoil);rig.update();samples++;
  collision=firstOverlap(rig.bones,hashes,matrix);if(collision){collision={variant,yaw,pitch,recoil,...collision};break outer;}
 }
 expect(collision).toBeNull();expect(samples).toBe(696);
},120000);

test('turret pitching cradle keeps shell fixed, bores aligned and recoil along the tilted axis',()=>{
 for(const [variant,{parts}] of Object.entries(model.variants)){
  const rig=new PoseRig({parts,root:identity(),instances:parts.map((p,index)=>({part:p.id,key:p.id,index,matrix:identity()}))},()=>{});
  const guns=rig.byId.get('guns'),head=rig.byId.get('head'),base=rig.byId.get('base');
  const cells=new Set(guns.part.voxels.map(c=>c.slice(0,3).join(',')));
  for(const socket of TURRET_MUZZLES[variant]){
   expect(socket[1]).toBe(guns.part.pivot[1]);
   for(let depth=0;depth<4;depth++)expect(cells.has([Math.floor(socket[0]),Math.floor(socket[1]),socket[2]+depth].join(','))).toBe(false);
   expect(cells.has([Math.floor(socket[0]),Math.floor(socket[1]),socket[2]+4].join(','))).toBe(true);
  }
  rig.setRotation('head',0,.7,0);rig.setRotation('guns',TURRET_PITCH.max,0,0);rig.update();
  const headRest=head.instance.matrix.slice(),baseRest=base.instance.matrix.slice(),gunsRest=guns.instance.matrix.slice();
  const forward=transform(gunsRest,[0,0,-1]),origin=transform(gunsRest,[0,0,0]);expect(forward[1]-origin[1]).toBeGreaterThan(0);
  rig.setTranslation('guns',0,0,TURRET_RECOIL.distance);expect(rig.update()).toBe(1);
  expect(head.instance.matrix).toEqual(headRest);expect(base.instance.matrix).toEqual(baseRest);
  for(let axis=0;axis<3;axis++)expect(guns.instance.matrix[12+axis]-gunsRest[12+axis]).toBeCloseTo(gunsRest[8+axis]*TURRET_RECOIL.distance,5);
 }
});
