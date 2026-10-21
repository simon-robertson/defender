import {BOX_SIZE} from '/shared/grid.js';
import {lookAt,ortho,multiply,identity} from '/shared/math.js';
const shader=`
struct Camera { vp:mat4x4<f32>, mode:vec4<f32> }; @group(0) @binding(0) var<uniform> camera:Camera;
struct In { @location(0) p:vec3<f32>, @location(1) n:vec3<f32>, @location(2) c:vec3<f32>, @location(3) e:f32, @location(4) r:f32, @location(5) a:vec4<f32>, @location(6) b:vec4<f32>, @location(7) d:vec4<f32>, @location(8) t:vec4<f32> };
struct Out { @builtin(position) p:vec4<f32>, @location(0) n:vec3<f32>, @location(1) c:vec3<f32>, @location(2) e:f32, @location(3) r:f32 };
@vertex fn vs(i:In)->Out { let model=mat4x4<f32>(i.a,i.b,i.d,i.t);var o:Out;o.p=camera.vp*model*vec4<f32>(i.p,1);o.n=(model*vec4<f32>(i.n,0)).xyz;o.c=i.c;o.e=i.e;o.r=i.r;return o; }
fn srgb(c:vec3<f32>)->vec3<f32>{return select(1.055*pow(max(c,vec3<f32>(0)),vec3<f32>(1.0/2.4))-0.055,12.92*c,c<=vec3<f32>(0.0031308));}
@fragment fn fs(i:Out)->@location(0) vec4<f32> {
 if(camera.mode.x>1.5){return vec4<f32>(vec3<f32>(i.r),1);}
 if(camera.mode.x>0.5){return vec4<f32>(vec3<f32>(i.e),1);}
 let shade=0.42+0.58*max(dot(normalize(i.n),normalize(vec3<f32>(0.5,0.9,0.65))),0.0);
 return vec4<f32>(srgb(min(i.c*(shade+i.e),vec3<f32>(1))),1);
}
struct LineOut{@builtin(position) p:vec4<f32>,@location(0) c:vec3<f32>};
@vertex fn lineVs(@location(0) p:vec3<f32>,@location(1) c:vec3<f32>)->LineOut{var o:LineOut;o.p=camera.vp*vec4<f32>(p,1);o.c=c;return o;}
@fragment fn lineFs(i:LineOut)->@location(0) vec4<f32>{return vec4<f32>(i.c,1);}
`;
export class Renderer {
  constructor(canvas,onError){this.canvas=canvas;this.onError=onError;this.target=[BOX_SIZE/2,BOX_SIZE/2,BOX_SIZE/2];this.eye=[0,0,0];this.yaw=2.45;this.pitch=0.6;this.radius=BOX_SIZE*1.3;this.mode=0;this.cache=new Map();this.draws=[];this.vp=new Float32Array(16);this.view=new Float32Array(16);this.proj=new Float32Array(16);this.cameraData=new Float32Array(20);this.pending=false;this.frames=0;this.bindControls();}
  async init(){
    if(!navigator.gpu)throw new Error('WebGPU is unavailable in this browser. Use the built-in Chrome with WebGPU enabled.');
    const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('No WebGPU adapter is available.');
    const device=this.device=await adapter.requestDevice();this.context=this.canvas.getContext('webgpu');this.format=navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({device,format:this.format,alphaMode:'opaque'});
    device.addEventListener('uncapturederror',e=>this.onError(e.error.message));
    device.lost.then(info=>{this.failed=true;this.onError(`WebGPU device lost: ${info.message}. Reload to reconnect.`);});
    const module=device.createShaderModule({code:shader});const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(m=>m.message).join('\n'));
    const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
    const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
    this.pipeline=await device.createRenderPipelineAsync({layout:pipelineLayout,vertex:{module,entryPoint:'vs',buffers:[{arrayStride:44,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x3'},{shaderLocation:3,offset:36,format:'float32'},{shaderLocation:4,offset:40,format:'float32'}]},{arrayStride:64,stepMode:'instance',attributes:[5,6,7,8].map((shaderLocation,i)=>({shaderLocation,offset:i*16,format:'float32x4'}))}]},fragment:{module,entryPoint:'fs',targets:[{format:this.format}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'},multisample:{count:4}});
    this.linePipeline=await device.createRenderPipelineAsync({layout:pipelineLayout,vertex:{module,entryPoint:'lineVs',buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'}]}]},fragment:{module,entryPoint:'lineFs',targets:[{format:this.format}]},primitive:{topology:'line-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less-equal'},multisample:{count:4}});
    this.cameraBuffer=device.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.bindGroup=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:this.cameraBuffer}}]});
    new ResizeObserver(()=>this.requestDraw()).observe(this.canvas);this.ready=true;this.requestDraw();return this;
  }
  buffer(data,usage){const buffer=this.device.createBuffer({size:Math.max(4,data.byteLength),usage:usage|GPUBufferUsage.COPY_DST});if(data.byteLength)this.device.queue.writeBuffer(buffer,0,data);return buffer;}
  setScene(entries,grid){
    if(!this.ready)return;const active=new Set();this.draws=[];
    for(const entry of entries){if(!entry.mesh.indices.length)continue;active.add(entry.key);let gpu=this.cache.get(entry.key);
      if(!gpu){gpu={vertices:this.buffer(entry.mesh.vertices,GPUBufferUsage.VERTEX),indices:this.buffer(entry.mesh.indices,GPUBufferUsage.INDEX),indexCount:entry.mesh.indices.length,instanceCapacity:0};this.cache.set(entry.key,gpu);}
      const instanceData=new Float32Array(entry.transforms.length*16);entry.transforms.forEach((m,i)=>instanceData.set(m,i*16));
      if(instanceData.byteLength>gpu.instanceCapacity){gpu.instances?.destroy();gpu.instanceCapacity=Math.max(64,instanceData.byteLength);gpu.instances=this.device.createBuffer({size:gpu.instanceCapacity,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});}
      this.device.queue.writeBuffer(gpu.instances,0,instanceData);this.draws.push({gpu,count:entry.transforms.length});
    }
    for(const [key,gpu]of this.cache)if(!active.has(key)){gpu.vertices.destroy();gpu.indices.destroy();gpu.instances.destroy();this.cache.delete(key);}
    this.gridBuffer?.destroy();this.gridBuffer=this.buffer(grid,GPUBufferUsage.VERTEX);this.gridCount=grid.length/6;this.requestDraw();
  }
  frame(target,radius){this.target[0]=target[0];this.target[1]=target[1];this.target[2]=target[2];this.radius=radius;this.requestDraw();}
  requestDraw(){if(this.pending||!this.ready||this.failed)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;this.draw();});}
  draw(){
    const c=this.canvas,dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(c.clientWidth*dpr)),h=Math.max(1,Math.round(c.clientHeight*dpr));
    if(c.width!==w||c.height!==h||!this.depth){c.width=w;c.height=h;this.depth?.destroy();this.color?.destroy();this.depth=this.device.createTexture({size:[w,h],format:'depth24plus',sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.color=this.device.createTexture({size:[w,h],format:this.format,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.depthView=this.depth.createView();this.colorView=this.color.createView();}
    const distance=this.radius*3;this.eye[0]=this.target[0]+Math.sin(this.yaw)*Math.cos(this.pitch)*distance;this.eye[1]=this.target[1]+Math.sin(this.pitch)*distance;this.eye[2]=this.target[2]+Math.cos(this.yaw)*Math.cos(this.pitch)*distance;
    lookAt(this.view,this.eye,this.target);ortho(this.proj,-this.radius*w/h,this.radius*w/h,-this.radius,this.radius,0.1,BOX_SIZE*800);multiply(this.vp,this.proj,this.view);this.cameraData.set(this.vp);this.cameraData[16]=this.mode;this.device.queue.writeBuffer(this.cameraBuffer,0,this.cameraData);
    const encoder=this.device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:this.colorView,resolveTarget:this.context.getCurrentTexture().createView(),clearValue:{r:0.071,g:0.094,b:0.086,a:1},loadOp:'clear',storeOp:'discard'}],depthStencilAttachment:{view:this.depthView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}});
    pass.setBindGroup(0,this.bindGroup);pass.setPipeline(this.pipeline);
    for(const draw of this.draws){pass.setVertexBuffer(0,draw.gpu.vertices);pass.setVertexBuffer(1,draw.gpu.instances);pass.setIndexBuffer(draw.gpu.indices,'uint32');pass.drawIndexed(draw.gpu.indexCount,draw.count);}
    if(this.gridCount){pass.setPipeline(this.linePipeline);pass.setVertexBuffer(0,this.gridBuffer);pass.draw(this.gridCount);}
    pass.end();this.device.queue.submit([encoder.finish()]);this.frames++;
  }
  bindControls(){let dragging=false,lastX=0,lastY=0,pan=false;const c=this.canvas;
    c.addEventListener('contextmenu',e=>e.preventDefault());
    c.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;pan=e.button!==0||e.shiftKey;c.setPointerCapture(e.pointerId);});
    c.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
      if(pan){const s=this.radius*2/c.clientHeight;this.target[0]-=dx*s*Math.cos(this.yaw);this.target[2]+=dx*s*Math.sin(this.yaw);this.target[0]-=dy*s*Math.sin(this.yaw);this.target[2]-=dy*s*Math.cos(this.yaw);}
      else{this.yaw-=dx*0.008;this.pitch=Math.max(0.08,Math.min(1.5,this.pitch+dy*0.008));}this.requestDraw();});
    const end=()=>dragging=false;c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);c.addEventListener('lostpointercapture',end);
    c.addEventListener('wheel',e=>{e.preventDefault();this.radius=Math.max(3,Math.min(BOX_SIZE*160,this.radius*Math.exp(e.deltaY*0.001)));this.requestDraw();},{passive:false});
  }
}
export function makeGrid(width,length,step=1,y=-0.02,boxes=[],pathHeight=null){
  const data=[],color=[0.20,0.27,0.23],major=[0.34,0.43,0.34];
  const line=(a,b,c)=>data.push(...a,...c,...b,...c);
  for(let x=0;x<=width;x+=step)line([x,y,0],[x,y,length],x%BOX_SIZE===0?major:color);
  for(let z=0;z<=length;z+=step)line([0,y,z],[width,y,z],z%BOX_SIZE===0?major:color);
  for(const box of boxes){const [x,by,z]=box;const p=[[x*BOX_SIZE,(pathHeight??by*BOX_SIZE)+0.03,z*BOX_SIZE],[(x+1)*BOX_SIZE,(pathHeight??by*BOX_SIZE)+0.03,z*BOX_SIZE],[(x+1)*BOX_SIZE,(pathHeight??by*BOX_SIZE)+0.03,(z+1)*BOX_SIZE],[x*BOX_SIZE,(pathHeight??by*BOX_SIZE)+0.03,(z+1)*BOX_SIZE]];for(let i=0;i<4;i++)line(p[i],p[(i+1)%4],[0.85,0.56,0.28]);}
  return new Float32Array(data);
}
