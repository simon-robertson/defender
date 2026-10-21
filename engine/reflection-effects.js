import {uniforms} from './shaders.js';
import {shotParticles,specializeLocalLights} from './shot-shaders.js';
import {arcParticles} from './arc-shaders.js';
import {damageParticles} from './damage-shaders.js';
import {waterDepthRead} from './water-depth.js';
import {settlePipelineFields} from './pipeline-preparation.js';
import {MAX_SMOKE,DAMAGE_PARTICLE_FLOATS} from '../shared/damage-effects.js';
import {SHOT_INSTANCE_FLOATS} from '../shared/shot-effects.js';
import {ARC_INSTANCE_FLOATS} from '../shared/arc-effects.js';

// Specialize the production shapes once, leaving the main-view shaders intact.
// Mirrored effects use hardware depth in the existing reflection pass, not the
// unrelated main-view depth/water maps. Clip their actual widened world points.
function replace(code,from,to){
 if(!code.includes(from))throw new Error('Reflected effect shader boundary changed: '+from.slice(0,80));
 return code.replace(from,to);
}
function withoutScreenDepth(code){
 code=replace(code,'@group(1) @binding(2) var depthMap:texture_depth_multisampled_2d;','');
 code=replace(code,'@group(1) @binding(4) var waterDepth:texture_depth_2d;','');
 return replace(code,waterDepthRead,'');
}
const clipPlane='if(i.world.y<frame.timing.w+.025){discard;}';
function reflectedShots(){
 let code=withoutScreenDepth(shotParticles(uniforms));
 code=replace(code,'@interpolate(flat) shape:vec2<f32>','@interpolate(flat) shape:vec2<f32>, @location(3) world:vec3<f32>');
 code=replace(code,'o.uv=corner;o.colorAlpha','o.world=world;o.uv=corner;o.colorAlpha');
 code=replace(code,`var coverage=0.0;
 for(var sample=0;sample<4;sample++){coverage+=select(0.0,.25,i.clip.z<=textureLoad(depthMap,pixel,sample));}
 if(coverage==0){discard;}`,clipPlane+'let coverage=1.0;');
 code=replace(code,'if(visibleWaterDepth(pixel)<i.clip.z){alpha*=.3;}','');
 return replace(code,'return vec4<f32>(color,alpha);','return vec4<f32>(bloomLinear(color),alpha);');
}
function reflectedArcs(){
 let code=withoutScreenDepth(arcParticles(uniforms));
 code=replace(code,'@interpolate(flat) kind:f32','@interpolate(flat) kind:f32, @location(4) world:vec3<f32>');
 code=replace(code,'o.kind=i.colorKind.w;','o.kind=i.colorKind.w;o.world=world;');
 code=replace(code,`var coverage=0.0;for(var sample=0;sample<4;sample++){coverage+=select(0.0,.25,i.clip.z<=textureLoad(depthMap,pixel,sample));}
 if(visibleWaterDepth(pixel)<i.clip.z){coverage*=.3;}`,clipPlane+'let coverage=1.0;');
 return replace(code,'return vec4<f32>(mix(i.colorAlpha.rgb,hotCore,core),alpha);','return vec4<f32>(bloomLinear(mix(i.colorAlpha.rgb,hotCore,core)),alpha);');
}
function reflectedDamage(){
 let code=withoutScreenDepth(damageParticles).replaceAll('@group(2)','@group(1)');
 code=replace(code,'fn damageSrgb(c:vec3<f32>)->vec3<f32>{return select(1.055*pow(max(c,vec3<f32>(0)),vec3<f32>(1.0/2.4))-.055,12.92*c,c<=vec3<f32>(.0031308));}',
  'fn damageSrgb(c:vec3<f32>)->vec3<f32>{return c;}');
 code=replace(code,`var coverage=0.0;
 for(var sample=0;sample<4;sample++){coverage+=select(0.0,.25,i.clip.z<=textureLoad(depthMap,pixel,sample));}
 if(visibleWaterDepth(pixel)<i.clip.z){coverage*=.3;}return coverage;`,clipPlane+'return 1.0;');
 // Surface rings and splash sheets depend on the main water mask, and are not
 // explosion smoke/fire. Keep them out of this mirrored particle draw.
 const start=code.indexOf('fn waterImpactColor('),end=code.indexOf('@fragment fn smokeFragment(',start);
 if(start<0||end<0)throw new Error('Reflected water-impact shader boundary changed.');
 code=code.slice(0,start)+code.slice(end);
 return replace(code,'if(i.detail.x>=2){return waterImpactColor(i);}','if(i.detail.x>=2){discard;}');
}

export function hasReflectionEffects(renderer){
 return !!(renderer.shotEffects?.instanceCount||renderer.damageEffects?.smokeCount||renderer.damageEffects?.blastCount||renderer.arcEffects?.instanceCount||renderer.plasmaLinks?.instanceCount||renderer.missileThrust?.instanceCount);
}

