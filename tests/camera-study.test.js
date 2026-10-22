import {test,expect,afterAll} from 'bun:test';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cameraStudyStore,validateStudyShot} from '../server/camera-study.js';
import {STUDY_SCENARIOS} from '../tools/camera-study-scenarios.js';
import {createStudyScene,advanceStudyScene,describeStudyScene,captureStudyCamera,restoreStudyCamera} from '../tools/camera-study-scene.js';
import {Camera} from '../engine/camera.js';

const directory=await mkdtemp(join(tmpdir(),'camera-study-')),store=cameraStudyStore(directory),origin='http://127.0.0.1:4290';
afterAll(()=>rm(directory,{recursive:true,force:true}));
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';
function payload(){return {camera:{position:[200,170,-60],yaw:.7,pitch:.6,fov:64,roll:0,viewport:[1280,720]},scene:{version:1,scenarioId:'split',levelId:'zone-b-ochre-04',waveId:'b4-wave-4',seconds:30,placements:[],enemies:[],defences:[],missiles:[],activity:[]},verdict:'preferred',notes:'Show both fronts and more of the board.',image};}
const post=(body,headers={})=>store(new Request(origin+'/api/camera-study/shots',{method:'POST',headers:{'content-type':'application/json',origin,...headers},body:JSON.stringify(body)}));

test('study examples persist matching notes, camera, state and PNG with unique append-only identities',async()=>{
 const input=payload(),response=await post(input);expect(response.status).toBe(201);const first=await response.json();
 expect(first.notes).toBe(input.notes);expect(first.camera).toEqual(input.camera);expect(first.scene).toEqual(input.scene);
 expect(await readFile(join(directory,first.id+'.png'))).toEqual(Buffer.from(image.slice(22),'base64'));
 const second=await(await post({...input,verdict:'avoid',notes:'Too steep.'})).json();expect(second.id).not.toBe(first.id);
 const list=await(await store(new Request(origin+'/api/camera-study/shots'))).json();expect(list.map(s=>s.id)).toContain(first.id);expect(list.map(s=>s.id)).toContain(second.id);expect(await readdir(directory)).toHaveLength(4);
 expect((await store(new Request(origin+'/api/camera-study/shots',{method:'DELETE'}))).status).toBe(405);
});
test('study storage rejects cross-origin writes, malformed poses and oversized or invalid records',async()=>{
 expect((await post(payload(),{origin:'https://example.com'})).status).toBe(403);
 expect((await post(payload(),{'sec-fetch-site':'cross-site'})).status).toBe(403);
 const missing=new Request(origin+'/api/camera-study/shots',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload())});expect((await store(missing)).status).toBe(403);
 for(const mutate of [p=>p.camera.position[0]=NaN,p=>p.camera.fov=0,p=>p.camera.viewport=[0,0],p=>p.scene.seconds=121,p=>p.scene.scenarioId='../escape',p=>p.notes='x'.repeat(4001),p=>p.image='data:text/html;base64,AA==',p=>p.scene.enemies=new Array(513).fill({})]){const p=payload();mutate(p);expect(()=>validateStudyShot(p)).toThrow();expect((await post(p)).status).toBe(400);}
 expect(await store(new Request(origin+'/api/other'))).toBeNull();
});

async function withAssets(run){
 const previous=globalThis.fetch;
 globalThis.fetch=async url=>{const match=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);if(!match)throw new Error('Unexpected asset URL '+url);return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${match[1]}/${match[2]}.json`,import.meta.url)).json()})};};
 try{return await run();}finally{globalThis.fetch=previous;}
}
test('all chaos presets use real waves and legal armies and produce living enemies with finite scene records',()=>withAssets(async()=>{
 for(const recipe of STUDY_SCENARIOS){
  const scene=await createStudyScene(recipe);
  try{
   await advanceStudyScene(scene,recipe.seconds,{yieldControl:async()=>{}});
   const snapshot=describeStudyScene(scene);expect(snapshot.enemies.length).toBeGreaterThan(0);expect(snapshot.placements).toEqual(recipe.placements);expect(snapshot.defences).toHaveLength(recipe.placements.length);expect(snapshot.seconds).toBeCloseTo(recipe.seconds,6);
   if(recipe.id==='quiet')expect(snapshot.activity).toHaveLength(0);if(recipe.id==='patrol')expect(snapshot.defences).toHaveLength(0);if(recipe.id==='exit')expect(snapshot.enemies.some(e=>e.routeLength-e.distance<100)).toBe(true);
   for(const defence of snapshot.defences)expect(defence.position.every(Number.isFinite)).toBe(true);
   for(const enemy of snapshot.enemies){expect(enemy.position.every(Number.isFinite)).toBe(true);expect(enemy.aim.every(Number.isFinite)).toBe(true);expect(enemy.health).toBeGreaterThan(0);}
   expect(()=>validateStudyShot({...payload(),scene:snapshot})).not.toThrow();
   console.log(JSON.stringify({scenario:recipe.id,time:snapshot.seconds,enemies:snapshot.enemies.length,weapons:snapshot.defences.length,recentEvents:snapshot.activity.length,nearExit:snapshot.enemies.filter(s=>s.routeLength-s.distance<100).length}));
  }finally{scene.dispose();}
 }
}),30000);
test('replaying a frozen battle reproduces actors, shots and effects; free camera work does not advance it',()=>withAssets(async()=>{
 const recipe=STUDY_SCENARIOS.find(s=>s.id==='skirmish');let before;
 for(let replay=0;replay<2;replay++){
  const scene=await createStudyScene(recipe);
  try{
   await advanceStudyScene(scene,24,{yieldControl:async()=>{}});
   const snapshot=describeStudyScene(scene),effects=Array.from(scene.shots.instanceData);
   if(before){expect(snapshot).toEqual(before.snapshot);expect(effects).toEqual(before.effects);}else before={snapshot,effects};
   const c=new Camera({clientWidth:1280,clientHeight:720,addEventListener(){},focus(){}},()=>{});c.setLevel(scene.world.level);restoreStudyCamera(c,payload().camera);const pose=captureStudyCamera(c);c.keys.add('w');c.advance(2);expect(c.position[0]).not.toBe(pose.position[0]);expect(describeStudyScene(scene)).toEqual(snapshot);restoreStudyCamera(c,pose);expect(captureStudyCamera(c)).toEqual(pose);c.dispose();
   await expect(advanceStudyScene(scene,23)).rejects.toThrow();
  }finally{scene.dispose();}
 }
}),15000);
