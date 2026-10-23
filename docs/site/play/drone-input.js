export class DroneInput {
 constructor(canvas,drone,allowed,onTarget=()=>{}){
  this.canvas=canvas;this.drone=drone;this.allowed=allowed;this.pointer=null;this.listeners=[];
  const listen=(type,fn)=>{canvas.addEventListener(type,fn,true);this.listeners.push([type,fn]);};
  listen('pointerdown',e=>{
   if(!allowed()||!drone.active||![0,2].includes(e.button)||this.pointer!==null)return;
   e.preventDefault();e.stopImmediatePropagation();this.pointer=e.pointerId;this.x=this.startX=e.clientX;this.y=this.startY=e.clientY;this.dragged=false;canvas.setPointerCapture(e.pointerId);canvas.focus();
  });
  listen('pointermove',e=>{
   if(this.pointer!==e.pointerId)return;if(!allowed()||!drone.active){this.clear();return;}
   const dx=e.clientX-this.x,dy=e.clientY-this.y;this.x=e.clientX;this.y=e.clientY;
   if(!this.dragged&&Math.hypot(e.clientX-this.startX,e.clientY-this.startY)<4)return;
   const hadTargeted=drone.hasTargeted;
   if(!this.dragged){this.dragged=true;drone.rotate(e.clientX-this.startX,e.clientY-this.startY);}else drone.rotate(dx,dy);
   if(!hadTargeted&&drone.hasTargeted)onTarget();
   e.preventDefault();e.stopImmediatePropagation();
  });
  listen('pointerup',e=>{
   if(this.pointer!==e.pointerId)return;
   e.preventDefault();e.stopImmediatePropagation();this.clear();
  });
  listen('pointercancel',()=>this.clear());listen('lostpointercapture',()=>this.clear());
 }
 clear(){const id=this.pointer;this.pointer=null;if(id!==null&&this.canvas.hasPointerCapture?.(id))this.canvas.releasePointerCapture(id);}
 dispose(){this.clear();for(const [type,fn]of this.listeners)this.canvas.removeEventListener(type,fn,true);this.listeners.length=0;}
}
