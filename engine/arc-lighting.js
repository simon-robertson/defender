import {ARC_LIGHT_SEGMENTS} from '../shared/arc-effects.js';
import {MAX_TUBE_LIGHTS} from '../shared/plasma-links.js';

// A distinct continuous finite-segment source. Adjacent segments are one tube
// field: strongest contribution wins within a strike; independent strikes add.
// This avoids tessellation-dependent brightness and endpoint-only lighting.
export const arcLighting=(group,enabled=true)=>enabled?`
struct ArcSegment { startRadius:vec4<f32>, endStrength:vec4<f32> };
struct ArcLight { colorRadius:vec4<f32>, strengthCount:vec4<f32>, segments:array<ArcSegment,${ARC_LIGHT_SEGMENTS}>, bounds:vec4<f32> };
struct ArcLights { count:vec4<f32>, lights:array<ArcLight> };
@group(${group}) @binding(2) var<storage,read> arcLights:ArcLights;
fn arcIllumination(world:vec3<f32>,normalOrView:vec3<f32>,mode:u32)->vec3<f32>{
 var result=vec3<f32>(0);
 for(var index=0u;index<min(u32(arcLights.count.x),min(arrayLength(&arcLights.lights),${MAX_TUBE_LIGHTS}u));index++){
  let bounds=arcLights.lights[index].bounds;let fromCentre=world-bounds.xyz;
  // Zero radius retains unbounded diagnostic records; production pools always
  // pack a conservative sphere enclosing every finite segment and falloff.
  if(bounds.w>0&&dot(fromCentre,fromCentre)>bounds.w*bounds.w){continue;}
  let light=arcLights.lights[index];var strongest=0.0;
  for(var segmentIndex=0u;segmentIndex<min(u32(light.strengthCount.y),${ARC_LIGHT_SEGMENTS}u);segmentIndex++){
   let segment=light.segments[segmentIndex];let axis=segment.endStrength.xyz-segment.startRadius.xyz;
   let t=clamp(dot(world-segment.startRadius.xyz,axis)/max(dot(axis,axis),.000001),0.0,1.0);
   let offset=segment.startRadius.xyz+axis*t-world;let d2=dot(offset,offset);
   let radius=light.colorRadius.w*segment.startRadius.w;let range2=radius*radius;
   if(range2>0&&d2<range2){
    let direction=offset*inverseSqrt(max(d2,.01));let cosine=dot(normalOrView,direction);
    var response=max(cosine,0.0);
    if(mode==1u){response=.28+.62*pow(max(-cosine,0.0),8)+.1*cosine*cosine;}
    if(mode==2u){response=abs(cosine);}
    let relative=d2/range2;let edge=1-relative;
    strongest=max(strongest,segment.endStrength.w*response*edge*edge/(1+relative*13.824));
   }
  }
  result+=light.colorRadius.rgb*(light.strengthCount.x*strongest);
 }return result;
}
`: 'fn arcIllumination(world:vec3<f32>,normalOrView:vec3<f32>,mode:u32)->vec3<f32>{return vec3<f32>(0);}\n';
