---
title: Docs Gap Analysis — Midway Mayhem
updated: 2026-04-18
status: current
domain: context
---

# Docs Gap Analysis — Midway Mayhem

Audited against the global CLAUDE.md "Required Project Files" standard.

---

## 1. Checklist

### Root-level docs

| File | Required? | Present? | Has frontmatter? | FM correct? | Status |
|------|-----------|----------|-----------------|-------------|--------|
| CLAUDE.md | yes | yes | yes | yes (updated: 2026-04-17) | current |
| AGENTS.md | yes | yes | yes | yes (updated: 2026-04-16) | **stale** (see §3) |
| README.md | yes | yes | yes | yes (updated: 2026-04-17) | current |
| CHANGELOG.md | yes | yes | yes | yes (updated: 2026-04-18) | current |
| STANDARDS.md | yes | yes | yes | yes (updated: 2026-04-16) | current |

### Governance files

| File | Required? | Present? | Status |
|------|-----------|----------|--------|
| .github/dependabot.yml | yes | yes | present |
| release-please-config.json | yes | yes | present |
| .release-please-manifest.json | yes | yes | present |
| .github/workflows/ci.yml | yes | yes | present |
| .github/workflows/release.yml | yes | yes | present |
| .github/workflows/cd.yml | yes | yes | present |

### AI tool config files

| File | Required? | Present? | Status |
|------|-----------|----------|--------|
| .github/copilot-instructions.md | yes | **no** | **MISSING** |
| .cursor/rules | yes | **no** | **MISSING** |
| .claude/settings.json | yes | yes | present |

### Domain docs in `docs/`

| File | Required? | Present? | Has frontmatter? | FM correct? | Status |
|------|-----------|----------|-----------------|-------------|--------|
| docs/ARCHITECTURE.md | yes | **no** | — | — | **MISSING** |
| docs/DESIGN.md | yes | **no** | — | — | **MISSING** |
| docs/TESTING.md | yes | **no** | — | — | **MISSING** |
| docs/DEPLOYMENT.md | yes | **no** | — | — | **MISSING** |
| docs/LORE.md | yes | **no** | — | — | **MISSING** |
| docs/STATE.md | yes | **no** | — | — | **MISSING** |
| docs/porting-map.md | no (extra) | yes | yes | yes (updated: 2026-04-18) | current |

### Root-level stale/cleanup candidates

| File | Required? | Present? | Status |
|------|-----------|----------|--------|
| ChatGPT-Clown_Car_3D_Prototype.md | no | yes | **stale / misplaced** |
| Gemini-Conversation.md | no | yes | **stale / misplaced** |

---

## 2. Missing docs — content outlines

### docs/ARCHITECTURE.md
- System diagram: R3F scene tree, ECS world (koota), audio buses, persistence layer, Capacitor bridge
- Data flow: input → ECS tick → render pipeline → HUD; persistence write path on runEnd
- Build output anatomy: web (OPFS + sql.js) vs native (Capacitor + CapacitorSQLite)
- Module boundaries: what lives in `game/`, `render/`, `ecs/`, `audio/`, `track/`, `persistence/`

### docs/DESIGN.md
- Reconciled vision from Gemini + ChatGPT conversation inputs: polka-dot identity, cockpit POV, big-top world
- Brand pillars: palette (6 colors from STANDARDS.md), fonts (Bangers + Rajdhani), UI vocabulary (HYPE/SANITY/CROWD REACTION)
- What Midway Mayhem IS and IS NOT (arcade not sim, circus not kart, mobile-first not desktop-only)
- Zone progression + sensory intent per zone (lighting, audio phrase grammar, obstacle set)

### docs/TESTING.md
- 4-tier pyramid: node unit → jsdom component → Vitest browser (real Chromium GPU) → Playwright e2e
- Coverage targets (≥65% line coverage for `game/`, `systems/`, `utils/`)
- How to run each tier (`pnpm test:node`, `pnpm test:browser`, `pnpm test:e2e`)
- Governor playthrough contract (≥300m without dying, expectNoErrorModal at entry/exit)

### docs/DEPLOYMENT.md
- Web deploy: Vite build → dist/, static hosting, BASE_URL rules
- Android: Capacitor sync → Gradle assembleDebug/Release, APK artifact path
- iOS: Capacitor sync → Xcode archive workflow
- Secrets / env vars needed (none at present — note explicitly)

