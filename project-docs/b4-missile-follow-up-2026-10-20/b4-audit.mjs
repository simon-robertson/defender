import {readdir} from 'node:fs/promises';
import {createPlacementRules} from '../../play/placement.js';
import {PLAY_CONFIG} from '../../play/config.js';
import {carveOchre,B_CARVES} from '../../scripts/b-path-carving.js';
import {reviewPlacementVisibility} from '../../scripts/verify-zone-a-four-visibility.js';
import {validateLevel} from '../../shared/level.js';
import {levelRoutes} from '../../shared/routes.js';
import {TerrainField} from '../../shared/terrain.js';
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../../play/engine.js';
import assert from 'node:assert/strict';
const models=new Map();for(const file of await readdir('assets/models'))if(file.endsWith('.json')){const m=await Bun.file('assets/models/'+file).json();models.set(m.id,m);}
const source=await Bun.file('assets/levels/ochre-04.json').json(),before=await Bun.file('docs/zone-b-path-carving-2026-10-19/aqueduct-shore-tour.level.json').json();
validateLevel(source,models);assert.deepEqual((await carveOchre('ochre-04')).level,source);
for(const key of ['environment','waterMaterial','previewWildlife'])assert.deepEqual(source[key],before[key]);
assert.deepEqual(source.terrain.boxes.filter(b=>b.water>0),before.terrain.boxes.filter(b=>b.water>0));
const rules=createPlacementRules(source,models,{config:PLAY_CONFIG}),oldRules=createPlacementRules(before,models,{config:PLAY_CONFIG});
const report={routes:levelRoutes(source).map(r=>({id:r.id,boxes:r.path.length})),bridges:source.bridges,placement:{},waves:[]};
for(const family of ['turret-study','arc-spire','missile-launcher'])for(const variant of ['base','upgrade1','upgrade2']){
 const valid=rules.eligibleCells(variant,[],null,family).filter(c=>c.valid).map(c=>c.box),old=oldRules.eligibleCells(variant,[],null,family).filter(c=>c.valid).map(c=>c.box);
 report.placement[family+':'+variant]={before:old.length,after:valid.length,new:valid.filter(b=>!old.some(o=>o.join(',')===b.join(',')))};
}
const visibility=reviewPlacementVisibility(source,B_CARVES['ochre-04'].sites,models);assert(visibility.passed);report.visibleSurveyedPlots=visibility.sites.length;
const placements=[];for(const box of [[4,0,2],[9,0,5],[11,0,5],[14,0,6],[16,0,3],[18,0,5],[12,0,10],[10,0,11],[12,0,13],[18,0,13],[16,0,15]]){
 const p={id:'b4-probe-'+placements.length,model:'arc-spire',variant:'upgrade2',box,turn:0};if(rules.check(box,p.variant,placements,null,p.model).valid)placements.push(p);
}
const prep=rules.prepare(placements);assert(prep.valid,prep.reason);report.simultaneous=placements;report.wildlifePoints=prep.wildlifePoints;rules.dispose();oldRules.dispose();
const native=globalThis.fetch;globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(`assets/${kind}/${id}.json`).json()})};};
try{for(const wave of PLAY_CONFIG.levels.find(l=>l.id==='ochre-04').waves){
 const world=await loadPlayWorld('ochre-04',{wave,config:PLAY_CONFIG,placements:[]}),engine=new PlayEngine(world,{wave});
 try{engine.startWave();let time=0;for(;time<300&&!engine.completed;time+=1/120)engine.advance(1/120);
 const stats=engine.stats();assert.equal(stats.escaped,wave.spawns.length);report.waves.push({id:wave.id,seconds:time,stats});
 }finally{engine.dispose();disposePlayWorld(world);}
}}finally{globalThis.fetch=native;}
await Bun.write('docs/b4-missile-follow-up-2026-10-20/b4-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
