import {previewActorsForLevel} from '../shared/enemy-roster.js';
import {wildlifeActorsForLevel} from './wildlife-preview.js';
import {missileActorsForLevel} from './missile-preview.js';

// The fetched level owns the mode and wildlife seeds. Never infer runtime
// enemies or projectiles from a noncombat preview's historical catalogue ID.
export function actorsForPreview(level){
 return [...previewActorsForLevel(level),...wildlifeActorsForLevel(level),...missileActorsForLevel(level)];
}
