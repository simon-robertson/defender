import {MAX_WATER_IMPACTS} from '../shared/water-impact.js';

// A travelling radial wave packet perturbs the existing water normal. The
// ordinary submerged-footprint guard still rejects banks and bridge decks.
export const waterImpactRipples=`
struct WaterRipple { positionAge:vec4<f32>, wave:vec4<f32> };
struct WaterRippleField { count:vec4<f32>, events:array<WaterRipple,${MAX_WATER_IMPACTS}> };
@group(1) @binding(8) var<uniform> waterRipples:WaterRippleField;
fn impactSlope(world:vec3<f32>)->vec2<f32>{
 var slope=vec2<f32>(0);
 for(var index=0u;index<min(u32(waterRipples.count.x),${MAX_WATER_IMPACTS}u);index++){
  let event=waterRipples.events[index];
  if(abs(world.y-event.positionAge.y)>.1){continue;}
  let offset=world.xz-event.positionAge.xz;let distance=length(offset);
  let q=(distance-event.wave.x)*event.wave.y;
  if(abs(q)>3){continue;}
  // Derivative of a damped cosine packet: alternating slopes bend the bed
  // and mirrored scene on either side of the expanding circular crest.
  let gradient=exp(-q*q*.5)*(-q*cos(q*3)-3*sin(q*3));
  slope+=offset/max(distance,.001)*(gradient*event.wave.z);
 }
 return clamp(slope,vec2<f32>(-.4),vec2<f32>(.4));
}
`;
