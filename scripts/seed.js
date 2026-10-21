import {mkdir} from 'node:fs/promises';
import {turretModel as turretStudy} from './turret.js';
import {newLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
const root=new URL('../assets/',import.meta.url).pathname;
// Keep the original public name and asset ID for existing tests and level references.
export {turretModel as turretStudy} from './turret.js';
export function layoutStudy(){
  const level=newLevel('layout-study');level.name='Layout study';level.size=[8,6];
  level.placements=['base','upgrade1','upgrade2'].map((variant,i)=>({id:`turret-${i+1}`,model:'turret-study',variant,box:[2+i*2,0,2],turn:0}));
  for(let x=0;x<8;x++)level.path.push([x,0,1]);
  level.path.push([7,0,2],[7,0,3]);for(let x=6;x>=0;x--)level.path.push([x,0,3]);
  return level;
}
export function terrainStudy(){
  const level=newLevel('terrain-study');level.name='Terrain study · stream & mounds';level.size=[8,6];
  level.path=Array.from({length:8},(_,x)=>[x,0,3]);
  level.placements=['base','upgrade1','upgrade2'].map((variant,i)=>({id:`turret-${i+1}`,model:'turret-study',variant,box:[2+i*2,0,1],turn:0}));
  const f=new TerrainField(level);
  // Terrain regions use the same 24x24 grid as placements and the route.
  f.setBox(4,0,32,0);f.setBox(6,0,40,0);
  for(let x=0;x<8;x++)f.setBox(x,4,4,12);
  f.commit();return level;
}
if(import.meta.main){
  for(const kind of ['models','levels'])await mkdir(root+kind,{recursive:true});
  for(const [kind,asset]of [['models',turretStudy()],['levels',layoutStudy()],['levels',terrainStudy()]]){
    const path=`${root}${kind}/${asset.id}.json`;if(!await Bun.file(path).exists()){await Bun.write(path,JSON.stringify(asset,null,2)+'\n');console.log(`Created ${kind}/${asset.id}.json`);}else console.log(`Kept existing ${kind}/${asset.id}.json`);
  }
}
