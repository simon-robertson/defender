import {BOX_SIZE} from '/shared/grid.js';
import {DRONE_MODEL,DRONE_ROTORS} from '/shared/drone-model.js';
import {DRONE_TUNING} from '/shared/drone.js';
import {validateModel,VARIANTS} from '/shared/model.js';
import {meshPart,meshQuads} from '/shared/mesher.js';
import {identity,translation} from '/shared/math.js';
import {modelForZone} from '/shared/zone-style.js';
import {defaultWaterMaterial} from '/shared/water.js';
import {WorldRenderer} from '/engine/renderer.js';
import {disposeWorld} from '/engine/world.js';
import {PoseRig} from '/engine/rig.js';
import {FrameLoop} from '/engine/clock.js';

// In-memory model inspection only. No flight controller, combat or saved level.
const $=id=>document.getElementById(id),canvas=$('scene'),controls=['variant','zone','pose','animate','night','reset','yaw','pitch'];
const baseTuning=DRONE_TUNING.base;
$('base-flight').textContent=`${baseTuning.flightSeconds}s flight from launch · return flight excluded`;
$('base-weapon').textContent=`${baseTuning.weapon.strength} strength/round · ${baseTuning.weapon.roundsPerSecond} rounds/s · ${baseTuning.weapon.shotsPerBurst}-round bursts · ${baseTuning.weapon.cooldownSeconds}s weapon cooldown`;
$('tuning-note').textContent=`Base timing: ${baseTuning.flightSeconds}s flight, ${baseTuning.rechargeSeconds}s pad recharge and ${baseTuning.weapon.cooldownSeconds}s weapon cooldown. On flight expiry, finish the active burst and return. This page only inspects the models; try A1 for combat.`;
const width=8*BOX_SIZE,length=6*BOX_SIZE,viewYaw=2.45,hoverLift=12,radians=Math.PI/180;
$('yaw').min=Math.round(DRONE_MODEL.gunYawMin/radians);$('yaw').max=Math.round(DRONE_MODEL.gunYawMax/radians);
$('pitch').min=Math.round(DRONE_MODEL.gunPitchMin/radians);$('pitch').max=Math.round(DRONE_MODEL.gunPitchMax/radians);
const floorMaterials=[{color:'#A5A49A',emission:0,reflectiveness:0}];
const floorMesh=meshQuads([{origin:[0,0,0],axis:1,sign:1,width:length,height:width,material:0}],floorMaterials);
const emptyWater=meshQuads([],floorMaterials),meshes=new Map(),bounds=new Map(),stats=new Map(),motion=new Map();
const environment={timeOfDay:12,sky:{direction:[-.65,1,-.45],color:'#FFF8EB',intensity:.88,ambient:'#C9CFCB',ambientIntensity:.48}};
const controller=new AbortController(),gpuErrors=[];
// Stable pose values: docked means pad hover; hover means elevated flight inspection.
let model=null,styledModel=null,cachedZone=null,world=null,ready=false,disposed=false,transitioning=false,night=false,selection='all',zone='A',poseMode='docked',animating=false;
// Illustrative review motor speed/spool; these are not flight/RPM tuning.
const reviewMotorSpeed=28,reviewMotorSpoolSeconds=.6;
let motorSpeed=0,rotorPhase=0,motionTime=0,inspectionTime=0,sceneRevision=0,loop;

function fail(message){
 if(disposed)return;
 ready=false;loop?.stop();controller.abort();
 $('error').textContent=String(message);$('review-status').textContent='Preview unavailable';
 for(const id of controls)$(id).disabled=true;
 $('review-diagnostics').textContent=JSON.stringify({ready:false,error:String(message),gpuErrors});
 dispose();
}
const renderer=new WorldRenderer(canvas,fail);
function wake(){if(ready&&world&&!transitioning&&!disposed&&!document.hidden)loop.start();}
const invalidate=renderer.requestDraw.bind(renderer);
renderer.requestDraw=()=>{invalidate();wake();};
loop=new FrameLoop((deltaSeconds,elapsedSeconds)=>{
 try{
  const motorTarget=reviewMotorSpeed;
  const previousMotorSpeed=motorSpeed,motorAcceleration=reviewMotorSpeed/reviewMotorSpoolSeconds;
  const motorStep=motorAcceleration*deltaSeconds;
  motorSpeed=motorSpeed<motorTarget?Math.min(motorTarget,motorSpeed+motorStep):Math.max(motorTarget,motorSpeed-motorStep);
  const rampSeconds=Math.min(deltaSeconds,Math.abs(motorTarget-previousMotorSpeed)/motorAcceleration);
  const motorAngle=(previousMotorSpeed+motorSpeed)*.5*rampSeconds+motorTarget*(deltaSeconds-rampSeconds);
  rotorPhase=(rotorPhase+motorAngle)%(2*Math.PI);
  if(animating&&poseMode==='hover')motionTime+=deltaSeconds;
  updatePose();
  renderer.render(deltaSeconds,elapsedSeconds);
  inspectionTime+=loop.clock.unscaledDeltaSeconds;
  if(inspectionTime>=.1){inspect();inspectionTime=0;}
 }catch(error){fail(error.message);}
});

