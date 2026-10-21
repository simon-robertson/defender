import {PREVIEW_LEVELS} from '../shared/preview-levels.js';
import {validateLevel} from '../shared/level.js';
import {defaultWaterMaterial} from '../shared/water.js';
import {denserWildlife} from './denser-wildlife.js';
import {assertLevelFootprint} from '../shared/level-footprint.js';
import {fixedLandscapeFor,snapshotText,sha256} from './fixed-landscapes.js';

// Production authoring entry point. Frozen landscape and historical carving
// factories remain unchanged; only authorised current carve reviews go here.
export async function currentPreviewFor(zone,number){
 const profile=PREVIEW_LEVELS.find(p=>p.zone===zone&&p.number===number);
 if(!profile)throw new Error('Unknown production preview.');
 const level=zone==='A'&&number===1
  ?await (await import('./a1-drone-test.js')).a1DroneTest()
  :zone==='A'&&number===2
  ?(await (await import('./a2-path-carving.js')).carveMoss02()).level
  :zone==='A'&&number===3
  ?(await (await import('./a3-path-carving.js')).carveMoss03()).level
  :zone==='A'&&number===4
  ?(await (await import('./a4-path-carving.js')).carveMoss04()).level
  :zone==='B'
  ?(await (await import('./b-path-carving.js')).carveOchre(profile.level)).level
  :zone==='C'
  ?(await (await import('./c-path-carving.js')).carveIce(profile.level)).level
  :zone==='D'
  ?(await (await import('./d-path-carving.js')).carvePlum(profile.level)).level
  :fixedLandscapeFor(zone,number);
 // Current water review supersedes the archived materials, not the landscapes.
 level.waterMaterial=defaultWaterMaterial();
 await denserWildlife(level);
 if(level.id!==profile.level)throw new Error('Production preview ID mismatch.');
 assertLevelFootprint(level);validateLevel(level);
 return level;
}

if(import.meta.main){
 const args=process.argv.slice(2);let id=null,write=false,check=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--write'&&!write)write=true;
  else if(args[i]==='--check'&&!check)check=true;
  else if(args[i]==='--level'&&id===null&&args[i+1])id=args[++i];
  else throw new Error('Usage: bun scripts/current-preview-levels.js [--level ID] [--write|--check]');
 }
 if(write&&check)throw new Error('Choose --write or --check.');
 const profiles=id?PREVIEW_LEVELS.filter(p=>p.level===id):PREVIEW_LEVELS;
 if(!profiles.length)throw new Error('Unknown production preview: '+id);
 const models=new Map();
 for(const profile of profiles){
  const level=await currentPreviewFor(profile.zone,profile.number);
  for(const id of new Set([...level.placements.map(p=>p.model),...(level.previewActors??[]).map(a=>a.modelId)]))if(!models.has(id)){
   models.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
  }
  validateLevel(level,models);
  const expected=snapshotText(level),file=Bun.file(new URL(`../assets/levels/${level.id}.json`,import.meta.url));
  const exists=await file.exists(),same=exists&&await file.text()===expected;
  if(check&&!same)throw new Error('Current source differs from its authoring factory: '+level.id);
  if(!check&&!same){
   if(exists&&!write)throw new Error('Existing source preserved; explicit --write is required: '+level.id);
   await Bun.write(file,expected);
  }
  console.log(JSON.stringify({id:level.id,mode:level.previewMode,pathBoxes:level.path.length,placements:level.placements.length,sha256:sha256(expected),status:check?'verified':same?'unchanged':'written'}));
 }
}
