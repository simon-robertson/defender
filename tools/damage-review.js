// Deterministic production snapshots; no saved assets or game UI are changed.
import {disposeWorld} from '../engine/world.js';
import {loadArchivedPreviewWorld as loadWorld} from '/tools/archived-preview-world.js';
import {WorldRenderer} from '../engine/renderer.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {FrameLoop} from '../engine/clock.js';
import {SceneLoader} from '../engine/scene-loader.js';
import {previewLevelForId} from '../shared/preview-levels.js';
const $=id=>document.getElementById(id),canvas=$('world'),status=$('status'),controls=[...document.querySelectorAll('button,select')];
const durations=Object.freeze({healthy:0,blast:.04,wave:.28,flight:.45,late:4.5,rest:2.4,replay:0});
const params=new URLSearchParams(location.search),levels=['moss-01','ochre-01','plum-01'];
if(levels.includes(params.get('level')))$('level').value=params.get('level');
let renderer,world=null,enemies=null,actor=null,loop,damage,scenes,time=0,playing=false,ready=false,disposed=false,night=params.has('night'),waveEnabled=true,seed=123;
let mode=Object.hasOwn(durations,params.get('mode'))?params.get('mode'):'smoke';
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function fail(message){ready=false;playing=false;loop?.stop();status.textContent=String(message);for(const control of controls)control.disabled=true;$('level').disabled=false;}
function wake(){if(ready&&!disposed&&!document.hidden)loop.start();}
function lighting(){
 if(!world)return;const sky=night?{color:'#708ABA',ambient:'#263754'}:world.level.environment.sky;
 renderer.setLightingColors(sky.color,sky.ambient,night?sky.ambient:previewLevelForId(world.level.id).background);
 $('night').textContent=night?'Day':'Night';$('night').setAttribute('aria-pressed',String(night));renderer.requestDraw();
}
function snapshot(nextMode){
 if(!ready)return;loop.stop();mode=nextMode;playing=mode==='replay';seed=123;time=0;
 enemies.reset();damage.setWorld(world,enemies.states);
 const visible=mode==='smoke'||mode==='healthy';
 for(const state of enemies.states)renderer.setActorVisible(state.id,state===actor&&visible);
 actor.health.current=mode==='healthy'?actor.health.maximum:mode==='smoke'?actor.health.maximum*.49:0;
 if(mode==='smoke'){
  for(let i=0;i<120;i++){damage.advance(1/120);damage.emitSmoke(1/120);}time=1;
 }else if(mode!=='healthy'){
  damage.explode(actor);const duration=durations[mode];
  for(let elapsed=0;elapsed<duration;){const dt=Math.min(1/120,duration-elapsed);damage.advance(dt);elapsed+=dt;}time=duration;
 }
 for(const button of document.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
 renderer.requestDraw();wake();
}
function inspect(){
 let rest=0,smokeMinY=Infinity,smokeMaxY=-Infinity,minAge=Infinity,maxAge=0;
 for(const p of damage.cubes)if(p.active&&p.resting)rest++;
 for(const p of damage.smoke)if(p.active){const y=p.y+p.rise*p.age;smokeMinY=Math.min(smokeMinY,y);smokeMaxY=Math.max(smokeMaxY,y);minAge=Math.min(minAge,p.age);maxAge=Math.max(maxAge,p.age);}
 status.textContent=mode==='healthy'?`Healthy model · ${world.level.zone} ${actor.model} · ${renderer.modelLights?.count??0} model lights · ${night?'Night':'Day'}`:`${playing?'Playing':'Snapshot'} · ${world.level.zone} ${actor.model} · ${time.toFixed(2)} s · ${damage.smokeCount} smoke · ${damage.cubeCount} cubes (${rest} resting) · ${damage.lightCount} effect lights · ${damage.shockwaveCount} waves`;
 $('review-diagnostics').textContent=JSON.stringify({ready,level:world.level.id,actor:actor.id,model:actor.model,mode,time,playing,night,waveEnabled,smoke:damage.smokeCount,activeSmoke:damage.activeSmoke,smokeHeight:Number.isFinite(smokeMinY)?[smokeMinY,smokeMaxY]:null,smokeAge:Number.isFinite(minAge)?[minAge,maxAge]:null,blasts:damage.blastCount,cubes:damage.cubeCount,resting:rest,lights:damage.lightCount,lightRadius:damage.lightCount?damage.lightData[7]:0,lightStrength:damage.lightCount?damage.lightData[11]:0,waves:damage.shockwaveCount,droppedSmoke:damage.droppedSmoke,droppedCubes:damage.droppedCubes,replacedBlasts:damage.replacedBlasts,sceneBuffers:renderer.sceneBuffers.size,createdSceneBuffers:renderer.createdSceneBuffers,destroyedSceneBuffers:renderer.destroyedSceneBuffers,geometryBytes:renderer.bytes,damageBytes:renderer.damageBytes});
}
try{
 renderer=new WorldRenderer(canvas,fail);renderer.inspect=true;
 const requestDraw=renderer.requestDraw.bind(renderer);renderer.requestDraw=()=>{requestDraw();wake();};
 loop=new FrameLoop(dt=>{try{
  if(!world||!ready)return;
  if(playing){time+=dt;damage.advance(dt);if(!damage.activeSmoke&&!damage.activeCubes&&!damage.activeBlasts)playing=false;}
  renderer.render(dt,time);inspect();
  if(!playing&&!renderer.camera.dragging&&!renderer.camera.keys.size)loop.stop();
 }catch(error){fail(error.message);}});
 await renderer.init();renderer.setShotEffects(new ShotEffects(random));damage=new DamageEffects(random);renderer.setDamageEffects(damage);
 // The existing refraction comparison only suppresses the prepared wave count.
 const prepareDamage=damage.prepare.bind(damage);damage.prepare=vp=>{prepareDamage(vp);if(!waveEnabled)damage.shockwaveCount=0;};
 scenes=new SceneLoader({
  load:(id,options)=>loadWorld(id,{...options,actors:previewActorsForLevel(id)}),discard:disposeWorld,
  release:previous=>{ready=false;playing=false;loop.stop();damage.reset();enemies?.dispose();enemies=null;actor=null;renderer.clearWorld();disposeWorld(previous);world=null;return renderer.device.queue.onSubmittedWorkDone();},
  activate:next=>{
   world=next;renderer.setWorld(next);enemies=new EnemyPreview(next,renderer.updateInstance.bind(renderer));actor=enemies.states[1];
   renderer.camera.target.set([actor.x,actor.aimY+6,actor.z]);renderer.camera.radius=66;renderer.camera.pitch=.65;lighting();
  },
  onLoading:()=>{ready=false;loop.stop();status.textContent='Loading real level…';for(const control of controls)control.disabled=true;},
  onReady:()=>{ready=true;for(const control of controls)control.disabled=false;snapshot(mode);},onError:error=>fail(error.message),
 });
 $('level').addEventListener('change',()=>scenes.switchTo($('level').value));
 for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>snapshot(button.dataset.mode));
 $('wave-toggle').addEventListener('click',event=>{waveEnabled=!waveEnabled;event.target.textContent='Refraction: '+(waveEnabled?'On':'Off');event.target.setAttribute('aria-pressed',String(waveEnabled));renderer.requestDraw();});
 $('night').addEventListener('click',()=>{night=!night;lighting();});
 document.addEventListener('keydown',event=>{if(!ready||event.key.toLowerCase()!=='n'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName))return;event.preventDefault();night=!night;lighting();});
 canvas.addEventListener('keydown',wake);
 if(!disposed)await scenes.switchTo($('level').value);
}catch(error){fail(error.message);scenes?.dispose();scenes?.barrier.catch(()=>{});renderer?.dispose();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)loop?.stop();else if(ready)renderer.requestDraw();});
window.addEventListener('pagehide',event=>{loop?.stop();if(event.persisted)return;disposed=true;scenes?.dispose();scenes?.barrier.catch(()=>{});renderer?.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted&&ready)renderer.requestDraw();});
