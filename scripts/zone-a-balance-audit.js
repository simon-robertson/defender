// Actual player engine and retained wallet witnesses; writes evidence only.
// bun scripts/zone-a-balance-audit.js --scenario=mixed --output=.../mixed.json
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PLAY_CONFIG,playCapacity} from '../play/config.js';
import {PlaySession} from '../play/session.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine} from '../play/engine.js';
import {createPlacementRules,enemyRouteEnvelope} from '../play/placement.js';
import {PathMotion} from '../engine/path-motion.js';
import {DOG_WALK} from '../engine/dog-gait.js';
import {ENEMY_EXPANSION_MOVEMENT} from '../engine/enemy-expansion-gait.js';
import {wildlifeActorsForLevel} from '../game/wildlife-preview.js';
const ROOT=new URL('../',import.meta.url),args=process.argv.slice(2),option=name=>args.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3),selected=option('scenario')??'mixed';
const cache=new Map(),nativeFetch=globalThis.fetch,hash=async path=>createHash('sha256').update(new Uint8Array(await Bun.file(new URL(path,ROOT)).arrayBuffer())).digest('hex');
async function asset(kind,id){const key=kind+'/'+id;if(!cache.has(key))cache.set(key,await Bun.file(new URL('assets/'+key+'.json',ROOT)).json());return structuredClone(cache.get(key));}
globalThis.fetch=async url=>{const match=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);assert(match,'Only actual asset endpoints are allowed.');return {ok:true,json:async()=>({asset:await asset(match[1],match[2])})};};
const G='turret-study',A='arc-spire',M='missile-launcher';
const preferred={
 'moss-01':[[13,0,9],[4,0,9],[11,0,6],[9,0,11],[2,0,7],[15,0,9],[8,0,10],[6,0,11],[4,0,11],[12,0,6]],
 'moss-02':[[5,0,5],[8,0,8],[16,0,9],[9,0,10],[13,0,14],[3,0,6],[7,0,5],[17,0,7],[16,0,12],[10,0,14],[12,0,15]],
 'moss-03':[[11,0,10],[6,0,8],[17,0,7],[11,0,13],[6,0,10],[16,0,9],[9,0,7],[18,0,4],[9,0,13],[6,0,6],[10,0,10],[15,0,6]],
 'moss-04':[[6,0,10],[15,0,8],[11,0,11],[8,0,10],[6,0,7],[12,0,12],[11,0,14],[4,0,10],[16,0,8],[9,0,4],[18,0,9],[10,0,12]],
};
const mixedTransactions=[
 [['b',G],['b',G]],[['u',0],['u',1]],[],[['b',G],['b',G]],
 [['b',A],['u',4]],[['u',0],['u',1]],[],[['u',2],['u',3]],
 [['b',M]],[['u',4]],[['u',5]],[['b',A]],
 [['u',6]],[['u',6]],[],[['u',5]],
];
function invest(session,number,name){
 const actions=[];const buy=model=>{const id=session.buy(model);assert(id,'Affordable unlocked purchase '+model);actions.push({buy:model,id});};const upgrade=index=>{const id=session.units[index]?.id;assert(id&&session.upgrade(id),'Affordable unlocked upgrade '+index);actions.push({upgrade:id,tier:session.units[index].variant});};
 if(name==='mixed'||name==='recovery')for(const [action,value]of mixedTransactions[number])action==='b'?buy(value):upgrade(value);
 else if(name==='old-two-guns'){
  if(number===0){buy(G);buy(G);}if(number===1){upgrade(0);upgrade(1);}if(number===4){upgrade(0);upgrade(1);}
 }else if(name==='wide-base'){while(session.tokens>=1&&session.units.length<14)buy(G);}
 else if(name==='gun-focused'){
  while(session.tokens>=1){const next=session.units.findIndex(unit=>{const variant=session.nextVariant(unit);return variant&&session.encounterNumber>=(session.config.defences[G].variants[variant].availableFromWave??1);});if(next>=0)upgrade(next);else buy(G);}
 }else if(name==='arc-heavy'){
  if(number===0){buy(G);buy(G);}else if(number===1){upgrade(0);upgrade(1);}else if(number>=4){
   while(session.tokens>=2){const next=session.units.findIndex(unit=>unit.model===A&&session.nextVariant(unit)&&session.encounterNumber>=(session.config.defences[A].variants[session.nextVariant(unit)].availableFromWave??1));if(next>=0)upgrade(next);else buy(A);}
  }
 }else throw new Error('Unknown scenario '+name);
 return actions;
}
async function arrange(session,name,number){
 const source=await asset('levels',session.level.id),ids=[...new Set([...source.placements.map(p=>p.model),...Object.keys(session.config.defences),...Object.keys(session.config.enemies),...wildlifeActorsForLevel(source).map(actor=>actor.model),'guided-missile'])],models=new Map();
 for(const id of ids)models.set(id,await asset('models',id));
 const rules=createPlacementRules(source,models,{config:session.config}),placements=[],unitOrder=session.units.map((unit,index)=>({unit,index}));
 // Fixed-mast and indirect weapons receive central courts first; guns still
 // cover branch entries and the late catch. Every choice passes actual rules.
 if(name!=='old-two-guns')unitOrder.sort((a,b)=>({[A]:0,[M]:1,[G]:2}[a.unit.model]-({[A]:0,[M]:1,[G]:2}[b.unit.model]))||a.index-b.index);
 try{
  for(const {unit}of unitOrder){
   if(name==='recovery'&&number===0){unit.box=null;continue;}
   const all=[...preferred[session.level.id]];for(let z=0;z<source.size[1];z++)for(let x=0;x<source.size[0];x++)all.push([x,0,z]);
   const box=all.find(box=>rules.check(box,unit.variant,placements,unit.id,unit.model).valid);assert(box,'A valid simultaneous position exists for '+unit.id+' '+unit.variant);
   assert(session.place(unit.id,box));placements.push({id:unit.id,model:unit.model,variant:unit.variant,box:[...box],turn:0});
  }
  const prepared=rules.prepare(placements);assert(prepared.valid,prepared.reason);return {placements,wildlifePoints:prepared.wildlifePoints};
 }finally{rules.dispose();}
}
async function scenario(name){
 const session=new PlaySession(PLAY_CONFIG);session.reset();const waves=[];let spent=0,world=null,engine=null,levelId=null;
 try{
  for(let number=0;number<16&&session.preparing;number++){
   const before=session.tokens,actions=invest(session,number,name);spent+=before-session.tokens;assert(session.prepare('deploy'));const arrangement=await arrange(session,name,number),wave=session.wave,wallet=session.tokens;
   if(levelId!==session.level.id){engine?.dispose();disposePlayWorld(world);world=await loadPlayWorld(session.level.id,{wave,placements:arrangement.placements,wildlifePoints:arrangement.wildlifePoints,config:PLAY_CONFIG});levelId=session.level.id;engine=null;}
   else{const update=engine.updateDeployments(arrangement.placements);assert(update.valid,update.reason);engine.prepareWave(wave);}
   if(!engine)engine=new PlayEngine(world,{config:PLAY_CONFIG,wave,onDeath:id=>assert(session.resolve(id,'killed')),onEscape:id=>{assert(session.resolve(id,'escaped'));if(session.phase==='defeat')engine.stopWave();},onWaveComplete:()=>{const id=session.wave.id;assert(session.beginSettling(id));assert(session.advanceSettlement(PLAY_CONFIG.waveSettleSeconds));assert(session.finishWave(id));}});
   assert(session.startWave());engine.startWave();const damageByFamily={[G]:0,[A]:0,[M]:0},damageBySpecies={};for(const [family,controller]of [[G,engine.firing.turrets],[A,engine.firing.arcs],[M,engine.firing.missiles.pool]])if(controller){const hit=controller.onHit;controller.onHit=(target,...values)=>{const useful=hit(target,...values);damageByFamily[family]+=useful;const key=family+':'+target.model;damageBySpecies[key]=(damageBySpecies[key]??0)+useful;return useful;};}for(let frame=0;frame<180*30&&session.phase==='wave';frame++)engine.advance(1/30);assert.notEqual(session.phase,'wave','Wave resolves in bounded time');
   assert.equal(session.tokens,wallet+(session.phase==='defeat'?0:PLAY_CONFIG.waveReward));const stats=engine.stats();
   const pool=engine.firing.missiles.pool,missileResults=pool?Object.fromEntries(['hits','collisions','expired','lostTargets','missed','orphaned','completedAtLastPosition'].map(key=>[key,pool[key]])):null;const result={damageByFamily,damageBySpecies,missileResults,wave:wave.id,name:wave.name,actions,placements:arrangement.placements,tiers:session.units.map(unit=>[unit.model,unit.variant]),tokens:session.tokens,spent,misses:session.misses,phase:session.phase,...stats,escapedHealth:engine.enemies.states.filter(enemy=>enemy.phase==='escaped').map(enemy=>({model:enemy.model,health:enemy.health.current}))};waves.push(result);console.log(JSON.stringify({scenario:name,...result}));
  }
  assert.equal(session.tokens,PLAY_CONFIG.startTokens+session.completedWaves*PLAY_CONFIG.waveReward-spent,'Retained economy balances exactly');
  return {name,phase:session.phase,completedWaves:session.completedWaves,misses:session.misses,tokens:session.tokens,spent,killed:waves.reduce((sum,wave)=>sum+wave.killed,0),escaped:waves.reduce((sum,wave)=>sum+wave.escaped,0),waves};
 }finally{engine?.dispose();disposePlayWorld(world);}
}
async function trafficAudit(){
 const models=new Map();for(const id of Object.keys(PLAY_CONFIG.enemies))models.set(id,await asset('models',id));
 const results=[];
for(const level of PLAY_CONFIG.levels){const source=await asset('levels',level.id),paths=new Map([['main',source.path],...(source.routes??[]).map(route=>[route.id,route.path])]);for(const wave of level.waves){const actors=wave.spawns.map(spawn=>{const profile={...PLAY_CONFIG.enemies[spawn.model],...wave.enemyOverrides[spawn.model]},movement=spawn.model==='dog'?DOG_WALK:ENEMY_EXPANSION_MOVEMENT[spawn.model],path=new PathMotion(paths.get(spawn.routeId),movement.turnDistance),envelope=enemyRouteEnvelope(models.get(spawn.model),profile);return {...spawn,speed:profile.speed,path,envelope,sample:new Float64Array(5)};}),end=Math.max(...actors.map(a=>a.at+a.path.length/a.speed));let worst={clearance:Infinity},checks=0;const pairs=new Map();for(let tick=0;tick<=Math.ceil(end*120);tick++){const time=tick/120,active=actors.filter(a=>time>=a.at&&time<a.at+a.path.length/a.speed);for(const a of active)a.path.sample((time-a.at)*a.speed,a.sample);for(let i=0;i<active.length;i++)for(let j=0;j<i;j++){const a=active[i],b=active[j];if(a.envelope.top<=b.envelope.bottom||b.envelope.top<=a.envelope.bottom)continue;const distance=Math.hypot(a.sample[0]-b.sample[0],a.sample[1]-b.sample[1]),clearance=distance-a.envelope.radius-b.envelope.radius;checks++;if(clearance<worst.clearance)worst={clearance,time,first:a.id,second:b.id,distance};if(clearance<-.01){const key=[a.id,b.id].sort().join(':');if(!pairs.has(key))pairs.set(key,{first:a.id,second:b.id,time,clearance});}}}results.push({wave:wave.id,checks,worst,conservativeCircleOverlaps:[...pairs.values()]});}}
return {recordedAt:new Date().toISOString(),configHash:await hash('play/config.js'),method:'Every120Hz tick of unarmed finite traffic. Production PathMotion plus conservative complete-animation horizontal radii and vertical envelopes. Does not include combat stagger; independent sampled occupied-part combat checks supplement this authoring audit.',results};
}

