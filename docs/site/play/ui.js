import {checkpointDescription,upgradeComparison,waveOutcomeText} from './briefing.js';
import {PORTRAITS} from './portraits.js';
import {RosterGroups} from './roster.js';
import {SOUND_LEVEL_DEFAULT} from './audio-options.js';
// Presentation only: the play session owns state, prices and all actions.
// Buttons expose data-action and optional data-unit for app-level delegation.
const $=id=>document.getElementById(id);
const refs=Object.fromEntries(['hud','title-screen','options-screen','prepare-panel','prepare-heading','prepare-description','shop','wave-preview','unit-list','unit-count','empty-inventory','placement-help','placement-hint','cancel-button','deployment-count','deploy-button','start-wave-button','loadout-button','preparation-note','last-wave-summary','step-loadout','step-deploy','level-label','level-name','tokens','misses','miss-limit','miss-pips','wave-label','wave-pips','pause-button','speed-button','drone-camera-viewfinder','drone-camera-time','drone-camera-label','drone-camera-format','wave-status','wave-status-text','notice','loading','loading-area','board-footer','board-caption','pause-screen','pause-context','result-screen','result-eyebrow','result-heading','result-description','result-waves','result-misses','result-emblem','retry-button','resume-checkpoint-button','result-checkpoint','leave-screen','leave-checkpoint','error-screen','error-description','buy-button'].map(id=>[id,$(id)]));
const rows=new Map(),shopRows=new Map();
const roster=new RosterGroups(refs['unit-list']);
let previewKey='',briefingHover=null,briefingFocus=null,briefingEnabled=false;
let previousPhase=null,previousModal=null,pendingFocus=null,currentActions=new Set(['play']);
const waveActions=['title','pause','speed'];
const phaseActions={title:['play','continue','options'],loadout:['title','buy','upgrade','select','deploy'],deploy:['title','select','undeploy','cancel','loadout','start-wave'],wave:waveActions,settling:waveActions,defeat:['continue','retry','title'],complete:['retry','title']};
const setText=(node,value)=>{const text=String(value??'');if(node.textContent!==text)node.textContent=text;};
const show=(node,visible)=>{if(node.hidden===visible)node.hidden=!visible;};
const count=value=>Number.isFinite(value)?Math.max(0,value):0;
const priceLabel=value=>`${value} token${value===1?'':'s'}`;
const ordinal=value=>String(value).padStart(2,'0');
const unlockLocation=(area,wave,encounter)=>area?`${area}${wave>1?` · WAVE ${wave}`:''}`:`WAVE ${encounter}`;

function createUnitRow(unit){
  const row=document.createElement('div');row.className='unit-row';row.dataset.unit=unit.id;
  const select=document.createElement('button');select.type='button';select.className='unit-select';select.dataset.action='select';select.dataset.unit=unit.id;
  const portrait=document.createElement('img');portrait.className='unit-portrait';portrait.alt='';portrait.setAttribute('aria-hidden','true');
  const number=document.createElement('span');number.className='unit-number';number.setAttribute('aria-hidden','true');
  const info=document.createElement('span');info.className='unit-info';
  const name=document.createElement('span');name.className='unit-name';
  const detail=document.createElement('span');detail.className='unit-detail';info.append(name,detail);
  const indicator=document.createElement('span');indicator.className='unit-indicator';indicator.setAttribute('aria-hidden','true');select.append(number,portrait,info,indicator);
  const operations=document.createElement('div');operations.className='unit-operations';
  const upgrade=document.createElement('button');upgrade.type='button';upgrade.dataset.action='upgrade';upgrade.dataset.unit=unit.id;
  const undeploy=document.createElement('button');undeploy.type='button';undeploy.dataset.action='undeploy';undeploy.dataset.unit=unit.id;undeploy.textContent='Recall';operations.append(upgrade,undeploy);row.append(select,operations);
  const briefing=document.createElement('div');briefing.className='upgrade-briefing';briefing.id='upgrade-briefing-'+unit.id;briefing.hidden=true;briefing.setAttribute('role','tooltip');upgrade.setAttribute('aria-describedby',briefing.id);document.body.append(briefing);
  return {row,select,portrait,number,name,detail,operations,upgrade,undeploy,briefing};
}

