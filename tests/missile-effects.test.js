import {test,expect} from 'bun:test';
import {DamageEffects} from '../engine/damage-effects.js';
import {Health} from '../engine/health.js';
import {meshQuads} from '../shared/mesher.js';
import {identity} from '../shared/math.js';
import {MAX_SMOKE,MAX_EFFECT_SMOKE,MAX_TRAIL_SMOKE,MAX_BLASTS,MAX_DAMAGE_PARTICLES,MISSILE_BLAST_PARTICLES,MISSILE_IMPACT_EFFECT,MISSILE_IMPACT_SMOKE,MISSILE_LAUNCH_SMOKE} from '../shared/damage-effects.js';

function fixture(enemies=true){
 const visibility={bounds:new Float32Array([-1000,0,-1000,1000,24,1000]),escape:new Uint32Array([1]),nodeCount:1};
 const mesh=meshQuads([{origin:[0,0,0],axis:1,sign:1,width:4,height:4,material:0}],[{color:'#C6C0AC',emission:0,reflectiveness:0}]);
 const matrix=identity();matrix[13]=24;
 const actor={model:'dog',variant:'base',instances:[{key:'dog:body',part:'body',matrix}]},world={visibility,actors:new Map([['dog',actor]]),entries:[{key:'dog:body',mesh}]};
 const state={id:'dog',health:new Health(300)},effects=new DamageEffects(()=>.5);effects.setWorld(world,enemies?[state]:[]);
 return {effects,state,world};
}

test('missile impacts retain the core, eight fireball lobes, smoke and original light curve without outward fragments',()=>{
 const {effects,state}=fixture(false),blast=effects.missileImpact(10,24,30,0,4,3);
 expect(blast.kind).toBe('missile');expect(blast.x).toBe(10);expect(blast.y).toBeCloseTo(24.12,10);expect(blast.z).toBeCloseTo(30.09,10);
 expect(blast.config).toBe(MISSILE_IMPACT_EFFECT);expect(blast.config.frightRadius).toBe(48);
 for(const age of [0,.02,.04,.12,.25,.27,.4,.69]){
  effects.advance(age-effects.time);effects.prepare();
  expect(effects.lightCount).toBe(age<.26?1:0);
  if(age<.26){expect(effects.lightData[7]).toBe(52);expect(effects.lightData[11]).toBeCloseTo(26*(1-age/.26)**2,5);}
  expect(effects.blastCount).toBe(age<.68?MISSILE_BLAST_PARTICLES:0);
  expect(effects.cubeCount).toBe(0);expect(state.health.current).toBe(300);
  expect(effects.particleCount).toBeLessThanOrEqual(MAX_DAMAGE_PARTICLES);
  if(age===.12){
   const hot=effects.particleData.slice(effects.smokeCount*12,effects.particleCount*12);
   expect(hot[3]).toBe(22);expect(effects.smokeCount).toBe(9);expect(effects.shockwaveCount).toBe(1);
   const fireball=Array.from({length:effects.blastCount},(_,i)=>hot.slice(i*12,(i+1)*12));
   expect(fireball).toHaveLength(9);expect(fireball.every(p=>p[8]===1)).toBe(true);
   expect(fireball.slice(1).every(p=>Math.hypot(p[0]-blast.x,p[2]-blast.z)>1)).toBe(true);
   expect(effects.particleCount).toBe(18);
  }
 }
 effects.advance(2);effects.prepare();expect(effects.particleCount+effects.lightCount+effects.shockwaveCount).toBe(0);
 const zero=effects.missileImpact(2,3,4,0,0,0);expect(zero.y).toBeCloseTo(3.15,10);
 const count=effects.missileImpacts;for(const args of [[NaN,1,2],[1,2,3,Infinity,0,0]])expect(()=>effects.missileImpact(...args)).toThrow();expect(effects.missileImpacts).toBe(count);
});

