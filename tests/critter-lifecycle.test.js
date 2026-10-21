import {test,expect} from 'bun:test';
import {PlaySession} from '../play/session.js';
import {DamageEffects} from '../engine/damage-effects.js';
import {beginPreparationFade} from '../play/critter-lifecycle.js';
const palette=new Float32Array([.3,.2,.1,1]);
function effects(){const d=new DamageEffects(()=>.5);d.setWorld({visibility:{bounds:new Float32Array([-1000,0,-1000,1000,24,1000]),escape:new Uint32Array([1]),nodeCount:1}},[]);return d;}
test('actual session wave end and late settling impacts retain all remains until build/deploy returns',()=>{
 const session=new PlaySession(),damage=effects();session.reset();session.prepare('deploy');session.startWave();damage.gibCritter({x:0,y:30,z:0},palette,-6,32,0);
 expect(beginPreparationFade(damage,session)).toBe(false);for(const spawn of session.wave.spawns)session.resolve(spawn.id,'killed');session.beginSettling(session.wave.id);
 damage.advance(3);session.advanceSettlement(3);damage.gibCritter({x:0,y:30,z:0},palette,-6,32,0);expect(beginPreparationFade(damage,session)).toBe(false);
 damage.advance(1);session.advanceSettlement(1);expect(damage.cubes.filter(p=>p.active).every(p=>p.fade===1&&p.fadeStart===null)).toBe(true);expect(damage.activeCubes).toBe(96);
 session.finishWave(session.wave.id);expect(session.phase).toBe('loadout');expect(beginPreparationFade(damage,session)).toBe(true);
 damage.advance(0);expect(damage.cubes.filter(p=>p.active).every(p=>p.fade===1)).toBe(true);damage.advance(1);expect(damage.cubes.filter(p=>p.active).every(p=>Math.abs(p.fade-.5)<1e-9)).toBe(true);damage.advance(1);expect(damage.hasCritterRemains).toBe(false);
});
test('defeat and final completion do not trigger an early critter fade',()=>{
 for(const phase of ['defeat','complete']){const s=new PlaySession(),d=effects();d.gibCritter({x:0,y:30,z:0},palette,-6,32,0);s.phase=phase;expect(beginPreparationFade(d,s)).toBe(false);d.advance(20);expect(d.hasCritterRemains).toBe(true);expect(d.critterFadeAt).toBeNull();d.reset();expect(d.hasCritterRemains).toBe(false);}
});

test('level-boundary preparation retains the outgoing board effects until their two-second fade finishes',()=>{
 const s=new PlaySession(),d=effects();s.reset();s.waveIndex=3;s.prepare('deploy');s.startWave();const outgoing=s.level.id,collision=d.visibility;
 d.gibCritter({x:0,y:30,z:0},palette,-6,32,0);for(const spawn of s.wave.spawns)s.resolve(spawn.id,'killed');s.beginSettling(s.wave.id);d.advance(s.config.waveSettleSeconds);s.advanceSettlement(s.config.waveSettleSeconds);
 expect(d.critterFadeAt).toBeNull();expect(d.hasCritterRemains).toBe(true);s.finishWave(s.wave.id);expect(s.level.id).not.toBe(outgoing);expect(s.preparing).toBe(true);
 expect(beginPreparationFade(d,s)).toBe(true);d.advance(1);expect(d.hasCritterRemains).toBe(true);expect(d.visibility).toBe(collision);d.advance(1);expect(d.hasCritterRemains).toBe(false);d.reset();expect(d.visibility).toBeNull();
});
