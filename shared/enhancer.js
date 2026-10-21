// Fractional changes, separate from geometry and weapon tuning: 0 means no
// change, .25 means +25% strength/rate or -25% cooldown duration. These are data
// only; proximity, stacking and combat application are resolved by the runtime.
// Add future scalar fields here so every enhancer uses the same validation.
const scalarFields=['strengthIncrease','fireRateIncrease','cooldownDecrease'];

export function defineEnhancerStats(variants){
 if(!variants||typeof variants!=='object'||Array.isArray(variants)||Object.keys(variants).length!==1||!Object.hasOwn(variants,'base'))throw new Error('Enhancer stats require a single base version.');
 const result={};
 for(const variant of ['base']){
  const stats=variants[variant],values={};
  if(!stats||typeof stats!=='object'||Array.isArray(stats)||Object.keys(stats).length!==scalarFields.length||!scalarFields.every(key=>Object.hasOwn(stats,key)))throw new Error('Enhancer stats require strengthIncrease, fireRateIncrease and cooldownDecrease.');
  for(const field of scalarFields){
   const value=stats[field];
   if(!Number.isFinite(value)||value<0||value>1)throw new Error(`Enhancer ${field} must be a finite number from 0 to 1.`);
   values[field]=value;
  }
  result[variant]=Object.freeze(values);
 }
 return Object.freeze(result);
}

// User-approved starting values, shared by all zone colour variants.
export const ENHANCER_STATS=Object.freeze({
 'power-generator':defineEnhancerStats({
  base:{strengthIncrease:.25,fireRateIncrease:0,cooldownDecrease:0},
 }),
});
