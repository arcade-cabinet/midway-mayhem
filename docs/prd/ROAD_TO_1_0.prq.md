---
title: Road to 1.0 — PRQ
updated: 2026-04-20
status: current
domain: context
---

# Midway Mayhem: Road to 1.0

## Priority: HIGH

## The vision (canonical)

The Midway is **a coiled descent through a circus big-top.**

- **Start** — a wire-hung platform suspended HIGH inside the dome, near the rafters. The driver's POV looks DOWN at the track unwinding away from the cockpit.
- **Mid-run** — the track tapers and curls in a long downward spiral, threading through the dome interior. The audience tiers (the red-velvet seating already in the HDRI) flank the descent — those aren't a stadium backdrop, they're spectators watching you fall toward the floor.
- **Finish** — at the BOTTOM of the dome, on the big-top floor, a black-and-white checkered race-track-style finish line.

A player who completes a run should perceive: "I started high, I spiraled down through cheering bleachers, I landed on the circus floor."

The current build has the geometry pieces (HDRI, archetype set including `dip`/`plunge`/`climb`, StartPlatform, FinishBanner, TrackScroller). What's missing: the cumulative DESCENT bias, the elevation placement of start/finish anchors, the camera tilt that sells the falling sensation, and an audience that fills those seats.

## Already done (trim)

These earlier scope items are VERIFIED_DONE on main and removed from the queue:

| ID | What |
|----|------|
| A2 | Hood fills lower third of POV (camera y 1.55) |
| B2 | Pause UX — overlay + button + Esc/P |
| B4 | Barker-honk combo chain |
| B5d | Trick desktop (Q/E/R) — mobile swipe still pending as B5m |
| B6 | `?daily=1` opt-in URL |
| B7 | Night mode (already wired) |
| D1 | Player-name onboarding |
| D2 | Leaderboard top-10 with player name |
| D3 | Early-fire achievements + toast UX |
| D5 | Ticket economy (balloons → tickets → shop, already wired) |
| F4 | App store description + keywords |
| G1 | STATE.md current + trackComposer correction |
| G2 | TESTING.md visual-matrix workflow |
| G3 | CHANGELOG 0.3 → 1.0 polish entries |

A1 is **NOT** required — `circus_arena_2k.hdr` is the correct asset (real big-top arena interior with audience tiers). Earlier "stadium backdrop" reading was perception drift; it's the spectators.

---

## Open tasks — descent-spiral world (NEW canonical scope)

### Track A — descent geometry + audience (P1)

**A-DESC-1** P1 — *Track has net-downward elevation profile across the run.*
- **Doc:** Add a "Run elevation profile" section to `docs/ARCHITECTURE.md` describing target Y delta over `runLength=80` pieces (~30-50m total descent). Per-zone bias: zone 1 mostly flat (intro), zone 2-3 progressive descent, zone 4 steep coil to floor.
- **Test:** New `src/track/__tests__/elevationProfile.test.ts` that calls `seedTrack` with the canonical phrase, samples the cumulative Y at every piece, and asserts the cumulative descent stays monotonic non-increasing across the last 60% of the run.
- **Code:** Bias archetype weights / introduce per-zone weight overrides so `dip`/`plunge` outweigh `climb` in zones 2-4. Add a new `coil-down` archetype combining `slight-right`+`dip` if needed for zone 4.
- **Acceptance:** isolated track screenshot harness output (see A-TRACK-VIS) shows visibly tapering Y from start to finish.

**A-DESC-2** P1 — *StartPlatform is suspended high in the rafters.*
- **Doc:** `docs/DESIGN.md` updated with "Start = wire-hung gondola in the dome cap; player is in the bleachers' Y range, NOT on the floor."
- **Test:** Browser test asserts StartPlatform y is at or above sampled track-piece y at `d=0` (`startY ≥ pose(0).y`) AND at least 25m above the finish-line y.
- **Code:** Update `src/track/runPlan.ts` (or wherever startPlatform is composed) to place start at `+30m Y` relative to track piece 0; thicker visible wire struts up to dome cap (already partially modeled).
- **Acceptance:** slice-040m shows steel wires going up out of frame; player feels the height.

**A-DESC-3** P1 — *FinishBanner is at the floor with checker race-line.*
- **Doc:** Same `DESIGN.md` section — "Finish = black-and-white checker on the dome's circular floor; the run ends visibly DOWN at audience-eye-level base."
- **Test:** Browser test asserts FinishBanner y ≈ 0 (within 2m) AND the cumulative track Y at `finishBanner.d` is below start by at least 25m.
- **Code:** FinishBanner sample point clamps Y to dome-floor altitude; checker quad widened to span the full dome floor radius; checker pattern uses real B&W race-track stripes (sized so ~30 stripes wide reads as a finish line, not 8 fat squares).
- **Acceptance:** at distance ≈ runEndDistance, slice screenshot shows full B&W race-finish on a circular floor.

