# Star Raiders - Feature Enhancement Roadmap

> A prioritized list of features to bring this Star Raiders clone closer to the authentic Atari 800 Star Raiders (1979) experience.

---

## Current Implementation Status

### Already Implemented

| Feature | Description | Status |
|---------|-------------|--------|
| **Multiple Views** | Front/Aft view, Galactic Chart, Long-Range Scan | Complete |
| **Energy System** | Energy management, engine/shield/torpedo consumption | Complete |
| **Combat** | Photon torpedoes, 3 enemy types (Fighter, Cruiser, Basestar) | Complete |
| **Damage System** | 6 damageable components (engines, shields, photons, radio, LRS, computer) | Complete |
| **Difficulty Levels** | Novice, Pilot, Warrior, Commander | Complete |
| **Galactic Map** | 8x8 sector grid with starbases | Complete |
| **Scoring** | Basic scoring system | Complete |
| **Audio Framework** | SoundManager infrastructure | Complete |

---

## Prioritized Feature Enhancements

### HIGH Priority - Core Gameplay

These features are essential to recreate the authentic Star Raiders gameplay loop.

#### 1. Enemy Projectiles + Player Damage
**Impact:** Critical - Makes combat meaningful and dangerous

Currently enemies exist but cannot harm the player. The `shouldFire()` method exists but no projectiles are created.

**Implementation Tasks:**
- Add enemy projectile creation in `CombatSystem`
- Implement projectile-player collision detection
- Add player hull/damage state to `GameState`
- Apply damage to ship systems when hit

**Files to Modify:**
- `src/systems/CombatSystem.ts` - Enemy projectile management
- `src/game/GameLoop.ts` - Player hit detection
- `src/game/GameState.ts` - Player hull/damage state

**Estimated Complexity:** Medium

---

#### 2. Hyperwarp Animation/Sequence
**Impact:** Critical - Core navigation mechanic

Visual warp travel between sectors with energy drain. The galactic map exists but sector-to-sector travel lacks the iconic warp sequence.

**Implementation Tasks:**
- Create warp tunnel visual effect (starfield stretch)
- Add warp initiation countdown
- Implement energy cost calculation (distance-based)
- Handle warp abort mechanics
- Add warp destination indicator

**Files to Modify:**
- `src/game/GameState.ts` - Warp state management
- `src/game/GameLoop.ts` - Warp sequence handling
- `src/render/` - New warp visual effects

**Estimated Complexity:** Medium-High

---

#### 3. Starbase Docking
**Impact:** Critical - Essential for survival gameplay loop

Logic for starbases exists but docking/repair/refuel is not implemented. This is crucial for extended gameplay.

**Implementation Tasks:**
- Add docking approach detection (proximity + velocity)
- Implement docking animation/sequence
- Create repair/refuel logic (time-based or instant)
- Add energy transfer from starbase
- Repair damaged ship systems

**Files to Modify:**
- `src/systems/` - New docking system
- `src/game/GameState.ts` - Docking state
- `src/render/` - Docking visual feedback

**Estimated Complexity:** Medium

---

#### 4. Player Damage from Combat
**Impact:** High - Tied to enemy projectiles

When hit, player ship should take damage to specific systems (matching existing damage system).

**Implementation Tasks:**
- Determine which system is hit (randomized or directional)
- Apply damage state to component
- Visual/audio feedback for hits
- Screen shake or flash effect

**Files to Modify:**
- `src/game/GameState.ts` - Damage application
- `src/render/` - Hit feedback effects

**Estimated Complexity:** Low (if enemy projectiles exist)

---

### MEDIUM Priority - Strategic Depth

These features add the strategic layer that made Star Raiders compelling.

#### 5. Starbase Destruction Timer
**Impact:** Medium-High - Creates urgency and strategic decisions

In the original, Zylons would attack and destroy undefended starbases over time, creating time pressure.

**Implementation Tasks:**
- Add threat timer per starbase
- Increase threat when Zylons in adjacent sectors
- Destroy starbase when timer expires
- Update galactic map to show starbase status
- Add warning alerts for endangered starbases

**Files to Modify:**
- `src/game/GameState.ts` - Starbase threat tracking
- `src/game/GameLoop.ts` - Timer updates
- New starbase threat visualization

**Estimated Complexity:** Medium

---

#### 6. Enemy Sector Movement
**Impact:** Medium - Dynamic galactic situation

Zylons should move between sectors on the galactic map, changing the strategic landscape.

**Implementation Tasks:**
- Add Zylon movement AI logic
- Movement toward starbases (threat behavior)
- Update galactic map on movement
- Movement during hyperwarp (time passes)

**Files to Modify:**
- `src/game/GameState.ts` - Enemy movement logic
- `src/game/GameLoop.ts` - Movement triggers

