// Reproduce the production camera hand-off entirely on CPU. Never connects to
// the browser, changes production code or touches a saved game.
import {loadPlayWorld,PlayEngine,disposePlayWorld} from '../../../play/engine.js';
import {PLAY_CONFIG} from '../../../play/config.js';
import {Camera} from '../../../engine/camera.js';
import {ActionCamera} from '../../../play/action-camera.js';
import {DroneCamera} from '../../../play/drone-camera.js';
import {CameraViews} from '../../../play/camera-views.js';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const tracked=['engine/camera.js','play/view-transition.js','play/camera-views.js','play/drone-camera.js','play/app.js'];
const hash=async path=>createHash('sha256').update(await Bun.file(path).bytes()).digest('hex');
const hashes=Object.fromEntries(await Promise.all(tracked.map(async p=>[p,await hash(p)]))),native=globalThis.fetch;
globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(`assets/${kind}/${id}.json`).json()})};};
const records=[];
function projected(c,p){const m=c.vp,w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];return [(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w,(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w];}
try{for(const id of ['moss-01','ochre-04']){
 const wave=PLAY_CONFIG.levels.find(l=>l.id===id).waves[0],world=await loadPlayWorld(id,{wave}),engine=new PlayEngine(world,{wave});
 const c=new Camera({clientWidth:1200,clientHeight:800,addEventListener(){},focus(){}},()=>{}),overview=new ActionCamera(c),drone=new DroneCamera(c,{random:()=>.5}),views=new CameraViews(overview,drone);
 try{
  c.setLevel(world.level);c.update(1.5);views.bind(world);engine.startWave();views.sync('wave',engine);
  const destinationBlendAtEntry=views.transition.to.blend,reference=[...drone.look],top=[reference[0],reference[1]+12,reference[2]],frames=[];
  function record(frame){c.update(1.5);const a=projected(c,reference),b=projected(c,top);frames.push({frame,seconds:frame/60,transition:views.transition.running,blend:c.transitionProjection?.blend??1,destinationBlend:views.transition.to?.blend,displayEyeY:c.eye[1],droneY:drone.position[1],zoom:c.transitionProjection?.zoom??null,markerPixels:Math.hypot((a[0]-b[0])*600,(a[1]-b[1])*400)});}
  record(0);for(let frame=1;frame<=90;frame++){engine.advance(1/60);views.advance(1/60,{engine,phase:'wave',paused:false});record(frame);}
  const during=frames.filter(f=>f.frame>0&&f.transition),end=frames.findIndex(f=>f.frame>0&&!f.transition),min=during.reduce((a,b)=>a.markerPixels<b.markerPixels?a:b);
  assert.equal(destinationBlendAtEntry,1);assert(during.every(f=>f.blend===0&&f.destinationBlend===0));assert.equal(frames[end].blend,1);
  records.push({level:id,destinationBlendAtEntry,firstFrameDestinationBlend:frames[1].destinationBlend,transitionCompletionSeconds:frames[end].seconds,physicalDroneYRange:[Math.min(...frames.map(f=>f.droneY)),Math.max(...frames.map(f=>f.droneY))],markerInitialPixels:frames[0].markerPixels,markerMinimumPixels:min.markerPixels,markerMinimumSeconds:min.seconds,completionMarkerPixelJump:frames[end].markerPixels/frames[end-1].markerPixels,frames});
 }finally{drone.dispose();engine.dispose();disposePlayWorld(world);c.dispose();}
}}finally{globalThis.fetch=native;}
for(const path of tracked)assert.equal(await hash(path),hashes[path]);
const report={status:'Confirmed projection feedback defect in production CPU replay; pending fix, no production changes.',method:'Production Camera, DroneCamera, CameraViews, ActionCamera and PlayEngine; first wave without defences;60Hz CPU frame ordering mirrors play/app.js then renderer Camera.update(1.5). Deterministic cosmetic random=.5. No browser/GPU screenshot or claim of reproducing the exact user scene.',hashes,records};
await Bun.write('docs/research/drone-start-transition-2026-10-20/replay.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(records.map(({frames,...r})=>r),null,2));
