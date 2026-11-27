# STAR RAIDERS remake — Fidelity Audit and Overhaul Plan

Audit of `src/` at commit `3d0a692` against [`docs/MANUAL_SPEC.md`](MANUAL_SPEC.md) (the manual **[M §…]**
plus the ROM disassembly **[R §17.x]** = MANUAL_SPEC §17). Screenshots of the current build next to the
manual's own screenshots are in the HTML evidence report attached to this PR.

## Verdict

**The remake is not faithful in any of the 14 areas.** It has the right skeleton (16×8 chart, 0–9
speeds, F/A/G/L/H keys, θ/Φ/R panel, DC:PESCLR letters), but almost every rule and number differs
from the manual, several manual features are missing (C, T as tracking, P, meteors, mirror LRS,
real docking, rating with class, attract mode), and the look is a modern neon/cyan Three.js scene
with a ship model, radar and vignettes instead of the spare 1979 screen. Two bugs make the game
unwinnable or free: kills can stop counting (victory impossible) and engines/shields can never
drain energy to zero.

**Recommendation: rebuild the simulation and rendering core around a single rules module that
encodes the manual/ROM tables, and replace the Three.js 3D scene with a 2D pixel renderer that
projects 3D positions the way the ROM does.** Keep Vite + TypeScript, the input layer and some DOM UI;
delete the rest as each phase replaces it. Patching the current code would mean touching nearly every
file twice.

| # | Area | Faithful? |
|---|---|---|
| 1 | Flight and views | **No** |
| 2 | HUD and control panel | **No** |
| 3 | Galactic chart | **No** |
| 4 | Long-range scan | **No** |
| 5 | Attack computer | **No** |
| 6 | Hyperwarp | **No** |
| 7 | Combat | **No** |
| 8 | Enemies and AI | **No** |
| 9 | Starbases and docking | **No** |
| 10 | Energy | **No** |
| 11 | Damage | **No** |
| 12 | Scoring and rating | **No** |
| 13 | Title screen | **No** |
| 14 | Audio | **No** |

---

## Part 1 — Audit by area

Each area lists: **Gaps** (spec says X, code does Y), **Bugs**, and **Prune** (dead or redundant code).
File references are `src/…:line`.

### 1. Flight and views — **No**
Spec: [M §IV 0–9, A, F; M §II; R §17.1, §17.13].

Gaps
- Speed table: code uses `engineSpeed × 50` units/s, linear 0–450 (`game/Game.ts:586`); the manual's
  V values are 00 00 00 01 03 06 12 25 37 43 — a doubling curve. V on the panel shows the key number,
  not V.
- No joystick/keyboard steering. Steering is **mouse-only with pointer lock** (`utils/InputManager.ts`,
  `game/Game.ts:1031-1038`); the manual is a stick (forward = dive, back = climb). Arrow keys only move
  the chart cursor.
- The ship **model is visible**: aft view shows a big blue/white hull across the lower half of the
  screen (`entities/Player.ts:39-130`). The manual: "you never actually see your own starship".
- Starfield is 500 points in a shell (`entities/Starfield.ts`); the original is 12 single pixels that
  stream outward and rotate with turns, coloured by distance.
- No title line per view (`AFT VIEW`, `LONG RANGE SCAN`), crosshair not view-specific (aft should be two
  dashes), no shields tint, red "vignette" overlays instead of background colour flashes.
- Camera aspect fixed 5:3 and stretched to the window (`Game.ts:112-131`), so it distorts.
- No pause (P) or idle-to-attract.

Bugs
- Warping from the chart after being in aft leaves the camera facing backwards (`Game.ts:878`).
- `ControlPanel.updateViewMode` is never called; the panel always shows "F" (`ui/ControlPanel.ts:683`).
- Sub-frame key taps are lost (`isKeyJustPressed` polling, `Game.ts:1092`).

Prune
- `Player.ts` ship model, `Starfield.ts` shader/size attribute, `Game.handleResize` (no-op),
  `Game.isInitialized`, `Player.setRotationDamping`, `InputManager.setMouseSensitivity`.

### 2. HUD and control panel — **No**
Spec: [M §IV Control Panel Display; R §17.2, §17.13].

Gaps
- Fields: code shows `V K E T S H` + `θ Φ R` + "OK/DMG" (`ui/ControlPanel.ts:94-127`). Spec is exactly
  `V:00 K:00 E:9999 T:0` / `θ:+00 Φ:+00 R:+000`. **S** and **H (hull)** do not exist in the original.
- **T** shows galaxy-wide enemies remaining ("T: 24") instead of the target index 0/1/2/3, and never
  becomes **C** with tracking on.
