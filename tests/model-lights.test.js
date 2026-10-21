import {test,expect} from 'bun:test';
import {ModelLights} from '../engine/model-lights.js';
import {meshPart,meshQuads} from '../shared/mesher.js';
import {identity} from '../shared/math.js';
import {modelForZone} from '../shared/zone-style.js';
import {MAX_MODEL_LIGHTS,MODEL_LIGHT_RADIUS,MODEL_LIGHT_STRENGTH} from '../shared/model-lights.js';
const turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json();
function fixture(mesh,instances=1){
 const transforms=Array.from({length:instances},()=>identity()),entry={key:'panel',mesh,transforms},packed=new Float32Array(instances*16);
 transforms.forEach((m,i)=>packed.set(m,i*16));const draw={transforms:packed,indexToSlot:null};return {entries:[entry],drawMap:new Map([['panel',draw]]),draw};
}
const palette=[{color:'#804020',emission:1,reflectiveness:0,castsLight:true},{color:'#804020',emission:1,reflectiveness:0},{color:'#804020',emission:0,reflectiveness:0,castsLight:true},{color:'#2080FF',emission:.5,reflectiveness:0,castsLight:true}];
const quad=(x,z,material=0)=>({origin:[x,1,z],axis:1,sign:1,width:1,height:1,material});

test('flagged exposed face clusters preserve all zone colours and only the authored turret panels',()=>{
 const before=JSON.stringify(turret);
 for(const zone of ['A','B','C','D'])for(const [variant,count] of [['base',3],['upgrade1',3],['upgrade2',2]]){
  const model=modelForZone(turret,zone),entries=model.variants[variant].parts.map(part=>({key:part.id,mesh:meshPart(model,part),transforms:[identity()]}));
  const draws=new Map(entries.map(entry=>[entry.key,{transforms:identity()}])),lights=new ModelLights(entries,draws);expect(lights.prepare()).toBe(true);
  expect(lights.count).toBe(count);expect(lights.authoredCount).toBe(count);expect(lights.overflow).toBe(0);expect(lights.data.byteLength).toBe(16+MAX_MODEL_LIGHTS*32);
  const rgb=[1,3,5].map(i=>{const c=parseInt(model.materials[4].color.slice(i,i+2),16)/255;return Math.fround(c<=.04045?c/12.92:((c+.055)/1.055)**2.4);});
  for(let i=0;i<count;i++){expect(Array.from(lights.data.slice(8+i*8,11+i*8))).toEqual(rgb);expect(lights.data[7+i*8]).toBe(MODEL_LIGHT_RADIUS);expect(lights.data[11+i*8]).toBeCloseTo(MODEL_LIGHT_STRENGTH,6);}
  expect(lights.sources.filter(source=>source.draw===draws.get('head'))).toHaveLength(count-1);expect(lights.prepare()).toBe(false);lights.dispose();
 }
 expect(JSON.stringify(turret)).toBe(before);
});

test('edge-connected matching faces share an emitter; gaps, point contacts and different materials do not',()=>{
 const mesh=meshQuads([quad(0,0),quad(1,0),quad(2,1),quad(5,0),quad(6,0,3),quad(8,0,1),quad(10,0,2)],palette),f=fixture(mesh),lights=new ModelLights(f.entries,f.drawMap);
 lights.prepare();expect(lights.authoredCount).toBe(4);expect(lights.count).toBe(4);
 expect(lights.sources[0].x).toBe(1);expect(lights.sources[0].z).toBe(.5);expect(lights.sources[0].y).toBe(1.6);
 expect(lights.sources.at(-1).strength).toBe(MODEL_LIGHT_STRENGTH*.5);
 const plain=fixture(meshQuads([quad(0,0,1),quad(1,0,2)],palette)),off=new ModelLights(plain.entries,plain.drawMap);expect(off.count).toBe(0);expect(off.data).toBeNull();expect(off.byteLength).toBe(0);expect(off.prepare()).toBe(false);
});

test('logical transforms, compacted visibility and unchanged invalidations reuse storage correctly',()=>{
 const f=fixture(meshQuads([quad(0,0)],palette),3),lights=new ModelLights(f.entries,f.drawMap),data=lights.data,sources=lights.sources;
 expect(lights.prepare()).toBe(true);expect(lights.prepare()).toBe(false);f.draw.transforms[16+12]=10;lights.invalidate('other');expect(lights.prepare()).toBe(false);
 lights.invalidate('panel');expect(lights.prepare()).toBe(true);expect(data[12]).toBe(10.5);lights.invalidate('panel');expect(lights.prepare()).toBe(false);
 f.draw.indexToSlot=new Int32Array([0,-1,1]);f.draw.transforms[32+12]=30;lights.invalidate('panel');expect(lights.prepare()).toBe(true);expect(lights.count).toBe(2);expect(data[12]).toBe(30.5);
 f.draw.indexToSlot[1]=2;lights.invalidate('panel');lights.prepare();expect(lights.count).toBe(3);expect(data[12]).toBe(10.5);expect(lights.data).toBe(data);expect(lights.sources).toBe(sources);
 lights.dispose();expect(sources).toHaveLength(0);expect(lights.keys.size).toBe(0);expect(lights.data).toBeNull();expect(lights.count).toBe(0);expect(lights.prepare()).toBe(false);
});

test('model light overflow is explicit, bounded and does not allocate one light per quad',()=>{
 const f=fixture(meshQuads([quad(0,0),quad(1,0)],palette),MAX_MODEL_LIGHTS+3),warn=console.warn,messages=[];let lights;
 try{console.warn=message=>messages.push(message);lights=new ModelLights(f.entries,f.drawMap);}finally{console.warn=warn;}
 lights.prepare();expect(lights.sources).toHaveLength(MAX_MODEL_LIGHTS);expect(lights.count).toBe(MAX_MODEL_LIGHTS);expect(lights.authoredCount).toBe(MAX_MODEL_LIGHTS+3);expect(lights.overflow).toBe(3);expect(messages).toHaveLength(1);expect(messages[0]).toContain('3 unlit');expect(lights.data.byteLength).toBe(16+MAX_MODEL_LIGHTS*32);
});
