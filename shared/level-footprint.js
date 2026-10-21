import {BOX_SIZE} from './grid.js';

// User-locked campaign footprint: Zone D level 3, 18 October 2026.
// Generic workshop/test scenes may use other sizes; production authoring may not.
export const LEVEL_FOOTPRINT=Object.freeze([20,16]);
export const LEVEL_WORLD_FOOTPRINT=Object.freeze(LEVEL_FOOTPRINT.map(n=>n*BOX_SIZE));

export function assertLevelFootprint(level){
 if(!Array.isArray(level.size)||level.size.length!==2||level.size.some((n,i)=>n!==LEVEL_FOOTPRINT[i])){
  throw new Error(`Production level ${level.id??''} must be ${LEVEL_FOOTPRINT.join('×')} boxes.`);
 }
 return level;
}
