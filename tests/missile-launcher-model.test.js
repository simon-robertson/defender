import {test,expect} from 'bun:test';
import {missileLauncherModel,guidedMissileModel} from '../scripts/missile-launcher.js';
import {validateModel,VARIANTS} from '../shared/model.js';
import {compileModel} from '../shared/mesher.js';
import {modelForZone} from '../shared/zone-style.js';
import {GUIDED_MISSILE_MODEL,MISSILE_LAUNCHER_SOCKETS,MISSILE_LAUNCHER_DECK_Y,MISSILE_LAUNCHER_CLEAR_Y,MISSILE_WELL_HALF_WIDTH} from '../shared/missile-model.js';

const launcher=missileLauncherModel(),missile=guidedMissileModel(),key=(x,y,z)=>`${x},${y},${z}`;
const identity=index=>index===4||index===14||index===15;
const turret=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json();
function connected(cells){
 const occupied=new Set(cells.map(c=>key(...c))),seen=new Set(),pending=[cells[0].slice(0,3)];
 while(pending.length){const c=pending.pop(),k=key(...c);if(seen.has(k)||!occupied.has(k))continue;seen.add(k);
  for(let axis=0;axis<3;axis++)for(const step of [-1,1]){const next=c.slice();next[axis]+=step;pending.push(next);}}
 return seen.size===occupied.size;
}

test('launcher and missile generators reproduce canonical sources with fixed connected matte geometry',async()=>{
 for(const generate of [missileLauncherModel,guidedMissileModel]){
  const source=generate();validateModel(source);expect(source).toEqual(await Bun.file(`assets/models/${source.id}.json`).json());
  expect(source.colorMode).toBeUndefined();expect(source.materials).toHaveLength(17);
  for(const [index,material]of source.materials.entries()){
   expect(material.color).toBe(turret.materials[index].color);expect(material.emission).toBe(identity(index)?1:0);
   expect(material.reflectiveness).toBe(0);expect(material.castsLight===true).toBe(source.id==='missile-launcher'&&identity(index));
  }
  for(const variant of Object.values(source.variants))for(const part of variant.parts){
   if(!part.voxels.length)continue;
   expect(part.id).toBe('body');expect(part.parent).toBeNull();expect(part.pivot).toEqual([12,0,12]);
   expect(connected(part.voxels)).toBe(true);
   expect(new Set(part.voxels.map(c=>key(...c))).size).toBe(part.voxels.length);
   expect(part.voxels.every(c=>c.slice(0,3).every((n,i)=>Number.isInteger(n)&&n>=0&&n<source.size[i]))).toBe(true);
  }
  const untouched=generate();source.variants.base.parts[0].voxels[0][3]=99;expect(generate()).toEqual(untouched);
 }
 expect(launcher.role).toBe('defence');expect(missile.role).toBeUndefined();
 for(const variant of ['upgrade1','upgrade2'])expect(missile.variants[variant].parts.every(p=>p.voxels.length===0)).toBe(true);
});

test('two four and six real open launch wells have fixed floors and no baked rounds',()=>{
 for(const [stage,variant]of VARIANTS.entries()){
  const parts=launcher.variants[variant].parts,cells=parts[0].voxels,occupied=new Set(cells.map(c=>key(...c)));
  const deck=MISSILE_LAUNCHER_DECK_Y[variant],sockets=MISSILE_LAUNCHER_SOCKETS[variant],r=MISSILE_WELL_HALF_WIDTH;
  expect(parts).toHaveLength(1);expect(sockets).toHaveLength(2+stage*2);expect(Math.max(...cells.map(c=>c[1]+1))).toBe(deck);
  for(const axis of [0,2]){expect(Math.min(...cells.map(c=>c[axis]))).toBe(1);expect(Math.max(...cells.map(c=>c[axis]+1))).toBe(23);}
  for(const [x,seat,z]of sockets){
   expect(seat+GUIDED_MISSILE_MODEL.height-deck).toBe(3);expect(MISSILE_LAUNCHER_CLEAR_Y[variant]-seat).toBe(10);
   for(let dx=-r;dx<r;dx++)for(let dz=-r;dz<r;dz++){
    expect(occupied.has(key(x+dx,seat-1,z+dz))).toBe(true);
    for(let y=seat;y<deck;y++)expect(occupied.has(key(x+dx,y,z+dz))).toBe(false);
   }
   for(let d=-r-1;d<=r;d++)for(const [px,pz]of [[x+d,z-r-1],[x+d,z+r],[x-r-1,z+d],[x+r,z+d]])expect(occupied.has(key(px,deck-1,pz))).toBe(true);
  }
 }
});

