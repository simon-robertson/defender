import {productionSceneryModels} from './production-scenery.js';
import {productionLevel} from './production-level.js';
import {validateLevel} from '../shared/level.js';
export {builder} from './model-builder.js';
export const sceneryModels=()=>productionSceneryModels('A');
// The shared production layout remains the unchanged template for A2/A3.
// This approved visual placement belongs only to the first Zone A level.
export function firstLevel(){
 const level=productionLevel('A');
 level.placements.push({id:'power-generator-1',model:'power-generator',variant:'base',box:[3,0,6],turn:0});
 return level;
}
if(import.meta.main){
 const models=sceneryModels(),level=firstLevel(),library=new Map(models.map(m=>[m.id,m]));
 for(const id of ['turret-study','power-generator'])library.set(id,await Bun.file(`assets/models/${id}.json`).json());validateLevel(level,library);
 for(const model of models){const path=`assets/models/${model.id}.json`;if(!await Bun.file(path).exists())await Bun.write(path,JSON.stringify(model,null,2)+'\n');}
 const path=`assets/levels/${level.id}.json`;if(!await Bun.file(path).exists())await Bun.write(path,JSON.stringify(level,null,2)+'\n');
 console.log(`First level: ${level.path.length} route boxes, ${level.placements.length} placements, ${models.length} scenery models. Existing files preserved.`);
}
