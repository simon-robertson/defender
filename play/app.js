import {WorldRenderer} from '../engine/renderer.js';
import {SceneLoader} from '../engine/scene-loader.js';
import {FrameLoop} from '../engine/clock.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {ArcEffects} from '../engine/arc-effects.js';
import {PlasmaLinks} from '../engine/plasma-links.js';
import {createPlasmaLinks} from '../game/plasma-links.js';
import {emitMissileImpact} from '../game/missile-impact.js';
import {TURRET_MUZZLES} from '../shared/arsenal.js';
import {PLAY_CONFIG,playCapacity} from './config.js';
import {PlaySession} from './session.js';
import {ProgressStore} from './progress.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine} from './engine.js';
import {createPlacementRules} from './placement.js';
import {renderUI} from './ui.js';
import {frameTitle,createTitleSession} from './presentation.js';
import {ActionCamera} from './action-camera.js';
import {DroneCamera} from './drone-camera.js';
import {CameraViews} from './camera-views.js';
import {UnitHighlight} from './unit-highlight.js';
import {LevelConditions,applyPlayLighting} from './conditions.js';
import {EntranceMarkers} from './entrance-markers.js';
import {FramePerformance} from './performance.js';
import {ScreenshotCamera} from './screenshot-camera.js';
import {loadGraphicsOptions,saveGraphicsOptions,GRAPHICS_DEFAULTS} from './graphics-options.js';

const canvas=document.getElementById('world'),overlay=document.getElementById('placement-overlay'),hint=document.getElementById('placement-hint');
const conditions=new LevelConditions();
let graphics=loadGraphicsOptions(),optionsOpen=false,leaveOpen=false;
const performanceReadout=new FramePerformance(document.getElementById('performance-readout'));
const entrances=new EntranceMarkers(document.getElementById('entrance-overlay'));
const config=PLAY_CONFIG,session=new PlaySession(config),shots=new ShotEffects(),damage=new DamageEffects(),arcs=new ArcEffects();
const progress=new ProgressStore(config);
let savedGame=null,progressLoaded=false,savingProgress=false,saveError='';
const highlight=new UnitHighlight({canvas,list:document.getElementById('unit-list'),overlay:document.getElementById('unit-highlight-overlay'),defences:config.defences});
const combatStep={combat:true},preparationStep={combat:false};
let renderer,loader,loop,engine,rules,actionCamera,droneCamera,cameraViews,screenshotCamera,plasmaLinks=null,plasmaOwner=null,plasmaConnections=[],sceneResize,pendingSpec,safeSeeds,lastCameraPhase='title',titleView=null,selectedId=null,hover=null,eligible=[],busy=true,error='',notice='',lastUI=-Infinity,lastDiagnostics=-Infinity,diagnosticsPending=false,disposed=false;
const frozen=()=>leaveOpen||session.paused||['defeat','complete'].includes(session.phase);
function snapshot(stats=engine?.stats()){
 const state=session.snapshot(),loadingSession=pendingSpec?.candidate??session;
 for(const unit of state.units){const weapon=unit.deployed&&engine?.firing.states.find(weapon=>weapon.id===unit.id);if(weapon){unit.stats={...unit.stats,strength:weapon.strength};unit.strengthIncrease=weapon.strengthIncrease??0;}}
 return {...state,loadingArea:busy?loadingSession.level.zone+config.levels.slice(0,loadingSession.levelIndex+1).filter(level=>level.zone===loadingSession.level.zone).length:undefined,graphics,optionsOpen,leaveOpen,savedGame:savedGame?{area:savedGame.level.zone+config.levels.slice(0,savedGame.levelIndex+1).filter(level=>level.zone===savedGame.level.zone).length,completedWaves:savedGame.completedWaves}:null,savingProgress,saveError,screenshotMode:screenshotCamera?.active??false,busy,error,notice,selectedId,cameraAutoEnabled:actionCamera?.enabled??true,droneCameraEnabled:droneCamera?.enabled??false,droneCameraActive:droneCamera?.active??false,droneCameraTime:droneCamera?.time??0,
 levelName:loader?.world?.level?.name??(session.levelIndex?'The Broadwater Garden':'The Limestone Orchard'),
 enemiesRemaining:stats?.active??0,spawned:stats?.spawned??0,totalEnemies:session.wave.spawns.length,
 placementHint:hover&&session.phase==='deploy'?hint.textContent:config.defences[session.units.find(unit=>unit.id===selectedId)?.model]?.kind==='enhancer'?'Place beside a defence: edge-sharing squares gain 25% strength. Diagonals do not.':undefined};}
