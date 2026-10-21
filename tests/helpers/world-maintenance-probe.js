// Historical routed fixtures retain the combat/animation measurement baseline.
// bun tests/helpers/world-maintenance-probe.js <pre-change-source-root> [output.json]
// Uses current saved assets for both source trees. Measures load-time CPU work,
// never FPS or GPU time; output also checks exact mesh/instance equivalence.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cpus} from 'node:os';
import {previewActorsForLevel} from '../../game/enemy-preview.js';
import {wildlifeActorsForLevel} from '../../game/wildlife-preview.js';
import {missileActorsForLevel} from '../../game/missile-preview.js';

const root=resolve(import.meta.dir,'../..'),beforeRoot=process.argv[2];
if(!beforeRoot)throw new Error('Supply the pre-change source root.');
const implementations=await Promise.all([resolve(beforeRoot),root].map(path=>import(pathToFileURL(resolve(path,'engine/world.js')).href)));
function signature(world){
 const hash=new Bun.CryptoHasher('sha256');
 for(const entry of [...world.entries,world.water]){
  hash.update(entry.key);hash.update(JSON.stringify(entry.mesh));
  for(const matrix of entry.transforms)hash.update(new Uint8Array(matrix.buffer,matrix.byteOffset,matrix.byteLength));
 }
 hash.update(JSON.stringify({quads:world.quads,uniqueQuads:world.uniqueQuads,assets:world.assetIds}));return hash.digest('hex');
}
const scenes=[];
for(const id of ['moss-01','moss-02','moss-03','ochre-03','plum-03']){
 const level=await Bun.file(resolve(root,'docs/landscape-reset-2026-10-18/previous-levels',id+'.json')).json();
 const actors=[...previewActorsForLevel(id),...wildlifeActorsForLevel(id),...missileActorsForLevel(id)],models=new Map();
 for(const modelId of new Set([...level.placements,...actors].map(p=>p.model)))models.set(modelId,await Bun.file(resolve(root,'assets/models',modelId+'.json')).json());
 const copies=[...level.placements,...actors],variants=new Map(copies.map(p=>[p.model+':'+p.variant,p]));
 const partCount=p=>models.get(p.model).variants[p.variant].parts.length;
 const samples=[[],[]],hashes=[];
 for(let run=-1;run<5;run++)for(const index of run%2===0?[1,0]:[0,1]){
  const started=performance.now(),world=implementations[index].buildWorld(level,models,{actors}),ms=performance.now()-started;
  if(run>=0)samples[index].push(ms);
  if(run===0)hashes[index]=signature(world);
  implementations[index].disposeWorld(world);
 }
 if(hashes[0]!==hashes[1])throw new Error(id+' geometry/instance mismatch');
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
 scenes.push({id,equivalent:true,sha256:hashes[0],bindHierarchyBuilds:{before:copies.length,after:variants.size},bindPartTransforms:{before:copies.reduce((n,p)=>n+partCount(p),0),after:[...variants.values()].reduce((n,p)=>n+partCount(p),0)},buildWorldMs:{before:samples[0],after:samples[1],medianBefore:median(samples[0]),medianAfter:median(samples[1])}});
}
const result={date:new Date().toISOString(),environment:{bun:Bun.version,platform:process.platform,arch:process.arch,cpu:cpus()[0]?.model},method:'Five alternating-order measured world builds after one warmup per implementation and scene; asset reads and exact hashing excluded. Bind counts derive from actual placements/actors and unique model+variant pairs. CPU load times include unchanged validation, meshing and visibility building; small differences are noisy and are not frame or GPU timings.',scenes};
if(process.argv[3])await Bun.write(process.argv[3],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
