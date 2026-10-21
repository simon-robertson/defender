import {productionLevel} from './production-level.js';
import {validateLevel} from '../shared/level.js';

const variants=['base','upgrade1','upgrade2'];

// Keep the accepted environments comparable with the turret and Arc studies.
export function missileLauncherLevel(zone){
 const level=productionLevel(zone);
 level.id=level.id.replace(/-01$/,'-03');
 level.name+=' · Missile launcher study';
 const sites=level.placements.filter(placement=>placement.model==='turret-study');
 if(sites.length!==variants.length)throw new Error('Missile launcher study requires three existing defence sites.');
 sites.forEach((placement,index)=>{placement.model='missile-launcher';placement.variant=variants[index];});
 return level;
}

if(import.meta.main){
 const args=process.argv.slice(2);
 if(args.some(arg=>arg!=='--write'))throw new Error('Usage: bun scripts/missile-launcher-levels.js [--write]');
 for(const zone of ['A','B','C','D']){
  const level=missileLauncherLevel(zone),path=new URL(`../assets/levels/${level.id}.json`,import.meta.url);
  if(!args.includes('--write')&&await Bun.file(path).exists()){
   console.log(`${level.id}: existing authored source preserved. Use --write for an explicit rebuild.`);
   continue;
  }
  const ids=[...new Set(level.placements.map(placement=>placement.model))];
  const models=await Promise.all(ids.map(id=>Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()));
  validateLevel(level,new Map(models.map(model=>[model.id,model])));
  await Bun.write(path,JSON.stringify(level,null,2)+'\n');
  console.log(`Created assets/levels/${level.id}.json`);
 }
}
