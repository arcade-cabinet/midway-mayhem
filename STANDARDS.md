---
title: STANDARDS.md — Midway Mayhem Non-negotiables
updated: 2026-04-16
status: current
domain: technical
---

# Non-negotiable Standards

## Code

- **TypeScript strict.** `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch` all on.
- **No JS files.** `.ts` / `.tsx` only in `src/`, `e2e/`, `scripts/` (bpy exempt).
- **Max 300 LOC per file.** Anything bigger splits by responsibility.
- **Biome config is law.** Run `pnpm lint:fix` before every commit.

## Error discipline

- **No fallbacks, no silent catches.** Every failure reaches `errorBus.reportError(err, context)`.
- **No perf-tier branching.** PostFX runs on every device; if it can't, the modal surfaces it.
- **No dev-vs-prod rendering differences.** Same code path everywhere.

## Assets

- **All assets are in the manifest.** `src/assets/manifest.ts` is authoritative. Preloader hard-fails on missing assets with the specific path.
- **Models are baked, not retextured at runtime.** `scripts/bake-kit.py` runs offline; `public/models/` is the shipped result.
- **License compliance:** Kenney Racing Kit (CC0), Quaternius Ultimate Animated Farm Animals (CC0), PolyHaven circus_arena (CC0), GeneralUser GS 1.472 soundfont (permissive custom license), Bangers + Rajdhani typefaces (SIL OFL 1.1). Full credit list in `docs/LORE.md#credits`.

## Brand

- **Palette:** Red `#E53935`, Yellow `#FFD600`, Blue `#1E88E5`, Purple `#8E24AA`, Orange `#F36F21`, Night `#0B0F1A`. Non-negotiable.
- **Fonts:** Bangers (display) + Rajdhani (UI). No substitutes.
- **UI vocabulary:** SPEED→HYPE, HEALTH→SANITY, BOOST→LAUGH BOOST, SCORE→CROWD REACTION.
- **Zones:** Midway Strip → Balloon Alley → Ring of Fire → Funhouse Frenzy.
- **Name:** "Midway Mayhem: Clown Car Chaos". Tagline: "Drive fast. Honk louder."

## Testing

- **E2E asserts zero error modals.** Every spec calls `expectNoErrorModal(page)` at entry + exit.
- **Unit ≥ 65% line coverage** for `game/`, `systems/`, `utils/`.
- **Visual regression** for cockpit + zone banners (once baselines exist).
- **Governor autonomous run** ≥ 300m without dying, per zone smoke.

## Git

- **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`, `ci:`, `build:`.
- **Squash merge PRs.**
- **Never force-push main.** Never `--no-verify`.

## Never, ever

- Never check secrets into git.
- Never add runtime try/catch that swallows. (Carve-out: non-production cleanup paths like `resetDbForTests()` MAY ignore close() rejection because the DB handle is being nulled anyway — but such paths MUST be gated by an explicit "test-only" name + comment explaining why swallowing is safe here.)
- Never add a fallback rendering path.
- Never hand-drift the palette from `constants.ts`.
- Never claim a fix works without a passing test or a screenshot proving it.
- Never commit raw conversation dumps to the repo.
