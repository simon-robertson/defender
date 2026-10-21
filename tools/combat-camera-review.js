// Frozen native-combat snapshots, separate from the player's current campaign.
import {PLAY_CONFIG,playCapacity} from '../play/config.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine} from '../play/engine.js';
import {WorldRenderer} from '../engine/renderer.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {ArcEffects} from '../engine/arc-effects.js';
import {TURRET_MUZZLES} from '../shared/arsenal.js';
import {emitMissileImpact} from '../game/missile-impact.js';
import {LevelConditions,applyPlayLighting} from '../play/conditions.js';

const $=id=>document.getElementById(id),errors=[],renderer=new WorldRenderer($('world'),fail,{modelLightCapacity:playCapacity(PLAY_CONFIG).modelLights,strictModelLights:true});
const shots=new ShotEffects(),damage=new DamageEffects(),arcs=new ArcEffects();
let recipes,world=null,engine=null,scene=null,loading=false,ready=false,view='after';
function fail(error){errors.push(String(error?.message??error));$('status').textContent=errors.join('\n');}
function draw(){
 if(!ready)return;
 const recipe=scene==='stack'?recipes.stackComparison:recipes.ordinaryLowArrival??recipes.safeLowStation,pose=scene==='stack'?recipe[view]:recipe,c=renderer.camera,p=pose.position,f=pose.focus??recipe.focus;
 c.mode='live';c.position.set(p);c.roll=pose.roll??0;c.fov=pose.fov??recipe.fov;c.yaw=pose.yaw??Math.atan2(p[0]-f[0],p[2]-f[2]);c.pitch=pose.pitch??Math.atan2(p[1]-f[1],Math.hypot(p[0]-f[0],p[2]-f[2]));
 renderer.requestDraw();renderer.render(0,engine.time);
 const result={view,scene,wave:engine.wave.id,elapsed:engine.time,position:Array.from(c.position),fov:c.fov,activeEnemies:engine.enemies.activeTargets.length,stats:engine.stats(),modelLights:renderer.modelLights?.count,modelLightOverflow:renderer.modelLights?.overflow,errors};
 $('world').dataset.review=JSON.stringify(result);$('status').textContent=`${engine.wave.id} at ${engine.time.toFixed(2)} s · ${view==='before'?'Original stacked view':view==='after'?'Composition-aware angle':'Safe lower camera station'} · ${engine.enemies.activeTargets.length} enemies\n${errors.length?errors.join('\n'):'Production models, combat and renderer; frozen for comparison. The active game is untouched.'}`;
}
async function show(next){
 if(loading)return;view=next;const nextScene=next==='low'?'low':'stack';
 if(scene===nextScene&&ready){draw();return;}
 loading=true;ready=false;for(const id of ['before','after','low'])$(id).disabled=true;
 try{
  engine?.dispose();engine=null;renderer.clearWorld();await renderer.device.queue.onSubmittedWorkDone();disposePlayWorld(world);world=null;shots.reset();damage.reset();arcs.reset();
  const recipe=nextScene==='stack'?recipes.stackComparison:recipes.ordinaryLowArrival??recipes.safeLowStation,level=PLAY_CONFIG.levels[recipe.levelIndex],wave=level.waves[recipe.waveIndex];
  world=await loadPlayWorld(level.id,{config:PLAY_CONFIG,wave,placements:recipe.placements,conditions:new LevelConditions().forLevel(level.id)});renderer.setWorld(world);applyPlayLighting(renderer,world.playConditions);
  engine=new PlayEngine(world,{config:PLAY_CONFIG,wave,onPoseChange:renderer.updateInstance.bind(renderer),onVisible:renderer.setActorVisible.bind(renderer),onStep:dt=>{shots.advance(dt);damage.advance(dt);arcs.advance(dt);},onAfterStep:dt=>damage.emitSmoke(dt),onShot:(variant,matrix,at)=>shots.emit(matrix,TURRET_MUZZLES[variant],at),onBulletImpact:(...args)=>shots.impact(...args),onArcShot:(...args)=>arcs.emit(...args),onDeath:(_id,state)=>damage.explode(state),missileEffects:{onTrail:(...args)=>damage.missileTrail(...args),onLaunch:(...args)=>damage.launchSmoke(...args),onImpact:(...args)=>emitMissileImpact(damage,engine.wildlife,...args)}});
  damage.setWorld(world,engine.enemies.states);arcs.setWorld(world);renderer.setShotEffects(shots);renderer.setDamageEffects(damage);renderer.setArcEffects(arcs);renderer.setMissileThrust(engine.firing.missiles.thrust);engine.startWave();
  for(let n=0;n<recipe.nativeSteps;n++)engine.advance(recipes.nativeStepSeconds);
  shots.prepare();arcs.prepare();scene=nextScene;ready=true;draw();
 }catch(error){fail(error);}finally{loading=false;for(const id of ['before','after','low'])$(id).disabled=false;}
}
for(const id of ['before','after','low'])$(id).onclick=()=>show(id);
window.addEventListener('resize',draw);
window.addEventListener('pagehide',()=>{ready=false;engine?.dispose();renderer.dispose();disposePlayWorld(world);});
try{await renderer.init();recipes=await(await fetch('/docs/combat-camera-follow-up-2026-10-21/camera-review-poses.json')).json();await show('after');}catch(error){fail(error);}
