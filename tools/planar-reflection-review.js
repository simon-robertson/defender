import {WorldRenderer} from '../engine/renderer.js';
import {PLAY_CONFIG,playCapacity} from '../play/config.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine} from '../play/engine.js';
import {LevelConditions,applyPlayLighting} from '../play/conditions.js';
import {GPUFrameTimer} from '../engine/gpu-frame-timer.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {newLevel,defaultEnvironment} from '../shared/level.js';
const $=id=>document.getElementById(id),errors=[],r=new WorldRenderer($('world'),e=>{errors.push(String(e));report();},{modelLightCapacity:playCapacity(PLAY_CONFIG).modelLights,gpuTiming:true});
r.inspect=true;let world,engine,busy=false,running=false,elapsed=12,last=0,benchmark=null,verification=null;const comparisons=[];
function report(){const data={level:world?.level.id,mode:$('mode').value,benchmark,comparisons,verification,errors,inspection:JSON.parse($('world').dataset.inspection??'{}')};$('report').textContent=JSON.stringify(data,null,2);$('report').dataset.result=JSON.stringify(data);}
function mode(){r.waterReflections=$('mode').value;r.ssr=$('mode').value!=='off';r.requestDraw();draw();}
function draw(){r.render(0,elapsed);report();}
async function load(){if(busy)return;busy=true;running=false;try{
 engine?.dispose();engine=null;r.clearWorld();await r.device.queue.onSubmittedWorkDone();disposePlayWorld(world);world=null;
 const config=PLAY_CONFIG,level=config.levels.find(x=>x.id===$('level').value),wave=level.waves[0],record=await(await fetch('/docs/todo-36-41-2026-10-21/mixed-campaign.json')).json(),placements=record.results[0].waves.find(x=>x.wave===wave.id).placements;
 world=await loadPlayWorld(level.id,{config,wave,placements,conditions:new LevelConditions().forLevel(level.id)});r.setWorld(world);applyPlayLighting(r,world.playConditions);
 engine=new PlayEngine(world,{config,wave,onPoseChange:(...args)=>r.updateInstance(...args),onVisible:(...args)=>r.setActorVisible(...args)});engine.startWave();for(let i=0;i<360;i++)engine.advance(1/30);elapsed=engine.time;mode();$('status').textContent='Actual production scenery, defences and animated enemies. No active player session.';
 }catch(e){errors.push(String(e));}finally{busy=false;report();}}
function drone(){const boxes=world.level.terrain.boxes.filter(b=>b.water>0);if(!boxes.length)return;boxes.sort((a,b)=>Math.hypot(a.box[0]-10,a.box[1]-8)-Math.hypot(b.box[0]-10,b.box[1]-8));const b=boxes[0],x=(b.box[0]+.5)*24,z=(b.box[1]+.5)*24,c=r.camera;c.mode='live';c.position.set([x+65,b.water+55,z+65]);c.yaw=Math.PI/4;c.pitch=Math.atan2(55,Math.hypot(65,65));c.fov=60;r.requestDraw();draw();}
const median=a=>{const s=[...a].sort((a,b)=>a-b);return s.length?(s[(s.length-1)>>1]+s[s.length>>1])/2:null;};
async function measure(){if(busy)return;busy=true;running=false;const saved=r.gpuTimer,savedMode=r.waterReflections,savedSSR=r.ssr,clock={now:0},timer=new GPUFrameTimer(r.device,()=>clock.now),results={};r.gpuTimer=timer;
 try{
 if(!r.device.features.has('timestamp-query'))throw new Error('GPU timestamps unsupported.');
 for(const changing of [false,true]){
  const samples={ssr:[],planar:[],off:[]};
  for(let i=0;i<84;i++){
   const mode=['ssr','planar','off'][i%3];r.waterReflections=mode;r.ssr=mode!=='off';if(changing)r.requestDraw();clock.now+=110;const sequence=timer.latestSequence;r.render(0,elapsed,false);
   await r.device.queue.onSubmittedWorkDone();await new Promise(requestAnimationFrame);
   if(i>=12&&timer.latestSequence>sequence)samples[mode].push(timer.values[(timer.cursor-1+timer.values.length)%timer.values.length]);
  }
  results[changing?'cameraOrSceneChanging':'cachedStatic']={samples,medianMs:Object.fromEntries(Object.entries(samples).map(([k,a])=>[k,median(a)]))};
 }
 benchmark={width:r.canvas.width,height:r.canvas.height,level:world.level.id,results,note:'Alternating complete-frame GPU timestamps, 12 warmup + 72 measured frames per condition; fixed camera/poses/phase. Changing condition invalidates camera-space passes in every mode, including the planar capture. Cached condition keeps all geometry images reusable. Exploratory local measurements.'};
 }catch(e){errors.push(String(e));}finally{r.gpuTimer=saved;r.waterReflections=savedMode;r.ssr=savedSSR;timer.dispose();busy=false;r.requestDraw();draw();}}
