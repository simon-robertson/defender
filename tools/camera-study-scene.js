import {PLAY_CONFIG} from '../play/config.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine,PLAY_TICK} from '../play/engine.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {ArcEffects} from '../engine/arc-effects.js';
import {PlasmaLinks} from '../engine/plasma-links.js';
import {createPlasmaLinks} from '../game/plasma-links.js';
import {TURRET_MUZZLES} from '../shared/arsenal.js';
import {emitMissileImpact} from '../game/missile-impact.js';
import {LevelConditions} from '../play/conditions.js';

export const STUDY_VERSION=1,STUDY_MAX_SECONDS=120;
export function seededRandom(seed=20261022){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export async function createStudyScene(recipe,hooks={}){
 const level=PLAY_CONFIG.levels[recipe.levelIndex],wave=level.waves[recipe.waveIndex];
 const world=await loadPlayWorld(level.id,{config:PLAY_CONFIG,wave,placements:recipe.placements,critters:false,conditions:new LevelConditions().forLevel(level.id)});
 const random=seededRandom(),shots=new ShotEffects(random),damage=new DamageEffects(random),arcs=new ArcEffects(random),plasma=new PlasmaLinks(),activity=[];
 let engine;
 const note=(kind,x,y,z,weight)=>{activity.push({kind,x,y,z,weight,at:engine.time});while(activity.length>256||activity[0]?.at<engine.time-6)activity.shift();};
 try{
  hooks.onWorld?.(world);
  engine=new PlayEngine(world,{
   config:PLAY_CONFIG,wave,onPoseChange:hooks.onPoseChange,onVisible:hooks.onVisible,
   onStep:dt=>{shots.advance(dt);damage.advance(dt);arcs.advance(dt);plasma.advance(dt);},onAfterStep:dt=>damage.emitSmoke(dt),
   onShot:(variant,matrix,at)=>{shots.emit(matrix,TURRET_MUZZLES[variant],at);note('shot',matrix[12],matrix[13],matrix[14],1);},
   onBulletImpact:(point,normal,at)=>{shots.impact(point,normal,at);note('impact',...point,1);},
   onArcShot:(...args)=>{arcs.emit(...args);note('arc',...args[1],2);},
   onDeath:(_id,state)=>{damage.explode(state);note('explosion',state.x,state.y,state.z,3);},
   missileEffects:{onTrail:(...a)=>damage.missileTrail(...a),onLaunch:(...a)=>damage.launchSmoke(...a),onImpact:(x,y,z,...normal)=>{emitMissileImpact(damage,null,x,y,z,...normal);note('missile',x,y,z,3);}},
  });
  damage.setWorld(world,engine.enemies.states);arcs.setWorld(world);plasma.setLinks(createPlasmaLinks(world,engine.firing.enhancers.states));engine.startWave();
 }catch(error){engine?.dispose();plasma.dispose();disposePlayWorld(world);throw error;}
 return {recipe,world,engine,shots,damage,arcs,plasma,activity,prepare(){shots.prepare();arcs.prepare();plasma.prepare();},dispose(){engine.dispose();plasma.dispose();disposePlayWorld(world);}};
}
// Fixed ticks and seeded cosmetic pools make a saved moment reproducible.
// Rewind rebuilds the scene; moving the camera never calls this function.
export async function advanceStudyScene(scene,seconds,{yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0)),onProgress=()=>{}}={}){
 if(!Number.isFinite(seconds)||seconds<scene.engine.time-1e-8||seconds>STUDY_MAX_SECONDS)throw new Error('Rebuild the scene before rewinding; time must be within 0–120 seconds.');
 const steps=Math.round(seconds/PLAY_TICK);
 let count=0;
 while(scene.engine.steps<steps&&scene.engine.running){scene.engine.advance(PLAY_TICK);if(++count%240===0){onProgress(scene.engine.time);await yieldControl();}}
 scene.prepare();return scene.engine.time;
}
export function describeStudyScene(scene){
 const {engine:e,world,recipe}=scene;
 return {version:STUDY_VERSION,scenarioId:recipe.id,levelId:world.level.id,waveId:e.wave.id,seconds:e.time,placements:structuredClone(recipe.placements),stats:e.stats(),
  enemies:e.enemies.activeTargets.map(s=>({id:s.id,model:s.model,routeId:s.routeId,position:[s.x,s.y,s.z],aim:[s.aimX,s.aimY,s.aimZ],health:s.health.current,distance:s.distance,routeLength:s.path.length,airborne:s.airborne})),
  defences:[...e.firing.states,...e.firing.enhancers.states].map(s=>{const root=world.rigs.get(s.id).root;return {id:s.id,model:s.model,variant:s.variant,position:[s.x??root[12],root[13],s.z??root[14]],targetId:s.target?.id??null,lineOfSight:Boolean(s.lineOfSight)};}),
  missiles:(e.firing.missiles.pool?.slots??[]).filter(s=>s.visible&&s.phase>1).map(s=>({id:s.id,phase:s.phase,position:[s.x,s.y,s.z],targetId:s.target?.id??null})),
  activity:scene.activity.filter(s=>s.at>=e.time-6).map(s=>({...s})),
 };
}
export function captureStudyCamera(camera){return {position:Array.from(camera.position),yaw:camera.yaw,pitch:camera.pitch,fov:camera.fov,roll:camera.roll,viewport:[camera.canvas.clientWidth,camera.canvas.clientHeight]};}
export function restoreStudyCamera(camera,pose){camera.position.set(pose.position);camera.yaw=pose.yaw;camera.pitch=pose.pitch;camera.fov=pose.fov;camera.roll=pose.roll??0;camera.mode='live';camera.freeFly=true;camera.invalidate();}
