import {waterDepthRead} from './water-depth.js';
import {bloomSettings} from './bloom-shaders.js';
import {MAX_LOCAL_LIGHTS} from '../shared/shot-effects.js';
import {MAX_MODEL_LIGHTS,MAX_SUPPORTED_MODEL_LIGHTS} from '../shared/model-lights.js';
import {arcLighting} from './arc-lighting.js';
import {generatorLighting} from './generator-lighting.js';

// Shader strings keep their byte-identical preview default. A separate player
// renderer specializes both the uniform array and every light-loop bound once
// during pipeline construction; no runtime shader branch or extra pass is added.
export function specializeLocalLights(code,capacity=MAX_LOCAL_LIGHTS){
 if(!Number.isInteger(capacity)||capacity<1||capacity>MAX_LOCAL_LIGHTS-MAX_MODEL_LIGHTS+MAX_SUPPORTED_MODEL_LIGHTS)throw new Error('Unsupported local-light shader capacity.');
 if(capacity===MAX_LOCAL_LIGHTS)return code;
 return code.replaceAll(`array<ShotLight,${MAX_LOCAL_LIGHTS}>`,`array<ShotLight,${capacity}>`).replaceAll(`min(u32(shotLights.count.x),${MAX_LOCAL_LIGHTS}u)`,`min(u32(shotLights.count.x),${capacity}u)`);
}

export const shotLighting=(group,arcs=false)=>arcLighting(group,arcs)+generatorLighting(group,arcs)+`
struct ShotLight { positionRadius:vec4<f32>, colorStrength:vec4<f32> };
struct ShotLights { count:vec4<f32>, lights:array<ShotLight,${MAX_LOCAL_LIGHTS}> };
@group(${group}) @binding(1) var<uniform> shotLights:ShotLights;
fn muzzleLighting(world:vec3<f32>,normal:vec3<f32>)->vec3<f32>{
 var result=vec3<f32>(0);
 for(var index=0u;index<min(u32(shotLights.count.x),${MAX_LOCAL_LIGHTS}u);index++){
  let light=shotLights.lights[index];let offset=light.positionRadius.xyz-world;
  let d2=dot(offset,offset);let range2=light.positionRadius.w*light.positionRadius.w;
  if(d2<range2){
   let relativeD2=d2/range2;let edge=1-relativeD2;let diffuse=max(dot(normal,offset*inverseSqrt(max(d2,.01))),0);
   // Preserve the original 48-unit curve (48*48*.006 = 13.824), scaling
   // the entire falloff with radius rather than only extending its cutoff.
   result+=light.colorStrength.rgb*(light.colorStrength.w*diffuse*edge*edge/(1+relativeD2*13.824));
  }
 }return result+arcIllumination(world,normal,0u)+generatorIllumination(world,normal);
}
`;

// One instanced draw for compact flame shapes and local sparks. These are
// procedural, depth-tested transparent shapes, not textures or projectiles.
export const shotParticles=frameUniforms=>frameUniforms+bloomSettings+`
@group(1) @binding(2) var depthMap:texture_depth_multisampled_2d;
@group(1) @binding(4) var waterDepth:texture_depth_2d;
${waterDepthRead}
struct ParticleInput {
 @location(0) positionSize:vec4<f32>, @location(1) directionLength:vec4<f32>,
 @location(2) colorAlpha:vec4<f32>, @location(3) shape:vec4<f32>
};
struct ParticleVertex {
 @builtin(position) clip:vec4<f32>, @location(0) uv:vec2<f32>,
 @location(1) colorAlpha:vec4<f32>, @location(2) @interpolate(flat) shape:vec2<f32>
};
@vertex fn vertex(i:ParticleInput,@builtin(vertex_index) index:u32)->ParticleVertex {
 let corners=array<vec2<f32>,6>(vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
 let corner=corners[index];let centre=i.positionSize.xyz;let view=toEye(centre);
 var right=cross(vec3<f32>(0,1,0),view);
 if(dot(right,right)<.0001){right=vec3<f32>(1,0,0);}right=normalize(right);
 let up=cross(view,right);var world=centre;
 if(i.shape.x<.5){
  let axis=i.directionLength.xyz;var side=cross(axis,view);
  if(dot(side,side)<.0001){side=right;}else{side=normalize(side);}
  world+=axis*((corner.x+1)*.5*i.directionLength.w)+side*corner.y*i.positionSize.w;
 }else{world+=(right*corner.x+up*corner.y)*i.positionSize.w;}
 var o:ParticleVertex;o.clip=frame.vp*vec4<f32>(world,1);o.uv=corner;o.colorAlpha=i.colorAlpha;o.shape=i.shape.xy;return o;
}
fn particleColor(i:ParticleVertex,pixel:vec2<i32>)->vec4<f32>{
 var coverage=0.0;
 for(var sample=0;sample<4;sample++){coverage+=select(0.0,.25,i.clip.z<=textureLoad(depthMap,pixel,sample));}
 if(coverage==0){discard;}
 var color=i.colorAlpha.rgb;var mask=0.0;
 if(i.shape.x<.5){
  let u=(i.uv.x+1)*.5;
  let width=(.28+.72*sin(u*3.14159))*(1-u)*(.88+.12*sin(u*28+i.shape.y));
  mask=1-smoothstep(width*.45,width+.015,abs(i.uv.y));
  if(i.shape.x<-.5){color=mix(vec3<f32>(1),i.colorAlpha.rgb,smoothstep(.2,.95,u));}
  else{color=mix(vec3<f32>(1,.96,.78),vec3<f32>(1,.28,.035),smoothstep(.12,.95,u));}
 }else if(i.shape.x<1.5){
  let radius=length(i.uv);mask=pow(max(0,1-radius*radius),2);
  color=mix(vec3<f32>(1,1,.91),color,smoothstep(.2,.9,radius));
 }else{mask=1-smoothstep(.45,1,abs(i.uv.x)+abs(i.uv.y));}
 var alpha=mask*i.colorAlpha.w*coverage;
 // Existing water is translucent; attenuate a particle behind its surface.
 if(visibleWaterDepth(pixel)<i.clip.z){alpha*=.3;}
 if(alpha<.003){discard;}
 return vec4<f32>(color,alpha);
}
@fragment fn fragment(i:ParticleVertex)->@location(0) vec4<f32>{return particleColor(i,vec2<i32>(i.clip.xy));}
@fragment fn bloomFragment(i:ParticleVertex)->@location(0) vec4<f32>{
 // Sparks remain unchanged; only the paired flame and hot core are emitters.
 if(i.shape.x>=1.5){discard;}
 let color=particleColor(i,vec2<i32>(i.clip.xy*bloomSettings.pixelScale.xy));
 return vec4<f32>(bloomLinear(color.rgb)*color.a,1);
}
`;
