import {checkVistaEdges} from './vista-edge-check.js';
import {LevelConditions,applyPlayLighting} from '../play/conditions.js';
import {WorldRenderer} from '../engine/renderer.js';
import {levelLighting} from '../engine/environment.js';
import {loadPlayWorld,disposePlayWorld} from '../play/engine.js';
import {PLAY_CONFIG,playCapacity} from '../play/config.js';
import {GPUFrameTimer} from '../engine/gpu-frame-timer.js';
const $=id=>document.getElementById(id),errors=[],r=new WorldRenderer($('world'),e=>{errors.push(String(e));report();},{modelLightCapacity:playCapacity(PLAY_CONFIG).modelLights,gpuTiming:true}),checks=[];
r.inspect=true;let world,night=false,busy=false,brighterSun=true,benchmark=null,edgeCheck=null,shortNightShadows=true;
function report(){const data={benchmark,edgeCheck,level:world?.level.id,conditions:world?.playConditions,lighting:{shortNightShadows,brighterSun,direction:Array.from(r.frameData.subarray(52,55)),sunIntensity:r.frameData[55],sunRGB:Array.from(r.frameData.subarray(56,59)),ambientIntensity:r.frameData[59],ambientRGB:Array.from(r.frameData.subarray(60,63))},errors,checks,inspection:JSON.parse($('world').dataset.inspection??'{}')};$('report').textContent=JSON.stringify(data);$('report').dataset.result=JSON.stringify(data);}
async function draw(){r.render(0,0);await r.device.queue.onSubmittedWorkDone();report();}
async function load(){r.clearWorld();await r.device.queue.onSubmittedWorkDone();disposePlayWorld(world);const selected=PLAY_CONFIG.levels.find(level=>level.id===$('level').value);world=await loadPlayWorld(selected.id,{config:PLAY_CONFIG,wave:selected.waves[0],placements:[],conditions:new LevelConditions().forLevel(selected.id)});r.setWorld(world);applyPlayLighting(r,world.playConditions);shortNightShadows=true;$('night-shadow').disabled=!world.playConditions.night;$('night-shadow').textContent='Short night shadows';$('night-shadow').setAttribute('aria-pressed','true');night=false;brighterSun=true;$('sun').disabled=world.playConditions.period!=='late-afternoon';$('sun').textContent='Brighter afternoon sun';$('sun').setAttribute('aria-pressed','true');await draw();$('status').textContent='Ready';}
function selectedZone(id){return PLAY_CONFIG.levels.find(level=>level.id===id).zone;}
function camera(high){const c=r.camera;c.mode='live';c.position.set([world.width*.82,high?210:110,-90]);c.yaw=Math.atan2(world.width*.32,-90-world.length*.5);c.pitch=high?.55:.25;c.fov=70;r.requestDraw();}
async function check(){if(busy)return;busy=true;checks.length=0;try{for(const id of PLAY_CONFIG.levels.map(level=>level.id)){
 $('level').value=id;await load();for(const mode of ['overview','high','low']){if(mode==='overview')r.camera.frame();else camera(mode==='high');await draw();if(!r.vista||r.vista.zone!==selectedZone(id))throw new Error('Missing biome vista: '+id);checks.push({id,mode,conditions:world.playConditions,vista:!!r.vista,bytes:r.vista?.geometryBytes??0,targets:r.vista?.targetBytes??0});}
 r.setLightingColors('#708ABA','#263754','#263754');await draw();checks.push({id,mode:'night',errors:errors.length});
 }$('level').value='moss-01';await load();$('status').textContent=errors.length?'GPU errors':checks.length+' GPU compositions passed';}catch(e){errors.push(String(e));$('status').textContent='Failed';}finally{busy=false;report();}}
