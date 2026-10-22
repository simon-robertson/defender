export const SOUND_LEVEL_DEFAULT=0,SOUND_LEVEL_KEY='defender.sound-level.v1';
export function soundLevel(value){return typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):SOUND_LEVEL_DEFAULT;}
export function loadSoundLevel(scope=globalThis){
 try{const raw=scope.localStorage?.getItem(SOUND_LEVEL_KEY);return raw==null?SOUND_LEVEL_DEFAULT:soundLevel(JSON.parse(raw));}
 catch{return SOUND_LEVEL_DEFAULT;}
}
export function saveSoundLevel(value,scope=globalThis){
 try{scope.localStorage?.setItem(SOUND_LEVEL_KEY,JSON.stringify(soundLevel(value)));}catch{/* A blocked store must not prevent in-session volume changes. */}
}
