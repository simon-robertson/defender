import {ZONE_PREVIEWS} from './zone-style.js';

// Development views only. Their numbers do not define campaign progression.
const levelIds={A:['moss-01','moss-02','moss-03','moss-04'],B:['ochre-01','ochre-02','ochre-03','ochre-04'],C:['ice-01','ice-02','ice-03','ice-04'],D:['plum-01','plum-02','plum-03','plum-04']};
export const PREVIEW_LEVELS=Object.freeze(ZONE_PREVIEWS.flatMap(profile=>levelIds[profile.zone].map((level,index)=>Object.freeze({
 ...profile,level,number:index+1,
 description:(profile.zone==='A'&&index===0?'Drone combat preview':'Path layout preview')+' · '+profile.name+' · 480 × 384 units.',
 previewMode:profile.zone==='A'&&index===0?'combat':'layout',
 missiles:index>=2,
}))));
export const previewLevelForId=id=>PREVIEW_LEVELS.find(profile=>profile.level===id);
export const previewLevelsForZone=zone=>PREVIEW_LEVELS.filter(profile=>profile.zone===zone);

// Requested selection survives failed loads and changes immediately while an
// older request is pending. SceneLoader independently owns the actual scene.
export class PreviewSelection {
 constructor(catalogue=PREVIEW_LEVELS){this.catalogue=catalogue;this.profile=catalogue[0];}
 selectZone(zone){
  const available=this.catalogue.filter(profile=>profile.zone===zone);
  if(!available.length)return null;
  let next=available[0];
  for(const profile of available)if(profile.number<=this.profile.number&&profile.number>next.number)next=profile;
  this.profile=next;return next;
 }
 selectLevel(number){
  const next=this.catalogue.find(profile=>profile.zone===this.profile.zone&&profile.number===number);
  if(!next)return null;this.profile=next;return next;
 }
}

export function previewShortcut(event){
 if(event.repeat||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName))return null;
 if(event.shiftKey){
  // Shift+2 is usually '@' or '"'. Physical digit codes keep that shortcut
  // independent of the keyboard layout's shifted punctuation.
  const digit=/^Digit([1-9])$/.exec(event.code??'');
  const number=digit?Number(digit[1]):!event.code&&/^[1-9]$/.test(event.key)?Number(event.key):null;
  return number===null?null:{kind:'level',number};
 }
 const profile=ZONE_PREVIEWS.find(profile=>profile.key===event.key);
 return profile?{kind:'zone',zone:profile.zone}:null;
}
