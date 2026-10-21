import {uniforms} from './shaders.js';
import {biomeVistaGeometry} from './vista-geometry.js';

// A cosmetic landscape, hundreds of units below the board. Nothing here enters
// the world's geometry, shadows, navigation, placement or targeting queries.
const prefixes={A:'moss',B:'ochre',C:'ice',D:'plum'};
export const hasZoneVista=level=>Boolean(prefixes[level.zone])&&new RegExp('^'+prefixes[level.zone]+'-0[1-4]$').test(level.id);
export const zoneVistaGeometry=(zone,width=480,length=384)=>biomeVistaGeometry(zone,width,length);
export const zoneAVistaGeometry=(width=480,length=384)=>biomeVistaGeometry('A',width,length);

const shader=uniforms+`
struct V { @builtin(position) clip:vec4<f32>, @location(0) color:vec3<f32>, @location(1) distance:f32 };
@vertex fn terrain(@location(0) p:vec3<f32>,@location(1) color:vec3<f32>)->V {
 var o:V;o.clip=frame.vp*vec4<f32>(p,1);o.distance=distance(p,frame.eye.xyz);
 // Separate background depth allows a vast vista without weakening the
 // gameplay camera's near/far precision or writing its depth buffer.
 if(frame.viewDirection.w<.5){
  // The battlefield overview is orthographic; its distant vista still recedes
  // in perspective, matching the overview at the board's focal distance.
  let depth=dot(frame.eye.xyz-p,frame.viewDirection.xyz);
  o.clip=vec4<f32>(o.clip.xy*900,0,depth);
 }
 o.clip.z=(1-1/(1+o.distance*.0001))*o.clip.w;o.color=color;return o;
}
@fragment fn land(i:V)->@location(0) vec4<f32>{
 let distant=smoothstep(2500,10000,i.distance)*.52;
 let palette=clamp(dot(frame.ambient.rgb,vec3<f32>(.2126,.7152,.0722))/.65,.07,1.0);
 let light=clamp(frame.sun.w*.55+frame.sunColor.w*.45,.12,1.0)*palette;
 return vec4<f32>(mix(i.color,vec3<f32>(.22,.275,.225),distant)*light,1);
}
@vertex fn sky(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{
 return vec4<f32>(f32((i<<1u)&2u)*2-1,f32(i&2u)*2-1,1,1);
}
@fragment fn skyColor(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{
 let palette=clamp(dot(frame.ambient.rgb,vec3<f32>(.2126,.7152,.0722))/.65,.07,1.0);
 let light=clamp(frame.sun.w*.55+frame.sunColor.w*.45,.12,1.0)*palette;
 return vec4<f32>(vec3<f32>(.22,.275,.225)*light,1);
}`;
export class ZoneVista {
 constructor(device,cameraLayout,width,length,zone='A'){
  this.device=device;this.zone=zone;this.resolutionScale=.75;const data=zoneVistaGeometry(zone,width,length);this.vertexCount=data.length/6;this.geometryBytes=data.byteLength;
  this.vertices=device.createBuffer({label:'Zone '+zone+' distant landscape',size:data.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(this.vertices,0,data);
  const module=device.createShaderModule({label:'Zone '+zone+' vista',code:shader.replaceAll('vec3<f32>(.22,.275,.225)',{A:'vec3<f32>(.22,.275,.225)',B:'vec3<f32>(.29,.22,.15)',C:'vec3<f32>(.26,.29,.31)',D:'vec3<f32>(.23,.22,.25)'}[zone])}),layout=device.createPipelineLayout({bindGroupLayouts:[cameraLayout]}),depthStencil={format:'depth32float',depthWriteEnabled:true,depthCompare:'less-equal'};
  this.terrain=device.createRenderPipeline({label:'Zone '+zone+' low-poly vista',layout,vertex:{module,entryPoint:'terrain',buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'}]}]},fragment:{module,entryPoint:'land',targets:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list',cullMode:'none'},depthStencil});
  this.sky=device.createRenderPipeline({label:'Zone '+zone+' distant sky',layout,vertex:{module,entryPoint:'sky'},fragment:{module,entryPoint:'skyColor',targets:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list'},depthStencil});
  this.pass={label:'Zone '+zone+' distant vista',colorAttachments:[{view:null,loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:null,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}};
  this.dirty=true;this.targetBytes=0;
 }
 resize(width,height){
  const w=Math.max(1,Math.ceil(width*this.resolutionScale)),h=Math.max(1,Math.ceil(height*this.resolutionScale));if(this.width===w&&this.height===h)return false;
  this.color?.destroy();this.depth?.destroy();this.width=w;this.height=h;this.targetBytes=w*h*8;
  const texture=format=>this.device.createTexture({label:'Zone '+this.zone+' vista '+format,size:[w,h],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
  this.color=texture('rgba8unorm');this.depth=texture('depth32float');this.view=this.color.createView();this.pass.colorAttachments[0].view=this.view;this.pass.depthStencilAttachment.view=this.depth.createView();this.dirty=true;return true;
 }
 render(encoder,cameraGroup,changed){
  if(!this.dirty&&!changed)return 0;const pass=encoder.beginRenderPass(this.pass);pass.setBindGroup(0,cameraGroup);pass.setPipeline(this.sky);pass.draw(3);pass.setPipeline(this.terrain);pass.setVertexBuffer(0,this.vertices);pass.draw(this.vertexCount);pass.end();this.dirty=false;return 2;
 }
 dispose(){this.vertices.destroy();this.color?.destroy();this.depth?.destroy();}
}
