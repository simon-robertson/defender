// Provisional turret firing data. Turret upgrade 2 remains unassigned.
// Turret damage is instant-hit; there is no travelling projectile.
export const TURRET_FIRING=Object.freeze({
 base:Object.freeze({shotsPerBurst:1,shotIntervalSeconds:0,cooldownSeconds:1,delivery:'hitscan',projectile:null}),
 upgrade1:Object.freeze({shotsPerBurst:3,shotIntervalSeconds:.12,cooldownSeconds:1,delivery:'hitscan',projectile:null}),
 upgrade2:null,
});
// The model faces local -Z. Recoil follows the pitched guns along local +Z.
export const TURRET_RECOIL=Object.freeze({part:'guns',distance:1.25,kickSeconds:.045,returnSeconds:.24});
// Provisional weighted aiming limits: 360 degrees/s, 2400 degrees/s².
// Shared by rest-to-rest random studies and continuous live-target tracking.
export const TURRET_TURN=Object.freeze({part:'head',maxSpeed:Math.PI*2,acceleration:Math.PI*2400/180});
// Positive local X raises forward -Z. Mechanical limits are eligibility limits,
// never a substitute angle for an unreachable target.
export const TURRET_PITCH=Object.freeze({part:'guns',min:-35*Math.PI/180,max:35*Math.PI/180,maxSpeed:Math.PI,acceleration:Math.PI*1200/180,tolerance:2*Math.PI/180});
// Provisional angular gate for the moving-target firing preview.
export const TURRET_AIM_TOLERANCE=2*Math.PI/180;
// Guns-part local centres of the actual three-unit muzzle openings, facing -Z.
// Each shot is one damage event; the paired flashes express the twin-barrel model.
export const TURRET_MUZZLES=Object.freeze({
 base:Object.freeze([Object.freeze([6.5,24.5,3]),Object.freeze([17.5,24.5,3])]),
 upgrade1:Object.freeze([Object.freeze([6.5,27.5,2]),Object.freeze([17.5,27.5,2])]),
 upgrade2:Object.freeze([Object.freeze([6.5,29.5,1]),Object.freeze([17.5,29.5,1])]),
});

// One validated lightning pulse is one hitscan damage event, regardless of
// visual segments or sparks. Cooldown begins after the last actual pulse.
export const ARC_SPIRE_FIRING=Object.freeze({
 base:Object.freeze({shotsPerBurst:1,shotIntervalSeconds:0,cooldownSeconds:1.4,delivery:'hitscan',projectile:null}),
 upgrade1:Object.freeze({shotsPerBurst:2,shotIntervalSeconds:.2,cooldownSeconds:1.4,delivery:'hitscan',projectile:null}),
 upgrade2:Object.freeze({shotsPerBurst:3,shotIntervalSeconds:.2,cooldownSeconds:1.6,delivery:'hitscan',projectile:null}),
});

// Model-local top-surface centres of the four existing crown terminals. The
// fixed mast has no aiming/recoil articulation. Select the nearest terminal to
// the target in world XZ; range still uses the defence's centre, not this socket.
export const ARC_SPIRE_TERMINALS=Object.freeze({
 base:Object.freeze([Object.freeze([5,32,5]),Object.freeze([19,32,5]),Object.freeze([5,32,19]),Object.freeze([19,32,19])]),
 upgrade1:Object.freeze([Object.freeze([5,42,5]),Object.freeze([19,42,5]),Object.freeze([5,42,19]),Object.freeze([19,42,19])]),
 upgrade2:Object.freeze([Object.freeze([4,54,4]),Object.freeze([20,54,4]),Object.freeze([4,54,20]),Object.freeze([20,54,20])]),
});
