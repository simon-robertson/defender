import {DRONE_TUNING,DRONE_PREVIEW} from '../shared/drone.js';
import {ENHANCER_STATS} from '../shared/enhancer.js';
import {DEFENCE_STATS} from '../shared/defence.js';
import {TURRET_FIRING,ARC_SPIRE_FIRING} from '../shared/arsenal.js';
import {MISSILE_FIRING} from '../shared/missile-flight.js';
import {MAX_SUPPORTED_MODEL_LIGHTS} from '../shared/model-lights.js';
import {VARIANTS} from '../shared/model.js';

// All campaign tuning belongs to /play/. Accepted assets and /game/ profiles
// remain unchanged. The finite campaign spans all sixteen authored landscapes.
export const PLAY_CONFIG_VERSION=1;
export const MAX_PLAY_MODEL_LIGHTS=MAX_SUPPORTED_MODEL_LIGHTS;
export const PLAY_TIME_RESOLUTION=1/120;
export const DEFENCE_LABELS=Object.freeze({'turret-study':'Gun','arc-spire':'Arc Spire','missile-launcher':'Missile launcher','power-generator':'Power generator','drone-defence':'Drone'});
export const ENEMY_LABELS=Object.freeze({dog:'Dog',roller:'Roller',moth:'Moth',walker:'Walker','dune-tread':'Dune Tread','twin-fan':'Twin Fan',tripod:'Tripod',ray:'Ray',spider:'Spider',lantern:'Lantern'});
export const PLAY_MODEL_LIGHTS=Object.freeze({'turret-study':3,'arc-spire':4,'missile-launcher':4,'power-generator':4,'drone-defence':9,dog:4,roller:2,moth:2,walker:2,'dune-tread':1,'twin-fan':1,tripod:1,ray:1,spider:1,lantern:1});
export const PLAY_LEVEL_IDS=Object.freeze(['moss','ochre','ice','plum'].flatMap(prefix=>[1,2,3,4].map(index=>prefix+'-0'+index)));
export const PLAY_ROUTE_IDS=Object.freeze(Object.fromEntries(PLAY_LEVEL_IDS.map(id=>[id,Object.freeze(['main',...(['moss-03','ochre-03'].includes(id)?['eastern']:id==='ice-03'?['northern']:id==='ochre-04'?['lake']:[])])])));
const SPEED_LIMITS={dog:15,roller:16,moth:24,walker:18,'dune-tread':10,'twin-fan':18,tripod:14,ray:22,spider:12,lantern:16};
const AIR_SPECIES=new Set(['moth','twin-fan','ray','lantern']);
const clone=value=>structuredClone(value);
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const positive=value=>Number.isFinite(value)&&value>0;
const check=(valid,message)=>{if(!valid)throw new Error('Invalid play configuration: '+message);};
function profile(model,variant,strength,maxRange,firing,availableFromWave=1){return {availableFromWave,stats:{...clone(DEFENCE_STATS[model][variant]),strength,maxRange},firing:clone(firing)};}
function encounter(level,index,name,description,enemyOverrides,groups,zone='a'){
 const id=`${zone}${level}-wave-${index}`,spawns=[];
 for(const [model,count,at,gap,routeId='main'] of groups)for(let i=0;i<count;i++)spawns.push({id:`${id}-${model}-${spawns.length+1}`,at:Math.round((at+i*gap)*1000)/1000,model,routeId});
 spawns.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));return {id,name,description,enemyOverrides:clone(enemyOverrides),spawns};
}
const A1={dog:{maxHealth:100,speed:12},roller:{maxHealth:350,speed:12}};
const A2={dog:{maxHealth:240,speed:14},roller:{maxHealth:750,speed:14},moth:{maxHealth:180,speed:20}};
const A3={dog:{maxHealth:480,speed:15},roller:{maxHealth:1400,speed:15},moth:{maxHealth:300,speed:21}};
const A4={dog:{maxHealth:650,speed:15},roller:{maxHealth:2000,speed:15},moth:{maxHealth:450,speed:22}};