function updateInventory(snapshot,locked){
  const units=snapshot.units??[],live=new Set(),loadout=snapshot.phase==='loadout',deploy=snapshot.phase==='deploy';
  for(let index=0;index<units.length;index++){
    const unit=units[index];live.add(unit.id);let entry=rows.get(unit.id);
    if(!entry){entry=createUnitRow(unit);rows.set(unit.id,entry);}
    const enhancer=unit.kind==='enhancer',tier=enhancer?'Enhancer':{base:'Base',upgrade1:'Upgrade I',upgrade2:'Upgrade II'}[unit.variant]??unit.variant,selected=unit.id===snapshot.selectedId,hasUpgrade=!enhancer&&Boolean(unit.nextVariant);
    entry.row.classList.toggle('selected',selected);entry.row.classList.toggle('deployed',Boolean(unit.deployed));
    const portrait=PORTRAITS[(unit.model??'turret-study')+'-'+unit.variant];if(entry.portrait.getAttribute('src')!==portrait)entry.portrait.src=portrait;
    setText(entry.number,ordinal(index+1));setText(entry.name,unit.label||`Gun ${ordinal(index+1)}`);
    const stats=enhancer?`+${Math.round(unit.stats.strengthIncrease*100)}% strength · 4 neighbours`:unit.stats?`DMG ${unit.stats.strength} / RNG ${unit.stats.maxRange}${unit.strengthIncrease?' · BOOSTED':''}`:'';
    setText(entry.detail,`${tier} / ${unit.deployed?'Deployed':'Reserve'}${stats?' · '+stats:''}`);
    entry.select.disabled=locked||(!loadout&&!deploy);entry.select.setAttribute('aria-pressed',String(selected));
    entry.select.setAttribute('aria-label',`${unit.label||`Gun ${index+1}`}, ${tier}, ${unit.deployed?'deployed':'in inventory'}. Select ${enhancer?'enhancer':'defence'}.`);
    show(entry.upgrade,loadout&&hasUpgrade);entry.upgrade.disabled=locked||!loadout||!unit.canUpgrade;setText(entry.upgrade,unit.upgradeAvailableFromWave>(snapshot.encounterNumber??1)?`Upgrade ${unit.nextVariant==='upgrade2'?'II':'I'} · ${unlockLocation(unit.upgradeAvailableArea,unit.upgradeAvailableWave,unit.upgradeAvailableFromWave)}`:`UPGRADE ${unit.nextVariant==='upgrade2'?'II':'I'} · ${priceLabel(unit.upgradeCost??snapshot.costs?.upgrade??1)}`);
    show(entry.undeploy,deploy&&Boolean(unit.deployed));entry.undeploy.disabled=locked||!deploy||!unit.deployed;
    show(entry.operations,(loadout&&hasUpgrade)||(deploy&&Boolean(unit.deployed)));
    const comparison=hasUpgrade&&!entry.upgrade.disabled?upgradeComparison(unit):null,key=JSON.stringify(comparison);
    entry.hasComparison=Boolean(comparison);
    if(entry.briefing.dataset.key!==key){entry.briefing.dataset.key=key;entry.briefing.replaceChildren();if(comparison){
     const title=document.createElement('h4');title.textContent=`UPGRADE ${unit.nextVariant==='upgrade2'?'II':'I'} · CURRENT → NEXT`;
     const list=document.createElement('dl');for(const[label,value]of comparison.rows){const name=document.createElement('dt'),detail=document.createElement('dd');name.textContent=label;detail.textContent=value;list.append(name,detail);}
     const note=document.createElement('p');note.textContent=comparison.note;entry.briefing.append(title,list,note);
    }}
  }
  for(const[id,entry]of rows)if(!live.has(id)){entry.row.remove();entry.briefing.remove();rows.delete(id);}
  roster.sync(units,rows);
  briefingEnabled=loadout&&!locked&&!snapshot.leaveOpen;
  setText(refs['unit-count'],ordinal(units.length));show(refs['empty-inventory'],units.length===0);
  return units;
}

