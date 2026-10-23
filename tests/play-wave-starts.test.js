import {test,expect} from 'bun:test';
import {PLAY_CONFIG,PLAY_ROUTE_IDS} from '../play/config.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine} from '../play/engine.js';

test('native finite waves activate both entrances in the same start call across all multi-route levels',async()=>{
 const native=globalThis.fetch;
 globalThis.fetch=async url=>{
  const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);
  return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};
 };
 try{
  for(const level of PLAY_CONFIG.levels.filter(level=>PLAY_ROUTE_IDS[level.id].length>1)){
   let world,engine;const visible=[];
   try{
    world=await loadPlayWorld(level.id,{wave:level.waves[0],critters:false});
    engine=new PlayEngine(world,{wave:level.waves[0],onVisible:(id,active)=>{if(active)visible.push(id);}});
    for(const wave of level.waves){
     engine.prepareWave(wave);visible.length=0;
     expect(engine.startWave()).toBe(true);
     expect(engine.waveTime).toBe(0);
     expect(engine.enemies.activeTargets.map(state=>state.id)).toEqual(wave.spawns.filter(spawn=>spawn.at===0).map(spawn=>spawn.id));
     expect(visible).toEqual(engine.enemies.activeTargets.map(state=>state.id));
     expect(new Set(engine.enemies.activeTargets.map(state=>state.routeId))).toEqual(new Set(PLAY_ROUTE_IDS[level.id]));
     expect(engine.enemies.activeTargets.every(state=>state.time===0&&state.distance===0)).toBe(true);
     engine.stopWave();
    }
   }finally{engine?.dispose();disposePlayWorld(world);}
  }
 }finally{globalThis.fetch=native;}
},30000);
