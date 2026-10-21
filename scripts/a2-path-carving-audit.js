// Offline probes only: no actors/defences are written to the reviewed level.
import {A2_OPTIONS,digest} from './a2-path-carving-options.js';
import {auditArcCoverage} from './a1-path-carving-audit.js';
import {auditModels,auditRouteGeometry} from './level-layout-audit.js';
import {reviewPlacementVisibility} from './verify-zone-a-four-visibility.js';
import {validateLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';

const root=new URL('../',import.meta.url),out=new URL('docs/a2-path-carving-2026-10-18/',root);

export async function auditA2Option(id){
 const text=await Bun.file(new URL(`${id}.level.json`,out)).text(),saved=JSON.parse(text),sites=A2_OPTIONS[id].sites,models=await auditModels(saved);
 models.set('arc-spire',await Bun.file(new URL('../assets/models/arc-spire.json',import.meta.url)).json());
 validateLevel(saved,models);
 const level=structuredClone(saved);delete level.previewMode;
 const field=new TerrainField(level),path=new Set(level.path.map(([x,,z])=>`${x},${z}`)),siteFailures=[];
 for(const site of sites){
  if(field.flatBox(...site.box)!==level.pathHeight||path.has(site.box.join(',')))siteFailures.push(site.id+': support/route');
  for(const model of ['turret-study','arc-spire'])for(const variant of ['base','upgrade1']){
   const probe={...level,placements:[...level.placements,{id:'individual-'+site.id,model,variant,box:[site.box[0],0,site.box[1]],turn:0}]};
   try{validateLevel(probe,models);}catch(e){siteFailures.push(site.id+'/'+model+'/'+variant+': '+e.message);}
  }
 }
 const geometry=auditRouteGeometry(level,sites,models),arc=auditArcCoverage(level,sites,models),visibility=reviewPlacementVisibility(saved,sites,models);
 return {schema:'defender.a2-carving-option-audit',version:1,id,sourceHash:digest(text),recordedAt:new Date().toISOString(),method:'Synthetic offline copy removes previewMode only to admit production Dog/Roller/Moth and individual weapon probes. Actual level contains scenery and wildlife only. Guns: production actual pitched muzzles at zero/full recoil, per-species 1-unit bins. Arcs: production closest terminal, centre LOS and deterministic production facing-side surface sampling at 1-unit bins. No damage, waves, budget or simultaneous adjacent-defence claim.',siteFailures,geometry,arc,visibility,passed:!siteFailures.length&&!geometry.failures.length&&visibility.passed};
}
if(import.meta.main){
 const ids=process.argv.slice(2);for(const id of ids.length?ids:Object.keys(A2_OPTIONS)){
  const report=await auditA2Option(id);await Bun.write(new URL(`${id}.audit.json`,out),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({id,passed:report.passed,failures:report.siteFailures,geometryFailures:report.geometry.failures,sites:report.geometry.coverage.length,poses:report.geometry.sampledPoses,visibility:report.visibility.passed}));
 }
}
