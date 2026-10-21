import {test,expect} from 'bun:test';
import {wildlifeModels,wildlifeBirdModel,wildlifeGroundModel,WILDLIFE_MODEL_IDS,WILDLIFE_RIG_CONTRACTS} from '../scripts/wildlife-models.js';
import {validateModel} from '../shared/model.js';
import {meshPart} from '../shared/mesher.js';
import {PoseRig} from '../engine/rig.js';
import {identity} from '../shared/math.js';

test('eight saved wildlife sources retain deterministic small matte scenery contracts',async()=>{
 const all=wildlifeModels();expect(all.length).toBe(8);expect(new Set(all.map(m=>m.id)).size).toBe(8);
 for(const zone of Object.keys(WILDLIFE_MODEL_IDS)){
  expect(wildlifeModels(zone).map(m=>m.id)).toEqual(Object.values(WILDLIFE_MODEL_IDS[zone]));
  for(const m of wildlifeModels(zone)){
   expect(m).toEqual(await Bun.file(`assets/models/${m.id}.json`).json());
   validateModel(m);expect(m.version).toBe(3);expect(m.role).toBe('scenery');expect(m.colorMode).toBe('authored');
   expect(m.materials.every(v=>v.emission===0&&v.reflectiveness===0)).toBe(true);
   for(const variant of ['upgrade1','upgrade2'])expect(m.variants[variant].parts.every(p=>!p.voxels.length)).toBe(true);
   const cells=m.variants.base.parts.flatMap(p=>p.voxels);
   const min=[0,1,2].map(i=>Math.min(...cells.map(c=>c[i]))),max=[0,1,2].map(i=>Math.max(...cells.map(c=>c[i]+1)));
   expect(min[1]).toBe(0);expect(max[0]-min[0]).toBeLessThanOrEqual(8);expect(max[2]-min[2]).toBeLessThanOrEqual(8);
   expect(max[1]).toBeLessThanOrEqual(9);expect(new Set(cells.map(c=>c.slice(0,3).join())).size).toBe(cells.length);
   const fresh=wildlifeModels(zone).find(n=>n.id===m.id);expect(fresh).toEqual(m);
   m.variants.base.parts[0].voxels[0][3]=99;expect(wildlifeModels(zone).find(n=>n.id===m.id)).toEqual(fresh);
  }
 }
 expect(()=>wildlifeModels('unknown')).toThrow();
});

test('shared hare and bird forms differ only through their authored zone palettes',()=>{
 expect(wildlifeGroundModel('A').variants).toEqual(wildlifeGroundModel('C').variants);
 expect(wildlifeGroundModel('A').materials).not.toEqual(wildlifeGroundModel('C').materials);
 for(const zone of ['B','C','D']){
  expect(wildlifeBirdModel(zone).variants).toEqual(wildlifeBirdModel('A').variants);
  expect(wildlifeBirdModel(zone).materials).not.toEqual(wildlifeBirdModel('A').materials);
 }
});

test('each wildlife part is connected, with no overlapping or coplanar inter-part faces',()=>{
 const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 for(const m of wildlifeModels()){
  const occupied=new Map(m.variants.base.parts.flatMap(p=>p.voxels.map(c=>[c.slice(0,3).join(),p.id])));
  for(const p of m.variants.base.parts){
   const remaining=new Map(p.voxels.map(c=>[c.slice(0,3).join(),c])),queue=[p.voxels[0]];
   remaining.delete(queue[0].slice(0,3).join());
   for(let i=0;i<queue.length;i++)for(const d of directions){
    const c=queue[i],key=[c[0]+d[0],c[1]+d[1],c[2]+d[2]].join();
    const owner=occupied.get(key);expect(owner===undefined||owner===p.id).toBe(true);
    const neighbour=remaining.get(key);if(neighbour){remaining.delete(key);queue.push(neighbour);}
   }
   expect(remaining.size).toBe(0);
  }
 }
});

