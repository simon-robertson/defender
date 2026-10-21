import {test,expect} from 'bun:test';
import {newLevel,validateLevel,upgradeLevel} from '../shared/level.js';
import {TerrainField,placementY,setPathHeight,validateTerrain} from '../shared/terrain.js';
import {meshTerrainChunk,terrainMaterials,TerrainMeshes} from '../shared/terrain-mesh.js';
import {newModel} from '../shared/model.js';
import {terrainStudy} from '../scripts/seed.js';
const edit=(l,x,z,op,value)=>{const f=new TerrainField(l);const result=f.paint(x,z,op,value);f.commit();return result;};
test('terrain changes whole boxes horizontally and single units vertically, with independent water depth',()=>{
 const l=newLevel('terrain');expect(l.version).toBe(4);expect(l.terrain.boxes).toEqual([]);
 edit(l,1,2,'flatten',4);edit(l,1,2,'water',8);let f=new TerrainField(l);
 for(const [x,z]of [[24,48],[47,71],[30,60]]){expect(f.height(x,z)).toBe(4);expect(f.height(x,z,true)).toBe(12);}
 expect(f.height(23,48)).toBe(24);expect(f.height(48,48)).toBe(24);
 edit(l,1,2,'raise');f=new TerrainField(l);expect(f.height(24,48)).toBe(5);expect(f.height(24,48,true)).toBe(12);
 edit(l,1,2,'flatten',12);expect(new TerrainField(l).height(24,48,true)).toBe(0);
 edit(l,1,2,'flatten',24);expect(l.terrain.boxes).toEqual([]);validateLevel(l);
});
test('one stroke only raises each box once; sparse terrain round-trips without mutating snapshots',()=>{
 const l=newLevel('terrain'),f=new TerrainField(l),visited=new Set();f.paint(0,0,'raise',0,visited);f.paint(0,0,'raise',0,visited);f.paint(1,0,'raise',0,visited);f.commit();
 expect(l.terrain.boxes.length).toBe(2);const restored=JSON.parse(JSON.stringify(l));validateLevel(restored);
 const r=new TerrainField(restored);expect(r.height(0,0)).toBe(25);expect(r.height(24,0)).toBe(25);expect(r.height(48,0)).toBe(24);
 const before=JSON.stringify(l);const copy=structuredClone(l);edit(copy,0,0,'lower');expect(JSON.stringify(l)).toBe(before);
});
test('path boxes are protected, always dry and flat, with atomic common-height changes',()=>{
 const l=newLevel('route');l.path=[[0,0,0],[1,0,0]];
 expect(edit(l,0,0,'flatten',4).protectedCount).toBe(1);expect(l.terrain.boxes.length).toBe(0);expect(edit(l,0,0,'water',8).changed).toBe(0);
 setPathHeight(l,25);validateLevel(l);expect(new TerrainField(l).flatBox(0,0)).toBe(25);expect(new TerrainField(l).flatBox(1,0)).toBe(25);expect(new TerrainField(l).flatBox(2,0)).toBe(24);
 const f=new TerrainField(l);f.setBox(0,0,24,0);f.commit();expect(()=>validateLevel(l)).toThrow('flat and dry');
});
test('scenery follows single-unit mound changes; flooded and intersecting placements are rejected',()=>{
 const l=newLevel('mound'),m=newModel('scenery');m.role='scenery';m.variants.base.parts[0].voxels=[[0,0,0,0]];const models=new Map([[m.id,m]]);
 l.placements=[{id:'p1',model:m.id,variant:'base',box:[0,0,0],turn:0}];
 edit(l,0,0,'flatten',31);expect(placementY(l,l.placements[0])).toBe(31);validateLevel(l,models);
 edit(l,0,0,'raise');expect(placementY(l,l.placements[0])).toBe(32);validateLevel(l,models);
 edit(l,0,0,'water',1);expect(()=>validateLevel(l,models)).toThrow('flat, dry');
 edit(l,0,0,'drain');l.placements[0].anchor='absolute';expect(()=>validateLevel(l,models)).toThrow('ground');
 l.placements[0].box[1]=2;validateLevel(l,models);expect(placementY(l,l.placements[0])).toBe(48);
});
test('terrain rejects fractional box coordinates, invalid heights, duplicate and out-of-bounds boxes',()=>{
 const l=newLevel('bad');edit(l,0,0,'lower');const good=structuredClone(l);
 for(const [h,w]of [[4.5,12],[4,4],[257,0],[4,-1]]){l.terrain.boxes[0].ground=h;l.terrain.boxes[0].water=w;expect(()=>validateTerrain(l)).toThrow();}
 l.terrain=structuredClone(good.terrain);l.terrain.boxes.push(structuredClone(l.terrain.boxes[0]));expect(()=>validateTerrain(l)).toThrow('Duplicate');
 for(const x of [.5,1]){l.terrain=structuredClone(good.terrain);l.size=[1,1];l.terrain.boxes[0].box=[x,0];expect(()=>validateTerrain(l)).toThrow('bounds');}
 const f=new TerrainField(good);expect(()=>f.setBox(.5,0,4,12)).toThrow('bounds');expect(()=>f.paint(0,0,'water',256)).toThrow('heights');
});
test('legacy layouts gain terrain without mutating source or changing horizontal positions',()=>{
 const old={schema:'defender.level',version:3,id:'legacy',name:'Legacy',size:[2,2],zone:'A',waves:5,path:[[0,0,0]],placements:[{id:'p1',model:'test',variant:'base',box:[1,0,1],turn:0}]};
 const before=structuredClone(old),next=upgradeLevel(old);expect(old).toEqual(before);expect(next.version).toBe(4);expect(next.pathHeight).toBe(24);expect(next.path).toEqual(old.path);expect(next.placements).toEqual(old.placements);expect(placementY(next,next.placements[0])).toBe(24);
});
test('flat terrain instances shared meshes and batches one-offs; internal seams have no faces',()=>{
 const l=newLevel('flat');l.size=[4,4];const cache=new TerrainMeshes(),entries=cache.scene(l);
 expect(entries.length).toBe(6);expect(entries.reduce((n,e)=>n+e.mesh.quads.length*e.transforms.length,0)).toBe(48);
 const f=new TerrainField(l),mesh=meshTerrainChunk(f,1,1,terrainMaterials('A'));expect(mesh.quads.length).toBe(2);expect(mesh.quads.every(q=>q.axis===1)).toBe(true);
 const same=cache.scene(l);expect(same.map(e=>e.mesh)).toEqual(entries.map(e=>e.mesh));
 edit(l,1,1,'raise');const changed=cache.scene(l);expect(changed.some(e=>entries.some(old=>old.mesh===e.mesh))).toBe(true);
});
test('terrain surface coverage matches an independent solid-cell oracle, including water and borders',()=>{
 const l=newLevel('surface');l.size=[3,2];const f=new TerrainField(l);
 for(const [x,z,h,w]of [[0,0,4,0],[1,0,2,5],[2,0,3,5],[0,1,6,0],[1,1,1,3],[2,1,0,2]])f.setBox(x,z,h,w);f.commit();
 const actual=new Set(),expected=new Set();
 for(let bz=0;bz<2;bz++)for(let bx=0;bx<3;bx++){const mesh=meshTerrainChunk(f,bx,bz,terrainMaterials('A'));for(const q of mesh.quads){const u=(q.axis+1)%3,v=(q.axis+2)%3;for(let i=0;i<q.width;i++)for(let j=0;j<q.height;j++){const p=q.origin.slice();p[0]+=bx*24;p[2]+=bz*24;p[u]+=i;p[v]+=j;const id=`${q.axis},${q.sign},${p}`;expect(actual.has(id)).toBe(false);actual.add(id);}}
 for(let i=0;i<mesh.indices.length;i+=3){const v=mesh.vertices,a=mesh.indices[i]*11,b=mesh.indices[i+1]*11,c=mesh.indices[i+2]*11,ab=[v[b]-v[a],v[b+1]-v[a+1],v[b+2]-v[a+2]],ac=[v[c]-v[a],v[c+1]-v[a+1],v[c+2]-v[a+2]];expect((ab[1]*ac[2]-ab[2]*ac[1])*v[a+3]+(ab[2]*ac[0]-ab[0]*ac[2])*v[a+4]+(ab[0]*ac[1]-ab[1]*ac[0])*v[a+5]).toBeGreaterThan(0);}}
 const height=(x,z)=>Math.max(f.height(x,z),f.height(x,z,true));
 for(let z=0;z<48;z++)for(let x=0;x<72;x++)for(let y=0;y<height(x,z);y++)for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const n=[x,y,z];n[axis]+=sign;if(n[1]>=0&&n[1]<height(n[0],n[2]))continue;const p=[x,y,z];if(sign>0)p[axis]++;expected.add(`${axis},${sign},${p}`);}
 expect(actual).toEqual(expected);
});
test('the study stream is box aligned; turret positions and path stay in their original boxes',()=>{
 const l=terrainStudy();validateLevel(l);expect(l.placements.map(p=>p.box)).toEqual([[2,0,1],[4,0,1],[6,0,1]]);expect(l.path).toEqual(Array.from({length:8},(_,x)=>[x,0,3]));
 const f=new TerrainField(l);for(let x=0;x<192;x++)for(let z=96;z<120;z++){expect(f.height(x,z)).toBe(4);expect(f.height(x,z,true)).toBe(12);}
 expect(f.height(24,120)).toBe(24);
});
