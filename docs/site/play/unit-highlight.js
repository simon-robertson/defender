import {UnitRangeGeometry,unitRangePreview} from './range-preview.js';
const SVG_NS='http://www.w3.org/2000/svg';
const turn=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const order=(a,b)=>a.x-b.x||a.y-b.y;

// Cache unique exposed mesh vertices once. Projection uses the current instance
// matrices, so independent head yaw, gun pitch and recoil remain represented.
export class UnitOutlineGeometry {
 constructor(){this.world=null;this.entries=new Map();this.meshPoints=new WeakMap();this.points=[];this.sorted=[];this.hull=[];this.signature=[];this.rig=null;this.width=this.height=0;this.changed=false;}
 reset(){this.world=null;this.entries.clear();this.rig=null;this.signature.length=0;this.hull.length=0;this.changed=true;}
 localPoints(mesh){
  let points=this.meshPoints.get(mesh);if(points)return points;
  const unique=new Map(),vertices=mesh.vertices;
  for(let i=0;i<vertices.length;i+=11){const x=vertices[i],y=vertices[i+1],z=vertices[i+2];unique.set(`${x},${y},${z}`,[x,y,z]);}
  points=new Float32Array(unique.size*3);let offset=0;for(const point of unique.values()){points.set(point,offset);offset+=3;}
  this.meshPoints.set(mesh,points);return points;
 }
 project(world,camera,unitId,width,height){
  this.changed=false;
  if(!world||!camera?.vp||!(width>0&&height>0)){this.reset();return null;}
  if(this.world!==world||this.entries.size!==world.entries.length){this.reset();this.world=world;for(const entry of world.entries)this.entries.set(entry.key,entry);}
  const rig=world.rigs?.get(unitId);if(!rig||rig.role!=='defence'||!rig.instances?.length){this.rig=null;this.hull.length=0;this.changed=true;return null;}
  let changed=this.rig!==rig||this.width!==width||this.height!==height,offset=0;
  for(let i=0;i<16;i++,offset++)if(this.signature[offset]!==camera.vp[i])changed=true;
  for(const instance of rig.instances)for(let i=0;i<16;i++,offset++)if(this.signature[offset]!==instance.matrix[i])changed=true;
  if(!changed)return this.hull.length>=3?this.hull:null;
  this.changed=true;this.rig=rig;this.width=width;this.height=height;offset=0;
  for(let i=0;i<16;i++)this.signature[offset++]=camera.vp[i];
  for(const instance of rig.instances)for(let i=0;i<16;i++)this.signature[offset++]=instance.matrix[i];
  this.signature.length=offset;this.sorted.length=0;this.hull.length=0;
  const vp=camera.vp;let count=0;
  for(const instance of rig.instances){
   const entry=this.entries.get(instance.key);if(!entry?.mesh?.vertices){this.rig=null;return null;}
   const local=this.localPoints(entry.mesh),m=instance.matrix;
   for(let i=0;i<local.length;i+=3){
    const x=local[i],y=local[i+1],z=local[i+2],wx=m[0]*x+m[4]*y+m[8]*z+m[12],wy=m[1]*x+m[5]*y+m[9]*z+m[13],wz=m[2]*x+m[6]*y+m[10]*z+m[14];
    const w=vp[3]*wx+vp[7]*wy+vp[11]*wz+vp[15];
    if(!Number.isFinite(w)||w<=1e-6){this.hull.length=0;return null;}
    const px=((vp[0]*wx+vp[4]*wy+vp[8]*wz+vp[12])/w+1)*width*.5,py=(1-(vp[1]*wx+vp[5]*wy+vp[9]*wz+vp[13])/w)*height*.5;
    if(!Number.isFinite(px)||!Number.isFinite(py)){this.hull.length=0;return null;}
    let point=this.points[count];if(!point){point={x:0,y:0};this.points[count]=point;}point.x=px;point.y=py;this.sorted.push(point);count++;
   }
  }
  this.sorted.sort(order);let uniqueCount=0;
  for(let i=0;i<this.sorted.length;i++){const point=this.sorted[i],last=this.sorted[uniqueCount-1];if(!last||point.x!==last.x||point.y!==last.y)this.sorted[uniqueCount++]=point;}
  this.sorted.length=uniqueCount;if(uniqueCount<3)return null;
  for(const point of this.sorted){while(this.hull.length>=2&&turn(this.hull.at(-2),this.hull.at(-1),point)<=0)this.hull.pop();this.hull.push(point);}
  const lower=this.hull.length;
  for(let i=uniqueCount-2;i>=0;i--){const point=this.sorted[i];while(this.hull.length>lower&&turn(this.hull.at(-2),this.hull.at(-1),point)<=0)this.hull.pop();this.hull.push(point);}
  this.hull.pop();
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const point of this.hull){minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);}
  if(maxX<0||minX>width||maxY<0||minY>height){this.hull.length=0;return null;}
  return this.hull.length>=3?this.hull:null;
 }
 dispose(){this.reset();this.meshPoints=new WeakMap();this.points.length=this.sorted.length=0;}
}

