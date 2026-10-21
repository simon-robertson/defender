import {newLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
import {defaultWaterMaterial} from '../shared/water.js';
import {productionLayout} from './production-layouts.js';

const profiles={
 A:{id:'moss-01',name:'The old waterway',sky:'#FFF2D9',ambient:'#B8C8C1',water:'#4E8F91',models:{tree:'scenery-oak',treeTall:'scenery-oak-tall',column:'scenery-cypress',wall:'scenery-ruin-wall',landmark:'scenery-ruin-pillar',rock:'scenery-rock',shrub:'scenery-shrub',tuft:'detail-grass',flowers:'detail-flowers',pebbles:'detail-pebbles',treeYoung:'scenery-oak-young',columnShort:'scenery-cypress-short'}},
 B:{id:'ochre-01',name:'The sunken aqueduct',sky:'#FFE4BC',ambient:'#D4BBA0',water:'#408B91',models:{tree:'ochre-cactus',treeTall:'ochre-mesa',column:'ochre-cactus',wall:'ochre-wall',landmark:'ochre-mesa',rock:'ochre-rock',shrub:'ochre-shrub',tuft:'ochre-tuft',flowers:'ochre-flowers',pebbles:'ochre-pebbles',treeYoung:'ochre-cactus-young',landmarkLow:'ochre-mesa-low'}},
 C:{id:'ice-01',name:'The frostwater pass',sky:'#FFF8EB',ambient:'#C7CFD0',water:'#52899F',models:{tree:'ice-fir',treeTall:'ice-fir',column:'ice-pillar',wall:'ice-wall',landmark:'ice-pillar',rock:'ice-rock',shrub:'ice-shrub',tuft:'ice-tuft',flowers:'ice-flowers',pebbles:'ice-pebbles',treeYoung:'ice-fir-young',landmarkLow:'ice-pillar-broken'}},
 D:{id:'plum-01',name:'The violet cloister',sky:'#FFF8EB',ambient:'#CBCBC5',water:'#5E839B',models:{tree:'plum-tree',treeTall:'plum-tree-tall',column:'plum-arch',wall:'plum-wall',landmark:'plum-arch',rock:'plum-rock',shrub:'plum-shrub',tuft:'plum-tuft',flowers:'plum-flowers',pebbles:'plum-pebbles',treeYoung:'plum-tree-young',landmarkLow:'plum-arch-broken'}},
};

export function productionLevel(zone){
 const profile=profiles[zone];if(!profile)throw new Error('Unknown production zone.');
 const layout=productionLayout(zone),level=newLevel(profile.id);level.zone=zone;level.name=profile.name;level.size=layout.size.slice();
 let [x,z]=layout.corners[0];level.path.push([x,0,z]);
 for(const [endX,endZ] of layout.corners.slice(1)){
  if(x!==endX&&z!==endZ)throw new Error('Route segments must be orthogonal.');
  while(x!==endX||z!==endZ){x+=Math.sign(endX-x);z+=Math.sign(endZ-z);level.path.push([x,0,z]);}
 }
 level.environment={timeOfDay:10.5,weather:{enabled:false},sky:{direction:[-.65,1,-.45],color:profile.sky,intensity:.88,ambient:profile.ambient,ambientIntensity:.48}};
 level.waterMaterial={...defaultWaterMaterial(),...(zone==='A'?{}:{color:profile.water})};
 const terrain=new TerrainField(level);
 for(const [x,z,ground,surface] of layout.water)terrain.setBox(x,z,ground,surface);
 for(const [x,z,height] of layout.mounds)terrain.setBox(x,z,height,0);
 terrain.commit();
 let id=0;const used=new Set(level.path.map(([x,,z])=>x+','+z)),clear=new Set(layout.clear.map(([x,z])=>x+','+z));
 for(const [x,z] of layout.clear){
  if(x<0||z<0||x>=level.size[0]||z>=level.size[1]||used.has(x+','+z)||terrain.flatBox(x,z)!==level.pathHeight)throw new Error('Reserved deployment ground must be in bounds, dry, flat and off the route.');
 }
 function place(model,x,z,turn=0,variant='base',offset=null){
  const key=x+','+z;if(used.has(key))throw new Error('Duplicate or route placement at '+key);
  if(!offset)used.add(key);
  level.placements.push({id:'scene-'+(++id),model,variant,box:[x,0,z],turn,...(offset?{kind:'detail',offset:offset.slice()}:{})});
 }
 layout.towers.forEach(([x,z],i)=>place('turret-study',x,z,0,i===1?'upgrade1':'base'));
 for(const item of [...layout.scenery,...layout.details]){
  if(clear.has(item.x+','+item.z))throw new Error('Scenery consumes reserved deployment ground.');
  const model=item.model??profile.models[item.kind];if(!model)throw new Error('Unknown scenery kind: '+item.kind);
  place(model,item.x,item.z,item.turn??0,'base',item.offset??null);
 }
 return level;
}
