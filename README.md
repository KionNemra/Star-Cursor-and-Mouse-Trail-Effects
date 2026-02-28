# Star Cursor & Mouse Trail Effects

Canvas-based cursor and mouse trail visual effects for any website. Pure JavaScript, no dependencies.

## Features

- **Cursor Stars** — Twinkling stars that orbit around your cursor
- **Mouse Trail** — Animated particle trail that follows your mouse movement
- **Click Burst** — Particles burst outward on click
- **5 Shape Styles** — Star ★, Bubble ⊙, Heart ♥, Flower ✿, Flame ☄
- **Color Modes** — Fixed color or rainbow (hue rotation)
- **Custom Cursors** — Supports `.cur` and `.ani` cursor files
- **Settings Panel** — In-page gear button with real-time preview and localStorage persistence
- **Profile System** — Named config profiles for different cursor themes

## Quick Start

### One-Line Setup (Recommended)

Add two `<script>` tags to your page — the effect bundle handles everything automatically:

```html
<script src="seffects/star-effects.js"></script>
<script src="seffects/star-effects-panel.js"></script>
```

`star-effects.js` contains the full effect engine (trail, cursor stars, burst, cursor manager) in a single file. It reads settings from `localStorage` and runs immediately.

`star-effects-panel.js` adds a floating gear icon (⚙) to the page, opening a settings panel where visitors can customize effects in real time. This script is optional — only include it on pages where you want the settings UI.

### Manual Setup (Advanced)

If you need more control, load the individual modules:

```html
<script src="starConfig.js"></script>
<script src="cursorManager.js"></script>
<script src="starCursor.js"></script>
<script src="MouseTrail.js"></script>
<script src="main.js"></script>
```

## Adding to Your Website

### Static HTML

Copy the `seffects/` folder (and `cursor/` if you want custom cursors) into your project, then add the scripts before `</body>`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Page</title>
</head>
<body>
  <!-- your page content -->

  <script src="seffects/star-effects.js"></script>
  <script src="seffects/star-effects-panel.js"></script>
</body>
</html>
```

### CDN / Remote Hosting

Host the files on any static server or CDN, then reference them by URL:

```html
<script src="https://your-cdn.example.com/seffects/star-effects.js"></script>
<script src="https://your-cdn.example.com/seffects/star-effects-panel.js"></script>
```

### Multi-Page Sites

- Add `star-effects.js` to **every page** that should have effects.
- Add `star-effects-panel.js` only to the pages where users should see the settings gear.
- Settings persist in `localStorage`, so changes made on one page apply across the entire site (same origin).

## Configuration

### Pre-Configure via JavaScript

Set `window.StarEffectsConfig` **before** the scripts load to override defaults:

```html
<script>
  window.StarEffectsConfig = {
    colorMode: "rainbow",
    clickBurst: true,
    trailStyle: "flame",
    cursorStyle: "heart",
    burstStyle: "flower",
    trailMaxCount: 30,
  };
</script>
<script src="seffects/star-effects.js"></script>
```

### All Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `colorMode` | `string` | `"fixed"` | `"fixed"` or `"rainbow"` |
| `color` | `string` | `"#c8b869"` | Fill color (fixed mode) |
| `glowColor` | `string` | `"#e8c01e"` | Cursor star glow color |
| `rainbowSpeed` | `number` | `3` | Hue rotation speed (deg/step) |
| `rainbowSaturation` | `number` | `100` | HSL saturation (%) |
| `rainbowLightness` | `number` | `65` | HSL lightness (%) |
| `trailMaxCount` | `number` | `20` | Max simultaneous trail particles |
| `cursorStarCount` | `number` | `3` | Stars orbiting the cursor |
| `clickBurst` | `boolean` | `false` | Enable click burst |
| `clickBurstCount` | `number` | `12` | Particles per burst |
| `trailStyle` | `string` | `"star"` | Trail shape: `star` \| `bubble` \| `heart` \| `flower` \| `flame` |
| `cursorStyle` | `string` | `"star"` | Cursor shape: `star` \| `bubble` \| `heart` \| `flower` \| `flame` |
| `burstStyle` | `string` | `"star"` | Burst shape: `star` \| `bubble` \| `heart` \| `flower` \| `flame` |
| `trailLifetime` | `number` | `1000` | Trail particle duration (300–5000 ms) |
| `burstLifetime` | `number` | `1000` | Burst particle duration (300–5000 ms) |
| `trailSize` | `number` | `100` | Trail particle size scale (50–200 %) |
| `cursorSize` | `number` | `100` | Cursor star size scale (50–200 %) |
| `cursorSpread` | `number` | `20` | Cursor star spread range (10–100 px) |
| `cursor` | `string` | `null` | Path to `.cur` / `.ani` cursor file |

### Profiles

Associate different configurations with named profiles:

```html
<script>
  window.StarEffectsConfig = {
    activeProfile: "neon",
    profiles: {
      neon: {
        colorMode: "rainbow",
        clickBurst: true,
        trailStyle: "flame",
        cursor: "cursor/cyan.ani",
      },
      ice: {
        colorMode: "fixed",
        color: "#88ccff",
        cursorStyle: "bubble",
        cursor: "cursor/white.cur",
      },
    },
  };
</script>
```

Switch profiles at runtime:

```js
window.StarEffects.setProfile("ice");   // returns true if found
window.StarEffects.addProfile("fire", { color: "#ff4400", trailStyle: "flame" });
```

## Custom Cursors

The `cursor/` folder includes pre-made cursor files:

| File | Type | Description |
|------|------|-------------|
| `cyan.ani` | Animated | Cyan animated cursor |
| `blue.ani` | Animated | Blue animated cursor |
| `green.ani` | Animated | Green animated cursor |
| `pink.ani` | Animated | Pink animated cursor |
| `yellow.ani` | Animated | Yellow animated cursor |
| `viole.ani` | Animated | Violet animated cursor |
| `apple.ani` | Animated | Apple-themed animated cursor |
| `cyan.cur` | Static | Cyan static cursor |
| `green.cur` | Static | Green static cursor |
| `red.cur` | Static | Red static cursor |
| `white.cur` | Static | White static cursor |
| `yellow.cur` | Static | Yellow static cursor |

## File Structure

```
├── seffects/
│   ├── star-effects.js         # All-in-one effect bundle (recommended)
│   └── star-effects-panel.js   # Settings panel UI (optional)
├── cursor/                     # .cur and .ani cursor files
├── starConfig.js               # Configuration & profile system (advanced)
├── cursorManager.js            # .cur/.ani cursor loader (advanced)
├── starCursor.js               # Cursor star effect class (advanced)
├── MouseTrail.js               # Mouse trail effect class (advanced)
├── main.js                     # Bootstrap script (advanced)
├── index.html                  # Demo page
└── style.css                   # Demo page styles
```

- **`seffects/`** — Self-contained bundle. Use this for most integrations.
- **Individual files** — For advanced use when you need fine-grained control over each module.

## Browser Support

Works in all modern browsers that support `<canvas>` and `requestAnimationFrame` (Chrome, Firefox, Safari, Edge).
