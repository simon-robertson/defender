import {BOX_SIZE} from '/shared/grid.js';
import {MISSILE_LAUNCHER_SOCKETS,GUIDED_MISSILE_MODEL} from '/shared/missile-model.js';
import {validateModel,VARIANTS} from '/shared/model.js';
import {meshPart,meshQuads} from '/shared/mesher.js';
import {identity,translation,partMatrices,multiply} from '/shared/math.js';
import {modelForZone} from '/shared/zone-style.js';
import {defaultWaterMaterial} from '/shared/water.js';
import {WorldRenderer} from '/engine/renderer.js';
import {disposeWorld} from '/engine/world.js';
import {FrameLoop} from '/engine/clock.js';

// An isolated inspection fixture, never a saved level. Only the active palette's
// three variant meshes are cached; camera and lighting changes reuse them.
const $=id=>document.getElementById(id),canvas=$('scene');
const controls=['variant','zone','night','reset'],width=8*BOX_SIZE,length=6*BOX_SIZE,viewYaw=2.45;
const floorMaterials=[{color:'#A5A49A',emission:0,reflectiveness:0}];
const floorMesh=meshQuads([{origin:[0,0,0],axis:1,sign:1,width:length,height:width,material:0}],floorMaterials);
const emptyWater=meshQuads([],floorMaterials),meshes=new Map(),bounds=new Map(),stats=new Map();
const environment={timeOfDay:12,weather:{enabled:false},sky:{direction:[-.65,1,-.45],color:'#FFF8EB',intensity:.88,ambient:'#C9CFCB',ambientIntensity:.48}};
const controller=new AbortController();
let model=null,missile=null,missileMesh=null,world=null,ready=false,disposed=false,night=false,selection='all',zone='A',loop;

function fail(message){
 ready=false;loop?.stop();
 $('error').textContent=String(message);$('review-status').textContent='Preview unavailable';
 for(const id of controls)$(id).disabled=true;
 $('review-diagnostics').textContent=JSON.stringify({ready:false,error:String(message)});
}
const renderer=new WorldRenderer(canvas,fail);
function wake(){if(ready&&!disposed&&!document.hidden)loop.start();}
const invalidate=renderer.requestDraw.bind(renderer);
renderer.requestDraw=()=>{invalidate();wake();};
loop=new FrameLoop((deltaSeconds,elapsedSeconds)=>{
 try{
  renderer.render(deltaSeconds,elapsedSeconds);
  if(!renderer.camera.dragging&&!renderer.camera.keys.size){loop.stop();inspect();}
 }catch(error){fail(error.message);}
});

