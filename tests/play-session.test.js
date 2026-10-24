import {test,expect} from 'bun:test';
import {PlaySession,nextEncounter,nextUnplaced,encounterLocation} from '../play/session.js';
import {createPlayConfig} from '../play/config.js';

function deployAndStart(s){const gun=s.buy();s.prepare('deploy');s.place(gun,[2,0,6]);expect(s.startWave()).toBe(true);}
function finish(session){const id=session.wave.id;for(const spawn of session.wave.spawns)session.resolve(spawn.id,'killed');expect(session.beginSettling(id)).toBe(true);session.advanceSettlement(session.config.waveSettleSeconds);expect(session.finishWave(id)).toBe(true);expect(session.finishWave(id)).toBe(false);}
test('unlock locations follow actual zone-local areas and wave positions across the campaign',()=>{
 const session=new PlaySession();let encounter=0;
 for(const [index,level]of session.config.levels.entries())for(let wave=1;wave<=level.waves.length;wave++){
  const number=session.config.levels.slice(0,index+1).filter(other=>other.zone===level.zone).length;
  expect(encounterLocation(session.config.levels,++encounter)).toEqual({area:level.zone+number,wave});
 }
 for(const invalid of [0,-1,1.5,NaN,null,65])expect(encounterLocation(session.config.levels,invalid)).toBeNull();
 const levels=[{zone:'A',waves:[1,2]},{zone:'A',waves:[1,2,3]},{zone:'B',waves:[1]}];
 expect(encounterLocation(levels,4)).toEqual({area:'A2',wave:2});expect(encounterLocation(levels,6)).toEqual({area:'B1',wave:1});
});
test('shop and upgrade unlock snapshots expose exact future areas and intra-area waves without changing eligibility',()=>{
 const config=createPlayConfig({defences:{
  'power-generator':{availableFromWave:17,variants:{base:{availableFromWave:19}}},
  'turret-study':{variants:{upgrade1:{availableFromWave:18},upgrade2:{availableFromWave:21}}},
 }}),s=new PlaySession(config);s.reset();const gun=s.buy();
 expect(s.snapshot().shop.find(item=>item.model==='power-generator')).toMatchObject({available:false,availableFromWave:19,availableArea:'B1',availableWave:3});
 expect(s.snapshot().units[0]).toMatchObject({canUpgrade:false,upgradeAvailableFromWave:18,upgradeAvailableArea:'B1',upgradeAvailableWave:2});expect(s.upgrade(gun)).toBe(false);
 s.levelIndex=4;s.waveIndex=1;expect(s.snapshot().units[0]).toMatchObject({canUpgrade:true,upgradeAvailableArea:null,upgradeAvailableWave:null});expect(s.upgrade(gun)).toBe(true);
 expect(s.snapshot().units[0]).toMatchObject({canUpgrade:false,upgradeAvailableFromWave:21,upgradeAvailableArea:'B2',upgradeAvailableWave:1});
 s.waveIndex=2;expect(s.snapshot().shop.find(item=>item.model==='power-generator')).toMatchObject({available:true,availableArea:null,availableWave:null});
 s.levelIndex=5;s.waveIndex=0;s.tokens=1;expect(s.upgrade(gun)).toBe(true);
 expect(s.snapshot().units[0]).toMatchObject({canUpgrade:false,upgradeAvailableFromWave:null,upgradeAvailableArea:null,upgradeAvailableWave:null});
});
test('catalogue progression finishes four waves and all four levels before the next zone',()=>{
 const levels=['A','B'].flatMap(zone=>Array.from({length:4},(_,i)=>({zone,id:zone+(i+1),waves:[1,2,3,4]})));
 expect(nextEncounter(levels,3,2)).toEqual({levelIndex:3,waveIndex:3});
 const next=nextEncounter(levels,3,3);expect(next).toEqual({levelIndex:4,waveIndex:0});expect(levels[next.levelIndex].id).toBe('B1');
 expect(nextEncounter(levels,7,3)).toBeNull();
});
test('wallet actions are phase gated, affordable and forks only spend on commit',()=>{
 const s=new PlaySession();expect(s.buy()).toBeNull();s.reset();const id=s.buy();expect(s.tokens).toBe(1);
 const candidate=s.fork();expect(candidate.upgrade(id)).toBe(true);expect(candidate.upgrade(id)).toBe(false);expect(s.tokens).toBe(1);
 s.adopt(candidate);expect(s.tokens).toBe(0);expect(s.buy()).toBeNull();s.prepare('deploy');s.place(id,[2,0,6]);s.startWave();
 expect(s.undeploy(id)).toBe(false);expect(s.place(id,[3,0,6])).toBe(false);expect(s.upgrade(id)).toBe(false);
});
test('consecutive preparation upgrades spend each step and the top tier survives the level boundary',()=>{
 const s=new PlaySession(createPlayConfig({startTokens:3,waveReward:1,defences:{'turret-study':{variants:{upgrade2:{availableFromWave:1}}}}}));s.reset();const id=s.buy();
 expect(s.snapshot().units[0]).toMatchObject({variant:'base',nextVariant:'upgrade1',upgradeCost:1,canUpgrade:true});
 expect(s.upgrade(id)).toBe(true);expect(s.snapshot().units[0]).toMatchObject({variant:'upgrade1',nextVariant:'upgrade2',upgradeCost:1,canUpgrade:true});
 const candidate=s.fork();expect(candidate.upgrade(id)).toBe(true);expect(candidate.tokens).toBe(0);expect(s.units[0].variant).toBe('upgrade1');s.adopt(candidate);
 expect(s.upgrade(id)).toBe(false);expect(s.snapshot().units[0]).toMatchObject({variant:'upgrade2',nextVariant:null,upgradeCost:null,canUpgrade:false});
 for(let i=0;i<4;i++){s.prepare('deploy');if(i===0)s.place(id,[2,0,7]);s.startWave();finish(s);}
 expect(s.levelIndex).toBe(1);expect(s.tokens).toBe(4);expect(s.units[0]).toEqual({id,model:'turret-study',variant:'upgrade2',box:null});
 s.prepare('deploy');expect(s.place(id,[5,0,5])).toBe(true);expect(s.placements[0].variant).toBe('upgrade2');
});
test('upgrade availability follows progression, enabled tiers, phase and wallet',()=>{
 const s=new PlaySession();s.reset();const id=s.buy();s.upgrade(id);expect(s.snapshot().units[0]).toMatchObject({nextVariant:'upgrade2',canUpgrade:false});
 s.tokens=2;expect(s.upgrade(id)).toBe(false);s.levelIndex=1;s.prepare('deploy');expect(s.snapshot().units[0].canUpgrade).toBe(false);expect(s.upgrade(id)).toBe(false);s.prepare('loadout');expect(s.upgrade(id)).toBe(true);expect(s.tokens).toBe(1);
 const baseOnly=new PlaySession(createPlayConfig({defences:{'turret-study':{enabledVariants:['base']}}}));baseOnly.reset();const base=baseOnly.buy();expect(baseOnly.upgrade(base)).toBe(false);expect(baseOnly.snapshot().units[0]).toMatchObject({nextVariant:null,canUpgrade:false});
});
test('next undeployed selection advances in visible order, wraps and returns null only when none remain',()=>{
 const units=['a','b','c','d'].map(id=>({id,box:null}));
 expect(nextUnplaced([])).toBeNull();expect(nextUnplaced(units)).toBe('a');expect(nextUnplaced(units,'missing')).toBe('a');
 units[1].box=[2,0,2];expect(nextUnplaced(units,'b')).toBe('c');units[2].box=[4,0,2];units[3].box=[6,0,2];expect(nextUnplaced(units,'b')).toBe('a');
 units[0].box=[8,0,2];expect(nextUnplaced(units,'d')).toBeNull();units[2].box=null;expect(nextUnplaced(units,'c')).toBe('c');
 const s=new PlaySession();s.reset();const first=s.buy(),second=s.buy();s.prepare('deploy');s.place(second,[2,0,7]);expect(s.nextUnplaced(second)).toBe(first);s.place(first,[9,0,10]);expect(s.nextUnplaced(first)).toBeNull();
});
test('64 finite waves reward once, retain positions and transfer ownership across every level and zone boundary',()=>{
 const s=new PlaySession();s.reset();const id=s.buy();s.prepare('deploy');s.place(id,[2,0,6]);
 for(let i=0;i<64;i++){
  if(i){s.prepare('deploy');if(i%4===0){expect(s.units[0].box).toBeNull();s.place(id,[5,0,5]);}}
  expect(s.startWave()).toBe(true);expect(s.finishWave(s.wave.id)).toBe(false);finish(s);
  if(i<63){expect(s.snapshot().zone).toBe('ABCD'[Math.floor((i+1)/16)]);expect(s.snapshot().levelNumber).toBe(Math.floor((i+1)%16/4)+1);}
  if(i<3)expect(s.units[0].box).toEqual([2,0,6]);if(i===3){expect(s.levelIndex).toBe(1);expect(s.waveIndex).toBe(0);expect(s.units[0].box).toBeNull();}
 }
 expect(s.phase).toBe('complete');expect(s.tokens).toBe(129);expect(s.completedWaves).toBe(64);expect(s.startWave()).toBe(false);
});
test('miss limit wins over wave completion, terminal events deduplicate and retry is fresh',()=>{
 const s=new PlaySession();s.reset();deployAndStart(s);s.misses=9;
 const first=s.wave.spawns[0].id;expect(s.resolve('stale-enemy','escaped')).toBe(false);expect(s.resolve(first,'escaped')).toBe(true);
 expect(s.phase).toBe('defeat');expect(s.resolve(first,'escaped')).toBe(false);expect(s.finishWave(s.wave.id)).toBe(false);expect(s.tokens).toBe(1);
 s.reset();expect(s.snapshot()).toMatchObject({phase:'loadout',tokens:2,misses:0,levelNumber:1,waveNumber:1,completedWaves:0,units:[]});
});
test('pause rejects combat events; killed actors cannot later escape',()=>{
 const s=new PlaySession();s.reset();deployAndStart(s);const id=s.wave.spawns[0].id;
 s.pause(true);expect(s.resolve(id,'escaped')).toBe(false);s.pause(false);expect(s.resolve(id,'killed')).toBe(true);expect(s.resolve(id,'escaped')).toBe(false);expect(s.misses).toBe(0);
});
test('successful waves settle for four seconds before reward or progression and pause freezes settlement',()=>{
 const s=new PlaySession();s.reset();deployAndStart(s);const wave=s.wave;
 expect(s.beginSettling(wave.id)).toBe(false);
 for(const spawn of wave.spawns)s.resolve(spawn.id,'killed');
 expect(s.finishWave(wave.id)).toBe(false);expect(s.beginSettling('old-wave')).toBe(false);expect(s.beginSettling(wave.id)).toBe(true);
 expect(s.snapshot()).toMatchObject({phase:'settling',settleRemaining:4,tokens:1,completedWaves:0,waveNumber:1});
 expect(s.beginSettling(wave.id)).toBe(false);expect(s.buy()).toBeNull();expect(s.prepare('deploy')).toBe(false);
 expect(s.advanceSettlement(3.75)).toBe(false);expect(s.finishWave(wave.id)).toBe(false);
 expect(s.pause(true)).toBe(true);expect(s.advanceSettlement(100)).toBe(false);expect(s.settleRemaining).toBe(.25);expect(s.finishWave(wave.id)).toBe(false);
 s.pause(false);expect(s.advanceSettlement(.25)).toBe(true);expect(s.finishWave(wave.id)).toBe(true);
 expect(s.snapshot()).toMatchObject({phase:'loadout',tokens:3,completedWaves:1,waveNumber:2});expect(s.finishWave(wave.id)).toBe(false);
});
test('defeat cannot settle, invalid time is rejected and reset clears a pending settlement',()=>{
 const s=new PlaySession();s.reset();deployAndStart(s);s.misses=9;s.resolve(s.wave.spawns[0].id,'escaped');
 expect(s.beginSettling(s.wave.id)).toBe(false);expect(s.advanceSettlement(5)).toBe(false);expect(s.tokens).toBe(1);
 s.reset();deployAndStart(s);for(const spawn of s.wave.spawns)s.resolve(spawn.id,'killed');s.beginSettling(s.wave.id);
 for(const dt of [NaN,Infinity,-1])expect(()=>s.advanceSettlement(dt)).toThrow();
 s.reset('title');expect(s.snapshot()).toMatchObject({phase:'title',settleRemaining:0,paused:false,tokens:2,completedWaves:0});expect(s.advanceSettlement(8)).toBe(false);
});


