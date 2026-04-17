---
title: Design
updated: 2026-04-16
status: current
domain: product
---

# Design

## Product statement

**Midway Mayhem: Clown Car Chaos** is a cockpit-POV arcade driving game. You race a polka-dot clown car down a winding Hot Wheels mega-track inside a massive circus big-top. You dodge carnival-themed hazards, collect tickets and boosts, and try not to lose your SANITY before the crowd does.

Tagline: **Drive fast. Honk louder.**

Target audience: mobile-first casual to midcore. Desktop session-extender. Plays in 30s bursts, rewards 10-minute runs.

## Pillars

1. **Controlled chaos.** Everything feels unpredictable, but readable within 200ms.
2. **Carnival energy.** Color bursts, polka dots, neon, unceasing motion.
3. **Speed + humor.** Fast gameplay, silly visuals, exaggerated physics.

## Vision reconciliation — what the conversations asked for

The game's design was pinned across two conversations: Gemini (7 rounds of visual refinement on the HTML prototype) and ChatGPT (brand lock + elevation pass + full architecture spec). The user's redirects across those conversations ARE the design spec. See Appendix A for the full trail.

### From Gemini — gameplay + camera + controls
- Cockpit framing with A-pillars, roof, dashboard (NOT third-person).
- Mobile-first: touch/pointer steering, NO keyboard, NO "press arrow" instructions.
- Dynamic banking: car yaws + rolls into turns; camera rides with the body.
- Camera INSIDE the cockpit group (parent, not chase-camera).
- Responsive FOV: portrait phones need wider horizontal FOV (~90°).
- Plunging Hot Wheels mega-track with curve drop-off — vertigo feel.
- Shader-driven world surfaces (car paint, track, skydome).
- Procedural assets: no external image URLs.
- Bubbled-hemisphere hood geometry, not flat-sided cylinder.
- Cockpit elements scaled as ONE group responsive to viewport.

### From ChatGPT — brand + identity + game spec
- Name: **Midway Mayhem: Clown Car Chaos**.
- Tagline: **Drive fast. Honk louder.**
- Palette (strict):
  - Carnival Red `#E53935`
  - Gold Yellow `#FFD600`
  - Electric Blue `#1E88E5`
  - Clown Purple `#8E24AA`
  - Track Orange `#F36F21`
  - Night Background `#0B0F1A`
- Fonts: Bangers (display) + Rajdhani (UI).
- Logo motif: steering wheel with red/yellow quadrant split, thick outline.
- UI vocabulary:
  - SPEED → **HYPE**
  - HEALTH → **SANITY**
  - BOOST → **LAUGH BOOST**
  - SCORE → **CROWD REACTION**
- Zones (cycle every ~450 track-m):
  - **The Midway Strip**
  - **Balloon Alley**
  - **Ring of Fire**
  - **Funhouse Frenzy**
- 5 obstacle types: Barrier, Cone Cluster, Gate, Oil Slick, Hammer.
- 3 pickup types: Boost Ring, Ticket, Mega Boost.
- 60 FPS target, telegraphed hazards, click-on-horn honking.

### From in-session dialog — world architecture + discipline
- **Full-dome circus arena.** The entire game world is inside the big-top — 360° × 180° HDRI immersion, not a skybox half-shell.
- **Start on a wire-hung platform at the top of the dome.** New Game overlay fades → platform releases → car drops onto the track. (Scheduled for a later pass; current commit boots directly into racing.)
- **Hard-fail error discipline.** Every exception surfaces in a global modal. No silent fallbacks.
- **TypeScript everywhere.** Only `bpy` scripts and harness hooks are carve-outs.
- **Bake-time asset retexture.** Runtime retex banned.
- **Grailguard + marmalade-drops are references.** Mirror proven patterns before inventing.
- **The cockpit is the hero procedural element** — gets its own deep refinement pass because it's the identity-carrier the player sees every frame.

## Player experience laws

1. Player instinctively steers within 10 seconds of boot.
2. Player feels speed immediately.
3. Obstacles read without thinking.
4. Player smiles within 30 seconds.
5. One run is 30s-10min; game doesn't grind you out with menus.

## Visual identity

### Color system

Primary palette (above). Supporting:
- Funhouse Frenzy shoulder: deep indigo `#1a0b22`
- Error state: Carnival Red on Night background
- Success state: Gold Yellow on Electric Blue

### Material vocabulary

| Surface | Material |
|---|---|
| Track main surface | `mm_track_orange` — Hot Wheels plastic, roughness 0.38, metal 0.1 |
| Track curbs | `mm_rail_yellow` — glossy plastic, roughness 0.4 |
| Shoulders | `mm_shoulder_purple` — matte, roughness 0.55 |
| Lane dashes | `mm_marking_white` — clean matte, roughness 0.45 |
| Clown-car hood | red base + polka-dot procedural canvas overlay |
| Cockpit pillars | Clown Purple `#8E24AA`, plastic roughness 0.4 |
| Windshield arch | Gold Yellow, subtle metallic for highlight pickup |
| Chrome gauges / horn ring / trim | near-mirror, roughness 0.08, metalness 0.95 |
| Rear-view mirror | drei MeshReflectorMaterial (planned) |

### Typography

- **Bangers** for: title, zone banners, game-over text, HYPE/SANITY numbers, HONK button.
- **Rajdhani 600/700** for: HUD labels, meta text, button labels secondary.

### Motion language

- Card slides + fades for overlays, NEVER sliding from off-screen for core HUD.
- Zone banner: scale 0.9→1.0 + opacity 0→1 over 0.5s, holds 2.2s, fades back.
- Camera bob: sin(t*40)*0.02 + cos(t*50)*0.02 — subtle engine vibration, never motion-sickness.
- Steering: wheel rotates 35° max each way, damped exp(0.25s tau) to center on release.
- Banking: body yaw ±0.12 rad + roll ±0.18 rad with steer, damped linearly.
- Crash shake: noise burst decaying at 4/s.

### Audio identity

Zero samples — all Tone.js procedural:
- **Engine hum:** FM synth pair, pitch-scaled by hype, 6Hz LFO for vibration
- **Honk:** Multi-voice PolySynth playing Cmin7 chord with random ±80 cents detune per press
- **Crash:** Brown noise burst + brief pitched crunch
- **Pickup ticket:** A5 sine ping
- **Pickup boost:** E5 sawtooth sweep
- **Pickup mega:** C5→E5→G5 triad arpeggio
- **Zone ambient** (future): layered pad arrangements per zone, crossfade on boundary

## Appendix A — Vision trail summary

The full chat transcripts are in the user's local filesystem (gitignored). Notable redirects that shaped the product:

- Gemini: "After steering you totally lose the cockpit and it becomes a weird sail" → camera parenting requirement.
- Gemini: "We're back to being super zoomed in" on mobile → dynamic FOV requirement.
- Gemini: "Make more of the world with shaders like the car etc" → procedural shader preference over canvas textures for hero surfaces.
- Gemini: "Real-world-sized version of a hot wheels track" → plunging downward geometry.
- ChatGPT: "Make a decision on all of it and then produce the final 30k copy and paste prompt" → brand + palette + font + zone + UI-vocab lock.
- In-session: "You're not capturing the feel of the original POC" → preserve polka-dot + chrome + dice + flower ornament identity.
- In-session: "Get rid of fallbacks — fail hard" → ErrorBus + ErrorModal architecture.
- In-session: "The cockpit is the one primarily procedural element it HAS to be nailed" → dedicated cockpit refinement pass.
- In-session: "Full dome encapsulating the curving banked winding hotwheels track" → HDRI-as-full-world, 360°×180° immersion.
