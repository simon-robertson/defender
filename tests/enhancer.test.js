import {test,expect} from 'bun:test';
import {defineEnhancerStats,ENHANCER_STATS} from '../shared/enhancer.js';

const fields=['strengthIncrease','fireRateIncrease','cooldownDecrease'];
const valid=()=>({
 base:{strengthIncrease:0,fireRateIncrease:.25,cooldownDecrease:1},
});

test('enhancer scalar contract accepts inclusive endpoints and fractional values without retaining mutable input',()=>{
 const input=valid(),stats=defineEnhancerStats(input);
 expect(stats).toEqual(input);expect(Object.isFrozen(stats)).toBe(true);
 for(const value of Object.values(stats))expect(Object.isFrozen(value)).toBe(true);
 input.base.strengthIncrease=.9;input.base.cooldownDecrease=0;
 expect(stats.base.strengthIncrease).toBe(0);expect(stats.base.cooldownDecrease).toBe(1);
});

test('enhancer scalar contract rejects upgrades, missing base, unknown fields and invalid numeric values',()=>{
 const input=valid();
 for(const value of [null,[],{}, {upgrade1:input.base},{...input,upgrade1:input.base},{...input,upgrade2:input.base},{...input,extra:input.base}])expect(()=>defineEnhancerStats(value)).toThrow();
 for(const value of [null,[],{}, {...input.base,unknown:0}])expect(()=>defineEnhancerStats({...input,base:value})).toThrow();
 for(const field of fields){
  const missing={...input.base};delete missing[field];expect(()=>defineEnhancerStats({...input,base:missing})).toThrow();
  for(const value of [-.001,1.001,NaN,Infinity,-Infinity,'0.2',null,undefined,true]){
   for(const variant of Object.keys(input))expect(()=>defineEnhancerStats({...input,[variant]:{...input[variant],[field]:value}})).toThrow();
  }
 }
});

test('power generator carries one approved strength version while historical geometry remains intact',async()=>{
 const source=await Bun.file(new URL('../assets/models/power-generator.json',import.meta.url)).json(),stats=ENHANCER_STATS[source.id];
 expect(Object.isFrozen(ENHANCER_STATS)).toBe(true);
 expect(Object.keys(stats)).toEqual(['base']);expect(Object.keys(source.variants)).toEqual(['base','upgrade1','upgrade2']);
 expect(Object.values(stats).map(s=>s.strengthIncrease)).toEqual([.25]);
 for(const s of Object.values(stats)){expect(s.fireRateIncrease).toBe(0);expect(s.cooldownDecrease).toBe(0);}
});
