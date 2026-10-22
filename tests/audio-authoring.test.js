import {test,expect} from 'bun:test';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {renderRecipe,encodeWav,readWav,validateRecipe} from '../scripts/audio/pcm.js';
import {buildAudio,doctor,serveReview} from '../scripts/audio/build.js';
import {reviewPage} from '../scripts/audio/review.js';
const bundle=JSON.parse(await readFile(new URL('../audio/diagnostics.json',import.meta.url),'utf8'));
const transient=bundle.recipes[0],loop=bundle.recipes[1];
const copy=value=>structuredClone(value);
test('offline recipe rendering is reproducible, seed-specific and does not use global RNG',()=>{
 const random=Math.random;Math.random=()=>{throw new Error('Unexpected global RNG');};
 try{const a=renderRecipe(transient),b=renderRecipe(transient),c=renderRecipe({...transient,seed:transient.seed+1});expect(a.samples).toEqual(b.samples);expect(a.samples).not.toEqual(c.samples);expect(a.analysis.peak).toBeLessThan(1);expect(a.samples[0]).toBe(0);expect(a.samples.at(-1)).toBe(0);}finally{Math.random=random;}
});
test('24-bit odd-length mono WAV round trips preserve shape and quantisation',()=>{
 for(const channels of [1]){const source=new Float32Array(channels*3);source.set([-.9,0,.9]);const wav=encodeWav(source,48000,channels),decoded=readWav(wav);expect(wav.readUInt32LE(4)).toBe(wav.length-8);expect(wav.length%2).toBe(0);expect(decoded).toMatchObject({sampleRate:48000,channels,frames:3,bits:24});for(let i=0;i<source.length;i++)expect(Math.abs(decoded.samples[i]-source[i])).toBeLessThan(2/8388608);}
 expect(()=>readWav(Buffer.from('RIFF'))).toThrow();expect(()=>encodeWav(new Float32Array(4),48000,2)).toThrow('mono');
});
test('periodic recipe exposes boundary and derivative measurements without artificial fade',()=>{
 const rendered=renderRecipe(loop);expect(rendered.analysis.loop.startFrame).toBe(0);expect(rendered.analysis.loop.endFrame).toBe(48000);expect(rendered.analysis.loop.boundaryJump).toBeLessThan(.01);expect(rendered.analysis.loop.slopeJump).toBeLessThan(.0001);expect(rendered.analysis.peak).toBeGreaterThan(.1);
});
test('authoring rejects ambiguous recipes, unsafe names, invalid loops, clipping and unbounded work',()=>{
 for(const modify of [r=>r.id='../escape',r=>r.unknown=1,r=>r.duration=Infinity,r=>r.duration=31,r=>r.seed=0,r=>r.channels=2,r=>r.layers[0].attack=-1,r=>r.layers[0].cutoff=NaN,r=>r.layers[0].frequency=30000,r=>r.loop={startFrame:2,endFrame:1},r=>r.layers=Array(17).fill(r.layers[0])]){const recipe=copy(transient);modify(recipe);expect(()=>validateRecipe(recipe)).toThrow();}
 const loud=copy(transient);loud.gain=1;loud.layers=Array(16).fill({...loud.layers[0],gain:1});expect(()=>renderRecipe(loud)).toThrow('clips');
});
test('review escapes recipe text and uses explicit loop times with owned audio cleanup',()=>{
 const recipe={...loop,name:'<script>"bad"</script>'},rendered=renderRecipe(recipe),html=reviewPage([{recipe,analysis:rendered.analysis,paths:{master:'masters/test.wav'},waveform:[.1,.2]}]);expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>"bad"');expect(html).toContain('data-end="1"');expect(html).toContain('source.loopStart=start');expect(html).toContain("document.addEventListener('visibilitychange'");
});
const encoderTest=['opusenc','opusdec','opusinfo'].every(name=>Bun.which(name))?test:test.skip;
encoderTest('real external encoder round trip and read-only review stay outside game assets',async()=>{
 // This integration test needs the explicitly installed host tooling, never a vendored fallback.
 const tools=doctor();expect(tools.opusenc.path).not.toContain('/defender/');
 const first=await buildAudio(undefined,{publishLatest:false}),second=await buildAudio(undefined,{publishLatest:false});let server;
 try{
  expect(first.manifest.entries.length).toBe(2);
  for(let i=0;i<2;i++){const a=first.manifest.entries[i],b=second.manifest.entries[i];expect(a.files.master.sha256).toBe(b.files.master.sha256);expect(a.files.ogg.sha256).toBe(b.files.ogg.sha256);expect(a.decodedAnalysis.frames).toBe(a.analysis.frames);expect(a.files.ogg.bytes).toBeLessThan(a.files.master.bytes);}
  server=await serveReview(0,basename(second.output));const url=String(server.url);
  const page=await fetch(url);expect(page.status).toBe(200);expect(await page.text()).toContain('Diagnostic sounds only');
  const wav=await fetch(new URL(first.manifest.entries[0].paths.master,url),{method:'HEAD'});expect(wav.headers.get('content-type')).toBe('audio/wav');expect((await wav.arrayBuffer()).byteLength).toBe(0);
  const ogg=await fetch(new URL(first.manifest.entries[0].paths.ogg,url));expect(ogg.headers.get('content-type')).toBe('audio/ogg');expect(Buffer.from(await ogg.arrayBuffer()).toString('ascii',0,4)).toBe('OggS');
  expect((await fetch(new URL('/package.json',url))).status).toBe(404);expect((await fetch(new URL('/%2e%2e/package.json',url))).status).toBe(404);expect((await fetch(url,{method:'POST'})).status).toBe(405);
 }finally{server?.stop(true);await rm(first.output,{recursive:true,force:true});await rm(second.output,{recursive:true,force:true});}
});
test('invalid build input fails before producing delivery data',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'defender-audio-'));
 try{const path=join(temp,'bad.json');await writeFile(path,JSON.stringify({version:1,recipes:[transient,transient]}));await expect(buildAudio(path,{wavOnly:true})).rejects.toThrow('Duplicate');}finally{await rm(temp,{recursive:true,force:true});}
});