test('missile and enemy death visuals retain their independent expansion, colour, peak light and particle timing',()=>{
 const {effects,state}=fixture();effects.explode(state);effects.prepare();
 expect(effects.particleData[3]).toBeCloseTo(3.36,6);expect(effects.particleData[5]).toBeCloseTo(.64,6);expect(effects.particleData[6]).toBeCloseTo(.27,6);
 expect(effects.lightData[7]).toBe(96);expect(effects.lightData[11]).toBe(44);expect(effects.activeSmoke).toBe(0);
 effects.advance(.04);effects.prepare();expect(effects.particleData[3]).toBeCloseTo(7.68,6);expect(effects.particleData[5]).toBeCloseTo(.46,6);expect(effects.particleData[6]).toBeCloseTo(.16,6);
 effects.advance(.04);effects.prepare();expect(effects.particleData[3]).toBeCloseTo(12,6);expect(effects.particleData[5]).toBeCloseTo(.28,6);expect(effects.particleData[6]).toBeCloseTo(.05,6);
 effects.advance(.25);effects.prepare();expect(effects.blastCount).toBe(1);expect(effects.lightCount).toBe(1);expect(effects.missileBlastCount).toBe(0);
 effects.advance(.16);effects.prepare();expect(effects.lightCount).toBe(0);expect(effects.blastCount).toBe(1);
 effects.advance(.07);effects.prepare();expect(effects.blastCount).toBe(0);expect(effects.shockwaveCount).toBe(1);
});

test('the shared flash budget replaces old missile flashes while every active death blast retains priority',()=>{
 const {effects,state}=fixture(),death=effects.explode(state);effects.advance(.05);
 const oldMissile=effects.missileImpact(1,24,1);effects.advance(.01);effects.missileImpact(2,24,2);effects.advance(.01);effects.missileImpact(3,24,3);
 const deathOrigin=[death.x,death.y,death.z],deathConfig=death.config;
 expect(effects.activeBlasts).toBe(MAX_BLASTS);expect(effects.missileImpact(4,24,4)).toBe(oldMissile);expect(effects.replacedBlasts).toBe(1);
 expect(death.kind).toBe('death');expect(death.config).toBe(deathConfig);expect([death.x,death.y,death.z]).toEqual(deathOrigin);
 for(let i=0;i<3;i++)effects.explode(state);
 expect(effects.blasts.every(b=>b.active&&b.kind==='death')).toBe(true);const ages=effects.blasts.map(b=>b.age);
 expect(effects.missileImpact(5,24,5)).toBeNull();expect(effects.droppedMissileBlasts).toBe(1);expect(effects.blasts.map(b=>b.age)).toEqual(ages);
 effects.prepare();expect(effects.lightCount).toBe(MAX_BLASTS);expect(effects.missileBlastCount).toBe(0);
 effects.advance(.8);expect(effects.missileImpact(6,24,6)).not.toBeNull();expect(effects.activeBlasts).toBe(1);
});

