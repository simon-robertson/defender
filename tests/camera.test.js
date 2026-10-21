import {test,expect} from 'bun:test';
import {Camera,PATH_CAMERA_SPEED} from '../engine/camera.js';
import {multiply,perspective} from '../shared/math.js';
const level={size:[8,5],path:[[1,0,2],[2,0,2],[3,0,2]],terrain:{defaultHeight:24,boxes:[{box:[2,3],ground:4,water:12},{box:[3,3],ground:41,water:0}]}};
function camera(){
 const handlers=new Map();const canvas={clientWidth:1200,clientHeight:800,focus(){},setPointerCapture(){},addEventListener(type,fn){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(fn);}};
 const c=new Camera(canvas,()=>{});c.setLevel(level);return {c,send(type,event={}){for(const fn of handlers.get(type)??[])fn({preventDefault(){},...event});}};
}
const transform=(m,p)=>[0,1,2,3].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]*p[3]);
test('overview fits full path tiles and all approaches while retaining landscape movement bounds',()=>{
 const {c}=camera();
 expect([...c.target]).toEqual([60,24,60]);expect([c.width,c.length]).toEqual([192,120]);
 const close=c.radius;c.setLevel({...level,path:[]});expect(c.radius).toBeGreaterThan(close);
 const routed={...level,pathHeight:41,routes:[{id:'branch',path:[[7,0,4],[6,0,4]]}]};c.setLevel(routed);
 expect([...c.target]).toEqual([102,41,78]);
 for(const aspect of [.5,1,1.5,2.5])for(const yaw of [0,.8,2.45,4])for(const pitch of [.25,.68,1.48]){
  c.canvas.clientWidth=800*aspect;c.yaw=yaw;c.pitch=pitch;const goal=c.overviewFrame(new Float64Array(4));c.target.set(goal.subarray(0,3));c.radius=goal[3];c.update(aspect);
  for(const route of [routed.path,...routed.routes.map(r=>r.path)])for(const [x,,z]of route)for(const dx of [0,24])for(const dz of [0,24]){
   const clip=transform(c.vp,[x*24+dx,41,z*24+dz,1]);expect(Math.abs(clip[0])).toBeLessThan(1);expect(Math.abs(clip[1])).toBeLessThan(1);
  }
 }
 // A secondary route alone still counts; the next pathless level drops old bounds.
 c.setLevel({...routed,path:[]});expect(c.pathBounds).not.toBeNull();
 c.setLevel({...level,path:[]});expect(c.pathBounds).toBeNull();expect([...c.target]).toEqual([96,22,60]);
 const horizontal=Math.abs(Math.cos(2.45))*192+Math.abs(Math.sin(2.45))*120,vertical=(Math.abs(Math.sin(2.45))*192+Math.abs(Math.cos(2.45))*120)*Math.sin(.68)+80*Math.cos(.68);
 expect(c.radius).toBe(Math.max(horizontal/2.5,vertical)*.54);c.clearLevel();expect(c.pathBounds).toBeNull();
});
test('player camera can disable development path view without changing preview default',()=>{
 const {c,send}=camera();c.pathModeEnabled=false;send('keydown',{key:'f'});expect(c.mode).toBe('overview');expect(c.toggleMode()).toBe(false);
 c.pathModeEnabled=true;expect(c.toggleMode()).toBe(true);
});
test('fixed title camera ignores zoom, drag and held keys, then restores normal controls',()=>{
 const {c,send}=camera();send('keydown',{key:'w'});c.setControlsEnabled(false);
 const before={radius:c.radius,yaw:c.yaw,pitch:c.pitch,target:[...c.target]};expect(c.keys.size).toBe(0);
 send('wheel',{deltaY:300});send('pointerdown',{button:0,clientX:0,clientY:0,pointerId:1});send('pointermove',{clientX:200,clientY:200});
 send('keydown',{key:'w'});send('keydown',{key:'f'});c.advance(1);
 expect({radius:c.radius,yaw:c.yaw,pitch:c.pitch,target:[...c.target]}).toEqual(before);expect(c.mode).toBe('overview');expect(c.dragging).toBe(false);
 c.setControlsEnabled(true);send('wheel',{deltaY:300});expect(c.radius).toBeGreaterThan(before.radius);send('keydown',{key:'w'});c.advance(.1);expect([...c.target]).not.toEqual(before.target);
});
test('path view samples every path box and restores the complete overview',()=>{
 const {c}=camera();c.target.set([70,29,60]);c.yaw=1.3;c.pitch=.9;c.radius=88;const original=Array.from(c.target);
 for(let i=0;i<level.path.length;i++){
  expect(c.toggleMode(()=>(i+.5)/level.path.length)).toBe(true);expect(c.mode).toBe('path');expect(Array.from(c.position)).toEqual([(level.path[i][0]+.5)*24,36,60]);
  c.update(1.5);c.keys.add('w');c.advance(.3);c.yaw+=.4;c.pitch=-.4;c.toggleMode();
  expect(c.mode).toBe('overview');expect(Array.from(c.target)).toEqual(original);expect([c.yaw,c.pitch,c.radius]).toEqual([1.3,.9,88]);expect(c.keys.size).toBe(0);
 }
});
test('F ignores auto-repeat and text editing; frame exits path view and clears held input',()=>{
 const {c,send}=camera();send('keydown',{key:'F'});expect(c.mode).toBe('path');send('keydown',{key:'f',repeat:true});expect(c.mode).toBe('path');
 send('keydown',{key:'f',target:{tagName:'INPUT'}});send('keydown',{key:'f',ctrlKey:true});expect(c.mode).toBe('path');send('keydown',{key:'f'});expect(c.mode).toBe('overview');
 c.toggleMode(()=>0);send('keydown',{key:'w'});c.frame();expect(c.mode).toBe('overview');expect(c.keys.size).toBe(0);
 c.setLevel({...level,path:[]});expect(c.toggleMode()).toBe(false);expect(c.mode).toBe('overview');
});
test('path WASD is horizontal, camera-relative and frame-rate independent with normalized diagonals',()=>{
 function move(hz,keys,pitch=0){const {c}=camera();c.toggleMode(()=>.5);c.yaw=.7;c.pitch=pitch;const start=Array.from(c.position);for(const key of keys)c.keys.add(key);for(let i=0;i<hz;i++)c.advance(1/hz);return Array.from(c.position,(v,i)=>v-start[i]);}
 const a=move(30,['w']),b=move(144,['w'],1.5),diagonal=move(60,['w','d']);for(let i=0;i<3;i++)expect(a[i]).toBeCloseTo(b[i],8);
 expect(a[0]).toBeCloseTo(-Math.sin(.7)*PATH_CAMERA_SPEED,8);expect(a[2]).toBeCloseTo(-Math.cos(.7)*PATH_CAMERA_SPEED,8);expect(a[1]).toBe(0);expect(Math.hypot(diagonal[0],diagonal[2])).toBeCloseTo(PATH_CAMERA_SPEED,8);
 const opposite=move(60,['w','s','a','d']);expect(opposite).toEqual([0,0,0]);
});
test('path camera stays 12 above ground through stream beds, mounds and level edges',()=>{
 const {c}=camera();c.toggleMode(()=>.5);c.yaw=0;c.keys.add('s');c.advance(20/36);expect(Array.from(c.position)).toEqual([60,16,80]);
 c.keys.clear();c.keys.add('d');c.advance(24/36);expect(Array.from(c.position)).toEqual([84,53,80]);
 c.advance(100);expect(c.position[0]).toBeCloseTo(192-.001);expect(c.position[1]).toBe(36);c.keys.clear();c.keys.add('w');c.advance(100);expect(c.position[2]).toBe(0);expect(c.position[1]).toBe(36);
 // Model placements deliberately do not participate in height or collision checks.
 expect(c.groundHeights.byteLength).toBe(level.size[0]*level.size[1]*2);
});
test('development drag rotates path view without translating; wheel cannot change FOV or height',()=>{
 const {c,send}=camera();c.toggleMode(()=>.5);const p=Array.from(c.position),radius=c.radius,yaw=c.yaw;
 send('pointerdown',{button:2,clientX:200,clientY:100,pointerId:1});send('pointermove',{clientX:230,clientY:140});expect(c.yaw).toBeCloseTo(yaw-.18);expect(c.pitch).toBeCloseTo(.2);expect(Array.from(c.position)).toEqual(p);
 send('pointermove',{clientX:230,clientY:9000});expect(c.pitch).toBe(1.54);send('pointerup');send('pointermove',{clientX:500,clientY:500});expect(c.pitch).toBe(1.54);
 send('wheel',{deltaY:400});expect(c.radius).toBe(radius);c.keys.add('w');send('blur');expect(c.keys.size).toBe(0);
});
test('80 degree perspective maps WebGPU near/far depth and camera inverse reconstructs world points',()=>{
 const p=new Float32Array(16);perspective(p,80*Math.PI/180,1.5,.1,2200);
 expect(2*Math.atan(1/p[5])*180/Math.PI).toBeCloseTo(80,5);for(const [z,expected]of [[-.1,0],[-2200,1]]){const clip=transform(p,[0,0,z,1]);expect(clip[2]/clip[3]).toBeCloseTo(expected,6);}
 const {c}=camera();c.toggleMode(()=>.5);
 for(const aspect of [.7,1.5,2.4])for(const yaw of [0,.7,2.4])for(const pitch of [-1.4,0,1.4]){
  c.yaw=yaw;c.pitch=pitch;c.update(aspect);const product=new Float32Array(16);multiply(product,c.vp,c.inverse);
  for(let i=0;i<16;i++)expect(product[i]).toBeCloseTo(i%5===0?1:0,3);
  for(const distance of [1,12,100]){const point=[c.eye[0]-Math.sin(yaw)*Math.cos(pitch)*distance,c.eye[1]-Math.sin(pitch)*distance,c.eye[2]-Math.cos(yaw)*Math.cos(pitch)*distance,1],clip=transform(c.vp,point),restored=transform(c.inverse,clip.map(v=>v/clip[3]));for(let i=0;i<3;i++)expect(restored[i]/restored[3]).toBeCloseTo(point[i],1);}
 }
});


