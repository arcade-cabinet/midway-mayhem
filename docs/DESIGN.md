---
title: Design
updated: 2026-04-23
status: current
domain: product
---

# Design

## What the game is

**Midway Mayhem: Clown Car Chaos** is a cockpit-perspective arcade runner. You race a polka-dot clown car down a Hot Wheels mega-track inside a circus big-top. The track is procedurally generated; the car moves forward automatically. Your only job is to steer.

Full name: **Midway Mayhem: Clown Car Chaos**
Tagline: **Drive fast. Honk louder.**

## What the game is NOT

- Not a racing sim. No lap times, no rivals, no physics realism.
- Not a kart racer. No items, no pick-a-character, no racing other cars.
- Not a first-person shooter or platformer wearing a racing skin.
- Not desktop-first. Mobile is the primary target; web is debug.

---

## Brand pillars

### 1. Controlled chaos
Everything should feel unpredictable but readable. Hazards are telegraphed. Reactions are exaggerated. You always understand what just happened.

### 2. Carnival energy
Lights, color bursts, motion everywhere. Every frame should feel like a midway at maximum capacity.

### 3. Speed + humor
Fast gameplay, silly visuals, exaggerated effects. Humor is visual and kinetic — not text-heavy. The polka-dot clown car commits to the bit without winking at the camera.

---

## Visual identity

### Palette (locked — do not drift)

| Name | Hex | Use |
|------|-----|-----|
| Carnival Red | `#E53935` | Primary brand, clown car body, danger |
| Gold Yellow | `#FFD600` | Accents, highlights, tickets, UI glow |
| Electric Blue | `#1E88E5` | Track rails, cooldown indicators, boost |
| Clown Purple | `#8E24AA` | Steering wheel, cockpit pillars, secondary UI |
| Track Orange | `#F36F21` | Hot Wheels track surface |
| Night | `#0B0F1A` | Background, HUD base, full-screen overlays |

These are defined in `src/utils/constants.ts` (COLORS object) and `src/app/global.css` (`--mm-*` variables). All three sources must stay in sync.

### Typography

- **Bangers** (Google Fonts, SIL OFL 1.1) — display, zone names, big numbers, HYPE meter
- **Rajdhani** (Google Fonts, SIL OFL 1.1) — UI, HUD labels, settings, body copy

No substitutes.

### UI vocabulary

| Game concept | In-world label |
|--------------|---------------|
| Speed | HYPE |
| Health / durability | SANITY |
| Boost | LAUGH BOOST |
| Score / points | CROWD REACTION |
| Currency | Tickets |

---

## Polka-dot identity

The polka-dot texture on the clown car hood is the game's visual signature. It is procedurally generated at runtime (not a loaded image) from the brand palette: red base, yellow and blue dots at regular intervals. This was a deliberate preservation from the ChatGPT HTML POC and must not be replaced with a flat color or imported texture.

The hood ornament (squirting flower) and chrome steering wheel spokes are inherited from the POC and give the cockpit its "fully committed to being a clown car" personality.

---

## Cockpit as hero surface

The player spends 100% of the game looking from inside the cockpit. Design decisions:

- Camera is parented to the cockpit group — banking/yaw affects both simultaneously
- Hood geometry is a capped hemisphere at fixed Z — never clips into camera
- `useResponsiveFov` widens vertical FOV on portrait mobile so the track is always visible below the dashboard
- The Gemini POC's recurring "sail glitch" (camera staying fixed while the car moved) is architecturally impossible in v2

---

## Zone progression

Zones cycle every ~450 track-metres. Each zone has a completely distinct visual identity — lighting, fog, shoulder props, and ground colour all change simultaneously so the player knows which zone they are in without reading the banner.

