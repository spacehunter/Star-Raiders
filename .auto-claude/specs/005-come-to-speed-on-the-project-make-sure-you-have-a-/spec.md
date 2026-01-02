# Specification: Fix Galactic Chart Grid Dimensions (8×8 → 16×8)

## Overview

The Star Raiders game currently displays the Galactic Chart with an incorrect 8×8 sector grid when it should be 16×8 (16 columns by 8 rows). This specification covers the investigation and fix of the grid dimensions throughout the codebase to match the original Atari 800 Star Raiders game's galaxy layout.

## Workflow Type

**Type**: feature

**Rationale**: This is a targeted fix to correct the galactic chart dimensions, requiring coordinated changes across multiple files (system, view, and state) while preserving existing functionality.

## Task Scope

### Services Involved
- **main** (primary) - Single TypeScript application containing all game logic

### This Task Will:
- [ ] Update `SectorSystem` to use separate width (16) and height (8) dimensions instead of single GRID_SIZE constant
- [ ] Update `GalacticChart` grid creation to render 16×8 cells
- [ ] Update CSS grid layout for proper 16×8 display
- [ ] Update cursor movement bounds to match new grid dimensions
- [ ] Update player starting position to center of new grid (8, 4)
- [ ] Update starbase placement regions for 16-column grid
- [ ] Verify all grid-dependent logic uses correct width/height values

### Out of Scope:
- Changing game mechanics or difficulty settings
- Modifying visual sprites or styling (only layout changes)
- Changes to other views (Long Range Scan, Attack Computer, etc.)
- Gameplay balancing adjustments

## Service Context

### Main Application

**Tech Stack:**
- Language: TypeScript
- Framework: None (Vanilla TS + Three.js for 3D rendering)
- Build Tool: Vite
- Key directories: `src/` (source code)

**Entry Point:** `src/main.ts`

**How to Run:**
```bash
npm run dev
```

**Port:** 5173

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `src/systems/SectorSystem.ts` | main | Replace `GRID_SIZE = 8` with `GRID_WIDTH = 16` and `GRID_HEIGHT = 8`; update all grid iteration and bounds checking |
| `src/views/GalacticChart.ts` | main | Update grid creation loops from 8×8 to 16×8; update CSS grid-template-columns; update cursor bounds |
| `src/game/GameState.ts` | main | Update initial sector position from (4,4) to (8,4) to center in 16×8 grid |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `src/systems/SectorSystem.ts` | Current grid iteration pattern; sector data structure |
| `src/views/GalacticChart.ts` | DOM creation pattern; CSS injection pattern |
| `src/game/GameState.ts` | State initialization pattern |

## Patterns to Follow

### Grid Dimension Constants Pattern

From `src/systems/SectorSystem.ts`:

```typescript
// CURRENT (incorrect):
public static readonly GRID_SIZE = 8;

// NEW (correct):
public static readonly GRID_WIDTH = 16;
public static readonly GRID_HEIGHT = 8;
```

**Key Points:**
- Use separate constants for width and height
- All iterations must use appropriate constant (X loops use WIDTH, Y loops use HEIGHT)
- Bounds checking must use correct constant

### Grid Creation Pattern

From `src/views/GalacticChart.ts`:

```typescript
// CURRENT (8×8):
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 8; x++) {
    // create cell
  }
}

// NEW (16×8):
for (let y = 0; y < SectorSystem.GRID_HEIGHT; y++) {
  for (let x = 0; x < SectorSystem.GRID_WIDTH; x++) {
    // create cell
  }
}
```

**Key Points:**
- Import SectorSystem constants to ensure consistency
- Y loop uses GRID_HEIGHT (8)
- X loop uses GRID_WIDTH (16)

### CSS Grid Template Pattern

From `src/views/GalacticChart.ts` styles:

```css
/* CURRENT (8×8): */
.chart-grid {
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
}

/* NEW (16×8): */
.chart-grid {
  grid-template-columns: repeat(16, 1fr);
  grid-template-rows: repeat(8, 1fr);
}
```

**Key Points:**
- Columns = 16 (width)
- Rows = 8 (height)
- May need to adjust aspect ratio for proper display

## Requirements

### Functional Requirements

1. **Grid Dimensions**
   - Description: The galactic chart must display a 16×8 grid (16 columns, 8 rows)
   - Acceptance: Visual count confirms 16 columns and 8 rows when chart is displayed

2. **Sector Data Structure**
   - Description: SectorSystem must manage a 16×8 array of sectors
   - Acceptance: `getAllSectors()` returns 8 rows of 16 sectors each

3. **Cursor Navigation**
   - Description: Cursor must navigate full 16×8 grid
   - Acceptance: Cursor can move to column 0-15 (X) and row 0-7 (Y)

4. **Starting Position**
   - Description: Player starts in center of grid
   - Acceptance: Initial sector position is (8, 4) - centered in 16×8

5. **Starbase Placement**
   - Description: Starbases are distributed across the wider grid
   - Acceptance: Starbases appear in various regions of the 16-column grid

### Edge Cases

