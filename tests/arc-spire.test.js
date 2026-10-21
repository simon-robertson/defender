import {test,expect} from 'bun:test';
import {arcSpireModel} from '../scripts/arc-spire.js';
import {validateModel,VARIANTS} from '../shared/model.js';
import {compileModel,meshPart} from '../shared/mesher.js';
import {modelForZone} from '../shared/zone-style.js';
import {identity} from '../shared/math.js';
import {ModelLights} from '../engine/model-lights.js';

const model=arcSpireModel(),key=(x,y,z)=>`${x},${y},${z}`;
const occupied=part=>new Set(part.voxels.map(cell=>key(...cell)));
const heights=[32,42,54],tierCounts=[3,5,7],crownFloors=[27,37,47];

test('Arc Spire variants are connected fixed solids within a common 24-unit footprint',()=>{
 validateModel(model);expect(model.role).toBe('defence');expect(model.size).toEqual([24,54,24]);
 let commonPad;
 for(const [stage,variant]of VARIANTS.entries()){
  const parts=model.variants[variant].parts;expect(parts).toHaveLength(1);
  const part=parts[0],cells=occupied(part),seen=new Set(),pending=[part.voxels[0].slice(0,3)];
  expect(part.id).toBe('body');expect(part.parent).toBeNull();expect(part.pivot).toEqual([12,0,12]);
  expect(part.voxels.every(c=>c[0]>=0&&c[0]<24&&c[2]>=0&&c[2]<24)).toBe(true);
  expect(Math.max(...part.voxels.map(c=>c[1]+1))).toBe(heights[stage]);
  while(pending.length){
   const p=pending.pop(),k=key(...p);if(seen.has(k)||!cells.has(k))continue;seen.add(k);
   for(let axis=0;axis<3;axis++)for(const step of [-1,1]){const n=p.slice();n[axis]+=step;pending.push(n);}
  }
  expect(seen.size).toBe(cells.size);
  // Upper housings change which pad faces are exposed, not its cell geometry.
  const pad=part.voxels.filter(c=>c[1]<3).map(c=>c.slice(0,4));
  if(commonPad)expect(pad).toEqual(commonPad);else commonPad=pad;
 }
});

test('three, five and seven separate porcelain tiers support open square crowns with four terminals',()=>{
 for(const [stage,variant]of VARIANTS.entries()){
  const part=model.variants[variant].parts[0],cells=occupied(part),runs=[];
  // Read the front middle edge, clear of the corner braces, side housings and
  // core. The first tier can contact its supporting pedestal below Y10.
  for(let y=10;y<crownFloors[stage]-2;y++)if(cells.has(key(12,y,6))&&(y===10||!cells.has(key(12,y-1,6))))runs.push(y);
  expect(runs).toHaveLength(tierCounts[stage]);
  for(const y of runs){
   expect(cells.has(key(12,y+1,6))).toBe(true);
   expect(cells.has(key(12,y+2,6))).toBe(false);
   expect(cells.has(key(12,y+2,12))).toBe(true); // Dark core supports each interval.
  }
  for(let y=crownFloors[stage];y<heights[stage];y++)for(let z=7;z<17;z++)for(let x=7;x<17;x++)expect(cells.has(key(x,y,z))).toBe(false);
  const top=new Set(part.voxels.filter(c=>c[1]===heights[stage]-1).map(c=>`${c[0]},${c[2]}`));
  let components=0;
  while(top.size){
   components++;const pending=[top.values().next().value];
   while(pending.length){const k=pending.pop();if(!top.delete(k))continue;const [x,z]=k.split(',').map(Number);pending.push(`${x-1},${z}`,`${x+1},${z}`,`${x},${z-1}`,`${x},${z+1}`);}
  }
  expect(components).toBe(4);
 }
});

test('saved Arc Spire source and compacted mesh preserve only exposed red identity light faces',async()=>{
 const saved=await Bun.file(new URL('../assets/models/arc-spire.json',import.meta.url)).json();expect(saved).toEqual(model);
 const compiled=compileModel(model);expect(compiled.role).toBe('defence');
 for(const [stage,variant]of VARIANTS.entries()){
  const mesh=compiled.variants[variant].parts[0];
  expect(mesh.quads).toBeLessThan(mesh.exposedFaces);
  expect(mesh.lightQuads).toHaveLength(stage===2?3:1);
  expect(mesh.lightQuads).toEqual(mesh.quadMaterials.flatMap((material,index)=>material===4?[index]:[]));
  const sourceMesh=meshPart(model,model.variants[variant].parts[0]);
  expect(sourceMesh.lightQuads.reduce((area,i)=>area+sourceMesh.quads[i].width*sourceMesh.quads[i].height,0)).toBe(stage===2?18:8);
 }
 for(const [index,m]of model.materials.entries()){
  const accent=[4,14,15].includes(index);expect(m.emission).toBe(accent?1:0);
  expect(m.castsLight===true).toBe(accent);expect(m.reflectiveness).toBe(0);
 }
 expect(model.materials[4].color).toBe('#D65D45');
});

test('all-zone palettes preserve Arc geometry and accent-only lighting within the three-model review budget',async()=>{
 const turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json(),before=JSON.stringify(model);
 for(const zone of ['A','B','C','D']){
  const styled=modelForZone(model,zone),reference=modelForZone(turret,zone);
  expect(styled.variants).toBe(model.variants);
  expect(styled.materials.map(m=>m.color)).toEqual(reference.materials.map(m=>m.color));
  for(const [index,m]of styled.materials.entries()){
   expect(m.reflectiveness).toBe(0);expect(m.emission).toBe([4,14,15].includes(index)?1:0);
   expect(m.castsLight===true).toBe([4,14,15].includes(index));
  }
  const entries=VARIANTS.map(variant=>({key:variant,mesh:meshPart(styled,styled.variants[variant].parts[0]),transforms:[identity()]}));
  const draws=new Map(entries.map(entry=>[entry.key,{transforms:identity()}]));
  const lights=new ModelLights(entries,draws);
  expect(lights.prepare()).toBe(true);expect(lights.authoredCount).toBe(5);expect(lights.count).toBe(5);expect(lights.overflow).toBe(0);
  expect(lights.prepare()).toBe(false);lights.dispose();
 }
 expect(JSON.stringify(model)).toBe(before);
});
