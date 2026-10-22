// Release Drone before restoring or capturing the overview:
// Camera.update() rewrites target while in perspective mode.
export class CameraViews {
 constructor(overview,drone){this.overview=overview;this.drone=drone;this.drone.setEnabled(true);}
 get active(){return this.drone.active?this.drone:null;}
 get selected(){return this.drone.enabled?'drone':'overview';}
 release(){this.drone.setEnabled(false);}
 reset(){this.release();this.drone.setEnabled(true);this.overview.resume();}
 toggle(kind){
  if(kind!=='drone')throw new Error('Unknown camera view.');
  const enable=!this[kind].enabled;this.release();this[kind].setEnabled(enable);this.overview.manualOverride(0);return this.selected;
 }
 toggleOverview(preparing=false){
  const selected=this.selected;this.release();
  if(selected!=='overview'||preparing||!this.overview.enabled)this.overview.resume();else this.overview.setEnabled(false);
 }
 frame(){this.release();this.overview.manualOverride(0);}
 bind(world){this.drone.bind(world);this.overview.bind(world);}
 refresh(){this.drone.refresh();}
 sync(phase,engine){const active=this.drone.active;this.drone.sync(phase,engine);
  if(active&&!this.drone.active)this.overview.capture?.();
 }
 advance(dt,state){this.sync(state.phase,state.engine);this.drone.advance(dt,state);
  if(!this.active)this.overview.advance(dt,state);
 }
 noteExplosion(state,at){this.drone.noteExplosion(state,at);}
 noteActivity(x,y,z,at,weight){this.drone.noteActivity(x,y,z,at,weight);}
}
