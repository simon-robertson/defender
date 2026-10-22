# First director rebuild from the saved shots

Branch: `drone-cam-logic-rebuild`. The sixteen original PNG/JSON pairs in `shots/` are retained verbatim as the player's reference set: fifteen preferred shots and one rejected shot.

The common direction is a readable battle in the foreground with arrivals and level context behind it. Quiet moments should survey approaching enemies and the board. Multiple active fronts need broader compositions. A dominant fight can sustain a closer, near-level dramatic shot; it should not be confined to permanent high stations. Enemies near an exit deserve attention because they create tension. Visible reflections are a useful compositional bonus when the action remains readable.

The rejected B4 view has living enemies and water but points away from the active front and covers relatively little of the board. Enemy count or an interesting structure alone therefore cannot certify a useful shot. Its paired preferred view is `6ae13f30-f9ff-40af-8988-a4cca23266c9`; the rejected view is `062cefd2-2d44-4387-919a-df1a22d9efc8`.

## Implementation

- `play/battle-director.js` builds spatial encounters from living enemies, participating weapons, recent impacts and remaining exit time. Sustained competitors get deliberate handovers; comparable fronts receive screen time. Shot exposure counts actual viewport time, and a long unshown approach cannot lock the director indefinitely.
- `play/battle-framing.js` composes survey, overview, battle, dramatic and danger shots. It scores the chosen exchange, other activity, arrivals behind the exchange, board coverage, subject scale, projected separation and visible water. Typical lenses are 56° for closer action and 64° for broader views. The profiles generalise the examples; no level coordinates or saved camera poses are embedded in runtime logic.
- `play/drone-camera.js` coordinates those decisions. Accepted views and routes remain committed. An unsafe replacement does not erase an existing journey. The old speculative defence-forecast owner, rotating altitude bands, fixed 168-unit standoff and timed orbit/low-shot rules are retired.
- `play/drone-flight.js` retains swept solid/water checks, actor envelopes, continuous detours, bounded speed/acceleration/jerk and eased gimbal/lens movement. Low stations require a clear escape column. Live actor prediction and imminent scheduled entrances trigger safe retreats; cameras may still travel beyond the board. Scene release clears borrowed actor references.

## Review and checks

Thirty-five targeted director, camera, ownership, screenshot and study-storage checks pass. The saved accepted B4 shot scores above its rejected counterpart. All seven native study presets produce finite, physically clear filming stations. Moving A2, B4 and D4 battles pass at 30/60/120 Hz, including swept static/actor checks. A separate camera-off run checks combat outcome identity; this is a camera change, with no balance or actor-scheduler edits.

The updated study tool adds **Compare rebuilt Drone**. Load an existing example, compare the director's chosen view, and use **Watch battle** to review its motion. **Return to manual camera** restores the prior manual pose. Time seeking returns to manual control. New examples can be recorded without replacing the original set.

Actual browser checks cover the initial native B4 framing, live wider/lower transitions and scene switching without reported GPU errors. The checks establish technical behaviour, not that the player will enjoy every choice. Static examples do not specify exact movement curves or dwell times; six seconds of visible action is the provisional shot-family interval, with earlier confirmed handovers to competing action. Further preferred/avoid examples can refine that timing and composition.

The local package is refreshed for review. Production is not merged or pushed, and the player's existing game tab is not reloaded.

## Interior stations, altitude and openings: player follow-up

The first rebuild offered only two long radii and two narrow height bands. Its opening randomness shifted the angle grid but usually recovered the same composition. Holding also required only local action visibility, allowing a shot to miss the wider battle indefinitely.

The search now offers 144 reusable candidates across short, medium and scene-sized radii and three elevations. Distance follows the current subject footprint, lens and viewport; height follows distance and a comfortable viewing angle. Interior and exterior stations compete on the same composition and clearance criteria. Opening randomness varies similarly useful compositions by at most 0.055 score. Ongoing flight has no randomness, and its travel penalty is smaller and capped. There is no centre destination rule or required altitude cycle.

Scenery visibility now contributes to actual local and global subject coverage, rather than checking only a few participants after screen-space scoring. Up to 24 plausible candidates receive full visibility evaluation; physically blocked or locally obscured candidates do not exhaust that shortlist. Accepted routes stay committed. A settled, readable overview can reframe after 2.4 seconds only for a substantial score and coverage improvement. Sustained additional fronts can request an overview before the six-second perspective change, retaining the exposure used for focus handovers. Broader shots accept smaller subjects; dramatic shots retain a modest preference for low filming when clear.

Forty targeted checks pass, including five new regressions: opening variation, an enclosed fight choosing an interior station, ridges demanding high coverage, a local shot yielding to wider action, and sustained new fronts widening without resetting scene exposure. In the ridge fixture the same open battle uses a lower station, while intervening terrain makes it select a station over 300 units high with all weighted subjects visible. Native A2/B4/D4 battles at 30/60/120 Hz retain swept static/actor clearance and camera-off combat outcome identity. Their selected stations include actual interior and elevated destinations, in addition to high transit waypoints. Browser review covers B4 live motion and C3 crossfire with no reported warnings/errors. These checks establish conditional choices and safety; the player's judgment of the camera's overall feel remains the acceptance criterion. Planning CPU cost has not been benchmarked; no GPU resource or pass is added.
