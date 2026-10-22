import {test,expect} from 'bun:test';
import {runEncounter,ENCOUNTERS,FLYERS} from '../project-docs/combat-camera-follow-up-2026-10-21/missile-encounters.mjs';
import {MissileFlightPool} from '../engine/missile-flight.js';

for(const hz of [30,60,120])test(`real nearby flyers are intercepted through straight and banked flight at ${hz} Hz`,()=>{
 for(const model of FLYERS)for(const scenario of ENCOUNTERS){
  const result=runEncounter(model,scenario,1/hz);
  expect(result.launchDistance).toBeLessThanOrEqual(72);
  expect(result.launchDistanceAfterWait).toBeLessThanOrEqual(72);
  expect(result.clear).toBe(true);expect(result.wait).toBeLessThan(1);
  expect(result.hits).toBe(1);expect(result.impacts).toHaveLength(1);
  expect(result.collisions+result.expired+result.offMap+result.lostTargets).toBe(0);
  expect(result.missed).toBe(0);
  expect(result.hit.time-result.wait).toBeGreaterThan(.9);
  expect(result.hit.time-result.wait).toBeLessThan(2);
  if(result.cutoff)expect(result.cutoff.speed).toBeGreaterThanOrEqual(180*.98);
 }
});

test('airborne torso forecasts follow actual curve, yaw and bank; active impact keeps the analytic velocity fallback',()=>{
 for(const model of FLYERS)runEncounter(model,ENCOUNTERS[3],1/120,MissileFlightPool,({pool,enemies,target})=>{
  for(const seconds of [.05,.3,.7,1.1]){
   expect(pool.routeAim(target,seconds)).toBe(true);const aim=Array.from(pool.futureAim);
   enemies.advance(seconds);
   expect(Math.hypot(aim[0]-target.aimX,aim[1]-target.aimY,aim[2]-target.aimZ)).toBeLessThan(.00003);
   enemies.reset();
  }
  target.impact.active=true;expect(pool.routeAim(target,.2)).toBe(false);target.impact.active=false;
 });
});

test('slow and fast accepted steering variations retain nearby physical flyer interception',()=>{
 for(const factor of [.85,1.15])for(const model of FLYERS)for(const scenario of [ENCOUNTERS[0],ENCOUNTERS[3]]){
  const result=runEncounter(model,scenario,1/60,MissileFlightPool,({pool})=>{pool.random=()=>factor===.85?0:1;});
  expect(result.clear).toBe(true);expect(result.launchDistanceAfterWait).toBeLessThanOrEqual(72);expect(result.hits).toBe(1);expect(result.collisions+result.expired+result.offMap).toBe(0);
 }
});
