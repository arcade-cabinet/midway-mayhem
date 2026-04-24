---
title: Visual Baselines
updated: 2026-04-23
status: current
domain: quality
---

# Visual baseline index

All pinned PNGs referenced by visual-regression tests. **83 total.**

When a test fails with a baseline diff, find the baseline here and compare it to the `.test-screenshots/` output locally:

```sh
# regenerate locally (GPU required)
pnpm test:browser <SuiteName>
# compare at .test-screenshots/<subdir>/ vs src/.../__baselines__/<subdir>/
```

## Cockpit

### Per form factor
- `src/render/cockpit/__baselines__/desktop.png`
- `src/render/cockpit/__baselines__/phone-landscape.png`
- `src/render/cockpit/__baselines__/phone-portrait.png`
- `src/render/cockpit/__baselines__/tablet-portrait.png`

Gated by `src/render/cockpit/__tests__/cockpitBaselines.test.ts` (1.5% tolerance, 24/255 per-pixel threshold). The big-picture cockpit composite at each form factor.

### Per element (6 isolated captures)

Gated by `src/render/cockpit/__tests__/cockpitElementBaseline.test.ts` (15% tolerance, 32/255 per-pixel threshold). Each element rendered in isolation from a camera framed on it.

- `elements/steering-column.png` — wheel + hub + horn + spokes + column
- `elements/pillars-arch.png` — purple A-pillars meeting yellow arch
- `elements/dashboard.png` — dashCowl + LAUGHS/FUN gauges
- `elements/hood-flower.png` — polka-dot hood + 8-petal ornament
- `elements/mirror-dice.png` — rearview mirror + fuzzy dice
- `elements/seat.png` — red bench seat + yellow piping

### Pixel-exact region

Gated by `src/render/cockpit/__tests__/cockpitPixelExact.test.ts` (0% tolerance on inner 40% region). Catches any pixel drift in the deterministic cockpit core.

## Track

### Per archetype (16 captures)

Gated by `src/track/__tests__/trackArchetypeBaseline.test.ts` (15% tolerance).

8 archetypes × 2 camera angles (axonometric + side-elevation):

- `archetypes/{straight,slight-left,slight-right,hard-left,hard-right,dip,climb,plunge}.png`
- `archetypes/{straight,slight-left,slight-right,hard-left,hard-right,dip,climb,plunge}-side.png`

### Track package (3 composite views)

Gated by `src/track/__tests__/trackPackageBaseline.test.ts` (30% tolerance).

- `track-package/pov.png` — POV at d=0 looking down the track
- `track-package/side.png` — orthographic +X side elevation (shows descent coil)
- `track-package/plan.png` — orthographic -Y top-down (shows spiral footprint)

## Environment

### Zones (4 captures)

Gated by `src/render/env/__tests__/zoneBaseline.test.ts`.

- `zones/zone-midway-strip.png`
- `zones/zone-balloon-alley.png`
- `zones/zone-ring-of-fire.png`
- `zones/zone-funhouse-frenzy.png`

### Audience
- `src/render/env/__baselines__/plan.png` — top-down crowd instancing

### Bunting
- `src/render/env/__baselines__/bunting.png` — triangle-pennant strands

## Obstacles (6 captures)

Gated by the themed GLB harness.

- `obstacles/{cone,barrier,gate,oil,hammer,critter}.png`

## Visual-matrix × 4 form factors (32 captures)

Gated by `src/app/__tests__/visualMatrixBaseline.test.ts`.

For each of `{desktop, phone-portrait, phone-landscape, tablet-portrait}`:
- 8 distance slices: `slice-{040,080,120,180,250,320,400,480}m.png`

= 32 PNGs anchoring the full-scene integration at every major device viewport.

## Mid-run + POV

- `src/app/__baselines__/mid-run-desktop.png` — live-game frame at d≥120m (deterministic seed)
- `src/app/__baselines__/visual-matrix/player-pov.png` — cockpit POV sample

---

## Regeneration workflow

When a baseline drifts intentionally (e.g., you changed a material):

```sh
# 1. Run the browser suite, which writes to .test-screenshots/
pnpm test:browser <SuiteName>

# 2. Visually inspect the new output matches your intent.

# 3. Copy to baselines:
cp .test-screenshots/<suite>/*.png src/<path>/__baselines__/<suite>/

# 4. Verify the diff gate passes:
pnpm test:node <baselineTestName>

# 5. Commit both the new baselines + the code change in ONE PR so the
#    intent is visible.
```

## Adding a new baseline suite

1. Write a `.browser.test.tsx` that renders a deterministic scene + calls `commands.writePngFromDataUrl` to `.test-screenshots/<suite>/<name>.png`.
2. Write a companion `.test.ts` (node project) that reads both baseline and current and diffs via `pngjs`. See `cockpitElementBaseline.test.ts` as a template.
3. Pin initial baseline, commit both files.
4. Add the suite to this doc.
