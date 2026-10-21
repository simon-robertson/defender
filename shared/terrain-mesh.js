import {BOX_SIZE} from './grid.js';
import {TerrainField} from './terrain.js';
import {meshQuads} from './mesher.js';
import {ZONES} from './model.js';
import {translation,identity} from './math.js';
import {BRIDGE_MATERIALS,bridgeQuads} from './bridges.js';
const N=BOX_SIZE,STRIDE=N+2;
export function terrainMaterials(zone){return [
  {color:ZONES[zone].colors[2],emission:0,reflectiveness:0},
  {color:ZONES[zone].colors[3],emission:0,reflectiveness:0},
  {color:({A:'#467E87',B:'#397781',C:'#699EB6',D:'#79B6AB'})[zone],emission:0,reflectiveness:.65}
];}
// Heightfield surfaces only: cost is columns, not column height. Neighbour
// samples cull chunk seams; equal rectangles/spans merge before GPU upload.
export function meshTerrainChunk(field,bx,bz,materials,translucentWater=false){
  const ground=new Uint16Array(STRIDE*STRIDE),water=new Uint16Array(STRIDE*STRIDE);
  for(let z=-1;z<=N;z++)for(let x=-1;x<=N;x++){const i=(z+1)*STRIDE+x+1;ground[i]=field.height(bx*N+x,bz*N+z);water[i]=field.height(bx*N+x,bz*N+z,true);}
  const quads=[];let volume=0;
  const quad=(origin,axis,sign,width,height,material)=>{
    // A natural bank meeting a deck has no exposed face inside that one-unit
    // slab. Keep the bed/bank below it and any taller bank above it unchanged.
    if(material===1&&axis!==1){
      const plane=origin[axis],edge=sign<0?0:N;
      const nx=bx+(axis===0?sign:0),nz=bz+(axis===2?sign:0);
      if(plane===edge&&field.bridgeBox(nx,nz)){
        const low=origin[1],high=low+(axis===0?width:height),bottom=field.level.pathHeight-1,top=field.level.pathHeight;
        for(const [lo,hi]of [[low,Math.min(high,bottom)],[Math.max(low,top),high]])if(hi>lo)quads.push({origin:[origin[0],lo,origin[2]],axis,sign,width:axis===0?hi-lo:width,height:axis===2?hi-lo:height,material});
        return;
      }
    }
    quads.push({origin,axis,sign,width,height,material});
  };
  const mask=new Int16Array(N*N);
  function horizontal(values,material,bottom=false){
    for(let z=0;z<N;z++)for(let x=0;x<N;x++){const h=values[(z+1)*STRIDE+x+1];const i=(z+1)*STRIDE+x+1;mask[z*N+x]=h&&!(material===0&&water[i]&&!translucentWater)&&!(material===2&&bottom&&ground[i])?(bottom?0:h):-1;}
    for(let z=0;z<N;z++)for(let x=0;x<N;){const h=mask[z*N+x];if(h<0){x++;continue;}let w=1,d=1;
      while(x+w<N&&mask[z*N+x+w]===h)w++;
      outer:while(z+d<N){for(let i=0;i<w;i++)if(mask[(z+d)*N+x+i]!==h)break outer;d++;}
      // For Y faces the mesher's U axis is Z and V axis is X.
      quad([x,h,z],1,bottom?-1:1,d,w,material);
      for(let j=0;j<d;j++)mask.fill(-1,(z+j)*N+x,(z+j)*N+x+w);x+=w;
    }
  }
  horizontal(ground,0);horizontal(ground,1,true);horizontal(water,2);horizontal(water,2,true);
  // Each vertical span is a single quad regardless of its height. Merge runs
  // with the same lower and upper endpoints along the horizontal axis.
  for(const axis of [0,2])for(const sign of [-1,1])for(let plane=0;plane<N;plane++)for(const liquid of [false,true]){
    let runStart=0,runLo=-1,runHi=-1;
    const flush=end=>{if(runHi>runLo){const origin=axis===0?[plane+(sign>0?1:0),runLo,runStart]:[runStart,runLo,plane+(sign>0?1:0)];quad(origin,axis,sign,axis===0?runHi-runLo:end-runStart,axis===0?end-runStart:runHi-runLo,liquid?2:1);}};
    for(let along=0;along<=N;along++){
      let lo=-1,hi=-1;
      if(along<N){const x=axis===0?plane:along,z=axis===0?along:plane,i=(z+1)*STRIDE+x+1,j=i+(axis===0?sign:sign*STRIDE);
        hi=liquid?water[i]:ground[i];lo=liquid?Math.max(ground[i],ground[j],water[j]):Math.max(ground[j],translucentWater?0:water[j]);if(hi<=lo){lo=-1;hi=-1;}}
      if(lo!==runLo||hi!==runHi){flush(along);runStart=along;runLo=lo;runHi=hi;}
    }
  }
  for(let z=0;z<N;z++)for(let x=0;x<N;x++){const i=(z+1)*STRIDE+x+1;volume+=Math.max(ground[i],water[i]);}
  return meshQuads(quads,materials,0,volume);
}