- **θ/Φ are degrees (−180..+180)**, e.g. "Θ: −170" in the captures; spec is gradons with sign meaning
  in front/behind, ±00–99. R is unspecified units ("+315") instead of centrons with a coarse last digit.
- Colours: everything cyan on `#3388cc`. Spec: light-mint V/T/θ/digits, **pink K and Φ label**,
  **yellow E and R label**, dark-blue band that flashes **pink below 1000 energy** and turns **orange
  when shields are out**.
- Extra modern widgets not in the original: "ZYLON FIGHTER RANGE:", "THREAT n", "SEC x,y",
  blinking red centre messages. Messages belong on the title line, one short phrase at a time.

Bugs
- Energy and shield colour classes are applied to the wrong element (`.parentElement.parentElement`,
  `ControlPanel.ts:595,617`), so the low-energy warning never shows.
- Hull `.critical` uses an undefined `@keyframes blink` (`ControlPanel.ts:346`).
- "ENERGY CRITICAL!" nags every 5 s below 500 instead of the panel flashing below 1000.

Prune
- Hull field and all `hull`/`repairHull`/`takeDamage` code in `game/GameState.ts`, the THREAT/SEC/RANGE
  text in `views/AttackComputer.ts:583-633`, `.control-hints` CSS, five duplicated Google Fonts
  `@import`s (ship one local pixel font).

### 3. Galactic chart — **No**
Spec: [M §IV G; R §17.4].

Gaps
- Counts: NOVICE has **24** enemies (spec 27), PILOT 36 ✓, WARRIOR 45 ✓, COMMANDER **60** (spec 54);
  starbases 3/3/3/4 (spec **3/4/5/6**) (`systems/SectorSystem.ts:337-377`). Enemies are scattered 1–4
  per sector randomly; spec places level+3 groups each of 2, 3 and 4 ships. Starbases always land in the
  top row's left regions (`SectorSystem.ts:382-413`); spec avoids borders and Zylon neighbours.
- **Your position is not marked** (`current-sector` is never added, `GalacticChart.ts:503`); spec shows
  two dots, position and destination.
- **TARGETS** shows the galaxy total (24) instead of the Zylons in the cursor sector.
- **WARP ENERGY** = `100 + 165 × Manhattan` (265–3730) instead of the manual table (100–2500).
- **STAR DATE** starts at 2850.00 and runs on wall time ×0.1; spec starts at 00.00 and ticks every
  41 loops.
- Symbols: 4 sprites by count (arrow/dashes/stacked/diamond) vs the ROM's 3 Zylon symbols (1–2, 3, 4).
  "4 or more" is not a thing — groups are at most 4.
- Fleet movement: every 30 s one enemy moves into each empty neighbour of the target starbase
  (`systems/StarbaseAttackSystem.ts`); spec moves whole groups every 0.50 star date with size-based
  probabilities (255/192/32 of 256), never into your sector or an occupied one. Disabled on NOVICE in
  code; spec moves on all levels.
- Surround: destruction after **300 s** (spec 1.00 star date ≈ 100 centons); destroyed starbase does
  not become a 2-Zylon sector; messages are long custom strings instead of `STARBASE SURROUNDED` /
  `STARBASE DESTROYED`; radio damage has no effect.
- DC letters: two states (cyan/red); spec three (blue/yellow/red). The panel and chart don't turn
  yellow when shields are damaged.
- Look: close to the manual (blue field, grid, white sprites, black title band) — the best-matching
  screen in the game — but the cursor is a green box and fonts/colours are ad hoc.

Bugs
- **Victory can become impossible**: the attack system moves sector counts in and out of the player's
  sector without spawning/removing ships; kills there no longer decrement totals
  (`StarbaseAttackSystem.ts:154-240`, `SectorSystem.ts:474-482`).
- Two different "remaining enemies" sources (panel T vs chart TARGETS) diverge.
- 60 s/30 s warnings re-fire every frame for a second (`StarbaseAttackSystem.ts:353-357`).
- The chart rebuilds 128 cells of DOM every frame while open.

Prune
- `SectorSystem.getSectorSymbol`, `getStarbasesUnderAttack`, `isStarbaseUnderAttack`,
  `SectorData.visited`; `GalacticChart.toggle`/`visible`, `.enemy-pip`, `.dc-char.destroyed`;
  `StarbaseAttackSystem.getDestructionTimeRemaining`/`reset`; the duplicated difficulty tables in
  `GameState.reset`, `SectorSystem.generateGalaxy` and `ScoringSystem`.

### 4. Long-range scan — **No**
Spec: [M §IV L; R §17.3, §17.13].

