import {newModel,newPart,canonicalModel} from '../shared/model.js';

// Small matte river fish, facing -Z. The tail swings about Y at the peduncle.
export function fishModel(){
 const model=newModel('wildlife-fish');model.name='Pool fish';model.role='scenery';model.colorMode='authored';model.size[1]=5;
 model.materials=[['Back','#6E8070'],['Flank','#D8B676'],['Belly','#DED5AD'],['Fin','#977650'],['Eye','#263D38']].map(([name,color])=>({name,color,emission:0,reflectiveness:0}));
 const body=newPart('body');body.pivot=[12,0,12];const cells=new Map();
 const box=(x0,y0,z0,x1,y1,z1,m)=>{for(let x=x0;x<x1;x++)for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)cells.set(`${x},${y},${z}`,[x,y,z,m]);};
 box(11,1,8,13,3,14,1);box(11,2,9,13,3,13,0);box(11,1,7,13,2,8,2);
 box(10,1,11,11,2,13,3);box(13,1,11,14,2,13,3);box(11,3,10,12,4,13,3);
 for(const x of [11,12]){const cell=cells.get(`${x},2,8`);cell[4]=[-1,-1,-1,-1,-1,-1];cell[4][x===11?1:0]=4;}
 body.voxels=[...cells.values()];
 const tail=newPart('tail');tail.parent='body';tail.pivot=[12,2,14];tail.voxels=[[11,1,14,3],[12,1,14,3],[11,1,15,3],[12,1,15,3],[10,1,16,3],[11,1,16,3],[12,1,16,3],[13,1,16,3],[10,1,17,3],[13,1,17,3]];
 model.variants.base.parts=[body,tail];return canonicalModel(model);
}
if(import.meta.main){
 const model=fishModel(),path=`assets/models/${model.id}.json`;
 if(!await Bun.file(path).exists())await Bun.write(path,JSON.stringify(model,null,2)+'\n');
}
