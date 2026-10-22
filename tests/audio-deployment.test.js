import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AUDIO_ASSETS,validateAudioAssets,audioAssetURL} from '../shared/audio-assets.js';
import {gatherAudioAssets} from '../scripts/deployment/audio.js';
import {gather} from '../scripts/deployment/build.js';
import {audioResponder} from '../server/audio.js';
import {encodeWav} from '../scripts/audio/pcm.js';
const wav=()=>encodeWav(new Float32Array([0,.1,-.1,0]),48000,1);
const manifest=[{id:'test-cue',file:'test-cue.ogg',fallback:'test-cue.wav'}];
function ogg(channels=1){const bytes=Buffer.alloc(80);bytes.write('OggS');bytes.write('OpusHead',28);bytes[36]=1;bytes[37]=channels;return bytes;}
test('audio manifest accepts delivery files and rejects traversal, masters and duplicates',()=>{
 expect(validateAudioAssets(manifest)).toBe(manifest);expect(audioAssetURL('not-a-cue')).toBeNull();
 for(const list of [[{id:'bad',file:'../master.wav'}],[{id:'bad',file:'test.flac'}],[{id:'bad',file:'test.ogg',fallback:'test.ogg'}],[manifest[0],manifest[0]],[{id:'bad',file:'test.wav',master:'source.wav'}]])expect(()=>validateAudioAssets(list)).toThrow();
});
test('packaging gathers exact mono delivery bytes and fails on missing/stereo files',async()=>{
 const files=new Map([['assets/audio/test-cue.ogg',ogg()],['assets/audio/test-cue.wav',wav()]]),requested=[];
 const result=await gatherAudioAssets(manifest,async path=>{requested.push(path);if(!files.has(path))throw new Error('Missing');return files.get(path);});
 expect(result.map(f=>f.source)).toEqual([...files.keys()]);expect(result[1].data).toEqual(wav());expect(requested.every(p=>!p.includes('masters'))).toBe(true);
 await expect(gatherAudioAssets(manifest,async()=>{throw new Error('Missing');})).rejects.toThrow('Missing');
 await expect(gatherAudioAssets(manifest,async()=>ogg(2))).rejects.toThrow('mono');
 const stereo=wav();stereo.writeUInt16LE(2,22);await expect(gatherAudioAssets([{id:'bad',file:'bad.wav'}],async()=>stereo)).rejects.toThrow('mono');
});
test('development serves only declared delivery audio with MIME and GET/HEAD confinement',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'defender-audio-route-'));await mkdir(join(temp,'audio'));
 try{
  await writeFile(join(temp,'audio/test-cue.wav'),wav());await writeFile(join(temp,'private.wav'),wav());await symlink(join(temp,'private.wav'),join(temp,'audio/test-cue.ogg'));
  const serve=audioResponder(temp,manifest),url='http://localhost/assets/audio/test-cue.wav';
  const response=await serve(new Request(url),'/assets/audio/test-cue.wav');expect(response.status).toBe(200);expect(response.headers.get('content-type')).toBe('audio/wav');expect(Buffer.from(await response.arrayBuffer())).toEqual(wav());
  const head=await serve(new Request(url,{method:'HEAD'}),'/assets/audio/test-cue.wav');expect((await head.arrayBuffer()).byteLength).toBe(0);
  expect((await serve(new Request(url,{method:'POST'}),'/assets/audio/test-cue.wav')).status).toBe(405);
  expect((await serve(new Request(url),'/assets/audio/private.wav')).status).toBe(404);expect((await serve(new Request(url),'/assets/audio/../private.wav')).status).toBe(404);expect((await serve(new Request(url),'/assets/audio/test-cue.ogg')).status).toBe(404);
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('production gather includes player audio modules and only manifest-listed audio',async()=>{
 const result=await gather();expect(result.outputs.has('docs/site/play/audio.js')).toBe(true);expect(result.outputs.has('docs/site/shared/audio-assets.js')).toBe(true);expect(result.audio).toHaveLength(6);expect(AUDIO_ASSETS.map(asset=>asset.id)).toEqual(['gun-dry-1','gun-dry-2','gun-dry-3']);for(const asset of AUDIO_ASSETS)for(const file of [asset.file,asset.fallback])expect(result.outputs.get('docs/site/assets/audio/'+file)?.data).toEqual(await readFile(new URL('../assets/audio/'+file,import.meta.url)));expect([...result.outputs.keys()].some(p=>p.includes('diagnostic')||p.includes('masters/'))).toBe(false);
 const shipped=result.outputs.get('docs/site/shared/audio-assets.js').data.toString();expect(shipped).toContain('new URL(`../assets/audio/');
 const base='https://example.test/defender/site/shared/audio-assets.js';expect(new URL('../assets/audio/test-cue.ogg',base).href).toBe('https://example.test/defender/site/assets/audio/test-cue.ogg');
});