Gaps
- Background is blue `#2B608A` with a square frame; spec is **black** with the title line and panel.
- The attack computer box and front crosshair stay drawn **on top of the scan** (z-order).
- Enemies are 6 px cyan dots; spec: **flashing squares**, larger than stars, random colours; meteors
  too. Starbase should be its small icon, not a green square.
- Scale ±500 units heads-up; spec: top-down z-x plane to about ±40,000 KM, objects rotate around you as
  you steer.
- **Damaged → no mirror**: the view simply doesn't open (`views/LongRangeScan.ts:259-262`). Spec:
  random mirrored rows; destroyed → only your ship.

Bugs
- Damaged LRS leaves the game in an invisible "LRS mode" where fire and shields don't work.
- It runs its own `requestAnimationFrame` loop **and** is updated from `Game.update` (double render).
- Decorative scan stars drift at ×10 while the world moves at ×50.

Prune
- `LongRangeScan.toggle`/`visible`, the unused `sectorSystem` constructor param, the commented
  `generateObjectPositions`.

### 5. Attack computer — **No**
Spec: [M §IV C, M, T, Attack Computer Display; R §17.6].

Gaps
- **No C key**; the display is always on (`AttackComputer.ts:565-576`) and costs nothing. Spec: C
  toggles it, ½ unit/s drain, crosshairs only appear with it on.
- Look: a tall cyan panel with A/B/C letters, a static cross, and a "proximity radar" with triangles,
  squares and octagons. Spec: a small line-drawn box (outer + inner rectangle) with the **target blip
  moving inside it** and three pairs of lock marks (A horizontal bars upper, B horizontal bars lower,
  C vertical bars bottom).
- Lock rules: code uses a yaw angle < 0.15 rad and range ≤ 50 units; spec: x within ±512 KM (A),
  plus y (B), plus in front and < 3072 KM (C). Lock uses the forward vector even in aft.
- Lock effect: none. Spec: locked torpedoes **home in** and the second fires automatically ("90% kill").
- **T** = "select nearest" message; spec: Tracking Computer toggle that auto-switches front/aft and
  changes T: to C: on the panel. **M** cycles all enemies; spec toggles target 0/1 (only 2 Zylons
  attack at once). Starbase tracking (T=2) and warp marker (T=3) are missing.

Prune
- `AttackComputer.getTarget`, `getLockIndicator`, `getHitProbability`, the radar renderer, and the
  duplicated θ/φ maths in `Game.updateTargetingData`.

### 6. Hyperwarp — **No**
Spec: [M §IV H, §IX; R §17.5].

Gaps
- Cost formula wrong (see §3 above). Paid up front instead of during hyperspace.
- No phases: a fixed 5 s with a z-stretched starfield. Spec: accelerate → star trails → `HYPERSPACE`
  (stars hidden, V = ∞) → decelerate; `HYPERWARP ENGAGED` / `HYPERWARP COMPLETE` messages.
- Steering: NOVICE shows "STEER TO TARGET" though it auto-centres; other levels drift by ±7.5×dist
  per frame and mouse correction is effectively zero (~0.0013 vh/px). Spec: a marker between long
  cross hairs, random kicks 6% of loops sized by warp cost, landing offset = marker offset (8 px =
  1 sector), stick steers it. Leaving front view randomises the landing (not NOVICE).
- No **abort** with 0–9 (−100 energy); keys are ignored during warp.
- No **RED ALERT** on arriving in a Zylon sector; red alert is "any enemy projectile in flight".
- No hyperwarp into a meteor.
- Chart-H also warps (spec: H from front view; the survival tactic of H without the chart works).

Bugs
- `difficulty >= 'WARRIOR'` string comparison: COMMANDER never gets the harder drift (`Game.ts:866`).
- "HYPERWARPENGAGED" typo (`Game.ts:877`); the misjump message is overwritten immediately.
- `playHyperwarp` and `createWarpTrail` exist but are never called.

### 7. Combat — **No**
Spec: [M §I, §V, §IV S; R §17.7].

Gaps
- Photon cost **5** (spec **10**); each press fires **two** torpedoes at once from fixed offsets
  converging at 50 units; spec alternates left/right barrels, 23-loop refire per barrel, life 255 loops,
  sparkling purple sprite. Code torpedoes are 3D multicolour particle clouds.
- **Shields block firing** on PILOT+ ("LOWER SHIELDS TO FIRE", `Game.ts:1188`): not in the manual.
- Shields: code multiplies hit damage by 0.3 and never destroys the ship. Spec: hit with shields up
  = −100 energy (+ damage roll); **hit with shields down = ship destroyed**.
