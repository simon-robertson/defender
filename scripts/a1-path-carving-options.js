// A1-only comparative authoring studies. These never edit production sources.
import {createHash} from 'node:crypto';
import {reviewPlacementVisibility} from './verify-zone-a-four-visibility.js';
import {auditModels} from './level-layout-audit.js';
import {expandCorners} from './level-rebuild-layouts.js';

export const A1_BASELINE='backups/pre-path-carving-2026-10-18T17-00-34-263Z/assets/levels/moss-01.json';
export const A1_BASELINE_SHA256='1d6301db7b573c33b74ae5f0f041b246a1c843ab10715136836e9d4f7517a347';
export const digest=text=>createHash('sha256').update(text).digest('hex');
const root=new URL('../',import.meta.url);
const sites=groups=>Object.entries(groups).flatMap(([group,boxes])=>boxes.map(box=>({id:`${group}-${box[0]}-${box[1]}`,group,box})));
export const A1_OPTIONS={
 'orchard-tour':{
  title:'Orchard tour',
  rationale:'A west entry turns north below the limestone ruin, passes east of the central grove, returns west below it, then loops through the southern flower belt before an independent eastward catch. The unequal returns connect different courts rather than make a repeated serpentine.',
  corners:[[0,7],[5,7],[5,4],[10,4],[10,7],[12,7],[12,11],[7,11],[7,14],[14,14],[14,10],[19,10]],
  sites:sites({
   'entry':[[1,8],[2,8],[3,8],[4,8],[4,6]],
   'ruin-meadow':[[6,5],[7,5],[8,5],[9,5],[6,6],[7,6],[8,6]],
   'east-shoulder':[[11,6],[11,8],[13,8],[13,9]],
   'south-return':[[8,12],[9,12],[10,12],[11,12],[8,13],[9,13],[10,13],[11,13],[12,12],[13,12],[13,13]],
   'late':[[15,11],[16,11],[17,11],[18,11],[16,9],[17,9],[18,9]],
  }),
 },
 'northern-traverse':{
  title:'Northern traverse',
  rationale:'A northern gateway passes between the raised knoll and limestone, drops into a compact western return, traverses above the central grove, and curls through the eastern orchard before a southern exit. This brings the northern landscape into the journey but sacrifices more of the eastern tree mass.',
  corners:[[6,0],[6,6],[4,6],[4,8],[11,8],[11,5],[18,5],[18,11],[14,11],[14,15]],
  sites:sites({
   'north':[[5,1],[5,2],[5,3],[7,1],[7,2],[7,3],[7,4]],
   'west-return':[[5,7],[6,7],[7,7],[3,7],[3,8]],
   'central':[[8,6],[9,6],[10,6],[8,7],[9,7],[10,7],[12,6],[12,7]],
   'east-return':[[16,6],[17,6],[16,7],[17,7],[17,8],[17,9],[17,10],[16,10],[15,10]],
   'late':[[13,12],[13,13],[13,14],[15,12],[15,13],[15,14]],
  }),
 },
 'southern-hook':{
  title:'Southern hook',
  rationale:'A western approach drops beside the southwest orchard, sweeps through the southern open ground, returns north along the central grove, then curls below the northeastern knoll and out through the eastern meadow. This reserves northern scenery and offers a broad middle court, at the cost of a longer scenic northern detour with little base-range repeat exposure.',
  corners:[[0,8],[5,8],[5,12],[10,12],[10,5],[14,5],[14,8],[12,8],[12,10],[19,10]],
  sites:sites({
   'west':[[1,7],[2,7],[3,7],[4,7],[4,9],[4,10],[4,11]],
   'south':[[6,10],[6,11],[7,10],[7,11],[8,10],[8,11],[9,10],[9,11],[7,13],[8,13],[9,13]],
   'north-return':[[11,6],[12,6],[13,6],[11,7],[12,7],[13,7]],
   'late':[[13,9],[14,9],[15,9],[16,9],[17,9],[18,9],[15,11],[16,11],[17,11],[18,11]],
  }),
 },
};

export async function readA1Baseline(){
 const text=await Bun.file(new URL(A1_BASELINE,root)).text();
 if(digest(text)!==A1_BASELINE_SHA256)throw new Error('Frozen A1 baseline hash changed.');
 return JSON.parse(text);
}

// Slow comparison-stage visibility solve. Final factory uses its reviewed,
// explicit removal list instead of repeating this solve on every regeneration.
export async function studyA1Option(id){
 const option=A1_OPTIONS[id];if(!option)throw new Error('Unknown A1 option: '+id);
 const before=await readA1Baseline(),level=structuredClone(before);
 level.path=expandCorners(option.corners);level.previewMode='layout';
 const clear=new Map(level.path.map(([x,,z])=>[`${x},${z}`,'continuous dry route travel']));
 for(const site of option.sites){const key=site.box.join(',');if(clear.has(key))throw new Error(`${id} site on route: ${key}`);clear.set(key,`full defence-ground footprint: ${site.group}`);}
 const removed=[];
 level.placements=level.placements.filter(p=>{const reason=clear.get(`${p.box[0]},${p.box[2]}`);if(!reason)return true;removed.push({...structuredClone(p),reason});return false;});
 const models=await auditModels(level);
 models.set('arc-spire',await Bun.file(new URL('../assets/models/arc-spire.json',import.meta.url)).json());
 const initialVisibility=reviewPlacementVisibility(level,option.sites,models),blockers=new Map();
 for(const site of initialVisibility.sites)for(const blocker of site.obstructions){
  if(blocker.id==='terrain')throw new Error(`${id} terrain hides ${site.id}`);
  if(!blockers.has(blocker.id))blockers.set(blocker.id,[]);blockers.get(blocker.id).push(site.id);
 }
 level.placements=level.placements.filter(p=>{const hidden=blockers.get(p.id);if(!hidden)return true;removed.push({...structuredClone(p),reason:'full placement-ground overview visibility: '+hidden.join(', ')});return false;});
 const lostPerches=before.previewWildlife.perches.filter(p=>!level.placements.some(q=>p.id===q.id));
 const manifest={id,baseline:{path:A1_BASELINE,sha256:A1_BASELINE_SHA256},rationale:option.rationale,corners:option.corners,sites:option.sites,routeLength:(level.path.length-1)*24,baselinePlacements:before.placements.length,retainedPlacements:level.placements.length,removed,added:[],moved:[],terrainChanged:false,lostPerches,previewWildlife:level.previewWildlife};
 return {level,manifest,models,sites:option.sites};
}
