import {EnemyPreview} from '../game/enemy-preview.js';
import {ENEMY_STATS} from '../shared/enemy.js';
import {DOG_WALK} from '../engine/dog-gait.js';
import {WALKER_WALK,SPIDER_WALK} from '../engine/articulated-gait.js';
import {ENEMY_EXPANSION_MOVEMENT} from '../engine/enemy-expansion-gait.js';

const PLAY_MOVEMENT={dog:DOG_WALK,walker:WALKER_WALK,spider:SPIDER_WALK,...ENEMY_EXPANSION_MOVEMENT};

// HP and lifecycle are separate: a future/escaped actor may retain positive HP
// but cannot be attacked, smoke, frighten wildlife or move. All slots/rigs are
// allocated for this finite wave only; the active view is reused in place.
function lifecycleHealth(health,state){
 return {get maximum(){return health.maximum;},get current(){return health.current;},get hits(){return health.hits;},get alive(){return state.phase==='active'&&health.alive;},reset:()=>health.reset(),takeDamage:strength=>state.phase==='active'?health.takeDamage(strength):0};
}
export function waveActors(wave){return wave.spawns.map(spawn=>({id:spawn.id,model:spawn.model,variant:'base',routeId:spawn.routeId,distance:0}));}
export class PlayEnemies {
 constructor(world,{config,wave,onPoseChange=()=>{},onVisible=()=>{},onDeath=()=>{},onEscape=()=>{}}){
  this.world=world;this.wave=wave;this.onVisible=onVisible;this.onDeath=onDeath;this.onEscape=onEscape;this.activeTargets=[];this.spawned=this.killed=this.escaped=this.resolved=0;this.time=0;this.spawnIndex=0;this.disposed=false;
  const profiles=Object.fromEntries(Object.entries(config.enemies).map(([model,profile])=>[model,{...profile,...wave.enemyOverrides?.[model]}]));
  const stats=Object.fromEntries(Object.entries(profiles).map(([model,profile])=>[model,{...ENEMY_STATS[model],maxHealth:profile.maxHealth,threat:profile.threat}])),movement=Object.fromEntries(Object.entries(profiles).map(([model,profile])=>[model,{...PLAY_MOVEMENT[model],speed:profile.speed,...(profile.altitude===undefined?{}:{altitude:profile.altitude})}]));
  this.preview=new EnemyPreview(world,onPoseChange,(_id,state)=>this.resolve(state,'killed'),waveActors(wave),{finite:true,stats,movement});
  this.states=this.preview.states;
  for(let i=0;i<this.states.length;i++){const state=this.states[i];state.phase='scheduled';state.spawnAt=wave.spawns[i].at;state.missValue=profiles[state.model].missValue;state.health=lifecycleHealth(state.health,state);this.onVisible(state.id,false);}
 }
 get alive(){return this.activeTargets.length;}
 get pending(){return this.states.length-this.spawned;}
 get complete(){return this.resolved===this.states.length;}
 prepare(){
  this.activeTargets.length=0;this.spawned=this.killed=this.escaped=this.resolved=0;this.time=0;this.spawnIndex=0;
  // Prime every slot's actual torso/route height for load-time gun forecasts.
  for(const s of this.states){s.phase='active';s.distance=s.time=s.seed=s.lap=0;}
  this.preview.reset();
  for(const s of this.states){s.phase='scheduled';this.onVisible(s.id,false);}
 }
 spawnDue(time){
  let changed=false;
  // Validated waves are ordered by spawn time. Consume each due slot once;
  // keep the same batch order and one final pose update for simultaneous spawns.
  while(this.spawnIndex<this.states.length){
   const state=this.states[this.spawnIndex];if(state.phase!=='scheduled'){this.spawnIndex++;continue;}if(state.spawnAt>time+1e-10)break;
   this.spawnIndex++;state.phase='active';state.time=state.distance=0;state.health.reset();this.activeTargets.push(state);this.spawned++;this.onVisible(state.id,true);changed=true;
  }
  if(changed)this.preview.pose(0,this.activeTargets);
 }
 nextSpawn(){while(this.spawnIndex<this.states.length&&this.states[this.spawnIndex].phase!=='scheduled')this.spawnIndex++;return this.states[this.spawnIndex]?.spawnAt??Infinity;}
 nextExit(){let seconds=Infinity;for(const s of this.activeTargets)seconds=Math.min(seconds,Math.max(0,(s.path.length-s.distance)/s.movement.speed));return seconds;}
 advance(dt){
  if(dt===0)return;
  this.time+=dt;this.preview.time=this.time;
  for(const state of this.activeTargets){state.time+=dt;state.distance+=dt*state.movement.speed;}
  this.preview.pose(dt,this.activeTargets);
 }
 takeHit(state,strength,vx,vy,vz){if(this.disposed||state.phase!=='active'||!this.activeTargets.includes(state))return 0;return this.preview.takeHit(state,strength,vx,vy,vz);}
 resolve(state,phase){
  if(state.phase!=='active')return false;
  state.phase=phase;const index=this.activeTargets.indexOf(state);if(index>=0)this.activeTargets.splice(index,1);
  state.velocityX=state.velocityY=state.velocityZ=state.aimVelocityX=state.aimVelocityY=state.aimVelocityZ=0;state.impact.freeze();this.resolved++;this.onVisible(state.id,false);
  if(phase==='killed'){this.killed++;this.onDeath(state.id,state);}else{this.escaped++;this.onEscape(state.id,state.missValue,state);}
  return true;
 }
 resolveExits(continuing=()=>true){for(const state of this.states){if(!continuing())break;if(state.phase==='active'&&state.distance>=state.path.length-1e-8)this.resolve(state,'escaped');}}
 dispose(){if(this.disposed)return;this.disposed=true;this.preview.dispose();this.activeTargets.length=0;this.world=null;this.wave=null;this.onVisible=this.onDeath=this.onEscape=null;}
}
