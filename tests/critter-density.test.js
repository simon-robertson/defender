import {test,expect} from 'bun:test';
import {PLAY_CONFIG} from '../play/config.js';
import {composePlayLevel} from '../play/engine.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {wildlifeActorsForLevel,WildlifePreview} from '../game/wildlife-preview.js';
import {hasFishWater,FISH_MODEL} from '../shared/fish-habitat.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {MAX_CRITTERS,CRITTER_FRAGMENTS,CRITTER_SPRAY} from '../shared/damage-effects.js';
import {pathBoxUnion} from '../shared/routes.js';
const library=new Map();

test('all sixteen levels double land wildlife with separated supported routeside seeds and safe gib/respawn',async()=>{
 const rows=[];
 for(const {id} of PLAY_CONFIG.levels){
  const source=await Bun.file(`assets/levels/${id}.json`).json(),level=composePlayLevel(source),actors=wildlifeActorsForLevel(level);
  expect(actors.filter(a=>a.kind==='ground')).toHaveLength(9);expect(actors.filter(a=>a.kind==='bird')).toHaveLength(3);
  for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model),...(hasFishWater(level)?[FISH_MODEL]:[])]))if(!library.has(id))library.set(id,await Bun.file(`assets/models/${id}.json`).json());
  const world=buildWorld(level,library,{actors,includeFish:true}),wildlife=new WildlifePreview(world,()=>{},actors),damage=new DamageEffects(()=>.5);damage.setWorld(world,[]);
  try{
   const ground=wildlife.states.filter(s=>s.kind==='ground'),paths=pathBoxUnion(level);
   for(let i=0;i<ground.length;i++){
    const s=ground[i],nav=wildlife.nav;expect(nav.offPath[s.node]).toBe(1);expect(nav.heights[s.node]).toBe(s.y);
    const component=nav.component[s.node];expect(nav.starts[component+1]-nav.starts[component]).toBeGreaterThanOrEqual(64);
    for(const other of ground.slice(i+1))expect(Math.hypot(s.x-other.x,s.z-other.z)).toBeGreaterThanOrEqual(s.radius+other.radius+2-1e-6);
   }
   const extra=ground.slice(3),near=extra.filter(s=>paths.some(([x,,z])=>Math.hypot(s.x-(x+.5)*24,s.z-(z+.5)*24)<=48)).length;
   expect(near).toBeGreaterThanOrEqual(4);
   const total=wildlife.states.length+wildlife.fish.states.length;expect(total).toBeLessThanOrEqual(MAX_CRITTERS);
   expect(wildlife.gibExplosion(0,0,0,10000,damage)).toBe(total);expect(damage.activeCubes).toBe(total*(CRITTER_FRAGMENTS+CRITTER_SPRAY));expect(damage.droppedCritterCubes).toBe(0);
   wildlife.prepareCritterRun();expect(wildlife.states.every(s=>!s.dead)).toBe(true);expect(wildlife.fish.states.every(s=>!s.dead)).toBe(true);
   const states=wildlife.states.slice();for(let i=0;i<180;i++)wildlife.advance(1/30);
   expect(states.some(s=>s.travelled>0)).toBe(true);expect(wildlife.states.every(s=>Number.isFinite(s.x+s.y+s.z))).toBe(true);
   rows.push({id,ground:ground.length,birds:3,fish:wildlife.fish.states.length,additionalNearRoute:near});
  }finally{damage.reset();wildlife.dispose();disposeWorld(world);}
 }
 console.log(JSON.stringify({densitySurvey:rows}));
},60000);