function applyCameraPresentation(force=false){
 if(!renderer?.world||screenshotCamera?.active)return;
 const title=session.phase==='title',camera=renderer.camera;cameraViews?.sync(session.phase,engine);camera.setControlsEnabled(false);
 if((force||titleView!==title)&&!cameraViews?.active){if(title)frameTitle(camera);else camera.frame();renderer.requestDraw();}
 titleView=title;
}
function syncCombatEffects(){
 if(!engine||!renderer)return;
 arcs.time=engine.time;renderer.setArcEffects(engine.firing.arcs.states.length?arcs:null);renderer.setMissileThrust(engine.firing.missiles.states.length?engine.firing.missiles.thrust:null);
 const owner=engine.firing.enhancers;
 if(plasmaOwner!==owner){
  plasmaOwner=owner;plasmaConnections=createPlasmaLinks(engine.world,owner.states);
  if(plasmaConnections.length){plasmaLinks??=new PlasmaLinks();plasmaLinks.time=engine.time;plasmaLinks.setLinks(plasmaConnections);}
  else{plasmaLinks?.dispose();plasmaLinks=null;}
  renderer.setPlasmaLinks(plasmaLinks);
 }
}
function updateHighlight(){highlight.update({world:loader?.world,camera:renderer?.camera,units:session.units,preparing:session.preparing,busy:busy||Boolean(error),paused:session.paused});}
function paint(){if(screenshotCamera?.active&&(!session.paused||busy||error||leaveOpen))screenshotCamera.leave();cameraViews?.sync(session.phase,engine);const stats=engine?.stats(),state=snapshot(stats);renderUI(state);applyCameraPresentation();updateHighlight();diagnostics(state,stats);}
// Keep the review dataset available by default. Cosmetic-only frame updates
// share the normal five-Hz cadence; actions and lifecycle changes publish now.
function diagnostics(state,stats,force=true){const now=performance.now();if(!force&&now-lastDiagnostics<200){diagnosticsPending=true;return;}lastDiagnostics=now;diagnosticsPending=false;stats??=engine?.stats();state??=snapshot(stats);canvas.dataset.play=JSON.stringify({wildlife:{enabled:loader?.world?.playCritters!==false,actors:engine?.wildlife.states.length??0,planningBytes:engine?.wildlife.planningBytes??0},fish:engine?.wildlife.fish.stats()??null,...state,levelId:session.level.id,engine:stats??null,placements:session.placements,
 enhancers:{generators:engine?.firing.enhancers.states??[],links:plasmaLinks?.linkCount??0,overflow:plasmaLinks?.overflow??0,connections:plasmaConnections},volumeSmoke:{steps:renderer?.volumeSmoke?.steps??16,trails:renderer?.volumeSmoke?.count??0,dropped:renderer?.volumeSmoke?.dropped??0},damage:{time:damage.time,activeCubes:damage.activeCubes},performance:performanceReadout.stats(),conditions:loader?.world?.playConditions??null,guns:engine?.firing.turrets.states.map(g=>({id:g.id,variant:g.variant,x:g.x,z:g.z,target:g.target?.id??null,reservation:g.reservation?.id??null,shots:g.cycle.shots,lastShotTarget:g.lastShotTargetId,secondsSinceShot:Number.isFinite(g.cycle.lastShotAt)?g.cycle.time-g.cycle.lastShotAt:null,cooldownRemaining:Math.max(0,g.cycle.readyAt-g.cycle.time),burstRemaining:g.cycle.remaining,lineOfSight:g.lineOfSight,yawError:g.aimError,pitchError:g.pitchError}))??[],loads:loader?.loads??0,unloads:loader?.unloads??0,camera:renderer?.camera?{mode:renderer.camera.mode,fov:renderer.camera.fov,roll:renderer.camera.roll,position:[...renderer.camera.position],radius:renderer.camera.radius,target:[...renderer.camera.target],controlsEnabled:renderer.camera.controlsEnabled}:null,actionCamera:actionCamera?.stats()??null,droneCamera:droneCamera?.stats()??null,
 eligible:eligible.filter(cell=>cell.valid).map(cell=>cell.box),errors:error?[error]:[]});}
