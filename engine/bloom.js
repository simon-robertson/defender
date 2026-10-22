import {uniforms,compositeBloom} from './shaders.js';
import {shotParticles,specializeLocalLights} from './shot-shaders.js';
import {damageParticles} from './damage-shaders.js';
import {bloomExtract,bloomBlur,BLOOM_SCALE} from './bloom-shaders.js';
import {arcParticles} from './arc-shaders.js';
import {ARC_INSTANCE_FLOATS} from '../shared/arc-effects.js';

// Lazy application pipelines/settings; reduced-resolution images belong to the
// active scene/viewport. No world, actor, effect or source arrays are retained.
export class BloomPasses {
 constructor(device,cameraLayout,screenLayout,lightingLayout,sampler,format,localLightCapacity,asyncCreate=false){
  this.device=device;this.sampler=sampler;this.active=false;this.wasTransient=false;this.bytes=0;this.width=this.height=0;this.draws=0;this.passes=0;
  this.settingsData=new Float32Array(4);this.settings=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.imageLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}}]});
  const settingsLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
  this.settingsGroup=device.createBindGroup({layout:settingsLayout,entries:[{binding:0,resource:{buffer:this.settings}}]});
  const extract=device.createShaderModule({label:'Explicit emitter extraction',code:bloomExtract(uniforms)}),blur=device.createShaderModule({label:'Reduced emitter bloom',code:bloomBlur}),display=device.createShaderModule({label:'Bloom display composite',code:specializeLocalLights(compositeBloom,localLightCapacity)});
  const create=descriptor=>asyncCreate?device.createRenderPipelineAsync(descriptor):device.createRenderPipeline(descriptor);
  const pipeline=(label,module,entryPoint,layouts,targetFormat)=>create({label,layout:device.createPipelineLayout({bindGroupLayouts:layouts}),vertex:{module,entryPoint:'vertex'},fragment:{module,entryPoint,targets:[{format:targetFormat}]},primitive:{topology:'triangle-list'}});
  this.extractPipeline=pipeline('Downsample model emission',extract,'fragment',[cameraLayout,screenLayout],'rgba16float');
  this.horizontalPipeline=pipeline('Bloom horizontal blur',blur,'horizontal',[this.imageLayout],'rgba16float');
  this.verticalPipeline=pipeline('Bloom vertical blur',blur,'vertical',[this.imageLayout],'rgba16float');
  this.compositePipeline=pipeline('Water, SSR and selective bloom',display,'fragment',[cameraLayout,screenLayout,lightingLayout,this.imageLayout],format);
  const targets=[{format:'rgba16float',blend:{color:{srcFactor:'one',dstFactor:'one',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}}],particleLayout=device.createPipelineLayout({bindGroupLayouts:[cameraLayout,screenLayout,lightingLayout,settingsLayout]});
  this.particleLayout=particleLayout;this.particleTargets=targets;this.arcPipeline=null;
  const shots=device.createShaderModule({label:'Muzzle emitter shapes',code:shotParticles(uniforms)}),damage=device.createShaderModule({label:'Explosion hot-core emitter',code:damageParticles});
  this.shotPipeline=create({label:'Reduced muzzle emission',layout:particleLayout,vertex:{module:shots,entryPoint:'vertex',buffers:[{arrayStride:64,stepMode:'instance',attributes:[0,1,2,3].map(shaderLocation=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}]},fragment:{module:shots,entryPoint:'bloomFragment',targets},primitive:{topology:'triangle-list',cullMode:'none'}});
  this.blastPipeline=create({label:'Reduced explosion emission',layout:particleLayout,vertex:{module:damage,entryPoint:'damageVertex',buffers:[{arrayStride:48,stepMode:'instance',attributes:[0,1,2].map(shaderLocation=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}]},fragment:{module:damage,entryPoint:'blastBloomFragment',targets},primitive:{topology:'triangle-list',cullMode:'none'}});
  const pass=label=>({label,colorAttachments:[{view:null,clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'}]});
  this.extractPass=pass('Selective bloom emitters');this.horizontalPass=pass('Selective bloom horizontal');this.verticalPass=pass('Selective bloom vertical');
 }
 ensureTargets(width,height){
  const w=Math.max(1,Math.ceil(width/BLOOM_SCALE)),h=Math.max(1,Math.ceil(height/BLOOM_SCALE));
  if(this.width===w&&this.height===h)return false;
  this.clearTargets();const d=this.device,texture=()=>d.createTexture({label:'Reduced bloom image',size:[w,h],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
  this.first=texture();this.second=texture();this.firstView=this.first.createView();this.secondView=this.second.createView();this.width=w;this.height=h;this.bytes=w*h*16;
  const group=view=>d.createBindGroup({layout:this.imageLayout,entries:[{binding:0,resource:view},{binding:1,resource:this.sampler}]});this.firstGroup=group(this.firstView);this.secondGroup=group(this.secondView);
  this.extractPass.colorAttachments[0].view=this.firstView;this.horizontalPass.colorAttachments[0].view=this.secondView;this.verticalPass.colorAttachments[0].view=this.firstView;return true;
 }
 render(encoder,renderer,width,height,opaqueUpdated,waterUpdated){
  this.draws=this.passes=0;const shots=renderer.shotEffects,damage=renderer.damageEffects,arcs=renderer.arcEffects,thrust=renderer.missileThrust,shot=!!shots?.flashCount,blast=!!damage?.blastCount,arc=!!arcs?.strikeCount,burn=!!thrust?.instanceCount,transient=shot||blast||arc||burn;
  if(!renderer.visibleEmitters&&!transient){this.active=false;this.wasTransient=false;return;}
  const wasActive=this.active,resized=this.ensureTargets(width,height);this.active=true;
  const ratioX=width/this.width,ratioY=height/this.height;
  if(this.settingsData[0]!==Math.fround(ratioX)||this.settingsData[1]!==Math.fround(ratioY)){this.settingsData[0]=ratioX;this.settingsData[1]=ratioY;this.device.queue.writeBuffer(this.settings,0,this.settingsData);}
  const moving=shot||blast||arc||burn;
  if(!resized&&wasActive&&!opaqueUpdated&&!waterUpdated&&!moving&&!this.wasTransient)return;
  this.wasTransient=moving;
  const source=encoder.beginRenderPass(this.extractPass);source.setPipeline(this.extractPipeline);source.setBindGroup(0,renderer.cameraGroup);source.setBindGroup(1,renderer.screenGroup);source.draw(3);this.draws++;
  if(transient){source.setBindGroup(2,renderer.lightGroup);source.setBindGroup(3,this.settingsGroup);}
  if(shot){source.setPipeline(this.shotPipeline);source.setVertexBuffer(0,renderer.shotInstances);source.draw(6,shots.flashCount*2);this.draws++;}
  if(burn){source.setPipeline(this.shotPipeline);source.setVertexBuffer(0,renderer.missileThrustInstances);source.draw(6,thrust.instanceCount);this.draws++;}
  if(blast){source.setPipeline(this.blastPipeline);source.setVertexBuffer(0,renderer.damageParticleBuffer);source.draw(6,damage.blastCount,0,damage.smokeCount+(damage.waterParticleCount??0));this.draws++;}
  if(arc){
   if(!this.arcPipeline){
    const module=this.device.createShaderModule({label:'Electrical channel emitter',code:arcParticles(uniforms)});
    this.arcPipeline=this.device.createRenderPipeline({label:'Reduced electrical emission',layout:this.particleLayout,vertex:{module,entryPoint:'vertex',buffers:[{arrayStride:ARC_INSTANCE_FLOATS*4,stepMode:'instance',attributes:[0,1,2].map(shaderLocation=>({shaderLocation,offset:shaderLocation*16,format:'float32x4'}))}]},fragment:{module,entryPoint:'bloomFragment',targets:this.particleTargets},primitive:{topology:'triangle-list',cullMode:'none'}});
   }
   source.setPipeline(this.arcPipeline);
   if(arc){source.setVertexBuffer(0,renderer.arcInstances);source.draw(6,arcs.instanceCount-arcs.sparkCount);this.draws++;}
  }source.end();
  const horizontal=encoder.beginRenderPass(this.horizontalPass);horizontal.setPipeline(this.horizontalPipeline);horizontal.setBindGroup(0,this.firstGroup);horizontal.draw(3);horizontal.end();
  const vertical=encoder.beginRenderPass(this.verticalPass);vertical.setPipeline(this.verticalPipeline);vertical.setBindGroup(0,this.secondGroup);vertical.draw(3);vertical.end();this.draws+=2;this.passes=3;
 }
 clearTargets(){
  this.first?.destroy();this.second?.destroy();this.first=this.second=this.firstView=this.secondView=this.firstGroup=this.secondGroup=null;this.width=this.height=this.bytes=this.draws=this.passes=0;this.active=false;this.wasTransient=false;
  if(this.extractPass){this.extractPass.colorAttachments[0].view=null;this.horizontalPass.colorAttachments[0].view=null;this.verticalPass.colorAttachments[0].view=null;}
 }
 dispose(){this.clearTargets();this.settings.destroy();}
}
