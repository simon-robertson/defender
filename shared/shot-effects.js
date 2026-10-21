import {MAX_DAMAGE_LIGHTS} from './damage-effects.js';
import {MAX_MODEL_LIGHTS} from './model-lights.js';
import {MAX_MISSILE_LIGHTS} from './missile-flight.js';
// Bounded preview capacities, not final gameplay budgets. No texture assets.
export const MAX_SHOT_LIGHTS=8;
export const MAX_LOCAL_LIGHTS=MAX_SHOT_LIGHTS+MAX_DAMAGE_LIGHTS+MAX_MODEL_LIGHTS+MAX_MISSILE_LIGHTS;
export const MAX_SHOT_SPARKS=128;
export const SHOT_INSTANCE_FLOATS=16;
export const MAX_SHOT_INSTANCES=MAX_SHOT_SPARKS+MAX_SHOT_LIGHTS*2;
export const FLASH_SECONDS=.085;
export const SPARK_SECONDS=.19;
// Preview art tuning: doubled flash dimensions and light reach, subject to review.
export const MUZZLE_FLASH_SCALE=2;
export const SHOT_LIGHT_RADIUS=96;
