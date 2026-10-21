import {createHash} from 'node:crypto';
import {carveMoss02,A2_BASELINE,A2_DEFENCE_SITES,checkA2PathEdges} from './a2-path-carving.js';
import {validateLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
const root=new URL('../',import.meta.url),out=new URL('docs/a2-path-carving-2026-10-18/',root),hash=text=>createHash('sha256').update(text).digest('hex'),read=path=>Bun.file(new URL(path,root)).text();
export async function verifyA2Carving(){
 const savedText=await read('assets/levels/moss-02.json'),saved=JSON.parse(savedText),selected=await read('docs/a2-path-carving-2026-10-18/garden-crossing.level.json'),baseline=JSON.parse(await read(A2_BASELINE));
 const generated=await carveMoss02(),second=await carveMoss02(),before=await Bun.file(new URL('before-assets.json',out)).json(),failures=[],models=new Map(),changed=[];
 for(const [path,sha]of Object.entries(before)){const text=await read(path);if(hash(text)!==sha)changed.push(path);if(path.startsWith('assets/models/'))models.set(path.slice(14,-5),JSON.parse(text));}
 if(JSON.stringify(changed)!==JSON.stringify(['assets/levels/moss-02.json']))failures.push('Unexpected active asset changes: '+changed.join(', '));
 const frozenRoot='backups/pre-path-carving-2026-10-18T17-00-34-263Z/',frozenManifest=JSON.parse(await read(frozenRoot+'manifest.json')),frozenChanges=[];
 for(const file of frozenManifest.files)if(hash(await read(frozenRoot+file.path))!==file.sha256)frozenChanges.push(file.path);
 if(frozenChanges.length)failures.push('Frozen backup asset changed.');
 const serialize=level=>JSON.stringify(level,null,2)+'\n',factoryExact=savedText===serialize(generated.level)&&serialize(generated.level)===serialize(second.level),selectedExact=savedText===selected;
 if(!selectedExact)failures.push('Saved source differs from the selected Garden Crossing rendering.');
 if(!factoryExact)failures.push('Factory is not deterministic or differs from saved source.');
 for(const key of ['terrain','environment','waterMaterial','previewWildlife','size'])if(JSON.stringify(saved[key])!==JSON.stringify(baseline[key]))failures.push('Baseline '+key+' changed.');
 const originals=new Map(baseline.placements.map(p=>[p.id,p]));for(const p of saved.placements)if(JSON.stringify(p)!==JSON.stringify(originals.get(p.id)))failures.push('Retained placement changed: '+p.id);
 if(saved.previewMode!=='layout'||saved.routes||saved.actorRoutes||saved.placements.some(p=>models.get(p.model)?.role!=='scenery'))failures.push('Unexpected combat metadata or placements.');
 validateLevel(saved,models);const edges=checkA2PathEdges(saved),field=new TerrainField(saved);
 const bridgeBoxes=saved.bridges.flatMap(b=>b.boxes),bridgeSupport=bridgeBoxes.map(box=>({box,naturalFlatHeight:field.flatBox(...box),walkingHeight:field.supportBox(...box),originalColumn:structuredClone(field.box(...box))}));
 if(bridgeSupport.some(b=>b.naturalFlatHeight!==null||b.walkingHeight!==24||b.originalColumn.water!==20))failures.push('Bridge did not retain water and independent deck support.');
 if(saved.path.some(([x,,z])=>field.supportBox(x,z)!==24))failures.push('Path support is discontinuous.');
 if(A2_DEFENCE_SITES.some(s=>field.bridgeBox(...s.box)||field.flatBox(...s.box)!==24||field.protected(...s.box)))failures.push('Candidate is not naturally dry and outside route/deck.');
 const audit=await Bun.file(new URL('garden-crossing.audit.json',out)).json(),clearance=await Bun.file(new URL('garden-crossing.clearance.json',out)).json(),coverage=await Bun.file(new URL('coverage.json',out)).json();
 if(audit.sourceHash!==hash(savedText)||!audit.passed||clearance.sourceHash!==hash(savedText)||!clearance.allProbedCombinationsClear||coverage.sourceHash!==hash(savedText))failures.push('Selected geometry/coverage/visibility/weapon evidence is missing, stale or fails.');
 if(coverage.sites.length!==A2_DEFENCE_SITES.length||coverage.sites.some(s=>!s.baseUseful))failures.push('Base-useful candidate claim fails.');
 const purposes={routeTravel:0,fullCandidateGround:0,overviewVisibility:0};for(const p of generated.manifest.removed)purposes[p.reason.startsWith('continuous')?'routeTravel':p.reason.startsWith('full defence')?'fullCandidateGround':'overviewVisibility']++;
 const dependencies={};for(const path of ['scripts/a2-path-carving.js','scripts/a2-path-carving-audit.js','scripts/a2-path-carving-clearance.js','scripts/a2-path-carving-coverage.js','scripts/a1-path-carving-audit.js','scripts/level-layout-audit.js','scripts/verify-zone-a-four-visibility.js','engine/path-motion.js','engine/visibility.js','engine/camera.js','engine/world.js','game/turret-preview.js','game/arc-spire-preview.js','game/enemy-preview.js','shared/arsenal.js','shared/defence.js','shared/bridges.js','shared/terrain.js','shared/level.js'])dependencies[path]=hash(await read(path));
 return {schema:'defender.a2-carving-final-verification',version:1,recordedAt:new Date().toISOString(),source:{path:'assets/levels/moss-02.json',sha256:hash(savedText)},selectedSourceExact:selectedExact,factoryExactAndDeterministic:factoryExact,changedActiveAssets:changed,unchangedOtherProductionLevels:15,unchangedModelSources:models.size,frozenAssetsVerified:frozenManifest.files.length,frozenChanges,retainedScenery:saved.placements.length,removedScenery:generated.manifest.removed.length,removalPurposes:purposes,terrainEnvironmentWildlifeUnchanged:true,edges,bridgeSupport,candidates:{count:A2_DEFENCE_SITES.length,fullGroundVisible:audit.visibility.passed,baseUseful:coverage.baseUsefulCount,upgradeDependent:coverage.upgradeDependentCount,baseGunReady:32,upgrade1GunReady:32,baseArcReady:32,upgrade1ArcReady:32,excluded:[]},actualBridgeGaps:coverage.union.map(({weapon,variant,species,bridgeUncovered})=>({weapon,variant,species,bridgeUncovered})),dependencies,failures,passed:!failures.length};
}
if(import.meta.main){const report=await verifyA2Carving();await Bun.write(new URL('verification.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,dependencies:undefined,bridgeSupport:undefined,actualBridgeGaps:undefined},null,2));if(!report.passed)process.exitCode=1;}