test('camera disposal removes canvas and document handlers before a renderer retry',()=>{
 const documentTarget=new EventTarget(),canvas=new EventTarget();Object.assign(canvas,{ownerDocument:documentTarget,clientWidth:1200,clientHeight:800,focus(){},setPointerCapture(){}});
 const event=(target,type,fields={})=>{const e=new Event(type,{cancelable:true});for(const [key,value]of Object.entries(fields))Object.defineProperty(e,key,{value});target.dispatchEvent(e);return e;};
 let oldInvalidations=0,newInvalidations=0;const old=new Camera(canvas,()=>oldInvalidations++);old.setLevel(level);old.dispose();old.dispose();const stale=oldInvalidations;
 expect(old.listeners).toHaveLength(0);expect(old.level).toBeNull();expect(old.keys.size).toBe(0);expect(event(canvas,'contextmenu').defaultPrevented).toBe(false);
 const current=new Camera(canvas,()=>newInvalidations++);current.setLevel(level);const radius=current.radius;
 event(canvas,'wheel',{deltaY:100});expect(current.radius).toBeCloseTo(radius*Math.exp(.1));event(canvas,'keydown',{key:'w'});expect(current.keys.has('w')).toBe(true);expect(old.keys.size).toBe(0);
 event(documentTarget,'keydown',{key:'f'});expect(current.mode).toBe('path');expect(old.mode).toBe('overview');expect(oldInvalidations).toBe(stale);expect(newInvalidations).toBeGreaterThan(1);
 current.dispose();const ended=newInvalidations;expect(event(canvas,'wheel',{deltaY:100}).defaultPrevented).toBe(false);expect(event(documentTarget,'keydown',{key:'f'}).defaultPrevented).toBe(false);expect(newInvalidations).toBe(ended);
});
