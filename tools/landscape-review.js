import {buildWorld,disposeWorld} from '/engine/world.js';
import {WorldRenderer} from '/engine/renderer.js';
import {FrameLoop} from '/engine/clock.js';
import {SceneLoader} from '/engine/scene-loader.js';
import {InspectionSampler} from '/engine/inspection-sampler.js';
import {PREVIEW_LEVELS,previewLevelForId} from '/shared/preview-levels.js';
import {levelRoutes,pathBoxUnion} from '/shared/routes.js';

const $=id=>document.getElementById(id),renderer=new WorldRenderer($('scene'),fail);
renderer.inspect=true;
const sampler=new InspectionSampler();
let selected=previewLevelForId(new URLSearchParams(location.search).get('level'))?.level??'moss-04',stage='before';
for(const profile of PREVIEW_LEVELS){const option=document.createElement('option');option.value=profile.level;option.textContent=`Zone ${profile.zone} · Level ${profile.number}`;$('level').append(option);}
$('level').value=selected;
let routeCount=0,pathBoxCount=0;
let world=null,ready=false,disposed=false,night=false,loop;
function fail(message){ready=false;loop?.stop();$('error').textContent=String(message);$('status').textContent='Review unavailable';$('review-diagnostics').textContent=JSON.stringify({ready:false,error:String(message)});}
function wake(){if(ready&&!disposed&&!document.hidden)loop.start();}
const invalidate=renderer.requestDraw.bind(renderer);renderer.requestDraw=()=>{invalidate();wake();};
function inspect(){
 $('review-diagnostics').textContent=JSON.stringify({ready,level:world?.level.id,stage:scenes.currentId?.split(':')[1],placements:world?.level.placements.length,routes:routeCount,pathBoxes:pathBoxCount,night,sceneBuffers:renderer.sceneBuffers.size,createdSceneBuffers:renderer.createdSceneBuffers,destroyedSceneBuffers:renderer.destroyedSceneBuffers,geometryBytes:renderer.bytes});
}
loop=new FrameLoop((delta,elapsed)=>{try{const report=sampler.advance(delta);renderer.render(delta,elapsed,report);if(report)inspect();}catch(error){fail(error.message);}});
function lighting(){const sky=world.level.environment.sky;renderer.setLightingColors(night?'#708ABA':sky.color,night?'#263754':sky.ambient,night?'#263754':null);$('night').textContent=night?'Day':'Night';$('night').setAttribute('aria-pressed',String(night));}
const scenes=new SceneLoader({
 load:async(key,{signal})=>{
  const [id,stage]=key.split(':');
  const response=await fetch(stage==='before'?`/docs/landscapes/${id}.json`:`/docs/landscape-reset-2026-10-18/previous-levels/${id}.json`,{signal,cache:'no-store'});
  if(!response.ok)throw new Error('The requested landscape stage is not available.');
  const level=await response.json();
  const models=new Map(await Promise.all([...new Set(level.placements.map(p=>p.model))].map(async id=>{
   const result=await fetch('/api/models/'+id,{signal,cache:'no-store'});if(!result.ok)throw new Error('Unable to load '+id);
   return [id,(await result.json()).asset];
  })));
  signal?.throwIfAborted();return buildWorld(level,models);
 },
 discard:disposeWorld,
 release:old=>{loop.stop();ready=false;renderer.clearWorld();disposeWorld(old);world=null;return renderer.device.queue.onSubmittedWorkDone();},
 activate:next=>{world=next;routeCount=levelRoutes(world.level).filter(route=>route.path.length).length;pathBoxCount=pathBoxUnion(world.level).length;renderer.setWorld(next);lighting();},
 onLoading:()=>{ready=false;loop.stop();$('error').textContent='';$('status').textContent='Loading…';$('night').disabled=$('frame').disabled=true;},
 onReady:()=>{
  ready=true;const [id,loadedStage]=scenes.currentId.split(':'),before=loadedStage==='before',profile=previewLevelForId(id);
  $('heading').textContent=`Zone ${profile.zone} · Level ${profile.number} · Archived comparison`;
  document.title=world.level.name+' · Archived landscape comparison';
  $('game-link').href=`/game/?inspect&level=${id}`;
  const url=new URL(location.href);url.searchParams.set('level',id);history.replaceState(null,'',url);
  $('before').setAttribute('aria-pressed',String(before));$('after').setAttribute('aria-pressed',String(!before));
  $('stage-label').textContent=before?'Previous landscape baseline · Before the fixed-size reset':'Previous carved layout · Archived for reference; path design is being reconsidered';
  $('status').textContent=`Ready · ${world.level.placements.length} placements · ${pathBoxCount} path boxes · ${routeCount} routes`;
  $('night').disabled=$('frame').disabled=false;inspect();wake();
 },onError:error=>fail(error.message),
});
function selectStage(next=stage){stage=next;void scenes.switchTo(`${selected}:${stage}`);}
$('before').addEventListener('click',()=>selectStage('before'));$('after').addEventListener('click',()=>selectStage('after'));
$('level').addEventListener('change',()=>{selected=$('level').value;selectStage();});
$('night').addEventListener('click',()=>{night=!night;lighting();});$('frame').addEventListener('click',()=>renderer.camera.frame());
document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else wake();});
window.addEventListener('pagehide',event=>{loop.stop();if(event.persisted)return;disposed=true;scenes.dispose();scenes.barrier.catch(()=>{});renderer.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted)wake();});
try{await renderer.init();if(!disposed){$('before').disabled=$('after').disabled=$('level').disabled=false;await scenes.switchTo(`${selected}:${stage}`);}}catch(error){fail(error.message);renderer.dispose();}
