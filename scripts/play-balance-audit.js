// Bounded real-engine balance witnesses. No asset or preview source is written.
// Run: bun scripts/play-balance-audit.js --output=docs/play-balance-2026-10-19/audit.json
// --scenario=name runs one witness; --require-defaults checks active tuning too.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPlayConfig,PLAY_CONFIG,playCapacity} from '../play/config.js';
import {PlaySession} from '../play/session.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine} from '../play/engine.js';
import {createPlacementRules} from '../play/placement.js';

const ROOT=new URL('../',import.meta.url),args=process.argv.slice(2),option=name=>args.find(arg=>arg.startsWith('--'+name+'='))?.split('=').slice(1).join('='),selected=option('scenario');
const hash=async path=>createHash('sha256').update(new Uint8Array(await Bun.file(new URL(path,ROOT)).arrayBuffer())).digest('hex');
const cache=new Map(),nativeFetch=globalThis.fetch;
globalThis.fetch=async url=>{
 const match=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);assert(match,'Only production asset endpoints may be loaded.');
 const key=match[1]+'/'+match[2];if(!cache.has(key))cache.set(key,await Bun.file(new URL('assets/'+key+'.json',ROOT)).json());
 return {ok:true,json:async()=>({asset:structuredClone(cache.get(key))})};
};
const legacy={hp:[80,80,80,80,80,80,80,80],speed:[12,12,12,12,12,12,12,12],count:[3,4,5,6,3,4,5,6],gap:[3,2.75,2.5,2,3,2.75,2.5,2]};
export const PROPOSED_BALANCE={hp:[100,120,140,160,180,200,220,240],speed:[12,13,14,15,15,15,15,15],count:[3,4,5,6,6,7,8,9],gap:[3,2.8,2.6,2.4,2.3,2.2,2.1,2]};
const legacyBoxes={'moss-01':[[2,0,7],[9,0,10]],'moss-02':[[5,0,5],[8,0,8]]};
const spreadingBoxes={'moss-01':[[13,0,9],[4,0,9],[11,0,6],[9,0,11],[2,0,7],[15,0,9]],'moss-02':[[5,0,5],[8,0,8],[16,0,9],[9,0,10],[13,0,14],[3,0,6]]};
const basicTiers=[['base','base'],['upgrade1','upgrade1']];
const fullTiers=[...basicTiers,['upgrade2','upgrade2'],['upgrade2','upgrade2','upgrade1'],['upgrade2','upgrade2','upgrade2','base'],['upgrade2','upgrade2','upgrade2','upgrade2'],['upgrade2','upgrade2','upgrade2','upgrade2','upgrade1'],['upgrade2','upgrade2','upgrade2','upgrade2','upgrade2','base']];
const scenarios=[
 {name:'legacy-two-tier1',profile:legacy,boxes:legacyBoxes,tiers:basicTiers},
 {name:'harder-old-two-tier1',profile:PROPOSED_BALANCE,boxes:legacyBoxes,tiers:basicTiers},
 {name:'harder-spread-two-tier1',profile:PROPOSED_BALANCE,boxes:spreadingBoxes,tiers:basicTiers},
 {name:'harder-two-tier2',profile:PROPOSED_BALANCE,boxes:spreadingBoxes,tiers:fullTiers.slice(0,3)},
 {name:'harder-progressive',profile:PROPOSED_BALANCE,boxes:spreadingBoxes,tiers:fullTiers},
 {name:'harder-upgraded-opening',profile:PROPOSED_BALANCE,boxes:{...spreadingBoxes,'moss-01':[[8,0,10],[13,0,9],[4,0,9],[11,0,6],[2,0,7],[9,0,11]]},tiers:[['upgrade1'],['upgrade2','base'],...fullTiers.slice(2)]},
 {name:'harder-undefended',profile:PROPOSED_BALANCE,boxes:spreadingBoxes,tiers:[[]]},
];
function configFor(profile){
 if(profile===PROPOSED_BALANCE)return PLAY_CONFIG;
 const levels=structuredClone(PLAY_CONFIG.levels);
 for(let li=0;li<2;li++)for(let wi=0;wi<4;wi++){
  const number=li*4+wi,wave=levels[li].waves[wi];
  wave.enemyOverrides={dog:{maxHealth:profile.hp[number],speed:profile.speed[number]}};
  wave.spawns=Array.from({length:profile.count[number]},(_,i)=>({id:wave.id+'-dog-'+(i+1),at:i*profile.gap[number],model:'dog',routeId:'main'}));
 }
 return createPlayConfig({levels,enemies:{dog:{maxHealth:profile.hp[0],speed:profile.speed[0]}}});
}
function payForTiers(session,desired){
 const order=session.config.defences['turret-study'].enabledVariants;
 for(let i=0;i<desired.length;i++){
  if(!session.units[i])assert(session.buy(),'Affordable new gun');
  while(order.indexOf(session.units[i].variant)<order.indexOf(desired[i]))assert(session.upgrade(session.units[i].id),'Affordable sequential upgrade');
  assert.equal(session.units[i].variant,desired[i]);
 }
 assert.equal(session.units.length,desired.length);
}
async function runScenario(spec){
 const config=configFor(spec.profile),session=new PlaySession(config);session.reset();const waves=[];let spent=0;
 for(let number=0;number<8&&session.preparing;number++){
  const tiers=spec.tiers[Math.min(number,spec.tiers.length-1)],before=session.tokens;payForTiers(session,tiers);spent+=before-session.tokens;
  assert(session.prepare('deploy'));const boxes=spec.boxes[session.level.id];
  for(let i=0;i<session.units.length;i++)assert(session.place(session.units[i].id,boxes[i]),'Owned gun has a deployment');
  const wave=session.wave,levelId=session.level.id,wallet=session.tokens,identities=session.units.map(unit=>unit.id);
  const perWave=config.levels.flatMap(level=>level.waves)[number].enemyOverrides.dog;
  const engineConfig=config;
  const world=await loadPlayWorld(levelId,{wave,config:engineConfig,placements:session.placements});let rules,engine,clearCalls=0;
  try{
   rules=createPlacementRules(world.playSource,world.playModels);const arrangement=rules.prepare(session.placements);assert(arrangement.valid,`${spec.name}/${wave.id}: ${arrangement.reason}`);
   engine=new PlayEngine(world,{config:engineConfig,wave,onDeath:id=>assert(session.resolve(id,'killed')),onEscape:id=>{assert(session.resolve(id,'escaped'));if(session.phase==='defeat')engine.stopWave();},onWaveComplete:()=>{
    clearCalls++;assert(session.beginSettling(wave.id));assert(session.advanceSettlement(config.waveSettleSeconds));assert(session.finishWave(wave.id));assert.equal(session.finishWave(wave.id),false);
   }});
   for(const enemy of engine.enemies.states){assert.equal(enemy.health.maximum,perWave.maxHealth);assert.equal(enemy.movement.speed,perWave.speed);}
   assert(session.startWave());engine.startWave();for(let frame=0;frame<180*30&&session.phase==='wave';frame++)engine.advance(1/30);
   assert.notEqual(session.phase,'wave','A bounded wave must resolve or reach defeat');
   assert.deepEqual(session.units.map(unit=>unit.id),identities,'Ownership persists');
   assert.equal(session.tokens,wallet+(session.phase==='defeat'?0:2),'Exactly one successful-wave reward, none on defeat');
   assert.equal(clearCalls,session.phase==='defeat'?0:1);
   const stats=engine.stats();waves.push({wave:wave.id,hp:perWave.maxHealth,speed:perWave.speed,count:wave.spawns.length,gap:spec.profile.gap[number],tiers,placements:world.level.placements.filter(p=>p.model==='turret-study'),wildlifePoints:arrangement.wildlifePoints,killed:stats.killed,escaped:stats.escaped,shots:stats.shots,seconds:stats.waveTime,misses:session.misses,tokens:session.tokens,phase:session.phase,escapedHealth:engine.enemies.states.filter(enemy=>enemy.phase==='escaped').map(enemy=>enemy.health.current)});
   console.log(JSON.stringify({scenario:spec.name,...waves.at(-1)}));
  }finally{engine?.dispose();rules?.dispose();disposePlayWorld(world);}
 }
 const result={name:spec.name,profile:spec.profile,capacity:playCapacity(config),phase:session.phase,completedWaves:session.completedWaves,misses:session.misses,spent,tokens:session.tokens,killed:waves.reduce((sum,wave)=>sum+wave.killed,0),escaped:waves.reduce((sum,wave)=>sum+wave.escaped,0),waves};
 assert.equal(session.tokens,2+session.completedWaves*2-spent,'Entire run economy balances');
 if(session.phase==='defeat'){assert.equal(session.misses,10);assert.equal(session.finishWave(session.wave.id),false);}
 return result;
}
try{
 const sourcePaths=['play/config.js','play/enemies.js','play/engine.js','play/session.js','play/placement.js','shared/defence.js','shared/arsenal.js','assets/levels/moss-01.json','assets/levels/moss-02.json'];
 const before=Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,await hash(path)]))),results=[];
 const defaultsMatchProposed=PLAY_CONFIG.levels.flatMap(level=>level.waves).every((wave,i)=>wave.spawns.length===PROPOSED_BALANCE.count[i]&&wave.spawns.every((spawn,j)=>Math.abs(spawn.at-j*PROPOSED_BALANCE.gap[i])<1e-10)&&wave.enemyOverrides?.dog?.maxHealth===PROPOSED_BALANCE.hp[i]&&wave.enemyOverrides?.dog?.speed===PROPOSED_BALANCE.speed[i]);
 if(args.includes('--require-defaults'))assert(defaultsMatchProposed,'Active play defaults equal the accepted moderate profile');
 for(const spec of scenarios.filter(spec=>!selected||selected===spec.name))results.push(await runScenario(spec));
 assert(results.length,'Unknown scenario');
 for(const path of sourcePaths.filter(path=>path.startsWith('assets/')))assert.equal(await hash(path),before[path],'Accepted source unchanged');
 if(!selected){
  assert.equal(results.find(result=>result.name==='legacy-two-tier1').phase,'complete');
  assert.equal(results.find(result=>result.name==='legacy-two-tier1').misses,0);
  assert.equal(results.find(result=>result.name==='harder-progressive').phase,'complete');
  const restrained=results.find(result=>result.name==='harder-two-tier2');assert.equal(restrained.phase,'complete');assert.equal(restrained.killed,48);assert.equal(restrained.misses,0);assert.equal(restrained.spent,6);assert.equal(restrained.tokens,12);
  assert.equal(results.find(result=>result.name==='harder-old-two-tier1').misses,5);
  assert.equal(results.find(result=>result.name==='harder-undefended').phase,'defeat');
  assert(results.find(result=>result.name==='harder-old-two-tier1').misses>results.find(result=>result.name==='harder-progressive').misses,'Reinvestment improves measured outcome');
 }
 const report={recordedAt:new Date().toISOString(),method:'Production PlaySession, PlayEngine, loadPlayWorld, actual LOS/yaw/pitch/burst/target planner, native per-wave enemy overrides, 120Hz fixed simulation, 30Hz outer updates; all deployments pass source placement and connected-wildlife preparation checks.',sourceHashes:before,defaultsMatchProposed,proposed:PROPOSED_BALANCE,results};
 if(option('output'))await Bun.write(option('output'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({summary:results.map(({waves,profile,...result})=>result)}));
}finally{globalThis.fetch=nativeFetch;}
