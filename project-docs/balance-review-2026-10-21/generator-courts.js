// Bounded legal court survey. No runtime/source mutations or browser activity.
import {PLAY_CONFIG} from '../../play/config.js';
import {createPlacementRules} from '../../play/placement.js';
import {wildlifeActorsForLevel} from '../../game/wildlife-preview.js';
import {createHash} from 'node:crypto';
const ROOT=new URL('../../',import.meta.url),E='power-generator',families=['turret-study','arc-spire','missile-launcher'],models=new Map(),rows=[];
for(const l of PLAY_CONFIG.levels){
 const source=await Bun.file(new URL('assets/levels/'+l.id+'.json',ROOT)).json();
 for(const id of new Set([...source.placements.map(p=>p.model),...Object.keys(PLAY_CONFIG.defences),...Object.keys(PLAY_CONFIG.enemies),...wildlifeActorsForLevel(source).map(a=>a.model)]))if(!models.has(id))models.set(id,await Bun.file(new URL('assets/models/'+id+'.json',ROOT)).json());
 const rules=createPlacementRules(source,models,{config:PLAY_CONFIG}),courts=[];
 try{for(let z=0;z<source.size[1];z++)for(let x=0;x<source.size[0];x++){
  const box=[x,0,z],gen={id:'survey-gen',model:E,variant:'base',box,turn:0};if(!rules.check(box,'base',[],gen.id,E).valid)continue;
  const spokes=[[x-1,0,z],[x+1,0,z],[x,0,z-1],[x,0,z+1]],variants={};
  for(const family of families){const eligible=[];for(let i=0;i<4;i++){const p={id:'survey-'+i,model:family,variant:'upgrade2',box:spokes[i],turn:0};if(rules.check(p.box,p.variant,[gen,...eligible],p.id,p.model).valid)eligible.push(p);}variants[family]={count:eligible.length,spokes:eligible.map(p=>p.box)};}
  courts.push({box,variants});
 }}finally{rules.dispose();}
 rows.push({level:l.id,generatorCells:courts.length,maxByFamily:Object.fromEntries(families.map(f=>[f,Math.max(0,...courts.map(c=>c.variants[f].count))])),courts});
 console.log(JSON.stringify({...rows.at(-1),courts:undefined}));
}
const paths=['docs/balance-review-2026-10-21/generator-courts.js','play/config.js','play/placement.js','shared/enhancer.js',...PLAY_CONFIG.levels.map(l=>'assets/levels/'+l.id+'.json'),...Array.from(models.keys()).map(id=>'assets/models/'+id+'.json')];
const hashes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(new Uint8Array(await Bun.file(new URL(p,ROOT)).arrayBuffer())).digest('hex')])));
await Bun.write(new URL('generator-courts.json',import.meta.url),JSON.stringify({method:'All320cells per16levels, production full-footprint visibility/support/route/static/model checks. For each legal basegenerator centre, greedily test allfour cardinal UpgradeII recipients of onefamily in fixedwest/east/north/south order; reports simultaneous legal adjacency, not firing windows, wildlife habitat, or human-visible linkage. Greedy may undercount a theoretically better subset but reports actual legal witnesses.',hashes,rows},null,2)+'\n');