test('family unlocks and upgrades retain correct model and family prices across levels',()=>{
 const s=new PlaySession();s.reset();s.tokens=20;
 expect(s.buy('arc-spire')).toBeNull();expect(s.buy('missile-launcher')).toBeNull();expect(s.buy('unknown')).toBeNull();
 const gun=s.buy();s.upgrade(gun);expect(s.upgrade(gun)).toBe(false);
 s.levelIndex=1;const arc=s.buy('arc-spire');expect(arc).toBeTruthy();expect(s.upgrade(arc)).toBe(true);expect(s.upgrade(arc)).toBe(false);expect(s.upgrade(gun)).toBe(true);
 expect(s.buy('missile-launcher')).toBeNull();s.levelIndex=2;const missile=s.buy('missile-launcher');expect(missile).toBeTruthy();expect(s.upgrade(missile)).toBe(true);expect(s.upgrade(missile)).toBe(false);expect(s.upgrade(arc)).toBe(true);
 s.levelIndex=3;s.tokens=3;expect(s.upgrade(missile)).toBe(true);expect(s.tokens).toBe(0);
 s.prepare('deploy');s.place(arc,[5,0,5]);expect(s.placements[0]).toMatchObject({id:arc,model:'arc-spire',variant:'upgrade2'});
 const before=s.snapshot();expect(before.units.find(u=>u.id===arc).label).toContain('Arc Spire');expect(before.shop.every(item=>item.available)).toBe(true);
});