// Later zones retain the same earned wallet and arsenal. Species keep one
// health/speed profile per level; traffic timing changes encounter pressure.
const B=[
 {walker:{maxHealth:1100,speed:10},'dune-tread':{maxHealth:2600,speed:10},'twin-fan':{maxHealth:600,speed:18}},
 {walker:{maxHealth:1400,speed:10},'dune-tread':{maxHealth:3200,speed:10},'twin-fan':{maxHealth:750,speed:18}},
 {walker:{maxHealth:1700,speed:10},'dune-tread':{maxHealth:3900,speed:10},'twin-fan':{maxHealth:900,speed:18}},
 {walker:{maxHealth:1400,speed:10},'dune-tread':{maxHealth:3300,speed:10},'twin-fan':{maxHealth:900,speed:18}},
];
const C=[2200,2800,3400,3900].map((health,index)=>({tripod:{maxHealth:health*1.5,speed:14},ray:{maxHealth:(1200+index*150)*1.5,speed:22}}));
const D=[4000,4500,5000,5500].map((health,index)=>({spider:{maxHealth:health*1.5,speed:12},lantern:{maxHealth:(1600+index*200)*1.5,speed:16}}));
const later=(zone,level,index,name,description,groups)=>encounter(level,index,name,description,(zone==='b'?B:zone==='c'?C:D)[level-1],groups,zone);
// Both entrances open together. Each branch retains its eight-second ground
// spacing; airborne groups share their authored introduction time.
function basinGroups(ground,airCount,airStart){
 const groups=[];let ordinal=0;
 for(const [model,count]of ground)for(let i=0;i<count;i++,ordinal++)groups.push([model,1,Math.floor(ordinal/2)*8,0,ordinal%2?'lake':'main']);
 groups.push(['twin-fan',Math.ceil(airCount/2),airStart,6],['twin-fan',Math.floor(airCount/2),airStart,6,'lake']);
 return groups;
}
const laterLevels=[
 {id:'ochre-01',zone:'B',waves:[
  later('b',1,1,'Cistern arrivals','Walkers lead the new ground convoy; Twin Fans arrive above the circuit.',[['walker',5,0,3.6],['dune-tread',4,20,3.6],['twin-fan',5,5,3]]),
  later('b',1,2,'Wheeled procession','Six-wheel rovers alternate with the taller Walkers.',[['dune-tread',5,0,3.6],['walker',5,22,3.6],['twin-fan',5,8,3]]),
  later('b',1,3,'Fans at the return','An extended air group tests the north return and eastern court.',[['walker',6,0,3.6],['dune-tread',5,25,3.6],['twin-fan',7,4,3]]),
  later('b',1,4,'Cistern and mesa','Two ground stages and six Twin Fans cover the complete circuit.',[['walker',6,0,3.6],['dune-tread',6,25,3.6],['twin-fan',6,5,3]]),
 ]},
 {id:'ochre-02',zone:'B',waves:[
  later('b',2,1,'Across the riverfold','A heavier mixed convoy crosses the existing wooden bridge.',[['walker',6,0,3.6],['dune-tread',5,25,3.6],['twin-fan',5,6,3]]),
  later('b',2,2,'Aqueduct weight','Treads test sustained fire across both banks.',[['dune-tread',7,0,3.6],['walker',5,29,3.6],['twin-fan',6,8,3]]),
  later('b',2,3,'Open sky crossing','Twin Fans overlap the bridge convoy and eastern return.',[['walker',6,0,3.6],['dune-tread',6,25,3.6],['twin-fan',8,4,3]]),
  later('b',2,4,'Riverfold crossing','A sustained combined column rewards repeat exposure and late coverage.',[['dune-tread',7,0,3.6],['walker',6,29,3.6],['twin-fan',7,7,3]]),
 ]},
 {id:'ochre-03',zone:'B',waves:[
  // Both ground fronts open together; matching airborne groups also start
  // together instead of compensating for their different approach lengths.
  later('b',3,1,'Mesa approaches','Walkers take the west while treads arrive from the east.',[['walker',5,0,10],['dune-tread',5,0,10,'eastern'],['twin-fan',4,3,6]]),
  later('b',3,2,'Exchange the fronts','Heavy treads move west while Walkers use the shorter approach.',[['dune-tread',6,0,10],['walker',6,0,10,'eastern'],['twin-fan',5,6,6,'eastern']]),
  later('b',3,3,'Fans at confluence','Separated flight groups share the southern approach.',[['walker',6,0,10],['dune-tread',6,0,10,'eastern'],['twin-fan',4,2,6],['twin-fan',4,2,6,'eastern']]),
  later('b',3,4,'Three mesa confluence','Both branches sustain the heavy shared-tail test.',[['dune-tread',6,0,10],['walker',6,0,10,'eastern'],['twin-fan',4,2,6],['twin-fan',4,2,6,'eastern']]),
 ]},
 {id:'ochre-04',zone:'B',waves:[
  later('b',4,1,'Basin interception','Two approaches cross the basin and circle the aqueduct before merging.',basinGroups([['walker',6],['dune-tread',5]],5,5)),
  later('b',4,2,'Heavy basin convoy','Seven six-wheel rovers divide between the lake bridge and mainland.',basinGroups([['dune-tread',7],['walker',5]],6,6)),
  later('b',4,3,'Petrol sky','Twin Fans sweep both approaches above the divided ground column.',basinGroups([['walker',6],['dune-tread',6]],8,3)),
  later('b',4,4,'Aqueduct and shore','The combined finale tests bank courts, aqueduct and shared shore.',basinGroups([['dune-tread',7],['walker',6]],7,5)),
 ]},
 ...[1,2,3,4].map(level=>({id:'ice-0'+level,zone:'C',waves:[
  later('c',level,1,['Floe patrol','Ember crossing','White ridge fronts','Ice garden patrol'][level-1],'Tripods and Rays test the retained arsenal on this new landscape.',level===3?[['tripod',4,0,8],['tripod',4,0,8,'northern'],['ray',3,2,6],['ray',3,2,6,'northern']]:[['tripod',8,0,3.5],['ray',6,3,3]]),
  later('c',level,2,'Three leg procession','A longer Tripod column tests sustained exposure.',level===3?[['tripod',5,0,8],['tripod',5,0,8,'northern'],['ray',4,2,6],['ray',3,2,6,'northern']]:[['tripod',10,0,3.5],['ray',7,5,3]]),
  later('c',level,3,'Wings over ice','A larger Ray group needs useful flight interception.',level===3?[['tripod',5,0,8],['tripod',4,0,8,'northern'],['ray',5,2,6],['ray',5,2,6,'northern']]:[['tripod',9,0,3.5],['ray',10,2,3]]),
  later('c',level,4,['Floe and ember','Across the meltwater','White ridge confluence','The ice and ember tour'][level-1],'The combined finale uses early contact, returns and a late catch.',level===3?[['tripod',6,0,8],['tripod',5,0,8,'northern'],['ray',6,2,6],['ray',5,2,6,'northern']]:[['tripod',11,0,3.5],['ray',11,3,3]]),
 ]})),
 ...[1,2,3,4].map(level=>({id:'plum-0'+level,zone:'D',waves:[
  later('d',level,1,['Violet arrivals','Orchard patrol','Dusk approach','Final garden'][level-1],'Spiders and Lanterns open the final zone with retained ownership.',[['spider',10,0,3.6],['lantern',8,4,3]]),
  later('d',level,2,'Low mechanical tide','An extended Spider column tests the whole journey.',[['spider',12,0,3.6],['lantern',8,6,3]]),
  later('d',level,3,'Lantern procession','The airborne procession overlaps the low ground column.',[['spider',11,0,3.6],['lantern',11,3,3]]),
  later('d',level,4,level===4?'The last defence':'Plum and mint tour','A long combined finale rewards continued investment and deliberate coverage.',[['spider',14,0,3.6],['lantern',12,4,3]]),
 ]})),
];

