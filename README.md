---
title: Midway Mayhem — Clown Car Chaos
updated: 2026-04-16
status: current
domain: product
---

# Midway Mayhem: Clown Car Chaos

> Drive fast. Honk louder.

Cockpit-perspective arcade driver where you race a polka-dot clown car down a Hot Wheels mega-track inside a circus big-top. Avoid obstacles, grab boosts, collect tickets, don't lose your SANITY.

## Tech stack

- React 19 + React Three Fiber + drei + @react-three/postprocessing
- Vite + TypeScript + pnpm + Biome
- Tone.js procedural audio
- Capacitor SQLite (native) / sql.js (web) via drizzle-orm
- Capacitor 8 for Android + iOS
- Vitest (node+jsdom+browser) + Playwright with Yuka.js autonomous-driver governor

## Running locally

    pnpm install
    pnpm dev

URL flags:

- `?skip=1` — skip title screen
- `?governor=1` — autonomous Yuka driver
- `?diag=1` — expose window.__mm.diag() for telemetry

## Rebake the asset kit

Models are baked with the Midway Mayhem brand palette via scripts/bake-kit.py. Re-run via Blender MCP or CLI.

## Error handling

Hard-fail: every error surfaces in a global modal with testid `error-modal`. No silent fallbacks.
