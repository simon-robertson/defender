import {test,expect} from 'bun:test';
import {levelWeather,ZONE_WEATHER,WET_PATH_REFLECTIVENESS,WET_MORTAR_REFLECTIVENESS} from '../shared/weather.js';
import {newLevel,validateLevel,defaultEnvironment} from '../shared/level.js';
import {TERRAIN_MATERIALS} from '../shared/zone-style.js';
import {terrainGeometry} from '../engine/world.js';
import {firstLevel} from '../scripts/first-level.js';
import {zonePreviewLevel} from '../scripts/zone-previews.js';
import {pathSurfaceQuads,PUDDLE_MATERIAL_START,PUDDLE_REFLECTIVENESS,PUDDLE_MATERIALS,SNOW_MATERIAL_START,SNOW_MATERIALS,LEAF_MATERIAL_START,LEAF_MATERIALS} from '../shared/path-surface.js';

// Classify the paving spatially: appended soil materials may use slots that
// the weather palette occupies in a different build. Compare resolved vertex
// materials outside the route rather than those build-local material indices.
const pathTop=(q,level,route)=>q.axis===1&&q.sign===1&&q.origin[1]===level.pathHeight&&route.has(Math.floor(q.origin[0]/24)+','+Math.floor(q.origin[2]/24));
const outsidePath=(mesh,pathFace)=>mesh.quads.flatMap((q,i)=>pathFace(q)?[]:[mesh.vertices.slice(i*44,(i+1)*44)]);

test('each level opts into its zone weather; legacy clear and missing settings stay disabled',()=>{
 const level=newLevel('weather-policy');expect(levelWeather(level)).toEqual({type:'rain',enabled:false});
 level.environment=defaultEnvironment();expect(levelWeather(level).enabled).toBe(false);
 for(const enabled of [true,false]){level.environment.weather={enabled};expect(levelWeather(level)).toEqual({type:'rain',enabled});expect(validateLevel(level)).toBe(level);}
 level.environment.weather='clear';expect(levelWeather(level).enabled).toBe(false);
 level.zone='C';expect(ZONE_WEATHER.C).toBe('snow');expect(levelWeather(level)).toEqual({type:'snow',enabled:false});
 for(const enabled of [true,false]){level.environment.weather={enabled};expect(levelWeather(level)).toEqual({type:'snow',enabled});expect(validateLevel(level)).toBe(level);}
 level.zone='D';expect(ZONE_WEATHER.D).toBeNull();level.environment.weather={enabled:false};expect(levelWeather(level)).toEqual({type:'clear',enabled:false});
 level.environment.weather={enabled:true};expect(()=>validateLevel(level)).toThrow('not been assigned');
 level.environment.weather='clear';expect(levelWeather(level)).toEqual({type:'clear',enabled:false});
 level.zone='B';expect(ZONE_WEATHER.B).toBeNull();expect(levelWeather(level)).toEqual({type:'clear',enabled:false});level.environment.weather={enabled:true};expect(()=>validateLevel(level)).toThrow('not been assigned');level.environment.weather={enabled:false};expect(()=>validateLevel(level)).not.toThrow();
 for(const weather of ['rain','fog',true,false,null,[],{}, {enabled:1},{enabled:'true'},{enabled:true,type:'rain'}]){level.zone='A';level.environment.weather=weather;expect(()=>validateLevel(level)).toThrow('Weather');}
});

test('settled snow replaces only flat exposed path edges with matte patches and a clear central route',()=>{
 const level=zonePreviewLevel('C');level.environment.weather.enabled=true;expect(levelWeather(level)).toEqual({type:'snow',enabled:true});
 const palette=structuredClone(TERRAIN_MATERIALS.C),snowy=terrainGeometry(level);level.environment.weather={enabled:false};const dry=terrainGeometry(level);
 const route=new Set(level.path.map(([x,,z])=>x+','+z)),pathFace=q=>pathTop(q,level,route);
 expect(snowy.water).toEqual(dry.water);expect(TERRAIN_MATERIALS.C).toEqual(palette);
 expect(outsidePath(snowy.ground,pathFace)).toEqual(outsidePath(dry.ground,pathFace));
 const cells=new Map();let settled=0;
 snowy.ground.quads.forEach((q,i)=>{
  if(!pathFace(q))return;
  expect(q.axis).toBe(1);expect(q.sign).toBe(1);expect(q.origin[1]).toBe(level.pathHeight);
  expect(snowy.ground.vertices[i*44+9]).toBe(0);expect(snowy.ground.vertices[i*44+10]).toBe(0);
  for(let z=q.origin[2];z<q.origin[2]+q.width;z++)for(let x=q.origin[0];x<q.origin[0]+q.height;x++){
   const key=x+','+z;expect(cells.has(key)).toBe(false);cells.set(key,q.material);
   const bx=Math.floor(x/24),bz=Math.floor(z/24),px=x%24,pz=z%24;
   if(q.material>=SNOW_MATERIAL_START){settled++;expect(q.material-SNOW_MATERIAL_START).toBeLessThan(SNOW_MATERIALS.length);
    expect((px<4&&!route.has((bx-1)+','+bz))||(px>=20&&!route.has((bx+1)+','+bz))||(pz<4&&!route.has(bx+','+(bz-1)))||(pz>=20&&!route.has(bx+','+(bz+1)))).toBe(true);
   }
   if(px>=4&&px<20&&pz>=4&&pz<20)expect(q.material).toBeLessThan(SNOW_MATERIAL_START);
  }
 });
 expect(cells.size).toBe(level.path.length*24*24);expect(settled/cells.size).toBeGreaterThan(.08);expect(settled/cells.size).toBeLessThan(.3);
 for(const [bx,,bz]of level.path)expect(pathSurfaceQuads(new Set([...route].reverse()),bx,bz,24,'snow')).toEqual(pathSurfaceQuads(route,bx,bz,24,'snow'));
 expect(terrainGeometry({...level,environment:{...level.environment,weather:'clear'}})).toEqual(dry);
});

