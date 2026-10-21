import {bloodDecals} from './damage-shaders.js';
import {specializeLocalLights} from './shot-shaders.js';
import {DAMAGE_CUBE_FLOATS} from '../shared/damage-effects.js';

// Flat receiver-clipped mesh decals suit the static cuboid collision world.
// A small physical normal offset separates them from receivers. Read-only
// scene depth occludes them; stable instance order controls overlapping marks.
export class BloodDecals {
 constructor(device,cameraLayout,lightingLayout,lightCapacity,asyncCreate=false){
  const module=device.createShaderModule({label:'Lit blood decals',code:specializeLocalLights(bloodDecals,lightCapacity)});
  const blend={color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one-minus-src-alpha',operation:'add'}};
  this.pipeline=(asyncCreate?device.createRenderPipelineAsync.bind(device):device.createRenderPipeline.bind(device))({label:'Read-only-depth blood decals',layout:device.createPipelineLayout({bindGroupLayouts:[cameraLayout,lightingLayout]}),
   vertex:{module,entryPoint:'bloodVertex',buffers:[{arrayStride:DAMAGE_CUBE_FLOATS*4,stepMode:'instance',attributes:Array.from({length:5},(_,shaderLocation)=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}]},
   fragment:{module,entryPoint:'bloodFragment',targets:[{format:'rgba8unorm',blend},{format:'rgba8unorm',blend}]},primitive:{topology:'triangle-list',cullMode:'back'},
   depthStencil:{format:'depth32float',depthWriteEnabled:false,depthCompare:'less-equal'},multisample:{count:4}});
 }
 draw(pass,renderer){
  pass.setPipeline(this.pipeline);pass.setBindGroup(0,renderer.cameraGroup);pass.setBindGroup(1,renderer.lightGroup);
  pass.setVertexBuffer(0,renderer.damageCubeBuffer);pass.draw(36,renderer.damageDecalCount,0,renderer.damageCubeCount);
 }
}
