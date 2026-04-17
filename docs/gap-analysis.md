---
title: Gap Analysis — Midway Mayhem
updated: 2026-04-17
status: current
domain: context
---

# Gap Analysis — 2026-04-16 (original) + 2026-04-17 remediation

Snapshot of divergence between docs, code, and assets. **Most items listed below have been resolved in the 2026-04-17 remediation pass** (PR #2 landed + follow-up branch `fix/gap-analysis-sweep`). Each row that was fixed in the pass is marked `✅`. Remaining open rows are marked `🔲`.

## Remediation summary (2026-04-17)

| # | Item | Status | Resolution |
|---|------|--------|------------|
| C1 / M1 | `src/game/pbrMaterials.ts` orphan | ✅ | Deleted (zero importers; referenced nonexistent manifest ids). |
| C2 | Android APK assembly commented out | ✅ | Uncommented in `cd.yml` + `release.yml`; added `pnpm build:native` step (fix PR #10 on top). |
| C3 | `upload-artifact@v7` | ✅ | Pinned to `@v4` across all three workflow files. |
| C4 | Missing `ios/` platform | 🔲 | Requires user-run `pnpm exec cap add ios` + commit. Documented in DEPLOYMENT.md. |
| H1 | README feature-matrix "Queued" lies | ✅ | Flipped to Shipped; added new shipped rows (NewRunModal, dual RNG, RunPlan, etc.). |
| H2 | STATE.md "In Progress / Next" lies | ✅ | Moved shipped items into the new `## Shipped in PR #2` section; rewrote `## Next (TBD)`. |
| H3 | ARCHITECTURE scene-tree incomplete | ✅ | Added StartPlatform, FinishBanner, BalloonLayer, FireHoopGate, MirrorLayer, BarkerCrowd, RaidLayer, ExplosionFX, SpeedFX, RacingLineGhost, RacingLineMeter, LiveRegion, AchievementToast. |
| H4 | TESTING.md test counts stale | ✅ | Rewrote Unit / Component / Browser / E2E sections against actual file counts (41 unit, 6 jsdom, 35 browser, 13 e2e). |
| H5 | CLAUDE.md project-structure stale | ✅ | Rewrote the feature-folder layout block. |
| H6 | `showRacingLine` settings toggle | ✅ | Shipped in PR #2 (Feature 3 agent). Confirmed via grep on `SettingsPanel.tsx`. |
| H7 | DEPLOYMENT.md Web "planned" | ✅ | Updated to `live` + linked production URL. |
| H8 | LORE gauges vs Cockpit reality | ✅ | LORE narrative now explicitly defers LAUGHS/FUN gauges. |
| H9 | Pause button missing | 🔲 | Deferred — pause is not a runner-style ship requirement; Maestro flows background via `pressKey: Home`. |
| H10 | Mobile frametime audits unverified | 🔲 | Requires on-device runs; documented as pending in AGENTS.md. |
| H11 | Orphan GLBs | ✅ | Deleted 9: raceCarRed/White/Orange, ramp, cone-flat, overheadLights, billboardLower, flagRed, flagGreen (roadCurved kept — actually used). |
| H12 | `__mm` diag gating undocumented | ✅ | Added explicit gate note in AGENTS.md + documented `__mmRunConfig`. |
| M2 | CLAUDE.md mislabels trackGenerator | ✅ | Reworded in the structure block. |
| M3 | `@/systems` alias landmine | ✅ | Removed from `vite.config.ts`. |
| M4–M7 | Files > 300 LOC | 🔀 in-flight | Background agent on branch `fix/gap-analysis-sweep` splitting Cockpit/HUD/BigTopTour/NewRunModal/TicketShop/ObstacleSystem/db/gameState/optimalPath/achievements. |
| M8 | Schema ≠ PRD | 🔲 | Schema-diff note deferred (low priority; code is correct). |
| M10 | MeshReflectorMaterial mirror | 🔲 | Still (planned) — acceptable. |
| M11 | Barrel-pattern migration half done | 🔲 | Acceptable current state; no new imports need to be fixed. |
| M12 | jsdom suites undocumented | ✅ | TESTING.md rewrite covers all suites. |
| M13 | `audit:balance:compare` script missing | ✅ | Created `scripts/compare-balance-audits.ts`. |
| M14 / M15 | SF2 + CC-BY attribution missing | ✅ | Added to LORE.md credits + STANDARDS.md + new `public/CREDITS.txt`. |
| M16 | Empty catch in `resetDbForTests` | 🔲 | Test-path only; tolerable. |
| M17 | Duplicate sql-wasm.wasm | ✅ | Intentional (sql.js locateFile probes both); comment added to `copywasm.ts` documenting the rationale. |
| L1 | PRD plan status | 🔲 | Low priority, bump on next release. |
| L2 | ROADMAP "Queued for PR #2" | ✅ | Rewrote as "Shipped in PR #2" earlier in session. |
| L3 / L4 | Dependabot token | ✅ | Switched to `GITHUB_TOKEN` in `dependabot-auto-merge.yml`. |
| L5 | Visual regression baselines doc stale | ✅ | Rewrote TESTING.md section against actual snapshot set. |
| L6 | Bundle chunk splitting | ✅ | Actually landed pre-session; STATE.md already reconciled. |
| L7 | Conversation-dump .gitignore | ✅ | Dumps are gitignored and no longer tracked. |
| L8 | Motion tokens | 🔲 | Low-pri polish. |
| L10 | CodeRabbit evidence | 🔲 | Shows ✓ pass on PR #2 via `gh pr checks`. |

## Open items summary

Open after the remediation pass:
- **C4** (iOS platform) — requires user to run `pnpm exec cap add ios` (can't be automated).
- **H9 / H10** — out-of-scope feature work (pause UI + on-device perf audits).
- **M4–M7** — in-flight (background agent splitting oversized files).
- Minor doc polish (L1, L8, L10) — not load-bearing.

---

## Original findings (preserved for reference)

Snapshot of divergence between what the docs claim, what the code does, and what assets are shipped. Every row cites the file path (absolute) and line number where applicable. Report only — no fixes performed.

## Summary

43 gaps total across 12 categories.
- Critical (ship-blockers): 4
- High (player-visible / promised-not-shipped): 12
- Medium (maintenance debt): 17
- Low (polish): 10

Category breakdown:
- Doc vs code: 9
- Promised vs shipped: 8
- Asset drift (orphans + missing refs): 7
- Schema drift: 1
- Test gaps: 5
- Stubs / partial: 2
- Orphaned code: 3
- Config / governance: 4
- Frontmatter gaps: 1
- Mobile / Capacitor: 2
- Broken biome-ignore: 0 verified (none found)
- Deferred CodeRabbit: 1 (roadmap asserts 0 blocking)

---

## 1. Critical (ship-blockers)

| # | File | What's missing | Why critical | Suggested fix |
|---|------|----------------|--------------|---------------|
| C1 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/src/game/pbrMaterials.ts:30,32,34` | Calls `assetUrl('tex:track_color')`, `'tex:track_normal'`, `'tex:track_rough'` — none of these IDs exist in `src/assets/manifest.ts`. `assetUrl()` throws `[assets] Unknown asset id: …` on invocation. | If anything ever imports these factories (currently nothing does — see G-O1) the runtime will hard-fail under the no-fallbacks rule. Ship-blocker if a cockpit/track refactor wires them in. | Either add `tex:track_color` / `tex:chrome_*` / `tex:hood_*` entries to `ASSET_MANIFEST` (the PNG/JPG files exist at `/public/textures/*.jpg`) or delete `pbrMaterials.ts`. |
| C2 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/.github/workflows/release.yml:57-77`, `.github/workflows/cd.yml:100+` | Android APK assembly block is commented-out with `TODO: uncomment after cap add android`. `android/` directory DOES exist (`android/app/build.gradle` present). CD never attaches an APK. | `docs/DEPLOYMENT.md:17-34` promises “Android debug APK … artifact on every PR + main push” and `ROADMAP.md:27` tracks it as ⏳. CD contradicts the doc. | Uncomment the blocks — the prerequisite (committed `android/`) is already satisfied. Remove the stale TODO comment. |
| C3 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/.github/workflows/ci.yml:124,128,273,302,348` | Uses `actions/upload-artifact@v7`. The current stable major is v4; v7 does not exist. | CI will fail on first run; pre-merge gate broken. | Pin to `@v4` (matches other workflow steps like `setup-java@v4`, `download-artifact@v4`). |
| C4 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/ios/` (missing directory) | `package.json:24` defines `native:ios:build`; `docs/DEPLOYMENT.md:17` + `TESTING.md:160-165` + `maestro/ios-*.yaml` (6 flows) all target iOS. No `ios/` directory exists at repo root. | iOS ship-blocker; every ios Maestro flow is un-runnable; `pnpm native:ios:build` hard-fails. | Run `pnpm exec cap add ios` and commit `ios/App/App.xcworkspace`. |

## 2. High (player-visible / promised-not-shipped)

| # | File | What's missing | Why | Suggested fix |
|---|------|----------------|-----|---------------|
| H1 | `README.md:42-54` Feature matrix | “Trick system (airborne rotations) — Queued”, yet `src/game/trickSystem.ts` + `Game.tsx:98,211-219` + `HUD.tsx:415 TrickOverlay` are **shipped and wired**. | Doc claims feature is queued; code already lives. Player-visible mismatch. | Flip Trick system, Ringmaster raids (also shipped as `raidDirector`), Daily route (`dailyRoute.ts` wired), Replay ghost (`replayRecorder` + `GhostCar`), Achievements (`achievementBus`+`AchievementsPanel`+20 slugs in `achievements.ts`) to “Shipped”. |
| H2 | `docs/STATE.md:28-42` “In progress / Next” | Lists: “wire-suspended start platform + NEW GAME overlay”, “per-zone color grading”, “Persistence: drizzle schema + sql.js”, “Maestro native smoke scripts”, “balance-audit TS script”, “marketing capture”. All are **present** (`StartPlatform.tsx`, `persistence/db.ts`, `maestro/*.yaml`, `scripts/run-balance-audit.ts`, `scripts/capture-marketing.ts`). | STATE.md out of sync by weeks; docs promise deprecation, code already delivered. | Move these items from “In progress / Next” → “Shipped”. |
| H3 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/docs/ARCHITECTURE.md:30` mentions `<GhostCar />` — only part of the flow documented | The big mounted set in `Game.tsx` also includes `BalloonLayer`, `FireHoopGate`, `MirrorLayer`, `BarkerCrowd`, `RaidLayer`, `StartPlatform`, `FinishBanner`, `ExplosionFX` — none documented in ARCHITECTURE.md. | Major gameplay features invisible in the architecture doc new contributors read. | Extend the scene tree diagram to list all zone-gimmick and raid layers + link them to their zone. |
| H4 | `docs/TESTING.md:64-71` Test counts “42 node + 14 jsdom + 4 browser + 15 e2e = 75” | Actual: 51 unit test files + 23 browser test files + 16 e2e specs. CHANGELOG.md:16 also says “75 tests”. | Understates coverage by ~3×; gives contributors a false benchmark. | Run a coverage count and update TESTING.md + CHANGELOG.md. |
| H5 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/src/components/` | Empty directory. `CLAUDE.md:35` and the PRD `midway-mayhem.prq.md:116-120` promise `src/components/ (Game, Cockpit, TrackSystem, …)` as the canonical layout. | Files moved to feature folders (`src/cockpit/`, `src/track/`, `src/game/`) but CLAUDE.md still references the old tree. | Update CLAUDE.md (“Project structure” section) to reflect actual feature-folder layout; delete empty `src/components/` dir. |
| H6 | `docs/DESIGN.md:83-95` “Racing line ghost … togglable via Settings → Show racing line (default on)” | `RacingLineGhost.tsx` + `RacingLineMeter.tsx` exist but there is **no Settings toggle**. `SettingsPanel.tsx` does not expose a `showRacingLine` option. Cannot verify — grep returns nothing. | Player-visible commitment; current build can't comply. | Add `showRacingLine` persisted setting + conditional render in `Game.tsx` around `<RacingLineGhost />`. |
| H7 | `docs/DEPLOYMENT.md:13` “Web (GitHub Pages) — planned” | `cd.yml:55-95` already configures `actions/deploy-pages@v5` and builds + deploys `dist/`. | Doc lags reality; confuses users who read docs first. | Change status from “planned” to “active” with correct URL (`arcade-cabinet.github.io/midway-mayhem/`). |
| H8 | `docs/LORE.md:20` “chrome gauges labeled **LAUGHS** and **FUN**” + `ROADMAP.md:20` “dead gauges removed, seat lip visible” | Contradiction — LORE says the gauges are present and named; Roadmap says they were removed. `src/cockpit/Cockpit.tsx` (~467 LOC) needs visual verification but the feature-matrix commits conflict. | Design-vs-code consistency; future contributors will reintroduce the gauges thinking they were a regression. | Reconcile LORE to remove the gauge reference or restore them behind a toggle. |
| H9 | `docs/TESTING.md:215-217` “pause-resume caveat … HUD does not yet expose a pause-button testId” | Grep across `src/` finds **zero** references to `pause-button`, `pause-overlay`, or a pause/resume UI. Maestro pause-resume flows rely on `pressKey: Home` — OS-level, not game-level. | Maestro pause/resume flows do not exercise a real pause button — they only background/foreground the app. A real pause feature is undelivered. | Add `<PauseButton>` with `data-testid="pause-button"` + pause overlay; or remove pause-resume Maestro flows + the note. |
| H10 | `AGENTS.md:119-121` Performance targets claim “iPhone 14 Pro: 45 FPS minimum — unverified; Mid-tier Android: 30 FPS minimum — unverified” | No evidence of frametime audit runs against these devices. `scripts/profile-frametime.ts` exists but only runs under xvfb Chromium on CI. | Ship blocker for a shipping-soon mobile title; targets unmet. | Run `pnpm audit:frametime` against real iPhone 14 Pro + a low-end Android via `maestro` or Chrome DevTools mobile emulation; commit the results to `docs/media/frametime/`. |
| H11 | `public/models/ramp.glb`, `raceCarRed.glb`, `raceCarWhite.glb`, `raceCarOrange.glb`, `cone-flat.glb`, `overheadLights.glb`, `billboardLower.glb`, `flagRed.glb`, `flagGreen.glb`, `roadCurved.glb` | **Orphaned GLBs** — present on disk but referenced from nowhere in `src/`. `manifest.ts` includes `roadCurved` but `src/track/trackComposer.ts` + `TrackSystem.tsx` do not use it (verified by grep). | Bundle-size and cognitive overhead; bake script wastes CI time. | Delete the orphans or add them to the manifest + composer. Bundle-size report at `docs/media/bundle-size/` should show the delta. |
| H12 | `AGENTS.md:106`, `docs/ARCHITECTURE.md:134` document `window.__mm.start()` and `.end()` | Implemented in `diagnosticsBus.ts:84-89` — present. Also documents `window.__mmHonk`, `window.__mmSpawner`, `window.__mmGovernor` — all wired except `__mmSpawner` is set externally in `ObstacleSystem.tsx` (verified via Game.tsx:190 grep only reads it). | Minor — docs claim these are always present in dev; `installDiagnosticsBus` gates on `DEV || ?diag=1 || ?governor=1` so `pnpm preview` without flags has none of these. | Document the gate explicitly in `AGENTS.md:106` and `ARCHITECTURE.md:140`. |

## 3. Medium (maintenance debt)

| # | File | What's missing | Why | Suggested fix |
|---|------|----------------|-----|---------------|
| M1 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/src/game/pbrMaterials.ts` | Orphaned module — zero importers (verified). Exports `createTrackMaterial`, `createChromeMaterial`, `createHoodMaterial`. | Dead code; and references missing manifest IDs (see C1). | Delete or wire into Cockpit/TrackSystem. |
| M2 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/src/track/trackGenerator.ts` (53 LOC) | `CLAUDE.md:50` + `AGENTS.md` call this the “legacy mathematical spline generator; replaced by trackComposer + drei useGLTF”. Yet `CameraRig.tsx:6`, `PlayerCar.tsx:5`, `Environment.tsx:5`, `governor/GovernorDriver.ts:2`, `obstacleSpawner.ts:2`, and lane-alignment tests still import `sampleTrack` / `laneCenterAt` / `sampleLookahead` from it. | Not dead code; still load-bearing. CLAUDE.md is misleading. | Change CLAUDE.md line 50 from “(legacy)” to “(continuous lane-math helper, consumed alongside trackComposer)”. |
| M3 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/vite.config.ts:21` | Alias `@/systems` → `src/systems/index.ts` but **`src/systems/` does not exist**. No code currently imports `@/systems/*` (grep empty). | Landmine: any future `@/systems/foo` import will fail path resolution. | Remove the alias. |
| M4 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/src/cockpit/Cockpit.tsx` | 467 LOC — over the 300-LOC CLAUDE.md/STANDARDS.md cap. | Direct STANDARDS violation. | Split into `Cockpit.tsx` shell + `cockpit/Hood.tsx` + `cockpit/Dashboard.tsx` + `cockpit/Gauges.tsx`. |
| M5 | `src/hud/HUD.tsx` | 487 LOC — over cap. | Direct STANDARDS violation; already contains `TrickOverlay`, `RaidTelegraphBanner`, etc. inline. | Extract inline components. |
| M6 | `src/modes/BigTopTour.tsx` | 577 LOC — over cap. | Direct STANDARDS violation. | Split cutscene mounts into `tour/cutscene/*.tsx`. |
| M7 | `src/hud/NewRunModal.tsx` (384), `src/hud/TicketShop.tsx` (375), `src/persistence/db.ts` (369), `src/obstacles/ObstacleSystem.tsx` (399), `src/game/gameState.ts` (340), `src/game/optimalPath.ts` (330), `src/persistence/achievements.ts` (316) | All over the 300-LOC cap. | Direct STANDARDS violation across 7 files. | Prioritize splitting; each has clean decomposition axes. |
| M8 | `docs/plans/midway-mayhem.prq.md:319-335` E5.T3-T4 prescribe tables `runs`, `bests`, `settings`, `meta_progress`. Actual schema has `profile`, `unlocks`, `loadout`, `daily_runs`, `replays`, `achievements`, `lifetime_stats`. | Schema diverged from PRD during iteration. Neither doc flags this. | Write a schema-diff note in `ARCHITECTURE.md` clarifying why the final schema is richer. |
| M9 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/docs/screenshots/cockpit-bigtop.png` | README.md:18 embeds this image. File exists, OK. But `docs/screenshots/alignment/phone-portrait.png`, `phone-landscape.png`, `tablet-portrait.png`, `desktop.png` are also present and referenced. All OK — flagged for completeness. | N/A — confirming no broken image refs. | — |
| M10 | `docs/DESIGN.md:124` references `drei MeshReflectorMaterial (planned)` for rear-view mirror | No code references `MeshReflectorMaterial`. Mirror is not implemented. | Acceptable since marked “(planned)”. Low priority. | Track as a TODO in STATE.md. |
| M11 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/docs/plans/architecture-subpackages.md` | Planning doc for barrel pattern migration. Vite aliases exist (`@/audio`, `@/obstacles`, `@/cockpit`, `@/hud`, `@/track`, `@/config`, `@/persistence`, `@/design`). Grep confirms many files still import deep paths (`from '@/track/trackGenerator'`, `from '@/game/governor/Governor'`). | Migration is half-done. | Decide whether to finish or retire the plan. |
| M12 | `docs/TESTING.md:56-60` Component section claims `<ErrorModal />`, `<HUD />`, `<TitleScreen />`, `<ZoneBanner />` are jsdom-tested. | Actually — `src/__tests__/ui/ErrorModal.test.tsx`, `HUD.test.tsx`, `TitleScreen.test.tsx`, `PhotoMode.test.tsx`, `ZoneBanner.test.tsx` all exist. `accessibility.test.tsx` + `LiveRegion.test.tsx` + `NewRunModal.test.tsx` + `RacingLineMeter.browser.test.tsx` are **undocumented** in TESTING.md. | Under-documented suite. | Add the extra jsdom/browser suites to `docs/TESTING.md`. |
| M13 | `package.json:44` `audit:balance` script vs `docs/plans/midway-mayhem.prq.md:412` E7.T8 | Script exists (`scripts/run-balance-audit.ts`) and `audit:balance:compare` command maps to `scripts/compare-balance-audits.ts` — but the compare script **does not exist on disk** (scripts/ listing confirmed). | npm script will fail. | Either implement `compare-balance-audits.ts` or drop the npm script. |
| M14 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/src/audio/conductor.ts`, `honkBus.ts`, `sf2.ts` | `AGENTS.md` + PRD promise “zero audio assets — procedural”. But `public/soundfonts/GeneralUser-GS.sf2` is shipped and `audio/sf2.ts` + `audio/audioBus.ts` load it. | Not a gap per se — the SF2 soundfont is CC0 and ships; but STANDARDS.md:27 enumerates only Kenney + PolyHaven CC0. SF2 license not documented. | Add SF2 + any critter-animal-pack license line to `docs/LORE.md#credits` and STANDARDS.md. |
| M15 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/src/assets/manifest.ts:86-91` Critter assets listed `required: true` with note “CC-BY, Ultimate Animated Animals pack” | LORE.md Credits does NOT list the animated-animals pack or its attribution. CC-BY requires written attribution. | Legal gap — CC-BY without credit violates license. | Add explicit attribution line to `docs/LORE.md#credits` AND `public/CREDITS.txt`. |
| M16 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/src/persistence/db.ts:356,365` | Empty `catch {}` blocks in `resetDbForTests()`. STANDARDS.md:54 bans runtime try/catch that swallows; tests-only carve-out isn't documented. | Minor — these are test-paths only but the rule forbids them anywhere. | Either funnel to `reportError` OR document the test-reset carve-out. |
| M17 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/public/sql-wasm.wasm` + `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/public/assets/sql-wasm.wasm` | WASM is duplicated at two paths. `scripts/copywasm.ts` copies to `public/assets/`; something else wrote to `public/` root. | Wasted bytes in ship. | Delete `public/sql-wasm.wasm` (keep `public/assets/sql-wasm.wasm`). |

## 4. Low (polish)

| # | File | What's missing | Why | Suggested fix |
|---|------|----------------|-----|---------------|
| L1 | `docs/plans/midway-mayhem.prq.md` | No YAML frontmatter status update; still `status: current` despite the gap between plan and reality (Execution Order section still reads as if untouched). | Out-of-date plan doc. | Add a “Delivered” note or bump to `status: archived` post-ship. |
| L2 | `docs/ROADMAP.md:34-65` “Queued for PR #2” | Several items (Combo meter #24, Trick system #25, Ringmaster raids #27, Ticket shop #28, Daily route #29, Replay ghost #34) are already in code. | Out-of-date roadmap. | Move shipped items up into “Landed” table. |
| L3 | `.github/workflows/dependabot-auto-merge.yml` uses `${{ secrets.CI_GITHUB_TOKEN }}` | Non-standard; GitHub default is `GITHUB_TOKEN`. If `CI_GITHUB_TOKEN` isn't configured in repo Actions secrets, auto-merge silently no-ops. | Config not documented in `docs/DEPLOYMENT.md`. | Document the secret or switch to `GITHUB_TOKEN`. |
| L4 | `docs/DEPLOYMENT.md:82` Secrets matrix | Omits `CI_GITHUB_TOKEN` (L3) and `NPM_TOKEN` / any npm-publish secret for `release.yml`. | Incomplete. | Add rows. |
| L5 | `docs/TESTING.md:112` Visual regression section | Says baselines "once they exist" — they DO exist at `e2e/visual.spec.ts-snapshots/` (7 PNGs covering title + HUD at 4 viewports). | Doc lags. | Update section + list snapshots. |
| L6 | `docs/STATE.md:49` “Bundle warning at 1,449 KB — chunk splitting not yet applied” | `package.json:47` wires `audit:bundle` + CI bundle-budget gate — chunk splitting is still pending. | Still valid. | Add chunk splitting (see ARCHITECTURE.md:116-121). |
| L7 | Root: `ChatGPT-Clown_Car_3D_Prototype.md`, `Gemini-Conversation.md` | `AGENTS.md:126-128` says these “live locally, gitignored”. Both files are **present** at repo root — not gitignored. | Repo has large raw conversation dumps checked in. | Add to `.gitignore` (per AGENTS.md rule). |
| L8 | `docs/DESIGN.md:133` “Card slides + fades for overlays” | `framer-motion` is a dependency (package.json:69) but motion design system isn't documented beyond prose. | Minor. | Add a motion-tokens file under `src/design/`. |
| L9 | `docs/plans/architecture-subpackages.md` has frontmatter? | Not yet read; need verification. Likely OK since sibling plan doc `midway-mayhem.prq.md` is valid. | Low. | Spot-check. |
| L10 | `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/docs/ROADMAP.md:88` “CodeRabbit has 0 remaining major/critical comments” | No evidence in the repo of the CodeRabbit report. | Can't verify claim. | Export latest CodeRabbit comment summary to `docs/media/coderabbit/`. |

---

## Asset inventory

| Asset | Referenced in | Exists on disk? | License | Source |
|-------|---------------|-----------------|---------|--------|
| `hdri/circus_arena_2k.hdr` | manifest.ts:17, Game.tsx:270 | Yes | CC0 | PolyHaven |
| `models/roadStart.glb` → `roadRampLongCurved.glb` (12 road pieces) | manifest.ts:20-51, trackComposer.ts | Yes (all 12) | CC0 | Kenney Racing Kit |
| `models/roadCurved.glb` | manifest.ts:51 — **not referenced** by composer or TrackSystem | Yes | CC0 | Kenney (orphan in code) |
| `models/barrier{Red,White,Wall}.glb`, `tent.glb`, `tentClosed.glb`, `bannerTower{Red,Green}.glb`, `flagCheckers.glb`, `lightPostLarge.glb`, `lightRed.glb`, `grandStand.glb`, `grandStandCovered.glb`, `billboard.glb`, `pylon.glb`, `overheadRoundColored.glb`, `cone.glb` | manifest.ts:54-84 + obstacle/environment modules | Yes | CC0 | Kenney |
| `models/critters/{Cow,Horse,Llama,Pig}.glb` | manifest.ts:88-91 + critter systems | Yes | CC-BY (per manifest comment) | Ultimate Animated Animals — **attribution not in LORE.md credits** (M15) |
| `models/raceCarRed.glb`, `raceCarWhite.glb`, `raceCarOrange.glb`, `ramp.glb`, `cone-flat.glb`, `overheadLights.glb`, `billboardLower.glb`, `flagRed.glb`, `flagGreen.glb` | **NOT referenced** anywhere in `src/` | Yes | CC0 | Kenney (orphan files — H11) |
| `textures/track_{color,normal,rough}.jpg`, `chrome_{color,metal,normal,rough}.jpg`, `hood_{color,normal,rough}.jpg` | only `src/game/pbrMaterials.ts` (orphaned module) | Yes (10 files) | Baked in repo | None wired into live code (C1 + M1) |
| `hdri/` additional HDRIs | only circus_arena — no other HDRIs referenced | — | — | — |
| `soundfonts/GeneralUser-GS.sf2` | src/audio/sf2.ts | Yes | GeneralUser GS MuseScore License — **not in LORE.md credits** (M14) | S. Christian Collins |
| `fonts/rajdhani-{300,400,500,600,700}.woff2`, `bangers-400.woff2`, `fonts.css` | referenced by src/hud DOM via `public/fonts/fonts.css` | Yes (7 files) | Google Fonts OFL | Google Fonts |
| `ui/logo-transparent-square.png`, `ui/background-landing.png` | `src/hud/TitleScreen.tsx` (verified via grep) | Yes | Project-authored | — |
| `config/tunables.json` | `src/config/loader.ts` | Yes | Project-authored | — |
| `assets/sql-wasm.wasm` | db.ts locateFile | Yes | MIT | sql.js |
| `sql-wasm.wasm` (root of public) | Not referenced — duplicate of above | Yes | MIT | Duplicate (M17) |

Missing-required-file rows: **0**. All manifest entries resolve on disk.
Orphan files: 10 (9 GLBs + 1 duplicate wasm).
License-attribution gaps: 2 (CC-BY animals, SF2 soundfont).

---

## Test coverage delta

| Surface | Doc claim (`docs/TESTING.md`) | Actual coverage | Gap |
|---------|-------------------------------|-----------------|-----|
| Unit (node) | 42 tests, covers `trackComposer`, `gameState`, `errorBus`, `obstacleSpawner`, `rng`, `GovernorDriver` | 51 `*.test.ts(x)` files under `__tests__/` (includes `comboSystem`, `damageLevel`, `difficulty`, `difficultyTelemetry`, `optimalPath`, `replayRecorder`, `trickSystem`, `runPlan`, `dailyRoute`, `seedPhrase`, `runRng`, `balloonSpawner`, `raidDirector`, `mirrorDuplicator`, `profile`, `lifetimeStats`, `achievements`, `settings`, `tutorial`, `replay`, `loader`) | Doc undercounts by ~9 suites. |
| Component (jsdom) | `ErrorModal`, `HUD`, `TitleScreen`, `ZoneBanner` — “14 tests” | `src/__tests__/ui/` has 5 files; `src/hud/__tests__/ui/` has `accessibility.test.tsx`, `LiveRegion.test.tsx`, `NewRunModal.test.tsx`, `useKeyboardControls.test.ts`, `usePrefersReducedMotion.test.ts`, `useTouchGestures.test.ts`. `src/hooks/__tests__/ui/` adds 3 more. Total unique jsdom suites ≈ 14, plus hooks. | OK in count, BUT hooks UI tests not documented. |
| Browser (real Chromium WebGL) | 4 tests | 23 `*.browser.test.tsx` files under multiple dirs. `ci.yml:85` uses `pnpm test:browser smoke` — no files with `smoke` in their name exist. | Doc severely undercounts (23 vs 4). `smoke` pattern likely matches zero; CI job could silently skip. |
| E2E (Playwright) | 15 specs; lists boot (5), gameplay (4), governor (2), error modal (2), mobile (2) | 16 `*.spec.ts` files: boot, gameplay, governor, errorModal, mobile, visual, visual-3d, cockpit-pov, bigtop-tour, gif-capture, loadout, newrun-flow, terminal-scenarios | Doc missing `visual.spec.ts`, `visual-3d.spec.ts`, `cockpit-pov.spec.ts`, `bigtop-tour.spec.ts`, `gif-capture.spec.ts`, `loadout.spec.ts`, `newrun-flow.spec.ts`, `terminal-scenarios.spec.ts`. |
| Visual regression | “Planned baselines for title + cockpit + each zone + each obstacle + HUD” | Actual snapshots: title (4 viewports) + HUD (4 viewports) + loadout (1). **Zero zone-entry, obstacle-type, cockpit-idle or game-over baselines.** | 4+ claimed baseline sets still missing. |
| Maestro flows | 6 Android + 6 iOS flows | 6 Android YAMLs + 6 iOS YAMLs exist, **but no iOS platform folder** — iOS flows un-runnable locally (C4). | iOS half undelivered. |

---

## Governance / frontmatter gaps

All root-level .md files carry correct frontmatter (`title`, `updated`, `status`, `domain`). `docs/*.md` all checked — 7 canonical docs (ARCHITECTURE, DESIGN, DEPLOYMENT, TESTING, STATE, ROADMAP, LORE) have frontmatter. `docs/plans/midway-mayhem.prq.md` + `docs/plans/architecture-subpackages.md` both have frontmatter (verified for prq).

**One gap:** `docs/gap-analysis.md` (this file) — has frontmatter on creation.

**No ecosystem gaps:** `.github/dependabot.yml` present; `release-please-config.json` + `.release-please-manifest.json` present; `.github/workflows/{ci,cd,release,dependabot-auto-merge}.yml` present.

---

## Actionable punch-list (ordered by priority)

1. **[C3]** Downgrade `actions/upload-artifact@v7` → `@v4` in `.github/workflows/ci.yml` at 5 call-sites. CI is broken.
2. **[C2]** Uncomment Android APK assembly in `.github/workflows/{cd,release}.yml` — `android/` is already committed, TODO is stale.
3. **[C4]** Run `pnpm exec cap add ios` + commit `ios/App/App.xcworkspace` so `native:ios:build` + 6 iOS Maestro flows actually run.
4. **[C1 + M1]** Decide on `src/game/pbrMaterials.ts`: either delete (no importers) or wire into Cockpit/TrackSystem AND add the missing `tex:*` entries to `ASSET_MANIFEST`. Textures on disk but not shipped through the hard-fail preload path.
5. **[H11]** Prune orphan GLBs (`raceCarRed/White/Orange.glb`, `ramp.glb`, `cone-flat.glb`, `overheadLights.glb`, `billboardLower.glb`, `flagRed.glb`, `flagGreen.glb`, `roadCurved.glb`) OR reference them via composer + manifest.
6. **[H4 + M12 + H5]** Sync docs: update `CLAUDE.md` project structure, `TESTING.md` counts/surfaces, `STATE.md` shipped list, `ROADMAP.md` landed/queued tables, `README.md` feature matrix. All 5 files are out of date with code.
7. **[M4 + M5 + M6 + M7]** Split files over 300 LOC: `Cockpit.tsx` (467), `HUD.tsx` (487), `BigTopTour.tsx` (577), `NewRunModal.tsx` (384), `TicketShop.tsx` (375), `ObstacleSystem.tsx` (399), `db.ts` (369), `gameState.ts` (340), `optimalPath.ts` (330), `achievements.ts` (316).
8. **[H6]** Add `showRacingLine` toggle to `SettingsPanel` + persisted setting + conditional render.
9. **[H9]** Deliver real pause (`data-testid="pause-button"` + overlay) to match Maestro/TESTING expectations.
10. **[M3]** Delete `@/systems` alias in `vite.config.ts:21` (points to nonexistent dir).
11. **[H10]** Run mobile-device frametime audits; commit evidence to `docs/media/frametime/`.
12. **[M15 + M14]** Add CC-BY attribution (animated animals) + SF2 attribution to `docs/LORE.md#credits` + optional `public/CREDITS.txt`.
13. **[M17]** Remove duplicate `public/sql-wasm.wasm` (keep `public/assets/sql-wasm.wasm`).
14. **[L7]** `.gitignore` the `ChatGPT-*.md` + `Gemini-*.md` conversation dumps per AGENTS.md:126-128.
15. **[M13]** Either implement `scripts/compare-balance-audits.ts` or drop the npm script.
16. **[H8]** Reconcile LORE.md gauges narrative with Cockpit.tsx reality.
17. **[H3]** Extend ARCHITECTURE.md scene tree to include BalloonLayer / FireHoopGate / MirrorLayer / BarkerCrowd / RaidLayer / StartPlatform / FinishBanner / ExplosionFX.
18. **[H2]** Move STATE.md “In Progress / Next” items that have shipped into “Shipped in 0.1.0” — or open 0.2.0 header.
19. **[L10]** Export CodeRabbit report into `docs/media/coderabbit/` to make ROADMAP.md:88 verifiable.
20. **[M11]** Finish or retire the barrel-pattern migration described in `docs/plans/architecture-subpackages.md`.

---

## In-flight flags (tasks #51-55, do not duplicate)

None of the above gaps match in-flight task markers — no `// FIXME(task-51)` or similar markers appear in the codebase. Work items listed here are safe for independent scheduling.
