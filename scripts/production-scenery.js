import {builder} from './model-builder.js';

// Author-time solids, never runtime procedural geometry. Deliberate overlaps
// between sculpting operations are unioned by builder into one occupied cell.
// Every prop has one static rigid part; colour follows forms, not random cells.
const COLORS = {
 A: ['#625B40','#857857','#304B35','#4C693C','#75874B','#929E5C','#C9C3A7','#999E85','#E1D6B8','#EEE5CB','#B17A56','#434731','#B8B89A','#5D7543','#D4CBAE'],
 B: ['#77543D','#9B7750','#244C48','#426E5D','#6D8B68','#95A87C','#C88D58','#9D6745','#DFAC75','#C4B581','#A57051','#514A37','#B78156','#64816A','#E2BD8A'],
 C: ['#575348','#786E5D','#263C35','#3B5548','#D2DCD7','#EFF0E8','#85939A','#5B6973','#AFBBBC','#DFDFCF','#92785A','#39443F','#9AA8AB','#597064','#E2E7DE'],
 D: ['#504343','#74605B','#413246','#654760','#875D7C','#A07894','#87858A','#5F5E69','#ABA6A4','#BECBBB','#986952','#38303D','#959197','#79536E','#C4BAB0'],
};
const MATERIAL_NAMES = ['Trunk','Trunk light','Foliage deep','Foliage','Foliage light','Foliage cap','Stone','Stone shade','Stone light','Flower','Muted accent','Crevice','Stone middle','Foliage middle','Pale mineral'];
const palettes = Object.fromEntries(Object.entries(COLORS).map(([zone, colors]) => [zone, colors.map((color, index) => ({name:MATERIAL_NAMES[index],color,emission:0,reflectiveness:0}))]));

function make(zone, id, name, height) {
 const b=builder(id,name,height,palettes[zone]);
 return {...b, finish(){const m=b.finish();m.role='scenery';return m;}};
}

// Broad chamfered clusters have a few intentional volume steps, not voxel noise.
// The low dark skirt and smaller crown express leaf masses at overview scale.
function canopy(b,x,y,z,w,h,d,main=3,top=4) {
 const cut=Math.min(3,Math.floor(Math.min(w,d)/4));
 b.crown(x+1,y,z+1,x+w-1,y+2,z+d-1,2,Math.max(0,cut-1));
 b.crown(x,y+2,z,x+w,y+h-2,z+d,main,cut);
 b.crown(x+1,y+h-2,z+1,x+w-1,y+h,z+d-1,top,Math.max(0,cut-1));
}

function roots(b,x,z,width=4) {
 b.crown(x-2,0,z-1,x+width+2,2,z+width+1,0,2);
 b.box(x,0,z-3,x+width,2,z+width+3,0);
 b.box(x+1,0,z-2,x+width-1,3,z+width+2,1);
}

function oak(id,tall=false,young=false) {
 const b=make('A',id,young?'Oak · young forked crown':tall?'Oak · open high canopy':'Oak · spreading branch canopy',young?32:tall?54:44);
 if(young) {
  roots(b,10,10,3);b.box(10,1,10,13,18,13,0);b.box(10,2,10,11,15,11,1);
  b.box(7,12,11,11,15,13,0);b.box(7,14,11,10,21,13,0);b.box(12,16,11,17,19,13,0);
  canopy(b,3,17,7,11,8,12,3,4);canopy(b,11,21,5,10,9,12,4,5);canopy(b,8,25,12,10,7,9,3,4);
 } else {
  const lift=tall?10:0;
  roots(b,10,10);b.box(10,1,10,14,24+lift,14,0);b.box(10,3,10,11,21+lift,11,1);
  // Three visible staggered branch forks carry separated canopy lobes.
  b.box(6,13+lift,10,11,17+lift,13,0);b.box(5,16+lift,10,8,24+lift,13,0);
  b.box(13,19+lift,11,19,22+lift,14,0);b.box(16,21+lift,11,19,29+lift,14,0);
  b.box(11,22+lift,13,14,25+lift,20,0);b.box(11,24+lift,17,14,30+lift,20,0);
  if(tall) {
   b.box(11,38,17,14,43,20,0);
   canopy(b,2,30,7,10,9,13,3,4);canopy(b,13,37,2,10,12,13,3,4);
   canopy(b,5,41,14,14,9,9,4,4);canopy(b,6,47,5,11,7,11,3,5);
   canopy(b,2,40,3,7,7,8,3,4);
  } else {
   canopy(b,1,20,6,12,10,14,3,4);canopy(b,12,25,3,11,12,13,3,4);
   canopy(b,7,28,12,14,11,11,4,4);canopy(b,5,34,5,13,10,12,3,5);
   // Break a straight silhouette with one quiet secondary branch mass.
   canopy(b,1,29,3,8,7,8,3,4);
  }
 }
 return b.finish();
}

