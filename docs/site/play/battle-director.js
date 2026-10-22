// Editorial decisions are separate from navigation and camera motion.
// Learned from the player's camera study: fights in front, arrivals behind,
// broad calm/multiple-front views, occasional low shots, and exit pressure.
const EMPTY=Object.freeze([]),MAX_SUBJECTS=256,MAX_AREAS=32,AREA_RADIUS=88;
export const battleAlive=s=>s?.phase==='active'&&s.health?.alive!==false;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class BattleDirector {
 constructor(){
  this.events=new Float64Array(32*5);this.subjects=Array.from({length:MAX_SUBJECTS},()=>({x:0,y:0,z:0,weight:0,kind:0,state:null,area:-1}));
  this.areas=Array.from({length:MAX_AREAS},()=>({x:0,y:0,z:0,weight:0,action:0,danger:0,count:0,enemy:null}));
  this.intent={anchor:new Float64Array(3),focus:new Float64Array(3),kind:'survey',style:'survey',version:0,subject:null,area:-1,radius:0,weight:0,action:0,danger:0,busyAreas:0,reason:'opening'};this.reset();
 }
 reset(){for(const p of this.subjects)p.state=null;for(const a of this.areas)a.enemy=null;this.events.fill(0);this.count=this.areaCount=0;this.nextScan=-Infinity;this.exposure=0;this.since=-Infinity;this.challengeSince=0;this.challengeX=this.challengeZ=Infinity;this.shotIndex=0;this.intent.version=0;this.intent.kind=this.intent.style='survey';this.intent.area=-1;this.intent.subject=null;this.intent.weight=this.intent.action=this.intent.danger=this.intent.busyAreas=0;}
 note(x,y,z,at,weight=1){
  if(![x,y,z,at,weight].every(Number.isFinite)||weight<=0)return;
  let slot=0;for(let k=0;k<this.events.length;k+=5){if(this.events[k+3]&&at-this.events[k+4]<3&&Math.hypot(this.events[k]-x,this.events[k+2]-z)<36){slot=k;break;}if(this.events[k+4]<this.events[slot+4]||!this.events[k+3])slot=k;}
  const a=this.events,old=a[slot+3]*Math.exp(-Math.max(0,at-a[slot+4])/1.2),sum=old+weight;
  a[slot]=(a[slot]*old+x*weight)/sum;a[slot+1]=(a[slot+1]*old+y*weight)/sum;a[slot+2]=(a[slot+2]*old+z*weight)/sum;a[slot+3]=Math.min(12,sum);a[slot+4]=at;
 }
 activity(x,z,now){let value=0;for(let k=0;k<this.events.length;k+=5){const age=now-this.events[k+4],d=Math.hypot(this.events[k]-x,this.events[k+2]-z);if(age>=0&&age<3&&d<72)value+=this.events[k+3]*Math.exp(-age/1.2)*(1-d/72);}return Math.min(8,value);}
 add(state,kind,weight,x,y,z){if(this.count===MAX_SUBJECTS)return null;const p=this.subjects[this.count++];Object.assign(p,{state,kind,weight,x,y,z,area:-1});return p;}
 scan(engine,world){
  this.count=this.areaCount=0;const guns=engine.firing?.states??EMPTY,targets=engine.enemies?.activeTargets??EMPTY,now=engine.time,ground=world.level.pathHeight;
  for(const s of targets){
   if(!battleAlive(s))continue;let engagement=0;
   for(const gun of guns)if(gun.target===s&&gun.lineOfSight){const at=gun.lastShotAt??gun.cycle?.lastShotAt,time=gun.cycle?.time??now;engagement+=Number.isFinite(at)&&time-at<1.4?3:1.2;}
   const remaining=Math.max(0,(s.path?.length??Infinity)-(s.distance??0)),seconds=remaining/(s.movement?.speed??12),danger=clamp((7-seconds)/7,0,1)*clamp(((s.distance??0)/(s.path?.length??Infinity)-.65)/.2,0,1),action=this.activity(s.x,s.z,now)+engagement;
   const p=this.add(s,0,.2+Math.min(10,action)+danger*22,s.aimX??s.x,s.aimY??s.y??ground+12,s.aimZ??s.z);if(!p)break;
   let at=-1,distance=AREA_RADIUS;
   for(let i=0;i<this.areaCount;i++){const a=this.areas[i],d=Math.hypot(p.x-a.x,p.z-a.z);if(d<distance){distance=d;at=i;}}
   if(at<0){if(this.areaCount===MAX_AREAS)continue;at=this.areaCount++;Object.assign(this.areas[at],{x:p.x,y:p.y,z:p.z,weight:0,action:0,danger:0,count:0,topWeight:0,enemy:s});}
   const a=this.areas[at],total=a.weight+p.weight;a.x=(a.x*a.weight+p.x*p.weight)/total;a.y=(a.y*a.weight+p.y*p.weight)/total;a.z=(a.z*a.weight+p.z*p.weight)/total;a.weight=total;a.action+=action;a.danger=Math.max(a.danger,danger);a.count++;p.area=at;
   if(p.weight>a.topWeight){a.enemy=s;a.topWeight=p.weight;}
  }
  // Include only participating weapons in action framing. Idle structures are
  // establishing context, never a substitute for a living battle elsewhere.
  for(const gun of guns){
   if(!battleAlive(gun.target)||!gun.lineOfSight)continue;
   const target=this.subjects.find((p,i)=>i<this.count&&p.kind===0&&p.state===gun.target);if(!target)continue;
   const p=this.add(gun,1,Math.min(3,target.weight*.5),gun.x,(gun.rig?.root[13]??ground)+24,gun.z);if(p)p.area=target.area;
  }
 }
 expose(seconds,visible){if(visible)this.exposure+=seconds;}
 update(engine,world){
  const now=engine.time;if(now+1e-9<this.nextScan)return false;this.nextScan=now+.35;this.scan(engine,world);
  const intent=this.intent;let best=-1,bestScore=-Infinity,current=-1,currentDistance=AREA_RADIUS*1.4,busy=0,totalAction=0;
  for(let i=0;i<this.areaCount;i++){
   const a=this.areas[i],score=a.weight+(a.danger>.05?8:0);if(score>bestScore){bestScore=score;best=i;}
   const d=Math.hypot(a.x-intent.anchor[0],a.z-intent.anchor[2]);if(d<currentDistance){currentDistance=d;current=i;}
   if(a.action>1.5)busy++;totalAction+=a.action;
  }
  if(current===best&&current>=0&&this.exposure>=4.5){let alternate=-1,weight=this.areas[current].weight*.65;for(let i=0;i<this.areaCount;i++)if(i!==current&&this.areas[i].action>1.5&&this.areas[i].weight>weight){weight=this.areas[i].weight;alternate=i;}if(alternate>=0)best=alternate;}
  let selected=best,reason='opening';
  if(intent.version&&current>=0&&best>=0&&current!==best){
   const a=this.areas[current],b=this.areas[best],urgent=b.danger>.05&&b.danger>a.danger+.08,quiet=a.action<.5&&b.action>1.5,aged=this.exposure>=4.5,travelTimeout=now-this.since>=8;
   const enough=this.exposure>=(urgent||quiet ? .6 : 1.8)||travelTimeout,advantage=b.weight>a.weight*(aged ? .78 : 1.18)+.25;
   if(enough&&(advantage||urgent||quiet)){
    if(Math.hypot(b.x-this.challengeX,b.z-this.challengeZ)>64){this.challengeX=b.x;this.challengeZ=b.z;this.challengeSince=now;}
    if(now-this.challengeSince<(urgent||quiet ? .3 : .6))selected=current;else reason=urgent?'exit pressure':quiet?'fresh fighting':aged?'share the action':'busier battle';
   }else{selected=current;this.challengeX=this.challengeZ=Infinity;}
  }else{this.challengeX=this.challengeZ=Infinity;}
  const a=selected>=0?this.areas[selected]:null,kind=a?.danger>.05?'danger':totalAction>1.5?'combat':this.count?'approach':'survey';
  const newArea=!intent.version||selected<0&&intent.area>=0||Math.hypot((a?.x??world.width/2)-intent.anchor[0],(a?.z??world.length/2)-intent.anchor[2])>AREA_RADIUS;
  let changed=newArea||kind!==intent.kind;
  if(changed){this.exposure=0;this.since=now;this.shotIndex=0;}
  else if(this.exposure>=6){this.shotIndex++;this.exposure=0;changed=true;reason='new perspective';}
  const dominant=a&&a.action>=totalAction*.7;
  const desiredStyle=kind==='danger'?'danger':kind==='survey'||kind==='approach'?'survey':busy>1&&!dominant?(this.shotIndex%2?'battle':'overview'):['battle','dramatic','overview'][this.shotIndex%3];
  const style=changed?desiredStyle:intent.style;
  if(changed){intent.version++;intent.reason=reason;}
  intent.kind=kind;intent.style=style;intent.area=selected;intent.busyAreas=busy;intent.action=a?.action??0;intent.danger=a?.danger??0;intent.weight=a?.weight??0;intent.subject=a?.enemy??null;
  if(a){intent.anchor.set([a.x,a.y,a.z]);}else intent.anchor.set([world.width/2,world.level.pathHeight+16,world.length/2]);
  // Look a little beyond the foremost exchange: arrivals become background,
  // while the near weapons/enemies remain the foreground subject.
  let x=intent.anchor[0],y=intent.anchor[1],z=intent.anchor[2],weight=1,radius=24;
  for(let i=0;i<this.count;i++){const p=this.subjects[i];if(p.area===selected){radius=Math.max(radius,Math.hypot(p.x-intent.anchor[0],p.z-intent.anchor[2]));if(p.kind===1){x+=p.x*.18;y+=p.y*.18;z+=p.z*.18;weight+=.18;}}}
  intent.focus.set([x/weight,y/weight+6,z/weight]);intent.radius=Math.min(100,radius);return changed;
 }
 get byteLength(){return this.events.byteLength+this.intent.anchor.byteLength+this.intent.focus.byteLength;}
}