function fail(cause){error=cause?.message??String(cause);busy=false;performanceReadout.setRunning(false,'Error');renderer?.setTimingActive(false);loop?.stop();paint();}
function cameraState(){const c=renderer?.camera,active=cameraViews?.active;if(active){const v=active.saved;return {id:loader.world.level.id,target:Array.from(v.subarray(0,3)),yaw:v[3],pitch:v[4],radius:v[5]};}return c&&loader?.world?{id:loader.world.level.id,target:[...c.target],yaw:c.yaw,pitch:c.pitch,radius:c.radius}:null;}
function refreshPlacement(){overlayKey='';hover=null;const unit=session.units.find(unit=>unit.id===selectedId);eligible=unit&&rules&&session.phase==='deploy'?rules.eligibleCells(unit.variant,session.placements,unit.id,unit.model):[];drawOverlay();}
function runLoop(){const photo=screenshotCamera?.active,running=!disposed&&!error&&!document.hidden&&((photo&&session.paused)||(!busy&&!frozen()));performanceReadout.setRunning(running&&!photo,session.paused?'Paused':'Idle');renderer?.setTimingActive(running&&!photo);if(running)loop?.start();else loop?.stop();diagnostics();}
async function rebuild(candidate=session.fork(),points){
 if(disposed)return false;
 const placementKey=JSON.stringify(candidate.placements);
 if(points===undefined&&candidate.placements.length){
  if(rules&&loader.world?.level.id===candidate.level.id){const prepared=rules.prepare(candidate.placements);if(!prepared.valid){notice=prepared.reason;busy=false;paint();return false;}points=prepared.wildlifePoints;}
  else if(safeSeeds?.id===candidate.level.id&&safeSeeds.key===placementKey)points=safeSeeds.points;
 }
 const camera=cameraState();pendingSpec={candidate,points,camera,critters:graphics.critters,conditions:conditions.forLevel(candidate.level.id)};busy=true;error='';paint();
 return loader.switchTo(candidate.level.id,{force:true});
}
function validateArrangement(candidate){
 for(const placement of candidate.placements){const result=rules.check(placement.box,placement.variant,candidate.placements,placement.id,placement.model);if(!result.valid)return result;}
 return rules.prepare(candidate.placements);
}
async function commitArrangement(candidate,{selectNextAfter=null}={}){
 const result=validateArrangement(candidate);if(!result.valid){notice=result.reason;paint();return false;}
 const updated=engine.updateDeployments(candidate.placements);
 if(updated?.valid===false){notice=updated.reason;paint();return false;}
 session.adopt(candidate);safeSeeds={id:session.level.id,key:JSON.stringify(session.placements),points:result.wildlifePoints};
 if(selectNextAfter!==null)selectedId=session.nextUnplaced(selectNextAfter);
 cameraViews?.refresh();refreshPlacement();paint();return true;
}
function onComplete(waveId){
 if(session.beginSettling(waveId)){selectedId=null;paint();}
}
async function saveCheckpoint(){
 savingProgress=true;
 try{
  if(session.phase==='complete'){await progress.clear();savedGame=null;}
  else savedGame=await progress.save(session);
  saveError='';
 }catch{
  saveError='Progress could not be saved on this device. The previous checkpoint is kept.';
  notice=saveError;
 }finally{savingProgress=false;if(!disposed)paint();}
}
function finishSettlement(){
 const levelId=session.level.id,waveId=session.wave.id;
 if(!session.finishWave(waveId))return;
 notice='';
 if(session.phase==='complete'||session.level.id!==levelId)void saveCheckpoint();
 selectedId=null;busy=session.phase!=='complete'&&session.level.id!==levelId;paint();
 // Release only after the current fixed simulation tick has returned.
 queueMicrotask(()=>{
  if(disposed)return;
  try{
   if(session.phase==='complete'){runLoop();drawOverlay();paint();}
   else if(session.level.id!==levelId){
    rebuild().catch(fail);
   }
   else{
    engine.prepareWave(session.wave);renderer.volumeSmoke.reset();renderer.volumeSmoke.expire(engine.time);cameraViews.refresh();shots.reset();arcs.setWorld(loader.world);damage.setWorld(loader.world,engine.enemies.states);syncCombatEffects();
    shots.time=arcs.time=engine.time;refreshPlacement();paint();runLoop();
   }
  }catch(cause){fail(cause);}
 });
}
async function initialize(){
 if(!progressLoaded){
  try{savedGame=await progress.load();}catch{saveError='Saved progress could not be loaded on this device.';}
  progressLoaded=true;
 }
 renderer=new WorldRenderer(canvas,fail,{modelLightCapacity:playCapacity(config).modelLights,strictModelLights:true,gpuTiming:true,renderScale:.5});renderer.inspect=new URLSearchParams(location.search).has('inspect');await renderer.init();if(disposed){renderer.device?.destroy();return;}
 renderer.setGraphicsOptions(graphics);
 const [effectsPrepared,volumePrepared]=await Promise.all([renderer.prepareDeathEffects(),renderer.prepareVolumeSmoke()]);if(!effectsPrepared||!volumePrepared||disposed)return;renderer.camera.pathModeEnabled=false;
 actionCamera=new ActionCamera(renderer.camera);droneCamera=new DroneCamera(renderer.camera);cameraViews=new CameraViews(actionCamera,droneCamera);screenshotCamera=new ScreenshotCamera(renderer.camera);
 loop=new FrameLoop(dt=>{
  try{
   if(!engine)return;
   if(screenshotCamera.active&&session.paused){
    screenshotCamera.advance(dt);if(renderer.cameraDirty||renderer.dirty){renderer.render(0,engine.time);diagnostics(undefined,undefined,false);}else if(diagnosticsPending)diagnostics(undefined,undefined,false);return;
   }
   if(busy||frozen())return;
   const frameStarted=performance.now();
   const wasSettling=session.phase==='settling';
   engine.advance(dt,session.phase==='wave'?combatStep:preparationStep);shots.prepare();if(engine.firing.arcs.states.length)arcs.prepare();plasmaLinks?.prepare();
   if(renderer.camera.dragging||renderer.camera.keys.size)takeCameraControl();
   cameraViews.advance(dt,{engine,phase:session.phase,paused:session.paused});
   
   lastCameraPhase=session.phase;
   const renderStarted=performance.now();renderer.render(dt,engine.time);const cpuRenderMs=performance.now()-renderStarted;
   drawOverlay();updateHighlight();
   if(wasSettling&&session.advanceSettlement(dt))finishSettlement();
   if(engine.time-lastUI>.2){lastUI=engine.time;paint();}
   performanceReadout.sample(loop.clock.unscaledDeltaSeconds,performance.now()-frameStarted,renderer.gpuTimer?.read(),cpuRenderMs);
  }catch(cause){fail(cause);}
 });
 loader=new SceneLoader({
  load:async(id,{signal})=>{
   const spec=pendingSpec,world=await loadPlayWorld(id,{signal,placements:spec.candidate.placements,wave:spec.candidate.wave,config,wildlifePoints:spec.points,conditions:spec.conditions,critters:spec.critters});world.playRequest=spec;return world;
  },
  release:async world=>{
   loop.stop();screenshotCamera.leave();cameraViews.bind(null);renderer.setPlasmaLinks(null);plasmaLinks?.dispose();plasmaLinks=null;plasmaOwner=null;plasmaConnections=[];engine?.dispose();engine=null;rules?.dispose();rules=null;shots.reset();damage.reset();arcs.reset();renderer.setArcEffects(null);renderer.setMissileThrust(null);renderer.clearWorld();
   await renderer.device?.queue.onSubmittedWorkDone();disposePlayWorld(world);world.playRequest=null;
  },
  discard:world=>{disposePlayWorld(world);world.playRequest=null;},
  activate:world=>{
   const spec=world.playRequest;renderer.setWorld(world);applyPlayLighting(renderer,world.playConditions);shots.reset();damage.reset();
   rules=createPlacementRules(world.playSource,world.playModels,{config,critters:world.playCritters});
   engine=new PlayEngine(world,{config,wave:spec.candidate.wave,
    onPoseChange:(...args)=>renderer.updateInstance(...args),onVisible:(...args)=>renderer.setActorVisible(...args),
    onDeploymentsChanged:world=>{renderer.syncRuntimeInstances(world);syncCombatEffects();},
    onStep:dt=>{shots.advance(dt);damage.advance(dt);renderer.volumeSmoke.expire(engine.time);if(engine?.firing.arcs.states.length)arcs.advance(dt);plasmaLinks?.advance(dt);},onAfterStep:(dt,combat)=>{if(combat)damage.emitSmoke(dt);},
    onShot:(variant,matrix,at)=>{shots.emit(matrix,TURRET_MUZZLES[variant],at);actionCamera.noteShot(matrix,at);},
    onBulletImpact:(point,normal,at)=>{shots.impact(point,normal,at);cameraViews.noteActivity(point[0],point[1],point[2],at,1);},
    onArcShot:(source,point,normal,at,matrix,localPoint,isChain,sourceMatrix,sourceLocalPoint)=>{arcs.emit(source,point,normal,at,matrix,localPoint,isChain,sourceMatrix,sourceLocalPoint);actionCamera.note(source[0],source[1],source[2],0,at);cameraViews.noteActivity(point[0],point[1],point[2],at,2);},
    missileEffects:{onTrail:(x,y,z,id,lag)=>renderer.volumeSmoke.sample(id,x,y,z,engine.time-lag),onLaunch:(x,y,z)=>{damage.launchSmoke(x,y,z);actionCamera.note(x,y,z,0,engine.time);},onImpact:(x,y,z,nx,ny,nz)=>{emitMissileImpact(damage,world.playCritters?engine.wildlife:null,x,y,z,nx,ny,nz);cameraViews.noteExplosion({x,y,z},engine.time);}},
    onDeath:(id,state)=>{session.resolve(id,'killed');actionCamera.noteDeath(state,engine.time);cameraViews.noteExplosion(state,engine.time);const blast=damage.explode(state);if(blast&&world.playCritters){engine.wildlife.spookExplosion(blast.x,blast.y,blast.z,blast.config.frightRadius);}},
    onEscape:id=>{session.resolve(id,'escaped');if(session.phase==='defeat'){engine.stopWave();queueMicrotask(()=>{paint();runLoop();});}},
    onWaveComplete:()=>onComplete(engine.wave.id),
   });
   damage.setWorld(world,engine.enemies.states);arcs.setWorld(world);syncCombatEffects();renderer.setShotEffects(shots);renderer.setDamageEffects(damage);
   session.adopt(spec.candidate);const c=spec.camera;
   if(c?.id===world.level.id){renderer.camera.target.set(c.target);Object.assign(renderer.camera,{yaw:c.yaw,pitch:c.pitch,radius:c.radius});}
   cameraViews.bind(world);lastCameraPhase=session.phase;
   safeSeeds={id:world.level.id,key:JSON.stringify(session.placements),points:spec.points};world.playRequest=null;lastUI=-Infinity;
  },
  onLoading:()=>{busy=true;runLoop();refreshPlacement();paint();},
  onReady:()=>{busy=false;error='';refreshPlacement();paint();applyCameraPresentation(true);runLoop();},onError:fail,
 });
 sceneResize?.disconnect();sceneResize=new ResizeObserver(()=>{
  if(!renderer?.world)return;
  performanceReadout.reset();performanceReadout.paint();
  // Panel transitions change the viewport during a camera move. Keep its pose;
  // the director fits the new aspect on the next frame without a hard reset.
  if(session.phase==='title')frameTitle(renderer.camera);
  else if(!cameraViews.active&&session.preparing&&!['wave','settling'].includes(lastCameraPhase)&&!actionCamera.stats().returning&&!actionCamera.stats().hold&&actionCamera.enabled)renderer.camera.frame();
  else renderer.requestDraw();
  if(!loop.running)renderer.render(0,engine?.time??0);drawOverlay();updateHighlight();
 });sceneResize.observe(document.getElementById('scene'));
 await rebuild(createTitleSession(config,savedGame));
}

