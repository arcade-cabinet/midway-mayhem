---
title: Visual Review Workflow
updated: 2026-04-23
status: current
domain: ui
---

# Visual Review Workflow

## Purpose

Use this workflow to review the production visual output against the art direction — polka-dot clown car cockpit POV descending through a circus big-top — using stable, regenerated screenshots rather than ad hoc judgment.

---

## Export Commands

```bash
# Generate browser-surface screenshot captures (real Chromium GPU)
pnpm test:browser VisualMatrix        # 8-slice integrated POV matrix
pnpm test:browser TrackPackage        # track geometry in isolation (side / plan / POV)
pnpm test:browser CockpitBlueprint    # cockpit structural blueprint invariants

# Playwright e2e visual export (smoke + nightly)
pnpm e2e:smoke                        # title load + one-phrase boot
pnpm e2e:nightly                      # 3 phrases × 3 viewports × 15 frames
```

### Output locations

| Command | Writes to |
|---------|-----------|
| `pnpm test:browser VisualMatrix` | `.test-screenshots/visual-matrix/slice-NNNm.png` |
| `pnpm test:browser TrackPackage` | `.test-screenshots/track-package/{side,plan,pov}.png` + `archetypes/*.png` |
| `pnpm test:browser CockpitBlueprint` | `.test-screenshots/cockpit-blueprint/tier-*.png` |
| Nightly e2e | `test-results/<id>/playthrough/<phrase>/frame-NN.png` |

Exported screenshots are intentionally ignored by git. Pinned baselines live under `src/**/__baselines__/` and ARE committed.

---

## Current Fixture Set

### Integrated POV (visual-matrix)

8 distance checkpoints of the integrated scene: App + Cockpit + Track + TrackContent + StartPlatform + FinishBanner + feature layers + HUD, shot from the POV camera:

| Slice | Distance | Zone |
|-------|----------|------|
| slice-040m | 40m | Zone 1 — Midway Strip (tutorial, flat) |
| slice-080m | 80m | Zone 1 — Midway Strip |
| slice-120m | 120m | Zone 1 → Zone 2 boundary |
| slice-180m | 180m | Zone 2 — Balloon Alley |
| slice-250m | 250m | Zone 2 — Balloon Alley |
| slice-320m | 320m | Zone 3 — Ring of Fire (descent visible) |
| slice-400m | 400m | Zone 3 — Ring of Fire |
| slice-480m | 480m | Zone 4 — Funhouse Frenzy |

Seed: `lightning-kerosene-ferris` on NIGHTMARE difficulty. Deterministic across runs.

### Track geometry (track-package)

Three renders of the procedural track in isolation (no cockpit, no obstacles, no audience):

| Render | Camera | What to look for |
|--------|--------|-----------------|
| `side.png` | Orthographic, looking down +X | Descent profile: ribbon should slope downward monotonically from Zone 2 onward. Flat ribbon = descent regression. |
| `plan.png` | Orthographic, looking down −Y | Spiral footprint: the coil shape should be visible from above. |
| `pov.png` | POV at d=0 | First frame the player sees: track should be visible ahead, no clipping. |

Per-archetype baselines in `src/track/__baselines__/archetypes/` show each piece type in isolation.

### Cockpit structural (cockpit-blueprint)

Four form-factor tiers rendered without CSS animation (deterministic):

- `tier-phone.png` — 390 × 844 portrait
- `tier-tablet.png` — 834 × 1194 portrait
- `tier-foldable.png` — 717 × 1200 unfolded
- `tier-desktop.png` — 1440 × 900 landscape

---

## Review Targets

### Cockpit POV

- **Polka-dot hood visibility**: red base with yellow + blue dots clearly visible in lower third of POV. Dots should not be too large (dominating) or too small (invisible). This is the game's visual signature — protect it.
- **Dashboard readability**: SANITY and CROWD REACTION gauges readable at phone size without squinting.
- **Steering wheel chrome**: purple spokes visible; wheel turns with banking input.
- **Hood ornament**: squirting flower visible at center of hood.
- **No sail glitch**: camera is parented to the cockpit group — if the cockpit banks and the camera doesn't, that's a regression.

