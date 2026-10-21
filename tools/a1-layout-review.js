import {buildWorld,disposeWorld} from '/engine/world.js';
import {WorldRenderer} from '/engine/renderer.js';
import {FrameLoop} from '/engine/clock.js';
import {SceneLoader} from '/engine/scene-loader.js';
import {previewLevelForId} from '/shared/preview-levels.js';

const views={
 baseline:{label:'Accepted landscape',url:'/docs/a1-path-carving-2026-10-18/baseline.level.json'},
 'orchard-tour':{label:'Orchard tour',url:'/docs/a1-path-carving-2026-10-18/orchard-tour.level.json'},
 'northern-traverse':{label:'Northern traverse',url:'/docs/a1-path-carving-2026-10-18/northern-traverse.level.json'},
 'southern-hook':{label:'Southern hook',url:'/docs/a1-path-carving-2026-10-18/southern-hook.level.json'},
 current:{label:'Approved A1 layout',url:'/docs/a1-path-carving-2026-10-18/approved-southern-hook.level.json'},
};
const $=id=>document.getElementById(id),renderer=new WorldRenderer($('scene'),fail);
let world=null,ready=false,night=false,disposed=false,loop;
const requested=new URLSearchParams(location.search).get('view'),initial=Object.hasOwn(views,requested)?requested:'current';
for(const [id,view]of Object.entries(views)){const option=document.createElement('option');option.value=id;option.textContent=view.label;$('level').append(option);}
$('level').value=initial;
function fail(message){ready=false;loop?.stop();$('error').textContent=String(message);$('status').textContent='Review unavailable';}
function wake(){if(ready&&!disposed&&!document.hidden)loop.start();}
const requestDraw=renderer.requestDraw.bind(renderer);renderer.requestDraw=()=>{requestDraw();wake();};
loop=new FrameLoop((delta,elapsed)=>{try{renderer.render(delta,elapsed);}catch(error){fail(error.message);}});
function lighting(){const sky=world.level.environment.sky;renderer.setLightingColors(night?'#708ABA':sky.color,night?'#263754':sky.ambient,night?'#263754':previewLevelForId('moss-01').background);$('night').textContent=night?'Day':'Night';$('night').setAttribute('aria-pressed',String(night));}
const scenes=new SceneLoader({
 load:async(id,{signal})=>{
  const view=views[id];if(!view)throw new Error('Unknown A1 layout view.');
  const response=await fetch(view.url,{signal,cache:'no-store'});if(!response.ok)throw new Error('A1 layout source is unavailable.');
  const data=await response.json(),level=view.api?data.asset:data;
  if(level.id!=='moss-01'||!['landscape','layout'].includes(level.previewMode))throw new Error('Expected a noncombat A1 source.');
  const models=new Map(await Promise.all([...new Set(level.placements.map(p=>p.model))].map(async model=>{
   const response=await fetch('/api/models/'+model,{signal,cache:'no-store'});if(!response.ok)throw new Error('Unable to load '+model);
   return [model,(await response.json()).asset];
  })));
  signal?.throwIfAborted();return buildWorld(level,models);
 },discard:disposeWorld,
 release:previous=>{ready=false;loop.stop();renderer.clearWorld();disposeWorld(previous);world=null;return renderer.device.queue.onSubmittedWorkDone();},
 activate:next=>{world=next;renderer.setWorld(world);lighting();},
 onLoading:()=>{ready=false;loop.stop();$('status').textContent='Loading…';$('error').textContent='';$('night').disabled=$('frame').disabled=true;},
 onReady:()=>{
  ready=true;const id=scenes.currentId,label=views[id].label;
  $('heading').textContent='A1 · '+label;$('stage-label').textContent='Limestone Orchard · 480 × 384 units · Layout review';
  $('status').textContent=`Ready · ${world.level.placements.length} scenery placements · ${world.level.path.length} path boxes · No combat units`;
  $('review-diagnostics').textContent=JSON.stringify({ready,view:id,placements:world.level.placements.length,pathBoxes:world.level.path.length,size:world.level.size,mode:world.level.previewMode,sceneBuffers:renderer.sceneBuffers.size,createdSceneBuffers:renderer.createdSceneBuffers,destroyedSceneBuffers:renderer.destroyedSceneBuffers});
  $('night').disabled=$('frame').disabled=false;$('game-link').href='/game/?inspect&level=moss-01';
  const url=new URL(location.href);url.searchParams.set('view',id);history.replaceState(null,'',url);wake();
 },onError:error=>fail(error.message),
});
$('level').addEventListener('change',()=>void scenes.switchTo($('level').value));
$('night').addEventListener('click',()=>{night=!night;lighting();});$('frame').addEventListener('click',()=>renderer.camera.frame());
document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else wake();});
window.addEventListener('pagehide',event=>{loop.stop();if(event.persisted)return;disposed=true;scenes.dispose();scenes.barrier.catch(()=>{});renderer.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted)wake();});
try{await renderer.init();if(!disposed){$('level').disabled=false;await scenes.switchTo(initial);}}catch(error){fail(error.message);renderer.dispose();}
