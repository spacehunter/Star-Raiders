# CSS Pixelated/Chunky Reference - Quick Copy-Paste Guide

## Essential CSS Properties for Atari 800 Aesthetic

### Text Elements (Labels, Values, Messages)
```css
.atari-text {
  /* CHUNKY MONOSPACE FONT */
  font-family: 'Courier New', 'Courier', monospace;
  font-size: 4vh;
  font-weight: bold;
  letter-spacing: 0.4vw;
  line-height: 1;

  /* FORCE PIXELATED RENDERING */
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: grayscale;
  font-smooth: never;
  text-rendering: geometricPrecision;

  /* BLOCKY SHADOW + MINIMAL GLOW */
  text-shadow:
    0.15vh 0.15vh 0 #000000,    /* Hard black shadow */
    0 0 0.3vh currentColor;      /* Subtle phosphor glow */

  /* PREVENT SMOOTH TRANSITIONS */
  transition: none;

  /* COLOR */
  color: #00FFFF;  /* Pure cyan */
}
```

### Container Elements (Panels, Frames, Radar)
```css
.atari-container {
  /* PIXELATED RENDERING */
  image-rendering: -moz-crisp-edges;
  image-rendering: -webkit-crisp-edges;
  image-rendering: pixelated;
  image-rendering: crisp-edges;

  /* CHUNKY BORDER */
  border: 0.6vh solid #00FFFF;

  /* SOLID BACKGROUND */
  background: #000000;

  /* MINIMAL GLOW */
  box-shadow: 0 0 0.5vh rgba(0, 255, 255, 0.4);

  /* NO ROUNDED CORNERS */
  border-radius: 0;
}
```

### SVG Elements (Grid Lines, Shapes)
```css
.atari-svg-grid {
  /* CRISP EDGE RENDERING */
  shape-rendering: crispEdges;

  /* Grid lines */
  stroke: #00FFFF;
  stroke-width: 1;
  stroke-dasharray: 3, 3;
  fill: none;
  opacity: 0.5;
}
```

### Animations (Blinking, Pulsing)
```css
.atari-blink {
  /* BLOCKY STEPPED ANIMATION - No smooth transitions */
  animation: blink 1s infinite steps(2);
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

### CRT Scanlines
```css
.atari-scanlines::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.4) 0px,
    transparent 1px,
    transparent 2px,
    rgba(0, 0, 0, 0.4) 2px
  );
  pointer-events: none;
  z-index: 1;
}
```

## Color Palette (Pure RGB Values)

```css
/* PRIMARY UI ELEMENTS */
--cyan: #00FFFF;        /* Friendly, UI, player */
--magenta: #FF00FF;     /* Enemies (Cruiser) */
--gold: #FFD700;        /* Enemies (Basestar), objectives */
--yellow-green: #BAFF00; /* Energy, shields */

/* ALERTS & WARNINGS */
--red: #FF0000;         /* Danger, critical, warnings */
--white: #FFFFFF;       /* Highlights, important */

/* BACKGROUND */
--black: #000000;       /* Background, space */
```

## Size Guidelines

### Typography
```css
/* Minimum sizes for chunky visibility */
--text-small: 1.8vh;    /* Info displays */
--text-medium: 4vh;     /* Standard UI text */
--text-large: 4.5vh;    /* Indicators (A/B/C) */
--text-xlarge: 5vh;     /* Critical indicators */
```

### Borders & Lines
```css
/* Thick enough to see clearly */
--border-thin: 0.4vh;   /* Inner elements */
--border-medium: 0.6vh; /* Main containers */
--border-thick: 0.8vh;  /* Prominent frames */
--line-thick: 0.5vh;    /* Crosshairs, reticles */
```

### Spacing
```css
/* Based on 8-pixel character cell concept */
--gap-small: 0.8vw;     /* Letter spacing */
--gap-medium: 5vw;      /* Between stat groups */
--gap-large: 1vh;       /* Row spacing */
```

## Common UI Patterns

### Stat Display Group
```html
<span class="stat-group cyan">
  <span class="stat-label">E:</span>
  <span class="stat-value">9999</span>
</span>
```

```css
.stat-group {
  display: flex;
  align-items: center;
}

.stat-label {
  font-family: 'Courier New', monospace;
  font-size: 4vh;
  font-weight: bold;
  color: #00FFFF;
  -webkit-font-smoothing: none;
  text-shadow: 0.15vh 0.15vh 0 #000000, 0 0 0.3vh #00FFFF;
  margin-right: 1vw;
}

.stat-value {
  font-family: 'Courier New', monospace;
  font-size: 4vh;
  font-weight: bold;
  color: #00FFFF;
  -webkit-font-smoothing: none;
  text-shadow: 0.15vh 0.15vh 0 #000000, 0 0 0.3vh #00FFFF;
  min-width: 6vw;
  font-variant-numeric: tabular-nums;
}

.stat-group.energy .stat-label,
.stat-group.energy .stat-value {
  color: #BAFF00;
  text-shadow: 0.15vh 0.15vh 0 #000000, 0 0 0.4vh #BAFF00;
}
```

### Chunky Border Box
```css
.chunky-box {
  border: 0.6vh solid #00FFFF;
  background: #000000;
  box-shadow: 0 0 0.5vh rgba(0, 255, 255, 0.4);
  image-rendering: pixelated;
}

