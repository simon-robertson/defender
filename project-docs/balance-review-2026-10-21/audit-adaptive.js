// Actual player engine and retained wallet witnesses; writes evidence only.
// bun scripts/campaign-balance-audit.js --scenario=mixed --output=.../../mixed.json
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';




import {PathMotion} from '../../engine/path-motion.js';
import {WALKER_WALK,SPIDER_WALK} from '../../engine/articulated-gait.js';
import {DOG_WALK} from '../../engine/dog-gait.js';
import {ENEMY_EXPANSION_MOVEMENT} from '../../engine/enemy-expansion-gait.js';
import {wildlifeActorsForLevel} from '../../game/wildlife-preview.js';
const ROOT=new URL('../../',import.meta.url),args=process.argv.slice(2),option=name=>args.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3),selected=option('scenario')??'mixed';
const feature=option('feature')??'current';
if(feature==='old-missiles')Bun.plugin({name:'balance-previous-missile-speed',setup(build){build.onLoad({filter:/\/shared\/missile-flight\.js$/},async ({path})=>({contents:(await Bun.file(path).text()).replace('cruiseSpeed:180,acceleration:630','cruiseSpeed:120,acceleration:420'),loader:'js'}));}});
const {PLAY_CONFIG,playCapacity,createPlayConfig}=await import('../../play/config.js');
const {PlaySession}=await import('../../play/session.js');
const {loadPlayWorld,disposePlayWorld,PlayEngine}=await import('../../play/engine.js');
const {createPlacementRules}=await import('../../play/placement.js');
const replay=option('replay')?await Bun.file(option('replay')).json():null;
const replayWaves=replay?.results[0].waves;
const stop=Number(option('stop')??64);
const cache=new Map(),nativeFetch=globalThis.fetch,hash=async path=>createHash('sha256').update(new Uint8Array(await Bun.file(new URL(path,ROOT)).arrayBuffer())).digest('hex');
async function asset(kind,id){const key=kind+'/'+id;if(!cache.has(key))cache.set(key,await Bun.file(new URL('assets/'+key+'.json',ROOT)).json());return structuredClone(cache.get(key));}
globalThis.fetch=async url=>{const match=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);assert(match,'Only actual asset endpoints are allowed.');return {ok:true,json:async()=>({asset:await asset(match[1],match[2])})};};
const auditConfig=option('levels')==='a'?createPlayConfig({levels:PLAY_CONFIG.levels.slice(0,4)}):PLAY_CONFIG;
const G='turret-study',A='arc-spire',M='missile-launcher',E='power-generator';
const preferred={
 'moss-01':[[13,0,9],[4,0,9],[11,0,6],[9,0,11],[2,0,7],[15,0,9],[8,0,10],[6,0,11],[4,0,11],[12,0,6]],
 'moss-02':[[5,0,5],[8,0,8],[16,0,9],[9,0,10],[13,0,14],[3,0,6],[7,0,5],[17,0,7],[16,0,12],[10,0,14],[12,0,15]],
 'moss-03':[[11,0,10],[6,0,8],[17,0,7],[11,0,13],[6,0,10],[16,0,9],[9,0,7],[18,0,4],[9,0,13],[6,0,6],[10,0,10],[15,0,6]],
 'moss-04':[[6,0,10],[15,0,8],[11,0,11],[8,0,10],[6,0,7],[12,0,12],[11,0,14],[4,0,10],[16,0,8],[9,0,4],[18,0,9],[10,0,12]],
 'ochre-01':[[8,0,4],[8,0,6],[14,0,8],[10,0,11],[9,0,13],[6,0,14],[13,0,4],[16,0,9],[4,0,6],[6,0,5],[14,0,11],[8,0,14]],
 'ochre-02':[[9,0,5],[14,0,6],[16,0,9],[15,0,12],[4,0,8],[12,0,4],[17,0,11],[13,0,14],[9,0,7],[4,0,11],[14,0,5],[16,0,14]],
 'ochre-03':[[7,0,8],[10,0,10],[15,0,11],[9,0,13],[6,0,12],[17,0,8],[7,0,12],[13,0,10],[10,0,13],[6,0,14],[6,0,9],[14,0,13]],
 'ochre-04':[[14,0,7],[16,0,6],[12,0,10],[12,0,12],[16,0,13],[17,0,13],[10,0,10],[14,0,13],[12,0,9],[14,0,9],[16,0,3],[18,0,13]],
 'ice-01':[[8,0,3],[15,0,7],[11,0,13],[2,0,6],[17,0,8],[9,0,13],[7,0,3],[15,0,12]],
 'ice-02':[[7,0,10],[8,0,10],[7,0,13],[17,0,15],[9,0,8],[7,0,2],[11,0,8],[11,0,13]],
 'ice-03':[[3,0,8],[11,0,4],[11,0,10],[3,0,9],[11,0,11],[11,0,15],[11,0,5],[6,0,9]],
 'ice-04':[[9,0,4],[8,0,7],[7,0,12],[10,0,4],[9,0,9],[7,0,15],[3,0,7],[5,0,12]],
 'plum-01':[[7,0,4],[8,0,6],[9,0,12],[7,0,12]],
 'plum-02':[[5,0,6],[9,0,8],[13,0,9],[17,0,10],[12,0,14]],
 'plum-03':[[8,0,3],[6,0,8],[7,0,11],[11,0,14]],
 'plum-04':[[2,0,8],[7,0,12],[10,0,7],[15,0,6],[12,0,11]],
};
const mixedTransactions=[
 [['b',G],['b',G]],[['u',0],['u',1]],[],[['b',G],['b',G]],
 [['b',A],['u',4]],[['u',0],['u',1]],[],[['u',2],['u',3]],
 [['b',M]],[['u',4]],[['u',5]],[['b',A]],
 [['u',6]],[['u',6]],[],[['u',5]],
];
function invest(session,number,name){
 const actions=[];if(name==='unarmed'||number>=stop)return actions;const buy=model=>{const id=session.buy(model);assert(id,'Affordable unlocked purchase '+model);actions.push({buy:model,id});};const upgrade=index=>{const id=session.units[index]?.id;assert(id&&session.upgrade(id),'Affordable unlocked upgrade '+index);actions.push({upgrade:id,tier:session.units[index].variant});};
 if(replayWaves){for(const action of replayWaves[number].actions){if(action.buy)buy(action.buy);else upgrade(session.units.findIndex(u=>u.id===action.upgrade));}return actions;}
 if(name==='cluster-gen'&&number>=16&&!session.units.some(u=>u.model===E)){
  if(session.tokens>=4)buy(E);return actions;
 }
 if(name==='missile-heavy'){
  if(number<9){for(const [action,value]of mixedTransactions[number])action==='b'?buy(value):upgrade(value);}
  else while(true){const next=session.units.findIndex(unit=>unit.model===M&&session.nextVariant(unit)&&session.encounterNumber>=(session.config.defences[M].variants[session.nextVariant(unit)].availableFromWave??1));if(next>=0&&session.tokens>=3)upgrade(next);else if(session.tokens>=3)buy(M);else break;}
 }else if(name==='mixed'||name.startsWith('cluster-')||name==='recovery'||name==='a-only-investment'||name==='b-only-investment'){
  if(number<16)for(const [action,value]of mixedTransactions[number])action==='b'?buy(value):upgrade(value);
  else if(name!=='a-only-investment'&&(name!=='b-only-investment'||number<32)){
   let turn=session.units.slice(7).length;
   while(true){const index=session.units.findIndex(unit=>session.nextVariant(unit));if(index>=0){const model=session.units[index].model;if(session.tokens<session.config.defences[model].upgradeCost)break;upgrade(index);}else{const model=[A,M,A,G,M][turn%5];if(session.tokens<session.config.defences[model].purchaseCost)break;buy(model);turn++;}}
  }
 }
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
 if(session.level.zone!=='A')unitOrder.sort((a,b)=>({[G]:0,[A]:1,[M]:2}[a.unit.model]-({[G]:0,[A]:1,[M]:2}[b.unit.model]))||a.index-b.index);
 else if(name!=='old-two-guns')unitOrder.sort((a,b)=>({[A]:0,[M]:1,[G]:2}[a.unit.model]-({[A]:0,[M]:1,[G]:2}[b.unit.model]))||a.index-b.index);
 const place=(unit,box)=>{assert(session.place(unit.id,box));placements.push({id:unit.id,model:unit.model,variant:unit.variant,box:[...box],turn:0});};
 try{
  if(replayWaves){for(const p of replayWaves[number].placements){assert(rules.check(p.box,p.variant,placements,p.id,p.model).valid);place(session.units.find(u=>u.id===p.id),p.box);}const prepared=rules.prepare(placements);assert(prepared.valid,prepared.reason);return {placements,wildlifePoints:prepared.wildlifePoints};}
  // Deliberately compare a feasible clustered package. Bounded search tries
  // top2/3/4 weapons by nominal DPS at all legal centres and all cardinal
  // assignments. Route exposure weights ranking; actual combat certifies value.
  let reservedCenter=null;
  if(name.startsWith('cluster-')&&number>=16){
   const dps=unit=>{const p=session.config.defences[unit.model].variants[unit.variant],f=p.firing;if(unit.model===M)return p.stats.strength*f.magazine/((f.magazine-1)*f.gap+f.reload);return p.stats.strength*f.shotsPerBurst/((f.shotsPerBurst-1)*f.shotIntervalSeconds+f.cooldownSeconds);};
   const weapons=unitOrder.filter(({unit})=>unit.model!==E).map(x=>x.unit).sort((a,b)=>dps(b)-dps(a)).slice(0,4),gen=session.units.find(u=>u.model===E),crosses=[];
   const routePoints=[source.path,...(source.routes??[]).map(r=>r.path)].flat();
   for(let z=0;z<source.size[1];z++)for(let x=0;x<source.size[0];x++){
    const center=[x,0,z],fake={id:gen?.id??'reserved-gen',model:E,variant:'base',box:center,turn:0};if(!rules.check(center,'base',[],fake.id,E).valid)continue;
    const spokes=[[x-1,0,z],[x+1,0,z],[x,0,z-1],[x,0,z+1]];
    for(let count=2;count<=weapons.length;count++){
     const recipients=weapons.slice(0,count);
     function assign(i,used,trial,score,chosen){
      if(i===count){crosses.push({center,fake,score,chosen:[...chosen]});return;}
      const u=recipients[i],range=session.config.defences[u.model].variants[u.variant].stats.maxRange;
      for(let j=0;j<4;j++){if(used.has(j)||!rules.check(spokes[j],u.variant,trial,u.id,u.model).valid)continue;
       const p={id:u.id,model:u.model,variant:u.variant,box:spokes[j],turn:0},coverage=routePoints.reduce((n,r)=>n+Number(Math.hypot((r[0]-spokes[j][0])*24,(r[2]-spokes[j][2])*24)<=range),0);
       assign(i+1,new Set([...used,j]),[...trial,p],score+coverage*dps(u),[...chosen,{unit:u,box:spokes[j]}]);
      }
     }
     assign(0,new Set(),[fake],0,[]);
    }
   }
   crosses.sort((a,b)=>b.score-a.score);const chosen=crosses[0];
   if(chosen){reservedCenter=chosen.fake;if(gen)place(gen,chosen.center);for(const p of chosen.chosen)place(p.unit,p.box);}
  }
  for(const {unit}of unitOrder){
   if(placements.some(p=>p.id===unit.id))continue;
   if(unit.model===E){unit.box=null;continue;}
   if(name==='recovery'&&number===0){unit.box=null;continue;}
   const routePoints=[source.path,...(source.routes??[]).map(route=>route.path)].flat(),range=session.config.defences[unit.model].variants[unit.variant].stats.maxRange;
   const candidates=[];for(let z=0;z<source.size[1];z++)for(let x=0;x<source.size[0];x++){const box=[x,0,z],coverage=routePoints.reduce((n,p)=>n+Number(Math.hypot((p[0]-x)*24,(p[2]-z)*24)<range),0);candidates.push({box,coverage});}
   candidates.sort((a,b)=>b.coverage-a.coverage);const all=[...(number>=16&&unit.box?[unit.box]:[]),...preferred[session.level.id],...candidates.map(c=>c.box)];
   const box=all.find(box=>rules.check(box,unit.variant,reservedCenter&&!placements.some(p=>p.id===reservedCenter.id)?[...placements,reservedCenter]:placements,unit.id,unit.model).valid);if(!box){unit.box=null;continue;}
   place(unit,box);
  }
  const prepared=rules.prepare(placements);assert(prepared.valid,prepared.reason);return {placements,wildlifePoints:prepared.wildlifePoints};
 }finally{rules.dispose();}
}
async function scenario(name){
 const session=new PlaySession(auditConfig);session.reset();const waves=[];let spent=0,world=null,engine=null,levelId=null;
 try{
  for(let number=0;number<Math.min(Number(option('waves')??64),auditConfig.levels.length*4)&&session.preparing;number++){
   const before=session.tokens,actions=invest(session,number,name);spent+=before-session.tokens;assert(session.prepare('deploy'));const arrangement=await arrange(session,name,number),wave=session.wave,wallet=session.tokens;
   if(levelId!==session.level.id){engine?.dispose();disposePlayWorld(world);world=await loadPlayWorld(session.level.id,{wave,placements:arrangement.placements,wildlifePoints:arrangement.wildlifePoints,config:auditConfig,conditions:{night:false,weather:false}});levelId=session.level.id;engine=null;}
   else{let update=engine.updateDeployments(arrangement.placements),preparationWait=0;while(!update.valid&&update.code==='wildlife-busy'&&preparationWait<60){engine.advance(.25,{combat:false});preparationWait+=.25;update=engine.updateDeployments(arrangement.placements);}assert(update.valid,update.reason);arrangement.preparationWait=preparationWait;engine.prepareWave(wave);}
   if(!engine)engine=new PlayEngine(world,{config:auditConfig,wave,onDeath:id=>assert(session.resolve(id,'killed')),onEscape:id=>{assert(session.resolve(id,'escaped'));if(session.phase==='defeat')engine.stopWave();},onWaveComplete:()=>{const id=session.wave.id;assert(session.beginSettling(id));assert(session.advanceSettlement(auditConfig.waveSettleSeconds));assert(session.finishWave(id));}});
   assert(session.startWave());engine.startWave();
   if(feature==='no-generator'){for(const binding of engine.firing.enhancers.bindings)binding.increase=0;engine.firing.enhancers.refresh();}
   const metrics={chainUseful:0,chainAttempted:0,chainCalls:0,primaryArcUseful:0,generatorMarginalUseful:0,attemptedDamage:0,usefulDamage:0,shotsByFamily:{[G]:0,[A]:0,[M]:0},generatorRecipients:engine.firing.enhancers.states.map(s=>({id:s.id,recipients:[...s.recipientIds]}))};
   let inChain=false;const chain=engine.firing.arcs.chain.bind(engine.firing.arcs);engine.firing.arcs.chain=(...values)=>{metrics.chainCalls++;inChain=true;try{return chain(...values);}finally{inChain=false;}};
   const damageByFamily={[G]:0,[A]:0,[M]:0},damageBySpecies={};for(const [family,controller]of [[G,engine.firing.turrets],[A,engine.firing.arcs],[M,engine.firing.missiles.pool]])if(controller){const hit=controller.onHit;controller.onHit=(target,...values)=>{const strength=values[0],before=target.health.current;
    metrics.attemptedDamage+=strength;metrics.shotsByFamily[family]++;
    if(inChain)metrics.chainAttempted+=strength;
    const useful=feature==='no-chain'&&inChain?0:hit(target,...values);metrics.usefulDamage+=useful;
    if(inChain)metrics.chainUseful+=useful;else if(family===A)metrics.primaryArcUseful+=useful;
    // Per-contact marginal useful HP above an unboosted same-contact pulse.
    // This does not count later extra shots, changed targets or saved escapes.
    const nominal=Object.values(session.config.defences[family].variants).map(p=>p.stats.strength),boosted=nominal.some(n=>Math.abs(n*1.25-strength)<1e-8)||(inChain&&nominal.some(n=>Math.abs(n*1.25*.25-strength)<1e-8));
    if(boosted&&useful>0)metrics.generatorMarginalUseful+=Math.max(0,useful-Math.min(before,strength/1.25));
    damageByFamily[family]+=useful;const key=family+':'+target.model;damageBySpecies[key]=(damageBySpecies[key]??0)+useful;return useful;};}for(let frame=0;frame<240*30&&session.phase==='wave';frame++)engine.advance(1/30);assert.notEqual(session.phase,'wave','Wave resolves in bounded time');
   assert.equal(session.tokens,wallet+(session.phase==='defeat'?0:auditConfig.waveReward));const stats=engine.stats();
   const pool=engine.firing.missiles.pool,missileResults=pool?Object.fromEntries(['hits','collisions','expired','lostTargets','missed','orphaned','completedAtLastPosition'].map(key=>[key,pool[key]])):null;const healthBudget=wave.spawns.reduce((n,s)=>n+(wave.enemyOverrides[s.model]?.maxHealth??auditConfig.enemies[s.model].maxHealth),0);
   const result={metrics,healthBudget,preparationWait:arrangement.preparationWait??0,undeployed:session.units.filter(unit=>!arrangement.placements.some(p=>p.id===unit.id)).map(unit=>unit.id),damageByFamily,damageBySpecies,missileResults,wave:wave.id,name:wave.name,actions,placements:arrangement.placements,tiers:session.units.map(unit=>[unit.model,unit.variant]),tokens:session.tokens,spent,misses:session.misses,phase:session.phase,...stats,escapedHealth:engine.enemies.states.filter(enemy=>enemy.phase==='escaped').map(enemy=>({model:enemy.model,health:enemy.health.current}))};waves.push(result);console.log(JSON.stringify({scenario:name,...result}));
  }
  assert.equal(session.tokens,auditConfig.startTokens+session.completedWaves*auditConfig.waveReward-spent,'Retained economy balances exactly');
  return {name,phase:session.phase,completedWaves:session.completedWaves,misses:session.misses,tokens:session.tokens,spent,killed:waves.reduce((sum,wave)=>sum+wave.killed,0),escaped:waves.reduce((sum,wave)=>sum+wave.escaped,0),waves};
 }finally{engine?.dispose();disposePlayWorld(world);}
}