// Inspect an available upgrade on hover/focus; selection never pins its tooltip.
// Keep comparisons outside the clipped roster without changing its row heights.
function positionBriefing(){
 const inspected=briefingEnabled?rows.get(briefingHover??briefingFocus):null;
 for(const entry of rows.values())show(entry.briefing,entry===inspected&&entry.hasComparison);
 if(!inspected?.hasComparison)return;
 const rect=inspected.row.getBoundingClientRect(),panel=refs['unit-list'].closest('.prepare-scroll')??refs['prepare-panel'],clip=panel.getBoundingClientRect();
 if(rect.bottom<=clip.top||rect.top>=clip.bottom||inspected.row.closest('[hidden],[inert]')){show(inspected.briefing,false);return;}
 const tooltip=inspected.briefing,box=tooltip.getBoundingClientRect();
 tooltip.style.left=Math.max(8,rect.left-box.width-12)+'px';
 tooltip.style.top=Math.max(8,Math.min(innerHeight-box.height-8,rect.top))+'px';
}

function focusable(root){return [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(node=>!node.closest('[hidden]'));}

function updateShop(snapshot,locked){
 const catalogue=snapshot.shop??[{model:'turret-study',name:'Twin-barrel gun',cost:snapshot.costs?.buy??1,available:true}];
 for(const item of catalogue){
  let entry=shopRows.get(item.model);
  if(!entry){
   const row=document.createElement('div');row.className='shop-item';row.dataset.model=item.model;
   const icon=document.createElement('img');icon.className='weapon-portrait';icon.alt='';icon.setAttribute('aria-hidden','true');icon.src=PORTRAITS[item.model+'-base'];
   const info=document.createElement('div');info.className='shop-description';const name=document.createElement('h3'),detail=document.createElement('p');info.append(name,detail);
   const button=document.createElement('button');button.type='button';button.className='small primary';button.dataset.action='buy';button.dataset.model=item.model;
   if(item.model==='turret-study'){button.id='buy-button';refs['buy-button']=button;}
   row.append(icon,info,button);refs.shop.append(row);entry={row,name,detail,button};shopRows.set(item.model,entry);
  }
  setText(entry.name,item.model==='turret-study'?'Twin-barrel gun':item.name);
  const unlock=unlockLocation(item.availableArea,item.availableWave,item.availableFromWave);
  setText(entry.detail,item.available?(item.kind==='enhancer'?`+${Math.round(item.stats.strengthIncrease*100)}% strength / 4 neighbours`:item.stats?`DMG ${item.stats.strength} / RNG ${item.stats.maxRange}`:'Base defence'):`UNLOCK / ${unlock}`);
  entry.button.disabled=locked||snapshot.phase!=='loadout'||!item.available||snapshot.tokens<item.cost;
  entry.button.setAttribute('aria-label',item.available?`Buy ${item.name} for ${priceLabel(item.cost)}`:`${item.name}, available at ${item.availableArea?'Area ':''}${unlock}`);
  setText(entry.button,item.available?`BUILD · ${item.cost}`:'LOCKED');entry.row.classList.toggle('locked',!item.available);
 }
 const label=document.querySelector('.catalogue-label');if(label)show(label,snapshot.phase==='loadout');
}

function updateWavePreview(snapshot){
 const preview=snapshot.wavePreview;if(!preview||!refs['wave-preview'])return;
 const key=JSON.stringify(preview);if(key===previewKey)return;previewKey=key;
 const label=document.createElement('span');label.className='intel-label';label.textContent='INCOMING';
 const heading=document.createElement('h3');heading.textContent=`${ordinal(snapshot.waveNumber??1)} / ${preview.name}`;
 const groups=document.createElement('div');groups.className='enemy-lineup';const lineup=new Map();
 const intel=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');body.className='intel-body';summary.textContent='Wave intel';intel.append(summary,body);
 if(preview.description){const p=document.createElement('p');p.textContent=preview.description;body.append(p);}
 for(const group of preview.groups){
  let chip=lineup.get(group.model);
  if(!chip){const row=document.createElement('div');row.className='enemy-chip';const icon=document.createElement('img');icon.src=PORTRAITS[group.model+'-base'];icon.alt='';icon.setAttribute('aria-hidden','true');const name=document.createElement('span');row.append(icon,name);groups.append(row);chip={name,count:0};lineup.set(group.model,chip);}
  chip.count+=group.count;chip.name.textContent=`${chip.count} ${group.name}${chip.count===1?'':'s'}`;
  const detail=document.createElement('p');detail.className='enemy-preview';const title=document.createElement('strong');title.textContent=`${group.count} ${group.name}${group.count===1?'':'s'}`;
  const text=document.createElement('span');text.textContent=`${group.maxHealth} HP / ${group.speed} speed / ${group.routeId==='eastern'?'Eastern approach':group.routeId==='northern'?'Northern approach':group.routeId==='main'?(preview.groups.some(g=>g.routeId==='eastern')?'Western approach':'Main approach'):'Approach '+group.routeId}${group.altitude!==undefined?' / Air '+group.altitude+' high':''} / ${Number(group.firstAt.toFixed(1))}–${Number(group.lastAt.toFixed(1))}s`;
  detail.append(title,text);body.append(detail);
 }
 refs['wave-preview'].replaceChildren(label,heading,groups,intel);
}

/** Update persistent UI from a session snapshot; call only when visible state changes. */
export function renderUI(snapshot={}){
  const phase=snapshot.phase??'title',busy=Boolean(snapshot.busy),error=Boolean(snapshot.error),activeWave=phase==='wave'||phase==='settling',settling=phase==='settling',paused=Boolean(snapshot.paused)&&activeWave;
  const screenshot=paused&&Boolean(snapshot.screenshotMode);
  const prep=phase==='loadout'||phase==='deploy',result=phase==='defeat'||phase==='complete',locked=busy||paused||error;
  const active=document.activeElement,oldAction=active?.dataset?.action,oldUnit=active?.dataset?.unit,oldGraphics=active?.dataset?.graphics,canvasActive=active===$('world');
  if(canvasActive&&!busy)pendingFocus=null;
  if(busy&&(oldAction||oldGraphics))pendingFocus={action:oldAction,unit:oldUnit,graphics:oldGraphics};
  document.body.dataset.phase=phase;document.body.dataset.paused=String(paused);document.body.dataset.screenshot=String(screenshot);$('play-shell').setAttribute('aria-busy',String(busy));
  const droneActive=Boolean(snapshot.droneCameraActive),droneEnabled=Boolean(snapshot.droneCameraEnabled),filming=droneActive&&!screenshot;
  const canvasLabel=screenshot?'Paused screenshot camera. W/S move forward/backward, A/D strafe, drag to rotate. Backspace restores the paused view.':droneActive?'Flying drone action camera. Hold either mouse button and drag to target the centre reticle. W moves the target forward in the current view, S backward. A orbits clockwise, D counter-clockwise, viewed from above. Release the keys to resume automatic orbit. The drone orbits the board position under the reticle.':phase==='title'?'Fixed scenery view of woodland ruins, trees and limestone paths.':phase==='deploy'?'Defence placement board. Select a defence, then click clear ground or use arrow keys to choose a square and Enter to place. Escape cancels placement.':'Defence landscape. Camera framing is automatic.';
  if($('world').getAttribute('aria-label')!==canvasLabel)$('world').setAttribute('aria-label',canvasLabel);
  show(refs['title-screen'],phase==='title');show(refs.hud,phase!=='title');show(refs['prepare-panel'],prep);show(refs['wave-preview'],prep);show(refs['board-footer'],phase!=='title');
  show(refs['options-screen'],phase==='title'&&snapshot.optionsOpen&&!error);
  show(refs['leave-screen'],Boolean(snapshot.leaveOpen)&&!error);setText(refs['leave-checkpoint'],checkpointDescription(snapshot.savedGame,snapshot.savingProgress));
  show(refs['pause-screen'],paused&&!screenshot&&!error&&!snapshot.leaveOpen);show(refs['result-screen'],result&&!error&&!snapshot.leaveOpen);show(refs['error-screen'],error);show(refs.loading,busy&&!error&&!(snapshot.loadingTitle??phase==='title'));
  if(busy)setText(refs['loading-area'],`AREA ${snapshot.loadingArea??((snapshot.zone??'A')+(snapshot.levelNumber??1))}`);
  const modal=error?refs['error-screen']:snapshot.leaveOpen?refs['leave-screen']:phase==='title'&&snapshot.optionsOpen?refs['options-screen']:paused&&!screenshot?refs['pause-screen']:result?refs['result-screen']:null;
  currentActions=new Set(screenshot?[]:error?['retry-load','title']:busy?[]:modal===refs['leave-screen']?['cancel-leave','confirm-title']:modal===refs['options-screen']?['close-options']:paused?['resume','title']:(phaseActions[phase]??[]));
  if(!snapshot.savedGame||snapshot.savingProgress)currentActions.delete('continue');
  show($('continue-button'),Boolean(snapshot.savedGame));
  setText($('continue-button'),`CONTINUE · ${snapshot.savedGame?.area??''}`);
  $('new-game-button').classList.toggle('has-checkpoint',Boolean(snapshot.savedGame));
  setText($('save-status'),snapshot.saveError||(snapshot.savingProgress?'Saving progress…':snapshot.savedGame?`Checkpoint: Area ${snapshot.savedGame.area} · ${snapshot.savedGame.completedWaves} waves cleared. New Game clears this checkpoint.`:'Progress saves after each level on this device.'));
  for(const node of [refs['title-screen'],refs.hud,refs['prepare-panel'],refs['wave-preview']])node.inert=Boolean(modal)||busy||screenshot;
  $('scene').inert=Boolean(modal)||busy;
  for(const button of document.querySelectorAll('button[data-action]'))button.disabled=!currentActions.has(button.dataset.action);
  // Audio controls remain unavailable during sound development.
  const soundLevel=$('sound-level'),volume=Math.round((snapshot.soundLevel??SOUND_LEVEL_DEFAULT)*100);soundLevel.value=String(volume);soundLevel.disabled=true;
  soundLevel.setAttribute('aria-valuetext',volume+'%');setText($('sound-level-value'),volume+'%');
  for(const input of document.querySelectorAll('input[data-graphics]')){input.checked=snapshot.graphics?.[input.dataset.graphics]!==false;input.disabled=busy||error||phase!=='title';}

  const wave=Math.max(1,snapshot.waveNumber??1),waves=Math.max(1,snapshot.wavesPerLevel??4),tokens=count(snapshot.tokens),misses=count(snapshot.misses),limit=snapshot.missLimit??10;
  setText(refs['level-label'],`AREA ${snapshot.zone??'A'}${snapshot.levelNumber??1} / ${snapshot.zoneName??'Moss & Porcelain'}`);setText(refs['level-name'],snapshot.levelName??'Limestone Orchard');
  setText(refs.tokens,tokens);setText(refs.misses,misses);setText(refs['miss-limit'],limit);
  setText($('title-areas'),ordinal(Math.ceil((snapshot.totalWaves??64)/waves)));setText($('title-waves'),snapshot.totalWaves??64);setText($('title-misses'),limit);
  const missPips=refs['miss-pips'];if(missPips){const n=Math.min(30,limit);while(missPips.children.length<n)missPips.append(document.createElement('i'));while(missPips.children.length>n)missPips.lastElementChild.remove();for(let i=0;i<n;i++)missPips.children[i].classList.toggle('used',i<Math.ceil(misses*n/limit));document.body.dataset.missDanger=String(misses>=limit*.7);}
  const waveNode=refs['wave-label'];if(waveNode.dataset.value!==`${wave}/${waves}`){waveNode.replaceChildren(document.createTextNode(`${wave} `));const tail=document.createElement('span');tail.className='stat-limit';tail.textContent=`/ ${waves}`;waveNode.append(tail);waveNode.dataset.value=`${wave}/${waves}`;}
  while(refs['wave-pips'].children.length<waves)refs['wave-pips'].append(document.createElement('i'));
  while(refs['wave-pips'].children.length>waves)refs['wave-pips'].lastElementChild.remove();
  for(let index=0;index<waves;index++){const pip=refs['wave-pips'].children[index];pip.classList.toggle('current',index===wave-1);pip.classList.toggle('done',index<wave-1);}
  show(refs['speed-button'],activeWave);refs['speed-button'].disabled=locked||!activeWave;
  const fast=snapshot.targetTimeScale===2,speedAction=fast?'Return to normal speed':'Double game speed';refs['speed-button'].setAttribute('aria-pressed',String(fast));refs['speed-button'].title=speedAction+' (T)';refs['speed-button'].setAttribute('aria-label',speedAction);
  show(refs['pause-button'],activeWave);refs['pause-button'].disabled=locked||!activeWave;
  document.body.dataset.droneCamera=String(filming);document.body.dataset.cameraView=droneActive?'drone':'overview';
  show(refs['drone-camera-viewfinder'],filming);setText(refs['drone-camera-label'],'DRONE CAM');setText(refs['drone-camera-format'],'Click and drag to control the drone.\nW/S: forward/backward\nA: clockwise · D: counter-clockwise\nRelease keys for automatic orbit.');
  show(refs['drone-camera-format'],filming&&phase==='wave'&&!paused&&!busy&&!error&&!snapshot.leaveOpen&&!snapshot.droneCameraHintDismissed);
  const recorded=Math.floor(snapshot.droneCameraTime??0);setText(refs['drone-camera-time'],`${String(Math.floor(recorded/60)).padStart(2,'0')}:${String(recorded%60).padStart(2,'0')}`);
  setText(refs['pause-context'],settling?'Post-wave effects paused.':'Wave paused.');
  updateShop(snapshot,locked);updateWavePreview(snapshot);
  const units=updateInventory({...snapshot,phase,tokens},locked);
  const deploying=phase==='deploy',deployed=units.filter(unit=>unit.deployed).length;
  setText(refs['prepare-heading'],deploying?'DEPLOYMENT':'ARSENAL');setText(refs['prepare-description'],deploying?'Place your defences beside the path. Reposition them freely before the wave.':'Build defences. Upgrade your firepower.');
  refs['step-loadout'].classList.toggle('current',!deploying);refs['step-deploy'].classList.toggle('current',deploying);
  show(refs.shop,!deploying);show(refs['placement-help'],deploying);show(refs['cancel-button'],deploying&&Boolean(snapshot.selectedId));
  setText(refs['placement-hint'],snapshot.placementHint??(snapshot.selectedId?'Choose clear ground to place this defence.':'Select a defence, then choose clear ground.'));
  show(refs['deployment-count'],deploying);setText(refs['deployment-count'],`${deployed} of ${units.length} defence${units.length===1?'':'s'} deployed`);
  show(refs['deploy-button'],!deploying);show(refs['start-wave-button'],deploying);show(refs['loadout-button'],deploying);setText(refs['start-wave-button'],`START WAVE ${wave} ▶`);
  show(refs['last-wave-summary'],prep&&Boolean(snapshot.lastWaveResult));setText(refs['last-wave-summary'],waveOutcomeText(snapshot.lastWaveResult));
  setText(refs['preparation-note'],snapshot.saveError|| (deploying?(deployed?'You can keep other defences in inventory.':'Place at least one defence to start the wave.'):'Unspent tokens carry forward.'));
  for(const id of ['deploy-button','start-wave-button','loadout-button','cancel-button'])refs[id].disabled=locked||!currentActions.has(refs[id].dataset.action);
  refs['start-wave-button'].disabled ||= deployed===0;
  show(refs['wave-status'],activeWave&&!paused);const remaining=count(snapshot.enemiesRemaining),spawned=count(snapshot.spawned),total=count(snapshot.totalEnemies);
  setText(refs['wave-status-text'],settling?'Wave complete · Clearing the field…':total?`${remaining} on the path · ${Math.min(spawned,total)} of ${total} arrived`:'Wave in progress');
  show(refs.notice,Boolean(snapshot.notice)&&!error&&!result);setText(refs.notice,snapshot.notice??'');
  setText(refs['board-caption'],filming?'Drone-cam active.':prep&&droneEnabled?'Drone armed for the next wave.':activeWave?'Wave in progress.':result?(phase==='complete'?'Run complete.':'Run ended.'):deploying?'Select a defence, then click clear ground to place it.':'Build, upgrade, then deploy.');

  if(result){
    show(refs['result-checkpoint'],phase==='defeat'||Boolean(snapshot.saveError));setText(refs['result-checkpoint'],snapshot.saveError||checkpointDescription(snapshot.savedGame,snapshot.savingProgress));
    show(refs['resume-checkpoint-button'],phase==='defeat'&&Boolean(snapshot.savedGame));setText(refs['resume-checkpoint-button'],`RESUME CHECKPOINT · ${snapshot.savedGame?.area??''}`);
    const complete=phase==='complete',completed=snapshot.completedWaves??(complete?snapshot.totalWaves??64:Math.max(0,((snapshot.levelNumber??1)-1)*waves+wave-1));
    refs['result-screen'].querySelector('.result-dialog').dataset.result=phase;
    setText(refs['result-eyebrow'],complete?'CAMPAIGN COMPLETE':'GAME OVER');setText(refs['result-heading'],complete?'ALL ZONES SECURED':'LINE BREACHED');
    refs['retry-button'].classList.toggle('primary',complete||!snapshot.savedGame);refs['retry-button'].classList.toggle('text-button',!complete&&Boolean(snapshot.savedGame));
    setText(refs['result-description'],complete?`All ${snapshot.totalLevels??16} landscapes held across Zones A–D. Your ${snapshot.totalWaves??64}-wave run is complete.`:`${misses} enemies reached the exit. ${snapshot.savedGame?'Resume your checkpoint or restart the campaign from Area A1.':'Restart the campaign from Area A1 and try another arrangement.'}`);
    setText(refs['result-waves'],completed);setText(refs['result-misses'],`${misses} / ${limit}`);setText(refs['retry-button'],complete?'NEW GAME':'RESTART CAMPAIGN');setText(refs['result-emblem'],complete?'✓':'×');
  }
  if(error)setText(refs['error-description'],typeof snapshot.error==='string'?snapshot.error:snapshot.error.message??'The landscape could not be loaded. Please try again.');

  // Stable controls retain focus. If a state change hides/removes that control,
  // move to an actionable control in the new surface rather than losing focus.
  const hiddenActive=active?.closest?.('[hidden]')||active?.disabled||!active?.isConnected;
  if((modal&&modal!==previousModal)||(!canvasActive&&(hiddenActive||previousPhase===null||(!busy&&pendingFocus)))){
    let target;
    if(modal){const controls=focusable(modal);target=(pendingFocus?.graphics&&controls.find(node=>node.dataset.graphics===pendingFocus.graphics))||controls[0];}
    else if(previousModal===refs['options-screen'])target=$('options-button');
    else{
      const identity=!busy&&pendingFocus?pendingFocus:{action:oldAction,unit:oldUnit};
      if(identity.action)target=[...document.querySelectorAll('[data-action]')].find(node=>node.dataset.action===identity.action&&node.dataset.unit===identity.unit&&!node.disabled&&!node.closest('[hidden]'));
      if(!target&&identity.unit){const select=rows.get(identity.unit)?.select;if(select&&!select.disabled&&!select.closest('[hidden]'))target=select;}
    }
    if(!target)target=phase==='title'?$(snapshot.savedGame&&!snapshot.savingProgress?'continue-button':'new-game-button'):deploying?(refs['start-wave-button'].disabled?refs['loadout-button']:refs['start-wave-button']):prep?(refs['buy-button'].disabled?refs['deploy-button']:refs['buy-button']):refs['pause-button'];
    if(target&&!target.disabled&&!target.closest('[hidden]'))target.focus({preventScroll:true});
    if(!busy)pendingFocus=null;
  }
  previousPhase=phase;previousModal=modal;positionBriefing();
}

// Keep app-level delegated actions inside the visible, unlocked UI surface.
// Session validation remains authoritative; this guard blocks stale/background
// keyboard or pointer activations before document-level action delegation.
document.addEventListener('click',event=>{
  const button=event.target?.closest?.('button[data-action]');
  if(!button)return;
  if(button.disabled||!currentActions.has(button.dataset.action)||button.closest('[hidden],[inert]')||(previousModal&&!previousModal.contains(button))){event.preventDefault();event.stopImmediatePropagation();return;}
  if(button.dataset.action==='select'){briefingHover=briefingFocus=null;positionBriefing();}
},true);

// Native buttons provide activation semantics. Only modal Tab containment
// belongs here; app.js owns P/Escape and all gameplay/camera keyboard handling.
document.addEventListener('keydown',event=>{
  if(!previousModal||event.key!=='Tab')return;
  event.stopImmediatePropagation();
  const controls=focusable(previousModal);if(!controls.length)return;
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&(document.activeElement===first||!previousModal.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!previousModal.contains(document.activeElement))){event.preventDefault();first.focus();}
},true);

refs['unit-list'].addEventListener('pointerover',event=>{briefingHover=event.target.closest?.('button[data-action="upgrade"]')?.dataset.unit??null;positionBriefing();});
refs['unit-list'].addEventListener('pointerout',event=>{briefingHover=event.relatedTarget?.closest?.('button[data-action="upgrade"]')?.dataset.unit??null;positionBriefing();});
refs['unit-list'].addEventListener('focusin',event=>{briefingFocus=event.target.closest?.('button[data-action="upgrade"]')?.dataset.unit??null;positionBriefing();});
refs['unit-list'].addEventListener('focusout',event=>{briefingFocus=event.relatedTarget?.closest?.('button[data-action="upgrade"]')?.dataset.unit??null;positionBriefing();});
document.addEventListener('scroll',positionBriefing,true);
window.addEventListener('resize',positionBriefing);
