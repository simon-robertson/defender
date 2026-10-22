import {test,expect} from 'bun:test';
import {DamageEffects,debrisPalette} from '../engine/damage-effects.js';
import {sweepScenery,debrisSupport} from '../engine/debris-collision.js';
import {Health} from '../engine/health.js';
import {ENEMY_STATS,defineEnemyStats} from '../shared/enemy.js';
import {MAX_DEBRIS,MAX_SMOKE,MAX_BLASTS} from '../shared/damage-effects.js';
import {meshQuads} from '../shared/mesher.js';
import {SceneryVisibility} from '../engine/visibility.js';
import {newLevel} from '../shared/level.js';
import {newModel} from '../shared/model.js';
import {identity} from '../shared/math.js';

function random(){let seed=123;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function fixture(model='dog'){
 const visibility={bounds:new Float32Array([-1000,0,-1000,1000,24,1000]),escape:new Uint32Array([1]),nodeCount:1};
 const materials=[{color:'#293A3F',emission:0,reflectiveness:0},{color:'#C6C0AC',emission:0,reflectiveness:0},{color:'#E86E3F',emission:0,reflectiveness:0}];
 const mesh=meshQuads([{origin:[0,0,0],axis:1,sign:1,width:10,height:10,material:0},{origin:[0,1,0],axis:1,sign:1,width:8,height:8,material:1},{origin:[0,2,0],axis:1,sign:1,width:1,height:1,material:2}],materials);
 const matrix=identity();matrix[12]=matrix[14]=-12;matrix[13]=23;
 const actor={model,variant:'base',instances:[{key:'dog:body',part:'body',matrix}]},world={visibility,actors:new Map([['dog',actor]]),entries:[{key:'dog:body',mesh}]};
 const state={id:'dog',health:new Health(ENEMY_STATS.dog.maxHealth),x:0,z:0,aimY:34.5};
 const effects=new DamageEffects(random());effects.setWorld(world,[state]);return {effects,state,world,actor};
}

test('enemy config doubles HP and validates enemy-specific explosion sizes and bounded debris counts',()=>{
 expect(ENEMY_STATS.dog.maxHealth).toBe(300);expect(ENEMY_STATS.dog.explosion.debrisCount).toBe(24);expect(Object.isFrozen(ENEMY_STATS.dog.explosion)).toBe(true);
 for(const debrisCount of [0,-1,1.5,MAX_DEBRIS+1,Infinity])expect(()=>defineEnemyStats({...ENEMY_STATS.dog,explosion:{...ENEMY_STATS.dog.explosion,debrisCount}})).toThrow();
 for(const size of [0,-1,NaN])expect(()=>defineEnemyStats({...ENEMY_STATS.dog,explosion:{...ENEMY_STATS.dog.explosion,size}})).toThrow();
 for(const settleSeconds of [.5,3])expect(()=>defineEnemyStats({...ENEMY_STATS.dog,explosion:{...ENEMY_STATS.dog.explosion,settleSeconds}})).toThrow();
 for(const effectOrigin of [null,{part:'',point:[1,2,3]},{part:'body',point:[NaN,1,2]},{part:'body',point:[1,2]}])expect(()=>defineEnemyStats({...ENEMY_STATS.dog,effectOrigin})).toThrow();
 for(const waveSeconds of [0,-1,NaN])expect(()=>defineEnemyStats({...ENEMY_STATS.dog,explosion:{...ENEMY_STATS.dog.explosion,waveSeconds}})).toThrow();
 const customized=defineEnemyStats({...ENEMY_STATS.dog,explosion:{...ENEMY_STATS.dog.explosion,size:8,debrisCount:12}});expect(customized.explosion.size).toBe(8);expect(customized.explosion.debrisCount).toBe(12);
 for(const model of ['dog','walker','spider']){
  const config=ENEMY_STATS[model].explosion;expect(config.lightStrength).toBe(44);expect(config.lightRadius).toBe(96);
  expect(config.frightRadius).toBe(model==='walker'?84:72);
 }
 for(const key of ['lightStrength','frightRadius'])for(const value of [0,-1,NaN,Infinity])expect(()=>defineEnemyStats({...ENEMY_STATS.dog,explosion:{...ENEMY_STATS.dog.explosion,[key]:value}})).toThrow();
});

test('damage smoke starts strictly below half health, rises, expires and stops emitting on death',()=>{
 const {effects,state}=fixture();state.health.takeDamage(150);effects.emitSmoke(1);effects.prepare();expect(effects.smokeCount).toBe(0);
 state.health.takeDamage(1);effects.emitSmoke(.125);effects.prepare();expect(effects.smokeCount).toBe(1);const y=effects.particleData[1];
 effects.advance(.2);effects.prepare();expect(effects.particleData[1]).toBeGreaterThan(y);
 state.health.takeDamage(200);effects.emitSmoke(2);expect(effects.activeSmoke).toBe(1);effects.advance(1.2);effects.prepare();expect(effects.smokeCount).toBe(0);
 for(const delta of [-1,NaN,Infinity]){expect(()=>effects.advance(delta)).toThrow();expect(()=>effects.emitSmoke(delta)).toThrow();}
});

test('explosions add no smoke while existing living-damage puffs finish naturally',()=>{
 for(const model of ['dog','walker','spider']){
  const {effects,state}=fixture(model),pool=effects.smoke,storage=effects.particleData;
  state.health.takeDamage(300);effects.explode(state);effects.prepare();
  expect(effects.activeSmoke).toBe(0);expect(effects.smokeCount).toBe(0);expect(effects.blastCount).toBe(1);
  expect(effects.lightData[7]).toBe(96);expect(effects.lightData[11]).toBe(44);
  effects.reset(true);state.health.reset();state.health.takeDamage(151);effects.emitSmoke(.25);
  expect(effects.activeSmoke).toBe(2);const ages=effects.smoke.slice(0,2).map(p=>p.age);
  state.health.takeDamage(300);effects.explode(state);effects.emitSmoke(1);effects.prepare();
  expect(effects.smokeCount).toBe(2);expect(effects.smoke.slice(0,2).map(p=>p.age)).toEqual(ages);expect(effects.droppedSmoke).toBe(0);
  effects.advance(1.2);effects.prepare();expect(effects.smokeCount).toBe(0);expect(effects.activeSmoke).toBe(0);
  expect(effects.smoke).toBe(pool);expect(effects.particleData).toBe(storage);
  effects.reset();expect(effects.emitters).toHaveLength(0);expect(effects.visibility).toBeNull();
 }
});

test('dominant debris colours are weighted by visible model area and stay in linear model colour space',()=>{
 const {effects,state,world,actor}=fixture(),palette=debrisPalette(world,actor);
 expect(palette[3]).toBeCloseTo(100/165,6);expect(palette[7]).toBeCloseTo(164/165,6);expect(palette[11]).toBe(1);
 effects.explode(state);effects.prepare();expect(effects.cubeCount).toBe(24);expect(effects.blastCount).toBe(1);expect(effects.lightCount).toBe(1);expect(effects.lightData[7]).toBe(96);expect(effects.lightData[11]).toBe(44);
 for(const p of effects.cubes.filter(p=>p.active))expect([0,4,8].some(k=>p.r===palette[k]&&p.g===palette[k+1]&&p.b===palette[k+2])).toBe(true);
 const pale=effects.cubes.filter(p=>p.active&&p.r===palette[4]).length;
 expect(pale).toBeGreaterThanOrEqual(8);expect(pale).toBeLessThanOrEqual(11);
 const initial=effects.cubeData.slice(0,16);effects.advance(.1);effects.prepare();expect(effects.cubeData.slice(0,16)).not.toEqual(initial);
 effects.advance(.2);effects.prepare();expect(effects.blastCount).toBe(1);expect(effects.lightCount).toBe(1);expect(effects.cubeCount).toBe(24);
 expect(effects.particleData[effects.smokeCount*12+7]).toBeGreaterThan(.3);expect(effects.shockwaveCount).toBe(1);
 const radius=effects.shockwaveData[3];effects.advance(.3);effects.prepare();expect(effects.blastCount).toBe(0);expect(effects.lightCount).toBe(0);expect(effects.shockwaveCount).toBe(1);expect(effects.shockwaveData[3]).toBeGreaterThan(radius);
 effects.advance(.11);effects.prepare();expect(effects.shockwaveCount).toBe(0);expect(effects.activeBlasts).toBe(0);
});

test('smoke, fragments, blast, light and wave share the current transformed body centre',()=>{
 const {effects,state,actor}=fixture(),m=actor.instances[0].matrix;
 // The aim/route point deliberately disagrees. A rotated and translated body
 // has its local [12,11.5,12] centre at [22,41.5,38].
 m[0]=m[10]=0;m[2]=-1;m[8]=1;m[12]=10;m[13]=30;m[14]=50;
 state.health.takeDamage(151);effects.emitSmoke(.125);const smoke=effects.smoke[0];expect([smoke.x,smoke.y,smoke.z]).toEqual([22,41.5,38]);
 const blast=effects.explode(state);expect(blast).toBe(effects.blasts[0]);expect([blast.x,blast.y,blast.z]).toEqual([22,41.5,38]);
 expect(blast.config).toBe(ENEMY_STATS.dog.explosion);expect(effects.explode({id:'unknown'})).toBeUndefined();
 for(const p of effects.cubes)if(p.active)expect([p.x,p.y,p.z]).toEqual([22,41.5,38]);
 effects.prepare();expect(Array.from(effects.lightData.slice(4,7))).toEqual([22,41.5,38]);
 // Death stays fixed in the world even if the former part matrix later moves.
 m[12]=100;effects.advance(.1);effects.prepare();expect(Array.from(effects.shockwaveData.slice(0,3))).toEqual([22,41.5,38]);
 const storage=effects.shockwaveData;effects.reset();effects.prepare();expect(effects.shockwaveCount).toBe(0);expect(effects.shockwaveData).toBe(storage);expect(effects.shockwaveData.every(v=>v===0)).toBe(true);
});

test('smoke blends by current projected depth instead of radial camera distance',()=>{
 const {effects,state}=fixture();state.health.takeDamage(151);effects.emitSmoke(.25);
 const a=effects.smoke[0],b=effects.smoke[1];
 for(const p of [a,b]){p.vx=p.vz=p.rise=0;p.y=0;}
 a.x=100;a.z=.2;b.x=0;b.z=.8;
 const vp=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 effects.prepare(vp);expect(effects.particleData[2]).toBeCloseTo(.8);
 vp[10]=-1;effects.prepare(vp);expect(effects.particleData[2]).toBeCloseTo(.2);
});

test('swept debris cannot tunnel through thin scenery and lands on roofs rather than the ground below',()=>{
 const model=newModel('wall');model.role='scenery';model.variants.base.parts[0].voxels=[];
 for(let y=0;y<10;y++)for(let z=0;z<24;z++)model.variants.base.parts[0].voxels.push([12,y,z,0]);
 const level=newLevel('debris-test');level.size=[3,3];level.placements=[{id:'wall',model:'wall',variant:'base',box:[1,0,1],turn:0}];
 const visibility=new SceneryVisibility(level,new Map([['wall',model]])),hit=new Float64Array(5);
 expect(sweepScenery(visibility,20,30,36,40,0,0,1,hit)).toBe(true);expect(hit[0]).toBeCloseTo(15/40);expect(Array.from(hit.slice(1,4))).toEqual([-1,0,0]);
 expect(sweepScenery(visibility,36.5,50,36,0,-60,0,1,hit)).toBe(true);expect(hit[4]).toBe(34);expect(hit[2]).toBe(1);expect(debrisSupport(visibility,36.5,36,.5,35)).toBe(34);
 expect(sweepScenery(visibility,25,50,36,0,-60,0,1,hit)).toBe(true);expect(hit[4]).toBe(24);
 expect(debrisSupport(visibility,36.5,36,.5,33)).toBe(24);visibility.dispose();
});

test('all flight cubes bounce, settle flat on a real surface, rest 1.5 seconds then vanish',()=>{
 const {effects,state}=fixture();effects.explode(state);effects.prepare();const firstRest=new Map(),lastPose=new Map(),expired=new Set(),storage=effects.cubeData;
 for(let frame=1;frame<=900;frame++){
  effects.advance(1/120);effects.prepare();
  for(let i=0;i<effects.cubes.length;i++){
   const p=effects.cubes[i];if(p.active){
    expect(p.y-p.size/2).toBeGreaterThanOrEqual(24-1e-6);
    if(p.resting){
     if(!firstRest.has(i)){firstRest.set(i,frame/120);lastPose.set(i,[p.x,p.y,p.z]);}
     expect(p.y-p.size/2).toBeCloseTo(24,5);expect([p.x,p.y,p.z]).toEqual(lastPose.get(i));expect([p.vx,p.vy,p.vz,p.wx,p.wy,p.wz]).toEqual([0,0,0,0,0,0]);
    }
   }else if(firstRest.has(i)&&!expired.has(i)){expect(frame/120-firstRest.get(i)).toBeGreaterThanOrEqual(1.5-1e-8);expect(frame/120-firstRest.get(i)).toBeLessThan(1.52);expired.add(i);}
  }
 }
 expect(firstRest.size).toBe(24);expect(expired.size).toBe(24);expect(effects.cubeCount).toBe(0);expect(effects.cubeData).toBe(storage);
 const revision=effects.cubeRevision;effects.advance(10);effects.prepare();expect(effects.cubeRevision).toBe(revision);
});

test('resting debris can sit on scenery tops and low stream beds without treating water as solid',()=>{
 const {effects,state}=fixture();effects.explode(state);const p=effects.cubes[0];
 effects.visibility={bounds:new Float32Array([-10,0,-10,10,40,10]),escape:new Uint32Array([1]),nodeCount:1};p.x=p.z=0;p.y=45;p.vx=p.vz=0;p.vy=-3;
 for(let i=0;i<300&&!p.resting;i++)effects.stepCube(p,1/120);
 expect(p.resting).toBe(true);expect(p.y-p.size/2).toBeCloseTo(40,6);
 const level=newLevel('stream-debris');level.size=[1,1];level.terrain.boxes=[{box:[0,0],ground:4,water:12}];const visibility=new SceneryVisibility(level,new Map());
 expect(debrisSupport(visibility,12,12,1,20)).toBe(4);
});

test('pool exhaustion is bounded, reset releases scene references and inactive effects perform no collision work',()=>{
 const {effects,state}=fixture(),arrays=[effects.cubeData,effects.particleData,effects.lightData],pool=effects.cubes;
 for(let i=0;i<10;i++)effects.explode(state);effects.prepare();expect(effects.cubeCount).toBe(MAX_DEBRIS);expect(effects.blastCount).toBe(MAX_BLASTS);expect(effects.droppedCubes).toBe(48);expect(effects.replacedBlasts).toBe(6);
 state.health.takeDamage(151);for(let i=0;i<MAX_SMOKE;i++)effects.emitSmoke(1);effects.prepare();expect(effects.smokeCount).toBe(MAX_SMOKE);expect(effects.droppedSmoke).toBeGreaterThan(0);
 effects.reset();expect(effects.visibility).toBeNull();expect(effects.emitters).toHaveLength(0);expect(effects.cubes.every(p=>!p.active&&p.config===null)).toBe(true);
 effects.advance(100);effects.prepare();expect(effects.cubeCount+effects.smokeCount+effects.blastCount+effects.lightCount).toBe(0);expect(effects.cubes).toBe(pool);expect([effects.cubeData,effects.particleData,effects.lightData]).toEqual(arrays);
});

test('every enemy death light ends thirty percent sooner with the same peak, radius and independent blast/debris lifetime',()=>{
 for(const model of Object.keys(ENEMY_STATS)){
  const {effects,state}=fixture(model),config=ENEMY_STATS[model].explosion;
  expect(config.lightSeconds).toBeCloseTo(.48*.7,12);effects.explode(state);
  for(const age of [0,.168,.335999,.336,.4]){
   effects.advance(age-effects.time);effects.prepare();expect(effects.lightCount).toBe(age<.336?1:0);
   if(age<.336){expect(effects.lightData[7]).toBe(96);expect(effects.lightData[11]).toBeCloseTo(44*(1-age/.336)**2,5);}
   expect(effects.blastCount).toBe(1);expect(effects.cubeCount).toBe(config.debrisCount);
  }
  effects.advance(.15);effects.prepare();expect(effects.blastCount).toBe(0);expect(effects.shockwaveCount).toBe(1);expect(effects.cubeCount).toBe(config.debrisCount);
 }
});
