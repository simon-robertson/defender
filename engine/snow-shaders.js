import {waterDepthRead} from './water-depth.js';
import {uniforms,shadowVisibility} from './shaders.js';
import {shotLighting} from './shot-shaders.js';
import {rainLighting} from './rain-shaders.js';
import {SNOW_FALL_SPEED,SNOW_DRIFT_X,SNOW_DRIFT_Z,SNOW_SIDE_X,SNOW_SIDE_Z,SNOW_OPACITY} from './snow.js';

// Snow shares the existing weather lighting functions without altering rain.
export const snowParticles=uniforms+`
@group(1) @binding(2) var depthMap:texture_depth_multisampled_2d;
@group(1) @binding(4) var waterDepth:texture_depth_2d;
${waterDepthRead}
@group(2) @binding(0) var shadowMap:texture_depth_2d;
`+shadowVisibility+shotLighting(2,true)+rainLighting+`
struct SnowInput { @location(0) spawn:vec4<f32>, @location(1) motion:vec4<f32>, @location(2) limits:vec4<f32> };
struct SnowVertex {
 @builtin(position) clip:vec4<f32>, @location(0) uv:vec2<f32>, @location(1) world:vec3<f32>,
 @location(2) @interpolate(flat) limits:vec2<f32>, @location(3) @interpolate(flat) fade:f32
};
fn triangle(phase:f32)->f32{return 1-4*abs(fract(phase)-.5);}
@vertex fn vertex(i:SnowInput,@builtin(vertex_index) index:u32)->SnowVertex{
 let corners=array<vec2<f32>,6>(vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
 let uv=corners[index];let age=(frame.timing.w+i.spawn.w*i.limits.z)%i.limits.z;
 let flutter=i.motion.z*(triangle(age/i.limits.w+i.motion.w)-triangle(i.motion.w));
 let centre=i.spawn.xyz+vec3<f32>(${SNOW_DRIFT_X}.0,-${SNOW_FALL_SPEED}.0,${SNOW_DRIFT_Z}.0)*age+vec3<f32>(${SNOW_SIDE_X},0,${SNOW_SIDE_Z})*flutter;
 let view=toEye(centre);var right=cross(vec3<f32>(0,1,0),view);
 if(dot(right,right)<.0001){right=vec3<f32>(1,0,0);}else{right=normalize(right);}
 let up=cross(view,right);let spin=i.motion.w*6.283185+age*1.7;
 let corner=vec2<f32>(uv.x*cos(spin)-uv.y*sin(spin),uv.x*sin(spin)+uv.y*cos(spin));
 // Prevent close perspective flakes from becoming broad opaque disks. This
 // only reduces their size; static collision bounds remain conservative.
 let centreClip=frame.vp*vec4<f32>(centre,1);let sideClip=frame.vp*vec4<f32>(centre+right*i.motion.x,1);
 var sizeScale=1.0;var fade=1.0;
 if(frame.viewDirection.w>.5){
  fade=smoothstep(.75,3,distance(frame.eye.xyz,centre));
  if(centreClip.w>0&&sideClip.w>0){let pixels=length((sideClip.xy/sideClip.w-centreClip.xy/centreClip.w)*frame.viewport.xy);sizeScale=min(1,12/max(pixels,.0001));}
 }
 let world=centre+(right*corner.x+up*corner.y)*i.motion.x*sizeScale;
 var o:SnowVertex;o.clip=frame.vp*vec4<f32>(world,1);o.uv=uv;o.world=world;o.limits=i.limits.xy;o.fade=fade;
 if(age>=i.motion.y){o.clip=vec4<f32>(2,2,2,1);}return o;
}
fn snowSrgb(c:vec3<f32>)->vec3<f32>{return select(1.055*pow(max(c,vec3<f32>(0)),vec3<f32>(1.0/2.4))-.055,12.92*c,c<=vec3<f32>(.0031308));}
@fragment fn fragment(i:SnowVertex)->@location(0) vec4<f32>{
 if(i.world.x<0||i.world.z<0||i.world.x>i.limits.x||i.world.z>i.limits.y){discard;}
 let radius2=dot(i.uv,i.uv);if(radius2>=1){discard;}
 let pixel=vec2<i32>(i.clip.xy);var coverage=0.0;
 for(var sample=0;sample<4;sample++){coverage+=select(0.0,.25,i.clip.z<=textureLoad(depthMap,pixel,sample));}
 if(coverage==0||visibleWaterDepth(pixel)<i.clip.z){discard;}
 let mask=(1-smoothstep(.2,1,radius2))*(.9+.1*cos(atan2(i.uv.y,i.uv.x)*6));
 let alpha=mask*${SNOW_OPACITY}*coverage*i.fade;if(alpha<.003){discard;}
 let light=rainIllumination(i.world,toEye(i.world),visibility(i.world,frame.sun.xyz));
 return vec4<f32>(snowSrgb(clamp(light,vec3<f32>(0),vec3<f32>(1))),alpha);
}
`;
