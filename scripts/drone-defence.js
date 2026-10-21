import {newModel,newPart,canonicalModel,VARIANTS} from '../shared/model.js';
import {DRONE_MODEL,DRONE_ROTORS,DRONE_VARIANTS} from '../shared/drone-model.js';

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
function sculpt(part){
 const cells=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
 function box(x0,y0,z0,x1,y1,z1,material){
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   if(material===null)cells.delete(key(x,y,z));else cells.set(key(x,y,z),[x,y,z,material]);
  }
 }
 function face(x0,y0,z0,x1,y1,z1,direction,material){
  for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
   const cell=cells.get(key(x,y,z));if(!cell)throw new Error('Drone face paint requires an occupied cell.');
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
function part(id,parent,pivot,name){const p=newPart(id);p.parent=parent;p.pivot=[...pivot];p.name=name;return p;}

export function droneDefenceModel(){
 const model=newModel(DRONE_MODEL.id);model.name='Recharge drone · Moss & Porcelain';model.role='defence';model.size[1]=19;
 model.materials=palette.map(([name,color],i)=>({name,color,emission:[4,14,15].includes(i)?1:0,reflectiveness:0,...([4,14,15].includes(i)?{castsLight:true}:{})}));
 for(const [stage,variant]of VARIANTS.entries()){
  const pad=part('pad',null,DRONE_MODEL.padPivot,'Fixed recharge pad and rear charging cabinet'),p=sculpt(pad);
  p.box(1,0,1,23,1,23,M.metalDark);p.box(1,1,1,23,2,23,M.forest);
  // Pale corner armour and actual inset contact rails, flush with the deck.
  for(const x of [1,19])for(const z of [1,19]){
   p.box(x,0,z,x+4,2,z+4,M.porcelain);
   p.face(x+1,1,z+1,x+2,2,z+2,2,M.red);
  }
  for(const x of [7,15]){
   p.box(x,1,4,x+2,2,20,M.metalEdge);
   p.face(x,1,5,x+2,2,7,2,M.stoneLight);p.face(x,1,17,x+2,2,19,2,M.stoneLight);
  }
  const chargeTop=DRONE_VARIANTS[variant].chargingHeight;
  p.box(9,2,21,15,chargeTop-1,23,M.forest);
  for(const x of [9,14])p.box(x,2,21,x+1,chargeTop,23,M.porcelain);
  p.box(10,chargeTop-2,21,14,chargeTop,23,M.mossDark);
  for(const x of [10,12]){p.box(x,3,20,x+1,chargeTop-2,21,M.stoneShade);}
  p.finish();

  const drone=part('drone',null,DRONE_MODEL.bodyPivot,'Level legless flying chassis and endurance battery'),d=sculpt(drone);
  // One-cell inboard clearance slots separate the complete tilting housings
  // from the chassis. The approved outside fan silhouette stays unchanged.
  d.box(10,8,7,14,10,19,M.forest);d.box(10,10,6,14,13,19,M.porcelain);
  d.box(10,9,4,14,12,6,M.porcelain);d.box(10,8,3,14,11,4,M.ivoryShade);
  d.face(11,9,3,13,10,4,5,M.red);
  d.box(10,12,6,14,13,9,M.moss);d.box(10,13,10,14,14,17,M.moss);
  // Recessed dark suspension arms remain on the level body.
  for(const rotor of DRONE_ROTORS){
   const [x,,z]=rotor.pivot;
   d.box(x<12?10:12,9,z-1,x<12?13:14,10,z+1,M.forest);
  }
  // The user removed all legs/skids: rest is a low powered hover above the pad.
  // Endurance changes are battery volume only, not altered guns or fans.
  if(stage===1){
   for(const x of [9,13]){d.box(x,13,11,x+2,15,18,M.ivoryShade);d.box(x,15,12,x+2,16,17,M.porcelain);}
   d.box(11,13,12,13,16,17,M.mossDark);
  }
  if(stage===2){
   d.box(9,13,10,15,17,18,M.forest);
   for(const x of [9,14])d.box(x,14,11,x+1,18,17,M.porcelain);
   d.box(10,17,12,14,19,17,M.mossDark);d.box(11,18,13,13,19,16,M.moss);
   for(const x of [9,14])for(const z of [12,14,16])d.face(x,14,z,x+1,16,z+1,x===9?1:0,M.recess);
  }
  d.finish();

  const yaw=part('gun-yaw','drone',DRONE_MODEL.gunPivot,'Underslung fine-yaw fork bearing'),y=sculpt(yaw);
  y.box(10,7,8,14,8,10,M.metalDark);
  for(const x of [9,14])y.box(x,5,8,x+1,8,10,M.forest);
  y.finish();
  const gun=part('gun-pitch','gun-yaw',DRONE_MODEL.gunPivot,'Double-barrel machine gun and shared receiver'),g=sculpt(gun);
  g.box(10,4,8,14,6,12,M.forest);
  // Two slim, physically separated barrels retain one gun/round damage value.
  for(const x of [10,13]){
   g.box(x,4,3,x+1,6,8,M.metalEdge);g.box(x,4,2,x+1,6,3,M.metalDark);
   g.face(x,4,2,x+1,6,3,5,M.recess);g.box(x,5,7,x+1,6,8,M.metalDark);
  }
  g.finish();
  // The entire open ring pitches/rolls; its rotor inherits this fan normal.
  const fans=DRONE_ROTORS.map(({gimbal,pivot})=>{
   const f=part(gimbal,'drone',pivot,'Gimballed open lift-fan housing'),s=sculpt(f),[x,y,z]=pivot;
   s.box(x-4,y-1.5,z-4,x+4,y-.5,z+4,M.metalDark);
   s.box(x-4,y-.5,z-4,x+4,y+1.5,z+4,M.porcelain);
   s.box(x-3,y-1.5,z-3,x+3,y+1.5,z+3,null);
   s.face(x-1,y-.5,z-4,x+1,y+.5,z-3,5,M.red);s.finish();return f;
  });
  const rotors=DRONE_ROTORS.map(({id,gimbal,pivot})=>{
   const r=part(id,gimbal,pivot,'Free-spinning lift fan cross and central hub'),s=sculpt(r),[x,y,z]=pivot;
   s.box(x-2,y-.5,z-1,x+2,y+.5,z+1,M.forest);s.box(x-1,y-.5,z-2,x+1,y+.5,z+2,M.forest);
   s.box(x-1,y-.5,z-1,x+1,y+.5,z+1,M.ivoryShade);s.finish();return r;
  });
  model.variants[variant]={parts:[pad,drone,yaw,gun,...fans,...rotors]};
 }
 return canonicalModel(model);
}

if(import.meta.main){
 const source=droneDefenceModel(),path=new URL('../assets/models/drone-defence.json',import.meta.url);
 if(process.argv.includes('--write')||!await Bun.file(path).exists()){
  await Bun.write(path,JSON.stringify(source,null,2)+'\n');console.log('Created assets/models/drone-defence.json');
 }else console.log('assets/models/drone-defence.json exists; authored source preserved. Use --write for an explicit rebuild.');
}
