// Read-only project/tool inventory and arithmetic. No playback, synthesis or encoding.
import {PLAY_CONFIG,playCapacity} from '../../../play/config.js';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const c=PLAY_CONFIG,waves=c.levels.reduce((n,l)=>n+l.waves.length,0),budget=c.startTokens+c.waveReward*(waves-1),gun=c.defences['turret-study'];
const files=['play/app.js','play/engine.js','play/config.js','engine/weapon.js','server.js','server/docs.js','scripts/deployment/build.js','scripts/deployment/serve.js','package.json'];
const hashes={};for(const file of files)hashes[file]=createHash('sha256').update(await readFile(new URL('../../../'+file,import.meta.url))).digest('hex');
const tools={};for(const name of ['bun','brew','opusenc','opusdec','opusinfo','ffmpeg','ffprobe','oggenc','sox','afconvert'])tools[name]=Bun.which(name);
const ceilings=gun.enabledVariants.map((variant,index)=>{const rule=gun.variants[variant].firing,cost=gun.purchaseCost+index*gun.upgradeCost,count=Math.floor(budget/cost),period=rule.cooldownSeconds+(rule.shotsPerBurst-1)*rule.shotIntervalSeconds;return {variant,cost,count,shotsPerBurst:rule.shotsPerBurst,periodSeconds:period,idealShotsPerSecond:count*rule.shotsPerBurst/period};});
if(budget!==playCapacity(c).maxOwnedUnits*gun.purchaseCost)throw new Error('Revisit economy interpretation before reusing this arithmetic.');
console.log(JSON.stringify({date:'2026-10-22',scope:'Read-only inventory/arithmetic; economic ceilings are not measured battle event rates.',platform:process.platform,architecture:process.arch,tools,waves,budget,capacity:playCapacity(c),gunCeilings:ceilings,illustrativeMemory:{halfSecondMono48kFloatPCM:0.5*48000*4,tenSecondsStereo48kFloatPCM:10*48000*2*4,twentyHalfSecondMonoClipsAndTwoTenSecondStereoLoops:20*.5*48000*4+2*10*48000*2*4,proposedEventRing256x8Float64:256*8*8},sourceHashes:hashes},null,2));
