import {test,expect} from 'bun:test';
import {WaterImpacts} from '../engine/water-impact.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {ENEMY_STATS} from '../shared/enemy.js';
import {MAX_WATER_IMPACTS,MAX_WATER_DROPS,MAX_WATER_PARTICLES,WATER_RIPPLE_FLOATS} from '../shared/water-impact.js';
import {MAX_DAMAGE_PARTICLES} from '../shared/damage-effects.js';
function world(bridge=false){
 const bounds=bridge?[-100,0,-100,100,1,100,0,12,0,24,14,24]:[-100,0,-100,100,1,100];
 return {level:{size:[3,3],terrain:{boxes:[{box:[0,0],ground:1,water:10},{box:[1,0],ground:1,water:10}]}},visibility:{bounds:new Float32Array(bounds),escape:new Uint32Array(bridge?[1,2]:[1]),nodeCount:bridge?2:1}};
}
function cube(damage,{x=12,y=22,z=12,vy=-40}={}){const p=damage.cubes[0];Object.assign(p,{active:true,resting:false,waterEntered:false,age:0,restAge:0,x,y,z,vx:3,vy,vz:2,size:2,rx:0,ry:0,rz:0,wx:1,wy:1,wz:1,config:ENEMY_STATS.dog.explosion});damage.activeCubes=1;return p;}

