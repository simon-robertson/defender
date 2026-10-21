import {BOX_SIZE} from '/shared/grid.js';
import {VARIANTS,validateModel} from '/shared/model.js';
import {meshPart} from '/shared/mesher.js';
import {identity} from '/shared/math.js';
import {TURRET_TURN,TURRET_PITCH,TURRET_RECOIL} from '/shared/arsenal.js';
import {PoseRig} from '/engine/rig.js';
import {Renderer} from '/tools/renderer.js';

const $=id=>document.getElementById(id),emptyGrid=new Float32Array(0),viewYaw=-2.35,degrees=180/Math.PI;
const controls=['variant','yaw','pitch','recoil','reset'];
let disposed=false,model,meshes,rigs,selection='all';
const renderer=new Renderer($('scene'),message=>{if(disposed)return;$('error').textContent=message;$('review-status').textContent='Preview unavailable';for(const id of controls)$(id).disabled=true;});
const draw=renderer.draw.bind(renderer);renderer.draw=()=>{if(!disposed&&renderer.ready&&!renderer.failed)draw();};
function scene(){
  if(disposed||!rigs)return;
  const variants=selection==='all'?VARIANTS:[selection],entries=[];
  for(const [i,v]of variants.entries()){
    const offset=selection==='all'?(i-1)*BOX_SIZE*1.35:0,rig=rigs.get(v);
    rig.root[12]=offset*Math.cos(viewYaw)-BOX_SIZE/2;rig.root[14]=-offset*Math.sin(viewYaw)-BOX_SIZE/2;
    rig.setRotation(TURRET_TURN.part,0,Number($('yaw').value)/degrees,0);
    rig.setRotation(TURRET_PITCH.part,Number($('pitch').value)/degrees,0,0);
    rig.setTranslation(TURRET_RECOIL.part,0,0,Number($('recoil').value));
    rig.invalidateRoot();rig.update();
    for(const item of meshes.get(v))entries.push({...item,transforms:[rig.byId.get(item.id).instance.matrix]});
  }
  renderer.setScene(entries,emptyGrid);
  $('angle').textContent=$('yaw').value+'°';$('pitch-angle').textContent=$('pitch').value+'°';$('recoil-distance').textContent=Number($('recoil').value).toFixed(2);
  $('scene').dataset.pose=JSON.stringify({selection,yaw:Number($('yaw').value),pitch:Number($('pitch').value),recoil:Number($('recoil').value)});
}
function frame(){
  const aspect=Math.max(.1,$('scene').clientWidth/$('scene').clientHeight);
  renderer.frame([0,BOX_SIZE*.66,0],Math.max(BOX_SIZE*.875,(selection==='all'?BOX_SIZE*2.1:BOX_SIZE*.75)/aspect)*1.1);
}
function reset(){renderer.yaw=viewYaw;renderer.pitch=.43;for(const id of ['yaw','pitch','recoil'])$(id).value='0';scene();frame();}
for(const id of ['yaw','pitch','recoil'])$(id).oninput=scene;
$('variant').onchange=e=>{selection=e.target.value;for(const card of document.querySelectorAll('[data-variant]'))card.hidden=selection!=='all'&&card.dataset.variant!==selection;document.querySelector('.variants').style.gridTemplateColumns=selection==='all'?'repeat(3,1fr)':'1fr';scene();frame();};
$('reset').onclick=reset;
function dispose(){if(disposed)return;disposed=true;renderer.ready=false;renderer.device?.destroy();renderer.context?.unconfigure();renderer.cache.clear();renderer.draws.length=0;rigs?.clear();meshes?.clear();model=null;}
addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
try{
  const response=await fetch('/api/models/turret-study');if(!response.ok)throw new Error('Unable to load turret source.');
  model=validateModel((await response.json()).asset);if(disposed)throw new Error('Preview closed.');
  meshes=new Map(VARIANTS.map(v=>[v,model.variants[v].parts.map(p=>({id:p.id,key:v+':'+p.id,mesh:meshPart(model,p)}))]));
  rigs=new Map(VARIANTS.map(v=>[v,new PoseRig({root:identity(),parts:model.variants[v].parts,instances:meshes.get(v).map(p=>({part:p.id,key:p.key,index:0,matrix:identity()}))},()=>{})]));
  for(const v of VARIANTS){const parts=meshes.get(v),quads=parts.reduce((n,p)=>n+p.mesh.quads.length,0);$(v+'-stats').textContent=`${quads.toLocaleString()} quads · ${parts.length} rigid parts`;}
  for(const material of model.materials){const swatch=document.createElement('span');swatch.style.backgroundColor=material.color;swatch.title=material.name;$('palette').append(swatch);}
  $('pitch').min=String(Math.round(TURRET_PITCH.min*degrees));$('pitch').max=String(Math.round(TURRET_PITCH.max*degrees));$('recoil').max=String(TURRET_RECOIL.distance);
  await renderer.init();if(disposed){renderer.ready=false;renderer.device?.destroy();renderer.context?.unconfigure();}else{reset();for(const id of controls)$(id).disabled=false;$('review-status').textContent='WebGPU ready';}
}catch(error){renderer.onError(error.message);dispose();}
