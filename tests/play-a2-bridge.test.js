import {test,expect} from 'bun:test';
import {auditA2Bridge} from '../scripts/play-a2-bridge-audit.js';
test('A2 second wave bridge-exit Upgrade I guns acquire every species after fresh load and previous-wave transition',async()=>{
 const outcomes=[];
 for(const previousWave of [false,true])for(const hz of [30,60,120]){
  const r=await auditA2Bridge({previousWave,hz});outcomes.push([r.killed,r.escaped,r.stats.map(g=>g.shots)]);
  expect(r.completed).toBe(true);expect(r.killed+r.escaped).toBe(11);
  for(const gun of r.stats){
   for(const species of ['dog','roller','moth'])expect(gun.bySpecies[species]).toBeGreaterThan(0);
   expect(gun.maxNoTargetSeconds).toBeLessThan(.15);expect(gun.maxReadyWithoutShotSeconds).toBeLessThan(.8);
  }
 }
 expect(outcomes).toEqual(Array(6).fill(outcomes[0]));
},30000);
