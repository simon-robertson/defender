import {disposeWorld} from '/engine/world.js';
import {loadArchivedPreviewWorld as loadWorld} from '/tools/archived-preview-world.js';
import {WorldRenderer} from '/engine/renderer.js';
import {FrameLoop} from '/engine/clock.js';
import {SceneLoader} from '/engine/scene-loader.js';
import {DamageEffects} from '/engine/damage-effects.js';
import {EnemyPreview,previewActorsForLevel} from '/game/enemy-preview.js';
import {MissilePreview,MISSILE_PREVIEW_ACTORS} from '/game/missile-preview.js';
import {MISSILE_PHASE,MISSILE_FLIGHT} from '/shared/missile-flight.js';
import {previewLevelForId} from '/shared/preview-levels.js';
const $=id=>document.getElementById(id),canvas=$('scene'),controls=['level','variant','night','close','attitude','overview','boost','coast','homing','terminal','launch-smoke','enemy-impact','ground-impact','age','impact-age'];
const params=new URLSearchParams(location.search),allowed=['moss-03','ochre-03','plum-03'];
if(allowed.includes(params.get('level')))$('level').value=params.get('level');
if(['base','upgrade1','upgrade2'].includes(params.get('variant')))$('variant').value=params.get('variant');
if(params.has('age')&&Number.isFinite(Number(params.get('age'))))$('age').value=Math.max(0,Math.min(4000,Number(params.get('age'))));
let world=null,enemies=null,missiles=null,selected=null,flight=null,night=params.has('night'),ready=false,disposed=false,loop,hitCount=0,lastImpact=null,reviewMode=params.get('mode')??'flight',snapshotAge=0;
const errors=[],renderer=new WorldRenderer(canvas,fail),damage=new DamageEffects(()=>.5);renderer.inspect=true;renderer.setDamageEffects(damage);
function fail(message){ready=false;loop?.stop();errors.push(String(message));$('error').textContent=String(message);$('status').textContent='Review unavailable';}
function wake(){if(ready&&!disposed&&!document.hidden)loop.start();}
const requestDraw=renderer.requestDraw.bind(renderer);renderer.requestDraw=()=>{requestDraw();wake();};
loop=new FrameLoop(delta=>{try{renderer.render(delta,snapshotAge);if(!renderer.camera.dragging&&!renderer.camera.keys.size){loop.stop();inspect();}}catch(error){fail(error.message);}});
function lighting(){
 if(!world)return;const sky=world.level.environment.sky;
 renderer.setLightingColors(night?'#708ABA':sky.color,night?'#263754':sky.ambient,night?'#263754':previewLevelForId(world.level.id).background);
 $('night').textContent=night?'Day':'Night';$('night').setAttribute('aria-pressed',String(night));renderer.requestDraw();
}
function makeMissiles(){
 // User-triggered review snapshots rebuild CPU control records only. The fixed
 // world actors, geometry, renderer buffer and shader pipelines remain shared.
 const prior=renderer.missileThrust;missiles?.dispose();missiles=new MissilePreview(world,renderer.updateInstance.bind(renderer),renderer.setActorVisible.bind(renderer),enemies.states,(target,strength,vx,vy,vz)=>{hitCount++;return enemies.takeHit(target,strength,vx,vy,vz);},{onTrail:(x,y,z)=>damage.missileTrail(x,y,z),onLaunch:(x,y,z)=>damage.launchSmoke(x,y,z),onImpact:(x,y,z,nx,ny,nz)=>{lastImpact={position:[x,y,z],normal:[nx,ny,nz],kind:hitCount?'enemy':'ground/scenery'};damage.missileImpact(x,y,z,nx,ny,nz);}});
 if(prior){prior.instanceData.set(missiles.thrust.instanceData);prior.instanceCount=0;missiles.pool.thrust=missiles.thrust=prior;}
 else renderer.setMissileThrust(missiles.thrust);
}
function snapshot(){
 if(!selected)return;loop.stop();hitCount=0;lastImpact=null;damage.reset(true);enemies.reset();enemies.advance(selected.routeTime);makeMissiles();
 const state=missiles.states.find(state=>state.id===selected.launcher),target=enemies.states.find(state=>state.id===selected.enemy);
 target.velocityX=target.velocityZ=target.aimVelocityX=target.aimVelocityY=target.aimVelocityZ=0;state.target=target;state.targetLap=target.lap;missiles.advance(0);state.target=null;
 flight=missiles.pool.slots.find(slot=>slot.phase===MISSILE_PHASE.BOOST);if(!flight)throw new Error('Review launch is not eligible.');
 const impactMode=reviewMode==='enemy-impact'||reviewMode==='ground-impact',age=(impactMode||reviewMode==='terminal')?8.1:reviewMode==='launch-smoke'?.35:Number($('age').value)*.001;
 let moved=false,elapsed=0;
 for(let steps=0;elapsed+1e-10<age&&steps<974;steps++){
  const dt=Math.min(MISSILE_FLIGHT.stepSeconds,age-elapsed);damage.advance(dt);missiles.advance(dt);elapsed+=dt;
  // A deliberate evasive move after commitment exercises the real miss and
  // terrain collision path; no flight destination or collision is fabricated.
  if(reviewMode==='ground-impact'&&!moved&&flight.committed){enemies.advance(3);moved=true;}
  if(lastImpact)lastImpact.kind=hitCount?'enemy':'ground/scenery';
  if(impactMode&&lastImpact){const after=Number($('impact-age').value)*.001;damage.advance(after);elapsed+=after;break;}
  if(reviewMode==='terminal'&&flight.engineCutoff)break;
 }
 damage.prepare();snapshotAge=elapsed;$('age-label').textContent=Math.round(elapsed*1000)+' ms';const phase=phaseName();$('status').textContent=`Ready · ${lastImpact?.kind??phase} · ${selected.enemy} · ${damage.smokeCount} smoke puffs`;
 for(const [id,ms]of [['boost',250],['coast',700],['homing',1200]])$(id).setAttribute('aria-pressed',String(reviewMode==='flight'&&Number($('age').value)===ms));
 for(const id of ['terminal','launch-smoke','enemy-impact','ground-impact'])$(id).setAttribute('aria-pressed',String(reviewMode===id));
 renderer.requestDraw();
}
function effectView(){
 if(reviewMode==='flight'||reviewMode==='terminal'){closeView();return;}
 const c=renderer.camera,p=lastImpact?.position??[selected.x,world.level.pathHeight+18,selected.z];
 c.mode='overview';c.keys.clear();c.dragging=false;c.pitch=.3;c.yaw=.65;c.target.set([p[0],p[1]+4,p[2]]);c.radius=reviewMode==='launch-smoke'?33:55;renderer.requestDraw();
}
function phaseName(){return !flight?'loaded':flight.phase===MISSILE_PHASE.FREE?(hitCount?'arrived':missiles.pool.collisions?'blocked':'expired'):flight.engineCutoff?'terminal coast':Object.keys(MISSILE_PHASE).find(key=>MISSILE_PHASE[key]===flight.phase).toLowerCase();}
function closeView(){
 if(!selected)return;const c=renderer.camera,target=enemies.states.find(state=>state.id===selected.enemy),dx=target.x-selected.x,dz=target.z-selected.z;
 c.mode='overview';c.keys.clear();c.dragging=false;c.pitch=.42;c.yaw=Math.atan2(dx,dz)+Math.PI*.5;
 const boostRise=MISSILE_FLIGHT.boostSpeed*MISSILE_FLIGHT.boostSeconds,coastRise=MISSILE_FLIGHT.boostSpeed*MISSILE_FLIGHT.coastSeconds-.5*MISSILE_FLIGHT.coastGravity*MISSILE_FLIGHT.coastSeconds**2;
 // Include a conservative powered-turn allowance above the ballistic phases.
 const low=world.level.pathHeight,high=selected.y+boostRise+coastRise+24;
 c.target.set([(selected.x+target.x)*.5,(low+high)*.5,(selected.z+target.z)*.5]);
 const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);c.radius=Math.max(43,(high-low)*.6,(Math.hypot(dx,dz)+28)*.55/Math.max(.4,aspect));renderer.requestDraw();
}
function findLaunch(){
 loop.stop();selected=null;enemies.reset();makeMissiles();const state=missiles.states.find(state=>state.variant===$('variant').value);if(!state)throw new Error('Requested launcher variant is missing.');
 // Bounded developer-only route search. Flight itself uses the production
 // current-range admission, curved guidance and swept collision paths.
 for(let step=0;step<600&&!selected;step++){
  for(const target of enemies.states){const distance=Math.hypot(target.x-state.x,target.z-state.z);if(distance<32||distance>state.maxRange*.85)continue;target.velocityX=target.velocityZ=target.aimVelocityX=target.aimVelocityY=target.aimVelocityZ=0;if(!missiles.eligible(state,target))continue;
   selected={launcher:state.id,variant:state.variant,enemy:target.id,routeTime:enemies.completedLoops*enemies.loopSeconds+enemies.time,distance,x:state.x,y:state.sources[1],z:state.z};target.velocityX=target.velocityZ=target.aimVelocityX=target.aimVelocityY=target.aimVelocityZ=0;break;
  }
  if(!selected)enemies.advance(.25);
 }
 if(!selected)throw new Error('No eligible route pose found.');snapshot();effectView();wake();
}
function inspect(){
 const pool=missiles?.pool;
 $('review-diagnostics').textContent=JSON.stringify({ready,errors,level:world?.level.id,night,age:snapshotAge,mode:reviewMode,impact:lastImpact,effects:{trailSmoke:damage.smoke.reduce((n,p)=>n+(p.active&&p.trail?1:0),0),smoke:damage.smokeCount,blasts:damage.blastCount,lights:damage.lightCount,launches:damage.launches,missileImpacts:damage.missileImpacts,dropped:damage.droppedMissileBlasts},selected,phase:phaseName(),hitCount,flight:flight?{turnFactor:flight.turnFactor,angularSpeed:flight.angularSpeed,steeringAngle:flight.steeringAngle,steeringTorque:flight.steeringTorque,jetPhase:flight.jetPhase,phase:flight.phase,engineCutoff:flight.engineCutoff,speed:Math.hypot(flight.vx,flight.vy,flight.vz),age:flight.age,position:[flight.x,flight.y,flight.z],direction:[flight.dx,flight.dy,flight.dz],velocity:[flight.vx,flight.vy,flight.vz]}:null,active:pool?.active,collisions:pool?.collisions,missed:pool?.missed,completedAtLastPosition:pool?.completedAtLastPosition,expired:pool?.expired,thrustInstances:missiles?.thrust.instanceCount,thrustInstanceData:missiles?Array.from(missiles.thrust.instanceData.subarray(0,missiles.thrust.instanceCount*16)):[],thrustLights:missiles?.thrust.lightCount,thrustLightData:missiles?Array.from(missiles.thrust.lightData.subarray(0,4+missiles.thrust.lightCount*8)):[],localLightUniformBytes:renderer.localLightData?.byteLength,localLightUploadBytes:renderer.localLightUploadBytes,thrustBytes:renderer.missileThrustBytes,thrustUploadBytes:renderer.missileThrustUploadBytes,bloomActive:renderer.bloom?.active,bloomDraws:renderer.bloom?.draws,actors:world?.actors.size,sceneBuffers:renderer.sceneBuffers.size,geometryBytes:renderer.bytes,modelLights:renderer.modelLights?.count??0,modelLightOverflow:renderer.modelLights?.overflow??0});
}
const scenes=new SceneLoader({
 load:(id,options)=>loadWorld(id,{...options,actors:[...previewActorsForLevel(id),...MISSILE_PREVIEW_ACTORS]}),discard:disposeWorld,
 release:old=>{loop.stop();ready=false;missiles?.dispose();missiles=null;enemies?.dispose();enemies=null;selected=flight=null;damage.reset();renderer.clearWorld();disposeWorld(old);world=null;return renderer.device.queue.onSubmittedWorkDone();},
 activate:next=>{world=next;renderer.setWorld(next);enemies=new EnemyPreview(next,renderer.updateInstance.bind(renderer));damage.setWorld(next,enemies.states);lighting();},
 onLoading:()=>{ready=false;loop.stop();$('status').textContent='Loading real level…';$('error').textContent='';for(const id of controls)$(id).disabled=true;},
 onReady:()=>{ready=true;for(const id of controls)$(id).disabled=false;try{findLaunch();}catch(error){fail(error.message);}},onError:error=>fail(error.message),
});
function runSnapshot(){try{snapshot();}catch(error){fail(error.message);}}
$('impact-age').addEventListener('input',()=>{if(reviewMode==='enemy-impact'||reviewMode==='ground-impact')runSnapshot();});
$('level').addEventListener('change',()=>scenes.switchTo($('level').value));$('variant').addEventListener('change',()=>{try{findLaunch();}catch(error){fail(error.message);}});
$('attitude').addEventListener('click',()=>{if(!flight)return;const c=renderer.camera;c.mode='overview';c.target.set([flight.x,flight.y,flight.z]);c.yaw=.8;c.pitch=1;c.radius=14;renderer.requestDraw();});
$('night').addEventListener('click',()=>{night=!night;lighting();});$('close').addEventListener('click',closeView);$('overview').addEventListener('click',()=>{renderer.camera.frame();renderer.requestDraw();});$('age').addEventListener('input',()=>{reviewMode='flight';runSnapshot();});
for(const [id,age]of [['boost',250],['coast',700],['homing',1200]])$(id).addEventListener('click',()=>{reviewMode='flight';$('age').value=age;runSnapshot();closeView();});
for(const id of ['terminal','launch-smoke','enemy-impact','ground-impact'])$(id).addEventListener('click',()=>{reviewMode=id;runSnapshot();effectView();});
document.addEventListener('keydown',event=>{if(!ready||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.key.toLowerCase()!=='n'||event.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName))return;event.preventDefault();night=!night;lighting();});
canvas.addEventListener('keydown',wake);document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else if(ready)renderer.requestDraw();});
window.addEventListener('pagehide',event=>{loop.stop();if(event.persisted)return;disposed=true;scenes.dispose();scenes.barrier.catch(()=>{});renderer.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted&&ready)renderer.requestDraw();});
try{await renderer.init();renderer.device.addEventListener('uncapturederror',event=>{errors.push(event.error.message);inspect();});if(!disposed)await scenes.switchTo($('level').value);}catch(error){fail(error.message);renderer.dispose();}
