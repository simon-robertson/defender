import {newModel,newPart,canonicalModel} from '../shared/model.js';

const palette=[['Bark','#645C3E'],['Bark light','#827551'],['Deep foliage','#334D35'],['Forest foliage','#4F693F'],['Moss foliage','#758949'],['Leaf highlight','#96A25D'],['Porcelain stone','#D7CCAF'],['Stone shade','#AAAD8C'],['Stone light','#E8DDC0'],['Flower','#F1E8D0'],['Vermilion','#B96D4F']].map(([name,color])=>({name,color,emission:0,reflectiveness:0}));
export function builder(id,name,height,materials=palette){
 const m=newModel(id);m.name=name;m.colorMode='authored';m.size[1]=height;m.materials=structuredClone(materials);const p=newPart('body'),cells=new Map();m.variants.base.parts=[p];
 const box=(x0,y0,z0,x1,y1,z1,mat)=>{for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){if(x<0||x>=24||z<0||z>=24||y<0||y>=height)throw new Error(id+' bounds');cells.set(x+24*(z+24*y),[x,y,z,mat]);}};
 const crown=(x0,y0,z0,x1,y1,z1,mat,cut=2)=>{for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++)if(Math.min(x-x0,x1-1-x)+Math.min(z-z0,z1-1-z)>=cut)box(x,y,z,x+1,y+1,z+1,mat);};
 const erase=(x0,y0,z0,x1,y1,z1)=>{for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++)cells.delete(x+24*(z+24*y));};
 return {box,crown,erase,finish(){p.voxels=[...cells.values()];return canonicalModel(m);}};
}
