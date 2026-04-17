---
title: CHANGELOG — Midway Mayhem
updated: 2026-04-16
status: current
domain: technical
---

# Changelog

All notable changes documented per [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). This project follows [Semantic Versioning 2.0.0](https://semver.org/).

## [Unreleased]

### Added
- Full test matrix: 75 tests across node + jsdom + real Chromium + Playwright desktop + Playwright mobile
- Full docs decomposition (CLAUDE.md, AGENTS.md, STANDARDS.md, docs/ARCHITECTURE.md, docs/DESIGN.md, docs/TESTING.md, docs/DEPLOYMENT.md, docs/LORE.md, docs/STATE.md)

## [0.1.0] — 2026-04-16

### Added
- Initial playable commit.
- Cockpit-perspective R3F scene inside full circus_arena HDRI big-top.
- Kenney Racing Kit track pieces baked with Midway Mayhem brand palette via `scripts/bake-kit.py`.
- `trackComposer.ts` snap-to-grid track assembly (start/straight/corner/ramp/end pieces).
- 5-type obstacle system (barrier, cones, gate, oil, hammer) + 3-type pickup system (boost, ticket, mega).
- Yuka.js autonomous governor for e2e playthroughs (`?governor=1`).
- Hard-fail error discipline: global ErrorModal + ErrorBus + React ErrorBoundary.
- Declarative asset manifest + preloader with hard-fail on 404.
- HUD (HYPE / DISTANCE / CRASHES / SANITY / CROWD REACTION) in Bangers + Rajdhani.
- Tone.js procedural audio bus (engine hum, honk, crash, pickup FX).
- Responsive camera FOV for portrait phones.
- Diagnostics bus at `window.__mm.diag()`.
- Camera-parented-to-cockpit architecture (fixes Gemini sail-glitch + hood-swallow bugs at the design level).

### Fixed — lessons from the prototype conversations
- Sail glitch: camera now rides inside the cockpit body group, no world-space chase.
- Hood-swallow: hood is a capped hemisphere at fixed Z never overlapping the dashboard plane.
- Mobile FOV zoom-in: `useResponsiveFov` adapts vertical FOV so horizontal FOV stays ≈90° on portrait.
- Cockpit scale drift on resize: all cockpit meshes live inside one `<Cockpit>` group.

### Stack
- React 19.2, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3
- Vite 6, TypeScript 5.7, pnpm 10.32
- Biome 2.4, Vitest 4, Playwright 1.51
- Tone.js 15, Yuka 0.7, zustand 5
- Capacitor 8 (Android + iOS)
- drizzle-orm + sql.js + @capacitor-community/sqlite (pinned for persistence work)
