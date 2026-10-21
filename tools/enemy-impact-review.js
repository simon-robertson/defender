// Isolated production-controller review. Nothing writes model or level assets.
import {disposeWorld} from '../engine/world.js';
import {loadArchivedPreviewWorld as loadWorld} from '/tools/archived-preview-world.js';
import {WorldRenderer} from '../engine/renderer.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {FrameLoop} from '../engine/clock.js';
import {SceneLoader} from '../engine/scene-loader.js';
import {ENEMY_IMPACT} from '../engine/enemy-impact.js';
import {previewLevelForId} from '../shared/preview-levels.js';

const $=id=>document.getElementById(id),canvas=$('scene'),controls=[...document.querySelectorAll('button,select,input')];
const durations=Object.freeze({before:0,peak:1/ENEMY_IMPACT.omega,recovery:ENEMY_IMPACT.seconds*.5,settled:ENEMY_IMPACT.seconds}),directions=Object.freeze({angled:Object.freeze([70,-45,20]),vertical:Object.freeze([0,-80,0])});
for(const [key,label]of [['peak','Peak'],['recovery','Recovery'],['settled','Settled']])document.querySelector(`[data-mode="${key}"]`).textContent=`${label} · ${Number(durations[key].toFixed(2))} s`;
const params=new URLSearchParams(location.search),levels=['moss-03','ochre-03','plum-03','moss-01','ochre-01','plum-01'];
if(levels.includes(params.get('level')))$('level').value=params.get('level');
if(params.get('direction')==='vertical')$('direction').value='vertical';
let mode=Object.hasOwn(durations,params.get('mode'))?params.get('mode'):'peak';
let world=null,enemies=null,actor=null,loop,ready=false,disposed=false,playing=false,night=params.has('night'),comparison=params.has('unhit');
let age=0,speed=1,snapshotSteps=0,lastInspect=-Infinity,hitApplied=0;
const errors=[],canonical=new Float64Array(5),renderer=new WorldRenderer(canvas,fail);renderer.inspect=true;
const reviewActors=id=>[previewActorsForLevel(id)[1]];
function fail(message){
 ready=false;playing=false;loop?.stop();errors.push(String(message));$('error').textContent=String(message);$('status').textContent='Review unavailable';
 for(const control of controls)control.disabled=true;$('level').disabled=false;
 $('review-diagnostics').textContent=JSON.stringify({ready,errors});
}
function wake(){if(ready&&!disposed&&!document.hidden)loop.start();}
const requestDraw=renderer.requestDraw.bind(renderer);renderer.requestDraw=()=>{requestDraw();wake();};
function lighting(){
 if(!world)return;const sky=world.level.environment.sky;
 renderer.setLightingColors(night?'#708ABA':sky.color,night?'#263754':sky.ambient,night?'#263754':previewLevelForId(world.level.id).background);
 $('night').textContent=night?'Day':'Night';$('night').setAttribute('aria-pressed',String(night));renderer.requestDraw();
}
function buttonState(){
 for(const button of document.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(!playing&&mode===button.dataset.mode));
 $('compare').textContent=comparison?'Show impact response':'Show unhit comparison';$('compare').setAttribute('aria-pressed',String(comparison));
 $('replay').setAttribute('aria-pressed',String(playing&&speed===1));$('slow').setAttribute('aria-pressed',String(playing&&speed===.25));$('pause').textContent=playing?'Pause':'Resume';
}
function resetPose(applyHit){
 enemies.reset();age=0;snapshotSteps=0;hitApplied=0;
 if(applyHit&&!comparison)hitApplied=enemies.takeHit(actor,1,...directions[$('direction').value]);
}
function advanceTo(seconds){
 // Snapshots are bounded to the configured recovery duration at 120 Hz.
 // Replay uses the shared frame delta without extra loops.
 const steps=Math.min(Math.ceil(ENEMY_IMPACT.seconds*120),Math.ceil(seconds*120));
 for(let i=0;i<steps;i++){const next=(i+1)*seconds/steps;enemies.advance(next-age);age=next;}
 snapshotSteps=steps;
}
function snapshot(nextMode=mode,seconds=durations[nextMode]){
 if(!ready)return;loop.stop();playing=false;mode=nextMode;resetPose(mode!=='before');advanceTo(seconds);buttonState();lastInspect=-Infinity;renderer.requestDraw();
}
function replay(nextSpeed){
 if(!ready)return;loop.stop();mode='replay';speed=nextSpeed;resetPose(true);playing=true;buttonState();lastInspect=-Infinity;renderer.requestDraw();
}
function closeView(){
 if(!actor)return;const c=renderer.camera;
 enemies.path.sample((actor.seed+actor.movement.speed*.75)%enemies.path.length,canonical);
 c.mode='overview';c.keys.clear();c.dragging=false;c.target.set([canonical[0],actor.groundHeight+(actor.model==='walker'?12:6),canonical[1]]);
 c.radius=actor.model==='walker'?39:33;c.pitch=.55;c.yaw=actor.yaw+Math.PI*.7;renderer.requestDraw();
}
function point(matrix,x,y,z){return [matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12],matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13],matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14]];}
function inspect(force=false){
 if(!actor||!ready)return;
 // Diagnostics are tool-only and refresh at most ten times per simulated
 // second during playback, rather than allocating per rendered frame.
 if(!force&&playing&&age-lastInspect<.1)return;lastInspect=age;
 enemies.path.sample(actor.distance,canonical);
 const displacement=[actor.x-canonical[0],actor.z-canonical[1]];
 $('status').textContent=`${playing?'Playing '+speed+'×':'Frozen'} · ${comparison?'Unhit':'Impact'} · ${age.toFixed(2)} s · tilt ${(Math.hypot(actor.impact.pitch,actor.impact.roll)*180/Math.PI).toFixed(1)}° · bob ${actor.impact.bob.toFixed(2)} u · offset ${Math.hypot(...displacement).toFixed(2)} u${actor.impact?.restricted?' · clearance restricted':''}`;
 const data={ready,errors,level:world.level.id,actor:actor.id,model:actor.model,mode,age,playing,speed,night,comparison,incoming:directions[$('direction').value],hitApplied,snapshotSteps,
  startDistance:actor.seed,routeDistance:actor.distance,routeTime:enemies.time,lap:actor.lap,position:[actor.x,actor.aimY,actor.z],velocity:[actor.velocityX,actor.velocityY,actor.velocityZ],aimPoint:[actor.aimX,actor.aimY,actor.aimZ],aimVelocity:[actor.aimVelocityX,actor.aimVelocityY,actor.aimVelocityZ],yaw:actor.yaw,
  canonicalPosition:[canonical[0],canonical[1]],displacement,impact:actor.impact?{active:actor.impact.active,hits:actor.impact.hits,offsetX:actor.impact.offsetX,offsetZ:actor.impact.offsetZ,velocityX:actor.impact.velocityX,velocityZ:actor.impact.velocityZ,restricted:actor.impact.restricted,pitch:actor.impact.pitch,roll:actor.impact.roll,bob:actor.impact.bob,brace:actor.impact.brace,tiltX:actor.impact.tiltX,tiltZ:actor.impact.tiltZ,balanceAllowed:actor.impact.balanceAllowed}:null,health:{current:actor.health.current,maximum:actor.health.maximum},
  parts:actor.rig.bones.map(b=>({id:b.part.id,pivot:point(b.instance.matrix,...b.part.pivot),rotation:Array.from(b.rotation),matrix:Array.from(b.instance.matrix)})),
  feet:actor.gait.feet.map(f=>{const b=actor.rig.byId.get(f.paw),p=b.part.pivot;return {part:f.paw,stance:f.stance,phase:f.phase,target:Array.from(f.position),actualAnkle:point(b.instance.matrix,...p),actualSole:point(b.instance.matrix,p[0],p[1]-1,p[2])};}),
  actors:world.actors.size,sceneBuffers:renderer.sceneBuffers.size,createdSceneBuffers:renderer.createdSceneBuffers,destroyedSceneBuffers:renderer.destroyedSceneBuffers,geometryBytes:renderer.bytes,modelLights:renderer.modelLights?.count??0,modelLightOverflow:renderer.modelLights?.overflow??0};
 const text=JSON.stringify(data);$('review-diagnostics').textContent=text;if($('inspect').open)$('details').textContent=JSON.stringify(data,null,2);
}
loop=new FrameLoop(delta=>{try{
 if(!ready)return;
 if(playing){const dt=Math.min(delta*speed,ENEMY_IMPACT.seconds-age);if(dt>0){enemies.advance(dt);age+=dt;}if(age>=ENEMY_IMPACT.seconds-1e-10){age=ENEMY_IMPACT.seconds;playing=false;mode='settled';buttonState();}}
 renderer.render(delta,age);inspect();if(!playing&&!renderer.camera.dragging&&!renderer.camera.keys.size)loop.stop();
}catch(error){fail(error.message);}});
const scenes=new SceneLoader({
 load:(id,options)=>loadWorld(id,{...options,actors:reviewActors(id)}),discard:disposeWorld,
 release:old=>{ready=false;playing=false;loop.stop();enemies?.dispose();enemies=null;actor=null;renderer.clearWorld();disposeWorld(old);world=null;return renderer.device.queue.onSubmittedWorkDone();},
 activate:next=>{
  world=next;renderer.setWorld(next);enemies=new EnemyPreview(next,renderer.updateInstance.bind(renderer),null,reviewActors(next.level.id));actor=enemies.states[0];
  if(!actor.impact)throw new Error('The production enemy impact controller is not available yet.');
  const requested=Number(params.get('distance'));if(params.has('distance')&&Number.isFinite(requested))actor.seed=Math.max(0,Math.min(enemies.path.length-.001,requested));
  $('distance').max=enemies.path.length-.001;$('distance').value=actor.seed;enemies.reset();lighting();closeView();
 },
 onLoading:()=>{ready=false;loop.stop();$('status').textContent='Loading real level…';$('error').textContent='';for(const control of controls)control.disabled=true;},
 onReady:()=>{ready=true;for(const control of controls)control.disabled=false;snapshot(Object.hasOwn(durations,mode)?mode:'peak');},onError:error=>fail(error.message),
});
function safely(action){try{action();}catch(error){fail(error.message);}}
$('level').addEventListener('change',()=>scenes.switchTo($('level').value));
$('direction').addEventListener('change',()=>safely(()=>snapshot(mode==='before'?'before':'comparison',age)));
$('distance').addEventListener('change',()=>safely(()=>{const value=Number($('distance').value);if(!Number.isFinite(value))return;actor.seed=Math.max(0,Math.min(enemies.path.length-.001,value));$('distance').value=actor.seed;snapshot(Object.hasOwn(durations,mode)?mode:'peak');closeView();}));
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>safely(()=>snapshot(button.dataset.mode)));
$('replay').addEventListener('click',()=>safely(()=>replay(1)));$('slow').addEventListener('click',()=>safely(()=>replay(.25)));
$('pause').addEventListener('click',()=>safely(()=>{if(playing){playing=false;mode='paused';buttonState();inspect(true);renderer.requestDraw();}else if(age<ENEMY_IMPACT.seconds){playing=true;buttonState();wake();}else replay(speed);}));
$('compare').addEventListener('click',()=>safely(()=>{comparison=!comparison;const elapsed=age;snapshot(mode==='before'?'before':'comparison',elapsed);}));
$('close').addEventListener('click',closeView);$('night').addEventListener('click',()=>{night=!night;lighting();});$('inspect').addEventListener('toggle',()=>inspect(true));
document.addEventListener('keydown',event=>{if(!ready||event.key.toLowerCase()!=='n'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName))return;event.preventDefault();night=!night;lighting();});
canvas.addEventListener('keydown',wake);document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else if(ready)renderer.requestDraw();});
window.addEventListener('pagehide',event=>{loop.stop();if(event.persisted)return;disposed=true;scenes.dispose();scenes.barrier.catch(()=>{});renderer.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted&&ready)renderer.requestDraw();});
try{await renderer.init();renderer.device.addEventListener('uncapturederror',event=>fail(event.error.message));if(!disposed)await scenes.switchTo($('level').value);}catch(error){fail(error.message);scenes.dispose();scenes.barrier.catch(()=>{});renderer.dispose();}