// Diagnostic only: timestamp the actual vista pass in a separate replay,
// alongside full production-frame timestamps. Never changes runtime timings.
async function benchmarkA(){
 if(busy)return;busy=true;benchmark={status:'running',views:[],method:'350 ms warmup followed by 30 asynchronous timestamp samples per view; isolated vista replay plus full production frames; stationary world, tiny camera yaw sweep'};
 const summary=values=>{const sorted=values.slice().sort((a,b)=>a-b);return {samples:sorted.length,median:sorted[Math.floor(sorted.length*.5)]??null,p90:sorted[Math.floor(sorted.length*.9)]??null};};
 try{
  for(const mode of ['overview','high','low']){
   if(mode==='overview')r.camera.frame();else camera(mode==='high');const baseYaw=r.camera.yaw,timer=new GPUFrameTimer(r.device),vista=[],whole=[],started=performance.now();let lastVista=0,lastFrame=0;
   r.gpuTimer?.reset();
   await new Promise((resolve,reject)=>{let frames=0;const tick=()=>{try{
    r.camera.yaw=baseYaw+Math.sin(frames*.025)*.015;r.requestDraw();r.render(0,0);
    if(timer.supported){const encoder=r.device.createCommandEncoder(),sample=timer.begin(encoder,r.vista.pass);if(sample){r.vista.render(timer.renderEncoder(encoder,sample),r.cameraGroup,true);timer.end(encoder,sample);r.device.queue.submit([encoder.finish()]);timer.submitted(sample);}}
    if(timer.latestSequence!==lastVista){lastVista=timer.latestSequence;if(performance.now()-started>350)vista.push(timer.values[(timer.cursor-1+timer.values.length)%timer.values.length]);}
    const full=r.gpuTimer;if(full?.latestSequence!==lastFrame){lastFrame=full.latestSequence;if(performance.now()-started>350&&full.count)whole.push(full.values[(full.cursor-1+full.values.length)%full.values.length]);}
    frames++;if(vista.length>=30||performance.now()-started>6000){resolve();return;}requestAnimationFrame(tick);
   }catch(error){reject(error);}};requestAnimationFrame(tick);});
   benchmark.views.push({mode,vista:summary(vista),wholeFrame:summary(whole),supported:timer.supported,geometryBytes:r.vista.geometryBytes,targetBytes:r.vista.targetBytes,viewport:[r.canvas.width,r.canvas.height],vistaSize:[r.vista.width,r.vista.height]});timer.dispose();report();
  }
  benchmark.status='complete';r.camera.frame();await draw();$('status').textContent='Selected biome GPU measurements complete';
 }catch(error){errors.push(String(error));benchmark.status='failed';}finally{busy=false;report();}
}
$('night-shadow').onclick=async()=>{if(!world?.playConditions.night)return;shortNightShadows=!shortNightShadows;if(shortNightShadows)applyPlayLighting(r,world.playConditions);else{const sky=levelLighting(world.level.environment);r.setLighting({...sky,direction:world.level.environment.sky.direction,intensity:.65,ambientIntensity:.85});r.setLightingColors('#708ABA','#263754','#263754');}$('night-shadow').textContent=shortNightShadows?'Short night shadows':'Previous night shadows';$('night-shadow').setAttribute('aria-pressed',String(shortNightShadows));await draw();};
$('benchmark').onclick=benchmarkA;
$('edges').onclick=async()=>{if(busy)return;busy=true;try{edgeCheck=await checkVistaEdges(r);$('status').textContent='Five edge coverage checks passed';}catch(e){errors.push(String(e));$('status').textContent='Edge check failed';}finally{busy=false;report();}};
$('sun').onclick=async()=>{if(world?.playConditions.period!=='late-afternoon')return;brighterSun=!brighterSun;r.setLighting(levelLighting(world.level.environment));if(brighterSun)applyPlayLighting(r,world.playConditions);else r.setLightingColors('#FFD4A2','#C7C8B5');$('sun').textContent=brighterSun?'Brighter afternoon sun':'Previous afternoon sun';$('sun').setAttribute('aria-pressed',String(brighterSun));await draw();};
$('level').onchange=()=>load().catch(e=>errors.push(String(e)));$('overview').onclick=async()=>{r.camera.frame();await draw();};$('high').onclick=async()=>{camera(true);await draw();};$('low').onclick=async()=>{camera(false);await draw();};$('night').onclick=async()=>{night=!night;if(night)r.setLightingColors('#708ABA','#263754','#263754');else{r.setLighting(levelLighting(world.level.environment));applyPlayLighting(r,world.playConditions);}await draw();};$('check').onclick=check;
window.addEventListener('pagehide',()=>{r.dispose();disposePlayWorld(world);});
try{await r.init();await load();}catch(e){errors.push(String(e));$('status').textContent='Failed';report();}
