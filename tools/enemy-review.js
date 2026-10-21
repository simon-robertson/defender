import {BOX_SIZE} from '/shared/grid.js';
import {validateModel} from '/shared/model.js';
import {meshPart} from '/shared/mesher.js';
import {translation,identity} from '/shared/math.js';
import {Renderer} from '/tools/renderer.js';
import {PoseRig} from '/engine/rig.js';
import {PathMotion} from '/engine/path-motion.js';
import {ArticulatedGait,WALKER_WALK,SPIDER_WALK} from '/engine/articulated-gait.js';
import {DogGait,DOG_WALK} from '/engine/dog-gait.js';
import {EnemyExpansionGait,ENEMY_EXPANSION_MOVEMENT} from '/engine/enemy-expansion-gait.js';
import {ENEMY_STATS} from '/shared/enemy.js';
import {FrameLoop} from '/engine/clock.js';

// An isolated inspection of the production gait. Keep the body centred while
// sampling straight-path contacts; meshes and GPU instance slots stay cached.
const $=id=>document.getElementById(id),ids=["dog", "roller", "moth", "walker", "dune-tread", "twin-fan", "tripod", "ray", "spider", "lantern"],models=new Map(),meshes=new Map(),bounds=new Map(),viewYaw=-2.4;
const renderer=new Renderer($('scene'),fail);
const requested=new URLSearchParams(location.search).get('model'),motion=new Map();
const groups={all:['walker','spider'],'zone-A':['dog','roller','moth'],'zone-B':['walker','dune-tread','twin-fan'],'zone-C':['tripod','ray'],'zone-D':['spider','lantern']};
const names={"dog": "Dog", "roller": "Roller", "moth": "Moth", "walker": "Walker", "dune-tread": "Dune Tread", "twin-fan": "Twin Fan", "tripod": "Tripod", "ray": "Ray", "spider": "Spider", "lantern": "Lantern"};
let selection=ids.includes(requested)||groups[requested]?requested:'all',visibleIds=groups.all,elapsed=0,paused=false,dirty=true,walking=true,playbackSpeed=1,disposed=false;
const loop=new FrameLoop(delta=>{
 try{
 if(walking&&!paused){elapsed+=delta*playbackSpeed;pose();dirty=true;}
 if(dirty&&renderer.ready&&!renderer.failed){renderer.draw();dirty=false;}
 if(!walking||paused||renderer.failed)loop.stop();
 }catch(error){fail(error.message);}
});
// The review owns one clock, including camera/resize draws while paused.
renderer.requestDraw=()=>{dirty=true;if(renderer.ready&&!document.hidden&&!disposed)loop.start();};
function dispose(){
 disposed=true;loop.stop();
 for(const state of motion.values())state.gait.dispose();motion.clear();
 // This page owns the workshop renderer/device. Destroying the device releases
 // its cached mesh/instance/grid/uniform buffers and render targets together.
 renderer.ready=false;renderer.context?.unconfigure();renderer.device?.destroy();
 renderer.cache.clear();renderer.draws.length=0;
}
function fail(message){
 if(disposed)return;
 $('error').textContent=message;$('review-status').textContent='Preview unavailable';
 for(const control of document.querySelectorAll('.controls button,.controls select,.controls input'))control.disabled=true;
 dispose();
}
function pose(){
 for(const id of visibleIds){
  const state=motion.get(id);if(!state)continue;
  const {rig,gait,rule,path,sample}=state;
  if(walking){
   const distance=BOX_SIZE+(elapsed*rule.speed)%(path.length-2*BOX_SIZE);
   path.sample(distance,sample);rig.root[13]=-(rule.crouch??0)+(rule.groundOffset??0);
   gait.pose(distance,sample[0],sample[1],sample[2],null,elapsed);
  }else{
   rig.root[13]=0;
   for(const bone of rig.bones)rig.setRotation(bone.part.id,0,0,0);
  }
  rig.invalidateRoot();rig.update();
 }
 $('scene').dataset.motionTime=elapsed.toFixed(6);
}
function scene(){
 const selected=visibleIds,entries=[],grid=[];
 for(const [index,id]of selected.entries()){
  const offset=(index-(selected.length-1)*.5)*BOX_SIZE*1.65;
  const x=offset*Math.cos(viewYaw)-BOX_SIZE/2,z=-offset*Math.sin(viewYaw)-BOX_SIZE/2,state=motion.get(id);
  state.rig.root.set(translation(x,0,z));
  for(const item of meshes.get(id))entries.push({...item,transforms:[state.rig.byId.get(item.part).instance.matrix]});
  if($('footprint').checked){
   const corners=[[x,0,z],[x+BOX_SIZE,0,z],[x+BOX_SIZE,0,z+BOX_SIZE],[x,0,z+BOX_SIZE]],colour=[.28,.36,.29];
   for(let i=0;i<4;i++)grid.push(...corners[i],...colour,...corners[(i+1)%4],...colour);
  }
 }
 renderer.setScene(entries,new Float32Array(grid));pose();
}
function frame(){
 const selected=visibleIds;
 const aspect=Math.max(.1,$('scene').clientWidth/$('scene').clientHeight);
 const sy=Math.sin(renderer.yaw),cy=Math.cos(renderer.yaw),sp=Math.sin(renderer.pitch),cp=Math.cos(renderer.pitch);
 const right=[cy,0,-sy],up=[-sy*sp,cp,-cy*sp];
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const [index,id]of selected.entries()){
  const offset=(index-(selected.length-1)*.5)*BOX_SIZE*1.65,b=bounds.get(id);
  for(const x0 of [b[0],b[3]])for(const y of [b[1],b[4]])for(const z0 of [b[2],b[5]]){
   const x=x0+offset*Math.cos(viewYaw)-BOX_SIZE/2,z=z0-offset*Math.sin(viewYaw)-BOX_SIZE/2;
   const px=x*right[0]+z*right[2],py=x*up[0]+y*up[1]+z*up[2];
   minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
  }
 }
 const cx=(minX+maxX)*.5,cyView=(minY+maxY)*.5;
 renderer.frame([right[0]*cx+up[0]*cyView,up[1]*cyView,right[2]*cx+up[2]*cyView],Math.max(6,(maxY-minY)*.56,(maxX-minX)*.56/aspect));
}
function reset(){renderer.yaw=viewYaw;renderer.pitch=.38;frame();}
function select(){
 selection=$('selection').value;
 visibleIds=groups[selection]??[selection];
 for(const card of document.querySelectorAll('[data-model]'))card.hidden=!visibleIds.includes(card.dataset.model);
 document.querySelector('.models').style.gridTemplateColumns=`repeat(${visibleIds.length},1fr)`;
 $('title').textContent=visibleIds.map(id=>names[id]).join(' · ');scene();reset();
}
$('selection').onchange=select;
$('footprint').onchange=scene;
$('reset').onclick=reset;
$('front').onclick=()=>{renderer.yaw=Math.PI;renderer.pitch=.08;frame();};
$('side').onclick=()=>{renderer.yaw=-Math.PI/2;renderer.pitch=.15;frame();};
$('top').onclick=()=>{renderer.yaw=Math.PI;renderer.pitch=1.5;frame();};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Play':'Pause';loop.clock.resetDelta();renderer.requestDraw();};
$('step').onclick=()=>{paused=true;$('pause').textContent='Play';elapsed+=1/60;pose();renderer.requestDraw();};
$('motion').onchange=()=>{
 walking=$('motion').value==='walk';for(const id of ['pause','step','speed'])$(id).disabled=!walking;
 pose();loop.clock.resetDelta();renderer.requestDraw();
};
$('speed').onchange=()=>{playbackSpeed=Number($('speed').value);loop.clock.resetDelta();};
document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else renderer.requestDraw();});
window.addEventListener('pagehide',event=>{loop.stop();if(!event.persisted)dispose();});
window.addEventListener('pageshow',()=>renderer.requestDraw());
try{
 const loaded=await Promise.all(ids.map(async id=>{
  const response=await fetch('/api/models/'+id);if(!response.ok)throw new Error('Unable to load '+id+' source.');
  return validateModel((await response.json()).asset);
 }));
 if(disposed)throw new Error('Review closed.');
 for(const model of loaded){
  const parts=model.variants.base.parts,items=parts.map(part=>({key:model.id+':'+part.id,part:part.id,mesh:meshPart(model,part)}));
  models.set(model.id,model);meshes.set(model.id,items);
  const rule=ENEMY_EXPANSION_MOVEMENT[model.id]??(model.id==='dog'?DOG_WALK:model.id==='spider'?SPIDER_WALK:WALKER_WALK);
  const rig=new PoseRig({root:identity(),parts,instances:items.map(item=>({key:item.key,part:item.part,index:0,matrix:identity()}))},(key,index,matrix)=>{
   const gpu=renderer.cache.get(key);if(gpu)renderer.device.queue.writeBuffer(gpu.instances,index*64,matrix);
  });
  const path=new PathMotion(Array.from({length:40},(_,i)=>[0,0,39-i]),rule.turnDistance);
  motion.set(model.id,{rig,rule,path,gait:ENEMY_EXPANSION_MOVEMENT[model.id]?new EnemyExpansionGait(rig,path,0,model.id,rule):model.id==='dog'?new DogGait(rig,path,0):new ArticulatedGait(rig,path,0,model.id,rule),sample:new Float64Array(3)});
  const extent=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(const part of parts)for(const cell of part.voxels)for(let axis=0;axis<3;axis++){extent[axis]=Math.min(extent[axis],cell[axis]);extent[axis+3]=Math.max(extent[axis+3],cell[axis]+1);}
  bounds.set(model.id,extent);
  const quads=items.reduce((total,item)=>total+item.mesh.quads.length,0);
  $(model.id+'-stats').textContent=`${parts.length} rigid parts · ${quads.toLocaleString()} quads · ${ENEMY_STATS[model.id].maxHealth} HP · ${rule.speed} units/s`;
  for(const material of model.materials){const swatch=document.createElement('span');swatch.style.backgroundColor=material.color;swatch.title=material.name;$(model.id+'-palette').append(swatch);}
 }
 await renderer.init();if(disposed){dispose();throw new Error('Review closed.');}
 $('selection').value=selection;select();
 for(const id of ['selection','footprint','front','side','top','reset','motion','pause','step','speed'])$(id).disabled=false;
 $('review-status').textContent='WebGPU ready · Current game gait';
}catch(error){fail(error.message);}
