// Author-time Zone C route comparisons; never writes other zones or the backup.
import {createHash} from 'node:crypto';
import {expandCorners} from './level-rebuild-layouts.js';
import {auditModels} from './level-layout-audit.js';
import {reviewPlacementVisibility} from './verify-zone-a-four-visibility.js';
import {TerrainField} from '../shared/terrain.js';
import {validateLevel} from '../shared/level.js';
import {levelRoutes,pathBoxUnion} from '../shared/routes.js';
export const C_OUT=new URL('../docs/campaign-completion-2026-10-20/',import.meta.url);
export const C_BASELINE='backups/pre-path-carving-2026-10-18T17-00-34-263Z/assets/levels/';
export const C_HASHES={'ice-01':'55bec68b06aa0edd28d9cbfc270edb5a45d895484960ea86f1201ed14f70b20b','ice-02':'09b890be825a3344bad3ea27cbf999299bb7a51cc145dff2a3bd5df420ae4969','ice-03':'505f41770d30b843917c8cdf6050bbd071aa21bd88267f6a610fc310a99a1b68','ice-04':'db21de6d66c330c36bc5ba1cd4f81d09566fc00a64c9cdde2fc4b6b72c1bedc0'};
export const digest=text=>createHash('sha256').update(text).digest('hex');
const root=new URL('../',import.meta.url);
export const C_WILDLIFE_SEED_REVISIONS={'zone-c-tarn-circuit':[[406,24,378],[6,24,86],[402,24,26]],'zone-c-meltwater-return':[[474,24,310],[126,24,26],[94,24,378]],'zone-c-ridge-confluence':[[454,24,314],[22,24,50],[82,24,378]],'zone-c-sanctuary-fold':[[458,24,194],[18,24,122],[330,24,50]]};
const sites=groups=>Object.entries(groups).flatMap(([group,boxes])=>boxes.map(box=>({id:group.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+'-'+box.join('-'),group,box})));
const near=(corners,group='alternative')=>{const path=expandCorners(corners),keys=new Set(path.map(([x,,z])=>x+','+z)),all=new Map();for(const [x,,z]of path)for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=z+dz,k=a+','+b;if(a>=0&&a<20&&b>=0&&b<16&&!keys.has(k))all.set(k,[a,b]);}return sites({[group]:[...all.values()]});};
export const C_OPTIONS={
 'zone-c-tarn-circuit':{level:'ice-01',title:'Tarn and Fir Circuit',rationale:'Tours northern fir ground, the eastern tarn bank and a southern return. Keeps both raised slate islands and the whole lake intact; north/early, long eastern contact and late southern alternatives remain separated.',corners:[[0,5],[6,5],[6,2],[10,2],[10,4],[16,4],[16,11],[14,11],[14,14],[8,14],[8,15]],bridges:[],sites:sites({entry:[[1,4],[2,4],[3,4],[4,4],[5,4],[2,6],[3,6],[4,6]],firReturn:[[5,2],[5,3],[7,2],[7,3],[7,4],[8,3],[9,3],[9,4],[10,1]],eastBank:[[11,3],[12,3],[13,3],[14,3],[15,3],[15,5],[15,6],[15,7],[15,8],[15,9],[17,6],[17,8],[17,10]],southReturn:[[15,12],[15,13],[13,13],[12,13],[11,13],[10,13],[9,13],[9,15],[7,14],[7,15]]})},
 'zone-c-western-tarn-fold':{level:'ice-01',title:'Western Tarn Fold',rationale:'A northern approach visits western ground before a lower-bank return. Avoids the long eastern transit and costs less eastern scenery, but leaves the substantial east bank scenic and clusters more opportunities west of the tarn.',corners:[[8,0],[8,5],[2,5],[2,8],[8,8],[8,13],[14,13],[14,15]],bridges:[]},
 'zone-c-meltwater-return':{level:'ice-02',title:'Meltwater Crossing and Return',rationale:'A short northern approach crosses the original meltwater on two wooden deck boxes, then folds through a broad western court and returns below the southern ridge. Bridge-bank investment, western return coverage and a separate southeast catch make different choices.',corners:[[6,0],[6,3],[10,3],[10,9],[5,9],[5,12],[10,12],[10,14],[18,14],[18,15]],bridges:[{id:'meltwater-waist',boxes:[[10,5],[10,6]]}],sites:sites({north:[[5,1],[5,2],[7,1],[7,2],[8,2],[9,2],[11,3],[11,4]],banks:[[9,4],[11,7],[11,8],[9,8],[11,9]],westCourt:[[6,8],[7,8],[8,8],[6,10],[7,10],[8,10],[9,10],[4,10],[4,11],[6,11],[7,11]],southernReturn:[[6,13],[7,13],[8,13],[9,13],[11,12],[11,13],[11,15],[12,15],[13,15],[14,15]],late:[[15,15],[16,15],[17,15],[18,13],[19,14]]})},
 'zone-c-upper-bend-tour':{level:'ice-02',title:'Upper Bend Tour',rationale:'Crosses from southwestern ground and tours the northern bank before a northeast exit. Northern courts gain a larger role, but the entire southern ridge and much lower ground cease to contribute to defence choice.',corners:[[0,11],[5,11],[5,9],[10,9],[10,2],[14,2],[14,3],[17,3],[17,0]],bridges:[{id:'meltwater-waist',boxes:[[10,5],[10,6]]}]},
 'zone-c-ridge-confluence':{level:'ice-03',title:'White Ridge Confluence',rationale:'A long western fold crosses the stream once and meets a distinct northern-bank approach. Shared eastern-corridor coverage leads to a southern catch, preserving the ridge as a backdrop and offering western-only, northern-only and common-tail investments.',corners:[[0,4],[4,4],[4,7],[1,7],[1,10],[5,10],[5,8],[12,8],[12,13],[10,13],[10,15]],additional:[{id:'northern',corners:[[12,0],[12,3],[10,3],[10,6],[12,6],[12,8],[12,13],[10,13],[10,15]]}],bridges:[{id:'white-stream',boxes:[[8,8]]}],sites:sites({westEntry:[[1,3],[2,3],[3,3],[3,5],[5,4],[5,5],[3,6]],westFold:[[2,8],[3,8],[4,8],[2,9],[3,9],[4,9],[0,8],[0,9],[6,9],[6,10]],streamBank:[[6,7],[7,7],[9,7],[10,7],[11,7],[9,9],[10,9],[11,9]],northApproach:[[11,1],[11,2],[13,1],[13,2],[11,4],[11,5],[9,4],[9,5],[13,6],[13,7]],shared:[[13,9],[13,10],[13,11],[11,10],[11,11],[11,12],[13,13]],late:[[11,14],[11,15],[9,14],[9,15],[10,12]]})},
 'zone-c-western-ridge-fold':{level:'ice-03',title:'Western Ridge Fold',rationale:'A completely dry western fold avoids a stream crossing and keeps all eastern ridge scenery intact. Several western returns are useful, but the eastern bank never enters play and it offers no distinct branch investment.',corners:[[0,4],[5,4],[5,8],[2,8],[2,11],[5,11],[5,14],[2,14],[2,15]],bridges:[]},
 'zone-c-sanctuary-fold':{level:'ice-04',title:'Sanctuary and Mere Fold',rationale:'Passes through the clear corridor between the raised sanctuary fragments, returns beside the northern mere shore, then descends east of the western ridge to a separate southern catch. The large southeastern lake stays uninterrupted; two broad internal courts support different contact times.',corners:[[0,6],[8,6],[8,2],[11,2],[11,8],[6,8],[6,14],[9,14],[9,15]],bridges:[],sites:sites({westEntry:[[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[2,7],[3,7],[4,7]],sanctuary:[[7,3],[7,4],[9,3],[9,4],[9,5],[10,3],[10,4],[10,5],[12,3],[12,4],[12,5]],shoreCourt:[[7,7],[8,7],[9,7],[10,7],[10,9],[9,9],[8,9],[7,9],[5,8],[5,9]],southCatch:[[5,11],[5,12],[5,13],[7,11],[7,12],[7,13],[7,15],[8,15],[10,14],[10,15]]})},
 'zone-c-shore-crossing':{level:'ice-04',title:'Sanctuary Shore Crossing',rationale:'The northern entry visits the eastern sanctuary and briefly bridges the lake lip before returning through central and western courts. It uses more eastern scenery and has a more elaborate late fold; the lake crossing adds engineering/scenic cost without creating a stronger independent final catch.',corners:[[10,0],[10,5],[18,5],[18,7],[12,7],[12,8],[8,8],[8,12],[6,12],[6,9],[1,9],[1,15]],bridges:[{id:'sanctuary-lip',boxes:[[15,7],[16,7]]}]},
};
// Tall Tripods reserve a full radius12 volume to Y26.5. These distinct
// second-row courts allow upgraded guns without weakening player clearance.
const gunCourts={
 'zone-c-tarn-circuit':[[2,7],[4,7],[8,4],[12,2],[14,2],[18,6],[18,9],[10,12],[6,14]],
 'zone-c-meltwater-return':[[8,4],[12,8],[3,10],[3,11],[7,14],[8,14],[17,12],[18,12]],
 'zone-c-ridge-confluence':[[1,2],[3,2],[6,5],[6,6],[14,1],[10,10],[10,11],[12,15]],
 'zone-c-sanctuary-fold':[[2,8],[4,8],[5,4],[13,6],[8,11],[10,12]],
};
for(const [id,boxes]of Object.entries(gunCourts))C_OPTIONS[id].sites.push(...sites({gunCourt:boxes}));
for(const option of Object.values(C_OPTIONS))if(!option.sites)option.sites=near(option.corners);
export async function readCBaseline(id){const text=await Bun.file(new URL(C_BASELINE+id+'.json',root)).text();if(digest(text)!==C_HASHES[id])throw new Error('Frozen C baseline hash mismatch: '+id);return JSON.parse(text);}
export function checkCPathEdges(level){
 const [width,length]=level.size,boundary=([x,,z])=>x===0||z===0||x===width-1||z===length-1;
 return levelRoutes(level).map(({id,path})=>{if(path.length<2||!boundary(path[0])||!boundary(path.at(-1))||path.slice(1,-1).some(boundary))throw new Error(level.id+'/'+id+': boundary endpoints/interior rule');return {id,entry:path[0],exit:path.at(-1),boundaryBoxes:2,interiorBoxes:path.length-2,edgeRunningSegments:0};});
}
export async function studyCOption(id){
 const option=C_OPTIONS[id];if(!option)throw new Error('Unknown C option: '+id);
 const before=await readCBaseline(option.level),level=structuredClone(before),field=new TerrainField(before);level.path=expandCorners(option.corners);level.previewMode='layout';
 if(option.additional)level.routes=option.additional.map(r=>({id:r.id,path:expandCorners(r.corners)}));
 if(option.bridges.length)level.bridges=structuredClone(option.bridges);
 const allPath=pathBoxUnion(level),pathKeys=new Set(allPath.map(([x,,z])=>`${x},${z}`)),clear=new Map(allPath.map(([x,,z])=>[`${x},${z}`,'continuous supported route travel'])),perches=new Set(before.previewWildlife.perches.map(p=>p.id)),perchBoxes=new Set(before.placements.filter(p=>perches.has(p.id)).map(p=>`${p.box[0]},${p.box[2]}`));
 const rejectedSites=[],candidateSites=[];
 for(const site of option.sites){const key=site.box.join(',');if(pathKeys.has(key)||field.flatBox(...site.box)!==24||perchBoxes.has(key)){rejectedSites.push({...site,reason:pathKeys.has(key)?'route box':perchBoxes.has(key)?'original supported bird perch':'not flat dry path-height ground'});continue;}candidateSites.push(site);clear.set(key,'full defence-ground footprint: '+site.group);}
 const removed=[];level.placements=level.placements.filter(p=>{const reason=clear.get(`${p.box[0]},${p.box[2]}`);if(!reason)return true;removed.push({...structuredClone(p),reason});return false;});
 const models=await auditModels(level);for(const model of ['arc-spire','missile-launcher','guided-missile'])models.set(model,await Bun.file(new URL(`../assets/models/${model}.json`,import.meta.url)).json());
 const initial=reviewPlacementVisibility(level,candidateSites,models),blockers=new Map();
 const hidden=initial.sites.filter(s=>s.obstructions.some(b=>b.id==='terrain'||perches.has(b.id)));
 const hiddenIds=new Set(hidden.map(s=>s.id)),finalSites=candidateSites.filter(s=>!hiddenIds.has(s.id));
 for(const s of hidden)rejectedSites.push({...candidateSites.find(c=>c.id===s.id),reason:'normal-overview obstruction from retained terrain/perch',obstructions:s.obstructions.filter(b=>b.id==='terrain'||perches.has(b.id)).map(b=>b.id)});
 // Restore rejected plots before the final visibility carve. Rejected dry
 // ground is not intentionally cleared and then described as unavailable.
 const finalKeys=new Set(finalSites.map(s=>s.box.join(',')));
 for(let i=removed.length-1;i>=0;i--){const p=removed[i],key=`${p.box[0]},${p.box[2]}`;if(!pathKeys.has(key)&&!finalKeys.has(key))removed.splice(i,1);}
 const retainedRemovalIds=new Set(removed.map(p=>p.id));level.placements=before.placements.filter(p=>!retainedRemovalIds.has(p.id));
 const finalVisibility=reviewPlacementVisibility(level,finalSites,models);
 for(const site of finalVisibility.sites)for(const block of site.obstructions){if(block.id==='terrain'||perches.has(block.id))throw new Error(id+' restored ground makes '+site.id+' hidden by retained '+block.id);if(!blockers.has(block.id))blockers.set(block.id,[]);blockers.get(block.id).push(site.id);}
 level.placements=level.placements.filter(p=>{if(!blockers.has(p.id))return true;removed.push({...structuredClone(p),reason:'full placement-ground overview visibility: '+blockers.get(p.id).join(', ')});return false;});
 const lostPerches=before.previewWildlife.perches.filter(p=>!level.placements.some(q=>q.id===p.id));
 if(lostPerches.length)throw new Error(id+' removes existing perch '+lostPerches.map(p=>p.id).join(','));
 if(C_WILDLIFE_SEED_REVISIONS[id]){level.previewWildlife.habitatPoints=C_WILDLIFE_SEED_REVISIONS[id].map(p=>[...p]);level.previewWildlife.habitats=level.previewWildlife.habitatPoints.map(([x,,z])=>[Math.floor(x/24),Math.floor(z/24)]);}
 validateLevel(level,models);const edges=checkCPathEdges(level);
 const sourceText=JSON.stringify(level,null,2)+'\n',manifest={id,level:level.id,title:option.title,baseline:{path:C_BASELINE+option.level+'.json',sha256:C_HASHES[option.level]},sourceHash:digest(sourceText),rationale:option.rationale,corners:option.corners,additional:option.additional??[],sites:finalSites,rejectedSites,bridges:option.bridges,routes:levelRoutes(level).map(r=>({id:r.id,boxes:r.path.length,length:(r.path.length-1)*24})),edges,unionPathBoxes:allPath.length,baselinePlacements:before.placements.length,retainedPlacements:level.placements.length,removed,added:[],moved:[],terrainChanged:false,environmentChanged:false,lostPerches,previewWildlife:level.previewWildlife,validationStatus:'Comparison source; production route, weapons, roaming and visual evidence is separate.'};
 return {level,manifest,models,sites:finalSites};
}
if(import.meta.main)for(const id of process.argv.slice(2).length?process.argv.slice(2):Object.keys(C_OPTIONS)){
 const {level,manifest}=await studyCOption(id);await Bun.write(new URL(id+'.level.json',C_OUT),JSON.stringify(level,null,2)+'\n');await Bun.write(new URL(id+'.manifest.json',C_OUT),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({id,level:level.id,routes:manifest.routes,sites:manifest.sites.length,rejected:manifest.rejectedSites.map(s=>({id:s.id,reason:s.reason})),retained:manifest.retainedPlacements,removedWalls:manifest.removed.filter(p=>p.model==='ochre-wall').map(p=>p.id)}));
}
