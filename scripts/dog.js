import {newModel,newPart,canonicalModel} from '../shared/model.js';
import {BOX_SIZE} from '../shared/grid.js';

// First enemy study: the small armoured quadruped in the approved colour sheet.
// Forward is -Z. The root's navigation centre is [12, 0, 12].
// Hip -> knee -> ankle lengths are 4 + 4 units. A separate paw lets the gait
// counter-rotate its flat sole instead of dragging a tilted foot through ground.
const palette=[
 ['Gunmetal','#293A3F'],['Gunmetal edge','#526369'],['Deep mechanism','#17262B'],
 ['Warm shell','#C6C0AC'],['Shell highlight','#E0D7C0'],['Shell shade','#9A9D92'],
 ['Sensor orange','#E86E3F'],['Sensor highlight','#FFA263'],['Sensor recess','#9A422C'],
 ['Paw sole','#1D282B'],['Joint collar','#71807D'],
];
const M={metal:0,edge:1,deep:2,shell:3,light:4,shade:5,sensor:6,sensorLight:7,sensorDeep:8,sole:9,collar:10};

function sculpt(part){
 const cells=new Map(),key=(x,y,z)=>x+BOX_SIZE*(z+BOX_SIZE*y);
 function box(x0,y0,z0,x1,y1,z1,material){
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   if(material===null)cells.delete(key(x,y,z));else cells.set(key(x,y,z),[x,y,z,material]);
  }
 }
 function paintFace(x0,y0,z0,x1,y1,z1,face,material){
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   const cell=cells.get(key(x,y,z));if(!cell)throw new Error('Dog face paint requires an occupied cell.');
   cell[4]??=[-1,-1,-1,-1,-1,-1];cell[4][face]=material;
  }
 }
 function finish(){
  const tops=new Map([[M.metal,M.edge],[M.shell,M.light],[M.shade,M.shell]]);
  for(const cell of cells.values())if(tops.has(cell[3])&&!cells.has(key(cell[0],cell[1]+1,cell[2]))){cell[4]??=[-1,-1,-1,-1,-1,-1];if(cell[4][2]<0)cell[4][2]=tops.get(cell[3]);}
  part.voxels=[...cells.values()];
 }
 return {box,paintFace,finish};
}

export function dogModel(){
 const model=newModel('dog');model.name='Dog · armoured quadruped';model.role='enemy';model.colorMode='authored';model.size[1]=16;
 model.materials=palette.map(([name,color],index)=>{
  const eye=index===M.sensor||index===M.sensorLight;
  return {name,color,emission:eye?1:0,reflectiveness:0,...(eye?{castsLight:true}:{})};
 });
 const body=newPart('body');body.name='Armoured chassis and sensor head';body.pivot=[12,9,12];
 const b=sculpt(body);
 // Narrow dark chassis leaves the independently moving legs outside its sides.
 b.box(9,8,7,15,11,19,M.deep);b.box(9,7,9,15,9,17,M.metal);
 b.box(9,10,8,15,11,19,M.metal);b.box(8,11,8,16,12,19,M.metal);
 // Stepped arched shell: wide lower shoulder and smaller raised spine.
 b.box(7,11,9,17,13,18,M.shade);b.box(8,12,8,16,14,18,M.shell);
 b.box(9,14,10,15,15,17,M.shell);b.box(10,11,18,14,13,19,M.shade);
 // Dark rib gaps are real inset material cells, not coplanar overlays.
 b.box(8,12,12,9,14,13,M.deep);b.box(15,12,12,16,14,13,M.deep);
 b.box(8,12,16,9,13,17,M.deep);b.box(15,12,16,16,13,17,M.deep);
 // Compact forward head and low snout; no organic ears or tail are invented.
 b.box(9,9,6,15,12,9,M.deep);b.box(8,9,4,16,12,7,M.metal);
 b.box(9,12,4,15,13,7,M.edge);b.box(9,9,3,15,12,5,M.deep);
 b.box(10,8,2,14,10,5,M.metal);b.paintFace(10,8,2,14,10,3,5,M.deep);
 // Only the front and side eyes emit light; the rear recess remains dark.
 b.paintFace(11,10,3,13,12,4,5,M.sensor);b.paintFace(11,11,3,13,12,4,5,M.sensorLight);
 b.paintFace(8,10,5,9,12,6,1,M.sensor);b.paintFace(15,10,5,16,12,6,0,M.sensor);
 b.box(10,9,19,14,12,21,M.metal);b.paintFace(11,10,20,13,11,21,4,M.sensorDeep);
 b.finish();
 const parts=[body];
 for(const [id,x,z] of [['fl',6.5,8.5],['fr',17.5,8.5],['rl',6.5,16.5],['rr',17.5,16.5]]){
  const x0=x-1.5,z0=z-1.5,outer=id.endsWith('l')?1:0;
  const leg=newPart('leg-'+id);leg.name='Hip '+id;leg.parent='body';leg.pivot=[x,9,z];
  const l=sculpt(leg);
  l.box(x0,5,z0,x0+3,8,z0+3,M.metal);l.box(x0,8,z0,x0+3,10,z0+3,M.shade);
  // Inset the two inner top corners for turn-induced hip abduction. The
  // central hinge strip remains; the raised shell and sensor head stay intact.
  const inner=outer===1?x0+2:x0;
  l.box(inner,9,z0,inner+1,10,z0+1,null);l.box(inner,9,z0+2,inner+1,10,z0+3,null);
  l.paintFace(outer===1?x0:x0+2,8,z0+1,outer===1?x0+1:x0+3,10,z0+2,outer,M.collar);l.finish();
  const shin=newPart('shin-'+id);shin.name='Shin '+id;shin.parent=leg.id;shin.pivot=[x,5,z];
  const s=sculpt(shin);s.box(x0,4,z0,x0+3,5,z0+3,M.deep);s.box(x0,2,z0+1,x0+3,4,z0+3,M.metal);s.finish();
  const paw=newPart('paw-'+id);paw.name='Paw '+id;paw.parent=shin.id;paw.pivot=[x,1,z];
  const p=sculpt(paw);p.box(x0,0,z0-1,x0+3,1,z0+3,M.sole);p.box(x0,1,z0-1,x0+3,2,z0+3,M.metal);
  p.paintFace(x0,1,z0-1,x0+3,2,z0,5,M.edge);p.finish();
  parts.push(leg,shin,paw);
 }
 model.variants.base.parts=parts;
 // Upgrade slots remain empty for format compatibility; enemies have no
 // approved upgrade progression. Only player arsenal items require three forms.
 return canonicalModel(model);
}

if(import.meta.main){
 const path='assets/models/dog.json',model=dogModel();
 if(!await Bun.file(path).exists()){await Bun.write(path,JSON.stringify(model,null,2)+'\n');console.log('Created '+path);}
 else console.log(path+' exists; authored source preserved.');
}
