// Finite single-flight feasibility evidence. No source actors, balance changes,
// planner policy or repeated volleys are introduced by this offline script.
import {D_OUT as out,digest} from './d-path-carving-options.js';
import {auditModels} from './level-layout-audit.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {MissilePreview,MISSILE_PREVIEW_ACTORS} from '../game/missile-preview.js';
import {MISSILE_PHASE,MISSILE_FLIGHT} from '../shared/missile-flight.js';
const DEFAULT_IDS=['orchard-crescent-tour','fallen-arch-return','lantern-shore-return','crown-river-tour'];
function casesFor(source,sites){
 const path=source.path,length=(path.length-1)*24,groups=[...new Set(sites.map(s=>s.group))],chosen=[groups[0],groups[Math.floor(groups.length/2)],groups.at(-1)];
 return chosen.map(group=>{const site=sites.find(s=>s.group===group&&s.box[0]>0&&s.box[0]<19&&s.box[1]>0&&s.box[1]<15);let best=null,error=Infinity;for(let d=24;d<length-96;d++){const i=Math.floor(d/24),f=(d%24)/24,a=path[i],b=path[i+1],x=a[0]+(b[0]-a[0])*f,z=a[2]+(b[2]-a[2])*f,delta=Math.hypot(x-site.box[0],z-site.box[1]);if(delta<error){error=delta;best=d;}}return {id:group,box:site.box,route:'main',distance:best};});
}
export async function auditDMissiles(id){
 const text=await Bun.file(new URL('zone-d-'+id+'.level.json',out)).text(),source=JSON.parse(text),models=await auditModels(source);delete source.previewMode;
 for(const model of ['missile-launcher','guided-missile'])models.set(model,await Bun.file(new URL(`../assets/models/${model}.json`,import.meta.url)).json());
 const rows=[],failures=[];
 const sites=(await Bun.file(new URL('zone-d-'+id+'.manifest.json',out)).json()).sites;
 for(const scenario of casesFor(source,sites))for(const variant of ['base','upgrade1','upgrade2'])for(const species of ['spider','lantern']){
  if(!sites.some(s=>s.box.join(',')===scenario.box.join(',')))throw new Error('Flight probe is outside declared candidate ground.');
  const level={...source,placements:[...source.placements,{id:'flight-launcher',model:'missile-launcher',variant,box:[scenario.box[0],0,scenario.box[1]],turn:0}]},actor={id:'flight-target',model:species,variant:'base',routeId:scenario.route,distance:scenario.distance};
  const world=buildWorld(level,models,{actors:[actor,...MISSILE_PREVIEW_ACTORS]}),enemies=new EnemyPreview(world,()=>{},null,[actor]),hits=[],impacts=[],phases=[];
  let preview;
  try{
   preview=new MissilePreview(world,()=>{},()=>{},enemies.states,(target,strength)=>{hits.push({time:preview.pool.time,routeDistance:target.distance,strength});return target.health.takeDamage(strength);},{onImpact:(x,y,z)=>impacts.push([x,y,z])});
   const state=preview.states[0],target=enemies.states[0],initialLap=target.lap,admitted=preview.eligible(state,target);state.target=target;state.targetLap=target.lap;preview.advance(0);state.cycle.readyAt=Infinity;
   const slot=preview.pool.slots.find(s=>s.phase===MISSILE_PHASE.BOOST);if(!slot)throw new Error('Expected representative launch was not admitted.');
   let elapsed=0,previousPhase=-1;
   while(slot.phase>=MISSILE_PHASE.BOOST&&elapsed<MISSILE_FLIGHT.maxAge+.1){
    if(slot.phase!==previousPhase){phases.push({phase:slot.phase,time:elapsed});previousPhase=slot.phase;}
    enemies.advance(1/120);preview.advance(1/120);elapsed+=1/120;
   }
   const pool=preview.pool,row={...scenario,variant,species,admitted,launches:state.cycle.shots,hits:hits.length,hitDetails:hits,impacts,elapsed:+elapsed.toFixed(4),phases,missed:pool.missed,staticContacts:pool.collisions,expired:pool.expired,lostTargets:pool.lostTargets,routeExitBeforeImpact:target.lap!==initialLap&&pool.lostTargets===1,offMap:pool.offMap??0,remainingClaim:pool.incomingDamage(target),remainingFlight:slot.phase>=MISSILE_PHASE.BOOST};rows.push(row);
   if(!admitted||row.launches!==1||row.remainingFlight||row.remainingClaim!==0||row.expired||(row.lostTargets&&!(scenario.timingProbe&&row.routeExitBeforeImpact)))failures.push(scenario.id+'/'+variant+'/'+species+': incomplete or invalid single flight');
  }finally{preview?.dispose();enemies.dispose();disposeWorld(world);}
 }
 return {sourceHash:digest(text),method:'Three representative placements/approach positions × three current silo variants × Spider/Lantern, one at a time; every launch starts at least96units before the exit. Production EnemyPreview gait, MissilePreview admission, boost/coast/committed-intercept guidance, swept contact and fixed claims;1/120-second steps. Every other launch is disabled. A hit demonstrates that finite placement/trajectory, not all positions/times. Committed-intercept corner misses may be valid outcomes and do not justify scenery removal.',rows,summary:{launches:rows.length,representativeLaunches:rows.filter(r=>!r.timingProbe).length,representativeHits:rows.filter(r=>!r.timingProbe&&r.hits).length,hits:rows.filter(r=>r.hits).length,physicalMisses:rows.filter(r=>!r.hits&&!r.routeExitBeforeImpact).length,routeExitDiscards:rows.filter(r=>r.routeExitBeforeImpact).length,staticContacts:rows.filter(r=>r.staticContacts).length},failures,passed:!failures.length};
}
if(import.meta.main)for(const id of process.argv.slice(2).length?process.argv.slice(2):DEFAULT_IDS){const report=await auditDMissiles(id);await Bun.write(new URL('zone-d-'+id+'.missiles.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id,summary:report.summary,failures:report.failures,passed:report.passed},null,2));}
