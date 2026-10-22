import {validateAudioAssets} from '../../shared/audio-assets.js';
// Header sanity checks only. The offline encoder pipeline performs full stream
// inspection/decoding; packaging must also reject accidental stereo masters.
export function assertMonoAudio(file,bytes){
 const b=Buffer.from(bytes);
 if(file.endsWith('.ogg')){
  const head=b.indexOf('OpusHead');if(b.toString('ascii',0,4)!=='OggS'||head<0||head>512||head+19>b.length||b[head+9]!==1)throw new Error('Expected mono Ogg Opus: '+file);
 }else{
  if(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE')throw new Error('Expected mono WAV: '+file);
  let mono=false,data=false;
  for(let p=12;p+8<=b.length;){const tag=b.toString('ascii',p,p+4),size=b.readUInt32LE(p+4),start=p+8;if(start+size>b.length)throw new Error('Truncated audio: '+file);if(tag==='fmt '&&size>=16)mono=b.readUInt16LE(start+2)===1;if(tag==='data'&&size)data=true;p=start+size+(size&1);}
  if(!mono||!data)throw new Error('Expected mono WAV: '+file);
 }
}
export async function gatherAudioAssets(assets,input){
 validateAudioAssets(assets);const files=[];
 for(const asset of assets)for(const file of [asset.file,asset.fallback])if(file){const source='assets/audio/'+file,data=await input(source);assertMonoAudio(file,data);files.push({id:asset.id,source,data});}
 return files;
}