**A-DESC-4** P1 — *Cockpit camera pitches forward proportionally to track pitch.*
- **Doc:** `docs/ARCHITECTURE.md` "Camera rig" section adds the pitch-look-down behavior.
- **Test:** Unit test for the camera-pitch helper: `getCockpitCameraPitch(trackPitch)` returns 0 on flat track, ~0.4× the track's pitch on descent (so the camera leans into the dive but never matches it 1:1 — that would cause vertigo).
- **Code:** Add a `useCockpitDescentPitch` hook reading current track piece pitch from the diag bus; apply to the cockpit-body group.
- **Acceptance:** during a `plunge` piece, the visible hood + steering wheel rotate downward in the frame; flat sections return to neutral within 0.5s.

**A-DESC-5** P2 — *Audience fills the empty seats with simple colored crowd silhouettes.*
- **Doc:** Note in DESIGN.md — "The HDRI seats are emissive but empty; we layer thousands of low-poly crowd silhouettes on top so the audience reads as PRESENT."
- **Test:** Visual-matrix slice-120m diff shows non-trivial pixel content in the seats region (top-left + top-right of POV) compared to current empty-seat baseline.
- **Code:** New `src/render/env/Audience.tsx` — instanced-mesh crowd of ~2000 capsule silhouettes in palette colors, placed via radial sweep around the dome at `y = 5..18m`, `r = 60..120m`. Subtle wave animation (idle bob).
- **Acceptance:** screenshots feel populated — seats no longer empty.

### Track A — visual identity remaining (P1/P2)

**A-OBS** P1 (was A3) — *Replace raw box obstacles with themed props.*
- **Doc:** New `docs/assets/obstacles.md` — table mapping each ECS Obstacle.kind (`cone`, `barrier`, `gate`, `oil`, `hammer`, `critter`) to a chosen GLB from `/Volumes/home/assets/3DLowPoly` (Kenney carnival/circus pack).
- **Test:** Update visual-matrix node-side baseline diff allow-list so the obstacle palette change passes; add a unit test that every Obstacle.kind maps to a non-null asset path.
- **Code:** New `src/render/obstacles/themedAssets.tsx` — replaces the inline `<boxGeometry>` instances in TrackContent with GLB loaders. Falls back to bright magenta box if asset fails to load (loud but visible).
- **Acceptance:** visual-matrix slices show themed obstacles instead of red/blue boxes; no `<boxGeometry>` + `color="#e53935"` in the live scene.

**A-ZONE-VIS** P2 (was A4) — *Per-zone visual identity.*
- **Doc:** `docs/DESIGN.md` zone table: Midway (orange/striped tents), Balloon Alley (pink/purple sky, floating pink), Ring of Fire (orange-red sky, dark track + flaming hoops), Funhouse (mirror walls + multicolored strobing).
- **Test:** Per-zone visual-matrix gate — slices captured AT each zone center (Midway≈225m, Balloon≈675m, Ring≈1125m, Funhouse≈1575m) baseline-diff against per-zone reference PNGs.
- **Code:** Extend `src/render/env/ZoneProps.tsx` to swap ambient color, fog density, and zone-specific particle/prop layers; add the 3 missing layers.
- **Acceptance:** the 4 zone-center slices each look unmistakably distinct.

**A-TRACK-MAT** P2 (was A5) — *PBR track material.*
- **Doc:** Note in DESIGN.md — surface = "carnival wood planks" (chosen for the big-top aesthetic).
- **Test:** Visual-matrix expected delta from new material absorbed into refreshed baselines.
- **Code:** PolyHaven planks PBR (diffuse + normal + roughness) downloaded via blender MCP, mapped onto `track-surface` mesh with proper UV stretching for the long ribbon.
- **Acceptance:** track surface reads as a physical wood plank ribbon, not an unshaded orange plane.

**A-DECOR** P3 (was A6) — *Banners, ribbons, bunting strung between rafters and dome.*
- **Code:** Procedural geometry — 4-color triangle bunting strings. Quick win once A-DESC-2 places the start near the dome cap.

### Track A — isolated procedural-track screenshot package (NEW, prerequisite for A-DESC-*)

**A-TRACK-VIS** P1 — *Isolated track screenshot harness with orientation/pitch/scale debug overlays.*

This is the test instrument that makes the descent geometry tasks above measurable.

