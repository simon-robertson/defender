import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {PLAY_CONFIG} from '../play/config.js';
import {PlaySession} from '../play/session.js';
import {ProgressStore} from '../play/progress.js';
const app=await readFile(new URL('../play/app.js',import.meta.url),'utf8'),ui=await readFile(new URL('../play/ui.js',import.meta.url),'utf8');
const helper=app.slice(app.indexOf('async function clearProgressForNewGame(){'),app.indexOf('async function saveCheckpoint(){'));
const click=app.slice(app.indexOf("document.addEventListener('click',async event=>{"),app.indexOf('\n\nfunction project('));
function checkpoint(){const s=new PlaySession();s.reset();s.buy();s.levelIndex=1;s.completedWaves=4;s.tokens=9;return s;}
function fixture(progress,saved=checkpoint(),phase='title'){
 const events=[],loaded=[],scope={document:{addEventListener:(_,fn)=>scope.handler=fn},disposed:false,busy:false,error:'',session:{phase},savedGame:saved,savingProgress:false,saveError:'old status',progress,audio:{startFromGesture:()=>events.push('audio')},optionsOpen:false,leaveOpen:false,cameraViews:{reset:()=>events.push('camera-reset')},conditions:{reset:()=>events.push('conditions-reset')},selectedId:null,notice:'',config:PLAY_CONFIG,PlaySession,createTitleSession:()=>({phase:'title'}),rebuild:async candidate=>{events.push('load');loaded.push(candidate);},fail:error=>{throw error;},paint(){},runLoop(){}};
 runInNewContext(helper+click,scope);return {scope,events,loaded,call:(action='play')=>scope.handler({target:{closest:()=>({disabled:false,dataset:{action}})}})};
}
async function storage(run){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map([['defender.audio.v2','0'],['defender.graphics','keep']]);
 const implementation={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:implementation});
 try{await run(values,implementation);}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
}

test('New Game deletes the real checkpoint before loading a fresh A1 run and only clears progress',()=>storage(async values=>{
 const progress=new ProgressStore(PLAY_CONFIG),saved=checkpoint();await progress.save(saved);const f=fixture(progress,saved);
 const pending=f.call();expect(f.events).toEqual(['audio']);expect(f.scope.busy).toBe(true);await pending;
 expect(await progress.load()).toBeNull();expect(f.scope.savedGame).toBeNull();expect(f.scope.saveError).toBe('');expect(f.scope.busy).toBe(false);
 expect(f.events).toEqual(['audio','camera-reset','conditions-reset','load']);expect(f.loaded[0].snapshot()).toMatchObject({phase:'loadout',zone:'A',levelNumber:1,waveNumber:1,tokens:2,completedWaves:0,units:[]});
 expect(values.get('defender.audio.v2')).toBe('0');expect(values.get('defender.graphics')).toBe('keep');
}));
test('pending older writes finish before clearing; repeated New Game input cannot race the reset',()=>storage(async()=>{
 const progress=new ProgressStore(PLAY_CONFIG),saved=checkpoint();await progress.save(saved);const key=await progress.encryptionKey();let release;const gate=new Promise(resolve=>release=resolve);progress.encryptionKey=()=>gate.then(()=>key);
 const olderWrite=progress.save(saved),f=fixture(progress,saved),pending=f.call();await f.call();expect(f.events).toEqual(['audio']);expect(f.loaded).toHaveLength(0);expect(f.scope.savedGame).toBe(saved);
 release();await olderWrite;await pending;expect(await progress.load()).toBeNull();expect(f.scope.savedGame).toBeNull();expect(f.loaded).toHaveLength(1);
}));
test('clear failure retains progress and permits retry without starting a new game',()=>storage(async(values,implementation)=>{
 const progress=new ProgressStore(PLAY_CONFIG),saved=checkpoint();await progress.save(saved);const remove=implementation.removeItem;implementation.removeItem=()=>{throw new Error('Storage denied');};
 for(const phase of ['title','defeat','complete']){
  const f=fixture(progress,saved,phase);await f.call(phase==='title'?'play':'retry');expect(f.loaded).toHaveLength(0);expect(f.scope.busy).toBe(false);expect(f.scope.savedGame).toBe(saved);expect(f.scope.saveError).toContain('could not be cleared');expect(f.events).toEqual(['audio']);
 }
 expect(await progress.load()).not.toBeNull();implementation.removeItem=remove;const f=fixture(progress,saved);await f.call();expect(f.loaded).toHaveLength(1);expect(await progress.load()).toBeNull();
}));
test('New Game from results clears progress, while Continue and return-to-title retain it',async()=>{
 for(const phase of ['defeat','complete']){let clears=0;const f=fixture({clear:async()=>clears++},checkpoint(),phase);await f.call('retry');expect(clears).toBe(1);expect(f.scope.savedGame).toBeNull();expect(f.loaded[0].levelIndex).toBe(0);}
 for(const action of ['continue','title','confirm-title']){let clears=0;const f=fixture({clear:async()=>clears++});await f.call(action);expect(clears).toBe(0);expect(f.scope.savedGame).not.toBeNull();}
 for(const flag of ['busy','disposed']){let clears=0;const f=fixture({clear:async()=>clears++});f.scope[flag]=true;await f.call();expect(clears).toBe(0);expect(f.events).toEqual([]);}
});
test('title copy explains reset and result screens expose deletion failures',()=>{
 expect(ui).toContain('New Game clears this checkpoint.');expect(ui).not.toContain('New Game keeps this save');
 const code=ui.slice(ui.indexOf("    show(refs['result-checkpoint']"),ui.indexOf("    show(refs['resume-checkpoint-button']"));
 for(const phase of ['defeat','complete']){
  const node={};runInNewContext(code,{refs:{'result-checkpoint':node},phase,snapshot:{saveError:'Saved progress could not be cleared.'},show:(n,visible)=>n.hidden=!visible,setText:(n,text)=>n.textContent=text,checkpointDescription:()=>''});expect(node.hidden).toBe(false);expect(node.textContent).toContain('could not be cleared');
 }
});

test('leaving during an asynchronous clear cannot restart a disposed player',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve),f=fixture({clear:()=>gate});
 const pending=f.call();f.scope.disposed=true;release();await pending;expect(f.loaded).toHaveLength(0);expect(f.events).toEqual(['audio']);expect(f.scope.savedGame).toBeNull();
});
