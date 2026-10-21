import {newLevel,defaultEnvironment} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {ENEMY_EXPANSION_MOVEMENT} from '../engine/enemy-expansion-gait.js';
import {WorldRenderer} from '../engine/renderer.js';
import {FrameLoop} from '../engine/clock.js';

const $=id=>document.getElementById(id),errors=[],r=new WorldRenderer($('world'),fail,{modelLightCapacity:8,strictModelLights:true});
let world,enemies,playing=true,overview=false,ready=false,disposed=false,loading=false;
function fail(error){playing=false;errors.push(String(error?.message??error));$('status').textContent='Preview unavailable: '+errors.at(-1);loop.stop();}
function camera(){
 if(overview){r.camera.frame();return;}
 const s=enemies.states[0],c=r.camera,dx=56,dz=66,dy=35;
 c.mode='live';c.position.set([s.aimX+dx,s.aimY+dy,s.aimZ+dz]);c.yaw=Math.atan2(dx,dz);c.pitch=Math.atan2(dy,Math.hypot(dx,dz));c.fov=50;
}
function draw(){
 if(!ready)return;
 const s=enemies.states[0];camera();r.requestDraw();r.render(0,enemies.time);
 const info={model:s.model,distance:s.distance,position:[s.x,s.y,s.z],bankDegrees:s.gait.bodyRoll*180/Math.PI,bodyRoll:s.rig.byId.get('body').rotation[2],velocity:[s.velocityX,s.velocityY,s.velocityZ],errors};
 $('world').dataset.review=JSON.stringify(info);$('phase').value=String(s.distance);$('status').textContent=`${s.model} · bank ${info.bankDegrees.toFixed(1)}° · ${playing?'playing at 0.65×':'paused'}${errors.length?' · '+errors.join(', '):''}`;
}
const loop=new FrameLoop(dt=>{try{if(playing&&ready){enemies.advance(dt*.65);draw();}}catch(error){fail(error);}});
function snapshot(distance){if(!ready)return;playing=false;loop.stop();$('pause').textContent='Play';enemies.states[0].seed=distance;enemies.time=enemies.completedLoops=0;enemies.reset();draw();}
async function load(){
 if(loading)return;loading=true;ready=false;loop.stop();
 try{
  if(world){r.clearWorld();await r.device.queue.onSubmittedWorkDone();enemies.dispose();disposeWorld(world);}
  const model=$('model').value,response=await fetch('/api/models/'+model,{cache:'no-store'});if(!response.ok)throw new Error('Unable to load '+model);
  const level=newLevel('flying-turn-study');level.environment=defaultEnvironment();level.size=[9,8];level.path=[[1,2],[2,2],[3,2],[4,2],[4,3],[4,4],[4,5],[5,5],[6,5],[7,5],[7,4],[7,3],[7,2]].map(([x,z])=>[x,0,z]);
  const actors=[{id:'flyer',model,variant:'base',distance:60}],movement={[model]:{...ENEMY_EXPANSION_MOVEMENT[model],altitude:44}};
  world=buildWorld(level,new Map([[model,(await response.json()).asset]]),{actors});r.setWorld(world);
  enemies=new EnemyPreview(world,r.updateInstance.bind(r),null,actors,{movement});$('phase').max=String(enemies.path.length-.001);ready=true;draw();if(playing)loop.start();
 }finally{loading=false;}
}
$('model').onchange=()=>load().catch(fail);$('pause').onclick=()=>{if(!ready)return;playing=!playing;$('pause').textContent=playing?'Pause':'Play';draw();if(playing)loop.start();else loop.stop();};
$('left').onclick=()=>snapshot(144);$('right').onclick=()=>snapshot(72);$('phase').oninput=()=>snapshot(Number($('phase').value));
$('view').onclick=()=>{overview=!overview;$('view').textContent=overview?'Follow':'Overview';draw();};
document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else if(!disposed&&playing)loop.start();});
window.addEventListener('resize',()=>draw());window.addEventListener('pagehide',()=>{disposed=true;ready=false;loop.stop();r.dispose();enemies?.dispose();disposeWorld(world);});
try{await r.init();await load();}catch(error){fail(error);}
