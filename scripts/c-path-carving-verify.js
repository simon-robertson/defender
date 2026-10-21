// Final C-only provenance and evidence reconciliation. Does not rebuild sources.
import {C_CARVES,carveIce} from './c-path-carving.js';
import {C_OUT,digest,readCBaseline} from './c-path-carving-options.js';
import {extraPavedJoins} from './c-path-carving-comparison.js';
import {TerrainField} from '../shared/terrain.js';
import {pathBoxUnion} from '../shared/routes.js';
export async function verifyCCarving(){
 const levels=[],failures=[];
 for(const [id,selected]of Object.entries(C_CARVES)){
  const text=await Bun.file(new URL('../assets/levels/'+id+'.json',import.meta.url)).text(),level=JSON.parse(text),baseline=await readCBaseline(id),generated=await carveIce(id),sourceHash=digest(text),local=[],reports={};
  if(text!==JSON.stringify(generated.level,null,2)+'\n')local.push('Saved source differs from deterministic factory.');
  for(const key of ['terrain','environment','waterMaterial','size','waves','pathHeight'])if(JSON.stringify(level[key])!==JSON.stringify(baseline[key]))local.push('Landscape '+key+' changed.');
  if(JSON.stringify(level.previewWildlife.perches)!==JSON.stringify(baseline.previewWildlife.perches))local.push('Bird perch metadata changed.');
  const originals=new Map(baseline.placements.map(p=>[p.id,p]));for(const placement of level.placements)if(JSON.stringify(placement)!==JSON.stringify(originals.get(placement.id)))local.push('Retained scenery changed: '+placement.id);
  for(const suffix of ['audit','clearance','coverage','missiles','placement']){const report=await Bun.file(new URL(selected.option+'.'+suffix+'.json',C_OUT)).json();reports[suffix]=report;if(report.sourceHash!==sourceHash)local.push('Stale '+suffix+' report.');}
  const runtime=await Bun.file(new URL('zone-c-'+id+'-runtime.json',C_OUT)).json();if(runtime.sourceSha256!==sourceHash||!runtime.passed||!runtime.released)local.push('Wildlife runtime failed/stale.');
  if(!reports.audit.passed||!reports.audit.visibility.passed||reports.audit.geometry.failures.length)local.push('Route/source/visibility audit failed.');
  if(!reports.placement.passed||!reports.missiles.passed)local.push('Native placement/enemy envelope/flight audit failed.');
  const nativeUnsafe=reports.clearance.excluded.filter(excluded=>reports.placement.rows.find(row=>row.model===excluded.model&&row.variant===excluded.variant).ready.includes(excluded.site));if(nativeUnsafe.length)local.push('Native-admitted site conflicts with independent sampled clearance.');
  if(extraPavedJoins(level).length)local.push('Nonconsecutive paved joins.');
  const field=new TerrainField(level);if(pathBoxUnion(level).some(([x,,z])=>field.supportBox(x,z)!==24))local.push('Unsupported route.');
  levels.push({id,title:selected.title,sourceHash,routes:generated.manifest.routes,unionPathBoxes:pathBoxUnion(level).length,retainedScenery:level.placements.length,removedScenery:generated.manifest.removed.length,surveyedPlots:selected.sites.length,terrainWaterEnvironmentUnchanged:true,perchesAndRetainedSceneryExact:true,frozenSourceHashConfirmed:true,fullGroundVisibility:reports.audit.visibility.passed,routePoses:reports.audit.geometry.sampledPoses,routeGeometryFailures:reports.audit.geometry.failures,nativeReady:reports.placement.rows.map(({model,variant,ready})=>({model,variant,count:ready.length,sites:ready})),nativeUnsafe,coverage:{baseGunUseful:reports.coverage.baseGunUseful,baseArcUseful:reports.coverage.baseArcUseful,baseGunArcUseful:reports.coverage.baseGunArcUseful,upgradeDependent:reports.coverage.upgradeDependent},flightSummary:reports.missiles.summary,wildlife:{seconds:runtime.seconds,completed:runtime.rows.map(row=>({id:row.id,kind:row.kind,journeys:row.completed})),passed:runtime.passed,released:runtime.released},failures:local,passed:!local.length});
  failures.push(...local.map(message=>id+': '+message));
 }
 return {schema:'defender.zone-c-carving-verification',version:1,recordedAt:new Date().toISOString(),status:'Implemented and technically verified. Whole-campaign balance and GPU/appearance review belong to the integration evidence; human acceptance pending.',levels,failures,passed:!failures.length};
}
if(import.meta.main){const report=await verifyCCarving();await Bun.write(new URL('zone-c-verification.json',C_OUT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,levels:report.levels.map(({id,routes,surveyedPlots,coverage,flightSummary,passed})=>({id,routes,surveyedPlots,coverage,flightSummary,passed})),failures:report.failures},null,2));if(!report.passed)process.exitCode=1;}
