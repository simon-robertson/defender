import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunTurretBundle} from '../scripts/audio/gun-turret.js';
import {renderRecipe,readWav} from '../scripts/audio/pcm.js';
import {reviewPage,validateReview} from '../scripts/audio/review.js';
import {reviewPlayer} from '../scripts/audio/review-player.js';
import {PLAY_CONFIG} from '../play/config.js';
import {AUDIO_ASSETS} from '../shared/audio-assets.js';
const bundle=gunTurretBundle();
test('three gun directions each own three mono takes with controlled energy and preserved masters',async()=>{
 expect(bundle.review.groups).toHaveLength(3);expect(bundle.recipes).toHaveLength(9);expect(AUDIO_ASSETS).toEqual([]);
 const audit=JSON.parse(await readFile(new URL('../audio/gun-turret/audit.json',import.meta.url),'utf8'));
 for(const recipe of bundle.recipes){
  const rendered=renderRecipe(recipe);expect(recipe.channels).toBe(1);expect(rendered.analysis.peak).toBeLessThan(.8);expect(Math.abs(rendered.analysis.dc[0])).toBeLessThan(.002);
  let energy=0;for(let i=0;i<6720;i++)energy+=rendered.samples[i]**2;expect(Math.sqrt(energy/6720)).toBeCloseTo(.052,5);
  expect(rendered.samples[0]).toBe(0);expect(rendered.samples.at(-1)).toBe(0);
  const bytes=await readFile(new URL('../audio/gun-turret/masters/'+recipe.id+'.wav',import.meta.url)),master=readWav(bytes),entry=audit.entries.find(e=>e.id===recipe.id);
  expect(master.channels).toBe(1);expect(master.frames).toBe(rendered.frames);expect(entry.files.master.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));expect(entry.decodedAnalysis.peak).toBeLessThan(1);expect(entry.decodedAnalysis.frames).toBe(rendered.frames);
 }
 for(const group of bundle.review.groups){const takes=group.recipes.map(id=>renderRecipe(bundle.recipes.find(r=>r.id===id)).samples);expect(takes[0]).not.toEqual(takes[1]);expect(takes[0]).not.toEqual(takes[2]);}
});
test('audition patterns use actual base and upgraded pulse spacing, with one cue for paired barrels',()=>{
 const {patterns}=bundle.review,gun=PLAY_CONFIG.defences['turret-study'].variants;
 expect(patterns[0].times).toEqual([0]);expect(patterns[1].times).toEqual([0,gun.base.firing.cooldownSeconds,gun.base.firing.cooldownSeconds*2]);
 for(const [i,variant]of [[2,'upgrade1'],[3,'upgrade2']]){const profile=gun[variant].firing;expect(patterns[i].times).toHaveLength(profile.shotsPerBurst);for(let n=0;n<patterns[i].times.length;n++)expect(patterns[i].times[n]).toBeCloseTo(n*profile.shotIntervalSeconds,8);}
});
test('grouped gun preview exposes scheduled comparison controls and parses as valid JavaScript',()=>{
 const entries=bundle.recipes.map(recipe=>{const {analysis}=renderRecipe(recipe);return {recipe,analysis,decodedAnalysis:null,paths:{master:'masters/'+recipe.id+'.wav',ogg:'delivery/'+recipe.id+'.ogg'},waveform:[.1,.2]};});
 const html=reviewPage(entries,bundle.review);expect(html).toContain('Gun turret · sound review');expect(html.match(/data-times=/g)).toHaveLength(12);expect(html).toContain('value="0.55"');expect(html).toMatch(/context\.currentTime\s*\+\s*0?\.025/);expect(html).toContain('cursors.set');
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];expect(()=>new Bun.Transpiler({loader:'js'}).transformSync(script)).not.toThrow();
});
test('review metadata rejects absent takes and malformed or unbounded schedules',()=>{
 for(const mutate of [r=>r.groups[0].recipes.push('missing'),r=>r.patterns[0].times=[0,-1],r=>r.patterns[0].times=[0,0],r=>r.patterns[0].times=[0,Infinity],r=>r.patterns[0].times=[0,11]]){const review=structuredClone(bundle.review);mutate(review);expect(()=>validateReview(review,bundle.recipes)).toThrow();}
});

test('audition schedules exact burst times, reuses decoded takes and stops pending pulses',async()=>{
 const saved={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch},sources=[],decoded=[],fetches=[];
 const status={textContent:''},volume={value:'0.55'},stop={},listeners={},button={dataset:{paths:JSON.stringify(['delivery/one.ogg','delivery/two.ogg','delivery/three.ogg']),times:'[0,0.12,0.24,0.36,0.48]',name:'Test gun'},textContent:'Five shots'};
 const document={hidden:false,querySelector:s=>s==='#status'?status:s==='#volume'?volume:stop,querySelectorAll:s=>s==='audio'?[]:[button],addEventListener:(name,fn)=>listeners[name]=fn};
 let resumes=0,suspends=0;
 class Context{constructor(){this.currentTime=40;this.destination={};}resume(){resumes++;return Promise.resolve();}suspend(){suspends++;return Promise.resolve();}createGain(){return {connect(){},gain:{setValueAtTime(){}}};}async decodeAudioData(bytes){const buffer={sampleRate:48000,duration:.4,id:new Uint8Array(bytes)[0]};decoded.push(buffer);return buffer;}createBufferSource(){const source={connect(){},disconnect(){},start(time){this.when=time;},stop(){this.stopped=true;}};sources.push(source);return source;}}
 try{
  globalThis.document=document;globalThis.window={AudioContext:Context,addEventListener(){}};globalThis.fetch=async path=>{fetches.push(path);const id=fetches.length;return {ok:true,arrayBuffer:async()=>Uint8Array.of(id).buffer};};reviewPlayer();
  const pending=button.onclick();expect(resumes).toBe(1);await pending;expect(decoded).toHaveLength(3);expect(fetches).toHaveLength(3);expect(sources.map(s=>s.buffer.id)).toEqual([1,2,3,1,2]);
  for(let i=0;i<5;i++)expect(sources[i].when).toBeCloseTo(40.025+i*.12,8);
  stop.onclick();expect(sources.every(s=>s.stopped)).toBe(true);expect(status.textContent).toBe('Stopped');
  await button.onclick();expect(fetches).toHaveLength(3);expect(sources.slice(5).map(s=>s.buffer.id)).toEqual([3,1,2,3,1]);
  document.hidden=true;listeners.visibilitychange();expect(suspends).toBe(1);expect(sources.every(s=>s.stopped)).toBe(true);
 }finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
