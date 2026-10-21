import {waterDepthRead} from './water-depth.js';
// Selective emitter bloom; no brightness threshold or exposure adjustment.
export const BLOOM_SCALE=4;
export const BLOOM_STRENGTH=.70;
export const bloomSettings=`
struct BloomSettings { pixelScale:vec4<f32> };
@group(3) @binding(0) var<uniform> bloomSettings:BloomSettings;
fn bloomLinear(c:vec3<f32>)->vec3<f32>{return select(pow((c+.055)/1.055,vec3<f32>(2.4)),c/12.92,c<=vec3<f32>(.04045));}
`;
const triangle=`
@vertex fn vertex(@builtin(vertex_index) index:u32)->@builtin(position) vec4<f32>{
 let x=f32((index<<1u)&2u);let y=f32(index&2u);return vec4<f32>(x*2-1,y*2-1,0,1);
}
`;
export const bloomExtract=frame=>frame+`
@group(1) @binding(0) var colorMap:texture_2d<f32>;
@group(1) @binding(2) var depthMap:texture_depth_multisampled_2d;
@group(1) @binding(4) var waterDepth:texture_depth_2d;
${waterDepthRead}
`+triangle+`
fn sourceWorld(pixel:vec2<i32>,depth:f32)->vec3<f32>{
 let uv=(vec2<f32>(pixel)+.5)*frame.viewport.zw;
 let world=frame.inverseVP*vec4<f32>(uv*vec2<f32>(2,-2)+vec2<f32>(-1,1),depth,1);return world.xyz/world.w;
}
@fragment fn fragment(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{
 let size=vec2<i32>(textureDimensions(colorMap));let ratio=vec2<f32>(size)/ceil(vec2<f32>(size)/${BLOOM_SCALE}.0);let origin=(p.xy-.5)*ratio;var color=vec3<f32>(0);
 // Explicit box integration retains tiny emissive strips at overview scale.
 for(var y=0;y<${BLOOM_SCALE};y++){for(var x=0;x<${BLOOM_SCALE};x++){
  let pixel=min(vec2<i32>(origin+(vec2<f32>(f32(x),f32(y))+.5)*ratio/${BLOOM_SCALE}.0),size-1);
  let surface=textureLoad(colorMap,pixel,0);if(surface.a<=0){continue;}
  let d=min(min(textureLoad(depthMap,pixel,0),textureLoad(depthMap,pixel,1)),min(textureLoad(depthMap,pixel,2),textureLoad(depthMap,pixel,3)));
  let water=visibleWaterDepth(pixel);var transmission=1.0;
  if(water<d){let travel=clamp(distance(sourceWorld(pixel,water),sourceWorld(pixel,d)),0,60);transmission=(1-frame.waterProperties.x)*exp(-frame.waterProperties.y*travel);}
  color+=surface.rgb*surface.a*transmission;
 }}return vec4<f32>(color/${BLOOM_SCALE*BLOOM_SCALE}.0,1);
}
`;
export const bloomBlur=`
@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var linearSampler:sampler;
`+triangle+`
fn blur(pixel:vec2<f32>,axis:vec2<f32>)->vec4<f32>{
 let inverse=1/vec2<f32>(textureDimensions(source));let uv=pixel*inverse;
 var color=textureSampleLevel(source,linearSampler,uv,0).rgb*.39905028;
 color+=(textureSampleLevel(source,linearSampler,uv+axis*inverse,0).rgb+textureSampleLevel(source,linearSampler,uv-axis*inverse,0).rgb)*.24203623;
 color+=(textureSampleLevel(source,linearSampler,uv+axis*inverse*2,0).rgb+textureSampleLevel(source,linearSampler,uv-axis*inverse*2,0).rgb)*.05400558;
 color+=(textureSampleLevel(source,linearSampler,uv+axis*inverse*3,0).rgb+textureSampleLevel(source,linearSampler,uv-axis*inverse*3,0).rgb)*.00443305;
 return vec4<f32>(color,1);
}
@fragment fn horizontal(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{return blur(p.xy,vec2<f32>(1,0));}
@fragment fn vertical(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{return blur(p.xy,vec2<f32>(0,1));}
`;
export const bloomCompositeBindings=`
@group(3) @binding(0) var bloomMap:texture_2d<f32>;
@group(3) @binding(1) var bloomSampler:sampler;
`;
export const bloomCompositeAdd=`color+=textureSampleLevel(bloomMap,bloomSampler,uv,0).rgb*${BLOOM_STRENGTH};`;
