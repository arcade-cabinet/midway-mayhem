---
title: Production Checklist
updated: 2026-04-23
status: current
domain: release
---

# Production Checklist

This document owns **release readiness**: what platforms we target, where each system sits on the path to launch, and what's still open post-1.0. Recent-release log lives in [STATE.md](./STATE.md). Vision in [DESIGN.md](./DESIGN.md), rules in [RULES.md](./RULES.md), tech in [ARCHITECTURE.md](./ARCHITECTURE.md), pre-submit QA in [LAUNCH_READINESS.md](./LAUNCH_READINESS.md), tag-and-publish flow in [RELEASE.md](./RELEASE.md).

## Release Targets

| Target | Requirement |
|--------|------------|
| Web | Debug-only development + CI preview surface |
| Android | Store-ready Capacitor build |
| iOS | Store-ready Capacitor build |
| Persistence | Capacitor SQLite (native) + sql.js WASM (web) |
| Accessibility | Tap-only play + reduced-motion mode honoured |
| Layout | Portrait phone (primary), landscape tablet, foldable, desktop |

## Implementation Status

The koota ECS world, R3F scene tree (cockpit, track, obstacles, environment, post-FX), procedural track generator, 4-zone system, persistence layer (SQLite/sql.js, drizzle-orm), test matrix (node + browser + Playwright e2e), CI/CD pipeline, release-please tagging, and dependabot automerge are all live on `main`.

This page tracks only what is **partial**, **still blocking store submission**, or **explicitly post-launch polish**. Completed work belongs in [STATE.md](./STATE.md) — don't leave stale TODOs here.

### Partial (gating future store submission)

| System | Status |
|--------|--------|
| Splash screen | Background color set; custom circus big-top art pending |
| App icon | `@capacitor/assets` pipeline not yet run; placeholder in place |
| Store listing metadata | Draft copy in `docs/store-listing.md`; screenshots TBD |
| Signing keys | Not yet in repo secrets — see `LAUNCH_READINESS.md` for key list |
| Android directory | `android/` not yet committed; requires `npx cap add android` |
| iOS IPA | CI Xcode build not yet configured (no macOS runner) |

## Current Remaining Work

### Brand / onboarding

- [ ] **Profile onboarding (D1)** — first-run name input + difficulty intro screen. No "you are launched into an unnamed run" cold start.
- [ ] **Difficulty selector copy + iconography** — Casual/Normal/Nightmare labels need brand-voice copy and visual tier differentiation beyond a plain list.
- [ ] **Title screen hero** — `public/ui/background-landing.png` is placeholder art. Final circus big-top composition with the polka-dot car descending needed before store screenshots.

### Visual journey / art direction

- [ ] **Cockpit final polish pass** — POC polka-dot hood identity preserved in v2; cockpit needs one final art review for dot scale, chrome reflectance, and dashboard readability at all form factors.
- [ ] **Zone transition cinematics** — zone banners are functional; the visual transition between zones (lighting shift, atmosphere change) needs a review pass at all four zone boundaries.
- [ ] **Obstacle art fidelity** — sawhorses and cones are placeholder geometry. Ring of Fire and Funhouse Frenzy obstacles need the full circus-themed art pass.
- [ ] **HUD polish** — SANITY and CROWD REACTION meters function; typography weight and color hierarchy at phone size needs a final review pass.
- [ ] **Audience / critter density** — Kenney CC0 critters are wired but not visible at expected density. Populate stands + track edges before screenshots.
- [ ] **Visual fixture review** — regenerate `pnpm test:browser` captures and review each slice as an art-directed scene, not just a functional component render.

### Content / authoring

- [ ] **Audio wiring** — `conductor.ts` and `sf2.ts` are compiled; the zone-aware phrase grammar is not yet triggered from the run lifecycle. Audio start + zone transition re-key must land before any playable build ships.
- [ ] **Combo + trick presentation** — combo multiplier logic compiles; the in-HUD streak counter and visual feedback (screen flash, score pop) are not yet built.
- [ ] **Achievement UI (D3)** — achievement toasts are wired; the full achievement browsing screen is not implemented.
- [ ] **Ticket Shop** — ticket economy is designed (RULES.md §10); the spend-side (cosmetic unlock screen) is not implemented.
- [ ] **Writer sign-off** — zone-name copy, Ringmaster raid announcement voice lines, game-over screen flavour text all need a brand/voice pass.
- [ ] **Splash screen custom art** — replace the temporary color-only splash.

### Release / ship blockers

- [ ] **Store metadata finalized** — copy + screenshots (`docs/store-listing.md`).
- [ ] **Signing keys** in repo secrets (Android keystore + Apple App Store API key — see `LAUNCH_READINESS.md`).
- [ ] **Physical device QA sign-off** on Android + iOS golden path.
- [ ] **`android/` directory committed** — `npx cap add android` + first sync.
- [ ] **iOS CI build** — macOS runner or Xcode Cloud integration for automated IPA.
- [ ] **`LAUNCH_READINESS.md` walked end-to-end**, with all sign-off rows filled.

### Engineering hygiene

- [ ] **`trackComposer.ts` deletion (PRQ G4)** — `PieceKind` type migration to `traits.ts`; file still has 10+ live imports.
- [ ] **Obstacle + pickup wiring audit** — several obstacle render layers compile but are not yet in App.tsx import tree (see `docs/STATE.md`).
- [ ] **100% node test coverage ≥ 65%** for `game/`, `ecs/systems/`, `utils/`.

## Recently Landed

- [x] **Descent coil (A-DESC-1)** — procedural track now descends 25–70m monotonically across zones 2–4; test-gated with elevation profile assertions.
- [x] **Track visual gate** — per-archetype deterministic golden-path screenshots; `TrackPackage.browser.test.tsx` side/plan/POV renders with pinned baselines.
- [x] **Cockpit structural integrity tests** — 9 blueprint invariant tests added.
- [x] **Visual matrix** — 8-slice deterministic POV baseline capture at `src/app/__baselines__/visual-matrix/`.
- [x] **Orphan code cleanup** — ~3000 LOC of dead v1 modules deleted across PRs #195–#205.
- [x] **ErrorModal mounted** — `errorBus` → `<ErrorModal>` path is live; hard-fail rule enforced in production.
- [x] **Reference port complete** — v1 reference → v2 port merged (PR #21); reference directory deleted.

## Release Artifacts

Each release ships with:

- Signed Android AAB (from `release.yml`)
- iOS xcarchive (from `release.yml`, manually signed for App Store submission)
- Web build deployed to GitHub Pages (from `cd.yml`)
- `CHANGELOG.md` entry for the version tag
- Native build notes and store metadata

## Ship / Re-tune Policy

All tuning values live in `src/config/tunables.json`. Once a tunable value is shipped in a store release, changes require a new version. There are no in-app balance patches — every change ships as a new version tag through the release-please flow.
