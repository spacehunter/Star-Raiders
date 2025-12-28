# Star Raiders: Web Implementation Guide

## Purpose

This guide provides a structured, phase-by-phase approach to implementing the Star Raiders web game. Each phase is designed to be a self-contained unit of work that can be handed off to a coding AI for implementation. The phases build upon each other, ensuring that the game is developed in a logical and manageable manner.

---

## Phase 1: Project Setup and Basic Scene

### Objectives

Establish the foundational infrastructure for the game, including the project structure, Three.js scene, and basic player ship controls.

### Tasks

#### 1.1 Initialize Project

Create a new web project using a modern build tool such as Vite. Install the necessary dependencies, including Three.js.

```bash
npm create vite@latest star-raiders -- --template vanilla
cd star-raiders
npm install three
```

#### 1.2 Create Basic Three.js Scene

Set up a basic Three.js scene with a camera, renderer, and a simple starfield background. The starfield should be created using a particle system with randomly positioned points.

**Key Components:**
- `PerspectiveCamera` with appropriate field of view (FOV around 75 degrees)
- `WebGLRenderer` with antialiasing enabled
- `Scene` to hold all objects
- Particle system for starfield (use `Points` with `PointsMaterial`)

#### 1.3 Implement Player Ship Model

Create a simple geometric model for the player's ship using Three.js primitives (boxes, cones, etc.). The ship should be positioned at the origin and oriented to face forward along the negative Z-axis.

**Ship Design:**
- Angular, geometric design consistent with 1970s sci-fi aesthetic
- Use basic shapes: cones for the nose, boxes for the body and wings
- Blue/white color scheme
- Scale appropriately for the scene

#### 1.4 Basic Movement Controls

Implement basic mouse controls to rotate the player's ship. The mouse movement should control the ship's pitch (up/down) and yaw (left/right).

**Control Mapping:**
- Mouse X-axis → Ship yaw rotation
- Mouse Y-axis → Ship pitch rotation
- Implement mouse sensitivity settings
- Add rotation smoothing/damping for better feel

#### 1.5 Game Loop

Implement the main game loop using `requestAnimationFrame`. The loop should update the game state and render the scene on each frame.

**Game Loop Structure:**
```
function gameLoop() {
  1. Calculate delta time
  2. Handle input
  3. Update game objects
  4. Render scene
  5. Request next frame
}
```

### Deliverables

- A working web application with a starfield background
- A player ship model that can be rotated using the mouse
- A functional game loop

---

## Phase 2: Core Gameplay Mechanics

### Objectives

Implement the fundamental gameplay mechanics, including weapon systems, energy management, and view switching.

### Tasks

#### 2.1 Front View and Aft View

Implement the ability to switch between Front View and Aft View using the F and A keys. The camera should rotate 180 degrees when switching to Aft View.

**Implementation Details:**
- Store current view state (FRONT or AFT)
- Animate camera rotation when switching views
- Reverse control inputs when in Aft View (left becomes right, etc.)
- Update HUD elements to reflect current view

#### 2.2 Photon Torpedo System

Implement the photon torpedo weapon system. When the player presses the spacebar, a photon torpedo should be created and launched from the ship's position in the direction the ship is facing.

**Torpedo Properties:**
- Geometry: Small elongated cylinder or sphere
- Material: Bright emissive material (red/orange glow)
- Speed: Fast constant velocity
- Lifespan: Despawn after traveling certain distance or time
- Visual effect: Trail or glow effect

**Collision Detection:**
- Implement raycasting or bounding box collision
- Check collisions with enemy ships
- Trigger explosion effect on hit
- Remove torpedo after collision

#### 2.3 Energy System

Implement the energy system. The player's ship should have a finite amount of energy that is consumed by various actions.

**Energy Consumption:**

| Action | Energy Cost |
|--------|-------------|
| Photon Torpedo | 5 units per shot |
| Engine Speed 1 | 1.2 units/second |
| Engine Speed 2 | 2 units/second |
| Engine Speed 3 | 3 units/second |
| Engine Speed 4 | 4 units/second |
| Engine Speed 5 | 5 units/second |
| Engine Speed 6 | 6 units/second |
| Engine Speed 7 | 7 units/second |
| Engine Speed 8 | 8 units/second |
| Engine Speed 9 | 9 units/second |
| Shields Active | 3 units/second |
| Hyperwarp | Variable (100-2410 based on distance) |

**Energy Display:**
- Show current energy level on HUD
- Warning indicator when energy is low (below 20%)
- Game over condition when energy reaches zero

