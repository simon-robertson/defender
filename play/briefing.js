import {ARC_CHAIN_RANGE_SCALE,ARC_CHAIN_STRENGTH} from '../shared/arsenal.js';
const number=value=>String(Number(value.toFixed(2)));
export function checkpointDescription(savedGame,saving=false){
 if(saving)return 'Saving the completed area. Please wait.';
 return savedGame?`Your checkpoint at Area ${savedGame.area} (${savedGame.completedWaves} waves cleared) will be kept.`:'No checkpoint exists yet. Your next game will start at Area A1.';
}
export function waveOutcomeText(result){
 if(!result)return '';
 return `Last wave · ${result.escaped===0?'No escapes':`${result.escaped} escaped`} · +${result.reward} token${result.reward===1?'':'s'}`;
}
export function upgradeComparison(unit){
 if(!unit?.nextVariant||!unit.stats||!unit.nextStats||!unit.firing||!unit.nextFiring)return null;
 const from=unit.stats,to=unit.nextStats,boost=1+(unit.strengthIncrease??0),cycle=unit.firing.cycle??unit.firing,nextCycle=unit.nextFiring.cycle??unit.nextFiring;
 const pair=(a,b,suffix='')=>`${number(a)} → ${number(b)}${suffix}`;
 const rows=[['Damage',pair(from.strength,to.strength*boost)],['Range',pair(from.maxRange,to.maxRange)]];
 let note;
 if(unit.model==='missile-launcher'){
  rows.push(['Magazine',pair(unit.firing.magazine,unit.nextFiring.magazine,' missiles')],['Launch gap',pair(unit.firing.gap,unit.nextFiring.gap,'s')],['Full reload',pair(unit.firing.reload,unit.nextFiring.reload,'s')]);
  note='Individual guided launches. Reload begins after the last missile in the magazine.';
 }else{
  rows.push([unit.model==='arc-spire'?'Pulses':'Burst',pair(cycle.shotsPerBurst,nextCycle.shotsPerBurst,' shots')],['Cooldown',pair(cycle.cooldownSeconds,nextCycle.cooldownSeconds,'s')]);
  note=`Cooldown begins after the final shot.${nextCycle.shotsPerBurst>1?` Shots are ${number(nextCycle.shotIntervalSeconds)}s apart.`:''}`;
  if(unit.model==='arc-spire'){
   const chain=stats=>`${number(stats.strength*boost*ARC_CHAIN_STRENGTH)} dmg / ${number(stats.maxRange*ARC_CHAIN_RANGE_SCALE)} range`;
   rows.push(['Chain',`${unit.variant==='base'?'None':chain({...from,strength:from.strength/boost})} → ${chain(to)}`]);
   note='Each hit can chain once to one eligible nearby enemy. '+note;
  }
 }
 return {rows,note:note+(boost>1?' Damage includes the current generator bonus.':'')};
}
