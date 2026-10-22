import {buildWorld,disposeWorld} from '../engine/world.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {connectedWildlifePoints} from '../play/placement.js';
import {pathBoxUnion} from '../shared/routes.js';

// Current authoring target: seven ground animals and two birds (nine total,
// down from twelve). Keep dispersed, already-certified seeds; retain legacy
// landscape factories and archived populations without rewriting them.
function reducePopulation(level){
 const wildlife=level.previewWildlife;
 if(wildlife.habitats.length===9){
  const keep=[0,1,2,3,4,6,8];
  wildlife.habitats=keep.map(i=>wildlife.habitats[i]);
  if(wildlife.habitatPoints)wildlife.habitatPoints=keep.map(i=>wildlife.habitatPoints[i]);
 }
 wildlife.perches=wildlife.perches.slice(0,2);
}
export async function denserWildlife(level){
 if(!level.previewWildlife)return;
 if([7,9].includes(level.previewWildlife.habitats.length)){reducePopulation(level);return;}
 const actors=wildlifeActorsForLevel(level),models=new Map();
 for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model),...(level.previewActors??[]).map(a=>a.modelId)]))models.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 const world=buildWorld(level,models,{actors});let wildlife;
 try{
  wildlife=new WildlifePreview(world,()=>{},actors);const grounds=wildlife.states.filter(s=>s.kind==='ground'),paths=pathBoxUnion(level),homes=grounds.map(s=>[s.x,s.y,s.z]);
  for(let i=0;i<6;i++){
   const box=paths[Math.floor((i+.5)*paths.length/6)];
   homes.push(box?[(box[0]+.5)*24+(i%2?24:-24),level.pathHeight,(box[2]+.5)*24]:homes[i%3]);
  }
  const points=connectedWildlifePoints(wildlife.nav,homes,Math.max(...grounds.map(s=>s.radius)),{offPath:true});
  if(!points)throw new Error('No safe increased wildlife population: '+level.id);
  level.previewWildlife.habitatPoints=points;level.previewWildlife.habitats=points.map(([x,,z])=>[Math.floor(x/24),Math.floor(z/24)]);
 }finally{wildlife?.dispose();disposeWorld(world);}
 reducePopulation(level);
}
