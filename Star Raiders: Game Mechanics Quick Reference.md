# Star Raiders: Game Mechanics Quick Reference

## Game Overview

Star Raiders is a first-person space combat and strategy game where the player commands a starship in the Atarian Starship Fleet, defending the galaxy against the Zylon Empire. The game combines tactical navigation, real-time combat, resource management, and strategic planning.

## Core Gameplay Loop

The player navigates a galaxy divided into 64 sectors (8x8 grid), engaging Zylon forces while protecting friendly starbases. Success requires balancing combat effectiveness, energy conservation, and strategic navigation. The mission ends when all enemies are destroyed (victory), the player runs out of energy (defeat), or the player's ship is destroyed (defeat).

## Ship Systems

### Energy System

Energy is the lifeblood of the starship, consumed by nearly every action. The player must carefully manage energy usage and dock at starbases to recharge. Running out of energy results in mission failure.

**Energy Consumption Rates:**

| System/Action | Energy Cost |
|---------------|-------------|
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
| Hyperwarp | 100-2410 units (distance-based) |

### Weapons System

**Photon Torpedoes:** The primary offensive weapon. These energy projectiles travel in a straight line and destroy targets on contact. The Attack Computer Display assists with targeting by showing lock-on status.

**Lock-On Indicators:**
- **A (Horizontal Lock):** Target is horizontally aligned with the ship's heading
- **B (Full Alignment):** Target is both horizontally and vertically aligned
- **C (Optimal Firing Solution):** Target is aligned and within optimal range - 90% hit probability

### Defensive Systems

**Shields:** Activated with the S key, shields protect the ship from enemy fire and meteor impacts. Shields consume energy continuously while active. At higher difficulty levels, photon torpedoes cannot be fired while shields are up, requiring tactical decisions about when to raise and lower shields.

### Navigation Systems

**Hyperwarp Drive:** Enables faster-than-light travel between sectors. Activated with the H key after selecting a destination on the Galactic Chart. Energy consumption increases with distance traveled.

**Twin-Ion Engines:** Provide sub-light propulsion within sectors. Speed is controlled with number keys 0-9, where 0 is stationary and 9 is maximum velocity.

### Information Systems

**Sub-Space Radio:** Relays critical mission updates including "STARBASE SURROUNDED" and "STARBASE DESTROYED" messages. Also updates the Galactic Chart with enemy position information. If damaged, the Galactic Chart will not receive updates, though the player can still see enemy counts by moving the cursor over sectors.

**Attack Computer:** Provides targeting assistance by calculating the alignment and range to enemy targets, displaying lock-on indicators when firing solutions are achieved.

**Tracking Computer:** Activated with the T key, automatically selects and tracks the nearest enemy in the current sector.

**Manual Target Selector:** Activated with the M key, allows the player to manually cycle through available targets in the current sector.

## Display Views

### Front View (F Key)

The primary first-person view from the cockpit, looking forward. This is the main combat view where the Attack Computer Display is visible in the bottom-right corner. The player uses this view for navigation, combat, and general gameplay.

### Aft View (A Key)

A rear-facing view from the cockpit, allowing the player to see threats approaching from behind. Control inputs are reversed in this view (moving left turns the ship right, and vice versa).

### Galactic Chart (G Key)

A strategic overview of the entire galaxy, displayed as an 8x8 grid of sectors. Each sector is marked with symbols indicating its contents:

| Symbol | Meaning |
|--------|---------|
| (empty) | Uninhabited sector |
| < | 1 enemy ship |
| = | 2 enemy ships |
| > | 3 enemy ships (task force) |
| ≥ | 4+ enemy ships (fleet) |
| * | Friendly starbase |
| ≥* | Starbase under attack |

The player's current position is shown as one colored dot, while the hyperwarp destination is shown as another. The player moves the destination cursor to select where to travel next.

### Long Range Scan (L Key)

A tactical view of the current sector, showing the relative positions of the player's ship, enemy vessels, and any starbases. This grid-based display provides situational awareness and helps the player plan combat maneuvers.

### Control Panel Display

Always visible at the bottom of the screen (except when Galactic Chart is open), the Control Panel shows critical ship status information including energy level, current speed, active view, Star Date, and indicators for damaged systems.

## Enemy Forces

### Zylon Fighter

Fast and agile attack craft designed for close-range combat. Fighters actively pursue the player and fire their weapons. They have low health and can be destroyed with one or two photon torpedo hits. Fighters are the most common enemy type and pose a moderate threat individually but can be dangerous in groups.

### Zylon Cruiser

Medium-sized patrol vessels that follow predetermined routes within sectors. Cruisers will not attack unless provoked (the player fires first). They have moderate health and require several hits to destroy. Cruisers represent a balanced threat, neither as aggressive as Fighters nor as formidable as Basestars.

### Zylon Basestar

Large, pyramid-shaped capital ships that are heavily shielded and can only be destroyed when their shields are down. Basestars are the primary strategic targets and pose the greatest threat. The Attack Computer's lock-on system is particularly important when engaging Basestars, as close-range attacks with full lock-on (C indicator) are the most effective method of destruction.

### Enemy Strategy

The Zylon forces employ a coordinated strategy: they engage the player in combat to distract them while other ships move to surround and destroy friendly starbases. Enemy positions shift periodically throughout the mission, requiring the player to monitor the Galactic Chart and respond to threats strategically.

## Starbases

