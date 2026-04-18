---
title: Feature Gap Analysis
updated: 2026-04-18
status: current
domain: quality
---

# Midway Mayhem — Feature Gap Analysis

**Branch analyzed:** `main` (post PR #21 + #22 merge)
**Comparison basis:** `CLAUDE.md` (project), `Gemini-Conversation.md` (visual vision),
`ChatGPT-Clown_Car_3D_Prototype.md` (full gameplay spec).

---

## Executive Summary

The codebase is a **large, mostly-built game that is not wired together**. The reference
port (PR #21) imported essentially every subsystem into `src/` — obstacle/pickup rendering
with Kenney GLBs, run plan baker, raid director, balloon layer, mirror rooms, fire hoops,
start/finish platforms, ticket shop, achievements, daily route, replay recorder, procedural
audio conductor — but the live game in `src/app/App.tsx` still runs an **older, simpler
render stack** (`Track.tsx` + `TrackContent.tsx`) that uses primitive cones/barriers/
balloons and ignores the RunPlan baker entirely.

**Top findings:**

1. **`ObstacleSystem`, `PickupSystem`, `WorldScroller`, `BalloonLayer`, `MirrorLayer`,
   `FireHoopGate`, `RaidLayer`, `BarkerCrowd`, `StartPlatform`, `FinishBanner`,
   `ZoneProps`, `RacingLineGhost`, `useGameSystems`, and the entire
   `src/game/obstacles/*` pipeline are orphaned** — nothing imports them.
2. **Kenney GLB track pieces and obstacle models referenced in code do not exist on
   disk** (`/models/*.glb`, `/textures/*` chrome/hood/track are present but
   `public/models/` is missing entirely).
3. **Input is not per the vision.** Vision = mouse-X / continuous touch-drag;
   implementation = virtual joystick (mobile) + discrete keyboard (desktop).
4. **Zone progression is decorative only.** Zone entities are seeded and banners render,
   but spawn weighting, materials, audio, and obstacle mix do not differ by zone in the
   live path.
5. **Several "complete" systems (raids, barker crowd, ghost car playback, tricks
   pipeline) have no e2e or visual coverage** and aren't mounted in App.

---

## 1. Cockpit & Camera

**Status: COMPLETE**

* `src/render/cockpit/Cockpit.tsx` — renders the polka-dot dashboard, purple pillars,
  yellow windshield arch, steering wheel, hood, ornament.
* `src/render/cockpit/CockpitSteeringWheel.tsx`, `CockpitHood.tsx`, `DiegeticHUD.tsx`,
  `SpeedFX.tsx`, `ExplosionFX.tsx`, `CockpitDamageFX.tsx`, `useCockpitAnimation.ts`,
  `plungeMotion.ts`, `useFormFactor.ts` — all wired through `Cockpit`.
* Fixed horizontal FOV (88°) per vision, vFov derived from aspect → responsive scaling works.
* `RacingLineGhost.tsx` exists but is not imported by `Cockpit` (orphan).

**Gaps vs vision:** none material. Identity signatures (polka-dots, purple pillars, yellow
arch, red bench, chrome wheel, honkable horn, spinning flower) all present.

**Priority / Effort:** N/A (P2 — wire `RacingLineGhost`, trivial).

---

## 2. Track Generation & Geometry

**Status: PARTIAL**

**What's there:**

* `src/ecs/systems/track.ts` — deterministic archetype-weighted generator writing
  `TrackSegment` entities, spawned at boot in `App.tsx:49`.
* `src/config/archetypes/track-pieces.json` — piece archetypes with yaw/pitch/bank/length.
* `src/render/Track.tsx` — renders segments to procedural BufferGeometry
  (surface + underside + walls + lane stripes + rumble curbs). Large, careful,
  well-tested (`Track.browser.test.tsx`, `TrackSegment.browser.test.tsx`).
* `src/track/trackComposer.ts` — Kenney racing-kit piece composer (**completely
  orphaned**; not imported by the live App).
* `src/track/dailyRoute.ts` — daily-seed derivation + `permuteTrackWithRng` — exists but
  `isDailyRoute()` flag is never consulted by `App.tsx`.
* `src/render/track/TrackSystem.tsx`, `StartPlatform.tsx`, `FinishBanner.tsx` — all
  orphaned. Nothing in the live tree uses them.

**Gaps vs vision:**

* **No start platform.** Vision: "wire-hung platform above the track, clicking drops
  you onto it." Implementation: player spawns already on track. `StartPlatform.tsx`
  is written but not rendered.
* **No finish banner.** Vision: checkered banner past a goal platform. `FinishBanner.tsx`
  exists, unused. `stepGameOver` uses a numeric distance threshold with no visible banner.
* **No banking shader / sweeping drop-off.** Track shader is flat-shaded MeshStandard;
  the "Hot Wheels plunge" visual from the Gemini conversation is approximated by pitch
  archetypes alone — it does not read as a dramatic descent.
* **RunPlan not used.** `buildRunPlan()` is invoked in `startRun` (gameState.ts:343) but
  the live `Track.tsx` + `TrackContent.tsx` pair renders from `seedContent` / ECS traits,
  not from `plan.obstacles / plan.pickups / plan.balloons / plan.mirrorRooms / plan.fireHoops`.

**Priority / Effort:**

* **P0 / Medium** — Wire `StartPlatform` + `FinishBanner` into App scene graph, gate
  `startRun` on click of platform.
* **P1 / Medium** — Decide: commit to procedural-generation path (current `Track.tsx`) or
  Kenney-kit composer path (`trackComposer.ts` + `TrackSystem.tsx`). Delete the loser.
* **P1 / Large** — Route obstacles/pickups/balloons through `RunPlan` OR delete RunPlan.
* **P2 / Medium** — Implement the "drop-off" track curvature shader vision describes.

**Concrete tasks:**
1. Add `<StartPlatform />` above player spawn; attach pointer handler that triggers
   `startRun`; remove the title-screen `onStart` branch that calls `startRun` directly.
2. Render `<FinishBanner distance={plan.finishBanner.d} />` and replace the distance
   bound in `gameOver.ts:40` with `pos.distance > plan.finishBanner.d`.
3. Pick track pipeline: if keeping procedural, delete `src/track/trackComposer.ts`,
   `src/render/track/TrackSystem.tsx`, and the kenney-kit `/models/*.glb` references.

---

## 3. Obstacles

**Status: STUB (live path) / COMPLETE (orphaned path)**

**Live path (wired in App):**
`src/render/TrackContent.tsx` renders five inline kinds — `cone`, `oil`, `barrier`, `gate`,
`hammer` — as primitive `mesh` trees. No critters, no animations, no telegraphing, no
hammer swing, no oil-slick slip mechanic visual, no near-miss detection.

**Orphan path (fully built, unused):**
`src/render/obstacles/ObstacleSystem.tsx` — Kenney GLB-based (barrierRed, cone, pylon,
barrierWall, critter_cow/horse/llama/pig). Consumes `runPlan.obstacles` with flee-on-honk,
near-miss detection, crowd bonus on scare, animation clips for critters. The entire
`src/game/obstacles/*` pipeline (`obstacleSpawner`, `critterPool`, `useObstacleFrame`,
`raidDirector`, `mirrorDuplicator`, `balloonSpawner`) backs it.

**Gaps vs vision (of the live path):**

* **No critters at all** in the live game — vision and `HowToPlayPanel.tsx` explicitly
  describe cow/horse/llama/pig scares as core gameplay.
* **No hammer swing animation.** Hammer is a static box.
* **No telegraphing.** Vision spec: "every obstacle MUST be readable — glow, color cues,
  animation." Only gate has emissive yellow; others have flat colors.
* **No near-miss bonus.** `useObstacleFrame` has a `nearMissFiredIds` path, but not in
  the live `collisions.ts`.
* **Cone/Barrier GLB assets missing on disk.** `/public/models/` does not exist — any
  attempt to wire `ObstacleSystem` would immediately hit a 404 and hard-fail per the
  "no fallbacks" rule.

**Priority / Effort:**

* **P0 / Large** — Critter system ships or cuts. If ships: supply the 4 GLBs into
  `public/models/`, wire `ObstacleSystem` into App, retire `TrackContent.tsx`'s obstacle
  branch. If cut: strip `src/game/obstacles/critterPool.ts`, `CritterKind` references,
  honk-scare logic, and the CRITTER achievements.
* **P1 / Medium** — Hammer swing animation (timed sine sweep in `useObstacleFrame` or
  inline in `TrackContent.tsx`).
* **P1 / Small** — Near-miss detection + crowd bonus in `collisions.ts` (copy-paste
  from `useObstacleFrame.ts`).
* **P1 / Medium** — Obstacle telegraph pass: emissive stripes on barriers, rotating
  warning ring on oil, glowing swing arc on hammer.

**Concrete tasks:**
1. Decide obstacles path (see Track #2 above). Both can't coexist.
2. Ship `public/models/` with Kenney Racing Kit pieces (see `scripts/bake-kit.py` which
   is referenced but may also be missing).
3. Port near-miss detection (nearMissLateral=0.7, nearMissDist=3 per tunables.json) into
   live `collisions.ts`.

---

## 4. Pickups

**Status: PARTIAL**

**What's there:**

* Three types per vision: `balloon` (score +100), `boost` (2.5s), `mega` (3.5s) —
  collision resolved in `src/ecs/systems/collisions.ts:87-102`.
* Rendered as primitive meshes in `TrackContent.tsx:174-242`.
* Spawned deterministically by `seedContent.ts` (live path) **or** baked into `runPlan`
  (orphan path).
* Boost / mega speed override in `collisions.ts:107-111` — simple 1.6× cruise multiplier.

**Gaps vs vision:**

* **"Boost Ring" visual missing.** Vision: spinning/glowing ring. Implementation: flat
  plane. `PickupSystem.tsx` has a proper TorusGeometry boost ring (orphaned).
* **"Ticket" currency vs "balloon" ambiguity.** Vision + shop catalog use *tickets* as
  currency; live pickup kind is `balloon`. Shop + profile persistence uses `ticketsThisRun`
  counter on `RunCounters`, but `applyPickup(kind === 'balloon')` does not increment
  tickets. (Cross-check `gameStateCombat.ts`.)
* **No mega rarity differentiation.** `seedContent.ts` picks mega 1/8 vs 5/8 balloons
  vs 2/8 boosts — doesn't match tunables "rarer than boost" flavor text.

**Priority / Effort:**

* **P0 / Small** — Align terminology: rename `balloon` pickup to `ticket` OR increment
  `ticketsThisRun` on balloon pickup. Without this, shop economy has no inflow.
* **P1 / Small** — Swap boost plane for torus ring geometry (port from orphan
  `PickupSystem.tsx`).
* **P2 / Trivial** — Adjust pickup weighting in `seedContent.ts` to match vision.

---

## 5. Balloons

**Status: PARTIAL**

`TrackContent.tsx:58-86` renders bobbing balloons from `Pickup` entities with kind
`balloon`. That is scoring balloons only, not *the balloon alley aesthetic*.

`src/render/obstacles/BalloonLayer.tsx` (orphan, 163 LOC) + `src/game/obstacles/balloonSpawner.ts`
implement the full vision: balloon clusters drifting across the track, popping on contact,
tied to `runPlan.balloons` with color + drift + duration. **Not wired.**

**Priority / Effort: P1 / Medium** — Wire `BalloonLayer` into `App.tsx` or port its core
to the live path. Needed for "Balloon Alley" zone identity.

---

## 6. Mirror Rooms

**Status: MISSING (live) / COMPLETE (orphan)**

`src/render/obstacles/MirrorLayer.tsx` (156 LOC) + `src/game/obstacles/mirrorDuplicator.ts`
build the funhouse-frenzy phantom-duplicator. The spec is in `runPlan.mirrorRooms`. Not
imported by App. Funhouse Frenzy zone currently just recolors the sky.

**Priority / Effort: P1 / Medium** — Wire `MirrorLayer`. Core to Funhouse Frenzy zone
identity.

---

## 7. Fire Hoops (Ring of Fire zone gimmick)

**Status: MISSING (live) / COMPLETE (orphan)**

`src/render/obstacles/FireHoopGate.tsx` (201 LOC) + `runPlan.fireHoops`. The Ring of Fire
zone currently exists only as a sky-tint + fog. Not wired.

**Priority / Effort: P1 / Medium** — Wire `FireHoopGate`. Signature zone gimmick called
out explicitly in the Gemini vision ("glowing, emissive fiery hoops to jump through").

---

## 8. Raid Director (boss-like beats)

**Status: MISSING (live) / COMPLETE (orphan)**

`src/game/obstacles/raidDirector.ts` + `src/render/obstacles/RaidLayer.tsx` +
`src/ui/hud/RaidTelegraphBanner.tsx`. Handles tiger leap, knife throw, cannonball
trajectory on a 30-45s cooldown with 2s telegraph. Tunables in `tunables.json:31-54`.
**None of this runs** — `RaidLayer` not mounted; `RaidTelegraphBanner` is mounted
inside `HUD.tsx:91` but the director writing to it is never started (happens inside
`useGameSystems`, also orphaned).

**Priority / Effort: P1 / Large** — Either ship raids (wire `useGameSystems`, mount
`RaidLayer`, create telegraph art) or cut entirely (remove tunables block, banner,
director code).

---

## 9. Barker Crowd / Midway Ambience

**Status: MISSING (live) / COMPLETE (orphan)**

`src/render/obstacles/BarkerCrowd.tsx` (189 LOC) — crowd silhouettes lining the track.
Not wired. Also `src/render/env/ZoneProps.tsx` for zone-specific props.

**Priority / Effort: P2 / Medium.** Visual polish. Ship or cut.

---

## 10. Ghost Car (self-competitive)

**Status: PARTIAL**

* Recording: `src/game/ghost.ts` — active, samples every 100ms, persists to localStorage
  on run end. Wired via `stepGhostRecorder` in `GameLoop.tsx:37`.
* Rendering: `src/render/obstacles/GhostCar.tsx` — mounted in `App.tsx:109`. Good.
* Playback scaling: single best-ghost only, no per-seed ghost memory.

**Gaps:** works end-to-end, but visuals are a simple translucent mesh; vision implies
a "second clown car" persona. Minor.

**Priority / Effort: P2 / Small.**

---

## 11. Tricks / Airborne

**Status: PARTIAL**

* `src/game/trickSystem.ts` — full sequence recognizer (BARREL_ROLL, WHEELIE, HANDSTAND,
  SPIN_180) with tunable durations (`tunables.json:56-64`). Pure logic.
* `src/ui/hud/TrickOverlay.tsx` mounted in HUD.
* **Input wiring missing.** `useKeyboard.ts` doesn't call `trickSystem.pushInput` on
  arrow keys. `TouchControls.tsx` has no swipe gesture recognizer. Comment in
  `trickSystem.ts:11-19` is explicit: mobile swipe required, keyboard is just a fallback.
* **Ramp/airborne trigger missing.** `TrickState.airborne` is a trait but nothing in
  the live path sets it — there's no "you just hit a ramp" detection in `playerMotion.ts`
  or `collisions.ts`.
* Animation: `setTrickState(active, rotY, rotZ)` is defined but never called.

**Priority / Effort:**

* **P1 / Medium** — Wire ramp detection: when player distance crosses a
  `ramp`/`rampLong`/`rampLongCurved` piece archetype, set airborne=true for `zRise/2`
  seconds.
* **P1 / Medium** — Add touch-swipe recognizer in `TouchControls.tsx` calling
  `trickSystem.pushInput`.
* **P2 / Small** — Keyboard fallback: arrow-up-up etc while airborne.

---

## 12. Combo System / Multiplier

**Status: COMPLETE (logic)**

* `src/game/comboSystem.ts` — clean chain tracker, registers events (`pickup`,
  `scare`, `nearMiss`), thresholds from tunables.
* `src/ui/hud/useComboMultiplier.ts` + `RacingLineMeter.tsx` — surfaces the multiplier.
* Integrated into `collisions.ts:114` and honk/scare path in `ObstacleSystem` (orphan).

**Gap:** In the live path, `combo.registerEvent('pickup')` is NOT called when
`collisions.ts:87` awards a pickup, so the multiplier only climbs from `cleanSeconds`
drift. Mega and ticket pickups should chain.

**Priority / Effort: P1 / Trivial** — One-line addition in `collisions.ts`.

---

## 13. Damage Levels

**Status: COMPLETE**

* `src/game/damageLevel.ts` — 4-tier mapping from sanity → [0–3].
* `src/render/cockpit/CockpitDamageFX.tsx` — renders smudge/smoke/sparks per level.
* Game-over at damage >= 3 via `gameOver.ts:35`. Vision: "multicolor clown explosion"
  on 0 sanity; implementation: simple overlay. `ExplosionFX.tsx` exists and may already
  cover this.

**Priority / Effort:** none material. Verify explosion fires on `EndReason === 'damage'`.

---

## 14. Plunge / Midway Meltdown

**Status: PARTIAL**

* Trait + state machine: `PlungeState`, `plungeMotion.ts`, `DropIntro`, `plunge.test.ts`.
* Banner: `HUD.tsx:88` shows "MIDWAY MELTDOWN" when plunging.
* **Trigger missing.** No code in the live path sets `plunging=true` when the player
  exceeds lateral clamp on a rail-free piece. The vision states this is a "drive off a
  rail-free ramp" end state but `playerMotion.ts:52-53` simply clamps lateral.

**Priority / Effort: P1 / Small** — Detect lateral > clamp && current piece has no
rails; set PlungeState.plunging.

---

## 15. Zones

**Status: STUB**

* Themes defined: `src/track/zoneSystem.ts` — 4 zones with sky/fog/accent.
* Banners: `src/render/ZoneBanners.tsx` mounted in App. `src/ui/hud/ZoneBanner.tsx`
  in HUD.
* **Live zone gameplay differences: none.** `seedContent.ts` doesn't take zone into
  account. Sky/fog don't apply per-zone (the live `Environment.tsx` uses one HDRI).

**Priority / Effort:**

* **P1 / Medium** — Zone-aware obstacle weighting (Ring of Fire spawns more hoops,
  Balloon Alley spawns more balloons, etc.).
* **P1 / Medium** — Drive `SkyDome.tsx` colors from `themeFor(currentZone)` per-frame
  OR crossfade envmap.
* **P2 / Small** — Zone-entry banner animation polish.

---

## 16. Input

**Status: DIVERGENT from vision**

**Vision (explicit from ChatGPT prompt, lines 1106-1123):**
* Desktop: mouse X position maps to continuous steering.
* Mobile: touch drag for continuous steering.
* NOT keyboard-steering, NOT discrete lanes.

**Implementation:**
* Desktop: `useKeyboard.ts` — discrete arrow keys / WASD, `steer = -1|0|+1`.
* Mobile: `TouchControls.tsx` — virtual joystick (still continuous, but dedicated UI
  widget, not whole-canvas drag).
* No mouse-X handler anywhere.

**Priority / Effort:**

* **P1 / Small** — Add `useMouseSteer` hook that reads pointer X on canvas, normalises
  to viewport half-width, writes `Steer.value`.
* **P2 / Medium** — Replace joystick with whole-canvas drag per vision. Joystick is
  arguably more discoverable; may warrant a design decision before porting.

---

## 17. Audio

**Status: COMPLETE (arcadeAudio) / PARTIAL (conductor)**

* `src/audio/arcadeAudio.ts` — engine growl, honk, tire squeal, pickup ding, hit thud,
  wind. Wired via `useArcadeAudio` → `AudioBridge` in App.
* `src/audio/conductor.ts` (80+ LOC) — procedural circus music with calliope + tuba +
  zone-keyed phrases. References `getBuses()`. **Not started by App.tsx.** `useGameSystems`
  (orphan) was supposed to call it.
* `src/audio/sf2.ts` (GeneralUser GS soundfont), `sfx.ts`, `tireSqueal.ts`,
  `honkBus.ts` — exist.

**Gaps:** conductor never plays. No background music in live game. Engine-only soundscape
does not match "controlled chaos + carnival energy" brand pillar.

**Priority / Effort: P1 / Small** — Instantiate `circusConductor`, call `init` in
`AudioBridge`, call `setZone(currentZone)` on zone change.

---

## 18. Ticket Economy & Unlocks Shop

**Status: COMPLETE (UI + persistence) / BROKEN (economy)**

* `src/ui/panels/TicketShop.tsx` — full 3-tab modal (palettes/ornaments/horns), focus
  management, esc-to-close.
* `src/config/shopCatalog.ts` (296 LOC) — all catalog entries with costs, starter
  flag, preview data.
* `src/persistence/profile.ts` — `hasUnlock`, `purchaseUnlock`, ticket spending.
* `src/hooks/useLoadout.ts` — reactive loadout cache.

**Gaps:**
* **No ticket inflow in live gameplay.** Pickups granted as `balloon` don't add to
  `ticketsThisRun` or to the lifetime tickets balance. (See #4.)
* **Loadout applied?** Need to verify `Cockpit.tsx` reads palette/ornament/horn slug
  from `useLoadoutStore`.
* **Persistence path: SQLite (sql-wasm.wasm ships).** That's sound but means mobile uses
  `@capacitor-community/sqlite` — no test ensures the loadout survives app relaunch.

**Priority / Effort:**

* **P0 / Trivial** — Fix ticket inflow (add to `applyPickupAction`).
* **P1 / Small** — Verify cockpit honors loadout; add a visual regression test.

---

## 19. Daily Route

**Status: STUB**

* `src/track/dailyRoute.ts` — `getDailySeed`, `isDailyRoute`, `permuteTrackWithRng`.
* `src/persistence/schema.ts` — `dailyRuns` table likely exists.
* **Not invoked.** `App.tsx:49` hardcodes `seedTrack(world, 42)` at module load.
  `isDailyRoute()` is never read, `?practice=1` flag never acted on.
* No leaderboard pulling daily runs — `Leaderboard.tsx` exists but not audited here.

**Priority / Effort: P1 / Small** — Derive boot seed from `getDailySeed()` unless
`?practice=1` and a `NewRunConfig` phrase is supplied.

---

## 20. Achievements

**Status: COMPLETE**

* Catalog: `src/persistence/achievementCatalog.ts` (~20 achievements) with predicates.
* Granting: `src/game/achievementRun.ts` steps per-frame; `stepAchievements` called
  in `GameLoop.tsx:38`.
* UI: `src/ui/AchievementToasts.tsx` mounted in App; `src/ui/panels/AchievementsPanel.tsx`
  for the panel view; `src/ui/hud/AchievementToast.tsx` for transient.

**Gaps:** Depends on features that don't run live — e.g. any "scare N critters"
achievement can never grant because critters aren't implemented in live path.

**Priority / Effort: P1 / Medium** — Audit catalog against the list of features that
actually ship; remove or guard unreachable achievements.

---

## 21. Settings / Preferences / Pause

**Status: PARTIAL**

* `src/ui/panels/SettingsPanel.tsx` + `src/persistence/preferences.ts` + `settings.ts`.
* Pause state trait is present, `pause()`/`resume()` functions exist in `gameState.ts`.
* **No pause button / escape key binding in live path.** `useKeyboard.ts` handles
  arrow keys + space only.

**Priority / Effort: P1 / Small** — Bind `Escape`/`P` to pause; add mobile pause button.

---

## 22. Replay Recorder

**Status: COMPLETE (not wired)**

`src/game/replayRecorder.ts` + `src/persistence/replay.ts` are built. `useGameSystems`
(orphan) was supposed to call `startRecording`/`sampleFrame`/`finishAndMaybeSave`.
Neither runs in live game.

**Priority / Effort: P1 / Medium** — Wire recorder into `GameLoop.tsx` alongside
ghost recorder; surface replay playback in Stats panel.

---

## 23. Title / Menu / NewRunModal

**Status: COMPLETE**

Clean, thorough implementation:
* `src/ui/title/TitleScreen.tsx`, compact/hero layouts, `NewRunModal.tsx` with seed
  phrase + difficulty tiles + permadeath toggle.
* `SeedPhraseField.tsx` — integrates `src/utils/seedPhrase.ts` dual-channel RNG.
* `src/ui/panels/*` — Stats, Credits, HowToPlay, Leaderboard, Achievements,
  Photo Mode, Settings.

No gaps.

---

## 24. Tutorial

**Status: UNKNOWN**

`src/persistence/tutorial.ts` exists with tests. UI surface not found in live App.
May be implicitly covered by `HowToPlayPanel.tsx`. **Verify whether first-time-user
flow exists.**

**Priority / Effort: P2 / Small** — Audit.

---

## 25. Night Mode

**Status: PARTIAL**

* `?night=1` URL flag → `isNightFromUrl()` → passed to `BigTopEnvironment`.
* `BigTopEnvironment` adjusts ground tint + background.
* **No UI toggle.** Settings panel doesn't expose it.

**Priority / Effort: P2 / Trivial** — Add toggle to `SettingsPanel`.

---

## 26. Photo Mode

**Status: COMPLETE**

`src/ui/panels/PhotoMode.tsx` + `photoUtils.ts` + `PhotoMode` trait + gameover overlay
suppression (HUD.tsx:93). Looks complete.

---

## 27. Assets (public/)

**Status: PARTIAL**

| Bucket | Present | Missing |
|---|---|---|
| HDRI | `circus_arena_2k.hdr` | — |
| Fonts | Bangers 400 + Rajdhani 300/400/500/600/700 | — |
| Textures | chrome + hood + track (color/normal/rough) | — |
| UI art | background-landing.png, logo-transparent-square.png | — |
| **Models** | **none** | **All Kenney Racing Kit GLBs** referenced in
  `ObstacleSystem.tsx:37-44`: barrierRed, barrierWall, cone, pylon,
  critter_cow/horse/llama/pig. |
| Audio | `sql-wasm.wasm` only (no sf2 soundfonts) | GeneralUser GS (.sf2) referenced
  in `audio/sf2.ts` — but since conductor is unwired, this may be fine for ship. |

**Priority / Effort:**

* **P0 / Medium** (if keeping critters) — bake + ship Kenney GLBs. The repo has
  `scripts/bake-kit.py` referenced but the `scripts/` dir inventory was not probed.
* **P0 / Trivial** (if cutting critters) — delete the GLB imports in `ObstacleSystem.tsx`.

---

## 28. Test Coverage — e2e & Maestro

**What exists (`e2e/`):**
* `_factory.ts`, `determinism.spec.ts`, `governor-playthrough.spec.ts`,
  `mobile-gameplay.spec.ts`, `seed-playthroughs.spec.ts`, `visual-regression.spec.ts`.
* Snapshots: `e2e/__screenshots__/visual-regression.spec.ts/` exists (not enumerated).

**What exists (`maestro/`):**
9 flows — smoke, gameplay-30s, pause-resume, game-over, title-panels, hud-visible,
critter-scare, ramp-trick, touch-steering.

**Gaps — features with NO coverage:**

| Feature | Node test | Browser test | e2e spec | Maestro |
|---|---|---|---|---|
| RunPlan baker | `runPlan.test.ts`? unverified | — | — | — |
| Raid director | `raidDirector.test.ts` ✓ | — | — | — |
| MirrorLayer | — | — | — | — |
| FireHoopGate | — | — | — | — |
| BalloonLayer | — | — | — | — |
| BarkerCrowd | — | — | — | — |
| Tricks — input wiring | — | — | — | flow exists but feature unwired |
| Critter scare | — | — | — | flow exists but feature unwired |
| Ghost car playback | — | — | — | — |
| Ticket economy inflow | profile tests ✓ | — | — | — |
| Shop equip → cockpit | — | — | — | — |
| Daily route seed | — | — | — | — |
| Pause/resume | — | — | — | ✓ |
| Night mode | — | — | — | — |
| Zone material change | — | — | — | — |
| Plunge | `plunge.test.ts` ✓ | — | — | — |

**Maestro flows reference unimplemented features:**
`android-critter-scare.yaml` and `android-ramp-trick.yaml` exist but those features
aren't wired in the live path — these flows are either failing silently or hitting
`<LiveRegion>` fallback strings.

**Priority / Effort:**

* **P0 / Medium** — For any P0/P1 fix above, add a coverage test before merging.
* **P1 / Small** — Delete or skip Maestro flows covering unimplemented features.

---

## Prioritized Backlog (Summary)

| # | P | Effort | Task |
|---|---|---|---|
| 1 | P0 | Trivial | Fix ticket economy — award tickets on balloon/pickup in `applyPickupAction` |
| 2 | P0 | Medium | Decide: ship vs cut critters. If ship, supply GLBs + wire `ObstacleSystem`. If cut, delete orphan code. |
| 3 | P0 | Medium | Start platform + finish banner wiring |
| 4 | P0 | Medium | Delete orphan track/obstacle pipeline OR wire it and delete the live path — one tree only |
| 5 | P1 | Trivial | Call `combo.registerEvent('pickup')` on every pickup collision |
| 6 | P1 | Small | Wire conductor music |
| 7 | P1 | Small | Daily route seed boot path |
| 8 | P1 | Small | Plunge trigger detection |
| 9 | P1 | Small | Near-miss detection + crowd bonus in live path |
| 10 | P1 | Small | Pause binding (Esc/P + mobile button) |
| 11 | P1 | Small | Mouse-X continuous steering (desktop) |
| 12 | P1 | Medium | Wire `BalloonLayer` — Balloon Alley zone identity |
| 13 | P1 | Medium | Wire `MirrorLayer` — Funhouse Frenzy identity |
| 14 | P1 | Medium | Wire `FireHoopGate` — Ring of Fire identity |
| 15 | P1 | Medium | Trick system: ramp-detect + touch-swipe recognizer |
| 16 | P1 | Medium | Zone-aware obstacle weighting + sky crossfade |
| 17 | P1 | Medium | Audit achievement catalog — remove unreachable entries |
| 18 | P1 | Medium | Replay recorder wiring |
| 19 | P1 | Large | Raid director wiring (or cut) |
| 20 | P2 | Trivial | Night-mode settings toggle |
| 21 | P2 | Small | Keyboard-trick fallback, shop visual regression test |
| 22 | P2 | Medium | `BarkerCrowd` + `ZoneProps` for midway ambience |
| 23 | P2 | Medium | Banking/drop-off track shader for Hot Wheels plunge feel |
| 24 | P2 | Small | `RacingLineGhost` wiring |

## Open Questions for Maintainers

1. **Which track pipeline is canonical?** `src/render/Track.tsx` (procedural BufferGeometry,
   live) vs `src/track/trackComposer.ts` + `src/render/track/TrackSystem.tsx` (Kenney GLBs,
   orphan). Both exist; only one should.
2. **Critters: in or out?** They're a core vision beat (honk-scare, CRITTER achievements,
   Maestro flow exists) but require GLB assets that aren't shipped.
3. **Pickup `balloon` vs `ticket` naming** — is the ECS `balloon` kind a rendering
   distinction (balloon-shaped token) with ticket economy behind it, or two separate
   pickup types?
4. **Is RunPlan canonical** or is the live `seedContent`/ECS-streaming path canonical?
   The current duplication is the biggest code-smell in the codebase.
5. **Raids — scope.** Full raid director is implemented but unwired. Ship or strip?

## Appendix — Orphan File Inventory

The following files compile, have no type errors, and are NOT imported by any live
code path (confirmed with `rg` import-checks):

* `src/render/obstacles/ObstacleSystem.tsx`
* `src/render/obstacles/PickupSystem.tsx`
* `src/render/obstacles/BalloonLayer.tsx`
* `src/render/obstacles/MirrorLayer.tsx`
* `src/render/obstacles/FireHoopGate.tsx`
* `src/render/obstacles/RaidLayer.tsx`
* `src/render/obstacles/BarkerCrowd.tsx`
* `src/render/track/WorldScroller.tsx`
* `src/render/track/TrackSystem.tsx`
* `src/render/track/StartPlatform.tsx`
* `src/render/track/FinishBanner.tsx`
* `src/render/env/ZoneProps.tsx`
* `src/render/cockpit/RacingLineGhost.tsx`
* `src/game/useGameSystems.ts`
* `src/game/obstacles/obstacleSpawner.ts`
* `src/game/obstacles/critterPool.ts`
* `src/game/obstacles/balloonSpawner.ts`
* `src/game/obstacles/mirrorDuplicator.ts`
* `src/game/obstacles/raidDirector.ts`
* `src/game/obstacles/useObstacleFrame.ts`
* `src/game/obstacles/trackToWorld.ts`
* `src/game/replayRecorder.ts` (storage; recorder not running)
* `src/track/trackComposer.ts`
* `src/audio/conductor.ts` (never started)
* `src/audio/sf2.ts` (depends on conductor)

These represent ~3000+ LOC of dark code. Either wire them or delete them before the
next feature push — every day they stay orphaned, assumptions drift and the import
graph gets harder to reason about.
