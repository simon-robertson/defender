import {waterDepthRead} from './water-depth.js';
import {bloomSettings} from './bloom-shaders.js';
import {geometry,uniforms,shadowVisibility} from './shaders.js';
import {shotLighting} from './shot-shaders.js';

// Procedural solid cube vertices share the exact model fragment lighting. CPU
// instances contain rigid world matrices with uniform scale and linear colour.
export const damageCubes=geometry
 .replace('@location(4) reflectiveness:f32\n};','@location(4) reflectiveness:f32, @location(5) @interpolate(flat) fade:f32\n};')
 .replace('@fragment fn fragment(i:Vertex)->Surface {','@fragment fn fragment(i:Vertex)->Surface { debrisFade(i.clip.xy,i.fade);')+`
@fragment fn debrisReflection(i:Vertex)->@location(0) vec4<f32>{
 debrisFade(i.clip.xy,i.fade);if(i.world.y<frame.timing.w+.025){discard;}
 return vec4<f32>(shadeSurface(i).color.rgb,1);
}
struct DebrisInput {
 @location(0) a:vec4<f32>, @location(1) b:vec4<f32>, @location(2) c:vec4<f32>,
 @location(3) d:vec4<f32>, @location(4) color:vec4<f32>
};
fn debrisNormal(face:u32)->vec3<f32>{
 let normals=array<vec3<f32>,6>(vec3(1,0,0),vec3(-1,0,0),vec3(0,1,0),vec3(0,-1,0),vec3(0,0,1),vec3(0,0,-1));return normals[face];
}
fn debrisPosition(index:u32)->vec3<f32>{
 let face=index/6u;let corners=array<vec2<f32>,6>(vec2(-.5,-.5),vec2(.5,-.5),vec2(.5,.5),vec2(-.5,-.5),vec2(.5,.5),vec2(-.5,.5));
 let horizontal=array<vec3<f32>,6>(vec3(0,0,-1),vec3(0,0,1),vec3(1,0,0),vec3(1,0,0),vec3(1,0,0),vec3(-1,0,0));
 let vertical=array<vec3<f32>,6>(vec3(0,1,0),vec3(0,1,0),vec3(0,0,-1),vec3(0,0,1),vec3(0,1,0),vec3(0,1,0));
 let corner=corners[index%6u];return debrisNormal(face)*.5+horizontal[face]*corner.x+vertical[face]*corner.y;
}
@vertex fn debrisVertex(i:DebrisInput,@builtin(vertex_index) index:u32)->Vertex{
 let model=mat4x4<f32>(i.a,i.b,i.c,i.d);let world=model*vec4<f32>(debrisPosition(index),1);
 var o:Vertex;o.clip=frame.vp*world;o.world=world.xyz;o.normal=(model*vec4<f32>(debrisNormal(index/6u),0)).xyz;
 o.color=i.color.rgb;o.emission=0;o.reflectiveness=0;o.fade=1-i.color.a;return o;
}
struct DebrisShadowVertex { @builtin(position) clip:vec4<f32>, @location(0) @interpolate(flat) fade:f32 };
@vertex fn debrisShadow(i:DebrisInput,@builtin(vertex_index) index:u32)->DebrisShadowVertex{
 var o:DebrisShadowVertex;o.clip=frame.lightVP*mat4x4<f32>(i.a,i.b,i.c,i.d)*vec4<f32>(debrisPosition(index),1);o.fade=1-i.color.a;return o;
}
// Ordered coverage fade preserves depth, shadows and SSR without adding a
// transparent geometry pass. Identical camera-depth/colour masks avoid holes.
fn debrisFade(pixel:vec2<f32>,fade:f32){
 let pattern=array<f32,16>(0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
 let p=vec2<u32>(pixel)%vec2<u32>(4);if(fade<=(pattern[p.y*4u+p.x]+.5)/16){discard;}
}
@fragment fn debrisDepth(i:Vertex){debrisFade(i.clip.xy,i.fade);}
@fragment fn debrisShadowDepth(i:DebrisShadowVertex){debrisFade(i.clip.xy,i.fade);}
`;

