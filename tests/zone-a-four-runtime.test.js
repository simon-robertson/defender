// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {DefencePreview} from '../game/defence-preview.js';
import {missileActorsForLevel} from '../game/missile-preview.js';
import {ModelLights} from '../engine/model-lights.js';
import {MAX_MODEL_LIGHTS} from '../shared/model-lights.js';
import {TerrainField} from '../shared/terrain.js';

test('A4 loads its mixed actors, supported wildlife and existing bounded light/missile pools',async()=>{
 const level=await Bun.file(new URL('../docs/landscape-reset-2026-10-18/previous-levels/moss-04.json',import.meta.url)).json();
 const animals=wildlifeActorsForLevel(level),actors=[...previewActorsForLevel(level.id),...animals,...missileActorsForLevel(level.id)];
 const ids=[...new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)])];
 const models=new Map(await Promise.all(ids.map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
 const world=buildWorld(level,models,{actors}),source=JSON.stringify(level),terrain=new TerrainField(level);
 let enemies,wildlife,defences,lights;
 try{
  enemies=new EnemyPreview(world,()=>{});wildlife=new WildlifePreview(world,()=>{});wildlife.setThreatSources(enemies.states);
  defences=new DefencePreview(world,()=>{},()=>.5,null,enemies.states,(enemy,strength,x,y,z)=>enemies.takeHit(enemy,strength,x,y,z),null,()=>{});
  expect(enemies.states).toHaveLength(7);expect(animals).toHaveLength(6);expect(world.actors.size).toBe(49);
  expect(defences.missiles.pool.slots).toHaveLength(36);expect(defences.missiles.states).toHaveLength(1);expect(defences.missiles.states[0].ammo).toBe(2);
  expect(wildlife.states.filter(s=>s.kind==='bird'&&!s.flight)).toHaveLength(3);
  expect(wildlife.treePerches.length).toBeGreaterThanOrEqual(3);
  expect(animals.filter(a=>a.kind==='bird').every(a=>world.rigs.has(a.perch))).toBe(true);
  const draws=new Map(world.entries.map(entry=>[entry.key,{transforms:Float32Array.from(entry.transforms.flatMap(matrix=>Array.from(matrix)))}]));
  lights=new ModelLights(world.entries,draws);lights.prepare();
  expect(lights.overflow).toBe(0);expect(lights.authoredCount).toBeLessThanOrEqual(MAX_MODEL_LIGHTS);
  let journeys=0;
  for(let frame=0;frame<900;frame++){
   enemies.advance(1/30);wildlife.advance(1/30);
   expect(wildlife.lastThinkWork).toBeLessThanOrEqual(512);
   for(const state of wildlife.states){
    expect([state.x,state.y,state.z].every(Number.isFinite)).toBe(true);
    if(state.kind==='ground')expect(terrain.flatBox(Math.floor(state.x/24),Math.floor(state.z/24))).not.toBeNull();
    journeys+=state.journeys;
   }
  }
  expect(journeys).toBeGreaterThan(0);expect(JSON.stringify(level)).toBe(source);
 }finally{lights?.dispose();defences?.dispose();wildlife?.dispose();enemies?.dispose();disposeWorld(world);}
 expect(world.actors.size).toBe(0);expect(world.rigs.size).toBe(0);expect(world.entries).toHaveLength(0);
});
