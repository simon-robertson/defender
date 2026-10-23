// WebGPU depth ray, including the perspective divide at both endpoints.
export function pickDroneTarget(camera,event,world,out){
 const rect=camera.canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*2-1,y=1-(event.clientY-rect.top)/rect.height*2,m=camera.inverse;
 const aw=m[3]*x+m[7]*y+m[15],bw=aw+m[11];
 if(!Number.isFinite(aw*bw)||Math.abs(aw)<1e-12||Math.abs(bw)<1e-12)return false;
 const ax=(m[0]*x+m[4]*y+m[12])/aw,ay=(m[1]*x+m[5]*y+m[13])/aw,az=(m[2]*x+m[6]*y+m[14])/aw;
 const bx=(m[0]*x+m[4]*y+m[8]+m[12])/bw,by=(m[1]*x+m[5]*y+m[9]+m[13])/bw,bz=(m[2]*x+m[6]*y+m[10]+m[14])/bw;
 const t=(world.level.pathHeight-ay)/(by-ay),px=ax+(bx-ax)*t,pz=az+(bz-az)*t;
 if(!Number.isFinite(t+px+pz)||t<0||px<0||pz<0||px>world.width||pz>world.length)return false;
 out[0]=px;out[1]=world.level.pathHeight;out[2]=pz;return true;
}

export class DroneInput {
 constructor(canvas,drone,allowed){
  this.canvas=canvas;this.drone=drone;this.allowed=allowed;this.pointer=null;this.point=new Float64Array(3);this.listeners=[];
  const listen=(type,fn)=>{canvas.addEventListener(type,fn,true);this.listeners.push([type,fn]);};
  listen('pointerdown',e=>{
   if(!allowed()||!drone.active||![0,2].includes(e.button)||this.pointer!==null)return;
   e.preventDefault();e.stopImmediatePropagation();this.pointer=e.pointerId;this.button=e.button;this.x=this.startX=e.clientX;this.y=this.startY=e.clientY;this.dragged=false;canvas.setPointerCapture(e.pointerId);canvas.focus();
  });
  listen('pointermove',e=>{
   if(this.pointer!==e.pointerId)return;if(!allowed()||!drone.active){this.clear();return;}
   const dx=e.clientX-this.x,dy=e.clientY-this.y;this.x=e.clientX;this.y=e.clientY;
   if(!this.dragged&&Math.hypot(e.clientX-this.startX,e.clientY-this.startY)<4)return;
   if(!this.dragged){this.dragged=true;drone.rotate(e.clientX-this.startX,e.clientY-this.startY);}else drone.rotate(dx,dy);
   e.preventDefault();e.stopImmediatePropagation();
  });
  listen('pointerup',e=>{
   if(this.pointer!==e.pointerId)return;
   if(allowed()&&drone.active&&!this.dragged&&this.button===0&&Math.hypot(e.clientX-this.startX,e.clientY-this.startY)<4&&pickDroneTarget(drone.camera,e,drone.world,this.point))drone.targetAt(...this.point);
   e.preventDefault();e.stopImmediatePropagation();this.clear();
  });
  listen('pointercancel',()=>this.clear());listen('lostpointercapture',()=>this.clear());
 }
 clear(){const id=this.pointer;this.pointer=null;if(id!==null&&this.canvas.hasPointerCapture?.(id))this.canvas.releasePointerCapture(id);}
 dispose(){this.clear();for(const [type,fn]of this.listeners)this.canvas.removeEventListener(type,fn,true);this.listeners.length=0;}
}
