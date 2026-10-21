import {mkdir} from 'node:fs/promises';
import {landscapeFor,LANDSCAPE_INFO,snapshotText} from './landscapes/index.js';
import {LEVEL_LAYOUTS,expandCorners} from './level-rebuild-layouts.js';
import {zoneAFourLevel,zoneAFourRemovalManifest} from './zone-a-four.js';
import {reviewPlacementVisibility} from './verify-zone-a-four-visibility.js';
import {auditModels,sourceHash} from './level-layout-audit.js';
import {validateLevel} from '../shared/level.js';
import {pathBoxUnion,levelRoutes} from '../shared/routes.js';
import {buildWorld,disposeWorld} from '../engine/world.js';

const root=new URL('../',import.meta.url),key=(x,z)=>`${x},${z}`;
function equipment(definition){
 const {number,zone,positions}=definition,prefix=zone.toLowerCase()+number;
 const kinds=number===1?['turret-study','turret-study','turret-study']:number===2?['arc-spire','arc-spire','arc-spire']:number===3?['missile-launcher','missile-launcher','missile-launcher']:['turret-study','arc-spire','missile-launcher'];
 const variants=number===1?['base','upgrade1','base']:number<4?['base','upgrade1','upgrade2']:['base','base','base'];
 const placements=positions.map(([x,z],i)=>({id:`${prefix}-defence-${i+1}`,model:kinds[i],variant:variants[i],box:[x,0,z],turn:0}));
 if(definition.generator)placements.push({id:prefix+'-generator',model:'power-generator',variant:'base',box:[definition.generator[0],0,definition.generator[1]],turn:0});
 return placements;
}
export async function carveLevel(id){
 const definition=LEVEL_LAYOUTS[id],info=LANDSCAPE_INFO[id];if(!definition||!info)throw new Error('Landscape/layout handoff is not ready: '+id);
 if(definition.landscapeSha256!==info.sha256)throw new Error('Tactical layout needs review against the revised landscape: '+id);
 const before=landscapeFor(definition.zone,definition.number),baselineText=await Bun.file(new URL(info.snapshot,root)).text();
 if(sourceHash(baselineText)!==info.sha256||snapshotText(before)!==baselineText)throw new Error('Frozen landscape differs from its handoff: '+id);
 let level,manifest;
 if(definition.reuseA4){level=zoneAFourLevel();manifest=zoneAFourRemovalManifest();}
 else{
  level=structuredClone(before);level.id=id;level.name=info.name;level.path=expandCorners(definition.corners.main);
  const additional=Object.entries(definition.corners).filter(([route])=>route!=='main').map(([route,corners])=>({id:route,path:expandCorners(corners)}));if(additional.length)level.routes=additional;
  if(definition.actorRoutes)level.actorRoutes={...definition.actorRoutes};
  const clear=new Map(pathBoxUnion(level).map(([x,,z])=>[key(x,z),'route']));
  for(const site of definition.sites){if(clear.has(key(...site.box)))throw new Error(id+' clearing overlaps a route: '+site.id);clear.set(key(...site.box),site.group+' defence clearing');}
  if(definition.generator){if(clear.has(key(...definition.generator)))throw new Error(id+' generator overlaps a route/site.');clear.set(key(...definition.generator),'generator support');}
  const removed=[],retained=[];
  for(const p of before.placements){const reason=clear.get(key(p.box[0],p.box[2]));if(reason)removed.push({id:p.id,model:p.model,box:p.box.slice(),reason});else retained.push(p);}
  const added=equipment(definition);level.placements=[...retained,...added];
  manifest={baselinePlacements:before.placements.length,retainedPlacements:retained.length,removed,added,moved:[],terrainChanged:false};
 }
 level.previewWildlife={habitats:structuredClone(definition.habitats),perches:info.perchCandidates.map(({id,point})=>({id,point:[...point]}))};
 const models=await auditModels(level),sites=definition.sites.map(site=>({...site,box:[...site.box],placement:level.placements.find(p=>models.get(p.model)?.role==='defence'&&p.box[0]===site.box[0]&&p.box[2]===site.box[1])?.id}));
 // Subtract exact scenery view obstructions, never terrain. Continuous full-
 // area projection catches slivers missed by the independent ray sample grid.
 const visibilitySites=[...sites,...level.placements.filter(p=>p.model==='power-generator'&&!sites.some(site=>site.box[0]===p.box[0]&&site.box[1]===p.box[2])).map(p=>({id:p.id+'-support',group:'enhancer',box:[p.box[0],p.box[2]],placement:p.id}))];
 const initialView=reviewPlacementVisibility(level,visibilitySites,models),obstructions=new Map();
 for(const site of initialView.sites)for(const blocker of site.obstructions){
  if(blocker.id==='terrain')throw new Error(id+' terrain obscures candidate '+site.id);
  if(!obstructions.has(blocker.id))obstructions.set(blocker.id,[]);obstructions.get(blocker.id).push(site.id);
 }
 if(obstructions.size){
  level.placements=level.placements.filter(p=>{if(!obstructions.has(p.id))return true;manifest.removed.push({id:p.id,model:p.model,box:p.box.slice(),reason:(obstructions.get(p.id).every(id=>id.endsWith('-support'))?'generator-support visibility: ':'placement-area visibility: ')+obstructions.get(p.id).join(', ')});return false;});
  manifest.retainedPlacements-=obstructions.size;
 }
 for(const perch of info.perchCandidates)if(!level.placements.some(p=>p.id===perch.id))throw new Error(id+' carving would remove a supported wildlife perch: '+perch.id);
 validateLevel(level,models);const world=buildWorld(level,models);disposeWorld(world);
 const retained=new Set(level.placements.map(p=>p.id));
 manifest={id,baseline:{path:info.snapshot,sha256:info.sha256},rationale:definition.rationale,...manifest,retainedLandmarks:info.landmarkIds.filter(id=>retained.has(id)),removedLandmarks:info.landmarkIds.filter(id=>!retained.has(id)),routes:levelRoutes(level).map(route=>({id:route.id,boxes:route.path.length,length:(route.path.length-1)*24})),sites,visibilitySites,actorRoutes:level.actorRoutes??{},previewWildlife:level.previewWildlife};
 return {level,manifest,models,sites,visibilitySites};
}

