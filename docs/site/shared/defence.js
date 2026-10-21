import {VARIANTS} from './model.js';

// User-set token prices for future gameplay. Costs belong to a defence family,
// apply in every zone, and upgradeCost is charged for each single upgrade step.
// Arc Spire is the Zapper's source ID; prices remain separate from attack tuning.
export const DEFENCE_COSTS=Object.freeze({
 'turret-study':Object.freeze({purchaseCost:1,upgradeCost:1}),
 'arc-spire':Object.freeze({purchaseCost:2,upgradeCost:2}),
 'missile-launcher':Object.freeze({purchaseCost:3,upgradeCost:3}),
});

// Every defence family uses this contract, separate from its visual model and
// firing pattern. Range is horizontal centre-to-centre world units. Strength is
// damage per validated attack pulse, not per barrel or visual particle.
export function defineDefenceStats(variants){
 if(!variants||typeof variants!=='object'||Object.keys(variants).length!==VARIANTS.length||!VARIANTS.every(key=>Object.hasOwn(variants,key)))throw new Error('Defence stats require all three variants.');
 const result={};
 for(const variant of VARIANTS){
  const stats=variants[variant];
  if(!stats||!Number.isFinite(stats.maxRange)||stats.maxRange<0||!Number.isFinite(stats.strength)||stats.strength<0)throw new Error('Defence range and strength must be finite, non-negative numbers.');
  if(typeof stats.requiresLineOfSight!=='boolean')throw new Error('Defence line-of-sight policy must be explicit.');
  result[variant]=Object.freeze({maxRange:stats.maxRange,strength:stats.strength,requiresLineOfSight:stats.requiresLineOfSight});
 }
 return Object.freeze(result);
}

// Turret base range is user-set. Upgrade ranges and preview strengths are
// provisional Tactician tuning; turret upgrade 2 remains inactive. Arc Spire
// retains matching range tiers and uses stronger pulses in all three variants.
export const DEFENCE_STATS=Object.freeze({
 'turret-study':defineDefenceStats({
  base:{maxRange:48,strength:10,requiresLineOfSight:true},
  upgrade1:{maxRange:72,strength:12,requiresLineOfSight:true},
  upgrade2:{maxRange:96,strength:0,requiresLineOfSight:true},
 }),
 // Guided missiles validate their actual swept flight, rather than a direct muzzle ray.
 'missile-launcher':defineDefenceStats({
  base:{maxRange:72,strength:60,requiresLineOfSight:false},
  upgrade1:{maxRange:96,strength:75,requiresLineOfSight:false},
  upgrade2:{maxRange:120,strength:90,requiresLineOfSight:false},
 }),
 'arc-spire':defineDefenceStats({
  base:{maxRange:48,strength:30,requiresLineOfSight:true},
  upgrade1:{maxRange:72,strength:40,requiresLineOfSight:true},
  upgrade2:{maxRange:96,strength:55,requiresLineOfSight:true},
 }),
});
