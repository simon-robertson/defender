// Runtime delivery manifest. Add only reviewed game cues, never authoring masters
// or diagnostic samples. Each entry: {id, file, fallback?}; fallback is mono WAV.
export const AUDIO_ASSETS=Object.freeze([
 ...[1,2,3].map(take=>Object.freeze({id:`gun-dry-${take}`,file:`gun-dry-${take}.ogg`,fallback:`gun-dry-${take}.wav`})),
]);
export function validateAudioAssets(assets){
 if(!Array.isArray(assets))throw new Error('Audio manifest must be an array');
 const ids=new Set(),files=new Set();
 for(const asset of assets){
  if(!asset||typeof asset!=='object'||Array.isArray(asset)||Object.keys(asset).some(key=>!['id','file','fallback'].includes(key)))throw new Error('Invalid audio manifest entry');
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(asset.id)||ids.has(asset.id))throw new Error('Invalid or duplicate audio id');ids.add(asset.id);
  for(const [key,file]of [['file',asset.file],['fallback',asset.fallback]]){
   if(key==='fallback'&&file===undefined)continue;
   if(typeof file!=='string'||!new RegExp('^[a-z][a-z0-9-]{0,63}\\.'+(key==='fallback'?'wav':'(?:ogg|wav)')+'$').test(file))throw new Error('Invalid audio file: '+file);
   if(files.has(file))throw new Error('Duplicate audio file: '+file);files.add(file);
  }
 }
 return assets;
}
export function audioAssetURL(id,fallback=false){
 const asset=AUDIO_ASSETS.find(asset=>asset.id===id),file=fallback?asset?.fallback:asset?.file;
 return file?new URL(`../assets/audio/${file}`,import.meta.url):null;
}
export function audioMimeType(file){return file.endsWith('.ogg')?'audio/ogg':'audio/wav';}