test('wave briefing reports effective species profiles and per-approach counts',()=>{
 const s=new PlaySession();s.reset();s.levelIndex=2;s.waveIndex=3;
 const brief=s.wavePreview();expect(brief.total).toBe(s.wave.spawns.length);expect(brief.groups.reduce((sum,g)=>sum+g.count,0)).toBe(brief.total);
 for(const group of brief.groups){const spawns=s.wave.spawns.filter(spawn=>spawn.model===group.model&&spawn.routeId===group.routeId);expect(group.count).toBe(spawns.length);expect(group.firstAt).toBe(spawns[0].at);expect(group.lastAt).toBe(spawns.at(-1).at);expect(group.maxHealth).toBe(s.wave.enemyOverrides?.[group.model]?.maxHealth??s.config.enemies[group.model].maxHealth);}
 expect(new Set(brief.groups.map(g=>g.routeId)).size).toBe(2);
});


test('Power generator purchase spends four tokens, remains base-only and survives redeployment and level transfer',()=>{
 const s=new PlaySession();s.reset();
 expect(s.snapshot().shop.find(item=>item.model==='power-generator')).toMatchObject({kind:'enhancer',name:'Power generator',cost:4,available:true,firing:null});
 expect(s.buy('power-generator')).toBeNull();expect(s.tokens).toBe(2);
 // Start from the earned wallet after wave one; campaign rewards have separate coverage.
 s.waveIndex=1;s.completedWaves=1;s.tokens=4;
 const candidate=s.fork(),id=candidate.buy('power-generator');expect(id).toBeTruthy();expect(candidate.tokens).toBe(0);expect(s.tokens).toBe(4);s.adopt(candidate);
 const unit=s.snapshot().units[0];expect(unit).toMatchObject({id,model:'power-generator',kind:'enhancer',variant:'base',nextVariant:null,upgradeCost:null,upgradeAvailableFromWave:null,canUpgrade:false,firing:null});
 expect(unit.label).toBe('Power generator 01');expect(s.upgrade(id)).toBe(false);expect(s.tokens).toBe(0);
 s.prepare('deploy');expect(s.place(id,[5,0,5])).toBe(true);expect(s.upgrade(id)).toBe(false);expect(s.undeploy(id)).toBe(true);expect(s.place(id,[6,0,5])).toBe(true);
 for(let i=0;i<3;i++){s.prepare('deploy');s.startWave();finish(s);expect(s.upgrade(id)).toBe(false);}
 expect(s.levelIndex).toBe(1);expect(s.units[0]).toEqual({id,model:'power-generator',variant:'base',box:null});expect(s.tokens).toBe(6);
 s.prepare('deploy');expect(s.place(id,[5,0,5])).toBe(true);expect(s.placements[0]).toMatchObject({id,model:'power-generator',variant:'base',box:[5,0,5]});
});

test('starting a wave requires a placed owned defence and recalling the last one closes the gate',()=>{
 const s=new PlaySession();s.reset();s.prepare('deploy');
 expect(s.canStartWave).toBe(false);expect(s.snapshot().canStartWave).toBe(false);expect(s.startWave()).toBe(false);expect(s.phase).toBe('deploy');
 s.prepare('loadout');const first=s.buy(),reserve=s.buy();s.prepare('deploy');
 expect(s.startWave()).toBe(false);s.place(first,[2,0,6]);expect(s.canStartWave).toBe(true);expect(s.snapshot().canStartWave).toBe(true);
 s.undeploy(first);expect(s.canStartWave).toBe(false);expect(s.startWave()).toBe(false);
 s.place(first,[2,0,6]);s.place(reserve,[4,0,6]);s.undeploy(first);expect(s.canStartWave).toBe(true);
 expect(s.startWave()).toBe(true);expect(s.canStartWave).toBe(false);expect(s.startWave()).toBe(false);
});