- Enemy hit damage 100/200/350 × level multiplier (0.5–1.5); spec flat **100**.
- **Meteors missing** (`entities/Meteor.ts` is never imported).
- **No explosions and no explosion/photon sounds** (`createExplosion`, `playExplosion`,
  `playTorpedoFire` never called). Spec: 32-fragment explosion and POKEY noise.
- Score/kill rules: K must count Zylons only; shooting a starbase is −3 and destroys it.

Bugs
- Hull never decreases; "hull destroyed" defeat is dead code.
- Enemy lead targeting is always zero (player is fixed at the origin) (`Enemy.ts:485-491`).

Prune
- `entities/PhotonTorpedo.ts` particle cloud, `EnemyProjectile` per-type configs and
  `window.PROJECTILE_CONFIGS`, `CombatSystem.checkNearMisses`/`getActiveEnemyCount`.

### 8. Enemies and AI — **No**
Spec: [M §I, §VIII; R §17.8].

Gaps
- Models: cyan pixel diamond (fighter), magenta H (cruiser), gold stepped pyramid with a wireframe box
  (basestar). Spec: **flat pixel sprites** — fighter is the "H/TIE" shape, cruiser the arch, basestar the
  stepped diamond — grey/white, dimmer with distance, 8 size steps; basestar colour flickers.
- Any number of enemies attack at once; spec: **max 2 Zylons in view and 1 Zylon torpedo**; new ones
  replace the dead while the sector count lasts.
- Type mix by level (NOVICE 100% fighters …) and re-rolled on every visit; spec: fighter 4/8,
  cruiser 3/8, basestar 1/8 on every level.
- Behaviour: honing, orbit radius 40, jinks, cruiser waypoints, basestar stationary with a shield that
  drops after one hit and needs 8 hits. Spec: velocity-index patterns, weave around the crosshair, dive
  in/out, back attacks on WARRIOR+, Zylons swing with your turns; **basestar dies only to a torpedo
  fired from close range** (< 15 loops old).
- Per-level difficulty should come from torpedo homing (1/4/8/20), shots from behind (not NOVICE),
  back attacks (WARRIOR+) and damage chance — not from HP, speed and fire-rate multipliers.

Bugs
- Cruiser patrol waypoints are not shifted with world movement (`Enemy.ts:219-237`).
- Basestar shield regen is per frame (frame-rate dependent).
- One console log per enemy spawn.

Prune
- Most of `entities/Enemy.ts` (1036 lines) and `config/EnemyConfig.ts` (`window.ENEMY_CONFIG`) once the
  ROM behaviour lands; `setProvoked`, `isProvoked`, `getHealthPercent`, `hasActiveShields`,
  `EnemyState.EVADE`, `cruiserProvocationSensitivity`.

### 9. Starbases and docking — **No**
Spec: [M §VI; R §17.9].

Gaps
- Docking is automatic when speed ≤ 2 and within 50 units — **it docked in the capture with the starbase
  not even on screen**. Spec: starbase centred in the crosshairs, in front, < 512 KM, speed **0**.
- Messages: "ORBIT ESTABLISHED - DOCKING…", "REPAIR DROID DEPLOYED…", "DOCKING COMPLETE - FULLY
  REPAIRED" in 2 s with the whole game frozen. Spec: `ORBIT ESTABLISHED` → `STANDBY` → transfer
  vessel flies in (~10 s) → `TRANSFER COMPLETE`; any key (except G) or stick → `DOCKING ABORTED`.
- Starbase model: green hub with white ring and cyan lights. Spec: orange pulsing three-part sprite.
- Starbase sectors should have no Zylons; code allows both.
- Starbase is not trackable (T=2) and not on the attack computer.

Bugs
- Re-docks every ~5 s while parked; cooldown counted per frame (`Game.ts:460-509`).
- A starbase destroyed by the surround stays in the scene and dockable; `Starbase.destroy()` never
  called.
- COMMANDER refuels to 9999 though it starts at 8000 (spec: everyone starts at 9999).

### 10. Energy — **No**
Spec: [M §V; R §17.1].

Gaps
- Engines drain `engineSpeed` per second (0–9 linear); spec 0, 1, 1.5, 2, 2.5, 3, 3.5, 7.5, 11.25, 15.
- Shields **3/s** (spec 2), torpedo **5** (spec 10), computer **0** (spec ½), **no life support** (spec ¼).
- Hyperwarp cost formula wrong; no 100-unit abort cost.
- Hit cost varies 50–525 by type and level; spec 100.
- COMMANDER starts at 8000; spec 9999 for all.

