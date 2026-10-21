import {test,expect} from 'bun:test';
import {droneDefenceModel} from '../scripts/drone-defence.js';
import {DRONE_MODEL,DRONE_ROTORS,DRONE_VARIANTS} from '../shared/drone-model.js';
import {validateModel,VARIANTS} from '../shared/model.js';
import {compileModel,meshPart} from '../shared/mesher.js';
import {modelForZone} from '../shared/zone-style.js';
import {partMatrices,identity} from '../shared/math.js';
import {ModelLights} from '../engine/model-lights.js';

const source=droneDefenceModel(),key=c=>c.slice(0,3).join(','),accent=i=>[4,14,15].includes(i);
function connected(cells){
 const occupied=new Set(cells.map(key)),seen=new Set(),pending=[cells[0].slice(0,3)];
 while(pending.length){const p=pending.pop(),k=key(p);if(seen.has(k)||!occupied.has(k))continue;seen.add(k);
  for(let a=0;a<3;a++)for(const d of [-1,1]){const n=p.slice();n[a]+=d;pending.push(n);}}
 return seen.size===occupied.size;
}
function box(cell,m){
 const p=cell.map((n,i)=>i<3?n+.5:n),axes=[[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]];
 return {p:[0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i]),axes};
}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function intersects(a,b){
 const d=b.p.map((n,i)=>n-a.p[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 // Broad phase plus exact separating-axis theorem for independently posed cells.
 for(let i=0;i<3;i++)if(Math.abs(d[i])>=.5*(a.axes.reduce((n,v)=>n+Math.abs(v[i]),0)+b.axes.reduce((n,v)=>n+Math.abs(v[i]),0))-1e-5)return false;
 for(const axis of [...a.axes,...b.axes,...a.axes.flatMap(v=>b.axes.map(w=>cross(v,w)))]){
  if(dot(axis,axis)<1e-12)continue;
  const radius=.5*(a.axes.reduce((n,v)=>n+Math.abs(dot(v,axis)),0)+b.axes.reduce((n,v)=>n+Math.abs(dot(v,axis)),0));
  if(Math.abs(dot(d,axis))>=radius-1e-5)return false;
 }
 return true;
}

test('drone canonical source has twelve connected rigid parts, nested gimbals and matte arsenal materials',async()=>{
 validateModel(source);expect(source).toEqual(await Bun.file('assets/models/drone-defence.json').json());
 expect(source.role).toBe('defence');expect(source.size).toEqual([24,19,24]);expect(source.materials).toHaveLength(17);
 const turret=await Bun.file('assets/models/turret-study.json').json();
 for(const [i,m]of source.materials.entries()){
  expect(m.color).toBe(turret.materials[i].color);expect(m.reflectiveness).toBe(0);expect(m.emission).toBe(accent(i)?1:0);expect(m.castsLight===true).toBe(accent(i));
 }
 for(const variant of VARIANTS){
  const parts=source.variants[variant].parts;expect(parts).toHaveLength(12);
  expect(parts.filter(p=>p.parent===null).map(p=>p.id)).toEqual(['pad','drone']);
  expect(parts.find(p=>p.id==='gun-yaw').parent).toBe('drone');expect(parts.find(p=>p.id==='gun-pitch').parent).toBe('gun-yaw');
  expect(Math.max(...parts.flatMap(p=>p.voxels.map(c=>c[1]+1)))).toBe(DRONE_VARIANTS[variant].height);
  for(const part of parts){expect(connected(part.voxels)).toBe(true);expect(new Set(part.voxels.map(key)).size).toBe(part.voxels.length);}
  for(const r of DRONE_ROTORS){
   const p=parts.find(p=>p.id===r.id),gimbal=parts.find(p=>p.id===r.gimbal);
   expect(p.parent).toBe(r.gimbal);expect(p.pivot).toEqual(r.pivot);
   expect(gimbal.parent).toBe('drone');expect(gimbal.pivot).toEqual(r.pivot);
  }
 }
 const changed=droneDefenceModel();changed.variants.base.parts[0].voxels[0][3]=99;expect(droneDefenceModel()).toEqual(source);
 expect(Object.isFrozen(DRONE_MODEL)).toBe(true);expect(Object.isFrozen(DRONE_ROTORS[0].pivot)).toBe(true);
});

test('all fans have real open recesses and their complete continuous spin cylinders clear the chassis',()=>{
 for(const variant of VARIANTS){
  const parts=source.variants[variant].parts;
  for(const r of DRONE_ROTORS){
   const [x,y,z]=r.pivot,fan=parts.find(p=>p.id===r.gimbal),occupied=new Set(fan.voxels.map(key));
   for(let dx=-3;dx<3;dx++)for(let dz=-3;dz<3;dz++)for(let cy=y-1.5;cy<y+1.5;cy++)expect(occupied.has(key([x+dx,cy,z+dz]))).toBe(false);
   for(const c of parts.find(p=>p.id===r.id).voxels)for(const dx of [0,1])for(const dz of [0,1]){
    expect(Math.hypot(c[0]+dx-x,c[2]+dz-z)).toBeLessThanOrEqual(DRONE_MODEL.rotorRadius+1e-12);
   }
   expect(DRONE_MODEL.rotorRadius).toBeLessThan(DRONE_MODEL.fanOpeningHalfWidth);
   // Distance from the fan axis to every static voxel square; this proves
   // clearance for all angles, not only a sequence of rotor snapshots.
   // Housing and rotor inherit the same gimbal, so this cylinder/ring
   // separation holds at every pitch/roll as well as every spin angle.
   for(const c of fan.voxels)if(c[1]<y+.5&&c[1]+1>y-.5){
    const dx=Math.max(c[0]-x,0,x-c[0]-1),dz=Math.max(c[2]-z,0,z-c[2]-1);
    expect(Math.hypot(dx,dz)).toBeGreaterThan(DRONE_MODEL.rotorRadius);
   }
  }
 }
});

test('complete fan assemblies clear level chassis, gun and pad through the compound tilt envelope',()=>{
 const limit=DRONE_MODEL.fanTiltMax,deg=180/Math.PI;
 expect(limit).toBe(20*Math.PI/180);expect(DRONE_MODEL.minimumFanTiltLift).toBe(6);
 // For Rz(roll)*Rx(pitch), |dy|<=1.5+4*(|pitch|+|roll|).
 // Cauchy bounds every point continuously across hypot(pitch,roll)<=20°.
 const verticalReach=1.5+4*Math.SQRT2*limit;
 // The front mounts are one unit higher to preserve full fine-yaw gun
 // clearance at20°. Rear fans clear the gun longitudinally instead.
 expect(11.5-verticalReach).toBeGreaterThan(8);
 expect(10.5-verticalReach+DRONE_MODEL.minimumFanTiltLift).toBeGreaterThan(13);
 // |dx|<=4+1.5*|roll|+4*|pitch*roll|. The one-cell
 // chassis slots therefore clear the housing continuously, not just samples.
 const horizontalReach=4+1.5*limit+2*limit*limit;
 expect(5+horizontalReach).toBeLessThan(10);expect(19-horizontalReach).toBeGreaterThan(14);
 // The gun fork remains below Y8, and even full declared gun pitch cannot
 // reach the fan's continuously bounded lowest point.
 const gunTop=6+Math.max(3*Math.sin(-DRONE_MODEL.gunPitchMin),7*Math.sin(DRONE_MODEL.gunPitchMax));
 expect(gunTop).toBeLessThan(8);
 const rearFanFront=18-4-1.5*limit;
 // Receiver's farthest Z under pitch and yaw, conservatively bounded.
 const gunRear=9+3+Math.sin(-DRONE_MODEL.gunPitchMin)+3*Math.sin(DRONE_MODEL.gunYawMax);
 expect(rearFanFront).toBeGreaterThan(gunRear);
 // Whole fan spheres are disjoint even for independently tilted housings.
 const fanRadius=Math.hypot(4,1.5,4);
 expect(2*fanRadius).toBeLessThan(12);
 // Preserve the runtime's existing conservative navigation sphere (also Y).
 expect(Math.hypot(7,2.5,6)+fanRadius).toBeLessThan(16.5);
 const poses=[[0,0]];
 for(const radius of [5,10,15,20])for(let bearing=0;bearing<360;bearing+=15){
  const angle=bearing*Math.PI/180;poses.push([radius*Math.cos(angle),radius*Math.sin(angle)]);
 }
 let checked=0;
 for(const variant of VARIANTS){
  const parts=source.variants[variant].parts,byId=new Map(parts.map(p=>[p.id,p]));
  expect(byId.get('drone').voxels.filter(c=>c[1]<13).every(c=>c[0]>=10&&c[0]+1<=14)).toBe(true);
  expect(byId.get('gun-yaw').voxels.every(c=>c[1]+1<=8)).toBe(true);
  expect(byId.get('gun-pitch').voxels.every(c=>c[1]>=4&&c[1]+1<=6&&c[2]>=2&&c[2]+1<=12)).toBe(true);
  for(const r of DRONE_ROTORS)expect(byId.get(r.gimbal).voxels.every(c=>
   c[0]>=r.pivot[0]-4&&c[0]+1<=r.pivot[0]+4&&c[1]>=r.pivot[1]-1.5&&c[1]+1<=r.pivot[1]+1.5&&c[2]>=r.pivot[2]-4&&c[2]+1<=r.pivot[2]+4)).toBe(true);
  for(const [pitch,roll]of poses){
   expect(Math.hypot(pitch/deg,roll/deg)).toBeLessThanOrEqual(limit+1e-12);
   const matrices=partMatrices(parts,Object.fromEntries(DRONE_ROTORS.map(r=>[r.gimbal,[pitch,0,roll]])));
   for(const p of parts)if(p.id!=='pad')matrices.get(p.id)[13]+=DRONE_MODEL.minimumFanTiltLift;
   let collision=null;
   for(const r of DRONE_ROTORS){
    const moving=byId.get(r.gimbal).voxels.map(c=>box(c,matrices.get(r.gimbal)));
    for(const id of ['drone','gun-yaw','gun-pitch','pad']){
     const other=byId.get(id),fixed=other.voxels.map(c=>box(c,matrices.get(id)));
     outer:for(let a=0;a<moving.length;a++)for(let b=0;b<fixed.length;b++)if(intersects(moving[a],fixed[b])){
      collision={variant,pitch,roll,id:r.gimbal,other:id,a:byId.get(r.gimbal).voxels[a].slice(0,3),b:other.voxels[b].slice(0,3)};break outer;
     }
     if(collision)break;
    }
    if(collision)break;
   }
   expect(collision).toBeNull();checked++;
  }
 }
 expect(checked).toBe(291);
},20000);

test('twenty-degree fan steering clears simultaneous extreme gun yaw and pitch',()=>{
 const degrees=DRONE_MODEL.fanTiltMax*180/Math.PI,diagonal=degrees/Math.SQRT2;
 const fanPoses=[[degrees,0],[-degrees,0],[0,degrees],[0,-degrees],
  [diagonal,diagonal],[diagonal,-diagonal],[-diagonal,diagonal],[-diagonal,-diagonal]];
 let checked=0;
 for(const variant of VARIANTS){
  const parts=source.variants[variant].parts,byId=new Map(parts.map(p=>[p.id,p]));
  for(const [pitch,roll]of fanPoses)for(const yaw of [-15,0,15])for(const gunPitch of [-35,0,10]){
   const matrices=partMatrices(parts,{...Object.fromEntries(DRONE_ROTORS.map(r=>[r.gimbal,[pitch,0,roll]])),
    'gun-yaw':[0,yaw,0],'gun-pitch':[gunPitch,0,0]});
   let collision=null;
   outer:for(const r of DRONE_ROTORS){
    const moving=byId.get(r.gimbal).voxels.map(c=>box(c,matrices.get(r.gimbal)));
    for(const id of ['gun-yaw','gun-pitch']){
     const fixed=byId.get(id).voxels.map(c=>box(c,matrices.get(id)));
     for(let a=0;a<moving.length;a++)for(let b=0;b<fixed.length;b++)if(intersects(moving[a],fixed[b])){
      collision={variant,pitch,roll,yaw,gunPitch,fan:r.gimbal,other:id};break outer;
     }
    }
   }
   expect(collision).toBeNull();checked++;
  }
 }
 expect(checked).toBe(216);
});

test('legless aircraft rests in a two-unit pad hover and every neutral lift interval clears the pad',()=>{
 for(const variant of VARIANTS){
  const parts=source.variants[variant].parts,pad=new Set(parts.find(p=>p.id==='pad').voxels.map(key));
  expect(Math.min(...parts.filter(p=>p.id!=='pad').flatMap(p=>p.voxels.map(c=>c[1])))).toBe(DRONE_MODEL.restLowestY);
  expect(DRONE_MODEL.restLowestY-DRONE_MODEL.padDeckY).toBe(DRONE_MODEL.restGap);expect(DRONE_MODEL.restGap).toBe(2);
  // The body contains no landing supports below its original fuselage belly.
  expect(parts.find(p=>p.id==='drone').voxels.every(c=>c[1]>=8)).toBe(true);
  let collision=null;
  for(const part of parts.filter(p=>p.id!=='pad'))for(const c of part.voxels){
   for(let y=c[1];y<c[1]+13;y++)if(pad.has(key([c[0],y,c[2]])))collision={variant,part:part.id,cell:c};
  }
  expect(collision).toBeNull();
 }
 // A full body turn becomes clear at the review hover height regardless of
 // heading: every flying cell is above even the tallest charging cabinet.
 expect(DRONE_MODEL.minimumTurnLift+DRONE_MODEL.restLowestY).toBeGreaterThan(Math.max(...Object.values(DRONE_VARIANTS).map(v=>v.chargingHeight)));
});

test('each stage has two separated slender barrels with frozen exact muzzle centres and one shared receiver',()=>{
 expect(DRONE_MODEL.muzzles).toEqual([[10.5,5,2],[13.5,5,2]]);expect(Object.isFrozen(DRONE_MODEL.muzzles)).toBe(true);
 for(const muzzle of DRONE_MODEL.muzzles)expect(Object.isFrozen(muzzle)).toBe(true);
 for(const variant of VARIANTS){
  const gun=source.variants[variant].parts.find(p=>p.id==='gun-pitch'),cells=new Set(gun.voxels.map(key));
  for(let z=2;z<8;z++)for(let y=4;y<6;y++)for(let x=10;x<14;x++)expect(cells.has(key([x,y,z]))).toBe(x===10||x===13);
  for(let z=8;z<12;z++)for(let y=4;y<6;y++)for(let x=10;x<14;x++)expect(cells.has(key([x,y,z]))).toBe(true);
 }
});

test('gun mechanically aims clear of fork, body and fixed pad through the declared lifted envelope',()=>{
 const yaws=[-15,-10,-5,0,5,10,15],pitches=[-35,-30,-25,-20,-15,-10,-5,0,5,10];let poses=0;
 for(const variant of VARIANTS){
  const parts=source.variants[variant].parts,byId=new Map(parts.map(p=>[p.id,p]));
  for(const yaw of yaws)for(const pitch of pitches){
   const matrices=partMatrices(parts,{'gun-yaw':[0,yaw,0],'gun-pitch':[pitch,0,0]});
   for(const p of parts)if(p.id!=='pad')matrices.get(p.id)[13]+=DRONE_MODEL.minimumAimLift;
   let collision=null;
   for(const id of ['gun-yaw','gun-pitch']){
    const moving=byId.get(id).voxels.map(c=>box(c,matrices.get(id)));
    for(const other of parts.filter(p=>p.id!==id&&!p.id.startsWith('rotor-'))){
     if(id==='gun-yaw'&&other.id==='gun-pitch')continue;
     const fixed=other.voxels.map(c=>box(c,matrices.get(other.id)));
     outer:for(let a=0;a<moving.length;a++)for(let b=0;b<fixed.length;b++)if(intersects(moving[a],fixed[b])){collision={variant,yaw,pitch,id,other:other.id,a:byId.get(id).voxels[a].slice(0,3),b:other.voxels[b].slice(0,3)};break outer;}
     if(collision)break;
    }
    if(collision)break;
   }
   expect(collision).toBeNull();poses++;
  }
 }
 expect(poses).toBe(210);
});

test('compiled meshes and all zone palettes retain finite geometry and exactly 27 total review lights',async()=>{
 const compiled=compileModel(source),turret=await Bun.file('assets/models/turret-study.json').json();
 for(const variant of VARIANTS)for(const p of compiled.variants[variant].parts){
  expect(p.vertices.every(Number.isFinite)).toBe(true);expect(p.indices.length).toBe(p.quads*6);expect(p.quadMaterials.length).toBe(p.quads);
  expect((p.lightQuads??[]).length).toBe(p.id==='pad'?4:p.id==='drone'||p.id.startsWith('fan-')?1:0);
 }
 for(const zone of ['A','B','C','D']){
  const styled=modelForZone(source,zone),reference=modelForZone(turret,zone);expect(styled.materials.map(m=>m.color)).toEqual(reference.materials.map(m=>m.color));
  const entries=VARIANTS.flatMap(variant=>styled.variants[variant].parts.map(p=>({key:`${variant}:${p.id}`,mesh:meshPart(styled,p),transforms:[identity()]})));
  const draws=new Map(entries.map(e=>[e.key,{transforms:identity()}])),lights=new ModelLights(entries,draws);
  lights.prepare();expect(lights.authoredCount).toBe(27);expect(lights.count).toBe(27);expect(lights.overflow).toBe(0);lights.dispose();
 }
});
