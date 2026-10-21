import {LANDSCAPE_INFO,landscapeFor,snapshotText,sha256} from './landscapes/index.js';
import {carveLevel} from './rebuild-level-layouts.js';
import {reviewPlacementVisibility} from './verify-zone-a-four-visibility.js';

const root=new URL('../',import.meta.url);

// Independent reread of saved final sources after the tactical batch is ready.
// This script writes only review evidence, never levels or landscape snapshots.
export async function reviewRebuiltZone(zone){
 const infos=Object.values(LANDSCAPE_INFO).filter(info=>info.zone===zone),levels=[];
 if(infos.length!==4)throw new Error('Expected four landscape baselines.');
 for(const info of infos){
  const sourcePath=`assets/levels/${info.id}.json`,file=Bun.file(new URL(sourcePath,root)),text=await file.text(),level=JSON.parse(text);
  const baselineText=await Bun.file(new URL(info.snapshot,root)).text(),baseline=JSON.parse(baselineText);
  if(sha256(baselineText)!==info.sha256||snapshotText(landscapeFor(zone,info.number))!==baselineText)throw new Error(`Changed baseline: ${info.id}`);
  const generated=await carveLevel(info.id);
  if(snapshotText(generated.level)!==text)throw new Error(`Saved source/factory disagreement: ${info.id}`);
  if(JSON.stringify(level.terrain)!==JSON.stringify(baseline.terrain))throw new Error(`Terrain changed during carving: ${info.id}`);
  const original=new Map(baseline.placements.map(p=>[p.id,p])),retained=level.placements.filter(p=>original.has(p.id));
  for(const placement of retained)if(JSON.stringify(placement)!==JSON.stringify(original.get(placement.id)))throw new Error(`Moved or altered original scenery: ${placement.id}`);
  for(const perch of info.perchCandidates)if(!retained.some(p=>p.id===perch.id))throw new Error(`Missing retained perch: ${perch.id}`);
  const models=new Map(),modelHashes={};
  for(const id of [...new Set(level.placements.map(p=>p.model))].sort()){
   const source=await Bun.file(new URL(`assets/models/${id}.json`,root)).text();models.set(id,JSON.parse(source));modelHashes[id]=sha256(source);
  }
  const review=reviewPlacementVisibility(level,generated.visibilitySites??generated.sites,models);
  if(await file.text()!==text)throw new Error(`Source changed during review: ${info.id}`);
  levels.push({id:info.id,source:{path:sourcePath,sha256:sha256(text),placements:level.placements.length,models:modelHashes},baseline:{path:info.snapshot,sha256:info.sha256,placements:baseline.placements.length},factoryAgrees:true,terrainUnchanged:true,retainedSceneryUnchanged:true,retainedScenery:retained.length,removedScenery:baseline.placements.length-retained.length,retainedPerches:info.perchCandidates.map(p=>p.id),...review});
 }
 const dependencies={};
 for(const path of ['scripts/verify-level-rebuild-visibility.js','scripts/verify-zone-a-four-visibility.js','scripts/rebuild-level-layouts.js','scripts/level-rebuild-layouts.js','scripts/landscapes/index.js','scripts/landscapes/core.js',`scripts/landscapes/${zone.toLowerCase()}.js`,'engine/visibility.js','engine/camera.js','shared/terrain.js'])
  dependencies[path]=sha256(await Bun.file(new URL(path,root)).text());
 return {schema:'defender.landscape-carve-visibility-review',version:1,recordedAt:new Date().toISOString(),zone,reproduce:`bun scripts/verify-level-rebuild-visibility.js ${zone} --write`,dependencies,levels,passed:levels.every(level=>level.passed)};
}

if(import.meta.main){
 const args=process.argv.slice(2),zone=args.find(arg=>/^[ABCD]$/.test(arg));
 if(!zone||args.some(arg=>!['A','B','C','D','--write'].includes(arg)))throw new Error('Usage: bun scripts/verify-level-rebuild-visibility.js A|B|C|D [--write]');
 const report=await reviewRebuiltZone(zone);
 if(args.includes('--write'))await Bun.write(new URL(`docs/level-rebuild-2026-10-18/visibility-${zone.toLowerCase()}.json`,root),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({zone,passed:report.passed,levels:report.levels.map(level=>({id:level.id,sourceHash:level.source.sha256,sites:level.sites.length,samples:level.method.totalSiteSamples,retainedScenery:level.retainedScenery,obstructions:level.sites.filter(site=>!site.clear)}))},null,2));
 if(!report.passed)process.exitCode=1;
}
