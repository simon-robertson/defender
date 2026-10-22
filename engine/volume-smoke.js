import {VolumeTrailField,VOLUME_TRAILS,VOLUME_FLOATS} from './volume-trail-field.js';
import {volumeSmokeShader} from './volume-smoke-shaders.js';
import {specializeLocalLights} from './shot-shaders.js';
// Renderer-owned bounded path volumes; compile while loading, never on first fire.
export class VolumeSmoke extends VolumeTrailField {
 constructor(renderer){
  super();this.renderer=renderer;this.enabled=true;this.steps=16;this.ready=false;this.disposed=false;this.uploadBytes=0;
  const d=this.device=renderer.device,size=VOLUME_TRAILS*VOLUME_FLOATS*4;
  this.data=new Float32Array(VOLUME_TRAILS*VOLUME_FLOATS);this.reflectedData=new Float32Array(this.data.length);this.settings=new Float32Array(4);this.eye=new Float64Array(3);this.reflectedEye=new Float64Array(3);this.packetOffsets=new Uint32Array(VOLUME_TRAILS);this.packedRevision=-1;
  this.buffer=d.createBuffer({label:'3D smoke path volumes',size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this.reflectedBuffer=d.createBuffer({label:'Reflected smoke order',size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this.uniform=d.createBuffer({label:'Volume settings',size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const entries=[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}];
  this.layout=d.createBindGroupLayout({entries});this.reflectedLayout=d.createBindGroupLayout({entries:[...entries,{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth'}}]});
  this.group=d.createBindGroup({layout:this.layout,entries:[{binding:0,resource:{buffer:this.buffer}},{binding:1,resource:{buffer:this.uniform}}]});
  this.reflectionPass={label:'Volume smoke in planar water',colorAttachments:[{view:null,loadOp:'load',storeOp:'store'}]};this.bytes=size*2+16;this.cpuBytes+=this.data.byteLength+this.reflectedData.byteLength+this.settings.byteLength+this.eye.byteLength+this.reflectedEye.byteLength+this.packetOffsets.byteLength;
 }
 init(){
  if(this.preparation)return this.preparation;
  if(this.disposed)return Promise.resolve(false);
  this.preparation=this.initialize();return this.preparation;
 }
 async initialize(){
  const d=this.device,r=this.renderer;
  const pipeline=async reflected=>{
   const module=d.createShaderModule({label:reflected?'Reflected 3D smoke':'3D smoke',code:specializeLocalLights(volumeSmokeShader(reflected),r.localLightCapacity)});
   const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');if(this.disposed)return null;if(errors.length)throw new Error(errors.map(m=>m.message).join('\n'));
   return d.createRenderPipelineAsync({label:reflected?'Ray-marched reflected smoke':'Ray-marched trail density',layout:d.createPipelineLayout({bindGroupLayouts:reflected?[r.cameraLayout,r.lightingLayout,this.reflectedLayout]:[r.cameraLayout,r.screenLayout,r.lightingLayout,this.layout]}),vertex:{module,entryPoint:'vertex'},fragment:{module,entryPoint:'fragment',targets:[{format:reflected?'rgba8unorm':r.format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:reflected?'one':'zero',dstFactor:reflected?'one-minus-src-alpha':'one',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:reflected?'back':'front'}});
  };
  const pipelines=await Promise.all([pipeline(false),pipeline(true)]);if(this.disposed)return false;
  [this.pipeline,this.reflectionPipeline]=pipelines;this.packedRevision=-1;this.ready=true;return this;
 }
 get active(){return this.ready&&!this.disposed&&this.enabled&&this.count>0;}
 prepare(frame){
  this.uploadBytes=0;if(this.disposed||!this.enabled)return;
  const changed=this.packedRevision!==this.revision||this.eye[0]!==frame[48]||this.eye[1]!==frame[49]||this.eye[2]!==frame[50];
  if(changed){this.eye[0]=frame[48];this.eye[1]=frame[49];this.eye[2]=frame[50];this.pack(this.data,this.eye);for(let i=0;i<this.count;i++)this.packetOffsets[this.order[i]]=i*VOLUME_FLOATS;this.packedRevision=this.revision;}
  if(!this.active)return;this.settings[0]=this.time;this.settings[1]=this.steps;this.device.queue.writeBuffer(this.uniform,0,this.settings);this.uploadBytes=16;
  if(changed){this.device.queue.writeBuffer(this.buffer,0,this.data,0,this.count*VOLUME_FLOATS);this.uploadBytes+=this.count*VOLUME_FLOATS*4;}
 }
 draw(pass,r){if(!this.active)return 0;pass.setPipeline(this.pipeline);pass.setBindGroup(0,r.cameraGroup);pass.setBindGroup(1,r.screenGroup);pass.setBindGroup(2,r.lightGroup);pass.setBindGroup(3,this.group);pass.draw(36,this.count);return 1;}
 reflect(encoder,r){
  if(!this.active)return 0;const p=r.planar;
  // Reflection changes order only. Reuse the already curled/bounded packets;
  // do not repeat trigonometry or create a subarray view for every trail.
  this.reflectedEye[0]=p.frame[48];this.reflectedEye[1]=p.frame[49];this.reflectedEye[2]=p.frame[50];this.sort(this.reflectedEye);for(let i=0;i<this.count;i++){const source=this.packetOffsets[this.order[i]],dest=i*VOLUME_FLOATS;for(let k=0;k<VOLUME_FLOATS;k++)this.reflectedData[dest+k]=this.data[source+k];}
  this.device.queue.writeBuffer(this.reflectedBuffer,0,this.reflectedData,0,this.count*VOLUME_FLOATS);this.uploadBytes+=this.count*VOLUME_FLOATS*4;
  if(this.lastDepth!==p.depth){this.lastDepth=p.depth;this.reflectedGroup=this.device.createBindGroup({layout:this.reflectedLayout,entries:[{binding:0,resource:{buffer:this.reflectedBuffer}},{binding:1,resource:{buffer:this.uniform}},{binding:2,resource:p.depth.createView()}]});}
  this.reflectionPass.colorAttachments[0].view=p.view;const pass=encoder.beginRenderPass(this.reflectionPass);pass.setPipeline(this.reflectionPipeline);pass.setBindGroup(0,p.cameraGroup);pass.setBindGroup(1,r.lightGroup);pass.setBindGroup(2,this.reflectedGroup);pass.draw(36,this.count);pass.end();return 1;
 }
 reset(){super.reset();this.packedRevision=-1;this.lastDepth=this.reflectedGroup=null;if(this.reflectionPass)this.reflectionPass.colorAttachments[0].view=null;}
 dispose(){if(this.disposed)return;this.disposed=true;this.reset();this.buffer.destroy();this.reflectedBuffer.destroy();this.uniform.destroy();this.lastDepth=this.reflectedGroup=this.renderer=null;}
}
