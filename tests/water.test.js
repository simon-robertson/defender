import {test,expect} from 'bun:test';
import {newLevel,validateLevel} from '../shared/level.js';
import {TerrainField,placementY} from '../shared/terrain.js';
import {meshTerrainChunk,terrainMaterials} from '../shared/terrain-mesh.js';
import {defaultWaterMaterial,validateWaterMaterial} from '../shared/water.js';
import {terrainGeometry} from '../engine/world.js';
import {firstLevel} from '../scripts/first-level.js';
import {newModel} from '../shared/model.js';
import {terrainStudy} from '../scripts/seed.js';

test('water material is explicit, bounded and survives level serialization',()=>{
 const l=firstLevel();expect(l.waterMaterial.reflectiveness).toBe(.85);expect(l.waterMaterial.type).toBe('water');expect(validateWaterMaterial(JSON.parse(JSON.stringify(l.waterMaterial)))).toEqual(defaultWaterMaterial());
 for(const key of ['opacity','absorption','refraction','rippleStrength','emission','reflectiveness']){const m=defaultWaterMaterial();m[key]=-1;expect(()=>validateWaterMaterial(m)).toThrow();m[key]=NaN;expect(()=>validateWaterMaterial(m)).toThrow();m[key]=1.1;expect(()=>validateWaterMaterial(m)).toThrow();}
 l.waterMaterial.rippleSpeed=-1;expect(()=>validateLevel(l)).toThrow('speed');
});
test('water and stream bed have separate complete surfaces on the box grid',()=>{
 const l=firstLevel(),{ground,water}=terrainGeometry(l),field=new TerrainField(l),covered=new Set(),bed=new Set();expect(ground.quads.every(q=>q.material!==2)).toBe(true);
 for(const q of water.quads){expect(q.material).toBe(2);if(q.axis!==1||q.sign!==1)continue;
  for(let x=q.origin[0];x<q.origin[0]+q.height;x++)for(let z=q.origin[2];z<q.origin[2]+q.width;z++){expect(covered.has(x+','+z)).toBe(false);covered.add(x+','+z);expect(field.height(x,z,true)).toBeGreaterThan(0);expect(q.origin[1]).toBe(field.height(x,z,true));}
 }
 for(const q of ground.quads){if(q.axis!==1||q.sign!==1||!field.height(q.origin[0],q.origin[2],true))continue;
  for(let x=q.origin[0];x<q.origin[0]+q.height;x++)for(let z=q.origin[2];z<q.origin[2]+q.width;z++){const key=x+','+z;expect(bed.has(key)).toBe(false);bed.add(key);expect(q.origin[1]).toBe(field.height(x,z));expect(field.height(x,z,true)).toBeGreaterThan(q.origin[1]);}
 }
 const waterBoxes=l.terrain.boxes.filter(box=>box.water>0);expect(waterBoxes.length).toBeGreaterThan(0);expect(covered.size).toBe(waterBoxes.length*24*24);expect(bed).toEqual(covered);
});
test('translucent terrain retains submerged solid faces and culls water interfaces against solids/water',()=>{
 const l=newLevel('wet-geometry');l.size=[3,1];const f=new TerrainField(l);f.setBox(0,0,4,12);f.setBox(1,0,7,10);f.setBox(2,0,16,0);f.commit();
 const ground=new Set(),water=new Set(),expectedGround=new Set(),expectedWater=new Set();
 for(let bx=0;bx<3;bx++)for(const q of meshTerrainChunk(f,bx,0,terrainMaterials('A'),true).quads){const target=q.material===2?water:ground,u=(q.axis+1)%3,v=(q.axis+2)%3;
  for(let i=0;i<q.width;i++)for(let j=0;j<q.height;j++){const p=q.origin.slice();p[0]+=bx*24;p[u]+=i;p[v]+=j;const key=`${q.axis},${q.sign},${p}`;expect(target.has(key)).toBe(false);target.add(key);}
 }
 for(let z=0;z<24;z++)for(let x=0;x<72;x++)for(let y=0;y<Math.max(f.height(x,z),f.height(x,z,true));y++){
  const solid=y<f.height(x,z),target=solid?expectedGround:expectedWater;
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const next=[x,y,z];next[axis]+=sign;const occupied=solid?f.height(next[0],next[2]):Math.max(f.height(next[0],next[2]),f.height(next[0],next[2],true));
   if(next[1]>=0&&next[1]<occupied)continue;const p=[x,y,z];if(sign>0)p[axis]++;target.add(`${axis},${sign},${p}`);
  }
 }
 expect(ground).toEqual(expectedGround);expect(water).toEqual(expectedWater);
});
test('all shipped player defences sit on ground at path height; mounds, floating anchors and extra layers are rejected',async()=>{
 const turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json(),models=new Map([[turret.id,turret]]);
 for(const id of ['moss-01','layout-study','terrain-study']){const l=await Bun.file(new URL(`../assets/levels/${id}.json`,import.meta.url)).json();const f=new TerrainField(l);for(const p of l.placements.filter(p=>p.model===turret.id)){expect(placementY(l,p,f)).toBe(l.pathHeight);expect(f.flatBox(p.box[0],p.box[2])).toBe(l.pathHeight);}}
 const l=terrainStudy(),f=new TerrainField(l);validateLevel(l,models);f.setBox(2,1,25,0);f.commit();expect(()=>validateLevel(l,models)).toThrow('enemy path height');
 f.setBox(2,1,4,0);f.commit();l.placements[0].anchor='absolute';l.placements[0].box[1]=1;expect(()=>validateLevel(l,models)).toThrow('enemy path height');
 f.setBox(2,1,24,0);f.commit();l.placements[0].box[1]=2;expect(()=>validateLevel(l,models)).toThrow('enemy path height');
 const generic=newModel('scenery');generic.variants.base.parts[0].voxels=[[12,0,12,0]];models.set(generic.id,generic);l.placements[0].model=generic.id;expect(()=>validateLevel(l,models)).not.toThrow();
});