**Estimated Complexity:** Medium

---

#### 7. Red Alert System
**Impact:** Medium - Audio/visual warning when under attack

Critical feedback when enemies are attacking, especially from behind.

**Implementation Tasks:**
- Detect when player is being targeted
- Trigger audio alarm
- Flash screen borders or indicator
- Show attack direction

**Files to Modify:**
- `src/game/GameLoop.ts` - Alert detection
- `src/render/` - Visual alerts
- `src/audio/SoundManager.ts` - Alert sounds

**Estimated Complexity:** Low

---

#### 8. Tracking Computer Display
**Impact:** Medium - HUD enhancement for target acquisition

Shows direction and distance to nearest enemy, essential for combat.

**Implementation Tasks:**
- Calculate bearing to nearest target
- Display directional indicator on HUD
- Show distance readout
- Indicate if target is fore or aft

**Files to Modify:**
- `src/render/` - HUD overlay
- `src/game/GameLoop.ts` - Target calculation

**Estimated Complexity:** Low

---

### LOW Priority - Polish

These features enhance game feel but aren't critical for core gameplay.

#### 9. Mission Debriefing/Ranking
**Impact:** Low - End-game reward and replayability

Classic Star Raiders had detailed score analysis and rank assignment (from "Garbage Scow Pilot" to "Star Commander Class 1").

**Implementation Tasks:**
- Score calculation based on time, kills, starbases saved
- Rank assignment table
- Debriefing screen with statistics
- Game over detection (all starbases destroyed, player destroyed)

**Files to Modify:**
- New debriefing screen component
- `src/game/GameState.ts` - Statistics tracking

**Estimated Complexity:** Medium

---

#### 10. Sound Effects
**Impact:** Low-Medium - Immersion and feedback

Comprehensive audio for game events.

**Sound Effects Needed:**
- Engine hum (varies with thrust)
- Photon torpedo fire
- Torpedo impacts/explosions
- Shield hit sounds
- Hyperwarp sound sequence
- Alert klaxon
- Docking sounds
- System damage sounds

**Files to Modify:**
- `src/audio/SoundManager.ts` - Sound implementation
- Audio asset files

**Estimated Complexity:** Medium (asset creation)

---

#### 11. Visual Effects
**Impact:** Low-Medium - Game feel enhancement

Polish effects for immersion.

**Effects Needed:**
- Shield impact flashes
- Explosion particles
- Warp tunnel/starfield stretch
- Screen shake on damage
- Scan line / CRT effect (optional retro)

**Files to Modify:**
- `src/render/` - Effect shaders/particles
- Three.js post-processing

**Estimated Complexity:** Medium-High

---

#### 12. Fore/Aft Shield Selection
**Impact:** Low - Tactical depth

Directional shield control for strategic combat.

**Implementation Tasks:**
- Add shield direction toggle (F/A)
- Shields only protect from selected direction
- Energy distribution between shields
- HUD indicator for shield direction

**Files to Modify:**
- `src/game/GameState.ts` - Shield direction state
- Input handling
- HUD updates

**Estimated Complexity:** Low

---

## Recommended Implementation Order

For the most impactful development path:

| Order | Feature | Rationale |
|-------|---------|-----------|
| 1 | Enemy Projectiles + Player Damage | Makes combat meaningful - currently no threat |
| 2 | Hyperwarp Sequence | Core navigation - completes the gameplay loop |
| 3 | Starbase Docking | Essential for survival - enables extended play |
| 4 | Starbase Timer + Enemy Movement | Strategic pressure - adds time-based tension |
| 5 | Red Alert + Tracking Computer | Combat feedback - improves player awareness |
| 6 | Audio/Visual Polish | Game feel - enhances immersion |
| 7 | Mission Debriefing | Completion reward - adds replayability |
| 8 | Shield Direction | Tactical depth - advanced gameplay option |

---

## Technical Notes

### Architecture Assessment
- **Framework:** TypeScript + Three.js with clean separation of concerns
- **Extensibility:** Most systems have stubs ready for extension (e.g., enemy firing logic exists)
- **Recommendation:** Consider adding a "hull integrity" stat for player ship survivability

### Key Files Reference
| System | Primary File |
|--------|-------------|
| Combat | `src/systems/CombatSystem.ts` |
| Game State | `src/game/GameState.ts` |
| Game Loop | `src/game/GameLoop.ts` |
| Rendering | `src/render/` |
| Audio | `src/audio/SoundManager.ts` |

---

## Classic Reference

This roadmap is based on analysis of the original **Atari 800 Star Raiders (1979)** by Doug Neubauer. The goal is authenticity to the classic experience while leveraging modern web technologies.

---

*Document generated as part of Star Raiders clone enhancement analysis*