function cypress(short=false) {
 const b=make('A',short?'scenery-cypress-short':'scenery-cypress',short?'Cypress · forked young column':'Cypress · tapered broken column',short?37:58);
 roots(b,10,10,3);b.box(10,0,10,13,short?22:36,13,0);
 const tiers=short?[[6,7,6,12,13,12],[8,17,8,9,12,9],[10,27,9,5,10,6]]:[[6,10,7,12,18,11],[7,25,6,10,18,12],[9,40,8,7,12,8],[10,50,10,4,8,4]];
 for(let i=0;i<tiers.length;i++) canopy(b,...tiers[i],i<2?3:4,i===tiers.length-1?5:4);
 b.erase(6,short?9:14,6,9,short?13:18,9);
 return b.finish();
}

function wall(zone) {
 const ids={A:'scenery-ruin-wall',B:'ochre-wall',C:'ice-wall',D:'plum-wall'};
 const b=make(zone,ids[zone],{A:'Limestone · broken mossy courses',B:'Sandstone · eroded buttress wall',C:'Slate · snow-lipped broken wall',D:'Cloister · buttressed ruin wall'}[zone],zone==='C'?27:26);
 if(zone==='A') {
  b.box(1,0,8,23,3,16,7);
  // Recessed mortar core supports offset courses; the open front joints retain
  // genuine depth without creating disconnected, floating masonry blocks.
  b.box(2,3,11,22,19,14,7);
  for(const [x,y,z,w,h,d,m] of [[2,3,9,9,5,6,6],[12,3,9,10,5,6,12],[1,8,10,6,6,5,8],[8,9,9,8,6,6,6],[17,8,9,6,6,6,6],[2,15,10,10,6,5,6],[13,16,10,9,4,5,8],[3,21,10,6,3,5,12]]) b.box(x,y,z,x+w,y+h,z+d,m);
  b.box(3,24,10,7,25,14,4);b.box(15,20,11,20,21,15,13);b.box(2,5,8,4,10,9,3);
  b.box(19,0,7,23,2,10,8);b.box(5,0,16,10,2,19,12);
 } else if(zone==='B') {
  b.crown(1,0,7,23,4,17,7,2);b.box(2,4,9,22,10,15,6);
  b.box(3,11,9,13,17,15,6);b.box(14,10,10,22,14,15,12);
  b.box(4,17,10,12,21,15,8);b.box(5,21,10,10,23,14,6);
  b.box(2,2,7,6,15,17,7);b.box(3,15,8,6,18,16,12);
  b.box(18,2,7,22,11,17,7);b.box(18,11,8,21,14,16,8);
  b.erase(10,5,8,11,10,11);b.erase(4,18,9,7,21,11);
 } else if(zone==='C') {
  b.box(1,0,8,23,4,17,7);
  b.box(3,4,11,20,19,14,7);
  for(const [x,y,w,h,m] of [[2,4,9,6,6],[12,4,10,6,12],[2,10,5,7,7],[8,11,9,6,6],[18,10,4,5,6],[3,18,8,6,6],[12,17,8,3,8]]) b.box(x,y,9,x+w,y+h,16,m);
  b.box(3,24,9,11,26,16,5);b.box(12,20,9,20,22,16,5);b.box(18,15,9,22,17,16,14);
  b.box(2,18,9,4,21,15,4);b.box(10,22,9,12,24,12,14);b.box(4,1,17,9,3,20,4);
 } else {
  b.box(1,0,8,23,3,17,7);b.box(3,3,10,21,9,15,6);
  b.box(3,9,10,10,15,15,12);b.box(11,9,10,21,15,15,6);
  b.box(4,16,10,15,21,15,6);b.box(16,16,10,20,19,15,8);
  b.box(2,3,8,6,22,17,7);b.box(3,4,8,5,20,9,12);b.box(1,21,7,7,24,18,8);
  b.box(18,3,8,22,16,17,7);b.box(17,15,7,23,18,18,8);
  b.box(7,0,17,11,2,20,6);b.box(12,0,6,17,2,9,12);
 }
 return b.finish();
}

