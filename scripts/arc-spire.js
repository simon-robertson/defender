import {newModel,newPart,canonicalModel,VARIANTS} from '../shared/model.js';
import {BOX_SIZE} from '../shared/grid.js';

// Editable translation of the accepted Arc Spire concept. These are authored
// world units, not a scaled reference sculpt. No attack or animation is implied.
const M={porcelain:0,forest:1,moss:2,stone:3,red:4,cream:5,ivoryShade:6,
 ivoryDeep:7,metalEdge:8,metalDark:9,mossLight:10,mossDark:11,
 stoneLight:12,stoneShade:13,redLight:14,redShade:15,recess:16};

// Keep the existing turret's 17 material-slot roles for shared zone palettes.
const palette=[
 ['Porcelain','#F1E8D5'],['Forest mechanism','#243E35'],
 ['Moss panels','#738B55'],['Stone pad','#D9CCAA'],['Vermilion','#D65D45'],
 ['Porcelain highlight','#FAF2E2'],['Porcelain shade','#D2C6AE'],
 ['Porcelain recess','#B4A88F'],['Forest edge','#435D4F'],
 ['Forest recess','#192C26'],['Moss highlight','#8D9E6E'],
 ['Moss shade','#526640'],['Stone highlight','#E8DAB9'],
 ['Stone edge','#B8A47F'],['Vermilion highlight','#E67C60'],
 ['Vermilion shade','#A94B39'],['Deep mechanism recess','#101C18'],
];
const lightAccents=new Set([M.red,M.redLight,M.redShade]);

function sculpt(part){
 const cells=new Map(),key=(x,y,z)=>x+BOX_SIZE*(z+BOX_SIZE*y);
 function box(x0,y0,z0,x1,y1,z1,material){
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   if(material===null)cells.delete(key(x,y,z));
   else cells.set(key(x,y,z),[x,y,z,material]);
  }
 }
 function face(x0,y0,z0,x1,y1,z1,direction,material){
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   const cell=cells.get(key(x,y,z));
   if(!cell)throw new Error('Arc Spire face paint needs an occupied cell.');
   cell[4]??=[-1,-1,-1,-1,-1,-1];cell[4][direction]=material;
  }
 }
 function ring(lo,y0,hi,y1,inner0,inner1,material){
  box(lo,y0,lo,hi,y1,inner0,material);
  box(lo,y0,inner1,hi,y1,hi,material);
  box(lo,y0,inner0,inner0,y1,inner1,material);
  box(inner1,y0,inner0,hi,y1,inner1,material);
 }
 function finish(){
  const tops=new Map([[M.porcelain,M.cream],[M.forest,M.metalEdge],
   [M.moss,M.mossLight],[M.stone,M.stoneLight]]);
  for(const cell of cells.values())if(tops.has(cell[3])&&!cells.has(key(cell[0],cell[1]+1,cell[2]))){
   cell[4]??=[-1,-1,-1,-1,-1,-1];
   if(cell[4][2]<0)cell[4][2]=tops.get(cell[3]);
  }
  part.voxels=[...cells.values()];
 }
 return {box,face,ring,finish};
}

