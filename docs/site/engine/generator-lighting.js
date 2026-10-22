import {MAX_GENERATOR_LIGHTS} from '../shared/generator-lights.js';
// A compact point-light bank keeps generator connections out of the expensive
// segmented Arc loop and below the 16 KiB model-light uniform binding limit.
export const generatorLighting=(group,enabled=true)=>enabled?`
struct GeneratorLight { positionRadius:vec4<f32>, colorStrength:vec4<f32> };
struct GeneratorLights { count:vec4<f32>, lights:array<GeneratorLight> };
@group(${group}) @binding(3) var<storage,read> generatorLights:GeneratorLights;
fn generatorIllumination(world:vec3<f32>,normal:vec3<f32>)->vec3<f32>{
 var result=vec3<f32>(0);
 for(var index=0u;index<min(u32(generatorLights.count.x),min(arrayLength(&generatorLights.lights),${MAX_GENERATOR_LIGHTS}u));index++){
  let positionRadius=generatorLights.lights[index].positionRadius;
  let offset=positionRadius.xyz-world;let d2=dot(offset,offset);let range2=positionRadius.w*positionRadius.w;
  if(range2>0&&d2<range2){
   let colorStrength=generatorLights.lights[index].colorStrength;
   let relative=d2/range2;let edge=1-relative;let diffuse=max(dot(normal,offset*inverseSqrt(max(d2,.01))),0.0);
   result+=colorStrength.rgb*(colorStrength.w*diffuse*edge*edge/(1+relative*13.824));
  }
 }return result;
}
`: 'fn generatorIllumination(world:vec3<f32>,normal:vec3<f32>)->vec3<f32>{return vec3<f32>(0); }\n';