test('legacy leaf surface primitives preserve coverage without enabling Area D weather',()=>{
 const level=zonePreviewLevel('D'),palette=structuredClone(TERRAIN_MATERIALS.D);expect(levelWeather(level)).toEqual({type:'clear',enabled:false});
 const leafy=terrainGeometry(level,{type:'leaves',enabled:true}),dry=terrainGeometry(level);
 const route=new Set(level.path.map(([x,,z])=>x+','+z)),pathFace=q=>pathTop(q,level,route);
 expect(leafy.water).toEqual(dry.water);expect(TERRAIN_MATERIALS.D).toEqual(palette);
 expect(outsidePath(leafy.ground,pathFace)).toEqual(outsidePath(dry.ground,pathFace));
 const expand=mesh=>{const cells=new Map();mesh.quads.forEach((q,i)=>{
  if(!pathFace(q))return;
  expect([q.axis,q.sign,q.origin[1]]).toEqual([1,1,level.pathHeight]);
  expect(mesh.vertices[i*44+9]).toBe(0);expect(mesh.vertices[i*44+10]).toBe(0);
  for(let z=q.origin[2]*2;z<(q.origin[2]+q.width)*2;z++)for(let x=q.origin[0]*2;x<(q.origin[0]+q.height)*2;x++){
   const key=x+','+z;expect(cells.has(key)).toBe(false);cells.set(key,q.material);
  }
 });return cells;};
 const cells=expand(leafy.ground),plain=expand(dry.ground);let leaves=0,purple=0;
 expect(cells.size).toBe(level.path.length*48*48);expect(cells.size).toBe(plain.size);
 for(const [key,m]of cells){
  expect(plain.has(key)).toBe(true);
  if(m<LEAF_MATERIAL_START){expect(m).toBe(plain.get(key));continue;}
  leaves++;if(m<LEAF_MATERIAL_START+3)purple++;
  expect(m-LEAF_MATERIAL_START).toBeLessThan(LEAF_MATERIALS.length);
  const [hx,hz]=key.split(',').map(Number),x=hx/2,z=hz/2,bx=Math.floor(x/24),bz=Math.floor(z/24),px=x%24,pz=z%24;
  expect((px<4&&!route.has((bx-1)+','+bz))||(px>=20&&!route.has((bx+1)+','+bz))||(pz<4&&!route.has(bx+','+(bz-1)))||(pz>=20&&!route.has(bx+','+(bz+1)))).toBe(true);
 }
 expect(leaves/cells.size).toBeGreaterThan(.025);expect(leaves/cells.size).toBeLessThan(.12);
 expect(purple/leaves).toBeGreaterThan(.7);expect(purple/leaves).toBeLessThan(.9);
 expect(LEAF_MATERIALS.map(m=>m.color)).toEqual(['#875B79','#A77B97','#6B4B6E','#A37058','#98624E']);
 for(const [bx,,bz]of level.path)expect(pathSurfaceQuads(new Set([...route].reverse()),bx,bz,24,'leaves')).toEqual(pathSurfaceQuads(route,bx,bz,24,'leaves'));
 expect(terrainGeometry({...level,environment:{...level.environment,weather:'clear'}})).toEqual(dry);
});