function selectedVariants(){return selection==='all'?VARIANTS:[selection];}
function origin(index,count){
 const offset=count===1?0:(index-1)*44;
 return [width/2+offset*Math.cos(viewYaw)-BOX_SIZE/2,0,length/2-offset*Math.sin(viewYaw)-BOX_SIZE/2];
}
function cachePalette(){
 meshes.clear();bounds.clear();stats.clear();
 const styled=modelForZone(model,zone);
 const styledMissile=modelForZone(missile,zone);missileMesh=meshPart(styledMissile,styledMissile.variants.base.parts[0]);
 for(const variant of VARIANTS){
  const parts=styled.variants[variant].parts,poses=partMatrices(parts),items=[];
  const extent=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  let cells=0,quads=0;
  for(const part of parts){
   const mesh=meshPart(styled,part),pose=poses.get(part.id);
   items.push({key:`missile-launcher:${variant}:${part.id}`,mesh,pose});cells+=part.voxels.length;quads+=mesh.quads.length;
   // Use actual mesh vertices and bind matrices, including future rigid parts.
   for(let i=0;i<mesh.vertices.length;i+=11)for(let axis=0;axis<3;axis++){
    const v=pose[axis]*mesh.vertices[i]+pose[4+axis]*mesh.vertices[i+1]+pose[8+axis]*mesh.vertices[i+2]+pose[12+axis];
    extent[axis]=Math.min(extent[axis],v);extent[axis+3]=Math.max(extent[axis+3],v);
   }
  }
  if(!cells)throw new Error(`Missile launcher ${variant} has no geometry.`);
  const sockets=MISSILE_LAUNCHER_SOCKETS[variant];extent[4]=Math.max(extent[4],...sockets.map(s=>s[1]+GUIDED_MISSILE_MODEL.height));
  meshes.set(variant,items);bounds.set(variant,extent);stats.set(variant,{parts:parts.length,cells,quads,bounds:extent});
  $(variant+'-stats').textContent=`${sockets.length} missiles · ${extent[4]-extent[1]} units tall · ${quads.toLocaleString()} body quads`;
 }
 const swatches=styled.materials.map(material=>{const swatch=document.createElement('span');swatch.style.backgroundColor=material.color;swatch.title=material.name;return swatch;});
 $('palette').replaceChildren(...swatches);
}
function buildReviewWorld(){
 const variants=selectedVariants(),entries=[{key:'review-floor',mesh:floorMesh,transforms:[identity()]}],missileTransforms=[];
 for(const [index,variant]of variants.entries()){
  const root=translation(...origin(index,variants.length));
  for(const socket of MISSILE_LAUNCHER_SOCKETS[variant])missileTransforms.push(translation(root[12]+socket[0]-12,root[13]+socket[1],root[14]+socket[2]-12));
  for(const item of meshes.get(variant)){
   const matrix=new Float32Array(16);multiply(matrix,root,item.pose);
   entries.push({key:item.key,mesh:item.mesh,transforms:[matrix]});
  }
 }
 entries.push({key:'guided-missile:base:body',mesh:missileMesh,transforms:missileTransforms});
 // Only these camera/light metadata fields are consumed by WorldRenderer.
 const level={size:[width/BOX_SIZE,length/BOX_SIZE],path:[],terrain:{defaultHeight:0,boxes:[]},environment};
 return {level,entries,actors:new Map(),rigs:new Map(),assetIds:['missile-launcher','guided-missile'],weather:{enabled:false,type:null},
  width,length,water:{key:'water',mesh:emptyWater,transforms:[identity()]},waterMaterial:defaultWaterMaterial()};
}
function applyLighting(){
 const sky=environment.sky;
 renderer.setLightingColors(night?'#708ABA':sky.color,night?'#263754':sky.ambient,night?'#263754':'#848B83');
 $('night').textContent=night?'Day':'Night';$('night').setAttribute('aria-pressed',String(night));wake();
}
function showModels(reframe=true){
 loop.stop();
 const previous=world;world=buildReviewWorld();renderer.setWorld(world);disposeWorld(previous);
 for(const card of document.querySelectorAll('[data-variant]'))card.hidden=selection!=='all'&&card.dataset.variant!==selection;
 document.querySelector('.variants').style.gridTemplateColumns=selection==='all'?'repeat(3,1fr)':'1fr';
 applyLighting();if(reframe)reset();wake();
}
function reset(){
 const camera=renderer.camera;camera.yaw=viewYaw;camera.pitch=.4;camera.mode='overview';camera.keys.clear();camera.dragging=false;
 const sy=Math.sin(camera.yaw),cy=Math.cos(camera.yaw),sp=Math.sin(camera.pitch),cp=Math.cos(camera.pitch);
 const right=[cy,0,-sy],up=[-sy*sp,cp,-cy*sp],center=[width/2,0,length/2];
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 const variants=selectedVariants();
 for(const [index,variant]of variants.entries()){
  const extent=bounds.get(variant),at=origin(index,variants.length);
  for(const x0 of [extent[0],extent[3]])for(const y of [0,extent[4]])for(const z0 of [extent[2],extent[5]]){
   const x=x0+at[0]-center[0],z=z0+at[2]-center[2];
   const px=x*right[0]+z*right[2],py=x*up[0]+y*up[1]+z*up[2];
   minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
  }
 }
 // Include a little floor below the pads to keep their emitted light visible.
 minY-=7;const cx=(minX+maxX)/2,cyView=(minY+maxY)/2,aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);
 camera.target.set([center[0]+right[0]*cx+up[0]*cyView,up[1]*cyView,center[2]+right[2]*cx+up[2]*cyView]);
 camera.radius=Math.max(35,(maxY-minY)*.58,(maxX-minX)*.58/Math.max(.1,aspect));renderer.requestDraw();
}
function inspect(){
 if(!ready)return;
 const lights=renderer.modelLights;
 const diagnostics={ready:true,model:model.id,selection,zone,night,variants:Object.fromEntries(stats),
  modelLights:lights?.count??0,authoredModelLights:lights?.authoredCount??0,modelLightOverflow:lights?.overflow??0,
  bloomActive:renderer.bloom?.active??false,bloomBytes:renderer.bloom?.bytes??0,sceneBuffers:renderer.sceneBuffers.size,
  createdSceneBuffers:renderer.createdSceneBuffers,destroyedSceneBuffers:renderer.destroyedSceneBuffers,geometryBytes:renderer.bytes,
  drawGroups:renderer.draws.length,frames:renderer.frames,camera:{yaw:renderer.camera.yaw,pitch:renderer.camera.pitch,radius:renderer.camera.radius},
  weatherEnabled:false,actors:0};
 $('review-diagnostics').textContent=JSON.stringify(diagnostics);
 const count=lights?.count??0;
 $('review-status').textContent=lights?.overflow?`${count} panel lights · ${lights.overflow} exceed preview capacity`:'WebGPU ready · Loaded missile models';
}

$('variant').addEventListener('change',event=>{if(!ready)return;selection=event.target.value;try{showModels();}catch(error){fail(error.message);}});
$('zone').addEventListener('change',event=>{if(!ready)return;zone=event.target.value;try{cachePalette();showModels();}catch(error){fail(error.message);}});
$('reset').addEventListener('click',()=>{if(ready)reset();});
$('night').addEventListener('click',()=>{if(ready){night=!night;applyLighting();}});
document.addEventListener('keydown',event=>{
 if(!ready||event.key.toLowerCase()!=='n'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName))return;
 event.preventDefault();night=!night;applyLighting();
});
canvas.addEventListener('keydown',wake);
document.addEventListener('visibilitychange',()=>{if(document.hidden)loop.stop();else if(ready)renderer.requestDraw();});
window.addEventListener('pagehide',event=>{
 loop.stop();if(event.persisted)return;
 disposed=true;ready=false;controller.abort();renderer.dispose();disposeWorld(world);world=null;model=null;missile=null;missileMesh=null;meshes.clear();bounds.clear();stats.clear();
});
window.addEventListener('pageshow',event=>{if(event.persisted&&ready)renderer.requestDraw();});

try{
 const responses=await Promise.all(['missile-launcher','guided-missile'].map(id=>fetch('/api/models/'+id,{cache:'no-store',signal:controller.signal})));
 if(responses.some(r=>!r.ok))throw new Error('Unable to load launcher or missile source.');
 const sources=await Promise.all(responses.map(r=>r.json()));model=validateModel(sources[0].asset);missile=validateModel(sources[1].asset);cachePalette();await renderer.init();
 if(disposed){renderer.dispose();}else{
  ready=true;showModels();for(const id of controls)$(id).disabled=false;
 }
}catch(error){if(!disposed){fail(error.message);renderer.dispose();disposeWorld(world);world=null;meshes.clear();}}
