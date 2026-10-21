// Replay the reported A2.1 deployment through production combat.
// Read-only diagnostics distinguish horizontal range, pitch and reservations.
import {PLAY_CONFIG} from '../play/config.js';
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../play/engine.js';
const root=new URL('../',import.meta.url),nativeFetch=globalThis.fetch;
globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(new URL('assets/'+kind+'/'+id+'.json',root)).json()})};};
const placements=[[16,0,9],[17,0,7],[3,0,5],[5,0,5],[8,0,10],[8,0,8]].map((box,i)=>({id:'player-gun-'+(i+1),model:'turret-study',variant:i<2?'upgrade1':'base',box,turn:0}));
const wave=PLAY_CONFIG.levels[1].waves[0],world=await loadPlayWorld('moss-02',{wave,placements,config:PLAY_CONFIG}),events=[];
const engine=new PlayEngine(world,{onDeath:(id,s)=>events.push({id,model:s.model,result:'killed',at:engine.waveTime}),onEscape:id=>events.push({id,model:engine.enemies.states.find(s=>s.id===id).model,result:'escaped',at:engine.waveTime})});
const stats=engine.firing.turrets.states.map(g=>({id:g.id,variant:g.variant,range:g.maxRange,pivotY:g.rig.root[13]+g.gunPivot[1],shots:0,airShots:0,inRange:0,pitchRejected:0,blocked:0,eligible:0,minPitch:Infinity,maxPitch:-Infinity,examples:[],airEligibleAttention:{}}));
engine.startWave();
for(let frame=0;frame<36000&&engine.running;frame++){
 engine.advance(1/120);
 for(let i=0;i<stats.length;i++){const gun=engine.firing.turrets.states[i],s=stats[i];if(gun.cycle.shots>s.shots){const target=engine.enemies.states.find(t=>t.id===gun.lastShotTargetId);if(target.model==='moth')s.airShots++;s.shots=gun.cycle.shots;}
 if(frame%12)continue;
 for(const target of engine.enemies.activeTargets){if(target.model!=='moth'||!gun.targeting.solve(gun.x,gun.z,target))continue;s.inRange++;const yaw=engine.firing.targetYaw(gun),pitch=engine.firing.targetPitch(gun,target,yaw),deg=pitch*180/Math.PI;s.minPitch=Math.min(s.minPitch,deg);s.maxPitch=Math.max(s.maxPitch,deg);if(!gun.pitch.reachable(pitch)){s.pitchRejected++;if(s.examples.length<2)s.examples.push({at:engine.waveTime,horizontal:Math.hypot(target.x-gun.x,target.z-gun.z),aimY:target.aimY,pitch:deg,reason:'pitch'});}else if(!engine.firing.turrets.hasSight(gun,target,yaw,pitch,0)){s.blocked++;}else{s.eligible++;const key=(gun.target?.model??'idle')+' / '+(gun.reservation?.model??'unreserved');s.airEligibleAttention[key]=(s.airEligibleAttention[key]??0)+1;if(s.examples.length<2)s.examples.push({at:engine.waveTime,horizontal:Math.hypot(target.x-gun.x,target.z-gun.z),aimY:target.aimY,pitch:deg,reason:'eligible'});}}
 }
}
console.log(JSON.stringify({wave:wave.id,placements,killed:engine.enemies.killed,escaped:engine.enemies.escaped,stats,events},null,2));
engine.dispose();disposePlayWorld(world);globalThis.fetch=nativeFetch;