export class TerrainMeshes {
  constructor(){this.cache=new Map();}
  scene(level){
    const field=new TerrainField(level),chunks=new Map(level.terrain.boxes.map(c=>[c.box.join(','),`${c.ground}/${c.water}`])),materials=terrainMaterials(level.zone),groups=new Map();
    const signature=(x,z)=>x<0||z<0||x>=level.size[0]||z>=level.size[1]?'outside':(chunks.get(`${x},${z}`)||'flat')+(field.bridgeBox(x,z)?'/bridge-'+level.pathHeight:'');
    for(let z=0;z<level.size[1];z++)for(let x=0;x<level.size[0];x++){
      const signatureKey=JSON.stringify([level.zone,signature(x,z),signature(x-1,z),signature(x+1,z),signature(x,z-1),signature(x,z+1)]);
      let cached=this.cache.get(signatureKey);if(!cached){cached={key:`terrain-${++TerrainMeshes.serial}`,mesh:meshTerrainChunk(field,x,z,materials)};this.cache.set(signatureKey,cached);}
      let group=groups.get(signatureKey);if(!group){group={...cached,transforms:[]};groups.set(signatureKey,group);}group.transforms.push(translation(x*N,0,z*N));
    }
    for(const key of this.cache.keys())if(!groups.has(key))this.cache.delete(key);
    // Repeated geometry remains instanced. Pack one-off chunks into one draw,
    // avoiding one draw call per small edited patch. Rebuild only on changes.
    const repeated=[],unique=[];for(const group of groups.values())(group.transforms.length===1?unique:repeated).push(group);
    if(unique.length){
      const batchKey=unique.map(g=>`${g.key}:${g.transforms[0][12]},${g.transforms[0][14]}`).join('|');
      if(this.batchKey!==batchKey){
        let vertexLength=0,indexLength=0;for(const g of unique){vertexLength+=g.mesh.vertices.length;indexLength+=g.mesh.indices.length;}
        const vertices=new Float32Array(vertexLength),indices=new Uint32Array(indexLength),quads=[];let vo=0,io=0,voxels=0;
        for(const g of unique){const mesh=g.mesh,m=g.transforms[0];vertices.set(mesh.vertices,vo);for(let i=vo;i<vo+mesh.vertices.length;i+=11){vertices[i]+=m[12];vertices[i+2]+=m[14];}for(let i=0;i<mesh.indices.length;i++)indices[io+i]=mesh.indices[i]+vo/11;
          for(const q of mesh.quads)quads.push({...q,origin:[q.origin[0]+m[12],q.origin[1],q.origin[2]+m[14]]});vo+=mesh.vertices.length;io+=mesh.indices.length;voxels+=mesh.voxels;
        }
        this.batchKey=batchKey;this.batch={key:`terrain-batch-${++TerrainMeshes.serial}`,mesh:{vertices,indices,quads,voxels,exposedFaces:0},transforms:[identity()]};
      }
      repeated.push(this.batch);
    }else{this.batch=null;this.batchKey=null;}
    if(level.bridges?.length){
      const signature=JSON.stringify([level.pathHeight,level.bridges,level.terrain.boxes]);
      if(this.bridgeSignature!==signature){this.bridgeSignature=signature;this.bridge={key:`bridge-${++TerrainMeshes.serial}`,mesh:meshQuads(bridgeQuads(level),BRIDGE_MATERIALS),transforms:[identity()]};}
      repeated.push(this.bridge);
    }else{this.bridgeSignature=null;this.bridge=null;}
    return repeated;
  }
}
TerrainMeshes.serial=0;
