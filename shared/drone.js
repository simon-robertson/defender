import {DEFENCE_STATS} from './defence.js';
import {DRONE_HULL} from './drone-model.js';

// User-approved base timing/damage. Navigation/aim values below are provisional
// A1 test tuning, kept separate from both the model and unassigned upgrades.
const roundsPerSecond=4;
export const DRONE_TUNING=Object.freeze({
 base:Object.freeze({
  flightSeconds:20,
  flightStartsAt:'launch',
  returnConsumesFlightTime:false,
  finishBurstBeforeReturn:true,
  rechargeSeconds:10,
  weapon:Object.freeze({
   strength:DEFENCE_STATS['turret-study'].base.strength,
   shotsPerBurst:10,
   roundsPerSecond,
   shotIntervalSeconds:1/roundsPerSecond,
   // Starts after the last actual round. Flight expiry never requires waiting
   // out this cooldown: finish an active valid burst, then begin returning.
   cooldownSeconds:5,
   delivery:'hitscan',projectile:null,
  }),
 }),
 upgrade1:null,
 upgrade2:null,
});
export const DRONE_PREVIEW=Object.freeze({
 maxRange:72,speed:72,lift:24,verticalSpeed:48,step:12,
 // Horizontal yaw enclosure and proved level-body vertical fan/gun envelope.
 hullRadius:DRONE_HULL.radius,hullBelow:DRONE_HULL.below,hullAbove:DRONE_HULL.above,transitLayers:Object.freeze([24,48,72,96]),
 rotorSpeed:28,replanSeconds:.4,
 acceleration:96,braking:120,turnAcceleration:84,cornerRadius:18,
 stationGain:24,stationMargin:4,fanResponse:10.5,fanYawShare:.3,
 stationShortlist:12,minimumUsefulPulses:3,urgentSwitchRatio:2,escapeEmergencySeconds:6,
 bodyTurn:Object.freeze({maxSpeed:.825*Math.PI,acceleration:2.25*Math.PI}),
 fineYaw:Object.freeze({min:-15*Math.PI/180,max:15*Math.PI/180,maxSpeed:2*Math.PI,acceleration:12*Math.PI}),
 pitch:Object.freeze({min:-35*Math.PI/180,max:10*Math.PI/180,maxSpeed:Math.PI,acceleration:8*Math.PI}),
 aimTolerance:2*Math.PI/180,
});
