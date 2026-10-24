import {test,expect} from 'bun:test';
import {DroneInput} from '../play/drone-input.js';
function fixture(){
 const handlers=new Map(),captures=new Set(),canvas={addEventListener(type,fn,capture){handlers.set(type,{fn,capture});},removeEventListener(type,fn,capture){const listener=handlers.get(type);if(listener?.fn===fn&&listener.capture===capture)handlers.delete(type);},focus(){},setPointerCapture(id){captures.add(id);},hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
 let allowed=true,updates=0;const calls=[],drone={active:true,hasTargeted:false,rotate:(...v)=>{calls.push(['rotate',...v]);drone.hasTargeted=true;return true;},setKeyboard:(...v)=>{calls.push(['keyboard',...v]);if(v[2])drone.hasTargeted=true;},targetAt:()=>{throw Error('Clicks must not retarget the drone.');}},input=new DroneInput(canvas,drone,()=>allowed,()=>updates++);
 const send=(type,x=600,y=400,button=0,pointerId=1)=>handlers.get(type)?.fn({clientX:x,clientY:y,button,pointerId,preventDefault(){},stopImmediatePropagation(){}});
 return {drone,input,send,calls,handlers,captures,get updates(){return updates;},setAllowed:v=>allowed=v};
}
test('clicking either mouse button leaves the centre target unchanged',()=>{
 const f=fixture();for(const button of [0,2]){f.send('pointerdown',600,400,button);expect(f.captures.has(1)).toBe(true);f.send('pointerup',600,400,button);expect(f.captures.size).toBe(0);}expect(f.calls).toEqual([]);expect(f.updates).toBe(0);f.input.dispose();
});
test('left and right drag aim with incremental pointer deltas',()=>{
 for(const button of [0,2]){const f=fixture();f.send('pointerdown',600,400,button);f.send('pointermove',620,410,button);f.send('pointermove',625,407,button);f.send('pointerup',625,407,button);expect(f.calls).toEqual([['rotate',20,10],['rotate',5,-3]]);expect(f.updates).toBe(1);expect(f.captures.size).toBe(0);f.input.dispose();}
});
test('click tolerance avoids accidental aim but preserves the full first drag',()=>{
 const f=fixture();f.send('pointerdown');f.send('pointermove',602,400);f.send('pointermove',603,400);expect(f.calls).toEqual([]);expect(f.updates).toBe(0);f.send('pointermove',605,400);expect(f.calls).toEqual([['rotate',5,0]]);expect(f.updates).toBe(1);f.send('pointerup',605,400);f.send('pointerdown');f.send('pointermove',610,410);f.send('pointerup',610,410);expect(f.updates).toBe(1);f.input.dispose();
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

function key(f,type,key,extra={}){let prevented=false;f.handlers.get(type)?.fn({key,preventDefault(){prevented=true;},stopImmediatePropagation(){},...extra});return prevented;}
test('keyboard combines axes, cancels opposing keys and releases even after input locks',()=>{
 const f=fixture();expect(key(f,'keydown','W')).toBe(true);key(f,'keydown','a');expect(f.calls.at(-1)).toEqual(['keyboard',1,-1,true]);expect(f.updates).toBe(1);
 key(f,'keydown','s');key(f,'keydown','d');expect(f.calls.at(-1)).toEqual(['keyboard',0,0,true]);key(f,'keyup','w');expect(f.calls.at(-1)).toEqual(['keyboard',-1,0,true]);
 f.setAllowed(false);for(const k of ['a','s','d'])key(f,'keyup',k,{target:{tagName:'INPUT'},metaKey:true});expect(f.calls.at(-1)).toEqual(['keyboard',0,0,false]);f.input.dispose();
});
test('keyboard rejects inactive, paused, modified and editable events and clears held keys',()=>{
 for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{target:{tagName:'INPUT'}},{target:{tagName:'TEXTAREA'}},{target:{tagName:'SELECT'}},{target:{isContentEditable:true}}]){
  const f=fixture();expect(key(f,'keydown','w',extra)).toBe(false);expect(f.calls).toEqual([]);key(f,'keydown','w');key(f,'keydown','a',extra);expect(f.calls.at(-1)).toEqual(['keyboard',0,0,false]);f.input.dispose();
 }
 for(const disable of [f=>f.setAllowed(false),f=>f.drone.active=false]){const f=fixture();disable(f);expect(key(f,'keydown','w')).toBe(false);expect(f.calls).toEqual([]);f.input.dispose();}
});
test('pointer release preserves held keys; blur, lifecycle cleanup and disposal release them',()=>{
 const f=fixture();key(f,'keydown','w');f.send('pointerdown');f.send('pointermove',610,410);f.send('pointerup');expect(f.input.keys.has('w')).toBe(true);f.input.dispose();expect(f.calls.at(-1)).toEqual(['keyboard',0,0,false]);expect(f.handlers.size).toBe(0);
 for(const end of [f=>f.handlers.get('blur').fn(),f=>f.input.clear()]){const g=fixture();key(g,'keydown','d');end(g);expect(g.calls.at(-1)).toEqual(['keyboard',0,0,false]);expect(g.input.keys.size).toBe(0);g.input.dispose();}
});

// Model DOM blur propagation: element blur is captured by ancestors but does
// not bubble; an actual window blur is delivered at the window itself.
function focusFixture(){
 const makeTarget=()=>({listeners:[],addEventListener(type,fn,capture){this.listeners.push({type,fn,capture});},removeEventListener(type,fn,capture){this.listeners=this.listeners.filter(l=>l.type!==type||l.fn!==fn||l.capture!==capture);}});
 const view=makeTarget(),document=makeTarget(),canvas=makeTarget(),hud=makeTarget(),captures=new Set(),calls=[];let focused=hud;
 document.defaultView=view;canvas.ownerDocument=document;
 const emit=(target,type,fields={})=>{const event={target,preventDefault(){},stopImmediatePropagation(){},...fields};if(type==='blur'&&target!==view)for(const ancestor of [view,document])for(const l of [...ancestor.listeners])if(l.type===type&&l.capture)l.fn(event);for(const l of [...target.listeners])if(l.type===type)l.fn(event);};
 Object.assign(canvas,{focus(){if(focused!==canvas){emit(focused,'blur');focused=canvas;}},setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)});
 const drone={active:true,hasTargeted:false,rotate:(...delta)=>{calls.push(delta);drone.hasTargeted=true;},setKeyboard:(forward,turn,active)=>{drone.keyboardActive=active;}},input=new DroneInput(canvas,drone,()=>true);
 const send=(type,fields={})=>emit(canvas,type,{pointerId:1,button:0,clientX:600,clientY:400,...fields});
 return {input,calls,captures,view,document,canvas,drone,send,emit};
}
test('the first drag survives focus moving from a HUD button to the canvas with either mouse button',()=>{
 for(const button of [0,2]){
  const f=focusFixture();f.send('pointerdown',{button});expect(f.captures.has(1)).toBe(true);f.send('pointermove',{clientX:620,clientY:410,button});f.send('pointermove',{clientX:625,clientY:407,button});expect(f.calls).toEqual([[20,10],[5,-3]]);f.send('pointerup',{button});expect(f.captures.size).toBe(0);f.input.dispose();
  expect(f.view.listeners.length+f.document.listeners.length+f.canvas.listeners.length).toBe(0);
 }
});
test('actual window focus loss still releases the drag and held keyboard controls',()=>{
 const f=focusFixture();f.canvas.focus();f.emit(f.document,'keydown',{key:'w'});f.send('pointerdown');expect(f.captures.has(1)).toBe(true);expect(f.drone.keyboardActive).toBe(true);f.emit(f.view,'blur');expect(f.captures.size).toBe(0);expect(f.drone.keyboardActive).toBe(false);f.send('pointermove',{clientX:620,clientY:410});expect(f.calls).toEqual([]);f.input.dispose();
 expect(f.view.listeners.length+f.document.listeners.length+f.canvas.listeners.length).toBe(0);
});
