import {levelRoutes,pathBoxUnion} from "/shared/routes.js";
import {buildWorld,disposeWorld} from '/engine/world.js';
import {WorldRenderer} from '/engine/renderer.js';
import {FrameLoop} from '/engine/clock.js';
import {SceneLoader} from '/engine/scene-loader.js';
import {previewLevelForId} from '/shared/preview-levels.js';

const studies=[
 {level:'ochre-01',name:'B1 · Sunworn Cistern',options:[['cistern-mesa-circuit','Cistern and Mesa Circuit'],['southern-mesa-return','Southern Mesa Return']]},
 {level:'ochre-02',name:'B2 · Broken Aqueduct',options:[['riverfold-crossing','Riverfold Crossing'],['aqueduct-confluence','Aqueduct Confluence']]},
 {level:'ochre-03',name:'B3 · Three Mesas',options:[['three-mesa-tour','Three Mesa Tour'],['mesa-confluence','Mesa Confluence']]},
 {level:'ochre-04',name:'B4 · Petrol Basin',options:[['aqueduct-shore-tour','Aqueduct and Shore Tour'],['basin-confluence','Basin Confluence']]},
];
const views={};
for(const study of studies){
 views[study.level+'-baseline']={label:study.name+' · Original landscape',level:study.level,url:'/docs/landscape-reset-2026-10-18/landscapes/'+study.level+'.json'};
 for(const [id,label] of study.options)views[id]={label:study.name+' · '+label,level:study.level,url:'/docs/zone-b-path-carving-2026-10-19/'+id+'.level.json'};
 views[study.level+'-current']={label:study.name+' · Current source',level:study.level,url:'/api/levels/'+study.level,api:true};
}
const $=id=>document.getElementById(id),renderer=new WorldRenderer($('scene'),fail);
let world=null,ready=false,night=false,disposed=false,loop;
const requested=new URLSearchParams(location.search).get('view'),initial=Object.hasOwn(views,requested)?requested:'ochre-01-current';
for(const [id,view]of Object.entries(views)){const option=document.createElement('option');option.value=id;option.textContent=view.label;$('level').append(option);}
$('level').value=initial;
function fail(message){ready=false;loop?.stop();$('error').textContent=String(message);$('status').textContent='Review unavailable';}
function wake(){if(ready&&!disposed&&!document.hidden)loop.start();}
const requestDraw=renderer.requestDraw.bind(renderer);renderer.requestDraw=()=>{requestDraw();wake();};
loop=new FrameLoop((delta,elapsed)=>{try{renderer.render(delta,elapsed);}catch(error){fail(error.message);}});
function lighting(){const sky=world.level.environment.sky;renderer.setLightingColors(night?'#708ABA':sky.color,night?'#263754':sky.ambient,night?'#263754':previewLevelForId(world.level.id).background);$('night').textContent=night?'Day':'Night';$('night').setAttribute('aria-pressed',String(night));}
const scenes=new SceneLoader({
 load:async(id,{signal})=>{
  const view=views[id];if(!view)throw new Error('Unknown Zone B layout view.');
  const response=await fetch(view.url,{signal,cache:'no-store'});if(!response.ok)throw new Error('Zone B layout source is unavailable.');
  const data=await response.json(),level=view.api?data.asset:data;
  if(level.id!==view.level||level.zone!=='B'||!['landscape','layout'].includes(level.previewMode))throw new Error('Expected the selected noncombat Zone B source.');
  const models=new Map(await Promise.all([...new Set(level.placements.map(p=>p.model))].map(async model=>{
   const response=await fetch('/api/models/'+model,{signal,cache:'no-store'});if(!response.ok)throw new Error('Unable to load '+model);
   return [model,(await response.json()).asset];
  })));
  signal?.throwIfAborted();return buildWorld(level,models);
 },discard:disposeWorld,
 release:previous=>{ready=false;loop.stop();renderer.clearWorld();disposeWorld(previous);world=null;return renderer.device.queue.onSubmittedWorkDone();},
 activate:next=>{world=next;renderer.setWorld(world);lighting();},
 onLoading:()=>{ready=false;loop.stop();$('status').textContent='Loading…';$('error').textContent='';$('night').disabled=$('frame').disabled=$('bridge').disabled=true;},
 onReady:()=>{
  ready=true;const id=scenes.currentId,label=views[id].label;
  $('heading').textContent=label;$('stage-label').textContent='Ochre and Petrol · 480 × 384 units · Layout review';
  $('status').textContent=`Ready · ${world.level.placements.length} scenery placements · ${pathBoxUnion(world.level).length} path boxes · ${levelRoutes(world.level).filter(r=>r.path.length).length} routes · No combat units`;
  $('review-diagnostics').textContent=JSON.stringify({ready,view:id,level:world.level.id,placements:world.level.placements.length,pathBoxes:pathBoxUnion(world.level).length,routes:levelRoutes(world.level).filter(r=>r.path.length).map(r=>({id:r.id,boxes:r.path.length})),bridgeBoxes:world.level.bridges?.reduce((n,b)=>n+b.boxes.length,0)??0,size:world.level.size,mode:world.level.previewMode,sceneBuffers:renderer.sceneBuffers.size,createdSceneBuffers:renderer.createdSceneBuffers,destroyedSceneBuffers:renderer.destroyedSceneBuffers});
  $('night').disabled=$('frame').disabled=false;$('bridge').disabled=!world.level.bridges?.length;$('game-link').href='/game/?inspect&level='+world.level.id;
  const url=new URL(location.href);url.searchParams.set('view',id);history.replaceState(null,'',url);wake();
 },onError:error=>fail(error.message),
});
$('level').addEventListener('change',()=>void scenes.switchTo($('level').value));
$('night').addEventListener('click',()=>{night=!night;lighting();});$('frame').addEventListener('click',()=>renderer.camera.frame());
$('bridge').addEventListener('click',()=>{
 const boxes=world?.level.bridges?.flatMap(bridge=>bridge.boxes);if(!boxes?.length)return;
 const xs=boxes.map(box=>box[0]),zs=boxes.map(box=>box[1]),minX=Math.min(...xs)*24,maxX=(Math.max(...xs)+1)*24,minZ=Math.min(...zs)*24,maxZ=(Math.max(...zs)+1)*24,camera=renderer.camera;
 camera.frame();camera.target.set([(minX+maxX)/2,world.level.pathHeight,(minZ+maxZ)/2]);camera.radius=Math.max(64,Math.max(maxX-minX,maxZ-minZ)*.7);camera.invalidate();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else wake();});
window.addEventListener('pagehide',event=>{loop.stop();if(event.persisted)return;disposed=true;scenes.dispose();scenes.barrier.catch(()=>{});renderer.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted)wake();});
try{await renderer.init();if(!disposed){$('level').disabled=false;await scenes.switchTo(initial);}}catch(error){fail(error.message);renderer.dispose();}
