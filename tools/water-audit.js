// Read-only source/world audit. Never edits assets or the active /play/ session.
import {benchmarkWaterSSR} from './water-ssr-benchmark.js';
import {PLAY_CONFIG,playCapacity} from '../play/config.js';
import {loadPlayWorld,disposePlayWorld} from '../play/engine.js';
import {WorldRenderer} from '../engine/renderer.js';
import {LevelConditions,applyPlayLighting} from '../play/conditions.js';
import {levelLighting} from '../engine/environment.js';
const $=id=>document.getElementById(id),canvas=$('world'),errors=[];
let renderer,world,wetBox,lighting='natural',elapsed=310,running=false,loading=false,lastNow=0,depthResult=null,comparison=null,probeResources=null,prepassResult=null,initialPassRecord=null,auditing=false;
function fail(cause){errors.push(cause?.message??String(cause));running=false;$('status').textContent=errors.at(-1);report();}
function report(){
 const r={level:world?.level.id,lighting,elapsed,stage:"Breeze refraction + water SSR · 60% base transparency",ssr:renderer?.ssr,waterPhase:renderer?.frameData[78],sunIntensity:renderer?.frameData[55],sunY:renderer?.frameData[53],waterMaterial:world?.waterMaterial,waterUniform80to91:renderer?Array.from(renderer.frameData.slice(80,92)):null,waterDrawIndices:renderer?.waterDraw?.indexCount,waterBox:wetBox,camera:renderer?{mode:renderer.camera.mode,target:[...renderer.camera.target],eye:[...renderer.camera.eye],radius:renderer.camera.radius,yaw:renderer.camera.yaw,pitch:renderer.camera.pitch}:null,gpuTimer:renderer?.gpuTimer?.read()??'off',depthProbe:depthResult,comparison,prepassAudit:prepassResult,errors};
 $('report').textContent=JSON.stringify(r,null,2);canvas.dataset.audit=JSON.stringify(r);
}
function render(){if(world&&!loading){renderer.render(0,elapsed);report();}}
function closeup(){if(!wetBox)return;const c=renderer.camera;c.mode='overview';c.target.set([(wetBox.box[0]+.5)*24,wetBox.water,(wetBox.box[1]+.5)*24]);c.radius=62;c.pitch=.72;c.yaw=.8;renderer.requestDraw();render();}
function perspectiveView(){if(!wetBox)return;const c=renderer.camera,x=(wetBox.box[0]+.5)*24,z=(wetBox.box[1]+.5)*24;c.mode='live';c.position.set([x+65,wetBox.water+55,z+65]);c.yaw=Math.PI/4;c.pitch=Math.atan2(55,Math.hypot(65,65));c.fov=60;renderer.requestDraw();render();}
function setLighting(clear){
 comparison=null;depthResult=null;$('captures').replaceChildren();$('status').textContent='Breeze ripples · refracted bed + SSR · 60% base transparency.';
 lighting=clear?(clear===true?'clear-10:30':'day-14:00'):'natural';renderer.setLighting(levelLighting({...world.level.environment,...(clear?{timeOfDay:clear===true?10.5:clear}:{})}));
 if(!clear)applyPlayLighting(renderer,world.playConditions);renderer.requestDraw();render();
}
function disposeProbe(){if(!probeResources)return;for(const b of [probeResources.output,probeResources.readback,probeResources.point])b.destroy();probeResources=null;}
async function load(){
 if(loading)return;loading=true;running=false;$('status').textContent='Loading actual production source…';
 try{
  disposeProbe();if(renderer){renderer.clearWorld();await renderer.device.queue.onSubmittedWorkDone();renderer.dispose();}disposePlayWorld(world);world=null;
  renderer=new WorldRenderer(canvas,fail,{modelLightCapacity:playCapacity(PLAY_CONFIG).modelLights,strictModelLights:true,waterReflections:'ssr',gpuTiming:$('gpu').checked});renderer.inspect=true;await renderer.init();renderer.ssr=$('ssr').checked;renderer.camera.pathModeEnabled=false;
  const level=PLAY_CONFIG.levels.find(l=>l.id===$('level').value);world=await loadPlayWorld(level.id,{config:PLAY_CONFIG,wave:level.waves[0],placements:[],conditions:new LevelConditions().forLevel(level.id)});renderer.setWorld(world);
  // A hidden pool remains hidden: no PlayEngine means no spawns or combat.
  const boxes=world.level.terrain.boxes.filter(b=>b.water>b.ground).sort((a,b)=>Math.hypot(a.box[0]-10,a.box[1]-8)-Math.hypot(b.box[0]-10,b.box[1]-8));
  $('wet').replaceChildren();for(const [i,box]of boxes.entries()){const option=document.createElement('option');option.value=i;option.textContent=`[${box.box}] · ${box.water-box.ground} deep`;$('wet').append(option);}
  $('wet').onchange=()=>{comparison=null;depthResult=null;$('captures').replaceChildren();wetBox=boxes[Number($('wet').value)];closeup();};wetBox=boxes[0];depthResult=comparison=prepassResult=null;loading=false;initialPassRecord=recordPasses('initial scene',()=>setLighting(false));closeup();await depthProbe();$('status').textContent='Breeze ripples · refracted bed + SSR · 60% base transparency. Gameplay is inactive.';
 }catch(cause){fail(cause);}finally{loading=false;report();}
}
function ensureProbe(){
 if(probeResources)return probeResources;const d=renderer.device,count=64*48+1,size=count*16;
 const module=d.createShaderModule({label:'Read-only water depth audit',code:`
 @group(0) @binding(0) var opaque:texture_depth_multisampled_2d;
 @group(0) @binding(1) var water:texture_depth_2d;
 @group(0) @binding(2) var normals:texture_2d<f32>;
 @group(0) @binding(3) var<storage,read_write> result:array<vec4<f32>>;
 @group(0) @binding(4) var<uniform> point:vec4<f32>;
 @compute @workgroup_size(1) fn probe(@builtin(global_invocation_id) id:vec3<u32>){
 let index=id.y*64u+id.x;if(index>3072u){return;}let dimensions=textureDimensions(water);
 var pixel=vec2<i32>((vec2<f32>(id.xy)+.5)*vec2<f32>(dimensions)/vec2<f32>(64,48));
 if(index==3072u){pixel=vec2<i32>(point.xy);}pixel=clamp(pixel,vec2<i32>(0),vec2<i32>(dimensions)-1);
 let d=min(min(textureLoad(opaque,pixel,0),textureLoad(opaque,pixel,1)),min(textureLoad(opaque,pixel,2),textureLoad(opaque,pixel,3)));
 let w=textureLoad(water,pixel,0);result[index]=vec4<f32>(d,w,textureLoad(normals,pixel,0).a,select(0.,1.,w<d));
 }`});
 const pipeline=d.createComputePipeline({label:'Water branch coverage audit',layout:'auto',compute:{module,entryPoint:'probe'}}),output=d.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),readback=d.createBuffer({size,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),point=d.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 return probeResources={pipeline,output,readback,point,size};
}
async function depthProbe(){
 render();const d=renderer.device,p=ensureProbe(),m=renderer.camera.vp,point=[(wetBox.box[0]+.5)*24,wetBox.water,(wetBox.box[1]+.5)*24],w=m[3]*point[0]+m[7]*point[1]+m[11]*point[2]+m[15],px=(m[0]*point[0]+m[4]*point[1]+m[8]*point[2]+m[12])/w,py=(m[1]*point[0]+m[5]*point[1]+m[9]*point[2]+m[13])/w;
 const pixel=[Math.floor((px*.5+.5)*canvas.width),Math.floor((.5-py*.5)*canvas.height)];d.queue.writeBuffer(p.point,0,new Float32Array([...pixel,0,0]));
 const group=d.createBindGroup({layout:p.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:renderer.depthView},{binding:1,resource:renderer.waterDepthView},{binding:2,resource:renderer.waterNormalView},{binding:3,resource:{buffer:p.output}},{binding:4,resource:{buffer:p.point}}]}),encoder=d.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(p.pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(64,49);pass.end();encoder.copyBufferToBuffer(p.output,0,p.readback,0,p.size);d.queue.submit([encoder.finish()]);await p.readback.mapAsync(GPUMapMode.READ);
 const data=new Float32Array(p.readback.getMappedRange());let waterPixels=0,surfacePixels=0;for(let i=0;i<3072;i++){if(data[i*4+1]<1)surfacePixels++;if(data[i*4+3])waterPixels++;}
 depthResult={grid:[64,48],sampledWaterSurfacePixels:surfacePixels,sampledShadedWaterPixels:waterPixels,shadedRatioOfImage:waterPixels/3072,wetCenterPixel:pixel,wetCenterOpaqueDepth:data[3072*4],wetCenterWaterDepth:data[3072*4+1],wetCenterNormalAlpha:data[3072*4+2],wetCenterShadesWater:Boolean(data[3072*4+3])};p.readback.unmap();report();return depthResult;
}
async function capture(label){
 // Canvas presentation may discard its drawing buffer before drawImage runs.
 // Capture the identical production display pipeline into an owned texture,
 // then copy padded rows explicitly rather than reading the presented canvas.
 renderer.render(0,elapsed);const d=renderer.device,width=canvas.width,height=canvas.height,bytesPerRow=Math.ceil(width*4/256)*256;
 const target=d.createTexture({label:'Isolated water display capture',size:[width,height],format:renderer.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),readback=d.createBuffer({label:'Isolated water capture readback',size:bytesPerRow*height,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),originalContext=renderer.context;
 try{
  renderer.context={getCurrentTexture:()=>target};try{renderer.render(0,elapsed);}finally{renderer.context=originalContext;}
  const encoder=d.createCommandEncoder();encoder.copyTextureToBuffer({texture:target},{buffer:readback,bytesPerRow,rowsPerImage:height},[width,height]);d.queue.submit([encoder.finish()]);await readback.mapAsync(GPUMapMode.READ);
  const raw=new Uint8Array(readback.getMappedRange()),rgba=new Uint8ClampedArray(width*height*4),bgra=renderer.format.startsWith('bgra');
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const source=y*bytesPerRow+x*4,dest=(y*width+x)*4;rgba[dest]=raw[source+(bgra?2:0)];rgba[dest+1]=raw[source+1];rgba[dest+2]=raw[source+(bgra?0:2)];rgba[dest+3]=raw[source+3];}
  readback.unmap();const pixels=new ImageData(rgba,width,height),snapshot=document.createElement('canvas');snapshot.width=width;snapshot.height=height;snapshot.getContext('2d').putImageData(pixels,0,0);
  const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=label;figure.append(snapshot,caption);$('captures').append(figure);return pixels;
 }finally{renderer.context=originalContext;readback.destroy();target.destroy();}
}
function compare(a,b){let pixels=0,sum=0,max=0;for(let i=0;i<a.data.length;i+=4){let difference=0;for(let j=0;j<3;j++){const delta=Math.abs(a.data[i+j]-b.data[i+j]);difference+=delta;sum+=delta;max=Math.max(max,delta);}if(difference)pixels++;}return {changedPixels:pixels,changedFraction:pixels/(a.width*a.height),meanAbsoluteRGBDifference:sum/(a.width*a.height*3),maxChannelDifference:max};}
async function animationTest(){
 if(!world||loading||auditing)return;auditing=true;running=false;$('captures').replaceChildren();$('status').textContent='Capturing fixed camera, water on/off and t+1.7…';const originalTime=elapsed,water=renderer.waterDraw;
 try{
  const first=await capture(`Water · t=${elapsed.toFixed(1)}`);elapsed+=1.7;const later=await capture(`Water · t=${elapsed.toFixed(1)}`);const phaseLater=renderer.frameData[78];elapsed=originalTime;
  renderer.waterDraw=null;renderer.requestDraw();const without=await capture('Water disabled');renderer.waterDraw=water;renderer.requestDraw();
  comparison={animation:compare(first,later),waterEnabledVsDisabled:compare(first,without),phaseLater};await depthProbe();$('status').textContent='Comparison complete. See changed pixels and depth coverage.';
 }finally{renderer.waterDraw=water;elapsed=originalTime;renderer.requestDraw();render();auditing=false;}
}
// Check actual display pixels against 0% and 100% opacity endpoints.
// Blending happens in linear light before the production sRGB transform.
async function transparencyTest(){
 if(!world||loading||auditing)return;auditing=true;running=false;$('captures').replaceChildren();
 const saved=renderer.frameData[84];
 const at=async(opacity,label)=>{renderer.frameData[84]=opacity;renderer.uniformDirty=true;return capture(label);};
 const linear=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;};
 const display=x=>255*(x<=.0031308?x*12.92:1.055*x**(1/2.4)-.055);
 try{
  const clear=await at(0,'0% opacity · bed reference'),solid=await at(1,'100% opacity · tint reference'),actual=await at(saved,'40% opacity · review');
  let pixels=0,maxError=0,failures=0;
  for(let i=0;i<actual.data.length;i+=4){
   if(![0,1,2].some(j=>clear.data[i+j]!==solid.data[i+j]))continue;
   pixels++;for(let j=0;j<3;j++){
    const expected=display(linear(clear.data[i+j])*(1-saved)+linear(solid.data[i+j])*saved),error=Math.abs(actual.data[i+j]-expected);
    maxError=Math.max(maxError,error);if(error>2)failures++;
   }
  }
  comparison={transparency:{opacity:saved,transmission:1-saved,checkedPixels:pixels,maxDisplayByteError:maxError,failedChannels:failures,tolerance:2,pass:pixels>0&&failures===0}};
  $('status').textContent=comparison.transparency.pass?'PASS · actual GPU pixels blend 60% bed / 40% blue tint.':'FAIL · see transparency report.';
 }finally{renderer.frameData[84]=saved;renderer.uniformDirty=true;render();auditing=false;}
}
async function rippleTest(){
 if(!world||loading||auditing)return;auditing=true;running=false;$('captures').replaceChildren();
 const savedTime=elapsed,opacity=renderer.frameData[84],refraction=renderer.frameData[86],ssr=renderer.ssr;renderer.ssr=false;
 const pair=async(label)=>{elapsed=savedTime;renderer.uniformDirty=true;const a=await capture(label+' · t');elapsed=savedTime+1.7;const b=await capture(label+' · t+1.7');return compare(a,b);};
 try{
  const refractedMotion=await pair('Breeze refraction');
  renderer.frameData[86]=0;const refractionOffMotion=await pair('Refraction off');
  renderer.frameData[86]=refraction;renderer.frameData[84]=1;const opaqueTintMotion=await pair('Opaque tint · no highlights');
  comparison={ripples:{refractedMotion,refractionOffMotion,opaqueTintMotion,pass:refractedMotion.changedPixels>0&&refractionOffMotion.changedPixels===0&&opaqueTintMotion.changedPixels===0}};
  $('status').textContent=comparison.ripples.pass?'PASS · ripples move transmitted scenery only; no animated highlights.':'FAIL · see ripple report.';
 }finally{renderer.ssr=ssr;elapsed=savedTime;renderer.frameData[84]=opacity;renderer.frameData[86]=refraction;renderer.uniformDirty=true;render();auditing=false;}
}
async function reflectionTest(){
 if(!world||loading||auditing)return;auditing=true;running=false;$('captures').replaceChildren();
 const saved=renderer.ssr,strength=renderer.frameData[83];
 try{
  renderer.ssr=false;const off=await capture('SSR off · same ripple phase');
  renderer.ssr=true;const on=await capture('SSR on · same ripple phase');
  renderer.ssr=false;const replay=await capture('SSR off · replay');
  renderer.ssr=true;renderer.frameData[83]=0;renderer.uniformDirty=true;const zero=await capture('Water reflection strength zero');
  comparison={reflections:{enabledVsDisabled:compare(off,on),disabledReplay:compare(off,replay),zeroStrengthVsDisabled:compare(off,zero),reflectiveness:strength,pass:compare(off,on).changedPixels>0&&compare(off,replay).changedPixels===0&&compare(off,zero).changedPixels===0}};
  $('status').textContent=comparison.reflections.pass?'PASS · SSR changes the frozen water view; disabled replay is identical.':'No reflection hits in this view · choose a pool facing nearby scenery.';
 }finally{renderer.frameData[83]=strength;renderer.uniformDirty=true;renderer.ssr=saved;render();auditing=false;}
}
function recordPasses(name,action=()=>renderer.render(0,elapsed)){
 const device=renderer.device,original=device.createCommandEncoder,passes=[];
 device.createCommandEncoder=function(...args){const encoder=Reflect.apply(original,device,args),begin=encoder.beginRenderPass.bind(encoder);encoder.beginRenderPass=function(descriptor){const depth=descriptor.depthStencilAttachment;passes.push({label:descriptor.label??'Unlabelled',colorAttachments:descriptor.colorAttachments?.length??0,depth:depth?{readOnly:Boolean(depth.depthReadOnly),load:depth.depthLoadOp??null,store:depth.depthStoreOp??null,view:!!depth.view}:null});return begin(descriptor);};return encoder;};
 try{action();}finally{device.createCommandEncoder=original;}
 const depth=passes.findIndex(p=>p.label==='Initial camera depth'),opaque=passes.findIndex(p=>p.label==='Visible opaque surfaces'),main=passes[depth];
 return {name,mainDepthIndex:depth,mainOpaqueIndex:opaque,depthBeforeOpaque:opaque<0?null:depth>=0&&depth<opaque,mainPrepassDepthOnly:main?main.colorAttachments===0&&main.depth?.readOnly===false:null,opaqueReadsDepth:opaque<0?null:passes[opaque].depth?.readOnly===true,passes};
}
async function prepassAudit(){
 running=false;const c=renderer.camera,saved={target:[...c.target],yaw:c.yaw,pitch:c.pitch,radius:c.radius},records=[initialPassRecord];
 records.push(recordPasses('cached static'));
 c.yaw+=.015;renderer.requestDraw();records.push(recordPasses('camera change'));
 const draw=renderer.draws.find(draw=>draw.visibleCount>0),original=draw?.transforms.slice(0,16);
 if(draw){const moved=original.slice();moved[12]+=.001;renderer.updateInstance(draw.key,0,moved);records.push(recordPasses('visible instance pose change'));renderer.updateInstance(draw.key,0,original);renderer.render(0,elapsed);}
 renderer.resize(canvas.width,canvas.height);records.push(recordPasses('viewport resize'));
 renderer.setWorld(world);if(lighting==='natural')applyPlayLighting(renderer,world.playConditions);else renderer.setLighting(levelLighting({...world.level.environment,timeOfDay:lighting==='day-14:00'?14:10.5}));records.push(recordPasses('same scene rebind'));
 c.target.set(saved.target);Object.assign(c,{yaw:saved.yaw,pitch:saved.pitch,radius:saved.radius});renderer.requestDraw();renderer.render(0,elapsed);await renderer.device.queue.onSubmittedWorkDone();
 prepassResult={records,allDrawnOpaquePassesHavePriorDepth:records.every(r=>r.depthBeforeOpaque!==false&&r.mainPrepassDepthOnly!==false&&r.opaqueReadsDepth!==false),cachedStaticSkipsMainPrepass:records[1].mainDepthIndex===-1};$('status').textContent='Actual encoded pass audit complete; no prepass implementation was changed.';report();
}
function tick(now){const dt=lastNow?(now-lastNow)/1000:0;lastNow=now;if(running&&!loading&&world){elapsed+=dt;render();}requestAnimationFrame(tick);}
$('load').onclick=()=>load();$('gpu').onchange=()=>load();$('close').onclick=closeup;$('perspective').onclick=perspectiveView;$('overview').onclick=()=>{renderer.camera.frame();render();};$('clear').onclick=()=>setLighting(true);$('day14').onclick=()=>setLighting(14);$('natural').onclick=()=>setLighting(false);$('run').onclick=()=>{running=true;};$('stop').onclick=()=>{running=false;report();};$('probe').onclick=()=>depthProbe().catch(fail);$('test').onclick=()=>animationTest().catch(fail);
$('ssr-cost').onclick=async()=>{if(auditing||loading)return;auditing=true;running=false;try{comparison={ssrCost:await benchmarkWaterSSR(renderer)};report();}catch(error){fail(error);}finally{auditing=false;}};
$('ssr').onchange=()=>{renderer.ssr=$('ssr').checked;render();};$('ssr-test').onclick=()=>reflectionTest().catch(fail);
$('ripple-test').onclick=()=>rippleTest().catch(fail);$('prepass').onclick=()=>prepassAudit().catch(fail);$('transparency').onclick=()=>transparencyTest().catch(fail);
window.addEventListener('resize',()=>{renderer?.requestDraw();render();});window.addEventListener('pagehide',()=>{running=false;disposeProbe();renderer?.dispose();disposePlayWorld(world);});
for(const [i,level]of PLAY_CONFIG.levels.entries())if(![...$('level').options].some(o=>o.value===level.id)){const o=document.createElement('option');o.value=level.id;o.textContent=level.zone+(i%4+1);$('level').append(o);}
try{await load();requestAnimationFrame(tick);}catch(cause){fail(cause);}
