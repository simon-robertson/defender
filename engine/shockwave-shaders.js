import {waterDepthRead} from './water-depth.js';
import {uniforms} from './shaders.js';
import {MAX_BLASTS} from '../shared/damage-effects.js';

// The source already contains display-converted water, SSR and all particles.
// Read-only opaque/water depth protects foreground geometry at both samples.
// Transparent particles share their underlying surface depth in this bounded
// screen-space approximation; no additional transparent-depth pass is added.
export const shockwaveRefraction=uniforms+`
struct Wave { positionRadius:vec4<f32>, shape:vec4<f32> };
struct Waves { count:vec4<f32>, items:array<Wave,${MAX_BLASTS}> };
@group(1) @binding(0) var source:texture_2d<f32>;
@group(1) @binding(1) var sourceSampler:sampler;
@group(1) @binding(2) var opaqueDepth:texture_depth_multisampled_2d;
@group(1) @binding(3) var waterDepth:texture_depth_2d;
${waterDepthRead}
@group(1) @binding(4) var<uniform> waves:Waves;
@vertex fn vertex(@builtin(vertex_index) index:u32)->@builtin(position) vec4<f32>{
 let x=f32((index<<1u)&2u);let y=f32(index&2u);return vec4<f32>(x*2-1,y*2-1,0,1);
}
fn worldAt(uv:vec2<f32>,depth:f32)->vec3<f32>{
 let p=frame.inverseVP*vec4<f32>(uv*vec2<f32>(2,-2)+vec2<f32>(-1,1),depth,1);return p.xyz/p.w;
}
fn nearestDepth(uv:vec2<f32>)->f32{
 let pixel=vec2<i32>(uv*frame.viewport.xy);var depth=visibleWaterDepth(pixel);
 for(var sample=0;sample<4;sample++){depth=min(depth,textureLoad(opaqueDepth,pixel,sample));}return depth;
}
fn screenPoint(world:vec3<f32>)->vec3<f32>{
 let p=frame.vp*vec4<f32>(world,1);if(p.w<=0){return vec3<f32>(0,0,-1);}return vec3<f32>(p.xy/p.w*vec2<f32>(.5,-.5)+.5,p.z/p.w);
}
// xyz is the first visible shell intersection; w is its projected rim weight.
fn waveFront(origin:vec3<f32>,direction:vec3<f32>,wave:Wave)->vec4<f32>{
 let offset=wave.positionRadius.xyz-origin;let along=dot(offset,direction);
 let perpendicular=offset-direction*along;let distance2=dot(perpendicular,perpendicular);
 let halfWidth=wave.shape.x*.5;let outer=wave.positionRadius.w+halfWidth;
 if(halfWidth<=0||outer<=0||distance2>=outer*outer){return vec4<f32>(0);}
 let chord=sqrt(max(0,outer*outer-distance2));var travel=along-chord;
 if(travel<0){travel=along+chord;}if(travel<=0){return vec4<f32>(0);}
 let weight=1-smoothstep(0,halfWidth,abs(sqrt(distance2)-wave.positionRadius.w));
 return vec4<f32>(origin+direction*travel,weight);
}
@fragment fn fragment(@builtin(position) pixel:vec4<f32>)->@location(0) vec4<f32>{
 let uv=pixel.xy*frame.viewport.zw;let depth=nearestDepth(uv);var displacement=vec2<f32>(0);
 let count=min(u32(waves.count.x),${MAX_BLASTS}u);let edge=frame.viewport.zw*.5;
 let origin=worldAt(uv,0);let direction=normalize(worldAt(uv,1)-origin);var fronts:array<vec4<f32>,${MAX_BLASTS}>;
 for(var index=0u;index<count;index++){
  let wave=waves.items[index];if(wave.shape.y<=0){continue;}
  let front=waveFront(origin,direction,wave);fronts[index]=front;if(front.w<=0){continue;}
  let screen=screenPoint(front.xyz);if(screen.z<0||screen.z>depth){continue;}
  let normal=normalize(front.xyz-wave.positionRadius.xyz);
  let shifted=screenPoint(front.xyz+normal*wave.shape.y*front.w);
  if(shifted.z<0){continue;}
  displacement+=shifted.xy-screen.xy;
 }
 var sampleUV=uv+displacement;
 if(any(sampleUV<edge)||any(sampleUV>vec2<f32>(1)-edge)){sampleUV=uv;}
 if(any(displacement!=vec2<f32>(0))){
  // Refraction must not pull a closer object across the wave's silhouette.
  // The nearest contributing shell protects against overlapping waves too.
  var nearestFront=1.0;var found=false;
  let candidateOrigin=worldAt(sampleUV,0);let candidateDirection=normalize(worldAt(sampleUV,1)-candidateOrigin);
  for(var index=0u;index<count;index++){
   let wave=waves.items[index];let front=fronts[index];
   if(wave.shape.y<=0||front.w<=0||screenPoint(front.xyz).z>depth){continue;}
   let candidate=waveFront(candidateOrigin,candidateDirection,wave);if(candidate.w<=0){continue;}
   nearestFront=min(nearestFront,screenPoint(candidate.xyz).z);found=true;
  }
  if(!found||nearestDepth(sampleUV)<nearestFront){sampleUV=uv;}
 }
 return textureSampleLevel(source,sourceSampler,sampleUV,0);
}
`;
