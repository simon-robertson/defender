import {test,expect} from 'bun:test';
import {currentPreviewFor} from '../scripts/current-preview-levels.js';
import {sceneryModels,firstLevel} from '../scripts/first-level.js';
import {buildWorld,groundMesh} from '../engine/world.js';
import {Camera} from '../engine/camera.js';
import {validateLevel,newLevel} from '../shared/level.js';
import {newModel} from '../shared/model.js';
import {placementY,TerrainField} from '../shared/terrain.js';
import {placementMatrix,partMatrices,multiply} from '../shared/math.js';

const models=new Map(sceneryModels().map(m=>[m.id,m]));
models.set('turret-study',await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json());
models.set('power-generator',await Bun.file(new URL('../assets/models/power-generator.json',import.meta.url)).json());
test('repeated rig bind poses retain independent instance matrices',()=>{
 const world=buildWorld(firstLevel(),models,{actors:[{id:'moving-a',model:'turret-study',variant:'base'},{id:'moving-b',model:'turret-study',variant:'base'}]});
 const expected=new Float32Array(16),matrices=new Set();
 for(const rig of [...world.rigs.values(),...world.actors.values()]){
  const poses=partMatrices(rig.parts);
  for(const instance of rig.instances){
   multiply(expected,rig.root,poses.get(instance.part));expect(instance.matrix).toEqual(expected);
   expect(matrices.has(instance.matrix)).toBe(false);matrices.add(instance.matrix);
  }
 }
 const a=world.actors.get('moving-a'),b=world.actors.get('moving-b'),before=b.instances[0].matrix.slice();
 a.instances[0].matrix[12]+=10;expect(b.instances[0].matrix).toEqual(before);
});
test('first level preserves the 24-unit grid, all three turrets, clear route and shared geometry',()=>{
 const level=firstLevel(),world=buildWorld(level,models);
 expect(level.size).toEqual([16,16]);expect(level.path.length).toBeGreaterThan(21);expect(level.placements.filter(p=>p.model==='turret-study').map(p=>p.variant)).toEqual(['base','upgrade1','base']);
 const keys=new Set(['ground']);for(const p of level.placements)for(const part of models.get(p.model).variants[p.variant].parts)keys.add(p.model+':'+p.variant+':'+part.id);
 expect(world.entries.map(entry=>entry.key).sort()).toEqual([...keys].sort());expect(world.uniqueQuads).toBeLessThan(world.quads);
 expect(world.entries.find(e=>e.key==='turret-study:base:head').transforms.length).toBe(2);
 expect(world.entries.find(e=>e.key==='turret-study:upgrade1:head').transforms.length).toBe(1);
 const generator=level.placements.find(p=>p.model==='power-generator'),firstTurret=level.placements.find(p=>p.model==='turret-study');
 expect(generator.variant).toBe('base');expect(Math.hypot(generator.box[0]-firstTurret.box[0],generator.box[2]-firstTurret.box[2])).toBe(1);
 expect(world.rigs.get(generator.id).root[13]).toBe(level.pathHeight);expect(world.entries.find(e=>e.key==='power-generator:base:body').transforms).toHaveLength(1);
 const terrain=new TerrainField(level);for(const [x,,z]of level.path)expect(terrain.flatBox(x,z)).toBe(24);
 const water=level.terrain.boxes.filter(box=>box.water>0);expect(water.length).toBeGreaterThan(0);
 for(const box of water){expect(terrain.height(box.box[0]*24,box.box[1]*24)).toBe(box.ground);expect(terrain.height(box.box[0]*24,box.box[1]*24,true)).toBe(box.water);}
 const blocked=structuredClone(level);blocked.placements[0].box=level.path[0].slice();expect(()=>buildWorld(blocked,models)).toThrow('blocks the enemy route');
});
test('detail props share a box with unit offsets, preserve transforms, and reject real overlap, bounds or path intrusion',()=>{
 const model=newModel('test-prop');model.variants.base.parts[0].voxels=[[12,0,12,0]];const library=new Map([[model.id,model]]),level=newLevel('detail-test');level.size=[2,2];
 const a={id:'a',model:model.id,variant:'base',box:[0,0,0],turn:1,kind:'detail',offset:[-5,2,4]},b={...a,id:'b',offset:[4,2,0]};level.placements=[a,b];expect(()=>validateLevel(level,library)).not.toThrow();
 expect(placementY(level,a)).toBe(26);const matrix=placementMatrix(a.box,a.turn,a.offset);expect(matrix[12]).toBe(19);expect(matrix[14]).toBe(4);
 b.offset=[...a.offset];expect(()=>validateLevel(level,library)).toThrow('overlap');b.offset=[4,2,0];a.offset=[-23,0,0];expect(()=>validateLevel(level,library)).toThrow('outside');
 a.offset=[-5,2,4];level.path=[[0,0,0]];expect(()=>validateLevel(level,library)).toThrow('enemy path');
 delete level.path[0];level.path=[];a.kind=undefined;expect(()=>validateLevel(level,library)).toThrow('Only detail');
});
test('ground surfaces include the submerged bed exactly once and path paving has no coplanar overlays',()=>{
 const level=firstLevel(),field=new TerrainField(level),mesh=groundMesh(level),coverage=new Map();
 for(const q of mesh.quads){if(q.axis!==1||q.sign!==1)continue;for(let x=q.origin[0];x<q.origin[0]+q.height;x++)for(let z=q.origin[2];z<q.origin[2]+q.width;z++){
  const key=x+','+z;expect(coverage.has(key)).toBe(false);coverage.set(key,q.origin[1]);
 }}
 expect(coverage.size).toBe(level.size[0]*level.size[1]*24*24);
 for(let z=0;z<level.size[1]*24;z++)for(let x=0;x<level.size[0]*24;x++)expect(coverage.get(x+','+z)).toBe(field.height(x,z));
});
test('camera inverse reconstructs clip coordinates across orbit, pan and zoom',()=>{
 const canvas={addEventListener(){},clientWidth:1200,clientHeight:800},camera=new Camera(canvas,()=>{}),result=new Float32Array(16);
 for(const [yaw,pitch,radius]of [[2.45,.68,150],[0,.25,35],[-2.1,1.4,650]]){camera.yaw=yaw;camera.pitch=pitch;camera.radius=radius;camera.target.set([168,24,120]);camera.pan(45,-27);camera.update(1.5);multiply(result,camera.vp,camera.inverse);
  for(let i=0;i<16;i++)expect(result[i]).toBeCloseTo(i%5===0?1:0,4);
 }
});
test('fixed level environment rejects malformed lighting',()=>{
 const level=firstLevel();level.environment.sky.direction=[0,0,0];expect(()=>validateLevel(level)).toThrow('direction');
 level.environment=firstLevel().environment;level.environment.timeOfDay=NaN;expect(()=>validateLevel(level)).toThrow('Time');
});
test('current A1–A4 and B1–B4 sources match their preview generators and historical model bounds stay clean',async()=>{
 for(const [zone,prefix]of [['A','moss'],['B','ochre']])for(const number of [1,2,3,4]){const saved=await Bun.file(new URL(`../assets/levels/${prefix}-0${number}.json`,import.meta.url)).json();expect(saved).toEqual(await currentPreviewFor(zone,number));}
 for(const [id,model]of models){if(id==='turret-study')continue;const source=await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json();expect(source).toEqual(model);expect(model.size[0]).toBe(24);expect(model.size[2]).toBe(24);}
});
test('fixed time of day controls daylight without a runtime cycle',async()=>{
 const {levelLighting}=await import('../engine/environment.js'),environment=firstLevel().environment;
 const noon=levelLighting({...environment,timeOfDay:12}),morning=levelLighting({...environment,timeOfDay:7}),night=levelLighting({...environment,timeOfDay:0});
 expect(noon.intensity).toBe(environment.sky.intensity);expect(morning.intensity).toBeLessThan(noon.intensity);expect(night.intensity).toBe(0);expect(night.ambientIntensity).toBeGreaterThan(0);
 expect(morning.direction[1]).toBeLessThan(noon.direction[1]);expect(environment).toEqual(firstLevel().environment);
});
