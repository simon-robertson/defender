import {MAX_ARC_STRIKES,ARC_LIGHT_FLOATS,ARC_LIGHT_SEGMENTS,ARC_INSTANCE_FLOATS} from './arc-effects.js';

// Visual capacity, independent of combat and enhancer strength. Extra authored
// links are reported and omitted; the six combat Arc slots stay reserved.
// The ordinary campaign offers 128 tokens: at most 32 four-token generators,
// each with four cardinal links. Recipient costs make this a conservative cap.
export const MAX_PLASMA_LINKS=128;
export const PLASMA_SEGMENTS=32;
export const PLASMA_NODES=PLASMA_SEGMENTS+1;
export const PLASMA_INSTANCE_FLOATS=ARC_INSTANCE_FLOATS;
export const PLASMA_LIGHT_SEGMENTS=ARC_LIGHT_SEGMENTS;
export const PLASMA_LIGHT_FLOATS=ARC_LIGHT_FLOATS;
export const PLASMA_INSTANCE_BYTES=MAX_PLASMA_LINKS*PLASMA_SEGMENTS*PLASMA_INSTANCE_FLOATS*4;
export const MAX_TUBE_LIGHTS=MAX_ARC_STRIKES+MAX_PLASMA_LINKS;
export const COMBINED_TUBE_LIGHT_BYTES=(4+MAX_TUBE_LIGHTS*ARC_LIGHT_FLOATS)*4;
export const PLASMA_WIDTH=.8;
// User motion trial: half the original displacement, twice its phase speed.
export const PLASMA_WAVE_AMPLITUDE=.6;
export const PLASMA_WAVE_LENGTH_RATIO=.05;
export const PLASMA_MOTION_RATE=6.4;
export const PLASMA_LIGHT_RADIUS=14;
export const PLASMA_LIGHT_STRENGTH=1.8;
export const PLASMA_COLOR=Object.freeze([.08,1,.16]);

