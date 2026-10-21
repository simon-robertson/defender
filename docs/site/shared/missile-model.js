// Authored geometry contract only. Combat timing and guidance live elsewhere.
const point=(x,y,z)=>Object.freeze([x,y,z]);
export const GUIDED_MISSILE_MODEL=Object.freeze({
 id:'guided-missile',variant:'base',part:'body',origin:point(12,0,12),
 forward:point(0,1,0),exhaust:point(12,0,12),height:10,radius:Math.sqrt(5),
});
export const MISSILE_LAUNCHER_DECK_Y=Object.freeze({base:14,upgrade1:18,upgrade2:22});
export const MISSILE_LAUNCHER_SOCKETS=Object.freeze({
 base:Object.freeze([point(7,7,12),point(17,7,12)]),
 upgrade1:Object.freeze([point(7,11,7),point(17,11,7),point(7,11,17),point(17,11,17)]),
 upgrade2:Object.freeze([point(7,15,5),point(17,15,5),point(7,15,12),point(17,15,12),point(7,15,19),point(17,15,19)]),
});
// A six-unit square well leaves one unit around the widest tail fins. A root
// three units above the deck leaves the complete cross-section above the body
// during the initial turn from vertical. This is ten units above every seat.
export const MISSILE_WELL_HALF_WIDTH=3;
export const MISSILE_LAUNCHER_CLEAR_Y=Object.freeze({base:17,upgrade1:21,upgrade2:25});
