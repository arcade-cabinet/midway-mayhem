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

Zones cycle every ~450 track-metres. Each zone has a distinct sensory identity:

### 1. The Midway Strip
The entry zone. Warm amber light, carousel waltz phrase grammar, red-and-white striped arches overhead. Obstacles: sawhorses, cone clusters. Crowd: excited, expectant.

### 2. Balloon Alley
Pastel sky transitions in. Balloon clusters flank the track. Gates force precision threading. Music: playful, slightly building. Crowd: engaged, calling out misses.

### 3. Ring of Fire
Deep red lighting, heat shimmer post-fx. Hammer hazards swing across lanes with exact timing windows. Fire hoops at regular intervals. Music: tense, driving. Crowd: gasping, roaring. No forgiveness — graze a ring and you lose SANITY.

### 4. Funhouse Frenzy
Strobing neon, mirror layer duplicating the scene. Highest obstacle density. Track markings distort. Music: chaotic, maximum energy. Crowd: frenzy. SANITY drain accelerates.

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
