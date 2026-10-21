import {newModel,newPart,canonicalModel,VARIANTS} from '../shared/model.js';
import {MISSILE_LAUNCHER_DECK_Y,MISSILE_LAUNCHER_SOCKETS,MISSILE_WELL_HALF_WIDTH,GUIDED_MISSILE_MODEL} from '../shared/missile-model.js';

// Approved vertical launcher and separate rounds. Identity accents glow on
// both models; only launcher panels opt into illuminating nearby surfaces.
const M={porcelain:0,forest:1,moss:2,stone:3,red:4,cream:5,ivoryShade:6,
 ivoryDeep:7,metalEdge:8,metalDark:9,mossLight:10,mossDark:11,
 stoneLight:12,stoneShade:13,redLight:14,redShade:15,recess:16};
const palette=[
 ['Porcelain','#F1E8D5'],['Forest mechanism','#243E35'],['Moss panels','#738B55'],
 ['Stone pad','#D9CCAA'],['Vermilion','#D65D45'],['Porcelain highlight','#FAF2E2'],
 ['Porcelain shade','#D2C6AE'],['Porcelain recess','#B4A88F'],['Forest edge','#435D4F'],
 ['Forest recess','#192C26'],['Moss highlight','#8D9E6E'],['Moss shade','#526640'],
 ['Stone highlight','#E8DAB9'],['Stone edge','#B8A47F'],['Vermilion highlight','#E67C60'],
 ['Vermilion shade','#A94B39'],['Deep mechanism recess','#101C18'],
];
function model(id,name,height){
 const m=newModel(id);m.name=name;m.size[1]=height;
 m.materials=palette.map(([name,color],index)=>{
  const identity=index===M.red||index===M.redLight||index===M.redShade;
  return {name,color,emission:identity?1:0,reflectiveness:0,...(identity?{castsLight:id==='missile-launcher'}:{})};
 });
 return m;
}
function sculpt(part){
 const cells=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
 function box(x0,y0,z0,x1,y1,z1,material){
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   if(material===null)cells.delete(key(x,y,z));else cells.set(key(x,y,z),[x,y,z,material]);
  }
 }
 function face(x0,y0,z0,x1,y1,z1,direction,material){
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   const cell=cells.get(key(x,y,z));if(!cell)throw new Error('Missile model face paint requires an occupied cell.');
   cell[4]??=[-1,-1,-1,-1,-1,-1];cell[4][direction]=material;
  }
 }
 function finish(){
  const tops=new Map([[M.porcelain,M.cream],[M.forest,M.metalEdge],[M.moss,M.mossLight],[M.stone,M.stoneLight]]);
  for(const c of cells.values())if(tops.has(c[3])&&!cells.has(key(c[0],c[1]+1,c[2]))){
   c[4]??=[-1,-1,-1,-1,-1,-1];if(c[4][2]<0)c[4][2]=tops.get(c[3]);
  }
  part.voxels=[...cells.values()];
 }
 return {box,face,finish};
}

