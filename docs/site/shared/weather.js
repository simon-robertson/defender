// Weather type belongs to the zone. B and D stay clear.
export const ZONE_WEATHER=Object.freeze({A:'rain',B:null,C:'snow',D:null});
export const WET_PATH_REFLECTIVENESS=.4;
export const WET_MORTAR_REFLECTIVENESS=.1;

export function levelWeather(level){
 if(!Object.hasOwn(ZONE_WEATHER,level.zone))throw new Error('Unknown weather zone.');
 const setting=level.environment?.weather;
 // Existing level-v4 assets used the literal 'clear'. Preserve their dry state.
 if(setting===undefined||setting==='clear')return {type:ZONE_WEATHER[level.zone]??'clear',enabled:false};
 if(!setting||typeof setting!=='object'||Array.isArray(setting)||typeof setting.enabled!=='boolean'||Object.keys(setting).some(key=>key!=='enabled'))throw new Error('Weather requires an enabled boolean (legacy clear is also supported).');
 const type=ZONE_WEATHER[level.zone];
 if(setting.enabled&&!type)throw new Error('Weather for this zone has not been assigned yet.');
 return {type:type??'clear',enabled:setting.enabled};
}
