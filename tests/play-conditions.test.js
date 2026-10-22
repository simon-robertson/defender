import {test,expect} from 'bun:test';
import {LevelConditions,applyPlayLighting,PLAY_NIGHT_LIGHTING,PLAY_DAYLIGHT,PLAY_AFTERNOON_SUN_SCALE,PLAY_EVENING_LIGHT_ELEVATION} from '../play/conditions.js';
import {levelLighting} from '../engine/environment.js';
import {composePlayLevel,loadPlayWorld,disposePlayWorld,PlayEngine} from '../play/engine.js';
import {PLAY_CONFIG} from '../play/config.js';

test('each zone retains stable authored daylight without random draws',()=>{
 const random=Math.random;Math.random=()=>{throw new Error('Level conditions must not draw randomness.');};
 try{
  const choices=new LevelConditions();
  for(const level of PLAY_CONFIG.levels){
   const condition=choices.forLevel(level.id);expect(condition).toEqual(PLAY_DAYLIGHT[Number(level.id.slice(-2))-1]);expect(Object.isFrozen(condition)).toBe(true);
   for(const wave of level.waves)expect(choices.forLevel(level.id)).toBe(condition);
  }
  choices.reset();expect(choices.forLevel(PLAY_CONFIG.levels[0].id)).toEqual(PLAY_DAYLIGHT[0]);
 }finally{Math.random=random;}
});

test('real A2 runtime retains selected lighting across wave preparation and deployments',async()=>{
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};
 try{for(const conditions of PLAY_DAYLIGHT){
  const world=await loadPlayWorld('moss-02',{wave:PLAY_CONFIG.levels[1].waves[0],conditions}),engine=new PlayEngine(world,{});
  try{
   expect(world.playConditions).toEqual(conditions);expect(world.level.environment.timeOfDay).toBe(conditions.timeOfDay);
   engine.prepareWave(PLAY_CONFIG.levels[1].waves[1]);engine.updateDeployments([]);engine.advance(.5,{combat:false});
   expect(world.playConditions).toEqual(conditions);expect(world.level.environment.timeOfDay).toBe(conditions.timeOfDay);
  }finally{engine.dispose();disposePlayWorld(world);expect(world.playConditions).toBeNull();}
 }}finally{globalThis.fetch=nativeFetch;}
},15000);

test('play time-of-day overrides are cloned and do not rewrite saved lighting',async()=>{
 const source=await Bun.file(new URL('../assets/levels/moss-01.json',import.meta.url)).json(),before=JSON.stringify(source);
 for(const conditions of PLAY_DAYLIGHT){const level=composePlayLevel(source,[],{conditions});expect(level.environment.timeOfDay).toBe(conditions.timeOfDay);expect(level.environment.sky).toEqual(source.environment.sky);}
 expect(JSON.stringify(source)).toBe(before);
});

test('all four late-afternoon levels brighten direct sunlight without compounding or changing its angle/ambient fill',async()=>{
 for(const prefix of ['moss','ochre','ice','plum']){
  const source=await Bun.file(new URL(`../assets/levels/${prefix}-02.json`,import.meta.url)).json(),before=JSON.stringify(source);
  const level=composePlayLevel(source,[],{conditions:PLAY_DAYLIGHT[1]}),baseline=levelLighting(level.environment);
  const renderer={world:{level},setLighting(sky){this.sky=sky;},setLightingColors(color,ambient){this.colors=[color,ambient];}};
  for(let retry=0;retry<3;retry++){
   applyPlayLighting(renderer,PLAY_DAYLIGHT[1]);
   expect(renderer.sky.intensity).toBeCloseTo(baseline.intensity*PLAY_AFTERNOON_SUN_SCALE,12);
   expect(renderer.sky.direction).toEqual(baseline.direction);expect(renderer.sky.ambientIntensity).toBe(baseline.ambientIntensity);
   expect(renderer.colors).toEqual(['#FFD4A2','#C7C8B5']);
  }
  expect(JSON.stringify(source)).toBe(before);
 }
});


test('third levels use a low night key light while preserving evening ambient and authored sources',async()=>{
 for(const prefix of ['moss','ochre','ice','plum']){
  const source=await Bun.file(new URL(`../assets/levels/${prefix}-03.json`,import.meta.url)).json(),before=JSON.stringify(source);
  const capture=conditions=>{
   const renderer={world:{level:composePlayLevel(source,[],{conditions})},setLighting(sky){this.sky=sky;},setLightingColors(color,ambient){this.colors=[color,ambient];}};
   applyPlayLighting(renderer,conditions);return renderer;
  };
  const evening=capture(PLAY_DAYLIGHT[2]),night=capture(PLAY_DAYLIGHT[3]),dir=evening.sky.direction,heading=source.environment.sky.direction;
  expect(evening.sky.color).toBe(night.colors[0]);expect(evening.sky.intensity).toBe(night.sky.intensity);
  expect(Math.atan2(dir[1],Math.hypot(dir[0],dir[2]))*180/Math.PI).toBeCloseTo(PLAY_EVENING_LIGHT_ELEVATION,10);
  expect(dir[0]).toBe(heading[0]);expect(dir[2]).toBe(heading[2]);expect(dir[1]).toBeGreaterThan(0);
  expect(Math.atan2(dir[1],Math.hypot(dir[0],dir[2]))).toBeLessThan(Math.atan2(night.sky.direction[1],Math.hypot(night.sky.direction[0],night.sky.direction[2])));
  expect(evening.sky.ambient).toBe('#8493B4');expect(evening.sky.ambientIntensity).toBe(.42);
  applyPlayLighting(evening,PLAY_DAYLIGHT[2]);expect(evening.sky).toEqual(capture(PLAY_DAYLIGHT[2]).sky);
  expect(JSON.stringify(source)).toBe(before);
 }
});


test('night shadow projection is one quarter as long on every fourth level without changing heading or ambient',async()=>{
 for(const prefix of ['moss','ochre','ice','plum']){
  const level=await Bun.file(new URL(`../assets/levels/${prefix}-04.json`,import.meta.url)).json(),before=JSON.stringify(level),original=level.environment.sky.direction;
  const renderer={world:{level},setLighting(sky){this.sky=sky;},setLightingColors(...colors){this.colors=colors;}};
  for(let retry=0;retry<3;retry++){
   applyPlayLighting(renderer,PLAY_DAYLIGHT[3]);const d=renderer.sky.direction;
   expect(Math.hypot(d[0],d[2])/d[1]).toBeCloseTo(Math.hypot(original[0],original[2])/original[1]*.25,12);
   expect(d[0]).toBe(original[0]);expect(d[2]).toBe(original[2]);expect(renderer.sky.intensity).toBe(.65);expect(renderer.sky.ambientIntensity).toBe(.85);
   expect(renderer.colors).toEqual([PLAY_NIGHT_LIGHTING.color,PLAY_NIGHT_LIGHTING.ambient,PLAY_NIGHT_LIGHTING.ambient]);
  }
  expect(JSON.stringify(level)).toBe(before);
 }
});
