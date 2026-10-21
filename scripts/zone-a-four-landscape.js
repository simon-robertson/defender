import {newLevel,defaultEnvironment,validateLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
import {defaultWaterMaterial} from '../shared/water.js';

// Landscape-first authoring precursor. No existing layout, route, defence range
// or placement-reservation data enters this factory. Tactical carving is later.
const WIDTH=18,DEPTH=16,key=(x,z)=>`${x},${z}`;
const MODEL={oak:'scenery-oak',tall:'scenery-oak-tall',young:'scenery-oak-young',
 cypress:'scenery-cypress',short:'scenery-cypress-short',rock:'scenery-rock',
 shrub:'scenery-shrub',wall:'scenery-ruin-wall',pillar:'scenery-ruin-pillar',
 grass:'detail-grass',flowers:'detail-flowers',pebbles:'detail-pebbles'};
const LAKE_ROWS=[[1,13,14],[2,12,15],[3,11,16],[4,11,16],[5,12,15],[6,13,14]];
const MOUNDS=[
 [2,1,28],[1,2,28],[2,2,28],[3,2,28],[1,3,28],[2,3,32],[3,3,28],
 [1,4,28],[2,4,32],[3,4,28],[2,5,28],[3,5,28],
 [15,10,28],[14,11,28],[15,11,28],[16,11,28],[14,12,28],[15,12,30],
 [16,12,28],[15,13,28],[16,13,28],
];
// Focal clusters are stonework and botanical composition, not future clearings.
const ANCHORS=[
 ['tall',1,2,2],['tall',16,12,1],['oak',3,14,3],
 ['pillar',9,6,0],['wall',10,6,0],['wall',9,7,1],['pillar',11,7,2],
 ['shrub',10,7,1],['rock',10,8,2],['wall',11,8,0],['pebbles',12,8,1],
 ['pillar',4,11,1],['wall',5,11,1],['rock',5,12,3],['shrub',4,12,0],
 ['rock',0,3,1],['rock',3,1,3],['rock',4,4,2],['rock',1,5,0],
 ['rock',14,10,1],['rock',16,10,3],['rock',17,12,0],['rock',14,13,2],
 ['cypress',16,2,0],['short',17,4,2],['rock',16,6,1],['shrub',12,6,0],
 ['oak',7,2,3],['young',8,3,1],['shrub',8,2,2],['rock',6,3,0],
 ['oak',6,7,1],['young',7,8,3],['shrub',5,8,0],['rock',6,9,2],
 ['oak',14,8,1],['young',15,8,0],['shrub',14,9,2],['rock',16,8,3],
];
const GROVES=[
 [2.0,3.1,3.1,4.0],[7.0,1.8,2.3,2.2],[5.8,6.9,2.3,2.5],
 [2.3,13.1,3.1,2.7],[8.0,12.7,2.5,2.4],[15.4,12.1,2.7,3.0],
 [14.8,8.1,2.4,1.7],[16.7,1.0,1.8,2.4],
];
function noise(x,z,salt=0){let n=Math.imul(x+19,374761393)^Math.imul(z+31,668265263)^Math.imul(salt+7,1442695041);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
function groveDistance(x,z){let d=Infinity;for(const [cx,cz,rx,rz]of GROVES)d=Math.min(d,((x-cx)/rx)**2+((z-cz)/rz)**2);return d;}
function shoreline(water,x,z){for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]])if(water.has(key(x+dx,z+dz)))return true;return false;}
function detailKind(x,z){
 const flowers=((x-10)/3.3)**2+((z-10.5)/2.6)**2<1||((x-4)/2.2)**2+((z-14)/2.0)**2<1;
 const n=noise(x,z,9);return flowers&&n<.58?'flowers':n<.20?'pebbles':'grass';
}

export const ZONE_A_FOUR_LANDSCAPE_INFO=Object.freeze({
 id:'moss-04-landscape',size:Object.freeze([WIDTH,DEPTH]),pathHeight:24,
 snapshot:'docs/zone-a-four-landscape.json',
 perchCandidates:Object.freeze(['a4-land-1-2','a4-land-16-12','a4-land-3-14']),
});

