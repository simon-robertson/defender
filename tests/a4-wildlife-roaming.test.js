import {test,expect} from 'bun:test';
import {carveMoss04} from '../scripts/a4-path-carving.js';
import {auditWildlifeRoaming} from '../scripts/wildlife-roaming-audit.js';
import {wildlifeActorsForLevel} from '../game/wildlife-preview.js';

test('A4 critters roam beyond their seed pockets without changing the approved landscape',async()=>{
 const {level}=await carveMoss04(),approved=await Bun.file(new URL('../docs/a4-path-carving-2026-10-18/ruin-and-mere-tour.level.json',import.meta.url)).json();
 const originalSeeds=approved.previewWildlife;approved.previewWildlife=level.previewWildlife;expect(level).toEqual(approved);
 expect(level.previewWildlife.perches).toEqual(originalSeeds.perches);expect(level.previewWildlife.habitatPoints[0]).toEqual(originalSeeds.habitatPoints[0]);
 const models=new Map();for(const id of new Set([...level.placements.map(p=>p.model),...wildlifeActorsForLevel(level).map(a=>a.model)]))models.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 const report=auditWildlifeRoaming(level,models);expect(report.passed).toBe(true);expect(new Set(report.rows.map(r=>r.component)).size).toBe(1);
 for(const row of report.rows){expect(row.completed).toBeGreaterThan(0);expect(row.maxDisplacement).toBeGreaterThanOrEqual(24);}
 const trapped=structuredClone(level);trapped.previewWildlife=originalSeeds;const before=auditWildlifeRoaming(trapped,models);
 expect(before.passed).toBe(false);expect(before.rows[2].reachableNodes).toBe(1);expect(before.rows[2].completed).toBe(0);
});
