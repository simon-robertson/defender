// Offline evidence only: read the current saved layouts and completed audits.
// This does not run simulation or alter levels, models or runtime settings.
import {sourceHash} from './level-layout-audit.js';

const root=new URL('../',import.meta.url);
const total=windows=>windows.reduce((sum,[a,b])=>sum+b-a,0);
function flags(windows,length){const result=new Uint8Array(length);for(const [a,b]of windows)result.fill(1,a,b);return result;}
function idealWindows(path,box,range){
 const result=[];let start=-1;const length=(path.length-1)*24;
 for(let d=0;d<=length;d++){
  let inside=false;
  if(d<length){const i=Math.floor(d/24),f=(d%24+.5)/24,a=path[i],b=path[i+1],x=(a[0]+(b[0]-a[0])*f-box[0])*24,z=(a[2]+(b[2]-a[2])*f-box[1])*24;inside=x*x+z*z<=range*range;}
  if(inside&&start<0)start=d;if(!inside&&start>=0){result.push([start,d]);start=-1;}
 }
 return result;
}

export async function levelRebuildSummary(){
 const levels=[];
 for(const prefix of ['moss','ochre','ice','plum'])for(let n=1;n<=4;n++){
  const id=`${prefix}-${String(n).padStart(2,'0')}`,source=await Bun.file(new URL(`assets/levels/${id}.json`,root)).text(),level=JSON.parse(source);
  const manifest=await Bun.file(new URL(`docs/level-rebuild-2026-10-18/${id}.manifest.json`,root)).json(),audit=await Bun.file(new URL(`docs/level-rebuild-2026-10-18/${id}.audit.json`,root)).json();
  if(audit.sourceHash!==sourceHash(source)||manifest.source.sha256!==audit.sourceHash)throw new Error(id+': source/audit/manifest hashes disagree.');
  if(sourceHash(await Bun.file(new URL(manifest.baseline.path,root)).text())!==manifest.baseline.sha256)throw new Error(id+': frozen landscape hash changed after the audit.');
  if(audit.geometry.failures.length||audit.combat.failures.length)throw new Error(id+': audit contains failures.');
  const species=Object.keys(audit.geometry.coverage[0].routes.main.eligible.base),referenceEnemy=species[0];
  const routes=[{id:'main',path:level.path},...(level.routes??[])];
  const comparisons=routes.map(route=>{
   const length=(route.path.length-1)*24,rows=audit.geometry.coverage.map(site=>({id:site.id,box:site.box,group:site.group,base:site.routes[route.id].eligible.base[referenceEnemy],upgrade1:site.routes[route.id].eligible.upgrade1[referenceEnemy]}));
   const early=rows.filter(s=>s.group==='early').sort((a,b)=>total(b.base)-total(a.base))[0];
   const earlyMask=flags(early.base,length),late=rows.filter(s=>s.group==='late').map(s=>{const mask=flags(s.base,length);let added=0;for(let d=Math.ceil(length*2/3);d<length;d++)if(mask[d]&&!earlyMask[d])added++;return {...s,additionalFinalThirdUnits:added};}).sort((a,b)=>b.additionalFinalThirdUnits-a.additionalFinalThirdUnits)[0];
   const reentries=rows.flatMap(site=>{
    for(const [variant,range]of [['base',48],['upgrade1',72]]){
     const windows=idealWindows(route.path,site.box,range),eligible=site[variant];
     const reached=windows.filter(([a,b])=>eligible.some(([c,d])=>Math.min(b,d)>Math.max(a,c)));
     if(reached.length>1)return [{site:site.id,box:site.box,variant,range,rangeWindows:reached,actualWindows:eligible}];
    }
    return [];
   });
   return {routeId:route.id,length,referenceEnemy,bestEarly:{id:early.id,box:early.box,windows:early.base,eligibleUnits:total(early.base)},lateAddition:{id:late.id,box:late.box,windows:late.base,additionalFinalThirdUnits:late.additionalFinalThirdUnits},trueRangeReentries:reentries,siteUnits:rows.map(s=>({id:s.id,box:s.box,group:s.group,base:total(s.base),upgrade1:total(s.upgrade1)}))};
  });
  levels.push({id,name:level.name,size:level.size,sourceHash:audit.sourceHash,baseline:manifest.baseline,waterBoxes:level.terrain.boxes.filter(c=>c.water>c.ground).length,retainedScenery:manifest.retainedPlacements,removedScenery:manifest.removed.length,removedLandmarks:manifest.removedLandmarks,attackSites:manifest.sites.length,visibilityAreas:manifest.visibilitySites.length,routeComparisons:comparisons,sampledPoses:audit.geometry.sampledPoses,checkedParts:audit.geometry.checkedParts,combatFrames:audit.combat.frames,combatHits:audit.combat.hits,missileHits:audit.combat.missileHits});
 }
 return {scope:'Current saved sixteen-level preview layouts; source hashes must match successful geometry/combat audits. No new test or simulation run.',units:'Coverage and distances are world units. Windows use 1-unit midpoint bins. Comparisons use the first listed zone species and actual base/upgrade1 gun eligibility; full per-species evidence remains in each level audit. These are opportunity measurements, not wave balance or predicted missile outcomes.',levels};
}
if(import.meta.main){
 const args=process.argv.slice(2);if(args.some(a=>a!=='--write'))throw new Error('Usage: bun scripts/summarize-level-rebuild.js [--write]');
 const result=await levelRebuildSummary(),text=JSON.stringify(result,null,2)+'\n';
 if(args.includes('--write'))await Bun.write(new URL('docs/level-rebuild-2026-10-18/coverage-summary.json',root),text);else console.log(text);
}
