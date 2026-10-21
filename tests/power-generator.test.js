import {test,expect} from 'bun:test';
import {powerGeneratorModel} from '../scripts/power-generator.js';
import {validateModel,VARIANTS,materialForFace} from '../shared/model.js';
import {compileModel,meshPart} from '../shared/mesher.js';
import {modelForZone} from '../shared/zone-style.js';
import {identity} from '../shared/math.js';
import {ModelLights} from '../engine/model-lights.js';

const model=powerGeneratorModel(),key=(x,y,z)=>`${x},${y},${z}`,heights=[14,18,22],shoulders=[8,11,13],accent=i=>[4,14,15].includes(i);

test('generator reproduces canonical connected fixed models within the shared footprint',async()=>{
 validateModel(model);expect(model).toEqual(await Bun.file(new URL('../assets/models/power-generator.json',import.meta.url)).json());
 expect(model.role).toBe('defence');expect(model.colorMode).toBeUndefined();expect(model.size).toEqual([24,22,24]);
 let pad=null,lastCount=0;
 for(const [stage,variant]of VARIANTS.entries()){
  const parts=model.variants[variant].parts;expect(parts).toHaveLength(1);
  const part=parts[0],cells=new Set(part.voxels.map(c=>key(...c))),seen=new Set(),pending=[part.voxels[0].slice(0,3)];
  expect(part.id).toBe('body');expect(part.parent).toBeNull();expect(part.pivot).toEqual([12,0,12]);expect(cells.size).toBe(part.voxels.length);
  expect(part.voxels.every(c=>c.slice(0,3).every((n,i)=>Number.isInteger(n)&&n>=0&&n<model.size[i]))).toBe(true);
  expect([0,1,2].map(i=>Math.min(...part.voxels.map(c=>c[i])))).toEqual([1,0,1]);
  expect([0,1,2].map(i=>Math.max(...part.voxels.map(c=>c[i]+1)))).toEqual([23,heights[stage],23]);
  while(pending.length){const p=pending.pop(),k=key(...p);if(seen.has(k)||!cells.has(k))continue;seen.add(k);for(let axis=0;axis<3;axis++)for(const step of [-1,1]){const n=p.slice();n[axis]+=step;pending.push(n);}}
  expect(seen.size).toBe(cells.size);expect(cells.size).toBeGreaterThan(lastCount);lastCount=cells.size;
  const current=part.voxels.filter(c=>c[1]<2).map(c=>c.slice(0,4));if(pad)expect(current).toEqual(pad);else pad=current;
 }
 const changed=powerGeneratorModel();changed.variants.base.parts[0].voxels[0][3]=99;expect(powerGeneratorModel()).toEqual(model);
});

test('sealed stepped caps, real cooling recesses and four exposed front bars preserve the concept silhouette',()=>{
 for(const [stage,variant]of VARIANTS.entries()){
  const part=model.variants[variant].parts[0],cells=new Map(part.voxels.map(c=>[key(...c),c])),shoulder=shoulders[stage];
  // Solid central stack and uninterrupted porcelain shoulder; no launch wells.
  for(let y=0;y<heights[stage];y++)expect(cells.has(key(12,y,12))).toBe(true);
  for(let x=6;x<18;x++)for(let z=6;z<18;z++)expect(cells.has(key(x,shoulder+2,z))).toBe(true);
  // Both negative-Z front grilles and X-side radiators contain genuine gaps.
  for(let y=3;y<shoulder-1;y++){
   expect(cells.has(key(5,y,3))).toBe(y%2===1);expect(cells.has(key(18,y,3))).toBe(y%2===1);
   expect(cells.has(key(2,y,12))).toBe(y%2===1);expect(cells.has(key(21,y,12))).toBe(y%2===1);
   expect(cells.has(key(4,y,12))).toBe(true);expect(cells.has(key(19,y,12))).toBe(true);
  }
  const bars=new Set();let area=0;
  for(const c of part.voxels)for(let face=0;face<6;face++)if(accent(materialForFace(c,face))){
   expect(face).toBe(5);expect(c[2]).toBe(3);expect(cells.has(key(c[0],c[1],c[2]-1))).toBe(false);bars.add(c[0]);area++;
  }
  expect([...bars].sort((a,b)=>a-b)).toEqual([8,10,13,15]);expect(area).toBe(4*(shoulder-4));
 }
});