test('wildlife meshes retain exposed materials and valid finite buffers',()=>{
 for(const m of wildlifeModels())for(const p of m.variants.base.parts){
  const mesh=meshPart(m,p);expect(mesh.quads.length).toBeGreaterThan(0);
  expect(Array.from(mesh.vertices).every(Number.isFinite)).toBe(true);
  expect(mesh.indices.length).toBe(mesh.quads.length*6);
  expect(mesh.quads.every(q=>q.material>=0&&q.material<m.materials.length)).toBe(true);
 }
});

// Independent cell SAT: a rotated wing cube against an axis-aligned body cube.
function overlaps(matrix,cell,fixed){
 const delta=[0,1,2].map(i=>matrix[i]*(cell[0]+.5)+matrix[4+i]*(cell[1]+.5)+matrix[8+i]*(cell[2]+.5)+matrix[12+i]-fixed[i]-.5);
 const basis=[[1,0,0],[0,1,0],[0,0,1]],rotated=[0,4,8].map(i=>Array.from(matrix.slice(i,i+3))),axes=[...basis,...rotated];
 for(const a of basis)for(const b of rotated)axes.push([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]);
 for(const axis of axes){
  const length=Math.hypot(...axis);if(length<1e-6)continue;
  const separation=Math.abs(delta.reduce((n,c,i)=>n+c*axis[i],0));
  const extent=(axis.reduce((n,c)=>n+Math.abs(c),0)+rotated.reduce((n,b)=>n+Math.abs(b.reduce((v,c,i)=>v+c*axis[i],0)),0))*.5;
  if(separation>=extent-1e-5*length)return false;
 }
 return true;
}

test('bird perch and complete permitted flap range clear body, opposite wing and ground',()=>{
 const m=wildlifeBirdModel('A'),parts=m.variants.base.parts,contract=WILDLIFE_RIG_CONTRACTS.bird;
 const rig=new PoseRig({parts,root:identity(),instances:parts.map((p,index)=>({part:p.id,key:p.id,index,matrix:identity()}))},()=>{});
 expect(contract.axis).toBe('z');expect(contract.root).toEqual([12,0,12]);expect(contract.forward).toEqual([0,0,-1]);
 expect(parts[0].id).toBe(contract.body);expect(parts[0].pivot).toEqual(contract.root);
 for(const wing of contract.wings){const p=rig.byId.get(wing.id).part;expect(p.parent).toBe('body');expect(p.pivot).toEqual(wing.pivot);}
 let collision=null,minHeight=Infinity,maxWidth=0;
 for(let angle=contract.limitsDegrees[0];angle<=contract.limitsDegrees[1];angle++){
  for(const wing of contract.wings)rig.setRotation(wing.id,0,0,wing.sign*angle*Math.PI/180);rig.update();
  let minX=Infinity,maxX=-Infinity;
  for(const wing of contract.wings){
   const bone=rig.byId.get(wing.id),matrix=bone.pose;
   for(const c of bone.part.voxels){
    for(const body of parts[0].voxels)if(overlaps(matrix,c,body))collision={angle,wing:wing.id,cell:c,body};
    for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){
     const x=c[0]+dx,y=c[1]+dy,z=c[2]+dz;
     const px=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12],py=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13];
     minX=Math.min(minX,px);maxX=Math.max(maxX,px);minHeight=Math.min(minHeight,py);
     // Separate X halfspaces also exclude any wing-to-wing intersection.
     expect(wing.sign===1?px<12:px>12).toBe(true);
    }
   }
  }
  maxWidth=Math.max(maxWidth,maxX-minX);
 }
 expect(collision).toBeNull();expect(minHeight).toBeGreaterThan(1);expect(maxWidth).toBeLessThan(10);
 expect(contract.perchDegrees).toBeLessThanOrEqual(contract.limitsDegrees[1]);
 expect(contract.flightDegrees[0]).toBeGreaterThanOrEqual(contract.limitsDegrees[0]);
 expect(contract.flightDegrees[1]).toBeLessThanOrEqual(contract.limitsDegrees[1]);
});