- **Doc:** `docs/TESTING.md` adds a "Track-only visual gate" section. Explains the harness, the orthographic side-view + axonometric overhead views, and the per-piece annotation render.
- **Test:** New `src/track/__tests__/TrackPackage.browser.test.tsx` — mounts JUST the procedural track (no cockpit, no obstacles, no audience) under a `Scene` harness, captures 3 fixed-camera renders:
  1. **Side elevation** — orthographic camera looking +X at the track ribbon, full run visible. Pitch + descent are visually obvious.
  2. **Top-down plan** — orthographic camera looking -Y, shows the spiral footprint.
  3. **POV at d=0** — the player's first frame.
  Annotations overlaid: per-piece archetype label, cumulative `(yaw, pitch, y)` at piece boundaries, total run length, total descent.
  Captures dumped to `.test-screenshots/track-package/{side,plan,pov}.png` + node-side baselines under `src/track/__baselines__/track-package/`.
- **Code:** A small orthographic-renderer wrapper around the existing `seedTrack` + procedural geometry. Probably 100 LOC. Keep separate from `Track.tsx` so the harness can render with debug overlays without polluting prod.
- **Acceptance:** the 3 PNGs render the canonical seed deterministically; the side-view PNG visibly shows the descent that A-DESC-1 produces; updates to archetype weights show up as visible deltas in the side-view.

**A-TRACK-VIS-ARCH** P1 (depends on A-TRACK-VIS) — *Per-archetype isolated render.*
- **Code:** Add a per-archetype variant — one PNG per archetype (`straight`, `slight-left`, `slight-right`, `hard-left`, `hard-right`, `dip`, `climb`, `plunge`, plus any new ones from A-DESC-1) showing JUST that piece in isolation, oriented so its `deltaYaw` and `deltaPitch` are obvious. Used to validate archetype changes don't break existing geometry.
- **Acceptance:** `src/track/__baselines__/archetypes/{archetype-id}.png` exists for every archetype; node diff catches regressions.

### Track B — gameplay (P1)

**B1** P1 — *Tutorial flow.* Unchanged from prior PRQ — depends on A-DESC-* + A-OBS landing so tutorial steps reference real visuals. 6 steps: steer, honk, balloon, boost, trick, plunge.

**B3** P1 — *Mobile touch controls.* Whole-canvas horizontal-drag steering; tap-top-right horn. Replaces virtual joystick.

**B5m** P2 — *Mobile trick swipe gestures.* Match desktop Q/E/R (swipe-left/right/up). Pure code; no design lift.

**B-TUTORIAL-DESCENT** P1 — *Tutorial includes a "you're falling" beat.* Step 6 explicitly previews the spiral — show the dome from outside, then drop in. Sells the descent vision before the player drives.

### Track C — audio (P1)

**C1** P1 — *Conductor wiring on first user gesture.* Music fade-in on PLAY, key change on zone transition, duck on crash. Already mostly built; needs the wire to first-gesture init.

**C-DESCENT-AMBIENCE** P1 — *Audience cheer ambient bed scaled by descent depth.* As the player descends through the dome, the crowd noise pans/swells based on how close they are to the floor. Uses Tone.Panner3D.

**C2** P2 — *SFX palette per zone* (3-4 honk variants, balloon pop, ticket ding, trick whoosh, plunge swoosh, crash thud).

**C3** P2 — *Spatial audio* — Tone.Panner3D positional crowd cheers from the actual seat regions defined by the audience layer (A-DESC-5).

**C4** P3 — *Music stingers* on first zone complete, 1000m, run clear.

### Track D — persistence + progression remaining (P2)

**D4** P2 — *Ghost replay UI.* "Watch Ghost" option after a run shows previous-best as translucent overlay car. Recorder + commit logic exist; needs UX.

### Track E — stability + perf (P1)

**E1** P1 — *5-min autonomous playthrough at Kazoo+Plenty without MAYHEM HALTED.* Uses existing governor + watches `errorBus` for halt events.

**E2** P1 — *60 FPS on iOS Simulator (iPhone 17 Pro available locally).*
- **Test:** New `e2e/perf-ios.spec.ts` — boots the iOS simulator (xcrun simctl boot), installs the IPA from F1, runs `?autoplay=1&phrase=lightning-kerosene-ferris` for 3 minutes, scrapes `__mm.diag().fps` per second, asserts p95 ≥ 55.
- **Code:** Add `pnpm perf:ios` script wrapping the simctl + Playwright iOS device flow.
- **Acceptance:** CI nightly artifact `perf-ios.json` shows p95 ≥ 55 fps for the 3-min run.

**E3** P1 — *45 FPS on Android emulator (already running locally).*
- **Test:** Mirror E2 — `e2e/perf-android.spec.ts` against `emulator-5554`. Asserts p95 ≥ 40.
- **Code:** `pnpm perf:android` wraps adb install + autoplay URL load.
- **Acceptance:** `perf-android.json` shows p95 ≥ 40 fps.

**E4** P2 — *Bundle under 2MB gzipped critical path.* Profile with `vite-bundle-visualizer`, lazy-load Tone soundfont, lazy-load PostFX shaders.