#### 2.4 Engine Speed Control

Implement engine speed control using the number keys 0-9. The ship's velocity should be adjusted based on the selected speed.

**Speed Implementation:**
- Speed 0: Stationary (no movement)
- Speed 1-9: Increasing forward velocity
- Update ship position based on current speed and delta time
- Display current speed on HUD

#### 2.5 Control Panel Display

Create a basic HUD overlay that displays the player's current energy level, engine speed, and other relevant information.

**HUD Elements:**
- Energy bar or numerical display
- Current speed indicator (0-9)
- Current view indicator (FRONT/AFT)
- Star date display
- Damage indicators (for later phases)

### Deliverables

- Functional weapon system with visual feedback
- Energy management system with HUD display
- Engine speed controls
- View switching between Front and Aft
- Basic control panel overlay

---

## Phase 3: Navigation and Galactic Chart

### Objectives

Implement the navigation systems, including the Galactic Chart, Long Range Scan, and hyperwarp functionality.

### Tasks

#### 3.1 Galactic Chart

Create the Galactic Chart as a 2D overlay. The chart should display a grid of sectors, with the player's current position and destination marked.

**Chart Specifications:**
- Grid size: 8x8 sectors (64 total sectors)
- Each sector can contain:
  - Empty space (no marker)
  - 1 enemy: `<` symbol
  - 2 enemies: `=` symbol
  - 3 enemies: `>` symbol (task force)
  - 4+ enemies: `≥` symbol (fleet)
  - Friendly starbase: `*` symbol
  - Starbase under attack: `≥*` symbol

**Interaction:**
- Press G key to open/close Galactic Chart
- Use mouse or arrow keys to move destination cursor
- Display sector information on hover
- Show player's current position as one colored dot
- Show hyperwarp destination as another colored dot

#### 3.2 Sector System

Implement a sector-based galaxy system. The galaxy should be divided into sectors, each of which can contain enemies, starbases, or be empty.

**Sector Data Structure:**
```javascript
{
  position: {x: number, y: number},
  enemies: Array<Enemy>,
  starbase: Starbase | null,
  visited: boolean
}
```

**Sector Generation:**
- Randomly populate sectors with enemies and starbases based on difficulty level
- Ensure minimum number of starbases (3-4 depending on difficulty)
- Distribute enemies across sectors
- Some sectors should remain empty

#### 3.3 Hyperwarp System

Implement the hyperwarp system. When the player presses the H key, the ship should enter hyperwarp and travel to the selected destination sector.

**Hyperwarp Sequence:**
1. Check if destination is selected on Galactic Chart
2. Calculate energy cost based on distance
3. Check if player has sufficient energy
4. Play hyperwarp visual effect (starfield stretching, tunnel effect)
5. Consume energy
6. Load destination sector
7. Update player position
8. Return to normal space

**Hyperwarp Visual Effect:**
- Stars stretch into lines
- Tunnel or warp effect
- Duration: 2-3 seconds
- Sound effect during transition

**Energy Calculation:**
- Distance = Manhattan distance between current and destination sector
- Energy cost increases with distance (see energy table from Phase 2)

#### 3.4 Long Range Scan

Implement the Long Range Scan view. This should display a tactical view of the current sector, showing the positions of the player, enemies, and starbases.

**Scan Display:**
- Grid-based representation
- Player ship in center
- Enemy ships as geometric icons
- Starbase as distinct icon
- Blue/cyan color scheme
- Press L key to toggle view

