import {previewLevelForId} from './preview-levels.js';
import {isNonCombatPreview} from './preview-mode.js';

const roster=(model,distances)=>Object.freeze(distances.map((distance,index)=>Object.freeze({id:'preview-'+model+'-'+(index+1),model,variant:'base',distance})));
// Preserve the original actor identities and starts for isolated legacy studies.
export const DOG_PREVIEW_ACTORS=roster('dog',[72,232,392]);
export const WALKER_PREVIEW_ACTORS=roster('walker',[72,232,720]);
export const SPIDER_PREVIEW_ACTORS=roster('spider',[72,232,624]);
const EMPTY=Object.freeze([]);

// Provisional shape-based movement, not enemy abilities or campaign classes.
// Altitude is the fixed root height above the shared flat path. Real gun pitch,
// scenery visibility and projectile contact still decide whether a shot works.
const movement=(speed,turnDistance,airborne=false,altitude=0)=>Object.freeze({speed,turnDistance,airborne,altitude});
export const ENEMY_MOVEMENT=Object.freeze({
 roller:movement(16,6),
 'dune-tread':movement(10,6),
 tripod:movement(14,12),
 moth:movement(20,12,true,36),
 'twin-fan':movement(18,12,true,36),
 ray:movement(22,12,true,36),
 lantern:movement(16,12,true,36),
});

// Two instances of each new type keep their silhouettes visible together.
// Starts are separated from the unchanged original actors and are shared by
// all three defence studies. These finite groups do not implement wave spawns.
const mixed=(original,ground,air)=>Object.freeze([...original,...roster(ground,[136,360]),...roster(air,[184,472])]);
export const MIXED_PREVIEW_ACTORS=Object.freeze({
 A:mixed(DOG_PREVIEW_ACTORS,'roller','moth'),
 B:mixed(WALKER_PREVIEW_ACTORS,'dune-tread','twin-fan'),
 C:mixed(EMPTY,'tripod','ray'),
 D:Object.freeze([...SPIDER_PREVIEW_ACTORS,...roster('lantern',[184,472])]),
});
// ID-only calls retain the historical roster for combat study tools. Runtime
// callers use the loaded source so noncombat previews never request enemies.
export function previewActorsForLevel(levelOrId){
 const level=typeof levelOrId==='object'&&levelOrId!==null?levelOrId:null;
 if(isNonCombatPreview(level))return EMPTY;
 if(level?.previewMode==='combat')return Object.freeze((level.previewActors??EMPTY).map(actor=>Object.freeze({id:actor.id,model:actor.modelId,variant:actor.variant,distance:actor.startDistance,routeId:actor.routeId})));
 return MIXED_PREVIEW_ACTORS[previewLevelForId(level?.id??levelOrId)?.zone]??EMPTY;
}
