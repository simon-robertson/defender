import {newModel,newPart,canonicalModel,VARIANTS} from '../shared/model.js';

// Editable source generator for the approved Moss & Porcelain turret family.
// All shapes are unions of occupied integer cells, never overlapping mesh shells.
const M={porcelain:0,forest:1,moss:2,stone:3,red:4,cream:5,ivoryShade:6,
  ivoryDeep:7,metalEdge:8,metalDark:9,mossLight:10,mossDark:11,
  stoneLight:12,stoneShade:13,redLight:14,redShade:15,bore:16};
const palette=[
  ['Porcelain','#F1E8D5',.18],['Forest mechanism','#243E35',.45],
  ['Moss panels','#738B55',.15],['Stone pad','#D9CCAA',.08],['Vermilion','#D65D45',.18],
  ['Porcelain highlight','#FAF2E2',.18],['Porcelain shade','#D2C6AE',.18],
  ['Porcelain recess','#B4A88F',.15],['Forest edge','#435D4F',.45],
  ['Forest recess','#192C26',.4],['Moss highlight','#8D9E6E',.15],
  ['Moss shade','#526640',.15],['Stone highlight','#E8DAB9',.08],
  ['Stone edge','#B8A47F',.08],['Vermilion highlight','#E67C60',.18],
  ['Vermilion shade','#A94B39',.18],['Muzzle interior','#101C18',.1],
];

function sculpt(part){
  const cells=new Map(),key=(x,y,z)=>x+32*(z+32*y);
  function box(x0,y0,z0,x1,y1,z1,material){
    for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
      if(material===null)cells.delete(key(x,y,z));else cells.set(key(x,y,z),[x,y,z,material]);
    }
  }
  // Corner-stepped prism: axis is the extrusion direction. No diagonal faces.
  function prism(bounds,axis,cut,material){
    const [x0,y0,z0,x1,y1,z1]=bounds,lo=[x0,y0,z0],hi=[x1,y1,z1],u=(axis+1)%3,v=(axis+2)%3;
    for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
      const p=[x,y,z],du=Math.min(p[u]-lo[u],hi[u]-1-p[u]),dv=Math.min(p[v]-lo[v],hi[v]-1-p[v]);
      if(du+dv>=cut)cells.set(key(x,y,z),[x,y,z,material]);
    }
  }
  function finish(){
    // A few broad top-plane tints retain material variation under changing light.
    const tops=new Map([[M.porcelain,M.cream],[M.moss,M.mossLight],[M.stone,M.stoneLight],[M.forest,M.metalEdge]]);
    for(const c of cells.values())if(tops.has(c[3])&&!cells.has(key(c[0],c[1]+1,c[2])))c[4]=[-1,-1,tops.get(c[3]),-1,-1,-1];
    part.voxels=Array.from(cells.values());
  }
  return {box,prism,finish};
}