| Zone | Distance | Sky | Ambient | Fog | Shoulder props |
|---|---|---|---|---|---|
| Midway Strip | 0–450m | Orange (#F36F21 bottom) | Warm yellow (#FFD600) | Thin orange | Striped red/white tent cones |
| Balloon Alley | 450–900m | Hot-pink/purple (#FF2D87 bottom) | Brand red (#E53935) | Purple (#8E24AA) | Floating pink + purple spheres |
| Ring of Fire | 900–1350m | Near-black with red glow | Red (#E53935), low | Dense dark red (#3D0800) | Emissive orange fire-ring toruses on posts |
| Funhouse Frenzy | 1350–1800m | Near-black with purple (#8E24AA) | Blue (#1E88E5), very dim | Heavy purple, density 0.009 | Strobing reflective mirror panels |

### 1. The Midway Strip (zone 0)
Warm orange daylight. Yellow key-light from above. Thin fog so sight-lines are long. Striped red/white carnival tent cones line both shoulders. Ground: dark canvas red. Obstacles: sawhorses, cone clusters. Crowd: excited, expectant.

**Visual signature:** Bright, warm, open. Orange everywhere.

### 2. Balloon Alley (zone 1)
Hot-pink/purple sky. Soft pink directional light from straight above. Floating sphere balloons — alternating brand pink (#FF2D87) and purple (#8E24AA) — bob gently at varied heights beside the track. Ground goes dark purple. Music: playful, slightly building. Crowd: engaged, calling out misses.

**Visual signature:** Pink-purple canopy of balloons above and beside you.

### 3. Ring of Fire (zone 2)
Near-black sky bleeding into deep red. Ground goes almost black (#1A0000). Very thick dark-red fog — sight-lines cut short, oppressive. Emissive orange torus rings (#F36F21, emissiveIntensity 2.0) mounted on dark posts flank the track. Key-light is orange from below-front, giving everything a fire-cast glow. Hammer hazards swing at timing windows. No forgiveness — graze a ring and you lose SANITY.

**Visual signature:** Dark, orange-lit, everything on fire.

### 4. Funhouse Frenzy (zone 3)
Near-black with purple bottom glow. Heaviest fog (density 0.009) — you can barely see ahead. Flat reflective mirror panels (#1E88E5 tint, metalness 0.95) line both shoulders, strobing on a 4Hz square wave (65% on, 35% off). Pink fill-light at high intensity pulses the scene. Ground is near-black with purple tint. Highest obstacle density. SANITY drain accelerates.

**Visual signature:** Dark strobing mirrors. You cannot see far. Nothing is real.

---

## Start platform — suspended from the dome cap

The start platform is a wire-hung launching pad suspended HIGH inside the
circus big-top, near the rafters. Visual spec:

- **Height**: y ≥ +25m above track piece 0 (which starts at y = 0.5m). The
  group origin sits at y = +30m so the player's POV looks DOWN the coil at
  the track unwinding far below.
- **Wire struts**: at least 4 visible steel-chrome cylinders extend UP from
  the platform corners to the dome cap at approximately y = +50m. They make
  the suspension explicit — the platform is obviously hanging, not floating.
- **Carnival identity preserved**: wooden plank deck + polka-dot trim rails +
  START sign remain unchanged; only the scene-graph y and wire geometry change.

The height is driven purely by the `StartPlatform` component's own
`position-y` within the scene graph. The track generator is unchanged; piece 0
stays at y = 0.5m as required by the integrator's ground clearance.

---

## Start platform — suspended from the dome cap

The start platform is a wire-hung launching pad suspended HIGH inside the
circus big-top, near the rafters. Visual spec:

- **Height**: y ≥ +25m above track piece 0 (which starts at y = 0.5m). The
  group origin sits roughly y = +30m so the player's POV looks DOWN the coil
  at the track unwinding far below.
- **Wire struts**: at least 4 visible steel-chrome cylinders extend UP from
  the platform corners to the dome cap at approximately y = +50m. They make
  the suspension explicit — the platform is obviously hanging, not floating.
- **Carnival identity preserved**: wooden plank deck + polka-dot trim rails +
  START sign remain unchanged; only the scene-graph y and wire geometry change.

The height is driven purely by the `StartPlatform` component's own
`position-y` within the scene graph. The track generator is unchanged; piece 0
stays at y = 0.5m as required by the integrator's ground clearance.

---

## World premise

The ride has gone off the rails. Literally. You are a clown in a polka-dot car that somehow ended up on the Hot Wheels mega-track inside a circus big-top. The Ringmaster is not pleased. The crowd is screaming. The track loops into zones you never agreed to race through.

There is no finish line on the first run. The track goes until you crash or your SANITY runs out. Every run is different because every run plan is seeded.

---

## Track surface material

The driveable track surface uses a PBR wood-plank material in place of the original flat orange Hot Wheels colour.

**Asset:** PolyHaven "Weathered Brown Planks" (`weathered_brown_planks`) — CC0 licence.
URL: https://polyhaven.com/a/weathered_brown_planks
Resolution fetched: 1k JPG (diffuse + OpenGL normal + roughness).

**Why this asset:**
Warm, aged, slightly worn brown planks with chipped paint and visible grain — exactly the carnival boardwalk / circus big-top floor aesthetic. The maroon/brown tones complement the red-and-white curbs and the arena HDRI lighting without competing with the polka-dot car.

**UV tiling (in `src/render/trackSurfaceMaterial.ts`):**
- 7 repeats across the 12 m track width
- 12 repeats along a 20 m track piece
- Gives boards ~1.7 m wide — oversized for arcade legibility at speed.

**Files stored at:** `public/textures/track/planks/` (diffuse.jpg, normal.jpg, roughness.jpg — each under 240 KB).

**Colour palette note:** "Track Orange" (`#F36F21`) remains in the locked palette table for reference and is still used by walls/underside/curbs. The surface itself is now texture-driven, not tinted.

---

## What the HTML POC proved

The Gemini + ChatGPT single-file HTML prototype went through seven visual-refinement rounds before this codebase was started. Key decisions that were validated and must be preserved:

1. **Polka-dot identity** — red base + yellow/blue dots is the correct signature
2. **Cockpit POV only** — third-person was never considered
3. **Steering via pointer/touch drag** — keyboard arrow keys are secondary, not primary
4. **Zones as distinct experiences** — same track, radically different atmosphere
5. **Crowd as a living presence** — the big-top audience is always audible and reactive
6. **SANITY/HYPE as the tension axes** — not a health bar, not a timer

---

## App icon

### Source

- **Master SVG**: `raw-assets/app-icon.svg`
- **Generator**: `scripts/generate-icons.ts` (run with `pnpm icons`)

### Concept

Night (`#0B0F1A`) background. Red (`#E53935`) clown car silhouette viewed from the front.
Polka-dot hood: black base with Yellow (`#FFD600`) and Blue (`#1E88E5`) dots — the same procedural signature as the in-game hood texture.
Big-top tent peaks behind the car use the Red/Yellow stripe pattern.
Orange (`#F36F21`) Hot Wheels track strip across the bottom.
Purple (`#8E24AA`) cabin-roof arc and hood-ornament (squirting flower) detail.
Headlight glow in Yellow. Electric-Blue wheels with Yellow hub caps.

All palette values are taken verbatim from the STANDARDS.md brand palette.

### Sizes generated

| Platform | Density | Size (px) | Destination |
|----------|---------|-----------|-------------|
| iOS iPhone | notification @2x | 40 | `AppIcon.appiconset/Icon-20@2x.png` |
| iOS iPhone | notification @3x | 60 | `AppIcon.appiconset/Icon-20@3x.png` |
| iOS iPhone | settings @1x | 29 | `AppIcon.appiconset/Icon-29@1x.png` |
| iOS iPhone | settings @2x | 58 | `AppIcon.appiconset/Icon-29@2x.png` |
| iOS iPhone | settings @3x | 87 | `AppIcon.appiconset/Icon-29@3x.png` |
| iOS iPhone | spotlight @2x | 80 | `AppIcon.appiconset/Icon-40@2x.png` |
| iOS iPhone | spotlight @3x | 120 | `AppIcon.appiconset/Icon-40@3x.png` |
| iOS iPhone | app @2x | 120 | `AppIcon.appiconset/Icon-60@2x.png` |
| iOS iPhone | app @3x | 180 | `AppIcon.appiconset/Icon-60@3x.png` |
| iOS iPad | notification @1x | 20 | `AppIcon.appiconset/Icon-ipad-20@1x.png` |
| iOS iPad | notification @2x | 40 | `AppIcon.appiconset/Icon-ipad-20@2x.png` |
| iOS iPad | settings @1x | 29 | `AppIcon.appiconset/Icon-ipad-29@1x.png` |
| iOS iPad | settings @2x | 58 | `AppIcon.appiconset/Icon-ipad-29@2x.png` |
| iOS iPad | spotlight @1x | 40 | `AppIcon.appiconset/Icon-ipad-40@1x.png` |
| iOS iPad | spotlight @2x | 80 | `AppIcon.appiconset/Icon-ipad-40@2x.png` |
| iOS iPad | app @1x | 76 | `AppIcon.appiconset/Icon-76@1x.png` |
| iOS iPad | app @2x | 152 | `AppIcon.appiconset/Icon-76@2x.png` |
| iOS iPad Pro | app @2x | 167 | `AppIcon.appiconset/Icon-83.5@2x.png` |
| iOS App Store | marketing | 1024 | `AppIcon.appiconset/Icon-1024.png` |
| Android | mdpi (1×) | 48 | `mipmap-mdpi/ic_launcher.png` |
| Android | hdpi (1.5×) | 72 | `mipmap-hdpi/ic_launcher.png` |
| Android | xhdpi (2×) | 96 | `mipmap-xhdpi/ic_launcher.png` |
| Android | xxhdpi (3×) | 144 | `mipmap-xxhdpi/ic_launcher.png` |
| Android | xxxhdpi (4×) | 192 | `mipmap-xxxhdpi/ic_launcher.png` |

### Regenerating

```bash
# Edit raw-assets/app-icon.svg, then:
pnpm icons
```

The generator hard-fails on any rasterisation error. `Contents.json` is
rebuilt automatically on each run, so it stays in sync with the spec table
inside `scripts/generate-icons.ts`.
