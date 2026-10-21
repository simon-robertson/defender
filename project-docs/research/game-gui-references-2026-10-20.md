# Game GUI references — 20 October 2026

**Status: research and proposed visual direction, before implementation.** The user requests a redesign of the entire `/play/` GUI as a game interface, rejects the oversized serif/letterspaced marketing treatment, and asks Researcher to find references first. Preserve the world, assets, levels, gameplay and economy; hide the Live cam option while retaining its underlying functionality. Laptop and desktop are the priority. GPU rendering is permitted if useful, not required.

Implementation followed this research; see the [GUI delivery](../game-gui-2026-10-20/README.md) for actual screens and verification.

## Recommended direction

Use a compact **field-command interface** belonging to Defender's porcelain-armoured machinery: dark forest/moss structural panels, warm porcelain inset surfaces, restrained amber selection/action signals and clear vermilion warnings. Build identity from real unit silhouettes, decisive typography and task layout. Use a modest bevel or clipped corner consistently; avoid decorative military clutter, fake bolts, CRT noise and elaborate frames. The landscape remains the largest and most visually rich element.

A compact game wordmark and a short menu over the accepted live scenery suit the title. Preparation should feel like selecting equipment for the battlefield: incoming enemies, build catalogue and owned units, with a persistent deployment/start action. During combat, retain a small state strip and essential camera/pause controls. Pause/results/error screens should use the same command-panel vocabulary and concise factual labels.

This visual palette, panel construction and typography are **our proposed adaptation**, not a claim that the reference games use Defender's colours or that their art should be copied.

## Four selected references

### 1. Defense Grid: The Awakening — tactical information and contextual actions

