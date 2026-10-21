import {EnemyPreview,DOG_PREVIEW_ACTORS} from './enemy-preview.js';
export {DOG_PREVIEW_ACTORS} from './enemy-preview.js';
export const DOG_AIM_HEIGHT=11.5;

// Compatibility for existing dog-only tooling; the gait and timing are unchanged.
export class DogPreview extends EnemyPreview {
 constructor(world,onPoseChange,onDeath=null){
  super(world,onPoseChange,onDeath,world.level.id==='moss-01'?DOG_PREVIEW_ACTORS:[]);
 }
}