Bugs
- **Energy can never reach 0 from engines or shields**: `consumeEnergy` refuses when too low
  (`GameState.ts:148-154`), so you fly forever at ~0 energy and never get "MISSION ABORTED / ZERO
  ENERGY".
- `CLAUDE.md` in the repo states the wrong costs (5 per shot, 3/s shields) and seeds future AI changes
  with them.

Prune
- `EnergySystem.toggleShields`, `executeHyperwarp`, `getEnergyPercent`; `GameState.isEnergyLow`,
  `addEnergy`, `maxSpeed`.

### 11. Damage — **No**
Spec: [M §IV DC, §IX; R §17.3].

Gaps
- 10% chance per hit on non-NOVICE; spec 0 / 31% / 70% / 99% by level, damaged vs **destroyed** (close
  shots and meteors destroy).
- Radio is never damaged and has no function. Photons damaged = no fire (spec: damaged = one barrel,
  destroyed = none). Engines damaged = max speed 5 (spec: jitter; destroyed = cap 5). Shields damaged =
  can't raise (spec: **flicker**, panel orange, hit while off = destroyed). Computer damaged = display
  hidden but θΦR still work (spec: θΦR freeze; destroyed = no crosshairs/display). LRS damaged = won't
  open (spec: mirror).
- Messages: "<SYSTEM> DAMAGED!" in magenta; spec `DAMAGE CONTROL` then `PHOTONS DAMAGED` etc. with the
  damage-report beep.

Bugs
- Damage is rolled even when shielded but never reported.
- Shields damaged while on keep draining but hits count as unshielded.

### 12. Scoring and rating — **No**
Spec: [M §VII; R §17.10].

Gaps
- Formula is `100 + 10×kills + time bonus + energy bonus − 50×starbases lost`, × level multiplier,
  +100 on victory (`systems/ScoringSystem.ts:40-94`). Spec: **M + 6×kills − energy/100 − time/100 −
  18×starbases lost − 3×starbases you shot**, with M from the 4×3 table.
- Rank table out of order (NOVICE < PILOT < WARRIOR < STAR COMMANDER < ACE …), no **class 1–5**, only one
  gag rank, no ROOKIE/ENSIGN. Spec: 12 ranks from GALACTIC COOK to STAR COMMANDER, class from the score.
- Time is wall-clock `Date.now()` (counts a backgrounded tab); spec uses star-date ticks.
- End screen is a modern "MISSION FAILED / SCORE / RANK" card; spec plays the `STAR FLEET TO / STAR
  CRUISER 7 / … / NEW RANK IS: / <rank> / CLASS n` sequence on the title line.
- Game over when all starbases die (spec: the game continues).

Bugs
- `starbasesRemaining` never decrements, so the starbase penalty is always 0.
- Breakdown object is passed to the end screen and ignored.

### 13. Title screen — **No**
Spec: [M §III; R §17.11; cover art M].

Gaps
- A modern menu: gradient "STAR RAIDERS" logo, "A CLASSIC RECREATION", four buttons, a red START
  MISSION button and a controls list (missing C, T, M, P). Mouse-only; no keyboard flow.
- Spec: the game itself is the attract screen — live starfield in demo flight, title line
  `NOVICE MISSION` / `STAR RAIDERS` / `COPYRIGHT ATARI 1979`, SELECT cycles the level, START begins.
  Idle 9 minutes returns to it.

Bugs
- `MainMenu.show()` adds a resize listener every time; the hidden START button can keep focus so Space
  restarts the game.

### 14. Audio — **No**
Spec: [R §17.12].

Gaps
- Only 3 of 10 synthesized sounds are ever played (enemy fire, player hit, shield hit). No engine
  rumble, photon whoosh, explosions, hyperwarp beeps, red-alert siren, acknowledge, damage-report or
  starbase tunes.
- No mute key or volume; one `AudioContext` leaks per restart.

Prune
- Unused `playTorpedoFire`, `playExplosion`, `playHyperwarp`, `playShields`, `playDocking`,
  `playAlert`, `updateEngineSound` are wrong-sounding anyway; replace with a POKEY-style synth.

---

## Part 2 — Repository leftovers

