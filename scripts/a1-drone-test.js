// The accepted Southern Hook remains the scenery/route authority. This wrapper
// adds only the user-authorised two-drone combat study; no waves or economy.
import {carveMoss01} from './a1-path-carving.js';

export const A1_DRONE_PADS=Object.freeze([
 Object.freeze({id:'drone-1',model:'drone-defence',variant:'base',box:Object.freeze([4,0,9]),turn:0}),
 Object.freeze({id:'drone-2',model:'drone-defence',variant:'base',box:Object.freeze([15,0,9]),turn:0}),
]);
export const A1_DRONE_ENEMIES=Object.freeze([
 Object.freeze({id:'preview-dog-1',modelId:'dog',variant:'base',startDistance:72,routeId:'main'}),
 Object.freeze({id:'preview-dog-2',modelId:'dog',variant:'base',startDistance:300,routeId:'main'}),
 Object.freeze({id:'preview-moth-1',modelId:'moth',variant:'base',startDistance:180,routeId:'main'}),
]);
export async function a1DroneTest(){
 const {level}=await carveMoss01();
 level.previewMode='combat';
 level.placements.push(...structuredClone(A1_DRONE_PADS));
 level.previewActors=structuredClone(A1_DRONE_ENEMIES);
 // The original corner seed belongs to an eight-node scenery pocket. Keep
 // the accepted landscape intact and seed this hare on connected open ground.
 level.previewWildlife.habitatPoints[1]=[106,24,250];
 level.previewWildlife.habitats[1]=[4,10];
 return level;
}
