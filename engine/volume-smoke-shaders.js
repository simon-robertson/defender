import {uniforms,shadowVisibility} from './shaders.js';
import {shotLighting} from './shot-shaders.js';
import {waterDepthRead} from './water-depth.js';
export function volumeSmokeShader(reflected=false){
 const group=reflected?2:3;
 return uniforms+`@group(${reflected?1:2}) @binding(0) var shadowMap:texture_depth_2d;`+shadowVisibility+shotLighting(reflected?1:2,true)+(reflected?`@group(2) @binding(2) var reflectedDepth:texture_depth_2d;`:`@group(1) @binding(2) var depthMap:texture_depth_multisampled_2d;
 @group(1) @binding(4) var waterDepth:texture_depth_2d;${waterDepthRead}`)+`
 struct Block {lo:vec4<f32>,hi:vec4<f32>};
 struct Trail {lo:vec4<f32>,hi:vec4<f32>,info:vec4<f32>,points:array<vec4<f32>,64>,blocks:array<Block,8>};
 @group(${group}) @binding(0) var<storage,read> trails:array<Trail>;
 @group(${group}) @binding(1) var<uniform> settings:vec4<f32>;
 struct Proxy {@builtin(position) clip:vec4<f32>,@location(0) @interpolate(flat) index:u32};
 @vertex fn vertex(@builtin(vertex_index) v:u32,@builtin(instance_index) instance:u32)->Proxy{
  let corners=array<vec3<f32>,8>(vec3(0,0,0),vec3(1,0,0),vec3(0,1,0),vec3(1,1,0),vec3(0,0,1),vec3(1,0,1),vec3(0,1,1),vec3(1,1,1));
  let indices=array<u32,36>(0,2,1,1,2,3,4,5,6,5,7,6,0,1,4,1,5,4,2,6,3,3,6,7,0,4,2,2,4,6,1,3,5,3,7,5);
  var o:Proxy;o.clip=frame.vp*vec4<f32>(mix(trails[instance].lo.xyz,trails[instance].hi.xyz,corners[indices[v]]),1);o.index=instance;return o;
 }
 fn hash3(p:vec3<f32>)->f32{var q=fract(p*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
 fn noise3(p:vec3<f32>)->f32{let a=floor(p);var f=fract(p);f=f*f*(3-2*f);return mix(mix(mix(hash3(a),hash3(a+vec3(1,0,0)),f.x),mix(hash3(a+vec3(0,1,0)),hash3(a+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(a+vec3(0,0,1)),hash3(a+vec3(1,0,1)),f.x),mix(hash3(a+vec3(0,1,1)),hash3(a+vec3(1,1,1)),f.x),f.y),f.z);}
 fn density(index:u32,p:vec3<f32>)->f32{
  let count=u32(trails[index].info.x);var value=0.0;
  for(var b=0u;b<8u;b++){
   if(b*8u>=count-1u){break;}let box=trails[index].blocks[b];if(any(p<box.lo.xyz)||any(p>box.hi.xyz)){continue;}
   for(var n=b*8u;n<min(count-1u,b*8u+8u);n++){
    let a=trails[index].points[n];let c=trails[index].points[n+1u];let axis=c.xyz-a.xyz;let u=clamp(dot(p-a.xyz,axis)/max(dot(axis,axis),.0001),0,1);let age=mix(a.w,c.w,u);let radius=3.2*(1+age*.9);let offset=p-mix(a.xyz,c.xyz,u);let d2=dot(offset,offset)/(radius*radius);
    // The radial kernel uses squared distance: avoid sqrt followed by a square,
    // and reject empty support before evaluating the fractional age power.
    if(d2>=1){continue;}let radial=1-d2;
    value=max(value,radial*radial*pow(max(0,1-age*.5),1.3));
   }
  }
  if(value<=0){return 0;}let q=p*.32-vec3(0,settings.x*.6,0);let noise=noise3(q)*.7+noise3(q*2.13+vec3(17.1))*.3;
  return value*smoothstep(.18,.78,noise)*2.4;
 }
 fn unproject(pixel:vec2<f32>,z:f32)->vec3<f32>{let q=frame.inverseVP*vec4<f32>(pixel/frame.viewport.xy*vec2<f32>(2,-2)+vec2<f32>(-1,1),z,1);return q.xyz/q.w;}
 fn srgb(c:vec3<f32>)->vec3<f32>{return select(1.055*pow(max(c,vec3<f32>(0)),vec3<f32>(1.0/2.4))-.055,12.92*c,c<=vec3<f32>(.0031308));}
 @fragment fn fragment(i:Proxy)->@location(0) vec4<f32>{
  let pixel=vec2<i32>(i.clip.xy);let origin=unproject(i.clip.xy,0);let direction=normalize(unproject(i.clip.xy,.9999)-origin);
  let safe=select(vec3<f32>(.000001),direction,abs(direction)>vec3<f32>(.000001));let inv=1/safe;let a=(trails[i.index].lo.xyz-origin)*inv;let b=(trails[i.index].hi.xyz-origin)*inv;let lo=min(a,b);let hi=max(a,b);
  let start=max(0,max(lo.x,max(lo.y,lo.z)));var end=min(hi.x,min(hi.y,hi.z));
  ${reflected?'let depths=vec4<f32>(textureLoad(reflectedDepth,pixel,0));':'let depths=vec4<f32>(textureLoad(depthMap,pixel,0),textureLoad(depthMap,pixel,1),textureLoad(depthMap,pixel,2),textureLoad(depthMap,pixel,3));'}
  let opaque=max(max(depths.x,depths.y),max(depths.z,depths.w));end=min(end,dot(unproject(i.clip.xy,opaque)-origin,direction));if(end<=start){discard;}
  ${reflected?'':'let waterZ=visibleWaterDepth(pixel);'}
  let steps=u32(settings.y);let stepSize=(end-start)/f32(steps);let jitter=hash3(vec3<f32>(floor(i.clip.xy),7));var transmittance=1.0;var weighted=vec3<f32>(0);var weight=0.0;
  for(var s=0u;s<32u;s++){
   if(s>=steps||transmittance<.015){break;}let p=origin+direction*(start+(f32(s)+.25+.5*jitter)*stepSize);
   ${reflected?'if(p.y<frame.timing.w+.025){continue;}':''}
   let clip=frame.vp*vec4<f32>(p,1);let coverage=dot(select(vec4<f32>(0),vec4<f32>(.25),depths>=vec4<f32>(clip.z/clip.w)),vec4<f32>(1));
   var d=density(i.index,p)*coverage;
   ${reflected?'':'if(waterZ<clip.z/clip.w){d*=.3;}'}
   let alpha=1-exp(-d*stepSize*.24);let contribution=transmittance*alpha;weighted+=p*contribution;weight+=contribution;transmittance*=1-alpha;
  }
  if(weight<.003){discard;}let centre=weighted/weight;let normal=normalize(frame.sun.xyz-direction*.35);let selfShadow=exp(-density(i.index,centre+frame.sun.xyz*4)*1.2);
  let light=frame.ambient.rgb*frame.sunColor.w+frame.sunColor.rgb*frame.sun.w*visibility(centre,frame.sun.xyz)*selfShadow*(.4+.6*max(dot(normal,frame.sun.xyz),0))+muzzleLighting(centre,normal);
  let color=clamp(vec3<f32>(.57,.58,.55)*light,vec3<f32>(0),vec3<f32>(1));return vec4<f32>(${reflected?'color':'srgb(color)'},weight);
 }`;
}
