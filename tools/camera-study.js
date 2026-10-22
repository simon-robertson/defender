import {DroneCamera} from '../play/drone-camera.js';
import {WorldRenderer} from '../engine/renderer.js';
import {FrameLoop} from '../engine/clock.js';
import {PLAY_CONFIG,playCapacity} from '../play/config.js';
import {applyPlayLighting} from '../play/conditions.js';
import {STUDY_SCENARIOS} from './camera-study-scenarios.js';
import {createStudyScene,advanceStudyScene,describeStudyScene,captureStudyCamera,restoreStudyCamera,STUDY_MAX_SECONDS} from './camera-study-scene.js';

const $=id=>document.getElementById(id),canvas=$('world');
const renderer=new WorldRenderer(canvas,fail,{modelLightCapacity:playCapacity(PLAY_CONFIG).modelLights,strictModelLights:true,renderScale:.5});
let autoDrone=null,manualPose=null,scene=null,busy=true,playing=false,disposed=false,saving=false,fast=false,vertical=0,saved=[],lastPaint=0,viewAspect=16/9;
const moves=new Set(),loop=new FrameLoop(frame);
function fail(error){playing=false;$('status').textContent=`Could not complete that action: ${error?.message??error}`;}
function busyUI(value,message='Preparing the frozen battle…'){
 busy=value;$('loading').hidden=!value;$('loading').textContent=message;
 $('scene-controls').disabled=value;for(const id of ['camera-controls','record-controls'])$(id).disabled=value||!scene;
 if(value){playing=false;renderer.camera.keys.clear();moves.clear();fast=false;vertical=0;}
}
function aimAt(point){const c=renderer.camera,p=c.position;c.yaw=Math.atan2(p[0]-point[0],p[2]-point[2]);c.pitch=Math.max(-1.54,Math.min(1.54,Math.atan2(p[1]-point[1],Math.hypot(p[0]-point[0],p[2]-point[2]))));renderer.requestDraw();}
function resetView(){
 const c=renderer.camera,w=scene.world,focus=[w.width/2,w.level.pathHeight+20,w.length/2],pitch=.62,yaw=Math.PI/4,aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight),halfAngle=Math.atan(Math.tan(32*Math.PI/180)*Math.min(1,aspect)),distance=(Math.hypot(w.width,w.length)/2+64)/Math.sin(halfAngle);
 const horizontal=Math.cos(pitch)*distance;restoreStudyCamera(c,{position:[focus[0]+Math.sin(yaw)*horizontal,focus[1]+Math.sin(pitch)*distance,focus[2]+Math.cos(yaw)*horizontal],yaw,pitch,fov:64,roll:0});syncLens();
}
function sizeCanvas(){const box=canvas.parentElement.getBoundingClientRect(),width=Math.max(1,Math.min(box.width,box.height*viewAspect));canvas.style.width=width+'px';canvas.style.height=width/viewAspect+'px';renderer.requestDraw();}
function stopDrone(){if(!autoDrone)return;autoDrone.dispose();autoDrone=null;if(manualPose)restoreStudyCamera(renderer.camera,manualPose);manualPose=null;$('drone-preview').textContent='Compare rebuilt Drone';syncLens();}
function syncLens(){$('lens').value=String(renderer.camera.fov);$('lens-label').textContent=`${Math.round(renderer.camera.fov)}°`;}
function populateSubjects(){
 const selected=$('subject').value,snapshot=describeStudyScene(scene);$('subject').replaceChildren(new Option('Choose an enemy or defence…',''));
 for(const [kind,actors]of [['Enemy',snapshot.enemies],['Defence',snapshot.defences]])for(const actor of actors)$('subject').add(new Option(`${kind} · ${actor.id} · ${actor.model}`,actor.id));
 $('subject').value=selected;
}
function paint(){
 if(!scene)return;
 const e=scene.engine,w=scene.world;$('scene-title').textContent=`${w.level.zone}${scene.recipe.levelIndex%4+1} · ${w.level.name}`;
 $('scene-counts').textContent=`${e.enemies.alive} enemies · ${e.firing.states.length+e.firing.enhancers.states.length} defences · ${e.firing.missiles.pool?.active??0} missiles`;
 $('moment').value=String(e.time);$('moment-label').textContent=`${e.time.toFixed(2)} s`;
 $('frozen-badge').textContent=playing?'LIVE PREVIEW':'FROZEN';$('play').textContent=playing?'Freeze battle':'Watch battle';$('play').disabled=!e.running||e.time>=STUDY_MAX_SECONDS;
 canvas.dataset.study=JSON.stringify({drone:autoDrone?.stats()??null,scenario:scene.recipe.id,time:e.time,playing,busy,camera:captureStudyCamera(renderer.camera),stats:e.stats()});
}
function draw(){if(scene&&!busy){renderer.requestDraw();renderer.render(0,scene.engine.time);paint();}}
function frame(dt){
 if(!scene||busy||disposed)return;
 try{
  const c=renderer.camera,step=Math.min(dt,.1);
  if(playing){scene.engine.advance(step);scene.prepare();renderer.requestDraw();if(!scene.engine.running||scene.engine.time>=STUDY_MAX_SECONDS){playing=false;populateSubjects();}}
  if(autoDrone){autoDrone.advance(step,{engine:scene.engine,phase:scene.engine.running?'wave':'settling',paused:!playing});syncLens();}
  if(!saving&&!autoDrone){c.advance(step*(fast?3:1));if(vertical){c.position[1]+=vertical*72*step*(fast?3:1);c.invalidate();}}
  if(renderer.dirty||renderer.cameraDirty)renderer.render(0,scene.engine.time);
  if(performance.now()-lastPaint>200){lastPaint=performance.now();paint();}
 }catch(error){loop.stop();fail(error);}
}
async function loadScene(recipe,seconds=recipe.seconds,{pose=null,keepCamera=false}={}){
 if(busy&&scene)return;const previous=keepCamera&&scene?captureStudyCamera(renderer.camera):null;
 stopDrone();busyUI(true);loop.stop();
 try{
  if(scene){scene.engine.dispose();renderer.clearWorld();await renderer.device.queue.onSubmittedWorkDone();scene.dispose();scene=null;}
  scene=await createStudyScene(recipe,{onActivity:(kind,x,y,z,at,weight)=>{if(kind!=='shot')autoDrone?.noteActivity(x,y,z,at,weight);},onWorld:world=>{renderer.setWorld(world);applyPlayLighting(renderer,world.playConditions);},onPoseChange:renderer.updateInstance.bind(renderer),onVisible:renderer.setActorVisible.bind(renderer)});
  renderer.setShotEffects(scene.shots);renderer.setDamageEffects(scene.damage);renderer.setArcEffects(scene.arcs);renderer.setGeneratorLights(scene.generatorLights);renderer.setMissileThrust(scene.engine.firing.missiles.thrust);
  await advanceStudyScene(scene,seconds,{onProgress:time=>$('loading').textContent=`Replaying battle · ${time.toFixed(0)} / ${seconds.toFixed(0)} s`});
  renderer.camera.pathModeEnabled=false;renderer.camera.setControlsEnabled(true);
  if(pose??previous){const savedPose=pose??previous;viewAspect=savedPose.viewport[0]/savedPose.viewport[1];sizeCanvas();restoreStudyCamera(renderer.camera,savedPose);syncLens();}else{viewAspect=16/9;sizeCanvas();resetView();}
  $('scenario').value=recipe.id;$('scenario-description').textContent=recipe.description;populateSubjects();
  $('status').textContent='Battle frozen. Fly to your preferred position, then save the shot and explain what matters.';return true;
 }catch(error){fail(error);return false;}finally{busyUI(false);if(scene){draw();loop.start();}}
}
async function seek(seconds){
 if(!scene||busy||saving)return;
 stopDrone();seconds=Math.min(STUDY_MAX_SECONDS,Math.max(0,seconds));playing=false;
 if(seconds<scene.engine.time-1e-8){await loadScene(scene.recipe,seconds,{keepCamera:true});return;}
 busyUI(true);try{await advanceStudyScene(scene,seconds);}catch(error){fail(error);}finally{busyUI(false);populateSubjects();draw();}
}
async function nextAction(){
 if(!scene||busy||saving)return;stopDrone();playing=false;busyUI(true,'Looking for the next shot or impact…');
 try{
  const initial=scene.activity.at(-1),start=scene.engine.time;
  while(scene.engine.running&&scene.engine.time<Math.min(STUDY_MAX_SECONDS,start+20)){
   await advanceStudyScene(scene,Math.min(STUDY_MAX_SECONDS,scene.engine.time+.05));
   if(scene.activity.at(-1)!==initial)break;
  }
  $('status').textContent=scene.activity.at(-1)!==initial?'Frozen at the next combat event.':'No further combat event in the next 20 seconds.';
 }catch(error){fail(error);}finally{busyUI(false);populateSubjects();draw();}
}
async function refreshShots(){
 const response=await fetch('/api/camera-study/shots',{cache:'no-store'});if(!response.ok)throw new Error('Saved examples could not be read.');saved=await response.json();$('saved-shots').replaceChildren();
 for(const shot of saved){
  const button=document.createElement('button'),title=document.createElement('strong'),note=document.createElement('span');button.className='saved-shot';button.type='button';
  const recipe=STUDY_SCENARIOS.find(s=>s.id===shot.scene.scenarioId);
  title.textContent=`${shot.verdict==='preferred'?'Keep':'Avoid'} · ${recipe?.label??shot.scene.scenarioId} · ${shot.scene.seconds.toFixed(2)} s`;
  note.textContent=shot.notes||'No written note';button.append(title,note);
  button.onclick=async()=>{if(busy||saving||!recipe)return;$('notes').value=shot.notes;$('verdict').value=shot.verdict;if(await loadScene({...recipe,placements:shot.scene.placements},shot.scene.seconds,{pose:shot.camera}))$('save-status').textContent='Restored saved example. Saving again creates another example.';};$('saved-shots').append(button);
 }
 if(!saved.length)$('saved-shots').textContent='No examples yet. Save your first shot above.';
}
async function saveShot(){
 if(!scene||busy||saving)return;playing=false;saving=true;$('save').disabled=true;$('save-status').textContent='Saving image and scene…';
 try{
  const c=renderer.camera,payload={verdict:$('verdict').value,notes:$('notes').value,scene:describeStudyScene(scene),camera:captureStudyCamera(c)};
  c.setControlsEnabled(false);$('scene-controls').disabled=$('camera-controls').disabled=true;vertical=0;moves.clear();fast=false;renderer.requestDraw();renderer.render(0,scene.engine.time);await renderer.device.queue.onSubmittedWorkDone();
  payload.image=canvas.toDataURL('image/png');
  const response=await fetch('/api/camera-study/shots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),result=await response.json();
  if(!response.ok)throw new Error(result.error??'The shot was not saved.');
  $('save-status').textContent=`Saved ${result.verdict==='preferred'?'preferred':'unwanted'} shot. Image, camera, scene and notes are recorded in project-docs/drone-camera-study/shots/.`;await refreshShots();
 }catch(error){$('save-status').textContent=`Not saved: ${error.message}. Your notes are still here.`;}finally{saving=false;$('save').disabled=false;$('scene-controls').disabled=$('camera-controls').disabled=false;renderer.camera.setControlsEnabled(!autoDrone);paint();}
}
for(const recipe of STUDY_SCENARIOS)$('scenario').add(new Option(recipe.label,recipe.id));
$('scenario').onchange=()=>{if(!busy&&!saving)void loadScene(STUDY_SCENARIOS.find(s=>s.id===$('scenario').value));};
$('moment').oninput=()=>$('moment-label').textContent=`${Number($('moment').value).toFixed(2)} s`;
$('moment').onchange=()=>seek(Number($('moment').value));$('back').onclick=()=>seek(scene.engine.time-1);$('step').onclick=()=>seek(scene.engine.time+1);$('action').onclick=nextAction;
$('play').onclick=()=>{if(!busy&&!saving&&scene?.engine.running&&scene.engine.time<STUDY_MAX_SECONDS){playing=!playing;if(!playing)populateSubjects();paint();}};
$('lens').oninput=()=>{const value=Number($('lens').value);stopDrone();renderer.camera.fov=value;renderer.requestDraw();syncLens();};
$('reset-view').onclick=()=>{stopDrone();resetView();canvas.focus();};$('fullscreen').onclick=()=>{if(!document.fullscreenElement)canvas.requestFullscreen().catch(fail);else document.exitFullscreen().catch(fail);};
$('aim').onclick=()=>{stopDrone();const s=describeStudyScene(scene),actor=[...s.enemies,...s.defences].find(a=>a.id===$('subject').value);if(actor){aimAt(actor.aim??actor.position);canvas.focus();}};
$('drone-preview').onclick=()=>{if(busy||saving||!scene)return;if(autoDrone){stopDrone();draw();return;}manualPose=captureStudyCamera(renderer.camera);autoDrone=new DroneCamera(renderer.camera,{random:()=>.35});autoDrone.bind(scene.world);for(const e of scene.activity)if(e.kind!=='shot')autoDrone.noteActivity(e.x,e.y,e.z,e.at,e.weight);autoDrone.setEnabled(true);autoDrone.sync('wave',scene.engine);$('drone-preview').textContent='Return to manual camera';draw();};
$('save').onclick=saveShot;$('refresh-shots').onclick=()=>refreshShots().catch(fail);
function toggleControls(){document.body.classList.toggle('wide');$('wide').textContent=document.body.classList.contains('wide')?'Show controls · Tab':'Hide controls · Tab';renderer.requestDraw();}
$('wide').onclick=toggleControls;
function clearInput(){fast=false;vertical=0;moves.clear();renderer.camera.keys.clear();renderer.camera.dragging=false;}
function syncMoves(){const c=renderer.camera;for(const key of ['w','a','s','d']){if(moves.has(key))c.keys.add(key);else c.keys.delete(key);}vertical=Number(moves.has('e'))-Number(moves.has('q'));}
for(const button of document.querySelectorAll('[data-move]')){
 button.onpointerdown=event=>{if(busy||saving)return;event.preventDefault();button.setPointerCapture(event.pointerId);moves.add(button.dataset.move);syncMoves();};
 for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>{moves.delete(button.dataset.move);syncMoves();});
}
canvas.addEventListener('keydown',event=>{if(busy||saving)return;const key=event.key.toLowerCase();if(['w','a','s','d','q','e'].includes(key)){event.preventDefault();moves.add(key);syncMoves();}if(key==='shift')fast=true;});
canvas.addEventListener('keyup',event=>{moves.delete(event.key.toLowerCase());vertical=Number(moves.has('e'))-Number(moves.has('q'));if(event.key==='Shift')fast=false;});
canvas.addEventListener('blur',clearInput);window.addEventListener('blur',clearInput);
document.addEventListener('keydown',event=>{if(event.key==='Tab'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&(event.target===canvas||event.target===document.body)){event.preventDefault();toggleControls();}});
document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden){playing=false;loop.stop();}else if(!disposed&&!busy&&scene)loop.start();});
const viewportResize=new ResizeObserver(sizeCanvas);viewportResize.observe(canvas.parentElement);
window.addEventListener('resize',sizeCanvas);
window.addEventListener('pagehide',()=>{disposed=true;loop.stop();viewportResize.disconnect();autoDrone?.dispose();scene?.engine.dispose();renderer.dispose();scene?.dispose();});
try{busyUI(true);await renderer.init();await renderer.prepareDeathEffects();await loadScene(STUDY_SCENARIOS.find(s=>s.id==='split'));await refreshShots();}catch(error){busyUI(false);fail(error);}
