import {test,expect} from 'bun:test';
import {productionLayout,productionCoverage} from '../scripts/production-layouts.js';
import {productionLevel} from '../scripts/production-level.js';
import {TerrainField} from '../shared/terrain.js';

test('square production layouts retain generous completely empty deployment ground and distinct routes',()=>{
 const routes=new Set();
 for(const zone of ['A','B','C','D']){
  const layout=productionLayout(zone),level=productionLevel(zone),terrain=new TerrainField(level);
  expect(level.size).toEqual([16,16]);expect(level.path.length).toBeGreaterThan(21);
  routes.add(JSON.stringify(level.path));
  const reserved=new Set(layout.clear.map(([x,z])=>x+','+z)),route=new Set(level.path.map(([x,,z])=>x+','+z));
  expect(reserved.size).toBe(layout.clear.length);expect(reserved.size).toBeGreaterThanOrEqual(40);
  let useful=0,courts=0;
  for(const [x,z] of layout.clear){
   expect(route.has(x+','+z)).toBe(false);expect(terrain.flatBox(x,z)).toBe(24);
   expect(level.placements.some(p=>p.box[0]===x&&p.box[2]===z)).toBe(false);
   // Strictly less than range: a tangent alone is not a useful firing interval.
   if(level.path.some(([px,,pz])=>Math.hypot(x-px,z-pz)<2))useful++;
   if(reserved.has((x+1)+','+z)&&reserved.has(x+','+(z+1))&&reserved.has((x+1)+','+(z+1)))courts++;
  }
  expect(useful).toBeGreaterThanOrEqual(24);expect(courts).toBeGreaterThan(0);
  for(const tower of level.placements.filter(p=>p.model==='turret-study')){
   expect(terrain.flatBox(tower.box[0],tower.box[2])).toBe(24);
   expect(level.path.some(([x,,z])=>Math.hypot(x-tower.box[0],z-tower.box[2])<2)).toBe(true);
  }
  expect(level.environment.weather.enabled).toBe(false);
 }
 expect(routes.size).toBe(4);
});

test('A has a genuine two-pass base pocket, nearby alternatives and a separate later engagement',()=>{
 const layout=productionLayout('A'),level=productionLevel('A'),terrain=new TerrainField(level);
 expect(layout.corners).toEqual([[0,5],[8,5],[8,7],[4,7],[4,11],[15,11]]);
 expect(layout.towers).toEqual([[2,6],[5,6],[9,10]]);
 const open=new Set([...layout.clear,...layout.towers].map(([x,z])=>x+','+z));
 for(const [x,z] of [[2,6],[5,6],[6,6],[7,6],[5,10],[9,10],[13,10]]){
  expect(open.has(x+','+z)).toBe(true);expect(terrain.flatBox(x,z)).toBe(24);
 }
 // A base turret one box from a long straight sees 2*sqrt(r²-offset²).
 // The middle pocket reaches two complete, separate such passes; the early
 // and late alternatives reach only one. Range and speed are not changed.
 const straight=2*Math.sqrt(48**2-24**2);
 for(const [x,z,multiple] of [[2,6,1],[5,6,2],[6,6,2],[9,10,1],[13,10,1]])expect(productionCoverage(level.path,x,z,48)).toBeCloseTo(straight*multiple,8);
 const position=d=>{const i=Math.floor(d/24),a=level.path[i],b=level.path[i+1],t=d/24-i;return [(a[0]+.5+(b[0]-a[0])*t)*24,(a[2]+.5+(b[2]-a[2])*t)*24];};
 const distance=d=>{const [x,z]=position(d);return Math.hypot(x-132,z-156);};
 expect(distance(120)).toBeLessThan(48);expect(distance(312)).toBeLessThan(48);
 expect(distance(204)).toBeGreaterThan(72);expect(distance(228)).toBeGreaterThan(72);
 expect(productionCoverage(level.path,7,6,48)).toBeGreaterThan(straight*2);
 // The later plot cannot cover the return at base or first-upgrade range.
 for(const d of [120,192,240,312]){const [x,z]=position(d);expect(Math.hypot(x-228,z-252)).toBeGreaterThan(72);}
});

function distanceAlong(level,box,distance){
 const i=Math.floor(distance/24),t=distance/24-i,a=level.path[i],b=level.path[i+1];
 return Math.hypot(a[0]+(b[0]-a[0])*t-box[0],a[2]+(b[2]-a[2])*t-box[1])*24;
}
function clearCandidates(zone,boxes){
 const layout=productionLayout(zone),level=productionLevel(zone),terrain=new TerrainField(level);
 const clear=new Set(layout.clear.map(p=>p.join(',')));
 for(const [x,z] of boxes){
  expect(clear.has(x+','+z)).toBe(true);expect(terrain.flatBox(x,z)).toBe(24);
  expect(productionCoverage(level.path,x,z,48)).toBeGreaterThan(0);
 }
 return level;
}

test('B distinguishes a long revisit, a compact continuous turn and a later catch',()=>{
 const level=clearCandidates('B',[[2,5],[5,7],[9,7],[2,12]]);
 expect(distanceAlong(level,[4,7],96)).toBeLessThan(48);
 expect(distanceAlong(level,[4,7],624)).toBeLessThan(48);
 expect(distanceAlong(level,[4,7],300)).toBeGreaterThan(72);
 // The middle upgrade stays in range throughout the turn, not just at endpoints.
 for(let d=341;d<=571;d++)expect(distanceAlong(level,[9,9],d)).toBeLessThan(72);
 expect(distanceAlong(level,[4,12],744)).toBeLessThan(48);
 expect(distanceAlong(level,[4,12],600)).toBeGreaterThan(72);
});

test('C gives base turrets opposite pass choices and requires extra range to reach both',()=>{
 const level=clearCandidates('C',[[7,5],[6,7],[11,7],[13,11]]);
 // Three-box separation has two internal rows. The distant pass is tangent
 // at base range, while the adjacent pass has a real interval on either side.
 expect(distanceAlong(level,[6,5],120)).toBe(24);
 expect(distanceAlong(level,[6,5],384)).toBe(48);
 expect(distanceAlong(level,[7,5],120)).toBe(48);
 expect(distanceAlong(level,[7,5],384)).toBe(24);
 expect(distanceAlong(level,[6,5],384)).toBeLessThan(72);
 expect(distanceAlong(level,[6,5],240)).toBeGreaterThan(72);
 expect(distanceAlong(level,[11,11],672)).toBeLessThan(48);
});

test('D offers a separated revisit and a useful continuous inner-corner alternative',()=>{
 const level=clearCandidates('D',[[8,2],[5,8],[8,8],[3,4]]);
 expect(distanceAlong(level,[8,4],96)).toBeLessThan(48);
 expect(distanceAlong(level,[8,4],528)).toBeLessThan(48);
 expect(distanceAlong(level,[8,4],300)).toBeGreaterThan(72);
 for(let d=271;d<=401;d++)expect(distanceAlong(level,[5,8],d)).toBeLessThan(48);
 expect(distanceAlong(level,[3,2],648)).toBeLessThan(48);
 expect(distanceAlong(level,[3,2],300)).toBeGreaterThan(72);
});
