const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Heights and lenses cover the player's overview, medium and near-level shots.
// These are shot families, not memorised level coordinates or camera poses.
export const BATTLE_SHOTS=Object.freeze({
 survey:{height:108,range:205,fov:64,board:.55},
 overview:{height:112,range:145,fov:64,board:.45},
 battle:{height:80,range:175,fov:56,board:.28},
 dramatic:{height:26,range:118,fov:56,board:.08},
 danger:{height:112,range:190,fov:60,board:.35},
});
export function projectBattlePoint(pose,x,y,z,aspect,out){
 const dx=x-pose.x,dy=y-pose.y,dz=z-pose.z,sy=Math.sin(pose.yaw),cy=Math.cos(pose.yaw),sp=Math.sin(pose.pitch),cp=Math.cos(pose.pitch),depth=-dx*sy*cp-dy*sp-dz*cy*cp,tan=Math.tan(pose.fov*Math.PI/360);
 out[0]=(dx*cy-dz*sy)/(depth*tan*aspect);out[1]=(-dx*sy*sp+dy*cp-dz*cy*sp)/(depth*tan);out[2]=depth;return out;
}
export class BattleFraming {
 constructor(){this.point=new Float64Array(3);this.basis=new Float64Array(9);this.projected=new Float64Array(16*3);this.pose={x:0,y:0,z:0,yaw:0,pitch:0,fov:56};this.result={score:-Infinity,action:0,board:0,arrivals:0,water:0,primary:false};this.water=[];}
 bind(world){this.world=world;this.water.length=0;if(!world)return;const wet=world.level.terrain.boxes.filter(b=>b.water>0),step=Math.max(1,Math.ceil(wet.length/24));for(let i=0;i<wet.length;i+=step){const b=wet[i];this.water.push([(b.box[0]+.5)*24,b.water,(b.box[1]+.5)*24]);}}
 orient(x,y,z,focus,fov){const p=this.pose;p.x=x;p.y=y;p.z=z;p.yaw=Math.atan2(x-focus[0],z-focus[2]);p.pitch=Math.atan2(y-focus[1],Math.hypot(x-focus[0],z-focus[2]));p.fov=fov;return p;}
 project(x,y,z){const b=this.basis,dx=x-b[6],dy=y-b[7],dz=z-b[8],depth=-dx*b[0]*b[3]-dy*b[2]-dz*b[1]*b[3],out=this.point;out[0]=(dx*b[1]-dz*b[0])/(depth*b[4]*b[5]);out[1]=(-dx*b[0]*b[2]+dy*b[3]-dz*b[1]*b[2])/(depth*b[4]);out[2]=depth;return out;}
 evaluate(pose,director,aspect=16/9){
  const {intent,subjects,count}=director,w=this.world,point=this.point,result=this.result,profile=BATTLE_SHOTS[intent.style];
  this.basis.set([Math.sin(pose.yaw),Math.cos(pose.yaw),Math.sin(pose.pitch),Math.cos(pose.pitch),Math.tan(pose.fov*Math.PI/360),aspect,pose.x,pose.y,pose.z]);
  const a=this.project(...intent.anchor),primary=a[2]>20&&Math.abs(a[0])<.88&&Math.abs(a[1])<.85,primaryDepth=a[2];
  let all=0,shown=0,local=0,localShown=0,arrivals=0,arrivalsTotal=0,foreground=0,frontWeight=0,projectedCount=0;
  for(let i=0;i<count;i++){
   const s=subjects[i],p=this.project(s.x,s.y,s.z),visible=p[2]>12&&Math.abs(p[0])<.91&&Math.abs(p[1])<.86;
   all+=s.weight;if(visible)shown+=s.weight;
   if(s.area===intent.area){local+=s.weight;if(visible){localShown+=s.weight;if(projectedCount<16){const k=projectedCount++*3;this.projected[k]=p[0];this.projected[k+1]=p[1];this.projected[k+2]=s.weight;}foreground+=(1-clamp(Math.abs(p[1]+.15)/1.2,0,1))*s.weight;frontWeight+=s.weight;}}
   else if(s.kind===0){arrivalsTotal+=s.weight;if(visible)arrivals+=s.weight*(p[2]>=primaryDepth*.9?1:.35);}
  }
  let board=0,screen=0;
  const ground=w.level.pathHeight;
  for(let iz=0;iz<5;iz++)for(let ix=0;ix<5;ix++){const p=this.project((ix+.5)/5*w.width,ground,(iz+.5)/5*w.length);if(p[2]>1&&Math.abs(p[0])<1&&Math.abs(p[1])<1)board++;}
  const sy=Math.sin(pose.yaw),cy=Math.cos(pose.yaw),sp=Math.sin(pose.pitch),cp=Math.cos(pose.pitch),tan=Math.tan(pose.fov*Math.PI/360);
  for(let row=0;row<4;row++)for(let col=0;col<6;col++){
   const sx=((col+.5)/6*2-1)*tan*aspect,up=((row+.5)/4*2-1)*tan,dy=-sp+up*cp,t=(ground-pose.y)/dy;
   if(t<=0)continue;const x=pose.x+(-sy*cp+sx*cy-up*sy*sp)*t,z=pose.z+(-cy*cp-sx*sy-up*cy*sp)*t;if(x>=0&&x<=w.width&&z>=0&&z<=w.length)screen++;
  }
  const coverage=board/25*.65+screen/24*.35,action=local?localShown/local:1,global=all?shown/all:1,depth=arrivalsTotal?arrivals/arrivalsTotal:1;
  let water=0;for(const q of this.water){const p=this.project(...q);if(p[2]>1&&Math.abs(p[0])<.95&&p[1]>-.95&&p[1]<.2)water++;}water=this.water.length?water/this.water.length:0;
  const wide=intent.style==='survey'||intent.style==='overview',context=clamp(coverage/Math.max(.08,profile.board),0,1),size=32/(Math.max(32,primaryDepth)*tan),desiredSize=intent.style==='dramatic'?.65:wide?.38:.38,scale=1-clamp(Math.abs(Math.log(Math.max(.01,size)/desiredSize))/2,0,1);
  let overlap=0,pairs=0;for(let i=0;i<projectedCount;i++)for(let j=i+1;j<projectedCount;j++){const a=i*3,b=j*3;overlap+=Math.max(0,1-Math.abs(this.projected[a]-this.projected[b])/.16)*Math.max(0,1-Math.abs(this.projected[a+1]-this.projected[b+1])/.24);pairs++;}
  result.score=(primary?0:-1.5)+action*.36+global*(wide?.22:.10)+context*.18+depth*.09+scale*.12+(frontWeight?foreground/frontWeight:0)*.07+water*.035-(pairs?overlap/pairs:0)*.12;
  result.action=action;result.board=coverage;result.arrivals=depth;result.water=water;result.primary=primary;return result;
 }
}
