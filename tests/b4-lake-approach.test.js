import {test,expect} from 'bun:test';
import {carveOchre,B_CARVES} from '../scripts/b-path-carving.js';
import {PLAY_CONFIG} from '../play/config.js';
import {levelRoutes} from '../shared/routes.js';
import {TerrainField} from '../shared/terrain.js';
import {createPlacementRules} from '../play/placement.js';
import {auditModels} from '../scripts/level-layout-audit.js';

const level=await Bun.file(new URL('../assets/levels/ochre-04.json',import.meta.url)).json();
const prior=await Bun.file(new URL('../docs/zone-b-path-carving-2026-10-19/aqueduct-shore-tour.level.json',import.meta.url)).json();
test('B4 lake approach crosses a real wooden bridge, joins one tail, and regenerates exactly',async()=>{
 expect((await carveOchre('ochre-04')).level).toEqual(level);
 expect(level.path).toEqual(prior.path);expect(levelRoutes(level).map(r=>r.id)).toEqual(['main','lake']);
 const field=new TerrainField(level);
 for(const route of levelRoutes(level))for(const [x,,z]of route.path)expect(field.supportBox(x,z)).toBe(24);
 expect(level.bridges[0].boxes).toHaveLength(6);
 for(const key of ['environment','waterMaterial','previewWildlife'])expect(level[key]).toEqual(prior[key]);
 expect(level.terrain.boxes.filter(b=>b.water)).toEqual(prior.terrain.boxes.filter(b=>b.water));
 const edits=level.terrain.boxes.filter(b=>JSON.stringify(b)!==JSON.stringify(prior.terrain.boxes.find(p=>p.box.join(',')===b.box.join(','))));
 expect(edits.map(e=>e.box)).toEqual([[10,3],[17,9],[14,11]]);expect(edits.every(e=>e.water===0&&e.ground===24)).toBe(true);
});
test('every B4 wave uses both approaches without changing its existing roster totals',()=>{
 const waves=PLAY_CONFIG.levels.find(l=>l.id===level.id).waves;
 expect(waves.map(w=>w.spawns.length)).toEqual([16,18,20,20]);
 for(const wave of waves){expect(new Set(wave.spawns.map(s=>s.routeId))).toEqual(new Set(['main','lake']));for(const id of ['main','lake'])expect(wave.spawns.filter(s=>s.routeId===id).some(s=>s.model==='twin-fan')).toBe(true);}
});
test('B4 gains useful bank ground and keeps bridge decks unavailable for defence deployment',async()=>{
 const models=await auditModels(level);for(const id of ['arc-spire','missile-launcher','guided-missile'])models.set(id,await Bun.file(new URL('../assets/models/'+id+'.json',import.meta.url)).json());
 const rules=createPlacementRules(level,models,{config:PLAY_CONFIG}),old=createPlacementRules(prior,models,{config:PLAY_CONFIG});
 try{for(const model of ['turret-study','arc-spire','missile-launcher'])for(const variant of ['base','upgrade1','upgrade2']){
  expect(rules.eligibleCells(variant,[],null,model).filter(c=>c.valid).length).toBeGreaterThan(old.eligibleCells(variant,[],null,model).filter(c=>c.valid).length);
  for(const [x,z]of level.bridges[0].boxes)expect(rules.check([x,0,z],variant,[],null,model).code).toBe('bridge');
 }
 expect(B_CARVES['ochre-04'].sites.length).toBeGreaterThan(32);
 }finally{rules.dispose();old.dispose();}
});
