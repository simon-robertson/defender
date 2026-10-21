# Independent drone motion review

18 October 2026. Engineer, `gpt-6.1-sol/high`, independent read-only code review. Lead authorised these two evidence files; runtime, models, shared documentation and browser control remain outside this reviewer's write scope.

The user requests smoother acceleration, braking and route changes, a level body without pitch/roll, and tilting fan assemblies with independently spinning rotors. Weapon, flight and recharge timing and level geometry remain unchanged.

## Practical before/after method

The bounded fixture loads the saved A1 source and exactly its source-selected models and actors. It runs the real enemy, defence, navigation, planner and rig controllers for 60 simulated seconds at a fixed `1/60` second delta. The random callback always returns `0.5`; enemy health is raised to 100,000 and the hit callback returns zero so targets keep moving throughout the observation. No wildlife simulation, renderer or GPU runs in this probe.

The same JavaScript below is executed with `bun -e` from the repository root before and after the implementation. The JSON data is saved in [review-motion.json](review-motion.json). Baseline was sampled before the motion implementation changed on 18 October.

- `maxAcceleration`: maximum norm of consecutive reported XYZ velocity differences divided by `1/60`, in world units/second². The initial controller derives those velocities from actual position displacement; the final review must check the new channel's meaning as well.
- `jumps`: frames with a velocity-vector change greater than 8 world units/second. This threshold is an inspection diagnostic, not a gameplay or performance budget.
- `bodyTilt`: maximum absolute reported pitch or roll, in radians.
- `goalChanges`: actual navigation goal-node changes, including expected launch/return transitions. The count alone is not a quality judgement.
- `distance`: accumulated speed × delta, in world units.
- `v` and `goal`: final velocity vector and navigation node, retained to reproduce the original output exactly.

This is a finite deterministic scene observation, not a proof of all navigation layouts, final balance, FPS or GPU performance. Browser motion review belongs to Lead.

```js
import {actorsForPreview} from './game/preview-actors.js';
import {buildWorld,disposeWorld} from './engine/world.js';
import {EnemyPreview} from './game/enemy-preview.js';
import {DefencePreview} from './game/defence-preview.js';
const level=await Bun.file('assets/levels/moss-01.json').json();
const actors=actorsForPreview(level),models=new Map();
for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)]))
 models.set(id,await Bun.file('assets/models/'+id+'.json').json());
const w=buildWorld(level,models,{actors}),e=new EnemyPreview(w,()=>{});
for(const t of e.states)t.health.current=t.health.maximum=100000;
const d=new DefencePreview(w,()=>{},()=>.5,null,e.states,()=>0);
const m=d.drones.states.map(s=>({v:[0,0,0],maxAcceleration:0,jumps:0,bodyTilt:0,goal:s.goalNode,goalChanges:0,distance:0}));
for(let f=0;f<3600;f++){
 e.advance(1/60);d.advance(1/60);
 d.drones.states.forEach((s,i)=>{
  const r=m[i],v=[s.velocityX,s.velocityY,s.velocityZ];
  const dv=Math.hypot(v[0]-r.v[0],v[1]-r.v[1],v[2]-r.v[2]);
  r.maxAcceleration=Math.max(r.maxAcceleration,dv*60);
  if(dv>8)r.jumps++;
  r.bodyTilt=Math.max(r.bodyTilt,Math.abs(s.bodyPitch),Math.abs(s.bodyRoll));
  r.distance+=Math.hypot(...v)/60;
  if(s.goalNode!==r.goal){r.goal=s.goalNode;r.goalChanges++;}
  r.v=v;
 });
}
console.log(JSON.stringify(m));
d.dispose();e.dispose();disposeWorld(w);
```

## Baseline

Both aircraft reach 5° body tilt and maximum frame velocity acceleration 5,760 world units/second². The first/second aircraft respectively show 118/75 velocity jumps over the diagnostic threshold and 43/30 goal changes. These numbers establish the initial abrupt direction/speed changes; they do not assign a final flight tuning target.

## Historical smooth-motion midpoint

The first stable smoothing revision retained 48-unit/second cruise, 32-unit/second vertical speed and a 10° fan cap. Its matching probe has zero large velocity jumps, zero body tilt and 24/16 goal changes. Position-derived acceleration peaks are 97.93/89.95 world units/second²; reported instantaneous velocity peaks are 138.03/109.77. The new controller publishes tangent velocity, so the supplementary position-derived measurement is the directly comparable trajectory metric.

Actual transformed fan normals produce the correct yaw tendency during acceleration and braking at all four pad quarter-turns. Rotor and housing normals match exactly; body up stays exactly vertical. A 30/60/120 Hz quarter-turn comparison differs by at most about 0.0066° in fan angle at the sampled times, with body yaw equal to floating-point precision. These are finite inspection manoeuvres, not physical thrust simulation.

Two concrete issues were closed: an exact stopped unrounded join could retain the previous segment's zero speed limit, and joins needed an exact zero-speed clamp to avoid tangent changes with residual speed. Focused regressions cover the native 1/60 and 0.02-second cases. Engineer reports 48 affected checks passing before the later retune.

## Verified 72-speed / 20° smoothing milestone

The user subsequently requested more visible fan steering and 50% higher movement speed. The stable follow-up uses cruise72 and vertical48 world units/second, a20° compound fan cap and6-unit minimum steering lift. Front fan pivots move toY11.5; rear pivots remainY10.5. Artist's full fan sphere bound15.40484 remains below the navigation radius16.5.

The matching60-second A1 probe reports:

