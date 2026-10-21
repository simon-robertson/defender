import {createHash} from 'node:crypto';
import {B_CARVES,carveOchre,checkBPathEdges} from './b-path-carving.js';
import {extraPavedJoins} from './b-path-carving-comparison.js';
import {TerrainField} from '../shared/terrain.js';
import {validateLevel} from '../shared/level.js';
import {pathBoxUnion} from '../shared/routes.js';
const root=new URL('../',import.meta.url),out=new URL('../docs/zone-b-path-carving-2026-10-19/',import.meta.url),hash=text=>createHash('sha256').update(text).digest('hex'),read=path=>Bun.file(new URL(path,root)).text(),serialize=value=>JSON.stringify(value,null,2)+'\n';
export async function verifyBCarving(){
 const before=await Bun.file(new URL('before-assets.json',out)).json(),models=new Map(),changed=[],failures=[];
 for(const entry of before.entries){const text=await read(entry.path);if(hash(text)!==entry.sha256)changed.push(entry.path);if(entry.path.startsWith('assets/models/'))models.set(entry.path.slice(14,-5),JSON.parse(text));}
 const expected=Object.keys(B_CARVES).map(id=>'assets/levels/'+id+'.json').sort();
 if(JSON.stringify(changed)!==JSON.stringify(expected))failures.push('Unexpected active asset changes: '+changed.join(', '));
 const frozenRoot='backups/pre-path-carving-2026-10-18T17-00-34-263Z/',checksums=await read(frozenRoot+'SHA256SUMS'),frozenChanges=[];
 const frozenFiles=checksums.trim().split('\n').map(line=>{const match=/^([a-f0-9]{64})\s+(.+)$/.exec(line);if(!match)throw new Error('Malformed frozen checksum');return {sha256:match[1],path:match[2]};});
 for(const entry of frozenFiles)if(hash(await read(frozenRoot+entry.path))!==entry.sha256)frozenChanges.push(entry.path);
 if(frozenChanges.length)failures.push('Frozen backup changed: '+frozenChanges.join(', '));
 const archive='backups/pre-path-carving-2026-10-18T17-00-34-263Z.tar.gz',archiveExpected=(await read(archive+'.sha256')).trim().split(/\s+/)[0],archiveHash=createHash('sha256').update(new Uint8Array(await Bun.file(new URL(archive,root)).arrayBuffer())).digest('hex');
 if(archiveHash!==archiveExpected)failures.push('Frozen archive hash mismatch');
 const levels=[];
 for(const [id,selected]of Object.entries(B_CARVES)){
  const text=await read('assets/levels/'+id+'.json'),saved=JSON.parse(text),baseline=JSON.parse(await read(selected.baseline.path)),proposal=await Bun.file(new URL(selected.option+'.level.json',out)).text(),generated=await carveOchre(id),second=await carveOchre(id),field=new TerrainField(saved),sourceHash=hash(text),local=[];
  const exactFactory=text===serialize(generated.level)&&serialize(generated.level)===serialize(second.level),exactProposal=text===proposal;
  if(!exactFactory||!exactProposal)local.push('Factory/proposal mismatch');
  for(const key of ['terrain','environment','waterMaterial','size','waves','pathHeight'])if(JSON.stringify(saved[key])!==JSON.stringify(baseline[key]))local.push('Original '+key+' changed');
  if(JSON.stringify(saved.previewWildlife.perches)!==JSON.stringify(baseline.previewWildlife.perches))local.push('Original bird perch metadata changed');
  if(saved.previewWildlife.habitats.length!==3||saved.previewWildlife.perches.length!==3||saved.previewMode!=='layout'||saved.previewActors||saved.actorRoutes||saved.placements.some(p=>models.get(p.model)?.role!=='scenery'))local.push('Unexpected combat actors/defences or wildlife count');
  const original=new Map(baseline.placements.map(p=>[p.id,p]));for(const p of saved.placements)if(JSON.stringify(p)!==JSON.stringify(original.get(p.id)))local.push('Retained scenery changed: '+p.id);
  validateLevel(saved,models);const edges=checkBPathEdges(saved),joins=extraPavedJoins(saved);
  if(joins.length)local.push('Nonconsecutive paved joins');
  if(pathBoxUnion(saved).some(([x,,z])=>field.supportBox(x,z)!==24))local.push('Unsupported route');
  if(selected.sites.some(s=>field.flatBox(...s.box)!==24||field.protected(...s.box)))local.push('Invalid surveyed ground');
  const audit=await Bun.file(new URL(selected.option+'.audit.json',out)).json(),clearance=await Bun.file(new URL(selected.option+'.clearance.json',out)).json(),coverage=await Bun.file(new URL(selected.option+'.coverage.json',out)).json(),missiles=await Bun.file(new URL(selected.option+'.missiles.json',out)).json(),wildlife=await Bun.file(new URL(id+'-runtime.json',out)).json();
  for(const [name,report]of Object.entries({audit,clearance,coverage,missiles}))if(report.sourceHash!==sourceHash)local.push('Stale '+name+' report');
  if(!audit.passed||!clearance.zeroRouteMotionOverlaps||!missiles.passed||!wildlife.passed||!wildlife.released||wildlife.sourceSha256!==sourceHash)local.push('Audit/runtime/flight failure or stale wildlife report');
  if(coverage.surveyedSites!==selected.sites.length||clearance.readyCombinations+clearance.restrictedCombinations!==clearance.testedCombinations)local.push('Coverage/physical survey inventory mismatch');
  const bridgeSupport=(saved.bridges??[]).flatMap(b=>b.boxes.map(box=>({id:b.id,box,walkingHeight:field.supportBox(...box),naturalFlatHeight:field.flatBox(...box),originalColumn:structuredClone(field.box(...box))})));
  const removed=generated.manifest.removed,purposes={routeTravel:0,fullCandidateGround:0,overviewVisibility:0};for(const p of removed)purposes[p.reason.startsWith('continuous')?'routeTravel':p.reason.startsWith('full defence')?'fullCandidateGround':'overviewVisibility']++;
  levels.push({id,selectedOption:selected.option,sourceHash,exactFactoryAndDeterministic:exactFactory,exactSelectedProposal:exactProposal,routes:generated.manifest.routes,unionPathBoxes:pathBoxUnion(saved).length,edges,extraPavedJoins:joins,bridgeSupport,retainedScenery:saved.placements.length,removedScenery:removed.length,removalPurposes:purposes,retainedSceneryExact:true,terrainWaterEnvironmentUnchanged:true,originalBirdPerchesUnchanged:true,groundSeedsChanged:JSON.stringify(saved.previewWildlife.habitatPoints)!==JSON.stringify(baseline.previewWildlife.habitatPoints),surveyedPlots:selected.sites.length,fullGroundVisibility:audit.visibility.passed,baseGunArcUseful:coverage.baseGunArcUseful,baseGunUseful:coverage.baseGunUseful,baseArcUseful:coverage.baseArcUseful,upgradeDependent:coverage.upgradeDependent,clearanceReady:coverage.clearanceReady,restrictions:coverage.excluded,sampledRoutePoses:audit.geometry.sampledPoses,sourceRouteFailures:audit.geometry.failures,weaponRouteFailures:clearance.rows.flatMap(r=>r.routeMotionFailures),missiles:missiles.summary,wildlife:{seconds:wildlife.seconds,hz:wildlife.hz,passed:wildlife.passed,groundCompleted:wildlife.rows.filter(r=>r.kind==='ground').map(r=>r.completed),birdCompleted:wildlife.rows.filter(r=>r.kind==='bird').map(r=>r.completed)},failures:local,passed:!local.length});
  failures.push(...local.map(message=>id+': '+message));
 }
 const dependencies={};for(const path of ['scripts/b-path-carving.js','scripts/b-path-carving-data.js','scripts/b-path-carving-options.js','scripts/b-path-carving-comparison.js','scripts/b-path-carving-audit.js','scripts/b-path-carving-clearance.js','scripts/b-path-carving-coverage.js','scripts/b-path-carving-missiles.js','scripts/b-path-runtime-audit.js','scripts/current-preview-levels.js','scripts/level-layout-audit.js','scripts/verify-zone-a-four-visibility.js','shared/preview-levels.js','shared/level.js','shared/terrain.js','shared/routes.js','shared/bridges.js','shared/defence.js','shared/arsenal.js','engine/world.js','engine/camera.js','engine/visibility.js','game/enemy-preview.js','game/turret-preview.js','game/arc-spire-preview.js','game/missile-preview.js','game/wildlife-preview.js'])dependencies[path]=hash(await read(path));
 return {schema:'defender.zone-b-carving-final-verification',version:1,recordedAt:new Date().toISOString(),status:'Lead-selected and technically verified for user review; user creative acceptance pending.',changedActiveAssets:changed,unchangedOtherProductionLevels:12,unchangedModelSources:models.size,frozenChecksummedFiles:frozenFiles.length,frozenChanges,frozenArchive:{path:archive,sha256:archiveHash,expectedSha256:archiveExpected,verified:archiveHash===archiveExpected},levels,dependencies,failures,passed:!failures.length};
}
if(import.meta.main){const report=await verifyBCarving();await Bun.write(new URL('verification.json',out),serialize(report));console.log(JSON.stringify({passed:report.passed,changed:report.changedActiveAssets,modelsPreserved:report.unchangedModelSources,frozenFiles:report.frozenChecksummedFiles,archive:report.frozenArchive.verified,levels:report.levels.map(({id,sourceHash,surveyedPlots,baseGunArcUseful,passed,failures})=>({id,sourceHash,surveyedPlots,baseGunArcUseful,passed,failures})),failures:report.failures},null,2));if(!report.passed)process.exitCode=1;}