export function arcSpireModel(){
 const model=newModel('arc-spire');model.name='Arc Spire · Moss & Porcelain';
 model.role='defence';model.size[1]=54;
 model.materials=palette.map(([name,color],index)=>({name,color,
  emission:lightAccents.has(index)?1:0,reflectiveness:0,
  ...(lightAccents.has(index)?{castsLight:true}:{})}));

 for(const [stage,variant]of VARIANTS.entries()){
  const body=newPart('body');body.name='Fixed coil mast and pedestal';
  const s=sculpt(body),tiers=3+stage*2,crownY=27+stage*10,crownDepth=stage===2?3:2;

  // Shared pad and compact stepped plinth. The pad remains inside the box.
  s.box(1,0,1,23,1,23,M.stoneShade);
  s.box(1,1,1,23,2,23,M.stone);
  s.box(3,2,3,21,3,21,M.stone);
  for(const x of [1,22])for(const z of [1,22])s.box(x,0,z,x+1,2,z+1,null);
  s.box(5,3,5,19,4,19,M.metalDark);
  s.box(6,4,6,18,5,18,M.ivoryShade);
  s.box(7,5,7,17,8,17,M.porcelain);
  s.box(8,8,8,16,10,16,M.porcelain);

  // Forest core, broad separated porcelain tiers and visibly dark intervals.
  s.box(9,9,9,15,crownY,15,M.forest);
  s.face(9,12,9,10,crownY,10,5,M.metalDark);
  for(let tier=0;tier<tiers;tier++){
   const y=10+tier*5;
   s.box(6,y,6,18,y+2,18,M.porcelain);
   s.face(6,y,6,18,y+1,18,3,M.ivoryShade);
  }

  // Four broad stepped braces retain the concept's taper without diagonal faces.
  const braceTop=[12,17,20][stage];
  for(const right of [false,true])for(const back of [false,true]){
   for(let y=3;y<braceTop;y++){
    const inset=5+Math.min(3,Math.floor((y-3)*4/(braceTop-3)));
    const x=right?21-inset:inset,z=back?21-inset:inset;
    s.box(x,y,z,x+3,y+1,z+3,M.moss);
   }
   const x=right?16:5,z=back?16:5;
   s.box(x,3,z,x+3,5,z+3,M.mossDark);
  }

  // Upgrades reinforce the same footprint; no side pylons or extra devices.
  if(stage>0){
   const lo=stage===2?3:4,hi=24-lo,top=stage===2?14:10;
   for(const right of [false,true]){
    const x0=right?17:lo,x1=right?hi:7;
    s.box(x0,3,7,x1,top,17,M.porcelain);
    s.box(x0,top,8,x1,top+1,16,M.ivoryShade);
    s.box(x0,3,7,x1,5,17,M.mossDark);
    // Quiet geometric recesses are whole-cell face materials, never overlays.
    if(stage===1){
     s.face(x0,6,7,x0+1,8,8,5,M.metalDark);
     s.face(x1-1,6,7,x1,8,8,5,M.metalDark);
    }else{
     const panelX=right?19:4;
     s.face(panelX,7,7,panelX+1,12,8,5,M.red);
    }
   }
  }

  // One coherent front panel per version, plus two narrow upgrade-2 panels.
  // All exposed light faces share slot 4 to avoid tiny shade-light islands.
  s.box(8,4,5,16,8,7,M.ivoryShade);
  s.box(9,5,5,15,8,6,M.porcelain);
  s.face(10,5,5,14,7,6,5,M.red);
  s.box(9,8,6,15,9,8,M.porcelain);

  // The square crown is truly open. A recessed dark support below it joins the
  // mast to the left/right rim; nothing floats and the opening remains visible.
  const crownLo=stage===2?2:3,crownHi=24-crownLo;
  s.box(crownLo,crownY-2,13,crownHi,crownY,16,M.metalDark);
  s.ring(crownLo,crownY-1,crownHi,crownY,6,18,M.forest);
  s.ring(crownLo,crownY,crownHi,crownY+crownDepth,6,18,M.porcelain);

  // Four dark terminal blocks with pale nonemissive insets. Electricity is not
  // modelled: the only emissive surfaces are the approved red identity panels.
  const terminalY=crownY+crownDepth,terminalHeight=stage===2?4:3;
  for(const x of [crownLo,crownHi-4])for(const z of [crownLo,crownHi-4]){
   s.box(x,terminalY-1,z,x+4,terminalY+1,z+4,M.mossDark);
   s.box(x+1,terminalY+1,z+1,x+3,terminalY+terminalHeight,z+3,M.forest);
   s.face(x+1,terminalY+1,z+1,x+2,terminalY+terminalHeight,z+2,5,M.cream);
  }
  s.finish();model.variants[variant]={parts:[body]};
 }
 return canonicalModel(model);
}

if(import.meta.main){
 const path=new URL('../assets/models/arc-spire.json',import.meta.url);
 if(process.argv.includes('--write')||!await Bun.file(path).exists()){
  await Bun.write(path,JSON.stringify(arcSpireModel(),null,2)+'\n');
  console.log('Created assets/models/arc-spire.json');
 }else console.log('assets/models/arc-spire.json exists; authored source preserved. Use --write for an explicit rebuild.');
}
