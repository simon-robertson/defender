// Deterministic cosmetic fixture: the real Dog explodes on A2's authored bridge.
// Its ordinary debris trajectories trigger water crossings; no scripted splash.
import {loadPlayWorld,disposePlayWorld,PlayEngine} from '../play/engine.js';
import {PLAY_CONFIG} from '../play/config.js';
import {WorldRenderer} from '../engine/renderer.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {FrameLoop} from '../engine/clock.js';
const $=id=>document.getElementById(id),canvas=$('world');let seed=123,world,engine,actor,damage,loop,ready=false,playing=false,night=false,overview=false;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const renderer=new WorldRenderer(canvas,fail,{modelLightCapacity:128,strictModelLights:true});renderer.inspect=true;
function fail(cause){playing=false;$('report').textContent='FAILED: '+(cause?.message??cause);console.error(cause);}
function camera(){if(overview)renderer.camera.frame();else{renderer.camera.target.set([324,22,204]);renderer.camera.radius=82;renderer.camera.pitch=.85;renderer.camera.yaw=.7;renderer.camera.invalidate();}renderer.requestDraw();}
function diagnostics(){const water=damage.waterImpacts,report={time:damage.time,playing,night,cubes:damage.cubeCount,waterEntries:water?.entries??0,activeImpacts:water?.count??0,drops:water?.activeDrops??0,waterParticles:damage.waterParticleCount,droppedImpacts:water?.droppedImpacts??0,droppedDrops:water?.droppedDrops??0,damageBytes:renderer.damageBytes,drawCalls:renderer.lastDrawCalls,sceneBuffers:renderer.sceneBuffers.size};canvas.dataset.review=JSON.stringify(report);$('report').textContent=JSON.stringify(report);}
function reset(mode){
 if(!ready)return;playing=false;seed=123;damage.setWorld(world,engine.enemies.states);actor.phase='active';actor.distance=24*24;actor.time=0;engine.enemies.preview.pose();renderer.setActorVisible(actor.id,false);damage.explode(actor);
 if(mode!=='replay'){
  // Find an actual debris contact, then advance a short, reproducible interval.
  while(damage.time<4&&!damage.waterImpacts.entries)damage.advance(1/120);
  const extra=mode==='ripples'?.85:.09;for(let t=0;t<extra-1e-9;t+=1/120)damage.advance(1/120);
 }else playing=true;
 renderer.requestDraw();renderer.render(0,damage.time);diagnostics();loop.start();
}
try{
 await renderer.init();world=await loadPlayWorld('moss-02',{wave:PLAY_CONFIG.levels[1].waves[0],config:PLAY_CONFIG});renderer.setWorld(world);engine=new PlayEngine(world,{config:PLAY_CONFIG,onPoseChange:renderer.updateInstance.bind(renderer),onVisible:renderer.setActorVisible.bind(renderer)});actor=engine.enemies.states.find(state=>state.model==='dog');damage=new DamageEffects(random);renderer.setDamageEffects(damage);camera();
 loop=new FrameLoop(dt=>{try{if(playing){damage.advance(dt);if(!damage.activeCubes&&!damage.waterImpacts.count&&!damage.waterImpacts.activeDrops)playing=false;}renderer.render(playing?dt:0,damage.time);diagnostics();}catch(cause){fail(cause);}});
 ready=true;for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>reset(b.dataset.mode);$('pause').onclick=()=>{playing=!playing;loop.start();};$('night').onclick=()=>{night=!night;const sky=night?{color:'#708ABA',ambient:'#263754'}:world.level.environment.sky;renderer.setLightingColors(sky.color,sky.ambient,night?sky.ambient:null);$('night').textContent=night?'Day':'Night';renderer.requestDraw();};$('overview').onclick=()=>{overview=!overview;camera();};reset('impact');
 document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else loop.start();});window.addEventListener('pagehide',()=>{ready=false;loop.stop();damage.reset();engine.dispose();renderer.dispose();disposePlayWorld(world);});
}catch(cause){fail(cause);}