function pillar(zone,broken=false) {
 const id=zone==='A'?'scenery-ruin-pillar':broken?'ice-pillar-broken':'ice-pillar';
 const b=make(zone,id,zone==='A'?'Limestone · fractured garden pillar':broken?'Slate · broken snow pillar':'Slate · fractured snow monolith',zone==='A'?37:broken?23:40);
 if(zone==='A') {
  b.crown(5,0,5,19,3,19,7,2);b.box(7,3,7,17,6,17,8);
  b.box(8,6,8,16,15,16,6);b.box(8,16,8,16,26,16,12);
  b.box(7,14,7,17,16,17,8);b.box(6,26,6,18,29,18,8);
  b.box(7,29,7,16,34,16,6);b.box(8,34,8,13,36,14,6);
  b.erase(7,31,13,10,34,17);b.box(9,36,9,13,37,13,4);b.box(13,29,15,15,32,16,13);
  b.box(3,0,15,7,3,20,6);b.box(16,0,3,21,2,7,8);
 } else {
  const cap=broken?18:35;
  b.crown(3,0,4,21,5,21,7,3);b.crown(6,5,6,19,cap,18,6,2);
  b.box(4,4,7,8,broken?13:27,15,12);b.box(15,5,10,20,broken?12:23,17,7);
  b.erase(11,7,5,13,cap-3,9);b.erase(16,cap-5,14,20,cap,19);
  b.crown(7,cap,7,16,cap+3,16,5,1);b.box(5,broken?13:27,8,8,broken?15:29,15,14);
  b.box(15,broken?12:23,10,20,broken?14:25,16,4);
  b.box(4,2,18,9,4,22,14);
 }
 return b.finish();
}

function rock(zone) {
 const b=make(zone,{A:'scenery-rock',B:'ochre-rock',C:'ice-rock',D:'plum-rock'}[zone],{A:'Limestone · split low ledge',B:'Sandstone · wind-cut shelves',C:'Slate · snow-filled fractured ledge',D:'Cloister · fractured low crag'}[zone],zone==='C'?14:12);
 if(zone==='A') {
  b.crown(2,0,5,20,5,21,7,3);b.crown(4,4,4,16,9,17,6,2);b.crown(11,2,2,22,7,12,12,2);
  b.box(6,9,6,13,11,14,8);b.box(6,11,8,11,12,13,13);b.erase(13,5,4,15,9,8);
 } else if(zone==='B') {
  b.crown(1,0,4,23,4,20,7,2);b.crown(3,4,3,19,7,18,6,2);b.crown(7,7,5,18,10,16,8,2);
  b.box(10,10,7,16,12,14,6);b.box(18,3,11,22,6,18,12);b.erase(5,3,3,7,7,8);
 } else if(zone==='C') {
  b.crown(2,0,4,20,4,22,7,3);b.box(5,4,5,12,11,16,6);b.crown(12,3,8,21,9,20,12,1);
  b.box(6,11,6,12,14,16,5);b.box(12,9,10,20,11,19,14);b.box(3,4,14,6,6,20,4);
  b.box(14,0,2,19,3,6,6);b.box(15,3,3,19,4,6,14);
 } else {
  b.crown(2,0,3,21,4,21,7,3);b.crown(4,4,4,14,10,18,6,1);b.crown(15,3,8,22,8,20,12,1);
  b.box(5,10,7,12,12,15,8);b.box(11,4,5,16,7,13,7);b.erase(12,5,7,15,9,11);
  b.box(2,0,16,6,2,22,12);
 }
 return b.finish();
}

