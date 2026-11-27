# STAR RAIDERS — Manual Specification

A faithful, structured transcription of the original Atari 400/800 **STAR RAIDERS** manual
(Model **CXL4011**, Atari Inc., 1979/1980), used as the reference for the overhaul of this remake.

**Sources**
- **[M]** The printed manual, from Joe's six photos (cover; Inserting the Cartridge / Table of Contents;
  I. Introduction; II. Using the Joystick; III. To Begin Play; IV. Control Keys; V. Energy Usage;
  VI. Starbase Docking; VII. Rating; VIII. Skill Level Descriptions; IX. Survival Tactics; X. Technical
  Information). Section references below look like **[M §IV]**.
- **[R]** Lorenz Wiest's fully documented reverse-engineered ROM source
  (github.com/lwiest/StarRaiders, `StarRaiders.source.asm.txt`, verified byte-identical against the
  cartridge and against the original Doug Neubauer source scans). It fills in what the manual leaves
  vague. References look like **[R:HYPERWARP]**, naming the routine. Where the manual and the ROM
  disagree, both values are given and the ROM wins for behaviour, the manual wins for wording.

Quoted text is the manual's own wording. Everything in tables is a number printed in the manual
unless marked [R].

---

## 1. Mission and setting  [M §I]

- You are part of "the elite unit of the ATARIAN STARSHIP FLEET — THE STAR RAIDERS". The treaty between
  the Atarian Federation and the Zylon Empire is broken.
- Orders: **"DESTROY ALL ZYLON STARSHIPS ON SIGHT, SHOW NO MERCY."**
- The galaxy is divided into **sectors** shown on the Galactic Chart.
- Only three Zylon craft types exist:
  | Type | Manual description |
  |---|---|
  | **Zylon Fighter** | "Designed for high-speed attacks. At close range they can be deadly." |
  | **Zylon Cruiser** | "May have assigned patrol routes within a sector and will not attack unless provoked." |
  | **Zylon Basestar** | "Unlike other Zylon craft these ships are equipped with shields and can only be destroyed at close range. Use extreme caution when attacking a BASESTAR." |
- Zylon strategy: "simple, yet clever. They will avoid contact unless provoked. While engaging you in
  battle the rest of the Zylon fleet will be surrounding and destroying friendly starbases."
- You only fight the craft in your current sector. A destroyed enemy "stays destroyed for the remainder
  of the mission".
- "A photon torpedo is a burst of concentrated energy — it completely destroys a target upon contact."
- **You never see your own starship** except as the icon in the Long-Range Scan. "Your television screen
  is your 'window' into space." [M §I]

### Mission objectives  [M §I]
1. Primary: destroy all Zylon starships without allowing them to destroy your starship, with as little
   damage as possible.
2. Secondary: complete the mission in as little time as possible, with minimal energy expended, and
   without allowing friendly starbases to be destroyed.

### Mission end  [M §VIII]
The mission ends when (1) you destroy all enemy targets, (2) you run out of energy, or (3) your starship
is destroyed. It is also aborted by SYSTEM RESET or the Atari key, or after 9 idle minutes (see §3).

---

## 2. Units  [M §X]

| Quantity | Unit |
|---|---|
| Time | **centons**; 100 centons = 1 **centor**. The manual equates 100 centons with "approximately one minute". |
| Distance | **metrons**; 100 metrons = 1 **centron** (R on the panel is in centrons). |
| Velocity | metrons per second (V) |
| Acceleration | metrons/second² |
| Angles | **gradons (0–99)** (θ and Φ on the panel) |
| Energy | **mergs** ("units") |

---

## 3. Console controls and starting play  [M §III]

- **SELECT** cycles the mission level shown at the top of the screen: NOVICE → PILOT → WARRIOR →
  COMMANDER.
- **START** begins the mission.
- **SYSTEM RESET** aborts the mission and returns to the NOVICE level.
- The **Atari key** aborts a mission, after which a rating is displayed based on the score so far.
- **OPTION** has no effect.
- After **nine minutes** in which no control keys are pressed and no photons are fired, the game aborts
  and goes into the attract mode ("Only a starfield will be displayed"). [M §IV P]

---

## 4. Joystick ("Control Stick")  [M §II]

| View | Stick forward | Stick back | Stick left | Stick right |
|---|---|---|---|---|
| **Front** | Dive | Climb | Turn to port (left) | Turn to starboard (right) |
| **Aft** | Climb | Dive | Turns ship **right** | Turns ship **left** |

- In the aft view, left/right have the opposite effect "since you are looking backward".
- The **red fire button** fires photon torpedoes.
- In the Galactic Chart the stick moves the hyperwarp destination dot. In hyperwarp (PILOT and above) it
  steers the hyperwarp target marker.
- "Using the Control Stick to steer your starship effectively and accurately will take practice."

---

## 5. Control keys  [M §IV]

| Key | Function |
|---|---|
| **0–9** | Twin-Ion Engine Control (velocity). Also **aborts hyperwarp**. |
| **A** | Aft View |
| **C** | Computer Attack Control (toggle) |
| **F** | Front View |
| **G** | Galactic Chart |
| **H** | Hyperwarp Engines Engaged |
| **L** | Long-Range Sector Scan |
| **M** | Manual Target Selector |
| **S** | Shields (toggle) |
| **T** | Tracking Computer (toggle) |
| **P** | Pause (suspends game) |

### 5.1 Speed table (0–9)  [M §IV]

"V represents velocity or metrons per second." "Your ship always moves forward."

| Key | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| **V** | 00 | 00 | 00 | 01 | 03 | 06 | **12** | 25 | 37 | 43 |

