import {test,expect} from 'bun:test';
import {Camera} from '../engine/camera.js';
import {DroneInput,pickDroneTarget} from '../play/drone-input.js';
function fixture(){
 const handlers=new Map(),captures=new Set(),canvas={clientWidth:1200,clientHeight:800,getBoundingClientRect:()=>({left:0,top:0,width:1200,height:800}),addEventListener(type,fn){handlers.set(type,fn);},removeEventListener(type){handlers.delete(type);},focus(){},setPointerCapture(id){captures.add(id);},hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
 const camera=new Camera(canvas,()=>{});camera.setLevel({size:[20,16],pathHeight:24,path:[[0,0,8],[19,0,8]],terrain:{defaultHeight:24,boxes:[]}});camera.mode='live';camera.position.set([240,224,292]);camera.yaw=0;camera.pitch=Math.atan2(200,100);camera.update(1.5);
 let allowed=true;const calls=[],drone={active:true,camera,world:{level:{pathHeight:24},width:480,length:384},rotate:(...v)=>calls.push(['rotate',...v]),targetAt:(...v)=>calls.push(['target',...v])},input=new DroneInput(canvas,drone,()=>allowed);
 const send=(type,x=600,y=400,button=0)=>handlers.get(type)?.({clientX:x,clientY:y,button,pointerId:1,preventDefault(){},stopImmediatePropagation(){}});
 return {camera,drone,input,send,calls,handlers,setAllowed:v=>allowed=v};
}
test('perspective clicks intersect the board plane and reject sky/outside',()=>{
 const f=fixture(),out=new Float64Array(3);
 expect(pickDroneTarget(f.camera,{clientX:600,clientY:400},f.drone.world,out)).toBe(true);expect(out[0]).toBeCloseTo(240,1);expect(out[1]).toBe(24);expect(out[2]).toBeCloseTo(192,1);
 f.camera.pitch=-.5;f.camera.update(1.5);expect(pickDroneTarget(f.camera,{clientX:600,clientY:400},f.drone.world,out)).toBe(false);f.input.dispose();
});
test('click selects once, drag rotates without selecting, right drag also rotates',()=>{
 const f=fixture();f.send('pointerdown');f.send('pointerup');expect(f.calls[0][0]).toBe('target');
 f.calls.length=0;f.send('pointerdown');f.send('pointermove',620,410);f.send('pointerup',620,410);expect(f.calls).toEqual([['rotate',20,10]]);
 f.calls.length=0;f.send('pointerdown',600,400,2);f.send('pointermove',620,400,2);f.send('pointerup',620,400,2);expect(f.calls).toEqual([['rotate',20,0]]);f.input.dispose();
});
test('pause, inactive camera, cancellation and disposal prevent stale targeting',()=>{
 const f=fixture();f.send('pointerdown');f.setAllowed(false);f.send('pointerup');expect(f.calls).toEqual([]);
 f.setAllowed(true);f.drone.active=false;f.send('pointerdown');f.send('pointerup');expect(f.calls).toEqual([]);
 f.drone.active=true;f.send('pointerdown');f.send('pointercancel');f.send('pointerup');expect(f.calls).toEqual([]);
 f.input.dispose();expect(f.handlers.size).toBe(5);
});