async function captureBytes(texture,width,height){const d=r.device,row=Math.ceil(width*4/256)*256,b=d.createBuffer({size:row*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),e=d.createCommandEncoder();e.copyTextureToBuffer({texture},{buffer:b,bytesPerRow:row},[width,height]);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const bytes=new Uint8Array(b.getMappedRange()),copy=new Uint8Array(width*height*4);for(let y=0;y<height;y++)copy.set(bytes.subarray(y*row,y*row+width*4),y*width*4);b.unmap();b.destroy();return copy;}
async function verify(){if(busy)return;busy=true;running=false;const previous=world,previousEngine=engine,savedMode=r.waterReflections,savedSSR=r.ssr;let fixture;
 try{
 const tower=(await(await fetch('/api/models/arc-spire')).json()).asset,level=newLevel('reflection-proof');level.size=[8,8];level.environment=defaultEnvironment();level.terrain.defaultHeight=24;level.terrain.boxes=[{box:[3,3],ground:24,water:32},{box:[4,3],ground:24,water:32},{box:[3,4],ground:24,water:32},{box:[4,4],ground:24,water:32}];level.placements=[{id:'above',model:tower.id,variant:'upgrade2',box:[3,0,2],turn:0}];level.path=[];fixture=buildWorld(level,new Map([[tower.id,tower]]));r.setWorld(fixture);r.waterReflections='planar';r.ssr=true;
 const c=r.camera;c.mode='live';c.position.set([96,48,145]);c.yaw=0;c.pitch=.9;c.fov=52;r.requestDraw();r.render(0,0);await r.device.queue.onSubmittedWorkDone();const p=r.planar;
 if(!p)throw new Error('Visible proof water did not create a reflection capture.');
 let abovePlaneVertices=0,offscreenAbovePlaneVertices=0;const vp=c.vp;
 for(const draw of r.draws){if(!draw.visibleCount)continue;const entry=fixture.entries.find(e=>e.key===draw.key);for(const m of entry.transforms)for(let k=0;k<entry.mesh.vertices.length;k+=11){const v=entry.mesh.vertices,x=m[0]*v[k]+m[4]*v[k+1]+m[8]*v[k+2]+m[12],y=m[1]*v[k]+m[5]*v[k+1]+m[9]*v[k+2]+m[13],z=m[2]*v[k]+m[6]*v[k+1]+m[10]*v[k+2]+m[14];if(y<r.waterHeight+.025)continue;abovePlaneVertices++;const cy=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],cw=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];if(cy>cw)offscreenAbovePlaneVertices++;}}
 const bytes=await captureBytes(p.color,p.width,p.height);let pixels=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i])pixels++;
 // Raising the plane above all mesh surfaces must remove every capture pixel.
 const high=r.waterHeight;r.waterHeight=250;r.waterBounds[4]=250;c.position[1]=300;r.requestDraw();r.render(0,0);await r.device.queue.onSubmittedWorkDone();const clipped=await captureBytes(p.color,p.width,p.height);let clippedPixels=0;for(let i=3;i<clipped.length;i+=4)if(clipped[i])clippedPixels++;
 verification={abovePlaneVertices,offscreenAbovePlaneVertices,offscreenPass:pixels>0&&abovePlaneVertices>0&&abovePlaneVertices===offscreenAbovePlaneVertices,capturePixels:pixels,allBelowPlanePixels:clippedPixels,clipPass:pixels>0&&clippedPixels===0,plane:high,note:'Actual Arc geometry: all above-plane vertices lie beyond the main camera top clip plane. Nonzero mirrored capture proves off-screen geometry is reflected; raising the clipping plane must remove all geometry.'};
 if(!verification.clipPass||!verification.offscreenPass)throw new Error('Planar geometry clipping proof failed.');
 }catch(e){errors.push(String(e));}finally{r.clearWorld();await r.device.queue.onSubmittedWorkDone();if(fixture)disposeWorld(fixture);world=previous;engine=previousEngine;r.setWorld(world);applyPlayLighting(r,world.playConditions);r.waterReflections=savedMode;r.ssr=savedSSR;busy=false;drone();report();}}
$('all').onclick=async()=>{if(busy)return;for(const id of ['moss-02','ochre-04']){ $('level').value=id;await load();for(const view of ['overview','drone']){if(view==='overview'){r.camera.frame();r.requestDraw();draw();}else drone();$('status').textContent='Measuring '+id+' '+view+'…';await measure();comparisons.push({view,...benchmark});report();}}$('status').textContent='Four GPU comparisons complete';};
$('load').onclick=load;$('mode').onchange=mode;$('overview').onclick=()=>{r.camera.frame();r.requestDraw();draw();};$('drone').onclick=drone;$('measure').onclick=measure;$('verify').onclick=verify;$('animate').onclick=()=>{running=!running;$('animate').textContent=running?'Stop':'Animate';};
function tick(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(running&&!busy&&engine){engine.advance(dt);elapsed+=dt;draw();}requestAnimationFrame(tick);}
window.addEventListener('pagehide',()=>{engine?.dispose();r.dispose();disposePlayWorld(world);});
try{await r.init();await load();requestAnimationFrame(tick);}catch(e){errors.push(String(e));report();}