**Primary source:** [official manual](https://store.steampowered.com/manual/18500), sections 5–6, PDF pages 2–3. [Official store/media page](https://store.steampowered.com/app/18500/Defense_Grid_The_Awakening/).

**Verified in the manual:** resources and core status occupy a stable upper display, Tactical Recon communicates upcoming enemies, selecting a build location presents tower choices, and selecting a tower offers Upgrade. The mission summary reports the outcome and relevant statistics. These are documented functional arrangements; they do not establish Defender's rules.

**Adapt:** a small stable token/miss/wave readout; a recognisable incoming-enemy strip; model-led purchase choices; selected-unit upgrade information adjacent to its identity. The battle HUD and preparation workbench should share the same position and visual grammar for the same facts. Use our existing range overlay and inventory-to-world highlight as part of selection feedback.

**Do not import:** recoverable cores, kill income, interest, selling, score medals, enemy immunities or its exact tower menu. Defender has cumulative misses and preparation-only transactions.

### 2. Command & Conquer Remastered — an arsenal that reduces searching

**Primary source:** EA producer Jim Vessella's [5 June 2019 sidebar development update](https://www.reddit.com/r/commandandconquer/comments/bx59ym/remaster_update_and_first_sidebar_preview/), posted as `EA_Jimtern`; this is a developer statement on Reddit, not a community design claim. It includes the official preview image. The [EA-published store description](https://store.steampowered.com/app/1213210/Command__Conquer_Remastered_Collection/) independently identifies reduced scrolling as an aim of its enhanced sidebar.

**Verified in the developer text:** build categories and a larger visible button set reduce scrolling; money/options were repositioned to preserve battlefield space; the illustrated build buttons were deliberately authored alongside the panel layout. Category grouping follows that game's actual production rules.

**Adapt:** make our three purchasable families immediately distinguishable through actual model-derived thumbnails, family name, tier and token price. Keep the active command available while the inventory scrolls. Use compact, predictable item geometry rather than tall generic web cards. Distinguish buying a new item from selecting/upgrading an owned item. With only three families, do not add tabs merely to imitate a larger RTS.

**Do not import:** radar, production queues, repair/sell controls, support powers, faction branding or C&C's industrial art. A compact labelled button is better than an unexplained copied symbol.

### 3. Bad North — identity cues, advance threat information and consistent outcomes

**Primary sources:** [official Jotunn Edition notes](https://www.badnorth.com/news/patch/2-00-jotunn-edition), especially Campaign, Commanders and Visuals; [official media page](https://www.badnorth.com/); [official press kit](https://www.badnorth.com/press-kit). The patch page provides [a shared-gold interface image](https://images.squarespace-cdn.com/content/v1/5989aae359cc68f043b479aa/1563892211241-2745PRRA4H0U7T1LZH1J/jotunn_gold.jpg) and [additional game media](https://images.squarespace-cdn.com/content/v1/5989aae359cc68f043b479aa/1563892237070-AJKPGYTA1AO3WVM6HEJI/1.png).

**Verified in the official notes:** the game exposes enemy types before a level, altered banner icons to represent commander traits, exposes commander statistics in the upgrade screen, and revised reward/victory interfaces. Its official description makes observing a small tactical world central to play.

**Adapt:** use familiar, repeated unit identities across catalogue, inventory, selection and results. Give each incoming species its own real silhouette plus count, air/ground and effective HP/speed; keep approach/timing information readable. Let the existing scenery carry the setting, rather than placing large prose blocks over it. Results should feel like the same game as preparation, using the same typography, numbers and unit language.

**Do not import:** commanders, traits, commander death, campaign rewards or shared-gold rules. Bad North's deliberately different tactical abstraction is not evidence that Defender can omit its necessary numerical wave information.

### 4. Into the Breach — information before commitment

**Primary sources:** [Subset's official game page](https://subsetgames.com/itb.html), [developer/publisher-controlled Steam page and gallery](https://store.steampowered.com/app/590380/Into_the_Breach/), and [official press-kit entry](https://subsetgames.com/presskit/sheet.php?p=into_the_breach).

**Verified in the official product text:** enemy attacks are telegraphed so the player can analyse the situation before committing. This supports a relationship between information and the decision being taken, not a particular font, panel position or imported mechanic.

**Adapt:** preparation must show the information used to choose purchases and placements before Start wave. Show an owned item's actual tier and next upgrade's cost/benefit clearly; selection must unmistakably connect it to its world model. A strong action label should state the existing command—Deploy or Start wave—not marketing language. Keep secondary controls visually subordinate.

**Do not import:** an End Turn system, predicted combat outcomes, reset-turn ability, enemy intention arrows, pilots, objectives or its pixel-art assets.

## Applying the references to each Defender surface

| Surface | Proposed composition and interaction |
| --- | --- |
| Title | Accepted scenic background; one custom compact heavy game wordmark; short functional menu headed by New game. Remove the boxed initial, editorial introduction, edition copy and CTA arrow. Do not add nonfunctional settings or campaign choices. |
| Preparation | Stable header with level/wave and wallet; an incoming group summary; a compact three-family purchase catalogue using real silhouettes; a clearly separate owned-unit list and selected-unit upgrade control. Keep current preparation/deployment phase rules. Pin the existing next/start action outside the scroll area. |
| Deployment | Give selected item, tier and price/state a clear visual anchor; preserve real placement feedback, range ring and hovered/focused unit highlight. Use an explicit selected outline/inset, not colour alone. Unplaced inventory should be obvious. |
| Wave HUD | Compact state strip: token chip + count, exit/miss symbol + `misses / 10`, and `wave / 4`. Use tabular numerals. Keep active-arrival status short. Avoid heart/shield imagery that implies defence health or a base-damage mechanic. Keep Pause/P and existing camera controls; remove visible Live cam entry points. |
| Pause | Same panel construction; plain Paused heading, clear Resume, and existing exit action. Freeze remains obvious. Avoid motivational prose and decorative emblems. |
| Completion/defeat | Direct outcome: Zone A complete or Game over, actual waves completed and misses, then New game/Try again and existing title action. No invented score, medal or stars. |
| Loading/error | Same panel language and high-contrast concise state. Retain actual retry behaviour and readable error text; do not make a failure look like a marketing dialog. |

Use a heavy condensed treatment for the wordmark/short section titles if available locally, and a legible ordinary sans for controls and data. Tight normal word spacing, consistent numeric alignment and a restrained size hierarchy matter more than a special font. Most labels should be normal case; avoid widely spaced all-capital paragraphs. As provisional layout targets, use readable 13–14 px controls/data and modest 16–20 px panel headings at ordinary laptop scale, then verify visually; do not preserve the current 8–10 px label density just to fit more decoration. All these sizes are proposed tuning, not source-derived accessibility guarantees.

Create the unit thumbnails from Defender's accepted model geometry or original vector interpretations of it, at a consistent isometric angle, lighting and scale. Gun barrels, Arc mast, silo wells, Dog legs, Roller wheels and Moth wings should remain recognisable. Keep names and costs alongside images; thumbnails are identification, not sole instructions. No reference-game screenshots, logos, glyphs or other art go into production assets.

**DOM/SVG is the recommended first implementation.** Native buttons, text and focus semantics already serve the required interactions and can carry original vector art and restrained bevels. GPU rendering is an available tool if a concrete visual or performance requirement calls for it; source research establishes no need for a new GPU GUI pipeline. No new framework, font service, account, setting or gameplay system is implied.

## Inspection and evidence limits

All external sources were accessed **20 October 2026**. Research read official product/developer text, the official Defense Grid PDF, source captions and media links. The researcher's built-in browser surface was unavailable (`iab` not exposed); the web tool could fetch links and PDF/image references but did not expose inspectable screenshot pixels in this session. Subset's direct press/game pages also returned 403 on open, so its specific supported claim is cross-checked against the official Steam product text. **This is not a claim to have visually inspected every linked game screen, played the games or measured their usability.** The image links are supplied for direct visual reference and the lead's available browser review. No community screenshot or third-party UI gallery is used as primary evidence.

The early functional recommendation from Defense Grid's manual and EA's sidebar account was sent to Lead before implementation, and Lead confirmed it was sufficient to begin. Specific colour, type and panel geometry remain our original proposal, to be judged in Defender's own browser rendering. Review title, empty/full inventory, locked items, deployment, active wave, pause, defeat, completion and error at laptop/desktop sizes before claiming the visual redesign complete.

## Shared design record changes needed after implementation

Lead should update **`docs/design-doc.md`** in these sections, preserving approval versus implementation status:

1. **First player loop and development gate:** replace the earlier cream/forest presentation description with the delivered game-interface composition; retain current phase/economy/input semantics.
2. **Visual direction and environments / Gameplay readability:** record the new UI type hierarchy, unit identity thumbnails, state colours, selection/focus language and laptop/desktop priority. The accepted world palette is unchanged.
3. **Proposed title and menu screen:** record that the earlier scenery-only concept's generic menu treatment has been superseded by the user's latest feedback; preserve the scenic world and distinguish the newly implemented game menu from historical artwork.
4. **Live action cam:** visible option hidden at the user's request while underlying camera/film functionality remains present; do not describe it as removed or add an alternative player setting.
5. **Rendering and lighting / Engine and performance requirements:** record a DOM/SVG GUI if selected; GPU GUI remains permission, not an implemented requirement. Preserve scene-only film/HUD separation and existing dependency limits.
6. **Document change record**, affected visual/project briefs, **daily diary** and team handoff: link this research, record the user's critique, delivered screens and actual browser verification. Do not treat these references as user approval of copied styling or final visual acceptance.
