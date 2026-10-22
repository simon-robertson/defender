import {hasFishWater} from '../shared/fish-habitat.js';
import {test,expect} from 'bun:test';
import {PREVIEW_LEVELS} from '../shared/preview-levels.js';
import {newLevel,validateLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
import {levelRoutes,pathBoxUnion} from '../shared/routes.js';
import {actorsForPreview} from '../game/preview-actors.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {missileActorsForLevel} from '../game/missile-preview.js';
import {DefencePreview} from '../game/defence-preview.js';
import {loadWorld,buildWorld,disposeWorld} from '../engine/world.js';
import {SceneLoader} from '../engine/scene-loader.js';
import {Camera,PATH_CAMERA_HEIGHT} from '../engine/camera.js';

function intersects(a,b,o=0){return a[0]<b[o+3]-1e-5&&a[3]>b[o]+1e-5&&a[1]<b[o+4]-1e-5&&a[4]>b[o+1]+1e-5&&a[2]<b[o+5]-1e-5&&a[5]>b[o+2]+1e-5;}
function supported(wildlife,world){
 const terrain=new TerrainField(world.level);
 for(const s of wildlife.states){
  expect([s.x,s.y,s.z,s.yaw].every(Number.isFinite)).toBe(true);
  const box=[s.x-s.radius,s.y,s.z-s.radius,s.x+s.radius,s.y+s.height,s.z+s.radius];
  expect(box[0]>=0&&box[2]>=0&&box[3]<=world.width&&box[5]<=world.length).toBe(true);
  const tree=world.visibility;let node=0,blocked=false;
  while(node<tree.nodeCount){if(intersects(box,tree.bounds,node*6)){if(tree.escape[node]===node+1){blocked=true;break;}node++;}else node=tree.escape[node];}
  expect(blocked).toBe(false);
  if(s.kind==='ground'){
   const y=wildlife.nav.heights[s.node];
   for(let z=Math.floor(box[2]/24);z<=Math.floor((box[5]-1e-6)/24);z++)for(let x=Math.floor(box[0]/24);x<=Math.floor((box[3]-1e-6)/24);x++)expect(terrain.flatBox(x,z)).toBe(y);
   expect(s.y).toBeGreaterThanOrEqual(y);expect(s.y).toBeLessThanOrEqual(y+s.hop+1e-8);
  }else if(!s.flight){
   expect(s.y).toBe(wildlife.perches[s.perch].y);
   const m=s.rig.byId.get('body').instance.matrix,cells=world.actors.get(s.id).parts.find(p=>p.id==='body').voxels;
   for(const c of cells)if(c[1]===0){const x=c[0]+.5,z=c[2]+.5,px=m[0]*x+m[8]*z+m[12],py=m[1]*x+m[9]*z+m[13],pz=m[2]*x+m[10]*z+m[14];expect(tree.blocked(px,py-.25,pz,px,py-.01,pz)).toBe(true);}
  }
 }
}

test('landscape mode rejects routes and combat placements while preserving historical actor catalogues',async()=>{
 const level=newLevel('moss-03');level.previewMode='landscape';
 expect(validateLevel(level)).toBe(level);expect(previewActorsForLevel(level)).toEqual([]);expect(missileActorsForLevel(level)).toEqual([]);expect(wildlifeActorsForLevel(level)).toEqual([]);
 expect(previewActorsForLevel(level.id)).toHaveLength(7);expect(missileActorsForLevel(level.id)).toHaveLength(36);
 for(const change of [l=>l.previewMode='unknown',l=>l.path=[[0,0,0]],l=>l.routes=[],l=>l.actorRoutes={}]){const invalid=structuredClone(level);change(invalid);expect(()=>validateLevel(invalid)).toThrow();}
 const turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json();
 level.placements=[{id:'forbidden-defence',model:turret.id,variant:'base',box:[0,0,0],turn:0}];
 expect(()=>validateLevel(level,new Map([[turret.id,turret]]))).toThrow('scenery');
 level.placements=[];const dog=await Bun.file(new URL('../assets/models/dog.json',import.meta.url)).json();
 expect(()=>buildWorld(level,new Map([[dog.id,dog]]),{actors:[{id:'forbidden-enemy',model:dog.id,variant:'base'}]})).toThrow('cosmetic');
});

test('layout mode supports a dry continuous route without restoring catalogue combat or legacy wildlife seeds',async()=>{
 const level=newLevel('moss-03');level.previewMode='layout';level.path=[[0,0,0],[1,0,0],[2,0,0]];
 expect(validateLevel(level)).toBe(level);expect(previewActorsForLevel(level)).toEqual([]);expect(missileActorsForLevel(level)).toEqual([]);expect(wildlifeActorsForLevel(level)).toEqual([]);expect(actorsForPreview(level)).toEqual([]);
 expect(previewActorsForLevel(level.id)).toHaveLength(7);expect(missileActorsForLevel(level.id)).toHaveLength(36);
 expect(previewActorsForLevel({...level,id:'moss-01'})).toEqual([]);expect(previewActorsForLevel({id:'moss-01'})).toHaveLength(7);expect(previewActorsForLevel('moss-01')).toHaveLength(7);
 const world=buildWorld(level,new Map()),enemies=new EnemyPreview(world,()=>{}),firing=new DefencePreview(world,()=>{});
 try{
  const camera=new Camera({addEventListener(){},clientWidth:1200,clientHeight:800,focus(){}},()=>{});camera.setLevel(level);
  expect(camera.toggleMode()).toBe(true);expect(camera.mode).toBe('path');expect(camera.toggleMode()).toBe(true);expect(camera.mode).toBe('overview');
  expect(enemies.states).toEqual([]);expect(enemies.path).toBeNull();expect(firing.states).toEqual([]);expect(firing.planner).toBeNull();expect(firing.missiles.pool).toBeNull();
 }finally{firing.dispose();enemies.dispose();disposeWorld(world);}
 for(const change of [l=>l.path=[],l=>l.path=[[0,0,0]],l=>l.path=[[0,0,0],[2,0,0]],l=>l.terrain.boxes=[{box:[1,0],ground:12,water:20}]]){const invalid=structuredClone(level);change(invalid);expect(()=>validateLevel(invalid)).toThrow();}
 for(const id of ['turret-study','dog','guided-missile']){
  const model=await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json(),library=new Map([[id,model]]),placement={id:'forbidden-placement',model:id,variant:'base',box:[3,0,1],turn:0};
  expect(()=>validateLevel({...level,placements:[placement]},library)).toThrow('scenery');
  expect(()=>buildWorld(level,library,{actors:[{id:'forbidden-actor',model:id,variant:'base'}]})).toThrow('cosmetic');
 }
 const withSilo={...level,placements:[{model:'missile-launcher'}]};expect(missileActorsForLevel(withSilo)).toEqual([]);
});

test('exact cosmetic seed points are copied and malformed or out-of-box points are rejected',()=>{
 const level={id:'moss-01',zone:'A',size:[20,16],previewMode:'landscape',previewWildlife:{habitats:[[1,1],[3,3],[5,5]],habitatPoints:[[30,24,34],[74,24,78],[122,24,126]],perches:[{id:'a',point:[12,44,12]},{id:'b',point:[12,44,12]},{id:'c',point:[12,44,12]}]}};
 const actors=wildlifeActorsForLevel(level);level.previewWildlife.habitatPoints[0][0]=40;expect(actors[0].point).toEqual([30,24,34]);expect(Object.isFrozen(actors[0].point)).toBe(true);
 for(const points of [[],[[0,24,0],[74,24,78],[122,24,126]],[[30,NaN,34],[74,24,78],[122,24,126]]]){const invalid=structuredClone(level);invalid.previewWildlife.habitatPoints=points;expect(()=>wildlifeActorsForLevel(invalid)).toThrow();}
});

test('explicit archived sources keep combat review working and receive identical validation and ID guards',async()=>{
 const sourceLevel=await Bun.file(new URL('../docs/landscape-reset-2026-10-18/previous-levels/moss-03.json',import.meta.url)).json(),nativeFetch=globalThis.fetch,requests=[];
 globalThis.fetch=async url=>{
  requests.push(String(url));const id=/^\/api\/models\/([a-z0-9-]+)$/.exec(String(url))?.[1];if(!id)throw new Error('Review must fetch only models after supplying a source.');
  return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()})};
 };
 let world,enemies,firing;
 try{
  await expect(loadWorld('moss-01',{sourceLevel,actors:actorsForPreview})).rejects.toThrow('does not match');expect(requests).toEqual([]);
  await expect(loadWorld(sourceLevel.id,{sourceLevel:{...sourceLevel,previewMode:'landscape'},actors:actorsForPreview})).rejects.toThrow('no enemy routes');expect(requests).toEqual([]);
  world=await loadWorld(sourceLevel.id,{sourceLevel,actors:actorsForPreview});enemies=new EnemyPreview(world,()=>{});firing=new DefencePreview(world,()=>{},()=>.5,null,enemies.states,null,null,()=>{});
  expect(enemies.states).toHaveLength(7);expect(firing.missiles.states).toHaveLength(3);expect(firing.missiles.pool.slots).toHaveLength(36);expect(world.assetIds).toContain('dog');expect(world.assetIds).toContain('guided-missile');expect(world.level).toBe(sourceLevel);
 }finally{firing?.dispose();enemies?.dispose();disposeWorld(world);globalThis.fetch=nativeFetch;}
});

