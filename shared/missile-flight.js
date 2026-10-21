export const MAX_MISSILES=36;
export const MAX_MISSILE_LIGHTS=MAX_MISSILES;
export const MISSILE_THRUST_LIGHT=Object.freeze({radius:32,strength:3,offset:3,color:Object.freeze([1,.61,.26])});
export const MISSILE_ATTACK_THRUST=Object.freeze({widthScale:1.3,lengthScale:1.5,lightStrength:4.5});
export const MISSILE_THRUST_FLOATS=16;
export const MAX_MISSILE_THRUST_INSTANCES=MAX_MISSILES*4;
export const MISSILE_STEERING_JET_LENGTH=5.25;
export const MISSILE_PHASE=Object.freeze({FREE:0,LOADED:1,BOOST:2,COAST:3,HOMING:4});
// Target-run speed and acceleration scale together so velocity can follow the
// existing eased turn before terminal cutoff; boost/coast retain their tuning.
export const MISSILE_FLIGHT=Object.freeze({boostSpeed:64,boostSeconds:.5,coastSeconds:.4,coastGravity:40,coastTurn:Math.PI*2,cruiseSpeed:180,acceleration:630,homingTurn:Math.PI*240/180,maxAge:8,stepSeconds:1/120,maxFrameSeconds:1,lastPositionRadius:1,terminalCutoffRadius:22});
const rule=(magazine,gap,reload)=>Object.freeze({magazine,gap,reload,cycle:Object.freeze({shotsPerBurst:1,shotIntervalSeconds:0,cooldownSeconds:gap,delivery:'projectile',projectile:Object.freeze({speedUnitsPerSecond:MISSILE_FLIGHT.cruiseSpeed})})});
export const MISSILE_FIRING=Object.freeze({base:rule(2,1,4),upgrade1:rule(4,1,4.5),upgrade2:rule(6,1,5)});
