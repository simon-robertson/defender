// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {carveLevel} from '../scripts/rebuild-level-layouts.js';
import {LEVEL_LAYOUTS} from '../scripts/level-rebuild-layouts.js';
import {LANDSCAPE_INFO,landscapeFor} from '../scripts/landscapes/index.js';
import {auditRouteGeometry,auditCombat,sourceHash} from '../scripts/level-layout-audit.js';
import {TerrainField} from '../shared/terrain.js';
import {validateLevel} from '../shared/level.js';
import {levelRoutes,pathBoxUnion} from '../shared/routes.js';
import {MIXED_PREVIEW_ACTORS} from '../shared/enemy-roster.js';

// A zone filter permits each completed batch to be verified once while the
// independent landscape author and runtime integration work continue.
const selected=Object.entries(LEVEL_LAYOUTS).filter(([id,definition])=>(!process.env.LEVEL_REBUILD_ZONE||definition.zone===process.env.LEVEL_REBUILD_ZONE)&&(!process.env.LEVEL_REBUILD_ID||id===process.env.LEVEL_REBUILD_ID));
for(const [id,definition]of selected)test(`${id}: reproducible carve, useful supported sites, actual movement and combat`,async()=>{
 const {level,manifest,models,sites}=await carveLevel(id),source=await Bun.file(new URL(`../docs/landscape-reset-2026-10-18/previous-levels/${id}.json`,import.meta.url)).text(),before=landscapeFor(definition.zone,definition.number),field=new TerrainField(level),routes=levelRoutes(level),path=new Set(pathBoxUnion(level).map(([x,,z])=>`${x},${z}`));
 expect(JSON.parse(source)).toEqual(level);expect(manifest.baseline.sha256).toBe(LANDSCAPE_INFO[id].sha256);
 expect(level.terrain).toEqual(before.terrain);expect(level.size).toEqual(before.size);expect(level.environment).toEqual(before.environment);expect(level.waterMaterial).toEqual(before.waterMaterial);expect(level.environment.weather.enabled).toBe(false);
 expect(manifest.moved).toEqual([]);expect(manifest.terrainChanged).toBe(false);
 const originals=new Map(before.placements.map(p=>[p.id,p])),removed=new Set(manifest.removed.map(p=>p.id)),retained=level.placements.filter(p=>originals.has(p.id));
 expect(removed.size).toBe(manifest.removed.length);expect(retained.length+removed.size).toBe(before.placements.length);expect(retained.length).toBe(manifest.retainedPlacements);
 for(const p of retained)expect(p).toEqual(originals.get(p.id));for(const p of before.placements)expect(removed.has(p.id)).toBe(!retained.some(q=>q.id===p.id));
 const actors=new Set(MIXED_PREVIEW_ACTORS[level.zone].map(a=>a.id));for(const actor of Object.keys(level.actorRoutes??{}))expect(actors.has(actor)).toBe(true);
 for(const site of sites){
  expect(field.flatBox(...site.box)).toBe(level.pathHeight);expect(path.has(site.box.join(','))).toBe(false);
  const candidate={...level,placements:[...level.placements.filter(p=>p.id!==site.placement),{id:'candidate-gun',model:'turret-study',variant:'base',box:[site.box[0],0,site.box[1]],turn:0}]};
  expect(validateLevel(candidate,models)).toBe(candidate);
 }
 const geometry=auditRouteGeometry(level,sites,models);expect(geometry.failures).toEqual([]);expect(geometry.sampledPoses).toBeGreaterThan(0);
 for(const site of geometry.coverage){
  // A site must offer a real base-gun opportunity against every current zone
  // species somewhere, not just touch a circle or duplicate a raw empty box.
  const types=[...new Set(MIXED_PREVIEW_ACTORS[level.zone].map(a=>a.model))];
  for(const model of types)expect(Object.values(site.routes).some(route=>route.eligible.base[model].some(([a,b])=>b>a)),site.id+'/'+model).toBe(true);
 }
 for(const route of routes){
  const length=(route.path.length-1)*24;
  expect(geometry.coverage.filter(s=>s.group==='late').some(s=>Object.values(s.routes[route.id].eligible.base).some(windows=>windows.some(([a,b])=>b>length*2/3))),route.id+' late coverage').toBe(true);
 }
 const combat=auditCombat(level,models);expect(combat.failures).toEqual([]);expect(Object.keys(combat.hits).length).toBeGreaterThan(0);
 for(const route of routes)expect(Object.keys(combat.hits).some(key=>key.startsWith(route.id+'/')),route.id+' actual attacks').toBe(true);
 if(level.placements.some(p=>p.model==='missile-launcher')){expect(combat.launches).toBeGreaterThan(0);expect(combat.claimsSeen).toBe(true);expect(combat.missileHits).toBeGreaterThan(0);}
 for(const generator of combat.enhancers){expect(generator.active).toBe(true);expect(generator.recipientIds).toHaveLength(1);}
 if(process.env.LEVEL_AUDIT_WRITE==='1')await Bun.write(new URL(`../docs/level-rebuild-2026-10-18/${id}.audit.json`,import.meta.url),JSON.stringify({id,sourceHash:sourceHash(source),geometry,combat},null,2)+'\n');
},30000);
