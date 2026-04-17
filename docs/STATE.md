---
title: State
updated: 2026-04-17
status: current
domain: context
---

# State

Where the project stands right now. Updated as work lands.

## Shipped in 0.1.0

- Repo: `arcade-cabinet/midway-mayhem` (public, GitHub)
- Playable cockpit-POV racing inside the circus_arena HDRI big-top
- Kenney Racing Kit track pieces baked with MM brand palette
- 5 obstacle types + 3 pickup types, collision + pickup logic
- Yuka.js autonomous governor
- Hard-fail ErrorBus + ErrorModal
- Declarative asset manifest + preloader
- HUD with Bangers + Rajdhani
- Tone.js procedural audio bus
- 75 tests passing (42 node + 14 jsdom + 4 browser + 15 e2e)
- Full docs decomposition (this commit)

## In progress

- **Cockpit deep refinement pass** — see memory: `project_next_pass_cockpit.md`. The cockpit is THE hero procedural element and needs Blender-prototyped proportions, proper hood hemisphere, reflective mirror, fuzzy-dice physics-bob, working chrome gauges, honkable 3D horn. Currently placeholder-quality.

## Shipped in PR #2 (c5d1a89 on main)

- Wire-suspended **start platform** at d=0 + black-and-white **checkered finish banner** at d=distance with goal platform
- Cockpit **plunge-past-track** animation (free-fall Y curve, track stays in world-space)
- **NewRunModal** — seed phrase + 🎲 shuffle + 3×2 DOOM-style difficulty grid + permadeath toggle
- **Dual-channel deterministic PRNG** seeded by phrase hash (track channel for construction, events channel for in-run streaming)
- **Pre-baked RunPlan** — every obstacle/pickup/balloon/mirror/fire-hoop enumerated at `startRun`, baked from `trackRng`, replayed by renderers
- **Critter idle animations** via per-clone `THREE.AnimationMixer` with phase-offset so animals breathe out-of-sync
- **Optimal-path solver** — `src/game/optimalPath.ts` — powers the test factory, runtime cleanliness scoring, RacingLineGhost overlay, difficulty telemetry CLI
- **Real-keyboard governor** — dispatches ArrowLeft/ArrowRight on `window`, same path a player uses. 60 m forward perception cap.
- **GitHub Pages deploy live** at https://arcade-cabinet.github.io/midway-mayhem/
- **Android debug APK** artifact on every push to `main` via `cd.yml`; **Android release APK** attached to every release via `release.yml`
- **Persistence** — drizzle schema + sql.js + CapacitorSQLite stack, with 7 tables (profile, unlocks, loadout, daily_runs, replays, achievements, lifetime_stats)
- **Maestro native smoke scripts** — 6 Android flows committed (iOS flows staged, pending `cap add ios`)
- **Balance audit** — `pnpm audit:balance` + `pnpm audit:balance:compare <before> <after>`
- **Difficulty telemetry** — `pnpm audit:difficulty` + `docs/telemetry/difficulty-balance.json`
- **Marketing screenshot capture** — `scripts/capture-marketing.ts` with curated poses
- **Landing-page hero art** with compact phone layout + square transparent logo + balloon-style brand buttons
- **Test matrix migration** — 35 browser tests via `@vitest/browser-playwright` in the same Chromium the game ships in

## Next (TBD)

- Cockpit deep refinement pass — proportions, hood hemisphere, reflective mirror, fuzzy dice, working chrome gauges, honkable 3D horn
- Per-zone color grading + crossfades
- Title-screen 3D start sequence (currently 2D hero-art; 3D sequence still pending)
- iOS platform wiring (`pnpm exec cap add ios`) + iOS Maestro flow validation
- Split remaining oversized source files under 300 LOC (in-flight this session)

## Known issues

- Hood positioning still placeholder — being addressed in cockpit refinement pass
- Track piece connection seams visible on large corners (composer math needs refinement for non-cardinal pieces)
- No zone color grading yet — every zone looks the same (HDRI-dominated)
- Post-FX can't be disabled from user settings (per hard-fail rule; intentional)
- Bundle split into r3f-vendor / audio-vendor / ai-vendor / drizzle-orm / sql-wasm-browser / jeep-sqlite / main. Main chunk ≈ 470KB pre-gz, 143KB gz; r3f-vendor the largest at ~1.2MB / 366KB gz (drei + postprocessing).

## Performance (M1 Mac desktop)

| Metric | Value |
|---|---|
| Boot to playable | ~2s including HDRI load |
| Steady-state FPS | ~60 |
| Bundle size (gzipped) | 398 KB |
| HDRI size | 6.2 MB (2K resolution) |
| All track GLBs combined | ~160 KB |

Mobile targets: iPhone 14 Pro 45 FPS min, mid-tier Android 30 FPS min — measurements pending.

## Test matrix

```
Unit (node):     42 passing   (0.3 s)
Component (jsdom): 14 passing (0.8 s)
Browser (real Chromium WebGL): 4 passing (4 s)
E2E (Playwright desktop): 13 passing  (~70 s)
E2E (Playwright iPhone 14 Pro): 2 passing  (~15 s)
────────────────────────────────────────
Total: 75/75 tests green
```

## Runtime flags (dev + test)

- `?skip=1` — skip title
- `?governor=1` — autonomous Yuka driver
- `?diag=1` — expose window.__mm.diag() diagnostics

## Decisions log (short)

- 2026-04-16 — chose HDRI-as-world over procedural sky shader (marmalade-drops pattern; immersion win)
- 2026-04-16 — chose Kenney Racing Kit GLBs over procedural spline (user: "you don't have to do procedural if you can copy the whole kit and make it work")
- 2026-04-16 — chose baked retexture over runtime retex (user: "why are you baking retexture into the GAME versus into the MODELS in a dev script")
- 2026-04-16 — locked brand to "Midway Mayhem: Clown Car Chaos" (per ChatGPT decision)
- 2026-04-16 — locked palette + fonts + UI vocabulary (per ChatGPT final recommendation)
- 2026-04-16 — hard-fail error discipline, no fallbacks (user directive)
- 2026-04-16 — TypeScript only in src/scripts/e2e (`.py` bpy + `.sh` hook exempt)
- 2026-04-16 — camera parents into Cockpit group (solves Gemini sail-glitch permanently)
- 2026-04-16 — world scrolls past origin-fixed cockpit (solves camera-chase bugs permanently)
