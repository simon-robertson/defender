import {test,expect} from 'bun:test';
import {DroneInput} from '../play/drone-input.js';
function fixture(){
 const handlers=new Map(),captures=new Set(),canvas={addEventListener(type,fn,capture){handlers.set(type,{fn,capture});},removeEventListener(type,fn,capture){const listener=handlers.get(type);if(listener?.fn===fn&&listener.capture===capture)handlers.delete(type);},focus(){},setPointerCapture(id){captures.add(id);},hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
 let allowed=true;const calls=[],drone={active:true,rotate:(...v)=>calls.push(['rotate',...v]),targetAt:()=>{throw Error('Clicks must not retarget the drone.');}},input=new DroneInput(canvas,drone,()=>allowed);
 const send=(type,x=600,y=400,button=0,pointerId=1)=>handlers.get(type)?.fn({clientX:x,clientY:y,button,pointerId,preventDefault(){},stopImmediatePropagation(){}});
 return {drone,input,send,calls,handlers,captures,setAllowed:v=>allowed=v};
}
test('clicking either mouse button leaves the centre target unchanged',()=>{
 const f=fixture();for(const button of [0,2]){f.send('pointerdown',600,400,button);expect(f.captures.has(1)).toBe(true);f.send('pointerup',600,400,button);expect(f.captures.size).toBe(0);}expect(f.calls).toEqual([]);f.input.dispose();
});
test('left and right drag aim with incremental pointer deltas',()=>{
 for(const button of [0,2]){const f=fixture();f.send('pointerdown',600,400,button);f.send('pointermove',620,410,button);f.send('pointermove',625,407,button);f.send('pointerup',625,407,button);expect(f.calls).toEqual([['rotate',20,10],['rotate',5,-3]]);expect(f.captures.size).toBe(0);f.input.dispose();}
});
test('click tolerance avoids accidental aim but preserves the full first drag',()=>{
 const f=fixture();f.send('pointerdown');f.send('pointermove',602,400);f.send('pointermove',603,400);expect(f.calls).toEqual([]);f.send('pointermove',605,400);expect(f.calls).toEqual([['rotate',5,0]]);f.send('pointerup',605,400);f.input.dispose();
});
test('inactive or locked input rejects new gestures and cancels an existing drag',()=>{
 for(const disable of [f=>f.setAllowed(false),f=>f.drone.active=false]){
  const f=fixture();disable(f);f.send('pointerdown');f.send('pointermove',620,410);f.send('pointerup',620,410);expect(f.calls).toEqual([]);expect(f.captures.size).toBe(0);f.input.dispose();
  const g=fixture();g.send('pointerdown');disable(g);g.send('pointermove',620,410);expect(g.captures.size).toBe(0);g.setAllowed(true);g.drone.active=true;g.send('pointermove',630,420);g.send('pointerup',630,420);expect(g.calls).toEqual([]);g.input.dispose();
 }
});
test('only the captured supported pointer can aim or end the drag',()=>{
 const f=fixture();f.send('pointerdown',600,400,1);expect(f.captures.size).toBe(0);f.send('pointerdown');f.send('pointerdown',800,400,0,2);f.send('pointermove',820,400,0,2);f.send('pointerup',820,400,0,2);expect(f.captures.has(1)).toBe(true);expect(f.calls).toEqual([]);f.send('pointermove',610,400);expect(f.calls).toEqual([['rotate',10,0]]);f.input.dispose();
});
test('cancel, capture loss, explicit cleanup and disposal end stale input',()=>{
 for(const cancel of [f=>f.send('pointercancel'),f=>f.send('lostpointercapture'),f=>f.input.clear()]){
  const f=fixture();f.send('pointerdown');cancel(f);f.send('pointermove',620,410);f.send('pointerup',620,410);expect(f.calls).toEqual([]);expect(f.captures.size).toBe(0);f.input.dispose();expect(f.handlers.size).toBe(0);
 }
 const f=fixture();f.send('pointerdown');f.input.dispose();expect(f.captures.size).toBe(0);expect(f.handlers.size).toBe(0);
});