// Marks use ordinary lit geometry, but never enter camera/shadow depth.
// Alpha is actual opacity here, not the debris ordered-coverage mask.
export const bloodDecals=geometry
 .replace('@location(4) reflectiveness:f32\n};','@location(4) reflectiveness:f32, @location(5) @interpolate(flat) opacity:f32\n};')
 .replace('@fragment fn fragment(i:Vertex)->Surface {','fn bloodSurface(i:Vertex)->Surface {')+`
struct BloodInput {
 @location(0) a:vec4<f32>, @location(1) b:vec4<f32>, @location(2) c:vec4<f32>,
 @location(3) d:vec4<f32>, @location(4) color:vec4<f32>
};
// Twelve irregular triangles make a flat, texture-free blood impact mark.
fn bloodPosition(index:u32,seed:f32)->vec3<f32>{
 if(index%3u==0u){return vec3<f32>(0);}
 let corner=index/3u+index%3u-1u;let angle=-f32(corner)*6.2831853/12;
 let radius=.7+.3*fract(sin(f32(corner%12u)*17.17+seed)*43758.5453);
 return vec3<f32>(cos(angle)*radius,0,sin(angle)*radius);
}
@vertex fn bloodVertex(i:BloodInput,@builtin(vertex_index) index:u32)->Vertex{
 let model=mat4x4<f32>(i.a,i.b,i.c,i.d);
 let world=model*vec4<f32>(bloodPosition(index,i.d.x*.17+i.d.z*.31),1);
 var o:Vertex;o.clip=frame.vp*world;o.world=world.xyz;o.normal=i.b.xyz;
 o.color=i.color.rgb;o.emission=0;o.reflectiveness=0;o.opacity=3-i.color.a;return o;
}
@fragment fn bloodFragment(i:Vertex)->Surface{
 var o=bloodSurface(i);o.color.a=i.opacity;o.normal.a=i.opacity;return o;
}
`;

