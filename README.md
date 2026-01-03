# Star Raiders

### A Web-Based Recreation of the Classic 1979 Atari Space Combat Game

---

**Star Raiders** is a faithful web-based recreation of the groundbreaking 1979 Atari 800 first-person space combat and strategy game. Built with modern web technologies (TypeScript and Three.js), this project delivers the authentic Star Raiders experience—tactical navigation, real-time combat, resource management, and strategic planning—all running in your browser.

> *"Defend the galaxy against the Zylon Empire. Command your starship. Save the starbases. Become a Star Commander."*

---

## Features

- **First-Person Space Combat** — Engage Zylon forces in immersive 3D combat with photon torpedoes
- **Strategic Galactic Navigation** — Navigate a 64-sector galaxy (8x8 grid) using hyperwarp drive
- **Three Enemy Types** — Battle Zylon Fighters, Cruisers, and the formidable Basestars
- **Resource Management** — Balance energy consumption across weapons, shields, and propulsion
- **Ship Systems & Damage** — Manage six critical systems that can be damaged in combat
- **Four Difficulty Levels** — From NOVICE (training mode) to COMMANDER (expert challenge)
- **Starbase Docking** — Repair and refuel at friendly starbases
- **Retro-Futuristic Aesthetic** — Authentic 1970s sci-fi visual style with geometric ships and synthesized audio
- **Rank & Scoring System** — Earn ranks from "Garbage Scow Captain" to "Star Commander"

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (included with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Star-Raiders.git
cd Star-Raiders

# Install dependencies
npm install

# Start the development server
npm run dev
```

The game will be available at `http://localhost:5173`

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview the production build
npm run preview
```

---

## How to Play

### Objective

Your mission is to defend the galaxy from the Zylon Empire. Destroy all enemy forces while protecting friendly starbases. The mission ends when:

- **Victory** — All Zylon forces are destroyed
- **Defeat** — Your ship runs out of energy
- **Defeat** — Your ship is destroyed in combat

### Core Gameplay Loop

1. **Check the Galactic Chart (G)** — Survey enemy positions and starbase locations
2. **Set Hyperwarp Destination** — Move the cursor and engage hyperwarp (H) to travel between sectors
3. **Engage Enemies** — Use Front View (F) for combat, fire photon torpedoes (Space)
4. **Manage Energy** — Monitor consumption from engines, shields, and weapons
5. **Dock at Starbases** — Approach slowly to repair damage and refuel
6. **Repeat** — Continue until all enemies are destroyed or mission fails

### Tips for New Players

- Start on **NOVICE** difficulty—your ship takes no damage, allowing risk-free practice
- Keep shields (S) active during combat, but remember they drain energy
- Use the **Long Range Scan (L)** to see enemy positions in your current sector
- The **Attack Computer** shows lock-on status: aim for the **C** indicator for 90% hit probability
- Watch for "STARBASE SURROUNDED" alerts—save starbases before they're destroyed

---

## Controls

### Mouse
| Action | Control |
|--------|---------|
| Aim Ship | Mouse Movement |
| Look Around | Move mouse (with pointer lock) |

### Keyboard

| Key | Function |
|-----|----------|
| **Space** | Fire photon torpedoes |
| **0-9** | Set engine speed (0 = stop, 9 = maximum) |
| **S** | Toggle shields on/off |
| **F** | Front View (main combat view) |
| **A** | Aft View (rear view, controls reversed) |
| **G** | Galactic Chart (strategic map) |
| **L** | Long Range Scan (tactical sector view) |
| **H** | Engage hyperwarp (from Galactic Chart) |
| **T** | Target nearest enemy (Tracking Computer) |
| **M** | Cycle through targets (Manual Selector) |
| **P** | Pause game |
| **Arrow Keys** | Move cursor on Galactic Chart |

---

## Game Systems

### Energy System

Energy powers all ship systems. Running out of energy ends the mission.

| System/Action | Energy Cost |
|---------------|-------------|
| Photon Torpedo | 5 units per shot |
| Shields Active | 3 units/second |
| Engine Speed 1-9 | 1.2 to 9 units/second |
| Hyperwarp | 100-2410 units (distance-based) |

**Maximum Energy:** 9,999 units
**Refuel:** Dock at a starbase to restore full energy

### Weapons System

**Photon Torpedoes** are your primary weapon. They travel in a straight line and destroy targets on contact.

**Lock-On Indicators** (Attack Computer Display):
- **A** — Horizontal alignment achieved
- **B** — Full horizontal and vertical alignment
- **C** — Optimal firing solution (90% hit probability)

### Defensive Systems

**Shields** protect against enemy fire and meteor impacts. Toggle with **S**.
- Consume 3 energy/second while active
- At higher difficulties, you cannot fire with shields raised

### Navigation Systems

**Hyperwarp Drive** — Faster-than-light travel between sectors
- Open Galactic Chart (G), select destination, engage (H)
- Energy cost increases with distance

**Twin-Ion Engines** — Sub-light propulsion within sectors
- Speed 0-9 controlled with number keys
- Higher speeds consume more energy

### Display Views

| View | Key | Description |
|------|-----|-------------|
| **Front View** | F | Primary cockpit view for combat |
| **Aft View** | A | Rear view (controls reversed) |
| **Galactic Chart** | G | Strategic 8x8 sector overview |
| **Long Range Scan** | L | Tactical view of current sector |

### Galactic Chart Symbols

| Symbol | Meaning |
|--------|---------|
| *(empty)* | Uninhabited sector |
| `<` | 1 enemy ship |
| `=` | 2 enemy ships |
| `>` | 3 enemy ships (task force) |
| `>=` | 4+ enemy ships (fleet) |
| `*` | Friendly starbase |
| `>=*` | Starbase under attack! |

### Damage System

Your ship has six critical systems that can be damaged:

| System | Effect When Damaged |
|--------|---------------------|
| Engines | Reduced maximum speed |
| Shields | Cannot activate shields |
| Photon Torpedoes | Cannot fire weapons |
| Sub-Space Radio | Galactic Chart not updated |
| Long Range Scan | Cannot use L view |
| Attack Computer | No lock-on indicators |

Damaged systems show red indicators on the Control Panel. **Dock at a starbase to repair all damage.**

---

## Enemy Forces

### Zylon Fighter
- **Role:** Fast attack craft
- **Speed:** 400 units/second
- **Behavior:** Aggressive pursuit, weaving and circle-strafing attacks
- **Threat:** Moderate individually, dangerous in groups
- **Durability:** Low (1-2 torpedo hits)

### Zylon Cruiser
- **Role:** Patrol vessel
- **Speed:** 300 units/second
- **Behavior:** Tactical patrol patterns; only attacks if provoked
- **Threat:** Moderate
- **Durability:** Medium (several torpedo hits)

### Zylon Basestar
- **Role:** Capital ship / fortress
- **Speed:** Stationary
- **Behavior:** Defensive; regenerating shields
- **Threat:** High (primary strategic target)
- **Durability:** High (shields must be down to destroy)

**Combat Tip:** Basestars require close-range attacks with full lock-on (C indicator) for best results.

### Enemy Strategy

The Zylon Empire employs coordinated tactics:
- Fighters engage and distract you
- Other forces move to surround and destroy starbases
- Enemy positions shift periodically—check the Galactic Chart often!

---

## Starbases

Starbases are critical allies. Docking restores full energy and repairs all damage.

### Docking Procedure

1. Navigate to the sector containing a starbase
2. Reduce speed to 0-2
3. Approach the starbase carefully
4. Align with the docking port
5. "ORBIT ESTABLISHED" confirms successful docking
6. Energy and systems are fully restored
7. Press any key to undock

**Warning:** If all starbases are destroyed, you cannot repair or refuel!

---

## Environmental Hazards

### Meteors

Random space debris that can damage your ship.
- Collision with shields down causes system damage
- Collision with shields up causes reduced damage (except NOVICE)
- Can be destroyed with photon torpedoes

---

## Difficulty Levels

| Level | Enemies | Starbases | Special Rules |
|-------|---------|-----------|---------------|
| **NOVICE** | ~20-25 | 3 | No damage taken; simple enemy AI |
| **PILOT** | ~36 | 3 | Full damage system; standard AI |
| **WARRIOR** | ~45 | 3 | Aggressive AI; requires mastery |
| **COMMANDER** | ~60 | 4 | Expert mode; reduced starting energy; difficult targeting |

### Difficulty Details

**NOVICE** — Training mode. Learn all systems without risk. Enemy AI is simplified.

**PILOT** — Standard difficulty. All systems active. Good for players who understand the basics.

**WARRIOR** — Challenging. More enemies, aggressive AI. Requires solid strategy and combat skills.

**COMMANDER** — Expert only. Maximum enemies, highly coordinated AI, frequent enemy movement between sectors, reduced starting energy. True Star Commander material.

---

## Scoring & Rank System

Your performance is rated at mission end based on multiple factors:

### Scoring Factors

| Difficulty | Factors Considered |
|------------|-------------------|
| NOVICE | Enemies destroyed, time taken, starbases lost |
| PILOT | + Energy used, damage taken |
| WARRIOR | All PILOT factors |
| COMMANDER | + Galactic Chart efficiency |

### Rank Progression

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
| 280+ | Commander / Star Commander |

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| **Language** | TypeScript 5.x |
| **3D Engine** | Three.js 0.182 (WebGL 2.0) |
| **Build Tool** | Vite 7.x |
| **Audio** | Web Audio API (synthesized sounds) |
| **UI/HUD** | HTML/CSS overlays |

### Build Information

| Metric | Value |
|--------|-------|
| TypeScript Modules | 24+ files |
| Build Size | ~560KB minified |
| Gzipped | ~140KB |

---

## Project Structure

```
star-raiders/
├── src/
│   ├── main.ts                 # Entry point and game initialization
│   ├── style.css               # Global styles
│   │
│   ├── audio/
│   │   └── SoundManager.ts     # Web Audio synthesized sounds
│   │
│   ├── config/
│   │   └── EnemyConfig.ts      # Enemy type configurations
│   │
│   ├── entities/
│   │   ├── Enemy.ts            # Fighter, Cruiser, Basestar classes
│   │   ├── EnemyProjectile.ts  # Enemy weapon projectiles
│   │   ├── Meteor.ts           # Environmental hazard
│   │   ├── PhotonTorpedo.ts    # Player weapon with glow effect
│   │   ├── Player.ts           # Player ship model and controls
│   │   ├── Starbase.ts         # Space station with docking
│   │   └── Starfield.ts        # Particle-based star background
│   │
│   ├── game/
│   │   ├── Game.ts             # Main game controller
│   │   ├── GameLoop.ts         # RequestAnimationFrame loop
│   │   └── GameState.ts        # Central state management
│   │
│   ├── systems/
│   │   ├── CombatSystem.ts     # Enemy spawning and combat logic
│   │   ├── EnergySystem.ts     # Energy consumption tracking
│   │   ├── ScoringSystem.ts    # Score and rank calculation
│   │   ├── SectorSystem.ts     # 8x8 galactic grid management
│   │   ├── StarbaseAttackSystem.ts  # Starbase threat logic
│   │   └── VFXSystem.ts        # Particle explosions and effects
│   │
│   ├── ui/
│   │   ├── ControlPanel.ts     # HUD overlay (energy, speed, status)
│   │   └── MainMenu.ts         # Title screen and game over
│   │
│   ├── utils/
│   │   └── InputManager.ts     # Keyboard/mouse with pointer lock
│   │
│   └── views/
│       ├── AttackComputer.ts   # Lock-on targeting (A/B/C indicators)
│       ├── GalacticChart.ts    # 8x8 sector navigation grid
│       └── LongRangeScan.ts    # Tactical sector view
│
├── public/                     # Static assets
├── index.html                  # HTML entry point
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite build configuration
```

---

## Strategic Tips

### Energy Management
- Always monitor energy levels
- Plan hyperwarp routes to minimize energy consumption
- Dock at starbases before energy becomes critical
- Reduce speed when not in combat to conserve fuel

### Combat Tactics
- Wait for the **C** lock-on indicator before firing
- Raise shields when under attack, lower to fire (higher difficulties)
- Use the Tracking Computer (T) to quickly target the nearest threat
- Escape requires Engine Speed 9—the only speed faster than Fighters

### Navigation Strategy
- Check the Galactic Chart frequently
- Prioritize sectors with `>=*` (starbases under attack)
- Plan efficient routes between threat zones
- Monitor Sub-Space Radio for starbase alerts

### Target Priority
1. **Threats to starbases** — Respond to "STARBASE SURROUNDED" immediately
2. **Basestars** — High-value targets; require close-range attacks
3. **Fighters** — Numerous and aggressive; eliminate quickly
4. **Cruisers** — Can often be ignored unless blocking your path

---

## Development

### Available Scripts

```bash
npm run dev      # Start development server (hot reload)
npm run build    # Build for production
npm run preview  # Preview production build locally
```

### Key Documentation

- `CLAUDE.md` — Development guidelines and architecture reference
- `PROGRESS.md` — Detailed iteration log
- `FEATURE_ROADMAP.md` — Planned enhancements
- `Star Raiders: Game Mechanics Quick Reference.md` — Complete game mechanics

---

## Credits

**Star Raiders** was originally created by **Doug Neubauer** and published by **Atari** in 1979 for the Atari 8-bit family. It is widely regarded as one of the first great action games for home computers and a pioneering first-person space combat simulator.

This web recreation is a fan project created to preserve and celebrate this classic game using modern web technologies.

---

## License

This is a fan recreation for educational and preservation purposes. Star Raiders is a trademark of Atari. This project is not affiliated with or endorsed by Atari.

---

<p align="center">
  <i>May your torpedoes fly true and your energy hold. Good luck, Commander.</i>
</p>
