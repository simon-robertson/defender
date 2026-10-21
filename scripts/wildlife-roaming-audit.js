import {buildWorld,disposeWorld} from '../engine/world.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';

// Offline authoring check, never part of frame simulation. These distances are
// review probes (two placement boxes of reach, one box actually travelled),
// not a confinement radius or a new wildlife movement rule.
export function auditWildlifeRoaming(level,models,seconds=60){
 const actors=wildlifeActorsForLevel(level),world=buildWorld(level,models,{actors}),life=new WildlifePreview(world,()=>{});
 try{
  const n=life.nav,rows=life.states.filter(s=>s.kind==='ground').map(s=>{
   const component=s.groundComponent,start=n.starts[component],end=n.starts[component+1];let reach=0;
   for(let i=start;i<end;i++){const node=n.members[i],x=(node%n.cols+.5)*4,z=(Math.floor(node/n.cols)+.5)*4;reach=Math.max(reach,Math.hypot(x-s.x,z-s.z));}
   return {id:s.id,start:[s.x,s.y,s.z],component,reachableNodes:end-start,farthestReach:reach,maxDisplacement:0};
  });
  for(let frame=0;frame<seconds*30;frame++){
   life.advance(1/30);
   for(let i=0;i<rows.length;i++){const s=life.states[i],r=rows[i];r.maxDisplacement=Math.max(r.maxDisplacement,Math.hypot(s.x-r.start[0],s.z-r.start[2]));}
  }
  for(let i=0;i<rows.length;i++){const s=life.states[i],r=rows[i];r.journeys=s.journeys;r.completed=s.journeysCompleted;r.passed=r.farthestReach>=48&&r.maxDisplacement>=24&&r.completed>0;}
  return {id:level.id,seconds,probeReach:48,probeDisplacement:24,rows,passed:rows.every(r=>r.passed)};
 }finally{life.dispose();disposeWorld(world);}
}
if(import.meta.main){
 const id=process.argv[2];if(!id||!/^\w[\w-]*$/.test(id))throw new Error('Usage: bun scripts/wildlife-roaming-audit.js LEVEL_ID');
 const level=await Bun.file(new URL(`../assets/levels/${id}.json`,import.meta.url)).json(),actors=wildlifeActorsForLevel(level),models=new Map();
 for(const model of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model),...(level.previewActors??[]).map(a=>a.modelId)]))models.set(model,await Bun.file(new URL(`../assets/models/${model}.json`,import.meta.url)).json());
 const report=auditWildlifeRoaming(level,models);console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
}