document.addEventListener('change',async event=>{
 const input=event.target.closest('input[data-graphics]'),key=input?.dataset.graphics;
 if(!Object.hasOwn(GRAPHICS_DEFAULTS,key)||disposed||busy||error||session.phase!=='title')return;
 graphics={...graphics,[key]:input.checked};saveGraphicsOptions(graphics);renderer.setGraphicsOptions(graphics);
 try{
  if(key==='critters')await rebuild();
  else{
   paint();runLoop();
  }
 }catch(cause){fail(cause);}
});

document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action,id=button.dataset.unit;
 if(disposed||busy)return;
 try{
  if(action==='cancel-leave'){leaveOpen=false;paint();runLoop();return;}
  if(action==='title'&&session.phase!=='title'&&session.phase!=='complete'&&!error){leaveOpen=true;screenshotCamera?.leave();renderer?.camera.keys.clear();paint();runLoop();return;}
  if(action==='confirm-title')leaveOpen=false;
  if(action==='options'||action==='close-options'){if(session.phase!=='title'||error)return;optionsOpen=action==='options';paint();return;}
  if(action==='retry-load'){leaveOpen=false;if(loader)await rebuild(pendingSpec?.candidate??session.fork(),pendingSpec?.points);else{renderer?.dispose();busy=true;error='';paint();await initialize();}return;}
  if(action==='continue'){
   optionsOpen=false;
   if(!['title','defeat'].includes(session.phase)||error||!savedGame||savingProgress)return;
   cameraViews?.reset();conditions.reset();selectedId=null;notice='Resumed from the last completed level.';await rebuild(savedGame.fork());return;
  }
  if(action==='title'||action==='confirm-title'||action==='play'||action==='retry'){
   optionsOpen=false;
   const toTitle=action==='title'||action==='confirm-title';leaveOpen=false;
   if(!toTitle)cameraViews?.reset();
   conditions.reset();const candidate=toTitle?createTitleSession(config,savedGame):new PlaySession(config);if(!toTitle)candidate.reset('loadout');selectedId=null;notice='';await rebuild(candidate);return;
  }
  if(error)return;
  if(action==='pause'||action==='resume'){session.pause(action==='pause');paint();runLoop();return;}
  if(session.paused)return;
  if(action==='buy'){const bought=session.buy(button.dataset.model??'turret-study');if(bought){selectedId=bought;notice='';paint();}return;}
  if(action==='select'&&session.preparing){selectedId=id;refreshPlacement();paint();return;}
  if(action==='cancel'){selectedId=null;refreshPlacement();paint();return;}
  if(action==='deploy'||action==='loadout'){if(session.prepare(action==='deploy'?'deploy':'loadout')){if(action==='deploy')selectedId=session.nextUnplaced();notice='';refreshPlacement();paint();}return;}
  if(action==='upgrade'){
   const candidate=session.fork();if(!candidate.upgrade(id))return;
   if(candidate.units.find(unit=>unit.id===id).box)await commitArrangement(candidate);else{session.adopt(candidate);paint();}return;
  }
  if(action==='undeploy'){const candidate=session.fork();if(candidate.undeploy(id))await commitArrangement(candidate);return;}
  if(action==='start-wave'&&session.phase==='deploy'){
   const valid=validateArrangement(session);if(!valid.valid){notice=valid.reason;paint();return;}
   selectedId=null;notice='';if(session.startWave()){refreshPlacement();engine.startWave();syncCombatEffects();paint();runLoop();}
  }
 }catch(cause){fail(cause);}
});