1. **Boundary Navigation** - Cursor at x=0 cannot go left; cursor at x=15 cannot go right
2. **Starbase Placement Regions** - Regions must be recalculated for 16-column grid
3. **Warp Energy Calculation** - Distance calculation must work with 16×8 coordinates
4. **Long Range Scan** - If it uses sector neighbors, must handle edge sectors correctly

## Implementation Notes

### DO
- Use `SectorSystem.GRID_WIDTH` and `SectorSystem.GRID_HEIGHT` constants throughout
- Update cursor bounds in `moveCursor()` to use `GRID_WIDTH - 1` (15) for X and `GRID_HEIGHT - 1` (7) for Y
- Update starbase placement regions to cover the full 16-column width
- Test cursor navigation to all corners: (0,0), (15,0), (0,7), (15,7)
- Adjust CSS `width` property of `.chart-grid` if aspect ratio looks wrong

### DON'T
- Don't change the SPRITES patterns (they are 8×8 pixel patterns for icons, not grid dimensions)
- Don't modify cell styling or sprite rendering logic
- Don't change the game difficulty or enemy/starbase counts
- Don't touch the 3D rendering code or other views

## Development Environment

### Start Services

```bash
npm install
npm run dev
```

### Service URLs
- Game: http://localhost:5173

### Required Environment Variables
- None required

## Success Criteria

The task is complete when:

1. [ ] Galactic chart displays 16 columns × 8 rows
2. [ ] Cursor can navigate to all 128 sectors (16×8)
3. [ ] Player starts at sector (8, 4) - center of grid
4. [ ] Enemies and starbases spawn across the full 16×8 grid
5. [ ] Warp navigation works correctly to any sector
6. [ ] No console errors
7. [ ] Existing tests still pass (if any)
8. [ ] Game is playable from start to finish

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| Grid Dimensions | `src/systems/SectorSystem.ts` | GRID_WIDTH = 16, GRID_HEIGHT = 8 |
| Sector Array | `src/systems/SectorSystem.ts` | sectors array is 8 rows × 16 columns |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| Chart + SectorSystem | GalacticChart ↔ SectorSystem | Chart correctly displays all 128 sectors |
| GameState + SectorSystem | GameState ↔ SectorSystem | Player starts at (8,4), can warp to any sector |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| View Galactic Chart | 1. Start game 2. Press 'G' | Chart shows 16×8 grid |
| Navigate Chart | 1. Open chart 2. Move cursor to edges | Cursor reaches x=0..15, y=0..7 |
| Warp Travel | 1. Open chart 2. Select far sector 3. Warp | Player arrives at correct sector |

### Browser Verification (if frontend)
| Page/Component | URL | Checks |
|----------------|-----|--------|
| Galactic Chart | `http://localhost:5173` (press G in game) | Count 16 columns, 8 rows; cursor works; starbases/enemies display |

### Database Verification (if applicable)
| Check | Query/Command | Expected |
|-------|---------------|----------|
| N/A | N/A | No database in this project |

### QA Sign-off Requirements
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Browser verification complete - grid is 16×8
- [ ] Cursor navigation works to all 128 sectors
- [ ] No regressions in existing functionality
- [ ] Code follows established patterns (TypeScript, class-based)
- [ ] No security vulnerabilities introduced

## Technical Details

### Current Hardcoded Values to Change

**SectorSystem.ts Line 17:**
```typescript
public static readonly GRID_SIZE = 8;
```
→ Change to:
```typescript
public static readonly GRID_WIDTH = 16;
public static readonly GRID_HEIGHT = 8;
```

**GalacticChart.ts Lines 92-93:**
```typescript
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 8; x++) {
```
→ Change to use SectorSystem constants

**GalacticChart.ts Lines 244-245 (CSS):**
```css
grid-template-columns: repeat(8, 1fr);
grid-template-rows: repeat(8, 1fr);
```
→ Change to:
```css
grid-template-columns: repeat(16, 1fr);
grid-template-rows: repeat(8, 1fr);
```

**GalacticChart.ts Lines 452-453:**
```typescript
const newX = Math.max(0, Math.min(7, this.cursorX + dx));
const newY = Math.max(0, Math.min(7, this.cursorY + dy));
```
→ Change to:
```typescript
const newX = Math.max(0, Math.min(15, this.cursorX + dx));  // GRID_WIDTH - 1
const newY = Math.max(0, Math.min(7, this.cursorY + dy));   // GRID_HEIGHT - 1
```

**GameState.ts Lines 73-74, 95-96:**
```typescript
public sectorX: number = 4;
public sectorY: number = 4;
```
→ Change starting X to 8 (center of 16-column grid)

**SectorSystem.ts Lines 98-103 (starbase regions):**
```typescript
const regions = [
  { minX: 0, maxX: 3, minY: 0, maxY: 3 },
  { minX: 4, maxX: 7, minY: 0, maxY: 3 },
  { minX: 0, maxX: 3, minY: 4, maxY: 7 },
  { minX: 4, maxX: 7, minY: 4, maxY: 7 },
];
```
→ Expand to cover 16 columns (adjust maxX values or add more regions)
