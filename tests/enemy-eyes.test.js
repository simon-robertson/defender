import {test,expect} from 'bun:test';
import {dogModel} from '../scripts/dog.js';
import {walkerModel,spiderModel} from '../scripts/enemy-models.js';
import {meshPart} from '../shared/mesher.js';
import {identity} from '../shared/math.js';
import {ModelLights} from '../engine/model-lights.js';

const cases=[
 {generate:dogModel,slots:[6,7],clusters:4,faces:[
  [11,10,3,5],[12,10,3,5],[11,11,3,5],[12,11,3,5],
  [8,10,5,1],[8,11,5,1],[15,10,5,0],[15,11,5,0],
 ]},
 {generate:walkerModel,slots:[9,10],clusters:2,faces:[
  [11,19,4,5],[12,19,4,5],[11,20,4,5],[12,20,4,5],
 ]},
 {generate:spiderModel,slots:[6,7],clusters:1,faces:[
  [11,8,5,5],[12,8,5,5],
 ]},
];

for(const {generate,slots,clusters,faces} of cases){
 const source=generate();
 test(`${source.id} eye faces alone glow and retain exposed local-light metadata`,async()=>{
  expect(source).toEqual(await Bun.file(`assets/models/${source.id}.json`).json());
  for(const [index,material]of source.materials.entries()){
   expect(material.emission).toBe(slots.includes(index)?1:0);
   expect(material.castsLight===true).toBe(slots.includes(index));
   expect(material.reflectiveness).toBe(0);
  }
  const actual=[];
  for(const part of source.variants.base.parts)for(const cell of part.voxels)for(let face=0;face<6;face++){
   const override=cell[4]?.[face],index=override>=0?override:cell[3];
   if(!slots.includes(index))continue;
   expect(part.id).toBe('body');actual.push([...cell.slice(0,3),face].join(','));
  }
  expect(actual.sort()).toEqual(faces.map(face=>face.join(',')).sort());
  const entries=source.variants.base.parts.map(part=>({key:part.id,mesh:meshPart(source,part),transforms:[identity()]}));
  let illuminatedArea=0;
  for(const entry of entries){
   const mesh=entry.mesh;
   for(let qi=0;qi<mesh.quads.length;qi++){
    const quad=mesh.quads[qi],eye=slots.includes(quad.material);
    expect(mesh.lightQuads?.includes(qi)??false).toBe(eye);
    if(eye)illuminatedArea+=quad.width*quad.height;
    for(let vertex=0;vertex<4;vertex++){
     const offset=qi*44+vertex*11;
     expect(mesh.vertices[offset+9]).toBe(eye?1:0);expect(mesh.vertices[offset+10]).toBe(0);
    }
   }
  }
  expect(illuminatedArea).toBe(faces.length);
  const draws=new Map(entries.map(entry=>[entry.key,{transforms:identity()}])),lights=new ModelLights(entries,draws);
  expect(lights.prepare()).toBe(true);expect(lights.count).toBe(clusters);expect(lights.overflow).toBe(0);
  lights.dispose();
 });
}
