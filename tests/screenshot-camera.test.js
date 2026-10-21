import {test,expect} from 'bun:test';
import {Camera,FREE_CAMERA_SPEED} from '../engine/camera.js';
import {ScreenshotCamera} from '../play/screenshot-camera.js';
function fixture(mode='live'){
 const handlers=new Map(),canvas={clientWidth:1200,clientHeight:800,focus(){},setPointerCapture(){},addEventListener(type,handler){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(handler);}};
 const camera=new Camera(canvas,()=>{});camera.setLevel({size:[20,16],pathHeight:24,path:[],terrain:{defaultHeight:24,boxes:[]}});camera.mode=mode;camera.position.set([150,110,90]);camera.yaw=.8;camera.pitch=.4;camera.fov=61;camera.roll=.02;camera.setControlsEnabled(false);camera.update(1.5);
 return {camera,photo:new ScreenshotCamera(camera),send(type,event){for(const fn of handlers.get(type)??[])fn({preventDefault(){},...event});}};
}
test('screenshot camera restores the exact paused projection/pose after free flight and dragging',()=>{
 for(const mode of ['live','overview']){
  const {camera:c,photo,send}=fixture(mode),before={mode:c.mode,yaw:c.yaw,pitch:c.pitch,radius:c.radius,fov:c.fov,roll:c.roll,position:[...c.position],target:[...c.target],eye:[...c.eye],vp:[...c.vp]};
  expect(photo.toggle(false)).toBe(false);expect(c.controlsEnabled).toBe(false);photo.toggle(true);expect(photo.active).toBe(true);expect(c.controlsEnabled).toBe(true);
  send('keydown',{key:'w'});photo.advance(.5);send('keyup',{key:'w'});send('pointerdown',{button:0,clientX:200,clientY:200,pointerId:1});send('pointermove',{clientX:250,clientY:170});
  expect([...c.position]).not.toEqual(before.position);expect(c.yaw).not.toBe(before.yaw);expect(c.pitch).not.toBe(before.pitch);
  photo.toggle(true);c.update(1.5);expect(photo.active).toBe(false);expect(c.controlsEnabled).toBe(false);expect(c.freeFly).toBe(false);expect(c.keys.size).toBe(0);expect(c.dragging).toBe(false);
  expect({mode:c.mode,yaw:c.yaw,pitch:c.pitch,radius:c.radius,fov:c.fov,roll:c.roll,position:[...c.position],target:[...c.target],eye:[...c.eye],vp:[...c.vp]}).toEqual(before);
  photo.enter();photo.dispose();expect(c.mode).toBe(before.mode);expect(c.controlsEnabled).toBe(false);
 }
});
test('free flight follows pitch, strafes, normalizes diagonal speed and is independent of frame rate',()=>{
 const travel=(keys,steps)=>{const {camera:c,photo,send}=fixture();photo.enter();const from=[...c.position];for(const key of keys)send('keydown',{key});for(let i=0;i<steps;i++)photo.advance(1/steps);return c.position.map((value,i)=>value-from[i]);};
 const forward=travel(['w'],60),back=travel(['s'],60),left=travel(['a'],60),right=travel(['d'],60),diagonal=travel(['w','d'],120);
 expect(forward[1]).toBeLessThan(0);expect(left[1]).toBeCloseTo(0,10);
 for(let i=0;i<3;i++){expect(forward[i]).toBeCloseTo(-back[i],9);expect(left[i]).toBeCloseTo(-right[i],9);expect(forward[i]).toBeCloseTo(travel(['w'],30)[i],9);}
 expect(Math.hypot(...diagonal)).toBeCloseTo(FREE_CAMERA_SPEED,8);expect(Math.hypot(...forward)).toBeCloseTo(FREE_CAMERA_SPEED,8);
 const {camera:c,photo,send}=fixture();photo.enter();send('keydown',{key:'w'});send('pointerdown',{button:0,clientX:0,clientY:0,pointerId:1});photo.clearInput();const position=[...c.position];photo.advance(1);expect([...c.position]).toEqual(position);expect(c.dragging).toBe(false);
});
