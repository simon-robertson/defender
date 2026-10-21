import {waterDepthRead} from './water-depth.js';
import {uniforms,shadowVisibility} from './shaders.js';
import {shotLighting} from './shot-shaders.js';
import {MAX_LOCAL_LIGHTS} from '../shared/shot-effects.js';
import {RAIN_HEIGHT,RAIN_OPACITY} from './rain.js';

// Shared verbatim with the developer GPU readback check. Thin droplets scatter
// from either side, with a stronger forward lobe when backlit; they are not
// opaque upward-facing diffuse surfaces and have no emissive floor.
export const rainLighting=`
fn dropletPhase(lightDirection:vec3<f32>,view:vec3<f32>)->f32{
 let cosine=dot(lightDirection,view);
 return .28+.62*pow(max(-cosine,0),8)+.1*cosine*cosine;
}
fn rainMuzzleLighting(world:vec3<f32>,view:vec3<f32>)->vec3<f32>{
 var result=vec3<f32>(0);
 for(var index=0u;index<min(u32(shotLights.count.x),${MAX_LOCAL_LIGHTS}u);index++){
  let light=shotLights.lights[index];let offset=light.positionRadius.xyz-world;
  let d2=dot(offset,offset);let range2=light.positionRadius.w*light.positionRadius.w;
  if(d2<range2){
   let relativeD2=d2/range2;let edge=1-relativeD2;
   // Same spatial falloff as production muzzle lighting, with transmissive
   // droplet scattering replacing its opaque-surface Lambert normal term.
   result+=light.colorStrength.rgb*(light.colorStrength.w*dropletPhase(offset*inverseSqrt(max(d2,.01)),view)*edge*edge/(1+relativeD2*13.824));
  }
 }return result+arcIllumination(world,view,1u);
}
fn rainIllumination(world:vec3<f32>,view:vec3<f32>,skyVisibility:f32)->vec3<f32>{
 return frame.ambient.rgb*frame.sunColor.w+frame.sunColor.rgb*frame.sun.w*skyVisibility*dropletPhase(frame.sun.xyz,view)+rainMuzzleLighting(world,view);
}
`;

export const rainParticles=uniforms+`
@group(1) @binding(2) var depthMap:texture_depth_multisampled_2d;
@group(1) @binding(4) var waterDepth:texture_depth_2d;
${waterDepthRead}
@group(2) @binding(0) var shadowMap:texture_depth_2d;
`+shadowVisibility+shotLighting(2,true)+rainLighting+`
struct RainInput { @location(0) column:vec4<f32>, @location(1) shape:vec4<f32> };
struct RainVertex {
 @builtin(position) clip:vec4<f32>, @location(0) uv:vec2<f32>,
 @location(1) world:vec3<f32>, @location(2) @interpolate(flat) limits:vec2<f32>,
 @location(3) @interpolate(flat) alphaScale:f32
};
@vertex fn vertex(i:RainInput,@builtin(vertex_index) index:u32)->RainVertex{
 let corners=array<vec2<f32>,6>(vec2(-1,0),vec2(1,0),vec2(-1,1),vec2(-1,1),vec2(1,0),vec2(1,1));
 let corner=corners[index];let lower=i.column.z;let ceiling=lower+${RAIN_HEIGHT}.0;
 let tip=ceiling-((i.column.w+frame.timing.w)%${RAIN_HEIGHT}.0);
 let centre=vec3<f32>(i.column.x,tip,i.column.y);let view=toEye(centre);
 let tail=vec3<f32>(0,1,0);
 var side=cross(tail,view);if(dot(side,side)<.0001){side=vec3<f32>(1,0,0);}else{side=normalize(side);}
 let centreClip=frame.vp*vec4<f32>(centre,1);let sideClip=frame.vp*vec4<f32>(centre+side*i.shape.y*.5,1);
 var widthScale=1.0;
 if(centreClip.w>0&&sideClip.w>0){
  let pixels=length((sideClip.xy/sideClip.w-centreClip.xy/centreClip.w)*frame.viewport.xy);
  widthScale=max(1,1.25/max(pixels,.0001));
 }
 // Keep subpixel streaks stable in overview. Compensated alpha preserves their
 // coverage instead of adding an emissive or camera-distance brightness floor.
 let world=centre+tail*(min(i.shape.x,ceiling-tip)*corner.y)+side*corner.x*i.shape.y*.5*widthScale;
 var o:RainVertex;o.clip=frame.vp*vec4<f32>(world,1);o.uv=corner;o.world=world;o.limits=i.shape.zw;o.alphaScale=1/widthScale;return o;
}
fn rainSrgb(c:vec3<f32>)->vec3<f32>{return select(1.055*pow(max(c,vec3<f32>(0)),vec3<f32>(1.0/2.4))-.055,12.92*c,c<=vec3<f32>(.0031308));}
@fragment fn fragment(i:RainVertex)->@location(0) vec4<f32>{
 if(i.world.x<0||i.world.z<0||i.world.x>i.limits.x||i.world.z>i.limits.y){discard;}
 let pixel=vec2<i32>(i.clip.xy);var coverage=0.0;
 for(var sample=0;sample<4;sample++){coverage+=select(0.0,.25,i.clip.z<=textureLoad(depthMap,pixel,sample));}
 if(coverage==0||visibleWaterDepth(pixel)<i.clip.z){discard;}
 let edge=1-smoothstep(.15,1,abs(i.uv.x));let ends=smoothstep(0,.12,i.uv.y)*(1-smoothstep(.7,1,i.uv.y));
 let alpha=edge*ends*${RAIN_OPACITY}*coverage*i.alphaScale;if(alpha<.003){discard;}
 let view=toEye(i.world);let lighting=rainIllumination(i.world,view,visibility(i.world,frame.sun.xyz));
 // Neutral white droplets inherit the actual light colour. Alpha blending
 // retains the scene beneath them, including through each streak's soft edges.
 return vec4<f32>(rainSrgb(clamp(lighting,vec3<f32>(0),vec3<f32>(1))),alpha);
}
`;