function project(x,y,z){const m=renderer.camera.vp,w=m[3]*x+m[7]*y+m[11]*z+m[15];return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w*canvas.clientWidth/2+canvas.clientWidth/2,canvas.clientHeight/2-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*canvas.clientHeight/2];}
function pick(event){
 const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*2-1,y=1-(event.clientY-rect.top)/rect.height*2,m=renderer.camera.inverse;
 const a=[m[0]*x+m[4]*y+m[12],m[1]*x+m[5]*y+m[13],m[2]*x+m[6]*y+m[14]],b=[a[0]+m[8],a[1]+m[9],a[2]+m[10]],t=(loader.world.level.pathHeight-a[1])/(b[1]-a[1]);
 return [Math.floor((a[0]+(b[0]-a[0])*t)/24),0,Math.floor((a[2]+(b[2]-a[2])*t)/24)];
}
const svgNS='http://www.w3.org/2000/svg',overlayView=new Float64Array(16);let overlayKey='';
function drawOverlay(){
 if(renderer)entrances.update(loader?.world,renderer.camera,busy?'loading':session.phase,canvas.clientWidth,canvas.clientHeight);
 if(!renderer||!engine||busy||session.phase!=='deploy'||!selectedId){if(overlay.childElementCount)overlay.replaceChildren();overlayKey='';return;}
 const unit=session.units.find(unit=>unit.id===selectedId),height=loader.world.level.pathHeight+.35;
 const view=renderer.camera.vp,key=[canvas.clientWidth,canvas.clientHeight,selectedId,unit.model,unit.variant,hover?.join(','),eligible.length].join('|');
 let changed=key!==overlayKey;if(!changed)for(let i=0;i<16;i++)if(overlayView[i]!==view[i]){changed=true;break;}
 if(!changed)return;overlayView.set(view);overlayKey=key;
 const fragment=document.createDocumentFragment();
 function polygon(box,color,opacity){const [x,,z]=box,shape=document.createElementNS(svgNS,'polygon');shape.setAttribute('points',[[x*24+1,z*24+1],[(x+1)*24-1,z*24+1],[(x+1)*24-1,(z+1)*24-1],[x*24+1,(z+1)*24-1]].map(([px,pz])=>project(px,height,pz).join(',')).join(' '));shape.setAttribute('fill',color);shape.setAttribute('fill-opacity',opacity);shape.setAttribute('stroke',color);shape.setAttribute('stroke-width','1.5');fragment.append(shape);}
 for(const cell of eligible)if(cell.valid)polygon(cell.box,'#9ad9b5','.17');
 if(hover){
  const result=rules.check(hover,unit.variant,session.placements,unit.id,unit.model),color=result.valid?'#dcf8b5':'#ea816c';polygon(hover,color,'.42');
  const family=config.defences[unit.model??'turret-study'];
  if(family.kind==='enhancer'){
   let neighbours=0;for(const placement of session.placements)if(config.defences[placement.model]?.kind!=='enhancer'&&Math.abs(placement.box[0]-hover[0])+Math.abs(placement.box[2]-hover[2])===1){polygon(placement.box,'#72ed88','.35');neighbours++;}
   hint.textContent=result.valid?`Click to place. ${neighbours?neighbours+' adjacent defence'+(neighbours===1?' gains':'s gain')+' +25% strength.':'No adjacent defence yet. Place a defence in an edge-sharing square to activate.'}`:result.reason;
  }else{
   const range=family.variants[unit.variant].stats.maxRange,ring=document.createElementNS(svgNS,'polygon'),cx=(hover[0]+.5)*24,cz=(hover[2]+.5)*24;
   ring.setAttribute('points',Array.from({length:64},(_,i)=>project(cx+Math.cos(i*Math.PI/32)*range,height,cz+Math.sin(i*Math.PI/32)*range).join(',')).join(' '));ring.setAttribute('fill','none');ring.setAttribute('stroke',color);ring.setAttribute('stroke-opacity','.7');ring.setAttribute('stroke-dasharray','4 5');fragment.prepend(ring);
   hint.textContent=result.valid?'Click to place. The dotted ring shows weapon range.':result.reason;
  }
 }
 overlay.replaceChildren(fragment);
}
async function placeAt(box){if(busy||error||session.phase!=='deploy'||!selectedId)return;const unit=session.units.find(unit=>unit.id===selectedId),valid=rules.check(box,unit.variant,session.placements,unit.id,unit.model);if(!valid.valid){notice=valid.reason;paint();return;}const candidate=session.fork();if(candidate.place(unit.id,box)){notice='';await commitArrangement(candidate,{selectNextAfter:unit.id});}}
function takeCameraControl(){if(cameraViews?.active)return;if(!busy&&!error&&!session.paused&&session.phase!=='title')actionCamera?.manualOverride(session.preparing?0:undefined);}
canvas.addEventListener('pointermove',event=>{if(busy||error||!loader?.world||!rules||session.phase!=='deploy'||!selectedId||event.buttons===2)return;hover=pick(event);drawOverlay();},true);
canvas.addEventListener('pointerdown',event=>{if(event.button!==0||busy||error||!loader?.world||!rules||session.phase!=='deploy'||!selectedId)return;event.preventDefault();event.stopImmediatePropagation();canvas.focus();hover=pick(event);placeAt(hover).catch(fail);},true);
canvas.addEventListener('pointerleave',()=>{hover=null;drawOverlay();});
document.addEventListener('keydown',event=>{
 if(leaveOpen){if(event.key==='Escape'&&!event.repeat){event.preventDefault();leaveOpen=false;paint();runLoop();}return;}
 if(optionsOpen&&event.key==='Escape'){event.preventDefault();optionsOpen=false;paint();return;}
 if(event.key==='Backspace'&&session.paused&&!busy&&!error&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target?.isContentEditable&&!/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName)){
  event.preventDefault();if(event.repeat)return;screenshotCamera.toggle(true);paint();if(screenshotCamera.active)canvas.focus();renderer.render(0,engine?.time??0);runLoop();return;
 }
 if(event.key.toLowerCase()==='p'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target?.isContentEditable&&!/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName)){
  if(['wave','settling'].includes(session.phase)&&!busy&&!error){event.preventDefault();screenshotCamera?.leave();session.pause(!session.paused);renderer?.camera.keys.clear();paint();runLoop();}return;
 }
 if(event.key==='Escape'&&!busy&&!error&&!event.repeat){if(selectedId){selectedId=null;refreshPlacement();paint();}else if(['wave','settling'].includes(session.phase)){screenshotCamera?.leave();session.pause(!session.paused);renderer?.camera.keys.clear();paint();runLoop();}return;}
 if(event.target!==canvas||busy||error||!loader?.world||!rules||session.phase!=='deploy'||!selectedId)return;
 if(event.key==='Enter'){event.preventDefault();if(hover)placeAt(hover).catch(fail);return;}
 const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];
 if(direction){event.preventDefault();event.stopImmediatePropagation();hover??=eligible.find(cell=>cell.valid)?.box.slice()??[0,0,0];hover=[Math.max(0,Math.min(loader.world.level.size[0]-1,hover[0]+direction[0])),0,Math.max(0,Math.min(loader.world.level.size[1]-1,hover[2]+direction[1]))];drawOverlay();}
},true);
document.addEventListener('visibilitychange',()=>{screenshotCamera?.clearInput();renderer?.camera.keys.clear();runLoop();});
window.addEventListener('blur',()=>screenshotCamera?.clearInput());
window.addEventListener('pagehide',()=>{disposed=true;screenshotCamera?.dispose();loop?.stop();sceneResize?.disconnect();highlight.dispose();entrances.dispose();droneCamera?.dispose();actionCamera?.bind(null);loader?.dispose();renderer?.dispose();});
paint();initialize().catch(fail);