test('the reusable missile has four cardinal fins and the agreed upright tail-origin bounds',()=>{
 const cells=missile.variants.base.parts[0].voxels;
 expect(GUIDED_MISSILE_MODEL.origin).toEqual([12,0,12]);expect(GUIDED_MISSILE_MODEL.exhaust).toEqual([12,0,12]);expect(GUIDED_MISSILE_MODEL.forward).toEqual([0,1,0]);
 expect([0,1,2].map(i=>Math.min(...cells.map(c=>c[i])))).toEqual([10,0,10]);
 expect([0,1,2].map(i=>Math.max(...cells.map(c=>c[i]+1)))).toEqual([14,10,14]);
 let radius=0;for(const c of cells)for(const dx of [0,1])for(const dz of [0,1])radius=Math.max(radius,Math.hypot(c[0]+dx-12,c[2]+dz-12));
 expect(radius).toBeLessThanOrEqual(GUIDED_MISSILE_MODEL.radius+1e-12);
 expect(cells.filter(c=>c[1]<3&&c[0]===10)).toHaveLength(6);expect(cells.filter(c=>c[1]<3&&c[0]===13)).toHaveLength(6);
 expect(cells.filter(c=>c[1]<3&&c[2]===10)).toHaveLength(6);expect(cells.filter(c=>c[1]<3&&c[2]===13)).toHaveLength(6);
 expect(Object.isFrozen(GUIDED_MISSILE_MODEL)).toBe(true);expect(Object.isFrozen(GUIDED_MISSILE_MODEL.origin)).toBe(true);
 for(const sockets of Object.values(MISSILE_LAUNCHER_SOCKETS)){expect(Object.isFrozen(sockets)).toBe(true);for(const socket of sockets)expect(Object.isFrozen(socket)).toBe(true);}
});

test('actual loaded missile cells stay separate and clear every vertical departure interval',()=>{
 const rocket=missile.variants.base.parts[0].voxels,origin=GUIDED_MISSILE_MODEL.origin;
 for(const variant of VARIANTS){
  const body=new Set(launcher.variants[variant].parts[0].voxels.map(c=>key(...c))),loaded=new Set();let collision=null;
  for(const [socketIndex,socket]of MISSILE_LAUNCHER_SOCKETS[variant].entries()){
   const ox=socket[0]-origin[0],oy=socket[1]-origin[1],oz=socket[2]-origin[2];
   for(const cell of rocket){const k=key(cell[0]+ox,cell[1]+oy,cell[2]+oz);expect(loaded.has(k)).toBe(false);loaded.add(k);}
   // Test the swept prism of each actual occupied unit cell, not just sampled
   // positions. The union from lift0 to10 is exact for straight vertical motion.
   const travel=MISSILE_LAUNCHER_CLEAR_Y[variant]-socket[1];
   outer:for(const cell of rocket){
    const x=cell[0]+ox,z=cell[2]+oz,y0=cell[1]+oy,y1=y0+1+travel;
    for(let y=y0;y<y1;y++)if(body.has(key(x,y,z))){collision={variant,socketIndex,cell:cell.slice(0,3),body:[x,y,z]};break outer;}
   }
  }
  expect(collision).toBeNull();
 }
});

test('all zone palettes preserve identity emission and only launcher panels compile local lights',()=>{
 for(const source of [launcher,missile])for(const zone of ['A','B','C','D']){
  const mapped=modelForZone(source,zone),reference=modelForZone(turret,zone);expect(mapped.variants).toBe(source.variants);
  expect(mapped.materials.map(m=>m.color)).toEqual(reference.materials.map(m=>m.color));
  for(const [index,material]of mapped.materials.entries()){
   expect(material.emission).toBe(identity(index)?1:0);expect(material.reflectiveness).toBe(0);
   expect(material.castsLight===true).toBe(source.id==='missile-launcher'&&identity(index));
  }
 }
 for(const source of [launcher,missile]){
  const compiled=compileModel(source);
  for(const variant of Object.values(compiled.variants))for(const part of variant.parts){
   expect(part.vertices.every(Number.isFinite)).toBe(true);expect(part.indices.length).toBe(part.quads*6);
   if(source.id==='missile-launcher'){
    expect(part.lightQuads).toHaveLength(1);expect(part.quadMaterials[part.lightQuads[0]]).toBe(4);
   }else expect(part.lightQuads).toBeUndefined();
   expect(part.quadMaterials.filter(identity)).toHaveLength(part.quads?(source.id==='missile-launcher'?1:4):0);
   for(let i=0;i<part.vertices.length;i+=11){
    expect(part.vertices[i+9]).toBe(identity(part.quadMaterials[Math.floor(i/44)])?1:0);expect(part.vertices[i+10]).toBe(0);
   }
  }
 }
});
