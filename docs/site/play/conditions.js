// Each zone repeats the same authored four-level daylight progression.
import {levelLighting} from '../engine/environment.js';
export const PLAY_NIGHT_LIGHTING=Object.freeze({color:'#708ABA',ambient:'#263754'});
export const PLAY_AFTERNOON_SUN_SCALE=1.35;
export const PLAY_EVENING_LIGHT_ELEVATION=12;
export const PLAY_NIGHT_SHADOW_LENGTH_SCALE=.25;
const NIGHT_SKY_INTENSITY=.65;
export const PLAY_DAYLIGHT=Object.freeze([
 Object.freeze({period:'day',timeOfDay:10.5,night:false}),
 Object.freeze({period:'late-afternoon',timeOfDay:16.5,night:false}),
 Object.freeze({period:'early-evening',timeOfDay:18.5,night:false}),
 Object.freeze({period:'night',timeOfDay:22,night:true}),
]);
export class LevelConditions {
 reset(){this.levelId=null;this.value=null;}
 forLevel(levelId){
  if(this.levelId!==levelId){this.levelId=levelId;this.value=PLAY_DAYLIGHT[Number(levelId.slice(-2))-1]??PLAY_DAYLIGHT[0];}
  return this.value;
 }
}
export function applyPlayLighting(renderer,conditions){
 if(conditions?.period==='late-afternoon'){
  // Derive from the authored level each time, so retries cannot compound it.
  const sky=levelLighting(renderer.world.level.environment);
  renderer.setLighting({...sky,intensity:sky.intensity*PLAY_AFTERNOON_SUN_SCALE});
  renderer.setLightingColors('#FFD4A2','#C7C8B5');
 }
 else if(conditions?.period==='early-evening'){
  const sky=renderer.world.level.environment.sky,heading=sky.direction;
  // Use the night key light near the horizon, retaining the evening fill.
  const elevation=Math.hypot(heading[0],heading[2])*Math.tan(PLAY_EVENING_LIGHT_ELEVATION*Math.PI/180);
  renderer.setLighting({...sky,direction:[heading[0],elevation,heading[2]],intensity:NIGHT_SKY_INTENSITY,ambientIntensity:.42,color:PLAY_NIGHT_LIGHTING.color,ambient:'#8493B4'});
 }else if(conditions?.night){
  const sky=levelLighting(renderer.world?.level.environment??{sky:{direction:[-.3,1,-.4],intensity:1,ambientIntensity:.6},timeOfDay:22});
  // For a vertical caster on flat ground, length = height * horizontal / Y.
  const heading=renderer.world?.level.environment.sky.direction??sky.direction;
  renderer.setLighting?.({...sky,direction:[heading[0],heading[1]/PLAY_NIGHT_SHADOW_LENGTH_SCALE,heading[2]],intensity:NIGHT_SKY_INTENSITY,ambientIntensity:.85});
  renderer.setLightingColors(PLAY_NIGHT_LIGHTING.color,PLAY_NIGHT_LIGHTING.ambient,PLAY_NIGHT_LIGHTING.ambient);
 }
}
