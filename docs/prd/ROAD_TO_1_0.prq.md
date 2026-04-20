---
title: Road to 1.0 — PRQ
updated: 2026-04-20
status: current
domain: context
---

# Midway Mayhem: Road to 1.0

## Priority: HIGH

## Overview

Drive the game from its current state (functional but visually/gameplay-rough; 49 browser tests, 828 node tests, visual-matrix gate live) to a shippable 1.0 on iOS + Android via Capacitor. Scope is both MACRO (ship-blockers, missing feature work) and MICRO (polish, rough edges, tuning). Work is decomposable into independent PRs; each task below ends at VERIFIED_DONE when its acceptance criteria pass.

Shipped-game definition:
- Loads cleanly on iPhone 14 Pro + a mid-tier Android device at 60 FPS
- Tutorial flow teaches honk, steer, boost, tricks, plunge, zones before first gameplay
- Every 3D asset reads as "clown car in a circus big-top" — no stadium backdrop, no raw primitives, no orphan placeholders
- At least 3 zones have distinct visual + audio identity (Midway Strip, Ring of Fire, Funhouse Frenzy already wired)
- Scores persist via SQLite; ghost replay works; achievements unlock visibly
- Haptics + spatial audio match the action
- No "mayhem halted" modal in any normal play session
- App store metadata present (icon, screenshots, description)

---

## Tasks

### Track A — Visual identity (P1, unblocks all polish)

**A1**: P1 — Replace `circus_arena_2k.hdr` with a real big-top interior HDRI.
- Current HDRI reads as a stadium with theater seats — wrong vibe.
- Acceptance: visual-matrix slice-040m shows red-striped big-top fabric overhead, not stadium rigging. User visually approves the backdrop.

**A2**: P1 — Move the camera to put the hood fully in the POV.
- Hood (polka-dot dome) renders as a pink sliver at the screen bottom; should occupy the bottom third and feel like you're INSIDE a car.
- Acceptance: visual-matrix slice-040m shows polka-dot hood filling ≥25% of frame height.

**A3**: P1 — Replace obstacle primitives (raw boxes in red/blue) with themed props.
- Carnival-themed obstacles: garbage bins, paint cans, clown shoes, streamers. Use Kenney carnival/circus pack from `/Volumes/home/assets/`.
- Acceptance: no `<boxGeometry>` + `color="#e53935"` primitive obstacles in live scene. Visual-matrix reflects themed obstacles.

**A4**: P2 — Zone visual identity per DESIGN.md.
- Midway Strip: orange track, striped tents, yellow sky. (Current baseline.)
- Balloon Alley: pink/purple sky, floating pink balloons on track.
- Ring of Fire: orange/red sky, flaming orange hoops, dark track.
- Funhouse Frenzy: mirror walls, multicolored strobing lights, distorted props.
- Acceptance: slice-120m (Midway), slice-480m (Balloon Alley entry) show distinct colorings per zone.

**A5**: P2 — Track surface material — replace flat orange shader with a tracker-pattern PBR material.
- PolyHaven PBR: wooden planks OR rubber belt OR polished concrete with painted lane lines.
- Acceptance: track surface reads as a physical surface, not an unshaded orange plane.

**A6**: P3 — Banners, ribbons, and bunting strung between tent poles as decorative ambient geometry.

### Track B — Gameplay polish (P1)

**B1**: P1 — Tutorial flow. First-run player sees a 6-step guided walk-through:
  1. Steering (left/right drag or arrow keys)
  2. Honk (tap horn → barkers wave → bonus)
  3. Balloon pickup (+1 ticket)
  4. Boost pickup (speed surge)
  5. Trick ramp (swipe up → back-flip → combo)
  6. Plunge recovery (off-track → plunge-animation → respawn)
- Acceptance: fresh profile auto-launches tutorial; after completion, normal run begins; tutorial persists as "done" in profile.

**B2**: P1 — Pause UX. Esc or P on desktop; dedicated pause button on mobile. Pause overlay shows big "PAUSED" + resume button. Time dilation froze by RunSession.paused.
- Acceptance: Esc during gameplay freezes the scene; resume continues from exact state.

**B3**: P1 — Mobile touch controls — whole-canvas horizontal-drag steering (replace virtual joystick if present). Tap top-right horn button for honk.
- Acceptance: iPhone 14 / Pixel 7 gestures: drag left/right → steering, tap horn → honks, tap pause → pauses. Playable hands-on.

**B4**: P1 — Combo crowd-bonus on honk near barker with 3+ lateral lane changes recent.
- Acceptance: honk while steering back-and-forth awards visible combo text ("CROWD +50! 2× CHAIN!").

**B5**: P2 — Trick system wiring: swipe up on ramp = back-flip; swipe double-left = left barrel roll.
- Acceptance: trick input → cockpit rotation animation → visible COMBO + Ticket bonus.

**B6**: P2 — Daily route. `?daily=1` URL flag generates same track for all players on the same date.
- Acceptance: seedPhrase derived from current date; leaderboard shows today's top scores.

**B7**: P2 — Night mode. Settings toggle → dim ambient, neon emissive lights, cool-toned HDRI.

### Track C — Audio (P1)

**C1**: P1 — Conductor wiring on first user gesture.
- Start → music fades in; zone transition → music key changes; crash → music ducks.
- Acceptance: audio starts when player clicks PLAY; zone 2 plays different phrase grammar than zone 1.

