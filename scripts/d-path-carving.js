// Deterministic D1–D4 selected sources. No comparison or audit runs during
// preview regeneration, and the immutable pre-carving baseline is never edited.
import {createHash} from 'node:crypto';
import {D_CARVES} from './d-path-carving-data.js';
import {expandCorners} from './level-rebuild-layouts.js';
import {validateLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
import {levelRoutes,pathBoxUnion} from '../shared/routes.js';

const root=new URL('../',import.meta.url),hash=text=>createHash('sha256').update(text).digest('hex');
export {D_CARVES};
export function checkDPathEdges(level){
 const [width,length]=level.size,boundary=([x,,z])=>x===0||z===0||x===width-1||z===length-1;
 return levelRoutes(level).map(({id,path})=>{if(path.length<2||!boundary(path[0])||!boundary(path.at(-1))||path.slice(1,-1).some(boundary))throw new Error(level.id+'/'+id+': boundary endpoints/interior rule');return {id,entry:path[0],exit:path.at(-1),boundaryBoxes:2,interiorBoxes:path.length-2,edgeRunningSegments:0};});
}
export async function carvePlum(id){
 const selected=D_CARVES[id];if(!selected)throw new Error('Unknown selected D carve: '+id);
 const baselineText=await Bun.file(new URL(selected.baseline.path,root)).text();if(hash(baselineText)!==selected.baseline.sha256)throw new Error('Frozen D baseline hash mismatch: '+id);
 const level=JSON.parse(baselineText),original=level.placements,removals=new Map(selected.removed.map(p=>[p.id,p.reason])),removed=[];
 level.path=expandCorners(selected.corners);level.previewMode='layout';
 if(selected.additional.length)level.routes=selected.additional.map(r=>({id:r.id,path:expandCorners(r.corners)}));
 if(selected.bridges.length)level.bridges=structuredClone(selected.bridges);
 level.placements=original.filter(p=>{const reason=removals.get(p.id);if(!reason)return true;removed.push({...structuredClone(p),reason});return false;});
 if(removed.length!==removals.size)throw new Error('D removal inventory differs from frozen source: '+id);
 for(const perch of level.previewWildlife.perches)if(!level.placements.some(p=>p.id===perch.id))throw new Error('Original D perch removed: '+perch.id);
 level.previewWildlife.habitatPoints=selected.wildlifePoints.map(p=>[...p]);level.previewWildlife.habitats=selected.wildlifePoints.map(([x,,z])=>[Math.floor(x/24),Math.floor(z/24)]);
 validateLevel(level);const field=new TerrainField(level),edges=checkDPathEdges(level);
 if(pathBoxUnion(level).some(([x,,z])=>field.supportBox(x,z)!==level.pathHeight))throw new Error('Discontinuous route support: '+id);
 for(const s of selected.sites)if(field.flatBox(...s.box)!==level.pathHeight||field.protected(...s.box))throw new Error('D candidate must be dry and outside route: '+s.id);
 const sourceText=JSON.stringify(level,null,2)+'\n';
 return {level,manifest:{id,selectedOption:selected.option,status:'Lead-selected layout/wildlife preview; user creative acceptance pending.',baseline:selected.baseline,source:{path:'assets/levels/'+id+'.json',sha256:hash(sourceText)},title:selected.title,corners:structuredClone(selected.corners),additional:structuredClone(selected.additional),routes:levelRoutes(level).map(r=>({id:r.id,boxes:r.path.length,length:(r.path.length-1)*24})),unionPathBoxes:pathBoxUnion(level).length,edges,bridges:structuredClone(selected.bridges),sites:structuredClone(selected.sites),baselinePlacements:original.length,retainedPlacements:level.placements.length,removed,added:[],moved:[],terrainChanged:false,environmentChanged:false,modelsChanged:false,previewWildlife:structuredClone(level.previewWildlife)}};
}
if(import.meta.main){const args=process.argv.slice(2),write=args.includes('--write'),ids=args.filter(a=>a!=='--write');for(const id of ids.length?ids:Object.keys(D_CARVES)){const {level,manifest}=await carvePlum(id);if(write){await Bun.write(new URL('assets/levels/'+id+'.json',root),JSON.stringify(level,null,2)+'\n');await Bun.write(new URL('docs/campaign-completion-2026-10-20/zone-d-'+id+'.manifest.json',root),JSON.stringify(manifest,null,2)+'\n');}console.log(JSON.stringify({id,selectedOption:manifest.selectedOption,routes:manifest.routes,sites:manifest.sites.length,retained:manifest.retainedPlacements,written:write}));}}
