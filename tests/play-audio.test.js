import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {AudioPlayer} from '../play/audio.js';
function fixture(){const events=[];class Context{constructor(options){events.push(['create',options]);this.state='suspended';}resume(){events.push(['resume']);this.state='running';return Promise.resolve();}close(){events.push(['close']);this.state='closed';return Promise.resolve();}}return {events,Context,audio:new AudioPlayer({AudioContext:Context})};}
test('player creates no context on title load and reuses one across game starts',()=>{
 const {events,audio}=fixture();expect(audio.state).toBe('uninitialised');expect(events).toEqual([]);audio.startFromGesture();const context=audio.context;expect(events.map(e=>e[0])).toEqual(['create','resume']);expect(events[0][1]).toEqual({latencyHint:'interactive'});audio.startFromGesture();expect(audio.context).toBe(context);expect(events.length).toBe(2);context.state='suspended';audio.startFromGesture();expect(events.at(-1)[0]).toBe('resume');audio.dispose();audio.dispose();audio.startFromGesture();expect(events.filter(e=>e[0]==='close')).toHaveLength(1);expect(audio.context).toBeNull();
});
test('missing API, device failures and rejected resumes do not reject game startup',async()=>{
 const missing=new AudioPlayer({});expect(()=>missing.startFromGesture()).not.toThrow();expect(missing.context).toBeNull();
 const broken=new AudioPlayer({AudioContext:class{constructor(){throw new Error('Device unavailable');}}});expect(()=>broken.startFromGesture()).not.toThrow();expect(broken.lastError).toBe('Device unavailable');
 const {audio}=fixture();audio.startFromGesture();audio.context.state='suspended';audio.context.resume=()=>Promise.reject(new Error('Not allowed'));audio.startFromGesture();await Promise.resolve();expect(audio.lastError).toBe('Not allowed');audio.dispose();
});
test('another real gesture can retry while a previous resume remains pending',()=>{
 const {audio}=fixture();audio.startFromGesture();audio.context.state='interrupted';let calls=0;audio.context.resume=()=>{calls++;return new Promise(()=>{});};audio.startFromGesture();audio.startFromGesture();expect(calls).toBe(2);audio.dispose();
});
const app=await readFile(new URL('../play/app.js',import.meta.url),'utf8');
const click=app.slice(app.indexOf("document.addEventListener('click',async event=>{"),app.indexOf('\n\nfunction project('));
function handlerFixture(action,{saved=true,busy=false}={}){
 const records=[],audio=new AudioPlayer({AudioContext:class{constructor(){records.push('context');this.state='suspended';}resume(){records.push('resume');return Promise.resolve();}}});let handler;
 const scope={document:{addEventListener:(_,fn)=>handler=fn},disposed:false,busy,error:'',session:{phase:'title'},savedGame:saved?{fork:()=>({})}:null,savingProgress:false,audio,optionsOpen:false,leaveOpen:false,cameraViews:{reset(){}},conditions:{reset(){}},selectedId:null,notice:'',config:{},PlaySession:class{reset(){}},createTitleSession:()=>({}),rebuild:()=>{records.push('load');return Promise.resolve();},fail:error=>{throw error;},paint(){},runLoop(){}};
 runInNewContext(click,scope);
 return {records,audio,call:()=>handler({target:{closest:()=>({disabled:false,dataset:{action}})}})};
}
test('actual New Game and Continue handlers call resume synchronously before loading',async()=>{
 for(const action of ['play','continue','retry']){const f=handlerFixture(action);const pending=f.call();expect(f.records).toEqual(['context','resume','load']);await pending;}
});
test('invalid Continue, busy controls and return to title do not open an audio device',async()=>{
 for(const [action,options]of [['continue',{saved:false}],['play',{busy:true}],['title',{}]]){const f=handlerFixture(action,options);await f.call();expect(f.records).not.toContain('context');}
});
