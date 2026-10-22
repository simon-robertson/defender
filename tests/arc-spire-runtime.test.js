// Routed combat asset requests explicitly read the archived preview sources.
import {test,expect} from 'bun:test';
import {loadWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {TurretPreview} from '../game/turret-preview.js';
import {DEFENCE_STATS} from '../shared/defence.js';

test('Arc Spire studies load only their actors, preserve movement, and keep wildlife clear of defence geometry',async()=>{
 const originalFetch=globalThis.fetch;
 try{
  for(const [prefix,enemy]of [['moss','dog'],['ochre','walker'],['ice',null],['plum','spider']]){
   const id=prefix+'-02',requests=[];
   globalThis.fetch=async url=>{
    requests.push(url);
    const [,kind,key]=/^\/api\/(models|levels)\/([\w-]+)$/.exec(url);
    return Response.json({asset:await Bun.file(new URL(kind==='levels'?`../docs/landscape-reset-2026-10-18/previous-levels/${key}.json`:`../assets/${kind}/${key}.json`,import.meta.url)).json()});
   };
   const roster=previewActorsForLevel(id),cosmetics=wildlifeActorsForLevel(id);
   expect(roster).toBe(previewActorsForLevel(prefix+'-01'));
   expect(cosmetics).toBe(wildlifeActorsForLevel(prefix+'-01'));
   const world=await loadWorld(id,{actors:[...roster,...cosmetics]});
   const enemies=new EnemyPreview(world,()=>{}),wildlife=new WildlifePreview(world,()=>{});
   const turrets=new TurretPreview(world,()=>{},()=>.5,null,enemies.states.length?enemies.states:null);
   wildlife.setThreatSources(enemies.states);
   try{
    expect(world.assetIds.includes('arc-spire')).toBe(true);
    expect(world.assetIds.includes('turret-study')).toBe(false);
    for(const candidate of ['dog','walker','spider'])expect(world.assetIds.includes(candidate)).toBe(candidate===enemy);
    expect(requests.filter(url=>url.startsWith('/api/models/')).length).toBe(new Set(world.assetIds).size);

    expect(enemies.states).toHaveLength(roster.length);expect(wildlife.states).toHaveLength(6);
    expect(DEFENCE_STATS['arc-spire'].base.strength).toBeGreaterThan(0);expect(turrets.states).toHaveLength(0);
    const defences=[...world.rigs.values()].filter(r=>r.role==='defence');
    expect(defences).toHaveLength(3);expect(wildlife.defences).toHaveLength(18);
    expect(defences.map(r=>r.variant)).toEqual(['base','upgrade1','upgrade2']);
    for(let i=0;i<3;i++)expect(wildlife.defences[i*6+4]).toBe(24+[32,42,54][i]);
    const initial=enemies.states.map(s=>s.distance);
    // Many destination changes expose clearance errors beyond valid spawn seeds.
    for(let frame=0;frame<1800;frame++){
     enemies.advance(1/30);wildlife.advance(1/30);turrets.advance(1/30);
     for(const state of wildlife.states){
      const a=[state.x-state.radius,state.y,state.z-state.radius,state.x+state.radius,state.y+state.height,state.z+state.radius];
      for(let i=0;i<wildlife.defences.length;i+=6){
       const b=wildlife.defences;
       const overlap=a[0]<b[i+3]-1e-6&&a[3]>b[i]+1e-6&&a[1]<b[i+4]-1e-6&&a[4]>b[i+1]+1e-6&&a[2]<b[i+5]-1e-6&&a[5]>b[i+2]+1e-6;
       expect(overlap).toBe(false);
      }
     }
    }
    for(let i=0;i<enemies.states.length;i++){
     expect(enemies.states[i].distance).not.toBe(initial[i]);
     expect(enemies.states[i].health.current).toBe(enemies.states[i].health.maximum);
    }
    expect(turrets.shots).toBe(0);expect(wildlife.thinkCount).toBe(1800);
   }finally{turrets.dispose();wildlife.dispose();enemies.dispose();disposeWorld(world);}
   expect(world.rigs.size).toBe(0);expect(world.actors.size).toBe(0);expect(wildlife.states).toHaveLength(0);
  }
  expect(previewActorsForLevel('moss-99')).toHaveLength(0);expect(wildlifeActorsForLevel('moss-99')).toHaveLength(0);
 }finally{globalThis.fetch=originalFetch;}
},30000);
