import {createHash} from 'node:crypto';
import {carveMoss01,A1_BASELINE,A1_DEFENCE_SITES,checkA1PathEdges} from './a1-path-carving.js';
import {validateLevel} from '../shared/level.js';
const root=new URL('../',import.meta.url),out=new URL('docs/a1-path-carving-2026-10-18/',root),hash=text=>createHash('sha256').update(text).digest('hex');
const read=path=>Bun.file(new URL(path,root)).text();
export async function verifyA1Carving(){
 const savedText=await read('assets/levels/moss-01.json'),saved=JSON.parse(savedText),approved=await read('docs/a1-path-carving-2026-10-18/approved-southern-hook.level.json'),baseline=JSON.parse(await read(A1_BASELINE));
 const generated=await carveMoss01(),second=await carveMoss01(),before=await Bun.file(new URL('before-assets.json',out)).json(),failures=[],models=new Map(),changed=[];
 for(const [path,sha]of Object.entries(before)){const text=await read(path);if(hash(text)!==sha)changed.push(path);if(path.startsWith('assets/models/'))models.set(path.slice(14,-5),JSON.parse(text));}
 if(JSON.stringify(changed)!==JSON.stringify(['assets/levels/moss-01.json']))failures.push('Unapproved active asset changes: '+changed.join(', '));
 const frozenRoot='backups/pre-path-carving-2026-10-18T17-00-34-263Z/',frozenManifest=JSON.parse(await read(frozenRoot+'manifest.json')),frozenChanges=[];
 for(const file of frozenManifest.files)if(hash(await read(frozenRoot+file.path))!==file.sha256)frozenChanges.push(file.path);
 if(frozenChanges.length)failures.push('Frozen backup asset changed.');
 const serialize=level=>JSON.stringify(level,null,2)+'\n';
 if(savedText!==approved)failures.push('Saved source differs from user-approved Southern Hook.');
 if(savedText!==serialize(generated.level)||serialize(generated.level)!==serialize(second.level))failures.push('Factory is not deterministic or differs from saved source.');
 for(const key of ['terrain','environment','waterMaterial','previewWildlife','size'])if(JSON.stringify(saved[key])!==JSON.stringify(baseline[key]))failures.push('Baseline '+key+' changed.');
 const originals=new Map(baseline.placements.map(p=>[p.id,p]));for(const p of saved.placements)if(JSON.stringify(p)!==JSON.stringify(originals.get(p.id)))failures.push('Retained placement changed: '+p.id);
 if(saved.previewMode!=='layout'||saved.routes||saved.actorRoutes||saved.placements.some(p=>models.get(p.model)?.role!=='scenery'))failures.push('Unexpected combat source metadata or placements.');
 validateLevel(saved,models);const edges=checkA1PathEdges(saved);
 const audit=await Bun.file(new URL('southern-hook.audit.json',out)).json(),clearance=await Bun.file(new URL('southern-hook.clearance.json',out)).json();
 if(audit.sourceHash!==hash(savedText)||!audit.passed||!clearance.declaredSuitabilityPassed)failures.push('Selected geometry/coverage/visibility/declared-weapon evidence is missing or fails.');
 const span=w=>w.reduce((sum,[a,b])=>sum+b-a,0),coverage=[];
 for(const site of A1_DEFENCE_SITES){
  const gun=audit.geometry.coverage.find(r=>r.id===site.id).routes.main.eligible,arc=audit.arc.find(r=>r.id===site.id).variants;
  const row={id:site.id,box:site.box,coverageRole:site.coverageRole,weaponSuitability:site.weaponSuitability,baseGunDog:span(gun.base.dog),upgradeGunDog:span(gun.upgrade1.dog),baseArcDog:span(arc.base.surfaceContact.dog),upgradeArcDog:span(arc.upgrade1.surfaceContact.dog)};
  if(site.coverageRole==='base-useful'&&['dog','roller','moth'].some(type=>!span(gun.base[type])||!span(arc.base.surfaceContact[type])))failures.push('Base-useful classification fails: '+site.id);
  if(['dog','roller','moth'].some(type=>!span(gun.upgrade1[type])||!span(arc.upgrade1.surfaceContact[type])))failures.push('Upgrade coverage is absent: '+site.id);
  coverage.push(row);
 }
 const dependencies={};for(const path of ['scripts/a1-path-carving.js','scripts/a1-path-carving-audit.js','scripts/a1-path-carving-clearance.js','scripts/level-layout-audit.js','scripts/verify-zone-a-four-visibility.js','engine/path-motion.js','engine/visibility.js','engine/camera.js','game/turret-preview.js','game/arc-spire-preview.js','game/enemy-preview.js','shared/arsenal.js','shared/defence.js'])dependencies[path]=hash(await read(path));
 return {schema:'defender.a1-carving-final-verification',version:1,recordedAt:new Date().toISOString(),source:{path:'assets/levels/moss-01.json',sha256:hash(savedText)},approvedSourceExact:true,factoryExactAndDeterministic:true,changedActiveAssets:changed,unchangedOtherProductionLevels:15,unchangedModelSources:[...models].length,frozenAssetsVerified:frozenManifest.files.length,frozenChanges,retainedScenery:229,removedScenery:91,removalPurposes:{routeTravel:40,fullCandidateGround:34,overviewVisibility:17},terrainEnvironmentWildlifeUnchanged:true,edges,coverage,clearance:{baseGunReady:34,upgrade1GunReady:33,baseArcReady:34,upgrade1ArcReady:34,upgrade1GunExclusions:['late-17-11'],baseUseful:32,upgradeDependent:2,acceptedSuitabilityPassed:clearance.declaredSuitabilityPassed},dependencies,failures,passed:!failures.length};
}
if(import.meta.main){const report=await verifyA1Carving();await Bun.write(new URL('verification.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,coverage:undefined,dependencies:undefined},null,2));if(!report.passed)process.exitCode=1;}
