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

## Next (order TBD with user)

- Wire-suspended start platform + NEW GAME overlay + drop transition (see `project_world_architecture.md`)
- Per-zone color grading + crossfades
- GitHub Actions: ci.yml, release.yml, cd.yml (see docs/DEPLOYMENT.md)
- GitHub Pages deploy
- Capacitor sync + Android debug APK build
- Persistence: drizzle schema + sql.js + CapacitorSQLite (grailguard pattern)
- Maestro native smoke scripts
- Balance-audit TS script (N autonomous runs, collect stats per commit)
- Marketing screenshot capture script (12 curated poses)
- Title-screen 3D start sequence (replace 2D polka-dot title)

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