export function turretModel(){
  const model=newModel('turret-study');model.name='Twin-barrel turret · Moss & Porcelain';model.size[1]=48;
  model.materials=palette.map(([name,color,reflectiveness])=>({name,color,emission:0,reflectiveness}));
  for(const [stage,variant] of VARIANTS.entries()){
    const base=newPart('base'),head=newPart('head'),lift=stage*3,ring=16+lift;
    base.name='Fixed pedestal';head.name='Rotating twin-barrel assembly';head.parent='base';head.pivot=[16,ring+3,16];
    const b=sculpt(base),h=sculpt(head);

    // Constant mounting footprint, with stone layers and inset moss corner caps.
    b.prism([1,0,1,31,2,31],1,1,M.stoneShade);
    b.prism([1,2,1,31,3,31],1,1,M.stone);
    b.prism([4,3,4,28,4,28],1,2,M.metalDark);
    for(const x of [1,27])for(const z of [1,27])b.box(x,0,z,x+4,3,z+4,M.mossDark);

    // Tapered armour: intentional broad steps instead of a noisy stair every cell.
    for(let y=4;y<ring;y++){
      const inset=7+Math.min(3,Math.floor((y-4)*4/(ring-4)));
      b.prism([inset,y,inset,32-inset,y+1,32-inset],1,2,M.porcelain);
      // Structural green ribs on four corners of the cream pedestal.
      for(const x of [inset,inset+1,30-inset,31-inset])for(const z of [inset,inset+1,30-inset,31-inset]){
        if(Math.min(x-inset,31-inset-x)+Math.min(z-inset,31-inset-z)>=2)b.box(x,y,z,x+1,y+1,z+1,M.mossDark);
      }
    }
    for(const x of [6,22])for(const z of [6,22]){
      b.prism([x,3,z,x+4,6,z+4],1,1,M.forest);
      b.box(x+1,6,z+1,x+3,7,z+3,M.metalEdge);
    }
    // Paint inset panels on the actual stepped surface, preserving the taper.
    for(let y=5;y<ring;y++){
      const inset=7+Math.min(3,Math.floor((y-4)*4/(ring-4)));
      for(const x of [inset+2,29-inset])b.box(x,y,inset,x+1,y+1,inset+1,M.mossDark);
      for(const z of [inset+2,29-inset]){
        b.box(inset,y,z,inset+1,y+1,z+1,M.moss);
        b.box(31-inset,y,z,32-inset,y+1,z+1,M.moss);
      }
      if(y>=7&&y<ring-2){
        b.box(13,y,inset,19,y+1,inset+1,M.ivoryShade);
        if(y>=8&&y<ring-3)b.box(14,y,inset,18,y+1,inset+1,M.ivoryDeep);
        if(y>=9&&y<ring-4)b.box(15,y,inset,17,y+1,inset+1,M.red);
      }
    }
    if(stage>0){
      b.box(22,6,12,24,13+lift,20,M.moss);
      b.box(8,6,12,10,13+lift,20,M.moss);
      for(const z of [13,18]){b.box(24,8,z,25,9,z+1,M.metalDark);b.box(7,8,z,8,9,z+1,M.metalDark);}
    }
    if(stage===2){
      b.box(14,4,7,18,8,9,M.porcelain);

    }
    // Exposed bearing bands. All fixed cells finish below the yawing assembly.
    b.prism([9,ring,9,23,ring+1,23],1,3,M.forest);
    b.prism([8,ring+1,8,24,ring+2,24],1,4,M.metalEdge);
    b.prism([9,ring+2,9,23,ring+3,23],1,3,M.metalDark);
    h.prism([10,ring+3,10,22,ring+4,22],1,3,M.forest);

    const y=23+lift,roof=33+lift+stage,side=stage===2?1:3;
    // Rear breech and stepped cream shell, kept distinct from the fixed support.
    h.prism([7,ring+4,15,25,y+2,29],1,2,M.ivoryShade);
    h.prism([side,y,19,32-side,roof-1,31],1,2,M.ivoryShade);
    h.prism([side+1,y+2,19,31-side,roof,30],1,2,M.porcelain);
    h.prism([7,y+4,20,25,roof+1,30],1,1,M.porcelain);
    h.box(14,y+1,17,18,y+6,22,M.forest);
    // Cheek panels, recessed fasteners and a small vermilion identity stripe.
    for(const right of [false,true]){
      const x=right?31-side:side;
      h.prism([x,y+1,24,x+1,roof-2,30],0,1,M.moss);
      for(const z of [25,28])h.box(x,y+3,z,x+1,y+4,z+1,M.metalDark);
      h.box(x,y+3,21,x+1,y+7+stage,23,M.red);
    }
    // Two identical, separate, chunky barrels with actual recessed open bores.
    const muzzle=[4,2,1][stage];
    for(const x of [4,19]){
      h.prism([x,y,18,x+9,y+9,24],2,1,M.forest);
      h.prism([x,y,muzzle+2,x+9,y+9,18],2,1,M.porcelain);
      h.prism([x,y,muzzle,x+9,y+9,muzzle+2],2,1,M.forest);
      // Inner walls remain dark for the full cavity, with a recessed back wall.
      h.box(x+1,y+1,muzzle,x+8,y+8,muzzle+7,M.bore);
      h.box(x+2,y+2,muzzle,x+7,y+7,muzzle+6,null);
      h.box(x+1,y+1,muzzle,x+8,y+2,muzzle+1,M.metalEdge);
      if(stage>0){
        h.box(x+2,y+9,muzzle+4,x+7,y+10,17,M.moss);
        h.box(x,y+2,muzzle+5,x+1,y+5,15,M.mossDark);
        h.box(x+8,y+2,muzzle+5,x+9,y+5,15,M.mossDark);
        // Recessed sleeve seam and narrow top break, not floating overlay faces.
        h.box(x+1,y+6,16,x+8,y+7,17,M.ivoryShade);
      }
      if(stage===2){
        h.box(x+1,y+9,5,x+8,y+10,18,M.moss);
        h.box(x+2,y+10,6,x+7,y+11,17,M.mossDark);
      }
    }
    if(stage===0){
      h.prism([12,roof+1,24,20,roof+2,30],1,1,M.moss);
    }else{
      // Raised observation housing visible in the approved upgrades, not a weapon.
      h.prism([11,roof+1,24,21,roof+4,31],1,1,M.porcelain);
      h.box(13,roof+1,24,19,roof+3,25,M.metalDark);
      h.box(14,roof+1,24,15,roof+2,25,M.metalEdge);
      h.box(17,roof+1,24,18,roof+2,25,M.metalEdge);
      h.prism([12,roof+4,25,20,roof+5,30],1,1,M.moss);
      if(stage===2){
        for(const x of [5,23]){
          h.prism([x,roof-1,21,x+4,roof+2,29],0,1,M.mossDark);
          h.box(x+1,roof+2,23,x+3,roof+3,27,M.moss);
        }
        h.box(12,roof+1,21,13,roof+3,24,M.porcelain);
        h.box(19,roof+1,21,20,roof+3,24,M.porcelain);
        h.box(12,roof+3,21,20,roof+4,23,M.porcelain);
      }
    }
    b.finish();h.finish();model.variants[variant]={parts:[base,head]};
  }
  return canonicalModel(model);
}