function shrub(zone) {
 const b=make(zone,{A:'scenery-shrub',B:'ochre-shrub',C:'ice-shrub',D:'plum-shrub'}[zone],{A:'Woodland · branching low shrub',B:'Desert · spreading dry scrub',C:'Alpine · snow-pocket dwarf fir',D:'Plum · open low shrub'}[zone],zone==='A'?10:zone==='C'?11:9);
 if(zone==='B') {
  b.box(10,0,11,13,5,14,0);b.box(6,3,11,17,5,13,0);b.box(10,2,7,12,4,18,0);
  canopy(b,3,3,9,8,5,7,3,4);canopy(b,12,4,6,8,5,8,13,4);canopy(b,8,1,14,9,5,7,2,3);
 } else if(zone==='C') {
  b.box(10,0,10,13,8,13,0);b.crown(3,2,7,19,5,19,2,3);b.crown(6,4,4,21,8,15,3,3);
  b.crown(8,8,7,17,10,13,5,2);b.box(5,5,10,10,7,17,14);b.box(12,10,9,15,11,12,5);
 } else {
  b.box(10,0,11,13,6,14,0);b.box(6,3,11,17,5,13,0);
  canopy(b,3,2,8,9,6,11,3,4);canopy(b,12,3,5,9,6,10,3,zone==='D'?5:4);canopy(b,11,1,14,7,5,7,2,3);
  if(zone==='A')b.box(5,8,11,8,10,14,4);
 }
 return b.finish();
}

function cactus(young=false) {
 const b=make('B',young?'ochre-cactus-young':'ochre-cactus',young?'Cactus · young fork':'Cactus · ribbed unequal branches',young?28:46);
 const column=(x,y,z,w,h)=>{
  b.crown(x,y,z,x+w,y+h-2,z+w,3,1);b.crown(x+1,y+h-2,z+1,x+w-1,y+h,z+w-1,4,0);
  b.box(x+1,y+1,z,x+2,y+h-3,z+1,13);b.box(x,y+1,z+2,x+1,y+h-4,z+3,2);
 };
 column(9,0,9,7,young?28:45);b.box(11,0,9,13,young?24:40,10,4);
 if(young) {
  b.box(15,10,10,20,14,14,3);column(18,11,9,5,10);
 } else {
  b.box(4,14,10,10,19,15,3);column(2,15,9,6,18);
  b.box(15,23,10,21,28,15,3);column(18,24,9,5,15);
  b.box(10,0,15,14,4,17,2);
 }
 return b.finish();
}

function mesa(low=false) {
 const b=make('B',low?'ochre-mesa-low':'ochre-mesa',low?'Sandstone · broad eroded terrace':'Sandstone · cleft weathered towers',low?26:47);
 b.crown(1,0,2,23,5,23,7,3);
 if(low) {
  b.crown(2,5,4,21,12,22,6,2);b.crown(4,12,3,19,18,19,12,2);b.crown(6,18,5,17,24,17,6,2);
  b.box(7,24,7,16,26,16,8);b.box(18,5,10,23,10,19,8);b.erase(3,7,9,6,14,12);
 } else {
  b.crown(3,5,3,16,22,19,6,2);b.crown(4,22,4,15,40,17,6,2);b.crown(5,40,5,14,46,16,8,1);
  b.crown(14,4,10,23,18,22,12,1);b.crown(15,18,12,22,31,21,6,1);b.box(16,31,13,21,34,20,8);
  b.crown(1,4,15,9,17,23,6,1);b.box(2,17,16,8,20,22,8);
  // Large vertical fracture and restrained sediment shelves avoid a tiered cake.
  b.erase(12,8,14,15,28,18);b.erase(4,27,3,6,39,8);
  b.box(3,14,4,4,16,13,8);b.box(5,26,4,13,28,5,12);b.box(16,15,11,21,17,12,8);
  b.box(7,46,8,12,47,13,6);
 }
 return b.finish();
}

