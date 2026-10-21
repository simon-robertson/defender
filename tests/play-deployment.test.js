import {test,expect} from 'bun:test';
import {PLAY_CONFIG,createPlayConfig,playCapacity} from '../play/config.js';
import {PlayEngine,loadPlayWorld,disposePlayWorld} from '../play/engine.js';
import {createPlacementRules} from '../play/placement.js';
import {WorldRenderer} from '../engine/renderer.js';

// Buffer ownership/identity is tested without a browser or shader execution.
// Browser rendering and actual WebGPU validation remain a separate live check.
function rendererFixture(modelLightCapacity){
 const original=Object.getOwnPropertyDescriptor(globalThis,'GPUBufferUsage');
 Object.defineProperty(globalThis,'GPUBufferUsage',{configurable:true,value:{COPY_DST:8,INDEX:16,VERTEX:32,UNIFORM:64,STORAGE:128}});
 const buffers=[],writes=[];
 const device={createShaderModule:descriptor=>descriptor,createPipelineLayout:descriptor=>descriptor,createRenderPipeline:descriptor=>descriptor,createBuffer({size,usage}){const b={size,usage,data:new Uint8Array(size),destroyCalls:0,destroy(){this.destroyCalls++;}};buffers.push(b);return b;},queue:{writeBuffer(buffer,offset,data,dataOffset=0,size){if(buffer.destroyCalls)throw new Error('Upload to released buffer.');const stride=data.BYTES_PER_ELEMENT,start=dataOffset*stride,length=size===undefined?data.byteLength-start:size*stride;buffer.data.set(new Uint8Array(data.buffer,data.byteOffset+start,length),offset);writes.push({buffer,offset,bytes:length});}},destroy(){}};
 const canvas={width:960,height:640,clientWidth:960,clientHeight:640,dataset:{},addEventListener(){},focus(){}};
 const renderer=new WorldRenderer(canvas,message=>{throw new Error(message);},{modelLightCapacity,strictModelLights:true});renderer.device=device;
 return {renderer,buffers,writes,dispose(){renderer.dispose();if(original)Object.defineProperty(globalThis,'GPUBufferUsage',original);else delete globalThis.GPUBufferUsage;}};
}
const assetCache=new Map();
async function fixture(id,config=PLAY_CONFIG){
 const native=globalThis.fetch,requests=[];
 globalThis.fetch=async url=>{requests.push(String(url));const match=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(String(url));if(!match)throw new Error('Unexpected request.');const key=match[1]+'/'+match[2];if(!assetCache.has(key))assetCache.set(key,await Bun.file(new URL(`../assets/${key}.json`,import.meta.url)).json());return {ok:true,json:async()=>({asset:structuredClone(assetCache.get(key))})};};
 let world;
 try{world=await loadPlayWorld(id,{config,wave:config.levels.find(level=>level.id===id).waves[0]});}finally{globalThis.fetch=native;}
 const gpu=rendererFixture(playCapacity(config).modelLights),r=gpu.renderer;let engine,rules;
 try{
  r.setWorld(world);
  engine=new PlayEngine(world,{config,onPoseChange:r.updateInstance.bind(r),onVisible:r.setActorVisible.bind(r),onDeploymentsChanged:world=>r.syncRuntimeInstances(world)});
  rules=createPlacementRules(world.playSource,world.playModels,{config});r.flushInstances();r.modelLights.prepare();
 }catch(error){engine?.dispose();rules?.dispose();gpu.dispose();disposePlayWorld(world);throw error;}
 return {world,engine,rules,r,gpu,requests,dispose(){engine.dispose();rules.dispose();gpu.dispose();disposePlayWorld(world);}};
}
const placement=(box,variant='base',id='player-gun-1')=>({id,model:'turret-study',variant,box:box.slice(),turn:0});
test('wave overrides survive reset and reused slots receive the next profile without changing defaults or wildlife',async()=>{
 const levels=structuredClone(PLAY_CONFIG.levels);levels[0].waves[0].enemyOverrides={dog:{maxHealth:123,speed:15}};levels[0].waves[1].enemyOverrides={dog:{maxHealth:177}};delete levels[0].waves[2].enemyOverrides;
 const config=createPlayConfig({levels}),f=await fixture('moss-01',config),{engine,world}=f;
 try{
  const slots=world.playDogSlots.slice(),life=engine.wildlife;
  expect(engine.enemies.states[0].health.maximum).toBe(123);expect(engine.enemies.states[0].movement.speed).toBe(15);engine.startWave();const first=engine.enemies.states[0];engine.enemies.takeHit(first,23);engine.advance(.5);expect(first.health.current).toBe(100);expect(first.distance).toBeCloseTo(7.5,6);
  engine.stopWave();engine.startWave();expect(first.health.current).toBe(123);expect(first.distance).toBe(0);expect(first.movement.speed).toBe(15);engine.stopWave();
  const before=poses(life),time=life.time;engine.prepareWave(config.levels[0].waves[1]);expect(engine.wildlife).toBe(life);expect(life.time).toBe(time);assertCurrentPoses(life,before);expect(world.playDogSlots).toEqual(slots);expect(engine.enemies.states[0].health.maximum).toBe(177);expect(engine.enemies.states[0].movement.speed).toBe(config.enemies.dog.speed);
  engine.prepareWave(config.levels[0].waves[2]);expect(engine.enemies.states[0].health.maximum).toBe(config.enemies.dog.maxHealth);expect(engine.enemies.states[0].movement.speed).toBe(config.enemies.dog.speed);expect(config.enemies.dog).toEqual(PLAY_CONFIG.enemies.dog);
 }finally{f.dispose();}
},30000);
function poses(life){return life.states.map(s=>({state:s,rig:s.rig,root:s.rig.root,route:s.route,position:[s.x,s.y,s.z,s.yaw,s.wing],random:s.random,journeys:s.journeys,completed:s.journeysCompleted,flightTime:s.flightTime,from:[s.fromX,s.fromY,s.fromZ],routeValues:s.route?.slice()??null,phase:s.phase,routeLength:s.routeLength,routeIndex:s.routeIndex}));}
function staticSnapshot(f){
 const {world,r}=f;
 return {world,level:world.level,entries:world.entries,visibility:world.visibility,water:world.water,source:JSON.stringify(world.playSource),camera:r.camera,cameraState:[r.camera.yaw,r.camera.pitch,r.camera.radius,...r.camera.target],perches:f.engine.wildlife.perches,staticEntries:world.entries.filter(e=>e.key==='ground'||!e.key.startsWith('turret-study:')&&!e.key.startsWith('dog:')).map(e=>({entry:e,mesh:e.mesh,transforms:e.transforms,draw:r.drawMap.get(e.key)})),waterDraw:r.waterDraw};
}
function assertStatic(f,before){
 const {world,r}=f;expect(world).toBe(before.world);expect(world.level).toBe(before.level);expect(world.entries).toBe(before.entries);expect(world.visibility).toBe(before.visibility);expect(world.water).toBe(before.water);expect(JSON.stringify(world.playSource)).toBe(before.source);expect(r.world).toBe(world);expect(r.camera).toBe(before.camera);expect([r.camera.yaw,r.camera.pitch,r.camera.radius,...r.camera.target]).toEqual(before.cameraState);expect(f.engine.wildlife.perches).toBe(before.perches);expect(r.waterDraw).toBe(before.waterDraw);
 for(const {entry,mesh,transforms,draw}of before.staticEntries){expect(world.entries.includes(entry)).toBe(true);expect(entry.mesh).toBe(mesh);expect(entry.transforms).toBe(transforms);expect(r.drawMap.get(entry.key)).toBe(draw);}
}
function assertCurrentPoses(life,before){
 expect(life.states).toHaveLength(before.length);
 for(let i=0;i<before.length;i++){const b=before[i],s=life.states[i];expect(s).toBe(b.state);expect(s.rig).toBe(b.rig);expect(s.rig.root).toBe(b.root);expect(s.route).toBe(b.route);expect([s.x,s.y,s.z,s.yaw,s.wing]).toEqual(b.position);expect(s.random).toBe(b.random);expect(s.journeys).toBe(b.journeys);expect(s.journeysCompleted).toBe(b.completed);}
}
function advanceCosmetics(engine,seconds){for(let frame=0;frame<seconds*30;frame++)engine.advance(1/30,{combat:false});}
function prepare(f,rows){const result=f.rules.prepare(rows);expect(result.valid).toBe(true);return result;}
function commit(f,rows,{attempts=120}={}){
 const arrangement=prepare(f,rows);
 for(let attempt=0;attempt<attempts;attempt++){
  const before=poses(f.engine.wildlife),time=f.engine.wildlife.time,levelBefore=JSON.stringify(f.world.level.placements),result=f.engine.updateDeployments(rows,{wildlifePoints:arrangement.wildlifePoints});
  expect(f.engine.wildlife.time).toBe(time);assertCurrentPoses(f.engine.wildlife,before);
  if(result.valid)return {before,result};
  expect(result.reason.length).toBeGreaterThan(0);expect(JSON.stringify(f.world.level.placements)).toBe(levelBefore);
  advanceCosmetics(f.engine,.1);
 }
 throw new Error('Deployment remained unavailable after wildlife had time to move.');
}
function assertRoutePreserved(s,b){
 expect(s.phase).toBe(b.phase);expect(s.routeLength).toBe(b.routeLength);expect(s.routeIndex).toBe(b.routeIndex);expect(s.route).toEqual(b.routeValues);expect(s.flightTime).toBe(b.flightTime);expect([s.fromX,s.fromY,s.fromZ]).toEqual(b.from);
}