test('water surface queries span neighbouring cells and exclude dry or upward crossings',()=>{
 const w=new WaterImpacts(()=>.5);w.setWorld(world());expect(w.height(25,12)).toBe(10);expect(w.height(12,25)).toBe(0);expect(w.height(-1,12)).toBe(0);
 expect(w.crossing(12,20,12,0,-20,0,1)).toBe(true);expect([...w.contact.slice(0,4)]).toEqual([.45,12,10,12]);
 expect(w.crossing(12,20,36,0,-20,0,1)).toBe(false);expect(w.crossing(12,5,12,0,20,0,1)).toBe(false);expect(w.crossing(12,20,12,0,-20,0,1,.4)).toBe(false);
});
test('real debris crosses water once, transfers momentum and sinks without smoke, light or solid bounce',()=>{
 const d=new DamageEffects(()=>.5);d.setWorld(world(),[]);const p=cube(d);for(let i=0;i<30;i++)d.advance(1/120);
 expect(d.waterImpacts.entries).toBe(1);expect(p.waterEntered).toBe(true);expect(Math.abs(p.vy)).toBeLessThan(25);expect(p.vx).toBeLessThan(2);expect(p.y).toBeLessThan(12);
 d.prepare();expect(d.waterParticleCount).toBeGreaterThan(0);expect(d.smokeCount).toBe(0);expect(d.blastCount).toBe(0);expect(d.lightCount).toBe(0);
 for(let i=0;i<600;i++)d.advance(1/120);d.prepare();expect(d.waterImpacts.entries).toBe(1);expect(d.waterImpacts.count).toBe(0);expect(d.waterImpacts.activeDrops).toBe(0);expect(d.waterParticleCount).toBe(0);
});
test('solid bridges win over underlying water and dry impacts create no splash',()=>{
 const d=new DamageEffects(()=>.5);d.setWorld(world(true),[]);cube(d);for(let i=0;i<180;i++)d.advance(1/120);expect(d.waterImpacts.entries).toBe(0);
 d.setWorld(world(),[]);cube(d,{z:36});for(let i=0;i<120;i++)d.advance(1/120);expect(d.waterImpacts.entries).toBe(0);
});
test('droplets have a ballistic apex, descending velocity and finite water contact lifetime',()=>{
 const w=new WaterImpacts(()=>.5);w.setWorld(world());w.impact(12,10,12,1.4,28);const p=w.drops[0],vy=p.vy,y=p.y;
 w.advance(.15);expect(p.active).toBe(true);expect(p.y).toBeGreaterThan(y);expect(p.vy).toBeLessThan(vy);w.advance(.3);expect(p.active).toBe(true);expect(p.vy).toBeLessThan(0);
 w.advance(1);expect(w.activeDrops).toBe(0);expect(w.drops.every(p=>!p.active)).toBe(true);
});
test('larger faster debris creates a stronger bounded disturbance and event exhaustion is explicit',()=>{
 const w=new WaterImpacts(()=>.5);w.setWorld(world());w.impact(12,10,12,1,12);w.impact(12,10,12,2,50);expect(w.impacts[1].power).toBeGreaterThan(w.impacts[0].power);
 for(let i=0;i<100;i++)w.impact(12,10,12,2,80);expect(w.count).toBe(MAX_WATER_IMPACTS);expect(w.activeDrops).toBe(MAX_WATER_DROPS);expect(w.droppedImpacts).toBeGreaterThan(0);expect(w.droppedDrops).toBeGreaterThan(0);
 w.advance(.15);let emitted=0;w.prepare(()=>emitted++);expect(emitted).toBeLessThanOrEqual(MAX_WATER_PARTICLES);expect(w.particleCount).toBe(emitted);expect(MAX_DAMAGE_PARTICLES).toBeGreaterThan(emitted);
});
test('water clocks pause exactly, reset retains optional bindings and disposal drops level references',()=>{
 const d=new DamageEffects(()=>.5);d.setWorld(world(),[]);d.waterImpacts.impact(12,10,12,1.4,28);d.advance(.1);const before=d.waterImpacts.impacts[0].age;d.advance(0);expect(d.waterImpacts.impacts[0].age).toBe(before);
 const grid=d.waterImpacts.heights;d.reset(true);expect(d.waterImpacts.heights).toBe(grid);expect(d.waterImpacts.count).toBe(0);d.reset();expect(d.waterImpacts.heights).toBeNull();expect(d.waterImpacts.visibility).toBeNull();
 d.setWorld({visibility:world().visibility},[]);expect(d.waterImpacts.heights).toBeNull();
 const dry=new DamageEffects();dry.setWorld({visibility:world().visibility},[]);expect(dry.waterImpacts).toBeNull();
});
test('impact rings have a visible refractive shoulder and fade while expanding in the retained buffer',()=>{
 const w=new WaterImpacts(()=>.5),packed=new Float32Array(WATER_RIPPLE_FLOATS);w.setWorld(world());w.ripple(12,10,12,1,true);w.advance(.2);
 expect(w.writeRipples(packed)).toBe(1);expect(Array.from(packed.slice(4,7))).toEqual([12,10,12]);
 // Evaluate a crest shoulder from the coefficients sent to the water shader.
 const q=Math.PI/6,gradient=Math.exp(-q*q*.5)*(-q*Math.cos(q*3)-3*Math.sin(q*3)),slope=Math.min(.4,Math.abs(gradient*packed[10]));
 expect(slope).toBeGreaterThan(.35);
 let opacity=0;w.prepare((_x,_y,_z,_r,_red,_green,_blue,alpha,kind)=>{if(kind===2)opacity=alpha;});expect(opacity).toBeGreaterThan(.18);
 const before=packed.slice(),radius=packed[8],strength=packed[10];w.advance(0);w.writeRipples(packed);expect(packed).toEqual(before);
 w.advance(.4);w.writeRipples(packed);expect(packed[8]).toBeGreaterThan(radius);expect(packed[10]).toBeLessThan(strength);
 w.advance(3);expect(w.writeRipples(packed)).toBe(0);expect(packed[0]).toBe(0);
});
test('surface crossing remains single and downward at30/60/120Hz including a long frame',()=>{
 for(const hz of [30,60,120]){const d=new DamageEffects(()=>.5);d.setWorld(world(),[]);const p=cube(d);for(let i=0;i<hz/2;i++)d.advance(1/hz);expect(d.waterImpacts.entries).toBe(1);expect(p.waterEntered).toBe(true);expect(p.y).toBeGreaterThan(1);}
 const d=new DamageEffects(()=>.5);d.setWorld(world(),[]);cube(d);d.advance(1);expect(d.waterImpacts.entries).toBe(1);
});
