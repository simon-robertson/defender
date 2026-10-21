import {PLAY_CONFIG,validatePlayConfig} from '../../play/config.js';

// Camera and acquisition regressions replay the 19 October gun/Dog fights.
// Their invariant is presentation/controller behaviour, independent of later
// campaign composition, unlock timing and stronger species placement envelopes.
export function legacyPlayConfig(){
 const config=structuredClone(PLAY_CONFIG),gun=config.defences['turret-study'];
 config.defences={'turret-study':gun};config.enemies={dog:{maxHealth:80,speed:12,missValue:1,threat:1}};
 gun.availableFromWave=1;for(const profile of Object.values(gun.variants))profile.availableFromWave=1;
 for(const [index,variant]of ['base','upgrade1','upgrade2'].entries()){
  gun.variants[variant].stats={maxRange:[48,72,96][index],strength:[10,12,14][index],requiresLineOfSight:true};
  gun.variants[variant].firing={shotsPerBurst:[1,3,5][index],shotIntervalSeconds:index===0?0:.12,cooldownSeconds:1,delivery:'hitscan',projectile:null};
 }
 const health=[100,120,140,160,180,200,220,240],speeds=[12,13,14,15,15,15,15,15],counts=[3,4,5,6,6,7,8,9],gaps=[3,2.8,2.6,2.4,2.3,2.2,2.1,2];
 for(let li=0;li<config.levels.length;li++)for(let wi=0;wi<4;wi++){
  const wave=config.levels[li].waves[wi],index=Math.min(li,1)*4+wi;
  wave.enemyOverrides={dog:{maxHealth:health[index],speed:speeds[index]}};
  // The required A3/A4 catalogue entries are unused by these regressions.
  // Keep their placeholder count small instead of inventing a late economy
  // capable of exceeding the production model-light bound.
  wave.spawns=Array.from({length:li<2?counts[index]:1},(_,i)=>({id:wave.id+'-dog-'+(i+1),at:i*gaps[index],model:'dog',routeId:'main'}));
 }
 return validatePlayConfig(config);
}