test('rain puddles replace only path-top materials, with identical coverage and no palette mutation',()=>{
 const level=firstLevel(),palette=structuredClone(TERRAIN_MATERIALS.A);level.environment.weather.enabled=true;const rain=terrainGeometry(level);
 level.environment.weather={enabled:false};const dry=terrainGeometry(level);
 expect(rain.water).toEqual(dry.water);
 const route=new Set(level.path.map(([x,,z])=>x+','+z)),pathFace=q=>pathTop(q,level,route);
 expect(outsidePath(rain.ground,pathFace)).toEqual(outsidePath(dry.ground,pathFace));
 const expand=mesh=>{const out=new Map();for(const q of mesh.quads.filter(pathFace)){
  expect(q.axis).toBe(1);expect(q.sign).toBe(1);expect(q.origin[1]).toBe(level.pathHeight);
  for(let z=q.origin[2];z<q.origin[2]+q.width;z++)for(let x=q.origin[0];x<q.origin[0]+q.height;x++){
   const key=x+','+z;expect(out.has(key)).toBe(false);out.set(key,q.material);
  }
 }return out;};
 const wet=expand(rain.ground),plain=expand(dry.ground);expect(wet.size).toBe(level.path.length*24*24);expect(wet.size).toBe(plain.size);let pooled=0;
 for(const [key,m] of wet){expect(plain.has(key)).toBe(true);if(m>=PUDDLE_MATERIAL_START){pooled++;expect(m-PUDDLE_MATERIAL_START+6).toBe(plain.get(key));}else expect(m).toBe(plain.get(key));}
 expect(pooled/wet.size).toBeGreaterThan(.08);expect(pooled/wet.size).toBeLessThan(.3);
 for(let q=0;q<rain.ground.quads.length;q++)if(pathFace(rain.ground.quads[q])){
  const m=rain.ground.quads[q].material,wanted=m>=PUDDLE_MATERIAL_START?PUDDLE_REFLECTIVENESS:m===9?WET_MORTAR_REFLECTIVENESS:WET_PATH_REFLECTIVENESS;
  expect(rain.ground.vertices[q*44+10]).toBe(Math.fround(wanted));
 }
 expect(PUDDLE_REFLECTIVENESS).toBeGreaterThan(WET_PATH_REFLECTIVENESS);
 for(const m of PUDDLE_MATERIALS)expect(parseInt(m.color.slice(5,7),16)).toBeGreaterThan(parseInt(m.color.slice(1,3),16));
 expect(TERRAIN_MATERIALS.A).toEqual(palette);expect(terrainGeometry({...level,environment:{...level.environment,weather:'clear'}})).toEqual(dry);
});

test('edge pools follow the outside of straight and turning routes, preserve centre lanes, and contain real breaks',()=>{
 const route=new Set(['0,0','1,0','2,0','2,1','2,2']),cells=new Map();
 for(const box of route){const [bx,bz]=box.split(',').map(Number),quads=pathSurfaceQuads(route,bx,bz,24,true);
  expect(pathSurfaceQuads(new Set([...route].reverse()),bx,bz,24,true)).toEqual(quads);
  for(const q of quads)for(let z=q.origin[2];z<q.origin[2]+q.width;z++)for(let x=q.origin[0];x<q.origin[0]+q.height;x++)cells.set(x+','+z,q.material);
 }
 let wetEdge=0,dryEdge=0;
 for(const [key,m]of cells){const [x,z]=key.split(',').map(Number),bx=Math.floor(x/24),bz=Math.floor(z/24),px=x%24,pz=z%24;
  if(m>=PUDDLE_MATERIAL_START){
   expect((px<4&&!route.has((bx-1)+','+bz))||(px>=20&&!route.has((bx+1)+','+bz))||(pz<4&&!route.has(bx+','+(bz-1)))||(pz>=20&&!route.has(bx+','+(bz+1)))).toBe(true);
  }
  if(px>=4&&px<20&&pz>=4&&pz<20)expect(m).toBeLessThan(PUDDLE_MATERIAL_START);
  if(z===0){if(m>=PUDDLE_MATERIAL_START)wetEdge++;else dryEdge++;}
 }
 expect(wetEdge).toBeGreaterThan(24);expect(dryEdge).toBeGreaterThan(4);
 // Connections between neighbours must never become transverse blue dams.
 for(let z=4;z<20;z++)for(const x of [23,24,47,48])expect(cells.get(x+','+z)).toBeLessThan(PUDDLE_MATERIAL_START);
 for(let x=52;x<68;x++)for(const z of [23,24,47,48])expect(cells.get(x+','+z)).toBeLessThan(PUDDLE_MATERIAL_START);
});


test('all saved levels and preview generators keep weather disabled until explicitly enabled',async()=>{
 for await(const path of new Bun.Glob('*.json').scan(new URL('../assets/levels/',import.meta.url).pathname)){
  const level=await Bun.file(new URL('../assets/levels/'+path,import.meta.url)).json();
  expect(levelWeather(level).enabled).toBe(false);
 }
 for(const level of [firstLevel(),...['B','C','D'].map(zonePreviewLevel)])expect(levelWeather(level).enabled).toBe(false);
});
