// A terrain material with its own render path; no image/normal/noise textures.
// Gentle breeze refraction and SSR; retain 60% base transparency and blue tint.
export function defaultWaterMaterial(){return {type:'water',color:'#8FBBD4',emission:0,reflectiveness:.85,opacity:.4,absorption:0,refraction:1,rippleStrength:.09,rippleScale:2.5,rippleSpeed:.24};}
export function validateWaterMaterial(m){
 if(!m||m.type!=='water'||!/^#[0-9a-f]{6}$/i.test(m.color))throw new Error('Water requires type water and an RGB colour.');
 for(const key of ['emission','reflectiveness','opacity','absorption','refraction','rippleStrength'])if(!Number.isFinite(m[key])||m[key]<0||m[key]>1)throw new Error(`Water ${key} must be in [0,1].`);
 if(!Number.isFinite(m.rippleScale)||m.rippleScale<=0||m.rippleScale>4)throw new Error('Water ripple scale must be in (0,4].');
 if(!Number.isFinite(m.rippleSpeed)||m.rippleSpeed<0||m.rippleSpeed>4)throw new Error('Water ripple speed must be in [0,4] cycles per second.');
 return m;
}
