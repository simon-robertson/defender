// A2 Garden Crossing, selected for user review. Heavy probes are separate.
import {createHash} from 'node:crypto';
import {validateLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
const root=new URL('../',import.meta.url);
export const A2_BASELINE='backups/pre-path-carving-2026-10-18T17-00-34-263Z/assets/levels/moss-02.json';
export const A2_BASELINE_SHA256='cb5b95b09a450a34cd25ee533ed20ff3a90128824532be9a06d187fcf83f694a';
export const A2_PATH_CORNERS=Object.freeze([[0,7],[4,7],[4,3],[6,3],[6,9],[9,9],[9,8],[17,8],[17,10],[15,10],[15,13],[11,13],[11,15]].map(Object.freeze));
export const A2_BRIDGES=Object.freeze([{"id":"garden-crossing","boxes":[[11,8],[12,8],[13,8],[14,8],[15,8],[16,8]]}].map(b=>Object.freeze({...b,boxes:Object.freeze(b.boxes.map(Object.freeze))})));
export const A2_DEFENCE_SITES=Object.freeze([
 {"id":"entry-1-6","group":"entry","box":[1,6],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"entry-2-6","group":"entry","box":[2,6],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"entry-3-6","group":"entry","box":[3,6],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"entry-3-5","group":"entry","box":[3,5],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"entry-3-4","group":"entry","box":[3,4],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"west-return-5-4","group":"westReturn","box":[5,4],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"west-return-5-5","group":"westReturn","box":[5,5],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"west-return-5-6","group":"westReturn","box":[5,6],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"west-return-5-7","group":"westReturn","box":[5,7],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"west-return-5-8","group":"westReturn","box":[5,8],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"garden-7-4","group":"garden","box":[7,4],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"garden-7-5","group":"garden","box":[7,5],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"garden-7-8","group":"garden","box":[7,8],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"garden-8-8","group":"garden","box":[8,8],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"garden-7-10","group":"garden","box":[7,10],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"garden-8-10","group":"garden","box":[8,10],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"garden-9-10","group":"garden","box":[9,10],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"garden-9-7","group":"garden","box":[9,7],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"east-landing-17-7","group":"eastLanding","box":[17,7],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"east-landing-18-7","group":"eastLanding","box":[18,7],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"east-landing-18-8","group":"eastLanding","box":[18,8],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"east-landing-18-9","group":"eastLanding","box":[18,9],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"east-landing-16-9","group":"eastLanding","box":[16,9],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"south-court-16-11","group":"southCourt","box":[16,11],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"south-court-16-12","group":"southCourt","box":[16,12],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"south-court-14-12","group":"southCourt","box":[14,12],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"south-court-14-14","group":"southCourt","box":[14,14],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"south-court-13-14","group":"southCourt","box":[13,14],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"south-court-12-14","group":"southCourt","box":[12,14],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"late-10-14","group":"late","box":[10,14],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"late-10-15","group":"late","box":[10,15],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}},
 {"id":"late-12-15","group":"late","box":[12,15],"coverageRole":"base-useful","weaponSuitability":{"turret-study":["base","upgrade1"],"arc-spire":["base","upgrade1"]}}
].map(s=>Object.freeze({...s,box:Object.freeze(s.box),weaponSuitability:Object.freeze(Object.fromEntries(Object.entries(s.weaponSuitability).map(([k,v])=>[k,Object.freeze(v)])))})));
const REMOVALS=new Map([
 ["a2-land-4-3","continuous supported route travel"],
 ["a2-land-5-3","continuous supported route travel"],
 ["a2-land-6-3","continuous supported route travel"],
 ["a2-land-3-4","full defence-ground footprint: entry"],
 ["a2-land-4-4","continuous supported route travel"],
 ["a2-land-5-4","full defence-ground footprint: westReturn"],
 ["a2-land-6-4","continuous supported route travel"],
 ["a2-land-7-4","full defence-ground footprint: garden"],
 ["a2-land-3-5","full defence-ground footprint: entry"],
 ["a2-land-4-5","continuous supported route travel"],
 ["a2-land-5-5","full defence-ground footprint: westReturn"],
 ["a2-land-6-5","continuous supported route travel"],
 ["a2-land-7-5","full defence-ground footprint: garden"],
 ["a2-land-1-6","full defence-ground footprint: entry"],
 ["a2-land-2-6","full defence-ground footprint: entry"],
 ["a2-land-3-6","full defence-ground footprint: entry"],
 ["a2-land-4-6","continuous supported route travel"],
 ["a2-land-5-6","full defence-ground footprint: westReturn"],
 ["a2-land-6-6","continuous supported route travel"],
 ["a2-land-0-7","continuous supported route travel"],
 ["a2-land-1-7","continuous supported route travel"],
 ["a2-land-2-7","continuous supported route travel"],
 ["a2-land-3-7","continuous supported route travel"],
 ["a2-land-4-7","continuous supported route travel"],
 ["a2-land-5-7","full defence-ground footprint: westReturn"],
 ["a2-land-6-7","continuous supported route travel"],
 ["a2-land-9-7","full defence-ground footprint: garden"],
 ["a2-land-17-7","full defence-ground footprint: eastLanding"],
 ["a2-land-18-7","full defence-ground footprint: eastLanding"],
 ["a2-land-5-8","full defence-ground footprint: westReturn"],
 ["a2-land-6-8","continuous supported route travel"],
 ["a2-land-7-8","full defence-ground footprint: garden"],
 ["a2-land-8-8","full defence-ground footprint: garden"],
 ["a2-land-9-8","continuous supported route travel"],
 ["a2-land-10-8","continuous supported route travel"],
 ["a2-land-17-8","continuous supported route travel"],
 ["a2-land-18-8","full defence-ground footprint: eastLanding"],
 ["a2-land-6-9","continuous supported route travel"],
 ["a2-land-7-9","continuous supported route travel"],
 ["a2-land-8-9","continuous supported route travel"],
 ["a2-land-9-9","continuous supported route travel"],
 ["a2-land-16-9","full defence-ground footprint: eastLanding"],
 ["a2-land-17-9","continuous supported route travel"],
 ["a2-land-18-9","full defence-ground footprint: eastLanding"],
 ["a2-land-7-10","full defence-ground footprint: garden"],
 ["a2-land-8-10","full defence-ground footprint: garden"],
 ["a2-land-9-10","full defence-ground footprint: garden"],
 ["a2-land-15-10","continuous supported route travel"],
 ["a2-land-16-10","continuous supported route travel"],
 ["a2-land-17-10","continuous supported route travel"],
 ["a2-land-15-11","continuous supported route travel"],
 ["a2-land-16-11","full defence-ground footprint: southCourt"],
 ["a2-land-14-12","full defence-ground footprint: southCourt"],
 ["a2-land-15-12","continuous supported route travel"],
 ["a2-land-16-12","full defence-ground footprint: southCourt"],
 ["a2-land-11-13","continuous supported route travel"],
 ["a2-land-12-13","continuous supported route travel"],
 ["a2-land-13-13","continuous supported route travel"],
 ["a2-land-14-13","continuous supported route travel"],
 ["a2-land-15-13","continuous supported route travel"],
 ["a2-land-10-14","full defence-ground footprint: late"],
 ["a2-land-11-14","continuous supported route travel"],
 ["a2-land-12-14","full defence-ground footprint: southCourt"],
 ["a2-land-13-14","full defence-ground footprint: southCourt"],
 ["a2-land-14-14","full defence-ground footprint: southCourt"],
 ["a2-land-10-15","full defence-ground footprint: late"],
 ["a2-land-11-15","continuous supported route travel"],
 ["a2-land-12-15","full defence-ground footprint: late"],
 ["a2-land-6-2","full placement-ground overview visibility: west-return-5-4"],
 ["a2-land-7-2","full placement-ground overview visibility: west-return-5-4"],
 ["a2-land-3-3","full placement-ground overview visibility: entry-3-4"],
 ["a2-land-7-3","full placement-ground overview visibility: west-return-5-4, west-return-5-5, garden-7-4"],
 ["a2-land-8-4","full placement-ground overview visibility: garden-7-4, garden-7-5"],
 ["a2-land-1-5","full placement-ground overview visibility: entry-1-6"],
 ["a2-land-8-5","full placement-ground overview visibility: garden-7-5"],
 ["a2-land-18-5","full placement-ground overview visibility: east-landing-17-7"],
 ["a2-land-19-5","full placement-ground overview visibility: east-landing-18-7"],
 ["a2-land-17-6","full placement-ground overview visibility: east-landing-17-7"],
 ["a2-land-18-6","full placement-ground overview visibility: east-landing-17-7, east-landing-18-7"],
 ["a2-land-19-6","full placement-ground overview visibility: east-landing-18-7"],
 ["a2-land-7-7","full placement-ground overview visibility: garden-7-8"],
 ["a2-land-8-7","full placement-ground overview visibility: garden-7-8, garden-8-8"],
 ["a2-land-19-7","full placement-ground overview visibility: east-landing-18-7, east-landing-18-8"],
 ["a2-land-17-11","full placement-ground overview visibility: south-court-16-11, south-court-16-12"],
 ["a2-land-18-11","full placement-ground overview visibility: south-court-16-12"],
 ["a2-land-17-12","full placement-ground overview visibility: south-court-16-12"],
 ["a2-land-10-13","full placement-ground overview visibility: late-10-14"]
]);
const sha256=text=>createHash('sha256').update(text).digest('hex');
export function checkA2PathEdges(level){
 const [width,length]=level.size,path=level.path,boundary=([x,,z])=>x===0||z===0||x===width-1||z===length-1;
 if(path.length<2||!boundary(path[0])||!boundary(path.at(-1)))throw new Error('A2 path must enter and exit at level edges.');
 if(path.slice(1,-1).some(boundary))throw new Error('A2 path must not run along a level edge.');
 for(let i=1;i<path.length;i++)if(Math.abs(path[i][0]-path[i-1][0])+Math.abs(path[i][2]-path[i-1][2])!==1)throw new Error('A2 route is not edge-connected.');
 return {entry:[...path[0]],exit:[...path.at(-1)],boundaryBoxes:2,interiorBoxes:path.length-2,edgeRunningSegments:0};
}
export async function carveMoss02(){
 const baselineText=await Bun.file(new URL(A2_BASELINE,root)).text();
 if(sha256(baselineText)!==A2_BASELINE_SHA256)throw new Error('Frozen A2 no longer matches the accepted landscape.');
 const level=JSON.parse(baselineText),original=level.placements,removed=[];
 let [x,z]=A2_PATH_CORNERS[0];level.path=[[x,0,z]];
 for(const [endX,endZ]of A2_PATH_CORNERS.slice(1)){
  if((x===endX)===(z===endZ))throw new Error('A2 corners require nonzero orthogonal segments.');
  while(x!==endX||z!==endZ){x+=Math.sign(endX-x);z+=Math.sign(endZ-z);level.path.push([x,0,z]);}
 }
 level.previewMode='layout';level.bridges=structuredClone(A2_BRIDGES);
 level.placements=original.filter(p=>{const reason=REMOVALS.get(p.id);if(!reason)return true;removed.push({...structuredClone(p),reason});return false;});
 if(removed.length!==REMOVALS.size)throw new Error('Selected A2 removal inventory does not match its baseline.');
 for(const perch of level.previewWildlife.perches)if(!level.placements.some(p=>p.id===perch.id))throw new Error('A2 wildlife perch was removed: '+perch.id);
 validateLevel(level);const edges=checkA2PathEdges(level),field=new TerrainField(level);
 for(const site of A2_DEFENCE_SITES)if(field.flatBox(...site.box)!==level.pathHeight||field.protected(...site.box)||field.bridgeBox(...site.box))throw new Error('A2 candidate must remain naturally dry and outside the route: '+site.id);
 const sourceText=JSON.stringify(level,null,2)+'\n';
 const manifest={id:'moss-02',selectedOption:'garden-crossing',status:'Implemented layout selected by Lead with Artist/Tactician review; user acceptance pending.',baseline:{path:A2_BASELINE,sha256:A2_BASELINE_SHA256},source:{path:'assets/levels/moss-02.json',sha256:sha256(sourceText)},rationale:"A western return leads past the limestone garden and lower grove, then crosses the broad middle of the lake. A short eastern-bank turn descends into a separate southern shoreline court and exit. The bridge separates meaningful western and eastern/southern decisions while leaving open water above and below.",corners:structuredClone(A2_PATH_CORNERS),routes:[{id:'main',boxes:level.path.length,length:(level.path.length-1)*24}],edges,bridges:structuredClone(level.bridges),bridgeGeometry:{thickness:1,top:24,underside:23,waterSurface:20,dryLandings:[[10,8],[17,8]],fullDeckRouteInterval:[516,660],naturalWaterAndBedPreserved:true},sites:structuredClone(A2_DEFENCE_SITES),baselinePlacements:original.length,retainedPlacements:level.placements.length,removed,added:[],moved:[],terrainChanged:false,modelsChanged:false,previewWildlife:structuredClone(level.previewWildlife),limitations:['Layout preview only: no enemies or actual defence units.','All32 candidate boxes offer base-range opportunity and individually fit base/upgrade1 gun and Arc geometry.','The bridge has no defence sites; land-only actual gun/Arc union leaves route522–606 uncovered at base range48 and548–580 at upgraded range72.','Candidate ground is an authoring study, not fixed build pads or a player-placement rule.','Individual clearance does not certify simultaneous adjacent weapon arrangements.','No waves, resources, enemy schedules or campaign balance are assigned.']};
 return {level,manifest};
}
if(import.meta.main){
 const args=process.argv.slice(2);if(args.some(arg=>arg!=='--write'))throw new Error('Usage: bun scripts/a2-path-carving.js [--write]');
 const {level,manifest}=await carveMoss02();
 if(args.includes('--write')){await Bun.write(new URL('assets/levels/moss-02.json',root),JSON.stringify(level,null,2)+'\n');await Bun.write(new URL('docs/a2-path-carving-2026-10-18/moss-02.manifest.json',root),JSON.stringify(manifest,null,2)+'\n');}
 console.log(JSON.stringify({id:level.id,selectedOption:manifest.selectedOption,route:manifest.routes[0],sites:manifest.sites.length,retained:manifest.retainedPlacements,edges:manifest.edges,written:args.includes('--write')}));
}
