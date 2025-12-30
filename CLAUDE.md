# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based recreation of **Star Raiders**, the classic 1979 Atari 800 first-person space combat and strategy game. The project is currently in the planning/documentation phase with no code implemented yet.

## Technology Stack

- **Build Tool**: Vite
- **3D Engine**: Three.js (WebGL 2.0)
- **Language**: TypeScript
- **UI/HUD**: HTML/CSS overlays
- **Audio**: Web Audio API + Howler.js
- **Mobile**: PWA with touch controls

## Project Initialization

When starting development:
```bash
npm create vite@latest star-raiders -- --template vanilla-ts
cd star-raiders
npm install three @types/three
```

## Architecture

### Recommended Directory Structure
```
src/
├── main.ts                 # Entry point
├── game/                   # Core game controller, loop, state
├── entities/               # Player, enemies (Fighter/Cruiser/Basestar), Starbase, projectiles
├── systems/                # EnergySystem, CombatSystem, NavigationSystem, ScoringSystem
├── views/                  # FrontView, AftView, GalacticChart, LongRangeScan, AttackComputer
├── ui/                     # ControlPanel, MainMenu, TouchControls
├── audio/                  # SoundManager
└── utils/                  # InputManager, MathUtils
```

### Key Game Components

**Views/Modes:**
- Front View (F key) - Main combat, first-person from cockpit
- Aft View (A key) - Rear view, controls reversed
- Galactic Chart (G key) - 8x8 sector grid overlay for navigation
- Long Range Scan (L key) - Tactical view of current sector
- Attack Computer Display - Targeting overlay with A/B/C lock indicators

**Ship Systems:**
- Photon Torpedoes (Spacebar) - 5 energy per shot
- Shields (S key) - 3 energy/second when active
- Hyperwarp (H key) - 100-2410 energy based on distance
- Engine Speed (0-9 keys) - Energy consumption equals speed level per second

**Enemy Types:**
- Zylon Fighter - Fast, aggressive, simple evasion AI
- Zylon Cruiser - Medium, patrol patterns, only attacks when provoked
- Zylon Basestar - Stationary, shielded, requires close-range attacks

**Difficulty Levels:** NOVICE, PILOT, WARRIOR, COMMANDER (affects enemy count, AI aggression, damage system)

## Visual Style Requirements

1970s sci-fi aesthetic with angular geometric spacecraft:
- **Color Palette:**
  - Background: #000000 (black)
  - Player Ship: #4488FF (blue), #FFFFFF (white)
  - Zylon Fighter: #00FFFF (cyan)
  - Zylon Cruiser: #FF00FF (magenta)
  - Zylon Basestar: #FFD700 (gold)
  - UI Elements: #00FFFF (cyan), #FF0000 (red warnings)
- Low poly models using BoxGeometry, ConeGeometry
- Emissive materials for energy effects
- Starfield using Points with PointsMaterial

## Implementation Phases

The project follows 7 phases documented in `implementation_guide.md`:
1. Project Setup & Basic Scene
2. Core Mechanics (weapons, energy, views)
3. Navigation (Galactic Chart, sectors, hyperwarp)
4. Combat (enemy AI, Attack Computer, shields, damage)
5. Game Systems (starbases, scoring, difficulty)
6. Polish (audio, VFX, UI refinement)
7. Mobile Optimization (touch controls, PWA)

## Key Documentation Files

- `implementation_guide.md` - Phase-by-phase development tasks
- `TECHNOLOGY_REVIEW.md` - Stack decisions and rationale
- `Star Raiders: A Web-Based Recreation - Technical Specifications.md` - Detailed specs
- `attack_computer_notes.md` - Lock-on system details (A/B/C indicators)
- `control_panel_display_notes.md` - HUD layout and elements
