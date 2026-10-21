// Finite single-flight feasibility evidence. No source actors, balance changes,
// planner policy or repeated volleys are introduced by this offline script.
import {B_OUT as out,digest} from './b-path-carving-options.js';
import {auditModels} from './level-layout-audit.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {MissilePreview,MISSILE_PREVIEW_ACTORS} from '../game/missile-preview.js';
import {MISSILE_PHASE,MISSILE_FLIGHT} from '../shared/missile-flight.js';
const CASES={
 'cistern-mesa-circuit':[
  {id:'early-cistern-court',box:[2,6],route:'main',distance:60},
  {id:'north-return',box:[8,4],route:'main',distance:288},
  {id:'eastern-mesa-court',box:[16,10],route:'main',distance:720},
  {id:'southern-return',box:[9,13],route:'main',distance:912},
  {id:'late-catch',box:[8,14],route:'main',distance:960},
  {id:'exit-timing-limit',box:[8,14],route:'main',distance:1008,timingProbe:true},
 ],
 'riverfold-crossing':[
  {id:'western-bank-court',box:[4,8],route:'main',distance:120},
  {id:'bridge-bank',box:[9,7],route:'main',distance:336},
  {id:'northern-bank-return',box:[12,4],route:'main',distance:540},
  {id:'eastern-return',box:[17,11],route:'main',distance:864},
  {id:'late-catch',box:[15,14],route:'main',distance:984},
  {id:'exit-timing-limit',box:[15,14],route:'main',distance:1032,timingProbe:true},
 ],
 'mesa-confluence':[
  {id:'western-approach',box:[4,7],route:'main',distance:96},
  {id:'western-return',box:[7,8],route:'main',distance:288},
  {id:'eastern-approach',box:[19,6],route:'eastern',distance:48},
  {id:'shared-southern-circuit',box:[15,11],route:'main',distance:552},
  {id:'late-catch',box:[4,14],route:'main',distance:984},
  {id:'exit-timing-limit',box:[4,14],route:'main',distance:1032,timingProbe:true},
 ],
 'aqueduct-shore-tour':[
  {id:'northern-entry',box:[16,3],route:'main',distance:72},
  {id:'aqueduct-court',box:[18,6],route:'main',distance:192},
  {id:'shore-return',box:[12,9],route:'main',distance:408},
  {id:'lower-court',box:[12,13],route:'main',distance:552},
  {id:'late-catch',box:[17,15],route:'main',distance:672},
 ],
};
export async function auditBMissiles(id){
 const text=await Bun.file(new URL(id+'.level.json',out)).text(),source=JSON.parse(text),models=await auditModels(source);delete source.previewMode;
 for(const model of ['missile-launcher','guided-missile'])models.set(model,await Bun.file(new URL(`../assets/models/${model}.json`,import.meta.url)).json());
 const rows=[],failures=[];
 const sites=(await Bun.file(new URL(id+'.manifest.json',out)).json()).sites;
 for(const scenario of CASES[id])for(const variant of ['base','upgrade1','upgrade2'])for(const species of ['walker','dune-tread','twin-fan']){
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
 return {sourceHash:digest(text),method:'Five representative placements/approach positions × three current silo variants × Walker/DuneTread/TwinFan, one at a time; B1–B3 additionally probe launches only24units before exit. Production EnemyPreview gait, MissilePreview admission, boost/coast/committed-intercept guidance, swept contact and fixed claims;1/120-second steps. Every other launch is disabled. Very late Walker/Fan flights are discarded when the existing development actor wraps its route; this is a timing limitation, not a campaign exit rule. A hit demonstrates that finite placement/trajectory, not all positions/times. Committed-intercept corner misses may be valid outcomes and do not justify scenery removal.',rows,summary:{launches:rows.length,representativeLaunches:rows.filter(r=>!r.timingProbe).length,representativeHits:rows.filter(r=>!r.timingProbe&&r.hits).length,hits:rows.filter(r=>r.hits).length,physicalMisses:rows.filter(r=>!r.hits&&!r.routeExitBeforeImpact).length,routeExitDiscards:rows.filter(r=>r.routeExitBeforeImpact).length,staticContacts:rows.filter(r=>r.staticContacts).length},failures,passed:!failures.length};
}
if(import.meta.main)for(const id of process.argv.slice(2).length?process.argv.slice(2):Object.keys(CASES)){const report=await auditBMissiles(id);await Bun.write(new URL(id+'.missiles.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id,summary:report.summary,failures:report.failures,passed:report.passed},null,2));}
