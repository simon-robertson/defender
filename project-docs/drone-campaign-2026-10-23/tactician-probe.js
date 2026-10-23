// Bounded gameplay evidence only. Real finite enemies/controllers and legal pads;
// no campaign wallet, human strategy, renderer, wildlife or performance claim.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PLAY_CONFIG} from '../../play/config.js';
import {PlayEnemies,waveActors} from '../../play/enemies.js';
import {createPlacementRules} from '../../play/placement.js';
import {buildWorld,disposeWorld} from '../../engine/world.js';
import {DefencePreview} from '../../game/defence-preview.js';
import {DRONE_TUNING} from '../../shared/drone.js';

const root=new URL('../../',import.meta.url),cache=new Map();
async function asset(kind,id){const key=kind+'/'+id;if(!cache.has(key))cache.set(key,await Bun.file(new URL('assets/'+key+'.json',root)).json());return structuredClone(cache.get(key));}
const files=['shared/drone.js','game/drone-preview.js','play/config.js','play/enemies.js','play/placement.js','game/defence-preview.js'];
const hashes=Object.fromEntries(await Promise.all(files.map(async path=>[path,createHash('sha256').update(await Bun.file(new URL(path,root)).text()).digest('hex')])));
const evidence=[];
for(const [id,cleanup,padPolicy='exit-near'] of [['moss-02',false],['moss-03',false],['moss-02',false,'entry-near'],['moss-03',false,'entry-near'],['plum-04',false],['plum-04',true]]){
 const source=await asset('levels',id),entry=PLAY_CONFIG.levels.find(level=>level.id===id),wave=entry.waves[0],models=new Map();
 for(const model of new Set([...source.placements.map(p=>p.model),'turret-study','drone-defence',...entry.waves.flatMap(w=>w.spawns.map(s=>s.model))]))models.set(model,await asset('models',model));
 const family={purchaseCost:1,upgradeCost:null,maxOwned:4,availableFromWave:5,enabledVariants:['base'],variants:{base:{stats:{strength:10,maxRange:72,requiresLineOfSight:true},firing:DRONE_TUNING.base.weapon}}};
 const config={...PLAY_CONFIG,defences:{...PLAY_CONFIG.defences,'drone-defence':family}},rules=createPlacementRules(source,models,{config,critters:false});
 // Choose the first legal visible pad closest to the final route point. This is
 // an explicit late-catch policy, not an exhaustive placement optimizer.
 const end=padPolicy==='entry-near'?source.path[0]:source.path.at(-1),cells=rules.eligibleCells('base',[],null,'drone-defence').filter(cell=>cell.valid).sort((a,b)=>Math.hypot(a.box[0]-end[0],a.box[2]-end[2])-Math.hypot(b.box[0]-end[0],b.box[2]-end[2])||a.box[2]-b.box[2]||a.box[0]-b.box[0]);
 assert(cells.length,'A legal Drone pad is required');
 const placements=[{id:'probe-drone-1',model:'drone-defence',variant:'base',box:cells[0].box,turn:0}];assert(rules.prepare(placements).valid);rules.dispose();
 const level=structuredClone(source);delete level.previewMode;delete level.previewActors;delete level.actorRoutes;level.placements=level.placements.filter(p=>models.get(p.model)?.role==='scenery');level.placements.push(...placements);
 const world=buildWorld(level,models,{actors:waveActors(wave),includeFish:false}),enemies=new PlayEnemies(world,{config:PLAY_CONFIG,wave}),hits=[];
 const firing=new DefencePreview(world,()=>{},()=>.5,null,enemies.states,(target,strength)=>{const applied=enemies.takeHit(target,strength);hits.push({at:enemies.time,id:target.id,model:target.model,applied});return applied;});
 // Like PlayCombat, allocate target-indexed storage from every finite slot,
 // then admit only the reused active-target view to ranking and live fire.
 firing.targets=firing.planner.targets=enemies.activeTargets;
 for(const controller of [firing.turrets,firing.arcs,firing.missiles,firing.drones])controller.targets=enemies.activeTargets;
 const spawned=enemies.spawnDue.bind(enemies);enemies.spawnDue=time=>{spawned(time);if(cleanup)for(const target of enemies.activeTargets)if(!target.probeWounded){target.probeWounded=true;target.health.takeDamage(target.health.current-100);}};
 try{
  enemies.prepare();enemies.spawnDue(0);
  for(let frame=0;frame<180*120&&!enemies.complete;frame++){
   const dt=1/120;enemies.spawnDue(enemies.time);enemies.advance(dt);enemies.spawnDue(enemies.time);firing.advance(dt);enemies.resolveExits();
  }
  assert(enemies.complete,'Finite probe must resolve');
  const state=firing.drones.states[0];evidence.push({id,padPolicy,mode:cleanup?'artificial100HPResidual':'authoredFullHP',wave:wave.id,pad:placements[0].box,legalPadCount:cells.length,seconds:enemies.time,killed:enemies.killed,escaped:enemies.escaped,shots:hits.length,usefulHP:hits.reduce((n,h)=>n+h.applied,0),modelsHit:[...new Set(hits.map(h=>h.model))],launches:state.launches,returns:state.returns,emergencyStops:state.emergencyStops,firstHitAt:hits[0]?.at??null,lastHitAt:hits.at(-1)?.at??null,hits});
 }finally{firing.dispose();enemies.dispose();disposeWorld(world);}
}
const output={date:'2026-10-23',hashes,scope:'One legal exit-near base Drone against first authored wave; 120Hz finite campaign enemies, shared real planner/navigation/aim/LOS/damage; no wildlife, no wallet, no other weapons. Fourth case intentionally pre-wounds every spawn to100HP, with same unchanged body/routes/speed; it is a cleanup capability witness, not an ordinary campaign.',base:DRONE_TUNING.base,evidence};
await Bun.write(new URL('tactician-evidence.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(evidence.map(({hits,...result})=>result),null,2));
