import {ASSET_VERSION} from './grid.js';
import {materialForFace, validateModel} from './model.js';

// Greedy rectangles on each rigid part's exposed grid surfaces. Material identity
// includes the face override, so different surface properties never merge.
export function meshPart(model, part) {
  const dims=model.size, count=dims[0]*dims[1]*dims[2];
  const grid=new Int32Array(count); grid.fill(-1);
  const index=(x,y,z)=>x+dims[0]*(z+dims[2]*y);
  part.voxels.forEach((v,i)=>{grid[index(v[0],v[1],v[2])]=i;});
  const quads=[]; let exposedFaces=0;
  for(let axis=0;axis<3;axis++) {
    const u=(axis+1)%3,v=(axis+2)%3, width=dims[u],height=dims[v], mask=new Int16Array(width*height);
    for(const sign of [-1,1]) {
      const face=axis*2+(sign===1?0:1);
      for(let layer=0;layer<dims[axis];layer++) {
        mask.fill(-1); const pos=[0,0,0]; pos[axis]=layer;
        for(let j=0;j<height;j++) for(let i=0;i<width;i++) {
          pos[u]=i; pos[v]=j; const ci=grid[index(...pos)]; if(ci<0) continue;
          pos[axis]=layer+sign;
          const outside=pos[axis]<0 || pos[axis]>=dims[axis];
          const hidden=!outside && grid[index(...pos)]>=0;
          pos[axis]=layer;
          if(!hidden) {mask[j*width+i]=materialForFace(part.voxels[ci],face);exposedFaces++;}
        }
        for(let j=0;j<height;j++) for(let i=0;i<width;) {
          const material=mask[j*width+i]; if(material<0){i++;continue;}
          let w=1,h=1; while(i+w<width && mask[j*width+i+w]===material)w++;
          outer: while(j+h<height){for(let k=0;k<w;k++)if(mask[(j+h)*width+i+k]!==material)break outer;h++;}
          const origin=[0,0,0]; origin[axis]=layer+(sign>0?1:0);origin[u]=i;origin[v]=j;
          quads.push({origin,axis,sign,width:w,height:h,material});
          for(let y=0;y<h;y++)mask.fill(-1,(j+y)*width+i,(j+y)*width+i+w);
          i+=w;
        }
      }
    }
  }
  return meshQuads(quads,model.materials,exposedFaces,part.voxels.length);
}
export function meshQuads(quads,materials,exposedFaces=0,voxels=0) {
  const vertices=new Float32Array(quads.length*4*11),indices=new Uint32Array(quads.length*6);
  let offset=0,lightQuads;
  quads.forEach((q,qi)=>{
    const u=(q.axis+1)%3,v=(q.axis+2)%3,m=materials[q.material];
    if(m.castsLight===true&&m.emission>0)(lightQuads??=[]).push(qi);
    const color=[1,3,5].map(i=>{const c=parseInt(m.color.slice(i,i+2),16)/255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);});
    for(const corner of [[0,0],[q.width,0],[q.width,q.height],[0,q.height]]) {
      const p=q.origin.slice();p[u]+=corner[0];p[v]+=corner[1];const n=[0,0,0];n[q.axis]=q.sign;
      vertices.set([...p,...n,...color,m.emission,m.reflectiveness],offset);offset+=11;
    }
    const b=qi*4;indices.set(q.sign>0?[b,b+1,b+2,b,b+2,b+3]:[b,b+2,b+1,b,b+3,b+2],qi*6);
  });
  return {vertices,indices,quads,exposedFaces,voxels,...(lightQuads?{lightQuads}:{})};
}
export function compileModel(model) {
  validateModel(model);
  return {schema:'defender.mesh',version:ASSET_VERSION,id:model.id,...(model.role?{role:model.role}:{}),stride:11,attributes:['position:3','normal:3','linearRGB:3','emission:1','reflectiveness:1'],size:model.size,materials:model.materials,
    variants:Object.fromEntries(Object.entries(model.variants).map(([name,variant])=>[name,{parts:variant.parts.map(part=>{
      const mesh=meshPart(model,part);return {id:part.id,parent:part.parent,pivot:part.pivot,vertices:Array.from(mesh.vertices),indices:Array.from(mesh.indices),quadMaterials:mesh.quads.map(q=>q.material),quads:mesh.quads.length,exposedFaces:mesh.exposedFaces,...(mesh.lightQuads?{lightQuads:mesh.lightQuads}:{})};
    })}]))};
}
