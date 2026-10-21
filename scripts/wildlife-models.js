import {newModel,newPart,canonicalModel} from '../shared/model.js';

// Cosmetic wildlife only. Geometry is authored once; root motion and bird wing
// rotations belong to the runtime controller, not to these model sources.
export const WILDLIFE_MODEL_IDS=Object.freeze({
 A:{ground:'wildlife-hare-moss',bird:'wildlife-bird-moss'},
 B:{ground:'wildlife-lizard-ochre',bird:'wildlife-bird-ochre'},
 C:{ground:'wildlife-hare-ice',bird:'wildlife-bird-ice'},
 D:{ground:'wildlife-beetle-plum',bird:'wildlife-bird-plum'},
});

const HARE_PALETTES={
 A:['#8A7150','#B19C78','#66543F','#CCBC99','#AE8877','#292D26','#72554A'],
 C:['#CFD6D1','#E8EBE2','#9EACA9','#EDF0E7','#BAADA8','#34444A','#8B7A74'],
};
const BIRD_PALETTES={
 A:['#A69670','#C7BB99','#4A5843','#B98C69','#242E27','#6E6250'],
 B:['#AF9E73','#D8C9A2','#4D6664','#8DAB9B','#263838','#83715A'],
 C:['#C5CECB','#E6EBE5','#617178','#A4B5B6','#283E47','#737A75'],
 D:['#88718A','#B6A3B2','#514456','#B8BCAE','#2D2934','#8A7770'],
};
const ZONE_NAMES={A:'Moss',B:'Ochre',C:'Ice',D:'Plum'};

function model(id,name,height,names,colors){
 const m=newModel(id);m.name=name;m.role='scenery';m.colorMode='authored';m.size[1]=height;
 m.materials=colors.map((color,i)=>({name:names[i],color,emission:0,reflectiveness:0}));
 return m;
}

function sculpt(id='body',parent=null,pivot=[12,0,12]){
 const p=newPart(id);p.parent=parent;p.pivot=pivot.slice();const cells=new Map();
 const key=(x,y,z)=>`${x},${y},${z}`;
 const box=(x0,y0,z0,x1,y1,z1,mat)=>{
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   if(mat===null)cells.delete(key(x,y,z));else cells.set(key(x,y,z),[x,y,z,mat]);
  }
 };
 const face=(x,y,z,direction,mat)=>{
  const c=cells.get(key(x,y,z));if(!c)throw new Error('Wildlife face requires a cell.');
  c[4]??=[-1,-1,-1,-1,-1,-1];c[4][direction]=mat;
 };
 return {box,face,finish(){
  for(const c of cells.values())if(c[3]===0&&!cells.has(key(c[0],c[1]+1,c[2]))){
   c[4]??=[-1,-1,-1,-1,-1,-1];if(c[4][2]<0)c[4][2]=1;
  }
  p.voxels=[...cells.values()];return p;
 }};
}

function hare(zone){
 const m=model(WILDLIFE_MODEL_IDS[zone].ground,zone==='A'?'Field hare · Moss':'White hare · Ice',10,
  ['Fur','Fur light','Fur shade','Belly and tail','Inner ear','Eye','Nose'],HARE_PALETTES[zone]);
 const p=sculpt();
 // Broad folded haunches, smaller forward head and two separated upright ears.
 p.box(10,1,10,14,4,15,0);p.box(9,1,12,15,5,15,0);
 p.box(9,0,12,11,2,15,2);p.box(13,0,12,15,2,15,2);
 p.box(10,0,9,11,3,11,2);p.box(13,0,9,14,3,11,2);
 p.box(10,3,8,14,6,11,0);p.box(11,3,8,13,4,9,3);
 p.box(10,6,9,11,9,10,0);p.box(13,6,9,14,9,10,0);
 p.face(10,7,9,5,4);p.face(13,7,9,5,4);
 p.face(10,4,9,1,5);p.face(13,4,9,0,5);
 p.face(11,3,8,5,6);p.face(12,3,8,5,6);
 p.box(11,2,15,13,4,16,3);
 m.variants.base.parts=[p.finish()];return canonicalModel(m);
}