if(import.meta.main){
 const args=process.argv.slice(2),write=args.includes('--write');let ids=Object.keys(LEVEL_LAYOUTS);
 for(let i=0;i<args.length;i++){if(args[i]==='--write')continue;if(args[i]==='--level'&&args[i+1]){ids=[args[++i]];continue;}throw new Error('Usage: bun scripts/rebuild-level-layouts.js [--level ID] [--write]');}
 const output=new URL('docs/level-rebuild-2026-10-18/',root);await mkdir(output,{recursive:true});await mkdir(new URL('previous-levels/',output),{recursive:true});
 for(const id of ids){
  const file=new URL(`assets/levels/${id}.json`,root),exists=await Bun.file(file).exists();
  if(exists&&!write){console.log(id+': existing source preserved; --write explicitly rebuilds.');continue;}
  const {level,manifest}=await carveLevel(id),text=snapshotText(level);
  if(exists){const previous=new URL(`previous-levels/${id}.json`,output);if(!await Bun.file(previous).exists())await Bun.write(previous,await Bun.file(file).text());}
  await Bun.write(file,text);await Bun.write(new URL(`${id}.manifest.json`,output),JSON.stringify({...manifest,source:{path:`assets/levels/${id}.json`,sha256:sourceHash(text)}},null,2)+'\n');
  console.log(JSON.stringify({id,placements:level.placements.length,removed:manifest.removed.length,routes:manifest.routes,removedLandmarks:manifest.removedLandmarks}));
 }
}
