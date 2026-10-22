// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {arcSpireLevel} from '../scripts/arc-spire-levels.js';
import {productionLevel} from '../scripts/production-level.js';
import {carveLevel} from '../scripts/rebuild-level-layouts.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {ModelLights} from '../engine/model-lights.js';
import {TerrainField,placementY} from '../shared/terrain.js';

const zones=['A','B','C','D'];

test('legacy Arc Spire factories retain paired study routes, sites and environments',()=>{
 for(const zone of zones){
  const level=arcSpireLevel(zone),original=productionLevel(zone);
  const originalSites=original.placements.filter(placement=>placement.model==='turret-study');
  const sites=level.placements.filter(placement=>placement.model==='arc-spire');
  expect(sites.map(placement=>placement.variant)).toEqual(['base','upgrade1','upgrade2']);
  expect(level.placements.some(placement=>placement.model==='turret-study')).toBe(false);
  for(let index=0;index<sites.length;index++){
   const {model,variant,...site}=sites[index],{model:oldModel,variant:oldVariant,...oldSite}=originalSites[index];
   expect(site).toEqual(oldSite);
  }
  const {id,name,placements,...environment}=level,{id:oldId,name:oldName,placements:oldPlacements,...oldEnvironment}=original;
  expect(environment).toEqual(oldEnvironment);
  expect(placements.filter(placement=>placement.model!=='arc-spire')).toEqual(oldPlacements.filter(placement=>placement.model!=='turret-study'));

 }
});
test('saved Arc Spire levels reproduce their current individual landscape-first carves',async()=>{
 for(const id of ['moss-02','ochre-02','ice-02','plum-02'])expect(await Bun.file(new URL(`../docs/landscape-reset-2026-10-18/previous-levels/${id}.json`,import.meta.url)).json()).toEqual((await carveLevel(id)).level);
},20000);

test('all four Arc Spire studies build with clear routes, supported defences and five local lights',async()=>{
 for(const zone of zones){
  const level=arcSpireLevel(zone),ids=[...new Set(level.placements.map(placement=>placement.model))];
  const sources=await Promise.all(ids.map(id=>Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()));
  // buildWorld checks actual world cells against the route as well as shared
  // source validation for solid overlap, terrain/water and defence elevation.
  const world=buildWorld(level,new Map(sources.map(model=>[model.id,model])));
  const field=new TerrainField(level),sites=level.placements.filter(placement=>placement.model==='arc-spire');
  for(const site of sites){
   expect(placementY(level,site,field)).toBe(24);
   expect(field.flatBox(site.box[0],site.box[2])).toBe(24);
   expect(world.rigs.get(site.id).parts).toHaveLength(1);
  }
  expect(world.assetIds.includes('arc-spire')).toBe(true);
  expect(world.assetIds.includes('turret-study')).toBe(false);
  const draws=new Map(world.entries.map(entry=>{
   const transforms=new Float32Array(entry.transforms.length*16);
   entry.transforms.forEach((transform,index)=>transforms.set(transform,index*16));
   return [entry.key,{transforms}];
  }));
  const lights=new ModelLights(world.entries,draws);
  lights.prepare();
  expect(lights.count).toBe(5);expect(lights.overflow).toBe(0);
  lights.dispose();disposeWorld(world);
  expect(world.entries).toHaveLength(0);expect(world.assetIds).toHaveLength(0);
 }
});
