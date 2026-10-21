import {test,expect} from 'bun:test';
import {newModel,validateModel,newPart,upgradeModel} from '../shared/model.js';
import {meshPart,compileModel} from '../shared/mesher.js';
import {newLevel,validateLevel,upgradeLevel} from '../shared/level.js';
import {partMatrices,placementMatrix} from '../shared/math.js';
import {turretStudy} from '../scripts/seed.js';
const fixture=cells=>{const m=newModel('test');m.variants.base.parts[0].voxels=cells;return m;};
test('24-unit authoring bounds accept distinct edge cells and reject either footprint overflow',()=>{
 const m=fixture([[23,0,0,0],[1,0,2,0],[0,1,0,0],[0,0,15,0],[23,23,23,0]]);
 expect(m.size).toEqual([24,24,24]);expect(newPart().pivot).toEqual([12,0,12]);expect(validateModel(m)).toBe(m);
 for(const cell of [[24,0,0,0],[0,0,24,0]])expect(()=>validateModel(fixture([cell]))).toThrow('bounds');
});
test('a full 24-unit box still compiles to six clean quads',()=>{
 const cells=[];for(let y=0;y<24;y++)for(let z=0;z<24;z++)for(let x=0;x<24;x++)cells.push([x,y,z,0]);
 const m=fixture(cells);validateModel(m);const mesh=meshPart(m,m.variants.base.parts[0]);
 expect(mesh.quads.length).toBe(6);expect(mesh.exposedFaces).toBe(3456);
 for(const q of mesh.quads){expect(q.width).toBe(24);expect(q.height).toBe(24);}
});
test('legacy source conversion preserves cells, rigs, materials and logical level coordinates',()=>{
 const old=fixture([[14,20,14,2,[1,-1,-1,-1,-1,-1]]]);old.version=1;old.size=[15,24,15];
 for(const v of Object.values(old.variants))v.parts[0].pivot=[7.5,0,7.5];
 const before=structuredClone(old),upgraded=upgradeModel(old);
 expect(old).toEqual(before);expect(upgraded.version).toBe(3);expect(upgraded.size).toEqual([24,24,24]);
 expect(upgraded.variants).toEqual(old.variants);expect(upgraded.materials).toEqual(old.materials);expect(upgradeModel(upgraded)).toBe(upgraded);
 const mesh=compileModel(upgraded);expect(mesh.version).toBe(3);expect(mesh.size).toEqual([24,24,24]);
 const level=newLevel('legacy');level.version=1;level.path=[[1,0,2],[2,0,2]];level.placements=[{id:'p1',model:'test',variant:'base',box:[2,1,3],turn:3}];
 const migrated=upgradeLevel(level);expect(migrated).toEqual({...level,version:4});expect(level.version).toBe(1);expect(validateLevel(migrated,new Map([['test',upgraded]]))).toBe(migrated);
 old.variants.base.parts[0].voxels[0][0]=15;expect(()=>upgradeModel(old)).toThrow('bounds');
});
test('all quarter-turns keep box corners on the 24-unit placement grid',()=>{
 const expected=[[.5,1.5],[22.5,.5],[23.5,22.5],[1.5,23.5]];
 for(let turn=0;turn<4;turn++){
  const m=placementMatrix([2,1,3],turn),[x,z]=expected[turn];
  expect(m[0]*.5+m[8]*1.5+m[12]).toBeCloseTo(48+x);
  expect(m[2]*.5+m[10]*1.5+m[14]).toBeCloseTo(72+z);expect(m[13]).toBe(24);
 }
});
test('version 2 conversion preserves fitting geometry and refuses destructive cropping',()=>{
 const old=fixture([[23,40,23,0]]);old.version=2;old.size=[32,48,32];
 for(const variant of Object.values(old.variants))variant.parts[0].pivot=[16,0,16];
 const before=structuredClone(old),converted=upgradeModel(old);
 expect(old).toEqual(before);expect(converted.size).toEqual([24,48,24]);expect(converted.version).toBe(3);
 expect(converted.variants).toEqual(old.variants);expect(converted.materials).toEqual(old.materials);
 old.variants.base.parts[0].voxels.push([24,0,0,0]);const oversized=structuredClone(old);
 expect(()=>upgradeModel(old)).toThrow('will not crop or resample');expect(old).toEqual(oversized);
 const level=newLevel('legacy-v2');level.version=2;level.placements=[{id:'p1',model:'test',variant:'base',box:[2,1,3],turn:2}];
 expect(upgradeLevel(level)).toEqual({...level,version:4});expect(level.version).toBe(2);
});
test('solid rectangular volumes remove internal faces and merge to six outward quads',()=>{
 const cells=[];for(let x=0;x<4;x++)for(let y=0;y<3;y++)for(let z=0;z<2;z++)cells.push([x,y,z,0]);
 const m=fixture(cells),mesh=meshPart(m,m.variants.base.parts[0]);expect(mesh.quads.length).toBe(6);expect(mesh.exposedFaces).toBe(52);
 for(let i=0;i<mesh.indices.length;i+=3){const a=mesh.indices[i]*11,b=mesh.indices[i+1]*11,c=mesh.indices[i+2]*11,v=mesh.vertices;
 const ab=[v[b]-v[a],v[b+1]-v[a+1],v[b+2]-v[a+2]],ac=[v[c]-v[a],v[c+1]-v[a+1],v[c+2]-v[a+2]];
 const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
 expect(normal[0]*v[a+3]+normal[1]*v[a+4]+normal[2]*v[a+5]).toBeGreaterThan(0);}
});
test('greedy surface coverage matches an independent cell-neighbour oracle, with face materials',()=>{
 let seed=17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
 for(let run=0;run<10;run++){
 const cells=[];for(let x=0;x<5;x++)for(let y=0;y<5;y++)for(let z=0;z<5;z++)if(random()>.45)cells.push([x,y,z,random()>.5?0:1,[-1,-1,2,-1,-1,-1]]);
 const m=fixture(cells),mesh=meshPart(m,m.variants.base.parts[0]),occupied=new Set(cells.map(c=>c.slice(0,3).join(','))),expected=new Set(),actual=new Set();
 for(const c of cells)for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const n=c.slice(0,3);n[axis]+=sign;if(occupied.has(n.join(',')))continue;const face=axis*2+(sign>0?0:1),material=c[4][face]>=0?c[4][face]:c[3];const p=c.slice(0,3);if(sign>0)p[axis]++;expected.add(`${axis},${sign},${p},${material}`);}
 for(const q of mesh.quads){const u=(q.axis+1)%3,v=(q.axis+2)%3;for(let i=0;i<q.width;i++)for(let j=0;j<q.height;j++){const p=q.origin.slice();p[u]+=i;p[v]+=j;const key=`${q.axis},${q.sign},${p},${q.material}`;expect(actual.has(key)).toBe(false);actual.add(key);}}
 expect(actual).toEqual(expected);
 }
});
test('per-face emission, reflectiveness and palette identity survive mesh compilation',()=>{const m=fixture([[0,0,0,0,[1,-1,-1,-1,-1,-1]]]);m.materials[1].emission=.7;m.materials[1].reflectiveness=.9;const p=compileModel(m).variants.base.parts[0];const index=p.vertices.findIndex((_,i)=>i%11===3&&p.vertices[i]===1)-3;expect(p.vertices[index+9]).toBeCloseTo(.7);expect(p.vertices[index+10]).toBeCloseTo(.9);expect(p.quadMaterials.length).toBe(p.quads);expect(p.quadMaterials[index/44]).toBe(1);});
test('optional light casting is independent of emission and survives face overrides and greedy meshing',()=>{
 const m=fixture([[0,0,0,0],[1,0,0,0,[-1,-1,1,-1,-1,-1]]]);
 m.materials[0].emission=1;m.materials[0].castsLight=false;
 m.materials[1]={...m.materials[0],name:'Opt-in light',castsLight:true};
 const mesh=meshPart(m,m.variants.base.parts[0]),top=mesh.quads.filter(q=>q.axis===1&&q.sign===1);
 expect(top.length).toBe(2);expect(top.map(q=>q.material).sort()).toEqual([0,1]);
 expect(mesh.lightQuads).toEqual(mesh.quads.flatMap((q,i)=>q.material===1?[i]:[]));
 const compiled=compileModel(m);expect(compiled.materials[0].castsLight).toBe(false);expect(compiled.materials[1].castsLight).toBe(true);
 expect(compiled.variants.base.parts[0].lightQuads).toEqual(mesh.lightQuads);
 expect(compiled.variants.base.parts[0].quadMaterials.filter(i=>compiled.materials[i].castsLight).length).toBe(1);
 m.materials[1].emission=0;expect(validateModel(m)).toBe(m);
 expect(meshPart(m,m.variants.base.parts[0]).lightQuads).toBeUndefined();
 for(const value of [null,1,'true',{}]){m.materials[1].castsLight=value;expect(()=>validateModel(m)).toThrow('castsLight');}
 delete m.materials[1].castsLight;expect(validateModel(m)).toBe(m);
});
test('reject duplicate cells, footprints, material ranges and cyclic rigs',()=>{
 expect(()=>validateModel(fixture([[0,0,0,0],[0,0,0,1]]))).toThrow('overlapping');expect(()=>validateModel(fixture([[24,0,0,0]]))).toThrow('bounds');
 const m=newModel('test');m.materials[0].emission=1.01;expect(()=>validateModel(m)).toThrow('emission');m.materials[0].emission=0;m.materials[0].reflectiveness=-.1;expect(()=>validateModel(m)).toThrow('reflectiveness');m.materials[0].reflectiveness=0;m.variants.base.parts[0].parent='body';expect(()=>validateModel(m)).toThrow('cyclic');
});
test('tall models work; touching rigid parts retain faces needed after articulation',()=>{
 const m=fixture([[0,40,0,0]]);m.size[1]=64;const p=newPart('top');p.voxels=[[0,41,0,0]];m.variants.base.parts.push(p);validateModel(m);expect(meshPart(m,p).quads.length).toBe(6);expect(meshPart(m,m.variants.base.parts[0]).quads.length).toBe(6);
});
test('rig rotation leaves the pivot fixed and propagates to children',()=>{const a=newPart('body'),b=newPart('head');a.pivot=[1,2,3];b.parent='body';const matrices=partMatrices([a,b],{body:[0,90,0]});const m=matrices.get('head');const transform=(x,y,z)=>[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];expect(transform(1,2,3)).toEqual([1,2,3]);expect(transform(2,2,3)[2]).toBeCloseTo(2);});
test('levels enforce waves, ordered paths and references; path guides can cross terrain models',()=>{const l=newLevel('test');l.waves=4;expect(()=>validateLevel(l)).toThrow('five');l.waves=5;l.path=[[0,0,0],[2,0,0]];expect(()=>validateLevel(l)).toThrow('edge');l.path=[[0,0,0],[1,0,0]];l.placements=[{id:'p1',model:'test',variant:'base',box:[1,0,0],turn:0}];expect(validateLevel(l)).toBe(l);expect(()=>validateLevel(l,new Map())).toThrow('Missing');});
test('level validator catches tall meshes overlapping vertically stacked placements',()=>{const m=fixture([[0,0,0,0],[0,24,0,0]]),l=newLevel('test');m.size[1]=64;l.placements=[0,1].map(y=>({id:`p${y}`,model:'test',variant:'base',box:[0,y,0],turn:0}));expect(()=>validateLevel(l,new Map([['test',m]]))).toThrow('world space');});
test('placement quarter-turn agrees with cell-grid rotation',()=>{const m=placementMatrix([2,1,3],1),x=.5,z=1.5;expect(m[0]*x+m[8]*z+m[12]).toBeCloseTo(70.5);expect(m[2]*x+m[10]*z+m[14]).toBeCloseTo(72.5);expect(m[13]).toBe(24);});
test('all sample turret variants are valid and have independent yaw and pitch parts',()=>{const m=turretStudy();expect(validateModel(m)).toBe(m);expect(compileModel(m).variants.upgrade2.parts.length).toBe(3);});