const DEFAULT_CONFIG={
 schema:'defender.play-config',version:PLAY_CONFIG_VERSION,
 startTokens:2,waveReward:2,missLimit:10,waveSettleSeconds:4,
 defences:{
  'turret-study':{purchaseCost:1,upgradeCost:1,availableFromWave:1,enabledVariants:[...VARIANTS],variants:{
   base:profile('turret-study','base',10,48,TURRET_FIRING.base),
   upgrade1:profile('turret-study','upgrade1',12,66,TURRET_FIRING.upgrade1),
   upgrade2:profile('turret-study','upgrade2',14,84,{shotsPerBurst:5,shotIntervalSeconds:.12,cooldownSeconds:1,delivery:'hitscan',projectile:null},5),
  }},
  'arc-spire':{purchaseCost:2,upgradeCost:2,availableFromWave:5,enabledVariants:[...VARIANTS],variants:{
   base:profile('arc-spire','base',36,60,{...ARC_SPIRE_FIRING.base,cooldownSeconds:1.2},5),
   upgrade1:profile('arc-spire','upgrade1',48,84,{...ARC_SPIRE_FIRING.upgrade1,shotIntervalSeconds:.16,cooldownSeconds:1.3},5),
   upgrade2:profile('arc-spire','upgrade2',65,108,{...ARC_SPIRE_FIRING.upgrade2,shotIntervalSeconds:.18,cooldownSeconds:1.4},9),
  }},
  'missile-launcher':{purchaseCost:3,upgradeCost:3,availableFromWave:9,enabledVariants:[...VARIANTS],variants:{
   base:profile('missile-launcher','base',300,96,MISSILE_FIRING.base,9),
   upgrade1:profile('missile-launcher','upgrade1',420,126,MISSILE_FIRING.upgrade1,9),
   upgrade2:profile('missile-launcher','upgrade2',540,150,MISSILE_FIRING.upgrade2,13),
  }},
  'drone-defence':{purchaseCost:1,upgradeCost:null,availableFromWave:5,maxOwned:4,enabledVariants:['base'],variants:{
   base:{stats:{strength:DRONE_TUNING.base.weapon.strength,maxRange:DRONE_PREVIEW.maxRange,requiresLineOfSight:true},firing:clone(DRONE_TUNING.base.weapon),flightSeconds:DRONE_TUNING.base.flightSeconds,rechargeSeconds:DRONE_TUNING.base.rechargeSeconds},
  }},
  'power-generator':{kind:'enhancer',purchaseCost:4,upgradeCost:null,availableFromWave:1,enabledVariants:['base'],variants:{
   base:{stats:clone(ENHANCER_STATS['power-generator'].base),firing:null},
  }},
 },
 enemies:{dog:{maxHealth:100,speed:12,missValue:1,threat:1},roller:{maxHealth:350,speed:12,missValue:1,threat:1.35},moth:{maxHealth:180,speed:20,altitude:44,missValue:1,threat:1.2},...Object.fromEntries(Object.entries({...B[0],...C[0],...D[0]}).map(([model,profile])=>[model,{...profile,missValue:1,threat:model==='dune-tread'?1.35:1,...(AIR_SPECIES.has(model)?{altitude:44}:{})}]))},
 levels:[
  {id:'moss-01',zone:'A',waves:[
   encounter(1,1,'First contact','Three Dogs. Cover more than one bend.',A1,[['dog',3,0,3]]),
   encounter(1,2,'Second patrol','Two separated Dog groups test repeat coverage.',A1,[['dog',3,0,3],['dog',3,14,3]]),
   encounter(1,3,'Heavy wheels','Rollers have more health. Familiar Dogs arrive first.',A1,[['dog',4,0,3],['roller',2,15,3]]),
   encounter(1,4,'The Southern Hook','A sustained ground patrol rewards reinvestment.',A1,[['dog',3,0,3],['roller',3,10,3],['dog',3,21,3]]),
  ]},
  {id:'moss-02',zone:'A',waves:[
   encounter(2,1,'Above the garden','Moths follow the route in the air. Guns can hit them at suitable distances.',A2,[['dog',4,0,3],['moth',3,3,4]]),
   encounter(2,2,'Crossing convoy','Heavy ground traffic followed by a small air group.',A2,[['roller',4,0,2.8],['dog',5,13,2.8],['moth',2,18,4]]),
   encounter(2,3,'Shared attention','Air and ground overlap. Dependable aiming matters.',A2,[['dog',4,0,2.8],['roller',3,12,2.8],['moth',5,4,3.5]]),
   encounter(2,4,'Garden crossing','Two combined groups use the bridge and the return.',A2,[['dog',3,0,2.8],['roller',2,9,2.8],['moth',2,5,3.5],['dog',3,20,2.8],['roller',2,29,2.8],['moth',2,24,3.5]]),
  ]},
  {id:'moss-03',zone:'A',waves:[
   // Ground fronts open together. Later groups retain their branch sequence
   // and spacing; matching Moth groups share their introduction time.
   encounter(3,1,'Two approaches','Dogs from the west; Rollers from the east. Both share the southern exit.',A3,[['roller',3,0,8,'eastern'],['dog',3,0,8],['moth',2,2,5,'eastern'],['moth',2,2,5]]),
   encounter(3,2,'Changing weight','The heavier convoy switches to the western approach.',A3,[['dog',4,0,8,'eastern'],['roller',4,0,8],['moth',4,5,4,'eastern']]),
   encounter(3,3,'At the confluence','Longer air groups compete with both ground approaches.',A3,[['roller',4,0,8,'eastern'],['dog',4,0,8],['moth',3,3,4],['moth',3,3,4,'eastern']]),
   encounter(3,4,'Both fronts','Unequal approaches need early damage and a shared-tail defence.',A3,[['roller',3,0,8,'eastern'],['dog',2,24,8,'eastern'],['dog',2,0,8],['roller',3,16,8],['moth',2,2,5],['moth',2,2,5,'eastern']]),
  ]},
  {id:'moss-04',zone:'A',waves:[
   encounter(4,1,'Ruin and mere','A stronger mixed patrol on the long tour. Retained purchases matter.',A4,[['dog',4,0,2.8],['roller',4,12,2.8],['moth',4,5,3.5]]),
   encounter(4,2,'Heavy procession','More Rollers test sustained damage and launcher reloads.',A4,[['roller',3,0,2.8],['dog',4,11,2.8],['roller',3,24,2.8],['moth',2,14,4]]),
   encounter(4,3,'Wings over stone','A larger Moth group tests firing windows and late interception.',A4,[['dog',4,0,2.8],['roller',2,12,2.8],['moth',6,3,3.5]]),
   encounter(4,4,'The final tour','Three stages combine Dogs, Rollers and Moths. Cover the whole journey.',A4,[['dog',2,0,2.8],['roller',6,7.5,2.8],['moth',6,3,3.5]]),
  ]},
  ...laterLevels,
 ],
};

