import {newModel,newPart,canonicalModel} from '../shared/model.js';

// Approved B/D concept translations only. No stats, spawning or gait controller.
// Forward −Z; navigation origin [12,0,12]; all pivots use model bind coordinates.
const DUNE_PALETTE=[
 ['Petrol mechanism','#273B43'],['Mechanism edge','#4D6268'],['Deep joint','#17292F'],
 ['Ochre armour','#B4773E'],['Ochre highlight','#D49A59'],['Terracotta shade','#8D5435'],
 ['Ivory collar','#CBC3AD'],['Ivory highlight','#E0D6BF'],['Collar shade','#9A9C8E'],
 ['Turquoise sensor','#429F9F'],['Sensor highlight','#7FC7BD'],['Sole','#1E2B30'],
];
const SPINDLE_PALETTE=[
 ['Aubergine mechanism','#49384D'],['Mechanism edge','#72556E'],['Deep joint','#2A2633'],
 ['Pale shell','#C3BCAE'],['Shell highlight','#DAD3C4'],['Shell shade','#95928C'],
 ['Coral sensor','#CC786D'],['Coral highlight','#E8A08B'],['Muted joint accent','#A56262'],
 ['Sole','#302A37'],['Joint collar','#8B7C84'],
];

function model(id,name,height,palette,eyeMaterials) {
 const m=newModel(id);m.name=name;m.role='enemy';m.colorMode='authored';m.size[1]=height;
 m.materials=palette.map(([name,color],index)=>{
  const eye=eyeMaterials.includes(index);
  return {name,color,emission:eye?1:0,reflectiveness:0,...(eye?{castsLight:true}:{})};
 });
 return m;
}

// Sculpt each rigid part independently; cross-part conflicts are rejected by
// canonicalModel, never silently trimmed. Source unions cannot duplicate cells.
function sculpt(id,name,parent,pivot,topMaterials) {
 const p=newPart(id);p.name=name;p.parent=parent;p.pivot=pivot.slice();
 const cells=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
 function box(x0,y0,z0,x1,y1,z1,material) {
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++) {
   if(material===null)cells.delete(key(x,y,z));else cells.set(key(x,y,z),[x,y,z,material]);
  }
 }
 function face(x0,y0,z0,x1,y1,z1,direction,material) {
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++) {
   const cell=cells.get(key(x,y,z));if(!cell)throw new Error(`${id}: face paint needs an occupied cell.`);
   cell[4]??=[-1,-1,-1,-1,-1,-1];cell[4][direction]=material;
  }
 }
 function finish() {
  for(const cell of cells.values())if(topMaterials.has(cell[3])&&!cells.has(key(cell[0],cell[1]+1,cell[2]))) {
   cell[4]??=[-1,-1,-1,-1,-1,-1];if(cell[4][2]<0)cell[4][2]=topMaterials.get(cell[3]);
  }
  p.voxels=[...cells.values()];return p;
 }
 return {box,face,finish};
}

function mirror(part,id,parent,x=false,z=false) {
 const p=structuredClone(part);p.id=id;p.name=id;p.parent=parent;
 if(x)p.pivot[0]=24-p.pivot[0];if(z)p.pivot[2]=24-p.pivot[2];
 for(const v of p.voxels) {
  if(x){v[0]=23-v[0];if(v[4])[v[4][0],v[4][1]]=[v[4][1],v[4][0]];}
  if(z){v[2]=23-v[2];if(v[4])[v[4][4],v[4][5]]=[v[4][5],v[4][4]];}
 }
 return p;
}

export function walkerModel() {
 const m=model('walker','Walker · reverse-knee biped',28,DUNE_PALETTE,[9,10]);
 const top=new Map([[0,1],[3,4],[5,3],[6,7]]);
 const body=sculpt('body','Stepped chest and turquoise sensor',null,[12,20,12],top);
 // Narrow underside with axles passing through the thigh bearing cavities.
 body.box(11,18,10,13,23,17,2);
 body.box(9,18,13,12,19,14,1);body.box(12,18,13,15,19,14,1);
 body.box(10,20,7,14,23,11,0);
 body.box(9,22,7,15,25,19,3);body.box(8,23,11,16,25,17,5);
 body.box(10,25,10,14,26,18,3);body.box(10,26,13,14,27,18,3);
 body.box(9,22,17,15,24,19,5);body.box(10,21,18,14,23,20,0);
 // Lower-forward snout and pale frame; only the turquoise eye faces emit.
 body.box(10,18,5,14,22,8,0);body.box(10,18,4,14,22,5,6);
 body.face(11,19,4,13,21,5,5,9);body.face(11,20,4,13,21,5,5,10);
 body.box(9,24,10,10,25,14,6);body.box(14,24,10,15,25,14,6);
 body.face(8,23,12,9,25,15,1,0);body.face(15,23,12,16,25,15,0,0);
 body.face(10,22,19,14,23,20,4,2);

 const thigh=sculpt('thigh-l','Left reverse-swept thigh','body',[8.5,18.5,13.5],top);
 // Five-unit square bearing with a three-unit cavity, not a rounded mesh.
 thigh.box(7,16,11,10,21,16,0);thigh.box(7,17,12,10,20,15,null);
 thigh.box(7,20,12,10,21,15,6);thigh.box(7,17,11,8,20,12,8);
 thigh.box(8,12,14,10,17,18,0);thigh.box(8,13,14,10,16,15,3);
 thigh.box(8,10,16,10,13,19,0);
 // Knee axle goes into the lower leg's outboard bearing, with an air gap.
 thigh.box(6,10,17,10,11,18,1);
 const shin=sculpt('shin-l','Left forward-returning shin','thigh-l',[8.5,10.5,17.5],top);
 shin.box(5,8,15,7,13,20,8);shin.box(5,9,16,7,12,19,null);
 shin.box(5,8,16,7,9,19,0);shin.box(5,12,16,7,13,19,6);
 shin.box(6,5,13,8,9,17,0);shin.box(7,3,10,9,6,14,0);
 shin.box(6,6,13,7,8,16,8);shin.face(7,3,10,9,6,11,5,1);
 const foot=sculpt('foot-l','Left broad split-toe foot','shin-l',[8.5,1,11.5],top);
 foot.box(6,0,8,11,1,14,11);foot.box(6,0,7,8,1,8,11);foot.box(9,0,7,11,1,8,11);
 foot.box(7,1,10,10,2,14,6);foot.box(6,1,8,8,2,10,0);foot.box(9,1,8,11,2,10,0);
 const left=[thigh.finish(),shin.finish(),foot.finish()];
 m.variants.base.parts=[body.finish(),...left,
  mirror(left[0],'thigh-r','body',true),mirror(left[1],'shin-r','thigh-r',true),mirror(left[2],'foot-r','shin-r',true)];
 return canonicalModel(m);
}