/** Fresh deterministic level data, deliberately with an empty path. */
export function zoneAFourLandscape(){
 const level=newLevel('moss-04-landscape');level.name='The old garden mere · uncarved landscape';
 level.size=[WIDTH,DEPTH];level.environment=defaultEnvironment();level.waterMaterial=defaultWaterMaterial();
 const field=new TerrainField(level),water=new Set();
 for(const [z,left,right]of LAKE_ROWS)for(let x=left;x<=right;x++){
  water.add(key(x,z));field.setBox(x,z,x>=13&&x<=14&&z>=2&&z<=5?4:8,12);
 }
 for(const [x,z,height]of MOUNDS)field.setBox(x,z,height,0);
 field.commit();
 const anchors=new Map(ANCHORS.map(([kind,x,z,turn])=>[key(x,z),{kind,turn}]));
 function place(kind,x,z,turn,suffix='',offset=null){
  const detail=['grass','flowers','pebbles'].includes(kind);
  level.placements.push({id:`a4-land-${x}-${z}${suffix}`,model:MODEL[kind],variant:'base',box:[x,0,z],turn,
   ...(detail?{kind:'detail',offset:offset??[0,0,0]}:{})});
 }
 for(let z=0;z<DEPTH;z++)for(let x=0;x<WIDTH;x++){
  if(water.has(key(x,z)))continue;
  const anchor=anchors.get(key(x,z));if(anchor){place(anchor.kind,x,z,anchor.turn);continue;}
  const d=groveDistance(x,z),n=noise(x,z),nearWater=shoreline(water,x,z);
  let kind;
  if(d<1.15&&n<.82-.28*Math.min(d,1)){
   const pick=noise(x,z,2);kind=pick<.38?'oak':pick<.70?'young':pick<.82?'tall':pick<.93?'short':'cypress';
  }else if(nearWater){kind=n<.36?'shrub':n<.57?'rock':n<.76?'short':detailKind(x,z);}
  else if(d<1.5&&n<.78){kind=n<.48?'shrub':'rock';}
  else if(n<.11){kind='young';}
  else if(n<.28){kind='shrub';}
  else if(n<.39){kind='rock';}
  else kind=detailKind(x,z);
  const turn=Math.floor(noise(x,z,4)*4),detail=['grass','flowers','pebbles'].includes(kind);
  if(detail&&kind!=='pebbles'&&noise(x,z,8)<.4){
   // Two same-rotation small clusters have disjoint X intervals at this spacing.
   place(kind,x,z,turn,'',[-5,0,-4]);place(kind,x,z,turn,'-understory',[5,0,4]);
  }else place(kind,x,z,turn,'',detail?[Math.floor(noise(x,z,5)*9)-4,0,Math.floor(noise(x,z,6)*9)-4]:null);
 }
 return level;
}

/** Author-time proof against existing source geometry, never a runtime pass. */
export async function verifyZoneAFourLandscape(level=zoneAFourLandscape()){
 const ids=[...new Set(level.placements.map(p=>p.model))],models=new Map();
 for(const id of ids){const model=await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json();
  if(model.role!=='scenery'||model.materials.some(m=>m.emission!==0||m.reflectiveness!==0))throw new Error(`Unapproved landscape model/material: ${id}`);models.set(id,model);}
 validateLevel(level,models);
 if(level.path.length||level.placements.some(p=>p.model.includes('turret')||p.model.includes('enemy')))throw new Error('Landscape precursor must remain path/defence/enemy free.');
 if(JSON.stringify(level)!==JSON.stringify(zoneAFourLandscape()))throw new Error('Landscape factory/source disagreement.');
 const field=new TerrainField(level),coverage=new Set(level.placements.map(p=>key(p.box[0],p.box[2]))),counts={flatDry:0,raisedDry:0,water:0};
 for(let z=0;z<DEPTH;z++)for(let x=0;x<WIDTH;x++){
  const height=field.flatBox(x,z);counts[height===null?'water':height===24?'flatDry':'raisedDry']++;
  if(height!==null&&!coverage.has(key(x,z)))throw new Error(`Unpopulated dry landscape box ${x},${z}`);
 }
 const modelCounts=Object.fromEntries(ids.sort().map(id=>[id,level.placements.filter(p=>p.model===id).length]));
 return {id:level.id,size:level.size,pathBoxes:level.path.length,placements:level.placements.length,models:ids.length,terrain:counts,modelCounts,
  perchCandidates:ZONE_A_FOUR_LANDSCAPE_INFO.perchCandidates.map(id=>{const p=level.placements.find(p=>p.id===id);return{id,model:p.model,box:p.box};})};
}

if(import.meta.main){
 const level=zoneAFourLandscape(),report=await verifyZoneAFourLandscape(level),target=new URL('../docs/zone-a-four-landscape.json',import.meta.url);
 if(process.argv.includes('--check')){
  const saved=await Bun.file(target).json();if(JSON.stringify(saved)!==JSON.stringify(level))throw new Error('Saved landscape differs from its factory.');
 }else if(process.argv.includes('--write')||!await Bun.file(target).exists())await Bun.write(target,JSON.stringify(level,null,2)+'\n');
 else throw new Error('Landscape snapshot already exists; use --check or explicit --write.');
 console.log(JSON.stringify(report,null,2));
}
