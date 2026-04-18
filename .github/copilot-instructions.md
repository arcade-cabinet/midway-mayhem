# GitHub Copilot Instructions — Midway Mayhem

This file defers to the authoritative agent docs. Read these before generating any code or docs:

- **[CLAUDE.md](../CLAUDE.md)** — project identity, architecture rules, commands, src/ layout
- **[AGENTS.md](../AGENTS.md)** — extended operating protocols, stack lock, state model, error handling, testing discipline

## Critical rules (summary — full detail in CLAUDE.md / AGENTS.md)

1. `.ts` = logic, `.tsx` = rendering, `.json` = data. No magic numbers in `.ts`.
2. One koota world is the entire state boundary. No second store for entity data.
3. No GLB road pieces. Track is procedural from JSON archetypes.
4. Hard-fail everywhere — no silent `.catch(() => {})`, no fallback rendering paths.
5. Every new system needs a test before merge. Browser screenshot test for every new render component.
6. Palette is locked. Never drift from the 6 colors in `src/utils/constants.ts`.
7. Fonts: Bangers (display) + Rajdhani (UI). No substitutes.
