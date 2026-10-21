import {geometry} from './shaders.js';
import {specializeLocalLights} from './shot-shaders.js';

// One horizontal plane per scene. Geometry/instances/shadows belong to the
// renderer. Pipelines/frame are lazy application resources; half-resolution
// images are scene/viewport resources and are dropped on every world release.
export function waterPlane(level){
 let height=null;
 for(const box of level.terrain.boxes)if(box.water>0){if(height!==null&&height!==box.water)return null;height=box.water;}
 return height;
}
export function reflectedFrame(out,frame,height){
 out.set(frame);
 // VP * reflection(Y=height), preserving the main projection in both cameras.
 for(let row=0;row<4;row++){out[4+row]=-frame[4+row];out[12+row]=frame[12+row]+2*height*frame[4+row];}
 out[49]=2*height-frame[49];out[69]=-frame[69];out[79]=height;
 return out;
}
export function waterInView(bounds,vp){
 // Test the union water AABB against homogeneous clip planes. No allocation,
 // per-box traversal or false rejection when the camera is inside its bounds.
 if(!bounds)return false;
 for(let plane=0;plane<6;plane++){
  let outside=true;
  for(let corner=0;corner<8;corner++){
   const x=bounds[corner&1?3:0],y=bounds[corner&2?4:1],z=bounds[corner&4?5:2];
   const cx=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],cy=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],cz=vp[2]*x+vp[6]*y+vp[10]*z+vp[14],cw=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
   if((plane===0?cx+cw:plane===1?cw-cx:plane===2?cy+cw:plane===3?cw-cy:plane===4?cz:cw-cz)>=0){outside=false;break;}
  }
  if(outside)return false;
 }
 return true;
}
export class PlanarReflection {
 constructor(renderer,buffers){
  const d=this.device=renderer.device;this.frame=new Float32Array(92);this.bytes=0;this.valid=false;
  this.uniform=d.createBuffer({label:'Mirrored water camera',size:368,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.cameraGroup=d.createBindGroup({layout:renderer.cameraLayout,entries:[{binding:0,resource:{buffer:this.uniform}}]});
  const module=d.createShaderModule({label:'Planar water reflection',code:specializeLocalLights(geometry,renderer.localLightCapacity)});
  this.pipeline=d.createRenderPipeline({label:'Mirrored opaque surfaces',layout:d.createPipelineLayout({bindGroupLayouts:[renderer.cameraLayout,renderer.lightingLayout]}),vertex:{module,entryPoint:'vertex',buffers},fragment:{module,entryPoint:'reflectionFragment',targets:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list',cullMode:'front'},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'}});
  this.pass={label:'Planar water reflection',colorAttachments:[{view:null,loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:0}}],depthStencilAttachment:{view:null,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}};
 }
 resize(width,height){
  const w=Math.max(1,Math.ceil(width*.5)),h=Math.max(1,Math.ceil(height*.5));if(w===this.width&&h===this.height)return false;
  this.clearTargets();this.width=w;this.height=h;
  const texture=format=>this.device.createTexture({label:'Half-resolution water reflection '+format,size:[w,h],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|(format==='rgba8unorm'?GPUTextureUsage.COPY_SRC:0)});
  this.color=texture('rgba8unorm');this.depth=texture('depth32float');this.view=this.color.createView();this.pass.colorAttachments[0].view=this.view;this.pass.depthStencilAttachment.view=this.depth.createView();this.bytes=w*h*8;return true;
 }
 render(encoder,renderer,height,changed){
  if(this.valid&&!changed)return 0;
  reflectedFrame(this.frame,renderer.frameData,height);this.frame[64]=this.width;this.frame[65]=this.height;this.frame[66]=1/this.width;this.frame[67]=1/this.height;
  this.device.queue.writeBuffer(this.uniform,0,this.frame);
  const pass=encoder.beginRenderPass(this.pass);pass.setBindGroup(0,this.cameraGroup);pass.setBindGroup(1,renderer.lightGroup);pass.setPipeline(this.pipeline);let draws=0;
  for(const draw of renderer.draws)if(draw.visibleCount){pass.setVertexBuffer(0,draw.vertices);pass.setVertexBuffer(1,draw.instances);pass.setIndexBuffer(draw.indices,'uint32');pass.drawIndexed(draw.indexCount,draw.visibleCount);draws++;}
  if(renderer.damageCubeCount){pass.setPipeline(renderer.damageReflectionPipeline);pass.setVertexBuffer(0,renderer.damageCubeBuffer);pass.draw(36,renderer.damageCubeCount);draws++;}
  pass.end();this.valid=true;return draws;
 }
 clearTargets(){this.color?.destroy();this.depth?.destroy();this.color=this.depth=this.view=null;this.width=this.height=this.bytes=0;this.valid=false;}
 dispose(){this.clearTargets();this.uniform.destroy();}
}
