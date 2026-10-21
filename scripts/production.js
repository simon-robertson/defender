// Explicit rebuild only. Normal seed commands still preserve authored files.
import {mkdir} from 'node:fs/promises';
import {productionSceneryModels} from './production-scenery.js';
import {productionLevel} from './production-level.js';
import {firstLevel} from './first-level.js';
import {validateLevel} from '../shared/level.js';
import {compileModel} from '../shared/mesher.js';

const args=process.argv.slice(2),zoneArgs=args.filter(arg=>arg.startsWith('--zone='));
if(zoneArgs.length>1||args.some(arg=>arg!=='--write'&&!/^--zone=[ABCD]$/.test(arg)))throw new Error('Usage: bun scripts/production.js [--zone=A|B|C|D] [--write]');
const selectedZone=zoneArgs[0]?.slice(7),zones=selectedZone?[selectedZone]:['A','B','C','D'];
const models=productionSceneryModels(selectedZone),library=new Map(models.map(m=>[m.id,m]));
library.set('turret-study',await Bun.file('assets/models/turret-study.json').json());
if(zones.includes('A'))library.set('power-generator',await Bun.file('assets/models/power-generator.json').json());
const levels=zones.map(zone=>zone==='A'?firstLevel():productionLevel(zone));
for(const level of levels)validateLevel(level,library);
const meshes=models.map(compileModel);
if(process.argv.includes('--write')){
 await mkdir('build/models',{recursive:true});
 for(let i=0;i<models.length;i++){
  await Bun.write(`assets/models/${models[i].id}.json`,JSON.stringify(models[i],null,2)+'\n');
  await Bun.write(`build/models/${models[i].id}.mesh.json`,JSON.stringify(meshes[i]));
 }
 for(const level of levels)await Bun.write(`assets/levels/${level.id}.json`,JSON.stringify(level,null,2)+'\n');
}
console.log(JSON.stringify({written:process.argv.includes('--write'),models:models.length,uniqueSceneryQuads:meshes.reduce((sum,m)=>sum+m.variants.base.parts.reduce((n,p)=>n+p.quads,0),0),levels:levels.map(l=>({id:l.id,size:l.size,path:l.path.length,placements:l.placements.length}))},null,2));
