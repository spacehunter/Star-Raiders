# Enemy Speed Tuning Guide

## Current Configuration

Edit `src/config/EnemyConfig.ts` to adjust enemy speeds.

**Current values (as of latest update):**
- Fighter: impulse 4 (200 units/sec) - moderate speed, trackable
- Cruiser: impulse 2 (100 units/sec) - slow, tactical
- Basestar: impulse 0 (0 units/sec) - stationary

**Previous values (too fast):**
- Fighter: impulse 7 (350 units/sec)
- Cruiser: impulse 5 (250 units/sec)

## Speed Scale Reference

| Impulse | Units/Sec | Description |
|---------|-----------|-------------|
| 1 | 50 | Very slow, easy tracking |
| 2 | 100 | Slow, comfortable combat |
| 3 | 150 | Moderate, requires attention |
| 4 | 200 | Fast, challenging tracking |
| 5 | 250 | Very fast, difficult to hit |
| 6 | 300 | Extremely fast |
| 7 | 350 | Near player max speed |
| 8 | 400 | Very near player max |
| 9 | 450 | Player maximum speed |

## Runtime Testing (Browser Console)

You can adjust speeds **without recompiling** using the browser console:

```javascript
// Slow down Fighters significantly
ENEMY_CONFIG.speeds.FIGHTER = 2;  // 100 units/sec

// Moderate Fighter speed (current default)
ENEMY_CONFIG.speeds.FIGHTER = 4;  // 200 units/sec

// Fast Fighter (original setting)
ENEMY_CONFIG.speeds.FIGHTER = 7;  // 350 units/sec

// Very slow Cruiser
ENEMY_CONFIG.speeds.CRUISER = 1;  // 50 units/sec

// Moderate Cruiser (current default)
ENEMY_CONFIG.speeds.CRUISER = 2;  // 100 units/sec

// After changing values, reload the mission
// (Hyperwarp to a new sector to spawn fresh enemies with new speeds)
```

## Testing Methodology

### 1. Test at Impulse 0 (Stationary Player)
This is the **baseline test** - if you can't engage enemies when stationary, they're too fast.

**Questions to answer:**
- Can you visually track enemies as they move?
- Can you aim the crosshair and lead your torpedoes effectively?
- Do enemies feel threatening but fair?
- Is combat satisfying, or frustrating?

**Expected behavior:**
- Fighters should move quickly but be trackable
- Cruisers should move slowly and predictably
- You should be able to hit enemies consistently with practice

### 2. Test at Impulse 3-4 (Moderate Player Speed)
This is **normal combat speed** - typical player engagement scenario.

**Questions to answer:**
- Do enemies feel relatively faster or slower?
- Is combat still engaging and challenging?
- Can you maneuver to avoid incoming fire while returning fire?
- Does the speed difference feel balanced?

### 3. Test at Impulse 7-9 (High Player Speed)
This tests **chase scenarios** - can you pursue fleeing enemies?

**Questions to answer:**
- Can you still engage enemies at high speed?
- Do they feel too slow (can you easily overtake them)?
- Is it harder to aim due to your own speed?
- Does combat feel too easy or too hard?

### 4. Test Enemy Behaviors

**Fighter behavior:**
- IDLE: Gentle bobbing (rotation only)
- PATROL: Aggressive pursuit with weaving
- ATTACK: Orbit strafe (30-unit radius circle)

**Cruiser behavior:**
- PATROL: Waypoint following at 60% speed
- ATTACK: Tactical approach maintaining 40-60 unit distance
  - Too close: Back off at 50% speed
  - Too far: Approach at 100% speed
  - In range: Strafe at 30% speed

**Questions:**
- Do the different behaviors feel distinct?
- Are the speed multipliers (60%, 50%, 30%) appropriate?
- Does the Cruiser's tactical behavior feel smart or frustrating?

## Suggested Starting Values

### Conservative (Easier Combat)
Good for **testing combat mechanics** or **casual gameplay**:
- Fighter: impulse 2-3 (100-150 units/sec)
- Cruiser: impulse 1-2 (50-100 units/sec)

### Moderate (Balanced) ← **CURRENT DEFAULT**
Recommended **starting point for tuning**:
- Fighter: impulse 4 (200 units/sec)
- Cruiser: impulse 2 (100 units/sec)

### Challenging (Faster Combat)
For players who want **intense, skill-based** combat:
- Fighter: impulse 5-6 (250-300 units/sec)
- Cruiser: impulse 3-4 (150-200 units/sec)

