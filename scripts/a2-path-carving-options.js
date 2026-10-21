// A2-only comparative studies. Active sources and the frozen backup are never
// written here; a selected deterministic factory is added after review.
import {createHash} from 'node:crypto';
import {expandCorners} from './level-rebuild-layouts.js';
import {auditModels} from './level-layout-audit.js';
import {reviewPlacementVisibility} from './verify-zone-a-four-visibility.js';
import {TerrainField} from '../shared/terrain.js';
export const A2_BASELINE='backups/pre-path-carving-2026-10-18T17-00-34-263Z/assets/levels/moss-02.json';
export const A2_BASELINE_SHA256='cb5b95b09a450a34cd25ee533ed20ff3a90128824532be9a06d187fcf83f694a';
export const digest=text=>createHash('sha256').update(text).digest('hex');
const root=new URL('../',import.meta.url),sites=groups=>Object.entries(groups).flatMap(([group,boxes])=>boxes.map(box=>({id:`${group.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}-${box[0]}-${box[1]}`,group,box})));
export const A2_OPTIONS={
 'garden-crossing':{
  title:'Garden Crossing',
  rationale:'A western return leads past the limestone garden and lower grove, then crosses the broad middle of the lake. A short eastern-bank turn descends into a separate southern shoreline court and exit. The bridge separates meaningful western and eastern/southern decisions while leaving open water above and below.',
  corners:[[0,7],[4,7],[4,3],[6,3],[6,9],[9,9],[9,8],[17,8],[17,10],[15,10],[15,13],[11,13],[11,15]],
  bridges:[{id:'garden-crossing',boxes:[[11,8],[12,8],[13,8],[14,8],[15,8],[16,8]]}],
  sites:sites({
   entry:[[1,6],[2,6],[3,6],[3,5],[3,4]],
   westReturn:[[5,4],[5,5],[5,6],[5,7],[5,8]],
   garden:[[7,4],[7,5],[7,8],[8,8],[7,10],[8,10],[9,10],[9,7]],
   eastLanding:[[17,7],[18,7],[18,8],[18,9],[16,9]],
   southCourt:[[16,11],[16,12],[14,12],[14,14],[13,14],[12,14]],
   late:[[10,14],[10,15],[12,15]],
  }),
 },
 'lower-arm':{
  title:'Lower Arm',
  rationale:'A northern gateway folds through the western garden before crossing the lake’s lower arm. The route then climbs the narrow eastern bank to a northeastern exit, distinguishing a broad western deployment area from constrained shoreline and final interception choices.',
  corners:[[5,0],[5,4],[3,4],[3,7],[6,7],[6,10],[17,10],[17,6],[18,6],[18,2],[19,2]],
  bridges:[{id:'lower-arm-crossing',boxes:[[10,10],[11,10],[12,10],[13,10],[14,10]]}],
  sites:sites({
   north:[[4,1],[4,2],[4,3]],
   westCourt:[[2,4],[2,5],[2,6],[2,7],[4,5],[4,6],[5,5],[5,6]],
   approach:[[5,8],[5,9],[7,8],[7,9],[7,11],[8,11],[9,11],[8,9],[9,9],[10,11]],
   eastBank:[[16,9],[16,11],[17,11],[18,11],[18,10],[18,9],[18,8]],
   late:[[17,4],[17,3],[17,2],[18,1],[19,3],[19,1]],
  }),
 },
 'northern-reach':{
  title:'Northern Reach',
  rationale:'A western meadow return approaches the upper limestone garden, then crosses the northern lake reach. The eastern bank descends to a short east-facing exit. Most open water remains south of the bridge; western repeat-coverage courts carry more of the tactical interest than the narrow later bank.',
  corners:[[0,5],[3,5],[3,8],[6,8],[6,4],[9,4],[9,3],[17,3],[17,7],[19,7]],
  bridges:[{id:'northern-reach-crossing',boxes:[[11,3],[12,3],[13,3],[14,3],[15,3],[16,3]]}],
  sites:sites({
   entry:[[1,4],[2,4],[2,6],[2,7]],
   westReturn:[[3,9],[4,9],[5,9],[4,7],[5,7],[5,6],[5,5],[5,4]],
   garden:[[7,5],[8,5],[7,3],[8,3],[8,2],[9,2]],
   eastLanding:[[17,2],[18,2],[18,3],[18,4]],
   late:[[18,5],[18,6],[17,8],[18,8],[19,8],[19,6]],
  }),
 },
};
export async function readA2Baseline(){const text=await Bun.file(new URL(A2_BASELINE,root)).text();if(digest(text)!==A2_BASELINE_SHA256)throw new Error('Frozen A2 hash mismatch.');return JSON.parse(text);}
export async function studyA2Option(id){
 const option=A2_OPTIONS[id];if(!option)throw new Error('Unknown A2 option: '+id);
 const before=await readA2Baseline(),level=structuredClone(before),field=new TerrainField(before);level.path=expandCorners(option.corners);level.previewMode='layout';level.bridges=structuredClone(option.bridges);
 const bridgeBoxes=new Set(option.bridges.flatMap(b=>b.boxes.map(p=>p.join(',')))),pathBoxes=new Set(level.path.map(([x,,z])=>`${x},${z}`)),clear=new Map(level.path.map(([x,,z])=>[`${x},${z}`,'continuous supported route travel']));
 for(const site of option.sites){const key=site.box.join(',');if(pathBoxes.has(key)||bridgeBoxes.has(key)||field.flatBox(...site.box)!==24)throw new Error(id+' invalid candidate: '+key);clear.set(key,'full defence-ground footprint: '+site.group);}
 const removed=[];level.placements=level.placements.filter(p=>{const reason=clear.get(`${p.box[0]},${p.box[2]}`);if(!reason)return true;removed.push({...structuredClone(p),reason});return false;});
 const models=await auditModels(level);models.set('arc-spire',await Bun.file(new URL('../assets/models/arc-spire.json',import.meta.url)).json());
 const initial=reviewPlacementVisibility(level,option.sites,models),blockers=new Map();
 for(const site of initial.sites)for(const block of site.obstructions){if(block.id==='terrain')throw new Error(id+' terrain obscures '+site.id);if(!blockers.has(block.id))blockers.set(block.id,[]);blockers.get(block.id).push(site.id);}
 level.placements=level.placements.filter(p=>{if(!blockers.has(p.id))return true;removed.push({...structuredClone(p),reason:'full placement-ground overview visibility: '+blockers.get(p.id).join(', ')});return false;});
 const lostPerches=before.previewWildlife.perches.filter(p=>!level.placements.some(q=>q.id===p.id));
 const manifest={id,baseline:{path:A2_BASELINE,sha256:A2_BASELINE_SHA256},rationale:option.rationale,corners:option.corners,sites:option.sites,bridges:option.bridges,routeLength:(level.path.length-1)*24,baselinePlacements:before.placements.length,retainedPlacements:level.placements.length,removed,added:[],moved:[],terrainChanged:false,lostPerches,previewWildlife:level.previewWildlife,validationStatus:'Comparison source; separate selected-option reports contain production route/weapon/visibility evidence.'};
 return {level,manifest,models,sites:option.sites};
}
if(import.meta.main)for(const id of process.argv.slice(2).length?process.argv.slice(2):Object.keys(A2_OPTIONS)){
 const {level,manifest}=await studyA2Option(id),folder=new URL('../docs/a2-path-carving-2026-10-18/',import.meta.url);
 await Bun.write(new URL(id+'.level.json',folder),JSON.stringify(level,null,2)+'\n');await Bun.write(new URL(id+'.manifest.json',folder),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({id,routeLength:manifest.routeLength,sites:manifest.sites.length,retained:manifest.retainedPlacements,lostPerches:manifest.lostPerches,removedRuins:manifest.removed.filter(p=>p.model.includes('ruin')).map(p=>p.id)}));
}
