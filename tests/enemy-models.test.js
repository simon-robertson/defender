import {test,expect} from 'bun:test';
import {enemyModels,walkerModel,spiderModel,ENEMY_RIG_CONTRACTS} from '../scripts/enemy-models.js';
import {validateModel} from '../shared/model.js';
import {meshPart} from '../shared/mesher.js';
import {PoseRig} from '../engine/rig.js';
import {identity} from '../shared/math.js';

test('Walker and Spider reproduce the accepted saved designs without shared mutable state',async()=>{
 for(const generate of [walkerModel,spiderModel]) {
  const first=generate(),second=generate();validateModel(first);
  expect(first).toEqual(await Bun.file(`assets/models/${first.id}.json`).json());
  expect(second).toEqual(first);first.variants.base.parts[0].voxels[0][3]=99;
  expect(generate()).toEqual(second);
 }
});

test('enemy geometry has only emissive eyes, stays matte and bounded, and has no enemy upgrades',()=>{
 for(const m of enemyModels()) {
  expect(m.version).toBe(3);expect(m.role).toBe('enemy');expect(m.colorMode).toBe('authored');
  expect(m.size[0]).toBe(24);expect(m.size[2]).toBe(24);
  const eyes=m.id==='walker'?[9,10]:[6,7];
  for(const [index,material]of m.materials.entries()){expect(material.emission).toBe(eyes.includes(index)?1:0);expect(material.castsLight===true).toBe(eyes.includes(index));expect(material.reflectiveness).toBe(0);}
  for(const variant of ['upgrade1','upgrade2'])expect(m.variants[variant].parts.every(p=>p.voxels.length===0)).toBe(true);
  const cells=m.variants.base.parts.flatMap(p=>p.voxels);
  expect(new Set(cells.map(c=>c.slice(0,3).join(','))).size).toBe(cells.length);
  for(const c of cells)for(let i=0;i<3;i++){expect(Number.isInteger(c[i])).toBe(true);expect(c[i]).toBeGreaterThanOrEqual(0);expect(c[i]).toBeLessThan(m.size[i]);}
  let radius=0;for(const c of cells)for(const dx of [0,1])for(const dz of [0,1])radius=Math.max(radius,Math.hypot(c[0]+dx-12,c[2]+dz-12));
  expect(radius).toBeLessThan(11.5);
 }
});

test('rigs have independent grounded feet and documented parent chains/pivots',()=>{
 for(const m of enemyModels()) {
  const parts=new Map(m.variants.base.parts.map(p=>[p.id,p])),contract=ENEMY_RIG_CONTRACTS[m.id];
  expect(parts.size).toBe(m.id==='walker'?7:13);expect(parts.get('body').parent).toBeNull();
  if(m.id==='spider')expect(contract.legs.map(leg=>leg.ids[0])).toEqual(['upper-fl','upper-fr','upper-rl','upper-rr']);
  expect(contract.root).toEqual([12,0,12]);expect(contract.forward).toEqual([0,0,-1]);
  for(const leg of contract.legs){
   for(let i=0;i<3;i++){
    const p=parts.get(leg.ids[i]);expect(p.parent).toBe(i===0?'body':leg.ids[i-1]);expect(p.pivot).toEqual([leg.hip,leg.knee,leg.ankle][i]);
   }
   const foot=parts.get(leg.ids[2]);expect(Math.min(...foot.voxels.map(c=>c[1]))).toBe(0);
   expect(Math.max(...foot.voxels.map(c=>c[1]+1))).toBe(2);
  }
 }
});

test('accepted rigid parts have no shared coplanar faces and each solid part is connected',()=>{
 for(const m of enemyModels()){
  const occupied=new Map(m.variants.base.parts.flatMap(p=>p.voxels.map(c=>[c.slice(0,3).join(','),p.id])));
  for(const p of m.variants.base.parts){
   for(const c of p.voxels)for(const d of [[1,0,0],[0,1,0],[0,0,1]]){
    const neighbour=occupied.get([c[0]+d[0],c[1]+d[1],c[2]+d[2]].join(','));
    expect(neighbour===undefined||neighbour===p.id).toBe(true);
   }
   const remaining=new Map(p.voxels.map(c=>[c.slice(0,3).join(','),c])),queue=[p.voxels[0]];
   remaining.delete(queue[0].slice(0,3).join(','));
   for(let i=0;i<queue.length;i++)for(const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
    const c=queue[i],key=[c[0]+d[0],c[1]+d[1],c[2]+d[2]].join(','),next=remaining.get(key);
    if(next){remaining.delete(key);queue.push(next);}
   }
   expect(remaining.size).toBe(0);
  }
 }
});

test('accepted source meshes compile to finite exposed quads with preserved face materials',()=>{
 for(const m of enemyModels()){
  let count=0;for(const p of m.variants.base.parts){
   const mesh=meshPart(m,p);count+=mesh.quads.length;
   expect(Array.from(mesh.vertices).every(Number.isFinite)).toBe(true);
   expect(mesh.indices.length).toBe(mesh.quads.length*6);
   expect(mesh.quads.every(q=>q.material>=0&&q.material<m.materials.length)).toBe(true);
  }
  expect(count).toBe(m.id==='walker'?371:338);
 }
});

// Independent oriented-cell SAT against fixed source cells. These few isolated
// inspection poses are not an animation controller or a full gait certificate.
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

test('small isolated hip and knee pitch inspections preserve rigid-part clearance',()=>{
 for(const m of enemyModels()){
  const parts=m.variants.base.parts,contract=ENEMY_RIG_CONTRACTS[m.id];
  for(const leg of contract.legs)for(const joint of [0,1])for(const direction of [-1,1]){
   const data={parts,root:identity(),instances:parts.map((p,index)=>({part:p.id,key:p.id,index,matrix:identity()}))},rig=new PoseRig(data,()=>{});
   rig.setRotation(leg.ids[joint],direction*contract.inspectionAngleDegrees*Math.PI/180,0,0);rig.update();
   const moved=new Set(leg.ids.slice(joint)),fixed=new Map(parts.filter(p=>!moved.has(p.id)).flatMap(p=>p.voxels.map(c=>[c.slice(0,3).join(','),c])));
   let collision=null;
   outer:for(const id of moved){const bone=rig.byId.get(id),matrix=bone.pose;
    for(const c of bone.part.voxels){
     const centre=[0,1,2].map(i=>matrix[i]*(c[0]+.5)+matrix[4+i]*(c[1]+.5)+matrix[8+i]*(c[2]+.5)+matrix[12+i]);
     for(let x=Math.floor(centre[0]-1);x<=Math.floor(centre[0]+1);x++)for(let y=Math.floor(centre[1]-1);y<=Math.floor(centre[1]+1);y++)for(let z=Math.floor(centre[2]-1);z<=Math.floor(centre[2]+1);z++){
      const other=fixed.get(`${x},${y},${z}`);if(other&&overlaps(matrix,c,other)){collision={model:m.id,id,joint,direction,cell:c,other};break outer;}
     }
    }
   }
   expect(collision).toBeNull();
  }
 }
});
