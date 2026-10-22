import {test,expect} from 'bun:test';
import {PlaySession} from '../play/session.js';
import {createPlayConfig} from '../play/config.js';
import {checkpointDescription,upgradeComparison,waveOutcomeText} from '../play/briefing.js';
test('checkpoint recovery distinguishes a saved area, missing save and pending write',()=>{
 expect(checkpointDescription(null)).toContain('No checkpoint');expect(checkpointDescription(null)).toContain('Area A1');
 expect(checkpointDescription({area:'C3',completedWaves:40})).toContain('Area C3 (40 waves cleared)');expect(checkpointDescription(null,true)).toContain('Saving');
});
test('upgrade briefings use real configured damage, range, burst, chain and magazine values',()=>{
 const s=new PlaySession();s.reset();s.levelIndex=3;s.tokens=30;
 for(const model of ['turret-study','arc-spire','missile-launcher']){
  const id=s.buy(model),unit=s.snapshot().units.find(u=>u.id===id),before=s.tokens,comparison=upgradeComparison(unit),rows=Object.fromEntries(comparison.rows);
  expect(s.tokens).toBe(before);expect(rows.Damage).toBe(`${unit.stats.strength} → ${unit.nextStats.strength}`);expect(rows.Range).toBe(`${unit.stats.maxRange} → ${unit.nextStats.maxRange}`);
  if(model==='turret-study'){expect(rows.Burst).toBe('1 → 3 shots');expect(rows.Damage).toBe('10 → 12');expect(rows.Range).toBe('48 → 66');}
  if(model==='arc-spire'){expect(rows.Chain).toContain('None →');expect(comparison.note).toContain('chain once');}
  if(model==='missile-launcher'){expect(rows.Magazine).toBe('2 → 4 missiles');expect(rows['Launch gap']).toBe('2 → 2s');expect(rows['Full reload']).toBe('4 → 4.5s');}
 }
});
test('upgrade descriptions retain generator bonuses and follow configuration changes',()=>{
 const s=new PlaySession(createPlayConfig({defences:{'turret-study':{variants:{upgrade1:{stats:{strength:19,maxRange:79}}}}}}));s.reset();const id=s.buy(),unit=s.snapshot().units.find(u=>u.id===id);
 unit.strengthIncrease=.25;unit.stats={...unit.stats,strength:unit.stats.strength*1.25};const result=upgradeComparison(unit);expect(Object.fromEntries(result.rows)).toMatchObject({Damage:'12.5 → 23.75',Range:'48 → 79'});expect(result.note).toContain('generator');expect(upgradeComparison({...unit,nextVariant:null})).toBeNull();
});
test('wave feedback counts this wave rather than cumulative misses and resets with a new campaign',()=>{
 const s=new PlaySession(createPlayConfig({enemies:{dog:{missValue:2}}}));s.reset();const gun=s.buy();s.prepare('deploy');s.place(gun,[13,0,9]);s.startWave();
 const complete=escaped=>{const id=s.wave.id;for(const[slot,spawn]of s.wave.spawns.entries())s.resolve(spawn.id,slot<escaped?'escaped':'killed');s.beginSettling(id);s.advanceSettlement(s.config.waveSettleSeconds);expect(s.finishWave(id)).toBe(true);};
 complete(1);expect(s.misses).toBe(2);expect(s.snapshot().lastWaveResult).toMatchObject({escaped:1,killed:2,reward:2});expect(waveOutcomeText(s.lastWaveResult)).toBe('Last wave · 1 escaped · +2 tokens');
 s.prepare('deploy');s.startWave();complete(0);expect(s.misses).toBe(2);expect(waveOutcomeText(s.lastWaveResult)).toBe('Last wave · No escapes · +2 tokens');
 const copy=s.fork();copy.lastWaveResult.escaped=8;expect(s.lastWaveResult.escaped).toBe(0);s.reset();expect(s.lastWaveResult).toBeNull();expect(waveOutcomeText(null)).toBe('');
});