test('launch smoke is immediately visible around the mouth and drifts outward and upward before expiry',()=>{
 const {effects}=fixture(false),x=20,y=38,z=50;
 expect(effects.launchSmoke(x,y,z)).toBe(8);effects.prepare();expect(effects.launchSmokeCount).toBe(8);expect(effects.smokeCount).toBe(8);expect(effects.launches).toBe(1);
 expect(effects.blastCount+effects.lightCount+effects.shockwaveCount+effects.cubeCount).toBe(0);
 const initial=effects.particleData.slice(0,8*12);
 for(let i=0;i<8;i++){
  const p=effects.smoke[i],k=i*12;
  expect(p.launch).toBe(true);expect(Math.hypot(p.x-x,p.z-z)).toBeLessThanOrEqual(1.5);expect(p.y).toBeGreaterThan(y);
  expect(p.life).toBeGreaterThanOrEqual(1.3);expect(p.life).toBeLessThanOrEqual(1.8);
  expect(initial[k+3]).toBeGreaterThanOrEqual(4.2);expect(initial[k+3]).toBeLessThanOrEqual(5.2);expect(initial[k+7]).toBeCloseTo(.82,6);expect(initial[k+8]).toBe(0);
  expect(initial[k+4]).toBeCloseTo(.52,6);expect(initial[k+5]).toBeCloseTo(.50,6);expect(initial[k+6]).toBeCloseTo(.46,6);
  expect((p.x-x)*p.vx+(p.z-z)*p.vz).toBeGreaterThan(0);
 }
 effects.advance(.35);effects.prepare();expect(effects.launchSmokeCount).toBe(8);
 for(let i=0;i<8;i++){
  const k=i*12,p=effects.smoke[i];expect(effects.particleData[k+1]).toBeGreaterThan(initial[k+1]);expect(effects.particleData[k+3]).toBeGreaterThan(initial[k+3]);expect(effects.particleData[k+7]).toBeLessThan(initial[k+7]);
  expect(effects.particleData[k+3]).toBeGreaterThan(5);expect(effects.particleData[k+7]).toBeGreaterThan(.6);
  expect((effects.particleData[k]-initial[k])*p.vx+(effects.particleData[k+2]-initial[k+2])*p.vz).toBeGreaterThan(0);
 }
 effects.advance(2);effects.prepare();expect(effects.activeSmoke+effects.smokeCount+effects.launchSmokeCount+effects.particleCount).toBe(0);expect(effects.launches).toBe(1);
 for(const args of [[NaN,1,2],[1,Infinity,2],[1,2,NaN]])expect(()=>effects.launchSmoke(...args)).toThrow();
});

test('launch and damage smoke share bounded storage without eviction or colour leaking on slot reuse',()=>{
 const {effects,state}=fixture();state.health.takeDamage(151);effects.emitSmoke(.25);
 const first=effects.smoke[0],second=effects.smoke[1],ages=[first.age,second.age];expect(first.launch).toBe(false);expect(second.launch).toBe(false);
 let emitted=0;for(let i=0;i<MAX_EFFECT_SMOKE/MISSILE_LAUNCH_SMOKE.count;i++)emitted+=effects.launchSmoke(0,38,0);
 expect(emitted).toBe(MAX_EFFECT_SMOKE-2);expect(effects.droppedLaunchSmoke).toBe(2);expect(effects.launchSmoke(0,38,0)).toBe(0);expect(effects.droppedLaunchSmoke).toBe(10);
 expect([first.age,second.age]).toEqual(ages);expect(first.launch).toBe(false);expect(second.launch).toBe(false);
 effects.prepare();expect(effects.smokeCount).toBe(MAX_EFFECT_SMOKE);expect(effects.launchSmokeCount).toBe(MAX_EFFECT_SMOKE-2);expect(effects.particleCount).toBeLessThanOrEqual(MAX_DAMAGE_PARTICLES);
 effects.advance(2);effects.emitSmoke(.125);effects.prepare();expect(effects.smokeCount).toBe(1);expect(effects.launchSmokeCount).toBe(0);expect(effects.smoke[0]).toBe(first);
 expect(effects.particleData[4]).toBeCloseTo(.04,6);expect(effects.particleData[5]).toBeCloseTo(.045,6);expect(effects.particleData[6]).toBeCloseTo(.05,6);
 state.health.takeDamage(300);effects.explode(state);effects.emitSmoke(1);expect(effects.activeSmoke).toBe(1);expect(effects.smoke[0].launch).toBe(false);
});