- "The best cruising speed is key **6 (V=12)**."
- "The Zylon warships have a maximum speed of approximately **7 (V=25)**."
- (The low keys print as 00 because the panel shows whole metrons/second; the ship still crawls. [R])

### 5.2 A — Aft view
Shows the view of space behind your starship. Stick left/right reversed (see §4).

### 5.3 C — Computer Attack Control
- Displays "cross hairs" in the **front** view as a plus with a gap (`—¦—` style) and in the **aft** view
  as two horizontal dashes (`— —`).
- Also displays the **Attack Computer Display** in the lower right corner of the screen in the front
  view.
- "The computer updates the horizontal (θ), vertical (Φ), and range (R) coordinates of the attacking
  Zylon starship. It also locks your photons onto the target."

### 5.4 F — Front view
Shows the view of space in front of your starship.

### 5.5 G — Galactic Chart  (see §8)

### 5.6 H — Hyperwarp  (see §9)

### 5.7 L — Long-Range Sector Scan  (see §10)

### 5.8 M — Manual Target Selector  [M §IV M]
- In a sector with more than one enemy, the computer decides which enemy to display in the Attack
  Computer Display and whose θ, Φ, R to show.
- Selection is automatic (unless the computer is destroyed). "The computer will randomly select a target
  unless you are in a battle, in which case the computer will select the target that is shooting at you."
- "Typically, only **two Zylons will attack at one time**. They are displayed as target 0 or target 1."
  The computer may select T=0; pressing **M** changes it to T=1 (shown on the panel).
- **T=2** when tracking a friendly starbase; **T=3** during hyperwarp (the hyperwarp marker).
  "T=2 overrides T=3."

### 5.9 S — Shields  [M §IV S]
- When active there is a **bluish tint to space**. When off, space is black.
- "Your starship will be destroyed if hit when the shields are down."
- The **Control Panel Display and Galactic Chart become yellow** when the shields are damaged or
  destroyed.

### 5.10 T — Tracking Computer  [M §IV T]
- Automatically tracks the selected target (if the computer is not destroyed) as it moves from front to
  aft. The screen **switches between front and aft views** to follow it.
- The panel's **T:** label changes to **C:** while the tracking computer is on (e.g. `C:2`).
- WARNING: experienced pilots only. In a cross-fire (one Zylon ahead, one behind) the view flips rapidly
  front/aft as they alternately fire.

### 5.11 P — Pause  [M §IV P]
- Stops the mission. Move the stick in any direction to continue.
- Works at any time, including to suspend a hyperwarp.

---

## 6. Control Panel Display (HUD)  [M §IV]

"The indicators are located toward the bottom of the screen in the front, aft, and long-range views."
Two rows, on a **light-blue strip**:

```
V:12  K:18  E:8260  T:2
θ:+12 Φ:+10 R:+236
```

| Field | Meaning | Format |
|---|---|---|
| **V** | Velocity, metrons/sec | 2 digits |
| **K** | Kills (Zylons destroyed) | 2 digits |
| **E** | Energy left | 4 digits |
| **T** | Target selected (0, 1; 2 = starbase; 3 = hyperwarp marker). Shows **C** instead of T when the Tracking Computer is on. | 1 digit |
| **θ** (Theta) | Horizontal offset of target, in gradons | sign + 2 digits |
| **Φ** (Phi) | Vertical offset of target, in gradons | sign + 2 digits |
| **R** | Range of target, in centrons | sign + 3 digits |
| sign | **+** target is in front of ship; **−** target is behind ship | |

- θ = +0 and Φ = +0 when the target is centred. [M §IV Attack Computer]
- When the computer is **damaged**, θ, Φ and R are lost. When **destroyed**, no computer functions
  work. [M §IV DC]
- Energy warning: "the Control Panel Display **flashes red** when your energy supply drops below 1000
  units." [M §V]
- Shields damaged: the panel turns **yellow** (§5.9).
- HUD colours (manual photos and ROM §17.13): V, T, θ and all digits **light mint**, **K and the Φ label
  pink**, **E and the R label yellow/light orange**, on a **blue** band (dark blue $90 in the ROM; the
  printed photos look sky-blue). The band flashes pink below 1000 energy and turns orange when the
  shields are out. Red alert flashes the space background, not the panel.

---

## 7. Damage Control (DC)  [M §IV G]

Shown at the bottom right of the Galactic Chart as **`DC:PESCLR`**.

| Letter | System |
|---|---|
| **P** | Photons |
| **E** | Engines |
| **S** | Shields |
| **C** | Computer |
| **L** | Long-Range Scan |
| **R** | Sub-Space Radio |

| Colour | Status |
|---|---|
| **Blue** | OK / working normally |
| **Yellow** | Damaged |
| **Red** | Destroyed |

Effects of damage [M §IV G, Sub-Space Radio, §IX]:
- **Engines**: still work when destroyed via a "backup impulse system", but progress is very slow. You
  can use the hyperwarp engines to move within a sector and abort near the target (abort costs 100).
- **Shields**: "flicker" when damaged; if a Zylon photon hits while they have flickered off you are
  destroyed. When shields are destroyed, the next enemy photon hit destroys you.
