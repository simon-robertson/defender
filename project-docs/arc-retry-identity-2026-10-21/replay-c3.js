// Isolated C3 snapshots from Tactician's earned-token Arc portfolio.
// Run from root: bun docs/arc-retry-identity-2026-10-21/replay-c3.js
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PLAY_CONFIG} from '../../play/config.js';
import {PlayEngine,loadPlayWorld,disposePlayWorld} from '../../play/engine.js';
import {createPlacementRules} from '../../play/placement.js';
import {wildlifeActorsForLevel} from '../../game/wildlife-preview.js';

const ROOT=new URL('../../',import.meta.url),baseline=process.argv.includes('--baseline');
const witness=await Bun.file(new URL('../balance-review-2026-10-21/arc-heavy.json',import.meta.url)).json();
const hash=async path=>createHash('sha256').update(await Bun.file(new URL(path,ROOT)).text()).digest('hex');
const arcPath='game/arc-spire-preview.js',sourceHashes={};
for(const [path,previous]of Object.entries(witness.sourceHashes)){
 const actual=await hash(path);sourceHashes[path]=actual;
 if(path!==arcPath)assert.equal(actual,previous,'Other audited combat inputs must stay fixed: '+path);
}
if(baseline)assert.equal(globalThis.defenderArcBaselineHash,witness.sourceHashes[arcPath]);
const nativeFetch=globalThis.fetch,cache=new Map(),waves=[];
async function asset(kind,id){
 const key=kind+'/'+id;if(!cache.has(key))cache.set(key,await Bun.file(new URL('assets/'+key+'.json',ROOT)).json());
 return structuredClone(cache.get(key));
}
globalThis.fetch=async url=>{
 const match=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(String(url));assert(match);
 return {ok:true,json:async()=>({asset:await asset(match[1],match[2])})};
};
try{
 const level=PLAY_CONFIG.levels.find(level=>level.id==='ice-03'),source=await asset('levels',level.id);
 for(const wave of level.waves){
  const recorded=witness.results[0].waves.find(entry=>entry.wave===wave.id);assert(recorded);
  const placements=structuredClone(recorded.placements),ids=new Set([...source.placements.map(p=>p.model),...Object.keys(PLAY_CONFIG.defences),...wildlifeActorsForLevel(source).map(actor=>actor.model)]);
  const models=new Map(await Promise.all([...ids].map(async id=>[id,await asset('models',id)])));
  const rules=createPlacementRules(source,models,{config:PLAY_CONFIG});let world,engine;
  try{
   for(let i=0;i<placements.length;i++){
    const p=placements[i];assert(rules.check(p.box,p.variant,placements.slice(0,i),p.id,p.model).valid,'Recorded deployment remains legal');
   }
   const preparation=rules.prepare(placements);assert(preparation.valid,preparation.reason);
   world=await loadPlayWorld(level.id,{wave,placements,wildlifePoints:preparation.wildlifePoints,conditions:{night:false,weather:false}});
   engine=new PlayEngine(world,{wave});engine.startWave();let usefulDamage=0;
   const takeHit=engine.enemies.takeHit.bind(engine.enemies);
   engine.enemies.takeHit=(...args)=>{const useful=takeHit(...args);usefulDamage+=useful;return useful;};
   for(let frame=0;frame<240*30&&engine.running;frame++)engine.advance(1/30);
   assert(engine.completed,'C3 snapshot resolves');
   const healthBudget=wave.spawns.reduce((n,s)=>n+(wave.enemyOverrides[s.model]?.maxHealth??PLAY_CONFIG.enemies[s.model].maxHealth),0);
   const escapedHP=engine.enemies.states.filter(s=>s.phase==='escaped').reduce((n,s)=>n+s.health.current,0);
   assert(Math.abs(usefulDamage+escapedHP-healthBudget)<1e-6,'Useful damage reconciles to scheduled HP');
   assert.equal(engine.enemies.escaped,0,'Current Arc army retains its C3 clear');
   const result={wave:wave.id,...engine.stats(),surfaceRejects:engine.firing.arcs.states.reduce((n,s)=>n+s.surfaceRejects,0),usefulDamage,healthBudget,placements};
   waves.push(result);console.log(JSON.stringify({mode:baseline?'pre-fix':'fixed',wave:wave.id,killed:result.killed,escaped:result.escaped,arcShots:result.arcShots,surfaceRejects:result.surfaceRejects}));
  }finally{engine?.dispose();disposePlayWorld(world);rules.dispose();}
 }
 for(const [path,expected]of Object.entries(sourceHashes))assert.equal(await hash(path),expected);
 const output={mode:baseline?'pre-fix':'fixed',recordedAt:new Date().toISOString(),effectiveArcHash:baseline?globalThis.defenderArcBaselineHash:sourceHashes[arcPath],method:'Independent C3 wave snapshots; frozen earned-token Arc placements; current native physical combat at120Hz/30Hz outer; no campaign spending search, browser or rendering. Non-Arc audited sources and HP conservation verified.',sourceHashes,waves};
 await Bun.write(new URL(baseline?'c3-baseline.json':'c3-fixed.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
}finally{globalThis.fetch=nativeFetch;}