function fir(young=false) {
 const b=make('C',young?'ice-fir-young':'ice-fir',young?'Fir · young wind-shaped branches':'Fir · separated snow-laden boughs',young?34:58);
 roots(b,10,10,3);b.box(10,0,10,13,young?31:55,13,0);b.box(10,2,10,11,young?23:43,11,1);
 const tiers=young?[[5,8,7,0],[12,6,6,1],[19,4,4,0],[25,2,2,0]]:[[9,11,9,0],[19,9,8,1],[29,7,6,-1],[38,5,5,0],[46,3,3,0],[52,1,1,0]];
 for(const [y,rx,rz,shift] of tiers) {
  const cx=12+shift,cz=12;
  b.crown(cx-rx,y,cz-rz,cx+rx,y+3,cz+rz,2,Math.min(3,rx-1));
  if(rx>2) {
   b.crown(cx-rx+2,y+3,cz-rz+1,cx+rx-1,y+6,cz+rz-1,3,Math.max(0,Math.min(2,rx-3)));
   b.crown(cx-rx+2,y+6,cz-rz+2,cx+rx-2,y+8,cz+rz-1,5,Math.max(0,Math.min(2,rx-3)));
   b.box(cx-rx+1,y+3,cz-1,cx-rx+4,y+5,cz+3,14);
   b.box(cx+rx-3,y+3,cz-rz+2,cx+rx-1,y+4,cz,4);
  } else {
   b.box(cx-rx,y+3,cz-rz,cx+rx,y+5,cz+rz,3);b.box(cx-rx,y+5,cz-rz,cx+rx,y+6,cz+rz,5);
  }
 }
 return b.finish();
}

function plumTree(tall=false,young=false) {
 const b=make('D',young?'plum-tree-young':tall?'plum-tree-tall':'plum-tree',young?'Plum · young spreading fork':tall?'Plum · airy high branches':'Plum · offset umbrella canopy',young?32:tall?52:42);
 roots(b,10,10,3);const lift=tall?10:0;
 b.box(10,1,10,13,young?17:23+lift,13,0);b.box(10,3,10,11,young?15:20+lift,11,1);
 if(young) {
  b.box(5,13,10,11,16,13,0);b.box(5,15,10,8,23,13,0);b.box(12,16,10,19,19,13,0);b.box(16,18,10,19,25,13,0);
  canopy(b,2,20,6,12,7,12,3,4);canopy(b,12,24,7,10,8,12,4,5);
 } else {
  b.box(4,17+lift,10,11,20+lift,13,0);b.box(4,19+lift,10,7,29+lift,13,0);
  b.box(12,21+lift,11,20,24+lift,14,0);b.box(17,23+lift,11,20,30+lift,14,0);
  b.box(10,22+lift,13,13,25+lift,20,0);b.box(10,24+lift,17,13,34+lift,20,0);
  if(tall) {
   canopy(b,1,36,5,10,8,13,3,4);canopy(b,14,37,7,9,9,12,3,5);
   canopy(b,6,44,13,12,8,10,4,5);canopy(b,8,41,2,8,7,8,3,4);
  } else {
   canopy(b,1,26,4,12,9,13,3,4);canopy(b,13,27,6,10,9,13,3,5);
   canopy(b,6,34,12,13,8,11,4,5);canopy(b,7,31,2,9,7,9,3,4);
  }
 }
 return b.finish();
}

function arch(broken=false) {
 const b=make('D',broken?'plum-arch-broken':'plum-arch',broken?'Cloister · broken arch spring':'Cloister · stepped open arch',broken?27:43);
 b.box(1,0,7,9,3,18,7);b.box(16,0,7,23,3,18,7);
 b.box(3,3,9,8,19,16,6);b.box(17,3,9,21,broken?11:19,16,12);
 b.box(2,9,8,9,11,17,8);b.box(16,9,8,22,11,17,8);
 b.box(2,19,8,9,22,17,8);
 if(broken) {
  b.box(4,22,9,11,25,16,6);b.box(5,25,10,9,27,15,12);
  b.box(17,11,9,21,14,16,6);b.box(11,0,9,15,3,16,8);b.box(8,0,18,13,2,21,6);
 } else {
  b.box(16,19,8,22,22,17,8);b.box(3,22,9,9,28,16,6);b.box(16,22,9,21,28,16,6);
  b.box(5,28,9,11,33,16,12);b.box(14,28,9,20,33,16,6);
  b.box(8,33,9,17,38,16,6);b.box(10,31,8,14,40,17,8);
  b.box(8,38,10,17,41,15,12);b.box(10,41,10,15,43,15,6);
  b.erase(3,25,14,5,28,17);b.box(2,0,17,6,2,21,12);
 }
 return b.finish();
}

