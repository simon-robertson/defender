import {PLAY_CONFIG} from '../play/config.js';
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../play/engine.js';

// Replay the reported A1 wave-3 arrangement through the real combat engine.
// Instrument decisions only; ordinary targeting, damage and geometry run intact.
export async function auditTargetCommitment({variant='upgrade2',hz=120,config=PLAY_CONFIG}={}){
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);
  return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};
 };
 const wave=config.levels[0].waves[2],placements=[[4,0,9],[12,0,6]].map((box,i)=>({id:`player-gun-${i+1}`,model:'turret-study',variant,box,turn:0}));
 let world,engine;const changes=[],deaths=[];
 try{
  world=await loadPlayWorld('moss-01',{config,wave,placements});
  engine=new PlayEngine(world,{config,wave,onDeath:id=>deaths.push({at:engine.waveTime,id})});engine.startWave();
  const planner=engine.firing.planner,choose=planner.choose.bind(planner);
  planner.choose=(state,index,recoil)=>{
   const before=state.target,eligible=before&&engine.firing.eligible(state,before,recoil);
   const entry={at:engine.waveTime,gun:state.id,from:before?.id??null,eligible:!!eligible,alive:before?.health.alive??null,
    age:state.cycle.time-state.targetSince,shots:state.cycle.shots,acquiredShots:state.targetShots,
    aim:state.aimError,pitch:state.pitchError,remaining:state.cycle.remaining};
   const next=choose(state,index,recoil);if(next!==before)changes.push({...entry,to:next?.id??null});return next;
  };
  for(let frame=0;frame<100*hz&&engine.running;frame++)engine.advance(1/hz);
  return {variant,hz,placements,completed:engine.completed,killed:engine.enemies.killed,escaped:engine.enemies.escaped,
   seconds:engine.waveTime,shots:engine.firing.shots,changes,deaths};
 }finally{engine?.dispose();disposePlayWorld(world);globalThis.fetch=nativeFetch;}
}

if(import.meta.main){
 const result=await auditTargetCommitment({variant:process.argv[3]??'upgrade2',hz:Number(process.argv[4]??120)});
 if(process.argv[2])await Bun.write(process.argv[2],JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}
