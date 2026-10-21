import {MAX_DEBRIS} from './damage-effects.js';
import {ENEMY_EXPANSION_RIGS} from './enemy-expansion-rigs.js';

// Enemy-specific combat and visual tuning, kept separate from authored geometry.
export function defineEnemyStats({maxHealth,threat=1,effectOrigin,smoke,explosion}){
 if(!Number.isFinite(maxHealth)||maxHealth<=0)throw new Error('Invalid enemy health.');
 if(!Number.isFinite(threat)||threat<=0)throw new Error('Invalid enemy threat.');
 if(!effectOrigin||typeof effectOrigin.part!=='string'||!effectOrigin.part||!Array.isArray(effectOrigin.point)||effectOrigin.point.length!==3||effectOrigin.point.some(value=>!Number.isFinite(value)))throw new Error('Invalid enemy effect origin.');
 for(const [name,settings,keys]of [['smoke',smoke,['threshold','rate','life','riseSpeed','radius']],['explosion',explosion,['size','debrisCount','minCubeSize','maxCubeSize','minSpeed','maxSpeed','minUpSpeed','maxUpSpeed','gravity','settleSeconds','maxFlightSeconds','flashSeconds','lightSeconds','lightRadius','lightStrength','frightRadius','waveSeconds','waveRadius','waveWidth','waveStrength']]]){
  if(!settings||keys.some(key=>!Number.isFinite(settings[key])||settings[key]<=0))throw new Error('Invalid enemy '+name+' settings.');
 }
 if(smoke.threshold>1||!Number.isInteger(explosion.debrisCount)||explosion.debrisCount>MAX_DEBRIS||explosion.minCubeSize>explosion.maxCubeSize||explosion.minSpeed>explosion.maxSpeed||explosion.minUpSpeed>explosion.maxUpSpeed||explosion.settleSeconds<1||explosion.settleSeconds>2)throw new Error('Invalid enemy effect limits.');
 return Object.freeze({maxHealth,threat,effectOrigin:Object.freeze({part:effectOrigin.part,point:Object.freeze([...effectOrigin.point])}),smoke:Object.freeze({...smoke}),explosion:Object.freeze({...explosion})});
}

const PREVIEW_SMOKE={threshold:.5,rate:8,life:1.15,riseSpeed:7,radius:2.2};
const PREVIEW_EXPLOSION={size:12,debrisCount:24,minCubeSize:.9,maxCubeSize:2,minSpeed:28,maxSpeed:52,minUpSpeed:18,maxUpSpeed:30,gravity:60,settleSeconds:1.5,maxFlightSeconds:6,flashSeconds:.55,lightSeconds:.336,lightRadius:96,lightStrength:44,frightRadius:72,waveSeconds:.7,waveRadius:32,waveWidth:3,waveStrength:.65};
const expansion=(model,maxHealth,size=12,debrisCount=24)=>defineEnemyStats({
 maxHealth,threat:1,effectOrigin:ENEMY_EXPANSION_RIGS[model].effectOrigin,
 smoke:PREVIEW_SMOKE,explosion:{...PREVIEW_EXPLOSION,size,debrisCount,frightRadius:size*6},
});

// Equal provisional health keeps the three preview enemies alive for repeated
// hits and smoke inspection. This does not assign campaign roles or balance.
export const ENEMY_STATS=Object.freeze({dog:defineEnemyStats({
 maxHealth:300,threat:1,
 effectOrigin:{part:'body',point:[12,11.5,12]},
 smoke:PREVIEW_SMOKE,
 explosion:PREVIEW_EXPLOSION,
}),walker:defineEnemyStats({
 maxHealth:300,threat:1,
 effectOrigin:{part:'body',point:[12,22.5,12]},
 smoke:PREVIEW_SMOKE,
 explosion:{...PREVIEW_EXPLOSION,size:14,debrisCount:28,frightRadius:84},
}),spider:defineEnemyStats({
 maxHealth:300,threat:1,
 effectOrigin:{part:'body',point:[12,9.5,11.5]},
 smoke:PREVIEW_SMOKE,
 explosion:PREVIEW_EXPLOSION,
}),
// Sensible preview defaults follow visible mass only. No armour, resistance,
// attacks or special targeting priority is implied by these new silhouettes.
roller:expansion('roller',360),
'dune-tread':expansion('dune-tread',420,14,28),
tripod:expansion('tripod',280),
moth:expansion('moth',180,8,16),
'twin-fan':expansion('twin-fan',240,10,20),
ray:expansion('ray',220,10,20),
lantern:expansion('lantern',260,10,20),
});