/** Screen-space preparation highlight. Never changes selection or run state. */
export class UnitHighlight {
 constructor({canvas,list,overlay,defences=null}){
  this.canvas=canvas;this.list=list;this.overlay=overlay;this.defences=defences;this.document=overlay.ownerDocument;this.geometry=new UnitOutlineGeometry();this.rangeGeometry=new UnitRangeGeometry();this.context=null;this.hoverRow=null;this.hoverTarget=null;this.disposed=false;this.visibleId=null;this.visibleLabel='';
  const node=(tag,attributes={})=>{const element=this.document.createElementNS(SVG_NS,tag);for(const[key,value]of Object.entries(attributes))element.setAttribute(key,value);return element;};
  this.rangeGroup=node('g');this.rangeUnder=node('polygon',{fill:'none',stroke:'#17291f','stroke-width':'4','vector-effect':'non-scaling-stroke'});
  this.range=node('polygon',{fill:'#ffe6a0','fill-opacity':'.07',stroke:'#ffe6a0','stroke-width':'1.5','vector-effect':'non-scaling-stroke'});this.rangeGroup.append(this.rangeUnder,this.range);overlay.append(this.rangeGroup);
  this.group=node('g');this.under=node('polygon',{fill:'none',stroke:'#514b31','stroke-width':'5','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'});
  this.outline=node('polygon',{fill:'#fff0bb','fill-opacity':'.13',stroke:'#ffe6a0','stroke-width':'2.5','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'});
  this.label=node('g');this.labelBack=node('rect',{height:'23',rx:'4',fill:'#fff0c9',stroke:'#857451','stroke-width':'1'});this.labelText=node('text',{'text-anchor':'middle',y:'15',fill:'#344534','font-size':'11','font-family':'Arial,Helvetica,sans-serif','font-weight':'700'});this.label.append(this.labelBack,this.labelText);this.group.append(this.under,this.outline,this.label);overlay.append(this.group);overlay.setAttribute('hidden','');overlay.setAttribute('aria-hidden','true');overlay.style.pointerEvents='none';
  this.onOver=event=>{const row=this.row(event.target);if(row){this.hoverRow=row;this.hoverTarget=event.target;this.draw();}};
  this.onOut=event=>{const row=this.row(event.target);if(row&&row===this.hoverRow){if(row.contains(event.relatedTarget))this.hoverTarget=event.relatedTarget;else this.hoverRow=this.hoverTarget=null;this.draw();}};
  this.onFocus=()=>this.draw();
  this.onBlur=()=>{this.focusLeaving=true;this.draw();this.focusLeaving=false;};
  list.addEventListener('pointerover',this.onOver);list.addEventListener('pointerout',this.onOut);list.addEventListener('focusin',this.onFocus);list.addEventListener('focusout',this.onBlur);
 }
 row(target){const row=target?.closest?.('.unit-row[data-unit]');return row&&this.list.contains(row)?row:null;}
 update({world,camera,units=[],preparing=false,busy=false,paused=false}){
  if(this.disposed)return;
  if(!preparing||busy||paused||!world||!camera){this.context=null;this.hoverRow=this.hoverTarget=null;this.geometry.reset();this.rangeGeometry.reset();this.clear();return;}
  if(this.context?.world!==world){this.hoverRow=this.hoverTarget=null;this.geometry.reset();this.rangeGeometry.reset();}
  this.context??={world:null,camera:null,units:null};this.context.world=world;this.context.camera=camera;this.context.units=units;this.draw();
 }
 clear(){this.overlay.setAttribute('hidden','');for(const key of ['data-unit','data-range','data-range-variant','data-range-mode'])this.overlay.removeAttribute(key);this.group.removeAttribute('data-unit');this.rangeGroup.setAttribute('hidden','');this.visibleId=null;this.visibleLabel='';}
 draw(){
  if(this.disposed||!this.context){this.clear();return;}
  if(this.hoverRow&&!this.list.contains(this.hoverRow))this.hoverRow=this.hoverTarget=null;
  const target=this.hoverRow?this.hoverTarget:(this.focusLeaving?null:this.document.activeElement),row=this.row(target),id=row?.dataset.unit,unit=this.context.units.find(unit=>unit.id===id);
  if(!unit||!(unit.deployed??unit.box)){this.clear();return;}
  const {world,camera}=this.context,width=this.canvas.clientWidth,height=this.canvas.clientHeight,hull=this.geometry.project(world,camera,id,width,height);
  if(!hull){this.clear();return;}
  const upgrade=target?.closest?.('[data-action="upgrade"]'),preview=unitRangePreview(unit,this.defences,Boolean(upgrade&&row.contains(upgrade)&&!upgrade.hidden))??unitRangePreview(unit,this.defences);
  const rangePoints=preview?this.rangeGeometry.project(world.rigs.get(id),camera,preview.range,width,height):null;
  const name=unit.label||`${{'arc-spire':'Arc Spire','missile-launcher':'Missile launcher','power-generator':'Power Generator'}[unit.model]??'Gun'} ${String(this.context.units.indexOf(unit)+1).padStart(2,'0')}`;
  const label=name+(rangePoints?` · ${preview.upgrade?'NEXT '+({upgrade1:'I',upgrade2:'II'}[preview.variant]??preview.variant)+' ':''}RNG ${preview.range}`:'');
  if(!this.geometry.changed&&!this.rangeGeometry.changed&&this.visibleId===id&&this.visibleLabel===label)return;
  this.overlay.setAttribute('viewBox',`0 0 ${width} ${height}`);this.overlay.setAttribute('data-unit',id);this.group.setAttribute('data-unit',id);this.overlay.removeAttribute('hidden');
  if(rangePoints){
   const points=rangePoints.map(point=>`${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),dash=preview.upgrade?'7 4':'';this.rangeUnder.setAttribute('points',points);this.range.setAttribute('points',points);this.rangeUnder.setAttribute('stroke-dasharray',dash);this.range.setAttribute('stroke-dasharray',dash);this.rangeGroup.removeAttribute('hidden');this.overlay.setAttribute('data-range',preview.range);this.overlay.setAttribute('data-range-variant',preview.variant);this.overlay.setAttribute('data-range-mode',preview.upgrade?'next':'current');
  }else{this.rangeGroup.setAttribute('hidden','');for(const key of ['data-range','data-range-variant','data-range-mode'])this.overlay.removeAttribute(key);}
  const points=hull.map(point=>`${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');this.under.setAttribute('points',points);this.outline.setAttribute('points',points);
  let minX=Infinity,minY=Infinity,maxX=-Infinity;for(const point of hull){minX=Math.min(minX,point.x);minY=Math.min(minY,point.y);maxX=Math.max(maxX,point.x);}
  const labelWidth=Math.min(width-8,label.length*6.7+18),x=Math.max(4,Math.min(width-labelWidth-4,(minX+maxX-labelWidth)*.5)),y=Math.max(4,minY-30);
  this.label.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)})`);this.labelBack.setAttribute('width',labelWidth);this.labelText.setAttribute('x',labelWidth*.5);this.labelText.textContent=label;this.visibleId=id;this.visibleLabel=label;
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.list.removeEventListener('pointerover',this.onOver);this.list.removeEventListener('pointerout',this.onOut);this.list.removeEventListener('focusin',this.onFocus);this.list.removeEventListener('focusout',this.onBlur);this.context=null;this.hoverRow=this.hoverTarget=null;this.clear();this.geometry.dispose();this.rangeGeometry.reset();this.group.remove();this.rangeGroup.remove();}
}
