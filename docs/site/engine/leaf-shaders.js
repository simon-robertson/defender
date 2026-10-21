import {waterDepthRead} from './water-depth.js';
import {uniforms,shadowVisibility} from './shaders.js';
import {shotLighting} from './shot-shaders.js';
import {MAX_LOCAL_LIGHTS} from '../shared/shot-effects.js';
import {LEAF_COLORS,LEAF_FALL_SPEED,LEAF_WIDTH_RATIO,LEAF_SPIN_RATE,LEAF_TUMBLE_RATE,LEAF_OPACITY} from '../shared/leaf-effects.js';

const linear=hex=>[1,3,5].map(at=>{const value=parseInt(hex.slice(at,at+2),16)/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;});
// Thin matte leaves receive light on both sides using their tumbling plane,
// with the same bounded point-light falloff as the existing scene materials.
export const leafLighting=`
fn leafMuzzleLighting(world:vec3<f32>,normal:vec3<f32>)->vec3<f32>{
 var result=vec3<f32>(0);
 for(var index=0u;index<min(u32(shotLights.count.x),${MAX_LOCAL_LIGHTS}u);index++){
  let light=shotLights.lights[index];let offset=light.positionRadius.xyz-world;let d2=dot(offset,offset);let range2=light.positionRadius.w*light.positionRadius.w;
  if(d2<range2){let relativeD2=d2/range2;let edge=1-relativeD2;let diffuse=abs(dot(normal,offset*inverseSqrt(max(d2,.01))));
   result+=light.colorStrength.rgb*(light.colorStrength.w*diffuse*edge*edge/(1+relativeD2*13.824));
  }
 }return result+arcIllumination(world,normal,2u);
}
fn leafIllumination(world:vec3<f32>,normal:vec3<f32>)->vec3<f32>{
 let skyNormal=select(-normal,normal,dot(normal,frame.sun.xyz)>=0);
 return frame.ambient.rgb*frame.sunColor.w+frame.sunColor.rgb*frame.sun.w*abs(dot(normal,frame.sun.xyz))*visibility(world,skyNormal)+leafMuzzleLighting(world,normal);
}
`;

export const leafParticles=uniforms+`
@group(1) @binding(2) var depthMap:texture_depth_multisampled_2d;
@group(1) @binding(4) var waterDepth:texture_depth_2d;
${waterDepthRead}
@group(2) @binding(0) var shadowMap:texture_depth_2d;
`+shadowVisibility+shotLighting(2,true)+leafLighting+`
const LEAF_PALETTE=array<vec3<f32>,${LEAF_COLORS.length}>(${LEAF_COLORS.map(color=>'vec3<f32>('+linear(color).join(',')+')').join(',')});
struct LeafInput { @location(0) spawn:vec4<f32>, @location(1) motion:vec4<f32>, @location(2) limits:vec4<f32>, @location(3) detail:vec4<f32> };
struct LeafVertex {
 @builtin(position) clip:vec4<f32>, @location(0) uv:vec2<f32>, @location(1) world:vec3<f32>,
 @location(2) @interpolate(flat) limits:vec2<f32>, @location(3) @interpolate(flat) fade:f32,
 @location(4) @interpolate(flat) normal:vec3<f32>, @location(5) @interpolate(flat) color:vec3<f32>
};
fn triangle(phase:f32)->f32{return 1-4*abs(fract(phase)-.5);}
@vertex fn vertex(i:LeafInput,@builtin(vertex_index) index:u32)->LeafVertex{
 let corners=array<vec2<f32>,6>(vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));let uv=corners[index];
 let age=(frame.timing.w+i.spawn.w*i.limits.z)%i.limits.z;
 let sway=i.motion.z*(triangle(age/i.limits.w+i.motion.w)-triangle(i.motion.w));
 let centre=i.spawn.xyz+vec3<f32>(i.detail.x*sway,-${LEAF_FALL_SPEED}.0*age,i.detail.y*sway);
 let yaw=i.detail.w*6.28318530718+age*${LEAF_SPIN_RATE};let tilt=i.motion.w*6.28318530718+age*${LEAF_TUMBLE_RATE};
 let right=vec3<f32>(cos(yaw),0,-sin(yaw));let up=vec3<f32>(sin(yaw)*sin(tilt),cos(tilt),cos(yaw)*sin(tilt));
 let normal=cross(right,up);var fade=1.0;
 if(frame.viewDirection.w>.5){fade=smoothstep(.75,3,distance(frame.eye.xyz,centre));}
 let world=centre+(right*uv.x*${LEAF_WIDTH_RATIO}+up*uv.y)*i.motion.x;
 var o:LeafVertex;o.clip=frame.vp*vec4<f32>(world,1);o.uv=uv;o.world=world;o.limits=i.limits.xy;o.fade=fade;o.normal=normal;o.color=LEAF_PALETTE[min(u32(i.detail.z),${LEAF_COLORS.length-1}u)];
 if(age>=i.motion.y){o.clip=vec4<f32>(2,2,2,1);}return o;
}
fn leafSrgb(c:vec3<f32>)->vec3<f32>{return select(1.055*pow(max(c,vec3<f32>(0)),vec3<f32>(1.0/2.4))-.055,12.92*c,c<=vec3<f32>(.0031308));}
@fragment fn fragment(i:LeafVertex)->@location(0) vec4<f32>{
 if(i.world.x<0||i.world.z<0||i.world.x>i.limits.x||i.world.z>i.limits.y){discard;}
 // A pointed six-sided silhouette, with a narrow darker central vein.
 let halfWidth=min(1,(1-abs(i.uv.y))*2);let mask=1-smoothstep(max(0,halfWidth-.06),max(.001,halfWidth),abs(i.uv.x));if(mask<=0){discard;}
 let pixel=vec2<i32>(i.clip.xy);var coverage=0.0;
 for(var sample=0;sample<4;sample++){coverage+=select(0.0,.25,i.clip.z<=textureLoad(depthMap,pixel,sample));}
 if(coverage==0||visibleWaterDepth(pixel)<i.clip.z){discard;}
 let alpha=mask*${LEAF_OPACITY}*coverage*i.fade;if(alpha<.003){discard;}
 let vein=1-.16*(1-smoothstep(.025,.055,abs(i.uv.x)));
 let color=i.color*vein*leafIllumination(i.world,normalize(i.normal));return vec4<f32>(leafSrgb(clamp(color,vec3<f32>(0),vec3<f32>(1))),alpha);
}
`;
