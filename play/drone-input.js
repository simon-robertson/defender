export class DroneInput {
 constructor(canvas,drone,allowed,onTarget=()=>{}){
  this.canvas=canvas;this.drone=drone;this.allowed=allowed;this.pointer=null;this.listeners=[];this.keys=new Set();
  const listen=(type,fn,target=canvas)=>{target.addEventListener(type,fn,true);this.listeners.push([target,type,fn]);};
  const keyboard=canvas.ownerDocument??canvas;
  listen('keydown',e=>{
   if(e.ctrlKey||e.metaKey||e.altKey||e.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)){this.clearKeys();return;}
   const key=e.key.toLowerCase();if(!'wasd'.includes(key)||key.length!==1)return;
   if(!allowed()||!drone.active){this.clearKeys();return;}
   e.preventDefault();e.stopImmediatePropagation();this.keys.add(key);
   const hadTargeted=drone.hasTargeted;this.updateKeys();if(!hadTargeted&&drone.hasTargeted)onTarget();
  },keyboard);
  listen('keyup',e=>{if(this.keys.delete(e.key.toLowerCase())){this.updateKeys();e.preventDefault();}},keyboard);
  listen('blur',()=>this.clear(),canvas.ownerDocument?.defaultView??canvas);
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
   e.preventDefault();e.stopImmediatePropagation();this.clearPointer();
  });
  listen('pointercancel',()=>this.clearPointer());listen('lostpointercapture',()=>this.clearPointer());
 }
 updateKeys(){this.drone.setKeyboard(Number(this.keys.has('w'))-Number(this.keys.has('s')),Number(this.keys.has('d'))-Number(this.keys.has('a')),this.keys.size>0);}
 clearKeys(){if(this.keys.size){this.keys.clear();this.updateKeys();}}
 clearPointer(){const id=this.pointer;this.pointer=null;if(id!==null&&this.canvas.hasPointerCapture?.(id))this.canvas.releasePointerCapture(id);}
 clear(){this.clearPointer();this.clearKeys();}
 dispose(){this.clear();for(const [target,type,fn]of this.listeners)target.removeEventListener(type,fn,true);this.listeners.length=0;}
}
