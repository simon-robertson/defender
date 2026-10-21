import {newModel,newPart,canonicalModel,VARIANTS} from '../shared/model.js';
import {BOX_SIZE} from '../shared/grid.js';

// Keep the approved sculpt's proportions in its original design coordinates.
// These are a recipe reference, not world units: every boundary is snapped onto
// the final 24-unit grid before authoring cells. No runtime scaling is applied.
const DESIGN_SIZE=32;
const snap=n=>Math.round(n*BOX_SIZE/DESIGN_SIZE);

// Editable source generator for the approved Moss & Porcelain turret family.
// All shapes are unions of occupied integer cells, never overlapping mesh shells.
const M={porcelain:0,forest:1,moss:2,stone:3,red:4,cream:5,ivoryShade:6,
  ivoryDeep:7,metalEdge:8,metalDark:9,mossLight:10,mossDark:11,
  stoneLight:12,stoneShade:13,redLight:14,redShade:15,bore:16};
const palette=[
  ['Porcelain','#F1E8D5'],['Forest mechanism','#243E35'],
  ['Moss panels','#738B55'],['Stone pad','#D9CCAA'],['Vermilion','#D65D45'],
  ['Porcelain highlight','#FAF2E2'],['Porcelain shade','#D2C6AE'],
  ['Porcelain recess','#B4A88F'],['Forest edge','#435D4F'],
  ['Forest recess','#192C26'],['Moss highlight','#8D9E6E'],
  ['Moss shade','#526640'],['Stone highlight','#E8DAB9'],
  ['Stone edge','#B8A47F'],['Vermilion highlight','#E67C60'],
  ['Vermilion shade','#A94B39'],['Muzzle interior','#101C18'],
];
const lightAccents=new Set([M.red,M.redLight,M.redShade]);

function sculpt(part){
  const cells=new Map(),key=(x,y,z)=>x+BOX_SIZE*(z+BOX_SIZE*y);
  function unitBox(x0,y0,z0,x1,y1,z1,material){
    for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
      if(material===null)cells.delete(key(x,y,z));else cells.set(key(x,y,z),[x,y,z,material]);
    }
  }
  function box(x0,y0,z0,x1,y1,z1,material){unitBox(...[x0,y0,z0,x1,y1,z1].map(snap),material);}
  // Corner-stepped prism: axis is the extrusion direction. No diagonal faces.
  function prism(bounds,axis,cut,material){
    unitPrism(bounds.map(snap),axis,snap(cut),material);
  }
  function sideDot(right,y,z,material){
    // Paint an existing outer cell; snapped corner details must not float.
    for(let step=0;step<BOX_SIZE;step++){
      const x=right?BOX_SIZE-1-step:step,cell=cells.get(key(x,y,z));
      if(cell){cell[3]=material;return;}
    }
  }
  function unitPrism(bounds,axis,cut,material){
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
  return {box,prism,unitBox,unitPrism,sideDot,finish};
}

export function turretModel(){
  const model=newModel('turret-study');model.role='defence';model.name='Twin-barrel turret · Moss & Porcelain';model.size[1]=snap(48);
  model.materials=palette.map(([name,color],index)=>({name,color,emission:lightAccents.has(index)?1:0,reflectiveness:0,
    ...(lightAccents.has(index)?{castsLight:true}:{})}));
  for(const [stage,variant] of VARIANTS.entries()){
    const base=newPart('base'),head=newPart('head'),guns=newPart('guns'),lift=stage*3,ring=16+lift;
    base.name='Fixed pedestal';head.name='Yawing shell and trunnion bearings';head.parent='base';head.pivot=[16,ring+3,16].map(snap);
    guns.name='Pitching twin barrels and recoil cradle';guns.parent='head';
    const b=sculpt(base),h=sculpt(head),g=sculpt(guns);

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
      for(const z of [25,28])h.sideDot(right,snap(y+3),snap(z),M.metalDark);
      h.box(x,y+3,21,x+1,y+7+stage,23,M.ivoryShade);
    }
    // Two chunky barrels share a connected pitching cradle, with real bores.
    const muzzle=[4,2,1][stage];
    for(const x of [4,19]){
      // Seven-unit sleeves and centred three-unit bores keep both guns identical
      // after snapping; blind resampling would make their openings asymmetric.
      const bx=snap(x),by=snap(y)+4,bz=snap(muzzle);
      g.unitPrism([bx,by,snap(18),bx+7,by+7,snap(24)],2,1,M.forest);
      g.unitPrism([bx,by,bz+1,bx+7,by+7,snap(18)],2,1,M.porcelain);
      g.unitPrism([bx,by,bz,bx+7,by+7,bz+1],2,1,M.forest);
      g.unitBox(bx+1,by+1,bz,bx+6,by+6,bz+5,M.bore);
      g.unitBox(bx+2,by+2,bz,bx+5,by+5,bz+4,null);
      g.unitBox(bx+1,by+1,bz,bx+6,by+2,bz+1,M.metalEdge);
      if(stage>0){
        g.unitBox(bx+1,by+7,bz+3,bx+6,by+8,snap(17),M.moss);
        g.unitBox(bx,by+2,bz+3,bx+1,by+4,snap(15),M.mossDark);
        g.unitBox(bx+6,by+2,bz+3,bx+7,by+4,snap(15),M.mossDark);
        g.unitBox(bx+1,by+5,snap(16),bx+6,by+6,snap(17),M.ivoryShade);
      }
      if(stage===2){
        g.unitBox(bx+1,by+7,snap(5),bx+6,by+8,snap(18),M.moss);
        g.unitBox(bx+2,by+8,snap(6),bx+5,by+9,snap(17),M.mossDark);
      }
    }
    if(stage===0){
      // Keep the base's small identity cap one cell thick on the final grid.
      h.unitPrism([snap(12),snap(roof+1),snap(24),snap(20),snap(roof+1)+1,snap(30)],1,1,M.moss);
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
    const by=snap(y)+4;guns.pivot=[12,by+3.5,15];
    // Recessed bays leave the stationary shell clear of barrel pitch and recoil.
    // The central undercarriage and rear wall still join the two cheek frames.
    for(const x of [3,14])h.unitBox(x,snap(y)-2,0,x+7,by+13,21,null);
    h.unitBox(10,by,11,14,by+8,21,null);
    g.unitBox(10,by+2,14,14,by+5,17,M.forest);
    // Square bearings enclose the small trunnions with a longitudinal recoil slot.
    for(const x of [2,21]){
      h.unitBox(x,by,10,x+1,by+7,20,M.metalEdge);
      h.unitBox(x,by+1,12,x+1,by+6,19,null);
      g.unitBox(x,by+3,14,x+1,by+4,16,M.metalEdge);
      // Identity stripe moves to the intact rear cheek beside the bearing slot.
      if(stage<2||x===2)h.unitBox(x,by+3,20,x+1,by+6+stage,21,M.red);
    }
    h.unitBox(2,by-2,22,22,by,23,M.porcelain);
    b.finish();h.finish();g.finish();model.variants[variant]={parts:[base,head,guns]};
  }
  return canonicalModel(model);
}
