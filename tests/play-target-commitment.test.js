import {test,expect} from 'bun:test';
import {auditTargetCommitment} from '../scripts/play-targeting-audit.js';
import {legacyPlayConfig} from './helpers/legacy-play-config.js';

test('A1 wave 3 at the reported gun positions finishes acquired targets without unfired reconsideration',async()=>{
 for(const variant of ['upgrade1','upgrade2']){
  const results=[];
  for(const hz of [30,60,120]){
   const result=await auditTargetCommitment({variant,hz,config:legacyPlayConfig()});results.push(result);
   expect(result.completed).toBe(true);expect(result.killed).toBe(5);expect(result.escaped).toBe(0);
   expect(result.changes.filter(change=>change.from&&change.eligible&&change.shots===change.acquiredShots)).toEqual([]);
   // The trace must actually include post-kill acquisitions and useful fire.
   expect(result.deaths).toHaveLength(5);expect(result.shots).toBeGreaterThanOrEqual(50);
   expect(result.changes.some(change=>change.from===null&&change.at>result.deaths[0].at)).toBe(true);
  }
  expect(results.map(r=>[r.killed,r.escaped,r.shots,r.seconds])).toEqual(Array(3).fill([results[0].killed,results[0].escaped,results[0].shots,results[0].seconds]));
 }
},30000);
