import {newLevel,defaultEnvironment} from '../../shared/level.js';
import {TerrainField} from '../../shared/terrain.js';
import {defaultWaterMaterial} from '../../shared/water.js';

// Authoring only: explicit landforms and botanical masses, never route data.
export const PROFILES={
 A:{prefix:'moss',sky:'#FFF2D9',ambient:'#B8C8C1',water:'#559B91',tree:'scenery-oak',tall:'scenery-oak-tall',young:'scenery-oak-young',column:'scenery-cypress-short',spire:'scenery-cypress',rock:'scenery-rock',boulder:'scenery-rock',shrub:'scenery-shrub',wall:'scenery-ruin-wall',marker:'scenery-ruin-pillar',tuft:'detail-grass',flowers:'detail-flowers',pebbles:'detail-pebbles',perchPoint:[8,54,8],perchModel:'scenery-oak-tall'},
 B:{prefix:'ochre',sky:'#FFE4BC',ambient:'#D4BBA0',water:'#408B91',tree:'ochre-cactus',tall:'ochre-cactus',young:'ochre-cactus-young',column:'ochre-cactus',spire:'ochre-mesa',rock:'ochre-rock',boulder:'ochre-mesa-low',shrub:'ochre-shrub',wall:'ochre-wall',marker:'ochre-mesa',tuft:'ochre-tuft',flowers:'ochre-flowers',pebbles:'ochre-pebbles',perchPoint:[11,45,11],perchModel:'ochre-cactus'},
 C:{prefix:'ice',sky:'#FFF8EB',ambient:'#C7CFD0',water:'#52899F',tree:'ice-fir',tall:'ice-fir',young:'ice-fir-young',column:'ice-fir-young',spire:'ice-pillar',rock:'ice-rock',boulder:'ice-pillar-broken',shrub:'ice-shrub',wall:'ice-wall',marker:'ice-pillar',tuft:'ice-tuft',flowers:'ice-flowers',pebbles:'ice-pebbles',perchPoint:[11,31,11],perchModel:'ice-fir-young'},
 D:{prefix:'plum',sky:'#FFF8EB',ambient:'#CBCBC5',water:'#5E839B',tree:'plum-tree',tall:'plum-tree-tall',young:'plum-tree-young',column:'plum-tree-young',spire:'plum-arch',rock:'plum-rock',boulder:'plum-arch-broken',shrub:'plum-shrub',wall:'plum-wall',marker:'plum-arch',tuft:'plum-tuft',flowers:'plum-flowers',pebbles:'plum-pebbles',perchPoint:[8,52,16],perchModel:'plum-tree-tall'},
};
const key=(x,z)=>`${x},${z}`;
function noise(x,z,seed,salt=0){let n=Math.imul(x+19,374761393)^Math.imul(z+31,668265263)^Math.imul(seed+salt*97,1442695041);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
export const placementId=(config,x,z)=>`${config.zone.toLowerCase()}${config.number}-land-${x}-${z}`;

export function makeLandscape(config){
 const profile=PROFILES[config.zone],level=newLevel(`${profile.prefix}-${String(config.number).padStart(2,'0')}-landscape`);
 level.name=`${config.name} · uncarved landscape`;level.zone=config.zone;level.size=[...config.size];
 level.environment=defaultEnvironment();level.environment.sky.color=profile.sky;level.environment.sky.ambient=profile.ambient;
 level.waterMaterial={...defaultWaterMaterial(),color:profile.water};
 const field=new TerrainField(level),water=new Set();
 for(const [z,left,right]of config.water)for(let x=left;x<=right;x++)water.add(key(x,z));
 const surface=config.waterSurface??12,[deepBed,shoreBed]=config.waterBeds??[4,8];
 for(const cell of water){const [x,z]=cell.split(',').map(Number),shore=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>!water.has(key(x+dx,z+dz)));field.setBox(x,z,shore?shoreBed:deepBed,surface);}
 for(const [cx,cz,rx,rz,peak]of config.mounds)for(let z=0;z<level.size[1];z++)for(let x=0;x<level.size[0];x++){
  const d=((x-cx)/rx)**2+((z-cz)/rz)**2;
  if(d<=1&&!water.has(key(x,z)))field.setBox(x,z,Math.max(field.flatBox(x,z),d<.28?peak:28),0);
 }
 field.commit();
 const anchors=new Map(config.anchors.map(([kind,x,z,turn=0])=>[key(x,z),{kind,turn}]));
 for(const [x,z,turn=0]of config.perches)anchors.set(key(x,z),{model:profile.perchModel,turn});
 const nearWater=(x,z)=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>water.has(key(x+dx,z+dz)));
 for(let z=0;z<level.size[1];z++)for(let x=0;x<level.size[0];x++){
  if(water.has(key(x,z)))continue;
  const anchor=anchors.get(key(x,z));let kind,model,turn=anchor?.turn??Math.floor(noise(x,z,config.seed,3)*4);
  if(anchor){kind=anchor.kind;model=anchor.model??profile[kind];}
  else{
   let distance=Infinity,groveType='mixed';
   for(const [cx,cz,rx,rz,type='mixed']of config.groves){const d=((x-cx)/rx)**2+((z-cz)/rz)**2;if(d<distance){distance=d;groveType=type;}}
   const n=noise(x,z,config.seed),pick=noise(x,z,config.seed,1);
   if(distance<1.1&&n<.78-.23*Math.min(distance,1)){
    if(groveType==='rock')kind=pick<.3?'marker':pick<.73?'boulder':'rock';
    else if(groveType==='column')kind=pick<.58?'column':pick<.78?'spire':'young';
    else kind=pick<.38?'tree':pick<.74?'young':pick<.87?'tall':'column';
   }else if(nearWater(x,z))kind=n<.4?'rock':n<.68?'shrub':pick<.4?'flowers':'tuft';
   else if(distance<1.48&&n<.76)kind=n<.43?'shrub':'rock';
   else if(n<.07)kind='young';
   else if(n<.20)kind='shrub';
   else if(n<.31)kind='rock';
   else{
    const flowerPatch=config.flowers.some(([cx,cz,rx,rz])=>((x-cx)/rx)**2+((z-cz)/rz)**2<1);
    kind=flowerPatch&&pick<.6?'flowers':pick<.18?'pebbles':'tuft';
   }
   model=profile[kind];
  }
  if(!model)throw new Error(`Unknown landscape model kind ${kind}`);
  const detail=['tuft','flowers','pebbles'].includes(kind);
  level.placements.push({id:placementId(config,x,z),model,variant:'base',box:[x,0,z],turn,...(detail?{kind:'detail',offset:[Math.floor(noise(x,z,config.seed,5)*7)-3,0,Math.floor(noise(x,z,config.seed,6)*7)-3]}:{})});
 }
 for(const [x,z]of config.perches)if(water.has(key(x,z)))throw new Error('Landscape perch enters water.');
 return level;
}
