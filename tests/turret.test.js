import {test,expect} from 'bun:test';
import {turretModel} from '../scripts/turret.js';
import {validateModel,VARIANTS} from '../shared/model.js';
import {compileModel} from '../shared/mesher.js';

const model=turretModel(),key=(x,y,z)=>`${x},${y},${z}`;
test('turret variants are connected rigid solids within one footprint, with full yaw clearance',()=>{
  validateModel(model);
  let previousHeight=0;
  for(const v of VARIANTS){
    const [base,head,guns]=model.variants[v].parts;
    expect(head.parent).toBe(base.id);expect(head.pivot[0]).toBe(12);expect(head.pivot[2]).toBe(12);
    const fixedTop=Math.max(...base.voxels.map(c=>c[1]+1));
    const movingBottom=Math.min(...head.voxels.map(c=>c[1]));
    // Yaw preserves Y, so this proves no positive-volume intersection at any angle.
    expect(movingBottom).toBeGreaterThanOrEqual(fixedTop);expect(head.pivot[1]).toBe(movingBottom);
    const height=Math.max(...head.voxels.map(c=>c[1]+1));expect(height).toBeGreaterThan(previousHeight);previousHeight=height;
    expect(guns.parent).toBe(head.id);expect(guns.pivot).toEqual([12,{base:24.5,upgrade1:27.5,upgrade2:29.5}[v],15]);
    for(const part of [base,head,guns]){
      const occupied=new Set(part.voxels.map(c=>key(...c))),seen=new Set(),pending=[part.voxels[0].slice(0,3)];
      while(pending.length){const p=pending.pop(),k=key(...p);if(seen.has(k)||!occupied.has(k))continue;seen.add(k);
        for(let axis=0;axis<3;axis++)for(const step of [-1,1]){const n=p.slice();n[axis]+=step;pending.push(n);}}
      expect(seen.size).toBe(occupied.size);
      expect(part.voxels.every(c=>c[0]>=0&&c[0]<24&&c[2]>=0&&c[2]<24)).toBe(true);
    }
  }
});

test('every turret has exactly two front muzzle rings with real recessed bores',()=>{
  for(const v of VARIANTS){
    const cells=model.variants[v].parts.find(p=>p.id==='guns').voxels,occupied=new Set(cells.map(c=>key(...c)));
    const front=Math.min(...cells.map(c=>c[2])),plane=new Set(cells.filter(c=>c[2]===front).map(c=>`${c[0]},${c[1]}`)),components=[];
    while(plane.size){const pending=[plane.values().next().value],component=[];
      while(pending.length){const k=pending.pop();if(!plane.delete(k))continue;const [x,y]=k.split(',').map(Number);component.push([x,y]);pending.push(`${x-1},${y}`,`${x+1},${y}`,`${x},${y-1}`,`${x},${y+1}`);}
      components.push(component);
    }
    expect(components.length).toBe(2);
    for(const ring of components){
      const x0=Math.min(...ring.map(p=>p[0])),x1=Math.max(...ring.map(p=>p[0])),y0=Math.min(...ring.map(p=>p[1])),y1=Math.max(...ring.map(p=>p[1]));
      expect(x1-x0).toBe(6);expect(y1-y0).toBe(6);
      for(let x=x0+2;x<=x1-2;x++)for(let y=y0+2;y<=y1-2;y++){
        for(let depth=0;depth<4;depth++)expect(occupied.has(key(x,y,front+depth))).toBe(false);
        expect(occupied.has(key(x,y,front+4))).toBe(true);
      }
    }
  }
});

test('turret exports retain material variation, three parts, and the saved editable source',async()=>{
  const saved=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json();expect(saved).toEqual(model);
  const mesh=compileModel(model);expect(mesh.role).toBe('defence');
  for(const v of VARIANTS){
    const parts=mesh.variants[v].parts;expect(parts.length).toBe(3);
    const used=new Set(parts.flatMap(p=>p.quadMaterials));expect(used.size).toBeGreaterThan(5);
    expect(used.has(4)).toBe(true); // Vermilion identity accent remains visible.
    for(const p of parts){expect(p.quads).toBeLessThan(p.exposedFaces);
      expect(p.lightQuads??[]).toEqual(p.quadMaterials.flatMap((material,index)=>material===4?[index]:[]));}
  }
  for(const [index,m]of model.materials.entries()){
    const accent=[4,14,15].includes(index);expect(m.emission).toBe(accent?1:0);
    expect(m.castsLight===true).toBe(accent);expect(m.reflectiveness).toBe(0);
  }
});