### docs/LORE.md
- World: circus big-top, Hot Wheels mega-track, wire-hung start platform
- Characters: the polka-dot clown car, Ringmaster (raid announcer), crowd critters (chicken, bear, mime, seal, clown)
- Zone lore: brief narrative for each zone (Midway Strip, Balloon Alley, Ring of Fire, Funhouse Frenzy)
- Credits: Kenney Racing Kit CC0, PolyHaven circus_arena CC0, GeneralUser GS soundfont license, Bangers/Rajdhani SIL OFL 1.1

### docs/STATE.md
- Port status: reference → v2 complete (PR #21 merged); `reference/` deleted
- What is done vs not done (feature matrix cross-ref with README.md feature table)
- Known issues / open questions: iPhone 14 Pro + mid-tier Android FPS unverified, visual regression baselines not yet captured
- Next planned work: cockpit hero procedural pass (Blender prototype first per MEMORY)

---

## 3. Stale content in existing docs

### AGENTS.md (updated: 2026-04-16) — specific outdated claims

1. **Stack lock table — ECS row**: says "zustand + plain modules (koota reserved for future entity graph)". The codebase has `src/ecs/world.ts` and `src/ecs/traits.ts` confirming koota IS the ECS now. `gameState.ts` still uses zustand for the session/player store, but the ECS column claim is misleading. Update to reflect actual split: koota for entity/trait graph, zustand for reactive session state shim (`useGameStore`).

2. **Asset pipeline section**: describes `scripts/bake-kit.py` but this file does not exist at `scripts/bake-kit.py` — the scripts directory contains only `maestro-all.sh`, `playthrough-governor.ts`, `vite-capture-plugin.ts`, and `vitest-write-png-command.ts`. The bake-kit pipeline may have been dropped or gitignored. This entire section may be stale.

3. **Asset pipeline section**: references `public/models/` for baked GLBs, but `public/models/` does not exist. Rule 3 in CLAUDE.md says "No GLB road pieces. Track geometry is generated procedurally." The bake pipeline described in AGENTS.md directly contradicts the architecture rule in CLAUDE.md.

4. **State model section**: describes a `zustand store (src/systems/gameState.ts)` with `session`, `player`, `derived`, `boost` slices. The file is now at `src/game/gameState.ts` (not `src/systems/`). The path reference is stale.

5. **What does NOT live in this repo**: says "Raw conversation dumps (`ChatGPT-*.md`, `Gemini-*.md`) … are gitignored." — they are NOT gitignored; both files exist at root as untracked but present files (verified by directory listing). The claim is contradicted by their presence.

### CLAUDE.md (updated: 2026-04-17) — specific outdated claims

1. **Current layout — audio**: says `audio/ — procedural Tone.js (no soundfonts)`. The CHANGELOG and README both confirm `spessasynth_lib SF2 sampler` is present. `src/audio/sf2.ts` exists as an untracked file. The "(no soundfonts)" parenthetical is false.

2. **Current layout — src**: does not list `track/`, `design/`, `hooks/`, `input/`, `persistence/`, `storage/`, `ui/` directories which all exist under `src/`. Layout is materially incomplete post-port.

---

## 4. Root-level stale file cleanup recommendations

### ChatGPT-Clown_Car_3D_Prototype.md and Gemini-Conversation.md

Both are raw LLM conversation dumps that pre-date the v2 architecture. STANDARDS.md explicitly states "Never commit raw conversation dumps to the repo." AGENTS.md says they are "gitignored" but they are not — they are present and untracked.

Recommended action: delete both files from the working tree and add their filename patterns to `.gitignore` to prevent re-addition. The design intent they captured has been reconciled into docs/DESIGN.md (once that doc is written) and into AGENTS.md's "Origin + vision reconciliation" section.

Do NOT move them to `docs/` — they are input artifacts, not documentation.

---

## 5. Summary counts

- Root docs: 5/5 present, 0 missing, 1 stale (AGENTS.md)
- Governance: 6/6 present
- AI tool configs: 1/3 present, 2 missing (.github/copilot-instructions.md, .cursor/rules)
- Domain docs: 0/6 present, **6 missing** (ARCHITECTURE, DESIGN, TESTING, DEPLOYMENT, LORE, STATE)
- Cleanup: 2 conversation dumps at root should be deleted and gitignored