- **Computer**: damaged → θ, Φ, R lost; destroyed → no computer functions, and the **cross hairs
  disappear** from the front view, making hyperjumps very hard (remember the marker's start point).
- **Long-Range Scan**: damaged → you see a **mirrored image** of everything; one object of each pair is a
  reflection. If the "target" moves away as you approach, you chose the reflection.
- **Sub-Space Radio**: relays "STARBASE SURROUNDED" and "STARBASE DESTROYED", and generates the TARGETS
  indicator. Damaged → the Galactic Chart is not updated (moving the cursor still shows TARGETS per
  sector). Destroyed → no radio functions.
- **Photons**: damaged/destroyed limits or stops torpedo fire. [R:DAMAGE]
- **NOVICE**: no damage can be inflicted on your starship. [M §VIII]

---

## 8. Galactic Chart  [M §IV G]

- Full-galaxy map divided into sectors. Each sector holds enemy starships, a friendly starbase, or is
  empty. The manual screenshot shows a **16 × 8 grid**. [M figure; R]
- Symbols (sprites drawn in white on the blue chart):

| Symbol | Meaning |
|---|---|
| ✱ (8-point star) | Friendly **starbase** |
| ▸ with tail (one arrow-ship) | **Patrol group** — 1 or 2 Zylon ships [M says "one or two"] |
| ≡ three bars | **Task force** — 3 Zylon ships |
| ÷ broken bars (four dashes) | **Fleet** — 4 Zylon ships |

- Two dots: one is **your present position**; the other (moved with the stick) is your **hyperwarp
  destination**.
- Below the chart (manual screenshot): `WARP ENERGY:0120`, `TARGETS:3  DC:PESCLR`,
  `STAR DATE:45.00`. Title bar `GALACTIC CHART` is white on a black band; the chart body is sky blue
  with a white grid.
- **WARP ENERGY** = energy needed to hyperwarp to the cursor sector, based on distance (e.g.
  WARP ENERGY=700).
- **TARGETS** = number of enemy targets in the cursor sector (e.g. TARGETS=3).
- **STAR DATE** = elapsed mission time in centons, shown as `NN.NN`. "The enemy may jump from one sector
  to another when the STAR DATE crosses .00 or .50."

### 8.1 Fleet movement  [M §IV G]
- "Check the Galactic Chart frequently … the enemy starships will shift periodically in an effort to
  surround and destroy starbases."
- **"THE ZYLON FLEET WILL CONCENTRATE ON ONE STARBASE AT A TIME, AND WILL NEVER SCATTER IN AN EFFORT TO
  ATTACK AND SURROUND MORE THAN ONE STARBASE SIMULTANEOUSLY."**
- Movement rates by group size: **patrol group fastest; task force at ½ the patrol speed; fleet at about
  ⅛ the patrol speed.**

### 8.2 Starbase surround  [M §IV G, §VIII]
- A starbase is **surrounded** when Zylon groups occupy all four orthogonally adjacent sectors
  (north, south, east, west — the manual diagram shows a patrol above, a fleet left, task forces right
  and below).
- "Whenever a starbase is surrounded, you have approximately **one minute (100 centons)** to clear a
  sector adjacent to the starbase to save it."
- The Sub-Space Radio announces **"STARBASE SURROUNDED"** and **"STARBASE DESTROYED"**.
- If the enemy destroys a starbase, **two more Zylon starships are created out of the debris**. It is
  better to destroy a doomed starbase yourself (rating penalty 3 vs 18, see §14). [M §IX]

---

## 9. Hyperwarp  [M §IV H]

1. Move the chart dot to the destination sector (G + stick).
2. Make sure you are in the **front view (F)**, then press **H**.
3. The **hyperwarp target marker** appears between the **cross hairs** (diagram: long horizontal and
   vertical lines with a small square-cross marker in the middle).
4. Keep the marker lined up between the cross hairs while hyperwarp is engaged. "If you get too far out
   of line, you may end up in the wrong sector. The difficulty in hyperwarping from sector to sector
   increases with the distance between the sectors."
5. **"A RED ALERT WILL BE SOUNDED AS A WARNING INDICATOR WHEN YOU ENTER A SECTOR OCCUPIED BY ENEMY
   STARSHIPS."**
6. "The closer you jump to the centre of the sector, the closer you will be to the target or targets."
7. **Abort**: press any engine key 0–9. Abort costs **100 units**. [M §IX]

Steering per level [M §IV H, §VIII]:

| Level | Steering in hyperspace |
|---|---|
| NOVICE | **Not needed** — "Your starship will hyperwarp automatically to the desired sector." |
| PILOT, WARRIOR, COMMANDER | **Required.** The marker drifts; if it leaves the cross hairs you can arrive in the wrong sector. |

Survival tactic [M §IX]: from a fight, press H **without** opening the chart and push the marker to the
edge of the cross hair that points toward the adjacent starbase sector (e.g. right cross hair = sector to
the right). With accurate steering (not NOVICE) you land in that sector.

---

## 10. Long-Range Sector Scan  [M §IV L]

- Top view of your current sector. **Your ship is in the centre** (drawn as the player ship icon, the
  only time you see it) and "all other objects in the sector rotate around it".
- "The enemy targets (and meteors) will appear as **flashing squares** and are larger than the other
  objects, which are stars."
- The starbase appears as a small **flying-saucer/eye** symbol (◆ with wings). [M §VI]
- Title `LONG RANGE SCAN` at the top, the control panel at the bottom; background **black**.
- Procedure: (1) select a target; (2) move the stick **left** until the target is directly in front of
  you; (3) move the stick forward/back until the target is as far away as possible (top of the screen);
  (4) use the engines to approach; (5) minor corrections, repeat 2–3; (6) when very close, stop; the
  target should now be visible in the front view.
- Damaged: mirror images of every object (see §7).

---

## 11. Attack Computer Display  [M §IV]

- Appears at the **bottom right of the screen in the front view** when the computer (C) is on.
- A rectangular frame with an inner box; the **target marker** (a small Zylon-shaped blip) moves inside.
  Centre it to track and locate enemy targets or friendly starbases.
- Lock indicator marks on the edges (diagram): **A** = two short horizontal bars, upper left and upper
  right; **B** = two short horizontal bars, lower left and lower right; **C** = two short vertical bars,
  bottom centre.

| Marks | Meaning |
|---|---|
| **A** | Computer has **horizontally** locked your photons onto the target |
| **B** | Locked **horizontally and vertically** |
| **C** | Locked horizontally, vertically, **and within range**. "This is the best time to fire your photons. Both photons will fire with a **kill probability of 90%** guaranteed." |

- "Using the computer lock-on is the best procedure for destroying a Zylon BASESTAR."
- In an empty sector the display is empty; when all targets in a sector are destroyed the target marker
  disappears.
- Exact lock windows from the ROM are in §17.6. Note the "90% guaranteed" is manual wording; the ROM
  makes locked torpedoes **home in** and auto-fires the second torpedo.

---

## 12. Energy usage  [M §V]

- Start: **9999 units**.
- Refill: dock at a starbase (§13) before you run out. At **0** the mission is aborted.
- Panel **flashes red** below **1000 units**.

### 12.1 Energy drain

| Reason | Drain |
|---|---|
| Each enemy photon hit | **100 units** |
| Each photon fired | **10 units** |
| Shields (S) up | **2 units / second** |
| Computer (C) on | **½ unit / second** |
| Life support (always on) | **¼ unit / second** |

### 12.2 Engines

| Twin-Ion speed | 0 | 1 | 2 | 3 | 4 | 5 | 6* | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Units / second | 0 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 7.5 | 11.25 | 15 |

\* "The most efficient speed is 6 (V=12), in terms of energy used and distance traveled."

### 12.3 Hyperwarp cost by distance

| Sectors | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Units | 100 | 130 | 160 | 200 | 230 | 500 | 700 | 800 | 900 | 1200 | 1250 | 1300 |

| Sectors | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Units | 1350 | 1400 | 1550 | 1700 | 1840 | 2000 | 2080 | 2160 | 2230 | 2320 | 2410 | 2500 |

- "Jumps over a distance of five sectors are very costly. … it is more efficient to make several smaller
  jumps." The numbers are approximate; "null points within a sector … vary these values slightly."
- Aborting a jump costs **100 units**. [M §IX]
- The ROM indexes exactly this 24-entry table by the block distance between the two chart positions;
  see §17.5.

---

## 13. Starbase docking  [M §VI]

1. Hyperwarp to a sector with a starbase.
2. Centre the target marker in the Attack Computer Display. Check **R** for distance, make sure R is
   **+** (in front), and θ and Φ are close to zero (**less than ±3**).
3. Approach on the Twin-Ion engines (reduced speed **1, 2 or 3** for best results). If the computer is
   destroyed, find the starbase on the Long-Range Scan.
4. "Docking is established when the starbase is in the centre of the cross hairs at a minimum distance
   from your ship." When **three small windows appear on both edges of the starbase** and it is centred
   between the cross hairs, reduce engine speed to **0**.
5. Messages in order: **"ORBIT ESTABLISHED"** → **"STANDBY"** → **"TRANSFER COMPLETE"**. It is then safe
   to hyperwarp to another sector.
6. "If you hit a button or key (other than G), or move the Control Stick before docking is complete, the
   operation will be interrupted and the message **"DOCKING ABORTED"** will appear." Retrace the steps.
- Docking restores energy and repairs damaged and destroyed equipment. [M §I]
- In the ROM a **transfer vessel** flies out from the starbase to your ship during STANDBY. [R:DOCKING]
- Tactic: turn the shields off once out of enemy range to save 2 units/second while docking. [M §IX]

---

## 14. Rating  [M §VII]

Computed at the end of each mission from five factors: mission level, enemies destroyed, energy used,
time taken, and starbases destroyed (by the enemy).

### 14.1 Formula

```
Score = M
      + 6 × (enemies destroyed)
      − (energy used) / 100
      − (time taken) / 100            (time in centons)
      − 18 × (starbases destroyed by the enemy)
      − 3 × (starbases destroyed by you)
```

### 14.2 Values for M

| Mission level | Bonus for mission completed | Mission aborted | Penalty for starship destroyed |
|---|---|---|---|
| NOVICE | 80 | 60 | 40 |
| PILOT | 76 | 60 | 50 |
| WARRIOR | 60 | 50 | 40 |
| COMMANDER | 111 | 100 | 90 |

### 14.3 Ranks

| Rating | Mission score |
|---|---|
| ROOKIE | 48–79 |
| NOVICE | 80–111 |
| ENSIGN | 112–143 |
| PILOT | 144–175 |
| ACE | 176–191 |
| LIEUTENANT | 192–207 |
| WARRIOR | 208–223 |
| CAPTAIN | 224–239 |
| COMMANDER | 240–271 |
| STAR COMMANDER | 272–303 |

- Displayed as **rank and class**: "The classes are 1 through 5, with 1 being the highest and 5 being the
  lowest. The classes divide each rank into five equal parts."
- Under **48** points: a **gag ranking** such as **"GARBAGE SCOW CAPTAIN"** or **"GALACTIC COOK"**. Full
  gag list from the ROM is in §17.
- The manual's insignia art: NOVICE = gold zig-zag; PILOT = gold bar; WARRIOR = gold lightning bolt;
  COMMANDER = lightning bolt with a star, each on a dark disc with a blue-green glow.

---

## 15. Skill levels  [M §VIII]

| Level | Starbases | Enemy starships | Hyperwarp steering | Damage to you | Notes |
|---|---|---|---|---|---|
| **NOVICE** | **3** | **27** | Automatic | **None** | Meteors cannot damage you with shields up |
| **PILOT** | **4** | **36** | Required | Yes | "susceptible to enemy attacks … more difficult in general" |
| **WARRIOR** | **5** | **45** | Required | Yes | "enemy attacks will be frequent and generally more devastating" |
| **COMMANDER** | **6** | **54** | Required | Yes | "under constant attack" |

Simplified NOVICE instructions [M §VIII]: SELECT NOVICE → START → press **S** and **C** (shields up,
computer on) → **G**, move the dot to an enemy sector → **F**, then **H** → centre the target marker in
the attack computer (θ=+0, Φ=+0, R a low + number) → destroy all targets with photons → move to the next
enemy sector, prioritising those threatening starbases.

---

## 16. Meteors  [M §I]

- Meteors fly through space during missions (screenshot: a field of small grey tumbling blocks).
- **Shields down**: a meteor hit **destroys your ship**.
- **Shields up**: a meteor can still **damage** the ship, except at NOVICE.
- You can **hyperwarp into a meteor**, resulting in damage or destruction.
- A photon torpedo destroys a meteor.
- Meteors show on the Long-Range Scan as flashing squares, like enemies.

---

## 17. Details from the ROM [R]

The manual is silent or approximate on these points. Values are from the disassembly; see
`docs/OVERHAUL_PLAN.md` for how each maps to the remake.

Values are from the disassembly. Line numbers are in `StarRaiders.source.asm.txt`. The ROM counts in
**game loops** (about one per 1/60 s video frame, longer when busy) and **TICKs** (exactly one VBI,
1/60 s NTSC). Internal distance unit is "KM" (= the manual's metron scale ×~2.56 on the panel).

### 17.1 Speeds and drain [R: VELOCITYTAB L10497, DRAINRATETAB L10532]

| Key | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Internal velocity (KM/loop) | 0 | 1 | 2 | 4 | 8 | 16 | 32 | 64 | 96 | 112 |
| Engine drain (1/256 unit per loop) | 0 | 4 | 6 | 8 | 10 | 12 | 14 | 30 | 45 | 60 |

- V on the panel = floor(100·velocity/256). Velocity changes by 1 per loop toward the new setting
  (smooth acceleration). A game starts at speed 6.
- Per-loop drain in 1/256 units: shields **8**, attack computer **2**, life support **1**, plus the engine
  rate. At ~60 loops/s that is shields ≈ 1.9/s, computer ≈ 0.47/s, life support ≈ 0.23/s — the manual's
  2, ½ and ¼ per second.
- Lump costs: photon fired −10; hit by Zylon torpedo or meteor −100; hyperwarp abort −100;
  hyperspace −10 per loop for (WARPENERGY−1) loops.
- Every time energy crosses a 100-unit boundary the running score loses 1 (this is the manual's
  "energy used / 100").
- **Zero energy**: mission ends, "MISSION ABORTED / ZERO ENERGY".
- **Low energy (<1000)**: the panel background alternates **pink $44 / dark blue $90** every 128 loops.

### 17.2 Panel [R: PANELTXTTAB L10672]
- Exact layout, 2 × 20 characters: `V:00 K:00 E:9999 T:0` / ` θ:+00 Φ:+00 R:+000`.
- The letter is **T** with the tracking computer **off** and **C** with it **on** (matches the manual's
  "changes to C:2 when Tracking Computer is on").
- R's last digit is a coarse 0–5; R shows ∞ when the target is out of range. V shows ∞ in hyperspace.
- θ, Φ, R **freeze** when the computer is damaged.

### 17.3 Damage [R: DAMAGE L6701]
- Chance a hit damages anything: NOVICE **0**, PILOT **80/256 (31%)**, WARRIOR **180/256 (70%)**,
  COMMANDER **254/256 (99%)**; then one of 8 slots (6 systems + 2 "nothing").
- **Destroyed** instead of damaged when the Zylon torpedo was fired from close (≥ 30 loops of life
  left). Meteors always **destroy**. Computer and LRS cannot both be destroyed.
- Messages: `DAMAGE CONTROL` then e.g. `PHOTONS DAMAGED`, `ENGINES DESTROYED`, `SECTOR SCAN DAMAGED`,
  `SUB-SPACE RADIO DESTROYED`. The LRS is called **SECTOR SCAN** on screen.
- Effects: photons damaged → one barrel only; destroyed → no fire. Engines damaged/destroyed → speed
  jitters; destroyed → capped at key 5. Shields damaged → flicker (200/256 up each 4 loops), panel
  turns **orange $26** while off; destroyed → always off. Computer damaged → θΦR freeze; destroyed →
  no crosshairs, display, lock or tracking. LRS damaged → random mirrored rows; destroyed → only your
  ship. Radio damaged → chart freezes; destroyed → no TARGETS update and no surround/destroyed
  messages.
- DC letter colours on the chart: OK **$B8 light mint**, damaged **$FC yellow**, destroyed
  **$5E pink-red**.

### 17.4 Galaxy, fleets and star date [R: INITIALIZE L8516, FLUSHGAMELOOP L8883]
- 16 × 8 sectors; you start at column 8, row 4. Per level, **level+3** sectors each of 2-ship,
  3-ship and 4-ship Zylon groups plus level+3 starbases → **27/36/45/54 Zylons, 3/4/5/6 starbases**.
  Starbases never start on the border or next to Zylons.
- Chart symbol sprites (8×8, left column and bottom row are the grid lines):
```
1-2 Zylons  3 Zylons   4 Zylons   Starbase
#.......    #.......   #.......   #.......
#.##....    #...###.   #..##...   #.#.#.#.
#..##...    #.......   #.......   #..###..
#.#####.    #.###...   #.##.##.   #.#####.
#..##...    #.......   #.......   #..###..
#.##....    #..###..   #...##..   #.#.#.#.
#.......    #.......   #.......   #.......
########    ########   ########   ########
```
- Star date: last digit +1 every **41 loops** (shown `00.00`).
- Fleets move every **50 star-date ticks** (0.50 star date; first move after 100). Per move tick each
  group moves one sector with probability **1–2 ships 255/256, 3 ships 192/256, 4 ships 32/256** (the
  manual's "½" and "⅛" rates), toward the single **hunted starbase** (re-chosen every 8 moves), never
  into your sector, never into an occupied sector. Score −1 per move tick.
- **Surround**: when all four N/E/S/W neighbours are occupied, `STARBASE SURROUNDED` (long message +
  "message from starbase" tune). At the next move tick 100 ticks later (1.00 star date), if still
  surrounded, the starbase becomes a **2-Zylon sector**, score −18, `STARBASE DESTROYED`.
- Losing all starbases does **not** end the game.

### 17.5 Hyperwarp [R: HYPERWARP L4586, CALCWARP L7582]
- H: `HYPERWARP ENGAGED`; speed ramps up 1/loop. From velocity 128 star **trails** appear (a new trail
  of 6 stars every 4 loops). At 254: `HYPERSPACE` (long), stars and marker hidden, V shows ∞, a
  1280 Hz transit beep; it lasts WARPENERGY−1 loops at −10 energy per loop. Then `HYPERWARP COMPLETE`,
  speed falls to 0. Entering a Zylon sector: **RED ALERT** for 255 loops.
- Cost: distance = |Δcol| + |Δrow|/2 in chart units; WARPENERGY = table[distance/8] + (distance & 3);
  shown ×10 (100–2530). The table is exactly the manual's 24 values.
- Landing point moves with the hyperwarp marker: 8 PM columns off-centre = 1 sector sideways, 16 PM
  rows = 1 sector up/down. The marker drifts (except NOVICE): 6% of loops it gets a random kick whose
  size grows with the warp cost (±16..31 below 640 energy up to ±16..127 at ≥ 1920). Leaving the front
  view during the jump (not NOVICE) randomises the landing.
- Abort: any 0–9 key in any phase, −100 energy, `HYPERWARP ABORTED`.
- Landing nearer the sector's vertical middle gives a tighter cluster of targets (VICINITYMASK).

### 17.6 Attack computer, lock-on and tracking [R: UPDATTCOMP L4320, TRIGGER L6438]
- Display: outer box cols 119–148 × rows 70–86 (of a 160×100 field), inner box cols 126–140 × rows
  75–81; the blip is a 6×5 shape (`#....#/#.##.#/######/#.##.#/#....#`).
- Three marker pairs (the manual's A, B, C):
  - **A (horizontal)**: target x within about ±512 KM of the axis.
  - **B (vertical)**: A plus y within about ±512 KM.
  - **C (range)**: A and B plus target **in front and closer than 3072 KM**.
- There is **no 90% roll** in the code: with full lock the torpedoes **home in** on the target and the
  second torpedo fires automatically. Firing without lock hides the markers for 12 display cycles.
- Tracking: the computer auto-tracks the Zylon that last fired; **M** toggles Zylon 0/1; **T** toggles
  `COMPUTER TRACKING ON` / `TRACKING OFF`, and when on, the game switches front/aft to keep the target
  in view.
- Front crosshair: vertical line col 80 rows 40–46 and 54–60, horizontal row 50 cols 62–76 and 84–98
  (a plus with a centre gap). Aft: only the horizontal bars.

### 17.7 Combat [R: TRIGGER, COLLISION L6833, MANEUVER L5184]
- Photons alternate left/right barrels; a barrel can refire after 23 loops; torpedo life 255 loops,
  speed 102 KM/loop, sparkling (shape ANDed with random each frame). Cost 10.
- Hit: screen overlap plus a depth window. Zylon kill: +6 score, K+1. Shooting a starbase: −3.
  Meteors and Zylon torpedoes can be shot down (no score).
- **Basestar**: only a torpedo **younger than 15 loops** (i.e. fired from close range) destroys it.
- Zylon torpedo: one at a time; fired when the Zylon is near your horizontal plane and within 8192 KM;
  life 62 loops, speed 80, homing toward your axis at NOVICE 1 / PILOT 4 / WARRIOR 8 / COMMANDER 20.
  Zylons fire from behind on all levels except NOVICE.
- Hit with **shields up**: −100 energy, possible damage, the screen flashes random colours. Shields
  **down**: `SHIP DESTROYED BY ZYLON FIRE`.
- **Meteors**: spawn rarely (4/256 on 3 of 4 loops when the torpedo slot is free), fly straight at you
  (z −8/loop); hit = like a torpedo hit (always destroys a subsystem). None in starbase sectors or
  during hyperwarp.
- Explosion: 32 fragments with random velocity −7..+7, 128 loops.

### 17.8 Zylon behaviour [R: MANEUVER]
- At most **2 Zylon ships** in view and 1 Zylon torpedo; a new one replaces a dead one while the
  sector count allows. Spawn ≥ 28928 KM ahead.
- Type mix per spawn: fighter 4/8, cruiser 3/8, basestar 1/8. Types differ only in shape, starting
  flight pattern, basestar flicker and the basestar kill rule; **cruisers are not coded to wait for
  provocation** (the manual's description is flavour).
- Each ship is steered once every 8 loops: velocity indices step toward random "milestones"
  (±62, ±30, ±4 KM/loop patterns). Within 8192 KM they switch to attack: weave around your crosshair,
  dive in to 2560 KM and pull out. WARRIOR/COMMANDER: 19% chance to attack from behind. Zylons swing
  with your turns so they stay in view.
- Starbase sectors contain no Zylons, torpedoes or meteors.

### 17.9 Docking [R: DOCKING L6007]
- Starbase = centre player + two wing players (the "three small windows" are the wing pattern), pulsing
  orange; tracked as T=2.
- Orbit needs, all at once: starbase centred (slightly above the horizontal crosshair), **in front and
  closer than 512 KM**, and speed 0 (current and new). Then `ORBIT ESTABLISHED` → `STANDBY`; a
  **transfer vessel** flies from the starbase to you (about 10 s); when it passes: `TRANSFER COMPLETE`,
  energy 9999, all systems repaired, the vessel flies back. Breaking a condition first:
  `DOCKING ABORTED`.

### 17.10 Rating and game over [R: GAMEOVER L7344]
- Running score: +6 per Zylon, −3 per starbase you shoot, −18 per starbase lost, −1 per fleet move
  tick (the manual's "time/100"), −1 per 100 energy used. Total = score + M (table §14.2).
- Rank = total / 16 → `GALACTIC COOK` (0–15), `GARBAGE SCOW CAPTAIN` (16–47), then the manual's ranks;
  ≥ 304 is STAR COMMANDER class 1. Class 1–5 from the low bits.
- End sequences (one segment at a time on the title line):
  - complete: `STAR FLEET TO / STAR CRUISER 7 / MISSION COMPLETE / NEW RANK IS: / <rank> / CLASS n /
    CONGRATULATIONS`
  - zero energy: `... MISSION ABORTED / ZERO ENERGY / NEW RANK IS: ... / REPORT TO BASE / FOR TRAINING`
  - destroyed: `STAR FLEET TO / ALL UNITS / STAR CRUISER 7 / DESTROYED / BY ZYLON FIRE / POSTHUMOUS
    RANK IS: ...`

### 17.11 Title and attract mode [R: INITCOLD, SETTITLE]
- Power-up shows `NOVICE MISSION` then `STAR RAIDERS` / `COPYRIGHT ATARI 1979` over the live starfield
  in demo mode (ship cruising at speed 6, no panel). SELECT cycles `PILOT MISSION`, `WARRIOR MISSION`,
  `COMMANDER MISSION`. There is **no separate title graphic** — the game itself is the attract screen.
- Unknown keys show `WHATS WRONG?`. Idle ≈ 9.1 minutes → demo.

### 17.12 Sound (POKEY) [R: SOUND L7907]
| Effect | Character |
|---|---|
| Engines | continuous noise rumble, pitch and volume rise with speed, silent at 0 |
| Photon launched | white-noise "whoosh" with rising envelope plus a falling tone (0.4 s) |
| Zylon explosion | tone sweep turning to loud noise, 0.8 s, delayed by torpedo flight time |
| Shield explosion (you hit / starbase dies) | heavier noise burst, ~1 s |
| Starship explosion | 1 s random-pitch noise/tone mix |
| Hyperwarp transit | 1280 Hz beeps, 13× |
| Red alert | alternating ≈490/330 Hz, 8× |
| Acknowledge (C, S, T, transfer) | three short ≈1880 Hz beeps |
| Damage report | ≈490→970 Hz, 3× |
| Message from starbase | ≈440, 490, 390 Hz tune |

### 17.13 Display and colours [R: PFCOLORTAB L11463]
- Screen: 160 × ~100 playfield (2-scanline pixels) + player/missile sprites. Only **12 stars**, each a
  single pixel, coloured by distance (near brightest, far dim, far ones twinkle). Turning rotates all
  objects 0.89° per loop.
- Front/aft upper area: crosshairs, attack box and far stars **$A6 green**; blip, lock marks, mid stars
  **$AA light green**; near stars and the title line **$AF very light green**; background black.
- **Shields on**: background **$A0** (dark green-cyan tint; the manual calls it "bluish").
- **Red alert**: background **$42 dark orange/red** flashing every 32 loops; title text flashes.
- **Hit with shields**: background random colours.
- Panel (and chart footer): background **$90 dark blue**; V/T/θ and digits **$B8 light mint**; K and
  Φ label **$5A pink**; E and R label **$FC light orange/yellow**; STAR DATE **$5E pink**.
- Chart and LRS: upper background **$A0**; chart symbols **$B8**.
- Sprites: Zylons and transfer vessel **grey/white $0x**; basestar hue **flickers randomly** every
  frame; starbase **orange $2x pulsing**; meteor **green $Ax**; photons **purple $5x** sparkling;
  hyperwarp marker **sky blue $9F**. Brightness falls with distance (14 → 4). In LRS and chart views
  blips flash random colours.
- Objects use 8 discrete size cells by distance; the farthest cell is the LRS dot.

---

## 18. Visual style

### 18.1 What the original screen looked like  [M figures; R]
- Black space with only **12 single-pixel stars**, coloured by distance, streaming outward from the
  centre as you fly (speed-dependent) and rotating as you turn. No cockpit frame, no ship model, no HUD chrome beyond the panel strip.
- **Control panel**: two text rows on a **light sky-blue band** across the bottom of the front, aft and
  LRS views. Text uses the Atari's chunky 8×8 custom font (see the HUD strip photo: `V:00 K:00 E:9875
  T:1 / θ:+00 Φ:−02 R:+043`).
- **Title/message line** near the top of the screen (one short phrase at a time) (e.g. `ORBIT ESTABLISHED`,
  `GALACTIC CHART`, `LONG RANGE SCAN`), on black.
- **Front view crosshair**: thin plus with a gap at the centre. **Aft crosshair**: two horizontal
  dashes.
- **Attack computer**: a small rectangle of thin light-blue lines in the lower right of the front view
  (photo in §VI shows it next to the starbase).
- **Galactic Chart**: the whole screen becomes the chart: a sky-blue field, a white 16×8 grid, white
  sprites, title band on black, three text lines below.
- **Long-Range Scan**: black field, white dots for stars, larger flashing squares for targets, the
  player's ship as a small white arrow-shaped icon in the middle.
- **Hyperwarp**: stars streak into long lines toward you (the "star trails") while the marker sits
  between long cross hairs.
- **Shields on**: space gets a **bluish (dark green-cyan) tint**. **Red alert**: the space background
  flashes dark red/orange with a two-tone siren and `RED ALERT` on the title line.
- **Explosions**: a burst of many coloured fragments flying outward from the hit point.
- Resolution was 160-pixel-wide playfield with player/missile sprites; objects scale in a few discrete
  sizes as they approach (8 shape sizes per object). [R]

### 18.2 Palette
Atari colour register values from the ROM (§17.13), with approximate sRGB from a standard NTSC
palette, and what the manual's photos show. The remake should use one fixed palette table like this
(ideally a published Atari NTSC palette such as Altirra's default) rather than ad-hoc CSS colours.

| Element | ROM value | Approx. sRGB | Manual photo |
|---|---|---|---|
| Space | $00 | `#000000` | black |
| Near stars, title line | $AF | `#C8FFE8` | white |
| Mid stars, blip, lock marks | $AA | `#7CE0B8` | white |
| Far stars, crosshairs, attack box | $A6 | `#3CA884` | light blue lines |
| Shields-on space tint | $A0 | `#00302A` | "bluish tint" |
| Red alert background | $42 | `#8C2010` | red flash |
| Panel / chart-footer background | $90 | `#1C3C9C` | sky-blue band |
| Panel low-energy flash | $44 | `#C04848` | "flashes red" |
| Panel shields-out | $26 | `#B06818` | ("yellow") |
| V, T, θ, digits; chart symbols; DC OK | $B8 | `#A8F0B8` | white/mint |
| K, Φ label | $5A | `#E890E0` | pink |
| E, R label, TARGETS, DC damaged | $FC | `#FCE08C` | yellow-green |
| STAR DATE, DC destroyed | $5E | `#FFB8FF` | pink |
| Zylon ships | $0x | `#E0E0E0`→`#606060` by range | white/pale blue |
| Starbase | $2x | `#F0A040` pulsing | orange/gold |
| Photon torpedoes | $5x | `#C070E0` sparkling | — |
| Meteors | $Ax | `#60C0A0` | grey-white |
| Hyperwarp marker | $9F | `#A0C8FF` | white |

### 18.3 Zylon and object sprite shapes  [M §I figures; R]
The manual's sprite plates match the ROM bitmaps (largest size; each pixel is twice as wide as tall):

```
ZYLON FIGHTER (12 rows)   ZYLON CRUISER (9)   ZYLON BASESTAR (10)   PHOTON / METEOR (16)
#......#                  ...##...            ...##...              ...##...
#......#                  ..####..            ..####..              ..####..
#......#                  .######.            .######.              .######.
#......#                  .######.            ########              .######.
#.####.#                  ##.##.##            ...##...              .###.##.
########                  ##....##            ...##...              ####.###
########                  #......#            ########              ##.#####
#.####.#                  #......#            .######.              ##.#####
#......#                  #......#            ..####..              ########
#......#                                      ...##...              ########
#......#                                                            ####.###
#......#                                                            .###.##.
                                                                    .######.
                                                                    .######.
                                                                    ..####..
                                                                    ...##...
```
- **Fighter**: an "H" (TIE-fighter-like) — two tall side panels joined by a thick centre bar.
- **Cruiser**: a stepped arch / inverted "U".
- **Basestar**: a stepped diamond with two horizontal wing bars; its colour flickers randomly.

Starbase (left wing | centre | right wing), orange, pulsing:
```
........ ...##... ........
........ .######. ........
........ ######## ........
........ ######## ........
.....### ######## ###.....
...##### ######## #####...
...##### ######## #####...
.####### ###..### #######.
###.#.#. ###..### .#.#.###
.####### ######## #######.
...##### ######## #####...
...##### ######## #####...
......## ######## ##......
......## ######## ##......
........ .######. ........
........ .######. ........
```
Hyperwarp target marker: a small open cross (`..#.#.. / ###.### / ... / ###.### / ..#.#..`) in sky
blue. Transfer vessel: a small grey capsule with legs. Player ship: never shown except as a 5-line
icon at the centre of the LRS.

### 18.4 Cover-art mood  [M cover]
- Deep **purple-black space** with a **red-violet nebula**, a large planet disc with a **purple glowing
  rim**, a field of **white stars**.
- A **white-and-blue angular starship** (wedge-shaped, with boxy wing pods) fires a **yellow-white beam**
  and a **white lightning bolt**.
- A **golden Zylon basestar**: a double pyramid (one point up, one down) with **red-orange** glows and
  smaller golden Zylon ships launching from it.
- Below: a perspective **grid of floating square tiles topped with white clouds**, receding to the
  horizon.
- Title type: **"COMPUTER ADVENTURE"** in coral red, **"STAR RAIDERS"** in large white serif-less caps,
  **"ATARI 400/800"** with the numerals in yellow. Red-orange band at the bottom.
- Interior paintings: a red/orange space battle with laser streaks, white starfighters with red stripes,
  a crew at a console looking out on planets.

These are the references for title-screen and promotional art; the in-game look stays the spare 1979
Atari screen above.