test('real A1/A2 deployment edits retain landscape, camera, wildlife identities and valid journey progress',async()=>{
 for(const id of ['moss-01','moss-02']){
  const f=await fixture(id),{engine,world,r,rules}=f;
  try{
   const life=engine.wildlife;r.camera.yaw=1.7;r.camera.pitch=.82;r.camera.radius=211;r.camera.target.set([203,28,169]);
   const before=staticSnapshot(f),gpuBuffers=[...r.sceneBuffers],created=r.createdSceneBuffers,destroyed=r.destroyedSceneBuffers,drawArrays=r.draws.map(d=>[d,d.transforms,d.packedTransforms,d.indexToSlot,d.slotToIndex]);
   const boxes=id==='moss-01'?[[2,0,7],[9,0,10]]:[[5,0,5],[8,0,8]],first=placement(boxes[0]),second=placement(boxes[1],'base','player-gun-2');
   commit(f,[first]);const fixedRig=world.rigs.get(first.id);expect(fixedRig).toBeDefined();commit(f,[first,second]);expect(world.rigs.get(first.id)).toBe(fixedRig);
   advanceCosmetics(engine,6);expect(life.states.some(s=>s.kind==='bird'&&s.phase==='flying')).toBe(true);expect(life.states.some(s=>s.kind==='ground'&&s.journeys>0)).toBe(true);
   const fixedSecond=world.rigs.get(second.id),fixedRoot=fixedSecond.root;
   const alternatives=rules.eligibleCells('upgrade2',[second],first.id).filter(c=>c.valid&&JSON.stringify(c.box)!==JSON.stringify(first.box)&&rules.check(c.box,'base',[second],first.id).valid&&rules.check(c.box,'upgrade1',[second],first.id).valid);
   alternatives.sort((a,b)=>Math.min(...life.states.filter(s=>s.kind==='ground').map(s=>Math.hypot((b.box[0]+.5)*24-s.x,(b.box[2]+.5)*24-s.z)))-Math.min(...life.states.filter(s=>s.kind==='ground').map(s=>Math.hypot((a.box[0]+.5)*24-s.x,(a.box[2]+.5)*24-s.z))));
   const moved=placement(alternatives[0].box);commit(f,[moved,second]);expect(world.rigs.get(second.id)).toBe(fixedSecond);expect(world.rigs.get(second.id).root).toBe(fixedRoot);
   const upgraded={...moved,variant:'upgrade1'};commit(f,[upgraded,second]);expect(world.rigs.get(upgraded.id).variant).toBe('upgrade1');expect(world.rigs.get(second.id)).toBe(fixedSecond);
   const top={...upgraded,variant:'upgrade2'};commit(f,[top,second]);expect(world.rigs.get(top.id).variant).toBe('upgrade2');expect(engine.firing.states.find(s=>s.id===top.id)?.strength).toBe(14);expect(world.rigs.get(second.id)).toBe(fixedSecond);
   const removal=commit(f,[second]);for(let i=0;i<life.states.length;i++)assertRoutePreserved(life.states[i],removal.before[i]);
   const empty=commit(f,[]);for(let i=0;i<life.states.length;i++)assertRoutePreserved(life.states[i],empty.before[i]);
   expect(world.rigs.has(first.id)).toBe(false);expect(world.rigs.has(second.id)).toBe(false);expect(engine.wildlife).toBe(life);assertStatic(f,before);
   expect([...r.sceneBuffers]).toEqual(gpuBuffers);expect(r.createdSceneBuffers).toBe(created);expect(r.destroyedSceneBuffers).toBe(destroyed);
   for(const [draw,transforms,packed,indexToSlot,slotToIndex]of drawArrays){expect(r.drawMap.get(draw.key)).toBe(draw);expect(draw.transforms).toBe(transforms);expect(draw.packedTransforms).toBe(packed);expect(draw.indexToSlot).toBe(indexToSlot);expect(draw.slotToIndex).toBe(slotToIndex);}
   advanceCosmetics(engine,75);for(const s of life.states)expect(s.journeysCompleted).toBeGreaterThan(0);
  }finally{f.dispose();}
  expect(f.gpu.buffers.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(world.visibility).toBeNull();expect(world.entries).toEqual([]);expect(engine.wildlife.world).toBeNull();
 }
},30000);

test('repeated deployment edits reuse fixed instance/light capacity and release every scene buffer exactly once',async()=>{
 const f=await fixture('moss-01'),{engine,world,r}=f;
 try{
  const base=placement([2,0,7]),moved=placement([9,0,10]),upgraded={...moved,variant:'upgrade1'},top={...moved,variant:'upgrade2'},rows=[[base],[moved],[upgraded],[top],[]],prepared=rows.map(row=>prepare(f,row));
  const before=staticSnapshot(f),buffers=[...r.sceneBuffers],totalBuffers=f.gpu.buffers.length,created=r.createdSceneBuffers,destroyed=r.destroyedSceneBuffers,draws=r.draws.map(d=>[d,d.transforms,d.packedTransforms]),routes=engine.wildlife.states.map(s=>s.route),navBytes=engine.wildlife.planningBytes,entries=world.entries.length;
  for(let cycle=0;cycle<24;cycle++)for(let step=0;step<rows.length;step++){
   const wildlife=poses(engine.wildlife),result=engine.updateDeployments(rows[step],{wildlifePoints:prepared[step].wildlifePoints});expect(result.valid).toBe(true);assertCurrentPoses(engine.wildlife,wildlife);r.flushInstances();r.modelLights.prepare();
   expect(world.entries).toHaveLength(entries);expect(r.modelLights.sources.length).toBeLessThanOrEqual(playCapacity(PLAY_CONFIG).modelLights);expect(r.modelLights.count).toBe(step===4?0:step===3?2:3);expect(r.modelLights.overflow).toBe(0);expect(engine.wildlife.planningBytes).toBeLessThanOrEqual(navBytes+world.width*world.length);expect(engine.wildlife.states.map(s=>s.route)).toEqual(routes);
  }
  assertStatic(f,before);expect([...r.sceneBuffers]).toEqual(buffers);expect(r.createdSceneBuffers).toBe(created);expect(r.destroyedSceneBuffers).toBe(destroyed);expect(f.gpu.buffers).toHaveLength(totalBuffers);
  for(const [draw,transforms,packed]of draws){expect(r.drawMap.get(draw.key)).toBe(draw);expect(draw.transforms).toBe(transforms);expect(draw.packedTransforms).toBe(packed);}
 }finally{f.dispose();}
 expect(f.gpu.buffers.every(buffer=>buffer.destroyCalls===1)).toBe(true);expect(r.sceneBuffers.size).toBe(0);expect(r.drawMap.size).toBe(0);expect(engine.wildlife.states).toEqual([]);
},60000);

test('same-map wave preparation reuses Dog slots, hides old IDs and preserves wildlife/camera without fetching',async()=>{
 const f=await fixture('moss-01'),{engine,world,r}=f,native=globalThis.fetch;
 try{
  const gun=placement([9,0,10],'upgrade1');commit(f,[gun]);
  globalThis.fetch=()=>{throw new Error('Same-map changes must not fetch assets.');};
  engine.startWave();for(let frame=0;frame<180*30&&!engine.completed;frame++)engine.advance(1/30);
  expect(engine.completed).toBe(true);expect(engine.enemies.resolved).toBe(3);r.flushInstances();r.modelLights.prepare();
  const before=staticSnapshot(f),life=engine.wildlife,posesBefore=poses(life),time=life.time,buffers=[...r.sceneBuffers],created=r.createdSceneBuffers,destroyed=r.destroyedSceneBuffers,gunRig=world.rigs.get(gun.id),slots=world.playDogSlots,slotRigs=slots.slice(),lightData=r.modelLights.data,oldIds=engine.enemies.states.map(s=>s.id),wave=PLAY_CONFIG.levels[0].waves[1];
  engine.prepareWave(wave);expect(engine.wave).toBe(wave);expect(engine.enemies.states).toHaveLength(wave.spawns.length);expect(engine.enemies.states.map(s=>s.id)).toEqual(wave.spawns.map(s=>s.id));expect(engine.enemies.activeTargets).toEqual([]);expect(engine.enemies.spawned).toBe(0);expect(engine.wildlife).toBe(life);expect(life.time).toBe(time);assertCurrentPoses(life,posesBefore);
  for(let i=0;i<life.states.length;i++)assertRoutePreserved(life.states[i],posesBefore[i]);
  expect(world.playDogSlots).toBe(slots);for(let i=0;i<slots.length;i++)expect(slots[i]).toBe(slotRigs[i]);expect(slots).toHaveLength(playCapacity(PLAY_CONFIG).maxWaveEnemiesBySpecies.dog);
  for(const id of oldIds)expect(world.actors.has(id)).toBe(false);
  for(const state of engine.enemies.states){expect(state.phase).toBe('scheduled');for(const instance of world.actors.get(state.id).instances)expect(r.drawMap.get(instance.key).indexToSlot[instance.index]).toBe(-1);}
  expect(world.rigs.get(gun.id)).toBe(gunRig);expect(r.modelLights.data).toBe(lightData);assertStatic(f,before);expect([...r.sceneBuffers]).toEqual(buffers);expect(r.createdSceneBuffers).toBe(created);expect(r.destroyedSceneBuffers).toBe(destroyed);
  expect(engine.startWave()).toBe(true);expect(engine.enemies.spawned).toBe(1);const first=engine.enemies.states[0];expect(first.id).toBe(wave.spawns[0].id);for(const instance of world.actors.get(first.id).instances)expect(r.drawMap.get(instance.key).indexToSlot[instance.index]).toBeGreaterThanOrEqual(0);
  for(let frame=0;frame<180*30&&!engine.completed;frame++)engine.advance(1/30);
  expect(engine.completed).toBe(true);expect(engine.enemies.resolved).toBe(wave.spawns.length);expect(engine.enemies.pending).toBe(0);expect(engine.enemies.activeTargets).toEqual([]);expect(world.playDogSlots).toBe(slots);expect(r.modelLights.data).toBe(lightData);assertStatic(f,before);expect([...r.sceneBuffers]).toEqual(buffers);expect(r.createdSceneBuffers).toBe(created);expect(r.destroyedSceneBuffers).toBe(destroyed);
 }finally{globalThis.fetch=native;f.dispose();}
 expect(f.gpu.buffers.every(buffer=>buffer.destroyCalls===1)).toBe(true);
},30000);

test('an animal on legal build ground respawns safely while deployment commits in place',async()=>{
 const f=await fixture('moss-01'),{engine,world,r,rules}=f;
 try{
  const cells=rules.eligibleCells('base').filter(c=>c.valid);let crossing=null;
  for(let frame=0;frame<180*30&&!crossing;frame++){
   engine.advance(1/30,{combat:false});
   for(const s of engine.wildlife.states)if(s.kind==='ground'){
    const candidate=cells.find(c=>Math.hypot((c.box[0]+.5)*24-s.x,(c.box[2]+.5)*24-s.z)<s.radius+7);
    if(candidate){crossing=candidate;break;}
   }
  }
  expect(crossing).not.toBeNull();const rows=[placement(crossing.box)],arrangement=prepare(f,rows),life=engine.wildlife,prior=poses(life),nav=life.nav,defences=life.defences,placements=world.level.placements,rigs=[...world.rigs],draws=[...r.drawMap],buffers=[...r.sceneBuffers],created=r.createdSceneBuffers;
  const result=engine.updateDeployments(rows,{wildlifePoints:arrangement.wildlifePoints});expect(result.valid).toBe(true);
  let relocated=0;
  for(let i=0;i<life.states.length;i++){
   const s=life.states[i],before=prior[i];expect(s.rig).toBe(before.rig);expect(s.route).toBe(before.route);expect(s.random).toBe(before.random);
   if([s.x,s.y,s.z].some((v,j)=>v!==before.position[j])){relocated++;expect(s.kind).toBe('ground');expect(s.phase).toBe('idle');expect(s.edgeNode).toBe(-1);expect(life.nav.heights[s.node]).toBe(s.y);expect(life.nav.starts[s.groundComponent+1]-life.nav.starts[s.groundComponent]).toBeGreaterThanOrEqual(64);expect(Math.hypot((crossing.box[0]+.5)*24-s.x,(crossing.box[2]+.5)*24-s.z)).toBeGreaterThan(s.radius+7);}
   else assertRoutePreserved(s,before);
  }
  expect(relocated).toBeGreaterThan(0);expect(life.nav).not.toBe(nav);expect(life.defences).not.toBe(defences);expect(world.rigs.has('player-gun-1')).toBe(true);expect(r.createdSceneBuffers).toBe(created);expect([...r.sceneBuffers]).toEqual(buffers);
  const completed=life.states.map(s=>s.journeysCompleted);advanceCosmetics(engine,90);for(let i=0;i<life.states.length;i++)expect(life.states[i].journeysCompleted).toBeGreaterThan(completed[i]);

 }finally{f.dispose();}
 expect(f.gpu.buffers.every(buffer=>buffer.destroyCalls===1)).toBe(true);
},30000);

test('blocking a future ground route replans only affected journeys without moving current wildlife poses',async()=>{
 const f=await fixture('moss-01'),{engine,world,rules}=f;
 try{
  const cells=rules.eligibleCells('base').filter(c=>c.valid),lastAttempt=new Map();let changed=null;
  for(let frame=0;frame<180*30&&!changed;frame++){
   engine.advance(1/30,{combat:false});const life=engine.wildlife,nav=life.nav;
   search:for(const s of life.states)if(s.kind==='ground'&&(s.phase==='hop'||s.phase==='scuttle'))for(let i=s.routeIndex+8;i<s.routeLength;i+=3){
    const node=s.route[i],x=(node%nav.cols+.5)*4,z=(Math.floor(node/nav.cols)+.5)*4,candidate=cells.find(c=>Math.hypot((c.box[0]+.5)*24-x,(c.box[2]+.5)*24-z)<s.radius+6&&Math.hypot((c.box[0]+.5)*24-s.x,(c.box[2]+.5)*24-s.z)>36);
    if(!candidate)continue;const key=candidate.box.join(',');if((lastAttempt.get(key)??-Infinity)>life.time-1)continue;lastAttempt.set(key,life.time);
    const before=poses(life),result=engine.updateDeployments([placement(candidate.box)]);
    if(result.valid){changed={before,animal:s};break search;}
   }
  }
  expect(changed).not.toBeNull();const life=engine.wildlife;assertCurrentPoses(life,changed.before);let interrupted=0,retained=0;
  for(let i=0;i<life.states.length;i++){
   const s=life.states[i],b=changed.before[i],routeChanged=s.routeLength!==b.routeLength||s.routeIndex!==b.routeIndex||s.phase!==b.phase;
   if(routeChanged){expect(s.kind).toBe('ground');expect(s.routeLength).toBeLessThanOrEqual(1);interrupted++;}
   else{assertRoutePreserved(s,b);retained++;}
  }
  expect(interrupted).toBeGreaterThan(0);expect(retained).toBeGreaterThanOrEqual(3);const completions=life.states.map(s=>s.journeysCompleted);advanceCosmetics(engine,90);
  for(let i=0;i<life.states.length;i++)expect(life.states[i].journeysCompleted).toBeGreaterThan(completions[i]);expect(world.rigs.has('player-gun-1')).toBe(true);
 }finally{f.dispose();}
 expect(f.gpu.buffers.every(buffer=>buffer.destroyCalls===1)).toBe(true);
},30000);

test('a bird occupying build ground returns to a clear supported perch without replacing its actor',async()=>{
 const f=await fixture('moss-01');try{
  const cell=f.rules.eligibleCells('base').find(c=>c.valid),bird=f.engine.wildlife.states.find(s=>s.kind==='bird'),rig=bird.rig;
  bird.x=(cell.box[0]+.5)*24;bird.y=f.world.level.pathHeight+5;bird.z=(cell.box[2]+.5)*24;f.engine.wildlife.writePose(bird,true);
  const result=f.engine.updateDeployments([placement(cell.box)]);expect(result.valid).toBe(true);expect(bird.rig).toBe(rig);expect(bird.phase).toBe('perched');expect(bird.flight).toBe(false);expect(bird.goalPerch).toBe(-1);
  const p=f.engine.wildlife.perches[bird.perch];expect([bird.x,bird.y,bird.z]).toEqual([p.x,p.y,p.z]);expect(bird.y).toBeGreaterThan(f.world.level.pathHeight+10);
  const complete=bird.journeysCompleted;advanceCosmetics(f.engine,90);expect(bird.journeysCompleted).toBeGreaterThan(complete);
 }finally{f.dispose();}
},30000);
