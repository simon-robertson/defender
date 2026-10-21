import {WorldRenderer} from '../engine/renderer.js';
import {loadPlayWorld,disposePlayWorld} from '../play/engine.js';
import {PLAY_CONFIG,playCapacity} from '../play/config.js';
import {ShotEffects} from '../engine/shot-effects.js';
import {identity} from '../shared/math.js';
const canvas=document.getElementById('world'),output=document.getElementById('result'),errors=[],runs=[];
const r=new WorldRenderer(canvas,message=>errors.push(String(message)),{modelLightCapacity:playCapacity(PLAY_CONFIG).modelLights});let world;
try{
 await r.init();await r.prepareDeathEffects();world=await loadPlayWorld('moss-02',{wave:PLAY_CONFIG.levels[1].waves[0],critters:false});r.setWorld(world);
 const box=world.level.terrain.boxes.find(b=>b.water>b.ground),c=r.camera,x=(box.box[0]+.5)*24,z=(box.box[1]+.5)*24;
 c.target.set([x,box.water,z]);c.radius=84;c.pitch=.72;c.yaw=.8;r.requestDraw();
 const shots=new ShotEffects(),matrix=identity();matrix[12]=x;matrix[13]=box.water+8;matrix[14]=z;shots.emit(matrix,[[0,0,0],[2,0,0]],0);shots.prepare();r.setShotEffects(shots);
 for(const options of [{reflections:true,bloom:true},{reflections:false,bloom:false},{reflections:true,bloom:false},{reflections:false,bloom:true},{reflections:true,bloom:true}]){
  r.setGraphicsOptions(options);r.render(0,3);await r.device.queue.onSubmittedWorkDone();
  const run={...options,reflectionGate:r.frameData[72],planarDraws:r.planarDraws,bloomPasses:r.bloom?.passes??0,bloomActive:r.bloom?.active??false,waterUniform:Array.from(r.frameData.slice(80,91))};
  run.pass=run.reflectionGate===Number(options.reflections)&&(options.reflections?run.planarDraws>0:run.planarDraws===0)&&(options.bloom?run.bloomPasses>0&&run.bloomActive:run.bloomPasses===0&&!run.bloomActive);runs.push(run);
 }
 output.textContent=JSON.stringify({ready:true,pass:errors.length===0&&runs.every(run=>run.pass)&&runs.every(run=>JSON.stringify(run.waterUniform)===JSON.stringify(runs[0].waterUniform)),runs,errors},null,2);
}catch(error){errors.push(error.message);output.textContent=JSON.stringify({ready:true,pass:false,runs,errors},null,2);}
addEventListener('pagehide',()=>{r.dispose();disposePlayWorld(world);},{once:true});
