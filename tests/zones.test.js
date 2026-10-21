// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {zoneSceneryModels,zonePreviewLevel} from '../scripts/zone-previews.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {modelForZone,ZONE_PREVIEWS} from '../shared/zone-style.js';
import {TerrainField,placementY} from '../shared/terrain.js';
import {TurretPreview} from '../game/turret-preview.js';
import {carveLevel} from '../scripts/rebuild-level-layouts.js';
const turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json();
const allModels=zoneSceneryModels();
test('legacy zone factories retain distinct scenery, clean routes, path-height defences and functioning turret rigs',async()=>{
 for(const profile of ZONE_PREVIEWS.slice(1)){
  const level=zonePreviewLevel(profile.zone),ids=new Set(level.placements.map(p=>p.model)),models=new Map(allModels.filter(m=>ids.has(m.id)).map(m=>[m.id,m]));models.set(turret.id,turret);
  const world=buildWorld(level,models),terrain=new TerrainField(level),preview=new TurretPreview(world,()=>{},()=>.5);expect(preview.states.length).toBe(3);
  expect(level.size).toEqual([16,16]);expect(level.path.length).toBeGreaterThan(21);for(const [x,,z]of level.path)expect(terrain.flatBox(x,z)).toBe(24);
  for(const p of level.placements.filter(p=>p.model===turret.id))expect(placementY(level,p,terrain)).toBe(24);
  preview.advance(2);preview.advance(.8);expect(preview.states.some(s=>s.cycle.shots>0)).toBe(true);
  expect(world.uniqueQuads).toBeLessThan(world.quads);expect(world.assetIds.sort()).toEqual([...ids].sort());preview.dispose();disposeWorld(world);
 }
 for(const model of allModels){expect(await Bun.file(new URL(`../assets/models/${model.id}.json`,import.meta.url)).json()).toEqual(model);expect(model.materials.every(m=>m.reflectiveness===0&&m.emission===0)).toBe(true);}
});
test('saved first levels reproduce the current landscape-first carve instead of the historical study factories',async()=>{
 for(const id of ['moss-01','ochre-01','ice-01','plum-01'])expect(await Bun.file(new URL(`../docs/landscape-reset-2026-10-18/previous-levels/${id}.json`,import.meta.url)).json()).toEqual((await carveLevel(id)).level);
},20000);
test('zone palettes preserve turret geometry and material properties, allowing shared porcelain shades',()=>{
 const before=JSON.stringify(turret);expect(modelForZone(turret,'A')).toBe(turret);
 for(const zone of ['B','C','D']){const result=modelForZone(turret,zone);expect(result.variants).toBe(turret.variants);expect(result.materials.length).toBe(17);
  expect(result.materials.some((m,i)=>m.color!==turret.materials[i].color)).toBe(true);
  for(let i=0;i<17;i++){
   const {color,...properties}=result.materials[i],{color:sourceColor,...sourceProperties}=turret.materials[i];
   expect(color).toMatch(/^#[0-9a-f]{6}$/i);expect(properties).toEqual(sourceProperties);
   const accent=[4,14,15].includes(i);expect(result.materials[i].emission).toBe(accent?1:0);
   expect(result.materials[i].castsLight===true).toBe(accent);expect(result.materials[i].reflectiveness).toBe(0);
  }
  if(zone==='B')for(const i of [0,5,6,7])expect(result.materials[i].color).toBe(turret.materials[i].color);
 }
 expect(JSON.stringify(turret)).toBe(before);expect(modelForZone(allModels[0],'D')).toBe(allModels[0]);
});
