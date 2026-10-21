import {WorldRenderer} from '../engine/renderer.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {PLAY_CONFIG,playCapacity} from '../play/config.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine} from '../play/engine.js';
import {CRITTER_GIB} from '../shared/damage-effects.js';
const $=id=>document.getElementById(id),runs=[],errors=[];let r,world,e,busy=false;
function report(){ $('result').textContent=JSON.stringify({runs,errors},null,2);}
async function run(prepared){if(busy)return;busy=true;$('status').textContent='Measuring…';try{
 e?.dispose();r?.dispose();disposePlayWorld(world);e=r=world=null;
 r=new WorldRenderer($('world'),message=>errors.push(String(message)),{modelLightCapacity:playCapacity(PLAY_CONFIG).modelLights});r.inspect=true;await r.init();
 const allocations={pipelines:[],asyncPipelines:[],buffers:[],textures:[],modules:[]},d=r.device;
 for(const [method,key]of [['createRenderPipeline','pipelines'],['createRenderPipelineAsync','asyncPipelines'],['createBuffer','buffers'],['createTexture','textures'],['createShaderModule','modules']]){const original=d[method].bind(d);d[method]=descriptor=>{allocations[key].push({label:descriptor.label??'',size:descriptor.size??null});return original(descriptor);};}
 const setupStart=performance.now();if(prepared){if(!r.prepareDeathEffects)throw new Error('Prepared effect path not implemented');await r.prepareDeathEffects();}
 const setupMs=performance.now()-setupStart,wave=PLAY_CONFIG.levels[0].waves[0];
 world=await loadPlayWorld('moss-01',{config:PLAY_CONFIG,wave,placements:[]});r.setWorld(world);const damage=new DamageEffects(()=>.5);r.setDamageEffects(damage);
 e=new PlayEngine(world,{config:PLAY_CONFIG,wave,onPoseChange:(...args)=>r.updateInstance(...args),onVisible:(...args)=>r.setActorVisible(...args),onStep:dt=>damage.advance(dt),onDeath:(_id,state)=>{const b=damage.explode(state);if(b){e.wildlife.gibExplosion(b.x,b.y,b.z,CRITTER_GIB.enemyRadius,damage);e.wildlife.spookExplosion(b.x,b.y,b.z,b.config.frightRadius);}}});damage.setWorld(world,e.enemies.states);e.startWave();
 for(let f=0;f<5;f++){r.render(0,e.time);await d.queue.onSubmittedWorkDone();await new Promise(requestAnimationFrame);}
 const deaths=[];
 for(let death=0;death<3;death++){
  while(!e.enemies.activeTargets.length&&e.running)e.advance(1/60);const target=e.enemies.activeTargets[0];if(!target)break;
  r.render(0,e.time);await d.queue.onSubmittedWorkDone();const before=Object.fromEntries(Object.entries(allocations).map(([k,v])=>[k,v.length]));
  const frames=[];let effectMs=0;
  for(let offset=0;offset<5;offset++){
   const frameBefore=Object.fromEntries(Object.entries(allocations).map(([k,v])=>[k,v.length])),rafBefore=await new Promise(requestAnimationFrame),started=performance.now();
   if(!offset){e.enemies.takeHit(target,1e9);effectMs=performance.now()-started;}else e.advance(1/60);
   const renderStart=performance.now();r.render(0,e.time);const cpuRenderMs=performance.now()-renderStart;await d.queue.onSubmittedWorkDone();const completionMs=performance.now()-started,rafAfter=await new Promise(requestAnimationFrame);
   frames.push({offset,cpuRenderMs,completionMs,nextRafGapMs:rafAfter-rafBefore,shockwaves:damage.shockwaveCount,created:Object.fromEntries(Object.entries(allocations).map(([k,v])=>[k,v.slice(frameBefore[k])]))});
  }
  deaths.push({death:death+1,effectMs,frames,created:Object.fromEntries(Object.entries(allocations).map(([k,v])=>[k,v.slice(before[k])])),activeCubes:damage.cubeCount,decals:damage.decalCount});
  for(let f=0;f<120;f++)e.advance(1/60);r.render(0,e.time);await d.queue.onSubmittedWorkDone();
 }
 runs.push({prepared,setupMs,viewport:[$('world').width,$('world').height],deaths,resources:{damageBytes:r.damageBytes,shockwaveBytes:r.shockwaveBytes,shockwaveTargetBytes:r.shockwaveTargetBytes},note:'Fresh renderer/device; actual A1 enemy takeHit/death callback and production effects, no defences/camera director. Wall completion includes queued GPU work; driver caches may persist across devices. No browser-wide/FPS guarantee.'});$('status').textContent='Complete';
 }catch(error){errors.push(String(error));$('status').textContent='Failed';}finally{busy=false;report();}}
$('compare').onclick=async()=>{if(busy)return;for(const prepared of [false,true,true,false,false,true])await run(prepared);};
$('cold').onclick=()=>run(false);$('warm').onclick=()=>run(true);window.addEventListener('pagehide',()=>{e?.dispose();r?.dispose();disposePlayWorld(world);});report();
