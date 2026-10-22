export const GRAPHICS_DEFAULTS=Object.freeze({critters:true,reflections:true,bloom:true});
export const GRAPHICS_STORAGE_KEY='defender.graphics.v1';
export function graphicsOptions(value){
 return Object.fromEntries(Object.keys(GRAPHICS_DEFAULTS).map(key=>[key,typeof value?.[key]==='boolean'?value[key]:true]));
}
export function loadGraphicsOptions(storage){
 try{return graphicsOptions(JSON.parse((storage??globalThis.localStorage)?.getItem(GRAPHICS_STORAGE_KEY)??'null'));}
 catch{return graphicsOptions();}
}
export function saveGraphicsOptions(value,storage){
 try{(storage??globalThis.localStorage)?.setItem(GRAPHICS_STORAGE_KEY,JSON.stringify(graphicsOptions(value)));}
 catch{/* Graphics choices still work for this page when storage is unavailable. */}
}
