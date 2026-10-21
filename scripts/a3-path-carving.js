// A3 Garden Confluence selected for user review. Heavy probes run separately.
import {createHash} from 'node:crypto';
import {validateLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
import {levelRoutes,pathBoxUnion} from '../shared/routes.js';
const root=new URL('../',import.meta.url);
export const A3_BASELINE='backups/pre-path-carving-2026-10-18T17-00-34-263Z/assets/levels/moss-03.json';
export const A3_BASELINE_SHA256='5cf9498a92440b1696d0edcfab667979532e8c03d99725c0ab6918c9409284cc';
export const A3_PATH_CORNERS=Object.freeze([[0,11],[5,11],[5,5],[7,5],[7,8],[12,8],[12,11],[10,11],[10,14],[12,14],[12,15]].map(Object.freeze));
export const A3_ADDITIONAL_ROUTES=Object.freeze([{"id":"eastern","corners":[[19,3],[16,3],[16,6],[18,6],[18,8],[12,8],[12,11],[10,11],[10,14],[12,14],[12,15]]}].map(r=>Object.freeze({...r,corners:Object.freeze(r.corners.map(Object.freeze))})));
export const A3_BRIDGES=Object.freeze([{"id":"lower-stream-crossing","boxes":[[14,8]]}].map(b=>Object.freeze({...b,boxes:Object.freeze(b.boxes.map(Object.freeze))})));
export const A3_DEFENCE_SITES=Object.freeze([
 {"id":"west-entry-1-12","group":"westEntry","box":[1,12],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-entry-2-12","group":"westEntry","box":[2,12],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-entry-3-12","group":"westEntry","box":[3,12],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-entry-4-12","group":"westEntry","box":[4,12],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-entry-4-10","group":"westEntry","box":[4,10],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-entry-6-11","group":"westEntry","box":[6,11],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-return-6-6","group":"westReturn","box":[6,6],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-return-6-7","group":"westReturn","box":[6,7],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-return-6-8","group":"westReturn","box":[6,8],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-return-6-9","group":"westReturn","box":[6,9],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-return-6-10","group":"westReturn","box":[6,10],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-return-7-9","group":"westReturn","box":[7,9],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-return-8-9","group":"westReturn","box":[8,9],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"west-return-9-9","group":"westReturn","box":[9,9],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"limestone-6-4","group":"limestone","box":[6,4],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"limestone-8-7","group":"limestone","box":[8,7],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"limestone-9-7","group":"limestone","box":[9,7],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"limestone-10-7","group":"limestone","box":[10,7],"coverageRole":"main","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-entry-17-2","group":"eastEntry","box":[17,2],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-entry-18-2","group":"eastEntry","box":[18,2],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-entry-17-4","group":"eastEntry","box":[17,4],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-entry-18-4","group":"eastEntry","box":[18,4],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-entry-17-5","group":"eastEntry","box":[17,5],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-return-17-7","group":"eastReturn","box":[17,7],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-return-16-7","group":"eastReturn","box":[16,7],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-return-15-6","group":"eastReturn","box":[15,6],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-return-15-7","group":"eastReturn","box":[15,7],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-return-19-7","group":"eastReturn","box":[19,7],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-return-19-8","group":"eastReturn","box":[19,8],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-return-18-9","group":"eastReturn","box":[18,9],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-return-17-9","group":"eastReturn","box":[17,9],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"east-return-16-9","group":"eastReturn","box":[16,9],"coverageRole":"eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"shared-court-11-9","group":"sharedCourt","box":[11,9],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"shared-court-11-10","group":"sharedCourt","box":[11,10],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"shared-court-10-10","group":"sharedCourt","box":[10,10],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"shared-court-11-12","group":"sharedCourt","box":[11,12],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"shared-court-11-13","group":"sharedCourt","box":[11,13],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"shared-court-12-13","group":"sharedCourt","box":[12,13],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"shared-court-9-12","group":"sharedCourt","box":[9,12],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"shared-court-9-13","group":"sharedCourt","box":[9,13],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"late-9-14","group":"late","box":[9,14],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"late-10-15","group":"late","box":[10,15],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"late-11-15","group":"late","box":[11,15],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}},
 {"id":"late-13-15","group":"late","box":[13,15],"coverageRole":"main+eastern","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"],"missile-launcher":["base","upgrade1","upgrade2"]}}
].map(s=>Object.freeze({...s,box:Object.freeze(s.box),weaponSuitability:Object.freeze(Object.fromEntries(Object.entries(s.weaponSuitability).map(([k,v])=>[k,Object.freeze(v)])))})));
const REMOVALS=new Map([
 ["a3-land-17-2","full defence-ground footprint: eastEntry"],
 ["a3-land-18-2","full defence-ground footprint: eastEntry"],
 ["a3-land-16-3","continuous supported route travel"],
 ["a3-land-17-3","continuous supported route travel"],
 ["a3-land-18-3","continuous supported route travel"],
 ["a3-land-19-3","continuous supported route travel"],
 ["a3-land-6-4","full defence-ground footprint: limestone"],
 ["a3-land-16-4","continuous supported route travel"],
 ["a3-land-17-4","full defence-ground footprint: eastEntry"],
 ["a3-land-18-4","full defence-ground footprint: eastEntry"],
 ["a3-land-5-5","continuous supported route travel"],
 ["a3-land-6-5","continuous supported route travel"],
 ["a3-land-7-5","continuous supported route travel"],
 ["a3-land-16-5","continuous supported route travel"],
 ["a3-land-17-5","full defence-ground footprint: eastEntry"],
 ["a3-land-5-6","continuous supported route travel"],
 ["a3-land-6-6","full defence-ground footprint: westReturn"],
 ["a3-land-7-6","continuous supported route travel"],
 ["a3-land-15-6","full defence-ground footprint: eastReturn"],
 ["a3-land-16-6","continuous supported route travel"],
 ["a3-land-17-6","continuous supported route travel"],
 ["a3-land-18-6","continuous supported route travel"],
 ["a3-land-5-7","continuous supported route travel"],
 ["a3-land-6-7","full defence-ground footprint: westReturn"],
 ["a3-land-7-7","continuous supported route travel"],
 ["a3-land-8-7","full defence-ground footprint: limestone"],
 ["a3-land-9-7","full defence-ground footprint: limestone"],
 ["a3-land-10-7","full defence-ground footprint: limestone"],
 ["a3-land-15-7","full defence-ground footprint: eastReturn"],
 ["a3-land-16-7","full defence-ground footprint: eastReturn"],
 ["a3-land-17-7","full defence-ground footprint: eastReturn"],
 ["a3-land-18-7","continuous supported route travel"],
 ["a3-land-19-7","full defence-ground footprint: eastReturn"],
 ["a3-land-5-8","continuous supported route travel"],
 ["a3-land-6-8","full defence-ground footprint: westReturn"],
 ["a3-land-7-8","continuous supported route travel"],
 ["a3-land-8-8","continuous supported route travel"],
 ["a3-land-9-8","continuous supported route travel"],
 ["a3-land-10-8","continuous supported route travel"],
 ["a3-land-11-8","continuous supported route travel"],
 ["a3-land-12-8","continuous supported route travel"],
 ["a3-land-13-8","continuous supported route travel"],
 ["a3-land-15-8","continuous supported route travel"],
 ["a3-land-16-8","continuous supported route travel"],
 ["a3-land-17-8","continuous supported route travel"],
 ["a3-land-18-8","continuous supported route travel"],
 ["a3-land-19-8","full defence-ground footprint: eastReturn"],
 ["a3-land-5-9","continuous supported route travel"],
 ["a3-land-6-9","full defence-ground footprint: westReturn"],
 ["a3-land-7-9","full defence-ground footprint: westReturn"],
 ["a3-land-8-9","full defence-ground footprint: westReturn"],
 ["a3-land-9-9","full defence-ground footprint: westReturn"],
 ["a3-land-11-9","full defence-ground footprint: sharedCourt"],
 ["a3-land-12-9","continuous supported route travel"],
 ["a3-land-16-9","full defence-ground footprint: eastReturn"],
 ["a3-land-17-9","full defence-ground footprint: eastReturn"],
 ["a3-land-18-9","full defence-ground footprint: eastReturn"],
 ["a3-land-4-10","full defence-ground footprint: westEntry"],
 ["a3-land-5-10","continuous supported route travel"],
 ["a3-land-6-10","full defence-ground footprint: westReturn"],
 ["a3-land-10-10","full defence-ground footprint: sharedCourt"],
 ["a3-land-11-10","full defence-ground footprint: sharedCourt"],
 ["a3-land-12-10","continuous supported route travel"],
 ["a3-land-0-11","continuous supported route travel"],
 ["a3-land-1-11","continuous supported route travel"],
 ["a3-land-2-11","continuous supported route travel"],
 ["a3-land-3-11","continuous supported route travel"],
 ["a3-land-4-11","continuous supported route travel"],
 ["a3-land-5-11","continuous supported route travel"],
 ["a3-land-6-11","full defence-ground footprint: westEntry"],
 ["a3-land-10-11","continuous supported route travel"],
 ["a3-land-11-11","continuous supported route travel"],
 ["a3-land-12-11","continuous supported route travel"],
 ["a3-land-1-12","full defence-ground footprint: westEntry"],
 ["a3-land-2-12","full defence-ground footprint: westEntry"],
 ["a3-land-3-12","full defence-ground footprint: westEntry"],
 ["a3-land-4-12","full defence-ground footprint: westEntry"],
 ["a3-land-9-12","full defence-ground footprint: sharedCourt"],
 ["a3-land-10-12","continuous supported route travel"],
 ["a3-land-11-12","full defence-ground footprint: sharedCourt"],
 ["a3-land-9-13","full defence-ground footprint: sharedCourt"],
 ["a3-land-10-13","continuous supported route travel"],
 ["a3-land-11-13","full defence-ground footprint: sharedCourt"],
 ["a3-land-12-13","full defence-ground footprint: sharedCourt"],
 ["a3-land-9-14","full defence-ground footprint: late"],
 ["a3-land-10-14","continuous supported route travel"],
 ["a3-land-11-14","continuous supported route travel"],
 ["a3-land-12-14","continuous supported route travel"],
 ["a3-land-10-15","full defence-ground footprint: late"],
 ["a3-land-11-15","full defence-ground footprint: late"],
 ["a3-land-12-15","continuous supported route travel"],
 ["a3-land-13-15","full defence-ground footprint: late"],
 ["a3-land-19-2","full placement-ground overview visibility: east-entry-18-2"],
 ["a3-land-6-3","full placement-ground overview visibility: limestone-6-4"],
 ["a3-land-7-3","full placement-ground overview visibility: limestone-6-4"],
 ["a3-land-7-4","full placement-ground overview visibility: limestone-6-4"],
 ["a3-land-15-5","full placement-ground overview visibility: east-return-15-6"],
 ["a3-land-18-5","full placement-ground overview visibility: east-entry-17-5, east-return-17-7"],
 ["a3-land-8-6","full placement-ground overview visibility: limestone-8-7"],
 ["a3-land-11-6","full placement-ground overview visibility: limestone-10-7"],
 ["a3-land-4-9","full placement-ground overview visibility: west-entry-4-10"],
 ["a3-land-19-9","full placement-ground overview visibility: east-return-18-9"],
 ["a3-land-7-10","full placement-ground overview visibility: west-entry-6-11, west-return-6-10"],
 ["a3-land-9-11","full placement-ground overview visibility: shared-court-9-12"],
 ["a3-land-13-12","full placement-ground overview visibility: shared-court-12-13"],
 ["a3-land-13-13","full placement-ground overview visibility: shared-court-12-13"],
 ["a3-land-13-14","full placement-ground overview visibility: late-13-15"]
]);
const sha256=text=>createHash('sha256').update(text).digest('hex');
function expand(corners){
 let [x,z]=corners[0];const path=[[x,0,z]];
 for(const [endX,endZ]of corners.slice(1)){
  if((x===endX)===(z===endZ))throw new Error('A3 corners require nonzero orthogonal segments.');
  while(x!==endX||z!==endZ){x+=Math.sign(endX-x);z+=Math.sign(endZ-z);path.push([x,0,z]);}
 }
 return path;
}
export function checkA3PathEdges(level){
 const [width,length]=level.size,boundary=([x,,z])=>x===0||z===0||x===width-1||z===length-1;
 return levelRoutes(level).map(({id,path})=>{
  if(path.length<2||!boundary(path[0])||!boundary(path.at(-1)))throw new Error('A3 complete routes must enter and exit at level edges.');
  if(path.slice(1,-1).some(boundary))throw new Error('A3 routes must not run along level edges.');
  for(let i=1;i<path.length;i++)if(Math.abs(path[i][0]-path[i-1][0])+Math.abs(path[i][2]-path[i-1][2])!==1)throw new Error('A3 route is not edge-connected.');
  return {id,entry:[...path[0]],exit:[...path.at(-1)],boundaryBoxes:2,interiorBoxes:path.length-2,edgeRunningSegments:0};
 });
}
export async function carveMoss03(){
 const baselineText=await Bun.file(new URL(A3_BASELINE,root)).text();
 if(sha256(baselineText)!==A3_BASELINE_SHA256)throw new Error('Frozen A3 no longer matches the accepted landscape.');
 const level=JSON.parse(baselineText),original=level.placements,removed=[];
 level.path=expand(A3_PATH_CORNERS);level.previewMode='layout';level.routes=A3_ADDITIONAL_ROUTES.map(r=>({id:r.id,path:expand(r.corners)}));level.bridges=structuredClone(A3_BRIDGES);
 level.placements=original.filter(p=>{const reason=REMOVALS.get(p.id);if(!reason)return true;removed.push({...structuredClone(p),reason});return false;});
 if(removed.length!==REMOVALS.size)throw new Error('Selected A3 removal inventory does not match its baseline.');
 for(const perch of level.previewWildlife.perches)if(!level.placements.some(p=>p.id===perch.id))throw new Error('A3 wildlife perch was removed: '+perch.id);
 validateLevel(level);const edges=checkA3PathEdges(level),field=new TerrainField(level);
 for(const site of A3_DEFENCE_SITES)if(field.flatBox(...site.box)!==24||field.protected(...site.box)||field.bridgeBox(...site.box))throw new Error('A3 candidate must remain naturally dry and outside the route: '+site.id);
 const sourceText=JSON.stringify(level,null,2)+'\n';
 const manifest={id:'moss-03',selectedOption:'garden-confluence',status:'Implemented layout selected by Lead with Artist/Tactician review; user acceptance pending.',baseline:{path:A3_BASELINE,sha256:A3_BASELINE_SHA256},source:{path:'assets/levels/moss-03.json',sha256:sha256(sourceText)},rationale:"A western approach returns through the cypress-side garden while a northeastern approach bends across a quieter bank and short stream bridge. They meet on dry ground before a shared southern meadow and limestone-side exit. Branch-specific early choices trade against a common later court without forcing the stream or raised knolls to change.",corners:structuredClone(A3_PATH_CORNERS),additional:structuredClone(A3_ADDITIONAL_ROUTES),routes:levelRoutes(level).map(r=>({id:r.id,boxes:r.path.length,length:(r.path.length-1)*24})),unionPathBoxes:pathBoxUnion(level).length,merge:{box:[12,8],routeDistances:{main:504,eastern:384},sharedTailBoxes:12,sharedTailLength:264},edges,bridges:structuredClone(level.bridges),bridgeGeometry:{thickness:1,top:24,underside:23,waterSurface:22,bed:20,dryLandings:[[15,8],[13,8]],easternDeckRouteInterval:[324,348],naturalWaterAndBedPreserved:true},sites:structuredClone(A3_DEFENCE_SITES),baselinePlacements:original.length,retainedPlacements:level.placements.length,removed,added:[],moved:[],terrainChanged:false,modelsChanged:false,previewWildlife:structuredClone(level.previewWildlife),limitations:['Layout preview only: no enemies or actual defence units.','All 44 candidate boxes offer base gun/Arc opportunity: 18 western-only, 14 eastern-only and 12 shared.','Each box individually fits base/upgrade1 gun and Arc, and all three silo stages, without weapon exclusions.','The eastern base gun/Arc union has a 12-unit dry-landing gap at route354–366; upgrade1 reaches it.',
'Candidate ground is an authoring study, not fixed build pads or a player-placement rule.','Independent clearance does not certify simultaneous adjacent weapon arrangements.','Finite missile feasibility probes demonstrate 60 hits and 3 legitimate turning-Moth misses among 63 single flights; this is not universal hit coverage or campaign balance.','No enemy schedules, wave timings, resource budgets or campaign outcomes are assigned.']};
 return {level,manifest};
}
if(import.meta.main){
 const args=process.argv.slice(2);if(args.some(arg=>arg!=='--write'))throw new Error('Usage: bun scripts/a3-path-carving.js [--write]');
 const {level,manifest}=await carveMoss03();
 if(args.includes('--write')){await Bun.write(new URL('assets/levels/moss-03.json',root),JSON.stringify(level,null,2)+'\n');await Bun.write(new URL('docs/a3-path-carving-2026-10-18/moss-03.manifest.json',root),JSON.stringify(manifest,null,2)+'\n');}
 console.log(JSON.stringify({id:level.id,selectedOption:manifest.selectedOption,routes:manifest.routes,union:manifest.unionPathBoxes,merge:manifest.merge,sites:manifest.sites.length,retained:manifest.retainedPlacements,written:args.includes('--write')}));
}
