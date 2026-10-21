import {productionSceneryModels} from './production-scenery.js';
import {productionLevel} from './production-level.js';
import {validateLevel} from '../shared/level.js';
export const zoneSceneryModels=()=>['B','C','D'].flatMap(productionSceneryModels);
export function zonePreviewLevel(zone){if(zone==='A')throw new Error('Use firstLevel() for Zone A.');return productionLevel(zone);}
if(import.meta.main){
 const models=zoneSceneryModels(),library=new Map(models.map(m=>[m.id,m]));library.set('turret-study',await Bun.file('assets/models/turret-study.json').json());
 const levels=['B','C','D'].map(zonePreviewLevel);for(const level of levels)validateLevel(level,library);
 for(const model of models){const path=`assets/models/${model.id}.json`;if(!await Bun.file(path).exists())await Bun.write(path,JSON.stringify(model,null,2)+'\n');}
 for(const level of levels){const path=`assets/levels/${level.id}.json`;if(!await Bun.file(path).exists())await Bun.write(path,JSON.stringify(level,null,2)+'\n');console.log(`${level.zone}: ${level.path.length} route boxes, ${level.placements.length} placements`);}
 console.log(`${models.length} zone scenery sources; existing files preserved.`);
}
