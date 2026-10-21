import {bloomCompositeBindings,bloomCompositeAdd} from './bloom-shaders.js';
import {waterDepthRead} from './water-depth.js';
import {shotLighting} from './shot-shaders.js';
export const uniforms=`
struct Frame {
 vp:mat4x4<f32>, lightVP:mat4x4<f32>, inverseVP:mat4x4<f32>,
 eye:vec4<f32>, sun:vec4<f32>, sunColor:vec4<f32>, ambient:vec4<f32>,
 viewport:vec4<f32>, viewDirection:vec4<f32>, options:vec4<f32>,
 // options.w enables the distant vista background.
 timing:vec4<f32>, waterColor:vec4<f32>, waterProperties:vec4<f32>, waterMotion:vec4<f32>
};
@group(0) @binding(0) var<uniform> frame:Frame;
fn toEye(world:vec3<f32>)->vec3<f32>{
 if(frame.viewDirection.w>.5){return normalize(frame.eye.xyz-world);}
 return frame.viewDirection.xyz;
}
`;
// Shared by opaque surfaces, water, and the GPU shadow regression check.
export const shadowVisibility=`
fn visibility(world:vec3<f32>,n:vec3<f32>)->f32 {
 if(dot(n,frame.sun.xyz)<=.0001){return 0;}
 let p=frame.lightVP*vec4<f32>(world,1);let uv=p.xy*vec2<f32>(.5,-.5)+.5;
 if(any(uv<vec2<f32>(0))||any(uv>vec2<f32>(1))||p.z>1||p.z<0){return 1;}
 // Transform the receiver plane into orthographic light clip space. This uses
 // its actual geometric normal, including rotated parts, without derivatives.
 let m=frame.lightVP;
 let x=vec3<f32>(m[0].x,m[1].x,m[2].x);let y=vec3<f32>(m[0].y,m[1].y,m[2].y);let z=vec3<f32>(m[0].z,m[1].z,m[2].z);
 let plane=vec3<f32>(dot(n,x)/dot(x,x),dot(n,y)/dot(y,y),dot(n,z)/dot(z,z));
 let slope=vec2<f32>(-2*plane.x,2*plane.y)/plane.z;
 let size=vec2<f32>(textureDimensions(shadowMap));let texel=uv*size;let centre=vec2<i32>(floor(texel));
 var sum=0.0;var weightSum=0.0;
 for(var yOffset=-1;yOffset<=1;yOffset++){for(var xOffset=-1;xOffset<=1;xOffset++){
  let pixel=centre+vec2<i32>(xOffset,yOffset);let offset=vec2<f32>(pixel)+.5-texel;
  // A continuous 3x3 tent filter. Each depth is compared at its own texel centre,
  // so neighbours on a sloping face cannot incorrectly shadow that same face.
  let weights=max(vec2<f32>(0),vec2<f32>(1.5)-abs(offset));let weight=weights.x*weights.y;
  let receiver=p.z+dot(slope,offset/size)-.000004;
  var lit=1.0;
  if(all(pixel>=vec2<i32>(0))&&all(pixel<vec2<i32>(size))){lit=select(0.0,1.0,receiver<=textureLoad(shadowMap,pixel,0));}
  sum+=lit*weight;weightSum+=weight;
 }}return sum/weightSum;
}
`;
export const geometry=uniforms+`
struct Input {
 @location(0) position:vec3<f32>, @location(1) normal:vec3<f32>,
 @location(2) color:vec3<f32>, @location(3) emission:f32, @location(4) reflectiveness:f32,
 @location(5) a:vec4<f32>, @location(6) b:vec4<f32>, @location(7) c:vec4<f32>, @location(8) d:vec4<f32>
};
struct Vertex {
 @builtin(position) clip:vec4<f32>, @location(0) world:vec3<f32>, @location(1) normal:vec3<f32>,
 @location(2) color:vec3<f32>, @location(3) emission:f32, @location(4) reflectiveness:f32
};
@vertex fn vertex(i:Input)->Vertex {
 let model=mat4x4<f32>(i.a,i.b,i.c,i.d);let world=model*vec4<f32>(i.position,1);
 var o:Vertex;o.clip=frame.vp*world;o.world=world.xyz;o.normal=(model*vec4<f32>(i.normal,0)).xyz;
 o.color=i.color;o.emission=i.emission;o.reflectiveness=i.reflectiveness;return o;
}
@vertex fn shadowVertex(i:Input)->@builtin(position) vec4<f32> {
 return frame.lightVP*mat4x4<f32>(i.a,i.b,i.c,i.d)*vec4<f32>(i.position,1);
}
@fragment fn waterMaskFragment(i:Vertex)->@location(0) vec4<f32>{return vec4<f32>(normalize(i.normal)*.5+.5,1);}
@group(1) @binding(0) var shadowMap:texture_depth_2d;
`+shadowVisibility+shotLighting(1,true)+`
struct Surface { @location(0) color:vec4<f32>, @location(1) normal:vec4<f32> };
fn shadeSurface(i:Vertex)->Surface {
 let n=normalize(i.normal);let diffuse=max(dot(n,frame.sun.xyz),0);let light=visibility(i.world,n);
 let ambient=frame.ambient.rgb*frame.sunColor.w*(.68+.32*max(n.y,0));
 var specular=0.0;
 if(i.reflectiveness>0&&light>0){
  let halfVector=normalize(frame.sun.xyz+toEye(i.world));
  specular=pow(max(dot(n,halfVector),0),48)*i.reflectiveness*.38*light;
 }
 var o:Surface;o.color=vec4<f32>(i.color*(ambient+frame.sunColor.rgb*diffuse*frame.sun.w*light+i.emission+muzzleLighting(i.world,n))+frame.sunColor.rgb*specular,i.emission);
 o.normal=vec4<f32>(n*.5+.5,i.reflectiveness);return o;
}
@fragment fn fragment(i:Vertex)->Surface {return shadeSurface(i);}
@fragment fn reflectionFragment(i:Vertex)->@location(0) vec4<f32>{
 if(i.world.y<frame.timing.w+.025){discard;}
 return vec4<f32>(shadeSurface(i).color.rgb,1);
}
`;
export const composite=uniforms+`
@group(1) @binding(0) var colorMap:texture_2d<f32>;
@group(1) @binding(1) var normalMap:texture_2d<f32>;
@group(1) @binding(2) var depthMap:texture_depth_multisampled_2d;
@group(1) @binding(3) var linearSampler:sampler;
@group(1) @binding(4) var waterDepth:texture_depth_2d;
${waterDepthRead}
@group(1) @binding(5) var waterNormal:texture_2d<f32>;
@group(1) @binding(6) var vistaMap:texture_2d<f32>;
@group(1) @binding(7) var planarMap:texture_2d<f32>;
@group(2) @binding(0) var shadowMap:texture_depth_2d;
`+shadowVisibility+shotLighting(2,true)+`
@vertex fn vertex(@builtin(vertex_index) index:u32)->@builtin(position) vec4<f32>{
 let x=f32((index<<1u)&2u);let y=f32(index&2u);return vec4<f32>(x*2-1,y*2-1,0,1);
}
fn worldAt(uv:vec2<f32>,d:f32)->vec3<f32>{let w=frame.inverseVP*vec4<f32>(uv*vec2<f32>(2,-2)+vec2<f32>(-1,1),d,1);return w.xyz/w.w;}
fn srgb(c:vec3<f32>)->vec3<f32>{return select(1.055*pow(max(c,vec3<f32>(0)),vec3<f32>(1.0/2.4))-.055,12.92*c,c<=vec3<f32>(.0031308));}
fn opaqueDepth(pixel:vec2<i32>)->f32{
 return min(min(textureLoad(depthMap,pixel,0),textureLoad(depthMap,pixel,1)),min(textureLoad(depthMap,pixel,2),textureLoad(depthMap,pixel,3)));
}
fn linearDepth(d:f32)->f32{
 let near=frame.options.y;let far=frame.options.z;
 if(frame.viewDirection.w>.5){return near*far/(far-d*(far-near));}
 return near+d*(far-near);
}
fn reflection(world:vec3<f32>,n:vec3<f32>,water:bool)->vec4<f32>{
 if(frame.options.x<.5){return vec4<f32>(0);}
 let ray=reflect(-toEye(world),n);
 if(water&&ray.y<=.001){return vec4<f32>(0);}
 // Water keeps a roughly 100-unit horizon with 28 coarse steps. The existing
 // dry-surface trace retains its 40 steps; larger water strides still fit the
 // 3.5-unit hit-thickness test and avoid a full-resolution extra render pass.
 let steps=select(40,28,water);let stride=select(2.5,3.5,water);
 for(var step=1;step<=steps;step++){
  let point=world+n*.4+ray*(2+f32(step)*stride);let clip=frame.vp*vec4<f32>(point,1);
  if(clip.w<=0||clip.z<0||clip.z>clip.w){break;}
  let uv=clip.xy/clip.w*vec2<f32>(.5,-.5)+.5;
  if(any(uv<=vec2<f32>(0))||any(uv>=vec2<f32>(1))){break;}
  // March with one depth sample. Only candidate water hits need the full
  // MSAA foreground check, rather than four reads at every empty ray step.
  let pixel=vec2<i32>(uv*frame.viewport.xy);let depth=textureLoad(depthMap,pixel,0);
  let gap=linearDepth(clip.z/clip.w)-linearDepth(depth);
  if(depth<1&&gap>0&&gap<3.5){
   // Water reflects above-surface geometry, never its own submerged bed.
   if(water){
    if(worldAt(uv,depth).y<=world.y+.08){continue;}
    let nearest=opaqueDepth(pixel);
    if(nearest<depth&&(linearDepth(clip.z/clip.w)-linearDepth(nearest)>=3.5||worldAt(uv,nearest).y<=world.y+.08)){continue;}
   }
   let edge=min(min(uv.x,1-uv.x),min(uv.y,1-uv.y));
   let distanceFade=select(1-f32(step)/55,1-f32(step)*stride/137.5,water);
   return vec4<f32>(textureSampleLevel(colorMap,linearSampler,uv,0).rgb,smoothstep(0,.08,edge)*distanceFade);
  }
 }
 return vec4<f32>(0);
}
// Small wind-driven slopes bend transmitted scenery and reflected geometry.
// Tint illumination keeps its flat normal; no analytic sun/specular highlights.
fn breezeNormal(world:vec3<f32>)->vec3<f32>{
 let p=world.xz*frame.waterMotion.x;let phase=frame.timing.z;
 let wind=vec2<f32>(.94,.342);let cross=vec2<f32>(.72,.694);let fine=vec2<f32>(-.25,.968);
 let a=dot(p,wind)*.448799-phase;
 let b=dot(p,cross)*.785398-phase*2+1.3;
 let c=dot(p,fine)*1.256637-phase*3+2.1;
 let slope=(wind*cos(a)+cross*(.35*cos(b))+fine*(.15*cos(c)))*frame.waterProperties.w;
 return normalize(vec3<f32>(slope.x,1,slope.y));
}
fn refractedBed(uv:vec2<f32>,world:vec3<f32>,bedDepth:f32,base:vec3<f32>)->vec3<f32>{
 if(bedDepth>=1||frame.waterProperties.z<=0||frame.waterProperties.x>=1){return base;}
 let bed=worldAt(uv,bedDepth);let ray=refract(-toEye(world),breezeNormal(world),1.0/1.333);
 let travel=clamp((world.y-bed.y)/max(.15,-ray.y),0,60);
 let clip=frame.vp*vec4<f32>(world+ray*travel,1);
 if(clip.w<=0||clip.z<0||clip.z>clip.w){return base;}
 let candidate=mix(uv,clip.xy/clip.w*vec2<f32>(.5,-.5)+.5,frame.waterProperties.z);
 // Accept only a complete bilinear footprint of submerged scenery. This
 // excludes dry banks, bridge decks, sky and off-screen or other-height pools.
 let footprint=vec2<i32>(floor(candidate*frame.viewport.xy-.5));
 if(any(footprint<vec2<i32>(0))||any(footprint+1>=vec2<i32>(frame.viewport.xy))){return base;}
 for(var y=0;y<2;y++){for(var x=0;x<2;x++){
  let pixel=footprint+vec2<i32>(x,y);let d=opaqueDepth(pixel);let wd=visibleWaterDepth(pixel);
  let sampleUV=(vec2<f32>(pixel)+.5)*frame.viewport.zw;
  if(wd>=d||d>=1){return base;}
  if(worldAt(sampleUV,d).y>world.y+.05||abs(worldAt(sampleUV,wd).y-world.y)>.1){return base;}
 }}
 return textureSampleLevel(colorMap,linearSampler,candidate,0).rgb;
}
fn shadeWater(uv:vec2<f32>,pixel:vec2<i32>,depth:f32,bedDepth:f32,base:vec3<f32>)->vec3<f32>{
 let world=worldAt(uv,depth);let n=normalize(textureLoad(waterNormal,pixel,0).xyz*2-1);
 let light=visibility(world,n);let diffuse=max(dot(n,frame.sun.xyz),0);
 let illumination=frame.ambient.rgb*frame.sunColor.w+frame.sunColor.rgb*diffuse*frame.sun.w*light+muzzleLighting(world,n);
 let tint=frame.waterColor.rgb*illumination;var transmitted=base;
 if(n.y>.9){transmitted=refractedBed(uv,world,bedDepth,base);}
 var color=mix(transmitted,tint,frame.waterProperties.x);
 if(n.y>.9&&frame.waterColor.a>0&&frame.options.x>.5){
  let normal=breezeNormal(world);var reflected=vec4<f32>(0);
  if(frame.waterMotion.w>.5){
   let projected=frame.vp*vec4<f32>(world+vec3<f32>(normal.x,0,normal.z)*6,1);
   let reflectedUV=projected.xy/projected.w*vec2<f32>(.5,-.5)+.5;
   if(projected.w>0&&all(reflectedUV>vec2<f32>(0))&&all(reflectedUV<vec2<f32>(1))){
    reflected=textureSampleLevel(planarMap,linearSampler,reflectedUV,0);
    // The clear background is transparent black: filtering produces coverage-
    // premultiplied RGB. Undo it before the common straight-alpha water mix.
    if(reflected.a>0){reflected=vec4<f32>(reflected.rgb/reflected.a,reflected.a);}
   }
  }else{reflected=reflection(world,normal,true);}
  // Raised reflection floor keeps scenery readable from the high game camera.
  let fresnel=.25+.75*pow(1-clamp(dot(normal,toEye(world)),0,1),5);
  color=mix(color,reflected.rgb,reflected.a*frame.waterColor.a*fresnel);
 }
 return color;
}
@fragment fn fragment(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{
 let pixel=vec2<i32>(p.xy);let uv=p.xy*frame.viewport.zw;var color=textureLoad(colorMap,pixel,0).rgb;
 let depths=vec4<f32>(textureLoad(depthMap,pixel,0),textureLoad(depthMap,pixel,1),textureLoad(depthMap,pixel,2),textureLoad(depthMap,pixel,3));
 let d=min(min(depths.x,depths.y),min(depths.z,depths.w));let wd=visibleWaterDepth(pixel);
 if(frame.options.w>0){
  // Resolved foreground RGB already includes its MSAA sample coverage.
  // Fill only uncovered samples with the actual vista, avoiding a pale rim.
  let uncovered=dot(select(vec4<f32>(0),vec4<f32>(.25),depths>=vec4<f32>(1)),vec4<f32>(1));
  if(uncovered>0){color+=textureSampleLevel(vistaMap,linearSampler,uv,0).rgb*(.76*uncovered);}
 }
 if(wd<d){color=shadeWater(uv,pixel,wd,d,color);}
 else if(d<1){
  let data=textureLoad(normalMap,pixel,0);
  if(data.a>.3){let n=normalize(data.xyz*2-1);let world=worldAt(uv,d);let reflected=reflection(world,n,false);let fresnel=.25+.75*pow(1-max(dot(n,toEye(world)),0),5);color=mix(color,reflected.rgb,reflected.a*data.a*fresnel);}
 }
 return vec4<f32>(srgb(clamp(color,vec3<f32>(0),vec3<f32>(1))),1);
}
`;

// The emitter texture changes only RGB addition, preserving water/SSR and the
// original display transform. Ordinary rendering still uses composite above.
export const compositeBloom=composite.replace('@fragment fn fragment(@builtin(position) p:',bloomCompositeBindings+'\n@fragment fn fragment(@builtin(position) p:').replace(' return vec4<f32>(srgb(clamp(color,',bloomCompositeAdd+'\n return vec4<f32>(srgb(clamp(color,');
