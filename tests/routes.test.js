import {test,expect} from 'bun:test';
import {newLevel,validateLevel,upgradeLevel} from '../shared/level.js';
import {levelRoutes,routePath,pathBoxUnion,actorRouteId,MAX_LEVEL_ROUTES,MAX_ROUTE_POINTS} from '../shared/routes.js';
import {TerrainField,setPathHeight} from '../shared/terrain.js';
import {newModel} from '../shared/model.js';
import {buildWorld,disposeWorld,terrainGeometry} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {PathMotion} from '../engine/path-motion.js';
import {TargetPlanner} from '../engine/target-planner.js';
import {WeaponCycle} from '../engine/weapon.js';
import {TURRET_FIRING} from '../shared/arsenal.js';
import {DefenceAim} from '../engine/targeting.js';
import {Health} from '../engine/health.js';
import {Camera} from '../engine/camera.js';

function source(){
 const level=newLevel('routes-study');level.size=[10,10];
 level.path=[[1,0,4],[2,0,4],[3,0,4],[4,0,4],[5,0,4],[6,0,4]];
 level.routes=[{id:'north',path:[[4,0,1],[4,0,2],[4,0,3],[4,0,4],[5,0,4],[6,0,4]]}];return level;
}
const clone=structuredClone;
test('additional fixed routes preserve the legacy primary source and round-trip stable assignments',()=>{
 const level=source();level.actorRoutes={'actor-a':'north'};const before=JSON.stringify(level);
 expect(validateLevel(level)).toBe(level);expect(levelRoutes(level).map(r=>r.id)).toEqual(['main','north']);
 expect(routePath(level)).toBe(level.path);expect(routePath(level,'north')).toBe(level.routes[0].path);expect(routePath(level,'missing')).toBeNull();
 expect(actorRouteId(level,{id:'actor-a'})).toBe('north');expect(actorRouteId(level,{id:'actor-b'})).toBe('main');expect(actorRouteId(level,{id:'actor-a',routeId:'main'})).toBe('main');
 expect(pathBoxUnion(level)).toHaveLength(9);expect(JSON.stringify(level)).toBe(before);expect(upgradeLevel(JSON.parse(before))).toEqual(level);
 const legacy=newLevel('legacy');legacy.path=clone(level.path);expect(validateLevel(legacy)).toBe(legacy);expect(levelRoutes(legacy)).toEqual([{id:'main',path:legacy.path}]);expect(pathBoxUnion(legacy)).toEqual(legacy.path);
});
test('route validation rejects ambiguous crossings, splits, reverse edges, repeats and invalid assignments',()=>{
 const cases=[
  l=>l.routes[0].id='main',l=>l.routes.push(clone(l.routes[0])),l=>l.routes[0].path.push([6,0,4]),
  l=>l.routes[0].path[0]=[4,0,0],l=>l.routes[0].path[0][1]=1,l=>l.routes[0].path[0][0]=10,
  l=>l.routes[0].path=[[4,0,3],[4,0,4],[4,0,5]],
  l=>l.routes[0].path=[[6,0,4],[5,0,4],[4,0,4]],
  l=>l.routes[0].path=[[4,0,3],[4,0,4],[4,0,5],[5,0,5],[5,0,4],[6,0,4]],
  l=>l.routes[0].path=[[1,0,1],[2,0,1]],l=>l.routes[0].path=[],l=>l.path=[],
  l=>l.actorRoutes={'actor-a':'missing'},l=>l.actorRoutes=[],l=>l.routes=Array(MAX_LEVEL_ROUTES).fill(l.routes[0]),
  l=>l.path=Array(MAX_ROUTE_POINTS+1).fill([1,0,4]),
 ];for(const modify of cases){const level=source();modify(level);expect(()=>validateLevel(level)).toThrow();}
 const bad=source();bad.terrain.boxes=[{box:[4,2],ground:4,water:12}];expect(()=>validateLevel(bad)).toThrow('flat and dry');
});
test('terrain protects the entire route union and paves shared tails exactly once',()=>{
 const level=source(),field=new TerrainField(level);expect(field.paint(4,2,'water',8).protectedCount).toBe(1);expect(field.paint(1,4,'raise').protectedCount).toBe(1);
 setPathHeight(level,25);for(const box of pathBoxUnion(level))expect(new TerrainField(level).flatBox(box[0],box[2])).toBe(25);expect(new TerrainField(level).flatBox(0,0)).toBe(24);validateLevel(level);
 for(const zone of ['A','B','C','D']){
  level.zone=zone;level.environment={timeOfDay:10,sky:{direction:[0,1,0],color:'#ffffff',intensity:1,ambient:'#ffffff',ambientIntensity:1}};
  const {ground}=terrainGeometry(level),coverage=new Uint8Array(level.size[0]*level.size[1]*48*48),width=level.size[0]*48;
  for(const q of ground.quads)if(q.axis===1&&q.sign===1)for(let z=q.origin[2]*2;z<(q.origin[2]+q.width)*2;z++)for(let x=q.origin[0]*2;x<(q.origin[0]+q.height)*2;x++)coverage[z*width+x]++;
  expect(coverage.every(count=>count===1)).toBe(true);
  // A branch-only box receives the path surface too, not the off-route shoulder.
  const branch=ground.quads.filter(q=>q.axis===1&&q.sign===1&&q.origin[0]>=96&&q.origin[0]<120&&q.origin[2]>=48&&q.origin[2]<72);
  expect(branch.length).toBeGreaterThan(1);expect(branch.every(q=>q.origin[1]===25)).toBe(true);
 }
});
test('world clearance rejects scenery and offset props on the additional approach',()=>{
 const model=newModel('test-prop');model.variants.base.parts[0].voxels=[[12,0,12,0]];const models=new Map([[model.id,model]]),level=source();
 level.placements=[{id:'obstacle',model:model.id,variant:'base',box:[4,0,2],turn:0}];expect(()=>buildWorld(level,models)).toThrow('blocks the enemy route');
 level.placements[0].kind='detail';expect(()=>validateLevel(level,models)).toThrow('enemy path');
 level.placements[0].box=[3,0,2];level.placements[0].offset=[13,0,0];expect(()=>validateLevel(level,models)).toThrow('enemy path');
});
test('actors retain complete route identity, gait and claim-relevant lap through a merge and reset',async()=>{
 const level=source();level.actorRoutes={'north-dog':'north','north-roller':'north','north-moth':'north'};
 const actors=[{id:'main-dog',model:'dog',variant:'base',distance:71.9},{id:'north-dog',model:'dog',variant:'base',distance:71.9},{id:'north-roller',model:'roller',variant:'base',distance:48},{id:'north-moth',model:'moth',variant:'base',distance:24}];
 const models=new Map(await Promise.all(['dog','roller','moth'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()]))),before=JSON.stringify(level),world=buildWorld(level,models,{actors}),preview=new EnemyPreview(world,()=>{},null,actors);
 try{
  const [a,b]=preview.states,paths=preview.states.map(s=>s.path),matrices=preview.states.map(s=>s.rig.bones.map(b=>b.instance.matrix));
  expect(a.routeId).toBe('main');expect(b.routeId).toBe('north');expect(a.path).not.toBe(b.path);expect(preview.paths.size).toBe(3);
  preview.advance(.02);expect(a.lap).toBe(0);expect(b.lap).toBe(0);expect(a.distance).toBeCloseTo(72.14);expect(b.distance).toBeCloseTo(72.14);expect(a.x).toBeCloseTo(b.x);expect(a.z).toBeCloseTo(b.z);
  for(let i=0;i<preview.states.length;i++){expect(preview.states[i].path).toBe(paths[i]);for(let j=0;j<matrices[i].length;j++)expect(preview.states[i].rig.bones[j].instance.matrix).toBe(matrices[i][j]);}
  preview.advance(34);for(const s of preview.states)expect(s.lap).toBe(Math.floor((s.seed+34.02*s.movement.speed)/s.path.length));
  preview.takeHit(b,1e6);const frozen=b.rig.root.slice();preview.advance(.5);expect(b.rig.root).toEqual(frozen);
  preview.reset();for(const s of preview.states){expect(s.distance).toBe(s.seed%s.path.length);expect(s.health.alive).toBe(true);expect(s.routeId).toBe(level.actorRoutes[s.id]??'main');}
  expect(JSON.stringify(level)).toBe(before);
 }finally{preview.dispose();disposeWorld(world);}expect(preview.paths.size).toBe(0);expect(world.actors.size).toBe(0);
});
function gun(id){return {id,x:0,z:0,strength:10,windows:[],targeting:new DefenceAim(TURRET_FIRING.base,1000),cycle:new WeaponCycle(TURRET_FIRING.base),recoil:{sample:()=>0}};}
function target(id,path,distance,routeId){return {id,path,routeId,distance,lap:0,aimY:34,movement:{speed:12},x:0,z:0,health:new Health(300),threat:1};}
test('planner profiles route plus height once and compares real time to exit across unequal approaches',()=>{
 const level=source();level.path.unshift([0,0,4]);const main=new PathMotion(level.path,0),north=new PathMotion(level.routes[0].path,0),targets=[target('main-a',main,72,'main'),target('north-a',north,72,'north'),target('north-b',north,72,'north')],states=[gun('first'),gun('second')];let probes=0;
 const planner=new TargetPlanner(states,targets,{path:main,eligible:()=>true,coverageVisible:(_s,p)=>{probes++;return p.z>=100;}});
 expect(probes).toBe(2*(main.length+north.length+2));expect(planner.coverage[0].get(targets[1])).toBe(planner.coverage[0].get(targets[2]));expect(planner.coverage[0].get(targets[0])).not.toBe(planner.coverage[0].get(targets[1]));
 expect(planner.score(targets[1],states[0])).toBeGreaterThan(planner.score(targets[0],states[0]));
 planner.advance(1/60);expect(states[0].target).toBe(targets[1]);expect(planner.thinks).toBe(1);expect(states[1].thinkCount).toBe(0);
 const profile=planner.coverage[1].get(targets[1]);expect(profile.path).toBe(north);expect(planner.capacity(1,targets[1])).toBeGreaterThan(0);
 targets[1].routeId='unknown';expect(planner.capacity(1,targets[1])).toBe(0);targets[1].routeId='north';
 states[1].reservation=targets[1];states[1].reservationLap=0;expect(planner.commitment(1,targets[2])).toBe(false);expect(planner.coverageDamage(targets[2],0)).toBe(0);
 planner.reset();expect(states.every(s=>s.target===null&&s.reservation===null)).toBe(true);planner.dispose();expect(planner.coverage).toHaveLength(0);
});
test('path camera can start on either complete route and releases route references',()=>{
 const canvas={clientWidth:800,clientHeight:600,focus(){},addEventListener(){}},camera=new Camera(canvas,()=>{}),level=source();camera.setLevel(level);
 camera.toggleMode(()=>0);expect(camera.routeId).toBe('main');expect([...camera.position]).toEqual([36,36,108]);camera.toggleMode();
 camera.toggleMode(()=>.5);expect(camera.routeId).toBe('north');expect([...camera.position]).toEqual([108,36,36]);camera.clearLevel();expect(camera.routes).toBeNull();expect(camera.routeId).toBeNull();
});
test('workshop route plan draws the union and the selected complete chain without changing the document',async()=>{
 const code=await Bun.file(new URL('../tools/app.js',import.meta.url)).text(),start=code.indexOf('function drawLevelGrid()'),end=code.indexOf('\nfunction bindLevelGrid()',start),draw=code.slice(start,end),rects=[];
 const ctx=new Proxy({fillRect(...r){rects.push(r);}}, {get(target,key){return target[key]??(()=>{});},set(target,key,value){target[key]=value;return true;}}),canvas={width:600,height:600,getContext:()=>ctx},level=source(),before=JSON.stringify(level);
 const run=new Function('$','mode','levelDoc','planTransform','drawTerrainPlan','pathBoxUnion','routePath','selectedRoute','layer','ZONES','planMode','terrainX','terrainZ',draw+';drawLevelGrid();');
 run(()=>canvas,'level',{data:level},()=>({x:0,z:0,unit:24}),()=>{},pathBoxUnion,routePath,'north',0,{},'layout',0,0);
 expect(rects.some(r=>r[0]===97&&r[1]===25)).toBe(true);expect(rects.some(r=>r[0]===25&&r[1]===97)).toBe(true);expect(JSON.stringify(level)).toBe(before);
});
