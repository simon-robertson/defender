import {test,expect} from 'bun:test';
import {DEFENCE_STATS,DEFENCE_COSTS,defineDefenceStats} from '../shared/defence.js';
import {ARC_SPIRE_FIRING,ARC_SPIRE_TERMINALS,TURRET_FIRING} from '../shared/arsenal.js';
import {WeaponCycle} from '../engine/weapon.js';

test('every registered defence variant has explicit range and provisional preview strength',()=>{
 const turret=DEFENCE_STATS['turret-study'];expect([turret.base.maxRange,turret.upgrade1.maxRange,turret.upgrade2.maxRange]).toEqual([48,72,96]);
 expect([turret.base.strength,turret.upgrade1.strength,turret.upgrade2.strength]).toEqual([10,12,0]);
 for(const variants of Object.values(DEFENCE_STATS))for(const stats of Object.values(variants)){expect(stats.strength).toBeGreaterThanOrEqual(0);expect(typeof stats.requiresLineOfSight).toBe('boolean');expect(Object.isFrozen(stats)).toBe(true);}
});

test('the shared defence contract rejects missing, negative and nonfinite attack stats without retaining mutable input',()=>{
 const valid={base:{maxRange:48,strength:0,requiresLineOfSight:true},upgrade1:{maxRange:72,strength:0,requiresLineOfSight:true},upgrade2:{maxRange:96,strength:0,requiresLineOfSight:true}};
 for(const input of [null,{base:valid.base},{...valid,extra:valid.base}])expect(()=>defineDefenceStats(input)).toThrow();
 for(const key of ['maxRange','strength'])for(const value of [undefined,-1,NaN,Infinity,'48'])expect(()=>defineDefenceStats({...valid,base:{...valid.base,[key]:value}})).toThrow();
 for(const requiresLineOfSight of [undefined,null,0,1,'true'])expect(()=>defineDefenceStats({...valid,base:{...valid.base,requiresLineOfSight}})).toThrow();
 expect(defineDefenceStats({...valid,base:{...valid.base,requiresLineOfSight:false}}).base.requiresLineOfSight).toBe(false);
 const stats=defineDefenceStats(valid);valid.base.maxRange=900;expect(stats.base.maxRange).toBe(48);expect(Object.isFrozen(stats)).toBe(true);
});

test('Arc Spire has three stronger active hitscan tiers without changing token costs or turret rules',()=>{
 const variants=['base','upgrade1','upgrade2'],arc=DEFENCE_STATS['arc-spire'];
 expect(variants.map(variant=>arc[variant].maxRange)).toEqual([48,72,96]);
 expect(variants.map(variant=>arc[variant].strength)).toEqual([30,40,55]);
 expect(variants.map(variant=>ARC_SPIRE_FIRING[variant].shotsPerBurst)).toEqual([1,2,3]);
 expect(variants.map(variant=>ARC_SPIRE_FIRING[variant].shotIntervalSeconds)).toEqual([0,.2,.2]);
 expect(variants.map(variant=>ARC_SPIRE_FIRING[variant].cooldownSeconds)).toEqual([1.4,1.4,1.6]);
 expect(DEFENCE_COSTS).toEqual({'turret-study':{purchaseCost:1,upgradeCost:1},'arc-spire':{purchaseCost:2,upgradeCost:2},'missile-launcher':{purchaseCost:3,upgradeCost:3}});
 expect(Object.isFrozen(ARC_SPIRE_FIRING)).toBe(true);
 const damageRate=(rule,strength)=>rule.shotsPerBurst*strength/((rule.shotsPerBurst-1)*rule.shotIntervalSeconds+rule.cooldownSeconds);
 let previousRate=0;
 for(const variant of variants){
  const rule=ARC_SPIRE_FIRING[variant],stats=arc[variant],cycle=new WeaponCycle(rule);
  expect(Object.isFrozen(rule)).toBe(true);expect(rule.delivery).toBe('hitscan');expect(rule.projectile).toBeNull();
  expect(stats.requiresLineOfSight).toBe(true);expect(cycle.trigger()).toBe(true);expect(cycle.shots).toBe(1);
  const rate=damageRate(rule,stats.strength);
  expect(rate).toBeGreaterThan(previousRate);previousRate=rate;
  // Stronger than the corresponding active gun tier, but never a one-burst
  // kill against the current 300-HP preview enemies.
  if(TURRET_FIRING[variant])expect(rate).toBeGreaterThan(damageRate(TURRET_FIRING[variant],DEFENCE_STATS['turret-study'][variant].strength));
  expect(stats.strength*rule.shotsPerBurst).toBeLessThan(300);
 }
 expect(TURRET_FIRING).toEqual({base:{shotsPerBurst:1,shotIntervalSeconds:0,cooldownSeconds:1,delivery:'hitscan',projectile:null},upgrade1:{shotsPerBurst:3,shotIntervalSeconds:.12,cooldownSeconds:1,delivery:'hitscan',projectile:null},upgrade2:null});
});

test('Arc Spire launch sockets sit on the actual exposed crown terminal tops',async()=>{
 const model=await Bun.file(new URL('../assets/models/arc-spire.json',import.meta.url)).json();
 expect(Object.isFrozen(ARC_SPIRE_TERMINALS)).toBe(true);
 for(const [variant,sockets]of Object.entries(ARC_SPIRE_TERMINALS)){
  const cells=new Set(model.variants[variant].parts.flatMap(part=>part.voxels.map(cell=>cell.slice(0,3).join(','))));
  expect(sockets).toHaveLength(4);expect(new Set(sockets.map(socket=>socket.join(','))).size).toBe(4);
  expect(Object.isFrozen(sockets)).toBe(true);
  for(const socket of sockets){
   const [x,y,z]=socket;expect(Object.isFrozen(socket)).toBe(true);
   // Each socket is the centre of a two-unit square terminal top, so all four
   // supporting cells must exist and the corresponding cells above be empty.
   for(const dx of [-1,0])for(const dz of [-1,0]){
    expect(cells.has([x+dx,y-1,z+dz].join(','))).toBe(true);
    expect(cells.has([x+dx,y,z+dz].join(','))).toBe(false);
   }
  }
 }
});


test('guided missile tiers have explicit impact damage, launch range and user-set3-token costs',()=>{
 const missile=DEFENCE_STATS['missile-launcher'],tiers=['base','upgrade1','upgrade2'];
 expect(tiers.map(v=>missile[v].maxRange)).toEqual([72,96,120]);
 expect(tiers.map(v=>missile[v].strength)).toEqual([60,75,90]);
 for(const v of tiers)expect(missile[v].requiresLineOfSight).toBe(false);
 expect(DEFENCE_COSTS['missile-launcher']).toEqual({purchaseCost:3,upgradeCost:3});
 expect(Object.isFrozen(DEFENCE_COSTS['missile-launcher'])).toBe(true);
});