// Application-owned pipelines and bounded smoke ordering scratch. Every other
// reflected effect reads its original GPU instance buffer directly. Smoke needs
// its own packed order because transparency is view dependent; no pool is cloned.
export class ReflectionEffects {
 constructor(renderer,asyncCreate=false){
  const d=this.device=renderer.device;this.disposed=false;
  const layout=d.createPipelineLayout({bindGroupLayouts:[renderer.cameraLayout,renderer.lightingLayout]});
  const module=(label,code)=>d.createShaderModule({label,code:specializeLocalLights(code,renderer.localLightCapacity)});
  const shots=module('Mirrored muzzle shapes',reflectedShots()),arcs=module('Mirrored electrical channels',reflectedArcs()),damage=module('Mirrored smoke and explosions',reflectedDamage());
  const create=descriptor=>asyncCreate?d.createRenderPipelineAsync(descriptor):d.createRenderPipeline(descriptor);
  const pipeline=(label,module,vertex,fragment,floats,additive)=>create({label,layout,
   vertex:{module,entryPoint:vertex,buffers:[{arrayStride:floats*4,stepMode:'instance',attributes:Array.from({length:floats/4},(_,shaderLocation)=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}]},
   fragment:{module,entryPoint:fragment,targets:[{format:'rgba8unorm',blend:{color:{srcFactor:'src-alpha',dstFactor:additive?'one':'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}}}]},
   primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth32float',depthWriteEnabled:false,depthCompare:'less-equal'}});
  this.shotPipeline=pipeline('Mirrored muzzle flashes and thrust',shots,'vertex','fragment',SHOT_INSTANCE_FLOATS,true);
  this.arcPipeline=pipeline('Mirrored Arc and plasma',arcs,'vertex','fragment',ARC_INSTANCE_FLOATS,true);
  this.smokePipeline=pipeline('Mirrored sorted smoke',damage,'damageVertex','smokeFragment',DAMAGE_PARTICLE_FLOATS,false);
  this.blastPipeline=pipeline('Mirrored explosion flashes',damage,'damageVertex','blastFragment',DAMAGE_PARTICLE_FLOATS,true);
  this.smokeData=new Float32Array(MAX_SMOKE*DAMAGE_PARTICLE_FLOATS);this.smokeOrder=new Uint32Array(MAX_SMOKE);this.smokeDepth=new Float64Array(MAX_SMOKE);
  this.bytes=this.smokeData.byteLength;this.cpuBytes=this.smokeData.byteLength+this.smokeOrder.byteLength+this.smokeDepth.byteLength;
  this.smokeBuffer=d.createBuffer({label:'Mirrored smoke ordering',size:this.bytes,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  if(asyncCreate)this.ready=settlePipelineFields(this,['shotPipeline','arcPipeline','smokePipeline','blastPipeline']);
 }
 prepareSmoke(damage,frame){
  const count=damage.smokeCount,data=damage.particleData,stride=DAMAGE_PARTICLE_FLOATS;
  for(let i=0;i<count;i++){
   const offset=i*stride,x=data[offset],y=data[offset+1],z=data[offset+2];
   const depth=(frame[2]*x+frame[6]*y+frame[10]*z+frame[14])/(frame[3]*x+frame[7]*y+frame[11]*z+frame[15]);
   let j=i;while(j>0&&this.smokeDepth[j-1]<depth){this.smokeDepth[j]=this.smokeDepth[j-1];this.smokeOrder[j]=this.smokeOrder[j-1];j--;}
   this.smokeDepth[j]=depth;this.smokeOrder[j]=i;
  }
  for(let i=0;i<count;i++)for(let k=0;k<stride;k++)this.smokeData[i*stride+k]=data[this.smokeOrder[i]*stride+k];
  this.device.queue.writeBuffer(this.smokeBuffer,0,this.smokeData,0,count*stride);
 }
 draw(pass,renderer,frame){
  const damage=renderer.damageEffects;let draws=0;
  if(damage?.smokeCount){this.prepareSmoke(damage,frame);pass.setPipeline(this.smokePipeline);pass.setVertexBuffer(0,this.smokeBuffer);pass.draw(6,damage.smokeCount);draws++;}
  if(damage?.blastCount){pass.setPipeline(this.blastPipeline);pass.setVertexBuffer(0,renderer.damageParticleBuffer);pass.draw(6,damage.blastCount,0,damage.smokeCount+(damage.waterParticleCount??0));draws++;}
  if(renderer.shotEffects?.instanceCount){pass.setPipeline(this.shotPipeline);pass.setVertexBuffer(0,renderer.shotInstances);pass.draw(6,renderer.shotEffects.instanceCount);draws++;}
  if(renderer.missileThrust?.instanceCount){pass.setPipeline(this.shotPipeline);pass.setVertexBuffer(0,renderer.missileThrustInstances);pass.draw(6,renderer.missileThrust.instanceCount);draws++;}
  if(renderer.arcEffects?.instanceCount){pass.setPipeline(this.arcPipeline);pass.setVertexBuffer(0,renderer.arcInstances);pass.draw(6,renderer.arcEffects.instanceCount);draws++;}
  if(renderer.plasmaLinks?.instanceCount){pass.setPipeline(this.arcPipeline);pass.setVertexBuffer(0,renderer.plasmaInstances);pass.draw(6,renderer.plasmaLinks.instanceCount);draws++;}
  return draws;
 }
 dispose(){this.disposed=true;this.smokeBuffer.destroy();}
}