try{
 
 const paths=['docs/balance-review-2026-10-21/audit-adaptive.js','docs/balance-review-2026-10-21/audit.js','scripts/campaign-balance-audit.js','shared/enhancer.js','game/enhancer-preview.js','shared/arc-effects.js','play/config.js','play/session.js','play/engine.js','play/enemies.js','play/placement.js','game/turret-preview.js','game/arc-spire-preview.js','game/missile-preview.js','engine/target-planner.js','engine/missile-flight.js','shared/defence.js','shared/arsenal.js','shared/missile-flight.js','shared/enemy.js','shared/enemy-roster.js','shared/model-lights.js','game/enemy-preview.js','engine/path-motion.js','engine/articulated-gait.js','engine/enemy-expansion-gait.js','engine/enemy-impact.js','engine/arc-impact.js',...Object.keys(auditConfig.enemies).map(id=>'assets/models/'+id+'.json'),...auditConfig.levels.map(level=>'assets/levels/'+level.id+'.json')],sourceHashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,await hash(path)]))),results=[];
 for(const name of selected==='all'?['mixed','arc-heavy','recovery','a-only-investment','unarmed']:[selected])results.push(await scenario(name));
 if(selected==='all'){const byName=Object.fromEntries(results.map(result=>[result.name,result]));for(const name of ['mixed','recovery','arc-heavy'])assert.equal(byName[name].phase,'complete',name+' is a complete affordable witness');assert.equal(byName.mixed.misses,0,'The primary mixed witness clears cleanly');assert.equal(byName.recovery.misses,3,'Opening misses persist without later leakage');assert.equal(byName.recovery.waves[0].escaped,3);for(const name of ['a-only-investment','unarmed'])assert.equal(byName[name].phase,'defeat',name+' must require further investment');}
 if(selected==='b-only-investment')assert.equal(results[0].phase,'defeat','Stopping investment after B must encounter later pressure');
 const report={feature,replay:option('replay')??null,stop,recordedAt:new Date().toISOString(),seeds:{arcXorshift:1234567,missileLCG:7919,gunRandom:.5},method:'Derived from scripts/campaign-balance-audit.js; production PlaySession/PlayEngine/loadPlayWorld at120Hz,30Hz outer updates, actual finite schedules, aiming/LOS/impact/missile flights and connected wildlife deployment; inventory and wallet persist through all entered levels. No source assets or shared preview profiles are changed. Legal purchased units with no simultaneous safe court remain owned and undeployed; no refund or replacement is granted.',capacity:playCapacity(auditConfig),sourceHashes,results};
 if(!args.includes('--explore'))for(const path of paths)assert.equal(await hash(path),sourceHashes[path],'Load-bearing source stayed fixed during the run: '+path);
 if(option('output'))await Bun.write(option('output'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:results.map(({waves,...summary})=>summary)}));
}finally{globalThis.fetch=nativeFetch;}
