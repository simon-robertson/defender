import {BOX_SIZE,ASSET_VERSION,LEGACY_BOX_SIZES} from './grid.js';
export const VARIANTS = ['base', 'upgrade1', 'upgrade2'];
export const FACE_NAMES = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];
export const MAX_HEIGHT = 256; // Authoring safety bound, not a game design height limit.
export const ZONES = {
  A: {name: 'Moss & Porcelain', colors: ['#F1E8D5','#243E35','#738B55','#D9CCAA','#D65D45']},
  B: {name: 'Ochre & Petrol', colors: ['#EBD3A4','#24535C','#75B6AA','#D79A4B','#AD5842']},
  C: {name: 'Ice & Ember', colors: ['#D8E7EB','#22364B','#46647B','#8BAFBF','#EF854A']},
  D: {name: 'Plum & Mint', colors: ['#A8D4BE','#302C46','#655376','#B58C9C','#F08873']},
};
export const validId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const int = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
export function newPart(id='body') { return {id, name: id, parent: null, pivot: [BOX_SIZE/2,0,BOX_SIZE/2], voxels: []}; }
export function newModel(id='untitled-model') {
  return {schema:'defender.model',version:ASSET_VERSION,id,name:'Untitled model',size:[BOX_SIZE,BOX_SIZE,BOX_SIZE],
    materials: ['Porcelain','Mechanism','Moss','Stone','Accent'].map((name,i)=>({name,color:ZONES.A.colors[i],emission:0,reflectiveness:0})),
    variants:Object.fromEntries(VARIANTS.map(v=>[v,{parts:[newPart()]}]))};
}
export function validateModel(model) {
  return validateModelData(model,ASSET_VERSION,BOX_SIZE);
}
function validateModelData(model,version,boxSize) {
  assert(model?.schema==='defender.model' && model.version===version,'Unsupported model schema/version.');
  assert(validId(model.id),'Model ID must use lowercase letters, numbers and hyphens, starting with a letter.');
  assert(model.role===undefined||['defence','scenery','enemy'].includes(model.role),'Invalid model role.');
  assert(model.colorMode===undefined||model.colorMode==='authored','Invalid colour mapping mode.');
  assert(typeof model.name==='string' && model.name.length>0 && model.name.length<=120,'Model name is required (120 characters maximum).');
  assert(Array.isArray(model.size) && model.size.length===3 && model.size[0]===boxSize && model.size[2]===boxSize && int(model.size[1],1,MAX_HEIGHT),`Model size must be [${boxSize}, height, ${boxSize}], height 1–256.`);
  assert(Array.isArray(model.materials) && model.materials.length>=1 && model.materials.length<=32,'Use 1–32 materials.');
  for(const m of model.materials) {
    assert(typeof m.name==='string' && m.name.length<=80 && /^#[\da-f]{6}$/i.test(m.color),'Invalid material name or RGB colour.');
    for(const property of ['emission','reflectiveness']) assert(finite(m[property]) && m[property]>=0 && m[property]<=1,`${property} must be between 0 and 1.`);
    assert(m.castsLight===undefined||typeof m.castsLight==='boolean','castsLight must be a boolean when present.');
  }
  assert(model.variants && Object.keys(model.variants).length===3 && VARIANTS.every(v=>Object.hasOwn(model.variants,v)),'A model must contain exactly base, upgrade1 and upgrade2 variants.');
  for(const variant of VARIANTS) {
    const parts=model.variants?.[variant]?.parts;
    assert(Array.isArray(parts) && parts.length>=1 && parts.length<=64,`${variant}: use 1–64 rigid parts.`);
    const ids=new Map(), occupied=new Set();
    for(const part of parts) {
      assert(validId(part.id) && !ids.has(part.id),`${variant}: duplicate or invalid part ID.`); ids.set(part.id,part);
      assert(typeof part.name==='string' && part.name.length<=80,'Invalid part name.');
      assert(part.parent===null || validId(part.parent),'Invalid parent ID.');
      assert(Array.isArray(part.pivot) && part.pivot.length===3 && part.pivot.every((n,i)=>finite(n) && n>=0 && n<=model.size[i]),'Pivot must lie within the model bounds.');
      assert(Array.isArray(part.voxels) && part.voxels.length<=boxSize*model.size[1]*boxSize,'Invalid voxel count.');
      for(const cell of part.voxels) {
        assert(Array.isArray(cell) && (cell.length===4 || cell.length===5),'Voxel must be [x,y,z,material,optionalFaceOverrides].');
        assert(cell.slice(0,3).every((n,i)=>int(n,0,model.size[i]-1)),`${variant}: cell outside model bounds.`);
        assert(int(cell[3],0,model.materials.length-1),'Invalid voxel material.');
        if(cell[4]!==undefined) assert(Array.isArray(cell[4]) && cell[4].length===6 && cell[4].every(n=>int(n,-1,model.materials.length-1)),'Face overrides must contain six material indices (-1 inherits).');
        const key=cell[0]+boxSize*(cell[2]+boxSize*cell[1]);
        assert(!occupied.has(key),`${variant}: overlapping cells at ${cell.slice(0,3).join(', ')}. Each cell belongs to one part.`); occupied.add(key);
      }
    }
    for(const part of parts) {
      const seen=new Set([part.id]); let parent=part.parent;
      while(parent!==null) {
        assert(ids.has(parent),`${variant}: missing parent ${parent}.`);
        assert(!seen.has(parent),`${variant}: cyclic part hierarchy.`); seen.add(parent); parent=ids.get(parent).parent;
      }
    }
  }
  return model;
}
export function upgradeModel(model) {
  const legacySize=LEGACY_BOX_SIZES[model?.version];
  if(!legacySize)return validateModel(model);
  validateModelData(model,model.version,legacySize);
  for(const variant of Object.values(model.variants))for(const part of variant.parts){
    assert(part.pivot[0]<=BOX_SIZE&&part.pivot[2]<=BOX_SIZE&&part.voxels.every(c=>c[0]<BOX_SIZE&&c[2]<BOX_SIZE),
      'This legacy model exceeds the 24-unit footprint. Refit its geometry and pivots before importing; automatic conversion will not crop or resample it.');
  }
  const result=structuredClone(model);
  result.version=ASSET_VERSION;result.size[0]=result.size[2]=BOX_SIZE;
  // Resize only empty canvas space. Preserve cells, pivots, materials and height.
  return validateModel(result);
}
export function materialForFace(cell, face) { return cell[4]?.[face]>=0 ? cell[4][face] : cell[3]; }
export function canonicalModel(model) {
  validateModel(model); const result=structuredClone(model);
  for(const v of VARIANTS) for(const p of result.variants[v].parts) p.voxels.sort((a,b)=>a[1]-b[1] || a[2]-b[2] || a[0]-b[0]);
  return result;
}
export function cellAt(parts,x,y,z) {
  for(const part of parts) { const index=part.voxels.findIndex(c=>c[0]===x && c[1]===y && c[2]===z); if(index!==-1) return {part,index,cell:part.voxels[index]}; }
  return null;
}
