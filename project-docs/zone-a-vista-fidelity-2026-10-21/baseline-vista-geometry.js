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
  if(zone==='A')y+=ridge(x,z,-1700,-1500,1800,700,60)+ridge(x,z,2300,-1300,1500,900,50);
  if(zone==='B')y=waterY-40+Math.floor(rise/28)*28+rolling*.55+ridge(x,z,-1600,-1800,1900,650,45);
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
 const step=160,half=45;
 for(let x=-half;x<half;x++)for(let z=-half;z<half;z++){
  const X=x*step,Z=z*step,a=[X,height(X,Z),Z],b=[X+step,height(X+step,Z),Z],c=[X+step,height(X+step,Z+step),Z+step],d=[X,height(X,Z+step),Z+step];
  const nearBank=bank(X+80,Z+80)<320,slope=Math.max(...[b,c,d].map(p=>Math.abs(p[1]-a[1])));
  const tint=.91+.065*Math.sin(X/510+Z/740)+random()*.06;
  let col=ground.map(v=>v*tint);
  // Broad geological/ecological bands remain readable after distant filtering.
  if(zone==='A'&&nearBank)col=[.16,.17,.11];
  if(zone==='B'&&Math.floor((a[1]+600)/28)%3===0)col=[.265*tint,.18*tint,.105*tint];
  if(zone==='C'&&slope>29)col=[.135*tint,.175*tint,.2*tint];
  if(zone==='D'&&nearBank)col=[.15,.15,.13];
  tri(a,c,b,col);tri(a,d,c,col);
 }
 for(let i=-90;i<90;i++){
  const x=i*80,nx=x+80,w=110+70*Math.sin(x/1100)**2,nw=110+70*Math.sin(nx/1100)**2;
  quad([x,waterY,river(x)-w],[nx,waterY,river(nx)-nw],[nx,waterY,river(nx)+nw],[x,waterY,river(x)+w],water);
 }
 // Close landmarks are composed groups, with quieter echoes farther out.
 for(let i=0;i<76;i++){
  const x=i<16?-2600+(i%8)*740:(random()-.5)*12000,z=i<16?-1100-Math.floor(i/8)*1800+(i%3)*140:(random()-.5)*12000;
  if(bank(x,z)<420)continue;const y=height(x,z)-14,r=75+random()*100;
  if(zone==='A'){
   // Limestone benches with broken caps and smaller fallen slabs.
   loft(x,y,z,[[0,r],[30,r*.88],[36,r*.55],[55,r*.46]],5,[.205,.22,.175],.2);
   box(x+r*.78,y-5,z+r*.2,r*.24,18,r*.3,[.18,.195,.15]);
  }else if(zone==='B'){
   // Mesa shoulders, exposed middle strata, and a small detached butte.
   const h=65+random()*40;
   loft(x,y,z,[[0,r],[h*.44,r*.83]],6,[.245,.125,.075],.12);
   loft(x,y+h*.44,z,[[0,r*.83],[10,r*.81]],6,[.3,.19,.105],.12);
   loft(x,y+h*.44+10,z,[[0,r*.81],[h*.55,r*.63]],6,[.265,.155,.085],.12);
   loft(x+r*1.35,y-8,z+r*.4,[[0,r*.28],[h*.65,r*.18]],5,[.235,.135,.08]);
  }else if(zone==='C'){
   // Interlocking ridges show a broad slate skirt and a smaller snow cap.
   const h=80+random()*45;
   loft(x,y,z,[[0,r*1.45],[h*.55,r*.63]],5,[.11,.15,.18],.3);
   loft(x,y+h*.55,z,[[0,r*.63],[h*.45,0]],5,[.33,.355,.36],.3);
   loft(x-r*.8,y-10,z+r*.4,[[0,r*.8],[h*.66,0]],5,[.235,.27,.29],.6);
  }else{
   // Broken sanctuary groups: unequal columns, surviving lintel, fallen block.
   const stone=[.235,.23,.205],h=42+random()*20;
   box(x,y,z,13,h,13,stone);box(x+68,y,z,13,h*.7,13,stone);
   box(x+18,y+h,z,31,10,15,[.26,.25,.225]);
   box(x-28,y-2,z+51,31,10,15,[.2,.2,.18]);
   box(x+105,y-2,z-35,9,26,9,stone);
  }
 }
 const count={A:2400,B:850,C:1550,D:1250}[zone];
 for(let i=0;i<count;i++){
  const x=(random()-.5)*10000,z=(random()-.5)*10000,b=bank(x,z);
  // Connected woodland groves alternate with long meadow/alpine openings.
  const grove=Math.sin(x/540+Math.sin(z/780))*Math.cos(z/670);
  if(b<270||(zone!=='B'&&grove<-.36))continue;
  const y=height(x,z)-12,h=32+random()*40,r=16+random()*16,phase=random()*Math.PI;
  if(zone==='A'){
   if(random()<.3)loft(x,y,z,[[0,r*.6],[h*1.35,0]],6,[.047,.09,.062],phase);
   else loft(x,y,z,[[h*.18,r*.35],[h*.58,r],[h,r*.44]],4,[.075+random()*.015,.125+random()*.02,.064],phase);
  }else if(zone==='B'){
   if(random()<.72){
    const col=[.075,.125,.09];box(x,y,z,4,h,4,col);box(x+11,y+h*.45,z,14,7,4,col);box(x+21,y+h*.45,z,4,h*.32,4,col);
    if(random()<.45){box(x-10,y+h*.28,z,13,6,4,col);box(x-19,y+h*.28,z,4,h*.25,4,col);}
   }else loft(x,y,z,[[0,r],[12,r*.42]],4,[.185,.13,.075],phase);
  }else if(zone==='C'){
   const col=[.04,.085,.095];
   loft(x,y,z,[[0,r],[h*.64,0]],6,col,phase);loft(x,y+h*.28,z,[[0,r*.76],[h*.64,0]],6,col,phase);
   loft(x,y+h*.66,z,[[0,r*.35],[h*.27,0]],6,[.29,.325,.33],phase);
  }else{
   const plum=random()<.74,col=plum?[.125+random()*.02,.07,.14+random()*.018]:[.105,.135,.115];
   box(x,y,z,3,h*.68,3,[.095,.08,.085]);
   loft(x,y,z,[[h*.46,r*.7],[h*.72,r*1.3],[h*.92,r*.65]],4,col,phase);
  }
 }
 return new Float32Array(data);
}
