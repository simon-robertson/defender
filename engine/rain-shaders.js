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
@group(3) @binding(0) var rainScene:texture_2d<f32>;
@group(3) @binding(1) var rainSampler:sampler;
`+shadowVisibility+shotLighting(2,true)+rainLighting+`
struct RainInput { @location(0) column:vec4<f32>, @location(1) shape:vec4<f32> };
struct RainVertex {
 @builtin(position) clip:vec4<f32>, @location(0) uv:vec2<f32>,
 @location(1) world:vec3<f32>, @location(2) @interpolate(flat) limits:vec2<f32>,
 @location(3) @interpolate(flat) alphaScale:f32,
 @location(4) @interpolate(flat) screenSide:vec2<f32>,
 @location(5) @interpolate(flat) screenTail:vec2<f32>
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
  widthScale=max(1,2.0/max(pixels,.0001));
 }
 // Keep subpixel lenses stable in overview, softening their alpha as the
 // silhouette widens rather than adding a camera-distance light source.
 let world=centre+tail*(min(i.shape.x,ceiling-tip)*corner.y)+side*corner.x*i.shape.y*.5*widthScale;
 let tailClip=frame.vp*vec4<f32>(centre+tail,1);
 let screenSide=(sideClip.xy*centreClip.w-centreClip.xy*sideClip.w)*vec2<f32>(1,-1)*frame.viewport.xy;
 let screenTail=(tailClip.xy*centreClip.w-centreClip.xy*tailClip.w)*vec2<f32>(1,-1)*frame.viewport.xy;
 var o:RainVertex;o.clip=frame.vp*vec4<f32>(world,1);o.uv=corner;o.world=world;o.limits=i.shape.zw;o.alphaScale=1/sqrt(widthScale);
 o.screenSide=screenSide/max(length(screenSide),.0001);o.screenTail=screenTail/max(length(screenTail),.0001);return o;
}
fn rainSrgb(c:vec3<f32>)->vec3<f32>{return select(1.055*pow(max(c,vec3<f32>(0)),vec3<f32>(1.0/2.4))-.055,12.92*c,c<=vec3<f32>(.0031308));}
fn rainLinear(c:vec3<f32>)->vec3<f32>{return select(pow((c+.055)/1.055,vec3<f32>(2.4)),c/12.92,c<=vec3<f32>(.04045));}
fn rainSampleUV(uv:vec2<f32>,candidate:vec2<f32>,depth:f32)->vec2<f32>{
 // Reject the complete bilinear footprint when a foreground solid or water
 // would be pulled over the drop. Screen edges fall back to the original ray.
 let footprint=vec2<i32>(floor(candidate*frame.viewport.xy-.5));
 if(any(footprint<vec2<i32>(0))||any(footprint+1>=vec2<i32>(frame.viewport.xy))){return uv;}
 for(var y=0;y<2;y++){for(var x=0;x<2;x++){
  let p=footprint+vec2<i32>(x,y);if(visibleWaterDepth(p)<depth){return uv;}
  for(var sample=0;sample<4;sample++){if(textureLoad(depthMap,p,sample)<depth){return uv;}}
 }}return candidate;
}
@fragment fn fragment(i:RainVertex)->@location(0) vec4<f32>{
 if(i.world.x<0||i.world.z<0||i.world.x>i.limits.x||i.world.z>i.limits.y){discard;}
 let pixel=vec2<i32>(i.clip.xy);var coverage=0.0;
 for(var sample=0;sample<4;sample++){coverage+=select(0.0,.25,i.clip.z<=textureLoad(depthMap,pixel,sample));}
 if(coverage==0||visibleWaterDepth(pixel)<i.clip.z){discard;}
 // A rounded lower bead stretches into a narrow tail. Its curved normal acts
 // as an intentionally strong water lens instead of a white painted streak.
 let profile=.25+.75*sqrt(max(0,1-pow((i.uv.y-.38)/.64,2)))*(1-.45*i.uv.y);
 let across=i.uv.x/profile;let edge=1-smoothstep(.6,1,abs(across));
 let ends=smoothstep(0,.12,i.uv.y)*(1-smoothstep(.75,1,i.uv.y));
 let alpha=edge*ends*${RAIN_OPACITY}*coverage*i.alphaScale;if(alpha<.003){discard;}
 let normal=normalize(vec3<f32>(across,(i.uv.y-.38)*.55,sqrt(max(.02,1-across*across))));
 let bent=refract(vec3<f32>(0,0,-1),normal,1.0/1.333);
 let uv=i.clip.xy*frame.viewport.zw;
 let offset=(i.screenSide*bent.x+i.screenTail*bent.y)*32.0*frame.viewport.zw;
 let sampleUV=rainSampleUV(uv,uv+offset,i.clip.z);
 let transmitted=rainLinear(textureSampleLevel(rainScene,rainSampler,sampleUV,0).rgb);
 let view=toEye(i.world);let lighting=rainIllumination(i.world,view,visibility(i.world,frame.sun.xyz));
 let rim=.0204+.9796*pow(1-normal.z,5);
 let color=transmitted*(1-rim)+lighting*(.08+rim*2.4);
 return vec4<f32>(rainSrgb(clamp(color,vec3<f32>(0),vec3<f32>(1))),alpha);
}
`;
