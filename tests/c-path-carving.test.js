import {describe,test,expect} from 'bun:test';
import {C_CARVES,carveIce,checkCPathEdges} from '../scripts/c-path-carving.js';
import {C_OPTIONS,readCBaseline} from '../scripts/c-path-carving-options.js';
import {extraPavedJoins} from '../scripts/c-path-carving-comparison.js';
import {validateLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
import {levelRoutes,pathBoxUnion} from '../shared/routes.js';
const root=new URL('../',import.meta.url),same=(a,b)=>expect(a).toEqual(b);
for(const [id,decision]of Object.entries(C_CARVES))describe(id,()=>{
 test('reproduces its selected active source without altering the landscape',async()=>{
  const baseline=await readCBaseline(id),first=await carveIce(id),again=await carveIce(id),text=await Bun.file(new URL('assets/levels/'+id+'.json',root)).text();
  expect(JSON.stringify(first.level,null,2)+'\n').toBe(text);same(again.level,first.level);validateLevel(first.level);
  for(const key of ['id','name','zone','size','waves','pathHeight','terrain','environment','waterMaterial'])same(first.level[key],baseline[key]);
  same(first.level.previewWildlife.perches,baseline.previewWildlife.perches);expect(first.level.previewWildlife.habitatPoints).toHaveLength(3);
  const originals=new Map(baseline.placements.map(p=>[p.id,p]));for(const placement of first.level.placements)same(placement,originals.get(placement.id));
  expect(first.manifest.removed.length+first.level.placements.length).toBe(baseline.placements.length);expect(first.level.previewMode).toBe('layout');expect(first.level.previewActors).toBeUndefined();
 });
 test('supports complete interior routes and full dry surveyed alternative ground',async()=>{
  const {level}=await carveIce(id),field=new TerrainField(level);expect(checkCPathEdges(level)).toHaveLength(levelRoutes(level).length);expect(extraPavedJoins(level)).toEqual([]);
  for(const [x,,z]of pathBoxUnion(level))expect(field.supportBox(x,z)).toBe(24);
  expect(new Set(decision.sites.map(s=>s.box.join())).size).toBe(decision.sites.length);
  for(const site of decision.sites){expect(field.flatBox(...site.box)).toBe(24);expect(field.protected(...site.box)).toBe(false);}
  const compared=Object.values(C_OPTIONS).filter(o=>o.level===id);expect(compared.length).toBeGreaterThanOrEqual(2);expect(new Set(compared.map(o=>JSON.stringify(o.corners))).size).toBe(compared.length);
 });
 test('keeps exact one-unit bridges above unchanged water and dry banks',async()=>{
  const {level}=await carveIce(id),field=new TerrainField(level),baseline=await readCBaseline(id),original=new TerrainField(baseline);
  for(const bridge of level.bridges??[])for(const [x,z]of bridge.boxes){same(field.box(x,z),original.box(x,z));expect(field.flatBox(x,z)).toBe(null);expect(field.supportBox(x,z)).toBe(24);expect(field.box(x,z).water).toBeLessThan(23);}
 });
});
