// CPU reproduction of immediate production view changes. No browser/session
// connection or saved asset writes. The rejected hand-off verifier is archived
// beside its historical evidence in docs/todo-delivery-2026-10-20/.
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../play/engine.js';
import {PLAY_CONFIG} from '../play/config.js';
import {Camera} from '../engine/camera.js';
import {ActionCamera} from '../play/action-camera.js';
import {DroneCamera} from '../play/drone-camera.js';
import {CameraViews} from '../play/camera-views.js';
import assert from 'node:assert/strict';
const native=globalThis.fetch,records=[];
globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(`assets/${kind}/${id}.json`).json()})};};
function mode(camera,aspect,expected){camera.update(aspect);assert.equal(camera.mode,expected);const live=expected==='live';assert.equal(camera.projection[11],live?-1:0);assert.equal(camera.projection[15],live?0:1);}
try{for(const id of ['moss-01','ochre-04'])for(const hz of [30,60,120])for(const aspect of [.8,1.5,2.4]){
 const wave=PLAY_CONFIG.levels.find(l=>l.id===id).waves[0],world=await loadPlayWorld(id,{wave}),engine=new PlayEngine(world,{wave});
 const c=new Camera({clientWidth:1200,clientHeight:800,addEventListener(){},focus(){}},()=>{}),overview=new ActionCamera(c),drone=new DroneCamera(c,{random:()=>.5}),views=new CameraViews(overview,drone);
 try{
  c.setLevel(world.level);mode(c,aspect,'overview');views.bind(world);const initial={target:[...c.target],yaw:c.yaw,pitch:c.pitch,radius:c.radius};engine.startWave();views.sync('wave',engine);mode(c,aspect,'live');
  assert.deepEqual([...c.eye],[...new Float32Array(drone.position)]);const entryPosition=[...drone.position];
  for(let frame=1;frame<=hz;frame++){engine.advance(1/hz);views.advance(1/hz,{engine,phase:'wave'});mode(c,aspect,'live');}
  const beforePause=[...c.vp],time=drone.time;views.advance(2,{engine,phase:'wave',paused:true});c.update(aspect);assert.deepEqual([...c.vp],beforePause);assert.equal(drone.time,time);
  views.sync('settling',engine);mode(c,aspect,'live');assert(drone.active);
  views.sync('loadout',engine);mode(c,aspect,'overview');assert(!drone.active);assert.deepEqual({target:[...c.target],yaw:c.yaw,pitch:c.pitch,radius:c.radius},initial);
  views.sync('wave',engine);mode(c,aspect,'live');views.toggleOverview();mode(c,aspect,'overview');assert.equal(views.selected,'overview');assert(overview.enabled);
  views.toggle('drone');views.sync('wave',engine);mode(c,aspect,'live');views.frame();c.frame();mode(c,aspect,'overview');assert.equal(views.selected,'overview');
  views.reset();views.sync('loadout',engine);mode(c,aspect,'overview');assert.equal(views.selected,'drone');views.sync('wave',engine);mode(c,aspect,'live');views.sync('complete',engine);mode(c,aspect,'overview');
  views.bind(null);assert.equal(drone.world,null);assert.equal(overview.world,null);assert.equal(drone.active,false);
  records.push({level:id,hz,aspect,entryPosition,immediateEntry:true,immediatePreparation:true,pauseExact:true,settlingRetained:true,auto:true,frame:true,reset:true,completion:true,unbind:true});
 }finally{drone.dispose();overview.dispose();engine.dispose();disposePlayWorld(world);c.dispose();}
}}finally{globalThis.fetch=native;}
const report={status:'pass',method:'18 actual production Camera/Drone/Views/PlayEngine replays across A1/B4, 30/60/120 Hz and .8/1.5/2.4 aspects. Every view endpoint is asserted before advancing another frame; pause, settling, Auto, Frame, reset, completion and unbind are checked. Browser/app lifecycle verified separately.',records};
await Bun.write('docs/todo-follow-up-2026-10-20/camera-endpoints.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,replays:records.length,levels:['moss-01','ochre-04'],checks:records[0]},null,2));