function lizard(){
 const m=model(WILDLIFE_MODEL_IDS.B.ground,'Sand lizard · Ochre',5,
  ['Sand hide','Hide light','Olive shade','Belly','Eye'],['#9B8A59','#C4B27B','#6F714C','#C1B48D','#303C32']);
 const p=sculpt();
 p.box(10,1,10,14,3,13,0);p.box(11,3,10,13,4,13,2);
 p.box(11,1,9,13,3,10,0);p.box(10,1,8,14,3,10,0);
 // Four low splayed legs connect to the body through real shoulder cells.
 for(const z of [10,12]){
  p.box(9,1,z,11,2,z+1,2);p.box(13,1,z,15,2,z+1,2);
  p.box(8,0,z-1,10,1,z+1,2);p.box(14,0,z-1,16,1,z+1,2);
 }
 p.box(11,1,13,13,2,15,0);p.box(11,1,15,12,2,16,0);
 p.face(10,2,8,1,4);p.face(13,2,8,0,4);
 p.face(11,1,8,5,3);p.face(12,1,8,5,3);
 m.variants.base.parts=[p.finish()];return canonicalModel(m);
}

function beetle(){
 const m=model(WILDLIFE_MODEL_IDS.D.ground,'Plum ground beetle',5,
  ['Plum shell','Shell light','Dark underside','Head','Muted eye'],['#67516C','#7E647F','#34303A','#493C4D','#A47972']);
 const p=sculpt();
 p.box(10,1,10,14,3,14,2);p.box(10,2,10,14,4,14,0);
 p.box(10,1,9,14,3,10,3);p.box(10,1,8,11,2,9,3);p.box(13,1,8,14,2,9,3);
 // Six short legs and a shallow centre division keep the small silhouette clear.
 for(const z of [9,11,13]){
  p.box(9,1,z,11,2,z+1,2);p.box(13,1,z,15,2,z+1,2);
  p.box(8,0,z,10,1,z+1,2);p.box(14,0,z,16,1,z+1,2);
 }
 p.face(11,3,11,2,3);p.face(11,3,12,2,3);p.face(11,3,13,2,3);
 p.face(10,2,9,5,4);p.face(13,2,9,5,4);
 m.variants.base.parts=[p.finish()];return canonicalModel(m);
}

export function wildlifeBirdModel(zone){
 if(!WILDLIFE_MODEL_IDS[zone])throw new Error('Unknown wildlife zone.');
 const m=model(WILDLIFE_MODEL_IDS[zone].bird,`${ZONE_NAMES[zone]} songbird`,7,
  ['Body feathers','Feather light','Wing and tail','Breast','Eye','Beak and feet'],BIRD_PALETTES[zone]);
 const body=sculpt();
 body.box(11,2,10,13,4,14,0);body.box(11,2,10,13,3,11,3);
 body.box(11,4,9,13,6,11,0);body.box(11,3,9,13,4,11,3);
 body.box(11,4,8,13,5,9,5);body.face(11,5,9,1,4);body.face(12,5,9,0,4);
 body.box(11,3,14,13,4,16,2);
 // Tiny staggered toes remain part of the solid body and contact the perch atY0.
 body.box(11,0,11,12,1,13,5);body.box(12,0,12,13,1,14,5);
 body.box(11,1,12,12,2,13,5);body.box(12,1,13,13,2,14,5);
 const left=sculpt('wing-l','body',[11,4,13]);
 left.box(9,4,12,11,5,14,2);left.box(8,4,13,9,5,14,2);
 const right=sculpt('wing-r','body',[13,4,13]);
 right.box(13,4,12,15,5,14,2);right.box(15,4,13,16,5,14,2);
 m.variants.base.parts=[body.finish(),left.finish(),right.finish()];return canonicalModel(m);
}

export function wildlifeGroundModel(zone){
 if(zone==='A'||zone==='C')return hare(zone);
 if(zone==='B')return lizard();if(zone==='D')return beetle();
 throw new Error('Unknown wildlife zone.');
}

export function wildlifeModels(zone){
 if(zone!==undefined)return [wildlifeGroundModel(zone),wildlifeBirdModel(zone)];
 return Object.keys(WILDLIFE_MODEL_IDS).flatMap(wildlifeModels);
}

// Radians are used by PoseRig; limits below are author-facing degrees.
// Positive left Z folds down; the right wing always uses the opposite angle.
export const WILDLIFE_RIG_CONTRACTS=Object.freeze({
 ground:{root:[12,0,12],forward:[0,0,-1],body:'body',soleY:0},
 bird:{root:[12,0,12],forward:[0,0,-1],body:'body',soleY:0,axis:'z',
  wings:[{id:'wing-l',pivot:[11,4,13],sign:1},{id:'wing-r',pivot:[13,4,13],sign:-1}],
  perchDegrees:70,flightDegrees:[-45,45],limitsDegrees:[-55,70]},
});

if(import.meta.main)for(const m of wildlifeModels()){
 const path=`assets/models/${m.id}.json`;
 if(!await Bun.file(path).exists()){await Bun.write(path,JSON.stringify(m,null,2)+'\n');console.log(`Created ${path}`);}
 else console.log(`${path} exists; authored source preserved.`);
}
