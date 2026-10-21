// B1–B4 comparative studies. Production sources and frozen baselines are never
// written by this script. Full plots are authoring alternatives, not build pads.
import {createHash} from 'node:crypto';
import {expandCorners} from './level-rebuild-layouts.js';
import {auditModels} from './level-layout-audit.js';
import {reviewPlacementVisibility} from './verify-zone-a-four-visibility.js';
import {TerrainField} from '../shared/terrain.js';
import {validateLevel} from '../shared/level.js';
import {levelRoutes,pathBoxUnion} from '../shared/routes.js';

export const B_OUT=new URL('../docs/zone-b-path-carving-2026-10-19/',import.meta.url);
export const B_BASELINE='backups/pre-path-carving-2026-10-18T17-00-34-263Z/assets/levels/';
export const B_HASHES={
 'ochre-01':'28e86a6bbd2c799f27e9bf26fad13fc262aa4feeff3eb77bf6aaf79918729bad',
 'ochre-02':'57962943a43dd2ad6cf6c728ac93f45296426b9f952beb0733d1085b09beeebe',
 'ochre-03':'ecd3302afda1cc3f7b0b0126ae9aa2d41f4b10027c9a3a834c7420ea13147f71',
 'ochre-04':'a6fc00d9feab604eb45502fc4120e96116fe845c0bdea93ded4e3642c9b49cc6',
};
export const digest=text=>createHash('sha256').update(text).digest('hex');
// Actual-nav corrections from the independent six-actor runtime probe. Each
// selected preview keeps three lizards/three birds and all original perches.
export const B_WILDLIFE_SEED_REVISIONS={
 'cistern-mesa-circuit':[[430,24,282],[26,24,70],[138,24,362]],
 'riverfold-crossing':[[454,24,342],[26,24,126],[74,24,358]],
 'mesa-confluence':[[454,24,334],[50,24,150],[426,24,126]],
 'aqueduct-shore-tour':[[454,24,358],[238,24,118],[70,24,378]],
};
const root=new URL('../',import.meta.url);
const sites=groups=>Object.entries(groups).flatMap(([group,boxes])=>boxes.map(box=>({id:`${group.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}-${box[0]}-${box[1]}`,group,box})));
export const B_OPTIONS={
 'cistern-mesa-circuit':{
  level:'ochre-01',title:'Cistern and Mesa Circuit',
  rationale:'The west entry bends around a small early court, returns north beside the cistern aqueduct, crosses the central dry garden and circles the eastern mesa before a separate southern catch. The two raised mesa islands and small cistern remain intact scenery. North/central firing choices trade against a longer eastern exposure and a late southern return.',
  corners:[[0,5],[3,5],[3,7],[7,7],[7,2],[10,2],[10,5],[15,5],[15,12],[7,12],[7,15]],bridges:[],
  sites:sites({entry:[[1,4],[2,4],[1,6],[2,6],[4,5],[4,6],[5,6],[6,6]],northReturn:[[6,3],[6,4],[6,5],[8,3],[8,4],[8,5],[8,6],[9,4]],upperMesa:[[11,4],[12,4],[13,4],[14,4],[14,6],[16,5],[16,6],[16,7]],eastCourt:[[14,8],[14,9],[14,10],[14,11],[16,9],[16,10],[16,11]],southReturn:[[8,11],[9,11],[10,11],[8,13],[9,13],[10,13],[11,13],[13,13],[14,13]],late:[[6,13],[6,14],[8,14],[8,15]]}),
 },
 'southern-mesa-return':{
  level:'ochre-01',title:'Southern Mesa Return',
  rationale:'A west entry skirts the southwestern mesa, turns through a southern court and returns north between the two raised islands. An eastern ascent and long eastern descent lead to a southeast exit. The southern landform has a stronger role, while the cistern and northern aqueduct stay remote scenery and the eastern side receives a long uninterrupted exposure.',
  corners:[[0,7],[7,7],[7,12],[9,12],[9,5],[15,5],[15,2],[18,2],[18,12],[16,12],[16,15]],bridges:[],
  sites:sites({west:[[1,6],[2,6],[3,6],[4,6],[5,6],[5,8],[7,8],[7,9],[7,10],[7,11]],southReturn:[[5,12],[5,13],[6,13],[7,13],[8,13],[8,11]],central:[[8,6],[8,7],[8,8],[8,9],[10,6],[10,7]],northEast:[[14,3],[14,4],[16,3],[16,4],[17,3],[17,4]],eastReturn:[[16,6],[16,7],[17,6],[17,7],[17,8],[17,9],[17,10],[17,11]],late:[[15,13],[15,14],[17,13],[17,14],[17,15]]}),
 },
 'riverfold-crossing':{
  level:'ochre-02',title:'Riverfold Crossing',
  rationale:'The western bank first curls through a dry lower court. One short straight crossing at the river waist introduces the eastern bank, whose northern court and eastern return lead around the raised aqueduct to an independent southern catch. The winding river remains a continuous dominant feature and the aqueduct fragments remain on their original raised ground.',
  corners:[[0,7],[3,7],[3,10],[5,10],[5,6],[10,6],[10,3],[15,3],[15,8],[18,8],[18,13],[14,13],[14,15]],bridges:[{id:'river-waist',boxes:[[6,6],[7,6]]}],
  sites:sites({westCourt:[[1,6],[2,6],[2,8],[2,9],[2,10],[4,7],[4,8],[4,9],[4,11],[5,11]],crossing:[[5,5],[9,5],[9,6],[9,7],[10,7],[11,6]],northCourt:[[11,3],[11,4],[12,4],[13,4],[14,4],[14,5],[16,4],[16,5]],eastReturn:[[14,6],[14,7],[16,7],[16,8],[16,9],[17,9],[17,10],[17,11],[17,12],[19,10],[19,11]],late:[[15,12],[15,14],[16,14],[17,14],[13,14],[13,15]]}),
 },
 'aqueduct-confluence':{
  level:'ochre-02',title:'Aqueduct Confluence',
  rationale:'A longer western approach visits the lower bank and upper aqueduct before a two-box bridge; a shorter northeastern approach curls through its own dry court. They meet east of the river and share a late southeast return. This creates bank/branch investment choices, at the cost of a larger western scenic carve and uneven approach lengths.',
  corners:[[0,13],[4,13],[4,9],[2,9],[2,6],[5,6],[5,4],[11,4],[11,7],[14,7],[14,9],[17,9],[17,13],[14,13],[14,15]],
  additional:[{id:'eastern',corners:[[19,3],[16,3],[16,5],[18,5],[18,7],[14,7],[14,9],[17,9],[17,13],[14,13],[14,15]]}],bridges:[{id:'aqueduct-crossing',boxes:[[7,4],[8,4]]}],
  sites:sites({westEntry:[[1,14],[2,14],[3,14],[5,13],[5,12],[3,11],[3,10]],westReturn:[[1,7],[1,8],[3,7],[3,8],[4,7],[4,8],[4,5],[6,4]],eastEntry:[[17,2],[18,2],[17,4],[18,4],[17,5]],eastReturn:[[15,5],[15,6],[15,7],[16,7],[18,8]],shared:[[12,5],[12,6],[12,7],[13,6],[13,8],[15,8],[15,9],[16,10],[16,11],[16,12],[18,10],[18,11],[18,12]],late:[[15,12],[15,14],[16,14],[13,14],[13,15]]}),
 },
 'three-mesa-tour':{
  level:'ochre-03',title:'Three Mesa Tour',
  rationale:'One long journey returns north around the western mesa, passes the small northern pool and skirts the lower face of the eastern mesa. It then descends the east and circles the southern mesa before a southwestern catch. It engages the greatest depth of the landscape, with a substantial scenic cost and delayed repeated encounters.',
  corners:[[0,8],[5,8],[5,6],[6,6],[6,1],[9,1],[9,5],[14,5],[14,8],[17,8],[17,14],[8,14],[8,11],[5,11],[5,15]],bridges:[],
  sites:sites({west:[[1,7],[2,7],[3,7],[4,7],[4,9],[4,10],[6,7],[6,8],[6,9]],northReturn:[[7,3],[7,4],[7,5],[9,6],[10,5],[10,6],[11,5]],eastMesa:[[12,5],[12,6],[13,6],[13,7],[15,6],[15,7],[16,8],[17,7]],eastReturn:[[17,9],[17,10],[17,11],[17,12],[17,13],[19,10],[19,11],[19,12]],southReturn:[[9,10],[10,10],[9,11],[9,12],[9,13],[10,14],[10,15],[12,14],[13,14],[14,14]],late:[[6,11],[6,12],[6,14],[6,15],[4,13],[4,14]]}),
 },
 'mesa-confluence':{
  level:'ochre-03',title:'Mesa Confluence',
  rationale:'A western approach bends through a broad central court while an eastern approach wraps below the northeastern mesa and aqueduct. They meet east of the southern mesa, then circle it through a southern return and independent southwest catch. Western-only, eastern-only and shared investments stay spatially distinct without turning every junction into one compact dominant court.',
  corners:[[0,8],[5,8],[5,6],[8,6],[8,9],[16,9],[16,14],[8,14],[8,11],[5,11],[5,15]],
  additional:[{id:'eastern',corners:[[19,5],[18,5],[18,7],[17,7],[17,9],[16,9],[16,14],[8,14],[8,11],[5,11],[5,15]]}],bridges:[],
  sites:sites({westEntry:[[1,7],[2,7],[3,7],[4,7],[4,9],[4,10],[6,7],[6,8]],westReturn:[[6,5],[7,5],[7,7],[7,8],[7,9],[9,7],[9,8],[10,8]],eastEntry:[[17,5],[17,6],[19,6],[19,7]],eastReturn:[[16,6],[17,8],[17,9],[14,7],[14,8]],shared:[[13,8],[12,8],[11,8],[10,10],[11,10],[12,10],[13,10],[15,10],[15,11],[15,12],[15,13]],southReturn:[[9,12],[9,13],[9,14],[10,14],[10,15],[12,14],[13,14],[14,14]],late:[[6,11],[6,12],[6,14],[6,15],[4,13],[4,14]]}),
 },
 'aqueduct-shore-tour':{
  level:'ochre-04',title:'Aqueduct and Shore Tour',
  rationale:'A northern entrance runs down the dry eastern mainland, turns around the broken aqueduct, then returns along the indented eastern lake shore. A lower court and southeast turn supply a distinct final catch. The broad western lake remains uninterrupted; the raised northern and southeastern mesas remain landmarks rather than roads.',
  corners:[[15,0],[15,5],[17,5],[17,8],[11,8],[11,11],[13,11],[13,14],[18,14],[18,15]],bridges:[],
  sites:sites({northEntry:[[14,1],[14,2],[14,3],[14,4],[16,1],[16,2],[16,3],[16,4]],aqueduct:[[18,4],[18,5],[18,6],[16,8],[15,8]],shoreReturn:[[10,6],[10,7],[11,6],[12,6],[12,7],[13,7],[12,9],[12,10],[10,10],[10,11]],lowerCourt:[[10,12],[11,12],[12,12],[12,13],[12,14],[14,12],[14,13],[14,14]],late:[[14,15],[15,15],[16,15],[17,15],[18,13],[19,14]]}),
 },
 'basin-confluence':{
  level:'ochre-04',title:'Basin Confluence',
  rationale:'A northeastern approach descends the mainland while a southern approach climbs the lake shore, meeting beside the aqueduct before one shared lower court and southeast exit. This offers early branch-specific choices on constrained land, but concentrates more coverage around the common shore junction and uses less of the northern dry entry.',
  corners:[[19,4],[14,4],[14,8],[12,8],[12,11],[13,11],[13,14],[18,14],[18,15]],
  additional:[{id:'southern',corners:[[9,15],[9,13],[10,13],[10,6],[12,6],[12,8],[12,11],[13,11],[13,14],[18,14],[18,15]]}],bridges:[],
  sites:sites({eastEntry:[[16,3],[17,3],[18,3],[15,4],[15,5],[15,6],[13,5],[13,6],[13,7]],shoreEntry:[[9,14],[8,15],[11,14],[11,13],[11,12],[9,11],[9,10],[11,10],[11,9],[11,8],[11,7]],junction:[[12,5],[13,8],[13,9],[13,10],[14,9],[14,10]],lowerCourt:[[12,12],[12,13],[12,14],[14,12],[14,13],[14,14]],late:[[14,15],[15,15],[16,15],[17,15],[18,13],[19,14]]}),
 },
};

