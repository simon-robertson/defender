import {newModel,newPart,canonicalModel} from '../shared/model.js';
import {ENEMY_EXPANSION_RIGS as R,ENEMY_EXPANSION_IDS} from '../shared/enemy-expansion-rigs.js';

// Seven active approved concept translations. Generation is deterministic and has no
// import-time writes; gameplay configuration and motion remain separate.
const PALETTES={
 A:['#D9D0B8','#F1E8D5','#253B32','#72845A','#9B9C81','#48534A','#E87947','#BBB79F'],
 B:['#C58D49','#E2B16B','#253C44','#40616A','#996C3D','#526269','#75C8BD','#CFC4A6'],
 C:['#466077','#647D91','#243744','#D4DFDF','#34495D','#7B8F99','#F0884C','#EFF0E5'],
 D:['#795C75','#9A7A90','#302E3C','#C3BCAE','#584656','#585363','#F18B78','#DAD3C4'],
};
const NAMES=['Armour','Armour top','Mechanism','Secondary plates','Armour shade','Bearing metal','Sensor','Pale edging'];
function model(id,height,parts){
 const m=newModel(id);m.name=id.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(' ');m.size=[24,height,24];m.role='enemy';m.colorMode='authored';
 m.materials=PALETTES[R[id].zone].map((color,i)=>({name:NAMES[i],color,emission:i===6?1:0,reflectiveness:0,...(i===6?{castsLight:true}:{})}));
 m.variants.base.parts=parts.map(p=>p.finish());return canonicalModel(m);
}
function sculpt(id='body',parent=null,pivot=[12,0,12]){
 const p=newPart(id);p.parent=parent;p.pivot=pivot.slice();const cells=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
 const box=(x0,y0,z0,x1,y1,z1,mat)=>{for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){const k=key(x,y,z);if(mat===null)cells.delete(k);else cells.set(k,[x,y,z,mat]);}};
 const face=(x0,y0,z0,x1,y1,z1,direction,mat)=>{for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){const c=cells.get(key(x,y,z));if(!c)throw Error(`${id}: missing face cell ${x},${y},${z}`);c[4]??=[-1,-1,-1,-1,-1,-1];c[4][direction]=mat;}};
 return {p,box,face,finish(){for(const c of cells.values())if(c[3]===0&&!cells.has(key(c[0],c[1]+1,c[2]))){c[4]??=[-1,-1,-1,-1,-1,-1];if(c[4][2]<0)c[4][2]=1;}p.voxels=[...cells.values()];return p;}};
}
function wheelPart(w,x0,x1,armoured=false){
 const s=sculpt(w.id,w.parent,w.pivot),[,cy,cz]=w.pivot,r=w.radius;
 for(let y=Math.floor(cy-r);y<cy+r;y++)for(let z=Math.floor(cz-r);z<cz+r;z++){
  const dy=Math.max(Math.abs(y-cy),Math.abs(y+1-cy)),dz=Math.max(Math.abs(z-cz),Math.abs(z+1-cz));
  if(dy*dy+dz*dz>r*r+1e-8)continue;
  const edge=Math.hypot(y+.5-cy,z+.5-cz)>r-1.7;
  for(let x=x0;x<x1;x++)s.box(x,y,z,x+1,y+1,z+1,edge?(armoured?0:2):5);
  // Continuous armour rims replace arbitrary diagonal colour fragments.
 }
 const hx=Math.floor((x0+x1)/2),hy=Math.floor(cy),hz=Math.floor(cz);
 s.box(hx,hy,hz,hx+1,hy+1,hz+1,2);
 return s;
}
function roller(){
 const b=sculpt();
 b.box(9,5,9,15,15,16,2);b.box(10,4,10,14,6,14,4);
 b.box(8,6,11,16,8,13,5);b.box(10,8,7,14,20,10,0);
 b.box(10,20,9,14,22,14,0);b.box(11,22,11,13,23,14,3);
 b.box(9,14,10,15,19,16,0);b.box(9,15,15,15,19,17,3);
 b.box(11,10,6,13,17,7,2);b.face(11,12,6,13,16,7,5,6);
 b.box(10,18,7,14,20,9,7);b.box(9,9,15,15,12,17,3);
 return model('roller',24,[b,...R.roller.wheels.map((w,i)=>wheelPart(w,i?17:3,i?21:7,true))]);
}
function duneTread(){
 const b=sculpt();
 b.box(8,3,6,16,7,19,2);b.box(9,3,4,15,5,8,0);
 b.box(9,5,6,15,7,10,0);b.box(8,7,9,16,9,17,0);b.box(9,9,12,15,10,17,0);
 b.box(10,7,7,14,8,9,7);b.box(10,5,4,14,6,5,2);b.face(11,5,4,13,6,5,5,6);
 b.box(9,6,18,15,8,20,3);b.box(10,8,17,14,9,19,2);
 // Three exposed wheels per side. Upper fenders retain the hull silhouette;
 // no continuous track belt or end frames remain below them.
 for(const x of [4,17])b.box(x,8,7,x+3,9,17,0);
 b.box(7,5,7,17,6,18,5);b.box(6,7,10,9,8,14,5);b.box(15,7,10,18,8,14,5);
 return model('dune-tread',11,[b,...R['dune-tread'].wheels.map((w,i)=>wheelPart(w,i<3?4:17,i<3?7:20))]);
}
function tripod(){
 const b=sculpt();
 b.box(10,16,10,14,24,15,2);b.box(9,19,9,15,24,15,0);
 b.box(10,24,10,14,26,14,3);b.box(11,26,11,13,27,14,0);
 b.box(10,19,8,14,24,9,3);b.box(11,20,7,13,24,8,2);b.face(11,20,7,13,23,8,5,6);
 b.box(9,17,10,10,19,12,5);b.box(14,17,10,15,19,12,5);b.box(11,17,15,13,19,16,5);
 const parts=[b];
 for(const [i,l]of R.tripod.legs.entries()){
  const [up,lo,ft]=l.ids,u=sculpt(up,'body',l.hip),d=sculpt(lo,up,l.knee),f=sculpt(ft,lo,l.ankle);
  if(i<2){
   const mirror=i===1,box=(s,x0,y0,z0,x1,y1,z1,m)=>s.box(mirror?24-x1:x0,y0,z0,mirror?24-x0:x1,y1,z1,m);
   box(u,6,14,9,8,17,11,2);box(u,4,11,8,6,15,10,0);box(u,4,10,8,6,12,10,5);
   box(u,6,15,8,8,17,9,3);
   box(u,4,10,7,7,11,8,5);
   box(d,7,8,5,8,12,10,5);box(d,7,9,6,8,12,9,null);box(d,5,8,6,7,9,8,5);
   box(d,4,7,6,6,9,8,5);box(d,4,3,5,6,8,7,2);box(d,4,4,5,6,7,6,3);
   box(f,4,0,6,7,1,9,2);box(f,4,1,6,6,2,8,0);box(f,4,1,6,6,2,7,7);
  }else{
   u.box(11,14,17,13,17,19,2);u.box(11,11,18,13,15,20,0);u.box(11,10,19,13,12,21,5);u.box(9,10,18,13,11,19,5);
   d.box(9,8,16,10,13,21,5);d.box(9,9,17,10,12,20,null);d.box(10,8,18,12,9,20,5);
   d.box(11,7,18,13,9,20,5);d.box(11,3,19,13,8,21,2);d.box(11,4,21,13,7,22,3);
   f.box(10,0,18,14,1,21,2);f.box(11,1,19,13,2,21,0);f.box(10,1,18,12,2,19,7);
  }
  parts.push(u,d,f);
 }
 return model('tripod',28,parts);
}
function moth(){
 const b=sculpt();b.box(10,3,8,14,7,17,2);b.box(10,5,8,14,8,14,0);b.box(11,7,11,13,9,16,3);
 b.box(10,3,6,14,6,9,0);b.box(11,3,5,13,5,6,2);b.face(11,4,5,13,5,6,5,6);
 b.box(11,3,17,13,6,19,4);
 const parts=[b];
 for(const w of R.moth.wings){
  const s=sculpt(w.id,'body',w.pivot),right=w.id.endsWith('r'),rear=w.id.includes('-r');
  const rect=(x0,y0,z0,x1,y1,z1,m)=>s.box(right?24-x1:x0,y0,z0,right?24-x0:x1,y1,z1,m);
  if(!rear){rect(3,5,5,8,6,12,0);rect(2,5,6,3,6,10,3);rect(3,5,4,5,6,5,3);rect(7,5,8,9,6,10,5);rect(4,6,6,7,7,9,0);rect(3,5,11,6,6,12,3);}
  else{rect(5,5,15,8,6,19,0);rect(4,5,17,5,6,19,3);rect(7,5,15,9,6,17,5);rect(5,5,18,7,6,20,3);}
  parts.push(s);
 }
 return model('moth',10,parts);
}
function rotor(s,cx,cy,cz,r){
 // Thin solid cross blades stay inside a circular swept opening. Square hub.
 s.box(cx-1,cy,cz-1,cx+1,cy+1,cz+1,5);
 s.box(cx-r,cy,cz-1,cx+r,cy+1,cz,2);
 s.box(cx,cy,cz-r,cx+1,cy+1,cz+r,2);
}
function twinFan(){
 const b=sculpt();b.box(10,3,6,14,7,17,2);b.box(10,5,6,14,8,13,0);
 b.box(11,3,4,13,6,6,0);b.box(11,4,3,13,6,4,2);b.face(11,4,3,13,5,4,5,6);
 b.box(11,7,15,13,12,17,3);b.box(11,11,16,13,13,18,0);
 b.box(9,4,11,15,6,13,5);
 for(const cx of [5,19]){
  b.box(cx-4,5,8,cx+4,7,9,3);b.box(cx-4,5,15,cx+4,7,16,3);
  b.box(cx-4,5,9,cx-3,7,15,3);b.box(cx+3,5,9,cx+4,7,15,3);
  // Clean continuous fan guards; remove nonfunctional diagonal armour bumps.
 }
 // Bridges below the spinning plane, joining frame, body and each hub support.
 b.box(5,3,11,19,4,13,5);b.box(4,4,11,6,5,13,2);b.box(18,4,11,20,5,13,2);
 const fans=R['twin-fan'].rotors.map(w=>{const p=sculpt(w.id,'body',w.pivot);rotor(p,w.pivot[0],6,12,2);return p;});
 return model('twin-fan',14,[b,...fans]);
}
function ray(){
 const b=sculpt();b.box(10,1,4,14,5,18,2);b.box(11,2,2,13,4,5,0);
 b.box(10,4,7,14,6,15,0);b.box(11,5,8,13,7,14,3);
 b.box(10,2,3,14,4,4,3);b.face(11,2,2,13,3,3,5,6);
 // Whole-cell stepped delta outline; no diagonal source faces.
 for(let x=2;x<10;x++){const d=10-x;const z0=5+Math.floor(d*.75),z1=18-Math.floor(d*.25);b.box(x,2,z0,x+1,3,z1,0);b.box(23-x,2,z0,24-x,3,z1,0);}
 b.box(6,3,10,10,4,15,3);b.box(14,3,10,18,4,15,3);
 b.box(8,3,15,10,4,17,2);b.box(14,3,15,16,4,17,2);
 b.box(8,3,17,10,7,19,0);b.box(14,3,17,16,7,19,0);
 b.box(9,7,18,10,9,20,3);b.box(14,7,18,15,9,20,3);
 return model('ray',10,[b]);
}
function lantern(){
 const b=sculpt();b.box(10,4,10,14,14,14,2);b.box(9,6,10,15,13,14,0);
 b.box(10,13,10,14,16,14,3);b.box(11,15,11,13,19,13,5);
 b.box(10,6,9,14,12,10,0);b.box(11,7,8,13,10,9,2);b.face(11,8,8,13,10,9,5,6);
 b.box(8,2,10,10,6,14,3);b.box(14,2,10,16,6,14,3);b.box(9,5,11,15,7,13,5);
 // Fixed overhead frame and four slim supports stay beyond the rotor sweep.
 b.box(5,19,5,19,22,6,0);b.box(5,19,18,19,22,19,0);
 b.box(5,19,6,6,22,18,0);b.box(18,19,6,19,22,18,0);
 for(const x of [5,17])for(const z of [5,17])b.box(x,21,z,x+2,23,z+2,3);
 b.box(11,17,6,13,18,18,5);b.box(6,17,11,18,18,13,5);
 b.box(5,17,11,6,20,13,2);b.box(18,17,11,19,20,13,2);
 b.box(11,17,5,13,20,6,2);b.box(11,17,18,13,20,19,2);
 const p=sculpt('rotor','body',R.lantern.rotors[0].pivot);rotor(p,12,20,12,5);
 return model('lantern',24,[b,p]);
}
const GENERATORS={roller,'dune-tread':duneTread,tripod,moth,'twin-fan':twinFan,ray,lantern};
export function enemyExpansionModel(id){if(!GENERATORS[id])throw Error(`Unknown enemy expansion model: ${id}`);return GENERATORS[id]();}
export function enemyExpansionModels(){return ENEMY_EXPANSION_IDS.map(enemyExpansionModel);}
if(import.meta.main)for(const m of enemyExpansionModels()){
 const path=`assets/models/${m.id}.json`;
 if(process.argv.includes('--write')||!await Bun.file(path).exists()){await Bun.write(path,JSON.stringify(m,null,2)+'\n');console.log(`Wrote ${path}`);}
 else console.log(`${path} exists; authored source preserved.`);
}
