// Isolated rendering evidence, using deployments from the persistent production
// replay. No query overrides, invented inventory or gameplay tuning in /play/.
import {PLAY_CONFIG,playCapacity} from '../play/config.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine} from '../play/engine.js';
import {WorldRenderer} from '../engine/renderer.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {CRITTER_GIB} from '../shared/damage-effects.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {ArcEffects} from '../engine/arc-effects.js';
import {TURRET_MUZZLES} from '../shared/arsenal.js';
import {emitMissileImpact} from '../game/missile-impact.js';
import {LevelConditions,applyPlayLighting} from '../play/conditions.js';
import {DroneCamera} from '../play/drone-camera.js';
import {ActionCamera} from '../play/action-camera.js';
import {CameraViews} from '../play/camera-views.js';
const $=id=>document.getElementById(id),canvas=$('world'),renderer=new WorldRenderer(canvas,fail,{modelLightCapacity:playCapacity(PLAY_CONFIG).modelLights,strictModelLights:true,gpuTiming:true}),shots=new ShotEffects(),damage=new DamageEffects(),arcs=new ArcEffects();
renderer.inspect=true;
let engine=null,world=null,record=null,ready=false,paused=true,loading=false,last=0,frame=0,lastReport=0,error='',reviewPhase=null,drawMS=0,maxDrawMS=0,completedAt=Infinity,bulletImpacts=0,maxSteeringJets=0;
const drone=new DroneCamera(renderer.camera),overview=new ActionCamera(renderer.camera),camera=new CameraViews(overview,drone);
const gpuErrors=[];
function fail(cause){gpuErrors.push(cause?.message??String(cause));error=cause?.message??String(cause);paused=true;$('status').textContent=error;report();}
function report(){
 const stats=engine?.stats(),r={encounter:engine?.wave.id,paused,errors:[...gpuErrors],engine:stats,gpu:{sceneBuffers:renderer.sceneBuffers.size,geometryBytes:renderer.bytes,modelLights:renderer.modelLights?.count,modelLightOverflow:renderer.modelLights?.overflow,arcInstances:arcs.instanceCount,arcLights:arcs.lightCount,missileThrust:engine?.firing.missiles.thrust?.instanceCount??0,drawCalls:renderer.lastDrawCalls,cpuSubmitMS:renderer.lastSubmitMs,maxObservedRenderSubmitMS:maxDrawMS},conditions:world?.playConditions,bulletImpacts,maxSteeringJets,gpuTimer:renderer.gpuTimer?.read(),chains:engine?.firing.arcs.chainHits??0,chainBolts:arcs.secondary.reduce((n,v,i)=>n+(v&&arcs.birth[i]!==-Infinity?1:0),0),chainSources:engine?.firing.arcs.states.map(s=>({variant:s.variant,strength:s.strength,maxRange:s.maxRange,target:s.lastChainTargetId??null,damage:s.lastChainDamage??0})),critters:{dead:engine?.wildlife.states.filter(s=>s.dead).length??0,bursts:damage.critterBursts,activeGibs:damage.cubes.filter(p=>p.active&&p.critter).length,fade:damage.critterFadeAt},camera:{selected:camera.selected,mode:renderer.camera.mode,drone:drone.stats()},resources:{createdSceneBuffers:renderer.createdSceneBuffers,destroyedSceneBuffers:renderer.destroyedSceneBuffers}};
 canvas.dataset.review=JSON.stringify(r);$('report').textContent=JSON.stringify(r,null,0);
}
async function load(){
 if(loading||!record)return;loading=true;paused=true;ready=false;error='';$('status').textContent='Loading production scene…';
 try{
  camera.bind(null);engine?.dispose();engine=null;renderer.setArcEffects(null);renderer.setMissileThrust(null);renderer.clearWorld();await renderer.device.queue.onSubmittedWorkDone();disposePlayWorld(world);world=null;
  shots.reset();damage.reset();arcs.reset();const index=Number($('encounter').value),wave=PLAY_CONFIG.levels[Math.floor(index/4)].waves[index%4],deployment=record.results.find(result=>result.name==='mixed').waves[index];
  if(!deployment||deployment.wave!==wave.id)throw new Error('No matching production replay deployment.');
  world=await loadPlayWorld(PLAY_CONFIG.levels[Math.floor(index/4)].id,{config:PLAY_CONFIG,wave,placements:deployment.placements,conditions:new LevelConditions().forLevel(PLAY_CONFIG.levels[Math.floor(index/4)].id)});renderer.setWorld(world);applyPlayLighting(renderer,world.playConditions);
  engine=new PlayEngine(world,{config:PLAY_CONFIG,wave,onPoseChange:renderer.updateInstance.bind(renderer),onVisible:renderer.setActorVisible.bind(renderer),onStep:dt=>{shots.advance(dt);damage.advance(dt);arcs.advance(dt);},onAfterStep:(dt,combat)=>{if(combat)damage.emitSmoke(dt);},onShot:(variant,matrix,at)=>shots.emit(matrix,TURRET_MUZZLES[variant],at),onBulletImpact:(point,normal,at)=>{bulletImpacts++;shots.impact(point,normal,at);},onArcShot:(...args)=>arcs.emit(...args),missileEffects:{onTrail:(x,y,z)=>damage.missileTrail(x,y,z),onLaunch:(x,y,z)=>damage.launchSmoke(x,y,z),onImpact:(...args)=>emitMissileImpact(damage,engine.wildlife,...args)},onDeath:(_id,state)=>{const blast=damage.explode(state);if(blast)engine.wildlife.gibExplosion(blast.x,blast.y,blast.z,CRITTER_GIB.enemyRadius,damage);camera.noteExplosion(state,engine.time);},onWaveComplete:()=>{damage.endCritterRun();completedAt=engine.time;$('status').textContent='Wave resolved';}});
  damage.setWorld(world,engine.enemies.states);arcs.setWorld(world);renderer.setShotEffects(shots);renderer.setDamageEffects(damage);engine.startWave();renderer.setArcEffects(engine.firing.arcs.states.length?arcs:null);renderer.setMissileThrust(engine.firing.missiles.states.length?engine.firing.missiles.thrust:null);camera.bind(world);ready=true;reviewPhase=null;maxDrawMS=0;completedAt=Infinity;bulletImpacts=maxSteeringJets=0;
  $('status').textContent=`${wave.id}: ${deployment.placements.length} recorded defences. Ready.`;renderer.render(0,0);report();
 }catch(cause){fail(cause);}finally{loading=false;}
}
function tick(now){
 const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;frame++;
 try{if(ready&&!loading){if(!paused){engine.advance(dt,{combat:engine.running});shots.prepare();arcs.prepare();camera.advance(dt,{engine,phase:engine.running?'wave':engine.time-completedAt<PLAY_CONFIG.waveSettleSeconds?'settling':'loadout',paused:false});}
  const thrust=engine.firing.missiles.thrust;let jets=0;for(let i=0;i<(thrust?.instanceCount??0);i++){const k=i*16;if(thrust.instanceData[k+7]===5.25&&thrust.instanceData[k+9]>.9)jets++;}maxSteeringJets=Math.max(maxSteeringJets,jets);
  const start=performance.now();renderer.render(paused?0:dt,engine.time);drawMS=performance.now()-start;maxDrawMS=Math.max(maxDrawMS,drawMS);
  if(now-lastReport>500){lastReport=now;report();}
 }}catch(cause){fail(cause);}requestAnimationFrame(tick);
}
$('step').onclick=()=>{if(!ready||error)return;paused=true;engine.advance(.1,{combat:engine.running});shots.prepare();arcs.prepare();camera.advance(.1,{engine,phase:reviewPhase??'wave',paused:false});renderer.render(.1,engine.time);report();};$('return-camera').onclick=()=>{paused=true;reviewPhase='loadout';camera.sync('loadout',engine);renderer.render(0,engine.time);report();};
function reviewAdvance(seconds){const steps=Math.ceil(seconds*120);for(let i=0;i<steps;i++)engine.advance(seconds/steps,{combat:engine.running});shots.prepare();arcs.prepare();renderer.requestDraw();renderer.render(0,engine.time);report();}
$('chain').onclick=()=>{if(!ready||error)return;paused=true;const before=engine.firing.arcs.chainHits;for(let i=0;i<120*180&&engine.running&&engine.firing.arcs.chainHits===before;i++)engine.advance(1/120);shots.prepare();arcs.prepare();renderer.requestDraw();renderer.render(0,engine.time);$('status').textContent=engine.firing.arcs.chainHits>before?'Chain hit captured':'No eligible chain in this encounter';report();};
$('chain-close').onclick=()=>{if(!ready)return;paused=true;camera.release();const points=[];for(let i=0;i<arcs.birth.length;i++)if(arcs.birth[i]!==-Infinity)for(let j=0;j<2;j++)points.push(Array.from(arcs.ends.subarray(i*6+j*3,i*6+j*3+3)));if(!points.length)return;const low=[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))),high=[0,1,2].map(a=>Math.max(...points.map(p=>p[a]))),c=renderer.camera;c.mode='overview';c.target.set(low.map((v,a)=>(v+high[a])*.5));c.radius=Math.max(45,Math.hypot(...high.map((v,a)=>v-low[a]))*.8);c.pitch=.65;c.yaw=.8;c.setControlsEnabled(true);renderer.requestDraw();renderer.render(0,engine.time);report();};
$('gib').onclick=()=>{if(!ready||error)return;paused=true;const s=engine.wildlife.states.find(s=>!s.dead&&s.kind==='ground')??engine.wildlife.states.find(s=>!s.dead);if(!s)return;const y=s.y+(s.centerOffset??2);emitMissileImpact(damage,engine.wildlife,s.x-12,y,s.z,0,1,0);camera.release();renderer.camera.mode='overview';renderer.camera.target.set([s.x,y,s.z]);renderer.camera.radius=60;renderer.camera.pitch=.65;renderer.camera.yaw=.7;reviewAdvance(.35);$('status').textContent='Persistent critter fragments and spray';};
$('fade').onclick=()=>{if(!ready||error)return;paused=true;damage.endCritterRun();reviewAdvance(2.1);$('status').textContent='Run ended; remains faded';};
$('half-fade').onclick=()=>{if(!ready||error)return;paused=true;damage.endCritterRun();reviewAdvance(1);$('status').textContent='Half-faded remains';};
$('load').onclick=()=>load();$('run').onclick=()=>{if(ready&&!error){paused=false;last=performance.now();$('status').textContent='Running ordinary real-time simulation';}};$('pause').onclick=()=>{paused=true;report();};$('drone').onclick=()=>{camera.toggle('drone');report();};
$('unit-close').onclick=()=>{
 const target=engine?.enemies.activeTargets.find(s=>s.model==='dune-tread')??engine?.enemies.activeTargets[0];if(!target)return;
 paused=true;camera.release();const c=renderer.camera;c.mode='overview';c.target.set([target.x,target.aimY??target.y,target.z]);c.yaw=.65;c.pitch=.4;c.radius=26;c.setControlsEnabled(true);renderer.requestDraw();report();
};
window.addEventListener('pagehide',()=>{ready=false;drone.dispose();overview.dispose();engine?.dispose();renderer.dispose();disposePlayWorld(world);});
try{await renderer.init();record=await (await fetch('/docs/b4-missile-follow-up-2026-10-20/mixed-campaign.json')).json();PLAY_CONFIG.levels.flatMap(level=>level.waves).forEach((wave,index)=>{const option=document.createElement('option');option.value=index;option.textContent=wave.id+' · '+wave.name;$('encounter').append(option);});$('encounter').value='4';await load();last=performance.now();requestAnimationFrame(tick);}catch(cause){fail(cause);}