| Measured quantity | Drone1 | Drone2 |
| --- | ---: | ---: |
| Position-derived maximum speed (units/s) |72.00 |72.00 |
| Position-derived acceleration peak (units/s²) |154.51 |127.64 |
| Reported instantaneous velocity acceleration peak (units/s²) |217.09 |120.00 |
| Large velocity jumps / emergency stops |0 /0 |0 /0 |
| Body tilt / body-up error |0 /0 |0 /0 |
| Goal-node changes |34 |19 |
| Actual fan-normal maximum tilt |19.59° |19.25° |
| Rotor/housing up-normal mismatch |0 |0 |
| Static-envelope failures / nonfinite poses |0 /0 |0 /0 |

The final trajectory supplement derives velocity from successive XYZ positions, then acceleration from successive derived velocities; this matches the original controller's reported-velocity meaning. The full calculation otherwise uses the exact fixture and core probe above. The zero-jump result is retained despite the higher speed. Scalar acceleration settings do not equal total vector acceleration through a curved path.

One higher-speed crossing initially caused an emergency stop at53.9167 seconds. Other-aircraft swept lookahead over the braking horizon fixes that exact case; the matching repeat above has no emergency stops or large jumps. This is a tested crossing, not a general guarantee for every future dynamic configuration.

The20° actual-matrix yaw audit checks a90° heading change at120Hz for each of the four pad quarter-turns. All44 accelerating samples have the correct geometric yaw tendency;44 of45 braking samples counter-tilt correctly, with the initial transition retaining one frame of the previous tilt because the servo eases rather than flips. Rotor/ring normals match exactly and body up stays vertical. Yaw-only tilt reaches about5.87°. The proxy `sum(r.z * fanNormal.x - r.x * fanNormal.z)` uses actual transformed ring normals and world pivot offsets; it demonstrates steering direction, not assigned physical thrust or torque.

## Final interception and collision review

No outstanding actionable blocker remains in the reviewed final source and bounded fixtures. The controller predicts along each enemy's complete route, estimates shortlisted arrival using the actual rounded-route acceleration/braking controller, reserves friendly stations, and holds useful firing windows. Range or pitch loss invalidates a used station and repositions for the same living target where useful; flight expiry still prevents a new burst.

The matching original60-second fixture now records14/8 goal changes, zero large velocity changes and zero body tilt. Position-derived acceleration peaks are142.94/166.05 world units/second²; reported instantaneous peaks are195.74/180.93. Both reach72 units/second. Actual body up remains vertical, fan/rotor normals agree, and sampled static envelopes and matrices remain clear/finite.

A separate60-second supplement runs the actual wildlife controller, binds its states and preserves the immortal enemy fixture. It has zero measured current-actor overlaps, static failures, emergency stops or large velocity changes. Aircraft hold one committed station while their target travels31/79 units; the longest uninterrupted holds are1.55/3.95 seconds. No goal changes occur during active bursts. Conservative avoidance can lengthen the return journey; the20-second budget excludes return travel.

The final actual-A1 combat repeat uses [Lead's saved trace source](trace-interception.js):150 seconds at1/60, real enemy health/damage, all six wildlife controllers, nearby-enemy fear and death-explosion scares, deterministic defence random0.5. It reaches zero living enemies and both aircraft in pad hover, with28/50 rounds and three launches/returns each. There are zero measured current actor, static or friendly-aircraft envelope overlaps and zero emergency stops; the shared planner ranks at most one defence per frame. Actual body-centre transform error stays below0.00003 world units. All six wildlife complete journeys. Scene source remains unchanged; reset clears station/evasion/shot state using retained storage, and disposal empties aircraft, obstacle references/typed bytes and navigation typed bytes.

Closed review findings:

- Interrupted escape motion could remain unfinished forever; it now replans after stopping.
- Rejected station probes could leave speculative movement installed; stationary planning clears it before selection.
- Enemy preview wrap needs a separately bounded entrance region; collision prediction now keeps exit and entrance apart.
- A real bird approach exposed an escape path whose endpoint was clear while its middle crossed the bird. Time-matched intermediate envelopes and active-escape checking close the observed56-overlap-frame/one-emergency case.
- An empty held return plan could align and snap from a distant position; actual home-position admission now prevents this.

Two flat-scene probes move the same living target immediately after the first shot: exactly underneath the drone, or100 units away inX beyond its72-unit range. In both, invalid remaining rounds cancel, the aircraft chooses a new station, settles and resumes firing at the same target at6.1667 seconds after the first round at1.15 seconds. This preserves the five-second cooldown after the last actual round. A separate escape started at flightElapsed19.9 expires during evasion, creates exactly one return, fires no expired attack and completes a ten-second own-pad recharge before the next launch.

The reviewer ran31 focused combat/motion/obstacle checks: all pass,291,073 assertions. No full suite or browser automation was run. Exact probe sources, final data and reviewed runtime SHA-256 hashes are in [review-motion.json](review-motion.json). To reproduce any stored source, read its `reproduction.*Source` JSON field and pass that string directly to `subprocess.run(['bun','-e',source])` from the repository root. The original before/after method above remains unchanged; supplements explicitly add wildlife or real damage.

The earlier actual-matrix yaw audit still applies to the unchanged20° steering transform: its four root quarter-turns show accelerating fan tilt and counter-tilt on braking, with one eased transition frame, matching rotor/housing normals and a vertical body. These are geometric steering checks, not assigned physical thrust.

Limits: this is finite deterministic scene evidence. Current collision checks use conservative posed-part AABBs against declared aircraft envelopes; predicted motion is bounded to one second, refreshed each frame, and cannot foresee arbitrary future random departures, scares or route changes. Station scoring, range72 and motion/fan response remain provisional. `verticalSpeed48` caps launch/descent; generic3D transit/escape uses the72-unit total-speed controller. Browser appearance, GPU behavior and user acceptance belong to Lead; no FPS or general collision-proof claim is made.
