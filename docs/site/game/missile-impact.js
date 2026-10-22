import {MISSILE_IMPACT_EFFECT} from '../shared/damage-effects.js';

// Fright belongs to the physical contact, even if all visual blast slots are
// occupied by higher-priority enemy deaths. Copy the exact contact scalars.
export function emitMissileImpact(damage,wildlife,x,y,z,nx,ny,nz){
 const blast=damage.missileImpact(x,y,z,nx,ny,nz);
 wildlife?.spookExplosion(x,y,z,MISSILE_IMPACT_EFFECT.frightRadius);
 return blast;
}
