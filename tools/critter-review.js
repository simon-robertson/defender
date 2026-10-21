import {benchmarkBloodDecals} from './decal-benchmark.js';
import {checkBloodDecals} from './decal-check.js';
import {PLAY_CONFIG,playCapacity} from '../play/config.js';
import {loadPlayWorld,disposePlayWorld} from '../play/engine.js';
import {WildlifePreview} from '../game/wildlife-preview.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {WorldRenderer} from '../engine/renderer.js';
import {FrameLoop} from '../engine/clock.js';
import {CRITTER_GIB,CRITTER_FRAGMENTS,CRITTER_SPRAY,critterShockwaveImpulse,MAX_CRITTERS,MAX_DAMAGE_CUBES} from '../shared/damage-effects.js';
const $=id=>document.getElementById(id),errors=[];let renderer,world,wildlife,damage,target,ready=false,burst=false,elapsed=0,seed=123,mode='population',latestKilled=0,launchSpeed=null,targetImpulse=null;
const rng=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
const loop=new FrameLoop((dt,time)=>{if(!ready)return;elapsed+=dt;if(!burst)wildlife.advance(dt);damage.advance(dt);renderer.render(dt,elapsed);report();});
function fail(error){errors.push(error?.message??String(error));loop.stop();$('status').textContent=errors.at(-1);report();}
function report(){if(!world)return;const states=[...wildlife.states,...wildlife.fish.states],r={level:world.level.id,mode,elapsed,ground:wildlife.states.filter(s=>s.kind==='ground').length,birds:wildlife.states.filter(s=>s.kind==='bird').length,fish:wildlife.fish.states.length,alive:states.filter(s=>!s.dead).length,latestKilled,enemyGibRadius:CRITTER_GIB.enemyRadius,missileGibRadius:CRITTER_GIB.missileRadius,blastDistance:Number($('distance').value),targetImpulse,launchSpeed,bursts:damage.critterBursts,fragmentsPerCritter:CRITTER_FRAGMENTS,sprayPerCritter:CRITTER_SPRAY,activeCubes:damage.activeCubes,renderedCubes:renderer.damageCubeCount,renderedDecals:renderer.damageDecalCount,decals:damage.cubes.filter(p=>p.active&&p.decal).length,fadeStarted:damage.critterFadeAt!==null,activeSpray:damage.cubes.filter(p=>p.active&&p.spray&&p.critter).length,dropped:damage.droppedCritterCubes,maxCritters:MAX_CRITTERS,maxDamageCubes:MAX_DAMAGE_CUBES,damageGPUBytes:renderer.damageBytes??0,errors};$('report').textContent=JSON.stringify(r,null,2);}
function render(){renderer.render(0,elapsed);report();}
function focus(){if(!target)return;const c=renderer.camera;c.mode='overview';c.target.set([target.x,target.y+2,target.z]);c.radius=35;c.pitch=.75;c.yaw=.8;renderer.requestDraw();render();}
async function load(){
 loop.stop();ready=false;$('status').textContent='Loading actual production wildlife…';
 try{
  wildlife?.dispose();damage?.reset();if(renderer){renderer.clearWorld();await renderer.device.queue.onSubmittedWorkDone();renderer.dispose();}disposePlayWorld(world);world=null;
  renderer=new WorldRenderer($('world'),fail,{modelLightCapacity:playCapacity(PLAY_CONFIG).modelLights,strictModelLights:true,gpuTiming:true});await renderer.init();
  const level=PLAY_CONFIG.levels.find(l=>l.id===$('level').value);world=await loadPlayWorld(level.id,{wave:level.waves[0]});renderer.setWorld(world);
  wildlife=new WildlifePreview(world,renderer.updateInstance.bind(renderer),undefined,renderer.setActorVisible.bind(renderer));damage=new DamageEffects(rng);damage.setWorld(world,[]);renderer.setDamageEffects(damage);
  target=wildlife.states.filter(s=>s.kind==='ground')[3];burst=false;seed=123;elapsed=0;mode='population';latestKilled=0;launchSpeed=targetImpulse=null;ready=true;focus();$('status').textContent='Production wildlife loaded · combat inactive.';loop.start();
 }catch(error){fail(error);}
}
function explode(all=false,snapshot=false){
 if(!ready)return;loop.stop();if(damage.critterBursts){damage.reset(true);wildlife.prepareCritterRun();}
 seed=123;burst=true;mode=all?'all-gib pool check':snapshot?'burst snapshot':'burst replay';
 const distance=Number($('distance').value);targetImpulse=all?null:critterShockwaveImpulse(distance,CRITTER_GIB.enemyRadius);
 latestKilled=all?wildlife.gibExplosion(0,0,0,10000,damage):wildlife.gibExplosion(target.x-distance,target.y+target.centerOffset,target.z,CRITTER_GIB.enemyRadius,damage);
 let minimum=Infinity,maximum=0;for(const p of damage.cubes)if(p.active&&p.critter){const speed=Math.hypot(p.vx,p.vy,p.vz);minimum=Math.min(minimum,speed);maximum=Math.max(maximum,speed);}launchSpeed={minimum,maximum};
 focus();
 if(snapshot){for(let i=0;i<14;i++)damage.advance(.01);elapsed+=.14;render();}else loop.start();
 $('status').textContent=`${latestKilled} critters gibbed · 48 pieces each · ${mode}`;
}
for(const [i,level]of PLAY_CONFIG.levels.entries()){const option=document.createElement('option');option.value=level.id;option.textContent=level.zone+(i%4+1);$('level').append(option);}
$('load').onclick=load;$('focus').onclick=focus;$('overview').onclick=()=>{renderer.camera.frame();render();};$('burst').onclick=()=>explode(false,true);$('replay').onclick=()=>explode();$('all').onclick=()=>explode(true,true);
function bloodFocus(near=false){loop.stop();const marks=damage.cubes.filter(p=>p.active&&p.decal);let p=null,best=-1;for(const a of marks){let score=0;for(const b of marks)if(a.nx===b.nx&&a.ny===b.ny&&a.nz===b.nz&&Math.abs((a.x-b.x)*a.nx+(a.y-b.y)*a.ny+(a.z-b.z)*a.nz)<.001&&Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<a.sx+b.sx+a.sz+b.sz)score++;if(score>best){p=a;best=score;}}if(!p){$('status').textContent='No blood impacts yet';return;}const c=renderer.camera;c.mode='live';c.fov=55;const d=near?3:12,h=near?.3:4;if(p.ny){const side=near?1.5:10,height=near?3:18;c.position.set([p.x+side,p.y+p.ny*height,p.z+side]);c.yaw=Math.PI/4;c.pitch=p.ny*Math.atan2(height,Math.SQRT2*side);}else{c.position.set([p.x+p.nx*d,p.y+h,p.z+p.nz*d]);c.yaw=Math.atan2(p.nx,p.nz);c.pitch=Math.atan2(h,d);}renderer.requestDraw();render();}
$('blood').onclick=()=>bloodFocus();$('blood-near').onclick=()=>bloodFocus(true);
$('settle').onclick=()=>{loop.stop();for(let i=0;i<600;i++)damage.advance(.01);elapsed+=6;mode='settled, awaiting preparation';render();};
$('half-fade').onclick=()=>{loop.stop();damage.endCritterRun();for(let i=0;i<100;i++)damage.advance(.01);elapsed+=1;mode='preparation fade halfway';render();};
$('fade').onclick=()=>{loop.stop();damage.endCritterRun();for(let i=0;i<201;i++)damage.advance(.01);elapsed+=2.01;mode='faded';render();$('status').textContent='Run-end fade complete.';};
$('decal-benchmark').onclick=async()=>{loop.stop();try{const r=await benchmarkBloodDecals(renderer);$('decal-result').textContent=JSON.stringify(r,null,2);$('decal-status').textContent=r.status==='complete'?`GPU cost: ${r.medianDifferenceMs.toFixed(3)} ms median difference`:r.status;}catch(error){$('decal-result').textContent=JSON.stringify({error:error.message},null,2);}};
$('decal-check').onclick=async()=>{loop.stop();try{const r=await checkBloodDecals(renderer);$('decal-result').textContent=JSON.stringify(r,null,2);$('decal-status').textContent=r.passed?`GPU decals: ${r.results.length} checks passed`:'GPU decal checks failed';}catch(error){$('decal-result').textContent=JSON.stringify({passed:false,error:error.message},null,2);}};
$('stop').onclick=()=>{loop.stop();report();};$('run').onclick=()=>loop.start();
window.addEventListener('resize',()=>{if(ready){renderer.requestDraw();render();}});window.addEventListener('pagehide',()=>{loop.stop();wildlife?.dispose();damage?.reset();renderer?.dispose();disposePlayWorld(world);});
await load();
