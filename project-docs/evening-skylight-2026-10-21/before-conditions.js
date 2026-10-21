// Each zone repeats a deterministic four-level daylight progression; weather stays clear.
import {levelLighting} from '../engine/environment.js';
export const PLAY_NIGHT_LIGHTING=Object.freeze({color:'#708ABA',ambient:'#263754'});
export const PLAY_AFTERNOON_SUN_SCALE=1.35;
export const PLAY_DAYLIGHT=Object.freeze([
 Object.freeze({period:'day',timeOfDay:10.5,night:false,weather:false}),
 Object.freeze({period:'late-afternoon',timeOfDay:16.5,night:false,weather:false}),
 Object.freeze({period:'early-evening',timeOfDay:18.5,night:false,weather:false}),
 Object.freeze({period:'night',timeOfDay:22,night:true,weather:false}),
]);
export class LevelConditions {
 constructor(){this.reset();}
 reset(){this.levelId=null;this.value=null;}
 forLevel(levelId){if(this.levelId!==levelId){this.levelId=levelId;const index=Number(levelId.slice(-2))-1;this.value=PLAY_DAYLIGHT[index]??PLAY_DAYLIGHT[0];}return this.value;}
}
export function applyPlayLighting(renderer,conditions){
 if(conditions?.period==='late-afternoon'){
  // Derive from the authored level each time, so retries cannot compound it.
  const sky=levelLighting(renderer.world.level.environment);
  renderer.setLighting({...sky,intensity:sky.intensity*PLAY_AFTERNOON_SUN_SCALE});
  renderer.setLightingColors('#FFD4A2','#C7C8B5');
 }
 else if(conditions?.period==='early-evening'){
  const sky=levelLighting({...renderer.world.level.environment,timeOfDay:17.4});
  renderer.setLighting({...sky,intensity:sky.intensity*.65,ambientIntensity:.42,color:'#E4A1A4',ambient:'#8493B4'});
 }else if(conditions?.night){
  const sky=levelLighting(renderer.world?.level.environment??{sky:{direction:[-.3,1,-.4],intensity:1,ambientIntensity:.6},timeOfDay:22});
  renderer.setLighting?.({...sky,direction:renderer.world?.level.environment.sky.direction??sky.direction,intensity:.65,ambientIntensity:.85});
  renderer.setLightingColors(PLAY_NIGHT_LIGHTING.color,PLAY_NIGHT_LIGHTING.ambient,PLAY_NIGHT_LIGHTING.ambient);
 }
}
