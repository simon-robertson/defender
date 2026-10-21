import {test,expect} from 'bun:test';
import {hasZoneVista,zoneAVistaGeometry,zoneVistaGeometry} from '../engine/zone-vista.js';
import {biomeVistaGeometry} from '../engine/vista-geometry.js';

test('Detailed A–D vistas are deterministic, distinct, finite and bounded below gameplay',()=>{
 const fingerprints=new Set();
 for(const zone of ['A','B','C','D']){
  const a=biomeVistaGeometry(zone),hash=new Bun.CryptoHasher('sha256').update(a).digest('hex');
  expect(hash).toBe(new Bun.CryptoHasher('sha256').update(biomeVistaGeometry(zone)).digest('hex'));
  expect(a.byteLength).toBeLessThan(24*1024*1024);expect(a.length%18).toBe(0);expect(a.length/6).toBeGreaterThan(50000);
  let highest=-Infinity,lowest=Infinity,finite=true,minColor=Infinity,maxColor=-Infinity,minArea=Infinity;
  for(let i=0;i<a.length;i+=6){
   finite&&=Number.isFinite(a[i]+a[i+1]+a[i+2]);highest=Math.max(highest,a[i+1]);lowest=Math.min(lowest,a[i+1]);
   for(let c=3;c<6;c++){finite&&=Number.isFinite(a[i+c]);minColor=Math.min(minColor,a[i+c]);maxColor=Math.max(maxColor,a[i+c]);}
  }
  for(let i=0;i<a.length;i+=18){
   const ux=a[i+6]-a[i],uy=a[i+7]-a[i+1],uz=a[i+8]-a[i+2],vx=a[i+12]-a[i],vy=a[i+13]-a[i+1],vz=a[i+14]-a[i+2];
   minArea=Math.min(minArea,Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx));
  }
  expect(finite).toBe(true);expect(highest).toBeLessThan(-150);expect(lowest).toBeGreaterThan(-700);
  expect(minColor).toBeGreaterThanOrEqual(0);expect(maxColor).toBeLessThan(.4);expect(minArea).toBeGreaterThan(.01);
  fingerprints.add(hash);
 }
 expect(fingerprints.size).toBe(4);expect(()=>biomeVistaGeometry('E')).toThrow('Unsupported vista biome');
});

test('All detailed vistas retain centered geometry when the battlefield dimensions change',()=>{
 for(const zone of ['A','B','C','D']){
  const a=biomeVistaGeometry(zone),b=biomeVistaGeometry(zone,528,432);let error=0;
  expect(a.length).toBe(b.length);
  for(let i=0;i<a.length;i+=6){
   error=Math.max(error,Math.abs(b[i]-a[i]-24),Math.abs(b[i+2]-a[i+2]-24),Math.abs(b[i+1]-a[i+1]));
   for(let c=3;c<6;c++)error=Math.max(error,Math.abs(b[i+c]-a[i+c]));
  }
  expect(error).toBeLessThan(.001);
 }
});

test('All sixteen production landscapes enable only their matching biome',()=>{
 for(const [zone,prefix]of [['A','moss'],['B','ochre'],['C','ice'],['D','plum']])for(let i=1;i<=4;i++)expect(hasZoneVista({zone,id:prefix+'-0'+i})).toBe(true);
 for(const [zone,id]of [['A','render-test'],['B','moss-01'],['C','ice-05'],['D','plum-00'],['E','moss-01']])expect(hasZoneVista({zone,id})).toBe(false);
});

test('Production dispatch and the Zone A compatibility entry use the detailed geometry',()=>{
 for(const zone of ['A','B','C','D'])expect(zoneVistaGeometry(zone)).toEqual(biomeVistaGeometry(zone));
 expect(zoneAVistaGeometry()).toEqual(biomeVistaGeometry('A'));expect(()=>zoneVistaGeometry('E')).toThrow('Unsupported vista biome');
});

test('the all-zone rollout retains the reviewed Zone A geometry exactly',()=>{
 expect(new Bun.CryptoHasher('sha256').update(biomeVistaGeometry('A')).digest('hex')).toBe('b948574f6b796a39c99b824891e2e03f8a121ed067fe8a0d74a435db352b4f2a');
});
