// Capture the completed display once so drops can lens water, reflections,
// bloom and combat effects together, without reading their own render target.
export class RainRefraction {
 constructor(device,format){
  this.device=device;this.format=format;this.bytes=0;this.valid=false;this.wasMoving=false;this.displayMode=-1;this.source={texture:null};this.destination={texture:null};this.extent=[0,0];
  this.layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}}]});
  this.pass={label:'Refractive rain',colorAttachments:[{view:null,loadOp:'load',storeOp:'store'}]};
 }
 render(encoder,renderer,source,view,width,height,renderEncoder=encoder,sceneChanged=true,moving=false){
  if(!this.texture){
   this.texture=this.device.createTexture({label:'Scene behind rain droplets',size:[width,height],format:this.format,usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.TEXTURE_BINDING});this.bytes=width*height*4;this.destination.texture=this.texture;this.extent[0]=width;this.extent[1]=height;
   this.group=this.device.createBindGroup({layout:this.layout,entries:[{binding:0,resource:this.texture.createView()},{binding:1,resource:renderer.sampler}]});
  }
  const mode=(renderer.bloom?.active?1:0)|(renderer.reflectionsEnabled&&renderer.ssr?2:0);
  // Rain moves independently of the scene it lenses. Keep the clean capture
  // through static dry frames, including one last refresh when effects expire.
  if(!this.valid||sceneChanged||moving||this.wasMoving||this.displayMode!==mode){
   this.source.texture=source;encoder.copyTextureToTexture(this.source,this.destination,this.extent);this.source.texture=null;this.valid=true;
  }
  this.wasMoving=moving;this.displayMode=mode;
  this.pass.colorAttachments[0].view=view;
  const pass=renderEncoder.beginRenderPass(this.pass);pass.setPipeline(renderer.rainPipeline);pass.setBindGroup(0,renderer.cameraGroup);pass.setBindGroup(1,renderer.screenGroup);pass.setBindGroup(2,renderer.lightGroup);pass.setBindGroup(3,this.group);pass.setVertexBuffer(0,renderer.rainInstances);pass.draw(6,renderer.rain.count);pass.end();
 }
 clearTargets(){this.texture?.destroy();this.texture=this.group=null;this.source.texture=this.destination.texture=null;this.pass.colorAttachments[0].view=null;this.bytes=0;this.valid=this.wasMoving=false;this.displayMode=-1;}
}