### Track descent

- **Descent visible in side elevation**: zone 2 onward should show a clear downward slope. Not a cliff, not flat — a sustained coil.
- **No Z-fighting**: track surface should not strobe where pieces meet.
- **Lane markings**: white lane markers visible at POV distance.
- **Zone visual transitions**: amber (zone 1) → pastel (zone 2) → deep red (zone 3) → strobing neon (zone 4).

### Zones and atmosphere

- **Zone 1 (Midway Strip)**: warm amber light, red-and-white arch props overhead. Crowd visible in bleachers.
- **Zone 2 (Balloon Alley)**: pastel sky transition. Balloon clusters flanking the track.
- **Zone 3 (Ring of Fire)**: deep red lighting. Fire hoop rings visible at timed intervals. Heat-shimmer postFX active.
- **Zone 4 (Funhouse Frenzy)**: strobing neon. Mirror layer doubling the track scene. High obstacle density.

### HUD overlay

- **SANITY meter**: top-left position; drains under obstacle contact.
- **CROWD REACTION counter**: prominent; responds to events.
- **Zone name banner**: visible at zone transition; auto-dismisses.
- **Pause button**: accessible on mobile portrait without thumb stretch.

### Form-factor compositions

- **Phone portrait**: 3+ lanes always visible. No lane clipped at edge. Cockpit not too large.
- **Tablet landscape**: wider FOV; audience bleachers should fill side space rather than leaving black margins.
- **Desktop**: same — atmospheric side-staging with the big-top canvas visible at edges.

### Color palette (locked — see DESIGN.md)

Every screen should be visually anchored by the brand palette. Check that screens are not drifting to unintended colors:

| Check | Target |
|-------|--------|
| Car body | Carnival Red `#E53935` |
| Hood dots | Gold Yellow `#FFD600` + Electric Blue `#1E88E5` |
| Track surface | Track Orange `#F36F21` |
| Background / Night | Night `#0B0F1A` |
| Steering wheel spokes | Clown Purple `#8E24AA` |

---

## Gap Analysis Worksheet

Each row owns one fixture + device profile combination. Fill in the **Gap** column after comparing the export against the design direction. Keep notes under 80 characters.

| Fixture | Device profile | Target | Gap (fill in) |
|---------|---------------|--------|---------------|
| slice-040m | desktop-chromium | Polka-dot hood visible, warm Zone 1 lighting | |
| slice-040m | mobile-portrait | Hood visible, 3+ lanes, HUD not clipped | |
| slice-320m | desktop-chromium | Descent slope visible, red Zone 3 lighting | |
| slice-320m | mobile-portrait | Track readable, SANITY/CROWD meters clear | |
| slice-480m | desktop-chromium | Mirror layer active, neon palette, chaos density | |
| side.png | (track only) | Downward slope zones 2–4; not flat, not cliff | |
| plan.png | (track only) | Coil spiral visible from above | |
| pov.png | (track only) | Track visible ahead, no clip at d=0 | |
| tier-phone | cockpit-blueprint | Hood lower third, wheel + gauges balanced | |
| tier-tablet | cockpit-blueprint | Wider composition; audience fills side space | |
| tier-desktop | cockpit-blueprint | Big-top canvas at edges; no dead black margins | |

### How to review

1. Run `pnpm test:browser VisualMatrix` and `pnpm test:browser TrackPackage` — produces captures.
2. Open each export side-by-side with the design reference in `docs/DESIGN.md` and `public/poc.html` (the 7-round HTML prototype).
3. Write the most important delta in the **Gap** cell (what is different, not what to do about it).
4. If a cell identifies a gap that needs code, open a sub-task.

---

## Change-log

- 2026-04-23 — Initial file; adapted from mean-streets VISUAL_REVIEW.md template. Midway Mayhem fixture set: visual-matrix (8-slice POV), track-package (side/plan/pov), cockpit-blueprint (4 form-factor tiers). Review targets tuned to circus big-top + polka-dot car identity.
