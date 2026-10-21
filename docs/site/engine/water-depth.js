// All screen-space consumers use the same dry-scene guard, allowing 1x1
// inactive bindings without out-of-bounds reads or accidental submersion.
export const waterDepthRead=`
fn visibleWaterDepth(pixel:vec2<i32>)->f32{
 if(frame.waterMotion.w<0){return 1.0;}
 return textureLoad(waterDepth,pixel,0);
}
`;