### Aggressive (Original System)
**Previous settings** - found to be too fast:
- Fighter: impulse 7 (350 units/sec)
- Cruiser: impulse 5 (250 units/sec)

## Behavior Multipliers

Current multipliers (defined in `EnemyConfig.ts`):
- `CRUISER_PATROL`: 0.6 (60% speed when patrolling)
- `CRUISER_BACKOFF`: 0.5 (50% speed when backing off)
- `CRUISER_STRAFE`: 0.3 (30% speed when strafing)

**Testing multipliers:**
If Cruiser behavior feels wrong, try adjusting these:

```javascript
// Make patrol more aggressive
ENEMY_CONFIG.multipliers.CRUISER_PATROL = 0.8;  // 80% speed

// Make backoff faster (retreat quicker)
ENEMY_CONFIG.multipliers.CRUISER_BACKOFF = 0.7;  // 70% speed

// Make strafing slower (more tactical)
ENEMY_CONFIG.multipliers.CRUISER_STRAFE = 0.2;  // 20% speed
```

## Difficulty Scaling (Future Enhancement)

Once you find optimal speeds for the **WARRIOR** difficulty, consider scaling for other difficulties:

| Difficulty | Fighter Impulse | Cruiser Impulse | Notes |
|------------|----------------|----------------|-------|
| NOVICE | Base - 2 | Base - 2 | Much slower, easier to track |
| PILOT | Base - 1 | Base - 1 | Slightly slower |
| WARRIOR | Base | Base | Your tuned baseline |
| COMMANDER | Base + 1 | Base + 1 | Faster, more challenging |

Example: If you settle on Fighter: 4, Cruiser: 2 for WARRIOR:
- NOVICE: Fighter: 2, Cruiser: 0 (stationary - may need minimum of 1)
- PILOT: Fighter: 3, Cruiser: 1
- WARRIOR: Fighter: 4, Cruiser: 2
- COMMANDER: Fighter: 5, Cruiser: 3

## Other Considerations

### Spawn Distance
Enemies spawn at various distances. If speeds are reduced significantly, consider:
- Reducing spawn distances so enemies reach combat range faster
- Adjusting pursuit range (currently 200 units)

### Pursuit Range
Enemies only actively move when within 200 units of the player. If speeds drop below impulse 3:
- Consider reducing pursuit range to 150 units
- Or enemies may feel too passive

### Energy Balance
Energy consumption = player's impulse level per second. If enemies are slower:
- Players may stay at lower speeds (consuming less energy)
- Game may become easier due to better energy efficiency
- May need to adjust enemy count or other difficulty factors

### Attack Ranges
Current attack ranges:
- Fighter: 80 units
- Cruiser: 120 units
- Basestar: 150 units

These don't need to change with speed, but be aware that slower enemies may have trouble closing to attack range if the player is kiting.

## Recording Your Findings

As you test, record observations:

```
Test Session: [Date]
Fighter Speed: [impulse level]
Cruiser Speed: [impulse level]

Player Impulse 0:
- Can I track: [Yes/No]
- Can I hit: [Easy/Medium/Hard]
- Feel: [Too slow/Balanced/Too fast]

Player Impulse 3-4:
- Relative speed: [Too slow/Good/Too fast]
- Combat engagement: [Boring/Fun/Frustrating]

Player Impulse 7-9:
- Chase ability: [Too easy/Balanced/Can't catch]
- Combat feel: [...]

Final verdict: [Keep/Adjust to X/Revert]
```

## Recommended Testing Process

1. **Start with defaults** (Fighter: 4, Cruiser: 2)
2. **Play 3-4 combat encounters** at different player speeds
3. **Record your impressions** using the template above
4. **Adjust in small increments** (±1 impulse level at a time)
5. **Repeat until combat feels right**
6. **Lock in final values** in `EnemyConfig.ts`
7. **(Optional) Implement difficulty scaling**

## Quick Reference Commands

```javascript
// Show current config
console.log(ENEMY_CONFIG.speeds);

// Fighter adjustments
ENEMY_CONFIG.speeds.FIGHTER = 3;  // Slower
ENEMY_CONFIG.speeds.FIGHTER = 5;  // Faster

// Cruiser adjustments
ENEMY_CONFIG.speeds.CRUISER = 1;  // Slower
ENEMY_CONFIG.speeds.CRUISER = 3;  // Faster

// Multiplier tweaks
ENEMY_CONFIG.multipliers.CRUISER_PATROL = 0.5;  // Slower patrol
ENEMY_CONFIG.multipliers.CRUISER_PATROL = 0.8;  // Faster patrol
```

After adjusting, hyperwarp to a new sector to test with fresh enemies.
