// Deterministic cosmetic scenery only: no meshes here join the playable world.
// Terrain, clustered vegetation and a few layered landmarks share one buffer.
export function biomeVistaGeometry(zone,width=480,length=384){
 if(!['A','B','C','D'].includes(zone))throw new Error('Unsupported vista biome: '+zone);
 const data=[];let seed={A:5937,B:7813,C:2939,D:9719}[zone];
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const river=x=>950+350*Math.sin(x/1100)+150*Math.sin(x/490),waterY=zone==='A'?-526:-550;
 const bank=(x,z)=>Math.abs(z-river(x));
 // Wide overlapping ridges create recognizable valleys rather than isolated
 // equally spaced cones. Their height never approaches the floating board.
 const ridge=(x,z,cx,cz,rx,rz,h)=>h*Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2));
 const height=(x,z)=>{
  const b=bank(x,z),rise=Math.min(160,Math.max(0,b-190)*.085),shore=Math.min(1,Math.max(0,b-140)/420);
  const rolling=(34*Math.sin(x/690)*Math.sin(z/830)+24*Math.cos((x+z)/560))*shore;
  let y=waterY-40+rise+rolling;
  if(zone==='A'){
   y+=ridge(x,z,-1700,-1500,1800,700,60)+ridge(x,z,2300,-1300,1500,900,50);
   // Smaller folds and shelf breaks give the woodland floor real relief.
   y+=(11*Math.sin(x/175)*Math.cos(z/215)+6*Math.sin((x-z)/93))*shore;
  }
  if(zone==='B')y=waterY-40+Math.floor(rise/28)*28+rolling*.55+ridge(x,z,-1600,-1800,1900,650,45);
  if(zone==='B')y+=5*Math.sin(x/145)*Math.cos(z/170)*shore;
  if(zone==='C')y+=7*Math.sin((x+z)/120)*Math.cos(z/210)*shore;
  if(zone==='D')y+=8*Math.sin(x/190)*Math.cos(z/155)*shore;
  if(zone==='C')y+=ridge(x,z,-2200,-1800,2300,650,95)+ridge(x,z,1700,-2400,1700,800,90);
  if(zone==='D')y+=ridge(x,z,-1700,-1300,1600,800,45)+ridge(x,z,1900,-2000,2100,650,55);
  return y;
 };
 const tri=(a,b,c,color)=>{
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,light=.68+.32*Math.abs((nx*.4+ny*.8+nz*.35)/(Math.hypot(nx,ny,nz)||1));
  for(const p of [a,b,c])data.push(p[0]+width/2,p[1],p[2]+length/2,color[0]*light,color[1]*light,color[2]*light);
 };
 const quad=(a,b,c,d,col)=>{tri(a,b,c,col);tri(a,c,d,col);};
 const box=(x,y,z,rx,h,rz,col)=>{
  const a=[x-rx,y,z-rz],b=[x+rx,y,z-rz],c=[x+rx,y,z+rz],d=[x-rx,y,z+rz],A=[x-rx,y+h,z-rz],B=[x+rx,y+h,z-rz],C=[x+rx,y+h,z+rz],D=[x-rx,y+h,z+rz];
  quad(a,b,B,A,col);quad(b,c,C,B,col);quad(c,d,D,C,col);quad(d,a,A,D,col);quad(A,B,C,D,col);
 };
 // A ring loft gives stepped shoulders, snow lines and broad crowns real
 // silhouettes without multiplying independent scenery objects.
 const loft=(x,y,z,rings,sides,col,phase=0)=>{
  for(let k=1;k<rings.length;k++)for(let j=0;j<sides;j++){
   const a=phase+j*Math.PI*2/sides,b=phase+(j+1)*Math.PI*2/sides,lo=rings[k-1],hi=rings[k];
   const p=[x+Math.cos(a)*lo[1],y+lo[0],z+Math.sin(a)*lo[1]],q=[x+Math.cos(b)*lo[1],y+lo[0],z+Math.sin(b)*lo[1]];
   const P=[x+Math.cos(a)*hi[1],y+hi[0],z+Math.sin(a)*hi[1]],Q=[x+Math.cos(b)*hi[1],y+hi[0],z+Math.sin(b)*hi[1]];
   if(hi[1]===0)tri(p,q,P,col);else quad(p,q,Q,P,col);
  }
  const top=rings.at(-1);if(top[1])for(let j=0;j<sides;j++){
   const a=phase+j*Math.PI*2/sides,b=phase+(j+1)*Math.PI*2/sides;
   tri([x+Math.cos(a)*top[1],y+top[0],z+Math.sin(a)*top[1]],[x+Math.cos(b)*top[1],y+top[0],z+Math.sin(b)*top[1]],[x,y+top[0],z],col);
  }
 };
 const ground={A:[.105,.155,.085],B:[.25,.16,.085],C:[.235,.275,.29],D:[.12,.125,.115]}[zone];
 const water={A:[.075,.165,.155],B:[.055,.145,.15],C:[.105,.18,.23],D:[.09,.135,.19]}[zone];
 const step=80,half=90;
 for(let x=-half;x<half;x++)for(let z=-half;z<half;z++){
  const X=x*step,Z=z*step,a=[X,height(X,Z),Z],b=[X+step,height(X+step,Z),Z],c=[X+step,height(X+step,Z+step),Z+step],d=[X,height(X,Z+step),Z+step];
  const nearBank=bank(X+step*.5,Z+step*.5)<320,slope=Math.max(...[b,c,d].map(p=>Math.abs(p[1]-a[1])));
  const tint=.91+.065*Math.sin(X/510+Z/740)+random()*.06;
  let col=ground.map(v=>v*tint);
  // Broad geological/ecological bands remain readable at distance.
  if(zone==='A'&&nearBank)col=[.16*tint,.17*tint,.11*tint];
  if(zone==='B'&&Math.floor((a[1]+600)/28)%3===0)col=[.265*tint,.18*tint,.105*tint];
  if(zone==='C'&&slope>29)col=[.135*tint,.175*tint,.2*tint];
  if(zone==='D'&&nearBank)col=[.15,.15,.13];
  tri(a,c,b,col);tri(a,d,c,col);
 }
 const riverStep=40,riverHalf=180;
 for(let i=-riverHalf;i<riverHalf;i++){
  const x=i*riverStep,nx=x+riverStep,w=110+70*Math.sin(x/1100)**2,nw=110+70*Math.sin(nx/1100)**2;
  quad([x,waterY,river(x)-w],[nx,waterY,river(nx)-nw],[nx,waterY,river(nx)+nw],[x,waterY,river(x)+w],water);
  if(zone==='A'){
   // Narrow irregular gravel shelves follow both banks; the middle channel
   // remains broad and quiet, without animated highlights or image textures.
   const edge=18+12*Math.sin(x/145)**2,nextEdge=18+12*Math.sin(nx/145)**2;
   for(const sign of [-1,1])quad([x,waterY-.5,river(x)+sign*w],[nx,waterY-.5,river(nx)+sign*nw],[nx,waterY-.5,river(nx)+sign*(nw+nextEdge)],[x,waterY-.5,river(x)+sign*(w+edge)],[.14,.16,.12]);
  }
 }
 // Close landmarks are composed groups, with quieter echoes farther out.
 for(let i=0;i<150;i++){
  const x=i<16?-2600+(i%8)*740:(random()-.5)*12000,z=i<16?-1100-Math.floor(i/8)*1800+(i%3)*140:(random()-.5)*12000;
  if(bank(x,z)<420)continue;const y=height(x,z)-14,r=75+random()*100;
  if(zone==='A'){
   // Limestone benches with broken caps and smaller fallen slabs.
   loft(x,y,z,[[0,r],[18,r*.96],[23,r*.7],[40,r*.65],[46,r*.48],[56,r*.44]],7,[.205,.22,.175],.2);
   box(x+r*.78,y-5,z+r*.2,r*.24,18,r*.3,[.18,.195,.15]);
   box(x-r*.64,y-3,z+r*.66,r*.3,12,r*.19,[.19,.205,.16]);
   loft(x+r*.42,y+48,z-r*.3,[[0,r*.22],[14,r*.14]],5,[.185,.2,.16],.6);
  }else if(zone==='B'){
   // Eroded mesa shoulders, narrow exposed strata and broken caprock.
   const h=65+random()*40;
   loft(x,y,z,[[0,r],[h*.22,r*.92],[h*.44,r*.83]],8,[.245,.125,.075],.12);
   loft(x,y+h*.44,z,[[0,r*.83],[6,r*.82],[10,r*.81]],8,[.3,.19,.105],.12);
   loft(x,y+h*.44+10,z,[[0,r*.81],[h*.35,r*.71],[h*.55,r*.63]],8,[.265,.155,.085],.12);
   loft(x+r*1.35,y-8,z+r*.4,[[0,r*.3],[h*.3,r*.26],[h*.65,r*.18]],7,[.235,.135,.08]);
   box(x-r*.8,y+3,z+r*.75,r*.28,12,r*.22,[.24,.15,.09]);
  }else if(zone==='C'){
   // Faceted slate ridges with inset snow shelves and a secondary summit.
   const h=80+random()*45;
   loft(x,y,z,[[0,r*1.45],[h*.28,r],[h*.55,r*.63]],8,[.11,.15,.18],.3);
   loft(x,y+h*.55,z,[[0,r*.63],[h*.15,r*.49],[h*.3,r*.23],[h*.45,0]],8,[.33,.355,.36],.3);
   loft(x-r*.8,y-10,z+r*.4,[[0,r*.8],[h*.32,r*.5],[h*.66,0]],7,[.235,.27,.29],.6);
   loft(x+r*.85,y-4,z-r*.3,[[0,r*.38],[h*.24,r*.2],[h*.4,0]],6,[.16,.195,.22],.1);
  }else{
   // Broken sanctuary groups: unequal columns, surviving lintel, fallen block.
   const stone=[.235,.23,.205],h=42+random()*20;
   box(x,y,z,13,h,13,stone);box(x+68,y,z,13,h*.7,13,stone);
   box(x+18,y+h,z,31,10,15,[.26,.25,.225]);
   box(x-28,y-2,z+51,31,10,15,[.2,.2,.18]);
   box(x+105,y-2,z-35,9,26,9,stone);
   // Broad plinths, broken capitals and collapsed steps anchor the ruins.
   box(x+30,y-5,z+4,65,7,35,[.17,.175,.155]);
   box(x,y+h-3,z,18,6,18,[.26,.25,.225]);
   box(x+68,y+h*.7-3,z,17,6,17,[.24,.235,.21]);
   box(x-45,y-3,z+78,27,6,14,[.19,.19,.17]);
   box(x-45,y-3,z+100,32,3,8,[.18,.185,.16]);
  }
 }
 const count={A:4200,B:1800,C:3200,D:3000}[zone];
 for(let i=0;i<count;i++){
  const x=(random()-.5)*10000,z=(random()-.5)*10000,b=bank(x,z);
  // Connected woodland groves alternate with long meadow/alpine openings.
  const grove=Math.sin(x/540+Math.sin(z/780))*Math.cos(z/670);
  if(b<270||(zone!=='B'&&grove<-.36))continue;
  const y=height(x,z)-12,h=32+random()*40,r=16+random()*16,phase=random()*Math.PI;
  if(zone==='A'){
   // Readable branching crowns and visible trunks replace the tiny pyramids.
   box(x,y,z,2.3,h*.58,2.3,[.075,.085,.055]);
   if(random()<.3){
    loft(x,y,z,[[h*.14,r*.35],[h*.45,r*.62],[h*.84,r*.35],[h*1.35,0]],7,[.047,.09,.062],phase);
   }else{
    const col=[.075+random()*.015,.125+random()*.02,.064];
    loft(x,y,z,[[h*.24,r*.42],[h*.57,r],[h*.9,r*.7],[h*1.06,r*.2]],6,col,phase);
    loft(x+r*.64,y,z-r*.12,[[h*.25,r*.36],[h*.52,r*.63],[h*.81,r*.24]],5,col.map(v=>v*.91),phase+.4);
   }
   if(i%5===0)loft(x+r*1.2,y+3,z+r*.5,[[0,r*.45],[11,r*.3],[17,0]],5,[.07,.105,.055],phase);
  }else if(zone==='B'){
   if(random()<.72){
    const col=[.075,.125,.09];box(x,y,z,4,h,4,col);box(x+11,y+h*.45,z,14,7,4,col);box(x+21,y+h*.45,z,4,h*.32,4,col);
    if(random()<.45){box(x-10,y+h*.28,z,13,6,4,col);box(x-19,y+h*.28,z,4,h*.25,4,col);}
    loft(x,y+h-2,z,[[0,5],[5,3],[7,0]],6,[.09,.145,.095],phase);
   }else{
    loft(x,y,z,[[0,r],[7,r*.8],[12,r*.42]],6,[.185,.13,.075],phase);
    loft(x+r*.75,y,z-r*.2,[[0,r*.4],[7,r*.23]],5,[.205,.15,.085],phase);
   }
  }else if(zone==='C'){
   const col=[.04,.085,.095];
   box(x,y,z,2,h*.7,2,[.075,.095,.095]);
   for(const [base,scale]of [[.08,1],[.3,.8],[.51,.6]]){
    loft(x,y+h*base,z,[[0,r*scale],[h*.14,r*scale*.7],[h*.4,0]],7,col,phase);
    loft(x,y+h*(base+.1),z,[[0,r*scale*.65],[h*.3,0]],7,[.29,.325,.33],phase);
   }
  }else{
   const plum=random()<.74,col=plum?[.125+random()*.02,.07,.14+random()*.018]:[.105,.135,.115];
   box(x,y,z,3,h*.68,3,[.095,.08,.085]);
   loft(x,y,z,[[h*.32,r*.45],[h*.58,r*1.3],[h*.84,r],[h*1.03,r*.3]],7,col,phase);
   loft(x-r*.7,y,z+r*.3,[[h*.28,r*.4],[h*.5,r*.8],[h*.78,r*.36]],6,col.map(v=>v*.9),phase+.3);
   if(i%6===0)loft(x+r*1.2,y+2,z+r*.5,[[0,r*.4],[12,r*.25],[18,0]],5,[.09,.105,.09],phase);
  }
 }
 return new Float32Array(data);
}