| Item | Action |
|---|---|
| `.auto-claude/` (74 tracked files; in `.gitignore` since `a935611` but never untracked) | **Remove**: `git rm -r --cached .auto-claude` and delete. Nothing references it. |
| `.claude_settings.json` (Auto-Claude permissions, also gitignored) | **Remove** from git. |
| `CHANGELOG.md` (starts with an LLM "I need more information" reply) | **Delete**; start a real one later if wanted. |
| 17 planning/notes `.md` at the root (`implementation_guide.md`, `PROGRESS.md`, `SPEED_TUNING.md`, `UI_REDESIGN_SUMMARY.md`, `*_notes.md`, the four `Star Raiders: …md` files with colons in their names, …) | **Delete.** They contradict the manual (8×8 grid, 5-energy torpedo, etc.) and mislead future agents. MANUAL_SPEC.md replaces them. |
| `README.md`, `PROJECT_SUMMARY.md` | Rewrite README to point at MANUAL_SPEC and OVERHAUL_PLAN; delete PROJECT_SUMMARY. |
| `CLAUDE.md` | **Rewrite**: it says "no code implemented yet", lists wrong costs and a cyan/magenta/gold palette. Point it at MANUAL_SPEC.md as the source of truth. |
| `PXL_20251126_*.jpg` (6 manual photos), `Screenshot2025-11-26*.png` (2) | **Move** to `docs/reference/manual/` (they are the manual reference). |
| `entities/Meteor.ts` | Delete; meteors are rebuilt in Phase 6. |
| `public/vite.svg` | Replace with a real icon in Phase 11. |

---

## Part 3 — Phased overhaul

Ordered; each phase is one PR and one task brief. Every phase: `npm run build` passes, unit tests for
its rules pass, and the brief's screenshots are captured with the Phase 0 harness. "Done when" is the
acceptance test. All numbers come from MANUAL_SPEC.md; the PR must cite the section it implements.

### Phase 0 — Clean house and test harness
- Do Part 2 (remove `.auto-claude/`, notes, CHANGELOG; move photos; rewrite CLAUDE.md and README).
- Add **Vitest** and a `npm test` script; add a **seeded RNG** (`src/core/rng.ts`) used everywhere
  instead of `Math.random`.
- Add a debug hook (`?debug=1` → `window.__sr` with `seed`, `state`, `teleport(sector)`,
  `spawn(type)`, `setView`, `step(n)`), and a Playwright capture script (`scripts/capture.mjs`) that
  takes the standard 8 screenshots used by later phases.
- **Done when**: the repo root holds only app files + docs; `npm test` runs; the capture script produces
  title, front, aft, chart, LRS, attack computer, hyperwarp and docking shots deterministically.

### Phase 1 — Rules core (no visuals)
- New `src/rules/` with the tables as data: speed/V, engine drain, per-loop drains, warp-energy table and
  CALCWARP, damage probabilities, M table, rank/class tables, counts per level, Zylon homing per level,
  message strings. One `LOOP_HZ = 60` fixed-timestep simulation clock (`src/core/clock.ts`) with
  loops, TICKs and the star date (41 loops per digit).
- New `src/sim/energy.ts` and `src/sim/rating.ts` implementing §12/§14/§17.1/§17.10 exactly, including
  zero-energy abort and the end-sequence message lists.
- **Done when**: unit tests reproduce every manual table (e.g. 6→V12 and 3.5/s, 5 sectors→500,
  score 90 → NOVICE class 4, 161 → PILOT class 3) and the old `EnergySystem`/`ScoringSystem` are
  deleted and their callers switched.

### Phase 2 — Galaxy, fleets and the Galactic Chart
- Rebuild `SectorSystem` + `StarbaseAttackSystem` as `src/sim/galaxy.ts` (§17.4): level+3 groups of
  2/3/4 and starbases with placement rules; fleet move ticks every 0.50 star date with 255/192/32
  probabilities toward one hunted starbase; surround → `STARBASE SURROUNDED` → 1.00 star date later
  `STARBASE DESTROYED` and a 2-Zylon sector; radio damage freezes the chart.
- Chart view: blue field, white grid, ROM symbols, **two dots** (position and destination), footer
  `WARP ENERGY:nnn0` / `TARGETS:n  DC:PESCLR` / `STAR DATE:00.00` in the ROM colours, DC letters
  three-state, yellow when shields damaged. Render once per change, not per frame.
- **Done when**: chart screenshot matches the manual photo layout; tests cover counts per level,
  surround timing and that fleets never enter the player's sector; the victory-impossible bug cannot
  occur (sector counts and live ships share one source).

### Phase 3 — Renderer, starfield, views and steering
- Replace the Three.js scene with a **2D pixel renderer** (`src/render/`): a 160×100 logical playfield
  (rendered at an integer multiple, see bends) using the ROM projection (`offset = 81·(x/z·128)/256`),
  12 distance-coloured stars that stream and rotate (0.89°/loop Minsky rotation), view title lines,
  front crosshair (plus with gap) and aft crosshair (two dashes), shields tint, red-alert background
  flash. No player ship model. Remove `three` from dependencies.
