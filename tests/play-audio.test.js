import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {AudioPlayer} from '../play/audio.js';
// Playback tests explicitly opt in; new players remain silent.
const playbackPreferences={getItem:()=>'0.8'};
function fixture(){const events=[];class Context{constructor(options){events.push(['create',options]);this.state='suspended';}resume(){events.push(['resume']);this.state='running';return Promise.resolve();}close(){events.push(['close']);this.state='closed';return Promise.resolve();}}return {events,Context,audio:new AudioPlayer({localStorage:playbackPreferences,AudioContext:Context})};}
test('player creates no context on title load and reuses one across game starts',()=>{
 const {events,audio}=fixture();expect(audio.state).toBe('uninitialised');expect(events).toEqual([]);audio.startFromGesture();const context=audio.context;expect(events.map(e=>e[0])).toEqual(['create','resume']);expect(events[0][1]).toEqual({latencyHint:'interactive'});audio.startFromGesture();expect(audio.context).toBe(context);expect(events.length).toBe(2);context.state='suspended';audio.startFromGesture();expect(events.at(-1)[0]).toBe('resume');audio.dispose();audio.dispose();audio.startFromGesture();expect(events.filter(e=>e[0]==='close')).toHaveLength(1);expect(audio.context).toBeNull();
});
test('missing API, device failures and rejected resumes do not reject game startup',async()=>{
 const missing=new AudioPlayer({});expect(()=>missing.startFromGesture()).not.toThrow();expect(missing.context).toBeNull();
 const broken=new AudioPlayer({localStorage:playbackPreferences,AudioContext:class{constructor(){throw new Error('Device unavailable');}}});expect(()=>broken.startFromGesture()).not.toThrow();expect(broken.lastError).toBe('Device unavailable');
 const {audio}=fixture();audio.startFromGesture();audio.context.state='suspended';audio.context.resume=()=>Promise.reject(new Error('Not allowed'));audio.startFromGesture();await Promise.resolve();expect(audio.lastError).toBe('Not allowed');audio.dispose();
});
test('another real gesture can retry while a previous resume remains pending',()=>{
 const {audio}=fixture();audio.startFromGesture();audio.context.state='interrupted';let calls=0;audio.context.resume=()=>{calls++;return new Promise(()=>{});};audio.startFromGesture();audio.startFromGesture();expect(calls).toBe(2);audio.dispose();
});
const app=await readFile(new URL('../play/app.js',import.meta.url),'utf8');
const click=app.slice(app.indexOf("document.addEventListener('click',async event=>{"),app.indexOf('\n\nfunction project('));
function handlerFixture(action,{saved=true,busy=false}={}){
 const records=[],audio=new AudioPlayer({localStorage:playbackPreferences,AudioContext:class{constructor(){records.push('context');this.state='suspended';}resume(){records.push('resume');return Promise.resolve();}}});let handler;
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

function mixerFixture({rejectOgg=false,channels=1}={}){
 const fetched=[],sources=[],graphs=[],events=[];
 class Param{constructor(){this.value=0;}cancelScheduledValues(){}setValueAtTime(value){this.value=value;}setTargetAtTime(value){this.value=value;}}
 class Node{constructor(){this.gain=new Param();this.pan=new Param();graphs.push(this);}connect(to){this.to=to;}disconnect(){this.disconnected=true;}}
 class Context{
  constructor(){this.state='suspended';this.currentTime=0;this.destination={};}
  resume(){events.push('resume');this.state='running';return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
  createGain(){return new Node();}createStereoPanner(){return new Node();}
  createBufferSource(){const source=new Node();source.start=at=>{source.at=at;};source.stop=()=>{source.stopped=true;};sources.push(source);return source;}
  async decodeAudioData(bytes){if(rejectOgg&&bytes[0]===1)throw new Error('Codec unsupported');return {numberOfChannels:channels,take:bytes[1],duration:.38};}
 }
 const audio=new AudioPlayer({localStorage:playbackPreferences,AudioContext:Context,fetch:async url=>{events.push('fetch');fetched.push(String(url));return {ok:true,arrayBuffer:async()=>Uint8Array.of(String(url).endsWith('.ogg')?1:2,Number(String(url).match(/dry-(\d)/)[1]))};}});
 const camera={eye:[0,0,0],vp:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]};
 return {audio,fetched,sources,graphs,events,camera,end:source=>source.onended({target:source})};
}
async function readyMixer(options){const f=mixerFixture(options);f.audio.startFromGesture();await f.audio.loading;f.audio.setActive(true);return f;}
test('bank decodes once, falls back to mono WAV and resumes before fetching',async()=>{
 const f=await readyMixer({rejectOgg:true});expect(f.events[0]).toBe('resume');expect(f.fetched).toHaveLength(6);expect(f.audio.ready).toBe(true);expect(f.graphs).toHaveLength(65);
 f.audio.startFromGesture();expect(f.fetched).toHaveLength(6);f.audio.dispose();expect(f.audio.ready).toBe(false);
 const stereo=mixerFixture({channels:2});stereo.audio.startFromGesture();await expect(stereo.audio.loading).rejects.toThrow('mono');await Promise.resolve();expect(stereo.audio.ready).toBe(false);stereo.audio.dispose();
});
test('one pulse uses transformed midpoint, rotates takes and tracks camera pan and distance',async()=>{
 const f=await readyMixer(),matrix=[1,0,0,0,0,1,0,0,0,0,1,0,10,20,30,1];
 f.audio.gunShot(matrix,[[0,2,4],[2,2,4]],.98);f.audio.advance(1,f.camera);
 expect(f.sources).toHaveLength(1);const v=f.audio.voices[0];expect([v.x,v.y,v.z]).toEqual([11,22,34]);expect(v.pan.pan.value).toBe(1);expect(v.level).toBeCloseTo(320/(320+Math.hypot(11,22,34)),8);expect(f.sources[0].at).toBeCloseTo(.072,8);
 const first=v.level;f.camera.eye=[1000,1000,1000];f.camera.vp[0]=-1;f.audio.context.currentTime=.1;f.audio.advance(1.1,f.camera);expect(v.pan.pan.value).toBe(-1);expect(v.level).toBeLessThan(first);
 f.end(f.sources[0]);for(let i=0;i<3;i++){f.audio.enqueue(0,0,0,1);f.audio.advance(1,f.camera);f.end(f.sources.at(-1));}expect(f.sources.map(s=>s.buffer.take)).toEqual([1,2,3,1]);f.audio.dispose();
});
test('dense traffic is bounded by voices, rolling source admissions and fixed queue capacity',async()=>{
 const f=await readyMixer();for(let i=0;i<200;i++)f.audio.enqueue(0,0,0,0);expect(f.audio.queued).toBe(128);f.audio.advance(0,f.camera);expect(f.sources).toHaveLength(32);expect(f.audio.active).toBe(32);
 for(const source of f.sources)f.end(source);for(let i=0;i<32;i++)f.audio.enqueue(0,0,0,0);f.audio.advance(0,f.camera);expect(f.sources).toHaveLength(64);for(const source of f.sources.slice(32))f.end(source);
 f.audio.enqueue(0,0,0,0);f.audio.advance(0,f.camera);expect(f.sources).toHaveLength(64);f.audio.context.currentTime=1;f.audio.enqueue(0,0,0,1);f.audio.advance(1,f.camera);expect(f.sources).toHaveLength(65);expect(f.graphs.length-f.sources.length).toBe(65);f.audio.dispose();
});
test('late shots never replay, pause clears pending voices and old ended events cannot release reused slots',async()=>{
 const f=await readyMixer();f.audio.enqueue(0,0,0,0);f.audio.advance(.5,f.camera);expect(f.sources).toHaveLength(0);expect(f.audio.dropped).toBe(1);
 f.audio.enqueue(0,0,0,1);f.audio.advance(1,f.camera);const old=f.sources[0];f.audio.enqueue(0,0,0,1);f.audio.setActive(false);expect(f.audio.active).toBe(0);expect(f.audio.queued).toBe(0);expect(old.stopped).toBe(true);
 f.audio.enqueue(0,0,0,1);f.audio.advance(1,f.camera);expect(f.sources).toHaveLength(1);f.audio.setActive(true);f.audio.enqueue(0,0,0,1);f.audio.advance(1,f.camera);f.end(old);expect(f.audio.active).toBe(1);expect(f.audio.voices[0].source).toBe(f.sources[1]);f.audio.dispose();
});
test('dispose during decoding cannot create a late graph or retain a sound bank',async()=>{
 const f=mixerFixture();let finish;f.audio.startFromGesture();f.audio.context.decodeAudioData=()=>new Promise(resolve=>finish=resolve);await Promise.resolve();await Promise.resolve();const pending=f.audio.loading;f.audio.dispose();finish({numberOfChannels:1});await pending;expect(f.graphs).toHaveLength(0);expect(f.audio.ready).toBe(false);
});

test('sound level defaults to 0%, is stored safely, and updates the master including mute',async()=>{
 const {SOUND_LEVEL_KEY,loadSoundLevel,soundLevel}=await import('../play/audio-options.js');
 expect(loadSoundLevel({})).toBe(0);for(const raw of ['broken','null','"loud"'])expect(loadSoundLevel({localStorage:{getItem:()=>raw}})).toBe(0);
 expect(loadSoundLevel({localStorage:{getItem:()=>'0.35'}})).toBe(.35);expect(soundLevel(-2)).toBe(0);expect(soundLevel(2)).toBe(1);
 const f=await readyMixer(),saved=[];expect(f.audio.volume).toBe(.8);expect(f.audio.master.gain.value).toBe(.8);f.audio.scope.localStorage={setItem:(...args)=>saved.push(args)};
 f.audio.setVolume(.25);expect(f.audio.master.gain.value).toBe(.25);expect(saved.at(-1)).toEqual([SOUND_LEVEL_KEY,'0.25']);f.audio.setVolume(0);expect(f.audio.master).toBeNull();expect(f.audio.context).toBeNull();expect(f.audio.state).toBe('closed');
 f.audio.scope.localStorage={setItem(){throw Error('Blocked');}};expect(()=>f.audio.setVolume(.6)).not.toThrow();expect(f.audio.context).toBeNull();f.audio.startFromGesture();await f.audio.loading;expect(f.audio.master.gain.value).toBe(.6);f.audio.dispose();
});

test('zero volume shuts down the device and buffers; Done can restart only above zero',async()=>{
 const f=await readyMixer();f.audio.enqueue(0,0,0,0);f.audio.advance(0,f.camera);const context=f.audio.context;f.audio.setVolume(0);expect(context.state).toBe('closed');expect(f.audio.active).toBe(0);expect(f.audio.buffers).toEqual([]);expect(f.audio.voices).toEqual([]);expect(f.audio.loading).toBeNull();
 f.audio.startFromGesture();expect(f.audio.context).toBeNull();f.audio.setVolume(.8);expect(f.audio.context).toBeNull();f.audio.startFromGesture();await f.audio.loading;expect(f.audio.context).not.toBe(context);expect(f.audio.state).toBe('running');expect(f.audio.ready).toBe(true);f.audio.dispose();
 const done=handlerFixture('close-options');await done.call();expect(done.records).toEqual(['context','resume']);done.audio.dispose();
});

test('the default zero volume starts no device, fetch, decode or sound even after play gestures',()=>{
 let contexts=0,fetches=0;const audio=new AudioPlayer({AudioContext:class{constructor(){contexts++;}},fetch(){fetches++;}});
 expect(audio.volume).toBe(0);expect(audio.state).toBe('closed');audio.startFromGesture();audio.setActive(true);audio.gunShot([],[],0);audio.enqueue(0,0,0,0);audio.advance(0,{});
 expect(contexts).toBe(0);expect(fetches).toBe(0);expect(audio.ready).toBe(false);expect(audio.loading).toBeNull();expect(audio.context).toBeNull();expect(audio.queued).toBe(0);audio.dispose();
});
