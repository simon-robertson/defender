// Bounded development effect tuning, independent of attack strength/cadence.
export const MAX_ARC_PRIMARY_STRIKES=6;
// Separate bounded banks prevent simultaneous primaries from hiding chains.
export const MAX_ARC_STRIKES=MAX_ARC_PRIMARY_STRIKES*2;
export const ARC_TRUNK_SEGMENTS=32;
export const ARC_LIGHT_SEGMENTS=8;
export const MAX_ARC_SPARKS=96;
export const ARC_SPARKS_PER_HIT=6;
export const ARC_INSTANCE_FLOATS=12;
export const MAX_ARC_INSTANCES=MAX_ARC_STRIKES*ARC_TRUNK_SEGMENTS+MAX_ARC_SPARKS;
export const ARC_LIGHT_BOUNDS_OFFSET=8+ARC_LIGHT_SEGMENTS*8;
export const ARC_LIGHT_FLOATS=ARC_LIGHT_BOUNDS_OFFSET+4;
export const ARC_EMPTY_LIGHT_BYTES=(4+ARC_LIGHT_FLOATS)*4;
export const ARC_LIGHT_BYTES=(4+MAX_ARC_STRIKES*ARC_LIGHT_FLOATS)*4;
export const ARC_SECONDS=.14;
export const ARC_SPARK_FLIGHT_SECONDS=3;
export const ARC_SPARK_REST_SECONDS=.35;
export const ARC_SPARK_SECONDS=ARC_SPARK_FLIGHT_SECONDS+ARC_SPARK_REST_SECONDS;
export const ARC_SPARK_GRAVITY=90;
export const ARC_RESTRIKE_AT=.045;
export const ARC_WIDTH=.9;
// A weaker enemy-to-enemy jump retains 70% of the primary channel width.
export const ARC_CHAIN_WIDTH_SCALE=.7;
export const ARC_LIGHT_RADIUS=18;
export const ARC_LIGHT_STRENGTH=4.8;
