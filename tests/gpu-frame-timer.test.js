import {test,expect} from 'bun:test';
import {GPUFrameTimer,requestRenderDevice} from '../engine/gpu-frame-timer.js';

function fixture(supported=true){
 const descriptors=new Map();for(const [name,value] of Object.entries({GPUBufferUsage:{QUERY_RESOLVE:1,COPY_SRC:2,COPY_DST:4,MAP_READ:8},GPUMapMode:{READ:1}})){descriptors.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,value});}
 let time=0;const buffers=[],operations=[],query={destroyCalls:0,destroy(){this.destroyCalls++;}},device={features:new Set(supported?['timestamp-query']:[]),createQuerySet:()=>query,
  createBuffer({size,usage}){const buffer={size,usage,data:new ArrayBuffer(size),destroyCalls:0,unmaps:0,mapAsync(){return new Promise((resolve,reject)=>{this.complete=resolve;this.reject=reject;});},getMappedRange(){return this.data;},unmap(){this.unmaps++;},destroy(){this.destroyCalls++;}};buffers.push(buffer);return buffer;}};
 const encoder={beginRenderPass(descriptor){const writes=descriptor.timestampWrites;if(writes){for(const key of Object.keys(writes))if(!['querySet','beginningOfPassWriteIndex','endOfPassWriteIndex'].includes(key))throw new Error(`Invalid timestamp descriptor field: ${key}`);if(writes.beginningOfPassWriteIndex===undefined&&writes.endOfPassWriteIndex===undefined)throw new Error('Missing timestamp write index');}operations.push({...descriptor,timestampWrites:writes?{...writes}:undefined});return {end(){}};},resolveQuerySet(...args){operations.push({resolve:args});},copyBufferToBuffer(...args){operations.push({copy:args});}};
 const timer=new GPUFrameTimer(device,()=>time),lastPass={label:'Actual display'},frame=()=>{const slot=timer.begin(encoder,lastPass);timer.renderEncoder(encoder,slot).beginRenderPass(lastPass).end();timer.end(encoder,slot);timer.submitted(slot);return slot;};
 return {timer,query,buffers,operations,frame,encoder,lastPass,setTime(value){time=value;},async complete(slot,milliseconds){new BigUint64Array(slot.buffer.data).set([10000000000000000n,10000000000000000n+BigInt(Math.round(milliseconds*1e6))]);slot.buffer.complete();for(let i=0;i<6;i++)await Promise.resolve();},cleanup(){timer.dispose();for(const [name,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}};
}

test('timestamp feature is optional, requested only on opt in, with ordinary-device fallback',async()=>{
 const calls=[],device={};const adapter={features:new Set(['timestamp-query']),requestDevice:async options=>{calls.push(options);return device;}};
 expect(await requestRenderDevice(adapter)).toBe(device);expect(calls).toEqual([undefined]);calls.length=0;
 expect(await requestRenderDevice(adapter,true)).toBe(device);expect(calls).toEqual([{requiredFeatures:['timestamp-query']}]);calls.length=0;
 adapter.requestDevice=async options=>{calls.push(options);if(options)throw new Error('Unavailable timing');return device;};
 expect(await requestRenderDevice(adapter,true)).toBe(device);expect(calls).toEqual([{requiredFeatures:['timestamp-query']},undefined]);calls.length=0;
 adapter.features.clear();await requestRenderDevice(adapter,true);expect(calls).toEqual([undefined]);
});

test('nanosecond subtraction remains exact before conversion and full-span markers precede resolve/copy',async()=>{
 const f=fixture();try{
  const slot=f.frame();expect(f.operations[0].timestampWrites).toEqual({querySet:f.query,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1});expect(f.operations[1].resolve.slice(1)).toEqual([0,2,f.timer.resolve,0]);expect(f.operations[2].copy).toEqual([f.timer.resolve,0,slot.buffer,0,16]);
  expect(f.timer.read()).toMatchObject({status:'pending',ms:null,pending:1,bufferBytes:64,queryCount:2});
  await f.complete(slot,2.125);expect(f.timer.read()).toMatchObject({status:'ready',ms:2.125,samples:1,pending:0});expect(slot.buffer.unmaps).toBe(1);
  f.setTime(99);expect(f.frame()).toBeNull();f.setTime(100);const next=f.frame();await f.complete(next,4.125);expect(f.timer.read().ms).toBe(3.125);
  f.setTime(1601);expect(f.timer.read()).toMatchObject({status:'stale',ms:null,samples:0});
 }finally{f.cleanup();}expect(f.buffers.reduce((sum,b)=>sum+b.size,0)).toBe(64);expect(f.buffers.every(b=>b.destroyCalls===1)).toBe(true);expect(f.query.destroyCalls).toBe(1);
});

test('three outstanding readbacks bound the pool and exhaustion skips without allocating or waiting',async()=>{
 const f=fixture();try{
  const slots=[];for(let i=0;i<3;i++){f.setTime(i*100);slots.push(f.frame());}f.setTime(400);expect(f.frame()).toBeNull();expect(f.timer.read().pending).toBe(3);expect(f.buffers.length).toBe(4);
  await f.complete(slots[1],2);f.setTime(500);expect(f.frame()).toBe(slots[1]);expect(f.buffers.length).toBe(4);
 }finally{f.cleanup();}
});

test('pause, resume, scene/resize resets and out-of-order completions cannot republish old samples',async()=>{
 const f=fixture();try{
  const old=f.frame();f.timer.setActive(false);await f.complete(old,9);expect(f.timer.read()).toMatchObject({status:'idle',ms:null});f.timer.setActive(true);
  f.setTime(100);const beforeReset=f.frame();f.timer.reset();await f.complete(beforeReset,8);expect(f.timer.read().ms).toBeNull();
  f.setTime(200);const first=f.frame();f.setTime(300);const second=f.frame();await f.complete(second,2);await f.complete(first,10);expect(f.timer.read()).toMatchObject({status:'ready',ms:2,samples:1});
  f.setTime(400);const delayed=f.frame();f.setTime(2000);await f.complete(delayed,5);expect(f.timer.read()).toMatchObject({status:'stale',ms:null});
 }finally{f.cleanup();}
});

test('unsupported, rejected mapping and disposal report accurate states without unhandled errors',async()=>{
 const unsupported=fixture(false);try{expect(unsupported.frame()).toBeNull();expect(unsupported.timer.read()).toMatchObject({status:'unsupported',bufferBytes:0,queryCount:0});expect(unsupported.buffers).toHaveLength(0);}finally{unsupported.cleanup();}
 const f=fixture();try{const slot=f.frame();slot.buffer.reject(new Error('Device lost'));for(let i=0;i<6;i++)await Promise.resolve();expect(f.timer.read()).toMatchObject({status:'unavailable',ms:null});expect(f.frame()).toBeNull();}finally{f.cleanup();}
 const pending=fixture();try{const slot=pending.frame();pending.timer.dispose();await pending.complete(slot,1);expect(pending.timer.read()).toMatchObject({status:'unavailable',ms:null,bufferBytes:0});}finally{pending.cleanup();}
});


test('timestamps attach only to actual first and last render passes without lingering on shared descriptors',()=>{
 const f=fixture();try{
  const slot=f.timer.begin(f.encoder,f.lastPass),encoder=f.timer.renderEncoder(f.encoder,slot),vista={label:'Actual vista'},bloom={label:'Actual bloom'};
  encoder.beginRenderPass(vista).end();encoder.beginRenderPass(bloom).end();encoder.beginRenderPass(f.lastPass).end();f.timer.end(f.encoder,slot);
  expect(f.operations[0].timestampWrites).toEqual({querySet:f.query,beginningOfPassWriteIndex:0});expect(f.operations[1].timestampWrites).toBeUndefined();expect(f.operations[2].timestampWrites).toEqual({querySet:f.query,endOfPassWriteIndex:1});expect(vista.timestampWrites).toBeUndefined();expect(f.lastPass.timestampWrites).toBeUndefined();
  expect(f.timer.currentEncoder).toBeNull();expect(f.timer.lastPass).toBeNull();
 }finally{f.cleanup();}
});
