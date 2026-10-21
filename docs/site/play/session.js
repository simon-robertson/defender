import {PLAY_CONFIG,validatePlayConfig,DEFENCE_LABELS,ENEMY_LABELS} from './config.js';
import {ZONES} from '../shared/model.js';
import {groupRosterUnits} from './roster-order.js';

const DEFENCE_NAMES=DEFENCE_LABELS;
const ENEMY_NAMES=ENEMY_LABELS;
const available=(entry,wave)=>wave>=(entry?.availableFromWave??1);

// Catalogue order defines progression through every zone to the final wave.
export function nextEncounter(levels,levelIndex,waveIndex){
 if(waveIndex+1<levels[levelIndex].waves.length)return {levelIndex,waveIndex:waveIndex+1};
 if(levelIndex+1<levels.length)return {levelIndex:levelIndex+1,waveIndex:0};
 return null;
}

// Continue in the visible roster order after the unit just placed, skipping
// deployed units and wrapping once. Purchase order can interleave families.
export function nextUnplaced(units,afterId=null){
 const ordered=groupRosterUnits(units).flatMap(group=>group.units),start=ordered.findIndex(unit=>unit.id===afterId);
 for(let offset=1;offset<=ordered.length;offset++){
  const unit=ordered[(start+offset)%ordered.length];if(!unit.box)return unit.id;
 }
 return null;
}

