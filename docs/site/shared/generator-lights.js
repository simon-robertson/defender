// Four cardinal neighbours per affordable campaign generator. Independent of
// the six reserved combat Arc slots and the model/transient uniform budget.
export const MAX_GENERATOR_LIGHTS=128,GENERATOR_LIGHT_FLOATS=8;
export const GENERATOR_LIGHT_BYTES=(4+MAX_GENERATOR_LIGHTS*GENERATOR_LIGHT_FLOATS)*4;
export const GENERATOR_EMPTY_LIGHT_BYTES=(4+GENERATOR_LIGHT_FLOATS)*4;
export const GENERATOR_LIGHT_RADIUS=14,GENERATOR_LIGHT_STRENGTH=1.8;
export const GENERATOR_LIGHT_COLOR=Object.freeze([.08,1,.16]);