/* Optional: Corner decorations */
.chunky-box::before {
  content: '';
  position: absolute;
  top: 1.2vh;
  left: 1.2vh;
  width: 2vh;
  height: 2vh;
  border: 0.4vh solid #00FFFF;
  border-right: none;
  border-bottom: none;
  background: #000000;
}
```

### Enemy Marker (Triangle)
```css
.enemy-marker-triangle {
  width: 0;
  height: 0;
  border-left: 1.2vh solid transparent;
  border-right: 1.2vh solid transparent;
  border-bottom: 2vh solid #00FFFF;
  filter: drop-shadow(0 0 0.4vh #00FFFF);
  animation: marker-blink 1.2s infinite steps(2);
}
```

### Enemy Marker (Square)
```css
.enemy-marker-square {
  width: 2vh;
  height: 2vh;
  background: #FF00FF;
  border-radius: 0;
  filter: drop-shadow(0 0 0.4vh #FF00FF);
  animation: marker-blink 1.2s infinite steps(2);
}
```

### Lock Indicator (Active State)
```css
.indicator {
  font-family: 'Courier New', monospace;
  font-size: 4.5vh;
  font-weight: bold;
  color: #002222;  /* Dark when inactive */
  -webkit-font-smoothing: none;
  transition: none;
}

.indicator.active {
  color: #00FFFF;
  text-shadow:
    0.2vh 0.2vh 0 #000000,
    0 0 0.4vh #00FFFF;
  animation: lock-pulse 0.8s infinite steps(2);
}

@keyframes lock-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

## Browser Compatibility Notes

### Font Smoothing
```css
/* Chrome/Safari */
-webkit-font-smoothing: none;

/* Firefox */
-moz-osx-font-smoothing: grayscale;

/* Standard (future) */
font-smooth: never;
```

### Image Rendering
```css
/* Firefox */
image-rendering: -moz-crisp-edges;

/* Chrome/Safari */
image-rendering: -webkit-crisp-edges;

/* Standard */
image-rendering: pixelated;
image-rendering: crisp-edges;
```

### SVG Rendering
```css
/* All browsers */
shape-rendering: crispEdges;
```

## Testing Snippets

### Test Pixelation
```html
<div style="
  font-family: 'Courier New', monospace;
  font-size: 8vh;
  font-weight: bold;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: grayscale;
  color: #00FFFF;
">
  ATARI 800
</div>
```

If text looks smooth and anti-aliased → browser override
If text looks chunky and blocky → correct!

### Test Animation Stepping
```html
<div style="animation: test 2s infinite steps(2);">BLINK</div>
<style>
@keyframes test {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
```

Should snap instantly between visible/invisible, not fade.

## Quick Fixes

### Problem: Text looks too smooth
```css
/* Add these properties */
-webkit-font-smoothing: none;
-moz-osx-font-smoothing: grayscale;
font-smooth: never;
```

### Problem: Borders too thin
```css
/* Increase from 0.3vh to 0.6vh+ */
border: 0.6vh solid #00FFFF;
```

### Problem: Colors too muted
```css
/* Use pure RGB values */
color: #00FFFF;  /* Not rgba(0, 255, 255, 0.8) */
```

### Problem: Animations too smooth
```css
/* Change from ease to steps */
animation: pulse 1s infinite steps(2);
/* Not: animation: pulse 1s infinite ease-in-out; */
```

### Problem: Elements too small
```css
/* Increase all sizes by 1.5-2x */
font-size: 4vh;    /* Was: 2.5vh */
width: 24vh;       /* Was: 16vh */
```

## Copy-Paste Complete Component

```html
<div class="atari-panel">
  <div class="atari-scanlines"></div>
  <div class="atari-content">
    <span class="atari-stat-group">
      <span class="atari-label">E:</span>
      <span class="atari-value">9999</span>
    </span>
  </div>
</div>

<style>
.atari-panel {
  position: fixed;
  background: #000000;
  border: 0.6vh solid #00FFFF;
  box-shadow: 0 0 0.5vh rgba(0, 255, 255, 0.4);
  image-rendering: pixelated;
}

.atari-scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.4) 0px,
    transparent 1px,
    transparent 2px,
    rgba(0, 0, 0, 0.4) 2px
  );
  pointer-events: none;
  z-index: 1;
}

.atari-content {
  position: relative;
  z-index: 2;
  padding: 2vh;
}

.atari-stat-group {
  display: flex;
  align-items: center;
  gap: 1vw;
}

.atari-label,
.atari-value {
  font-family: 'Courier New', monospace;
  font-size: 4vh;
  font-weight: bold;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: grayscale;
  color: #00FFFF;
  text-shadow:
    0.15vh 0.15vh 0 #000000,
    0 0 0.3vh #00FFFF;
}
</style>
```

## Final Checklist

Before committing any Atari 800 UI:
- [ ] Using Courier/monospace font?
- [ ] Font smoothing disabled?
- [ ] Borders thick enough (0.5vh+)?
- [ ] Colors are pure RGB values?
- [ ] Animations use `steps()`?
- [ ] No rounded corners?
- [ ] Text size 4vh or larger?
- [ ] Scanlines visible?
- [ ] Looks chunky/blocky when zoomed?
- [ ] Could this run on 1979 hardware?

If all YES → Ship it! 🚀
