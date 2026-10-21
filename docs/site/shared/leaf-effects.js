// Shared airborne/litter palette: predominantly zone purples, with muted rust.
export const LEAF_COLORS=Object.freeze(['#875B79','#A77B97','#6B4B6E','#A37058','#98624E']);
export function leafColorIndex(sample){return sample<.3?0:sample<.6?1:sample<.8?2:sample<.9?3:4;}

export const MAX_LEAVES=2048,LEAVES_PER_BOX=4,LEAF_INSTANCE_FLOATS=16;
export const LEAF_FALL_SPEED=3,LEAF_HEADROOM=48,LEAF_OPACITY=.92;
export const LEAF_MIN_LENGTH=1.4,LEAF_MAX_LENGTH=2.2,LEAF_WIDTH_RATIO=.5;
export const LEAF_MIN_SWAY=1,LEAF_MAX_SWAY=2,LEAF_SWAY_CYCLES=8;
export const LEAF_SPIN_RATE=.45,LEAF_TUMBLE_RATE=.85;
