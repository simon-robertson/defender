// Bounded preview tuning for explicitly flagged emissive model panels/eyes.
// A1 maximum: nine turret panels, twelve Dog eyes, four generator bars,
// two Roller sensors and two Moth sensors. Other mixed studies use fewer.
export const MAX_MODEL_LIGHTS=29;
// Application-specific capacities may be larger; the preview default remains29.
// 463 model sources plus the existing48 transient reservations fit the WebGPU
// minimum16KiB uniform binding limit without a new buffer type or draw pass.
// Header16 + (463+48)*32 =16,368 bytes. Scene applications request only their
// measured bound; the preview still defaults to29.
export const MAX_SUPPORTED_MODEL_LIGHTS=463;
export const MODEL_LIGHT_RADIUS=14;
export const MODEL_LIGHT_STRENGTH=.65;
export const MODEL_LIGHT_SURFACE_OFFSET=.6;