function spiderFront() {
 const top=new Map([[0,1],[3,4],[5,3]]);
 const upper=sculpt('upper-fl','Front left folded outrigger','body',[8,8,9],top);
 upper.box(7,7,8,9,9,10,0);upper.box(6,9,7,8,12,10,0);
 upper.box(4,12,5,7,14,9,0);upper.box(5,13,5,7,14,7,8);
 upper.face(4,12,6,5,13,8,1,10);
 const lower=sculpt('lower-fl','Front left armoured lower leg','upper-fl',[5.5,11.5,6.5],top);
 lower.box(4,9,5,5,11,8,2);lower.box(4,3,4,6,9,7,0);
 lower.box(4,5,4,5,9,7,3);lower.box(4,3,4,5,5,6,5);
 lower.face(4,7,4,5,8,5,5,8);
 const foot=sculpt('foot-fl','Front left ground foot','lower-fl',[5.5,1,5.5],top);
 foot.box(4,0,4,7,1,7,9);foot.box(4,1,4,6,2,7,0);
 return [upper.finish(),lower.finish(),foot.finish()];
}

export function spiderModel() {
 const m=model('spider','Spider · four-legged folded crawler',15,SPINDLE_PALETTE,[6,7]);
 const top=new Map([[0,1],[3,4],[5,3]]);
 const body=sculpt('body','Low segmented shell and coral sensor',null,[12,8,12],top);
 body.box(10,6,8,14,10,16,2);body.box(9,10,8,15,12,16,5);
 body.box(10,12,9,14,13,15,3);body.box(9,11,9,15,12,15,3);
 body.box(8,9,10,10,10,14,3);body.box(14,9,10,16,10,14,3);
 // Segmentation is recessed solid material; no overlay faces or texture lines.
 body.box(11,12,11,13,13,12,5);body.box(11,12,14,13,13,15,5);
 body.box(10,7,6,14,10,8,0);body.box(11,7,5,13,10,6,2);
 body.face(11,8,5,13,9,6,5,6);body.face(11,8,5,13,9,6,5,7);
 body.face(10,8,6,11,9,7,1,8);body.face(13,8,6,14,9,7,0,8);
 body.box(10,8,16,14,10,18,0);body.box(11,10,16,13,11,17,5);
 const front=spiderFront();
 const mirrored=(parts,suffix,x,z)=>parts.map((p,i)=>mirror(p,['upper-','lower-','foot-'][i]+suffix,i===0?'body':(i===1?'upper-':'lower-')+suffix,x,z));
 m.variants.base.parts=[body.finish(),...front,...mirrored(front,'fr',true,false),...mirrored(front,'rl',false,true),...mirrored(front,'rr',true,true)];
 return canonicalModel(m);
}

export function enemyModels(){return [walkerModel(),spiderModel()];}

// Describes bind geometry and an intentionally small inspection envelope.
// These angles are tested isolated poses, NOT a planted-foot walking solution.
export const ENEMY_RIG_CONTRACTS={
 walker:{forward:[0,0,-1],root:[12,0,12],body:'body',soleY:0,inspectionAngleDegrees:4,
  legs:[
   {ids:['thigh-l','shin-l','foot-l'],hip:[8.5,18.5,13.5],knee:[8.5,10.5,17.5],ankle:[8.5,1,11.5]},
   {ids:['thigh-r','shin-r','foot-r'],hip:[15.5,18.5,13.5],knee:[15.5,10.5,17.5],ankle:[15.5,1,11.5]},
  ]},
 spider:{forward:[0,0,-1],root:[12,0,12],body:'body',soleY:0,inspectionAngleDegrees:3,
  legs:[
   {ids:['upper-fl','lower-fl','foot-fl'],hip:[8,8,9],knee:[5.5,11.5,6.5],ankle:[5.5,1,5.5]},
   {ids:['upper-fr','lower-fr','foot-fr'],hip:[16,8,9],knee:[18.5,11.5,6.5],ankle:[18.5,1,5.5]},
   {ids:['upper-rl','lower-rl','foot-rl'],hip:[8,8,15],knee:[5.5,11.5,17.5],ankle:[5.5,1,18.5]},
   {ids:['upper-rr','lower-rr','foot-rr'],hip:[16,8,15],knee:[18.5,11.5,17.5],ankle:[18.5,1,18.5]},
  ]},
};

if(import.meta.main)for(const m of enemyModels()) {
 const path=`assets/models/${m.id}.json`;
 if(!await Bun.file(path).exists()){await Bun.write(path,JSON.stringify(m,null,2)+'\n');console.log(`Created ${path}`);}
 else console.log(`${path} exists; authored source preserved.`);
}
