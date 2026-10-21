import {disposeWorld} from '/engine/world.js';
import {loadArchivedPreviewWorld as loadWorld} from '/tools/archived-preview-world.js';
import {WorldRenderer} from '/engine/renderer.js';
import {FrameLoop} from '/engine/clock.js';
import {SceneLoader} from '/engine/scene-loader.js';
import {EnemyPreview,previewActorsForLevel} from '/game/enemy-preview.js';
import {ArcEffects} from '/engine/arc-effects.js';
import {ArcImpactSampler} from '/engine/arc-impact.js';
import {ARC_SPIRE_TERMINALS} from '/shared/arsenal.js';
import {DEFENCE_STATS} from '/shared/defence.js';
import {previewLevelForId} from '/shared/preview-levels.js';
const $=id=>document.getElementById(id),canvas=$('scene'),controls=['level','variant','night','close','overview','effect','age'];
const params=new URLSearchParams(location.search),allowed=['moss-02','ochre-02','plum-02'];
if(allowed.includes(params.get('level')))$('level').value=params.get('level');
if(['base','upgrade1','upgrade2'].includes(params.get('variant')))$('variant').value=params.get('variant');
let world=null,enemies=null,contact=null,selected=null,night=params.has('night'),enabled=true,ready=false,disposed=false,seed=73,loop;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},effects=new ArcEffects(random),source=new Float64Array(3),sockets=new Float64Array(12);
const renderer=new WorldRenderer(canvas,fail);renderer.inspect=true;
function fail(message){ready=false;loop?.stop();$('error').textContent=String(message);$('status').textContent='Review unavailable';}
function wake(){if(ready&&!disposed&&!document.hidden)loop.start();}
const requestDraw=renderer.requestDraw.bind(renderer);renderer.requestDraw=()=>{requestDraw();wake();};
loop=new FrameLoop(delta=>{try{renderer.render(delta,0);if(!renderer.camera.dragging&&!renderer.camera.keys.size){loop.stop();inspect();}}catch(error){fail(error.message);}});
function lighting(){
 if(!world)return;const sky=world.level.environment.sky;
 renderer.setLightingColors(night?'#708ABA':sky.color,night?'#263754':sky.ambient,night?'#263754':previewLevelForId(world.level.id).background);
 $('night').textContent=night?'Day':'Night';$('night').setAttribute('aria-pressed',String(night));renderer.requestDraw();
}
function strike(){
 if(!selected)return;effects.setWorld(world);seed=193;const age=Number($('age').value)*.001;
 if(enabled){effects.emit(source,contact.point,contact.normal,0,contact.matrix,contact.localPoint);effects.advance(age);}effects.prepare();
 $('age-label').textContent=Math.round(age*1000)+' ms';$('effect').textContent=enabled?'Strike on':'Strike off';$('effect').setAttribute('aria-pressed',String(enabled));renderer.requestDraw();
}
function closeView(){
 if(!selected)return;const camera=renderer.camera,point=contact.point,dx=point[0]-source[0],dz=point[2]-source[2];
 camera.mode='overview';camera.keys.clear();camera.dragging=false;camera.pitch=.48;camera.yaw=Math.atan2(dx,dz)+Math.PI*.5;
 camera.target.set([(source[0]+point[0])*.5,(source[1]+point[1]+world.level.pathHeight)*.333,(source[2]+point[2])*.5]);
 const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight),span=Math.hypot(dx,dz);
 camera.radius=Math.max(38,(span+45)*.56/Math.max(.4,aspect),(source[1]-world.level.pathHeight+24)*.62);renderer.requestDraw();
}
function findStrike(){
 loop.stop();selected=null;effects.reset();enemies.reset();contact?.dispose();seed=73;contact=new ArcImpactSampler(world,enemies.states,random);
 const placement=world.level.placements.find(p=>p.model==='arc-spire'&&p.variant===$('variant').value);
 if(!placement)throw new Error('Requested Arc variant is missing.');
 const m=world.rigs.get(placement.id).root,local=ARC_SPIRE_TERMINALS[placement.variant],cx=m[0]*12+m[8]*12+m[12],cz=m[2]*12+m[10]*12+m[14],maxRange=DEFENCE_STATS['arc-spire'][placement.variant].maxRange;
 for(let i=0;i<local.length;i++)for(let axis=0;axis<3;axis++)sockets[i*3+axis]=m[axis]*local[i][0]+m[4+axis]*local[i][1]+m[8+axis]*local[i][2]+m[12+axis];
 // A bounded developer search through the actual authored route. Each accepted
 // pose/contact uses production articulation, centre range and exact surface LOS.
 for(let step=0;step<600&&!selected;step++){
  for(const target of enemies.states){
   const distance=Math.hypot(target.x-cx,target.z-cz);if(distance>maxRange||distance<24)continue;
   let socket=0,best=Infinity;for(let i=0;i<4;i++){const d=(sockets[i*3]-target.x)**2+(sockets[i*3+2]-target.z)**2;if(d<best){best=d;socket=i;}}
   for(let axis=0;axis<3;axis++)source[axis]=sockets[socket*3+axis];
   if(!contact.sample(target,source,world.visibility))continue;
   selected={placement:placement.id,variant:placement.variant,enemy:target.id,part:contact.partId,time:enemies.time,distance,terminal:socket};break;
  }
  if(!selected)enemies.advance(.25);
 }
 if(!selected)throw new Error('No valid facing-side contact found in the bounded route study.');
 strike();closeView();$('status').textContent=`Ready · ${selected.variant} → ${selected.enemy} / ${selected.part}`;wake();
}
function inspect(){
 $('review-diagnostics').textContent=JSON.stringify({ready,level:world?.level.id,night,enabled,age:Number($('age').value)*.001,selected,source:Array.from(source),impact:contact?Array.from(contact.point):null,normal:contact?Array.from(contact.normal):null,strikes:effects.strikeCount,sparks:effects.sparkCount,grounded:effects.groundedCount,lights:effects.lightCount,instances:effects.instanceCount,arcBytes:renderer.arcBytes,modelLights:renderer.modelLights?.count??0,modelLightOverflow:renderer.modelLights?.overflow??0,sceneBuffers:renderer.sceneBuffers.size,geometryBytes:renderer.bytes,createdSceneBuffers:renderer.createdSceneBuffers,destroyedSceneBuffers:renderer.destroyedSceneBuffers,camera:{radius:renderer.camera.radius,yaw:renderer.camera.yaw,pitch:renderer.camera.pitch}});
}
const scenes=new SceneLoader({
 load:(id,options)=>loadWorld(id,{...options,actors:previewActorsForLevel(id)}),discard:disposeWorld,
 release:old=>{loop.stop();ready=false;effects.reset();contact?.dispose();contact=null;selected=null;enemies?.dispose();enemies=null;renderer.clearWorld();disposeWorld(old);world=null;return renderer.device.queue.onSubmittedWorkDone();},
 activate:next=>{world=next;renderer.setWorld(next);renderer.setArcEffects(effects);effects.setWorld(next);enemies=new EnemyPreview(next,renderer.updateInstance.bind(renderer));lighting();},
 onLoading:()=>{ready=false;loop.stop();$('status').textContent='Loading real level…';$('error').textContent='';for(const id of controls)$(id).disabled=true;},
 onReady:()=>{ready=true;for(const id of controls)$(id).disabled=false;try{findStrike();}catch(error){fail(error.message);}},onError:error=>fail(error.message),
});
$('level').addEventListener('change',()=>scenes.switchTo($('level').value));
$('variant').addEventListener('change',()=>{try{findStrike();}catch(error){fail(error.message);}});
$('night').addEventListener('click',()=>{night=!night;lighting();});$('close').addEventListener('click',closeView);$('overview').addEventListener('click',()=>renderer.camera.frame());
$('effect').addEventListener('click',()=>{enabled=!enabled;strike();});$('age').addEventListener('input',strike);
document.addEventListener('keydown',event=>{if(!ready||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.key.toLowerCase()!=='n'||event.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName))return;event.preventDefault();night=!night;lighting();});
canvas.addEventListener('keydown',wake);document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else if(ready)renderer.requestDraw();});
window.addEventListener('pagehide',event=>{loop.stop();if(event.persisted)return;disposed=true;scenes.dispose();scenes.barrier.catch(()=>{});renderer.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted&&ready)renderer.requestDraw();});
try{await renderer.init();if(!disposed)await scenes.switchTo($('level').value);}catch(error){fail(error.message);renderer.dispose();}
