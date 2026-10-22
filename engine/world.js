import {FISH_MODEL,hasFishWater,fishHabitat} from '../shared/fish-habitat.js';
import {defaultWaterMaterial,validateWaterMaterial} from '../shared/water.js';
import {validateLevel} from '../shared/level.js';
import {isNonCombatPreview} from '../shared/preview-mode.js';
import {BRIDGE_MATERIALS,bridgeQuads} from '../shared/bridges.js';
import {validateModel,validId,VARIANTS} from '../shared/model.js';
import {TerrainField,placementY} from '../shared/terrain.js';
import {meshTerrainChunk} from '../shared/terrain-mesh.js';
import {meshPart,meshQuads} from '../shared/mesher.js';
import {identity,placementMatrix,partMatrices,multiply} from '../shared/math.js';
import {TERRAIN_MATERIALS,modelForZone} from '../shared/zone-style.js';
import {SceneryVisibility} from './visibility.js';
import {pathSurfaceQuads,pathShoulderQuads,PATH_SHOULDER_MATERIALS} from '../shared/path-surface.js';

// Load-time colour patches across several boxes. The old per-box colour cycle
// produced a checkerboard on broad deployment courts; keep those surfaces quiet.
function groundHash(x,z){let n=Math.imul(x+173,374761393)^Math.imul(z+271,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function groundMaterial(bx,bz){
 const x=bx/4,z=bz/4,ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz,s=u*u*(3-2*u),t=v*v*(3-2*v);
 const a=groundHash(ix,iz)*(1-s)+groundHash(ix+1,iz)*s,b=groundHash(ix,iz+1)*(1-s)+groundHash(ix+1,iz+1)*s,value=a*(1-t)+b*t;
 return value<.3?4:value<.58?0:value<.77?3:5;
}

// Surface replacement, never a path decal on top of an existing ground face.
export function terrainGeometry(level){
  const terrainPalette=[...TERRAIN_MATERIALS[level.zone]];
  const shoulderMaterialStart=terrainPalette.length;terrainPalette.push(...PATH_SHOULDER_MATERIALS);
  const bridgeMaterialStart=terrainPalette.length;terrainPalette.push(...BRIDGE_MATERIALS);
  const field=new TerrainField(level),route=field.path,quads=[],waterQuads=[],shoulderCells=new Int8Array(24*24);
  // Bridge spans cannot paint soil shoulders onto the adjacent banks. Their
  // wooden surface is separate from the unchanged natural bed and water.
  const shoulderRoute=field.bridges.size?new Set([...route].filter(id=>!field.bridges.has(id))):route;
  for(let bz=0;bz<level.size[1];bz++)for(let bx=0;bx<level.size[0];bx++){
    for(const q of meshTerrainChunk(field,bx,bz,terrainPalette,true).quads){
      const x=q.origin[0]+bx*24,y=q.origin[1],z=q.origin[2]+bz*24;
      if(q.material===2){waterQuads.push({...q,origin:[x,y,z]});continue;}
      if(q.axis===1&&q.sign===1&&q.material===0){
        if(field.height(x,z,true)){
          // Bed colour patches are real non-overlapping face materials, at the authored ground height.
          for(let iz=0;iz<24;iz+=4)for(let ix=0;ix<24;ix+=4)quads.push({origin:[x+ix,y,z+iz],axis:1,sign:1,width:4,height:4,material:12+((bx*31+bz*7+ix*3+iz*11+(ix*iz)/16)%7)%4});
        }else if(route.has(bx+','+bz)){
          quads.push(...pathSurfaceQuads(bx,bz,y));
        }else{
          const material=groundMaterial(bx,bz);
          const shoulder=y===level.pathHeight?pathShoulderQuads(shoulderRoute,bx,bz,y,material,shoulderMaterialStart,shoulderCells):null;
          if(shoulder)quads.push(...shoulder);else quads.push({...q,origin:[x,y,z],material});
        }
      }else if(q.axis!==1&&q.material===1){
        const extent=q.axis===0?q.width:q.height,top=y+extent;
        // Exposed banks have a stone base and a shallow turf cap, all contiguous.
        const edges=[y,...[8,16,Math.max(y,top-3)].filter(v=>v>y&&v<top),top].sort((a,b)=>a-b);
        for(let i=1;i<edges.length;i++){const lo=edges[i-1],hi=edges[i];if(lo===hi)continue;
          quads.push({...q,origin:[x,lo,z],width:q.axis===0?hi-lo:q.width,height:q.axis===2?hi-lo:q.height,material:lo>=top-3?4:lo<8?11:lo<16?10:1});
        }
      }else quads.push({...q,origin:[x,y,z]});
    }
  }
  quads.push(...bridgeQuads(level,bridgeMaterialStart));
  return {ground:meshQuads(quads,terrainPalette),water:meshQuads(waterQuads,terrainPalette)};
}
export function groundMesh(level){return terrainGeometry(level).ground;}
function validateActors(actors,models=null,placements=[]){
  // Input safety guard matching level authoring, not a gameplay entity budget.
  if(!Array.isArray(actors)||actors.length>16384)throw new Error('Invalid runtime actor collection.');
  const ids=new Set(placements.map(p=>p.id));
  for(const actor of actors){
    if(!actor||!validId(actor.id)||ids.has(actor.id)||!validId(actor.model)||!VARIANTS.includes(actor.variant))throw new Error('Invalid or duplicate runtime actor.');
    ids.add(actor.id);
    if(models&&!models.has(actor.model))throw new Error('Runtime actor model is missing: '+actor.model);
  }
}
export function buildWorld(level,models,{actors=[],includeFish=false}={}){
  for(const m of models.values())validateModel(m);
  validateLevel(level,models);
  validateActors(actors,models,level.placements);
  if(isNonCombatPreview(level)&&actors.some(actor=>models.get(actor.model).role!=='scenery'))throw new Error('Landscape and layout previews only support cosmetic scenery actors.');
  const styledModels=new Map([...models].map(([id,model])=>[id,modelForZone(model,level.zone)]));
  const field=new TerrainField(level),route=field.path;
  const terrain=terrainGeometry(level),waterMaterial=validateWaterMaterial(level.waterMaterial??defaultWaterMaterial());
  const entries=[{key:'ground',mesh:terrain.ground,transforms:[identity()]}],groups=new Map(),rigs=new Map(),actorRigs=new Map(),bindPoses=new Map();
  const addRig=(p,root,target)=>{
    const model=styledModels.get(p.model),parts=model.variants[p.variant].parts,poseKey=p.model+':'+p.variant,instances=[];
    // Immutable author poses repeat across scenery/actor instances. Cache only
    // during this build; each instance still owns its animated world matrix.
    let poses=bindPoses.get(poseKey);if(!poses){poses=partMatrices(parts);bindPoses.set(poseKey,poses);}
    for(const part of parts){
      const key=p.model+':'+p.variant+':'+part.id;
      let group=groups.get(key);if(!group){group={key,mesh:meshPart(model,part),transforms:[]};groups.set(key,group);}
      const matrix=new Float32Array(16);multiply(matrix,root,poses.get(part.id));
      instances.push({part:part.id,key,index:group.transforms.length,matrix});group.transforms.push(matrix);
    }
    target.set(p.id,{model:p.model,role:model.role,variant:p.variant,root,parts,instances});
  };
  for(const p of level.placements){
    const model=styledModels.get(p.model),parts=model.variants[p.variant].parts;
    const root=placementMatrix(p.box,p.turn,p.offset);root[13]=placementY(level,p,field);
    // Route clearance is checked against actual cells, including offset props.
    for(const part of parts)for(const cell of part.voxels){
      const x=root[0]*(cell[0]+.5)+root[8]*(cell[2]+.5)+root[12],z=root[2]*(cell[0]+.5)+root[10]*(cell[2]+.5)+root[14];
      if(route.has(Math.floor(x/24)+','+Math.floor(z/24)))throw new Error(`${p.id} blocks the enemy route.`);
    }
    addRig(p,root,rigs);
  }
  // Moving actors are not scenery obstacles. Their controller establishes the
  // initial root/pose before the first rendered frame; source layouts stay intact.
  for(const actor of actors)addRig(actor,identity(),actorRigs);
  entries.push(...groups.values());
  const world={level,entries,rigs,actors:actorRigs,visibility:new SceneryVisibility(level,models),assetIds:[...models.keys()],water:{key:'water',mesh:terrain.water,transforms:[identity()]},waterMaterial,width:level.size[0]*24,length:level.size[1]*24,
    quads:terrain.water.quads.length+entries.reduce((n,e)=>n+e.mesh.quads.length*e.transforms.length,0),
    uniqueQuads:terrain.water.quads.length+entries.reduce((n,e)=>n+e.mesh.quads.length,0)};
  world.visibility.setDefences(level,models,rigs);
  world.fishHabitat=includeFish&&models.has(FISH_MODEL)?fishHabitat(world):null;world.fishActors=[];
  if(world.fishHabitat){
   const schools=world.fishHabitat.pools,population=Math.round(schools.length*3*.75),pool=addWorldRigPool(world,models.get(FISH_MODEL),'base',population);
   // Round the combined population, then share it across certified pools.
   // One pool keeps two fish; two pools retain five rather than only four.
   for(let schoolIndex=0;schoolIndex<schools.length;schoolIndex++){
    const school=schools[schoolIndex],count=Math.round((schoolIndex+1)*3*.75)-Math.round(schoolIndex*3*.75);
    for(let i=0;i<count;i++){
     const index=world.fishActors.length,id=`wildlife-fish-${index+1}`,node=school.nodes[Math.floor((i+.5)*school.nodes.length/count)];
     world.fishActors.push({id,node,index});actorRigs.set(id,pool.rigs[index]);for(const entry of pool.entries)entry.activeIndices.push(index);
    }
   }
   world.quads+=pool.entries.reduce((n,e)=>n+e.mesh.quads.length*e.activeIndices.length,0);
  }
  return world;
}
// Bounded runtime membership: geometry and logical instance indices are allocated
// once, before the renderer receives the world. Inactive slots consume no light.
export function addWorldRigPool(world,rawModel,variant,capacity){
 const model=modelForZone(rawModel,world.level.zone),parts=model.variants[variant].parts,poses=partMatrices(parts),entries=parts.map(part=>({key:model.id+':'+variant+':'+part.id,mesh:meshPart(model,part),transforms:[],activeIndices:[],dynamic:true})),rigs=[];
 for(let index=0;index<capacity;index++){
  const root=identity(),instances=parts.map((part,i)=>{const matrix=new Float32Array(poses.get(part.id));entries[i].transforms.push(matrix);return {part:part.id,key:entries[i].key,index,matrix};});
  rigs.push({model:model.id,role:model.role,variant,root,parts,instances});
 }
 world.entries.push(...entries);world.uniqueQuads+=entries.reduce((n,e)=>n+e.mesh.quads.length,0);
 return {entries,rigs};
}
export async function loadWorld(id,{signal,actors=[],sourceLevel=null}={}){
  async function asset(kind,key){const r=await fetch(`/api/${kind}/${key}`,{signal,cache:'no-store'});if(!r.ok)throw new Error(`Unable to load ${key}.`);return (await r.json()).asset;}
  const level=sourceLevel??await asset('levels',id);
  // Resolve actors from the fetched source before requesting any model. A
  // landscape can share a catalogue ID with an archived combat fixture.
  validateLevel(level);
  if(level.id!==id)throw new Error('Level source ID does not match the requested world.');
  const selectedActors=typeof actors==='function'?actors(level):actors;
  validateActors(selectedActors);
  const runtimeActors=selectedActors.map(({id,model,variant})=>({id,model,variant}));
  const ids=[...new Set([...level.placements.map(p=>p.model),...runtimeActors.map(p=>p.model),...(hasFishWater(level)&&runtimeActors.some(a=>a.id.startsWith('wildlife-'))?[FISH_MODEL]:[])])];
  const list=await Promise.all(ids.map(id=>asset('models',id)));
  signal?.throwIfAborted();
  return buildWorld(level,new Map(list.map(m=>[m.id,m])),{actors:runtimeActors,includeFish:runtimeActors.some(a=>a.id.startsWith('wildlife-'))});
}
export function disposeWorld(world){
 if(!world)return;
 world.visibility?.dispose();world.visibility=null;
 world.entries.length=0;world.rigs.clear();world.actors?.clear();world.assetIds.length=0;
 world.onDebrisWaterImpact=null;world.fishHabitat=null;world.fishActors?.splice(0);world.level=null;world.water=null;world.waterMaterial=null;world.quads=world.uniqueQuads=0;
}