export function playCapacity(config){
 const waves=config.levels.flatMap(level=>level.waves),budget=config.startTokens+config.waveReward*Math.max(0,waves.length-1),families=Object.keys(config.defences),species=Object.keys(config.enemies);
 const maxOwnedByFamily=Object.fromEntries(families.map(model=>[model,Math.min(config.defences[model].maxOwned??Infinity,Math.floor(budget/config.defences[model].purchaseCost))]));
 const maxWaveEnemiesBySpecies=Object.fromEntries(species.map(model=>[model,Math.max(...waves.map(wave=>wave.spawns.filter(spawn=>spawn.model===model).length))]));
 let modelLights=0;
 for(let wi=0;wi<waves.length;wi++){
  const tokens=config.startTokens+config.waveReward*wi,best=new Uint32Array(tokens+1);
  for(const model of families){
   const family=config.defences[model],cost=family.purchaseCost,lights=PLAY_MODEL_LIGHTS[model];if((family.availableFromWave??1)>wi+1)continue;
   if(family.maxOwned===undefined){for(let amount=cost;amount<=tokens;amount++)best[amount]=Math.max(best[amount],best[amount-cost]+lights);}
   else for(let copy=0;copy<Math.min(family.maxOwned,Math.floor(tokens/cost));copy++)for(let amount=tokens;amount>=cost;amount--)best[amount]=Math.max(best[amount],best[amount-cost]+lights);
  }
  const enemyLights=waves[wi].spawns.reduce((sum,spawn)=>sum+PLAY_MODEL_LIGHTS[spawn.model],0);modelLights=Math.max(modelLights,best[tokens]+enemyLights);
 }
 return {maxOwnedUnits:Math.floor(budget/Math.min(...families.map(model=>config.defences[model].purchaseCost))),maxWaveEnemies:Math.max(...waves.map(wave=>wave.spawns.length)),maxOwnedByFamily,maxWaveEnemiesBySpecies,pooledEnemyCount:Object.values(maxWaveEnemiesBySpecies).reduce((sum,count)=>sum+count,0),modelLights};
}

