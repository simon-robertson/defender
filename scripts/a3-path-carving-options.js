// A3-only comparative studies. Active sources and the frozen backup are never
// written here; a selected deterministic factory is added after review.
import {createHash} from 'node:crypto';
import {expandCorners} from './level-rebuild-layouts.js';
import {auditModels} from './level-layout-audit.js';
import {reviewPlacementVisibility} from './verify-zone-a-four-visibility.js';
import {TerrainField} from '../shared/terrain.js';
export const A3_BASELINE='backups/pre-path-carving-2026-10-18T17-00-34-263Z/assets/levels/moss-03.json';
export const A3_BASELINE_SHA256='5cf9498a92440b1696d0edcfab667979532e8c03d99725c0ab6918c9409284cc';
export const digest=text=>createHash('sha256').update(text).digest('hex');
const root=new URL('../',import.meta.url),sites=groups=>Object.entries(groups).flatMap(([group,boxes])=>boxes.map(box=>({id:`${group.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}-${box[0]}-${box[1]}`,group,box})));
export const A3_OPTIONS={
 'single-west-return':{
  title:'Single Western Return',
  rationale:'A western entry passes below the cypress rise and returns through the garden, then follows the limestone approach to a quiet one-cell stream bridge. A separate eastern-bank loop supplies later repeated contact and a northeastern exit, keeping the lower orchard and southern ruin as scenery.',
  corners:[[0,10],[5,10],[5,5],[7,5],[7,8],[11,8],[11,4],[16,4],[16,7],[18,7],[18,2],[19,2]],
  bridges:[{id:'upper-stream-crossing',boxes:[[12,4]]}],
  sites:sites({
   entry:[[2,11],[3,11],[4,11]],
   westReturn:[[6,6],[6,7],[6,8],[6,9],[6,10]],
   limestone:[[6,4],[8,7],[9,7],[10,7]],
   approach:[[10,5],[10,6],[10,9],[12,6],[12,7],[13,3]],
   eastReturn:[[15,5],[15,6],[15,7],[17,4],[17,5],[17,6],[16,8],[17,8],[18,8]],
   late:[[17,2],[17,3],[18,1],[19,1],[19,3]],
  }),
 },
 'garden-confluence':{
  title:'Garden Confluence',
  rationale:'A western approach returns through the cypress-side garden while a northeastern approach bends across a quieter bank and short stream bridge. They meet on dry ground before a shared southern meadow and limestone-side exit. Branch-specific early choices trade against a common later court without forcing the stream or raised knolls to change.',
  corners:[[0,11],[5,11],[5,5],[7,5],[7,8],[12,8],[12,11],[10,11],[10,14],[12,14],[12,15]],
  additional:[{id:'eastern',corners:[[19,3],[16,3],[16,6],[18,6],[18,8],[12,8],[12,11],[10,11],[10,14],[12,14],[12,15]]}],
  bridges:[{id:'lower-stream-crossing',boxes:[[14,8]]}],
  sites:sites({
   westEntry:[[1,12],[2,12],[3,12],[4,12],[4,10],[6,11]],
   westReturn:[[6,6],[6,7],[6,8],[6,9],[6,10],[7,9],[8,9],[9,9]],
   limestone:[[6,4],[8,7],[9,7],[10,7]],
   eastEntry:[[17,2],[18,2],[17,4],[18,4],[17,5]],
   eastReturn:[[17,7],[16,7],[15,6],[15,7],[19,7],[19,8],[18,9],[17,9],[16,9]],
   sharedCourt:[[11,9],[11,10],[10,10],[11,12],[11,13],[12,13],[9,12],[9,13]],
   late:[[9,14],[10,15],[11,15],[13,15]],
  }),
 },
};
export async function readA3Baseline(){const text=await Bun.file(new URL(A3_BASELINE,root)).text();if(digest(text)!==A3_BASELINE_SHA256)throw new Error('Frozen A3 hash mismatch.');return JSON.parse(text);}
export async function studyA3Option(id){
 const option=A3_OPTIONS[id];if(!option)throw new Error('Unknown A3 option: '+id);
 const before=await readA3Baseline(),level=structuredClone(before),field=new TerrainField(before);level.path=expandCorners(option.corners);level.previewMode='layout';if(option.additional)level.routes=option.additional.map(route=>({id:route.id,path:expandCorners(route.corners)}));level.bridges=structuredClone(option.bridges);
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
 const manifest={id,baseline:{path:A3_BASELINE,sha256:A3_BASELINE_SHA256},rationale:option.rationale,corners:option.corners,additional:option.additional??[],sites:option.sites,bridges:option.bridges,routeLength:(level.path.length-1)*24,routes:[{id:'main',length:(level.path.length-1)*24},...(level.routes??[]).map(r=>({id:r.id,length:(r.path.length-1)*24}))],baselinePlacements:before.placements.length,retainedPlacements:level.placements.length,removed,added:[],moved:[],terrainChanged:false,lostPerches,previewWildlife:level.previewWildlife,validationStatus:'Comparison source; separate selected-option reports contain production route/weapon/visibility evidence.'};
 return {level,manifest,models,sites:option.sites};
}
if(import.meta.main)for(const id of process.argv.slice(2).length?process.argv.slice(2):Object.keys(A3_OPTIONS)){
 const {level,manifest}=await studyA3Option(id),folder=new URL('../docs/a3-path-carving-2026-10-18/',import.meta.url);
 await Bun.write(new URL(id+'.level.json',folder),JSON.stringify(level,null,2)+'\n');await Bun.write(new URL(id+'.manifest.json',folder),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({id,routeLength:manifest.routeLength,sites:manifest.sites.length,retained:manifest.retainedPlacements,lostPerches:manifest.lostPerches,removedRuins:manifest.removed.filter(p=>p.model.includes('ruin')).map(p=>p.id)}));
}
