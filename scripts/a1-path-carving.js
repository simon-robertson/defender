// User-approved Southern Hook, A1 only. No audit work runs in this factory.
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
export const A1_BASELINE="backups/pre-path-carving-2026-10-18T17-00-34-263Z/assets/levels/moss-01.json";
export const A1_BASELINE_SHA256="1d6301db7b573c33b74ae5f0f041b246a1c843ab10715136836e9d4f7517a347";
export const A1_PATH_CORNERS=Object.freeze([[0,8],[5,8],[5,12],[10,12],[10,5],[14,5],[14,8],[12,8],[12,10],[19,10]].map(Object.freeze));
export const A1_DEFENCE_SITES=Object.freeze([
 {
  "id": "west-1-7",
  "group": "west",
  "box": [
   1,
   7
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "west-2-7",
  "group": "west",
  "box": [
   2,
   7
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "west-3-7",
  "group": "west",
  "box": [
   3,
   7
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "west-4-7",
  "group": "west",
  "box": [
   4,
   7
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "west-4-9",
  "group": "west",
  "box": [
   4,
   9
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "west-4-10",
  "group": "west",
  "box": [
   4,
   10
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "west-4-11",
  "group": "west",
  "box": [
   4,
   11
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "south-6-10",
  "group": "south",
  "box": [
   6,
   10
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "south-6-11",
  "group": "south",
  "box": [
   6,
   11
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "south-7-10",
  "group": "south",
  "box": [
   7,
   10
  ],
  "coverageRole": "upgrade-dependent"
 },
 {
  "id": "south-7-11",
  "group": "south",
  "box": [
   7,
   11
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "south-8-10",
  "group": "south",
  "box": [
   8,
   10
  ],
  "coverageRole": "upgrade-dependent"
 },
 {
  "id": "south-8-11",
  "group": "south",
  "box": [
   8,
   11
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "south-9-10",
  "group": "south",
  "box": [
   9,
   10
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "south-9-11",
  "group": "south",
  "box": [
   9,
   11
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "south-7-13",
  "group": "south",
  "box": [
   7,
   13
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "south-8-13",
  "group": "south",
  "box": [
   8,
   13
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "south-9-13",
  "group": "south",
  "box": [
   9,
   13
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "north-return-11-6",
  "group": "north-return",
  "box": [
   11,
   6
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "north-return-12-6",
  "group": "north-return",
  "box": [
   12,
   6
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "north-return-13-6",
  "group": "north-return",
  "box": [
   13,
   6
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "north-return-11-7",
  "group": "north-return",
  "box": [
   11,
   7
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "north-return-12-7",
  "group": "north-return",
  "box": [
   12,
   7
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "north-return-13-7",
  "group": "north-return",
  "box": [
   13,
   7
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "late-13-9",
  "group": "late",
  "box": [
   13,
   9
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "late-14-9",
  "group": "late",
  "box": [
   14,
   9
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "late-15-9",
  "group": "late",
  "box": [
   15,
   9
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "late-16-9",
  "group": "late",
  "box": [
   16,
   9
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "late-17-9",
  "group": "late",
  "box": [
   17,
   9
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "late-18-9",
  "group": "late",
  "box": [
   18,
   9
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "late-15-11",
  "group": "late",
  "box": [
   15,
   11
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "late-16-11",
  "group": "late",
  "box": [
   16,
   11
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "late-17-11",
  "group": "late",
  "box": [
   17,
   11
  ],
  "coverageRole": "base-useful"
 },
 {
  "id": "late-18-11",
  "group": "late",
  "box": [
   18,
   11
  ],
  "coverageRole": "base-useful"
 }
].map(s=>Object.freeze({...s,box:Object.freeze(s.box),weaponSuitability:Object.freeze({turretBase:true,turretUpgrade1:s.id!=='late-17-11',arcBase:true,arcUpgrade1:true})})));
const REMOVALS=new Map([
 [
  "a1-land-10-5",
  "continuous dry route travel"
 ],
 [
  "a1-land-11-5",
  "continuous dry route travel"
 ],
 [
  "a1-land-12-5",
  "continuous dry route travel"
 ],
 [
  "a1-land-13-5",
  "continuous dry route travel"
 ],
 [
  "a1-land-14-5",
  "continuous dry route travel"
 ],
 [
  "a1-land-10-6",
  "continuous dry route travel"
 ],
 [
  "a1-land-11-6",
  "full defence-ground footprint: north-return"
 ],
 [
  "a1-land-12-6",
  "full defence-ground footprint: north-return"
 ],
 [
  "a1-land-13-6",
  "full defence-ground footprint: north-return"
 ],
 [
  "a1-land-14-6",
  "continuous dry route travel"
 ],
 [
  "a1-land-1-7",
  "full defence-ground footprint: west"
 ],
 [
  "a1-land-2-7",
  "full defence-ground footprint: west"
 ],
 [
  "a1-land-3-7",
  "full defence-ground footprint: west"
 ],
 [
  "a1-land-4-7",
  "full defence-ground footprint: west"
 ],
 [
  "a1-land-10-7",
  "continuous dry route travel"
 ],
 [
  "a1-land-11-7",
  "full defence-ground footprint: north-return"
 ],
 [
  "a1-land-12-7",
  "full defence-ground footprint: north-return"
 ],
 [
  "a1-land-13-7",
  "full defence-ground footprint: north-return"
 ],
 [
  "a1-land-14-7",
  "continuous dry route travel"
 ],
 [
  "a1-land-0-8",
  "continuous dry route travel"
 ],
 [
  "a1-land-1-8",
  "continuous dry route travel"
 ],
 [
  "a1-land-2-8",
  "continuous dry route travel"
 ],
 [
  "a1-land-3-8",
  "continuous dry route travel"
 ],
 [
  "a1-land-4-8",
  "continuous dry route travel"
 ],
 [
  "a1-land-5-8",
  "continuous dry route travel"
 ],
 [
  "a1-land-10-8",
  "continuous dry route travel"
 ],
 [
  "a1-land-12-8",
  "continuous dry route travel"
 ],
 [
  "a1-land-13-8",
  "continuous dry route travel"
 ],
 [
  "a1-land-14-8",
  "continuous dry route travel"
 ],
 [
  "a1-land-4-9",
  "full defence-ground footprint: west"
 ],
 [
  "a1-land-5-9",
  "continuous dry route travel"
 ],
 [
  "a1-land-10-9",
  "continuous dry route travel"
 ],
 [
  "a1-land-12-9",
  "continuous dry route travel"
 ],
 [
  "a1-land-13-9",
  "full defence-ground footprint: late"
 ],
 [
  "a1-land-14-9",
  "full defence-ground footprint: late"
 ],
 [
  "a1-land-15-9",
  "full defence-ground footprint: late"
 ],
 [
  "a1-land-16-9",
  "full defence-ground footprint: late"
 ],
 [
  "a1-land-17-9",
  "full defence-ground footprint: late"
 ],
 [
  "a1-land-18-9",
  "full defence-ground footprint: late"
 ],
 [
  "a1-land-4-10",
  "full defence-ground footprint: west"
 ],
 [
  "a1-land-5-10",
  "continuous dry route travel"
 ],
 [
  "a1-land-6-10",
  "full defence-ground footprint: south"
 ],
 [
  "a1-land-7-10",
  "full defence-ground footprint: south"
 ],
 [
  "a1-land-8-10",
  "full defence-ground footprint: south"
 ],
 [
  "a1-land-9-10",
  "full defence-ground footprint: south"
 ],
 [
  "a1-land-10-10",
  "continuous dry route travel"
 ],
 [
  "a1-land-12-10",
  "continuous dry route travel"
 ],
 [
  "a1-land-13-10",
  "continuous dry route travel"
 ],
 [
  "a1-land-14-10",
  "continuous dry route travel"
 ],
 [
  "a1-land-15-10",
  "continuous dry route travel"
 ],
 [
  "a1-land-16-10",
  "continuous dry route travel"
 ],
 [
  "a1-land-17-10",
  "continuous dry route travel"
 ],
 [
  "a1-land-18-10",
  "continuous dry route travel"
 ],
 [
  "a1-land-19-10",
  "continuous dry route travel"
 ],
 [
  "a1-land-4-11",
  "full defence-ground footprint: west"
 ],
 [
  "a1-land-5-11",
  "continuous dry route travel"
 ],
 [
  "a1-land-6-11",
  "full defence-ground footprint: south"
 ],
 [
  "a1-land-7-11",
  "full defence-ground footprint: south"
 ],
 [
  "a1-land-8-11",
  "full defence-ground footprint: south"
 ],
 [
  "a1-land-9-11",
  "full defence-ground footprint: south"
 ],
 [
  "a1-land-10-11",
  "continuous dry route travel"
 ],
 [
  "a1-land-15-11",
  "full defence-ground footprint: late"
 ],
 [
  "a1-land-16-11",
  "full defence-ground footprint: late"
 ],
 [
  "a1-land-17-11",
  "full defence-ground footprint: late"
 ],
 [
  "a1-land-18-11",
  "full defence-ground footprint: late"
 ],
 [
  "a1-land-5-12",
  "continuous dry route travel"
 ],
 [
  "a1-land-6-12",
  "continuous dry route travel"
 ],
 [
  "a1-land-7-12",
  "continuous dry route travel"
 ],
 [
  "a1-land-8-12",
  "continuous dry route travel"
 ],
 [
  "a1-land-9-12",
  "continuous dry route travel"
 ],
 [
  "a1-land-10-12",
  "continuous dry route travel"
 ],
 [
  "a1-land-7-13",
  "full defence-ground footprint: south"
 ],
 [
  "a1-land-8-13",
  "full defence-ground footprint: south"
 ],
 [
  "a1-land-9-13",
  "full defence-ground footprint: south"
 ],
 [
  "a1-land-2-4",
  "full placement-ground overview visibility: west-1-7"
 ],
 [
  "a1-land-14-4",
  "full placement-ground overview visibility: north-return-12-6, north-return-13-6"
 ],
 [
  "a1-land-2-5",
  "full placement-ground overview visibility: west-1-7"
 ],
 [
  "a1-land-3-5",
  "full placement-ground overview visibility: west-1-7, west-2-7"
 ],
 [
  "a1-land-4-5",
  "full placement-ground overview visibility: west-2-7, west-3-7"
 ],
 [
  "a1-land-1-6",
  "full placement-ground overview visibility: west-1-7"
 ],
 [
  "a1-land-2-6",
  "full placement-ground overview visibility: west-1-7, west-2-7"
 ],
 [
  "a1-land-3-6",
  "full placement-ground overview visibility: west-2-7, west-3-7"
 ],
 [
  "a1-land-5-7",
  "full placement-ground overview visibility: west-4-7"
 ],
 [
  "a1-land-17-7",
  "full placement-ground overview visibility: late-16-9"
 ],
 [
  "a1-land-7-8",
  "full placement-ground overview visibility: south-6-10"
 ],
 [
  "a1-land-8-8",
  "full placement-ground overview visibility: south-6-10, south-7-10"
 ],
 [
  "a1-land-9-8",
  "full placement-ground overview visibility: south-7-10, south-8-10"
 ],
 [
  "a1-land-6-9",
  "full placement-ground overview visibility: south-6-10"
 ],
 [
  "a1-land-7-9",
  "full placement-ground overview visibility: south-6-10, south-6-11, south-7-10"
 ],
 [
  "a1-land-8-9",
  "full placement-ground overview visibility: south-6-10, south-6-11, south-7-10, south-7-11, south-8-10"
 ],
 [
  "a1-land-9-9",
  "full placement-ground overview visibility: south-7-10, south-7-11, south-8-10, south-8-11, south-9-10"
 ]
]);
const sha256=text=>createHash('sha256').update(text).digest('hex');
export function checkA1PathEdges(level){
 const [width,length]=level.size,boundary=([x,,z])=>x===0||z===0||x===width-1||z===length-1,path=level.path;
 if(path.length<2||!boundary(path[0])||!boundary(path.at(-1)))throw new Error('A1 path must enter and exit at level edges.');
 if(path.slice(1,-1).some(boundary))throw new Error('A1 path must not run along a level edge.');
 for(let i=1;i<path.length;i++)if(Math.abs(path[i][0]-path[i-1][0])+Math.abs(path[i][2]-path[i-1][2])!==1)throw new Error('A1 route is not edge-connected.');
 return {entry:[...path[0]],exit:[...path.at(-1)],boundaryBoxes:2,interiorBoxes:path.length-2,edgeRunningSegments:0};
}
export async function carveMoss01(){
 const baselineText=await Bun.file(new URL(A1_BASELINE,root)).text();
 if(sha256(baselineText)!==A1_BASELINE_SHA256)throw new Error('Frozen A1 backup no longer matches the approved baseline.');
 const level=JSON.parse(baselineText),original=level.placements,removed=[];
 let [x,z]=A1_PATH_CORNERS[0];level.path=[[x,0,z]];
 for(const [endX,endZ]of A1_PATH_CORNERS.slice(1)){
  if((x===endX)===(z===endZ))throw new Error('A1 corners require nonzero orthogonal segments.');
  while(x!==endX||z!==endZ){x+=Math.sign(endX-x);z+=Math.sign(endZ-z);level.path.push([x,0,z]);}
 }
 level.previewMode='layout';
 level.placements=original.filter(p=>{const reason=REMOVALS.get(p.id);if(!reason)return true;removed.push({...structuredClone(p),reason});return false;});
 if(removed.length!==REMOVALS.size)throw new Error('Approved A1 removal inventory does not match its baseline.');
 for(const perch of level.previewWildlife.perches)if(!level.placements.some(p=>p.id===perch.id))throw new Error('A1 wildlife perch was removed: '+perch.id);
 const edges=checkA1PathEdges(level),sourceText=JSON.stringify(level,null,2)+'\n';
 const manifest={id:'moss-01',selectedOption:'southern-hook',status:'User-approved visual layout; offline technical evidence is separate.',baseline:{path:A1_BASELINE,sha256:A1_BASELINE_SHA256},source:{path:'assets/levels/moss-01.json',sha256:sha256(sourceText)},rationale:"The user-approved route bends south from the west entrance through the southwest orchard, crosses a broad southern court, returns north into the limestone and eastern orchard, then curls back to an independent eastern exit. Distinct entry, inner-turn, separated return, upgraded-range and late-catch positions share generous visible ground. The approved wider central meadow replaces the former central six-tree mass; both raised northern knolls, all limestone pieces and the supported wildlife perches remain.",corners:A1_PATH_CORNERS.map(p=>[...p]),routes:[{id:'main',boxes:level.path.length,length:(level.path.length-1)*24}],edges,sites:A1_DEFENCE_SITES.map(s=>({...s,box:[...s.box]})),baselinePlacements:original.length,retainedPlacements:level.placements.length,removed,added:[],moved:[],terrainChanged:false,modelsChanged:false,previewWildlife:structuredClone(level.previewWildlife),limitations:['No enemies or actual defence units are saved; this is a layout preview.','32 candidate boxes offer base48-range opportunities; [7,10] and [8,10] require upgrade72 range.','Candidate plots are authoring evidence, not fixed build pads or a player-placement rule.','[17,11] permits the base gun and Arc probes, but upgrade1 gun yaw intersects a retained canopy; use another site for that upgrade.','Individual weapon clearance does not certify simultaneous adjacent arrangements.','No waves, resources, enemy schedules or campaign balance are assigned.']};
 return {level,manifest};
}
if(import.meta.main){
 const args=process.argv.slice(2);if(args.some(arg=>arg!=='--write'))throw new Error('Usage: bun scripts/a1-path-carving.js [--write]');
 const {level,manifest}=await carveMoss01();
 if(args.includes('--write')){await Bun.write(new URL('assets/levels/moss-01.json',root),JSON.stringify(level,null,2)+'\n');await Bun.write(new URL('docs/a1-path-carving-2026-10-18/moss-01.manifest.json',root),JSON.stringify(manifest,null,2)+'\n');}
 console.log(JSON.stringify({id:level.id,selectedOption:manifest.selectedOption,route:manifest.routes[0],sites:manifest.sites.length,retained:manifest.retainedPlacements,edges:manifest.edges,written:args.includes('--write')}));
}
