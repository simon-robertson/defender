import {zoneAFourLandscape} from './zone-a-four-landscape.js';
import {validateLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';

const key=(x,z)=>`${x},${z}`;
export const ZONE_A_FOUR_CORNERS=Object.freeze([[0,8],[3,8],[3,10],[10,10],[10,13],[12,13],[12,7],[17,7]].map(Object.freeze));
export const ZONE_A_FOUR_SITES=Object.freeze([
 {id:'early-entry',box:[2,9],group:'early'},
 {id:'early-turn',box:[4,9],group:'early',placement:'a4-gun'},
 {id:'early-straight',box:[5,9],group:'early'},
 {id:'repeat-upper',box:[11,10],group:'repeat',placement:'a4-arc'},
 {id:'repeat-middle',box:[11,11],group:'repeat'},
 {id:'repeat-turn',box:[11,12],group:'repeat'},
 {id:'late-approach',box:[14,8],group:'late'},
 {id:'late-middle',box:[15,8],group:'late',placement:'a4-silo'},
 {id:'late-exit',box:[16,8],group:'late'},
 {id:'late-opposite',box:[16,6],group:'late'},
].map(site=>Object.freeze({...site,box:Object.freeze(site.box)})));
const DEFENCES=[
 {id:'a4-gun',model:'turret-study',variant:'base',box:[4,0,9],turn:0},
 {id:'a4-generator',model:'power-generator',variant:'base',box:[4,0,8],turn:0},
 {id:'a4-arc',model:'arc-spire',variant:'base',box:[11,0,10],turn:0},
 {id:'a4-silo',model:'missile-launcher',variant:'base',box:[15,0,8],turn:0},
];
// Extra removals are individually justified after checking the carved scene.
const EXTRA_REMOVALS=new Map([
 ['a4-land-7-9','placement-area visibility: canopy masks the early clearing approach at route box 6,10'],
 ['a4-land-11-9','placement-area visibility: canopy masks route turn 10,10 and the Arc clearing'],
 ['a4-land-5-7','placement-area visibility: tall oak obscures early-turn clearing 4,9'],
 ['a4-land-6-7','placement-area visibility: oak obscures early-straight alternative 5,9'],
 ['a4-land-6-8','placement-area visibility: cypress obscures early-straight alternative 5,9'],
 ['a4-land-5-8','placement-area visibility: shrub obscures early clearings 4,9 and 5,9'],
 ['a4-land-6-9','placement-area visibility: rock obscures early clearings 4,9 and 5,9'],
 ['a4-land-16-5','placement-area visibility: rock obscures late-opposite alternative 16,6'],
 ['a4-land-17-8','placement-area visibility: tall oak obscures boundary of late-exit alternative 16,8'],
 ['a4-land-17-4','placement-area visibility: cypress obscures boundary of late-opposite alternative 16,6'],
 ['a4-land-17-6','placement-area visibility: grass obscures boundary of late-opposite alternative 16,6'],
]);

function carve(){
 const level=zoneAFourLandscape(),reasons=new Map();
 level.id='moss-04';level.name='The old garden mere';
 let [x,z]=ZONE_A_FOUR_CORNERS[0];level.path=[[x,0,z]];
 for(const [endX,endZ]of ZONE_A_FOUR_CORNERS.slice(1)){
  if((x===endX)===(z===endZ))throw new Error('A4 corners require nonzero orthogonal segments.');
  while(x!==endX||z!==endZ){x+=Math.sign(endX-x);z+=Math.sign(endZ-z);level.path.push([x,0,z]);}
 }
 for(const [x,,z]of level.path)reasons.set(key(x,z),'route');
 for(const site of ZONE_A_FOUR_SITES){
  if(reasons.has(key(...site.box)))throw new Error('A4 defence clearing enters the route.');
  reasons.set(key(...site.box),`${site.group} defence clearing`);
 }
 reasons.set('4,8','generator support');
 const removed=[],retained=[];
 for(const placement of level.placements){
  const reason=EXTRA_REMOVALS.get(placement.id)??reasons.get(key(placement.box[0],placement.box[2]));
  if(reason)removed.push({id:placement.id,model:placement.model,box:placement.box.slice(),reason});else retained.push(placement);
 }
 const before=level.placements.length;level.placements=[...retained,...structuredClone(DEFENCES)];
 return {level,manifest:{baselinePlacements:before,retainedPlacements:retained.length,removed,added:structuredClone(DEFENCES),moved:[],terrainChanged:false}};
}

export const zoneAFourLevel=()=>carve().level;
export const zoneAFourRemovalManifest=()=>carve().manifest;

if(import.meta.main){
 const args=process.argv.slice(2);
 if(args.some(arg=>arg!=='--write'))throw new Error('Usage: bun scripts/zone-a-four.js [--write]');
 const file=new URL('../assets/levels/moss-04.json',import.meta.url);
 if(!args.includes('--write')&&await Bun.file(file).exists())console.log('moss-04: existing authored source preserved. Use --write for an explicit rebuild.');
 else{
  const {level,manifest}=carve(),models=new Map();
  for(const id of new Set(level.placements.map(p=>p.model)))models.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
  validateLevel(level,models);const world=buildWorld(level,models);disposeWorld(world);
  await Bun.write(file,JSON.stringify(level,null,2)+'\n');
  console.log(JSON.stringify({id:level.id,pathBoxes:level.path.length,routeLength:(level.path.length-1)*24,placements:level.placements.length,removed:manifest.removed.length,retained:manifest.retainedPlacements}));
 }
}