try{
 if(selected==='traffic'){const report=await trafficAudit();if(option('output'))await Bun.write(option('output'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exit(0);}
 const paths=['play/config.js','play/session.js','play/engine.js','play/enemies.js','play/placement.js','game/turret-preview.js','game/arc-spire-preview.js','game/missile-preview.js','engine/target-planner.js','engine/missile-flight.js','shared/defence.js','shared/arsenal.js','shared/missile-flight.js',...['moss-01','moss-02','moss-03','moss-04'].map(id=>'assets/levels/'+id+'.json')],sourceHashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,await hash(path)]))),results=[];
 for(const name of selected==='all'?['old-two-guns','gun-focused','mixed','recovery','wide-base','arc-heavy']:[selected])results.push(await scenario(name));
 if(selected==='all'){const byName=Object.fromEntries(results.map(result=>[result.name,result]));for(const name of ['gun-focused','mixed','recovery','arc-heavy'])assert.equal(byName[name].phase,'complete',name+' is a complete affordable witness');assert.equal(byName.mixed.misses,0,'The primary mixed witness clears cleanly');assert.equal(byName.recovery.misses,3,'Opening misses persist without later leakage');assert.equal(byName.recovery.waves[0].escaped,3);for(const name of ['old-two-guns','wide-base'])assert.equal(byName[name].phase,'defeat',name+' must require further investment');}
 const report={recordedAt:new Date().toISOString(),method:'Production PlaySession/PlayEngine/loadPlayWorld at120Hz,30Hz outer updates, actual finite schedules, aiming/LOS/impact/missile flights and connected wildlife deployment; inventory and wallet persist through all entered levels. No source assets or shared preview profiles are changed.',capacity:playCapacity(PLAY_CONFIG),sourceHashes,results};
 for(const path of paths)assert.equal(await hash(path),sourceHashes[path],'Load-bearing source stayed fixed during the run: '+path);
 if(option('output'))await Bun.write(option('output'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:results.map(({waves,...summary})=>summary)}));
}finally{globalThis.fetch=nativeFetch;}