test('the fifteen remaining noncombat previews request only scenery and cosmetics, animate safely and release before the next load',async()=>{
 const nativeFetch=globalThis.fetch,requested=[],cache=new Map(),released=[];let active=null;
 globalThis.fetch=async url=>{
  const match=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(String(url));if(!match)throw new Error('Unexpected URL '+url);
  if(match[1]==='levels'&&released.length){const prior=released.at(-1);expect(prior.entries).toEqual([]);expect(prior.rigs.size).toBe(0);expect(prior.actors.size).toBe(0);expect(prior.visibility).toBeNull();}
  requested.push(String(url));const path=`../assets/${match[1]}/${match[2]}.json`;
  let asset=cache.get(path);if(!asset){asset=await Bun.file(new URL(path,import.meta.url)).json();cache.set(path,asset);}
  return {ok:true,json:async()=>({asset:structuredClone(asset)})};
 };
 const loader=new SceneLoader({
  load:(id,options)=>loadWorld(id,{...options,actors:actorsForPreview}),discard:disposeWorld,
  activate:world=>{active={world,enemies:new EnemyPreview(world,()=>{}),wildlife:new WildlifePreview(world,()=>{}),firing:new DefencePreview(world,()=>{})};},
  release:world=>{active.enemies.dispose();active.wildlife.dispose();active.firing.dispose();disposeWorld(world);released.push(world);active=null;},
 });
 try{
  for(const profile of PREVIEW_LEVELS.filter(p=>p.level!=='moss-01')){
   const firstRequest=requested.length;expect(await loader.switchTo(profile.level)).toBe(true);
   const {world,enemies,wildlife,firing}=active,source=JSON.stringify(world.level);
   const layout=true,a3=profile.level==='moss-03',b3=profile.level==='ochre-03',routes=levelRoutes(world.level),terrain=new TerrainField(world.level);
   expect(world.level.previewMode).toBe(layout?'layout':'landscape');expect(world.level.size).toEqual([20,16]);expect(world.width).toBe(480);expect(world.length).toBe(384);
   if(layout){for(const route of routes){expect(route.path.length).toBeGreaterThan(1);for(const [x,,z]of route.path)expect(terrain.supportBox(x,z)).toBe(world.level.pathHeight);}}
   else{expect(world.level.path).toEqual([]);expect(world.level.routes).toBeUndefined();expect(world.level.bridges).toBeUndefined();}
   if(a3){
    expect(routes.map(route=>route.id)).toEqual(['main','eastern']);expect(routes.map(route=>route.path.length)).toEqual([33,28]);expect(pathBoxUnion(world.level)).toHaveLength(49);
    expect(world.level.bridges).toEqual([{id:'lower-stream-crossing',boxes:[[14,8]]}]);expect(terrain.flatBox(14,8)).toBeNull();expect(terrain.height(14*24+12,8*24+12,true)).toBe(22);
    expect(previewActorsForLevel(world.level)).toEqual([]);expect(missileActorsForLevel(world.level)).toEqual([]);expect(missileActorsForLevel(world.level.id)).toHaveLength(36);
   }else if(b3){
    expect(routes.map(route=>route.id)).toEqual(['main','eastern']);expect(routes.map(route=>route.path.length)).toEqual([45,31]);expect(pathBoxUnion(world.level)).toHaveLength(52);
    expect(world.level.bridges).toBeUndefined();
   }else if(['A','B'].includes(profile.zone)&&profile.level!=='ochre-04')expect(world.level.routes).toBeUndefined();
   if(profile.zone==='B'){
    expect(routes.map(route=>route.path.length)).toEqual({'ochre-01':[44],'ochre-02':[45],'ochre-03':[45,31],'ochre-04':[31,41]}[profile.level]);
    for(const route of routes){const boundary=([x,,z])=>x===0||z===0||x===19||z===15;expect(boundary(route.path[0])).toBe(true);expect(boundary(route.path.at(-1))).toBe(true);expect(route.path.slice(1,-1).some(boundary)).toBe(false);}
    if(profile.level==='ochre-02'){
     expect(world.level.bridges).toEqual([{id:'river-waist',boxes:[[6,6],[7,6]]}]);
     for(const x of [6,7]){expect(terrain.flatBox(x,6)).toBeNull();expect(terrain.height(x*24+12,6*24+12)).toBe(17);expect(terrain.height(x*24+12,6*24+12,true)).toBe(20);}
    }else if(profile.level==='ochre-04'){expect(world.level.bridges).toEqual([{id:'basin-crossing',boxes:[[2,4],[3,4],[4,4],[5,4],[6,4],[7,4]]}]);}else expect(world.level.bridges).toBeUndefined();
   }
   expect(world.level.actorRoutes).toBeUndefined();
   expect(world.level.placements.length).toBeGreaterThan(0);expect(world.actors.size).toBe(12+world.fishActors.length);expect(world.assetIds).toEqual([...new Set([...world.level.placements.map(p=>p.model),...wildlifeActorsForLevel(world.level).map(a=>a.model),...(hasFishWater(world.level)?['wildlife-fish']:[])])]);
   for(const id of world.assetIds)expect(cache.get(`../assets/models/${id}.json`).role).toBe('scenery');
   expect(requested.slice(firstRequest).filter(url=>url.includes('/models/')).map(url=>url.split('/').at(-1))).toEqual(world.assetIds);
   expect(enemies.states).toEqual([]);expect(enemies.alive).toBe(0);expect(enemies.path).toBeNull();expect(firing.states).toEqual([]);expect(firing.planner).toBeNull();expect(firing.missiles.pool).toBeNull();expect(firing.enhancers.states).toEqual([]);
   expect(wildlife.states).toHaveLength(12);expect(wildlife.states.filter(s=>s.kind==='bird')).toHaveLength(3);expect(wildlife.treePerches.length).toBeGreaterThanOrEqual(3);expect(wildlife.threatSources).toEqual([]);supported(wildlife,world);
   const canvas={addEventListener(){},clientWidth:1200,clientHeight:800,focus(){}},camera=new Camera(canvas,()=>{});camera.setLevel(world.level);
   if(layout)for(let routeIndex=0;routeIndex<routes.length;routeIndex++){
    expect(camera.toggleMode(()=>(routeIndex+.5)/routes.length)).toBe(true);expect(camera.mode).toBe('path');expect(camera.routeId).toBe(routes[routeIndex].id);expect(camera.position[1]).toBe(world.level.pathHeight+PATH_CAMERA_HEIGHT);
    if(a3&&routes[routeIndex].id==='eastern')expect(Array.from(camera.position)).toEqual([14*24+12,world.level.pathHeight+PATH_CAMERA_HEIGHT,8*24+12]);
    expect(camera.toggleMode()).toBe(true);expect(camera.mode).toBe('overview');
   }else{expect(camera.toggleMode()).toBe(false);expect(camera.mode).toBe('overview');}
   if(profile.zone==='B')for(const bridge of world.level.bridges??[])for(const [x,z]of bridge.boxes){
    const routeIndex=routes.findIndex(r=>r.path.some(p=>p[0]===x&&p[2]===z)),route=routes[routeIndex],index=route.path.findIndex(p=>p[0]===x&&p[2]===z);
    expect(camera.toggleMode(()=>(routeIndex+(index+.5)/route.path.length)/routes.length)).toBe(true);expect(camera.routeId).toBe(route.id);expect(Array.from(camera.position)).toEqual([x*24+12,world.level.pathHeight+PATH_CAMERA_HEIGHT,z*24+12]);
    expect(world.visibility.blocked(x*24+12,world.level.pathHeight+.5,z*24+12,x*24+12,world.level.pathHeight-.5,z*24+12)).toBe(true);expect(camera.toggleMode()).toBe(true);
   }
   camera.clearLevel();expect(camera.routes).toBeNull();expect(camera.groundHeights).toBeNull();
   for(let frame=0;frame<240;frame++){wildlife.advance(1/30);expect(wildlife.lastThinkWork).toBeLessThanOrEqual(512);if(frame%30===0)supported(wildlife,world);}
   expect(wildlife.thinkCount).toBe(240);expect(wildlife.states.some(s=>s.journeys>0)).toBe(true);expect(enemies.time).toBe(0);expect(firing.shots).toBe(0);
   const time=wildlife.time;enemies.reset();firing.resetTargets();expect(wildlife.time).toBe(time);expect(enemies.alive).toBe(0);expect(firing.missiles.pool).toBeNull();expect(JSON.stringify(world.level)).toBe(source);
  }
 }finally{loader.dispose();globalThis.fetch=nativeFetch;}
 expect(released).toHaveLength(15);expect(loader.world).toBeNull();expect(active).toBeNull();
},30000);