export function validatePlayConfig(config){
 check(config?.schema==='defender.play-config'&&config.version===PLAY_CONFIG_VERSION,'unsupported schema/version.');
 check(integer(config.startTokens,0,10000)&&integer(config.waveReward,0,10000),'wallet values must be nonnegative whole tokens.');
 check(integer(config.missLimit,1,10000),'missLimit must be a positive whole number.');
 check(Number.isFinite(config.waveSettleSeconds)&&config.waveSettleSeconds>=0&&config.waveSettleSeconds<=30,'waveSettleSeconds must be between0 and30.');
 const availability=(entry,label)=>check(entry.availableFromWave===undefined||integer(entry.availableFromWave,1,64),label+' availability must be a global wave number1–64.');
 check(config.defences&&Object.keys(config.defences).length>0&&config.defences['turret-study']&&Object.keys(config.defences).every(model=>Object.hasOwn(DEFENCE_LABELS,model)),'only existing campaign defence families are supported.');
 for(const [model,family] of Object.entries(config.defences)){
  const enhancer=model==='power-generator',drone=model==='drone-defence';
  check(family.maxOwned===undefined||integer(family.maxOwned,1,128),model+' ownership limit must be a positive whole count.');
  check(integer(family.purchaseCost,1,10000)&&(enhancer||drone?family.upgradeCost===null:integer(family.upgradeCost,1,10000)),model+' costs need positive whole purchase tokens and supported upgrade pricing.');availability(family,model);
  check(enhancer?family.kind==='enhancer':family.kind===undefined||family.kind==='defence',model+' needs its actual family kind.');
  if(enhancer){
   check(Array.isArray(family.enabledVariants)&&family.enabledVariants.length===1&&family.enabledVariants[0]==='base'&&family.variants&&Object.keys(family.variants).length===1&&Object.hasOwn(family.variants,'base'),'Power generator has one non-upgradable base version.');
   const resolved=family.variants.base,stats=resolved?.stats,approved=ENHANCER_STATS[model].base;
   check(resolved&&resolved.firing===null&&stats&&Object.keys(stats).length===Object.keys(approved).length&&Object.keys(approved).every(field=>stats[field]===approved[field]),'Power generator needs its approved +25% strength-only stats and no firing cycle.');
   availability(resolved,model+'/base');check((resolved.availableFromWave??family.availableFromWave??1)>=(family.availableFromWave??1),'base availability must follow its family.');
   continue;
  }
  check(Array.isArray(family.enabledVariants)&&family.enabledVariants.length>0&&family.enabledVariants.length<=VARIANTS.length&&family.enabledVariants.every((variant,i)=>variant===VARIANTS[i]),'enabled tiers must follow base, upgrade1, upgrade2 in order.');
  check(family.variants&&Object.keys(family.variants).every(variant=>VARIANTS.includes(variant)),'tiers must use supported model variants.');
  if(drone)check(family.maxOwned===4&&family.enabledVariants.length===1&&family.enabledVariants[0]==='base'&&Object.keys(family.variants).length===1,'Drone fleet has four base-only pads and no upgrades.');
  let availableAt=family.availableFromWave??1;
  for(const variant of family.enabledVariants){
   const resolved=family.variants[variant],stats=resolved?.stats,firing=resolved?.firing;check(resolved,model+'/'+variant+' needs a resolved profile.');availability(resolved,model+'/'+variant);
   check((resolved.availableFromWave??availableAt)>=availableAt,'upgrade availability must follow its family and previous tier.');availableAt=resolved.availableFromWave??availableAt;
   check(stats&&positive(stats.maxRange)&&positive(stats.strength)&&stats.requiresLineOfSight===(model!=='missile-launcher'),model+'/'+variant+' needs positive range/strength and the actual family LOS policy.');
   if(drone)check(resolved.flightSeconds===DRONE_TUNING.base.flightSeconds&&resolved.rechargeSeconds===DRONE_TUNING.base.rechargeSeconds&&stats.strength===DRONE_TUNING.base.weapon.strength&&stats.maxRange===DRONE_PREVIEW.maxRange,'Drone base retains approved weapon/endurance/recharge and tested range.');
   const cycle=model==='missile-launcher'?firing?.cycle:firing;
   check(cycle&&integer(cycle.shotsPerBurst,1,32)&&Number.isFinite(cycle.shotIntervalSeconds)&&cycle.shotIntervalSeconds>=0&&Number.isFinite(cycle.cooldownSeconds)&&cycle.cooldownSeconds>=PLAY_TIME_RESOLUTION,model+'/'+variant+' needs a finite firing cycle.');
   if(drone)check(Object.keys(DRONE_TUNING.base.weapon).every(key=>cycle[key]===DRONE_TUNING.base.weapon[key]),'Drone base retains its approved firing cycle.');
   check(cycle.shotsPerBurst===1||cycle.shotIntervalSeconds>=PLAY_TIME_RESOLUTION,'burst rounds must be at least one120Hz tick apart.');
   if(model==='missile-launcher')check(integer(firing.magazine,1,2*(VARIANTS.indexOf(variant)+1))&&Number.isFinite(firing.gap)&&firing.gap>=1&&positive(firing.reload)&&cycle.delivery==='projectile'&&positive(cycle.projectile?.speedUnitsPerSecond)&&cycle.cooldownSeconds===firing.gap,'missiles need bounded magazines, a minimum one-second launch gap, separate reload and a physical projectile.');
   else check(cycle.delivery==='hitscan'&&cycle.projectile===null,'guns and Arc use actual hitscan pulses.');
  }
 }
 check(config.enemies&&Object.keys(config.enemies).length>0&&Object.keys(config.enemies).every(model=>Object.hasOwn(ENEMY_LABELS,model)),'only existing campaign enemy species are supported.');
 for(const [model,enemy] of Object.entries(config.enemies)){check(positive(enemy.maxHealth)&&positive(enemy.speed)&&enemy.speed<=SPEED_LIMITS[model]&&positive(enemy.threat)&&integer(enemy.missValue,1,10000),model+' needs positive HP/threat, supported speed and whole miss contribution.');check(enemy.altitude===undefined||AIR_SPECIES.has(model)&&Number.isFinite(enemy.altitude)&&enemy.altitude>=36&&enemy.altitude<=60,'only airborne species may assign a supported flight altitude36–60.');}
 check(Array.isArray(config.levels)&&[4,16].includes(config.levels.length)&&config.levels.every((level,i)=>level?.id===PLAY_LEVEL_IDS[i]),'The campaign must use A1–D4 in order; the preserved four-level A fixture is also supported.');
 const ids=new Set();
 for(const level of config.levels){
  check(level.zone===['A','B','C','D'][Math.floor(PLAY_LEVEL_IDS.indexOf(level.id)/4)]&&Array.isArray(level.waves)&&level.waves.length===4,'each campaign level needs four waves in its authored zone.');
  for(const wave of level.waves){
   check(typeof wave.id==='string'&&/^[a-z0-9][a-z0-9-]*$/.test(wave.id)&&!ids.has(wave.id),'wave IDs must be unique.');ids.add(wave.id);
   if(wave.enemyOverrides!==undefined){
    const overrides=wave.enemyOverrides;check(overrides&&typeof overrides==='object'&&!Array.isArray(overrides)&&Object.keys(overrides).length>0,'wave overrides need species profiles.');
    for(const [model,rule] of Object.entries(overrides)){
     check(config.enemies[model]&&rule&&typeof rule==='object'&&!Array.isArray(rule)&&Object.keys(rule).length>0&&Object.keys(rule).every(key=>key==='maxHealth'||key==='speed'),'wave overrides may assign enabled-species HP/speed only.');
     check((!Object.hasOwn(rule,'maxHealth')||positive(rule.maxHealth))&&(!Object.hasOwn(rule,'speed')||positive(rule.speed)&&rule.speed<=SPEED_LIMITS[model]),'wave overrides need positive HP and supported speed.');
    }
   }
   check(Array.isArray(wave.spawns)&&wave.spawns.length>0&&wave.spawns.length<=32,'a wave needs1–32 finite enemy spawns.');let previous=-Infinity;
   for(const spawn of wave.spawns){
    check(typeof spawn.id==='string'&&/^[a-z0-9][a-z0-9-]*$/.test(spawn.id)&&!ids.has(spawn.id),'spawn IDs must be unique across the run.');ids.add(spawn.id);
    check(config.enemies[spawn.model]&&PLAY_ROUTE_IDS[level.id].includes(spawn.routeId)&&Number.isFinite(spawn.at)&&spawn.at>=0&&spawn.at>=previous&&spawn.at<=600,'spawns need ordered finite times, enabled species and actual level routes.');previous=spawn.at;
   }
  }
 }
 const capacity=playCapacity(config);check(capacity.maxOwnedUnits<=128&&capacity.maxWaveEnemies<=32&&capacity.pooledEnemyCount<=128&&capacity.modelLights<=MAX_PLAY_MODEL_LIGHTS,'the run exceeds bounded player entity/model-light capacity.');return config;
}
function merge(base,override){if(override===undefined)return clone(base);if(!override||typeof override!=='object'||Array.isArray(override))return clone(override);const result=base&&typeof base==='object'&&!Array.isArray(base)?clone(base):{};for(const [key,value]of Object.entries(override))result[key]=merge(result[key],value);return result;}
export function createPlayConfig(overrides={}){return freeze(validatePlayConfig(merge(DEFAULT_CONFIG,overrides)));}
export const PLAY_CONFIG=createPlayConfig();