**Scan Functionality:**
- Update in real-time as objects move
- Show relative positions of all objects in sector
- Indicate direction and approximate distance
- Works even when Sub-Space Radio is damaged (but won't show new enemy positions)

### Deliverables

- Functional Galactic Chart with sector display
- Sector-based galaxy system
- Hyperwarp travel between sectors
- Long Range Scan view
- Navigation integration with energy system

---

## Phase 4: Enemy AI and Combat

### Objectives

Implement the three types of Zylon enemy ships, their AI behaviors, and the complete combat system including the Attack Computer Display.

### Tasks

#### 4.1 Enemy Ship Models

Create 3D models for the three types of Zylon ships.

**Zylon Fighter:**
- Small, agile design
- Simple geometric shape (similar to player but distinct)
- Light blue or cyan coloring
- Fast movement speed

**Zylon Cruiser:**
- Medium-sized ship
- More complex geometry
- Different color (perhaps purple or magenta)
- Moderate speed

**Zylon Basestar:**
- Large, pyramid-shaped vessel (as shown in original box art)
- Yellow/gold coloring
- Imposing presence
- Slow or stationary

#### 4.2 Enemy AI Behaviors

Implement AI behaviors for each enemy type.

**Zylon Fighter AI:**
- State: Idle, Patrol, Attack
- Idle: Random movement within sector
- Attack: When player enters range, pursue and fire
- Fast, aggressive behavior
- Simple evasive maneuvers

**Zylon Cruiser AI:**
- State: Patrol, Attack
- Patrol: Follow predefined path in sector
- Attack: Only when provoked (player fires first)
- Moderate aggression
- More predictable movement

**Zylon Basestar AI:**
- State: Stationary, Defensive
- Remains in fixed position
- Has shields that must be depleted
- Only vulnerable when shields are down
- Requires close-range attack for maximum effectiveness

**Strategic AI:**
- Enemies periodically move between sectors
- Attempt to surround starbases
- Coordinate to distract player while others attack starbases

#### 4.3 Attack Computer Display

Implement the Attack Computer Display overlay on the Front View.

**Display Components:**
- Rectangular frame at bottom-right of screen
- Central targeting reticle/crosshair
- Lock-on indicators: A, B, C

**Lock-On System:**
- **A indicators** (top corners): Horizontal lock achieved
  - Appears when target is horizontally aligned (θ ≈ 0)
- **B indicators** (middle sides): Horizontal + vertical lock
  - Appears when target is both horizontally and vertically aligned (θ ≈ 0, Φ ≈ 0)
- **C indicators** (bottom center): Full lock - optimal firing solution
  - Appears when target is aligned AND within optimal range
  - 90% hit probability when firing with C lock

**Implementation:**
- Calculate angle between player facing direction and target position
- Determine horizontal alignment (yaw angle)
- Determine vertical alignment (pitch angle)
- Calculate distance to target
- Display appropriate indicators based on alignment and range

#### 4.4 Shields System

Implement the shields system. When activated with the S key, the shields should protect the player from damage.

**Shield Properties:**
- Toggle on/off with S key
- Consumes energy continuously when active (3 units/second)
- Provides protection from:
  - Enemy weapons
  - Meteor impacts (except in NOVICE mode where no damage occurs anyway)
- Visual indicator: Semi-transparent sphere or glow around ship
- Cannot fire photon torpedoes while shields are up (at higher difficulty levels)

#### 4.5 Damage System

Implement a damage system for both the player and enemies.

**Player Damage:**
- Ship has multiple subsystems that can be damaged:
  - Engines (reduces max speed)
  - Shields (cannot activate)
  - Photon torpedoes (cannot fire)
  - Sub-Space Radio (no Galactic Chart updates)
  - Long Range Scan (cannot use L view)
  - Attack Computer (no lock-on indicators)
- Damage occurs when hit by enemy fire or meteors (when shields down)
- Display damaged systems on HUD with red indicators
- Must dock at starbase to repair

**Enemy Damage:**
- Fighters: Low health, destroyed in 1-2 hits
- Cruisers: Medium health, destroyed in 3-4 hits
- Basestars: High health, requires multiple hits, shields must be down

#### 4.6 Tracking Computer and Manual Target Selector

Implement targeting assistance systems.

**Tracking Computer (T key):**
- Automatically selects nearest enemy in current sector
- Rotates player ship to face target (or assists with rotation)
- Updates Attack Computer Display to show selected target
- Helps locate enemies in 3D space

**Manual Target Selector (M key):**
- Cycles through all enemies in current sector
- Allows player to choose specific target
- Updates Attack Computer Display
- Shows target information on HUD

### Deliverables

- Three distinct enemy ship types with unique models
- Functional AI for each enemy type
- Attack Computer Display with lock-on system
- Shields system with visual feedback
- Damage system for player and enemies
- Targeting assistance systems

---

## Phase 5: Game Systems and UI

### Objectives

Implement the remaining game systems, including starbases, scoring, difficulty levels, and the Sub-Space Radio.

### Tasks

#### 5.1 Starbase System

Implement friendly starbases that the player can dock with for repairs and refueling.

**Starbase Model:**
- Large, distinct geometric structure
- Different from enemy ships (perhaps cube or space station design)
- Friendly color scheme (green or white)
- Stationary in sector

**Docking Procedure:**
1. Player approaches starbase
2. Reduce speed to 0-2
3. Align with docking port
4. When close enough and properly aligned, docking initiates
5. Display "ORBIT ESTABLISHED" message
6. Automatically repair all damage
7. Restore energy to maximum
8. Player can press key to undock and resume mission

**Docking Mechanics:**
- Require player to be within certain distance
- Require low speed (speed 0-2)
- Require approximate alignment
- Provide visual feedback (docking indicator)

#### 5.2 Sub-Space Radio

Implement the Sub-Space Radio system that provides mission updates.

**Radio Messages:**
- "STARBASE SURROUNDED" - When enemies are in same sector as starbase
- "STARBASE DESTROYED" - When starbase is destroyed by enemies
- Display messages as text overlay
- Play alert sound with messages

**Galactic Chart Updates:**
- Radio updates chart with enemy positions
- Shows targets indicator for each sector
- If radio is damaged:
  - No new updates to chart
  - Chart shows last known positions
  - Can still see enemy count when cursor over sector

#### 5.3 Scoring and Rating System

Implement the comprehensive scoring and rating system.

**Score Calculation Factors:**

| Difficulty | Factors Considered |
|------------|-------------------|
| NOVICE | Enemies destroyed, Time, Starbases lost |
| PILOT | Above + Energy used, Damage taken |
| WARRIOR | All above factors |
| COMMANDER | All factors + Galactic Chart usage efficiency |

**Rating Ranks:**

| Score Range | Rank |
|-------------|------|
| < 80 | Garbage Scow Captain |
| 80-91 | Novice |
| 92-111 | Pilot |
| 112-175 | Warrior |
| 176-191 | Star Commander |
| 192-207 | Ace |
| 208-239 | Lieutenant |
| 240-279 | Captain |
| 280+ | Commander/Star Commander |

**End of Mission:**
- Calculate final score based on performance
- Display rating rank
- Show mission statistics
- Option to play again or change difficulty

#### 5.4 Difficulty Levels

Implement the four difficulty levels with distinct characteristics.

**NOVICE:**
- Fewer enemies (approximately 20-25)
- 3 starbases
- No damage to player ship
- Simpler enemy AI
- More energy available
- Basic visual effects during hyperwarp

**PILOT:**
- More enemies (approximately 36)
- 3 starbases
- Damage system active
- Standard enemy AI
- Standard energy levels
- Enhanced visual effects

**WARRIOR:**
- Many enemies (approximately 45)
- 3 starbases
- Full damage system
- Aggressive enemy AI
- Standard energy
- All visual effects

**COMMANDER:**
- Most enemies (approximately 60)
- 4 starbases
- Full damage system
- Highly aggressive and coordinated enemy AI
- Reduced starting energy
- Enemies move more frequently
- Most challenging targeting
- All visual effects

**Difficulty Selection:**
- Main menu with SELECT button/key to cycle through difficulties
- Display difficulty name and brief description
- Show mission parameters (enemy count, starbase count)
- START button/key to begin mission

#### 5.5 Meteor System

Implement environmental hazards in the form of meteors.

**Meteor Properties:**
- Randomly appear in sectors
- Move across space
- Geometric rock-like models
- Various sizes

**Meteor Behavior:**
- Fly through sector in random directions
- Can damage player ship if shields are down
- Can be destroyed with photon torpedoes
- No damage in NOVICE mode
- Reduced damage when shields are up

**Meteor Warnings:**
- Visual: Meteors visible in space
- Player must observe and avoid or destroy
- Can hyperwarp into meteors (causes damage)

#### 5.6 Mission Timer and Star Date

Implement the mission timer and Star Date system.

**Star Date:**
- Starts at mission beginning (e.g., 2850.0)
- Increments over time
- Displayed on control panel
- Used in score calculation (faster completion = better score)

**Mission End Conditions:**
1. All enemies destroyed (Victory)
2. Energy depleted (Defeat)
3. Player ship destroyed (Defeat)

### Deliverables

- Functional starbase system with docking
- Sub-Space Radio with message system
- Complete scoring and rating system
- Four difficulty levels with distinct characteristics
- Meteor hazard system
- Mission timer and end conditions

---

## Phase 6: Polishing and Finalization

### Objectives

Add audio, refine the user interface, implement visual effects, and perform thorough testing.

### Tasks

#### 6.1 Sound Effects

Implement sound effects for all game events.

**Required Sound Effects:**
- Photon torpedo fire
- Photon torpedo hit/explosion
- Enemy ship explosion
- Hyperwarp engage/disengage
- Shield activation/deactivation
- Docking sequence
- Radio messages alert
- Low energy warning
- System damage alert
- Meteor impact
- Engine hum (varies with speed)

**Audio Implementation:**
- Use Web Audio API or Howler.js library
- Simple, synthesized sounds matching 1970s aesthetic
- Volume controls in settings
- Spatial audio for directional effects

#### 6.2 Visual Effects

Enhance the game with visual effects.

**Effects to Implement:**
- Explosion particles when ships are destroyed
- Photon torpedo trail/glow
- Hyperwarp tunnel effect
- Shield visual (transparent sphere/glow)
- Engine thrust particles
- Starfield parallax during movement
- Damage sparks/smoke on player ship
- Muzzle flash when firing
- Screen shake on impact
- Color tinting for different game states

**Visual Style:**
- High contrast colors
- Geometric, angular aesthetic
- Emissive materials for energy effects
- Simple but effective particle systems
- Maintain 1970s sci-fi look

#### 6.3 User Interface Refinement

Polish all UI elements for clarity and usability.

**Main Menu:**
- Title screen with Star Raiders logo
- Difficulty selection
- Controls explanation
- Start game button
- Settings (audio volume, mouse sensitivity)

**In-Game HUD:**
- Control panel at bottom of screen showing:
  - Energy level (numerical and bar)
  - Current speed (0-9)
  - Current view (F/A/G/L)
  - Star Date
  - Damaged systems (red indicators)
  - Score (optional, or only at end)
- Attack Computer Display (bottom-right during Front View)
- Targeting reticle (center of screen)
- Message display area (for radio messages)

**Galactic Chart UI:**
- Clear sector grid
- Legend explaining symbols
- Current position and destination indicators
- Sector information panel
- Energy cost preview for hyperwarp

**Pause Menu:**
- Resume game
- Controls reminder
- Return to main menu
- Settings

#### 6.4 Controls and Input Polish

Refine all control schemes for better feel.

**Mouse Controls:**
- Adjustable sensitivity
- Optional mouse smoothing/acceleration
- Center reticle for reference
- Mouse lock (pointer lock API) for better control

**Keyboard Controls:**
- Key remapping options
- Clear visual feedback when keys are pressed
- Prevent accidental key presses (confirmation for quit, etc.)

**Controller Support (Optional):**
- Gamepad API support
- Map analog sticks to ship rotation
- Buttons for actions

#### 6.5 Performance Optimization

Ensure the game runs smoothly across different devices.

**Optimization Strategies:**
- Object pooling for photon torpedoes and particles
- Frustum culling for off-screen objects
- Level of detail (LOD) for distant ships
- Efficient collision detection (spatial partitioning)
- Minimize draw calls
- Optimize particle systems
- Lazy loading of assets

**Performance Targets:**
- 60 FPS on modern browsers
- 30 FPS minimum on older hardware
- Fast load times
- Responsive controls

#### 6.6 Testing and Bug Fixing

Conduct thorough testing across all game systems.

**Test Cases:**
- All difficulty levels playable start to finish
- All controls function correctly
- Energy system works properly
- Scoring calculates correctly
- Enemy AI behaves as expected
- Collision detection is accurate
- No game-breaking bugs
- UI displays correctly at different resolutions
- Audio plays correctly
- Save/load state (if implemented)

**Browser Compatibility:**
- Test on Chrome, Firefox, Safari, Edge
- Test on desktop and mobile (if applicable)
- Ensure WebGL support

**Bug Fixing:**
- Document all bugs found during testing
- Prioritize critical bugs
- Fix and retest
- Perform regression testing

#### 6.7 Final Polish

Add final touches to complete the game.

**Polish Items:**
- Smooth transitions between screens
- Loading screen during asset loading
- Credits screen
- Tutorial or help screen
- Easter eggs (optional)
- Achievements (optional)

### Deliverables

- Complete audio implementation
- Polished visual effects
- Refined user interface
- Optimized performance
- Thoroughly tested game
- Final polished product ready for release

---

## Summary

This implementation guide provides a comprehensive, phase-by-phase approach to developing the Star Raiders web game. Each phase builds upon the previous one, ensuring a logical progression from basic setup to a fully polished game. By following this guide, a coding AI can systematically implement all the features and mechanics necessary to recreate the classic Star Raiders experience in a modern web environment using Three.js.

The key to success is to complete each phase thoroughly before moving to the next, ensuring that all systems are functional and integrated properly. This modular approach allows for easier debugging, testing, and iteration throughout the development process.
