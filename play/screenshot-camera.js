// A temporary camera owner. Simulation/director state never advances here.
export {FREE_CAMERA_SPEED as SCREENSHOT_CAMERA_SPEED} from '../engine/camera.js';
const scalars=['mode','yaw','pitch','radius','fov','roll','near','far','controlsEnabled','freeFly'];
const vectors=['position','target','eye','overview','frameGoal'];
export class ScreenshotCamera {
 constructor(camera){this.camera=camera;this.saved=null;}
 get active(){return this.saved!==null;}
 toggle(paused){if(!paused)return false;if(this.active)this.leave();else this.enter();return true;}
 enter(){
  if(this.active)return false;const c=this.camera,saved={};
  for(const name of scalars)saved[name]=c[name];for(const name of vectors)saved[name]=c[name].slice();this.saved=saved;
  if(c.mode!=='live'&&c.mode!=='path'){
   c.update(c.canvas.clientWidth/Math.max(1,c.canvas.clientHeight));c.position.set(c.eye);
   c.fov=2*Math.atan(c.radius/900)*180/Math.PI;
  }
  c.mode='live';c.freeFly=true;c.setControlsEnabled(true);c.keys.clear();c.dragging=false;c.invalidate();return true;
 }
 leave(){
  if(!this.active)return false;const c=this.camera,saved=this.saved;this.saved=null;
  c.setControlsEnabled(false);for(const name of scalars)c[name]=saved[name];for(const name of vectors)c[name].set(saved[name]);
  c.keys.clear();c.dragging=false;c.invalidate();return true;
 }
 advance(seconds){if(this.active)this.camera.advance(seconds);}
 clearInput(){this.camera.keys.clear();this.camera.dragging=false;}
 dispose(){this.leave();this.camera=null;}
}