**E5** P2 — *No memory leaks over 30-min session.* Heap snapshot every 5 min via Chrome DevTools protocol.

### Track F — app store (P1)

**F1** P1 — *iOS IPA in CI + signed APK.* Requires Apple Developer cert (user blocker — deferred until creds provided). Android APK already signs in cd.yml.

**F2** P1 — *App icon set.* Procedural — polka-dot hood + car silhouette. Generate via existing brand palette in design tokens.

**F3** P1 — *5 screenshots per platform for app stores.* Generate from `pnpm playthrough` after A-OBS + A-DESC-* land. Cockpit, boost, mid-zone, trick, game-over.

**F5** P2 — *Privacy + terms* (no data collected — the game is local-only). Static pages on the GitHub Pages deploy.

### Track G — documentation (P2)

**G4** P2 — *Migrate `PieceKind` out of `trackComposer.ts`, then delete the file.* `composeTrack` and `DEFAULT_TRACK` are still referenced by 2 game-logic modules (`optimalPathScripts.ts`, `obstacles/trackToWorld.ts`); they must be migrated to the archetype API first. 14-file refactor scoped as one careful PR.

### Track H — testing hardening (P3)

**H1** P3 — *Visual matrix × 4 form factors = 32 baselines.* Adds viewport switch infra to vitest-browser.

**H2** P3 — *Per-archetype browser test* (subsumed by A-TRACK-VIS-ARCH above; keep this entry as the catch-all for any archetypes added after the descent landing).

**H3** P3 — *Pixel-exact Cockpit diff* (currently exists-only).

---

## Doc → Tests → Code ordering

Every task above follows the contract:

1. **Doc first** — write the constraint into ARCHITECTURE.md / DESIGN.md / TESTING.md / asset-mapping doc. The doc is what's reviewed — code is the implementation of an agreed contract.
2. **Tests next** — node test if pure logic; browser test if it needs render; visual-matrix slice if it needs pixels. Test fails initially.
3. **Code last** — implement until the failing test passes. Visual baselines re-pinned only when the test was already passing AND the user-visible change is intentional.

For visual-only tasks (A-DESC-*, A-OBS, A-ZONE-VIS, A-DECOR, A-DESCENT-AMBIENCE), the test step REQUIRES re-rendering the isolated track package screenshots (A-TRACK-VIS) so the diff is reviewable.

---

## Dependencies

- **A-TRACK-VIS** unblocks all A-DESC-* (you can't tune what you can't see).
- **A-DESC-1, A-DESC-2, A-DESC-3** are siblings — can land in any order once A-TRACK-VIS exists.
- **A-DESC-4** (camera pitch) depends on A-DESC-1 (need real track pitch to react to).
- **A-DESC-5** (audience) is independent — can land anytime.
- **B1** (tutorial) depends on A-DESC-* + A-OBS so tutorial visuals match shipped game.
- **C-DESCENT-AMBIENCE** depends on A-DESC-1.
- **F3** (store screenshots) depends on A-DESC-* + A-OBS + A-ZONE-VIS.

Priority lane:

1. **A-TRACK-VIS** (the instrument) — gate everything else
2. **A-DESC-1, A-DESC-2, A-DESC-3** (the descent) — core vision
3. **A-DESC-4, A-DESC-5** (the polish on the descent)
4. **A-OBS** (themed obstacles) — parallel after A-TRACK-VIS
5. **A-ZONE-VIS, A-TRACK-MAT, A-DECOR** — incremental visual fidelity
6. **B1, B3, B5m, B-TUTORIAL-DESCENT** — gameplay layer
7. **C1, C-DESCENT-AMBIENCE, C2, C3, C4** — audio
8. **D4, E1-E5, F2, F3, F5, G4, H1, H2, H3** — release prep

---

## Acceptance — the 1.0 gate

All of the following must hold to call it 1.0:

1. **Descent reads** — A-TRACK-VIS side-view PNG shows visible Y descent across the run; live POV playthrough conveys "I'm spiraling DOWN through the dome to a floor".
2. **iOS IPA + Android APK** both build in CI, pass Maestro smoke, open to title screen without error.
3. **Tutorial** — fresh-profile player runs B1 end-to-end + completes a normal run without docs.
4. **Visual matrix at 8 distance slices** — themed obstacles, real big-top, descent visible, hood prominent, audience populated.
5. **5-min autonomous playthrough** at all 4 difficulties — no MAYHEM HALTED.
6. **60 FPS on iOS sim, 45 FPS on Android emulator** for 3-min run (`perf-ios.json`, `perf-android.json` artifacts).
7. **Top-10 scoreboard + 5+ achievements** unlock through SQLite persistence.
8. **App store assets** (icon, screenshots, copy, privacy) ready for submission.
