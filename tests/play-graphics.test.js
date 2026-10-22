import {test,expect} from 'bun:test';
import {GRAPHICS_DEFAULTS,GRAPHICS_STORAGE_KEY,graphicsOptions,loadGraphicsOptions,saveGraphicsOptions} from '../play/graphics-options.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine} from '../play/engine.js';
import {createPlacementRules} from '../play/placement.js';
import {PLAY_CONFIG} from '../play/config.js';
import {FISH_MODEL} from '../shared/fish-habitat.js';

test('graphics default on, restore only valid booleans and tolerate unavailable preferences',()=>{
 expect(loadGraphicsOptions({getItem:()=>null})).toEqual(GRAPHICS_DEFAULTS);
 expect(loadGraphicsOptions({getItem:()=>'{broken'})).toEqual(GRAPHICS_DEFAULTS);
 expect(loadGraphicsOptions({getItem(){throw new Error('Storage blocked');}})).toEqual(GRAPHICS_DEFAULTS);
 expect(graphicsOptions({critters:false,reflections:'false',bloom:null,extra:false})).toEqual({critters:false,reflections:true,bloom:true});
 expect(loadGraphicsOptions({getItem:()=>'{"critters":false,"reflections":true,"bloom":false}'})).toEqual({critters:false,reflections:true,bloom:false});
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const selected={critters:false,reflections:false,bloom:false};saveGraphicsOptions(selected,storage);
 expect(values.has(GRAPHICS_STORAGE_KEY)).toBe(true);expect(loadGraphicsOptions(storage)).toEqual(selected);
 expect(()=>saveGraphicsOptions(selected,{setItem(){throw new Error('Storage blocked');}})).not.toThrow();
 expect(GRAPHICS_DEFAULTS).toEqual({critters:true,reflections:true,bloom:true});
});

test('critters off omits all wildlife assets, fish, navigation and ticks while combat/deployment remain usable',async()=>{
 const nativeFetch=globalThis.fetch,requests=[];
 globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);requests.push(id);return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};
 let world,engine,rules;
 try{
  const level=PLAY_CONFIG.levels[1];world=await loadPlayWorld(level.id,{wave:level.waves[0],critters:false,wildlifePoints:[]});
  expect(world.playCritters).toBe(false);expect(requests.some(id=>id.startsWith('wildlife-'))).toBe(false);
  expect(world.playModels.has(FISH_MODEL)).toBe(false);expect(world.fishActors).toEqual([]);expect(world.fishHabitat).toBeNull();
  expect([...world.actors.keys()].some(id=>id.startsWith('wildlife-'))).toBe(false);
  expect(world.level.previewWildlife).toEqual(world.playSource.previewWildlife);
  engine=new PlayEngine(world);expect(engine.wildlife.states).toEqual([]);expect(engine.wildlife.fish.states).toEqual([]);expect(engine.wildlife.nav).toBeNull();expect(engine.wildlife.planningBytes).toBe(0);expect(world.onDebrisWaterImpact).toBeNull();
  engine.wildlife.advance=()=>{throw new Error('Disabled wildlife must not tick');};
  rules=createPlacementRules(world.playSource,world.playModels,{config:PLAY_CONFIG,critters:false});expect(rules.prepare([])).toMatchObject({valid:true,wildlifePoints:[]});
  expect(engine.updateDeployments([])).toEqual({valid:true});engine.prepareWave(level.waves[1]);engine.advance(.1,{combat:false});
  expect(engine.startWave()).toBe(true);engine.advance(.1);expect(engine.enemies.spawned).toBeGreaterThan(0);
  engine.dispose();engine=null;disposePlayWorld(world);world=null;rules.dispose();rules=null;requests.length=0;
  world=await loadPlayWorld(level.id,{wave:level.waves[0]});engine=new PlayEngine(world);
  expect(world.playCritters).toBe(true);expect(engine.wildlife.states).toHaveLength(9);expect(engine.wildlife.fish.states.length).toBeGreaterThan(0);expect(requests).toContain(FISH_MODEL);expect(engine.wildlife.planningBytes).toBeGreaterThan(0);
 }finally{rules?.dispose();engine?.dispose();disposePlayWorld(world);globalThis.fetch=nativeFetch;}
},10000);