**C2**: P2 — SFX palette: honk variants (3-4 per zone for variety), balloon pop, ticket ding, trick-land whoosh, plunge swoosh, crash thud. All procedurally via Tone.js.
- Acceptance: each action has a sound; no silence during gameplay.

**C3**: P2 — Spatial audio for big-top via Tone.js 3D panner. Crowd cheers come from the correct side.

**C4**: P3 — Music stingers on milestones (first zone complete, 1000m, run clear).

### Track D — Persistence + progression (P1)

**D1**: P1 — Profile onboarding. First launch asks for player name; persists to SQLite.
- Acceptance: second launch recognizes player; scoreboard shows name.

**D2**: P1 — Scoreboard UI on title screen. Local top-10 by score.
- Acceptance: reachable from title, shows previous runs with name+score+date+difficulty.

**D3**: P1 — Achievements UI. On unlock → AchievementToast mounts for 4s. Full list reachable from title.
- Acceptance: first 5 achievements actually fire (first honk, first balloon, first zone transit, first trick, first clear).

**D4**: P2 — Ghost replay. After a run, "Watch Ghost" option shows previous-best run as a translucent car overlay.

**D5**: P2 — Ticket economy. Balloons → tickets. Tickets unlock cosmetics in a shop.
- Shop items: cockpit liveries (polka-dot colorways), horn sounds, windshield bling.
- Acceptance: balloons accumulate to tickets; shop reachable; items equippable.

### Track E — Stability + perf (P1)

**E1**: P1 — No runtime errors in 5-minute autonomous playthrough at Kazoo/Plenty difficulty.
- Acceptance: `pnpm playthrough` with `?phrase=lightning-kerosene-ferris&difficulty=plenty` runs 5 minutes without MAYHEM HALTED or uncaught throws.

**E2**: P1 — 60 FPS on iPhone 14 Pro at all zones.
- Acceptance: telemetry artifact from iPhone shows fps ≥55 p95 across a 3-minute run.

**E3**: P1 — 45 FPS on Pixel 6a (mid-tier Android).
- Acceptance: same as E2 on the Android device.

**E4**: P2 — Bundle budget. App + Three.js + Tone.js + drei under 2 MB gzipped for the critical path; remaining assets lazy-load.

**E5**: P2 — Memory profile. No leaks over a 30-minute session. World entity count stable within ±10% after zone loop.

### Track F — App store + build (P1)

**F1**: P1 — iOS build in CI + signed APK for Android. cd.yml already produces Android debug; add iOS path.

**F2**: P1 — App icon set (all required sizes) from the existing brand palette. Use the hood polka-dot + car silhouette.

**F3**: P1 — Screenshots for App Store / Play Store: 5 per platform showing cockpit, boost, trick, zone 2 transit, game-over overlay. Generate via `pnpm playthrough` + post-process.

**F4**: P2 — App description copy: tagline, genre, key features.

**F5**: P2 — Privacy policy + terms-of-use pages on a static site (required by stores).

### Track G — Documentation + polish (P2)

**G1**: P2 — Update STATE.md to reflect actual current state (post-visual-matrix fixes).

**G2**: P2 — Write TESTING.md section on visual-matrix baselines — how to re-pin, how to interpret diff failures.

**G3**: P2 — Changelog for 0.3 → 1.0 per Keep a Changelog.

**G4**: P2 — Delete dead code surfaced by the recent audit (`trackComposer.ts` and its `PieceKind` export — replaced by the archetype system but still referenced by legacy tests).

### Track H — Testing hardening (P3)

**H1**: P3 — Expand visual matrix to 4 form factors × 8 slices = 32 baselines.

**H2**: P3 — Per-archetype visual test: every archetype (straight, slight-left, hard-right, dip, climb, plunge) gets a dedicated browser test that spawns the player ON that piece and captures.

**H3**: P3 — Pixel-exact diff for Cockpit.browser.test.tsx (currently just an "exists" gate).

---

## Dependencies

- B1 (tutorial) depends on A1-A3 landing so the tutorial references the real visuals
- F1-F3 (app store) depend on A1-A5 + B1-B5 (can't ship raw primitives to the store)
- E2-E3 (perf) depend on A1-A5 (perf profile changes when assets change)
- D1-D5 can land in parallel with A/B tracks
- C1-C3 can land in parallel once A1 is done (audio doesn't need perfect visuals)

Priority order for the first phase:
1. **Unblock Track A** first — visual identity gates everything else
2. **Track B** in parallel (gameplay polish is independent of visual identity)
3. **Track C** once A1 lands
4. **Track D** anytime
5. **Track E** after A/B/C land (measure on real assets)
6. **Track F** last — app store requires polished scene
7. **Track G** ongoing
8. **Track H** nice-to-have, not 1.0-blocking

## Acceptance — the 1.0 gate

All of the following must hold to call it 1.0:

1. iOS IPA and Android APK both build in CI, pass Maestro smoke tests, open to title screen without error
2. Fresh-profile player can run the tutorial end-to-end and then complete a normal run without checking docs
3. Visual matrix at all 8 slices shows themed assets (no raw primitives, real track material, big-top HDRI, hood visible)
4. 5-minute autonomous playthrough at all 4 difficulty tiers completes with no MAYHEM HALTED
5. 60 FPS on iPhone 14 Pro; 45 FPS on mid-tier Android across a 3-minute run
6. Top-10 scoreboard + achievements unlock path both work with SQLite persistence
7. App store assets (icon, screenshots, copy, privacy) ready for submission
