---
title: Gap Analysis — Master Action Plan
updated: 2026-04-18
status: current
domain: context
---

# Midway Mayhem — Master Action Plan

Derived from three parallel audits ([features](features.md), [docs](docs.md),
[code-quality](code-quality.md)) post PR #21 + #22 merge.

## The headline finding

**PR #21 landed ~3000 LOC of dark code**: `ObstacleSystem`, `PickupSystem`,
`WorldScroller`, `BalloonLayer`, `MirrorLayer`, `FireHoopGate`, `RaidLayer`,
`BarkerCrowd`, `StartPlatform`, `FinishBanner`, `RacingLineGhost`,
`useGameSystems`, `conductor.ts`, `src/game/obstacles/*`, `src/track/trackComposer.ts`
all compile but nothing imports them. The live App.tsx still runs the simpler
pre-port render stack.

**Decisions made (autonomously, per the "nothing is out of scope" mandate):**

1. **Track pipeline**: keep live procedural `Track.tsx` (working, tested).
   Delete orphan `trackComposer.ts` + `src/render/track/TrackSystem.tsx`.
2. **Critters**: ship. Source GLBs from assets-library MCP or Kenney directly.
3. **RunPlan**: make canonical. Replace live `seedContent` with RunPlan-driven spawns.
4. **Raids**: wire. Core vision beat, fully implemented.
5. **Balloon economy**: balloon pickup = +1 ticket (rename behavior, keep ECS kind).

## Execution tracks

### Track A — P0 ship-blockers (this pass)

| # | Task | Owner | Effort | Report ref |
|---|------|-------|--------|-----------|
| A1 | Balloon pickup awards ticket (profile.addTickets) | me | Trivial | features #1 |
| A2 | Fix silent `.catch(() => {})` swallowers (useLoadout, TicketShop equip, usePrefersReducedMotion) | me | Trivial | code-quality #20/21/23 |
| A3 | Fix release.yml unsigned-APK silent fallback (`assembleRelease \|\| assembleDebug`) | me | Trivial | code-quality #31 |
| A4 | release-please GitHub Actions PR permission — flag to user (repo setting, not code) | flag | N/A | code-quality #32 |
| A5 | Delete 2 stale root-level files (ChatGPT/Gemini convo dumps) + gitignore | me | Trivial | docs §5 |

### Track B — Missing docs (this pass, parallel)

Single agent writes all 6 required domain docs + fixes AGENTS.md + CLAUDE.md staleness + creates the two missing AI-tool configs.

- docs/ARCHITECTURE.md
- docs/DESIGN.md
- docs/TESTING.md
- docs/DEPLOYMENT.md
- docs/LORE.md
- docs/STATE.md
- Fix AGENTS.md (asset pipeline, ECS status, `src/systems` path)
- Fix CLAUDE.md (audio section, `src/` layout listing)
- Create `.github/copilot-instructions.md` (ref CLAUDE.md + AGENTS.md)
- Create `.cursor/rules` (same)

### Track C — Wire or cut the orphan code (next pass)

This is the biggest scope item and needs a dedicated PR. Tracked as follow-up task.

- C1: RunPlan canonical path — replace `seedContent` with `buildRunPlan` → stream into ECS
- C2: Wire `ObstacleSystem` + `PickupSystem` (or keep `TrackContent` but use Kenney GLBs) — decide one
- C3: Wire `StartPlatform` + `FinishBanner`
- C4: Wire `RaidDirector` into `GameLoop`
- C5: Wire `BalloonLayer` / `MirrorLayer` / `FireHoopGate` gated by zone
- C6: Wire `conductor` music on run start
- C7: Wire `BarkerCrowd` for midway ambience
- C8: Wire `replayRecorder`
- C9: Wire `RacingLineGhost` in cockpit
- C10: Delete `trackComposer.ts` + `render/track/TrackSystem.tsx` (we're keeping live)

### Track D — Gameplay polish (next pass after Track C)

- D1: Mouse-X continuous steering (desktop)
- D2: Whole-canvas drag for mobile (replace TouchControls virtual joystick)
- D3: Pause binding (Esc/P + mobile pause button)
- D4: Plunge trigger detection when off-track
- D5: Near-miss detection + crowd bonus
- D6: Trick system: ramp-detect + touch-swipe recognizer
- D7: Night-mode toggle in SettingsPanel
- D8: Combo `registerEvent('pickup')` on every collision
- D9: Daily-route boot path (`?daily=1`)
- D10: Zone-aware spawn weighting + sky crossfade

### Track E — Code quality cleanup (ongoing)

- E1: Move `constants.ts` TRACK/HONK/STEER blocks into tunables.json
- E2: Move `obstacleSpawner.ts` SPAWN/ZONE_WEIGHTS into tunables.json
- E3: Replace `@vitest/browser/context` with `vitest/browser` in 6 test files
- E4: Trim `seed-playthroughs.spec.ts` to 3 seeds + add nightly-full variant
- E5: Fix gameState.ts 788-LOC 5-responsibility god-module (defer; risky)
- E6: Lighthouse/frametime/jsdom shim scripts → real runners or delete

## Operating mode

- Track A + Track B run **in this session, in parallel**. Separate commits.
- Track C is a **separate follow-up PR** (too large + risky for same PR).
- Tracks D + E queued as tasks.

## Success criteria

- 3 reports (features.md, docs.md, code-quality.md) land on main with PLAN.md
- Track A merged as one small PR
- Track B merged as one docs PR
- Open Issues/tasks created for each Track C/D/E item so work doesn't get lost