Friendly starbases are safe havens where the player can dock to repair all damage and fully recharge energy. The number of starbases varies by difficulty level (3-4), and they are critical to mission success. If all starbases are destroyed, the player cannot repair or refuel, making mission completion extremely difficult or impossible.

**Docking Procedure:**
1. Navigate to the sector containing a starbase
2. Reduce speed to 0-2 using engine controls
3. Approach the starbase carefully
4. Align with the docking port
5. When properly positioned, docking will initiate automatically
6. The "ORBIT ESTABLISHED" message confirms successful docking
7. All systems are repaired and energy is restored to maximum
8. Press a key to undock and resume the mission

## Environmental Hazards

**Meteors:** Random space debris that flies through sectors. Meteors can damage the player's ship if they collide when shields are down. When shields are up, meteors cause reduced damage (except in NOVICE mode where no damage occurs). Meteors can be destroyed with photon torpedoes. Players must observe their surroundings carefully and avoid or destroy meteors as needed.

## Damage System

The player's ship has multiple subsystems that can be damaged by enemy fire or meteor impacts:

| System | Effect When Damaged |
|--------|---------------------|
| Engines | Reduced maximum speed |
| Shields | Cannot activate shields |
| Photon Torpedoes | Cannot fire weapons |
| Sub-Space Radio | Galactic Chart not updated |
| Long Range Scan | Cannot use L view |
| Attack Computer | No lock-on indicators |

Damaged systems are indicated by red markers on the Control Panel Display. All damage can be repaired by docking at a starbase.

## Difficulty Levels

### NOVICE

An introductory difficulty designed for learning the game mechanics. Features approximately 20-25 enemy ships and 3 starbases. The player's ship takes no damage in this mode, allowing risk-free exploration and combat practice. Enemy AI is simpler and less aggressive.

### PILOT

A moderate difficulty with approximately 36 enemy ships and 3 starbases. The damage system is active, requiring the player to manage shields and seek repairs. Enemy AI uses standard behaviors and aggression levels.

### WARRIOR

A challenging difficulty with approximately 45 enemy ships and 3 starbases. The full damage system is active, and enemy AI is more aggressive. Requires solid mastery of all game systems and strategic thinking.

### COMMANDER

The most difficult level, reserved for expert players. Features approximately 60 enemy ships and 4 starbases. Enemy AI is highly aggressive and coordinated, enemies move more frequently between sectors, and the player starts with reduced energy. Targeting is more difficult, and the mission requires exceptional skill and strategy to complete.

## Scoring and Rating System

At the end of each mission, the player receives a rating based on their performance. The rating calculation considers different factors depending on the difficulty level:

**NOVICE:** Enemies destroyed, time taken, starbases lost

**PILOT:** All NOVICE factors plus energy used and damage taken

**WARRIOR:** All PILOT factors

**COMMANDER:** All WARRIOR factors plus efficiency of Galactic Chart usage

**Rating Ranks:**

| Score Range | Rank |
|-------------|------|
| Below 80 | Garbage Scow Captain |
| 80-91 | Novice |
| 92-111 | Pilot |
| 112-175 | Warrior |
| 176-191 | Star Commander |
| 192-207 | Ace |
| 208-239 | Lieutenant |
| 240-279 | Captain |
| 280+ | Commander/Star Commander |

## Mission End Conditions

**Victory:** All Zylon forces in the galaxy are destroyed

**Defeat (Energy Depletion):** The ship's energy reaches zero

**Defeat (Ship Destroyed):** The ship's hull integrity is compromised and the ship is destroyed

## Control Reference

### Mouse
- **Movement:** Control ship pitch (up/down) and yaw (left/right)

### Keyboard

| Key | Function |
|-----|----------|
| Spacebar | Fire photon torpedoes |
| 0-9 | Set engine speed (0=stop, 9=maximum) |
| F | Switch to Front View |
| A | Switch to Aft View |
| G | Open/close Galactic Chart |
| L | Open/close Long Range Scan |
| S | Toggle shields on/off |
| T | Activate Tracking Computer |
| M | Manual Target Selector (cycle targets) |
| H | Engage hyperwarp to selected destination |
| P | Pause game |

## Strategic Tips

**Energy Management:** Always monitor energy levels. Plan hyperwarp routes to minimize energy consumption. Dock at starbases before energy becomes critically low.

**Combat Tactics:** Use the Attack Computer Display to achieve lock-on before firing. The C indicator provides the best hit probability. Raise shields when under fire, but remember they consume energy.

**Navigation Strategy:** Use the Galactic Chart frequently to track enemy movements. Prioritize sectors where starbases are under attack (≥* symbol). Plan efficient routes to conserve energy.

**Target Priority:** Basestars are the highest-value targets but require close-range attacks. Fighters are numerous and aggressive, so eliminate them quickly. Cruisers can often be ignored unless they're provoked or blocking your path.

**Starbase Defense:** Monitor Sub-Space Radio messages. When a starbase is surrounded, hyperwarp to that sector immediately to defend it. Losing starbases makes the mission significantly harder.

**System Damage:** If critical systems are damaged (especially engines or weapons), dock at a starbase as soon as possible. Flying with damaged systems puts you at a severe disadvantage.

## Visual and Audio Style

The game maintains the aesthetic of the original 1979 Atari version, featuring geometric ship designs, a grid-based space environment, high-contrast colors, and simple synthesized sound effects. The visual style emphasizes the 1970s sci-fi look with angular spacecraft, bright energy effects against dark space, and a distinctive retro-futuristic atmosphere.
