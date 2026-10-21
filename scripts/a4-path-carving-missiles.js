// Finite single-flight feasibility evidence. No source actors, balance changes,
// planner policy or repeated volleys are introduced by this offline script.
import {A4_OPTIONS,digest} from './a4-path-carving-options.js';
import {auditModels} from './level-layout-audit.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {MissilePreview,MISSILE_PREVIEW_ACTORS} from '../game/missile-preview.js';
import {MISSILE_PHASE,MISSILE_FLIGHT} from '../shared/missile-flight.js';
const out=new URL('../docs/a4-path-carving-2026-10-18/',import.meta.url);
const CASES=[
 {id:'southwest-ruin-court',box:[4,10],route:'main',distance:100},
 {id:'woodland-return',box:[6,7],route:'main',distance:360},
 {id:'mere-shore-approach',box:[14,8],route:'main',distance:670},
 {id:'southern-return',box:[12,11],route:'main',distance:940},
 {id:'late-catch',box:[11,14],route:'main',distance:1070},
];
export async function auditA4Missiles(){
 const text=await Bun.file(new URL('ruin-and-mere-tour.level.json',out)).text(),source=JSON.parse(text),models=await auditModels(source);delete source.previewMode;
 for(const model of ['missile-launcher','guided-missile'])models.set(model,await Bun.file(new URL(`../assets/models/${model}.json`,import.meta.url)).json());
 const rows=[],failures=[];
 for(const scenario of CASES)for(const variant of ['base','upgrade1','upgrade2'])for(const species of ['dog','roller','moth']){
  if(!A4_OPTIONS['ruin-and-mere-tour'].sites.some(s=>s.box.join(',')===scenario.box.join(',')))throw new Error('Flight probe is outside declared candidate ground.');
  const level={...source,placements:[...source.placements,{id:'flight-launcher',model:'missile-launcher',variant,box:[scenario.box[0],0,scenario.box[1]],turn:0}]},actor={id:'flight-target',model:species,variant:'base',routeId:scenario.route,distance:scenario.distance};
  const world=buildWorld(level,models,{actors:[actor,...MISSILE_PREVIEW_ACTORS]}),enemies=new EnemyPreview(world,()=>{},null,[actor]),hits=[],impacts=[],phases=[];
  let preview;
  try{
   preview=new MissilePreview(world,()=>{},()=>{},enemies.states,(target,strength)=>{hits.push({time:preview.pool.time,routeDistance:target.distance,strength});return target.health.takeDamage(strength);},{onImpact:(x,y,z)=>impacts.push([x,y,z])});
   const state=preview.states[0],target=enemies.states[0],admitted=preview.eligible(state,target);state.target=target;state.targetLap=target.lap;preview.advance(0);state.cycle.readyAt=Infinity;
   const slot=preview.pool.slots.find(s=>s.phase===MISSILE_PHASE.BOOST);if(!slot)throw new Error('Expected representative launch was not admitted.');
   let elapsed=0,previousPhase=-1;
   while(slot.phase>=MISSILE_PHASE.BOOST&&elapsed<MISSILE_FLIGHT.maxAge+.1){
    if(slot.phase!==previousPhase){phases.push({phase:slot.phase,time:elapsed});previousPhase=slot.phase;}
    enemies.advance(1/120);preview.advance(1/120);elapsed+=1/120;
   }
   const pool=preview.pool,row={...scenario,variant,species,admitted,launches:state.cycle.shots,hits:hits.length,hitDetails:hits,impacts,elapsed:+elapsed.toFixed(4),phases,missed:pool.missed,staticContacts:pool.collisions,expired:pool.expired,lostTargets:pool.lostTargets,offMap:pool.offMap??0,remainingClaim:pool.incomingDamage(target),remainingFlight:slot.phase>=MISSILE_PHASE.BOOST};rows.push(row);
   if(!admitted||row.launches!==1||row.remainingFlight||row.remainingClaim!==0||row.expired||row.lostTargets)failures.push(scenario.id+'/'+variant+'/'+species+': incomplete or invalid single flight');
  }finally{preview?.dispose();enemies.dispose();disposeWorld(world);}
 }
 return {sourceHash:digest(text),method:'45 single launches: five representative placements/approach positions × three current silo variants × Dog/Roller/Moth, one at a time. Production EnemyPreview gait, MissilePreview admission, boost/coast/committed-intercept guidance, swept contact and fixed claims;1/120-second steps. Every other launch is disabled. A hit demonstrates that finite placement/trajectory, not all positions/times. Committed-intercept corner misses may be valid outcomes and do not justify scenery removal.',rows,summary:{launches:rows.length,hits:rows.filter(r=>r.hits).length,misses:rows.filter(r=>!r.hits).length,staticContacts:rows.filter(r=>r.staticContacts).length},failures,passed:!failures.length};
}
if(import.meta.main){const report=await auditA4Missiles();await Bun.write(new URL('ruin-and-mere-tour.missiles.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,failures:report.failures,passed:report.passed},null,2));}
