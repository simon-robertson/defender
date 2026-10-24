import {test,expect} from 'bun:test';
import {meshPart} from '../shared/mesher.js';
const ids=['dog','roller','moth','walker','dune-tread','twin-fan','tripod','ray','spider','lantern'];
test('enemy refinement preserves rig contracts, footprints and accepted geometry except removing fan guard clutter',async()=>{
 for(const id of ids){
  const before=await Bun.file(`project-docs/todo-36-41-2026-10-21/before-models/${id}.json`).json(),after=await Bun.file(`assets/models/${id}.json`).json();
  expect(after.size).toEqual(before.size);expect(after.materials).toEqual(before.materials);
  const parts=after.variants.base.parts,old=before.variants.base.parts;expect(parts.map(p=>[p.id,p.parent,p.pivot])).toEqual(old.map(p=>[p.id,p.parent,p.pivot]));
  for(let i=0;i<parts.length;i++){
   const prior=new Set(old[i].voxels.map(c=>c.slice(0,3).join(','))),current=new Set(parts[i].voxels.map(c=>c.slice(0,3).join(',')));
   if(id==='twin-fan'){for(const cell of current)expect(prior.has(cell)).toBe(true);}else expect(current).toEqual(prior);
  }
  const quads=model=>model.variants.base.parts.reduce((n,p)=>n+meshPart(model,p).quads.length,0);expect(quads(after)).toBeLessThanOrEqual(quads(before));
  if(['moth','dune-tread','ray','lantern'].includes(id))expect(after).toEqual(before);
 }
});
test('front sensor face details are bilaterally balanced',async()=>{
 for(const id of ['dog','roller','walker','tripod','spider']){
  const m=await Bun.file(`assets/models/${id}.json`).json(),cells=m.variants.base.parts.find(p=>p.id==='body').voxels,map=new Map(cells.map(c=>[c.slice(0,3).join(','),c]));let checked=0;
  for(const c of cells){const material=c[4]?.[5]??-1;if(material<0||!m.materials[material].emission)continue;const other=map.get([23-c[0],c[1],c[2]].join(','));expect(other?.[4]?.[5]).toBe(material);checked++;}
  expect(checked).toBeGreaterThan(0);
 }
});
