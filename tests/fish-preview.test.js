import {test,expect} from 'bun:test';
import {fishModel} from '../scripts/fish-model.js';
import {validateModel} from '../shared/model.js';
import {newLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
import {FISH_RADIUS} from '../shared/fish-habitat.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {WildlifePreview} from '../game/wildlife-preview.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {ENEMY_STATS} from '../shared/enemy.js';
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../play/engine.js';
import {PLAY_CONFIG} from '../play/config.js';

function fixture({depth=10,split=false,tiny=false}={}){
 const level=newLevel('fish-fixture');level.size=[8,6];level.previewMode='landscape';
 for(let z=1;z<5;z++)for(let x=1;x<7;x++)if((!split||x!==4)&&(!tiny||x===1&&z===1))level.terrain.boxes.push({box:[x,z],ground:12-depth,water:12});
 const world=buildWorld(level,new Map([['wildlife-fish',fishModel()]]),{includeFish:true}),wildlife=new WildlifePreview(world,()=>{},[]);
 return {world,wildlife,fish:wildlife.fish,dispose(){wildlife.dispose();disposeWorld(world);}};
}
function debris(damage,x,z,y=25){
 Object.assign(damage.cubes[0],{active:true,resting:false,waterEntered:false,age:0,restAge:0,x,y,z,vx:0,vy:-35,vz:0,size:2,rx:0,ry:0,rz:0,wx:0,wy:0,wz:0,config:ENEMY_STATS.dog.explosion});damage.activeCubes=1;
}
function run(f,seconds,hz=60,damage=null){for(let n=0;n<seconds*hz;n++){damage?.advance(1/hz);f.wildlife.advance(1/hz);}}

test('fish model is a deterministic matte articulated cosmetic asset',async()=>{
 const model=fishModel();validateModel(model);expect(model).toEqual(await Bun.file('assets/models/wildlife-fish.json').json());
 expect(model.role).toBe('scenery');expect(model.materials.every(m=>m.emission===0&&m.reflectiveness===0)).toBe(true);
 expect(model.variants.base.parts.map(p=>p.id)).toEqual(['body','tail']);expect(model.variants.base.parts[1].parent).toBe('body');
 const f=fixture();expect(f.fish.states).toHaveLength(2);expect(f.fish.states.every(s=>!('health'in s))).toBe(true);f.dispose();
});
test('shallow and isolated water are empty; separate usable pools own separate schools',()=>{
 const shallow=fixture({depth:4});expect(shallow.world.fishHabitat).toBeNull();expect(shallow.fish.states).toHaveLength(0);expect(shallow.fish.events.byteLength).toBe(0);shallow.dispose();
 const tiny=fixture({tiny:true});expect(tiny.fish.states).toHaveLength(0);tiny.dispose();
 const f=fixture({split:true});expect(f.fish.states).toHaveLength(5);expect(f.world.fishHabitat.pools).toHaveLength(2);
 const s=f.fish.states[0],other=f.fish.states.find(a=>a.waterBody!==s.waterBody);
 // Impact on the left bank is close enough to fish across a dry divider,
 // but only water-connected fish may react. Bank nodes need not be swimmable.
 expect(Math.abs(other.x-94)).toBeLessThan(64);expect(f.fish.spookWaterImpact(94,s.surface,other.z,4,64)).toBe(true);run(f,.25);
 expect(f.fish.states.some(a=>a.frightened)).toBe(true);expect(f.fish.states.filter(a=>a.waterBody!==s.waterBody).every(a=>!a.frightened)).toBe(true);f.dispose();
});
test('full rotating fish envelopes stay underwater and inside usable pools throughout roaming',()=>{
 const f=fixture(),field=new TerrainField(f.world.level);
 for(let frame=0;frame<3600;frame++){
  f.wildlife.advance(1/60);
  for(const s of f.fish.states){
   for(const dx of [-FISH_RADIUS,FISH_RADIUS])for(const dz of [-FISH_RADIUS,FISH_RADIUS]){expect(field.height(s.x+dx,s.z+dz,true)).toBe(s.surface);expect(s.y-.3).toBeGreaterThan(field.height(s.x+dx,s.z+dz));}
   for(const instance of s.rig.bones){expect(Array.from(instance.instance.matrix).every(Number.isFinite)).toBe(true);}
   expect(s.y+4.3).toBeLessThan(s.surface);
  }
 }
 expect(f.fish.states.every(s=>s.journeysCompleted>8&&s.travelled>64)).toBe(true);f.dispose();
});
test('actual debris water entries trigger faster outward escapes, then fish return to calm swimming',()=>{
 const f=fixture(),d=new DamageEffects(()=>.5),s=f.fish.states[0],x=s.x-10,z=s.z;d.setWorld(f.world,[]);debris(d,x,z);
 // An explosion event alone belongs to ground/bird wildlife, not fish.
 f.wildlife.spookExplosion(s.x,s.surface,s.z,72);run(f,.1);expect(f.fish.impactCount).toBe(0);expect(s.frightened).toBe(false);
 run(f,.5,60,d);expect(d.waterImpacts.entries).toBe(1);expect(f.fish.impactCount).toBe(1);expect(s.frightened).toBe(true);expect(s.speed).toBe(18);
 const start=Math.hypot(s.x-x,s.z-z);run(f,1,60,d);expect(Math.hypot(s.x-x,s.z-z)).toBeGreaterThan(start);
 run(f,5,60,d);expect(s.frightened).toBe(false);expect(s.speed).toBe(4);expect(f.fish.impactCount).toBe(1);
 d.reset();expect(d.onWaterImpact).toBeNull();f.dispose();
});
test('pause, bounded impact storms, dry contacts, reset and release preserve lifecycle',()=>{
 const f=fixture(),s=f.fish.states[0],d=new DamageEffects(()=>.5);d.setWorld(f.world,[]);
 debris(d,12,12,40);run(f,1,60,d);expect(f.fish.impactCount).toBe(0);
 for(let i=0;i<100;i++)f.fish.spookWaterImpact(s.x,s.surface,s.z,2,40);
 expect(f.fish.events.length).toBe(48);run(f,.2);const before=f.fish.stats();f.wildlife.advance(0);d.advance(0);expect(f.fish.stats()).toEqual(before);
 f.fish.reset();expect(f.fish.impactCount).toBe(0);expect(f.fish.states.every(s=>!s.frightened&&s.travelled===0)).toBe(true);
 d.reset(true);expect(d.onWaterImpact).not.toBeNull();d.reset();expect(d.onWaterImpact).toBeNull();
 f.dispose();expect(f.fish.habitat).toBeNull();expect(f.fish.events.length).toBe(0);expect(f.world.onDebrisWaterImpact).toBeNull();
});
test('a bridge hit before water never frightens fish',()=>{
 const f=fixture(),d=new DamageEffects(()=>.5),s=f.fish.states[0];
 const tree=f.world.visibility;f.world.visibility={nodeCount:1,bounds:new Float32Array([s.x-10,14,s.z-10,s.x+10,16,s.z+10]),escape:new Uint32Array([1])};d.setWorld(f.world,[]);debris(d,s.x,s.z);run(f,1,60,d);
 expect(d.waterImpacts.entries).toBe(0);expect(f.fish.impactCount).toBe(0);f.world.visibility=tree;d.reset();f.dispose();
});
test('actual deep pools load fish, retain them through wave preparation, and keep combat outcomes unchanged',async()=>{
 const native=globalThis.fetch;globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(`assets/${kind}/${id}.json`).json()})};};
 try{
  for(const index of [1,3,7,8,11,14]){
   const level=PLAY_CONFIG.levels[index],world=await loadPlayWorld(level.id,{wave:level.waves[0]}),engine=new PlayEngine(world,{config:PLAY_CONFIG,wave:level.waves[0]}),states=engine.wildlife.fish.states;
   expect(states.length).toBe(2);engine.startWave();
   for(let i=0;i<360;i++)engine.advance(1/30);
   expect(states.every(s=>s.journeysCompleted>1)).toBe(true);expect(engine.enemies.states.every(s=>!s.id.startsWith('wildlife-'))).toBe(true);
   while(engine.running)engine.advance(1/30);
   expect(engine.enemies.escaped).toBe(level.waves[0].spawns.length);expect(engine.enemies.killed).toBe(0);
   const first=states[0],travel=first.travelled;engine.prepareWave(level.waves[1]);expect(engine.wildlife.fish.states[0]).toBe(first);expect(first.travelled).toBe(travel);
   engine.dispose();disposePlayWorld(world);
  }
 }finally{globalThis.fetch=native;}
},30000);
