import {levelRoutes} from '../shared/routes.js';

// Runtime UI anchors; do not add solid objects or alter authored landscapes.
export function pathEntrances(level){
 const entries=[],seen=new Set();
 for(const route of levelRoutes(level)){
  const first=route.path[0];if(!first)continue;
  const key=first[0]+':'+first[2];if(seen.has(key))continue;seen.add(key);
  const next=route.path.find(box=>box[0]!==first[0]||box[2]!==first[2]),dx=next?next[0]-first[0]:0,dz=next?next[2]-first[2]:1,length=Math.hypot(dx,dz);
  entries.push({x:(first[0]+.5)*24,y:(level.pathHeight??24)+.6,z:(first[2]+.5)*24,dx:dx/length,dz:dz/length});
 }
 return entries;
}
const NS='http://www.w3.org/2000/svg';
export class EntranceMarkers {
 constructor(overlay){this.overlay=overlay;this.level=null;this.entries=[];this.view=new Float64Array(16);this.width=this.height=-1;this.started=false;overlay.style.pointerEvents='none';}
 update(world,camera,phase,width,height){
  if(world?.level!==this.level){this.level=world?.level??null;this.entries=this.level?pathEntrances(this.level):[];this.width=this.height=-1;this.started=false;}
  if(phase==='wave'||phase==='settling')this.started=true;
  const show=!this.started&&this.entries.length&&['loadout','deploy'].includes(phase)&&camera?.mode==='overview';
  if(show)this.overlay.removeAttribute('hidden');else this.overlay.setAttribute('hidden','');this.overlay.style.display=show?'':'none';if(!show)return;
  const m=camera.vp;let changed=width!==this.width||height!==this.height;
  if(!changed)for(let i=0;i<16;i++)if(this.view[i]!==m[i]){changed=true;break;}
  if(!changed)return;this.view.set(m);this.width=width;this.height=height;
  this.overlay.setAttribute('viewBox',`0 0 ${width} ${height}`);this.overlay.setAttribute('role','img');this.overlay.setAttribute('aria-label',`${this.entries.length} enemy path ${this.entries.length===1?'entrance':'entrances'}`);
  const project=(x,y,z)=>{const w=m[3]*x+m[7]*y+m[11]*z+m[15];return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w*width/2+width/2,height/2-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*height/2];};
  const node=(tag,attributes)=>{const n=this.overlay.ownerDocument.createElementNS(NS,tag);for(const [key,value]of Object.entries(attributes))n.setAttribute(key,value);return n;},fragment=this.overlay.ownerDocument.createDocumentFragment();
  this.entries.forEach((e,index)=>{
   const a=project(e.x,e.y,e.z);if(a[0]<0||a[0]>width||a[1]<0||a[1]>height)return;
   const group=node('g',{'data-entrance':index+1}),points=[];
   // Two chevrons lie on the actual route and point into its first segment.
   for(const advance of [-4,5])for(const [along,side]of [[-4,-5],[1,0],[-4,5]])points.push(project(e.x+e.dx*(advance+along)-e.dz*side,e.y,e.z+e.dz*(advance+along)+e.dx*side));
   for(let i=0;i<2;i++)group.append(node('polyline',{points:points.slice(i*3,i*3+3).map(p=>p.join(',')).join(' '),fill:'none',stroke:'#ffe3a0','stroke-width':3,'stroke-linecap':'square','stroke-linejoin':'miter'}));
   const x=Math.max(39,Math.min(width-39,a[0])),y=Math.max(28,a[1]-40);
   group.append(node('rect',{x:x-37,y:y-10,width:74,height:21,fill:'#25382b'}));
   const text=node('text',{x,y:y+4,'text-anchor':'middle',fill:'#ffe3a0','font-size':10,'font-family':'ui-monospace,Menlo,monospace','font-weight':700,'letter-spacing':1});text.textContent=this.entries.length>1?`ENTRY ${index+1}`:'ENTRY';group.append(text);fragment.append(group);
  });
  this.overlay.replaceChildren(fragment);
 }
 dispose(){this.overlay.replaceChildren();this.level=null;this.entries=[];this.width=this.height=-1;}
}
