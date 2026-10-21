import {test,expect} from 'bun:test';
import {DRONE_MODEL as M,DRONE_ROTORS,DRONE_HULL as H,DRONE_VARIANTS} from '../shared/drone-model.js';
import {partMatrices} from '../shared/math.js';

const source=await Bun.file(new URL('../assets/models/drone-defence.json',import.meta.url)).json();
function bounds(part){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const c of part.voxels)for(let a=0;a<3;a++){b[a]=Math.min(b[a],c[a]);b[a+3]=Math.max(b[a+3],c[a]+1);}return b;}

test('level drone vertical hull follows continuous fan/gun limits and authored family heights',()=>{
 const fanReach=1.5+4*Math.SQRT2*M.fanTiltMax,gunBottom=5-Math.cos(-M.gunPitchMin)-7*Math.sin(-M.gunPitchMin),gunTop=6+Math.max(3*Math.sin(-M.gunPitchMin),7*Math.sin(M.gunPitchMax));
 expect(11.5+fanReach-9).toBeLessThan(H.above);expect(9-gunBottom).toBeLessThan(H.below);expect(gunTop).toBeLessThan(8);
 // On [0,35deg], d(-cos(a)-7sin(a))/da is strictly negative.
 expect(Math.tan(-M.gunPitchMin)).toBeLessThan(7);
 expect(5-Math.cos(M.gunPitchMax)-3*Math.sin(M.gunPitchMax)).toBeGreaterThan(gunBottom);
 expect(H.radius).toBe(16.5);expect(H.below).toBe(9);expect(H.above).toBe(6);
 for(const [variant,v]of Object.entries(source.variants)){
  const body=v.parts.find(p=>p.id===M.body),b=bounds(body),gun=bounds(v.parts.find(p=>p.id===M.gunPitch)),fork=bounds(v.parts.find(p=>p.id===M.gunYaw));
  expect(b[4]).toBe(DRONE_VARIANTS[variant].height);expect(b[4]-9).toBeLessThanOrEqual(H.variantAbove[variant]);expect(b[1]).toBeGreaterThanOrEqual(8);
  expect(gun[1]).toBeGreaterThanOrEqual(4);expect(gun[4]).toBeLessThanOrEqual(6);expect(gun[2]).toBeGreaterThanOrEqual(2);expect(gun[5]).toBeLessThanOrEqual(12);expect(fork[1]).toBeGreaterThanOrEqual(5);expect(fork[4]).toBeLessThanOrEqual(8);
  for(const rotor of DRONE_ROTORS){
   const fan=v.parts.find(p=>p.id===rotor.gimbal),cells=v.parts.find(p=>p.id===rotor.id).voxels,fb=bounds(fan),pivot=fan.pivot;
   expect(Math.max(pivot[0]-fb[0],fb[3]-pivot[0],pivot[2]-fb[2],fb[5]-pivot[2])).toBeLessThanOrEqual(4);expect(Math.max(pivot[1]-fb[1],fb[4]-pivot[1])).toBeLessThanOrEqual(1.5);
   for(const c of cells)for(const dx of [0,1])for(const dz of [0,1])expect(Math.hypot(c[0]+dx-pivot[0],c[2]+dz-pivot[2])).toBeLessThanOrEqual(4);
  }
 }
});

test('source part boxes stay inside asymmetric hull over compound fan, rotor and fine gun poses',()=>{
 const observed={};let poses=0;
 for(const [variant,v]of Object.entries(source.variants)){
  const boxes=v.parts.filter(p=>p.id!==M.pad).map(p=>({id:p.id,b:bounds(p)}));let low=Infinity,high=-Infinity,radius=0;
  for(let bearing=0;bearing<360;bearing+=15)for(const magnitude of [0,10,20])for(const yaw of [-15,0,15])for(const pitch of [-35,0,10]){
   const channels={'gun-yaw':[0,yaw,0],'gun-pitch':[pitch,0,0]},a=bearing*Math.PI/180;
   for(let i=0;i<DRONE_ROTORS.length;i++){const rotor=DRONE_ROTORS[i],sign=i%2?1:-1;channels[rotor.gimbal]=[magnitude*Math.cos(a)*sign,0,magnitude*Math.sin(a)*sign];channels[rotor.id]=[0,(bearing*7+i*31)%360,0];}
   const matrices=partMatrices(v.parts,channels);poses++;
   for(const {id,b}of boxes){const m=matrices.get(id);for(let c=0;c<8;c++){const x=b[c&1?3:0],y=b[1+(c&2?3:0)],z=b[2+(c&4?3:0)],wx=m[0]*x+m[4]*y+m[8]*z+m[12]-12,wy=m[1]*x+m[5]*y+m[9]*z+m[13]-9,wz=m[2]*x+m[6]*y+m[10]*z+m[14]-12;low=Math.min(low,wy);high=Math.max(high,wy);radius=Math.max(radius,Math.hypot(wx,wz));}}
  }
  observed[variant]={low,high,radius};expect(low).toBeGreaterThanOrEqual(-H.below);expect(high).toBeLessThanOrEqual(H.variantAbove[variant]);expect(radius).toBeLessThanOrEqual(H.radius);
 }
 expect(poses).toBe(1944);
});

test('neutral base departure retains its existing 11 by 5 box without airborne aiming allowance',()=>{
 for(const part of source.variants.base.parts)if(part.id!==M.pad)for(const cell of part.voxels)for(let c=0;c<8;c++){
  const x=cell[0]+(c&1?1:0)-12,y=cell[1]+(c&2?1:0)-9,z=cell[2]+(c&4?1:0)-12;
  expect(Math.abs(x)).toBeLessThanOrEqual(H.neutralRadius);expect(Math.abs(z)).toBeLessThanOrEqual(H.neutralRadius);expect(y).toBeGreaterThanOrEqual(-H.neutralBelow);expect(y).toBeLessThanOrEqual(H.neutralAbove);
 }
});
