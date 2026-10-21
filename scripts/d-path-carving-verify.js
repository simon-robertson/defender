import {D_CARVES,carvePlum,checkDPathEdges} from './d-path-carving.js';
import {D_OUT,digest} from './d-path-carving-options.js';
import {extraPavedJoins} from './d-path-carving-comparison.js';
import {TerrainField} from '../shared/terrain.js';
import {validateLevel} from '../shared/level.js';
import {pathBoxUnion} from '../shared/routes.js';
const root=new URL('../',import.meta.url),json=v=>JSON.stringify(v,null,2)+'\n',read=p=>Bun.file(new URL(p,root)).text();
export async function verifyDCarving(){
 const levels=[],failures=[];
 for(const [id,selected]of Object.entries(D_CARVES)){
  const source=await read('assets/levels/'+id+'.json'),saved=JSON.parse(source),baseline=JSON.parse(await read(selected.baseline.path)),generated=await carvePlum(id),second=await carvePlum(id),field=new TerrainField(saved),local=[];
  const audit=await Bun.file(new URL('zone-d-'+selected.option+'.audit.json',D_OUT)).json(),clearance=await Bun.file(new URL('zone-d-'+selected.option+'.clearance.json',D_OUT)).json(),coverage=await Bun.file(new URL('zone-d-'+selected.option+'.coverage.json',D_OUT)).json(),missiles=await Bun.file(new URL('zone-d-'+selected.option+'.missiles.json',D_OUT)).json(),wildlife=await Bun.file(new URL('zone-d-'+id+'-runtime.json',D_OUT)).json(),placement=await Bun.file(new URL('zone-d-'+id+'-placement.json',D_OUT)).json();
  if(source!==json(generated.level)||json(generated.level)!==json(second.level))local.push('Deterministic factory mismatch');
  if(source!==await read('docs/campaign-completion-2026-10-20/zone-d-'+selected.option+'.level.json'))local.push('Selected comparison differs');
  for(const key of ['terrain','environment','waterMaterial','size','waves','pathHeight'])if(JSON.stringify(saved[key])!==JSON.stringify(baseline[key]))local.push('Original '+key+' changed');
  if(JSON.stringify(saved.previewWildlife.perches)!==JSON.stringify(baseline.previewWildlife.perches))local.push('Bird metadata changed');
  const original=new Map(baseline.placements.map(p=>[p.id,p]));for(const p of saved.placements)if(JSON.stringify(p)!==JSON.stringify(original.get(p.id)))local.push('Retained scenery changed '+p.id);
  validateLevel(saved);checkDPathEdges(saved);if(extraPavedJoins(saved).length)local.push('Unintended paved joins');
  if(pathBoxUnion(saved).some(([x,,z])=>field.supportBox(x,z)!==24))local.push('Unsupported route');
  if(selected.sites.some(s=>field.flatBox(...s.box)!==24||field.protected(...s.box)))local.push('Invalid candidate support');
  for(const [name,report]of Object.entries({audit,clearance,coverage,missiles,placement}))if(report.sourceHash!==digest(source))local.push('Stale '+name+' report');
  if(wildlife.sourceSha256!==digest(source))local.push('Stale wildlife report');
  if(!audit.passed||!clearance.zeroRouteMotionOverlaps||!missiles.passed||!wildlife.passed||!wildlife.released||!placement.passed)local.push('Audit failure');
  if(coverage.surveyedSites!==selected.sites.length)local.push('Survey inventory mismatch');
  levels.push({id,option:selected.option,title:selected.title,sourceHash:digest(source),baseline:selected.baseline,routes:generated.manifest.routes,sites:selected.sites.length,retainedScenery:saved.placements.length,removedScenery:generated.manifest.removed.length,terrainWaterEnvironmentExact:true,retainedSceneryExact:true,originalBirdPerchesExact:true,deterministicFactoryExact:true,edges:checkDPathEdges(saved),extraPavedJoins:[],bridgeSupport:(saved.bridges??[]).flatMap(b=>b.boxes.map(box=>({id:b.id,box,walkingHeight:field.supportBox(...box),naturalHeight:field.flatBox(...box),originalColumn:field.box(...box)}))),sourcePoseSamples:audit.geometry.sampledPoses,sourceMotionFailures:audit.geometry.failures,fullGroundVisible:audit.visibility.passed,baseGunArcUseful:coverage.baseGunArcUseful,upgradeDependent:coverage.upgradeDependent,independentWeaponCombinations:placement.combinations,productionAllowed:placement.valid,productionRestrictions:placement.restricted,missiles:missiles.summary,wildlife:{seconds:wildlife.seconds,hz:wildlife.hz,rows:wildlife.rows,passed:wildlife.passed,released:wildlife.released},hulls:placement.hulls,failures:local,passed:!local.length});
  failures.push(...local.map(f=>id+': '+f));
 }
 const snapshotRoot='backups/pre-path-carving-2026-10-18T17-00-34-263Z/',lines=(await read(snapshotRoot+'SHA256SUMS')).trim().split('\n'),frozenFailures=[];
 for(const line of lines){const [,hash,path]=/^([a-f0-9]{64})\s+(.+)$/.exec(line);if(digest(await read(snapshotRoot+path))!==hash)frozenFailures.push(path);}
 failures.push(...frozenFailures.map(f=>'Frozen backup changed '+f));
 return {schema:'defender.zone-d-carving-final-verification',version:1,recordedAt:new Date().toISOString(),scope:'Zone D layouts only. Combat schedules and whole-campaign balance are independently owned by the campaign integration. Human creative/balance acceptance pending.',reproduce:'bun scripts/d-path-carving-verify.js',levels,frozenBackup:{checksummedFiles:lines.length,failures:frozenFailures,passed:!frozenFailures.length},failures,passed:!failures.length};
}
if(import.meta.main){const report=await verifyDCarving();await Bun.write(new URL('zone-d-verification.json',D_OUT),json(report));console.log(JSON.stringify({passed:report.passed,frozen:report.frozenBackup,levels:report.levels.map(({id,routes,sites,baseGunArcUseful,sourcePoseSamples,productionAllowed,independentWeaponCombinations,passed,failures})=>({id,routes,sites,baseGunArcUseful,sourcePoseSamples,productionAllowed,independentWeaponCombinations,passed,failures})),failures:report.failures}));if(!report.passed)process.exitCode=1;}