- Input: keyboard steering (arrows/WASD = stick, Space = fire), gamepad, and optional mouse; aft view
  reverses left/right exactly as in M §II. Edge-triggered keys via event queue (no lost taps).
- **Done when**: front/aft screenshots look like the manual's front-view photo minus the objects; the
  aspect is correct at 16:9 and 4:3; Three.js is gone.

### Phase 4 — Control panel and title-line messages
- Panel exactly `V:00 K:00 E:9999 T:0` / `θ:+00 Φ:+00 R:+000` in the ROM colours on the dark-blue band;
  low-energy pink flash, shields-out orange; T↔C with tracking; θΦR in gradons/centrons with ±, frozen
  when the computer is damaged; V = ∞ in hyperspace.
- One message line at the top showing ROM phrases one segment at a time (60/254-loop timing).
- Delete the hull field, THREAT/SEC/RANGE text, "OK/DMG", blinking red centre messages.
- **Done when**: the HUD crop is a pixel-for-pixel layout match for the manual's HUD strip photo.

### Phase 5 — Zylons, photons, shields, meteors and explosions
- `src/sim/zylons.ts` per §17.8: max 2 ships + 1 torpedo, 4/8 fighter, 3/8 cruiser, 1/8 basestar,
  velocity-index flight patterns, attack weave, back attacks on WARRIOR+, swing with player turns,
  torpedo rules (§17.7) with per-level homing.
- Photons: alternating barrels, 23-loop refire, 255-loop life, 10 energy, sparkle; basestar only dies
  to a torpedo < 15 loops old.
- Shields: up = −100 per hit; down = ship destroyed. Meteors per §16/§17.7. 32-fragment explosions.
  Red alert only on arrival in a Zylon sector.
- Sprites from the ROM bitmaps with 8 distance size cells, grey/white brightness by range, flickering
  basestar.
- **Done when**: a seeded NOVICE run in the capture harness shows a fighter H-sprite approaching,
  being shot and exploding; tests cover the basestar rule and shields-down death.

### Phase 6 — Attack computer, tracking and lock-on
- C toggles the computer (½/s drain); box per §17.6 geometry with the moving blip; A/B/C mark pairs with
  the ROM windows; locked fire makes torpedoes home and auto-fires the second.
- M toggles target 0/1; T tracking computer auto-switching F/A; starbase as T=2; warp marker as T=3.
- **Done when**: the attack-computer crop matches the manual diagram; tests cover lock windows.

### Phase 7 — Damage control
- §17.3 in full: probabilities per level, damaged vs destroyed, the six effects (one barrel, speed
  jitter/cap, shield flicker, θΦR freeze/no crosshairs, LRS mirror/blank, radio freeze), `DAMAGE CONTROL`
  messages and the damage-report beep; repaired only by docking.
- **Done when**: tests force each subsystem state and assert its effect; chart DC letters show all three
  colours.

### Phase 8 — Hyperwarp
- §9 + §17.5: H from front view; acceleration, star trails, `HYPERSPACE` (stars hidden, V ∞),
  deceleration; cost charged per hyperspace loop; marker between long cross hairs with cost-scaled
  random kicks (not NOVICE); landing offset from marker offset; leaving front view randomises the
  landing; abort with 0–9 (−100); red alert on arrival; landing near the vertical middle clusters
  targets.
- **Done when**: a scripted PILOT warp held centred lands in the target sector and one pushed to the right
  cross hair lands one sector right (the M §IX tactic); captures show the trail and hyperspace phases.

### Phase 9 — Long-range scan
- Black background, title line, panel; top-down z-x plane ±40,000 KM; your ship icon at the centre;
  targets and meteors as flashing random-colour squares; starbase icon; rotates with steering;
  damaged = mirror, destroyed = only your ship. No crosshair or attack computer over it.
- **Done when**: the LRS capture matches the manual's LRS photo layout.

### Phase 10 — Starbases and docking
- Orange three-part pulsing starbase sprite; starbase sectors have no Zylons/meteors; orbit conditions
  per §17.9; `ORBIT ESTABLISHED` → `STANDBY` → transfer vessel → `TRANSFER COMPLETE` (energy 9999,
  all repaired); any key except G or stick → `DOCKING ABORTED`; shooting it = −3 and gone.
- **Done when**: a scripted approach at speed 2 then 0 docks only when centred and close; tests cover
  abort and the no-re-dock loop.

### Phase 11 — Attract mode, title, pause and end-of-mission
- Attract mode = live demo flight with `NOVICE MISSION` / `STAR RAIDERS` / `COPYRIGHT ATARI 1979` on
  the title line; SELECT/START mapped to keys (Tab/Enter or 1–4 + Enter) and on-screen buttons for touch;
  P pause until stick/key; idle 9 minutes → attract; `WHATS WRONG?` for unknown keys.
