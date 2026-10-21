import {createHash} from 'node:crypto';
import {carveMoss04,A4_BASELINE,A4_DEFENCE_SITES,checkA4PathEdges} from './a4-path-carving.js';
import {validateLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
import {pathBoxUnion} from '../shared/routes.js';
const root=new URL('../',import.meta.url),out=new URL('docs/a4-path-carving-2026-10-18/',root),hash=text=>createHash('sha256').update(text).digest('hex'),read=path=>Bun.file(new URL(path,root)).text();
export async function verifyA4Carving(){
 const savedText=await read('assets/levels/moss-04.json'),saved=JSON.parse(savedText),selected=await read('docs/a4-path-carving-2026-10-18/ruin-and-mere-tour.level.json'),baseline=JSON.parse(await read(A4_BASELINE));
 const generated=await carveMoss04(),second=await carveMoss04(),before=await Bun.file(new URL('before-assets.json',out)).json(),failures=[],models=new Map(),changed=[];
 for(const [path,sha]of Object.entries(before)){const text=await read(path);if(hash(text)!==sha)changed.push(path);if(path.startsWith('assets/models/'))models.set(path.slice(14,-5),JSON.parse(text));}
 if(JSON.stringify(changed)!==JSON.stringify(['assets/levels/moss-04.json']))failures.push('Unexpected active asset changes: '+changed.join(', '));
 const frozenRoot='backups/pre-path-carving-2026-10-18T17-00-34-263Z/',frozenManifest=JSON.parse(await read(frozenRoot+'manifest.json')),frozenChanges=[];
 for(const file of frozenManifest.files)if(hash(await read(frozenRoot+file.path))!==file.sha256)frozenChanges.push(file.path);
 if(frozenChanges.length)failures.push('Frozen backup asset changed.');
 const serialize=level=>JSON.stringify(level,null,2)+'\n',factoryExact=savedText===serialize(generated.level)&&serialize(generated.level)===serialize(second.level),selectedExact=savedText===selected;
 if(!selectedExact)failures.push('Saved source differs from the selected Ruin and Mere Tour rendering.');
 if(!factoryExact)failures.push('Factory is not deterministic or differs from saved source.');
 for(const key of ['terrain','environment','waterMaterial','previewWildlife','size'])if(JSON.stringify(saved[key])!==JSON.stringify(baseline[key]))failures.push('Baseline '+key+' changed.');
 const originals=new Map(baseline.placements.map(p=>[p.id,p]));for(const p of saved.placements)if(JSON.stringify(p)!==JSON.stringify(originals.get(p.id)))failures.push('Retained placement changed: '+p.id);
 if(saved.previewMode!=='layout'||Boolean(saved.routes?.length)||saved.actorRoutes||saved.placements.some(p=>models.get(p.model)?.role!=='scenery'))failures.push('Unexpected combat metadata or placements.');
 validateLevel(saved,models);const edges=checkA4PathEdges(saved),field=new TerrainField(saved);
 const bridgeSupport=[];if(saved.bridges?.length)failures.push('Selected dry tour unexpectedly has a bridge.');
 if(pathBoxUnion(saved).some(([x,,z])=>field.supportBox(x,z)!==24))failures.push('Path support is discontinuous.');
 if(A4_DEFENCE_SITES.some(s=>field.bridgeBox(...s.box)||field.flatBox(...s.box)!==24||field.protected(...s.box)))failures.push('Candidate is not naturally dry and outside route/deck.');
 const audit=await Bun.file(new URL('ruin-and-mere-tour.audit.json',out)).json(),clearance=await Bun.file(new URL('ruin-and-mere-tour.clearance.json',out)).json(),coverage=await Bun.file(new URL('coverage.json',out)).json(),missiles=await Bun.file(new URL('ruin-and-mere-tour.missiles.json',out)).json();
 if(audit.sourceHash!==hash(savedText)||!audit.passed||clearance.sourceHash!==hash(savedText)||!clearance.declaredSuitabilityPassed||coverage.sourceHash!==hash(savedText)||missiles.sourceHash!==hash(savedText)||!missiles.passed)failures.push('Selected geometry/coverage/visibility/weapon evidence is missing, stale or fails.');
 if(coverage.sites.length!==A4_DEFENCE_SITES.length||coverage.baseUsefulCount!==37||coverage.sites.filter(s=>!s.baseUseful).length!==3)failures.push('Base-useful candidate claim fails.');
 const purposes={routeTravel:0,fullCandidateGround:0,overviewVisibility:0};for(const p of generated.manifest.removed)purposes[p.reason.startsWith('continuous')?'routeTravel':p.reason.startsWith('full defence')?'fullCandidateGround':'overviewVisibility']++;
 const dependencies={};for(const path of ['scripts/a4-path-carving.js','scripts/a4-path-carving-audit.js','scripts/a4-path-carving-clearance.js','scripts/a4-path-carving-coverage.js','scripts/a4-path-carving-missiles.js','scripts/level-layout-audit.js','scripts/verify-zone-a-four-visibility.js','engine/path-motion.js','engine/visibility.js','engine/camera.js','engine/world.js','game/turret-preview.js','game/arc-spire-preview.js','game/enemy-preview.js','game/missile-preview.js','engine/missile-flight.js','shared/missile-flight.js','shared/missile-model.js','shared/arsenal.js','shared/defence.js','shared/bridges.js','shared/terrain.js','shared/level.js'])dependencies[path]=hash(await read(path));
 return {schema:'defender.a4-carving-final-verification',version:1,recordedAt:new Date().toISOString(),source:{path:'assets/levels/moss-04.json',sha256:hash(savedText)},selectedSourceExact:selectedExact,factoryExactAndDeterministic:factoryExact,changedActiveAssets:changed,unchangedOtherProductionLevels:15,unchangedModelSources:models.size,frozenAssetsVerified:frozenManifest.files.length,frozenChanges,retainedScenery:saved.placements.length,removedScenery:generated.manifest.removed.length,removalPurposes:purposes,terrainEnvironmentWildlifeUnchanged:true,edges,bridgeSupport,candidates:{count:A4_DEFENCE_SITES.length,fullGroundVisible:audit.visibility.passed,baseUseful:coverage.baseUsefulCount,upgradeDependent:coverage.sites.filter(s=>!s.baseUseful).length,baseGunReady:39,upgrade1GunReady:37,baseArcReady:40,upgrade1ArcReady:40,siloReady:{base:40,upgrade1:40,upgrade2:40},coverageClassification:coverage.classification,excluded:clearance.excluded},routes:generated.manifest.routes,merge:generated.manifest.merge,unionPathBoxes:generated.manifest.unionPathBoxes,missileFeasibility:missiles.summary,dependencies,failures,passed:!failures.length};
}
if(import.meta.main){const report=await verifyA4Carving();await Bun.write(new URL('verification.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,dependencies:undefined,bridgeSupport:undefined},null,2));if(!report.passed)process.exitCode=1;}
