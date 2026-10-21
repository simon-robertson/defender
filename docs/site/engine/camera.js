import {lookAt,ortho,perspective,multiply} from '../shared/math.js';
import {BOX_SIZE} from '../shared/grid.js';
import {levelRoutes} from '../shared/routes.js';
const PAN_KEYS=new Set(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown']);
export const PATH_CAMERA_HEIGHT=12,PATH_CAMERA_FOV=80,PATH_CAMERA_SPEED=36;
export const FREE_CAMERA_SPEED=72;
export class Camera {
  constructor(canvas,invalidate){
    this.canvas=canvas;this.invalidate=invalidate;this.target=new Float32Array(3);this.eye=new Float32Array(3);
    this.view=new Float32Array(16);this.projection=new Float32Array(16);this.vp=new Float32Array(16);this.inverse=new Float32Array(16);
    this.keys=new Set();this.yaw=2.45;this.pitch=.68;this.radius=150;this.width=336;this.length=240;
    this.mode='overview';this.freeFly=false;this.fov=73;this.roll=0;this.pathModeEnabled=true;this.controlsEnabled=true;this.position=new Float64Array(3);this.overview=new Float64Array(6);this.frameGoal=new Float64Array(4);this.pathBounds=null;this.near=.1;this.far=2200;
    this.dragging=false;this.listeners=[];let pan=false,lx=0,ly=0;
    const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);this.listeners.push({target,type,handler,options});};
    listen(canvas,'contextmenu',e=>e.preventDefault());
    listen(canvas,'pointerdown',e=>{if(!this.controlsEnabled||(e.button!==0&&e.button!==2))return;this.dragging=true;pan=e.button===2||e.shiftKey;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.focus();});
    listen(canvas,'pointerup',()=>this.dragging=false);listen(canvas,'pointercancel',()=>this.dragging=false);listen(canvas,'lostpointercapture',()=>this.dragging=false);
    listen(canvas,'pointermove',e=>{if(!this.controlsEnabled||!this.dragging)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;
      if(this.mode==='overview'&&pan)this.pan(dx,dy);else{this.yaw-=dx*.006;this.pitch=Math.max(this.mode==='path'||this.freeFly?-1.54:.25,Math.min(this.mode==='path'||this.freeFly?1.54:1.48,this.pitch+dy*.005));}invalidate();});
    listen(canvas,'wheel',e=>{e.preventDefault();if(!this.controlsEnabled||this.mode==='path'||this.freeFly)return;this.radius=Math.max(35,Math.min(650,this.radius*Math.exp(e.deltaY*.001)));invalidate();},{passive:false});
    listen(canvas,'keydown',e=>{const key=e.key.toLowerCase();if(this.controlsEnabled&&PAN_KEYS.has(key)){e.preventDefault();this.keys.add(key);}});
    listen(canvas,'keyup',e=>this.keys.delete(e.key.toLowerCase()));listen(canvas,'blur',()=>{this.keys.clear();this.dragging=false;});
    // F works when a preview button has focus too, without stealing text input.
  }
  dispose(){for(const {target,type,handler,options} of this.listeners)target.removeEventListener?.(type,handler,options);this.listeners.length=0;this.onModeChange=null;this.setControlsEnabled(false);this.clearLevel();}
  setControlsEnabled(enabled){this.controlsEnabled=Boolean(enabled);if(!this.controlsEnabled){this.keys.clear();this.dragging=false;}}
  setLevel(level){
    this.level=level;this.routes=levelRoutes(level).filter(route=>route.path.length);this.width=level.size[0]*BOX_SIZE;this.length=level.size[1]*BOX_SIZE;
    // Cache the full tiles of every approach, including branches and shared tails.
    this.pathBounds=null;
    if(this.routes.length){
      let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
      for(const route of this.routes)for(const [x,,z]of route.path){minX=Math.min(minX,x*BOX_SIZE);minZ=Math.min(minZ,z*BOX_SIZE);maxX=Math.max(maxX,(x+1)*BOX_SIZE);maxZ=Math.max(maxZ,(z+1)*BOX_SIZE);}
      const margin=BOX_SIZE/2;
      this.pathBounds=[Math.max(0,minX-margin),Math.max(0,minZ-margin),Math.min(this.width,maxX+margin),Math.min(this.length,maxZ+margin)];
    }
    // Dense heights avoid Map string keys and temporary objects during movement.
    this.groundHeights=new Uint16Array(level.size[0]*level.size[1]);this.groundHeights.fill(level.terrain.defaultHeight);
    for(const box of level.terrain.boxes)this.groundHeights[box.box[1]*level.size[0]+box.box[0]]=box.ground;
    for(const bridge of level.bridges??[])for(const [x,z]of bridge.boxes)this.groundHeights[z*level.size[0]+x]=level.pathHeight;
    this.frame();
  }
  clearLevel(){this.level=null;this.routes=null;this.routeId=null;this.pathBounds=null;this.groundHeights=null;this.keys.clear();this.dragging=false;this.freeFly=false;this.mode='overview';this.onModeChange?.(this.mode);}
  groundHeight(x,z){const bx=Math.max(0,Math.min(this.level.size[0]-1,Math.floor(x/BOX_SIZE))),bz=Math.max(0,Math.min(this.level.size[1]-1,Math.floor(z/BOX_SIZE)));return this.groundHeights[bz*this.level.size[0]+bx];}
  toggleMode(random=Math.random){
    if(!this.controlsEnabled||!this.pathModeEnabled)return false;
    this.keys.clear();this.dragging=false;
    if(this.mode==='path'){
      for(let i=0;i<3;i++)this.target[i]=this.overview[i];this.yaw=this.overview[3];this.pitch=this.overview[4];this.radius=this.overview[5];this.mode='overview';
    }else{
      const routes=this.routes;if(!routes?.length)return false;
      // One random sample chooses a route and its starting box. Single-route
      // levels retain the exact previous random-box behavior.
      const sample=Math.max(0,Math.min(1-Number.EPSILON,random()))*routes.length,routeIndex=Math.floor(sample),path=routes[routeIndex].path;
      this.routeId=routes[routeIndex].id;
      this.overview.set(this.target);this.overview[3]=this.yaw;this.overview[4]=this.pitch;this.overview[5]=this.radius;
      const index=Math.min(path.length-1,Math.max(0,Math.floor((sample-routeIndex)*path.length))),box=path[index],next=path[index+1]??path[index-1];
      this.position[0]=(box[0]+.5)*BOX_SIZE;this.position[2]=(box[2]+.5)*BOX_SIZE;this.position[1]=this.groundHeight(this.position[0],this.position[2])+PATH_CAMERA_HEIGHT;
      this.yaw=next?Math.atan2(box[0]-next[0],box[2]-next[2]):0;this.pitch=0;this.mode='path';
    }
    this.canvas.focus();this.onModeChange?.(this.mode);this.invalidate();return true;
  }
  advance(deltaSeconds){
    if(!this.controlsEnabled)return;
    const k=this.keys,x=Number(k.has('a')||k.has('arrowleft'))-Number(k.has('d')||k.has('arrowright')),y=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'));
    if(!x&&!y)return;
    if(this.freeFly){
      const speed=FREE_CAMERA_SPEED*deltaSeconds/(x&&y?Math.SQRT2:1),s=Math.sin(this.yaw),c=Math.cos(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch),p=this.position;
      p[0]+=(-x*c-y*s*cp)*speed;p[1]-=y*sp*speed;p[2]+=(x*s-y*c*cp)*speed;this.invalidate();return;
    }
    if(this.mode==='path'){
      const speed=PATH_CAMERA_SPEED*deltaSeconds/(x&&y?Math.SQRT2:1),s=Math.sin(this.yaw),c=Math.cos(this.yaw),p=this.position,oldX=p[0],oldZ=p[2];
      p[0]=Math.max(0,Math.min(this.width-.001,p[0]+(-x*c-y*s)*speed));p[2]=Math.max(0,Math.min(this.length-.001,p[2]+(x*s-y*c)*speed));
      p[1]=this.groundHeight(p[0],p[2])+PATH_CAMERA_HEIGHT;if(p[0]!==oldX||p[2]!==oldZ)this.invalidate();return;
    }
    const speed=420*deltaSeconds/(x&&y?Math.SQRT2:1),previousX=this.target[0],previousZ=this.target[2];this.pan(x*speed,y*speed);if(previousX!==this.target[0]||previousZ!==this.target[2])this.invalidate();
  }
  pan(dx,dy){const scale=2*this.radius/Math.max(1,this.canvas.clientHeight),c=Math.cos(this.yaw),s=Math.sin(this.yaw),p=Math.sin(this.pitch);
    this.target[0]+=-dx*c*scale+dy*s*p*scale;this.target[2]+=dx*s*scale+dy*c*p*scale;
    this.target[0]=Math.max(-this.width*.3,Math.min(this.width*1.3,this.target[0]));this.target[2]=Math.max(-this.length*.3,Math.min(this.length*1.3,this.target[2]));
  }
  overviewFrame(out){
    const bounds=this.pathBounds,width=bounds?bounds[2]-bounds[0]:this.width,length=bounds?bounds[3]-bounds[1]:this.length;
    const aspect=this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight),horizontal=Math.abs(Math.cos(this.yaw))*width+Math.abs(Math.sin(this.yaw))*length;
    const vertical=(Math.abs(Math.sin(this.yaw))*width+Math.abs(Math.cos(this.yaw))*length)*Math.sin(this.pitch)+80*Math.cos(this.pitch);
    out[0]=bounds?(bounds[0]+bounds[2])/2:this.width/2;out[1]=bounds?(this.level.pathHeight??24):22;out[2]=bounds?(bounds[1]+bounds[3])/2:this.length/2;out[3]=Math.max(horizontal/aspect,vertical)*.54;
    return out;
  }
  frame(width=this.width,length=this.length){this.mode='overview';this.keys.clear();this.dragging=false;this.width=width;this.length=length;this.yaw=2.45;this.pitch=.68;
    const goal=this.overviewFrame(this.frameGoal);this.target.set(goal.subarray(0,3));this.radius=goal[3];this.onModeChange?.(this.mode);this.invalidate();
  }
  update(aspect){
    const c=Math.cos(this.pitch),s=Math.sin(this.pitch),sx=Math.sin(this.yaw)*c,sz=Math.cos(this.yaw)*c,perspectiveMode=this.mode==='path'||this.mode==='live';
    if(perspectiveMode){
      this.eye.set(this.position);this.target[0]=this.eye[0]-sx;this.target[1]=this.eye[1]-s;this.target[2]=this.eye[2]-sz;
      perspective(this.projection,(this.mode==='live'?this.fov:PATH_CAMERA_FOV)*Math.PI/180,aspect,this.near,this.far);
    }else{
      this.eye[0]=this.target[0]+sx*900;this.eye[1]=this.target[1]+s*900;this.eye[2]=this.target[2]+sz*900;
      ortho(this.projection,-this.radius*aspect,this.radius*aspect,-this.radius,this.radius,this.near,this.far);
    }
    lookAt(this.view,this.eye,this.target);
    if(this.mode==='live'&&this.roll){const cr=Math.cos(this.roll),sr=Math.sin(this.roll);for(let col=0;col<16;col+=4){const x=this.view[col],y=this.view[col+1];this.view[col]=cr*x+sr*y;this.view[col+1]=-sr*x+cr*y;}}
    multiply(this.vp,this.projection,this.view);
    // Inverse rigid view × inverse projection, using the same reusable arrays.
    const v=this.view,p=this.projection,o=this.inverse;
    const determinant=p[10]*p[15]-p[14]*p[11];
    for(let r=0;r<3;r++){
      o[r]=v[r*4]/p[0];o[4+r]=v[r*4+1]/p[5];
      o[8+r]=(v[r*4+2]*p[15]-this.eye[r]*p[11])/determinant;
      o[12+r]=(-v[r*4+2]*p[14]+this.eye[r]*p[10])/determinant;
    }
    o[3]=o[7]=0;o[11]=-p[11]/determinant;o[15]=p[10]/determinant;
  }
}