// Pure run state. Deployment edits use a fork and commit after runtime validation.
export class PlaySession {
 constructor(config=PLAY_CONFIG){this.config=validatePlayConfig(config);this.reset('title');}
 reset(phase='loadout'){
  this.phase=phase;this.tokens=this.config.startTokens;this.misses=0;this.levelIndex=0;this.waveIndex=0;
  this.units=[];this.nextUnit=1;this.completedWaves=0;this.resolved=new Map();this.paused=false;this.settleRemaining=0;
 }
 get level(){return this.config.levels[this.levelIndex];}
 get wave(){return this.level.waves[this.waveIndex];}
 get preparing(){return this.phase==='loadout'||this.phase==='deploy';}
 get encounterNumber(){return this.config.levels.slice(0,this.levelIndex).reduce((sum,level)=>sum+level.waves.length,0)+this.waveIndex+1;}
 get placements(){return this.units.filter(unit=>unit.box).map(unit=>({id:unit.id,model:unit.model??'turret-study',variant:unit.variant,box:[...unit.box],turn:0}));}
 fork(){const copy=new PlaySession(this.config);for(const key of Object.keys(this))if(key!=='config')copy[key]=structuredClone(this[key]);return copy;}
 adopt(copy){if(copy.config!==this.config)throw new Error('Session configurations differ.');for(const key of Object.keys(copy))if(key!=='config')this[key]=structuredClone(copy[key]);}
 buy(model='turret-study'){
  const family=this.config.defences[model],cost=family?.purchaseCost;
  if(this.phase!=='loadout'||!family||!available(family,this.encounterNumber)||!available(family.variants.base,this.encounterNumber)||this.tokens<cost)return null;
  const unit={id:'player-'+(model==='turret-study'?'gun':model)+'-'+this.nextUnit++,model,variant:'base',box:null};this.units.push(unit);this.tokens-=cost;return unit.id;
 }
 nextVariant(unit){const variants=this.config.defences[unit?.model??'turret-study']?.enabledVariants??[],index=variants.indexOf(unit?.variant);return index<0?null:variants[index+1]??null;}
 nextUnplaced(afterId=null){return nextUnplaced(this.units,afterId);}
 upgrade(id){
  const unit=this.units.find(unit=>unit.id===id),family=this.config.defences[unit?.model??'turret-study'],cost=family?.upgradeCost,next=this.nextVariant(unit);
  if(this.phase!=='loadout'||family?.kind==='enhancer'||!Number.isInteger(cost)||!next||!available(family,this.encounterNumber)||!available(family.variants[next],this.encounterNumber)||this.tokens<cost)return false;
  unit.variant=next;this.tokens-=cost;return true;
 }
 place(id,box){
  const unit=this.units.find(unit=>unit.id===id);if(this.phase!=='deploy'||!unit||!Array.isArray(box)||box.length!==3||!box.every(Number.isInteger))return false;
  unit.box=[...box];return true;
 }
 undeploy(id){const unit=this.units.find(unit=>unit.id===id);if(this.phase!=='deploy'||!unit?.box)return false;unit.box=null;return true;}
 prepare(phase){if(!this.preparing||!['loadout','deploy'].includes(phase))return false;this.phase=phase;return true;}
 startWave(){if(this.phase!=='deploy')return false;this.phase='wave';this.paused=false;this.resolved.clear();return true;}
 resolve(id,outcome){
  if(this.phase!=='wave'||this.paused||!['killed','escaped'].includes(outcome)||this.resolved.has(id)||!this.wave.spawns.some(spawn=>spawn.id===id))return false;
  this.resolved.set(id,outcome);
  if(outcome==='escaped'){
   const spawn=this.wave.spawns.find(spawn=>spawn.id===id);this.misses+=this.config.enemies[spawn.model].missValue;
   if(this.misses>=this.config.missLimit){this.phase='defeat';this.paused=false;}
  }
  return true;
 }
 beginSettling(waveId){
  if(this.phase!=='wave'||this.paused||this.wave.id!==waveId||this.resolved.size!==this.wave.spawns.length)return false;
  this.phase='settling';this.settleRemaining=this.config.waveSettleSeconds;return true;
 }
 advanceSettlement(dt){
  if(!Number.isFinite(dt)||dt<0)throw new Error('Settlement delta must be finite and nonnegative.');
  if(this.phase!=='settling'||this.paused)return false;
  this.settleRemaining=Math.max(0,this.settleRemaining-dt);return this.settleRemaining===0;
 }
 finishWave(waveId){
  if(this.phase!=='settling'||this.paused||this.settleRemaining>0||this.wave.id!==waveId||this.resolved.size!==this.wave.spawns.length)return false;
  this.tokens+=this.config.waveReward;this.completedWaves++;this.resolved.clear();
  const next=nextEncounter(this.config.levels,this.levelIndex,this.waveIndex);
  if(next){if(next.levelIndex!==this.levelIndex)for(const unit of this.units)unit.box=null;Object.assign(this,next);this.phase='loadout';}
  else this.phase='complete';
  return true;
 }
 pause(value){if(!['wave','settling'].includes(this.phase))return false;this.paused=Boolean(value);return true;}
 wavePreview(){
  const groups=new Map();
  for(const spawn of this.wave.spawns){const key=spawn.model+':'+spawn.routeId;let group=groups.get(key);if(!group){const profile={...this.config.enemies[spawn.model],...this.wave.enemyOverrides?.[spawn.model]};group={model:spawn.model,name:ENEMY_NAMES[spawn.model]??spawn.model,routeId:spawn.routeId,count:0,maxHealth:profile.maxHealth,speed:profile.speed,altitude:profile.altitude,firstAt:spawn.at,lastAt:spawn.at};groups.set(key,group);}group.count++;group.lastAt=spawn.at;}
  return {splitApproaches:new Set(this.wave.spawns.map(spawn=>spawn.routeId)).size>1,name:this.wave.name??'Incoming wave',description:this.wave.description??'',groups:[...groups.values()],total:this.wave.spawns.length};
 }
 snapshot(){return {phase:this.phase,paused:this.paused,settleRemaining:this.settleRemaining,tokens:this.tokens,misses:this.misses,missLimit:this.config.missLimit,
  zone:this.level.zone,zoneName:ZONES[this.level.zone].name,
  levelNumber:this.config.levels.slice(0,this.levelIndex+1).filter(level=>level.zone===this.level.zone).length,
  campaignLevelNumber:this.levelIndex+1,totalLevels:this.config.levels.length,
  waveNumber:this.waveIndex+1,wavesPerLevel:this.level.waves.length,completedWaves:this.completedWaves,
  totalWaves:this.config.levels.reduce((sum,level)=>sum+level.waves.length,0),wavePreview:this.wavePreview(),
  shop:Object.entries(this.config.defences).map(([model,family])=>({model,kind:family.kind??'defence',name:DEFENCE_NAMES[model]??model,cost:family.purchaseCost,available:available(family,this.encounterNumber)&&available(family.variants.base,this.encounterNumber),availableFromWave:Math.max(family.availableFromWave??1,family.variants.base.availableFromWave??1),stats:family.variants.base.stats,firing:family.variants.base.firing})),
  units:this.units.map((unit,i)=>{const model=unit.model??'turret-study',family=this.config.defences[model],nextVariant=this.nextVariant(unit),upgradeCost=nextVariant?family.upgradeCost:null,upgradeAvailableFromWave=nextVariant?Math.max(family.availableFromWave??1,family.variants[nextVariant].availableFromWave??1):null;return {...unit,model,kind:family.kind??'defence',box:unit.box?.slice()??null,deployed:Boolean(unit.box),stats:family.variants[unit.variant].stats,firing:family.variants[unit.variant].firing,label:(DEFENCE_NAMES[model]??model)+' '+String(i+1).padStart(2,'0'),nextVariant,upgradeCost,upgradeAvailableFromWave,canUpgrade:this.phase==='loadout'&&nextVariant!==null&&this.encounterNumber>=upgradeAvailableFromWave&&this.tokens>=upgradeCost};}),
  encounterNumber:this.encounterNumber,
  costs:{buy:this.config.defences['turret-study'].purchaseCost,upgrade:this.config.defences['turret-study'].upgradeCost}};}
}