test('missile effect reset reuses every pool and payload, including a scene with no enemy emitters',()=>{
 const {effects,world}=fixture(false),pools=[effects.smoke,effects.blasts,effects.cubes],storage=[effects.cubeData,effects.particleData,effects.lightData,effects.shockwaveData,effects.smokeOrder,effects.smokeDepth,effects.contact];
 effects.launchSmoke(10,38,20);effects.missileImpact(30,24,40);effects.advance(.1);effects.prepare();expect(effects.particleCount).toBe(8+9+MISSILE_BLAST_PARTICLES);
 effects.reset(true);effects.prepare();expect(effects.visibility).toBe(world.visibility);expect(effects.emitters).toHaveLength(0);
 expect(effects.particleCount+effects.lightCount+effects.shockwaveCount+effects.activeSmoke+effects.activeBlasts).toBe(0);
 expect(effects.missileImpacts+effects.launches+effects.droppedMissileBlasts+effects.droppedLaunchSmoke).toBe(0);
 expect(effects.smoke.every(p=>!p.active&&!p.launch)).toBe(true);expect(effects.blasts.every(b=>!b.active&&b.kind===null&&b.config===null)).toBe(true);
 effects.launchSmoke(10,38,20);effects.missileImpact(30,24,40);effects.reset();effects.advance(100);effects.prepare();expect(effects.visibility).toBeNull();expect(effects.particleCount).toBe(0);
 expect([effects.smoke,effects.blasts,effects.cubes]).toEqual(pools);expect([effects.cubeData,effects.particleData,effects.lightData,effects.shockwaveData,effects.smokeOrder,effects.smokeDepth,effects.contact]).toEqual(storage);
 expect(Object.isFrozen(MISSILE_LAUNCH_SMOKE)).toBe(true);
});

test('attack smoke uses its reserved ring, fades after cutoff and clears its colour on reset',()=>{
 const {effects}=fixture(false),storage=effects.particleData;
 expect(effects.missileTrail(10,80,30)).toBe(true);effects.prepare();expect(effects.smokeCount).toBe(1);expect(effects.launchSmokeCount).toBe(0);
 const radius=storage[3],opacity=storage[7];expect(radius).toBeGreaterThan(1);expect(opacity).toBeGreaterThan(.3);
 effects.advance(.4);effects.prepare();expect(storage[3]).toBeGreaterThan(radius);expect(storage[7]).toBeLessThan(opacity);expect(storage[1]).toBeGreaterThan(80);
 for(let i=1;i<MAX_TRAIL_SMOKE;i++)expect(effects.missileTrail(i,80,30)).toBe(true);
 expect(effects.missileTrail(0,80,30)).toBe(true);expect(effects.activeSmoke).toBe(MAX_TRAIL_SMOKE);expect(effects.recycledTrailSmoke).toBe(1);expect(effects.droppedSmoke).toBe(0);
 effects.advance(2);effects.prepare();expect(effects.smokeCount).toBe(0);effects.launchSmoke(10,24,30);effects.prepare();expect(effects.launchSmokeCount).toBe(MISSILE_LAUNCH_SMOKE.count);
 effects.reset();expect(effects.smoke.every(p=>!p.active&&!p.trail)).toBe(true);expect(effects.particleData).toBe(storage);
});

test('simultaneous missile bursts stay bounded and pause holds all payloads exactly',()=>{
 const {effects}=fixture(false);
 for(let i=0;i<MAX_TRAIL_SMOKE;i++)effects.missileTrail(i,80,0);
 for(let i=0;i<MAX_BLASTS;i++)effects.missileImpact(i*20,24,0);
 effects.advance(.1);effects.prepare();expect(effects.particleCount).toBe(MAX_TRAIL_SMOKE+MAX_BLASTS*(MISSILE_BLAST_PARTICLES+MISSILE_IMPACT_SMOKE.count));
 const data=effects.particleData.slice(),light=effects.lightData.slice();effects.advance(0);effects.prepare();expect(effects.particleData).toEqual(data);expect(effects.lightData).toEqual(light);
 effects.advance(3);effects.prepare();expect(effects.particleCount).toBe(0);
 effects.launchSmoke(0,24,0);expect(effects.smoke.filter(p=>p.active).every(p=>p.launch&&!p.impact)).toBe(true);
});
