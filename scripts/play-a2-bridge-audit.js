// Production A2 wave-two replay at the previously recorded bridge-exit guns.
// Measures lack of acquisition separately from cooldown and servo movement.
import {PLAY_CONFIG} from '../play/config.js';
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../play/engine.js';
export const BRIDGE_PLACEMENTS=[[16,0,9],[17,0,7],[3,0,5],[5,0,5],[8,0,10],[8,0,8]].map((box,i)=>({id:'player-gun-'+(i+1),model:'turret-study',variant:i<2?'upgrade1':'base',box,turn:0}));
export async function auditA2Bridge({hz=120,previousWave=false,onlyUpgrades=false}={}){
 const root=new URL('../',import.meta.url),nativeFetch=globalThis.fetch;
 globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(new URL('assets/'+kind+'/'+id+'.json',root)).json()})};};
 let world,engine;
 try{
  const placements=onlyUpgrades?BRIDGE_PLACEMENTS.slice(0,2):BRIDGE_PLACEMENTS,waves=PLAY_CONFIG.levels[1].waves;
  world=await loadPlayWorld('moss-02',{wave:waves[previousWave?0:1],placements});engine=new PlayEngine(world,{});
  if(previousWave){engine.startWave();for(let frame=0;frame<hz*300&&engine.running;frame++)engine.advance(1/hz);if(!engine.completed)throw new Error('Opening wave did not finish.');engine.prepareWave(waves[1]);}
  const stats=engine.firing.turrets.states.slice(0,2).map(g=>({id:g.id,shots:0,bySpecies:{},eligibleTicks:0,maxNoTargetSeconds:0,maxReadyWithoutShotSeconds:0,noTargetTicks:0,readyWithoutShotTicks:0}));
  engine.startWave();
  // Combat uses the production fixed tick; sample attention once per host frame.
  // The 120 Hz run also observes every ordinary simulation tick.
  let frame=0;while(engine.running&&frame++<36000){
   engine.advance(1/hz);
   for(let i=0;i<stats.length;i++){
    const g=engine.firing.turrets.states[i],s=stats[i],point=[...g.targeting.point];let eligible=0;
    const shots=g.cycle.shots-s.shots;if(shots){const t=engine.enemies.states.find(t=>t.id===g.lastShotTargetId);s.bySpecies[t.model]=(s.bySpecies[t.model]??0)+shots;}
    for(const t of engine.enemies.activeTargets){if(!g.targeting.solve(g.x,g.z,t))continue;const yaw=engine.firing.targetYaw(g),pitch=engine.firing.targetPitch(g,t,yaw);if(g.pitch.reachable(pitch)&&engine.firing.turrets.hasSight(g,t,yaw,pitch,0))eligible++;}
    g.targeting.point.set(point);if(eligible)s.eligibleTicks++;
    s.noTargetTicks=eligible&&!g.target?s.noTargetTicks+1:0;s.maxNoTargetSeconds=Math.max(s.maxNoTargetSeconds,s.noTargetTicks/hz);
    s.readyWithoutShotTicks=eligible&&g.cycle.ready&&!shots?s.readyWithoutShotTicks+1:0;s.maxReadyWithoutShotSeconds=Math.max(s.maxReadyWithoutShotSeconds,s.readyWithoutShotTicks/hz);s.shots=g.cycle.shots;
   }
  }
  return {wave:engine.wave.id,hz,previousWave,placements,completed:engine.completed,killed:engine.enemies.killed,escaped:engine.enemies.escaped,seconds:engine.waveTime,stats};
 }finally{engine?.dispose();disposePlayWorld(world);globalThis.fetch=nativeFetch;}
}
if(import.meta.main){const results=[];for(const previousWave of [false,true])for(const hz of [30,60,120])results.push(await auditA2Bridge({hz,previousWave}));results.push(await auditA2Bridge({onlyUpgrades:true}));console.log(JSON.stringify(results,null,2));}
