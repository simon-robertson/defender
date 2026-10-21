// Bounded visual-preview pools. Enemy configuration chooses a smaller burst.
export const MAX_DEBRIS=192,MAX_SMOKE=384,MAX_BLASTS=4,MAX_DAMAGE_LIGHTS=4;
// Nine ground animals, three birds and at most four three-fish schools. Each animal
// can die once per wave. Reserve their storage so enemy bursts cannot evict it.
export const MAX_CRITTERS=24,CRITTER_FRAGMENTS=16,CRITTER_SPRAY=32;
export const MAX_CRITTER_DEBRIS=MAX_CRITTERS*(CRITTER_FRAGMENTS+CRITTER_SPRAY),MAX_DAMAGE_CUBES=MAX_DEBRIS+MAX_CRITTER_DEBRIS;
export const CRITTER_GIB=Object.freeze({enemyRadius:33.6,missileRadius:72,fadeSeconds:2,gravity:60,settleSeconds:Infinity,maxFlightSeconds:6,coreImpulse:112,edgeImpulse:32});
// Bounded game impulse in world units/s. The lethal-radius edge still has a
// substantial kick; the core is finite instead of an inverse-square singularity.
export function critterShockwaveImpulse(distance,radius){
 if(!Number.isFinite(distance)||distance<0||!Number.isFinite(radius)||radius<=0)throw new Error('Invalid critter shockwave distance or radius.');
 const remaining=1-Math.min(1,distance/radius);
 return CRITTER_GIB.edgeImpulse+(CRITTER_GIB.coreImpulse-CRITTER_GIB.edgeImpulse)*remaining*remaining;
}
import {MAX_WATER_PARTICLES} from './water-impact.js';
export const MISSILE_BLAST_PARTICLES=9;
export const MAX_DAMAGE_PARTICLES=MAX_SMOKE+MAX_BLASTS*MISSILE_BLAST_PARTICLES+MAX_WATER_PARTICLES;
// Small physical separation from the contacted scenery face, in world units.
export const BLOOD_DECAL_OFFSET=.08;
export const DAMAGE_CUBE_FLOATS=20,DAMAGE_PARTICLE_FLOATS=12;
export const SHOCKWAVE_FLOATS=8;

// Missile presentation shares the existing pools and shader layouts. Its
// Layered fireball lobes share the blast draw. Lighting remains
// exactly the former contact flash; this changes presentation, never damage.
export const MISSILE_IMPACT_EFFECT=Object.freeze({size:22,flashSeconds:.68,flashRiseSeconds:.035,flashGreen:.94,flashBlue:.82,lightSeconds:.26,lightRadius:52,lightStrength:26,frightRadius:48,waveSeconds:.38,waveRadius:46,waveWidth:5,waveStrength:.55,surfaceOffset:.15});
export const MISSILE_IMPACT_SMOKE=Object.freeze({count:9,minLife:1,maxLife:1.6,minRadius:4,maxRadius:7,minOutSpeed:10,maxOutSpeed:22,minRise:7,maxRise:14,opacity:.8,r:.12,g:.115,b:.105});
export const MISSILE_LAUNCH_SMOKE=Object.freeze({count:8,minLife:1.3,maxLife:1.8,minRadius:4.2,maxRadius:5.2,minOutSpeed:3,maxOutSpeed:6,minRise:3,maxRise:5,opacity:.82,r:.52,g:.50,b:.46});

export const MISSILE_TRAIL_SMOKE=Object.freeze({life:2,radius:3.2,rise:1.2,opacity:.9,r:.57,g:.58,b:.55});
