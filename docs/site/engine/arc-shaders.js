import {waterDepthRead} from './water-depth.js';
import {bloomSettings} from './bloom-shaders.js';

// Narrow camera-facing capsules join into one procedural channel. Endpoints are
// world-space geometry; source and impact are not screen-space glow billboards.
export const arcParticles=frameUniforms=>frameUniforms+bloomSettings+`
@group(1) @binding(2) var depthMap:texture_depth_multisampled_2d;
@group(1) @binding(4) var waterDepth:texture_depth_2d;
${waterDepthRead}
struct ArcInput { @location(0) startWidth:vec4<f32>, @location(1) endAlpha:vec4<f32>, @location(2) colorKind:vec4<f32> };
struct ArcVertex {
 @builtin(position) clip:vec4<f32>, @location(0) uv:vec2<f32>,
 @location(1) @interpolate(flat) lengths:vec2<f32>, @location(2) @interpolate(flat) colorAlpha:vec4<f32>,
 @location(3) @interpolate(flat) kind:f32
};
@vertex fn vertex(i:ArcInput,@builtin(vertex_index) index:u32)->ArcVertex{
 let corners=array<vec2<f32>,6>(vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));let corner=corners[index];
 var start=i.startWidth.xyz;var end=i.endAlpha.xyz;var hidden=false;
 // Clip an intersecting ribbon at the perspective near plane before widening.
 // This avoids giant triangles when the camera crosses a channel endpoint.
 if(frame.viewDirection.w>.5){
  let a=frame.vp*vec4<f32>(start,1);let b=frame.vp*vec4<f32>(end,1);
  if(a.z<.00001&&b.z<.00001){hidden=true;}
  else if(a.z<.00001){start=mix(start,end,clamp((.00001-a.z)/(b.z-a.z),0.0,1.0));}
  else if(b.z<.00001){end=mix(start,end,clamp((.00001-a.z)/(b.z-a.z),0.0,1.0));}
 }
 let delta=end-start;let span=length(delta);let direction=delta/max(span,.00001);let view=toEye((start+end)*.5);
 var side=cross(direction,view);if(dot(side,side)<.00001){side=cross(vec3<f32>(0,1,0),view);}
 if(dot(side,side)<.00001){side=vec3<f32>(1,0,0);}side=normalize(side);
 let halfWidth=i.startWidth.w;let world=mix(start,end,(corner.x+1)*.5)+direction*corner.x*halfWidth+side*corner.y*halfWidth;
 var o:ArcVertex;o.clip=frame.vp*vec4<f32>(world,1);o.uv=vec2<f32>(corner.x*(span*.5+halfWidth),corner.y*halfWidth);o.lengths=vec2<f32>(span*.5,halfWidth);o.colorAlpha=vec4<f32>(i.colorKind.rgb,i.endAlpha.w);o.kind=i.colorKind.w;
 if(hidden){o.clip=vec4<f32>(2,2,2,1);}return o;
}
fn arcColor(i:ArcVertex,pixel:vec2<i32>)->vec4<f32>{
 let outside=vec2<f32>(max(abs(i.uv.x)-i.lengths.x,0.0),i.uv.y);let distance=length(outside)/max(i.lengths.y,.0001);
 if(distance>=1){discard;}
 var coverage=0.0;for(var sample=0;sample<4;sample++){coverage+=select(0.0,.25,i.clip.z<=textureLoad(depthMap,pixel,sample));}
 if(visibleWaterDepth(pixel)<i.clip.z){coverage*=.3;}
 let core=1-smoothstep(.18,.55,distance);let alpha=pow(max(0.0,1-distance),1.25)*i.colorAlpha.a*coverage;
 if(alpha<.003){discard;}
 var hotCore=select(vec3<f32>(.96,.985,1),min(vec3<f32>(1),i.colorAlpha.rgb+vec3<f32>(0,.16,.2)),i.kind>.5);
 if(i.kind>1.5){hotCore=vec3<f32>(.82,1,.88);}
 return vec4<f32>(mix(i.colorAlpha.rgb,hotCore,core),alpha);
}
@fragment fn fragment(i:ArcVertex)->@location(0) vec4<f32>{return arcColor(i,vec2<i32>(i.clip.xy));}
@fragment fn bloomFragment(i:ArcVertex)->@location(0) vec4<f32>{
 // Small impact sparks stay crisp; only the electrical channel emits bloom.
 if(i.kind>.5&&i.kind<1.5){discard;}
 let color=arcColor(i,vec2<i32>(i.clip.xy*bloomSettings.pixelScale.xy));return vec4<f32>(bloomLinear(color.rgb)*color.a,1);
}
`;
