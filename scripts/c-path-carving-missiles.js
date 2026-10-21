// Finite single-flight feasibility evidence. No source actors, balance changes,
// planner policy or repeated volleys are introduced by this offline script.
import {C_OUT as out,digest} from './c-path-carving-options.js';
import {auditModels} from './level-layout-audit.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {MissilePreview,MISSILE_PREVIEW_ACTORS} from '../game/missile-preview.js';
import {MISSILE_PHASE,MISSILE_FLIGHT} from '../shared/missile-flight.js';
import {levelRoutes} from '../shared/routes.js';
const IDS=['zone-c-tarn-circuit','zone-c-meltwater-return','zone-c-ridge-confluence','zone-c-sanctuary-fold'];
function flightCases(source,sites){return levelRoutes(source).flatMap(route=>[.18,.5,.8].map((fraction,i)=>{const length=(route.path.length-1)*24,distance=Math.floor(length*fraction),segment=Math.floor(distance/24),f=distance/24-segment,a=route.path[segment],b=route.path[segment+1],x=(a[0]+f*(b[0]-a[0]))*24,z=(a[2]+f*(b[2]-a[2]))*24,site=[...sites].sort((a,b)=>Math.hypot(x-a.box[0]*24,z-a.box[1]*24)-Math.hypot(x-b.box[0]*24,z-b.box[1]*24))[0];return{id:route.id+'-'+i,box:site.box,route:route.id,distance};}));}
export async function auditCMissiles(id){
 const text=await Bun.file(new URL(id+'.level.json',out)).text(),source=JSON.parse(text),models=await auditModels(source);delete source.previewMode;
 for(const model of ['missile-launcher','guided-missile'])models.set(model,await Bun.file(new URL(`../assets/models/${model}.json`,import.meta.url)).json());
 const rows=[],failures=[];
 const sites=(await Bun.file(new URL(id+'.manifest.json',out)).json()).sites;
 for(const scenario of flightCases(source,sites))for(const variant of ['base','upgrade1','upgrade2'])for(const species of ['tripod','ray']){
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
 return {sourceHash:digest(text),method:'Three representative approach positions per route × three current silo variants × Tripod/Ray, one at a time. Production EnemyPreview gait, MissilePreview admission, boost/coast/committed-intercept guidance, swept contact and fixed claims;1/120-second steps. Every other launch is disabled. Very late flights are discarded when the existing development actor wraps its route; this is a timing limitation, not a campaign exit rule. A hit demonstrates that finite placement/trajectory, not all positions/times. Committed-intercept corner misses may be valid outcomes and do not justify scenery removal.',rows,summary:{launches:rows.length,representativeLaunches:rows.filter(r=>!r.timingProbe).length,representativeHits:rows.filter(r=>!r.timingProbe&&r.hits).length,hits:rows.filter(r=>r.hits).length,physicalMisses:rows.filter(r=>!r.hits&&!r.routeExitBeforeImpact).length,routeExitDiscards:rows.filter(r=>r.routeExitBeforeImpact).length,staticContacts:rows.filter(r=>r.staticContacts).length},failures,passed:!failures.length};
}
if(import.meta.main)for(const id of process.argv.slice(2).length?process.argv.slice(2):IDS){const report=await auditCMissiles(id);await Bun.write(new URL(id+'.missiles.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id,summary:report.summary,failures:report.failures,passed:report.passed},null,2));}