- End sequence on the title line (`STAR FLEET TO / STAR CRUISER 7 / … / NEW RANK IS: / <rank> /
  CLASS n`), then a debrief card (bend) with the score breakdown.
- **Done when**: power-on to mission to rank works keyboard-only; capture shows attract and debrief.

### Phase 12 — Audio
- POKEY-style Web Audio synth (`src/audio/pokey.ts`): engine noise rumble by speed, photon whoosh,
  Zylon/shield/starship explosions, hyperwarp transit beeps, red-alert two-tone, acknowledge,
  damage-report and message-from-starbase tunes, with the ROM priorities. Mute key and volume.
  Dispose the AudioContext on restart.
- **Done when**: every event in §17.12 plays; no AudioContext leak across 5 restarts.

### Phase 13 — Modern polish (the bends below)
- Touch controls and PWA install, settings panel (palette/CRT/star count/difficulty help), NOVICE
  tutorial overlay, local rank history, title key art (if generated).

---

## Part 4 — Deliberate modern bends

Rules and numbers stay exactly as the manual/ROM. These are the places to bend, each behind a setting
where it changes the look:

1. **Controls**: keyboard steering (arrows/WASD), mouse aim and gamepad as well as a "stick" feel;
   touch on mobile. Original used only the joystick.
2. **Resolution**: render the 160×100 playfield at a crisp integer scale, letterboxed to 16:9/4:3; an
   optional **CRT/scanline filter**. Optional "HD sprites" that smooth the ROM bitmaps, never redraw them.
3. **Starfield density**: the ROM shows 12 stars; offer 12 ("Classic") or ~48 ("Enhanced") with the
   same motion rules, because 12 pixels on a 27-inch screen feel empty.
4. **Readable HUD**: the same two rows and colours, but a larger crisp pixel font and safe margins.
5. **Messages**: the title line keeps ROM phrases; add an optional small subtitle for new players
   (e.g. what "RED ALERT" means) on NOVICE only.
6. **Debrief screen**: after the ROM end sequence, a card with the score breakdown (kills, energy, time,
   starbases) and the manual's insignia style; keep a local history of ranks.
7. **Pause menu** on P/Esc with key help (the original P just froze).
8. **Audio**: POKEY character, but mixed for headphones (stereo panning for left/right barrels and
   enemy position), volume and mute.
9. **Accessibility**: optional slower game speed for NOVICE, colour-blind safe DC letters (add
   underline/strike for damaged/destroyed).
10. **Title key art**: an original painting in the cover's mood behind the attract screen (see
    Part 5). The game screen itself stays 1979.

Not bent: speeds, drains, costs, counts, lock rules, damage, docking, rating formula, sprites' shapes,
the panel layout, the chart layout, and "you never see your own ship".

---

## Part 5 — Should we generate assets on the Spark's ComfyUI?

**Yes, but only for three non-game assets. No for everything inside the game screen.**

| Asset | Generate? | Why |
|---|---|---|
| **Title/attract key art** (one 16:9 backdrop, plus a 1:1 crop) | **Yes** | The cover's mood (golden pyramid basestar, white-blue starship, purple-red nebula, cloud-tile grid) is the strongest "this is Star Raiders" signal for players today, and it must be original art, not a copy of Atari's cover. A Flux/SDXL run on the Spark can produce it cheaply; it sits behind the attract screen only. |
| **Rank insignia** (4 badges: Novice zig-zag, Pilot bar, Warrior bolt, Commander bolt+star) for the debrief card | **Yes** | The manual's insignia discs are a nice, cheap modern touch for the debrief; original renditions in that style. |
| **App icon / PWA splash / social card** | **Yes** | Needed for PWA install and sharing; derived from the key art. |
| Zylon, starbase, meteor, torpedo, transfer-vessel sprites | **No** | They are exact ROM bitmaps (MANUAL_SPEC §18.3); hand-encoding them is faster and faithful. Generated sprites would break the look. |
| HUD, chart, LRS, attack-computer graphics, fonts | **No** | Line art and an 8×8 pixel font; code-drawn. |
| Starfield, explosions, hyperwarp trails | **No** | Procedural per the ROM. |
| Sound effects and music | **No** | The original has no music, and POKEY sounds are best synthesized from the ROM parameters (§17.12) with Web Audio; generative audio models would sound wrong. |

Do it as part of Phase 13, after Joe approves; nothing was started or loaded in ComfyUI for this audit.
