import {test,expect} from 'bun:test';
import {createPlacementRules,defenceMovementShapes} from '../play/placement.js';
import {PLAY_CONFIG} from '../play/config.js';
import {newLevel} from '../shared/level.js';
import {DRONE_MODEL as M,DRONE_HULL as H} from '../shared/drone-model.js';
import {DRONE_PREVIEW as T} from '../shared/drone.js';
import {partMatrices} from '../shared/math.js';
import {DroneNavigation} from '../engine/drone-navigation.js';
import {DroneObstacles} from '../engine/drone-obstacles.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {composePlayLevel} from '../play/engine.js';
import {wildlifeActorsForLevel} from '../game/wildlife-preview.js';

const models=new Map(await Promise.all(['dog','moth','turret-study','drone-defence','power-generator','missile-launcher','arc-spire'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
function configuration(source=null,{air=false}={}){
 const config=structuredClone(PLAY_CONFIG);config.startTokens=10;config.defences[M.id]={purchaseCost:1,enabledVariants:['base']};if(air)config.enemies.moth.altitude=36;
 if(source)config.levels=[{id:source.id,waves:[{spawns:[{model:air?'moth':'dog'}]}]}];
 return config;
}
function flat(){const source=newLevel('drone-placement-fixture');source.size=[12,10];source.path=Array.from({length:12},(_,x)=>[x,0,3]);return source;}
const placement=(id='drone',box=[5,0,6],model=M.id)=>({id,model,variant:'base',box,turn:0});
function fixture(source=flat(),options={}){const rules=createPlacementRules(source,models,{config:configuration(source,options),critters:false});return {source,rules};}
function assertNativeHomes(source,placements,modelMap=models){
 const level={...structuredClone(source),placements:[...source.placements,...placements]};delete level.previewMode;delete level.previewActors;delete level.actorRoutes;const world=buildWorld(level,modelMap);let nav;
 try{nav=new DroneNavigation(world);for(const p of placements)if(p.model===M.id){const rig=world.rigs.get(p.id);expect(nav.home({homeX:(p.box[0]+.5)*24,homeZ:(p.box[2]+.5)*24,ground:source.pathHeight,rig,padIndex:nav.padIndices.get(p.id)})).toBeGreaterThanOrEqual(0);}}
 finally{nav?.dispose();disposeWorld(world);}
}

test('Drone placement bounds preserve pad geometry and enclose the complete spinning neutral aircraft',()=>{
 const model=models.get(M.id),shapes=defenceMovementShapes(model,'base'),body=shapes.find(s=>s.part===M.body);
 expect(body.bounds).toEqual([12-H.neutralRadius,M.restLowestY,12-H.neutralRadius,12+H.neutralRadius,9+H.neutralAbove,12+H.neutralRadius]);
 expect(body.bounds[3]-body.bounds[0]).toBe(22);expect(shapes.some(s=>s.part===M.pad)).toBe(true);
 let checked=0;
 for(let angle=0;angle<360;angle+=15){
  const poses=partMatrices(model.variants.base.parts,Object.fromEntries(model.variants.base.parts.filter(p=>p.id.startsWith('rotor-')).map(p=>[p.id,[0,angle,0]])));
  for(const p of model.variants.base.parts)if(p.id!==M.pad)for(const c of p.voxels)for(let i=0;i<8;i++){
   const m=poses.get(p.id),x=c[0]+(i&1?1:0),y=c[1]+(i&2?1:0),z=c[2]+(i&4?1:0),point=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
   for(let axis=0;axis<3;axis++){expect(point[axis]).toBeGreaterThanOrEqual(body.bounds[axis]-1e-5);expect(point[axis]).toBeLessThanOrEqual(body.bounds[axis+3]+1e-5);}checked++;
  }
 }
 expect(checked).toBeGreaterThan(10000);
});

test('Drone pads use ordinary flat dry ground and route gates while retaining only the supported base tier',()=>{
 const {source,rules}=fixture();try{
  expect(rules.check([5,0,6],'base',[],null,M.id).valid).toBe(true);
  expect(rules.check([5,0,3],'base',[],null,M.id).code).toBe('route');
  expect(rules.check([5,0,6],'upgrade1',[],null,M.id).code).toBe('variant');
  expect(rules.check([5,1,6],'base',[],null,M.id).code).toBe('bounds');
  expect(rules.check([0,0,6],'base',[],null,M.id).code).toBe('launch-clearance');
  expect(rules.check([1,0,6],'base',[],null,M.id).valid).toBe(true);
  assertNativeHomes(source,[placement()]);
 }finally{rules.dispose();}
 for(const terrain of [{box:[5,6],ground:16,water:24},{box:[5,6],ground:30,water:0}]){
  const source=flat();source.terrain.boxes=[terrain];const {rules}=fixture(source);try{expect(rules.check([5,0,6],'base',[],null,M.id).code).toBe('ground');}finally{rules.dispose();}
 }
});

test('safe neutral departure rejects a narrow overhead obstacle but retains a lower clear transit layer',()=>{
 for(const [height,valid]of [[15,false],[35,false],[45,true]]){
  const source=flat(),obstacle={...structuredClone(models.get(M.id)),id:'departure-obstacle',role:'scenery',size:[24,80,24]};for(const variant of Object.values(obstacle.variants))variant.parts=[{id:'block',name:'Departure obstacle',parent:null,pivot:[12,0,12],voxels:[[12,height,12,0]]}];const modelMap=new Map(models).set(obstacle.id,obstacle);
  source.placements=[{...placement('obstacle',[5,0,6],obstacle.id),kind:'detail',offset:[0,0,0]}];const rules=createPlacementRules(source,modelMap,{config:configuration(source),critters:false});try{
   const result=rules.check([5,0,6],'base',[],null,M.id);expect(result.valid).toBe(valid);
   if(valid){expect(rules.prepare([placement()]).valid).toBe(true);assertNativeHomes(source,[placement()],modelMap);}else expect(result.code).toBe('launch-clearance');
  }finally{rules.dispose();}
 }
});

test('adjacent Drone pads and compact generators retain accepted room without a ground-level airborne hull',()=>{
 const {source,rules}=fixture();try{
  const first=placement(),next=placement('next',[6,0,6]),generator=placement('generator',[4,0,6],'power-generator');
  expect(rules.check(next.box,'base',[first],null,M.id).valid).toBe(true);
  expect(rules.check(generator.box,'base',[first],null,generator.model).valid).toBe(true);
  const deployed=[first,next,generator];expect(rules.prepare(deployed).valid).toBe(true);assertNativeHomes(source,deployed);
  expect(rules.check(first.box,'base',deployed,first.id,M.id).valid).toBe(true);
  expect(rules.check(first.box,'base',deployed,null,M.id).code).toBe('occupied');
 }finally{rules.dispose();}
});

test('new ordinary units cannot obstruct an existing Drone departure and placement order gives the same result',()=>{
 const {rules}=fixture();try{
  const drone=placement(),gun=placement('gun',[6,0,6],'turret-study');
  expect(rules.check(gun.box,'base',[],null,gun.model).valid).toBe(true);
  expect(rules.check(drone.box,'base',[],null,M.id).valid).toBe(true);
  expect(rules.check(gun.box,'base',[drone],null,gun.model).code).toBe('launch-clearance');
  expect(rules.check(drone.box,'base',[gun],null,M.id).code).toBe('launch-clearance');
  expect(rules.prepare([drone,gun]).code).toBe('launch-clearance');
  expect(rules.check([8,0,6],'base',[drone],null,gun.model).valid).toBe(true);
  expect(rules.prepare([drone,{...gun,box:[8,0,6]}]).valid).toBe(true);
 }finally{rules.dispose();}
});

test('native mixed A2 deployment rejects the runtime turret prediction corner before committing either placement order',async()=>{
 const source=await Bun.file(new URL('../assets/levels/moss-02.json',import.meta.url)).json(),modelMap=new Map(models);
 for(const p of source.placements)if(!modelMap.has(p.model))modelMap.set(p.model,await Bun.file(new URL(`../assets/models/${p.model}.json`,import.meta.url)).json());
 const pads=[[1,0,6],[18,0,8],[10,0,14],[9,0,7]].map((box,i)=>placement(`drone-${i}`,box)),gun=placement('gun',[3,0,4],'turret-study'),arc=placement('arc',[5,0,4],'arc-spire');
 const world=buildWorld(composePlayLevel(source,[...pads,gun,arc],{models:modelMap}),modelMap),obstacles=new DroneObstacles(world),rules=createPlacementRules(source,modelMap,{config:configuration(),critters:false});try{
  expect(obstacles.pointClear(36,33,156,H.neutralRadius,1,H.neutralBelow,H.neutralAbove)).toBe(false);expect(obstacles.lastBlockedId).toBe(gun.id);
  expect(rules.prepare(pads).valid).toBe(true);
  expect(rules.check(gun.box,'base',pads,null,gun.model).code).toBe('launch-clearance');
  expect(rules.check(pads[0].box,'base',[gun],null,M.id).code).toBe('launch-clearance');
  expect(rules.eligibleCells('base',pads,null,gun.model).find(c=>c.box[0]===3&&c.box[2]===4).valid).toBe(false);
  expect(rules.prepare([...pads,gun,arc]).code).toBe('launch-clearance');
 }finally{rules.dispose();obstacles.dispose();disposeWorld(world);}
});

test('airborne route clearance protects the neutral column rather than only docked voxels',()=>{
 const ground=fixture(),air=fixture(flat(),{air:true});try{
  expect(ground.rules.check([5,0,4],'base',[],null,M.id).valid).toBe(true);
  expect(air.rules.check([5,0,4],'base',[],null,M.id).code).toBe('launch-clearance');
  expect(air.rules.check([5,0,6],'base',[],null,M.id).valid).toBe(true);
 }finally{ground.rules.dispose();air.rules.dispose();}
});

test('enabling Drones leaves every previously approved ordinary placement unchanged',()=>{
 const source=flat(),without=structuredClone(PLAY_CONFIG),withDrone=configuration();delete without.defences[M.id];const baseline=createPlacementRules(source,models,{config:without,critters:false}),rules=createPlacementRules(source,models,{config:withDrone,critters:false});try{
  for(const model of ['turret-study','power-generator','missile-launcher'])for(const variant of withDrone.defences[model].enabledVariants)expect(rules.eligibleCells(variant,[],null,model)).toEqual(baseline.eligibleCells(variant,[],null,model));
 }finally{baseline.dispose();rules.dispose();}
});

test('native A2 Drone pads retain wildlife relocation and every approved single pad has a real navigation home',async()=>{
 const source=await Bun.file(new URL('../assets/levels/moss-02.json',import.meta.url)).json(),level=composePlayLevel(source),modelMap=new Map(models);
 for(const id of new Set([...level.placements.map(p=>p.model),...wildlifeActorsForLevel(level).map(a=>a.model)]))if(!modelMap.has(id))modelMap.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 const rules=createPlacementRules(source,modelMap,{config:configuration(),critters:true});try{
  const cells=rules.eligibleCells('base',[],null,M.id).filter(c=>c.valid);expect(cells.length).toBeGreaterThan(10);
  for(const {box}of cells)assertNativeHomes({...source,placements:source.placements.filter(p=>modelMap.get(p.model)?.role==='scenery')},[placement('drone',box)],modelMap);
  let prepared=null;for(const {box}of cells){const result=rules.prepare([placement('drone',box)]);if(result.valid){prepared=result;break;}}
  expect(prepared).not.toBeNull();expect(prepared.wildlifePoints.length).toBe(wildlifeActorsForLevel(level).filter(a=>a.kind==='ground').length);expect(prepared.wildlifePoints.length).toBeGreaterThan(0);
 }finally{rules.dispose();}
});
