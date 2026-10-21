// Restore only the exact pre-fix Arc module in memory for paired evidence.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const source=await Bun.file(new URL('../../game/arc-spire-preview.js',import.meta.url)).text();
const previous=source
 .replace('// Active target arrays compact on death/escape. Keep retries on the enemy\n   // identity so another enemy cannot inherit its temporary surface rejection.','// Fixed roster slots prevent a centre-visible but surface-blocked enemy\n   // from starving alternatives. Retry soon as it moves around the obstacle.')
 .replace('state.surfaceRetryAt=new WeakMap();','state.surfaceRetryAt=new Float64Array(targets.length);')
 .replace('if(state.cycle.time<(state.surfaceRetryAt.get(target)??0))return false;','const index=this.targets.indexOf(target);if(index>=0&&state.cycle.time<state.surfaceRetryAt[index])return false;')
 .replace('state.surfaceRetryAt.set(target,now+SURFACE_RETRY_SECONDS);','const index=this.targets.indexOf(target);if(index>=0)state.surfaceRetryAt[index]=now+SURFACE_RETRY_SECONDS;')
 .replace('state.surfaceRetryAt=new WeakMap();','state.surfaceRetryAt.fill(0);');
const report=await Bun.file(new URL('../balance-review-2026-10-21/arc-heavy.json',import.meta.url)).json();
const hash=createHash('sha256').update(previous).digest('hex');
assert.equal(hash,report.sourceHashes['game/arc-spire-preview.js'],'Reconstructed module must match the audited pre-fix source exactly');
globalThis.defenderArcBaselineHash=hash;
console.log('Verified pre-fix Arc SHA-256:',hash);
Bun.plugin({name:'pre-fix-arc-retry',setup(build){build.onLoad({filter:/\/game\/arc-spire-preview\.js$/},()=>({contents:previous,loader:'js'}));}});