function selectedVariants(){return selection==='all'?VARIANTS:[selection];}
function origin(index,count){
 const offset=count===1?0:(index-1)*44;
 return [width/2+offset*Math.cos(viewYaw)-BOX_SIZE/2,0,length/2-offset*Math.sin(viewYaw)-BOX_SIZE/2];
}
function cachePalette(){
 meshes.clear();bounds.clear();stats.clear();styledModel=modelForZone(model,zone);cachedZone=zone;
 for(const variant of VARIANTS){
  const parts=styledModel.variants[variant].parts,items=[],extent=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  let cells=0,quads=0;
  for(const part of parts){
   const mesh=meshPart(styledModel,part);items.push({key:`drone-defence:${variant}:${part.id}`,part:part.id,mesh});cells+=part.voxels.length;quads+=mesh.quads.length;
   for(let i=0;i<mesh.vertices.length;i+=11)for(let axis=0;axis<3;axis++){
    extent[axis]=Math.min(extent[axis],mesh.vertices[i+axis]);extent[axis+3]=Math.max(extent[axis+3],mesh.vertices[i+axis]);
   }
  }
  if(!cells)throw new Error(`Drone ${variant} has no geometry.`);
  meshes.set(variant,items);bounds.set(variant,extent);stats.set(variant,{parts:parts.length,cells,quads,bindBounds:extent});
  $(variant+'-stats').textContent=`${extent[3]-extent[0]} × ${extent[5]-extent[2]} footprint · ${extent[4]-extent[1]} units tall in pad hover · ${parts.length} parts`;
 }
 const swatches=styledModel.materials.map(material=>{const swatch=document.createElement('span');swatch.style.backgroundColor=material.color;swatch.title=material.name;return swatch;});
 $('palette').replaceChildren(...swatches);
}
function buildReviewWorld(){
 const variants=selectedVariants(),entries=[{key:'review-floor',mesh:floorMesh,transforms:[identity()]}],rigs=new Map();
 for(const [index,variant]of variants.entries()){
  const root=translation(...origin(index,variants.length)),instances=[];
  for(const item of meshes.get(variant)){
   const matrix=new Float32Array(root);entries.push({key:item.key,mesh:item.mesh,transforms:[matrix]});
   instances.push({key:item.key,part:item.part,index:0,matrix});
  }
  const rig=new PoseRig({root,parts:styledModel.variants[variant].parts,instances},(key,index,matrix)=>renderer.updateInstance(key,index,matrix));
  motion.set(variant,rig);rigs.set(variant,rig);
 }
 const level={size:[width/BOX_SIZE,length/BOX_SIZE],path:[],terrain:{defaultHeight:0,boxes:[]},environment};
 return {level,entries,actors:new Map(),rigs,assetIds:['drone-defence'],
  width,length,water:{key:'water',mesh:emptyWater,transforms:[identity()]},waterMaterial:defaultWaterMaterial()};
}
function updatePose(){
 const hovering=poseMode==='hover',yaw=hovering?(animating?Math.sin(motionTime*.65)*12:Number($('yaw').value)):0;
 const pitch=hovering?(animating?-12+Math.sin(motionTime*.8)*8:Number($('pitch').value)):0;
 // Illustrative forward/side acceleration and yaw torque. The level chassis
 // turns while opposing fan pairs vector thrust in opposite directions.
 const heading=hovering?Math.sin(motionTime*.42)*.3:0;
 const yawEffort=hovering?-Math.sin(motionTime*.42)*12*radians:0;
 const collectivePitch=hovering?Math.sin(motionTime*.35)*8*radians:0;
 const collectiveRoll=hovering?Math.sin(motionTime*.28)*4*radians:0;
 for(const rig of motion.values()){
  rig.setTranslation(DRONE_MODEL.body,0,hovering?hoverLift:0,0);
  rig.setRotation(DRONE_MODEL.body,0,heading,0);
  for(const rotor of DRONE_ROTORS){
   const dx=rotor.pivot[0]-DRONE_MODEL.bodyPivot[0],dz=rotor.pivot[2]-DRONE_MODEL.bodyPivot[2],radius=Math.hypot(dx,dz);
   let fanPitch=collectivePitch-dx/radius*yawEffort,fanRoll=collectiveRoll-dz/radius*yawEffort;
   const magnitude=Math.hypot(fanPitch,fanRoll),scale=magnitude>DRONE_MODEL.fanTiltMax?DRONE_MODEL.fanTiltMax/magnitude:1;
   fanPitch*=scale;fanRoll*=scale;
   rig.setRotation(rotor.gimbal,fanPitch,0,fanRoll);
   rig.setRotation(rotor.id,0,rotorPhase*rotor.spin,0);
  }
  rig.setRotation(DRONE_MODEL.gunYaw,0,yaw*radians,0);rig.setRotation(DRONE_MODEL.gunPitch,pitch*radians,0,0);rig.update();
 }
 $('yaw-value').textContent=Math.round(yaw)+'°';$('pitch-value').textContent=Math.round(pitch)+'°';
}
function syncPoseControls(){
 const manual=ready&&!transitioning&&poseMode==='hover'&&!animating;
 $('yaw').disabled=$('pitch').disabled=!manual;
 $('animate').disabled=!ready||transitioning||poseMode!=='hover';
 $('animate').textContent=animating?'Pause flight / aim':'Animate flight / aim';$('animate').setAttribute('aria-pressed',String(animating));
}
function applyLighting(){
 const sky=environment.sky;
 renderer.setLightingColors(night?'#708ABA':sky.color,night?'#263754':sky.ambient,night?'#263754':'#848B83');
 $('night').textContent=night?'Day':'Night';$('night').setAttribute('aria-pressed',String(night));renderer.requestDraw();
}
async function showModels(recolour=false){
 const revision=++sceneRevision;transitioning=true;loop.stop();motion.clear();
 renderer.clearWorld();disposeWorld(world);world=null;
 // Release old GPU/CPU scene ownership before allocating the replacement.
 await renderer.device.queue.onSubmittedWorkDone();
 if(disposed||revision!==sceneRevision||!ready)return;
 if(recolour||cachedZone!==zone||!meshes.size)cachePalette();
 world=buildReviewWorld();renderer.setWorld(world);updatePose();transitioning=false;
 for(const card of document.querySelectorAll('[data-variant]'))card.hidden=selection!=='all'&&card.dataset.variant!==selection;
 document.querySelector('.variants').style.gridTemplateColumns=selection==='all'?'repeat(3,1fr)':'1fr';
 syncPoseControls();applyLighting();reset();wake();
}
function reset(){
 const camera=renderer.camera;camera.yaw=viewYaw;camera.pitch=.4;camera.mode='overview';camera.keys.clear();camera.dragging=false;
 const sy=Math.sin(camera.yaw),cy=Math.cos(camera.yaw),sp=Math.sin(camera.pitch),cp=Math.cos(camera.pitch);
 const right=[cy,0,-sy],up=[-sy*sp,cp,-cy*sp],center=[width/2,0,length/2];
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 const variants=selectedVariants();
 for(const [index,variant]of variants.entries()){
  const extent=bounds.get(variant),at=origin(index,variants.length),top=extent[4]+(poseMode==='hover'?hoverLift:0);
  for(const x0 of [extent[0]-2,extent[3]+2])for(const y of [0,top])for(const z0 of [extent[2]-2,extent[5]+2]){
   const x=x0+at[0]-center[0],z=z0+at[2]-center[2],px=x*right[0]+z*right[2],py=x*up[0]+y*up[1]+z*up[2];
   minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
  }
 }
 minY-=5;const cx=(minX+maxX)/2,cyView=(minY+maxY)/2,aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);
 camera.target.set([center[0]+right[0]*cx+up[0]*cyView,up[1]*cyView,center[2]+right[2]*cx+up[2]*cyView]);
 camera.radius=Math.max(18,(maxY-minY)*.58,(maxX-minX)*.58/Math.max(.1,aspect));renderer.requestDraw();
}
function inspect(){
 if(!ready||!world)return;
 const lights=renderer.modelLights,parts={};
 for(const [variant,rig]of motion){
  parts[variant]={};for(const bone of rig.bones)parts[variant][bone.part.id]={parent:bone.part.parent,rotation:Array.from(bone.rotation),translation:Array.from(bone.translation),matrix:Array.from(bone.instance.matrix)};
 }
 $('review-diagnostics').textContent=JSON.stringify({ready:true,error:null,gpuErrors,model:model.id,selection,zone,night,pose:poseMode,poseLabel:poseMode==='hover'?'Flight inspection':'Pad hover',animating,reviewOnly:true,restingGap:DRONE_MODEL.restGap,
  approvedTuning:DRONE_TUNING,motionTime,motorSpeed,rotorPhase,rotorPhases:Object.fromEntries(DRONE_ROTORS.map(rotor=>[rotor.id,rotorPhase*rotor.spin])),fanTiltLimit:DRONE_MODEL.fanTiltMax,fanTiltUnits:'radians; combined pitch/roll vector',flightPresentation:'level body with collective and differential yaw-steering fan tilt',motorTarget:reviewMotorSpeed,motorSpeedUnits:'illustrative radians/second',hoverLift:poseMode==='hover'?hoverLift:0,variants:Object.fromEntries(stats),parts,
  accentMaterials:styledModel.materials.filter(m=>m.emission>0).map(m=>({name:m.name,color:m.color,emission:m.emission,castsLight:m.castsLight})),
  modelLights:lights?.count??0,authoredModelLights:lights?.authoredCount??0,modelLightOverflow:lights?.overflow??0,
  bloomActive:renderer.bloom?.active??false,bloomBytes:renderer.bloom?.bytes??0,sceneBuffers:renderer.sceneBuffers.size,
  createdSceneBuffers:renderer.createdSceneBuffers,destroyedSceneBuffers:renderer.destroyedSceneBuffers,geometryBytes:renderer.bytes,
  transformBytes:renderer.transformBytes,transformUploads:renderer.lastTransformUploads,transformUploadBytes:renderer.lastTransformUploadBytes,
  drawGroups:renderer.draws.length,frames:renderer.frames,loopRunning:loop.running,camera:{yaw:renderer.camera.yaw,pitch:renderer.camera.pitch,radius:renderer.camera.radius},combatActors:0});
 $('review-status').textContent=lights?.overflow?`${lights.count} lights · ${lights.overflow} exceed capacity`:`Ready · ${lights?.count??0} panel lights · ${poseMode==='hover'?'Flight inspection':'Pad hover'}`;
}
function runRebuild(recolour){showModels(recolour).catch(error=>{if(!disposed)fail(error.message);});}
$('variant').addEventListener('change',event=>{if(ready){selection=event.target.value;runRebuild(false);}});
$('zone').addEventListener('change',event=>{if(ready){zone=event.target.value;runRebuild(true);}});
$('pose').addEventListener('change',event=>{
 if(!ready||transitioning)return;poseMode=event.target.value;syncPoseControls();updatePose();reset();renderer.requestDraw();
});
$('animate').addEventListener('click',()=>{
 if(!ready||transitioning)return;
 if(animating&&poseMode==='hover'){const rig=motion.values().next().value;$('yaw').value=rig.byId.get(DRONE_MODEL.gunYaw).rotation[1]/radians;$('pitch').value=rig.byId.get(DRONE_MODEL.gunPitch).rotation[0]/radians;}
 animating=!animating;syncPoseControls();updatePose();renderer.requestDraw();
});
for(const id of ['yaw','pitch'])$(id).addEventListener('input',()=>{if(ready&&!transitioning){updatePose();renderer.requestDraw();}});
$('reset').addEventListener('click',()=>{if(ready&&!transitioning)reset();});
$('night').addEventListener('click',()=>{if(ready&&!transitioning){night=!night;applyLighting();}});
document.addEventListener('keydown',event=>{
 if(!ready||transitioning||event.key.toLowerCase()!=='n'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName))return;
 event.preventDefault();night=!night;applyLighting();
});
canvas.addEventListener('keydown',wake);
document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else renderer.requestDraw();});
function dispose(){
 if(disposed)return;disposed=true;ready=false;sceneRevision++;loop.stop();controller.abort();renderer.dispose();disposeWorld(world);
 world=null;model=null;styledModel=null;motion.clear();meshes.clear();bounds.clear();stats.clear();
}
window.addEventListener('pagehide',event=>{loop.stop();if(!event.persisted)dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted&&ready)renderer.requestDraw();});
try{
 const response=await fetch('/api/models/drone-defence',{cache:'no-store',signal:controller.signal});
 if(!response.ok)throw new Error('Unable to load the drone defence model source.');
 model=validateModel((await response.json()).asset);if(disposed)throw new Error('Review closed.');await renderer.init();
 renderer.device.addEventListener('uncapturederror',event=>{gpuErrors.push(event.error.message);fail(event.error.message);});
 if(disposed){renderer.dispose();}else{
  ready=true;await showModels(true);if(!disposed){for(const id of controls)$(id).disabled=false;syncPoseControls();}
 }
}catch(error){if(!disposed)fail(error.message);}
