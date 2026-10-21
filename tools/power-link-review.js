import {disposeWorld} from '/engine/world.js';
import {loadArchivedPreviewWorld as loadWorld} from '/tools/archived-preview-world.js';
import {WorldRenderer} from '/engine/renderer.js';
import {FrameLoop} from '/engine/clock.js';
import {SceneLoader} from '/engine/scene-loader.js';
import {PlasmaLinks} from '/engine/plasma-links.js';
import {DefencePreview} from '/game/defence-preview.js';
import {createPlasmaLinks} from '/game/plasma-links.js';
import {previewLevelForId} from '/shared/preview-levels.js';
const $=id=>document.getElementById(id),canvas=$('scene'),controls=['night','close','overview','effect','play','time'];
const params=new URLSearchParams(location.search);
let world=null,firing=null,links=[],effect=null,night=params.has('night'),enabled=true,playing=true,ready=false,disposed=false,loop;
const renderer=new WorldRenderer(canvas,fail);renderer.inspect=true;
function fail(message){ready=false;loop?.stop();$('error').textContent=String(message);$('status').textContent='Review unavailable';$('review-diagnostics').textContent=JSON.stringify({ready:false,error:String(message)});}
function wake(){if(ready&&!disposed&&!document.hidden)loop.start();}
const requestDraw=renderer.requestDraw.bind(renderer);renderer.requestDraw=()=>{requestDraw();wake();};
loop=new FrameLoop((delta,elapsed)=>{try{
 if(playing&&enabled)effect?.advance(delta);effect?.prepare();renderer.render(delta,elapsed);inspect();
 if(!playing&&!renderer.camera.dragging&&!renderer.camera.keys.size)loop.stop();
}catch(error){fail(error.message);}});
function lighting(){
 if(!world)return;const sky=world.level.environment.sky;
 renderer.setLightingColors(night?'#708ABA':sky.color,night?'#263754':sky.ambient,night?'#263754':previewLevelForId(world.level.id).background);
 $('night').textContent=night?'Day':'Night';$('night').setAttribute('aria-pressed',String(night));renderer.requestDraw();
}
function closeView(){
 if(!links.length)return;const camera=renderer.camera,source=links[0].source,target=links[0].target;
 camera.mode='overview';camera.keys.clear();camera.dragging=false;camera.pitch=.48;camera.yaw=2.35;
 camera.target.set([(source[0]+target[0])*.5,world.level.pathHeight+10,(source[2]+target[2])*.5]);
 camera.radius=Math.max(41,41/(canvas.clientWidth/Math.max(1,canvas.clientHeight)));renderer.requestDraw();
}
function playback(){ $('play').textContent=playing?'Pause':'Play';$('play').setAttribute('aria-pressed',String(playing));renderer.requestDraw(); }
function inspect(){
 const time=effect?.time??0;
 $('time-label').textContent=time.toFixed(2)+' s';
 $('review-diagnostics').textContent=JSON.stringify({ready,level:world?.level.id,night,enabled,playing,time,links:links.map(link=>({sourceId:link.sourceId,targetId:link.targetId,source:Array.from(link.source),target:Array.from(link.target)})),linkCount:effect?.linkCount??0,lightCount:effect?.lightCount??0,instanceCount:effect?.instanceCount??0,overflow:effect?.overflow??0,strengths:firing?.states.map(s=>({id:s.id,base:s.baseStrength,increase:s.strengthIncrease,effective:s.strength})),plasmaBytes:renderer.plasmaBytes,tubeBytes:renderer.plasmaLightBuffer?.size??0,renderedLights:renderer.plasmaLightCount,modelLights:renderer.modelLights?.count??0,modelLightOverflow:renderer.modelLights?.overflow??0,sceneBuffers:renderer.sceneBuffers.size,createdSceneBuffers:renderer.createdSceneBuffers,destroyedSceneBuffers:renderer.destroyedSceneBuffers});
}
const scenes=new SceneLoader({
 load:(id,options)=>loadWorld(id,options),discard:disposeWorld,
 release:old=>{loop.stop();ready=false;renderer.setPlasmaLinks(null);effect?.dispose();effect=null;links.length=0;firing?.dispose();firing=null;renderer.clearWorld();disposeWorld(old);world=null;return renderer.device.queue.onSubmittedWorkDone();},
 activate:next=>{world=next;renderer.setWorld(next);firing=new DefencePreview(next,renderer.updateInstance.bind(renderer),Math.random,null,[]);links=createPlasmaLinks(next,firing.enhancers.states);effect=new PlasmaLinks();effect.setLinks(links);effect.prepare();renderer.setPlasmaLinks(effect);lighting();},
 onLoading:()=>{ready=false;loop.stop();for(const id of controls)$(id).disabled=true;},
 onReady:()=>{ready=true;for(const id of controls)$(id).disabled=false;$('status').textContent='Ready · One active connection';closeView();wake();},onError:error=>fail(error.message),
});
$('night').addEventListener('click',()=>{night=!night;lighting();});$('close').addEventListener('click',closeView);$('overview').addEventListener('click',()=>renderer.camera.frame());
$('effect').addEventListener('click',()=>{enabled=!enabled;renderer.setPlasmaLinks(enabled?effect:null);$('effect').textContent=enabled?'Link on':'Link off';$('effect').setAttribute('aria-pressed',String(enabled));renderer.requestDraw();});
$('play').addEventListener('click',()=>{playing=!playing;playback();});
$('time').addEventListener('input',()=>{playing=false;effect.reset();effect.advance(Number($('time').value)*.001);effect.prepare();playback();});
document.addEventListener('keydown',event=>{if(!ready||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.key.toLowerCase()!=='n'||event.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName))return;event.preventDefault();night=!night;lighting();});
canvas.addEventListener('keydown',wake);document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else wake();});
window.addEventListener('pagehide',event=>{loop.stop();if(event.persisted)return;disposed=true;scenes.dispose();scenes.barrier.catch(()=>{});renderer.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted)wake();});
try{await renderer.init();if(!disposed)await scenes.switchTo('moss-01');}catch(error){fail(error.message);renderer.dispose();}