test('compiled geometry exactly covers exposed cells without duplicate faces and keeps only meter faces emissive',()=>{
 const compiled=compileModel(model);expect(compiled.role).toBe('defence');expect(model.materials).toHaveLength(17);
 for(const [i,m]of model.materials.entries()){expect(m.emission).toBe(accent(i)?1:0);expect(m.castsLight===true).toBe(accent(i));expect(m.reflectiveness).toBe(0);}
 for(const variant of VARIANTS){
  const part=model.variants[variant].parts[0],cells=new Map(part.voxels.map(c=>[key(...c),c])),mesh=meshPart(model,part),surface=new Map(),covered=new Map();
  // Independent unit-face oracle checks hidden removal and greedy coverage.
  for(const c of part.voxels)for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
   const neighbour=c.slice(0,3);neighbour[axis]+=sign;if(cells.has(key(...neighbour)))continue;
   const origin=c.slice(0,3);if(sign>0)origin[axis]++;
   surface.set(`${axis},${sign},${key(...origin)}`,materialForFace(c,axis*2+(sign>0?0:1)));
  }
  for(const q of mesh.quads){
   expect(q.width>0&&q.height>0).toBe(true);
   for(let u=0;u<q.width;u++)for(let v=0;v<q.height;v++){
    const p=q.origin.slice();p[(q.axis+1)%3]+=u;p[(q.axis+2)%3]+=v;const k=`${q.axis},${q.sign},${key(...p)}`;
    expect(covered.has(k)).toBe(false);covered.set(k,q.material);
   }
  }
  expect(covered).toEqual(surface);expect(mesh.quads.length).toBeLessThan(mesh.exposedFaces);
  expect(mesh.lightQuads).toHaveLength(4);expect(mesh.lightQuads.every(i=>mesh.quads[i].axis===2&&mesh.quads[i].sign===-1&&mesh.quads[i].material===4)).toBe(true);
  const saved=compiled.variants[variant].parts[0];expect(saved.lightQuads).toEqual(mesh.lightQuads);expect(saved.vertices.every(Number.isFinite)).toBe(true);expect(saved.indices.length).toBe(saved.quads*6);
  for(let i=0;i<saved.vertices.length;i+=11){expect(saved.vertices[i+9]).toBe(accent(saved.quadMaterials[Math.floor(i/44)])?1:0);expect(saved.vertices[i+10]).toBe(0);}
 }
});

test('all zones preserve green identity and four lights per model with no combined review overflow',async()=>{
 const turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json(),before=JSON.stringify(model);
 for(const zone of ['A','B','C','D']){
  const styled=modelForZone(model,zone),reference=modelForZone(turret,zone);expect(styled.variants).toBe(model.variants);
  for(const [i,m]of styled.materials.entries()){
   expect(m.color).toBe(accent(i)?model.materials[i].color:reference.materials[i].color);expect(m.emission).toBe(accent(i)?1:0);expect(m.castsLight===true).toBe(accent(i));expect(m.reflectiveness).toBe(0);
  }
  const entries=VARIANTS.map(variant=>({key:variant,mesh:meshPart(styled,styled.variants[variant].parts[0]),transforms:[identity()]}));
  const draws=new Map(entries.map(entry=>[entry.key,{transforms:identity()}]));
  for(const entry of entries){const lights=new ModelLights([entry],draws);lights.prepare();expect(lights.count).toBe(4);expect(lights.authoredCount).toBe(4);expect(lights.overflow).toBe(0);lights.dispose();}
  const lights=new ModelLights(entries,draws);expect(lights.prepare()).toBe(true);expect(lights.authoredCount).toBe(12);expect(lights.count).toBe(12);expect(lights.overflow).toBe(0);expect(lights.prepare()).toBe(false);lights.dispose();
 }
 expect(JSON.stringify(model)).toBe(before);
});