export function missileLauncherModel(){
 const m=model('missile-launcher','Vertical missile launcher · Moss & Porcelain',22);m.role='defence';
 for(const [stage,variant]of VARIANTS.entries()){
  const body=newPart('body');body.name='Fixed launch battery with empty vertical wells';
  const s=sculpt(body),top=MISSILE_LAUNCHER_DECK_Y[variant],zlo=[5,2,1][stage],zhi=24-zlo;
  // Common 22-unit mounting pad; stepped corners replace illustrative bevels.
  s.box(1,0,1,23,1,23,M.stoneShade);s.box(1,1,1,23,2,23,M.stone);
  for(const x of [1,22])for(const z of [1,22])s.box(x,0,z,x+1,2,z+1,null);
  s.box(3,2,zlo,21,4,zhi,M.metalDark);
  s.box(3,4,zlo,21,top-2,zhi,M.forest);
  s.box(3,top-2,zlo,21,top-1,zhi,M.moss);
  s.box(3,top-1,zlo,21,top,zhi,M.forest);

  // Recessed lower skirt, service panel and modest red front identifier.
  s.box(5,3,zlo,19,5,zlo+2,M.metalEdge);
  s.box(7,top-7,zlo,17,top-1,zlo+2,M.porcelain);
  s.face(11,top-5,zlo,13,top-3,zlo+1,5,M.red);
  for(const x of [5,18]){
   s.box(x,top-6,zlo,x+1,top-2,zlo+1,M.metalDark);
   s.face(x,top-5,zlo,x+1,top-3,zlo+1,5,M.mossDark);
  }
  for(const x of [3,20])for(const z of [zlo+3,zhi-4]){
   s.box(x,5,z,x+1,top-4,z+1,M.metalDark);
  }
  if(stage>0){
   s.box(8,5,zlo,16,8,zlo+1,M.ivoryShade);
   s.face(10,6,zlo,14,7,zlo+1,5,M.recess);
   s.box(5,4,zhi-2,19,7,zhi,M.mossDark);
  }
  if(stage===2){
   for(const x of [3,20]){
    s.box(x,7,5,x+1,10,19,M.ivoryShade);
    s.box(x,8,6,x+1,10,18,M.porcelain);
    s.box(x,11,4,x+1,13,20,M.metalEdge);
   }
  }

  // Four sturdy porcelain shoulders, with broader stepped feet below them.
  for(const right of [false,true])for(const back of [false,true]){
   const x=right?18:3,z=back?zhi-3:zlo;
   s.box(x,3,z,x+3,top-3,z+3,M.ivoryShade);
   s.box(x,4,z,x+3,top-4,z+3,M.porcelain);
   const ox=right?18:2,oz=back?zhi-3:zlo;
   s.box(ox,top-7,oz,ox+4,top-1,oz+3,M.porcelain);
   s.box(ox+1,top-1,oz,ox+3,top,oz+3,M.porcelain);
   s.box(ox,2,oz,ox+4,3,oz+3,M.mossDark);
   s.box(ox,3,oz,ox+4,4,oz+3,M.moss);
   s.box(ox+1,4,oz+1,ox+3,5,oz+3,M.moss);
  }

  // Floor and lip are real solid cells. The entire six-unit shaft stays empty;
  // loaded noses are separate missile actors, never baked into this model.
  for(const [x,seat,z]of MISSILE_LAUNCHER_SOCKETS[variant]){
   const r=MISSILE_WELL_HALF_WIDTH;
   s.box(x-r-1,top-2,z-r-1,x+r+1,top,z+r+1,M.forest);
   s.box(x-r,seat-1,z-r,x+r,seat,z+r,M.recess);
   s.box(x-r,seat,z-r,x+r,top+1,z+r,null);
  }
  s.finish();m.variants[variant]={parts:[body]};
 }
 return canonicalModel(m);
}

export function guidedMissileModel(){
 const m=model(GUIDED_MISSILE_MODEL.id,'Guided missile · Moss & Porcelain',GUIDED_MISSILE_MODEL.height);
 const body=newPart(GUIDED_MISSILE_MODEL.part);body.name='Missile body, square nose and four tail fins';body.pivot=[...GUIDED_MISSILE_MODEL.origin];
 const s=sculpt(body);
 s.box(11,0,11,13,1,13,M.metalDark);
 s.box(11,1,11,13,7,13,M.porcelain);
 s.box(11,7,11,13,8,13,M.red);
 s.box(11,8,11,13,10,13,M.forest);
 // Cardinal fins remain within a four-unit square cross-section.
 for(const x of [10,13])s.box(x,0,11,x+1,3,13,M.moss);
 for(const z of [10,13])s.box(11,0,z,13,3,z+1,M.moss);
 s.finish();m.variants.base={parts:[body]};
 return canonicalModel(m);
}

if(import.meta.main)for(const source of [missileLauncherModel(),guidedMissileModel()]){
 const path=new URL(`../assets/models/${source.id}.json`,import.meta.url);
 if(process.argv.includes('--write')||!await Bun.file(path).exists()){
  await Bun.write(path,JSON.stringify(source,null,2)+'\n');console.log(`Created assets/models/${source.id}.json`);
 }else console.log(`assets/models/${source.id}.json exists; authored source preserved. Use --write for an explicit rebuild.`);
}
