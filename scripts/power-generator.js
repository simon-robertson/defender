import {newModel,newPart,canonicalModel,VARIANTS} from '../shared/model.js';

// Approved sealed-reactor family. Arsenal slot meanings remain shared; only
// the identity colours differ, and only those green meter faces emit light.
const M={porcelain:0,forest:1,moss:2,stone:3,power:4,cream:5,ivoryShade:6,
 ivoryDeep:7,metalEdge:8,metalDark:9,mossLight:10,mossDark:11,
 stoneLight:12,stoneShade:13,powerLight:14,powerShade:15,recess:16};
const palette=[
 ['Porcelain','#F1E8D5'],['Forest mechanism','#243E35'],['Moss panels','#738B55'],
 ['Stone pad','#D9CCAA'],['Power green','#5FEA38'],['Porcelain highlight','#FAF2E2'],
 ['Porcelain shade','#D2C6AE'],['Porcelain recess','#B4A88F'],['Forest edge','#435D4F'],
 ['Forest recess','#192C26'],['Moss highlight','#8D9E6E'],['Moss shade','#526640'],
 ['Stone highlight','#E8DAB9'],['Stone edge','#B8A47F'],['Power green highlight','#8BFF61'],
 ['Power green shade','#37AD28'],['Deep mechanism recess','#101C18'],
];
function sculpt(part){
 const cells=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
 function box(x0,y0,z0,x1,y1,z1,material){
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   if(material===null)cells.delete(key(x,y,z));else cells.set(key(x,y,z),[x,y,z,material]);
  }
 }
 function face(x0,y0,z0,x1,y1,z1,direction,material){
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   const cell=cells.get(key(x,y,z));if(!cell)throw new Error('Power generator face paint requires an occupied cell.');
   cell[4]??=[-1,-1,-1,-1,-1,-1];cell[4][direction]=material;
  }
 }
 function finish(){
  const tops=new Map([[M.porcelain,M.cream],[M.forest,M.metalEdge],[M.moss,M.mossLight]]);
  for(const c of cells.values())if(tops.has(c[3])&&!cells.has(key(c[0],c[1]+1,c[2]))){
   c[4]??=[-1,-1,-1,-1,-1,-1];if(c[4][2]<0)c[4][2]=tops.get(c[3]);
  }
  part.voxels=[...cells.values()];
 }
 return {box,face,finish};
}

export function powerGeneratorModel(){
 const model=newModel('power-generator');model.name='Power generator · Moss & Porcelain';model.role='defence';model.size[1]=22;
 model.materials=palette.map(([name,color],i)=>({name,color,emission:[4,14,15].includes(i)?1:0,reflectiveness:0,...([4,14,15].includes(i)?{castsLight:true}:{})}));
 for(const [stage,variant]of VARIANTS.entries()){
  const body=newPart('body');body.name='Sealed reactor, cooling banks and front power meter';
  const s=sculpt(body),shoulder=[8,11,13][stage];
  // One broad common plinth, with stepped corner feet and a dark lower edge.
  s.box(1,0,1,23,1,23,M.metalDark);s.box(1,1,1,23,2,23,M.forest);
  for(const x of [1,19])for(const z of [1,19])s.box(x,0,z,x+4,3,z+4,M.forest);
  s.box(5,2,5,19,shoulder,20,M.forest);
  s.box(5,2,5,19,3,20,M.metalDark);

  // Four bars occupy only the outward front faces of a solid dark meter.
  // Face overrides keep the green light exposed without lighting the housing.
  s.box(7,2,3,17,shoulder,6,M.metalDark);
  s.box(7,shoulder-1,3,17,shoulder,6,M.metalEdge);
  for(const x of [8,10,13,15])s.face(x,3,3,x+1,shoulder-1,4,5,M.power);

  // Compact front banks. Their alternating one-cell gaps are actual recesses,
  // backed by solid housings; there are no decorative coplanar overlays.
  for(const x of [3,17]){
   s.box(x,3,4,x+4,shoulder-1,8,M.mossDark);
   for(let y=3;y<shoulder-1;y+=2)s.box(x,y,3,x+4,y+1,8,M.moss);
   s.box(x,shoulder-1,4,x+4,shoulder,8,M.moss);
  }
  // Long side radiators make the generator broad and industrial from above.
  for(const right of [false,true]){
   const x=right?19:2,back=right?19:4;
   s.box(back,3,8,back+1,shoulder-1,20,M.mossDark);
   for(let y=3;y<shoulder-1;y+=2)s.box(x,y,8,x+3,y+1,20,M.moss);
   for(const z of [8,19])s.box(x,3,z,x+3,shoulder,z+1,M.mossDark);
   s.box(x,shoulder-1,8,x+3,shoulder,20,M.moss);
  }
  // A quiet rear grille completes the solid housing on its unseen face.
  s.box(7,3,20,17,shoulder-1,21,M.metalDark);
  for(let y=4;y<shoulder-1;y+=2)s.box(8,y,20,16,y+1,21,M.metalEdge);

  // Closed porcelain shoulder: stepped one-cell corners replace the concept's
  // illustrative bevels while preserving a broad, unmistakably capped top.
  s.box(4,shoulder,4,20,shoulder+1,20,M.ivoryShade);
  s.box(4,shoulder+1,4,20,shoulder+2,20,M.porcelain);
  for(const x of [4,19])for(const z of [4,19])s.box(x,shoulder,z,x+1,shoulder+2,z+1,null);
  s.box(5,shoulder+2,5,19,shoulder+3,19,M.porcelain);
  s.box(9,shoulder-1,3,15,shoulder+1,5,M.porcelain);
  if(stage===0){
   s.box(7,11,7,17,13,17,M.moss);s.box(9,13,9,15,14,15,M.forest);
  }else if(stage===1){
   s.box(6,14,6,18,15,18,M.moss);
   s.box(7,15,7,17,17,17,M.porcelain);s.box(9,17,9,15,18,15,M.forest);
  }else{
   s.box(6,16,6,18,18,18,M.moss);
   s.box(6,18,6,18,20,18,M.porcelain);s.box(7,20,7,17,21,17,M.porcelain);
   s.box(9,21,9,15,22,15,M.forest);
   for(const x of [6,17])for(const z of [6,17])s.box(x,16,z,x+1,18,z+1,M.forest);
  }

  // Upgrades add four tall square corner braces; the final tier breaks the
  // ivory inlays with a dark coupling band rather than growing into a tower.
  if(stage>0)for(const x of [2,19])for(const z of [3,18]){
   s.box(x,2,z,x+3,shoulder+1,z+3,M.forest);
   const faceZ=z===3?3:20,direction=z===3?5:4;
   s.face(x+1,3,faceZ,x+2,shoulder-1,faceZ+1,direction,M.ivoryShade);
   if(stage===2)s.face(x+1,7,faceZ,x+2,9,faceZ+1,direction,M.forest);
   s.box(x,shoulder-1,z,x+3,shoulder+1,z+3,M.porcelain);
  }
  s.finish();model.variants[variant]={parts:[body]};
 }
 return canonicalModel(model);
}

if(import.meta.main){
 const model=powerGeneratorModel(),path=new URL('../assets/models/power-generator.json',import.meta.url);
 if(process.argv.includes('--write')||!await Bun.file(path).exists()){
  await Bun.write(path,JSON.stringify(model,null,2)+'\n');console.log('Created assets/models/power-generator.json');
 }else console.log('assets/models/power-generator.json exists; authored source preserved. Use --write for an explicit rebuild.');
}
