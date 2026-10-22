import {loadWorld,disposeWorld} from '/engine/world.js';
import {WorldRenderer} from '/engine/renderer.js';
import {FrameLoop} from '/engine/clock.js';
import {InspectionSampler} from '/engine/inspection-sampler.js';
import {SceneLoader} from '/engine/scene-loader.js';
import {DefencePreview} from '/game/defence-preview.js';
import {actorsForPreview} from '/game/preview-actors.js';
import {emitMissileImpact} from '/game/missile-impact.js';
import {EnemyPreview} from '/game/enemy-preview.js';
import {WildlifePreview,wildlifeActorsForLevel} from '/game/wildlife-preview.js';
import {ShotEffects} from '/engine/shot-effects.js';
import {DamageEffects} from '/engine/damage-effects.js';
import {ArcEffects} from '/engine/arc-effects.js';
import {PlasmaLinks} from '/engine/plasma-links.js';
import {createPlasmaLinks} from '/game/plasma-links.js';
import {TURRET_MUZZLES} from '/shared/arsenal.js';
import {ZONE_PREVIEWS} from '/shared/zone-style.js';
import {PreviewSelection,previewLevelForId,previewLevelsForZone,previewShortcut} from '/shared/preview-levels.js';
import {levelRoutes} from '/shared/routes.js';
import {isNonCombatPreview} from '/shared/preview-mode.js';
const status=document.getElementById('status'),error=document.getElementById('error');
const cameraButton=document.getElementById('camera-mode'),lightingButton=document.getElementById('lighting-mode'),frameButton=document.getElementById('frame'),controls=document.getElementById('camera-controls');
const zoneButtons=[...document.querySelectorAll('[data-zone-key]')];
const timeButton=document.getElementById('time-mode');
const levelControls=document.getElementById('level-controls'),levelButtonsHost=document.getElementById('level-buttons'),levelSummary=document.getElementById('level-selection-status');
const selection=new PreviewSelection(),levelButtons=new Map();
const initialLevel=previewLevelForId(new URLSearchParams(location.search).get('level'));
if(initialLevel){selection.selectZone(initialLevel.zone);selection.selectLevel(initialLevel.number);}
const inspectionSampler=new InspectionSampler();
const NIGHT_LIGHTING=Object.freeze({color:'#708ABA',ambient:'#263754'});
let renderer,loop,scenes,firing,enemies,wildlife,plasmaLinks=null,plasmaConnections=[],night=false,lastUnload=null,enemyResets=0;
const profileFor=previewLevelForId;
function fail(cause){loop?.stop();status.hidden=true;error.hidden=false;error.textContent=cause instanceof Error?cause.message:cause;console.error(cause);}
function readyControls(ready){
 lightingButton.disabled=frameButton.disabled=timeButton.disabled=!ready;
 const hasPath=Boolean(scenes?.world&&levelRoutes(scenes.world.level).some(route=>route.path.length));
 cameraButton.disabled=!ready||!hasPath;cameraButton.title=hasPath?'Enter path view (F)':'Path view unavailable: this landscape has no enemy path.';
 updateCameraControls(renderer?.camera.mode??'overview');
}
function updateCameraControls(mode){
 const path=mode==='path',noncombat=isNonCombatPreview(scenes?.world?.level),hasPath=Boolean(scenes?.world&&levelRoutes(scenes.world.level).some(route=>route.path.length));
 cameraButton.setAttribute('aria-pressed',String(path));cameraButton.querySelector('span').textContent=path?'Overview':'Path view';
 const view=path?'<span><b>WASD</b> move</span><i></i><span><b>Drag</b> look</span><i></i><span><b>F</b> overview</span>':'<span><b>Drag</b> orbit</span><i></i><span><b>Right drag / WASD</b> pan</span><i></i><span><b>Scroll</b> zoom</span>';
 controls.innerHTML=view+(noncombat?'':'<i></i><span><b>R</b> reset enemies</span>')+'<i></i><span><b>T</b> slow motion</span>';
 renderer?.canvas.setAttribute('aria-label',path?'Path view. WASD to move, drag to look, F to return to overview.':'3D landscape preview. Drag to orbit, right drag or WASD to pan, scroll to zoom.'+(hasPath?' F to enter path view.':''));
}
function toggleTime(){
 if(!loop||!scenes?.world||scenes.loading||renderer.failed)return false;
 const slow=loop.clock.timeScale===1;loop.clock.setTimeScale(slow ? .1 : 1);
 timeButton.querySelector('span').textContent=slow?'Time: 0.1×':'Time: 1×';timeButton.setAttribute('aria-pressed',String(slow));
 timeButton.title=slow?'Return to normal speed (T)':'Slow preview to 0.1× speed (T)';return true;
}
function reportLifecycle(phase){
 if(!renderer.inspect)return;
 renderer.canvas.dataset.lifecycle=JSON.stringify({phase,requested:scenes.requestedId,current:scenes.currentId,requestedId:selection.profile.level,requestedZone:selection.profile.zone,requestedLevel:selection.profile.number,currentId:scenes.currentId,zone:scenes.world?.level.zone??null,level:profileFor(scenes.currentId)?.number??null,previewMode:scenes.world?.level.previewMode??null,loads:scenes.loads,unloads:scenes.unloads,sceneBuffers:renderer.sceneBuffers.size,createdSceneBuffers:renderer.createdSceneBuffers,destroyedSceneBuffers:renderer.destroyedSceneBuffers,geometryBytes:renderer.bytes??0,assets:scenes.world?.assetIds??[],actors:scenes.world?.actors.size??0,visibilityBytes:scenes.world?.visibility?.byteLength??0,visibilityPrimitives:scenes.world?.visibility?.primitiveCount??0,lastUnload});
}
function applyLighting(world=scenes?.world){
 if(!world)return;const sky=night?NIGHT_LIGHTING:world.level.environment.sky;
 renderer.setLightingColors(sky.color,sky.ambient,night?sky.ambient:profileFor(world.level.id)?.background);
 document.body.dataset.lighting=night?'night':'day';lightingButton.setAttribute('aria-pressed',String(night));lightingButton.querySelector('span').textContent=night?'Day':'Night';
}
function toggleLighting(){if(!scenes?.world||scenes.loading)return;night=!night;applyLighting();}
function requestZone(zone){if(!scenes||renderer.failed)return;const profile=selection.selectZone(zone);if(profile)void scenes.switchTo(profile.level);}
function requestLevel(number){if(!scenes||renderer.failed)return;const profile=selection.selectLevel(number);if(profile)void scenes.switchTo(profile.level);}
function updateLevelControls(phase,id){
 const profile=profileFor(id)??selection.profile,available=previewLevelsForZone(profile.zone),active=phase==='ready'?profile:null;
 const numbers=new Set(available.map(item=>item.number));
 for(const [number,button]of levelButtons)if(!numbers.has(number)){button.remove();levelButtons.delete(number);}
 for(const item of available){
  let button=levelButtons.get(item.number);
  if(!button){
   button=document.createElement('button');button.type='button';button.dataset.levelNumber=String(item.number);
   button.innerHTML=`Level ${item.number} <kbd>⇧ ${item.number}</kbd>`;
   button.addEventListener('click',()=>requestLevel(item.number));levelButtons.set(item.number,button);levelButtonsHost.append(button);
  }
  button.setAttribute('aria-label',`Zone ${profile.zone} level ${item.number} (Shift+${item.number})`);
  button.setAttribute('aria-pressed',String(active?.number===item.number));
  button.dataset.loading=String(phase==='loading'&&profile.number===item.number);
  button.title=`Select level ${item.number} in ${profile.name} (Shift+${item.number})`;
 }
 for(const [index,button]of zoneButtons.entries()){
  const zone=ZONE_PREVIEWS[index].zone;button.setAttribute('aria-pressed',String(active?.zone===zone));
  button.dataset.loading=String(phase==='loading'&&profile.zone===zone);
 }
 levelControls.setAttribute('aria-busy',String(phase==='loading'));
 levelSummary.textContent=`Zone ${profile.zone} · Level ${profile.number}${phase==='loading'?' · Loading…':phase==='error'?' · Choose again to retry':''}`;
}
try{
 renderer=new WorldRenderer(document.getElementById('world'),fail);renderer.inspect=new URLSearchParams(location.search).has('inspect');
 renderer.camera.overviewFov=renderer.camera.pathFov=renderer.camera.fov=60;
 renderer.camera.onModeChange=updateCameraControls;
 cameraButton.addEventListener('click',()=>renderer.camera.toggleMode());lightingButton.addEventListener('click',toggleLighting);frameButton.addEventListener('click',()=>renderer.camera.frame());
 timeButton.addEventListener('click',toggleTime);
 zoneButtons.forEach((button,index)=>button.addEventListener('click',()=>requestZone(ZONE_PREVIEWS[index].zone)));
 document.addEventListener('keydown',e=>{
  if(e.repeat||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName))return;
  const key=e.key.toLowerCase();if(key==='r'){if(resetEnemies())e.preventDefault();return;}if(key==='n'){e.preventDefault();toggleLighting();return;}if(key==='t'){if(toggleTime())e.preventDefault();return;}
  const shortcut=previewShortcut(e);
  if(shortcut?.kind==='zone'){e.preventDefault();requestZone(shortcut.zone);}
  else if(shortcut?.kind==='level'&&previewLevelsForZone(selection.profile.zone).some(profile=>profile.number===shortcut.number)){e.preventDefault();requestLevel(shortcut.number);}
 });
 readyControls(false);await renderer.init();
 const effects=new ShotEffects(),damage=new DamageEffects();let arcEffects=null;
 const onPoseChange=renderer.updateInstance.bind(renderer),onShot=(variant,matrix,at,muzzles=TURRET_MUZZLES[variant])=>effects.emit(matrix,muzzles,at);
 function resetEnemies(){
  if(!scenes?.world||scenes.loading||renderer.failed||(!enemies?.states.length&&!firing?.missiles.states.length&&!firing?.drones.states.length))return false;
  damage.reset(true);wildlife?.clearFearEvents();arcEffects?.reset(true);const shotTime=effects.time;effects.reset();effects.time=shotTime;firing.resetTargets();enemies.reset();
  for(const state of enemies.states)renderer.setActorVisible(state.id,true);
  enemyResets++;inspectionSampler.reset();reportLifecycle('enemies-reset');return true;
 }
 const onEnemyDeath=(id,state)=>{
  const blast=damage.explode(state);
  if(blast){wildlife?.spookExplosion(blast.x,blast.y,blast.z,blast.config.frightRadius);}
  renderer.setActorVisible(id,false);
 },onHit=(target,strength,vx,vy,vz)=>enemies.takeHit(target,strength,vx,vy,vz);
 const missileEffects={
  onImpact:(x,y,z,nx,ny,nz)=>emitMissileImpact(damage,wildlife,x,y,z,nx,ny,nz),
  onTrail:(x,y,z,lag)=>damage.missileTrail(x,y,z,lag),onLaunch:(x,y,z)=>damage.launchSmoke(x,y,z),
 };
 const onArcShot=(source,point,normal,at,matrix,localPoint,isChain,sourceMatrix,sourceLocalPoint)=>arcEffects.emit(source,point,normal,at,matrix,localPoint,isChain,sourceMatrix,sourceLocalPoint);
 loop=new FrameLoop((deltaSeconds,elapsedSeconds)=>{try{
  if(!scenes.world||!firing)return;
  const noncombat=isNonCombatPreview(scenes.world.level),hasArcs=firing.arcs.states.length>0;
  const inspectFrame=renderer.inspect&&inspectionSampler.advance(loop.clock.unscaledDeltaSeconds);
  if(noncombat)wildlife?.advance(deltaSeconds);
  else{effects.advance(deltaSeconds);if(hasArcs)arcEffects.advance(deltaSeconds);plasmaLinks?.advance(deltaSeconds);damage.advance(deltaSeconds);enemies?.advance(deltaSeconds);wildlife?.advance(deltaSeconds);firing.advance(deltaSeconds);damage.emitSmoke(deltaSeconds);effects.prepare();if(hasArcs)arcEffects.prepare();plasmaLinks?.prepare();}
  renderer.render(deltaSeconds,elapsedSeconds,inspectFrame);
  if(inspectFrame){
   renderer.canvas.dataset.enhancers=JSON.stringify({generators:firing.enhancers.states.map(s=>({id:s.id,model:s.model,variant:s.variant,active:s.active,recipientIds:s.recipientIds})),plasma:{time:plasmaLinks?.time??0,links:plasmaLinks?.linkCount??0,lights:plasmaLinks?.lightCount??0,instances:plasmaLinks?.instanceCount??0,overflow:plasmaLinks?.overflow??0,connections:plasmaConnections.map(link=>({sourceId:link.sourceId,targetId:link.targetId,source:Array.from(link.source),target:Array.from(link.target)}))}});
   renderer.canvas.dataset.clock=JSON.stringify({timeScale:loop.clock.timeScale,unscaledDeltaSeconds:loop.clock.unscaledDeltaSeconds,deltaSeconds,elapsedSeconds});
   renderer.canvas.dataset.damage=JSON.stringify({smoke:damage.smokeCount,blasts:damage.blastCount,waves:damage.shockwaveCount,cubes:damage.cubeCount,resting:damage.cubes.reduce((n,p)=>n+(p.active&&p.resting?1:0),0),lights:damage.lightCount,droppedCubes:damage.droppedCubes,droppedSmoke:damage.droppedSmoke,replacedBlasts:damage.replacedBlasts,missileImpacts:damage.missileImpacts,launches:damage.launches,droppedMissileBlasts:damage.droppedMissileBlasts,droppedLaunchSmoke:damage.droppedLaunchSmoke,missileBlasts:damage.missileBlastCount,launchSmoke:damage.launchSmokeCount});
   renderer.canvas.dataset.enemies=JSON.stringify({resets:enemyResets,time:enemies.time,alive:enemies.alive,updatedParts:enemies.updatedParts,actors:enemies.states.map(s=>({id:s.id,model:s.model,routeId:s.routeId,routeLength:s.path.length,airborne:s.airborne,routeForecastEligible:s.routeForecastEligible,speed:s.movement.speed,altitude:s.altitude,health:s.health.current,maxHealth:s.health.maximum,threat:s.threat,lap:s.lap,alive:s.health.alive,hits:s.health.hits,distance:s.distance,x:s.x,z:s.z,aimX:s.aimX,aimY:s.aimY,aimZ:s.aimZ,aimVelocityX:s.aimVelocityX,aimVelocityY:s.aimVelocityY,aimVelocityZ:s.aimVelocityZ,velocityX:s.velocityX,velocityZ:s.velocityZ,yaw:s.yaw,impact:s.impact?{active:s.impact.active,balanceAllowed:s.impact.balanceAllowed,age:s.impact.age,hits:s.impact.hits,offsetX:s.impact.offsetX,offsetZ:s.impact.offsetZ,velocityX:s.impact.velocityX,velocityZ:s.impact.velocityZ,restricted:s.impact.restricted,pitch:s.impact.pitch,roll:s.impact.roll,bob:s.impact.bob,brace:s.impact.brace,tiltX:s.impact.tiltX,tiltZ:s.impact.tiltZ}:null,feet:s.gait.feet.map(f=>({name:f.name,phase:f.phase,stance:f.stance,position:Array.from(f.position)}))}))});
   // Keep the existing A inspection alias while exposing all enemy types.
   if(scenes.currentId==='moss-01')renderer.canvas.dataset.dogs=renderer.canvas.dataset.enemies;
   renderer.canvas.dataset.wildlife=JSON.stringify({fish:wildlife.fish.stats(),time:wildlife.time,updatedParts:wildlife.updatedParts,thinkCount:wildlife.thinkCount,lastThinkId:wildlife.lastThinkId,lastThinkWork:wildlife.lastThinkWork,planningBytes:wildlife.planningBytes,treePerches:wildlife.treePerches.length,explosionEvents:wildlife.spookCount,actors:wildlife.states.map(s=>({id:s.id,model:s.model,kind:s.kind,phase:s.phase,flight:s.flight,frightened:s.frightened,spooks:s.spooks,lastSpookKind:s.lastSpookKind,fleeJourneys:s.fleeJourneys,thinkCount:s.thinkCount,journeys:s.journeys,journeysCompleted:s.journeysCompleted,groundComponent:s.groundComponent,targetPerch:s.targetPerch,destinationX:s.destinationX,destinationY:s.destinationY,destinationZ:s.destinationZ,perch:wildlife.perches[s.perch]?.id??null,destination:wildlife.perches[s.goalPerch]?.id??null,x:s.x,y:s.y,z:s.z,homeX:s.homeX,homeZ:s.homeZ}))});
   renderer.canvas.dataset.firing=JSON.stringify({plannerThinks:firing.planner?.thinks??0,lastThinkId:firing.planner?.lastThinkId??null,tracking:firing.targets!==null,shots:firing.shots,active:firing.active,turning:firing.turning,updatedParts:firing.updatedParts,turrets:firing.turrets.states.map(s=>({id:s.id,variant:s.variant,thinkCount:s.thinkCount??0,reservation:s.reservation?.id??null,predictedCoverage:s.predictedCoverage??0,x:s.x,z:s.z,maxRange:s.maxRange,baseStrength:s.baseStrength,strengthIncrease:s.strengthIncrease,strength:s.strength,requiresLineOfSight:s.requiresLineOfSight,lineOfSight:s.lineOfSight,occludedTargets:s.occludedTargets,targetId:s.target?.id??null,targetDistance:s.targetDistance,aimPoint:s.target?Array.from(s.targeting.point):null,aimError:s.aimError,lastShotTargetId:s.lastShotTargetId,lastShotDistance:s.lastShotDistance,lastShotAimError:s.lastShotAimError,lastShotPitchError:s.lastShotPitchError,lastShotVisible:s.lastShotVisible,lastShotDamage:s.lastShotDamage,lastShotAt:s.cycle.lastShotAt,burstRemaining:s.cycle.remaining,shots:s.cycle.shots,recoil:s.displacement,yaw:s.aim.yaw,targetYaw:s.aim.target,angularVelocity:s.aim.velocity,pitch:s.pitch.angle,targetPitch:s.targetPitch,pitchError:s.pitchError,pitchReachable:s.pitchReachable,pitchVelocity:s.pitch.velocity,turning:s.turning,cooldownRemaining:Math.max(0,s.cycle.readyAt-s.cycle.time)}))});
   renderer.canvas.dataset.arcs=JSON.stringify({strikes:arcEffects?.strikeCount??0,sparks:arcEffects?.sparkCount??0,grounded:arcEffects?.groundedCount??0,lights:arcEffects?.lightCount??0,replacedStrikes:arcEffects?.replacedStrikes??0,droppedSparks:arcEffects?.droppedSparks??0,spires:firing.arcs.states.map(s=>({id:s.id,variant:s.variant,maxRange:s.maxRange,baseStrength:s.baseStrength,strengthIncrease:s.strengthIncrease,strength:s.strength,terminal:s.terminal,source:Array.from(s.source),thinkCount:s.thinkCount??0,targetId:s.target?.id??null,targetDistance:s.targetDistance,lineOfSight:s.lineOfSight,shots:s.cycle.shots,lastShotAt:s.lastShotAt,lastShotTargetId:s.lastShotTargetId,lastShotDamage:s.lastShotDamage,lastShotDistance:s.lastShotDistance,lastImpact:Array.from(s.lastImpact),lastNormal:Array.from(s.lastNormal),lastImpactPart:s.lastImpactPart,surfaceRejects:s.surfaceRejects,burstRemaining:s.cycle.remaining,cooldownRemaining:Math.max(0,s.cycle.readyAt-s.cycle.time)}))});
   const missiles=firing.missiles,pool=missiles.pool;
   const drones=firing.drones,nav=drones.navigation;
   renderer.canvas.dataset.drones=JSON.stringify({time:drones.time,shots:drones.shots,obstacles:drones.obstacles?.inspect()??null,navigation:nav?{nodes:nav.count,bytes:nav.byteLength+(drones.brakeIntent?.byteLength??0)+drones.states.reduce((total,s)=>total+s.nav.queue.byteLength+s.nav.parents.byteLength+s.nav.distance.byteLength+s.nav.path.byteLength+s.candidateNodes.byteLength+s.candidateTimes.byteLength+s.candidateLap.byteLength+(s.candidateWindows?.byteLength??0)+(s.shortNodes?.byteLength??0)+(s.shortScores?.byteLength??0)+(s.shortTimes?.byteLength??0)+(s.window?.byteLength??0)+(s.motion?.data.byteLength??0)+(s.motion?.point.byteLength??0)+(s.motion?.samplePoint.byteLength??0)+(s.intent?.byteLength??0),0),queries:nav.queries,nodeVisits:nav.nodeVisits}:null,aircraft:drones.states.map(s=>({id:s.id,phase:s.phase,x:s.x,y:s.y,z:s.z,homeX:s.homeX,homeZ:s.homeZ,flightElapsed:s.flightElapsed,flightRemaining:Math.max(0,20-s.flightElapsed),rechargeRemaining:s.rechargeRemaining,expired:s.expired,launches:s.launches,returns:s.returns,returnStartedAt:s.returnStartedAt,returnReason:s.returnReason,avoidanceCause:s.avoidanceCause,avoidanceActorId:s.avoidanceActorId,planningFailure:s.planningFailure,flightAction:s.flightAction,fleetYieldTo:s.fleetYieldTo,yieldOwner:s.yieldOwner,fleetWait:s.fleetWait,shotsAtExpiry:s.shotsAtExpiry,shots:s.cycle.shots,burstRemaining:s.cycle.remaining,cooldownRemaining:Math.max(0,s.cycle.readyAt-s.cycle.time),targetId:s.target?.id??null,targetLap:s.targetLap,targetDistance:s.targetDistance,thinkCount:s.thinkCount,replans:s.replans,blocked:s.blocked,holds:s.holds,goalNode:s.goalNode,homeNode:s.homeNode,navPathLength:s.nav.pathLength,navPathIndex:s.nav.pathIndex,navVisited:s.nav.visited,lineOfSight:s.lineOfSight,aimError:s.aimError,pitchError:s.pitchError,bodyYaw:s.aim.yaw,bodyPitch:s.bodyPitch,bodyRoll:s.bodyRoll,fanPitch:s.fanPitch,fanRoll:s.fanRoll,yawAcceleration:s.yawAcceleration,fans:s.fans?.map(f=>({id:f.id,gimbal:f.gimbal,pitch:f.pitch,roll:f.roll,targetPitch:f.targetPitch,targetRoll:f.targetRoll})),speed:s.speed,velocityX:s.velocityX,velocityY:s.velocityY,velocityZ:s.velocityZ,accelerationX:s.accelerationX,accelerationY:s.accelerationY,accelerationZ:s.accelerationZ,stationChanges:s.stationChanges,routeChanges:s.routeChanges,emergencyStops:s.emergencyStops,stationCommitted:s.stationCommitted,stationArrivalAt:s.stationArrivalAt,stationFireAt:s.stationFireAt,stationWindowEnd:s.stationWindowEnd,stationPulses:s.stationPulses,committedThinks:s.committedThinks,evasions:s.evasions,evading:s.evading,motion:s.motion?{segmentIndex:s.motion.segmentIndex,segmentCount:s.motion.segmentCount,distance:s.motion.distance,length:s.motion.length}:null,gunYaw:s.gunYaw.angle,gunPitch:s.pitch.angle,rotorPhase:s.rotorPhase,lastShotAt:s.lastShotAt,lastShotTargetId:s.lastShotTargetId,lastShotDamage:s.lastShotDamage,lastShotDistance:s.lastShotDistance,lastShotVisible:s.lastShotVisible,lastShotAimError:s.lastShotAimError,lastShotPitchError:s.lastShotPitchError,maxRange:s.maxRange,strength:s.strength}))});
   renderer.canvas.dataset.missiles=JSON.stringify({active:pool?.active??0,hits:pool?.hits??0,collisions:pool?.collisions??0,expired:pool?.expired??0,offMap:pool?.offMap??0,lostTargets:pool?.lostTargets??0,orphaned:pool?.orphaned??0,completedAtLastPosition:pool?.completedAtLastPosition??0,missed:pool?.missed??0,stallDiscards:pool?.stallDiscards??0,free:pool?.freeCount()??0,coverage:enemies.states.map(s=>({id:s.id,health:s.health.current,incomingDamage:pool?.incomingDamage(s)??0})),thrustInstances:missiles.thrust?.instanceCount??0,thrustLights:missiles.thrust?.lightCount??0,launchers:missiles.states.map(s=>({id:s.id,variant:s.variant,maxRange:s.maxRange,baseStrength:s.baseStrength,strengthIncrease:s.strengthIncrease,strength:s.strength,launchGap:s.rule.gap,capacity:s.capacity,ammo:s.ammo,reloading:s.reloading,reloadRemaining:Math.max(0,s.reloadUntil-s.cycle.time),reloads:s.reloads,poolDeferrals:s.poolDeferrals,thinkCount:s.thinkCount??0,targetId:s.target?.id??null,targetDistance:s.targetDistance,shots:s.cycle.shots,lastShotAt:s.lastShotAt,lastShotTargetId:s.lastShotTargetId,lastShotDistance:s.lastShotDistance,hits:s.hits,lastHitTargetId:s.lastHitTargetId,lastHitDamage:s.lastHitDamage})),flights:pool?.slots.filter(s=>s.phase>=2).map(s=>({id:s.id,phase:s.phase,age:s.age,strength:s.strength,targetLap:s.targetLap,targetId:s.target?.id??null,orphaned:s.orphaned,committed:s.committed,engineCutoff:s.engineCutoff,passedAim:s.passedAim,aimPoint:[s.aimX,s.aimY,s.aimZ],x:s.x,y:s.y,z:s.z,dx:s.dx,dy:s.dy,dz:s.dz,vx:s.vx,vy:s.vy,vz:s.vz}))??[]});


  }
 }catch(e){fail(e);}});
 scenes=new SceneLoader({
  load:(id,options)=>loadWorld(id,{...options,actors:actorsForPreview}),discard:disposeWorld,
  release:world=>{
   const zone=world.level.zone,id=world.level.id,level=profileFor(id)?.number;renderer.setPlasmaLinks(null);plasmaLinks?.dispose();plasmaLinks=null;plasmaConnections.length=0;renderer.setMissileThrust(null);firing?.dispose();firing=null;damage.reset();arcEffects?.reset();enemies?.dispose();enemies=null;wildlife?.dispose();wildlife=null;delete renderer.canvas.dataset.routes;delete renderer.canvas.dataset.wildlife;delete renderer.canvas.dataset.enemies;delete renderer.canvas.dataset.dogs;delete renderer.canvas.dataset.firing;delete renderer.canvas.dataset.damage;delete renderer.canvas.dataset.arcs;delete renderer.canvas.dataset.missiles;delete renderer.canvas.dataset.drones;delete renderer.canvas.dataset.enhancers;renderer.clearWorld();disposeWorld(world);
   lastUnload={zone,id,level,sceneBuffers:renderer.sceneBuffers.size,geometryBytes:renderer.bytes,assets:world.assetIds.length,rigs:world.rigs.size,actors:world.actors?.size??0,visibilityBytes:world.visibility?.byteLength??0,shotLights:effects.lightCount,shotInstances:effects.instanceCount,arcStrikes:arcEffects?.strikeCount??0,arcSparks:arcEffects?.sparkCount??0,arcBytes:renderer.arcBytes,arcLights:renderer.arcLightCount,plasmaBytes:renderer.plasmaBytes,plasmaLinks:renderer.plasmaLinks?.linkCount??0,missileThrustBytes:renderer.missileThrustBytes,missileThrustInstances:renderer.missileThrust?.instanceCount??0};reportLifecycle('unloaded');
   // Drain submitted work before replacement assets are fetched/allocated.
   return renderer.device.queue.onSubmittedWorkDone();
  },
  activate:world=>{enemyResets=0;const noncombat=isNonCombatPreview(world.level);renderer.setShotEffects(noncombat?null:effects);renderer.setDamageEffects(noncombat?null:damage);renderer.setWorld(world);enemies=new EnemyPreview(world,onPoseChange,onEnemyDeath);wildlife=new WildlifePreview(world,onPoseChange,wildlifeActorsForLevel(world.level));wildlife.setThreatSources(enemies.states);if(!noncombat)damage.setWorld(world,enemies.states);const hasArcs=world.level.placements.some(p=>p.model==='arc-spire');if(hasArcs)arcEffects??=new ArcEffects();renderer.setArcEffects(hasArcs?arcEffects:null);if(hasArcs)arcEffects.setWorld(world);firing=new DefencePreview(world,onPoseChange,Math.random,onShot,enemies.states.length?enemies.states:null,onHit,onArcShot,renderer.setActorVisible.bind(renderer),missileEffects);firing.drones.setWildlife(wildlife.states,wildlife.defences);renderer.setMissileThrust(firing.missiles.states.length?firing.missiles.thrust:null);plasmaConnections=createPlasmaLinks(world,firing.enhancers.states);if(plasmaConnections.length){plasmaLinks=new PlasmaLinks();plasmaLinks.setLinks(plasmaConnections);}renderer.setPlasmaLinks(plasmaLinks);applyLighting(world);loop.clock.elapsedSeconds=0;},
  onLoading:id=>{
   const profile=profileFor(id);loop.stop();readyControls(false);status.hidden=false;error.hidden=true;status.textContent=`Loading ${profile.name} · Level ${profile.number}…`;renderer.canvas.dataset.loading='true';delete renderer.canvas.dataset.zone;delete renderer.canvas.dataset.level;delete renderer.canvas.dataset.currentId;
   updateLevelControls('loading',id);reportLifecycle('loading');
  },
  onReady:id=>{
   inspectionSampler.reset();
   const profile=profileFor(id),world=scenes.world;document.title=world.level.name+' · Defender';document.getElementById('zone-label').textContent='ZONE '+profile.zone+' · '+profile.name.toUpperCase();document.getElementById('level-title').textContent=world.level.name;document.getElementById('level-description').textContent=profile.description;
   document.getElementById('study-label').textContent=(world.level.previewMode==='landscape'?'LANDSCAPE / ':world.level.previewMode==='layout'?'PATH LAYOUT / ':'LEVEL STUDY / ')+String(profile.number).padStart(2,'0');
   updateLevelControls('ready',id);renderer.canvas.dataset.zone=profile.zone;renderer.canvas.dataset.level=String(profile.number);renderer.canvas.dataset.currentId=id;renderer.canvas.dataset.loading='false';
   renderer.canvas.dataset.routes=JSON.stringify(levelRoutes(world.level).filter(route=>route.path.length).map(route=>({id:route.id,boxes:route.path.length,actors:enemies.states.filter(state=>state.routeId===route.id).map(state=>state.id)})));
   const url=new URL(location.href);url.searchParams.set('level',id);history.replaceState(null,'',url);
   readyControls(true);status.hidden=true;reportLifecycle('ready');if(!document.hidden&&!renderer.failed)loop.start();
  },
  onError:(e,id)=>{const profile=profileFor(id);readyControls(false);renderer.canvas.dataset.loading='false';status.hidden=true;error.hidden=false;error.textContent=`Could not load ${profile.name} · Level ${profile.number}: ${e.message}\nChoose the level again or press Shift+${profile.number} to retry. Press 1–4 to change zone.`;updateLevelControls('error',id);reportLifecycle('error');},
 });
 // Getters follow the active scene and never retain an unloaded world or rig.
 Object.defineProperty(window,'defenderPreview',{value:{renderer,get world(){return scenes.world;},get firing(){return firing;},get enemies(){return enemies;},get wildlife(){return wildlife;},get dogs(){return scenes.currentId==='moss-01'?enemies:null;},get stats(){return {frames:renderer.frames,zone:scenes.world?.level.zone,level:profileFor(scenes.currentId)?.number??null,currentId:scenes.currentId,requestedId:selection.profile.level,requestedZone:selection.profile.zone,requestedLevel:selection.profile.number,loading:scenes.loading,loads:scenes.loads,unloads:scenes.unloads,drawGroups:renderer.draws.length+(renderer.waterDraw?1:0),deltaSeconds:renderer.deltaSeconds,elapsedSeconds:renderer.elapsedSeconds,drawCalls:renderer.lastDrawCalls,quads:scenes.world?.quads,uniqueQuads:scenes.world?.uniqueQuads,geometryBytes:renderer.bytes,sceneBuffers:renderer.sceneBuffers.size,targetBytes:renderer.targetBytes,cpuSubmitMs:renderer.lastSubmitMs};}}});
 for(const button of zoneButtons)button.disabled=false;
 await scenes.switchTo(selection.profile.level);
}catch(e){scenes?.dispose();renderer?.dispose();fail(e);}
const resume=()=>{if(scenes?.world&&!scenes.loading&&!renderer?.failed&&!document.hidden)loop?.start();};
document.addEventListener('visibilitychange',()=>{if(document.hidden){loop?.stop();renderer?.camera.keys.clear();}else resume();});
window.addEventListener('pagehide',event=>{loop?.stop();renderer?.camera.keys.clear();if(!event.persisted){scenes?.dispose();scenes?.barrier.catch(()=>{});renderer?.dispose();}});
window.addEventListener('pageshow',event=>{if(event.persisted)resume();});
