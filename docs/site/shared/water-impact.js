// Presentation only. Fixed pools cap simultaneous debris/water disturbances.
export const MAX_WATER_IMPACTS=48,MAX_WATER_DROPS=192;
export const MAX_WATER_PARTICLES=MAX_WATER_DROPS+MAX_WATER_IMPACTS*3;
export const WATER_IMPACT=Object.freeze({gravity:72,rippleSeconds:1.8,crownSeconds:.38,underwaterDrag:4.6,underwaterGravity:18});
