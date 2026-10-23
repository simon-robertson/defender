import {test,expect} from 'bun:test';
import {newLevel,validateLevel} from '../shared/level.js';
import {previewActorsForLevel} from '../shared/enemy-roster.js';
import {actorsForPreview} from '../game/preview-actors.js';
import {a1CombatPreview} from '../scripts/a1-combat-preview.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {auditWildlifeRoaming} from '../scripts/wildlife-roaming-audit.js';

function fixture(){
 const level=newLevel('combat-source-test');level.previewMode='combat';level.path=[[0,0,2],[1,0,2],[2,0,2]];
 level.previewActors=[{id:'test-dog',modelId:'dog',variant:'base',startDistance:12,routeId:'main'}];return level;
}
test('explicit combat roster validates identity, supported model, complete route and start bounds',()=>{
 const level=fixture();expect(validateLevel(level)).toBe(level);
 for(const change of [
  l=>delete l.previewActors,l=>l.previewActors=null,l=>l.previewActors.push({...l.previewActors[0]}),
  l=>l.previewActors[0].modelId='concertina',l=>l.previewActors[0].variant='upgrade1',
  l=>l.previewActors[0].routeId='missing',l=>delete l.previewActors[0].routeId,
  l=>l.previewActors[0].startDistance=-1,l=>l.previewActors[0].startDistance=48,
  l=>l.previewActors[0].startDistance=NaN,l=>l.previewMode='layout',l=>l.previewMode='landscape',
  l=>delete l.previewMode,l=>l.placements.push({id:'test-dog',model:'turret-study',variant:'base',box:[0,0,0],turn:0}),
 ]){const bad=structuredClone(level);change(bad);expect(()=>validateLevel(bad)).toThrow();}
 level.previewActors[0].startDistance=47.99;expect(validateLevel(level)).toBe(level);
 level.previewActors=[];expect(validateLevel(level)).toBe(level);expect(previewActorsForLevel(level)).toEqual([]);
});

test('explicit roster owns runtime actors without mutating source or reviving the historical mixed roster',()=>{
 const level=fixture();level.id='moss-01';const actors=previewActorsForLevel(level);
 expect(actors).toEqual([{id:'test-dog',model:'dog',variant:'base',distance:12,routeId:'main'}]);
 level.previewActors[0].startDistance=24;expect(actors[0].distance).toBe(12);expect(Object.isFrozen(actors[0])).toBe(true);
 expect(previewActorsForLevel('moss-01')).toHaveLength(7);
 expect(previewActorsForLevel({...level,previewMode:'layout'})).toEqual([]);
 expect(previewActorsForLevel({...level,previewActors:[]})).toEqual([]);
});

test('A1 combat preserves approved geometry, corrects the trapped hare seed and loads only its bounded roster',async()=>{
 const level=await a1CombatPreview(),approved=await Bun.file(new URL('../project-docs/a1-drone-test-2026-10-18/baseline.level.json',import.meta.url)).json();
 const restored=structuredClone(level);restored.previewMode='layout';delete restored.previewActors;
 expect(restored.previewWildlife.perches).toEqual(approved.previewWildlife.perches);
 expect(restored.previewWildlife.habitatPoints[0]).toEqual(approved.previewWildlife.habitatPoints[0]);
 expect(restored.previewWildlife.habitatPoints[2]).toEqual(approved.previewWildlife.habitatPoints[2]);
 restored.previewWildlife=approved.previewWildlife;
 expect(restored).toEqual(approved);
 expect(level.placements.every(p=>p.model!=='drone-defence')).toBe(true);
 const actors=actorsForPreview(level);expect(actors).toHaveLength(9);expect(actors.filter(a=>a.model==='dog')).toHaveLength(2);expect(actors.filter(a=>a.model==='moth')).toHaveLength(1);
 const models=new Map();for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)]))models.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 expect(auditWildlifeRoaming(level,models).passed).toBe(true);
 const trapped=structuredClone(level);trapped.previewWildlife=approved.previewWildlife;
 const before=auditWildlifeRoaming(trapped,models);expect(before.passed).toBe(false);expect(before.rows[1].reachableNodes).toBe(8);
 expect(validateLevel(level,models)).toBe(level);const world=buildWorld(level,models,{actors});
 try{expect(world.actors.size).toBe(9);expect(world.rigs.has('drone-1')).toBe(false);expect(world.rigs.has('drone-2')).toBe(false);expect(world.assetIds).not.toContain('guided-missile');}
 finally{disposeWorld(world);}expect(world.actors.size).toBe(0);expect(world.rigs.size).toBe(0);
});