export const damageParticles=uniforms+bloomSettings+`
@group(1) @binding(2) var depthMap:texture_depth_multisampled_2d;
@group(1) @binding(4) var waterDepth:texture_depth_2d;
${waterDepthRead}
@group(2) @binding(0) var shadowMap:texture_depth_2d;
`+shadowVisibility+shotLighting(2,true)+`
struct DamageInput { @location(0) positionRadius:vec4<f32>, @location(1) colorAlpha:vec4<f32>, @location(2) detail:vec4<f32> };
struct DamageVertex {
 @builtin(position) clip:vec4<f32>, @location(0) uv:vec2<f32>, @location(1) world:vec3<f32>,
 @location(2) @interpolate(flat) colorAlpha:vec4<f32>, @location(3) @interpolate(flat) detail:vec4<f32>,
 @location(4) @interpolate(flat) right:vec3<f32>, @location(5) @interpolate(flat) up:vec3<f32>
};
@vertex fn damageVertex(i:DamageInput,@builtin(vertex_index) index:u32)->DamageVertex{
 let corners=array<vec2<f32>,6>(vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));let corner=corners[index];
 let view=toEye(i.positionRadius.xyz);var right=cross(vec3<f32>(0,1,0),view);if(dot(right,right)<.0001){right=vec3<f32>(1,0,0);}else{right=normalize(right);}var up=cross(view,right);var stretch=1.0;
 if(i.detail.x==2){right=vec3<f32>(1,0,0);up=vec3<f32>(0,0,1);}
 if(i.detail.x==3){up=vec3<f32>(0,1,0);stretch=i.detail.w;}
 if(i.detail.x==4){stretch=i.detail.z;}
 let spin=i.detail.y;var uv=vec2<f32>(corner.x*cos(spin)-corner.y*sin(spin),corner.x*sin(spin)+corner.y*cos(spin));if(i.detail.x>=2){uv=corner;}
 let world=i.positionRadius.xyz+(right*corner.x+up*corner.y*stretch)*i.positionRadius.w;
 var o:DamageVertex;o.clip=frame.vp*vec4<f32>(world,1);o.uv=uv;o.world=world;o.colorAlpha=i.colorAlpha;o.detail=i.detail;o.right=right;o.up=up;return o;
}
fn damageSrgb(c:vec3<f32>)->vec3<f32>{return select(1.055*pow(max(c,vec3<f32>(0)),vec3<f32>(1.0/2.4))-.055,12.92*c,c<=vec3<f32>(.0031308));}
fn damageCoverageAt(i:DamageVertex,pixel:vec2<i32>)->f32{
 var coverage=0.0;
 for(var sample=0;sample<4;sample++){coverage+=select(0.0,.25,i.clip.z<=textureLoad(depthMap,pixel,sample));}
 if(visibleWaterDepth(pixel)<i.clip.z){coverage*=.3;}return coverage;
}
fn damageCoverage(i:DamageVertex)->f32{return damageCoverageAt(i,vec2<i32>(i.clip.xy));}
fn waterImpactColor(i:DamageVertex)->vec4<f32>{
 let kind=i.detail.x;let pixel=vec2<i32>(i.clip.xy);var alpha=i.colorAlpha.a*damageCoverage(i);if(alpha<=0){discard;}
 var normal=vec3<f32>(0,1,0);var waterColor=mix(frame.waterColor.rgb,i.colorAlpha.rgb,.78);
 if(kind==2){
  let depth=visibleWaterDepth(pixel);if(depth>=1){discard;}
  let uv=i.clip.xy/frame.viewport.xy;let clip=vec4<f32>(uv*vec2<f32>(2,-2)+vec2<f32>(-1,1),depth,1);
  let p=frame.inverseVP*clip;if(abs(p.y/p.w-i.detail.w)>.3){discard;}
  let r=length(i.uv);let ring=smoothstep(.76,.86,r)*(1-smoothstep(.94,1,r));alpha*=ring;
  // A low-contrast disturbance follows the actual water tint, without ink-dark
  // troughs or a near-white outline over the reflection.
  let crest=1-smoothstep(.85,.94,r);
  waterColor=frame.waterColor.rgb*mix(.88,1.12,crest);
 }else if(kind==3){
  let x=abs(i.uv.x);if(x>1){discard;}
  let rim=-.55+.8*pow(x,1.5)+.16*sin(i.uv.x*13+i.detail.y);
  let sheet=smoothstep(rim-.28,rim-.08,i.uv.y)*(1-smoothstep(rim+.08,rim+.26,i.uv.y));alpha*=sheet*(1-smoothstep(.82,1,x));normal=normalize(toEye(i.world)+vec3<f32>(0,.5,0));
 }else{
  let r2=dot(i.uv,i.uv);if(r2>=1){discard;}alpha*=1-smoothstep(.48,1,r2);
  normal=normalize(i.right*i.uv.x+i.up*i.uv.y+toEye(i.world)*sqrt(max(.02,1-r2)));
 }
 if(alpha<.004){discard;}
 let light=frame.ambient.rgb*frame.sunColor.w+frame.sunColor.rgb*frame.sun.w*visibility(i.world,normal)*(.35+.65*max(dot(normal,frame.sun.xyz),0))+muzzleLighting(i.world,normal);
 let color=waterColor*light;
 return vec4<f32>(damageSrgb(clamp(color,vec3<f32>(0),vec3<f32>(1))),alpha);
}
@fragment fn smokeFragment(i:DamageVertex)->@location(0) vec4<f32>{
 if(i.detail.x>=2){return waterImpactColor(i);}
 let radius2=dot(i.uv,i.uv);if(radius2>=1){discard;}let coverage=damageCoverage(i);if(coverage==0){discard;}
 let seed=i.detail.y;let drift=i.detail.z*.8;
 let lobes=.73+.12*sin(i.uv.x*5+seed+drift)*sin(i.uv.y*6-seed)+.08*sin((i.uv.x+i.uv.y)*11+seed*.7-drift);
 let alpha=(1-smoothstep(.05,1,radius2))*lobes*i.colorAlpha.a*coverage;if(alpha<.003){discard;}
 let view=toEye(i.world);let normal=normalize(i.right*i.uv.x+i.up*i.uv.y+view*sqrt(max(.02,1-radius2)));
 let light=frame.ambient.rgb*frame.sunColor.w+frame.sunColor.rgb*frame.sun.w*visibility(i.world,frame.sun.xyz)*(.35+.65*max(dot(normal,frame.sun.xyz),0))+muzzleLighting(i.world,normal);
 return vec4<f32>(damageSrgb(clamp(i.colorAlpha.rgb*light,vec3<f32>(0),vec3<f32>(1))),alpha);
}
fn blastColor(i:DamageVertex,pixel:vec2<i32>)->vec4<f32>{
 let radius2=dot(i.uv,i.uv);if(radius2>=1){discard;}let coverage=damageCoverageAt(i,pixel);if(coverage==0){discard;}
 let lobes=.9+.1*sin(i.uv.x*9+i.detail.y)*sin(i.uv.y*7-i.detail.y);let mask=pow(max(0,1-radius2),2)*lobes;
 let alpha=mask*i.colorAlpha.a*coverage;if(alpha<.003){discard;}
 let hotCore=.8*(1-smoothstep(.145,.6,i.detail.z));
 let color=mix(i.colorAlpha.rgb,vec3<f32>(1,.95,.78),(1-smoothstep(0,.3,radius2))*hotCore);
 return vec4<f32>(damageSrgb(clamp(color,vec3<f32>(0),vec3<f32>(1))),alpha);
}
@fragment fn blastFragment(i:DamageVertex)->@location(0) vec4<f32>{return blastColor(i,vec2<i32>(i.clip.xy));}
@fragment fn blastBloomFragment(i:DamageVertex)->@location(0) vec4<f32>{
 let color=blastColor(i,vec2<i32>(i.clip.xy*bloomSettings.pixelScale.xy));
 let core=1-smoothstep(.15,.65,dot(i.uv,i.uv));return vec4<f32>(bloomLinear(color.rgb)*color.a*core,1);
}
`;