export async function readBBaseline(id){const text=await Bun.file(new URL(B_BASELINE+id+'.json',root)).text();if(digest(text)!==B_HASHES[id])throw new Error('Frozen B baseline hash mismatch: '+id);return JSON.parse(text);}
export function checkBPathEdges(level){
 const [width,length]=level.size,boundary=([x,,z])=>x===0||z===0||x===width-1||z===length-1;
 return levelRoutes(level).map(({id,path})=>{if(path.length<2||!boundary(path[0])||!boundary(path.at(-1))||path.slice(1,-1).some(boundary))throw new Error(level.id+'/'+id+': boundary endpoints/interior rule');return {id,entry:path[0],exit:path.at(-1),boundaryBoxes:2,interiorBoxes:path.length-2,edgeRunningSegments:0};});
}
export async function studyBOption(id){
 const option=B_OPTIONS[id];if(!option)throw new Error('Unknown B option: '+id);
 const before=await readBBaseline(option.level),level=structuredClone(before),field=new TerrainField(before);level.path=expandCorners(option.corners);level.previewMode='layout';
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
 if(B_WILDLIFE_SEED_REVISIONS[id]){level.previewWildlife.habitatPoints=B_WILDLIFE_SEED_REVISIONS[id].map(p=>[...p]);level.previewWildlife.habitats=level.previewWildlife.habitatPoints.map(([x,,z])=>[Math.floor(x/24),Math.floor(z/24)]);}
 validateLevel(level,models);const edges=checkBPathEdges(level);
 const sourceText=JSON.stringify(level,null,2)+'\n',manifest={id,level:level.id,title:option.title,baseline:{path:B_BASELINE+option.level+'.json',sha256:B_HASHES[option.level]},sourceHash:digest(sourceText),rationale:option.rationale,corners:option.corners,additional:option.additional??[],sites:finalSites,rejectedSites,bridges:option.bridges,routes:levelRoutes(level).map(r=>({id:r.id,boxes:r.path.length,length:(r.path.length-1)*24})),edges,unionPathBoxes:allPath.length,baselinePlacements:before.placements.length,retainedPlacements:level.placements.length,removed,added:[],moved:[],terrainChanged:false,environmentChanged:false,lostPerches,previewWildlife:level.previewWildlife,validationStatus:'Comparison source; production route, weapons, roaming and visual evidence is separate.'};
 return {level,manifest,models,sites:finalSites};
}
if(import.meta.main)for(const id of process.argv.slice(2).length?process.argv.slice(2):Object.keys(B_OPTIONS)){
 const {level,manifest}=await studyBOption(id);await Bun.write(new URL(id+'.level.json',B_OUT),JSON.stringify(level,null,2)+'\n');await Bun.write(new URL(id+'.manifest.json',B_OUT),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({id,level:level.id,routes:manifest.routes,sites:manifest.sites.length,rejected:manifest.rejectedSites.map(s=>({id:s.id,reason:s.reason})),retained:manifest.retainedPlacements,removedWalls:manifest.removed.filter(p=>p.model==='ochre-wall').map(p=>p.id)}));
}
