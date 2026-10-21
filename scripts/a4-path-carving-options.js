// A4-only comparative studies. Active sources and the frozen backup are never
// written here; a selected deterministic factory is added after review.
import {createHash} from 'node:crypto';
import {expandCorners} from './level-rebuild-layouts.js';
import {auditModels} from './level-layout-audit.js';
import {reviewPlacementVisibility} from './verify-zone-a-four-visibility.js';
import {TerrainField} from '../shared/terrain.js';
export const A4_BASELINE='backups/pre-path-carving-2026-10-18T17-00-34-263Z/assets/levels/moss-04.json';
export const A4_BASELINE_SHA256='c424dbe1c62a5e1d593de17bd10fe43eea0a3ade8e06188edaaee600cfde49f0';
export const digest=text=>createHash('sha256').update(text).digest('hex');
const root=new URL('../',import.meta.url),sites=groups=>Object.entries(groups).flatMap(([group,boxes])=>boxes.map(box=>({id:`${group.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}-${box[0]}-${box[1]}`,group,box})));
export const A4_OPTIONS={
 'ruin-and-mere-tour':{
  title:'Ruin and Mere Tour',
  rationale:'A dry western entrance curls around the southwest limestone garden, rises through the wooded western interior and passes the central masonry. A lower-shore encounter then turns around an eastern court before returning beside the southeastern knoll to a separate southern catch. The lake remains uninterrupted scenery, while the route visits both ruin settings and several differently shaped courts.',
  corners:[[0,9],[3,9],[3,12],[7,12],[7,5],[10,5],[10,8],[12,8],[12,7],[17,7],[17,9],[13,9],[13,13],[10,13],[10,15]],
  bridges:[],
  sites:sites({
   southwest:[[1,10],[2,10],[2,11],[4,9],[4,10],[5,9],[5,10],[6,9],[6,10],[6,11]],
   westReturn:[[6,6],[6,7],[6,8],[8,9],[8,10],[8,11],[8,12]],
   masonry:[[8,4],[9,4],[10,4],[11,5]],
   shoreCourt:[[13,8],[14,8],[15,8],[16,8],[18,8],[18,9],[18,10]],
   southReturn:[[11,9],[12,9],[12,10],[11,11],[12,11],[11,12],[12,12]],
   late:[[9,13],[9,14],[10,12],[11,14],[11,15]],
  }),
 },
 'northern-crossing':{
  title:'Northern Crossing',
  rationale:'A western entrance climbs from the southwest garden into a broad northern woodland court, then crosses the narrower upper part of the mere. The eastern bank bends down toward a central return below the masonry and a southern exit. This makes the lake crossing the transition between early western and late eastern/southern opportunities, at the cost of a more exposed upper shore and a bank-range gap over water.',
  corners:[[0,11],[2,11],[2,8],[6,8],[6,4],[9,4],[9,2],[17,2],[17,5],[18,5],[18,9],[12,9],[12,12],[9,12],[9,15]],
  bridges:[{id:'upper-mere-crossing',boxes:[[12,2],[13,2],[14,2],[15,2]]}],
  sites:sites({
   southwest:[[1,10],[1,9],[3,10],[3,9],[4,9],[5,9],[5,10]],
   westReturn:[[5,5],[5,6],[5,7],[7,5],[7,6],[7,7],[7,8]],
   northCourt:[[7,3],[8,3],[8,2],[8,1],[9,1],[10,1],[10,3],[10,4]],
   eastBank:[[18,2],[18,3],[18,4],[19,5],[17,6],[17,7],[17,8],[16,8]],
   southReturn:[[13,8],[14,8],[15,8],[13,10],[11,10],[11,11],[10,11],[10,10]],
   late:[[10,13],[10,14],[8,13],[8,14],[9,11]],
  }),
 },
};
export async function readA4Baseline(){const text=await Bun.file(new URL(A4_BASELINE,root)).text();if(digest(text)!==A4_BASELINE_SHA256)throw new Error('Frozen A4 hash mismatch.');return JSON.parse(text);}
export async function studyA4Option(id){
 const option=A4_OPTIONS[id];if(!option)throw new Error('Unknown A4 option: '+id);
 const before=await readA4Baseline(),level=structuredClone(before),field=new TerrainField(before);level.path=expandCorners(option.corners);level.previewMode='layout';if(option.additional)level.routes=option.additional.map(route=>({id:route.id,path:expandCorners(route.corners)}));if(option.bridges.length)level.bridges=structuredClone(option.bridges);
 const allPath=[level.path,...(level.routes??[]).map(r=>r.path)].flat(),bridgeBoxes=new Set(option.bridges.flatMap(b=>b.boxes.map(p=>p.join(',')))),pathBoxes=new Set(allPath.map(([x,,z])=>`${x},${z}`)),clear=new Map(allPath.map(([x,,z])=>[`${x},${z}`,'continuous supported route travel']));
 for(const site of option.sites){const key=site.box.join(',');if(pathBoxes.has(key)||bridgeBoxes.has(key)||field.flatBox(...site.box)!==24)throw new Error(id+' invalid candidate: '+key);clear.set(key,'full defence-ground footprint: '+site.group);}
 const removed=[];level.placements=level.placements.filter(p=>{const reason=clear.get(`${p.box[0]},${p.box[2]}`);if(!reason)return true;removed.push({...structuredClone(p),reason});return false;});
 const models=await auditModels(level);models.set('arc-spire',await Bun.file(new URL('../assets/models/arc-spire.json',import.meta.url)).json());
 const initial=reviewPlacementVisibility(level,option.sites,models),blockers=new Map();
 const hiddenByTerrain=initial.sites.filter(s=>s.obstructions.some(b=>b.id==='terrain')).map(s=>s.id);
 if(hiddenByTerrain.length)throw new Error(id+' terrain obscures '+hiddenByTerrain.join(', '));
 for(const site of initial.sites)for(const block of site.obstructions){if(!blockers.has(block.id))blockers.set(block.id,[]);blockers.get(block.id).push(site.id);}
 level.placements=level.placements.filter(p=>{if(!blockers.has(p.id))return true;removed.push({...structuredClone(p),reason:'full placement-ground overview visibility: '+blockers.get(p.id).join(', ')});return false;});
 const lostPerches=before.previewWildlife.perches.filter(p=>!level.placements.some(q=>q.id===p.id));
 const manifest={id,baseline:{path:A4_BASELINE,sha256:A4_BASELINE_SHA256},rationale:option.rationale,corners:option.corners,additional:option.additional??[],sites:option.sites,bridges:option.bridges,routeLength:(level.path.length-1)*24,routes:[{id:'main',length:(level.path.length-1)*24},...(level.routes??[]).map(r=>({id:r.id,length:(r.path.length-1)*24}))],baselinePlacements:before.placements.length,retainedPlacements:level.placements.length,removed,added:[],moved:[],terrainChanged:false,lostPerches,previewWildlife:level.previewWildlife,validationStatus:'Comparison source; separate selected-option reports contain production route/weapon/visibility evidence.'};
 return {level,manifest,models,sites:option.sites};
}
if(import.meta.main)for(const id of process.argv.slice(2).length?process.argv.slice(2):Object.keys(A4_OPTIONS)){
 const {level,manifest}=await studyA4Option(id),folder=new URL('../docs/a4-path-carving-2026-10-18/',import.meta.url);
 await Bun.write(new URL(id+'.level.json',folder),JSON.stringify(level,null,2)+'\n');await Bun.write(new URL(id+'.manifest.json',folder),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({id,routeLength:manifest.routeLength,sites:manifest.sites.length,retained:manifest.retainedPlacements,lostPerches:manifest.lostPerches,removedRuins:manifest.removed.filter(p=>p.model.includes('ruin')).map(p=>p.id)}));
}