function details(zone,type) {
 const id=zone==='A'?`detail-${type==='tuft'?'grass':type}`:`${{B:'ochre',C:'ice',D:'plum'}[zone]}-${type}`;
 const b=make(zone,id,`${{A:'Woodland',B:'Desert',C:'Alpine',D:'Plum'}[zone]} · ${type==='tuft'?'low shoots':type==='flowers'?'small flowering stems':'broken stone fragments'}`,type==='tuft'?8:type==='flowers'?6:4);
 if(type==='pebbles') {
  if(zone==='B') {b.crown(6,0,7,12,2,12,6,1);b.box(7,2,8,11,3,11,8);b.box(14,0,13,19,1,17,12);b.box(15,1,14,18,2,16,6);b.box(11,0,16,13,1,18,8);}
  else if(zone==='C') {b.box(7,0,7,11,3,12,7);b.box(8,3,8,11,4,11,14);b.box(14,0,13,18,2,17,6);b.box(15,2,14,18,3,17,4);b.box(11,0,15,13,2,18,12);}
  else if(zone==='D') {b.crown(6,0,8,12,3,13,6,1);b.box(8,3,9,11,4,12,8);b.box(15,0,13,18,2,18,7);b.box(12,0,6,15,1,9,12);}
  else {b.crown(6,0,7,12,3,13,6,1);b.box(7,3,8,11,4,11,8);b.box(15,0,13,18,2,17,12);b.box(11,0,16,14,1,19,7);}
 } else if(type==='tuft') {
  if(zone==='B') {
   b.box(10,0,10,14,4,14,2);b.box(7,1,10,11,3,12,3);b.box(6,2,10,8,5,12,4);b.box(13,1,12,17,3,14,3);b.box(16,2,12,18,5,14,4);
   b.box(11,2,6,13,4,11,3);b.box(11,3,5,13,6,7,4);b.box(10,2,13,12,4,17,3);b.box(10,3,16,12,6,18,4);b.box(11,3,10,13,8,12,13);
  } else {
   const shoots=zone==='C'?[[8,10,3],[11,8,5],[14,12,4],[12,16,3]]:zone==='D'?[[8,11,5],[12,8,6],[15,12,4],[10,16,5]]:[[8,10,5],[11,8,7],[14,12,6],[11,16,4]];
   for(const [x,z,h] of shoots) {b.box(x,0,z,x+1,h,z+1,zone==='C'?3:2);b.box(x,h-2,z-1,x+2,h,z,zone==='D'?4:13);if(zone==='C')b.box(x,h-1,z,x+1,h,z+1,4);}
  }
 } else {
  const stems=zone==='A'?[[8,9,3],[14,12,4],[10,16,2]]:zone==='B'?[[9,10,2],[15,14,3]]:zone==='C'?[[9,9,2],[14,14,3]]:[[9,11,3],[15,14,2],[12,7,2]];
  for(const [x,z,h] of stems) {
   b.box(x,0,z,x+1,h,z+1,3);b.box(x-1,1,z,x,2,z+2,zone==='D'?4:13);
   b.box(x-1,h,z,x+2,h+1,z+1,9);b.box(x,h,z-1,x+1,h+1,z+2,9);b.box(x,h,z,x+1,h+1,z+1,zone==='C'?12:zone==='B'?10:4);
  }
 }
 return b.finish();
}

/** All current category IDs remain stable; extra IDs are repeated-mesh variants. */
export function productionSceneryModels(zone) {
 if(zone!==undefined&&!Object.hasOwn(COLORS,zone))throw new Error(`Unknown production scenery zone: ${zone}`);
 const result=[];
 for(const current of zone?[zone]:['A','B','C','D']) {
  if(current==='A')result.push(oak('scenery-oak'),oak('scenery-oak-tall',true),cypress(),pillar('A'),oak('scenery-oak-young',false,true),cypress(true));
  if(current==='B')result.push(cactus(),mesa(),cactus(true),mesa(true));
  if(current==='C')result.push(fir(),pillar('C'),fir(true),pillar('C',true));
  if(current==='D')result.push(plumTree(),plumTree(true),arch(),plumTree(false,true),arch(true));
  result.push(wall(current),rock(current),shrub(current),details(current,'tuft'),details(current,'flowers'),details(current,'pebbles'));
 }
 return result;
}
